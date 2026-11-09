import type { GuidanceLocal, MorningAlarmHandoff } from './types'

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 500
export const validGuidanceDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
export const guidanceTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 180
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key))

export function validMorningAlarmHandoff(value: unknown, nowMs: number): value is MorningAlarmHandoff {
  return object(value) && keys(value, ['occurrenceId', 'targetDate', 'alarmAt', 'confirmedAt'])
    && identifier(value.occurrenceId) && validGuidanceDate(value.targetDate)
    && guidanceTimestamp(value.alarmAt) && guidanceTimestamp(value.confirmedAt)
    // An activity-triggered alarm can ring before its fixed target time.
    && value.alarmAt <= value.confirmedAt + 90 * 60_000 && value.confirmedAt <= nowMs + 5000
    && nowMs - value.confirmedAt <= 24 * 3600_000
}

export function validIfThenPlan(value: unknown): boolean {
  return object(value) && keys(value, ['wish', 'outcome', 'obstacle', 'sentence', 'showOnPc'])
    && ['wish', 'outcome', 'obstacle', 'sentence'].every(key => text(value[key])) && typeof value.showOnPc === 'boolean'
}

/** New private containers are bounded and strict; absent old containers remain valid. */
export function validGuidanceLocal(value: unknown): value is GuidanceLocal | undefined {
  if (value === undefined) return true
  if (!object(value) || !keys(value, ['days', 'receipts', 'ifThen', 'lightSuggestion']) || !object(value.days)
    || Object.keys(value.days).length > 64 || !Array.isArray(value.receipts) || value.receipts.length > 256
    || !value.receipts.every(identifier) || new Set(value.receipts).size !== value.receipts.length
    || value.ifThen !== undefined && !validIfThenPlan(value.ifThen)
    || value.lightSuggestion !== undefined && value.lightSuggestion !== 'accepted' && value.lightSuggestion !== 'declined') return false
  return Object.entries(value.days).every(([date, day]) => validGuidanceDate(date) && object(day)
    && keys(day, ['alarmOccurrenceId', 'alarmAt', 'morningActivatedAt', 'morningCompletedAt', 'firstInteractionAt', 'nightLockedAt', 'bedVerifiedAt', 'emergencyUntil', 'brainDumpIds', 'brainDumpShownAt'])
    && (day.alarmOccurrenceId === undefined || identifier(day.alarmOccurrenceId))
    && ['alarmAt', 'morningActivatedAt', 'morningCompletedAt', 'firstInteractionAt', 'nightLockedAt', 'bedVerifiedAt', 'emergencyUntil', 'brainDumpShownAt'].every(key => day[key] === undefined || guidanceTimestamp(day[key]))
    && (day.brainDumpIds === undefined || Array.isArray(day.brainDumpIds) && day.brainDumpIds.length <= 64 && day.brainDumpIds.every(identifier))
    && (typeof day.morningCompletedAt !== 'number' || typeof day.morningActivatedAt !== 'number' || day.morningCompletedAt >= day.morningActivatedAt))
}

export function guidanceLocal(value: unknown): GuidanceLocal {
  return validGuidanceLocal(value) && value ? structuredClone(value) : { days: {}, receipts: [] }
}

export function rememberGuidanceReceipt(local: GuidanceLocal, receipt: string): void {
  if (!identifier(receipt)) throw new Error('Die Bestätigung ist ungültig.')
  local.receipts = [...new Set([...local.receipts, receipt])].slice(-256)
  const dates = Object.keys(local.days).sort().slice(-64)
  local.days = Object.fromEntries(dates.map(date => [date, local.days[date]!]))
}
