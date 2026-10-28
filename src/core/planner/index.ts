export * from './plan'
export * from './fit'

import type { DayOverride, DayPlan } from '../types'

/** „Ich mache heute länger“: verschiebt den Feierabend, PC-Stopp und Bett bleiben fix. */
export function workLonger(o: DayOverride, plan: DayPlan, extraMin: number): DayOverride {
  const base = plan.workEnd ?? 17 * 60
  return { ...o, workEnd: base + extraMin }
}

/** Verlängerung PC-Stopp: einmal pro Abend um 15 Minuten. */
export function extendPcStop(o: DayOverride): DayOverride | null {
  if ((o.pcStopExtendMin ?? 0) > 0) return null
  return { ...o, pcStopExtendMin: 15 }
}
