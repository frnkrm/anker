import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { energyNightFor, sleepInsights } from './sleepInsights'
import { validateSleepEntry } from './sleepDiary'
import { addDays, zonedToUtc } from './time'
import type { SleepDiaryEntry } from './types'

const date = '2026-11-02'
const night = (date: string, status: 'confirmed' | 'estimated' = 'confirmed'): SleepDiaryEntry => ({
  bedAt: zonedToUtc(date, 1380), onset: { at: zonedToUtc(date, 1395), status, source: 'prompt-timeout' },
  wakeAt: zonedToUtc(date, 1860), wakeFeedback: { at: zonedToUtc(date, 1870), value: 'right' },
  dayEnergy: { at: zonedToUtc(date, 2700), value: 4 },
})
describe('Vorsichtige lokale Schlafauswertung', () => {
  it('ordnet späte Energierückmeldungen derselben vorangegangenen Nacht zu', () => {
    expect(energyNightFor(zonedToUtc(date, 22 * 60))).toBe('2026-11-01')
    expect(energyNightFor(zonedToUtc('2026-11-03', 30))).toBe('2026-11-01')
  })
  it('wertet eine nicht bestätigte Schätzung und einen QR-Scan nicht als Schlafdauer', () => {
    const n = night(date, 'estimated')
    expect(sleepInsights({ [date]: n }, date)).toEqual({ confirmedNights: 0, estimatedNights: 1, ratedNights: 0 })
    expect(sleepInsights({ [date]: { qrAt: n.wakeAt } }, date).confirmedNights).toBe(0)
  })
  it('bildet erst bei genügend freiwilligen Rückmeldungen einen Vorschlag und ändert keine Einstellungen', () => {
    const s = defaultSettings(date), before = JSON.stringify(s)
    const entries = Object.fromEntries(Array.from({ length: 14 }, (_, i) => { const d = addDays(date, i); return [d, night(d)] }))
    expect(sleepInsights(entries, '2026-11-14').suggestion).toBeUndefined()
    expect(sleepInsights(entries, '2026-11-15').suggestion).toMatchObject({ bed: 1380, wake: 420, supportingNights: 14, observedDurationMin: 465 })
    expect(JSON.stringify(s)).toBe(before)
  })
  it('fehlende Antworten sind weder mittlere Energie noch schlechte Nächte', () => {
    const n = night(date); delete n.dayEnergy
    expect(sleepInsights({ [date]: n }, date)).toMatchObject({ confirmedNights: 1, ratedNights: 0, observedDurationMin: 465 })
  })
  it('hält Schätzung, Korrektur und Weckinteraktionen in der vorhandenen Tagebuchvalidierung getrennt', () => {
    const n = night(date), now = zonedToUtc('2026-11-04', 720)
    expect(validateSleepEntry(date, { ...n, alarmAt: n.wakeAt, qrAt: n.wakeAt! + 1000 }, now)).toMatchObject(n)
    expect(() => validateSleepEntry(date, { ...n, onset: { ...n.onset!, at: n.wakeAt! + 1000 } }, now)).toThrow()
    expect(validateSleepEntry(date, { ...n, onset: { ...n.onset!, at: n.wakeAt! + 1000, status: 'discarded' } }, now).onset?.status).toBe('discarded')
    expect(() => validateSleepEntry(date, { dayEnergy: { at: now, value: 9 as 1 } }, now)).toThrow()
  })
})
