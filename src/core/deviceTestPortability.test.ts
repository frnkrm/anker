import { describe, expect, it } from 'vitest'
import { DEVICE_REPORT_FILE_LIMIT, DEVICE_TEST_SUITE, deviceTestEvidence, deviceTestImportSummary,
  exportDeviceTestReports, mergeDeviceTestReports, parseDeviceTestReportFile, reopenDeviceTestReport,
  saveDeviceTestReport, validDeviceTests } from './deviceTests'
import { makeBackup, parseBackup } from './export/backup'
import type { DeviceTestProgress, DeviceTestReport } from './types'

const old: DeviceTestReport = { result: 'passed', note: 'Am eigenen Gerät gehört', at: 1000, platform: 'android', device: 'Mein Handy', os: 'Android 16', appVersion: '1.3.0-rc.1', build: '8', suiteVersion: 'old-suite', buildFingerprint: 'old-code' }
const failed: DeviceTestReport = { ...old, at: 2000, result: 'failed', note: 'Hier bleibt ein Fehler', appVersion: '1.3.0-rc.2', build: '10', suiteVersion: DEVICE_TEST_SUITE, buildFingerprint: 'current' }
const file = (reports: Record<string, DeviceTestReport>, history?: Record<string, DeviceTestReport[]>) => ({ app: 'anker' as const, exportedAt: '2026-11-07T12:00:00.000Z', reports, ...(history ? { history } : {}) })

describe('Tragbare Gerätebelege', () => {
  it('liest das bisherige Exportformat mit allen ursprünglichen Metadaten', () => {
    expect(parseDeviceTestReportFile(JSON.stringify(file({ 1: old })))).toEqual(file({ 1: old }))
    expect(Object.keys(exportDeviceTestReports({ reports: { 1: old } })).sort()).toEqual(['app', 'exportedAt', 'reports'])
  })
  it('archiviert beim neuen Versuch und beim Wiederöffnen, ohne einen Beleg umzudeuten', () => {
    const original: DeviceTestProgress = { reports: { 1: old }, drafts: { 1: { note: 'Entwurf', device: '', os: '' } } }
    const saved = saveDeviceTestReport(original, 1, failed)
    expect(original.reports[1]).toEqual(old)
    expect(saved.reports[1]).toEqual(failed)
    expect(saved.history?.[1]).toEqual([old])
    expect(deviceTestEvidence(saved, 1, 'android', 'current')).toEqual({ current: failed, previous: [old] })
    const reopened = reopenDeviceTestReport(saved, 1)
    expect(reopened.reports[1]).toBeUndefined()
    expect(reopened.drafts?.[1]).toBeUndefined()
    expect(deviceTestEvidence(reopened, 1, 'android', 'current')).toEqual({ current: undefined, previous: [failed, old] })
  })
  it('bewahrt aktuelle Fehler gegen importierte Erfolge, auch bei gleichem Fingerprint', () => {
    const progress = { reports: { 1: failed } }
    const imported = { ...failed, at: 3000, result: 'passed' as const, note: 'Anderer Versuch' }
    const merged = mergeDeviceTestReports(progress, file({ 1: imported, 21: imported }))
    expect(progress).toEqual({ reports: { 1: failed } })
    expect(merged.reports).toEqual({ 1: failed })
    expect(deviceTestEvidence(merged, 1, 'android', 'current').current?.result).toBe('failed')
    expect(deviceTestEvidence(merged, 21, 'android', 'current')).toEqual({ current: undefined, previous: [imported] })
    expect(mergeDeviceTestReports(merged, file({ 1: imported, 21: imported }))).toEqual(merged)
  })
  it('erhält alle Plattformen, unbekannte Testnummern und verschiedene Versuche im Export-Import-Roundtrip', () => {
    const browser: DeviceTestReport = { ...failed, at: 4000, platform: 'web', result: 'partial', build: 'Web' }
    const saved = saveDeviceTestReport({ reports: { 1: old, 1001: browser } }, 1, failed)
    const exported = exportDeviceTestReports(saved, new Date('2026-11-07T12:00:00Z'))
    const incoming = parseDeviceTestReportFile(JSON.stringify(exported, null, 2))
    const restored = mergeDeviceTestReports({ reports: {} }, incoming)
    expect(restored.reports).toEqual({})
    expect(deviceTestEvidence(restored, 1, 'android', 'current').previous).toEqual([failed, old])
    expect(restored.history?.[1001]).toEqual([browser])
    const reimported = parseDeviceTestReportFile(JSON.stringify(exportDeviceTestReports(restored)))
    expect(mergeDeviceTestReports(restored, reimported)).toEqual(restored)
    expect(exported.reports[1]).toEqual(failed)
    expect(exported.history?.[1]).toEqual([old])
  })
  it('zählt dieselbe Beobachtung unter verschiedenen Testnummern getrennt', () => {
    expect(deviceTestImportSummary({ reports: { 1: failed } }, file({ 1: old, 2: old }, { 1: [old] }))).toEqual({ reports: 2, android: 2, web: 0, added: 1, preserved: 1 })
  })
  it('validiert neue Historie auch in der vollständigen Datensicherung', () => {
    const backup = (progress: unknown) => JSON.stringify(makeBackup([{ collection: 'meta', id: 'local', updated_at: 1, deleted: false, data: { deviceTests: progress } }]))
    const progress = { reports: { 1: failed }, history: { 1: [old] } }
    expect(parseBackup(backup(progress))[0]?.data).toEqual({ deviceTests: progress })
    for (const history of [[], { 1: null }, { 1: [null] }, { 1: [{ ...old, platform: 'unknown' }] }, { '-1': [old] }]) {
      expect(validDeviceTests({ reports: {}, history })).toBe(false)
      expect(() => parseBackup(backup({ reports: {}, history }))).toThrow('ungültige Testergebnisse')
      expect(() => parseDeviceTestReportFile(JSON.stringify({ ...file({}), history }))).toThrow()
    }
  })
  it('lehnt ungültige und übergroße Dateien vollständig ab und kürzt nichts still', () => {
    for (const invalid of ['{', '[]', JSON.stringify({ ...file({ 1: old }), app: 'other' }), JSON.stringify(file({ 1: { ...old, at: -1 } })), JSON.stringify(file({ 1: { ...old, device: 'x'.repeat(1025) } })), JSON.stringify(file({}, { 1: Array.from({ length: 1001 }, () => old) }))]) {
      expect(() => parseDeviceTestReportFile(invalid)).toThrow()
    }
    expect(() => parseDeviceTestReportFile(' '.repeat(DEVICE_REPORT_FILE_LIMIT + 1))).toThrow('5 MB')
    expect(() => parseDeviceTestReportFile('ü'.repeat(DEVICE_REPORT_FILE_LIMIT / 2 + 1))).toThrow('5 MB')
    expect(() => parseDeviceTestReportFile(JSON.stringify(file(Object.fromEntries(Array.from({ length: 10001 }, (_, index) => [index + 1, old])))))).toThrow('10.000 Berichte')
    expect(() => parseDeviceTestReportFile(JSON.stringify(file({ '9007199254740992': old })))).toThrow('Testnummer')
    const large = { reports: { 1: { ...old, note: 'x'.repeat(100001) } } }
    expect(() => exportDeviceTestReports(large)).toThrow('Export wurde nicht erstellt')
    expect(large.reports[1].note).toHaveLength(100001)
  })
})
