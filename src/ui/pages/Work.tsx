import { useState } from 'react'
import { openWork, MAX_WORK_VISIBLE } from '../../core/support'
import { taskIsActionable } from '../../core/tasks'
import { addDays } from '../../core/time'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { RestingTasks, TaskCard, TaskLearning, useTaskAction } from '../components/TaskDetails'
import { Button, Card, Page, Section, TextInput } from '../components/ui'

/** Die vorhandenen lokalen Arbeitsaufgaben bekommen Start, Rücknahme und kleine Schritte. */
export default function Work() {
  const st = useApp()
  const { date, m, plan, now } = useToday()
  const work = st.local.work
  const open = openWork(work).filter((task) => taskIsActionable(task, now))
  const later = openWork(work).filter((task) => !taskIsActionable(task, now))
  const completed = work.filter((task) => task.done)
  const [title, setTitle] = useState('')
  const [showAll, setShowAll] = useState(false)
  const { busy, error, message, run } = useTaskAction()
  const yesterday = st.local.handover[addDays(date, -1)]
  const handover = st.local.handover[date] ?? { open: '', next: '' }
  const afterWork = plan.workEnd !== undefined && m >= plan.workEnd - 30
  const visible = showAll ? open : open.slice(0, MAX_WORK_VISIBLE)
  return <Page title="Arbeit" back="/mehr">
    {yesterday?.next && <Card><p className="text-sm text-muted">Gestern notiert</p><p className="break-words text-lg">{yesterday.next}</p></Card>}
    <Section title="Heute am wichtigsten">
      {visible.map((task, index) => <TaskCard key={task.id} taskRef={{ kind: 'work', id: task.id }} task={task} first={index === 0} moveToTop={index > 0 ? () => st.moveWorkTaskToTop(task.id) : undefined} />)}
      {open.length === 0 && <p className="px-1 text-muted">{work.length ? 'Für jetzt ist hier nichts offen.' : 'Noch nichts eingetragen. Ein Titel genügt.'}</p>}
      {open.length > MAX_WORK_VISIBLE && <button type="button" className="min-h-11 px-1 text-sm text-muted underline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Weniger zeigen' : `${open.length - MAX_WORK_VISIBLE} weitere`}</button>}
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) void run(async () => { await st.addWorkTask(title); setTitle('') })
      }}><TextInput aria-label="Neue Aufgabe" placeholder="Neue Aufgabe" value={title} onChange={(event) => setTitle(event.target.value)} /><Button type="submit" disabled={busy || !title.trim()}>Hinzufügen</Button></form>
    </Section>
    {later.length > 0 && <details className="px-1"><summary className="min-h-11 py-2 text-muted">Für später vorgemerkt ({later.length})</summary><div className="space-y-2">{later.map((task) => <TaskCard key={task.id} taskRef={{ kind: 'work', id: task.id }} task={task} />)}</div></details>}
    {completed.length > 0 && <details className="px-1"><summary className="min-h-11 py-2 text-muted">Erledigt ({completed.length})</summary><div className="space-y-2">{completed.map((task) => <Card key={task.id} className="space-y-2"><p className="break-words text-muted">{task.title}{task.doneMode === 'minimal' ? ' · kleine Version' : ''}</p><Button size="sm" disabled={busy} aria-label={`${task.title} zurücknehmen`} onClick={() => run(() => st.completeTask({ kind: 'work', id: task.id }, false))}>Erledigung zurücknehmen</Button></Card>)}</div></details>}
    <RestingTasks tasks={work} kind="work" />
    {(afterWork || handover.open || handover.next) && <Section title="Feierabend-Übergabe" hint="Eine Minute, nur für dich. Wird nicht an jemanden gesendet."><Card className="space-y-3">
      <TextInput aria-label="Was ist offen?" placeholder="Was ist offen?" value={handover.open} onChange={(event) => { const value = event.target.value; void st.saveLocal((local) => ({ ...local, handover: { ...local.handover, [date]: { ...(local.handover[date] ?? { open: '', next: '' }), open: value } } })).catch(() => st.showToast('Die Übergabe konnte nicht gespeichert werden.')) }} />
      <TextInput aria-label="Wo mache ich morgen weiter?" placeholder="Wo mache ich morgen weiter?" value={handover.next} onChange={(event) => { const value = event.target.value; void st.saveLocal((local) => ({ ...local, handover: { ...local.handover, [date]: { ...(local.handover[date] ?? { open: '', next: '' }), next: value } } })).catch(() => st.showToast('Die Übergabe konnte nicht gespeichert werden.')) }} />
    </Card></Section>}
    <TaskLearning />
    <details className="px-1"><summary className="min-h-11 py-2 text-muted">Vorlagen zum Kopieren</summary><div className="space-y-2 pt-2">{TEMPLATES.map((template) => <Card key={template.title} className="space-y-2"><p className="font-medium">{template.title}</p><p className="whitespace-pre-wrap text-muted">{template.text}</p><Button size="sm" disabled={busy} onClick={() => run(async () => { await navigator.clipboard.writeText(template.text); st.showToast('Kopiert. Senden entscheidest du.') })}>Kopieren</Button></Card>)}</div></details>
    <p className="px-1 text-sm text-muted">Arbeitsaufgaben bleiben auf diesem Gerät und werden nicht synchronisiert. In Erinnerungen erscheinen ihre Inhalte nicht.</p>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Page>
}

const TEMPLATES = [
  { title: 'Aufgabe schriftlich bestätigen', text: 'Kurz zur Sicherheit, ob ich es richtig verstanden habe: Ich soll … bis … erledigen. Passt das so?' },
  { title: 'Kurzer Check-in', text: 'Ich arbeite gerade an … und sage dir in 30 Minuten kurz Bescheid, wie weit ich bin. Passt das für dich?' },
  { title: 'Notiz im Meeting', text: 'Besprochen: …\nMeine Aufgabe: …\nBis wann: …\nNächster Schritt: …' },
]
