import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { dailyMeasurementDecision } from './nightMeasurement'

describe('Tägliche Nachtmessung', () => {
  const input = () => ({ settings: defaultSettings('2026-11-02'), now: 1000, bedAt: 1000, targetAt: 1000 + 8 * 3600_000, active: false, foreground: true, microphoneGranted: true, alarmRinging: false })
  it('beginnt aus und benötigt die konkrete tägliche Wahl', () => {
    const i = input()
    expect(dailyMeasurementDecision(i)).toBe('none')
    i.settings.alarm.smartWake.enabled = true; i.settings.alarm.smartWake.autoDaily = true
    expect(dailyMeasurementDecision(i)).toBe('start-visible')
    expect(dailyMeasurementDecision({ ...i, foreground: false })).toBe('remind')
    expect(dailyMeasurementDecision({ ...i, microphoneGranted: false })).toBe('remind')
  })
  it('startet nach Neustart oder Stopp nicht mehrfach dieselbe Nacht und holt morgens nichts nach', () => {
    const i = input(); i.settings.alarm.smartWake = { enabled: true, autoDaily: true, windowMinutes: 45 }
    expect(dailyMeasurementDecision({ ...i, lastTargetAt: i.targetAt })).toBe('none')
    expect(dailyMeasurementDecision({ ...i, alarmRinging: true })).toBe('none')
    expect(dailyMeasurementDecision({ ...i, now: i.bedAt + 3 * 3600_000 })).toBe('none')
  })
})
