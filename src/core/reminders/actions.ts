import { reminderRevisions, type ReminderExtras } from './build'
import type { DayLog, DayPlan, Settings } from '../types'

export interface ReminderAction {
  id: string
  action: 'done' | 'skip'
  key: string
  date: string
  at: number
  revision: string
  token: string
  ruleId?: string
}

export type ReminderApplyResult = 'applied' | 'duplicate' | 'obsolete'

export function validReminderAction(value: unknown): value is ReminderAction {
  if (value === null || typeof value !== 'object') return false
  const a = value as Partial<ReminderAction>
  return typeof a.id === 'string' && a.id.length > 0 && a.id.length <= 256
    && (a.action === 'done' || a.action === 'skip')
    && typeof a.key === 'string' && a.key.length > 0 && a.key.length <= 256
    && typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
    && Number.isFinite(Date.parse(`${a.date}T12:00:00Z`)) && new Date(`${a.date}T12:00:00Z`).toISOString().slice(0, 10) === a.date
    && typeof a.at === 'number' && Number.isFinite(a.at) && a.at >= 0
    && typeof a.revision === 'string' && /^r2-[a-f0-9]{16}$/.test(a.revision)
    && typeof a.token === 'string' && a.token.length > 0 && a.token.length <= 256
}

export function currentReminderAction(a: ReminderAction, plans: DayPlan[], logs: Record<string, DayLog | undefined>, s: Settings, extras: ReminderExtras, now: number): boolean {
  return validReminderAction(a) && !a.key.startsWith('prepare:') && a.at <= now + 60_000 && reminderRevisions(plans, logs, s, extras)[`${a.date}|${a.key}`] === a.revision
}

/** Stored with the effect in its existing record. Old backups may omit receipts. */
export function validReminderReceipts(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.length <= 256 && value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 256))
}

export function withReminderReceipt(old: string[] | undefined, id: string): string[] {
  return [...(old ?? []).filter((item) => item !== id), id].slice(-256)
}
