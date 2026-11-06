import { describe, expect, it } from 'vitest'
import { sleepNightFor, sleepOverview, validateSleepEntry } from './sleepDiary'
import { zonedToUtc } from './time'

const now = zonedToUtc('2026-11-03', 12 * 60)
const bedAt = zonedToUtc('2026-11-02', 23 * 60)
const wakeAt = zonedToUtc('2026-11-03', 7 * 60)

describe('freiwilliger Schlafüberblick', () => {
  it('behält einzelne Angaben und leere Einträge ohne etwas zu ergänzen', () => {
    expect(validateSleepEntry('2026-11-02', {}, now)).toEqual({})
    expect(validateSleepEntry('2026-11-02', { bedAt, sleepyAt: undefined }, now)).toEqual({ bedAt })
    expect(validateSleepEntry('2026-11-02', { wakeAt }, now)).toEqual({ wakeAt })
  })

  it('lässt Müdigkeit auch nach dem Zubettgehen zu', () => {
    const sleepyAt = zonedToUtc('2026-11-03', 30)
    expect(validateSleepEntry('2026-11-02', { bedAt, sleepyAt, wakeAt }, now)).toEqual({ bedAt, sleepyAt, wakeAt })
  })

  it('weist vertauschte Aufstehzeiten zurück, auch bei fehlender Bettzeit', () => {
    expect(() => validateSleepEntry('2026-11-02', { bedAt: wakeAt, wakeAt: bedAt }, now)).toThrow(/Aufstehen/)
    expect(() => validateSleepEntry('2026-11-02', { sleepyAt: wakeAt, wakeAt: bedAt }, now)).toThrow(/Aufstehen/)
  })

  it('nimmt keine zukünftigen, unendlichen oder ungültigen Zeitpunkte an', () => {
    for (const value of [NaN, Infinity, -Infinity, -1, now + 1]) {
      expect(() => validateSleepEntry('2026-11-02', { bedAt: value }, now)).toThrow()
    }
    for (const date of ['2026-02-30', '2026-13-01', '02.11.2026', '']) {
      expect(() => validateSleepEntry(date, { bedAt }, now)).toThrow(/Datum/)
    }
    expect(validateSleepEntry('2026-11-03', { sleepyAt: now }, now)).toEqual({ sleepyAt: now })
  })

  it('ordnet Bett und Müdigkeit vor 04:00 dem Vorabend zu, Aufstehen immer der vorigen Kalendernacht', () => {
    const afterMidnight = zonedToUtc('2026-11-03', 60)
    expect(sleepNightFor('bedAt', afterMidnight)).toBe('2026-11-02')
    expect(sleepNightFor('sleepyAt', afterMidnight)).toBe('2026-11-02')
    expect(sleepNightFor('wakeAt', afterMidnight)).toBe('2026-11-02')
    expect(sleepNightFor('bedAt', zonedToUtc('2026-11-03', 240))).toBe('2026-11-03')
    expect(sleepNightFor('wakeAt', zonedToUtc('2026-11-03', 420))).toBe('2026-11-02')
    expect(sleepNightFor('wakeAt', zonedToUtc('2027-01-01', 420))).toBe('2026-12-31')
  })

  it('zeigt genau sieben Nächte mit Lücken und berechnet nur bekannte Bett-bis-Aufsteh-Abstände', () => {
    const rows = sleepOverview({ '2026-11-02': { bedAt, wakeAt }, '2026-11-01': { sleepyAt: bedAt - 86_400_000 } }, '2026-11-02')
    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual({ date: '2026-11-02', entry: { bedAt, wakeAt }, bedToWakeMin: 480 })
    expect(rows[1]?.bedToWakeMin).toBeUndefined()
    expect(rows[2]).toEqual({ date: '2026-10-31', entry: {}, bedToWakeMin: undefined })
    expect(rows.at(-1)?.date).toBe('2026-10-27')
  })

  it('zählt die echte verstrichene Zeit über beide Zeitumstellungen', () => {
    const entries = {
      '2026-03-28': { bedAt: zonedToUtc('2026-03-28', 23 * 60), wakeAt: zonedToUtc('2026-03-29', 7 * 60) },
      '2026-10-24': { bedAt: zonedToUtc('2026-10-24', 23 * 60), wakeAt: zonedToUtc('2026-10-25', 7 * 60) },
    }
    expect(sleepOverview(entries, '2026-03-28', 1)[0]?.bedToWakeMin).toBe(7 * 60)
    expect(sleepOverview(entries, '2026-10-24', 1)[0]?.bedToWakeMin).toBe(9 * 60)
  })

  it('macht aus widersprüchlichen oder fehlenden Zeiten keinen Abstand', () => {
    const entries = { '2026-11-02': { bedAt: wakeAt, wakeAt: bedAt }, '2026-11-01': { wakeAt }, '2026-10-31': { bedAt: NaN, wakeAt } }
    expect(sleepOverview(entries, '2026-11-02', 3).every((row) => row.bedToWakeMin === undefined)).toBe(true)
  })
})
