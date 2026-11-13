import { activePlanDate } from './now'
import { MODE_LABEL } from './support'
import { addDays, daysBetween, todayBerlin, weekday } from './time'
import type { DayLog, StepResult, SupportMode } from './types'

export type ReviewPeriod = 'current' | 'previous'
export interface WeeklyEvidence {
  from: string; to: string; current: boolean; totalDays: number; dataDays: number; missingDays: number
  modes: Partial<Record<SupportMode, number>>
  lightDays: number; shortMorningDays: number; adjustedDays: number
  steps: Record<StepResult, number>
}

/** Vorhandene Tagesstände lesen; keine Pläne, Freitexte, Messdaten oder Ursachen ableiten. */
export function weeklyEvidence(days: Readonly<Record<string, DayLog>>, nowMs: number, period: ReviewPeriod): WeeklyEvidence | undefined {
  if (!Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime())) return undefined
  const date = activePlanDate(nowMs, todayBerlin)
  const monday = addDays(date, -weekday(date))
  const from = period === 'previous' ? addDays(monday, -7) : monday
  const to = period === 'previous' ? addDays(monday, -1) : date
  const totalDays = daysBetween(from, to) + 1
  const result: WeeklyEvidence = { from, to, current: period === 'current', totalDays, dataDays: 0, missingDays: 0,
    modes: {}, lightDays: 0, shortMorningDays: 0, adjustedDays: 0, steps: { done: 0, minimal: 0, skipped: 0, 'not-needed': 0 } }
  for (let offset = 0; offset < totalDays; offset++) {
    const day = addDays(from, offset), log = days[day]
    if (!log || log.date !== day) continue
    let known = false
    const mode = log.override?.mode
    if (mode && Object.hasOwn(MODE_LABEL, mode)) { result.modes[mode] = (result.modes[mode] ?? 0) + 1; known = true }
    if (log.override?.light === true) { result.lightDays++; known = true }
    if (log.override?.shortMorning === true) { result.shortMorningDays++; known = true }
    if (log.override?.adjusted === true) { result.adjustedDays++; known = true }
    for (const [key, status] of Object.entries(log.steps ?? {})) {
      if (!['morning:', 'evening:'].some(prefix => key.startsWith(prefix) && key.length > prefix.length) || !Object.hasOwn(result.steps, status)) continue
      result.steps[status]++; known = true
    }
    if (known) result.dataDays++
  }
  result.missingDays = totalDays - result.dataDays
  return result
}
