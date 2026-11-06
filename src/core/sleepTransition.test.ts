import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { sleepOutlook } from './sleep'

describe('Schlafgelegenheit ist eine reale Berliner Zeitspanne', () => {
  it.each([
    ['2026-03-28', 23 * 60, 420, true],
    ['2026-10-24', 23 * 60, 540, false],
    ['2026-03-28', 1440 + 90, 270, true],
    ['2026-10-24', 1440 + 90, 390, true],
    ['2026-11-06', 23 * 60, 480, false],
    ['2026-11-06', 1440 + 30, 390, true],
  ] as const)('rechnet %s ab Planminute%s ohne pauschales24-Stunden-Addieren', (date, bed, minutes, short) => {
    const s = defaultSettings(date)
    s.sleep.needMin = 480; s.sleep.fallAsleepMin = 0
    const original = structuredClone(s)
    expect(sleepOutlook(bed, 7 * 60, s, date)).toMatchObject({ sleepMin: minutes, short })
    s.sleep.fallAsleepMin = 15
    expect(sleepOutlook(bed, 7 * 60, s, date).sleepMin).toBe(minutes - 15)
    expect({ ...s, sleep: original.sleep }).toEqual(original)
  })

  it('bewahrt den bisherigen datumslosen Aufruf und erfindet nach dem nötigen Aufstehen keine Schlafzeit', () => {
    const s = defaultSettings('2026-11-06')
    s.sleep.fallAsleepMin = 0
    expect(sleepOutlook(23 * 60, 7 * 60, s).sleepMin).toBe(480)
    expect(sleepOutlook(1440 + 8 * 60, 7 * 60, s, '2026-03-28').sleepMin).toBe(0)
  })
})
