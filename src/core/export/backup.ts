import { key, remoteWins } from '../../data/merge'
import type { Rec } from '../../data/types'
import { isFocusSession, sameFocusTarget } from '../focus'
import { localBusinessNote } from '../syncPrivacy'
import { TIME_CATALOG_RECORD_ID } from '../timeCatalog'
import { deviceTestsFromLocal, mergeDeviceTestReports, validDeviceTests } from '../deviceTests'
import { object, validatedRecords } from './backupValidation'

export { validatedRecords } from './backupValidation'

/** Nur eine Exportauswahl; die Domänendaten bleiben im vorhandenen Repository. */
export interface BackupSelection {
  work: boolean
  health: boolean
  places: boolean
  deviceTests: boolean
}
export const COMPLETE_BACKUP: Readonly<BackupSelection> = { work: true, health: true, places: true, deviceTests: true }

export interface Backup {
  app: 'anker'
  version: 1
  exportedAt: string
  selection?: BackupSelection
  records: Rec[]
}

function without(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
}

function withoutDeviceCalendar(value: Record<string, unknown>): Record<string, unknown> {
  return object(value.extras) ? { ...value, extras: without(value.extras, ['deviceCalendar']) } : value
}

/** Learning keys group by title/series; only the existing sample id retains its source task id. */
function omittedSample(value: unknown, businessIds: ReadonlySet<string>, privateIds: ReadonlySet<string>): boolean {
  if (!object(value)) return true
  const key = typeof value.key === 'string' ? value.key : ''
  const source = typeof value.id === 'string' ? value.id : ''
  const matches = (id: string) => source.startsWith(`task:${id}:`) || key === `task:${id}`
  return key.startsWith('work:') || source.startsWith('work:') || [...businessIds].some(matches)
    || ![...privateIds].some(matches)
}

const privateNoteIds = (records: readonly Rec[]) => new Set(records.filter(r => r.collection === 'inbox'
  && object(r.data) && !localBusinessNote(r.data)).map(r => r.id))

/** Weggelassene Gruppen fehlen wirklich; sie werden beim Import nicht als Löschauftrag ausgegeben. */
export function selectBackupRecords(records: readonly Rec[], choice: Partial<BackupSelection> = {}): Rec[] {
  const selection = { ...COMPLETE_BACKUP, ...choice }
  const businessIds = new Set(records.filter((record) => record.collection === 'inbox' && localBusinessNote(record.data)).map((record) => record.id))
  const privateIds = privateNoteIds(records)
  const workReference = (value: unknown): boolean => object(value) && (value.kind === 'work' || value.kind === 'task'
    && !privateIds.has(String(value.refId ?? value.id)))
  return records.filter((record) => (record.collection !== 'meta' || record.id !== TIME_CATALOG_RECORD_ID)
    && (selection.places || record.collection !== 'meta' || record.id !== 'events')
    && (selection.work || record.collection !== 'inbox' || !businessIds.has(record.id))).map((record) => {
    const copy = structuredClone(record)
    if (copy.collection === 'meta' && copy.id === 'local' && object(copy.data)) copy.data = withoutDeviceCalendar(copy.data)
    // A deletion only needs identity/revision. Its former body must not bypass an omitted group.
    if (copy.deleted) return { ...copy, data: null }
    if (!object(copy.data)) return copy
    let data = copy.data
    if (record.collection === 'settings') {
      if (!selection.health && object(data.alarm)) data = { ...data, alarm: without(data.alarm, ['medicationEnabled', 'medicationReminderAt']) }
      if (!selection.places && object(data.weather)) data = { ...data, weather: without(data.weather, ['city', 'lat', 'lng', 'enabled']) }
    }
    if (record.collection === 'meta' && record.id === 'local') {
      // Eine abgeleitete Übersicht kann Arbeits-/Orts-/Gesundheitsquellen zusammenführen.
      // Auch vollständige Backups enthalten deshalb ausschließlich die Originaldaten.
      data = without(data, ['timeCatalog', 'pcBridge', 'healthSleepEnabled'])
      if (!selection.health) data = without(data, ['meds', 'sleepDiary', 'guidance'])
      if (!selection.deviceTests) data = without(data, ['deviceTests'])
      if (!selection.places) {
        data = without(data, ['places', 'commitments', 'planUndo', 'weather', 'weatherProfile', 'packTemplates', 'routeProfile', 'routeEstimates', 'acknowledgedPlanConflicts'])
        if (object(data.extras)) data = { ...data, extras: without(data.extras, ['geofences', 'ownCalendar']) }
        if (object(data.assistance)) data = { ...data, assistance: without(data.assistance, ['routeChecks']) }
      }
      if (!selection.work) {
        data = without(data, ['work', 'workSessions', 'handover', 'homeOfficeContact', 'acknowledgedPlanConflicts'])
        if (workReference(data.resume)) data = without(data, ['resume'])
        if (object(data.captureDraft) && workReference(data.captureDraft.context)) data = without(data, ['captureDraft'])
        if (object(data.focus) && workReference(data.focus.target)) data = without(data, ['focus'])
        if (Array.isArray(data.focusHistory)) data = { ...data, focusHistory: data.focusHistory.filter((focus) => !object(focus) || !workReference(focus.target)) }
        if (object(data.taskLearning) && Array.isArray(data.taskLearning.samples)) data = { ...data, taskLearning: { ...data.taskLearning, samples: data.taskLearning.samples.filter(sample => !omittedSample(sample, businessIds, privateIds)) } }
      }
    }
    return { ...copy, data }
  })
}

