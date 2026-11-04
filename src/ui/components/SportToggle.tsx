import { sportDone } from '../../core/game'
import { isSportDay } from '../../core/planner'
import type { DayPlan } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Card } from './ui'

/** Sport von Hand abhaken. Eintrag von Health Connect bleibt fest, sonst lässt er sich zurücknehmen. */
export function SportToggle({ plan }: { plan: DayPlan }) {
  const st = useApp()
  const date = plan.date
  if (!isSportDay(date, st.settings) || plan.dayType === 'sick' || plan.dayType === 'vacation') return null
  const log = st.days[date]
  const done = sportDone(plan, log, st.settings)
  const label = st.settings.sport.kind === 'gym' ? 'Fitnessstudio heute' : 'Sport heute'
  const hint = log?.sport === 'health' ? 'Von Health Connect erkannt.' : done && !log?.sport ? 'Über die Morgenroutine abgehakt.' : undefined

  return (
    <Card className="flex items-center gap-3">
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {log?.sport === 'health' || (done && !log?.sport) ? (
        <span className="text-accent">✓ Erledigt</span>
      ) : (
        <Button
          variant={done ? 'secondary' : 'primary'}
          aria-pressed={done}
          onClick={() => st.updateDay(date, (l) => ({ ...l, sport: l.sport ? undefined : 'manual' }))}
        >
          {done ? '✓ Erledigt' : 'Erledigt'}
        </Button>
      )}
    </Card>
  )
}
