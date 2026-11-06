import type { DeviceTestProgress, DeviceTestReport, DeviceTestResult } from './types'

export const DEVICE_TEST_SUITE = '2026-11-06-e02'
export const TEST_RESULT_LABEL: Record<DeviceTestResult, string> = {
  passed: 'Hat geklappt', partial: 'Teilweise', failed: 'Problem', 'not-applicable': 'Für mich nicht relevant',
}

export interface DeviceTestCase { id: number; group: string; action: string; expected: string }

/** The maintained device document is the catalog. Historical outcomes never become new checkmarks. */
export function parseDeviceTestCatalog(markdown: string): DeviceTestCase[] {
  const cases: DeviceTestCase[] = []
  let group = ''
  const plain = (value: string) => value.replace(/\*\*|\*|`/g, '').trim()
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) group = line.slice(3).trim()
    const cells = line.split('|').map((cell) => cell.trim())
    if (!/^\d+$/.test(cells[1] ?? '') || !cells[2] || !cells[3]) continue
    const id = Number(cells[1])
    if (cases.some((test) => test.id === id)) throw new Error(`Doppelte Geräteprüfung: ${id}`)
    cases.push({ id, group, action: plain(cells[2]), expected: plain(cells[3]) })
  }
  return cases.sort((a, b) => a.id - b.id)
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(new Date(value).getTime()) && value >= 0

export function isDeviceTestReport(value: unknown): value is DeviceTestReport {
  return object(value) && typeof value.result === 'string' && Object.hasOwn(TEST_RESULT_LABEL, value.result)
    && timestamp(value.at) && (value.platform === 'android' || value.platform === 'web')
    && ['note', 'device', 'os', 'appVersion', 'build', 'suiteVersion'].every((key) => typeof value[key] === 'string')
    && (value.buildFingerprint === undefined || typeof value.buildFingerprint === 'string')
}

export function validDeviceTests(value: unknown): boolean {
  if (value === undefined) return true // Compatible with all previous backups.
  if (!object(value) || !object(value.reports)) return false
  if (!Object.entries(value.reports).every(([id, report]) => /^[1-9]\d*$/.test(id) && isDeviceTestReport(report))) return false
  if (value.activeId !== undefined && (typeof value.activeId !== 'number' || !Number.isSafeInteger(value.activeId) || value.activeId < 1)) return false
  if (['device', 'os'].some((key) => value[key] !== undefined && typeof value[key] !== 'string')) return false
  if (value.drafts !== undefined && (!object(value.drafts) || !Object.entries(value.drafts).every(([id, draft]) => /^[1-9]\d*$/.test(id) && object(draft) && ['note', 'device', 'os'].every((key) => typeof draft[key] === 'string')))) return false
  const before = value.alarmBefore
  if (before !== undefined && (!object(before) || !timestamp(before.at) || !timestamp(before.mainAt) || !timestamp(before.preWakeAt) || !Number.isInteger(before.snoozed) || Number(before.snoozed) < 0)) return false
  return true
}

export function deviceTestsFromLocal(local: unknown): DeviceTestProgress {
  if (object(local) && local.deviceTests !== undefined && validDeviceTests(local.deviceTests)) return local.deviceTests as unknown as DeviceTestProgress
  return { reports: {} }
}

/** Count explicitly reported success only for this test version and the actual platform. */
export function currentTestReport(report: DeviceTestReport | undefined, platform: 'android' | 'web', buildFingerprint: string): DeviceTestReport | undefined {
  return report?.suiteVersion === DEVICE_TEST_SUITE && report.platform === platform && report.buildFingerprint === buildFingerprint ? report : undefined
}
