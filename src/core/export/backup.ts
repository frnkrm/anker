import { key, remoteWins } from '../../data/merge'
import type { Rec } from '../../data/types'
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
  return records.filter((record) => selection.places || record.collection !== 'meta' || record.id !== 'events').map((record) => {
    const copy = structuredClone(record)
    if (copy.deleted || !object(copy.data)) return copy
    let data = copy.data
    if (!selection.work && record.collection === 'inbox' && object(data.linkedTo) && data.linkedTo.kind === 'work') data = without(data, ['linkedTo'])
    if (record.collection === 'settings') {
      if (!selection.health && object(data.alarm)) data = { ...data, alarm: without(data.alarm, ['medicationEnabled', 'medicationReminderAt']) }
      if (!selection.places && object(data.weather)) data = { ...data, weather: without(data.weather, ['city', 'lat', 'lng', 'enabled']) }
    }
    if (record.collection === 'meta' && record.id === 'local') {
      if (!selection.health) data = without(data, ['meds', 'sleepDiary'])
      if (!selection.deviceTests) data = without(data, ['deviceTests'])
      if (!selection.places) {
        data = without(data, ['places', 'commitments', 'planUndo', 'weather', 'weatherProfile', 'routeProfile', 'routeEstimates'])
        if (object(data.extras)) data = { ...data, extras: without(data.extras, ['geofences', 'ownCalendar']) }
      }
      if (!selection.work) {
        data = without(data, ['work', 'workSessions', 'handover'])
        if (object(data.resume) && data.resume.kind === 'work') data = without(data, ['resume'])
        if (object(data.captureDraft) && object(data.captureDraft.context) && data.captureDraft.context.kind === 'work') data = without(data, ['captureDraft'])
        if (object(data.focus) && object(data.focus.target) && data.focus.target.kind === 'work') data = without(data, ['focus'])
        if (Array.isArray(data.focusHistory)) data = { ...data, focusHistory: data.focusHistory.filter((focus) => !object(focus) || !object(focus.target) || focus.target.kind !== 'work') }
        if (object(data.taskLearning) && Array.isArray(data.taskLearning.samples)) data = { ...data, taskLearning: { ...data.taskLearning, samples: data.taskLearning.samples.filter((sample) => !object(sample) || typeof sample.key !== 'string' || !sample.key.startsWith('work:')) } }
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
function preserveOmitted(current: unknown, incoming: unknown): unknown {
  if (!object(current) || !object(incoming)) return incoming
  return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(incoming)])].map((key) => [
    key, Object.hasOwn(incoming, key) ? preserveOmitted(current[key], incoming[key]) : current[key],
  ]))
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
  const winners = new Map<string, Rec>()
  for (const record of records) {
    const id = key(record)
    const before = winners.get(id) ?? previous.get(id)
    if (!remoteWins(before, record)) continue
    const merged = !record.deleted && ((record.collection === 'settings' && record.id === 'main') || (record.collection === 'meta' && record.id === 'local'))
      ? { ...record, data: preserveOmitted(before?.deleted ? undefined : before?.data, record.data) }
      : record
    winners.set(id, merged)
  }
  const prepared = validatedRecords([...winners.values()])
  const local = records.find((record) => !record.deleted && record.collection === 'meta' && record.id === 'local')?.data
  const sensitive = object(local) ? [
    ...(['work', 'workSessions', 'handover'].some((field) => Object.hasOwn(local, field)) ? ['Arbeitsaufgaben und Zeiten'] : []),
    ...(['meds', 'sleepDiary'].some((field) => Object.hasOwn(local, field)) ? ['Einnahme- oder Schlafprotokoll'] : []),
    ...(['places', 'commitments'].some((field) => Object.hasOwn(local, field)) ? ['Orte und Termine'] : []),
  ] : []
  return { records: prepared, incoming: records.length, changed: prepared.length, skipped: records.length - prepared.length,
    deletions: prepared.filter((record) => record.deleted).length, sensitive }
}