export function makeBackup(records: Rec[], now = new Date(), choice: Partial<BackupSelection> = {}): Backup {
  const selection = { ...COMPLETE_BACKUP, ...choice }
  return { app: 'anker', version: 1, exportedAt: now.toISOString(), selection, records: selectBackupRecords(records, selection).map(({ dirty: _dirty, ...record }) => record) }
}

/** Ungültige Datensätze werden nicht still herausgefiltert; vorher bleibt der ganze Import unangetastet. */
export function parseBackup(text: string): Rec[] {
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('Die Datei ist kein gültiges JSON.') }
  if (!object(value) || value.app !== 'anker' || !Array.isArray(value.records)) throw new Error('Das ist keine Anker-Sicherung.')
  if (value.version !== 1) throw new Error('Diese Sicherung stammt aus einer anderen App-Version.')
  return validatedRecords(withoutPcConnection(value.records)).map(record => {
    if (record.collection !== 'meta' || record.id !== 'local' || !object(record.data)
      || !Object.hasOwn(record.data, 'healthSleepEnabled')) return record
    return { ...record, data: { ...record.data, healthSleepEnabled: false } }
  })
}

/** An imported file cannot transplant device pairing, ACKs, native cursors or calendar consent.
 * The same-device connection is retained later through preserveOmitted. */
function withoutPcConnection(records: unknown): unknown {
  return Array.isArray(records) ? records.map(record => object(record) && record.collection === 'meta' && record.id === 'local' && object(record.data)
    ? { ...record, data: withoutDeviceCalendar(without(record.data, ['pcBridge'])) } : record) : records
}

/** Restoring data is not fresh consent to external reads, uploads, audio or PC effects.
 * Omitted choices are retained from this device by preserveOmitted, or use disabled defaults.
 * Keep validation before projection so malformed imported data still rejects the whole batch. */
