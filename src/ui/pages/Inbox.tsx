import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { thoughtCount } from '../../core/uiText'
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
import { Button, Card, Choice, DateField, Page, Section, Segmented, TextInput } from '../components/ui'

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
  const [tab, setTab] = useState<'thoughts' | 'tasks'>('thoughts')
  const [text, setText] = useState(() => st.local.captureDraft?.text ?? '')
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
  const capture = () => run(async () => {
    if (!text.trim()) throw new Error('Trage deinen Gedanken ein. Ein paar Worte genügen.')
    await st.saveCaptureDraft(text, useApp.getState().local.captureDraft?.context)
    const id = await st.addInbox(text)
    if (!id) throw new Error('Der Gedanke konnte noch nicht gespeichert werden. Dein Text bleibt hier.')
    setText(''); setTab('thoughts'); st.showToast('Gedanke gespeichert.')
  })
  return <Page title="Gedanken">
    <form aria-label="Gedanke schnell festhalten" className="min-w-0 space-y-2" onSubmit={event => { event.preventDefault(); void capture() }}>
      <label className="block space-y-1"><span className="text-sm text-muted">Was geht dir durch den Kopf?</span><TextInput aria-label="Gedanke festhalten" placeholder="Ein Gedanke genügt …" value={text} onChange={event => setText(event.target.value)} onBlur={() => { if (text.trim()) void st.saveCaptureDraft(text, useApp.getState().local.captureDraft?.context).catch(() => st.showToast('Dein Entwurf konnte noch nicht gespeichert werden.')) }} /></label>
      <div className="flex gap-2"><Button type="submit" variant="primary" disabled={busy} className="flex-1">Merken</Button><Button aria-label="Gedanke mit Optionen festhalten" variant="ghost" onClick={() => void run(async () => { if (text.trim()) await st.saveCaptureDraft(text, useApp.getState().local.captureDraft?.context); setAdding(true) })}>⋯</Button></div>
    </form>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <Segmented<'thoughts' | 'tasks'> label="Gedankenbereich" value={tab} onChange={setTab} options={[{ value: 'thoughts', label: 'Gedanken' }, { value: 'tasks', label: 'Private Aufgaben' }]} />
    {tab === 'thoughts' ? <>
      {open.length > 0 && <Card className="flex min-w-0 items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{thoughtCount(open.length)}</p><p className="text-sm text-muted">{left === null ? '2 Minuten Durchsicht, ohne Bewertung.' : `Noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p></div>{left === null && <Button onClick={() => setLeft(120)}>Durchsehen</Button>}</Card>}
      {open.length === 0 && <p className="px-1 text-muted">Alles festgehalten. Du entscheidest, was daraus wird.</p>}
      <Section>{open.map(item => <NoteCard key={item.id} item={item} due={reviewDue(item, now)} />)}</Section>
      {parked.length > 0 && <details className="space-y-2"><summary className="min-h-11 py-2 text-muted">Geparkte Gedanken ({parked.length})</summary><ParkedThoughts items={parked} now={now} /></details>}
      {kept.length > 0 && <details className="space-y-2"><summary className="min-h-11 py-2 text-muted">Gesammelte Gedanken ({kept.length})</summary><div className="space-y-2">{kept.map(item => <NoteCard key={item.id} item={item} />)}</div></details>}
    </> : <>
      <Section title="Private Aufgaben">{currentTasks.map(task => <TaskCard key={task.id} taskRef={{ kind: 'task', id: task.id }} task={task} />)}
        {currentTasks.length === 0 && <p className="px-1 text-muted">Für jetzt ist hier nichts eingeplant. Ein Gedanke wird erst nach deiner Wahl zur Aufgabe.</p>}
        {laterTasks.length > 0 && <details><summary className="min-h-11 py-2 text-muted">Für später ({laterTasks.length})</summary><div className="space-y-2">{laterTasks.map(task => <TaskCard key={task.id} taskRef={{ kind: 'task', id: task.id }} task={task}><p className="text-xs text-muted">{task.taskDate === addDays(d, 1) ? 'Für morgen eingeplant' : task.taskDate ? `Eingeplant für ${new Date(task.taskDate + 'T12:00:00').toLocaleDateString('de-DE')}` : 'Für später'}</p></TaskCard>)}</div></details>}
      </Section>
      {doneToday.length > 0 && <details className="space-y-2"><summary className="min-h-11 py-2 text-muted">Erledigt ({doneToday.length})</summary><div className="space-y-2">{doneToday.map(task => <Card key={task.id} className="space-y-2"><p className="break-words text-muted">{task.text}{task.doneMode === 'minimal' ? ' · kleine Version' : ''}</p><Button size="sm" disabled={busy} aria-label={`${task.text} zurücknehmen`} onClick={() => run(() => st.completeTask({ kind: 'task', id: task.id }, false))}>Erledigung zurücknehmen</Button></Card>)}</div></details>}
      <RestingTasks tasks={st.inbox.filter(item => item.status === 'task')} kind="task" />
      <TaskLearning />
    </>}
    <InboxSheet open={adding} onClose={() => { setAdding(false); setText(useApp.getState().local.captureDraft?.text ?? '') }} />
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
  const plan = (date: string) => run(async () => { await st.updateInbox(item.id, { status: 'task', taskDate: date, estimateMin: item.estimateMin ?? 5, state: date > d ? 'deferred' : 'pending', deferredUntil: date > d ? zonedToUtc(date, 240) : undefined, source: item.source ?? { kind: 'capture' } }); st.showToast('Als Aufgabe eingeplant.') })
  return <Card className="min-w-0 space-y-3">
    <p className="break-words text-lg">{item.text}</p>
    {due && <p className="text-sm text-muted">Jetzt wieder zum Ansehen da. Du entscheidest, was daraus wird.</p>}
    {item.linkedTo && <p className="text-sm text-muted">{linked ? <>Verknüpft mit: <Link className="underline" to={`/aufgabe/${item.linkedTo.kind}/${encodeURIComponent(item.linkedTo.id)}`}>{taskTitle(linked)}</Link></> : 'Die verknüpfte Aufgabe ist hier nicht mehr vorhanden. Deine Notiz bleibt erhalten.'}</p>}
    <div className="flex flex-wrap gap-2">
      {item.status !== 'kept' && <Button size="sm" disabled={busy} onClick={() => run(() => st.updateInbox(item.id, { status: 'kept' }))}>Gedanke behalten</Button>}
      <Button size="sm" disabled={busy} onClick={() => plan(addDays(d, 1))}>Für morgen einplanen</Button>
      <Button size="sm" variant="ghost" disabled={busy} aria-label="Zur Arbeit verschieben" onClick={() => run(async () => { await st.moveInboxToWork(item.id); st.showToast('Liegt jetzt bei der Arbeit, nur auf diesem Gerät.') })}>Arbeit</Button>
      <Button size="sm" variant="ghost" disabled={busy} aria-label="Löschen" onClick={() => run(() => st.removeInbox(item.id))}>Löschen</Button>
    </div>
    <details><summary className="min-h-11 py-2 text-sm text-muted">Tag wählen oder verknüpfen</summary><div className="space-y-3 pt-2">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (date) void plan(date); else void run(async () => { throw new Error('Wähle einen Tag für deine Aufgabe.') }) }}><div className="min-w-0 flex-1"><DateField label="Gewählter Aufgabentag" value={date} onChange={setDate} /></div><Button type="submit" size="sm" disabled={busy}>Für diesen Tag einplanen</Button></form>
      {choices.length > 0 && <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const target = choices.find((choice) => `${choice.ref.kind}:${choice.ref.id}` === selected)?.ref; void run(async () => { if (!target) throw new Error('Wähle eine Aufgabe zum Verknüpfen.'); await st.linkInbox(item.id, target) }, 'Gedanke verknüpft.') }}><Choice label="Mit vorhandener Aufgabe verbinden" value={selected} onChange={setSelected} options={[{ value: '', label: 'Aufgabe wählen' }, ...choices.map(choice => ({ value: `${choice.ref.kind}:${choice.ref.id}`, label: `${choice.ref.kind === 'work' ? 'Arbeit: ' : ''}${choice.title}` }))]} /><Button type="submit" size="sm" disabled={busy}>Gedanke verknüpfen</Button></form>}
    </div></details>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Card>
}
