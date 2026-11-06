import { activePlanDate } from './now'
import { validateSleepEntry } from './sleepDiary'
import { addDays, fmtTime, parseTime, todayBerlin, utcToZoned, zonedToUtc } from './time'
import type { InboxItem, LocalData, SleepDiaryEntry, TomorrowStep } from './types'

/** Wiedervorlage macht einen offenen Gedanken sichtbar, aber niemals zu einer Aufgabe. */
export function reviewDue(item: InboxItem, nowMs: number): boolean {
  return item.status === 'open' && !item.done && item.reviewAt !== undefined && Number.isFinite(new Date(item.reviewAt).getTime()) && item.reviewAt <= nowMs
}

/** Zukunfts-Gedanken ruhen bis zur selbst gewählten Zeit. Beschädigte Zeiten verstecken nichts. */
export function openThoughts(inbox: readonly InboxItem[], nowMs: number): InboxItem[] {
  return inbox.filter((item) => item.status === 'open' && !item.done && (item.reviewAt === undefined || !Number.isFinite(new Date(item.reviewAt).getTime()) || item.reviewAt <= nowMs))
}

/** Fällige private Schritte bleiben unabhängig von Alter und Plan-Tag erhalten. */
export function pendingTomorrowSteps(steps: readonly TomorrowStep[], nowMs: number): TomorrowStep[] {
  return steps.filter((step) => step.doneAt === undefined && Number.isFinite(step.resumeAt) && step.resumeAt <= nowMs).sort((a, b) => a.resumeAt - b.resumeAt || a.createdAt - b.createdAt)
}

/** UTC ms → datetime-local-Wert, ausdrücklich in Berlin statt in der Browser-Zeitzone. */
export function toBerlinDateTimeInput(utcMs: number): string {
  if (!Number.isFinite(utcMs) || !Number.isFinite(new Date(utcMs).getTime())) return ''
  const { date, minutes } = utcToZoned(utcMs)
  return `${date}T${fmtTime(minutes)}`
}

/** Ungültige Kalenderdaten und nicht existierende Berliner Wandzeiten werden nicht verschoben. */
export function fromBerlinDateTimeInput(value: string): number {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value)
  if (!match) return NaN
  const date = match[1]!
  const minutes = parseTime(match[2]!)
  if (!Number.isFinite(minutes)) return NaN
  const utcMs = zonedToUtc(date, minutes)
  return Number.isFinite(utcMs) && toBerlinDateTimeInput(utcMs) === value ? utcMs : NaN
}

/** Vorschlag für den nächsten Plan-Tag. Vor 04:00 gehört der Abend noch zum Vortag. */
export function nextEveningTime(nowMs: number, minutes = 11 * 60): number {
  const wallMinute = Number.isInteger(minutes) && minutes >= 0 && minutes < 1440 ? minutes : 11 * 60
  let date = addDays(activePlanDate(nowMs, todayBerlin), 1)
  let at = zonedToUtc(date, wallMinute)
  if (at <= nowMs) {
    date = addDays(date, 1)
    at = zonedToUtc(date, wallMinute)
  }
  return at
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isTomorrowStep(value: unknown): value is TomorrowStep {
  if (!object(value)) return false
  return ['id', 'title', 'nextStep'].every((key) => typeof value[key] === 'string' && value[key].trim().length > 0)
    && typeof value.resumeAt === 'number' && Number.isFinite(new Date(value.resumeAt).getTime())
    && typeof value.createdAt === 'number' && Number.isFinite(new Date(value.createdAt).getTime())
    && typeof value.remind === 'boolean'
    && (value.doneAt === undefined || (typeof value.doneAt === 'number' && Number.isFinite(new Date(value.doneAt).getTime())))
}

function isSleepEntry(date: string, value: unknown, nowMs: number): value is SleepDiaryEntry {
  if (!object(value)) return false
  try { validateSleepEntry(date, value as SleepDiaryEntry, nowMs); return true } catch { return false }
}

/** Ältere lokale Stände haben diese Felder noch nicht. Ungültige Werte dürfen die Ansicht nicht blockieren. */
export function eveningLocalFields(value: unknown, nowMs = Date.now()): Pick<LocalData, 'tomorrowSteps' | 'sleepDiary'> {
  const local = object(value) ? value : {}
  return {
    tomorrowSteps: Array.isArray(local.tomorrowSteps) ? local.tomorrowSteps.filter(isTomorrowStep) : [],
    sleepDiary: object(local.sleepDiary)
      ? Object.fromEntries(Object.entries(local.sleepDiary).filter((entry): entry is [string, SleepDiaryEntry] => isSleepEntry(entry[0], entry[1], nowMs)))
      : {},
  }
}

/** Neue private Felder vor dem Import prüfen; ausgelassene Felder älterer Sicherungen bleiben erlaubt. */
export function validEveningLocal(value: unknown, nowMs = Date.now()): boolean {
  if (!object(value)) return false
  if (value.tomorrowSteps !== undefined && (!Array.isArray(value.tomorrowSteps) || !value.tomorrowSteps.every(isTomorrowStep))) return false
  if (value.sleepDiary !== undefined && (!object(value.sleepDiary) || !Object.entries(value.sleepDiary).every(([date, entry]) => isSleepEntry(date, entry, nowMs)))) return false
  return true
}