function withoutDeviceConsents(record: Rec): Rec {
  if (record.deleted || !object(record.data)) return record
  if (record.collection === 'settings') {
    const data = without(record.data, ['integrations', 'extras', 'guidance'])
    return { ...record, data: object(data.weather) ? { ...data, weather: { ...data.weather, enabled: false } } : data }
  }
  if (record.collection !== 'meta' || record.id !== 'local') return record
  let data = without(record.data, ['healthSleepEnabled'])
  if (object(data.assistance)) data = { ...data, assistance: without(data.assistance, ['ai', 'routes']) }
  if (object(data.extras)) data = { ...data, extras: without(data.extras, ['geofences']) }
  if (object(data.weatherProfile)) data = { ...data, weatherProfile: { ...data.weatherProfile, enabled: false } }
  if (object(data.taskLearning)) data = { ...data, taskLearning: { ...data.taskLearning, enabled: false } }
  if (object(data.guidance) && object(data.guidance.ifThen)) data = { ...data,
    guidance: { ...data.guidance, ifThen: { ...data.guidance.ifThen, showOnPc: false } } }
  return { ...record, data }
}

/** Nur fehlende Objektfelder ergänzen. Vorhandene Werte/Listen bleiben weiterhin pro Record LWW. */
function preserveOmitted(current: unknown, incoming: unknown, path = ''): unknown {
  if (path === 'local.taskLearning' && object(incoming)) incoming = { ...incoming, enabled: object(current) && current.enabled === true }
  // Sitzungen und Rückwege sind vollständige Identitäten. Eine alte Elternreferenz
  // ohne partId darf niemals die Teilreferenz einer neueren lokalen Sitzung erben.
  if (['local.focus', 'local.resume', 'local.captureDraft'].includes(path) || /^local\.deviceTests\.reports\.[1-9]\d*$/.test(path)) return incoming
  if (!object(current) || !object(incoming)) return incoming
  return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(incoming)])].map((key) => [
    key, Object.hasOwn(incoming, key) ? preserveOmitted(current[key], incoming[key], path ? `${path}.${key}` : key) : current[key],
  ]))
}

/** Eine Sicherung ohne Arbeitsgruppe enthält nur den privaten Teil des Fokusarchivs. */
function preserveWorkHistory(current: unknown, incoming: unknown, businessIds: ReadonlySet<string>, privateIds: ReadonlySet<string>): unknown {
  if (!object(current) || !object(incoming) || Object.hasOwn(incoming, 'work')) return incoming
  let out = incoming
  if (Array.isArray(current.focusHistory) && Array.isArray(incoming.focusHistory)) {
    const incomingHistory = incoming.focusHistory.filter(isFocusSession)
    const retained = current.focusHistory.filter(isFocusSession).filter((focus) =>
      (focus.target.kind === 'work' || focus.target.kind === 'task' && !privateIds.has(focus.target.id))
      && !incomingHistory.some((next) => sameFocusTarget(next.target, focus.target)))
    out = { ...out, focusHistory: [...incomingHistory, ...retained] }
  }
  if (object(current.taskLearning) && object(incoming.taskLearning)
    && Array.isArray(current.taskLearning.samples) && Array.isArray(incoming.taskLearning.samples)) {
    const samples = incoming.taskLearning.samples
    const retained = current.taskLearning.samples.filter(sample => omittedSample(sample, businessIds, privateIds)
      && !samples.some(next => object(next) && object(sample) && next.id === sample.id))
    out = { ...out, taskLearning: { ...incoming.taskLearning, samples: [...samples, ...retained] } }
  }
  return out
}

/** Normaler Import bleibt LWW; Wiederherstellen ist eine eigene bewusste Wahl. */
export type BackupImportMode = 'merge' | 'restore'

/** Ein Restore ergänzt Testbelege, überschreibt aber keine aktuelle Beobachtung. */
function restoredTestEvidence(current: unknown, incoming: unknown, merged: unknown, at: number): unknown {
  if (!object(incoming) || !Object.hasOwn(incoming, 'deviceTests') || !validDeviceTests(incoming.deviceTests) || !object(merged)) return merged
  const before = deviceTestsFromLocal(current)
  const imported = deviceTestsFromLocal(incoming)
  const combined = mergeDeviceTestReports(before, { app: 'anker', exportedAt: new Date(at).toISOString(), reports: imported.reports, history: imported.history })
  return { ...merged, deviceTests: { ...(object(merged.deviceTests) ? merged.deviceTests : {}), reports: combined.reports, history: combined.history } }
}

