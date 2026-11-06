import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { addDays, zonedToUtc } from '../../core/time'
import { openThoughts, reviewDue } from '../../core/evening'
import { routineBlock } from '../../core/planner'
import { resolveTask, taskIsActionable, taskIsOpen, taskTitle } from '../../core/tasks'
import type { InboxItem, TaskRef } from '../../core/types'
import { planFor, today, useApp } from '../../state/store'
import { useNow } from '../../state/hooks'
import { ParkedThoughts } from '../components/EveningTools'
import { InboxSheet } from '../components/Shell'
import { RestingTasks, TaskCard, TaskLearning, useTaskAction } from '../components/TaskDetails'
import { Button, Card, Page, Section } from '../components/ui'

/** Gedanken bleiben Notizen, bis du sie ausdrücklich einplanst oder verknüpfst. */
export default function Inbox() {
  const st = useApp()
  const now = useNow(1000)
  const d = today()
  const open = openThoughts(st.inbox, now).sort((a, b) => a.createdAt - b.createdAt)
  const parked = st.inbox.filter((item) => item.status === 'open' && Number.isFinite(new Date(item.reviewAt ?? NaN).getTime()) && item.reviewAt! > now).sort((a, b) => a.reviewAt! - b.reviewAt!)
  const tasks = st.inbox.filter((item) => item.status === 'task' && taskIsOpen(item))
  const currentTasks = tasks.filter((task) => (task.state === 'active' || (task.taskDate ?? d) <= d) && taskIsActionable(task, now))
  const laterTasks = tasks.filter((task) => !currentTasks.includes(task))
  const doneToday = st.inbox.filter((item) => item.status === 'task' && item.done && item.doneAt !== undefined && now - item.doneAt < 24 * 3600_000)
  const kept = st.inbox.filter((item) => item.status === 'kept')
  const [left, setLeft] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const { busy, error, run } = useTaskAction()
  useEffect(() => {
    if (left === null || left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])
  useEffect(() => {
    if (left === null || open.length > 0) return
    const step = routineBlock(planFor(d), 'evening')?.steps?.find((item) => item.tag === 'inbox')
    if (step && !st.days[d]?.steps[`evening:${step.id}`]) void st.setStep(d, 'evening', step.id, 'done')
    setLeft(null)
  }, [left, open.length, d, st])
  return <Page title="Gedanken" actions={<Button size="sm" onClick={() => setAdding(true)}>+ Neu</Button>}>
    {open.length > 0 && <Card className="flex items-center gap-3"><div className="flex-1"><p className="font-semibold">{open.length} offene Gedanken</p><p className="text-sm text-muted">{left === null ? '2 Minuten Durchsicht, ohne Bewertung.' : `Noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p></div>{left === null && <Button variant="primary" onClick={() => setLeft(120)}>Durchsehen</Button>}</Card>}
    {open.length === 0 && <p className="px-1 text-lg text-muted">Alles festgehalten. Du entscheidest, was daraus wird.</p>}
    <Section>{open.map((item) => <NoteCard key={item.id} item={item} due={reviewDue(item, now)} />)}</Section>
    {parked.length > 0 && <Section title="Für später geparkt" hint="Bis zur gewählten Zeit ruht die Idee. Du kannst sie früher ansehen."><ParkedThoughts items={parked} now={now} /></Section>}
    {tasks.length > 0 && <Section title="Eingeplant">{currentTasks.map((task) => <TaskCard key={task.id} taskRef={{ kind: 'task', id: task.id }} task={task} />)}{laterTasks.length > 0 && <details><summary className="min-h-11 py-2 text-muted">Für später vorgemerkt ({laterTasks.length})</summary><div className="space-y-2">{laterTasks.map((task) => <TaskCard key={task.id} taskRef={{ kind: 'task', id: task.id }} task={task}><p className="text-xs text-muted">{task.taskDate === addDays(d, 1) ? 'Für morgen vorgemerkt' : task.taskDate ? `Vorgemerkt für ${task.taskDate}` : 'Von dir für später geparkt'}</p></TaskCard>)}</div></details>}</Section>}
    {doneToday.length > 0 && <Section title="Erledigt">{doneToday.map((task) => <Card key={task.id} className="space-y-2"><p className="break-words text-muted">{task.text}{task.doneMode === 'minimal' ? ' · kleine Version' : ''}</p><Button size="sm" disabled={busy} aria-label={`${task.text} zurücknehmen`} onClick={() => run(() => st.completeTask({ kind: 'task', id: task.id }, false))}>Erledigung zurücknehmen</Button></Card>)}</Section>}
    <RestingTasks tasks={st.inbox.filter((item) => item.status === 'task')} kind="task" />
    {kept.length > 0 && <Section title="Behalten">{kept.map((item) => <NoteCard key={item.id} item={item} />)}</Section>}
    <TaskLearning />
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <InboxSheet open={adding} onClose={() => setAdding(false)} />
  </Page>
}

function NoteCard({ item, due = false }: { item: InboxItem; due?: boolean }) {
  const st = useApp()
  const d = today()
  const [date, setDate] = useState(addDays(d, 1))
  const [selected, setSelected] = useState('')
  const { busy, error, message, run } = useTaskAction()
  const linked = item.linkedTo ? resolveTask(item.linkedTo, st.inbox, st.local.work) : undefined
  const choices: { ref: TaskRef; title: string }[] = [
    ...st.inbox.filter((task) => task.id !== item.id && task.status === 'task' && taskIsOpen(task)).map((task) => ({ ref: { kind: 'task' as const, id: task.id }, title: task.text })),
    ...st.local.work.filter(taskIsOpen).map((task) => ({ ref: { kind: 'work' as const, id: task.id }, title: task.title })),
  ]
  const plan = (date: string) => run(async () => { await st.updateInbox(item.id, { status: 'task', taskDate: date, estimateMin: item.estimateMin ?? 5, state: date > d ? 'deferred' : 'pending', deferredUntil: date > d ? zonedToUtc(date, 240) : undefined, source: item.source ?? { kind: 'capture' } }); st.showToast('Als Aufgabe vorgemerkt.') })
  return <Card className="min-w-0 space-y-3">
    <p className="break-words text-lg">{item.text}</p>
    {due && <p className="text-sm text-muted">Für jetzt wieder vorgelegt. Du entscheidest, was daraus wird.</p>}
    {item.linkedTo && <p className="text-sm text-muted">{linked ? <>Verknüpft mit: <Link className="underline" to={`/aufgabe/${item.linkedTo.kind}/${encodeURIComponent(item.linkedTo.id)}`}>{taskTitle(linked)}</Link></> : 'Die verknüpfte Aufgabe ist hier nicht mehr vorhanden. Deine Notiz bleibt erhalten.'}</p>}
    <div className="flex flex-wrap gap-2">
      {item.status !== 'kept' && <Button size="sm" disabled={busy} onClick={() => run(() => st.updateInbox(item.id, { status: 'kept' }))}>Behalten</Button>}
      <Button size="sm" disabled={busy} onClick={() => plan(addDays(d, 1))}>Morgen erledigen</Button>
      <Button size="sm" variant="ghost" disabled={busy} aria-label="Zur Arbeit verschieben" onClick={() => run(async () => { await st.moveInboxToWork(item.id); st.showToast('Liegt jetzt bei der Arbeit, nur auf diesem Gerät.') })}>Arbeit</Button>
      <Button size="sm" variant="ghost" disabled={busy} aria-label="Löschen" onClick={() => run(() => st.removeInbox(item.id))}>Löschen</Button>
    </div>
    <details><summary className="min-h-10 py-2 text-sm text-muted">Tag wählen oder verknüpfen</summary><div className="space-y-3 pt-2">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (date) void plan(date) }}><label className="min-w-0 flex-1 space-y-1"><span className="block text-sm text-muted">Gewählter Tag</span><input type="date" aria-label="Gewählter Aufgabentag" value={date} required className="min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3" onChange={(event) => setDate(event.target.value)} /></label><Button type="submit" size="sm" disabled={busy || !date}>Für diesen Tag einplanen</Button></form>
      {choices.length > 0 && <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const target = choices.find((choice) => `${choice.ref.kind}:${choice.ref.id}` === selected)?.ref; if (target) void run(() => st.linkInbox(item.id, target), 'Notiz verknüpft.') }}><label className="block space-y-1"><span className="text-sm text-muted">Mit vorhandener Aufgabe verbinden</span><select aria-label="Mit vorhandener Aufgabe verbinden" className="min-h-12 w-full min-w-0 max-w-full rounded-xl bg-surface-2 px-3" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Aufgabe wählen</option>{choices.map((choice) => <option key={`${choice.ref.kind}:${choice.ref.id}`} value={`${choice.ref.kind}:${choice.ref.id}`}>{choice.ref.kind === 'work' ? 'Arbeit: ' : ''}{choice.title}</option>)}</select></label><Button type="submit" size="sm" disabled={busy || !selected}>Notiz verknüpfen</Button></form>}
    </div></details>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Card>
}
