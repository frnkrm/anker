import type { LocalData } from './types'

export type HomeOfficeContact = NonNullable<LocalData['homeOfficeContact']>[string]
export const CONTACT_DELAY_MS = 30 * 60_000
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
const day = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

export function validHomeOfficeContacts(value: unknown): value is LocalData['homeOfficeContact'] {
  return value === undefined || (object(value) && Object.entries(value).every(([date, entry]) => day(date) && object(entry)
    && ['done', 'not-needed', 'later'].includes(String(entry.status)) && timestamp(entry.at)
    && (entry.remindAt === undefined || (entry.status === 'later' && timestamp(entry.remindAt) && entry.remindAt >= entry.at + CONTACT_DELAY_MS))))
}

/** Nur ein bewusst gewähltes Später kann eine einzige ruhige Rückfrage auslösen. */
export function homeOfficeContactDue(entry: HomeOfficeContact | undefined, now: number): boolean {
  return !!entry && entry.status === 'later' && entry.remindAt !== undefined && timestamp(now)
    && now >= entry.remindAt && now >= entry.at + CONTACT_DELAY_MS
}
