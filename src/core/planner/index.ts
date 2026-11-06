export { hardConflicts, legSpan, mapsUrl, parseQuickTime, planLegs } from './adaptive'
export * from './plan'
export * from './fit'

import type { DayOverride, DayPlan } from '../types'

/** „Ich mache heute länger“: verschiebt den Feierabend, PC-Stopp und Bett bleiben fix. */
export function workLonger(o: DayOverride, plan: DayPlan, extraMin: number): DayOverride {
  const base = plan.workEnd ?? 17 * 60
  return { ...o, workEnd: base + extraMin }
}

/** Bestehende gespeicherte Verlängerungen bleiben additiv; neue UI nutzt die freie Abendentscheidung. */
export function extendPcStop(o: DayOverride, minutes = 15): DayOverride | null {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return null
  return { ...o, pcStopExtendMin: (o.pcStopExtendMin ?? 0) + minutes }
}