/** Nur gewählte Recordrevisionen werden neu gesetzt; echte Ereignis-/Berichtszeiten bleiben original. */
function restoreCandidates(records: readonly Rec[], current: readonly Rec[], nowMs: number): Rec[] {
  let latest = nowMs
  for (const record of [...current, ...records]) latest = Math.max(latest, record.updated_at)
  const revision = Math.floor(latest) + 1
  if (!Number.isFinite(nowMs) || nowMs < 0 || !Number.isSafeInteger(revision) || !Number.isFinite(new Date(revision).getTime())) {
    throw new Error('Der Datenzeitpunkt dieser Sicherung lässt sich nicht sicher wiederherstellen. Es wurde nichts übernommen.')
  }
  const selected = new Map<string, Rec>()
  for (const record of records) if (remoteWins(selected.get(key(record)), record)) selected.set(key(record), record)
  return [...selected.values()].map((record) => ({ ...record, updated_at: revision }))
}

export interface ImportPreview {
  records: Rec[]
  incoming: number
  changed: number
  skipped: number
  deletions: number
  sensitive: string[]
}

/** Vorschau und unmittelbarer Store-Import benutzen dieselbe Projektion, keine zweite Import-Engine. */
export function previewImport(incoming: unknown, current: readonly Rec[], mode: BackupImportMode = 'merge', nowMs = Date.now()): ImportPreview {
  if (mode !== 'merge' && mode !== 'restore') throw new Error('Dieser Importmodus ist nicht gültig.')
  const records = validatedRecords(withoutPcConnection(incoming)).map(withoutDeviceConsents)
  const candidates = mode === 'restore' ? restoreCandidates(records, current, nowMs) : records
  const previous = new Map(current.map((record) => [key(record), record]))
  const businessIds = new Set(current.filter((record) => record.collection === 'inbox' && !record.deleted && localBusinessNote(record.data)).map((record) => record.id))
  const privateIds = privateNoteIds(current)
  const winners = new Map<string, Rec>()
  for (const record of candidates) {
    const id = key(record)
    const before = winners.get(id) ?? previous.get(id)
    if (!remoteWins(before, record)) continue
    const beforeData = before?.deleted ? undefined : before?.data
    const incomingData = record.collection === 'meta' && record.id === 'local' ? preserveWorkHistory(beforeData, record.data, businessIds, privateIds) : record.data
    const merged = !record.deleted && ((record.collection === 'settings' && record.id === 'main') || (record.collection === 'meta' && record.id === 'local'))
      ? { ...record, data: preserveOmitted(beforeData, incomingData, record.collection === 'meta' ? 'local' : 'settings') }
      : record
    const finalRecord = mode === 'restore' && record.collection === 'meta' && record.id === 'local' && !record.deleted
      ? { ...merged, data: restoredTestEvidence(beforeData, incomingData, merged.data, nowMs) } : merged
    winners.set(id, finalRecord)
  }
  const prepared = validatedRecords([...winners.values()])
  const local = records.find((record) => !record.deleted && record.collection === 'meta' && record.id === 'local')?.data
  const sensitive = object(local) ? [
    ...(['work', 'workSessions', 'handover', 'homeOfficeContact'].some((field) => Object.hasOwn(local, field)) ? ['Arbeitsaufgaben und Zeiten'] : []),
    ...(['meds', 'sleepDiary'].some((field) => Object.hasOwn(local, field)) ? ['Einnahme- oder Schlafprotokoll'] : []),
    ...(['places', 'commitments'].some((field) => Object.hasOwn(local, field)) ? ['Orte und Termine'] : []),
  ] : []
  return { records: prepared, incoming: records.length, changed: prepared.length, skipped: records.length - prepared.length,
    deletions: prepared.filter((record) => record.deleted).length, sensitive }
}
