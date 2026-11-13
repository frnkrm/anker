import { departureReadiness } from '../../core/departure'
import { fmtDuration, fmtTime } from '../../core/time'
import type { DayLog, DayPlan } from '../../core/types'

export function DepartureReadiness({ plan, log, now }: { plan: DayPlan; log: DayLog; now: number }) {
  const view = departureReadiness(plan, log, now)
  if (!view) return null
  const remaining = view.remainingMin
  const buffer = view.bufferMin
  return <aside className="now-departure" aria-label="Abfahrtsbereitschaft">
    <p className="font-semibold">{view.label}</p>
    <p>{remaining === undefined ? 'Abfahrt noch offen' : remaining < 0
      ? `Geplante Abfahrt ${fmtTime(view.leave!)} · seit ${fmtDuration(Math.ceil(-remaining))} erreicht`
      : `Losgehen ${fmtTime(view.leave!)} · noch ${fmtDuration(Math.floor(remaining))}`}</p>
    <p>Vorbereitung {view.durationOpen ? 'mindestens ' : 'ca. '}{fmtDuration(Math.ceil(view.preparationMin))}
      {view.openSteps > 0 && ` · ${view.openSteps} ${view.openSteps === 1 ? 'offener Routine-Schritt' : 'offene Routinen-Schritte'}`}
      {view.openItems > 0 && ` · ${view.openItems} ${view.openItems === 1 ? 'Sache' : 'Sachen'} einzupacken`}</p>
    <p>{buffer === undefined ? 'Puffer offen · Zeiten oder Weg noch unklar.' : buffer < 0
      ? `Rechnerisch fehlen ${fmtDuration(Math.ceil(-buffer))} bis zur geplanten Abfahrt.`
      : `Rechnerischer Puffer ${fmtDuration(Math.floor(buffer))} · nach geschätzter Vorbereitung.`}</p>
  </aside>
}
