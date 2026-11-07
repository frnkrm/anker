import { addDays, daysBetween, type DateStr } from './time'
import type { InboxItem, TaskFields, TaskPart, TaskRef, TaskState, WorkTask } from './types'

export type TaskResolution = TaskState | 'completed' | 'completed-minimal'
export type TaskDetailDepth = 'three' | 'normal' | 'tiny'

export function resolveTask(ref: TaskRef, inbox: readonly InboxItem[], work: readonly WorkTask[]): InboxItem | WorkTask | undefined {
  return ref.kind === 'work' ? work.find((task) => task.id === ref.id) : inbox.find((task) => task.id === ref.id && task.status === 'task')
}

export function taskTitle(task: InboxItem | WorkTask): string {
  return 'text' in task ? task.text : task.title
}

/** Alte done-Felder bleiben der bestätigte Abschluss, nie ein abgelaufener Timer. */
export function taskState(task: TaskFields): TaskResolution {
  return task.done ? task.doneMode === 'minimal' ? 'completed-minimal' : 'completed' : task.state ?? 'pending'
}

export function taskIsOpen(task: TaskFields): boolean {
  return !task.done && task.state !== 'not-needed' && task.state !== 'cancelled'
}

export function taskIsActionable(task: TaskFields, nowMs: number): boolean {
  if (!taskIsOpen(task)) return false
  if (task.state === 'active') return true // bewusst vorgezogen, kein automatisches Verstecken
  if (task.earliestStart !== undefined && task.earliestStart > nowMs) return false
  return task.state !== 'deferred' || (task.deferredUntil !== undefined && task.deferredUntil <= nowMs)
}

export function taskNextStep(task: TaskFields, fallbackTitle: string): string {
  return task.nextStep?.trim() || task.subtasks?.find((part) => part.doneAt === undefined)?.title.trim() || fallbackTitle
}

export function taskPriority(task: TaskFields): number {
  return task.priority === 'high' ? 2 : task.priority === 'low' ? 0 : 1
}

