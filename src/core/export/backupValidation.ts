import { COLLECTIONS, type Rec } from '../../data/types'
import { defaultSettings } from '../defaults'
import { validDeviceTests } from '../deviceTests'
import { validAssistancePreferences } from '../assistance'
import { validPackingLocal } from '../packing'
import { validEveningLocal } from '../evening'
import { validExtrasLocal, validExtrasSettings } from '../extras'
import { validPlanUndo } from '../flexible'
import { validRecoveryLocal } from '../recovery'
import { validReminderReceipts } from '../reminders/actions'
import { validTaskFields, validTaskRef } from '../tasks'
import { validPlanningLocal } from '../travel'
import { validWeatherLocal } from '../weatherProfile'
import { validWorkSession } from '../worktime'
import { validHomeOfficeContacts } from '../homeOfficeContact'
import { TIME_CATALOG_RECORD_ID } from '../timeCatalog'
import { validConflictAcknowledgements } from '../planConflicts'

export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const nonempty = (value: unknown): value is string => text(value) && !!value.trim()
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const timestamp = (value: unknown): value is number => finite(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(text)
const choice = (value: unknown, values: readonly (string | number)[]): boolean => values.includes(value as string | number)
const date = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const optional = (obj: Record<string, unknown>, key: string, valid: (value: unknown) => boolean): boolean => obj[key] === undefined || valid(obj[key])
const fields = (obj: Record<string, unknown>, keys: string[], valid: (value: unknown) => boolean): boolean => keys.every((key) => optional(obj, key, valid))

/** Alte Container dürfen Felder auslassen; vorhandene Listeneinträge müssen vollständig lesbar sein. */
function compatible(value: unknown, sample: unknown, complete = false): boolean {
  if (sample === null) return value === null || finite(value)
  if (typeof sample === 'number') return finite(value)
  if (Array.isArray(sample)) return Array.isArray(value) && (!sample.length || value.every((item) => compatible(item, sample[0], true)))
  if (object(sample)) {
    if (!object(value)) return false
    if (complete && Object.keys(sample).some((key) => key !== 'tag' && key !== 'minimal' && !Object.hasOwn(value, key))) return false
    return Object.entries(value).every(([key, field]) => !Object.hasOwn(sample, key) || compatible(field, sample[key], complete))
  }
  return typeof value === typeof sample
}

export function validSettings(value: unknown): boolean {
  const sample = defaultSettings('2000-01-01')
  if (!object(value) || !Number.isInteger(value.version) || Number(value.version) < 1 || Number(value.version) > sample.version || typeof value.onboarded !== 'boolean') return false
  const step = { id: '', title: '', minutes: 0, minimal: { title: '', minutes: 0 }, tag: '' }
  if (!compatible(value, {
    ...sample,
    anchor: { ...sample.anchor, manual: { wake: false, pcStop: false, bed: false } },
    flex: { ...sample.flex, latestStart: null },
    work: [{ isWorkDay: false, start: 0, durationMin: 0, pauseMin: 0, homeOffice: false }],
    routines: { morning: [step], evening: [step] },
    routineLinks: [{ eveningStepId: '', morningStepId: '' }],
    suggestions: [{ id: '', text: '', createdAt: '' }],
  })) return false
  if (!optional(value, 'goal', (v) => choice(v, ['on-time-rested', 'more-energy', 'routine']))
    || !optional(value, 'themeId', (v) => choice(v, ['seefahrt', 'piraten', 'weltraum', 'kampfkunst', 'schlicht']))) return false
  if (value.work !== undefined && (!Array.isArray(value.work) || value.work.length !== 7 || !value.work.every((work) => object(work)
    && optional(work, 'latestStart', (v) => v === null || finite(v)) && optional(work, 'endPreference', finite)))) return false
  if (object(value.commute) && !optional(value.commute, 'mode', (v) => choice(v, ['auto', 'oepnv', 'rad', 'fuss']))) return false
  if (object(value.game) && (!optional(value.game, 'stage', (v) => choice(v, [1, 2, 3])) || !optional(value.game, 'startDate', date))) return false
  if (object(value.sport) && (!optional(value.sport, 'kind', (v) => choice(v, ['gym', 'home', 'run'])) || !optional(value.sport, 'time', (v) => choice(v, ['morning', 'afterWork'])))) return false
  if (value.evenings !== undefined && (!Array.isArray(value.evenings) || value.evenings.length !== 7 || !value.evenings.every((v) => choice(v, ['free', 'friends', 'sport', 'cook', 'appointment'])))) return false
  if (object(value.focus) && (!optional(value.focus, 'pulse', (v) => choice(v, ['off', 'gentle', 'strong'])) || !optional(value.focus, 'everyMin', (v) => choice(v, [2, 5])))) return false
  if (object(value.reminders) && !optional(value.reminders, 'intensity', (v) => choice(v, ['gentle', 'normal', 'persistent']))) return false
  if (object(value.alarm)) {
    if (!optional(value.alarm, 'mathTasks', (v) => choice(v, [3, 5, 8]))) return false
    if (object(value.alarm.smartWake) && !optional(value.alarm.smartWake, 'windowMinutes', (v) => Number.isInteger(v) && Number(v) >= 5 && Number(v) <= 90)) return false
  }
  if (object(value.weather) && (!optional(value.weather, 'lat', (v) => finite(v) && Math.abs(v) <= 90) || !optional(value.weather, 'lng', (v) => finite(v) && Math.abs(v) <= 180))) return false
  return validExtrasSettings(value.extras)
}

function validSteps(value: unknown): boolean {
  return object(value) && Object.entries(value).every(([key, result]) => nonempty(key) && choice(result, ['done', 'minimal', 'skipped', 'not-needed']))
}

function validOverride(value: unknown): boolean {
  if (!object(value)) return false
  if (!fields(value, ['workEnd', 'workStart', 'targetNetMin', 'pauseMin', 'pcStopExtendMin', 'wakeOverride', 'returnCheckAfter'], finite)
    || !optional(value, 'latestStart', (v) => v === null || finite(v))
    || !optional(value, 'lateUntil', (v) => v === 'open' || finite(v))
    || !optional(value, 'backAt', timestamp)
    || !fields(value, ['homeOffice', 'light', 'adjusted'], (v) => typeof v === 'boolean')
    || !optional(value, 'reason', text) || !fields(value, ['coveredSteps', 'uncoveredSteps'], stringList)) return false
  if (!optional(value, 'dayType', (v) => choice(v, ['work', 'weekend', 'vacation', 'sick']))
    || !optional(value, 'evening', (v) => choice(v, ['free', 'friends', 'sport', 'cook', 'appointment']))
    || !optional(value, 'mode', (v) => choice(v, ['normal', 'startschwierigkeit', 'wenig-energie', 'ueberlastet', 'auf-kurs']))) return false
  return optional(value, 'routineAt', (v) => object(v) && ['morning', 'evening'].every((key) => optional(v, key, (at) => at === 'return' || finite(at))))
}

function validDay(value: unknown, id: string): boolean {
  return object(value) && date(value.date) && value.date === id && validOverride(value.override) && validSteps(value.steps)
    && fields(value, ['wakeAt', 'leftAt', 'eveningRoutineDoneAt', 'pcOffAt', 'bedAt'], timestamp)
    && fields(value, ['snoozeCount'], natural)
    && optional(value, 'sport', (v) => choice(v, ['manual', 'health']))
    && fields(value, ['prepCooked', 'tidyDone'], (v) => typeof v === 'boolean')
    && fields(value, ['prepChecklist', 'dismissed', 'awarded', 'changes'], stringList)
    && optional(value, 'arrival', (v) => Array.isArray(v) && v.every(natural))
    && optional(value, 'before', (v) => object(v) && validOverride(v.override) && validSteps(v.steps))
}

function validGame(value: unknown): boolean {
  if (!object(value) || !nonnegative(value.xp) || !nonnegative(value.spent) || !object(value.chapter)) return false
  const chapter = value.chapter
  return natural(chapter.index) && date(chapter.startDate) && typeof chapter.jokerUsed === 'boolean' && Number.isSafeInteger(chapter.attempt) && Number(chapter.attempt) >= 1
    && Array.isArray(value.chaptersDone) && value.chaptersDone.every((v) => object(v) && natural(v.length) && v.length > 0 && date(v.endDate))
    && stringList(value.badges) && object(value.achievements) && Object.values(value.achievements).every(date)
    && Array.isArray(value.redeemed) && value.redeemed.every((v) => object(v) && nonempty(v.rewardId) && text(v.title) && nonnegative(v.price) && timestamp(v.at))
    && optional(value, 'lastEvaluated', date) && fields(value, ['pendingLevelUp', 'pendingChapter'], natural)
    && optional(value, 'stageOffer', (v) => choice(v, [2, 3]))
}

function validInbox(value: unknown, id: string): boolean {
  return object(value) && value.id === id && text(value.text) && timestamp(value.createdAt) && choice(value.status, ['open', 'kept', 'task'])
    && validTaskFields(value) && optional(value, 'taskDate', date) && optional(value, 'captureContext', text)
    && optional(value, 'linkedTo', validTaskRef) && optional(value, 'reviewAt', timestamp) && optional(value, 'reviewNotify', (v) => typeof v === 'boolean')
}

function validLocal(value: unknown): boolean {
  if (!object(value) || !validHomeOfficeContacts(value.homeOfficeContact) || !validPlanningLocal(value) || !validRecoveryLocal(value) || !validWeatherLocal(value)
    || !validPlanUndo(value.planUndo) || !validExtrasLocal(value.extras) || !validAssistancePreferences(value.assistance) || !validPackingLocal(value)
    || !validConflictAcknowledgements(value.acknowledgedPlanConflicts)) return false
  if (object(value.planUndo) && !Object.values(value.planUndo).every((entry) => object(entry) && validPlanningLocal({ commitments: entry.commitments }))) return false
  if (!optional(value, 'workSessions', (v) => Array.isArray(v) && v.every(validWorkSession))) return false
  if (!optional(value, 'handover', (v) => object(v) && Object.entries(v).every(([day, entry]) => date(day) && object(entry) && text(entry.open) && text(entry.next)))) return false
  if (!optional(value, 'meds', (v) => object(v) && Object.entries(v).every(([day, entry]) => date(day) && object(entry) && timestamp(entry.at) && choice(entry.status, ['taken', 'not-taken', 'unsure'])))) return false
  if (!optional(value, 'trial', (v) => object(v) && date(v.startedAt) && choice(v.days, [7, 14]) && object(v.answers)
    && Object.entries(v.answers).every(([day, answer]) => date(day) && choice(answer, ['ja', 'teilweise', 'nein', 'uebersprungen'])))) return false
  return true
}

function validEvents(value: unknown): boolean {
  return Array.isArray(value) && value.every((event) => object(event) && nonempty(event.id) && text(event.title)
    && timestamp(event.start) && timestamp(event.end) && event.end >= event.start && optional(event, 'allDay', (v) => typeof v === 'boolean'))
}

/** Ein kompletter Batch wird vor Persistenz geprüft. Fehlermeldungen enthalten niemals Nutzinhalte. */
export function validatedRecords(value: unknown): Rec[] {
  const fail = (subject = 'Daten'): never => { throw new Error(`Die Sicherung enthält ungültige ${subject}. Es wurde nichts importiert.`) }
  if (!Array.isArray(value)) fail()
  const records = value as unknown[]
  for (const raw of records) {
    if (!object(raw) || !choice(raw.collection, COLLECTIONS) || !nonempty(raw.id) || !timestamp(raw.updated_at) || typeof raw.deleted !== 'boolean') fail('Datensätze')
    const record = raw as unknown as Rec
    if (record.deleted) continue
    const data = record.data
    if ((record.collection === 'days' || (record.collection === 'meta' && record.id === 'local')) && object(data) && !validReminderReceipts(data.reminderReceipts)) fail('Erinnerungsbestätigungen')
    switch (record.collection) {
      case 'settings': if (record.id !== 'main' || !validSettings(data)) fail('Einstellungen'); break
      case 'game': if (record.id !== 'main' || !validGame(data)) fail('Spielstände'); break
      case 'inbox': if (!validInbox(data, record.id)) fail('Aufgabenangaben'); break
      case 'days': if (!validDay(data, record.id)) fail('Tagesdaten'); break
      case 'reviews': if (!object(data) || data.id !== record.id || !date(data.id) || !fields(data, ['good', 'hard', 'change'], text)
        || ['good', 'hard', 'change'].some((key) => !Object.hasOwn(data, key))) fail('Wochenrückblicke'); break
      case 'meta':
        if (record.id === 'local') {
          if (!validEveningLocal(data)) fail('private Abend- oder Schlafdaten')
          if (object(data) && !validDeviceTests(data.deviceTests)) fail('Testergebnisse')
          if (!validRecoveryLocal(data)) fail('Aufgaben-, Fokus- oder Wiedereinstiegsdaten')
          if (!validLocal(data)) fail('lokale Planungs- oder Arbeitsdaten')
        } else if (record.id === 'events' && !validEvents(data)) fail('Kalenderdaten')
        break
    }
  }
  return (structuredClone(records) as Rec[]).filter((record) => record.collection !== 'meta' || record.id !== TIME_CATALOG_RECORD_ID).map((record) => {
    if (record.collection !== 'meta' || record.id !== 'local' || !object(record.data)) return record
    // Ein importierter Cache ist weder Wahrheit noch ein versteckter Weg für ausgeschlossene Gruppen.
    const data = { ...record.data }
    delete data.timeCatalog
    return { ...record, data }
  })
}
