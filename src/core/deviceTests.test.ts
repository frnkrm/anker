import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEVICE_TEST_SUITE, currentTestReport, deviceTestsFromLocal, parseDeviceTestCatalog, validDeviceTests } from './deviceTests'
import { makeBackup, parseBackup } from './export/backup'
import type { DeviceTestReport } from './types'

const report: DeviceTestReport = { result: 'passed', note: 'Ton gehört', at: 1000, platform: 'android', device: 'Testgerät', os: 'API36', appVersion: '1.2.0-rc.1', build: '3', suiteVersion: DEVICE_TEST_SUITE, buildFingerprint: 'current' }

describe('Geführte Geräteprüfung', () => {
  it('übernimmt alle63 Punkte aus derselben Dokumentquelle und niemals historische Ergebnisse', () => {
    const catalog = parseDeviceTestCatalog(readFileSync(new URL('../../docs/GERAETETEST.md', import.meta.url), 'utf8'))
    expect(catalog.map((test) => test.id)).toEqual(Array.from({ length: 63 }, (_, i) => i + 1))
    expect(catalog.every((test) => test.group && test.action && test.expected)).toBe(true)
    expect(Object.keys(catalog[0]!)).toEqual(['id', 'group', 'action', 'expected'])
    expect(JSON.stringify(catalog)).not.toContain('Bestätigt vom Nutzer')
    expect(() => parseDeviceTestCatalog('| 1 | Tun | Erwartung | ok |\n| 1 | Tun | Erwartung | |')).toThrow('Doppelte')
  })
  it('alte Daten beginnen ohne Häkchen; APIs erzeugen keine Ergebnisse', () => {
    expect(deviceTestsFromLocal(undefined)).toEqual({ reports: {} })
    expect(deviceTestsFromLocal({ work: [] })).toEqual({ reports: {} })
    expect(deviceTestsFromLocal({ deviceTests: { reports: { 1: null } } })).toEqual({ reports: {} })
  })
  it('trennt Browser, alte Teststände und Androidberichte', () => {
    expect(currentTestReport(report, 'android', 'current')).toBe(report)
    expect(currentTestReport(report, 'web', 'current')).toBeUndefined()
    expect(currentTestReport({ ...report, suiteVersion: 'older' }, 'android', 'current')).toBeUndefined()
    expect(currentTestReport({ ...report, buildFingerprint: 'older-app-build' }, 'android', 'current')).toBeUndefined()
    expect(currentTestReport({ ...report, buildFingerprint: undefined }, 'android', 'current')).toBeUndefined()
    expect(currentTestReport(undefined, 'android', 'current')).toBeUndefined()
  })
  it('behält manuelle Ergebnisse im Backup, akzeptiert Altstände und verwirft ungültige neue Felder vor Import', () => {
    const text = (deviceTests: unknown) => JSON.stringify(makeBackup([{ collection: 'meta', id: 'local', updated_at: 1, deleted: false, data: { deviceTests } }]))
    const progress = { reports: { 3: report }, activeId: 3, alarmBefore: { at: 1000, mainAt: 2000, preWakeAt: 0, snoozed: 1 } }
    expect(parseBackup(text(progress))[0]?.data).toEqual({ deviceTests: progress })
    expect(parseBackup(text(undefined))).toHaveLength(1)
    for (const invalid of [null, [], { reports: null }, { reports: { 3: { ...report, result: 'auto-passed' } } }, { reports: { 3: { ...report, at: 'yesterday' } } }, { reports: {}, activeId: -1 }, { reports: {}, alarmBefore: { at: 1, mainAt: null, preWakeAt: 0, snoozed: 0 } }]) {
      expect(validDeviceTests(invalid)).toBe(false)
      expect(() => parseBackup(text(invalid))).toThrow('ungültige Testergebnisse')
    }
  })
})