export function taskStateLabel(task: TaskFields): string {
  const labels: Record<TaskResolution, string> = {
    pending: 'Offen', active: 'Läuft', paused: 'Pausiert', partial: 'Teilweise', deferred: 'Für später',
    'not-needed': 'Nicht nötig', cancelled: 'Abgesagt', completed: 'Erledigt', 'completed-minimal': 'Kleine Version erledigt',
  }
  return labels[taskState(task)]
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(new Date(value).getTime()) && value >= 0
const text = (value: unknown): value is string => typeof value === 'string'
const nonempty = (value: unknown): value is string => text(value) && !!value.trim()
const minutes = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1440
const option = (value: unknown, choices: readonly string[]): boolean => typeof value === 'string' && choices.includes(value)

function validDate(value: unknown): value is DateStr {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validTaskRef(value: unknown): value is TaskRef {
  return object(value) && (value.kind === 'task' || value.kind === 'work') && nonempty(value.id)
}

export function validTaskParts(value: unknown): value is TaskPart[] {
  if (!Array.isArray(value) || value.length > 200) return false
  const ids = new Set<string>()
  return value.every((part) => {
    if (!object(part) || !nonempty(part.id) || !nonempty(part.title) || ids.has(part.id)) return false
    ids.add(part.id)
    return (part.estimateMin === undefined || minutes(part.estimateMin)) && (part.timerMin === undefined || minutes(part.timerMin))
      && (part.doneAt === undefined || timestamp(part.doneAt))
  })
}

/** Neue Felder prüfen, ohne alte Records zur Angabe aller optionalen Felder zu zwingen. */
export function validTaskFields(value: unknown): value is TaskFields {
  if (!object(value)) return false
  if (value.reminderRevision !== undefined && !nonempty(value.reminderRevision)) return false
  for (const key of ['description', 'nextStep', 'resumeNote', 'why']) if (value[key] !== undefined && !text(value[key])) return false
  for (const key of ['deadline', 'earliestStart', 'startedAt', 'deferredUntil', 'doneAt']) if (value[key] !== undefined && !timestamp(value[key])) return false
  if (value.estimateMin !== undefined && !minutes(value.estimateMin)) return false
  if (value.done !== undefined && typeof value.done !== 'boolean') return false
  if (value.doneMode !== undefined && !option(value.doneMode, ['full', 'minimal'])) return false
  if (value.priority !== undefined && !option(value.priority, ['low', 'normal', 'high'])) return false
  if (value.context !== undefined && !option(value.context, ['any', 'home', 'work', 'errand'])) return false
  if (value.energy !== undefined && !option(value.energy, ['low', 'medium', 'high'])) return false
  if (value.state !== undefined && !option(value.state, ['pending', 'active', 'paused', 'partial', 'deferred', 'not-needed', 'cancelled'])) return false
  if (value.subtasks !== undefined && !validTaskParts(value.subtasks)) return false
  if (value.recurrence !== undefined && (!object(value.recurrence) || !nonempty(value.recurrence.seriesId)
    || !Number.isInteger(value.recurrence.everyDays) || Number(value.recurrence.everyDays) < 1 || Number(value.recurrence.everyDays) > 366
    || !validDate(value.recurrence.occurrenceDate))) return false
  if (value.source !== undefined && (!object(value.source) || !option(value.source.kind, ['capture', 'manual', 'repeat'])
    || (value.source.id !== undefined && !nonempty(value.source.id)))) return false
  return true
}

const partHash = (title: string): string => {
  let hash = 2166136261
  for (const char of title.trim().toLocaleLowerCase('de-DE')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16)
}

/** Ein lokaler, editierbarer Vorschlag. Keine KI und keine Übertragung des Aufgabentexts. */
export function decomposeTask(title: string, depth: TaskDetailDepth, existingParts: readonly TaskPart[] = []): TaskPart[] {
  const action = title.trim()
  if (!action) return existingParts.map((part) => ({ ...part }))
  const call = /anruf|telefon/i.test(action)
  const household = /aufräum|putz|wäsche|spül|staub|müll/i.test(action)
  const labels: Record<string, string> = {
    ground: 'Eine Sache auswählen, mit der du anfangen möchtest',
    prepare: call ? 'Den passenden Kontakt heraussuchen' : household ? 'Einen kleinen Bereich und das nötige Material wählen' : `Das Nötige für „${action}“ bereitlegen`,
    open: call ? 'Die Telefonnummer öffnen' : household ? 'Eine Sache greifen' : 'Die passende Datei, Unterlage oder Stelle öffnen',
    choose: call ? 'Den ersten Satz für das Gespräch notieren' : 'Den ersten kleinen Teil festlegen',
    small: call ? 'Den Anruf beginnen' : household ? 'Diese eine Sache an ihren Platz bringen' : `Einen kleinen Teil von „${action}“ bearbeiten`,
    pause: 'Kurz prüfen, ob du weiterarbeiten oder pausieren möchtest',
    continue: call ? 'Das Ergebnis kurz notieren' : 'Am nächsten kleinen Teil weiterarbeiten, falls es passt',
    check: 'Kurz prüfen und den nächsten offenen Schritt notieren',
  }
  const keys = depth === 'three' ? ['prepare', 'small', 'check']
    : depth === 'tiny' ? ['ground', 'prepare', 'open', 'choose', 'small', 'pause', 'continue', 'check']
      : ['prepare', 'open', 'small', 'continue', 'check']
  const prefix = `part:${partHash(action)}:`
  const completed = existingParts.filter((part) => part.doneAt !== undefined)
  const completedIds = new Set(completed.map((part) => part.id))
  const result: TaskPart[] = keys.filter((key) => !completedIds.has(prefix + key)).map((key) => {
    const previous = existingParts.find((part) => part.id === prefix + key)
    return previous ? { ...previous } : { id: prefix + key, title: labels[key]!, estimateMin: key === 'small' ? 5 : 2 }
  })
  // Auch manuell ergänzte Erledigungen und ihre Reihenfolge bleiben erhalten.
  for (const part of completed) result.splice(Math.min(existingParts.indexOf(part), result.length), 0, { ...part })
  return result
}

/** Genau die nächste künftige Instanz; mehrere Tage Nichtnutzung erzeugen keinen Rückstandsstapel. */
export function nextTaskOccurrence(task: TaskFields & { id: string }, today: DateStr): { id: string; date: DateStr; recurrence: NonNullable<TaskFields['recurrence']> } | undefined {
  const recurrence = task.recurrence
  if (!recurrence || !validTaskFields({ recurrence }) || !validDate(today)) return undefined
  const passed = daysBetween(recurrence.occurrenceDate, today)
  const jumps = Math.max(1, Math.floor(passed / recurrence.everyDays) + 1)
  const date = addDays(recurrence.occurrenceDate, jumps * recurrence.everyDays)
  return { id: `repeat:${encodeURIComponent(recurrence.seriesId)}:${date}`, date, recurrence: { ...recurrence, occurrenceDate: date } }
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/** Nur ein sichtbarer Vorschlag aus bestätigten lokalen Werten; verändert keine Standardzeit. */
export function durationSuggestion(samples: readonly { minutes: number; confirmed?: boolean }[]): number | undefined {
  const values = samples.filter((sample) => sample.confirmed === true && Number.isFinite(sample.minutes) && sample.minutes >= 1 && sample.minutes <= 480).map((sample) => sample.minutes)
  if (values.length < 3) return undefined
  const middle = median(values)
  const typical = values.filter((value) => value >= middle / 3 && value <= middle * 3)
  return Math.max(1, Math.round(median(typical.length >= 3 ? typical : values)))
}

export function taskLearningKey(ref: TaskRef, task: TaskFields & { text?: string; title?: string }): string {
  return `${ref.kind}:${task.recurrence?.seriesId ?? (task.text ?? task.title ?? '').trim().toLocaleLowerCase('de-DE')}`
}
