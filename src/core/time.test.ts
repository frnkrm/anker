import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  fmtDuration,
  fmtTime,
  minutesOnPlanDay,
  parseTime,
  todayBerlin,
  tzOffsetMinutes,
  utcToZoned,
  weekday,
  zonedToUtc,
} from './time'

describe('zonedToUtc', () => {
  it('Sommerzeit: Mitternacht Berlin = 22:00 UTC am Vortag', () => {
    expect(zonedToUtc('2026-07-01', 0)).toBe(Date.UTC(2026, 5, 30, 22))
  })
  it('Winterzeit: 06:00 Berlin = 05:00 UTC', () => {
    expect(zonedToUtc('2026-12-01', 360)).toBe(Date.UTC(2026, 11, 1, 5))
  })
  it('Sommerzeit-Lücke: 02:30 am 29.03.2026 wird auf 03:30 verschoben', () => {
    const t = zonedToUtc('2026-03-29', 150)
    expect(t).toBe(Date.UTC(2026, 2, 29, 1, 30))
    expect(utcToZoned(t)).toEqual({ date: '2026-03-29', minutes: 210 })
  })
  it('Zeitumstellung im Oktober: 06:00 am 25.10.2026 = 05:00 UTC', () => {
    expect(zonedToUtc('2026-10-25', 360)).toBe(Date.UTC(2026, 9, 25, 5))
  })
  it('Minuten > 1440 landen am Folgetag', () => {
    expect(utcToZoned(zonedToUtc('2026-11-02', 1470))).toEqual({ date: '2026-11-03', minutes: 30 })
  })
  it('Roundtrip über das ganze Jahr', () => {
    for (let d = 0; d < 365; d += 7) {
      const date = addDays('2026-01-01', d)
      for (const m of [0, 375, 720, 1335]) expect(utcToZoned(zonedToUtc(date, m))).toEqual({ date, minutes: m })
    }
  })
})

describe('Hilfsfunktionen', () => {
  it('Offset Sommer/Winter', () => {
    expect(tzOffsetMinutes(Date.UTC(2026, 6, 1))).toBe(120)
    expect(tzOffsetMinutes(Date.UTC(2026, 0, 1))).toBe(60)
  })
  it('minutesOnPlanDay zählt Wandzeit, auch am Umstellungstag', () => {
    expect(minutesOnPlanDay('2026-10-25', zonedToUtc('2026-10-25', 600))).toBe(600)
    expect(minutesOnPlanDay('2026-03-29', zonedToUtc('2026-03-29', 600))).toBe(600)
    expect(minutesOnPlanDay('2026-11-02', zonedToUtc('2026-11-03', 30))).toBe(1470)
    expect(minutesOnPlanDay('2026-11-02', zonedToUtc('2026-11-01', 1380))).toBe(-60)
  })
  it('todayBerlin kurz nach Mitternacht', () => {
    expect(todayBerlin(Date.UTC(2026, 10, 2, 23, 30))).toBe('2026-11-03')
  })
  it('addDays über Monats- und Jahresgrenze', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-20', '2026-11-02')).toBe(13)
  })
  it('weekday: 0 = Montag', () => {
    expect(weekday('2026-11-02')).toBe(0)
    expect(weekday('2026-11-08')).toBe(6)
  })
  it('Formatierung', () => {
    expect(fmtTime(1470)).toBe('00:30')
    expect(fmtTime(435)).toBe('07:15')
    expect(fmtTime(-30)).toBe('23:30')
    expect(parseTime('7:05')).toBe(425)
    expect(parseTime('24:00')).toBeNaN()
    expect(fmtDuration(95)).toBe('1 h 35 min')
    expect(fmtDuration(40)).toBe('40 min')
  })
})
