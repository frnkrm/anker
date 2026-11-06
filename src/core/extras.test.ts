import { describe, expect, it } from 'vitest'
import { extraSettings, validExtrasLocal, validExtrasSettings } from './extras'

describe('Freiwillige lokale Extras', () => {
  it('schaltet neue Sprachfähigkeiten bei Altständen nicht ein', () => {
    expect(extraSettings()).toEqual({ dictation: false, spokenCues: false })
    expect(extraSettings({ dictation: true })).toEqual({ dictation: true, spokenCues: false })
    expect(validExtrasSettings(undefined)).toBe(true)
    expect(validExtrasSettings({ dictation: 'ja', spokenCues: false })).toBe(false)
  })
  it('verlangt für Geofences einen besuchsbezogenen ausdrücklichen und begrenzten Datensatz', () => {
    const choice = { radiusM: 150, dwellMs: 120_000, consentedAt: 1000 }
    expect(validExtrasLocal({ geofences: { enabled: false, visits: {} } })).toBe(true)
    expect(validExtrasLocal({ geofences: { enabled: true, visits: { visit: choice } } })).toBe(true)
    for (const patch of [{ radiusM: 0 }, { dwellMs: 0 }, { consentedAt: NaN }]) expect(validExtrasLocal({ geofences: { enabled: true, visits: { visit: { ...choice, ...patch } } } })).toBe(false)
    expect(validExtrasLocal({ calendar: { state: 'ready', checkedAt: 10, fetchedAt: 9 } })).toBe(true)
    expect(validExtrasLocal({ calendar: { state: 'ready', checkedAt: -1 } })).toBe(false)
  })
})
