import { describe, expect, it } from 'vitest'
import { buildAlarmConfig, nextAlarmTimes } from './alarm'
import { defaultSettings, migrateSettings } from './defaults'
import { smartWakeWindow } from './smartWake'
import { zonedToUtc } from './time'

describe('Aktivitäts-Weckfenster', () => {
  it('beginnt 45 echte Minuten vor dem unveränderten festen Wecker', () => {
    const settings = defaultSettings('2026-11-02')
    const now = zonedToUtc('2026-11-02', 22 * 60)
    const before = nextAlarmTimes(buildAlarmConfig(settings, {}, '2026-11-02'), now)
    settings.alarm.smartWake = { enabled: true, windowMinutes: 45 }
    const cfg = buildAlarmConfig(settings, {}, '2026-11-02')
    expect(nextAlarmTimes(cfg, now)).toEqual(before)
    expect(smartWakeWindow(before.mainAt, 45)).toEqual({ from: before.mainAt - 45 * 60_000, to: before.mainAt })
    expect(cfg.smartWakeEnabled).toBe(true)
  })

  it('bleibt bei alten Einstellungen aus und ergänzt die Fensterlänge', () => {
    const settings = defaultSettings('2026-11-02')
    const legacy = JSON.parse(JSON.stringify(settings))
    delete legacy.alarm.smartWake
    expect(migrateSettings(legacy, '2026-11-02').alarm.smartWake).toEqual({ enabled: false, windowMinutes: 45 })
  })

  it('berechnet das Fenster auch über Mitternacht und Zeitumstellung als reale Zeitspanne', () => {
    const target = zonedToUtc('2026-10-25', 150)
    expect(smartWakeWindow(target, 45)?.from).toBe(target - 45 * 60_000)
    expect(smartWakeWindow(zonedToUtc('2026-11-03', 20), 45)?.from).toBe(zonedToUtc('2026-11-02', 1415))
    for (const minutes of [NaN, -1, 0, 91, 45.5]) expect(smartWakeWindow(target, minutes)).toBeUndefined()
  })
})
