import { addDays, todayBerlin } from './time'
import { sleepNightFor, validateSleepEntry } from './sleepDiary'
import type { SleepDiaryEntry } from './types'

export interface HealthSleepSample { dataType: string; startDate: string; endDate: string; sleepState?: string }
export interface HealthSleepSuggestion { id: string; date: string; bedAt: number; wakeAt: number }

/** Nur Sitzungsgrenzen, keine Schlafphasen, Diagnose oder berechnete Schlafdauer. */
export function healthSleepSuggestions(samples: readonly HealthSleepSample[], nowMs = Date.now()): HealthSleepSuggestion[] {
  const oldest = addDays(todayBerlin(nowMs), -14)
  const latest = sleepNightFor('bedAt', nowMs)
  const found = new Map<string, HealthSleepSuggestion>()
  for (const sample of samples) {
    if (sample.dataType !== 'sleep' || sample.sleepState !== undefined && !['asleep', 'inBed'].includes(sample.sleepState)) continue
    // Offsetlose Fremdzeiten dürfen nicht von der lokalen Browserzone abhängen.
    if (![sample.startDate, sample.endDate].every(value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) continue
    const bedAt = Date.parse(sample.startDate), wakeAt = Date.parse(sample.endDate)
    if (!Number.isFinite(bedAt) || !Number.isFinite(wakeAt) || wakeAt <= bedAt || wakeAt > nowMs || wakeAt - bedAt > 24 * 60 * 60_000) continue
    const date = sleepNightFor('bedAt', bedAt)
    if (date < oldest || date > latest) continue
    const id = `${date}:${bedAt}:${wakeAt}`
    found.set(id, { id, date, bedAt, wakeAt })
  }
  const sorted = [...found.values()].sort((a, b) => b.bedAt - a.bedAt || b.wakeAt - a.wakeAt)
  const nights = new Set([...new Set(sorted.map(row => row.date))].slice(0, 14))
  return sorted.filter(row => nights.has(row.date))
}

/** Eigene oder bereits übernommene Nächte sind vollständig geschützt. */
export function acceptHealthSleepSuggestion(date: string, entry: SleepDiaryEntry, current: SleepDiaryEntry | undefined, nowMs = Date.now()): SleepDiaryEntry | undefined {
  if (current && ['sleepyAt', 'bedAt', 'wakeAt'].some(key => current[key as keyof SleepDiaryEntry] !== undefined)) return undefined
  const clean = validateSleepEntry(date, entry, nowMs)
  if (clean.bedAt === undefined || clean.wakeAt === undefined || clean.wakeAt <= clean.bedAt || clean.sleepyAt !== undefined) return undefined
  const candidate = healthSleepSuggestions([{ dataType: 'sleep', startDate: new Date(clean.bedAt).toISOString(), endDate: new Date(clean.wakeAt).toISOString() }], nowMs)[0]
  return candidate?.date === date ? { bedAt: clean.bedAt, wakeAt: clean.wakeAt, source: 'health-connect' } : undefined
}
