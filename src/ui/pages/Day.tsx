import { useState } from 'react'
import { dayGoals } from '../../core/game'
import { addDays, fmtTime, weekday, WEEKDAYS_LONG } from '../../core/time'
import { usePlan, useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Timeline } from '../components/Timeline'
import { Card, Page, Segmented } from '../components/ui'

export default function Day() {
  const { date: todayDate, m } = useToday()
  const [offset, setOffset] = useState(0)
  const date = addDays(todayDate, offset)
  const plan = usePlan(date)
  const st = useApp()
  const log = st.days[date]
  const goals = dayGoals(plan, log, st.settings)

  return (
    <Page title={offset === 0 ? 'Heute' : offset === 1 ? 'Morgen' : WEEKDAYS_LONG[weekday(date)]!}>
      <Segmented
        label="Tag wählen"
        value={offset}
        options={[
          { value: 0, label: 'Heute' },
          { value: 1, label: 'Morgen' },
          { value: 2, label: WEEKDAYS_LONG[weekday(addDays(todayDate, 2))]! },
        ]}
        onChange={setOffset}
      />
      {plan.notes.length > 0 && (
        <div className="space-y-1 rounded-2xl bg-warm-soft px-4 py-3 text-warm">
          {plan.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
      <Card>
        <Timeline plan={plan} log={log} m={offset === 0 ? m : -1} />
      </Card>
      {goals.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Kernziele {offset === 0 ? 'heute' : ''}</h2>
          <ul className="space-y-1">
            {goals.map((g) => (
              <li key={g.key} className="flex min-h-10 items-center gap-3">
                <span aria-hidden="true" className={g.met ? 'text-accent' : 'text-muted'}>
                  {g.met ? '✓' : '○'}
                </span>
                <span className={g.met ? '' : 'text-muted'}>{g.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="px-1 text-sm text-muted">
        Feste Zeiten: Aufstehen {fmtTime(plan.wake)}
        {plan.leave !== undefined && ` · Los ${fmtTime(plan.leave)}`} · PC-Stopp {fmtTime(plan.pcStop)} · Bett {fmtTime(plan.bed)}
      </p>
    </Page>
  )
}
