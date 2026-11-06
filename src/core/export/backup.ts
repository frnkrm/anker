import type { Collection, Rec } from '../../data/types'
import { defaultSettings } from '../defaults'
import { validEveningLocal } from '../evening'
import { validDeviceTests } from '../deviceTests'
import { validReminderReceipts } from '../reminders/actions'
import { validRecoveryLocal } from '../recovery'
import { validTaskFields, validTaskRef } from '../tasks'
import { COLLECTIONS } from '../../data/types'

export interface Backup {
  app: 'anker'
  version: 1
  exportedAt: string
  records: Rec[]
}

export function makeBackup(records: Rec[], now = new Date()): Backup {
  return { app: 'anker', version: 1, exportedAt: now.toISOString(), records: records.map(({ dirty: _d, ...r }) => r) }
}

/** Prüft eine Backup-Datei. Wirft einen verständlichen Fehler, wenn sie nicht passt. */
export function parseBackup(text: string): Rec[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  const b = data as Partial<Backup>
  if (!b || b.app !== 'anker' || !Array.isArray(b.records)) throw new Error('Das ist keine Anker-Sicherung.')
  if (b.version !== 1) throw new Error('Diese Sicherung stammt aus einer anderen App-Version.')
  const records = b.records.filter(
    (r): r is Rec =>
      !!r &&
      COLLECTIONS.includes(r.collection as Collection) &&
      typeof r.id === 'string' &&
      typeof r.updated_at === 'number' && Number.isFinite(r.updated_at) &&
      typeof r.deleted === 'boolean',
  )
  for (const record of records) {
    if (!record.deleted && (record.collection === 'days' || (record.collection === 'meta' && record.id === 'local')) && object(record.data) && !validReminderReceipts(record.data.reminderReceipts)) {
      throw new Error('Die Sicherung enthält ungültige Erinnerungsbestätigungen. Es wurde nichts importiert.')
    }
    if (!record.deleted && record.collection === 'settings' && !validSettings(record.data)) {
      throw new Error('Die Sicherung enthält ungültige Einstellungen. Es wurde nichts importiert.')
    }
    if (!record.deleted && record.collection === 'meta' && record.id === 'local' && !validEveningLocal(record.data)) {
      throw new Error('Die Sicherung enthält ungültige private Abend- oder Schlafdaten. Es wurde nichts importiert.')
    }
    if (!record.deleted && record.collection === 'meta' && record.id === 'local' && object(record.data) && !validDeviceTests(record.data.deviceTests)) {
      throw new Error('Die Sicherung enthält ungültige Testergebnisse. Es wurde nichts importiert.')
    }
    if (!record.deleted && record.collection === 'meta' && record.id === 'local' && !validRecoveryLocal(record.data)) {
      throw new Error('Die Sicherung enthält ungültige Aufgaben-, Fokus- oder Wiedereinstiegsdaten. Es wurde nichts importiert.')
    }
    if (!record.deleted && record.collection === 'inbox' && (!validTaskFields(record.data)
      || (object(record.data) && record.data.linkedTo !== undefined && !validTaskRef(record.data.linkedTo)))) {
      throw new Error('Die Sicherung enthält ungültige Aufgabenangaben. Es wurde nichts importiert.')
    }
    if (!record.deleted && record.collection === 'inbox' && record.data && typeof record.data === 'object') {
      const data = record.data as Record<string, unknown>
      if ((data.reviewAt !== undefined && (typeof data.reviewAt !== 'number' || !Number.isFinite(new Date(data.reviewAt).getTime())))
        || (data.reviewNotify !== undefined && typeof data.reviewNotify !== 'boolean')) {
        throw new Error('Die Sicherung enthält einen ungültigen Wiedervorlage-Zeitpunkt. Es wurde nichts importiert.')
      }
    }
  }
  return records
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Older versions may omit fields, but malformed present fields must never replace working settings. */
function compatible(value: unknown, sample: unknown, complete = false): boolean {
  if (sample === null) return value === null || (typeof value === 'number' && Number.isFinite(value))
  if (typeof sample === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (Array.isArray(sample)) return Array.isArray(value) && (!sample.length || value.every((item) => compatible(item, sample[0], true)))
  if (object(sample)) {
    if (!object(value)) return false
    // Settings containers may omit legacy fields, but an existing list entry must be complete.
    // RoutineStep.tag and .minimal remain optional; a supplied minimal record requires both fields.
    if (complete && Object.keys(sample).some((key) => key !== 'tag' && key !== 'minimal' && !Object.hasOwn(value, key))) return false
    return Object.entries(value).every(([key, field]) => !(key in sample) || compatible(field, sample[key], complete))
  }
  return typeof value === typeof sample
}

function validSettings(value: unknown): boolean {
  if (!object(value) || !Number.isInteger(value.version) || typeof value.onboarded !== 'boolean') return false
  const sample = defaultSettings('2000-01-01')
  const step = { id: '', title: '', minutes: 0, minimal: { title: '', minutes: 0 }, tag: '' }
  if (!compatible(value, {
    ...sample,
    anchor: { ...sample.anchor, manual: { wake: false, pcStop: false, bed: false } },
    flex: { ...sample.flex, latestStart: null },
    routines: { morning: [step], evening: [step] },
    routineLinks: [{ eveningStepId: '', morningStepId: '' }],
    suggestions: [{ id: '', text: '', createdAt: '' }],
  })) return false
  // An explicitly supplied work schedule must cover the week.
  if (value.work !== undefined && (!Array.isArray(value.work) || value.work.length !== 7)) return false
  if (object(value.alarm) && object(value.alarm.smartWake) && value.alarm.smartWake.windowMinutes !== undefined) {
    const minutes = value.alarm.smartWake.windowMinutes
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 5 || minutes > 90) return false
  }
  return true
}
