import type { DeviceTestProgress, DeviceTestReport, DeviceTestResult } from './types'

export const DEVICE_TEST_SUITE = '2026-11-06-e04-e09'
export const DEVICE_TEST_CAMPAIGN_GROUP = 'Gemeinsamer Abschlusslauf: E04–E09'
export const DEVICE_TEST_SHORT_GROUP = 'Kurzer Updatecheck'
export const DEVICE_TEST_SHORT_IDS = [1, 21, 62, 92, 95, 96] as const
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
  if (value.history !== undefined && (!object(value.history) || !Object.entries(value.history).every(([id, reports]) => /^[1-9]\d*$/.test(id) && Array.isArray(reports) && reports.every(isDeviceTestReport)))) return false
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

export interface DeviceTestReportFile {
  app: 'anker'
  exportedAt: string
  reports: Record<string, DeviceTestReport>
  history?: Record<string, DeviceTestReport[]>
}

export const DEVICE_REPORT_FILE_LIMIT = 5 * 1024 * 1024
const MAX_IMPORT_REPORTS = 10_000
const MAX_IMPORT_HISTORY_PER_TEST = 1000

function reportIdentity(report: DeviceTestReport): string {
  return JSON.stringify([report.at, report.platform, report.appVersion, report.build, report.suiteVersion,
    report.buildFingerprint ?? null, report.device, report.os, report.result, report.note])
}

/** Identische Dateien sind wiederholbar; abweichende Beobachtungen werden niemals zusammengefasst. */
function distinctReports(reports: readonly DeviceTestReport[]): DeviceTestReport[] {
  return [...new Map(reports.map((report) => [reportIdentity(report), report])).values()]
}

export function deviceTestEvidence(progress: DeviceTestProgress, id: number | string, platform: 'android' | 'web', fingerprint: string): { current?: DeviceTestReport; previous: DeviceTestReport[] } {
  const report = progress.reports[id]
  const current = currentTestReport(report, platform, fingerprint)
  const previous = distinctReports([...(report && !current ? [report] : []), ...(progress.history?.[id] ?? [])])
    .sort((a, b) => b.at - a.at)
  return { current, previous }
}

/** Ein neuer Bericht ersetzt nur nach einem bewussten Versuch; sein Vorgänger bleibt ein Beleg. */
export function saveDeviceTestReport(progress: DeviceTestProgress, id: number, report: DeviceTestReport): DeviceTestProgress {
  const previous = progress.reports[id]
  const reports = { ...progress.reports, [id]: report }
  const archived = distinctReports([...(progress.history?.[id] ?? []), ...(previous ? [previous] : [])])
    .filter((entry) => reportIdentity(entry) !== reportIdentity(report))
  const history = { ...progress.history }
  if (archived.length) history[id] = archived
  else delete history[id]
  const next = { ...progress, reports }
  if (Object.keys(history).length) next.history = history
  else delete next.history
  return next
}

export function reopenDeviceTestReport(progress: DeviceTestProgress, id: number): DeviceTestProgress {
  const reports = { ...progress.reports }
  const previous = reports[id]
  delete reports[id]
  const drafts = { ...progress.drafts }
  delete drafts[id]
  return { ...progress, reports, drafts, ...(previous ? { history: { ...progress.history, [id]: distinctReports([...(progress.history?.[id] ?? []), previous]) } } : {}) }
}

/** Das bisherige Exportformat bleibt lesbar; zusätzliche Historie ist optional. */
export function exportDeviceTestReports(progress: DeviceTestProgress, now = new Date()): DeviceTestReportFile {
  if (!validDeviceTests(progress)) throw new Error('Die gespeicherten Testberichte sind ungültig.')
  const file: DeviceTestReportFile = structuredClone({ app: 'anker', exportedAt: now.toISOString(), reports: progress.reports,
    ...(progress.history && Object.values(progress.history).some((reports) => reports.length) ? { history: progress.history } : {}) })
  // Never call an export successful when this app could not import the same file.
  try { return parseDeviceTestReportFile(JSON.stringify(file, null, 2)) }
  catch { throw new Error('Diese Berichte überschreiten die Dateigrenzen. Der Export wurde nicht erstellt; alle Berichte bleiben in der App. Sichere sie mit der vollständigen Datensicherung.') }
}

