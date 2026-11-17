import { activePlanDate } from './now'
import { addDays, todayBerlin, type DateStr } from './time'
import type { SleepDiaryEntry } from './types'

export const SLEEP_EVENTS = ['sleepyAt', 'bedAt', 'wakeAt'] as const
export type SleepEvent = typeof SLEEP_EVENTS[number]

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

/** Nur bewusst gemeldete Zeitpunkte. Fehlende Angaben bleiben fehlend. */
export function validateSleepEntry(date: DateStr, entry: SleepDiaryEntry, nowMs = Date.now()): SleepDiaryEntry {
  if (!validDate(date)) throw new Error('Bitte wähle ein gültiges Datum für die Nacht.')
  if (entry.source !== undefined && entry.source !== 'health-connect') throw new Error('Die Herkunft der Schlafangaben ist ungültig.')
  const clean: SleepDiaryEntry = {}
  const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= nowMs
  for (const field of ['alarmAt', 'qrAt', 'wakeFeedbackSkippedAt', 'energySkippedAt'] as const) {
    const value = entry[field]
    if (value !== undefined) {
      if (!timestamp(value)) throw new Error('Der Zeitpunkt der Weckinteraktion ist ungültig.')
      clean[field] = value
    }
  }
  if (entry.onset !== undefined) {
    const v = entry.onset
    if (!v || !timestamp(v.at) || !['estimated', 'confirmed', 'discarded'].includes(v.status)
      || !['prompt-timeout', 'manual'].includes(v.source)) throw new Error('Die Einschlafangabe ist ungültig.')
    if (v.status !== 'discarded' && (entry.bedAt !== undefined && v.at < entry.bedAt || entry.wakeAt !== undefined && v.at > entry.wakeAt)) throw new Error('Prüfe die Reihenfolge der Schlafangaben.')
    clean.onset = { at: v.at, status: v.status, source: v.source }
  }
  if (entry.wakeFeedback !== undefined) {
    const v = entry.wakeFeedback
    if (!v || !timestamp(v.at) || !['too-early', 'right', 'too-late'].includes(v.value)) throw new Error('Die Rückmeldung zur Weckzeit ist ungültig.')
    clean.wakeFeedback = { at: v.at, value: v.value }
  }
  if (entry.dayEnergy !== undefined) {
    const v = entry.dayEnergy
    if (!v || !timestamp(v.at) || ![1, 2, 3, 4, 5].includes(v.value)) throw new Error('Die Energierückmeldung ist ungültig.')
    clean.dayEnergy = { at: v.at, value: v.value }
  }
  for (const event of SLEEP_EVENTS) {
    const value = entry[event]
    if (value === undefined) continue
    if (!Number.isFinite(value) || value < 0) throw new Error('Bitte trage gültige Zeitpunkte ein.')
    if (value > nowMs) throw new Error('Die Zeitpunkte dürfen nicht in der Zukunft liegen. Noch offene Angaben kannst du leer lassen.')
    clean[event] = value
  }
  if (clean.wakeAt !== undefined) {
    if (clean.bedAt !== undefined && clean.wakeAt < clean.bedAt) {
      throw new Error('Aufstehen muss nach dem Zubettgehen liegen. Bitte prüfe auch das Datum.')
    }
    if (clean.sleepyAt !== undefined && clean.wakeAt < clean.sleepyAt) {
      throw new Error('Aufstehen muss nach der eingetragenen Müdigkeit liegen. Bitte prüfe auch das Datum.')
    }
  }
  // Müdigkeit kann auch erst im Bett auftreten. Ihre Reihenfolge zur Bettzeit ist offen.
  if (entry.source === 'health-connect' && (clean.bedAt === undefined || clean.wakeAt === undefined || clean.sleepyAt !== undefined)) throw new Error('Die übernommenen Schlafangaben sind unvollständig.')
  return clean
}

/** Nacht = Datum des Abends. Vor 04:00 gehört der Abend noch zum Vortag. */
export function sleepNightFor(event: SleepEvent, nowMs = Date.now()): DateStr {
  return event === 'wakeAt' ? addDays(todayBerlin(nowMs), -1) : activePlanDate(nowMs, todayBerlin)
}

export interface SleepNightOverview {
  date: DateStr
  entry: SleepDiaryEntry
  /** Tatsächlicher UTC-Abstand, keine geschätzte Schlafdauer. */
  bedToWakeMin?: number
}

export function sleepOverview(entries: Record<DateStr, SleepDiaryEntry>, throughDate: DateStr, days = 7): SleepNightOverview[] {
  return Array.from({ length: Math.max(0, Math.min(366, Math.floor(days))) }, (_, index) => {
    const date = addDays(throughDate, -index)
    const entry = entries[date] ?? {}
    const { bedAt, wakeAt } = entry
    const bedToWakeMin = bedAt !== undefined && wakeAt !== undefined && Number.isFinite(bedAt) && Number.isFinite(wakeAt) && wakeAt >= bedAt
      ? (wakeAt - bedAt) / 60_000
      : undefined
    return { date, entry, bedToWakeMin }
  })
}
