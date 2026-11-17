import { activePlanDate } from './now'
import { addDays, minutesOnPlanDay, todayBerlin, type DateStr } from './time'
import type { SleepDiaryEntry } from './types'

/** Die Energie am Montagabend gehört zur Nacht Sonntag→Montag, auch nach Mitternacht. */
export function energyNightFor(now: number): DateStr { return addDays(activePlanDate(now, todayBerlin), -1) }
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}
export interface SleepInsights {
  confirmedNights: number
  estimatedNights: number
  ratedNights: number
  observedDurationMin?: number
  suggestion?: { bed: number; wake: number; observedDurationMin: number; supportingNights: number }
}
/** Beschreibende lokale Beobachtung. Keine Diagnose und keine automatische Änderung von Zeiten. */
export function sleepInsights(entries: Record<DateStr, SleepDiaryEntry>, throughDate: DateStr): SleepInsights {
  const earliest = addDays(throughDate, -59)
  const relevant = Object.entries(entries).filter(([date]) => date >= earliest && date <= throughDate)
  const estimatedNights = relevant.filter(([, e]) => e.onset?.status === 'estimated').length
  const confirmed = relevant.flatMap(([date, e]) => {
    if (e.onset?.status !== 'confirmed' || e.wakeAt === undefined) return []
    const duration = (e.wakeAt - e.onset.at) / 60_000
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) return []
    return [{ date, e, duration }]
  })
  const rated = confirmed.filter(({ e }) => e.wakeFeedback !== undefined && e.dayEnergy !== undefined)
  const good = rated.filter(({ e }) => e.wakeFeedback!.value === 'right' && e.dayEnergy!.value >= 4 && e.bedAt !== undefined)
  const out: SleepInsights = { confirmedNights: confirmed.length, estimatedNights, ratedNights: rated.length,
    ...(confirmed.length ? { observedDurationMin: Math.round(median(confirmed.map(n => n.duration))) } : {}) }
  // Produkt-Mindestumfang für einen vorsichtigen Vorschlag, kein klinischer Schwellenwert.
  if (rated.length >= 14 && good.length >= 5) out.suggestion = {
    bed: Math.round(median(good.map(({ date, e }) => minutesOnPlanDay(date, e.bedAt!)))) % 1440,
    wake: Math.round(median(good.map(({ date, e }) => minutesOnPlanDay(date, e.wakeAt!)))) % 1440,
    observedDurationMin: Math.round(median(good.map(n => n.duration))), supportingNights: good.length,
  }
  return out
}
