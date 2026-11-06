import { useState } from 'react'
import { DEFAULT_TASK_MIN, suggestTaskWindow, tasksFor } from '../../core/support'
import { daysBetween, fmtTime, type DateStr } from '../../core/time'
import { trialLearningPoints } from '../../core/trial'
import { Link } from 'react-router'
import type { DayPlan } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Card, Section } from './ui'
import { TaskCard, useTaskAction } from './TaskDetails'

/** Flexible Aufgaben eines Tages. Dieselben Einträge wie in der Inbox, also nur eine Wahrheit. */
export function DayTasks({ date, plan }: { date: DateStr; plan: DayPlan }) {
  const st = useApp()
  const [showAll, setShowAll] = useState(false)
  const tasks = tasksFor(st.inbox, date)
  if (!tasks.length) return null
  const win = suggestTaskWindow(plan, tasks[0]?.estimateMin ?? DEFAULT_TASK_MIN)
  return (
    <Section title="Flexibel" hint={win ? (win.fits ? `Passt etwa ab ${fmtTime(win.start)}, kein fester Termin.` : 'Heute wird es eng. Ein kleiner Anfang reicht, oder verschiebe es.') : undefined}>
      {(showAll ? tasks : tasks.slice(0, 3)).map((x) => (
        <TaskCard key={x.id} taskRef={{ kind: 'task', id: x.id }} task={x} />
      ))}
      {tasks.length > 3 && <button type="button" className="min-h-11 px-1 text-sm text-muted underline" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Weniger Aufgaben zeigen' : `${tasks.length - 3} weitere Aufgaben`}</button>}
    </Section>
  )
}

const TRIAL_ANSWERS = [
  { value: 'ja', label: 'Ja' },
  { value: 'teilweise', label: 'Teilweise' },
  { value: 'nein', label: 'Nein' },
  { value: 'uebersprungen', label: 'Überspringen' },
] as const

/** Freiwillige Nutzungsprobe: eine Frage am Tag, bleibt auf dem Gerät, keine Diagnostik. */
export function TrialCard({ date }: { date: DateStr }) {
  const st = useApp()
  const t = st.local.trial
  const [offer, setOffer] = useState(false)
  const { busy, error, run } = useTaskAction()
  if (!t) {
    return (
      <div className="space-y-2">
        <button type="button" className="min-h-11 px-1 text-left text-sm text-muted underline" onClick={() => setOffer(!offer)} aria-expanded={offer}>
          {offer ? 'Doch nicht' : 'Freiwillig ausprobieren: Hilft mir Anker?'}
        </button>
        {offer && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Dauer der freiwilligen Probe">
            {([7, 14] as const).map((days) => (
              <Button
                key={days}
                disabled={busy}
                onClick={() => void run(() => st.saveLocal((l) => ({ ...l, trial: { startedAt: date, days, answers: {} } })))}
              >
                {days} Tage
              </Button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      </div>
    )
  }
  const over = daysBetween(t.startedAt, date) >= t.days
  const remove = () =>
    st.saveLocal((l) => {
      const next = { ...l }
      delete next.trial
      return next
    })
  if (over) {
    const points = trialLearningPoints(t)
    return (
      <Card className="space-y-2">
        <h3 className="font-medium">Die Probezeit ist vorbei</h3>
        <ul className="space-y-2 text-muted">{points.map((point) => <li key={point}>{point}</li>)}</ul>
        <p className="text-sm text-muted">Die Antworten bleiben auf diesem Gerät und sagen nichts über deine Gesundheit. Einstellungen ändern sich dadurch nicht.</p>
        <Link to="/einstellungen/hilfen" className="flex min-h-11 items-center text-accent">Hilfen nach eigener Wahl anpassen</Link>
        <Link to="/backup" className="flex min-h-11 items-center text-accent">Antworten mit einer Sicherung exportieren</Link>
        <Button size="sm" disabled={busy} onClick={() => void run(remove)}>
          Löschen
        </Button>
        {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      </Card>
    )
  }
  if (t.answers[date]) return null
  return (
    <Card className="space-y-2">
      <p className="font-medium">Hat dir Anker heute geholfen?</p>
      <div className="flex flex-wrap gap-2">
        {TRIAL_ANSWERS.map((o) => (
          <Button key={o.value} size="sm" disabled={busy} onClick={() => void run(() => st.saveLocal((l) => (l.trial ? { ...l, trial: { ...l.trial, answers: { ...l.trial.answers, [date]: o.value } } } : l)))}>
            {o.label}
          </Button>
        ))}
      </div>
      <button type="button" disabled={busy} className="min-h-11 text-sm text-muted underline" onClick={() => void run(remove)}>
        Probe beenden und löschen
      </button>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    </Card>
  )
}
