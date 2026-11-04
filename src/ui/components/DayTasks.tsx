import { useState } from 'react'
import { DEFAULT_TASK_MIN, suggestTaskWindow, tasksFor } from '../../core/support'
import { addDays, daysBetween, fmtTime, type DateStr } from '../../core/time'
import type { DayPlan } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Card, Section } from './ui'

/** Flexible Aufgaben eines Tages. Dieselben Einträge wie in der Inbox, also nur eine Wahrheit. */
export function DayTasks({ date, plan }: { date: DateStr; plan: DayPlan }) {
  const st = useApp()
  const tasks = tasksFor(st.inbox, date)
  if (!tasks.length) return null
  const win = suggestTaskWindow(plan, tasks[0]?.estimateMin ?? DEFAULT_TASK_MIN)
  return (
    <Section title="Flexibel" hint={win ? (win.fits ? `Passt etwa ab ${fmtTime(win.start)}, kein fester Termin.` : 'Heute wird es eng. Ein kleiner Anfang reicht, oder verschiebe es.') : undefined}>
      {tasks.map((x) => (
        <div key={x.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-2">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" aria-label={`${x.text} erledigt`} checked={false} onChange={() => st.setInboxDone(x.id, true)} />
          <span className="flex-1">{x.text}</span>
          <Button size="sm" variant="ghost" onClick={() => st.updateInbox(x.id, { taskDate: addDays(date, 1) })}>
            Später
          </Button>
        </div>
      ))}
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
  if (!t) {
    return (
      <button type="button" className="min-h-10 px-1 text-left text-sm text-muted underline" onClick={() => setOffer(!offer)} aria-expanded={offer}>
        {offer ? 'Doch nicht' : 'Freiwillig ausprobieren: Hilft mir Anker?'}
        {offer && (
          <span className="mt-2 flex gap-2">
            {([7, 14] as const).map((days) => (
              <span
                key={days}
                role="button"
                tabIndex={0}
                className="rounded-xl bg-surface-2 px-3 py-2 no-underline"
                onClick={(e) => {
                  e.stopPropagation()
                  void st.saveLocal((l) => ({ ...l, trial: { startedAt: date, days, answers: {} } }))
                }}
              >
                {days} Tage
              </span>
            ))}
          </span>
        )}
      </button>
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
    const a = Object.values(t.answers)
    const count = (v: string) => a.filter((x) => x === v).length
    return (
      <Card className="space-y-2">
        <p className="font-medium">Deine Probe ist fertig</p>
        <p className="text-muted">
          Geholfen: {count('ja')} Tage · teilweise: {count('teilweise')} · nicht: {count('nein')}. Die Zahlen bleiben auf dem Gerät und sagen nichts über deine Gesundheit.
        </p>
        <Button size="sm" onClick={remove}>
          Löschen
        </Button>
      </Card>
    )
  }
  if (t.answers[date]) return null
  return (
    <Card className="space-y-2">
      <p className="font-medium">Hat dir Anker heute geholfen?</p>
      <div className="flex flex-wrap gap-2">
        {TRIAL_ANSWERS.map((o) => (
          <Button key={o.value} size="sm" onClick={() => st.saveLocal((l) => (l.trial ? { ...l, trial: { ...l.trial, answers: { ...l.trial.answers, [date]: o.value } } } : l))}>
            {o.label}
          </Button>
        ))}
      </div>
      <button type="button" className="min-h-10 text-sm text-muted underline" onClick={remove}>
        Probe beenden und löschen
      </button>
    </Card>
  )
}
