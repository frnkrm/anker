import { describe, expect, it } from 'vitest'
import { acceptHealthSleepSuggestion, healthSleepSuggestions } from './healthSleep'
import { addDays, zonedToUtc } from './time'
import { validateSleepEntry } from './sleepDiary'

const now = zonedToUtc('2026-11-09', 10 * 60)
const bedAt = zonedToUtc('2026-11-08', 23 * 60)
const wakeAt = zonedToUtc('2026-11-09', 7 * 60)
const sample = { dataType: 'sleep', startDate: new Date(bedAt).toISOString(), endDate: new Date(wakeAt).toISOString() }

describe('Lokale Schlafvorschläge aus Sitzungsgrenzen', () => {
  it('ignoriert Stufen, Werte, Quellenbezeichner und doppelte Sitzungsgrenzen', () => {
    const rows = healthSleepSuggestions([sample, { ...sample, sleepState: 'asleep' }, { ...sample, sleepState: 'deep' }, { ...sample, dataType: 'steps' }], now)
    expect(rows).toEqual([{ id: `2026-11-08:${bedAt}:${wakeAt}`, date: '2026-11-08', bedAt, wakeAt }])
  })
  it('behält mehrere Sitzungen einer Nacht zur bewussten Auswahl statt Quellen zusammenzurechnen', () => {
    expect(healthSleepSuggestions([sample, { ...sample, startDate: new Date(bedAt + 60_000).toISOString() }], now)).toHaveLength(2)
  })
  it('beachtet den Berliner Vorabend auch nach Mitternacht und den echten Sommerzeitabstand', () => {
    const start = zonedToUtc('2026-10-25', 30), end = zonedToUtc('2026-10-25', 7 * 60)
    expect(healthSleepSuggestions([{ dataType: 'sleep', startDate: new Date(start).toISOString(), endDate: new Date(end).toISOString() }], end + 1)[0]).toMatchObject({ date: '2026-10-24', bedAt: start, wakeAt: end })
  })
  it.each([
    { ...sample, startDate: '2026-11-08T23:00:00' }, { ...sample, endDate: 'ungültig' },
    { ...sample, endDate: new Date(bedAt).toISOString() }, { ...sample, endDate: new Date(now + 1).toISOString() },
    { ...sample, startDate: new Date(now - 30 * 86_400_000).toISOString() },
  ])('verwirft beschädigte, zukünftige, offsetlose oder zu alte Grenzen %j', value => {
    expect(healthSleepSuggestions([value], now)).toEqual([])
  })
  it('liefert höchstens 14 verschiedene Nächte ohne die Sitzung einer Nacht auszuwählen', () => {
    const rows = Array.from({ length: 20 }, (_, i) => {
      const date = addDays('2026-11-08', -i)
      return { dataType: 'sleep', startDate: new Date(zonedToUtc(date, 1380)).toISOString(), endDate: new Date(zonedToUtc(addDays(date, 1), 420)).toISOString() }
    })
    expect(new Set(healthSleepSuggestions(rows, now).map(row => row.date)).size).toBe(14)
  })
  it('übernimmt nur leere Nächte und schreibt keine Müdigkeit oder andere Ereignisse', () => {
    expect(acceptHealthSleepSuggestion('2026-11-08', { bedAt, wakeAt }, undefined, now)).toEqual({ bedAt, wakeAt, source: 'health-connect' })
    for (const current of [{ bedAt }, { wakeAt }, { sleepyAt: bedAt }, { bedAt, wakeAt, source: 'health-connect' as const }]) {
      expect(acceptHealthSleepSuggestion('2026-11-08', { bedAt, wakeAt }, current, now)).toBeUndefined()
    }
    expect(acceptHealthSleepSuggestion('2026-11-07', { bedAt, wakeAt }, undefined, now)).toBeUndefined()
  })
  it('entfernt die Herkunft bei manueller Korrektur und blockiert ungültige Herkunft vor Import', () => {
    expect(validateSleepEntry('2026-11-08', { bedAt, wakeAt, source: 'health-connect' }, now)).toEqual({ bedAt, wakeAt })
    expect(() => validateSleepEntry('2026-11-08', { source: 'fremd' as 'health-connect' }, now)).toThrow(/Herkunft/)
  })
})
