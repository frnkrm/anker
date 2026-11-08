import { useState } from 'react'
import { Link } from 'react-router'
import { dayGoals } from '../../core/game'
import { addDays, fmtTime, weekday, WEEKDAYS, WEEKDAYS_LONG } from '../../core/time'
import { usePlan, useToday } from '../../state/hooks'
import { planNoteForDate } from '../../core/uiText'
import { useApp } from '../../state/store'
import { SportToggle } from '../components/SportToggle'
import { Timeline } from '../components/Timeline'
import { DayCommitments } from '../components/DayCommitments'
import { DayTasks } from '../components/DayTasks'
import { TodayDifferent, WakeSuggestion } from '../components/TodayDifferent'
import { WeatherCard } from '../components/WeatherCard'
import { Card, Page, Segmented } from '../components/ui'

export default function Day() {
  const { date: todayDate, m } = useToday()
  const [offset, setOffset] = useState(0)
  const [different, setDifferent] = useState(false)
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
          { value: 1, label: WEEKDAYS[weekday(addDays(todayDate, 1))]! },
          { value: 2, label: WEEKDAYS[weekday(addDays(todayDate, 2))]! },
        ]}
        onChange={setOffset}
      />
      {plan.notes.length > 0 && (
        <div className="space-y-1 rounded-2xl bg-surface px-4 py-3 text-muted">
          {plan.notes.map((n) => (
            <p key={n}>{planNoteForDate(n, date, todayDate)}</p>
          ))}
        </div>
      )}
      <Card>
        <Timeline plan={plan} log={log} m={offset === 0 ? m : -1} collapseCompleted />
      </Card>
      <button type="button" className="min-h-11 w-full rounded-2xl border border-line" onClick={() => setDifferent(true)}>
        {offset === 0 ? 'Heute anders' : offset === 1 ? 'Morgen anders' : 'Diesen Tag anders'}
      </button>
      <TodayDifferent open={different} onClose={() => setDifferent(false)} date={date} m={offset === 0 ? m : plan.wake} isTomorrow={offset > 0} />
      <Link to={`/druck?typ=both&tag=${date}`} className="flex min-h-11 items-center rounded-xl border border-line px-3 text-muted">Routinen für diesen Tag drucken</Link>
      <DayCommitments plan={plan} />
      {offset > 0 && <WakeSuggestion date={date} />}
      {offset > 0 && <WeatherCard date={date} />}
      <DayTasks date={date} plan={plan} />
      {offset === 0 && <SportToggle plan={plan} />}
      {goals.length > 0 && st.settings.support.gameVisible && log?.override.mode !== 'ueberlastet' && (
        <Card>
          <h2 className="mb-2 font-semibold">Kernziele {offset === 0 ? 'heute' : ''}</h2>
          <ul className="space-y-1">
            {goals.filter((g) => g.met || !log?.override.adjusted).map((g) => (
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