export function parseDeviceTestReportFile(text: string): DeviceTestReportFile {
  if (text.length > DEVICE_REPORT_FILE_LIMIT || new TextEncoder().encode(text).byteLength > DEVICE_REPORT_FILE_LIMIT) throw new Error('Die Datei ist größer als 5 MB. Es wurde nichts übernommen.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('Die Datei ist kein gültiges JSON. Es wurde nichts übernommen.') }
  if (!object(value) || value.app !== 'anker' || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))
    || !validDeviceTests({ reports: value.reports, history: value.history })) throw new Error('Das sind keine gültigen Anker-Testberichte. Es wurde nichts übernommen.')
  const reports = value.reports as Record<string, DeviceTestReport>
  const history = value.history as Record<string, DeviceTestReport[]> | undefined
  if ([...Object.keys(reports), ...Object.keys(history ?? {})].some((id) => !Number.isSafeInteger(Number(id)))) throw new Error('Eine Testnummer ist ungültig. Es wurde nichts übernommen.')
  const all = [...Object.values(reports), ...Object.values(history ?? {}).flat()]
  if (all.length > MAX_IMPORT_REPORTS || Object.values(history ?? {}).some((entries) => entries.length > MAX_IMPORT_HISTORY_PER_TEST)) throw new Error('Die Datei enthält mehr als 10.000 Berichte oder 1.000 Belege je Test. Es wurde nichts übernommen.')
  if (all.some((report) => report.note.length > 100_000 || [report.device, report.os, report.appVersion, report.build, report.suiteVersion, report.buildFingerprint ?? ''].some((entry) => entry.length > 1024))) throw new Error('Ein Bericht enthält ungewöhnlich lange Angaben. Es wurde nichts übernommen.')
  return structuredClone({ app: 'anker', exportedAt: value.exportedAt, reports, ...(history ? { history } : {}) })
}

/** Importierte Beobachtungen bleiben frühere Belege; nur ein eigener Versuch setzt die maßgebliche Rückmeldung. */
export function mergeDeviceTestReports(progress: DeviceTestProgress, incoming: DeviceTestReportFile): DeviceTestProgress {
  const reports = { ...progress.reports }
  const history = { ...progress.history }
  for (const id of new Set([...Object.keys(incoming.reports), ...Object.keys(incoming.history ?? {})])) {
    const imported = incoming.reports[id]
    const primary = reports[id]
    const archived = distinctReports([...(history[id] ?? []), ...(incoming.history?.[id] ?? []), ...(imported ? [imported] : [])])
      .filter((report) => !primary || reportIdentity(report) !== reportIdentity(primary))
    if (archived.length) history[id] = archived
  }
  return { ...progress, reports, ...(Object.keys(history).length ? { history } : {}) }
}

export function deviceTestImportSummary(progress: DeviceTestProgress, incoming: DeviceTestReportFile): { reports: number; android: number; web: number; added: number; preserved: number } {
  const ids = [...new Set([...Object.keys(incoming.reports), ...Object.keys(incoming.history ?? {})])]
  const all = ids.flatMap((id) => distinctReports([...(incoming.reports[id] ? [incoming.reports[id]] : []), ...(incoming.history?.[id] ?? [])]))
  return { reports: all.length, android: all.filter((report) => report.platform === 'android').length,
    web: all.filter((report) => report.platform === 'web').length,
    added: ids.filter((id) => !progress.reports[id] && !progress.history?.[id]?.length).length,
    preserved: ids.filter((id) => progress.reports[id] !== undefined).length }
}
