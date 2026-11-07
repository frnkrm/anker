import { key, remoteWins } from '../../data/merge'
import type { Rec } from '../../data/types'
import { isFocusSession, sameFocusTarget } from '../focus'
import { localBusinessNote } from '../syncPrivacy'
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

/** Weggelassene Gruppen fehlen wirklich; sie werden beim Import nicht als Löschauftrag ausgegeben. */
export function selectBackupRecords(records: readonly Rec[], choice: Partial<BackupSelection> = {}): Rec[] {
  const selection = { ...COMPLETE_BACKUP, ...choice }
  const businessIds = new Set(records.filter((record) => record.collection === 'inbox' && localBusinessNote(record.data)).map((record) => record.id))
  const businessKeys = new Set([...businessIds].map((id) => `task:${id}`))
  const workReference = (value: unknown): boolean => object(value) && (value.kind === 'work' || value.kind === 'task'
    && businessIds.has(String(value.refId ?? value.id)))
  return records.filter((record) => (selection.places || record.collection !== 'meta' || record.id !== 'events')
    && (selection.work || record.collection !== 'inbox' || !businessIds.has(record.id))).map((record) => {
    const copy = structuredClone(record)
    if (copy.deleted) return selection.work ? copy : { ...copy, data: null }
    if (!object(copy.data)) return copy
    let data = copy.data
    if (record.collection === 'settings') {
      if (!selection.health && object(data.alarm)) data = { ...data, alarm: without(data.alarm, ['medicationEnabled', 'medicationReminderAt']) }
      if (!selection.places && object(data.weather)) data = { ...data, weather: without(data.weather, ['city', 'lat', 'lng', 'enabled']) }
    }
    if (record.collection === 'meta' && record.id === 'local') {
      if (!selection.health) data = without(data, ['meds', 'sleepDiary'])
      if (!selection.deviceTests) data = without(data, ['deviceTests'])
      if (!selection.places) {
        data = without(data, ['places', 'commitments', 'planUndo', 'weather', 'weatherProfile', 'packTemplates', 'routeProfile', 'routeEstimates'])
        if (object(data.extras)) data = { ...data, extras: without(data.extras, ['geofences', 'ownCalendar']) }
        if (object(data.assistance)) data = { ...data, assistance: without(data.assistance, ['routeChecks']) }
      }
      if (!selection.work) {
        data = without(data, ['work', 'workSessions', 'handover', 'homeOfficeContact'])
        if (workReference(data.resume)) data = without(data, ['resume'])
        if (object(data.captureDraft) && workReference(data.captureDraft.context)) data = without(data, ['captureDraft'])
        if (object(data.focus) && workReference(data.focus.target)) data = without(data, ['focus'])
        if (Array.isArray(data.focusHistory)) data = { ...data, focusHistory: data.focusHistory.filter((focus) => !object(focus) || !workReference(focus.target)) }
        if (object(data.taskLearning) && Array.isArray(data.taskLearning.samples)) data = { ...data, taskLearning: { ...data.taskLearning, samples: data.taskLearning.samples.filter((sample) => !object(sample) || typeof sample.key !== 'string' || !sample.key.startsWith('work:') && !businessKeys.has(sample.key)) } }
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
  return validatedRecords(value.records)
}

/** Nur fehlende Objektfelder ergänzen. Vorhandene Werte/Listen bleiben weiterhin pro Record LWW. */
function preserveOmitted(current: unknown, incoming: unknown, path = ''): unknown {
  // Sitzungen und Rückwege sind vollständige Identitäten. Eine alte Elternreferenz
  // ohne partId darf niemals die Teilreferenz einer neueren lokalen Sitzung erben.
  if (['local.focus', 'local.resume', 'local.captureDraft'].includes(path)) return incoming
  if (!object(current) || !object(incoming)) return incoming
  return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(incoming)])].map((key) => [
    key, Object.hasOwn(incoming, key) ? preserveOmitted(current[key], incoming[key], path ? `${path}.${key}` : key) : current[key],
  ]))
}

/** Eine Sicherung ohne Arbeitsgruppe enthält nur den privaten Teil des Fokusarchivs. */
function preserveWorkHistory(current: unknown, incoming: unknown, businessIds: ReadonlySet<string>): unknown {
  if (!object(current) || !object(incoming) || Object.hasOwn(incoming, 'work')
    || !Array.isArray(current.focusHistory) || !Array.isArray(incoming.focusHistory)) return incoming
  const incomingHistory = incoming.focusHistory.filter(isFocusSession)
  const retained = current.focusHistory.filter(isFocusSession).filter((focus) =>
    (focus.target.kind === 'work' || focus.target.kind === 'task' && businessIds.has(focus.target.id))
    && !incomingHistory.some((next) => sameFocusTarget(next.target, focus.target)))
  return { ...incoming, focusHistory: [...incomingHistory, ...retained] }
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
export function previewImport(incoming: unknown, current: readonly Rec[]): ImportPreview {
  const records = validatedRecords(incoming)
  const previous = new Map(current.map((record) => [key(record), record]))
  const businessIds = new Set(current.filter((record) => record.collection === 'inbox' && !record.deleted && localBusinessNote(record.data)).map((record) => record.id))
  const winners = new Map<string, Rec>()
  for (const record of records) {
    const id = key(record)
    const before = winners.get(id) ?? previous.get(id)
    if (!remoteWins(before, record)) continue
    const beforeData = before?.deleted ? undefined : before?.data
    const incomingData = record.collection === 'meta' && record.id === 'local' ? preserveWorkHistory(beforeData, record.data, businessIds) : record.data
    const merged = !record.deleted && ((record.collection === 'settings' && record.id === 'main') || (record.collection === 'meta' && record.id === 'local'))
      ? { ...record, data: preserveOmitted(beforeData, incomingData, record.collection === 'meta' ? 'local' : 'settings') }
      : record
    winners.set(id, merged)
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
