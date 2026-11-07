import { isFocusSession, isStuckSession, validFocus, validStuck } from './focus'
import { resolveTask, taskIsOpen, taskNextStep, taskTitle, validTaskFields, validTaskParts, validTaskRef } from './tasks'
import type { InboxItem, LocalData, ResumePoint, WorkTask } from './types'

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(new Date(value).getTime()) && value >= 0
const optionalText = (value: unknown): boolean => value === undefined || typeof value === 'string'
const internalRoute = (value: unknown): value is string => typeof value === 'string' && /^\/(?!\/)/.test(value) && [...value].every((char) => char !== '\\' && char.charCodeAt(0) >= 32)

export function validResume(value: unknown): value is ResumePoint {
  return object(value) && ['task', 'work', 'step', 'free'].includes(String(value.kind))
    && typeof value.title === 'string' && timestamp(value.at)
    && ['nextStep', 'refId', 'route', 'note'].every((key) => optionalText(value[key]))
    && (value.partId === undefined || ((value.kind === 'task' || value.kind === 'work') && typeof value.refId === 'string' && !!value.refId.trim()
      && typeof value.partId === 'string' && !!value.partId.trim() && value.partId.length <= 500))
    && (value.route === undefined || internalRoute(value.route))
}

export function validCaptureDraft(value: unknown): value is NonNullable<LocalData['captureDraft']> {
  return object(value) && typeof value.id === 'string' && !!value.id && typeof value.text === 'string'
    && timestamp(value.updatedAt) && (value.context === undefined || validResume(value.context))
}

export function validTaskLearning(value: unknown): value is NonNullable<LocalData['taskLearning']> {
  return object(value) && typeof value.enabled === 'boolean' && Array.isArray(value.samples)
    && value.samples.every((sample) => object(sample) && sample.confirmed === true
      && ['id', 'key', 'label'].every((key) => typeof sample[key] === 'string')
      && timestamp(sample.at) && typeof sample.minutes === 'number' && Number.isFinite(sample.minutes)
      && sample.minutes > 0 && sample.minutes <= 1440)
}

/** Neue vorhandene Felder prüfen; alte Sicherungen dürfen sie weiterhin auslassen. */
export function validRecoveryLocal(value: unknown): boolean {
  if (!object(value)) return false
  return (value.resume === undefined || validResume(value.resume))
    && (value.captureDraft === undefined || validCaptureDraft(value.captureDraft))
    && (value.taskLearning === undefined || validTaskLearning(value.taskLearning))
    && validFocus(value.focus) && validStuck(value.stuck)
    && (value.focusHistory === undefined || (Array.isArray(value.focusHistory) && value.focusHistory.every((focus) => isFocusSession(focus) && focus.timer.status === 'paused')))
    && (value.taskContext === undefined || ['any', 'home', 'work', 'errand'].includes(String(value.taskContext)))
    && (value.work === undefined || (Array.isArray(value.work) && value.work.every((task) => object(task)
      && typeof task.id === 'string' && typeof task.title === 'string' && validTaskFields(task))))
}

/** Fehlerhafte neue optionale Daten nicht ausführen; vorhandene Records dabei nicht löschen. */
export function recoveryFields(value: unknown): Pick<LocalData, 'resume' | 'captureDraft' | 'taskLearning' | 'focus' | 'focusHistory' | 'stuck' | 'taskContext'> {
  const local = object(value) ? value : {}
  return {
    resume: validResume(local.resume) ? local.resume : undefined,
    captureDraft: validCaptureDraft(local.captureDraft) ? local.captureDraft : undefined,
    taskLearning: validTaskLearning(local.taskLearning) ? local.taskLearning : undefined,
    focus: isFocusSession(local.focus) ? local.focus : undefined,
    focusHistory: Array.isArray(local.focusHistory) ? local.focusHistory.filter((focus) => isFocusSession(focus) && focus.timer.status === 'paused') : undefined,
    taskContext: ['any', 'home', 'work', 'errand'].includes(String(local.taskContext)) ? local.taskContext as LocalData['taskContext'] : undefined,
    stuck: isStuckSession(local.stuck) ? local.stuck : undefined,
  }
}

/** Ein Merker verfällt nicht nach Uhrzeit. Seine reale Referenz muss weiterhin offen sein. */
export function usableResume(resume: ResumePoint | undefined, inbox: readonly InboxItem[], work: readonly WorkTask[]): ResumePoint | undefined {
  if (!resume || !validResume(resume)) return undefined
  if (resume.refId && (resume.kind === 'task' || resume.kind === 'work')) {
    const item = resolveTask({ kind: resume.kind, id: resume.refId }, inbox, work)
    if (!item || !taskIsOpen(item)) return undefined
    const part = resume.partId === undefined ? undefined : item.subtasks?.find((part) => part.id === resume.partId && part.doneAt === undefined)
    if (resume.partId !== undefined && !part) return undefined
    return { ...resume, title: taskTitle(item), nextStep: part?.title ?? taskNextStep(item, taskTitle(item)), ...(item.resumeNote !== undefined ? { note: item.resumeNote } : {}) }
  }
  return resume
}

export function resumeRoute(resume: ResumePoint): string | undefined {
  if ((resume.kind === 'task' || resume.kind === 'work') && resume.refId) return `/aufgabe/${resume.kind}/${encodeURIComponent(resume.refId)}${resume.partId === undefined ? '' : `?teil=${encodeURIComponent(resume.partId)}`}`
  return internalRoute(resume.route) ? resume.route : undefined
}

const taskFields = ['reminderRevision', 'description', 'why', 'nextStep', 'resumeNote', 'priority', 'deadline', 'earliestStart', 'estimateMin', 'context', 'energy', 'state', 'startedAt', 'deferredUntil', 'done', 'doneAt', 'doneMode', 'subtasks', 'recurrence', 'source'] as const

/** Bestehende gültige Angaben bleiben exakt erhalten; kaputte optionale Felder werden nicht ausgeführt. */
export function normaliseTask<T extends InboxItem | WorkTask>(task: T): T {
  const next = { ...task }
  // Ein beschädigtes neues Dauerfeld darf ältere Titel und echte Teilabschlüsse nicht entfernen.
  if (Array.isArray(next.subtasks)) next.subtasks = next.subtasks.map((part) => {
    if (!part || typeof part !== 'object' || part.timerMin === undefined || validTaskParts([part])) return part
    const previous = { ...part }
    delete previous.timerMin
    return validTaskParts([previous]) ? previous : part
  })
  for (const key of taskFields) if (!validTaskFields({ [key]: next[key] })) delete next[key]
  if ('linkedTo' in next && next.linkedTo !== undefined && !validTaskRef(next.linkedTo)) delete next.linkedTo
  return next
}
