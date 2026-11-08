import { create } from 'zustand'
import { assistanceAllowed, taskAssistanceRevision, type TaskSuggestionExpectation } from '../core/assistance'
import { coalesceAsync } from '../core/coalesced'
import { validCalendarStatus, type CalendarStatus } from '../core/extras'
import { previewImport, validatedRecords, type BackupImportMode } from '../core/export/backup'
import type { AlarmPlanningStatus } from '../core/alarm'
import { defaultSettings, emptyLocal, migrateSettings, randomId } from '../core/defaults'
import { eveningLocalFields } from '../core/evening'
import { restoreCommitments, routineCoverage, validPlanUndo } from '../core/flexible'
import { deviceTestsFromLocal, validDeviceTests } from '../core/deviceTests'
import { createCountdown, isFocusSession, pauseCountdown, remainingMs, resumeCountdown, sameFocusTarget, validFocusTarget, validStuck, type FocusSession, type FocusTarget, type StuckSession, type TaskFocusTarget } from '../core/focus'
import { normaliseTask, recoveryFields, usableResume, validCaptureDraft } from '../core/recovery'
import { nextTaskOccurrence, resolveTask, taskIsOpen, taskLearningKey, taskNextStep, taskTitle, validTaskFields, validTaskParts, validTaskRef } from '../core/tasks'
import { applyAwards, advanceGame, dayGoals, dayStatus, initialGame, levelFor, theme, type DayStatus } from '../core/game'
import { activePlanDate, openSteps, routineCompleted, stepKey } from '../core/now'
import { buildDayPlan } from '../core/planner'
import { planConflicts, validConflictAcknowledgements } from '../core/planConflicts'
import { currentReminderAction, validReminderAction, withReminderReceipt, type ReminderAction, type ReminderApplyResult } from '../core/reminders/actions'
import { validateSleepEntry } from '../core/sleepDiary'
import { addDays, minutesOnPlanDay, todayBerlin, zonedToUtc, type DateStr } from '../core/time'
import { buildTimeCatalog, currentTimeCatalog, TIME_CATALOG_RECORD_ID, timeCatalogPlanDates, validTimeCatalog, type TimeCatalogRuntime, type TimeCatalogSnapshot } from '../core/timeCatalog'
import type {
  CalendarEvent,
  Commitment,
  DayLog,
  DayOverride,
  DayPlan,
  DeviceTestProgress,
  GameState,
  InboxItem,
  LocalData,
  Place,
  MedsStatus,
  ResumePoint,
  RoutineId,
  Settings,
  SleepDiaryEntry,
  StepResult,
  TaskFields,
  TaskPart,
  TaskRef,
  TaskState,
  TomorrowStep,
  WeeklyReview,
  WorkSession,
  WorkSessionKind,
  WorkTask,
} from '../core/types'
import { assertWorkChanges, endBreak, startBreak, startSession, stopSession } from '../core/worktime'
import { validCommitment, validPlace } from '../core/travel'
import { migrateWeatherState } from '../core/weatherProfile'
import { key } from '../data/merge'
import { getRepository, type Rec, type Repository } from '../data'
import type { Collection, RepositoryWrite } from '../data/types'

export type AlarmStatus = AlarmPlanningStatus

export interface Celebration {
  kind: 'level' | 'chapter' | 'achievement' | 'xp' | 'restart' | 'stage'
  title: string
  text?: string
}

/** Flüchtige UI-Aktion. Weder Funktion noch Rücknahmeinhalt werden synchronisiert. */
export interface ToastAction {
  label: string
  run: () => void | Promise<void>
}

interface AppState {
  ready: boolean
  settings: Settings
  game: GameState
  days: Record<DateStr, DayLog>
  inbox: InboxItem[]
  reviews: WeeklyReview[]
  events: CalendarEvent[]
  /** Nur auf diesem Gerät: Arbeit, Einnahmeprotokoll, Wiedereinstieg. Wird nicht synchronisiert. */
  local: LocalData
  celebrations: Celebration[]
  toast?: string
  toastAction?: ToastAction
  /** Was Android zuletzt zur Weckerplanung gemeldet hat. Nicht gespeichert. */
  alarmStatus?: AlarmStatus
  /** Stand vor der letzten Korrektur an Arbeitszeiten, für „Rückgängig“. Nicht gespeichert. */
  workUndo?: { before: WorkSession[]; revision: string }

  load(): Promise<void>
  saveSettings(fn: (s: Settings) => Settings): Promise<void>
  updateDay(date: DateStr, fn: (log: DayLog) => DayLog): Promise<void>
  acknowledgePlanConflict(date: DateStr, conflictId: string): Promise<void>
  setStep(date: DateStr, r: RoutineId, stepId: string, result: StepResult | undefined): Promise<void>
  mark(date: DateStr, field: 'wakeAt' | 'leftAt' | 'pcOffAt' | 'bedAt' | 'eveningRoutineDoneAt', at?: number): Promise<void>
  applyReminderAction(action: ReminderAction): Promise<ReminderApplyResult>
  setOverride(date: DateStr, patch: Partial<DayOverride>): Promise<void>
  addInbox(text: string, context?: string): Promise<string | undefined>
  parkThought(text: string, reviewAt: number, notify?: boolean): Promise<string | undefined>
  updateInbox(id: string, patch: Partial<InboxItem>): Promise<void>
  removeInbox(id: string): Promise<void>
  saveCaptureDraft(text: string, context?: ResumePoint): Promise<void>
  addWorkTask(title: string): Promise<string | undefined>
  moveWorkTaskToTop(id: string): Promise<void>
  updateTask(ref: TaskRef, patch: Partial<TaskFields> & { text?: string; title?: string; taskDate?: DateStr }, expected?: TaskSuggestionExpectation): Promise<void>
  setTaskState(ref: TaskRef, state: TaskState): Promise<void>
  completeTask(ref: TaskRef, done: boolean, minimal?: boolean, confirmedMinutes?: number): Promise<void>
  removeTask(ref: TaskRef): Promise<void>
  startTaskFocus(ref: TaskRef, minutes?: number, partId?: string): Promise<void>
  pauseTaskFocus(ref: TaskRef, nextStep?: string, note?: string, partId?: string): Promise<void>
  setTaskPartDone(ref: TaskRef, partId: string, done: boolean): Promise<void>
  replaceTaskParts(ref: TaskRef, parts: TaskPart[], expected?: TaskSuggestionExpectation): Promise<void>
  moveInboxToWork(id: string): Promise<void>
  linkInbox(id: string, ref: TaskRef): Promise<void>
  setTaskLearning(enabled: boolean): Promise<void>
  clearTaskLearning(): Promise<void>
  ensureFocus(target: FocusTarget, seconds: number, legacyStartedAt?: number): Promise<void>
  updateFocus(id: string, fn: (current: FocusSession) => FocusSession): Promise<void>
  clearFocus(id: string): Promise<void>
  saveStuck(fn: (current: StuckSession | undefined) => StuckSession | undefined): Promise<void>
  saveReview(r: WeeklyReview): Promise<void>
  redeem(rewardId: string): Promise<boolean>
  setGame(fn: (g: GameState) => GameState): Promise<void>
  evaluateProgress(): Promise<void>
  setEvents(e: CalendarEvent[]): Promise<void>
  applyCalendarSnapshot(events: CalendarEvent[], status: CalendarStatus, accept: () => boolean): Promise<boolean>
  saveLocal(fn: (l: LocalData) => LocalData): Promise<void>
  /** Rein lesende Zeitübersicht: erst beim bewussten Öffnen initialisieren. */
  refreshTimeCatalog(runtime?: TimeCatalogRuntime): Promise<void>
  saveDeviceTests(fn: (progress: DeviceTestProgress) => DeviceTestProgress): Promise<void>
  setResume(r: ResumePoint | undefined): Promise<void>
  saveTomorrowStep(title: string, nextStep: string, resumeAt: number, remind?: boolean): Promise<string | undefined>
  finishTomorrowStep(id: string): Promise<void>
  removeTomorrowStep(id: string): Promise<void>
  saveSleepEntry(date: DateStr, entry: SleepDiaryEntry): Promise<void>
  removeSleepEntry(date: DateStr): Promise<void>
  /** Nur nach einer bewussten Eingabe aufrufen, nie aus Wecker-Ereignissen. */
  setMeds(date: DateStr, status: MedsStatus | undefined): Promise<void>
  /** Aufgabe aus der Inbox erledigen (dieselbe Aufgabe überall) oder zurücknehmen */
  setInboxDone(id: string, done: boolean): Promise<void>
  setAlarmStatus(a: AlarmStatus): void
  /** Änderung über „Heute anders“: merkt den Ausgangsstand, damit alles rückgängig zu machen ist */
  adjustDay(date: DateStr, label: string, fn: (log: DayLog) => DayLog): Promise<void>
  /** Zurück zum ursprünglichen Plan. Wirklich Erledigtes bleibt erledigt. */
  restoreDay(date: DateStr): Promise<void>
  saveCommitment(c: Commitment): Promise<void>
  /** Bewusste Terminplanung mit privater atomarer Rücknahmebasis. */
  adjustCommitment(c: Commitment, label: string, reason?: string): Promise<void>
  /** Planfelder auf dem neuesten Termin ändern; verspätete Vorschläge vor dem Schreiben verwerfen. */
  updateCommitment(id: string, patch: Partial<Omit<Commitment, 'id' | 'date'>>, label?: string, accept?: () => boolean): Promise<void>
  markCommitment(id: string, field: 'leftAt' | 'arrivedAt' | 'backAt', at?: number): Promise<void>
  savePlace(place: Place): Promise<void>
  removePlace(id: string): Promise<void>
  /** Arbeit starten. Läuft schon etwas, bleibt es dabei. */
  workStart(i?: { kind?: WorkSessionKind; label?: string; commitmentId?: string; at?: number }): Promise<void>
  /** Beendet, was läuft. Mehrfaches Tippen ändert nichts. */
  workStop(at?: number): Promise<void>
  workBreakStart(at?: number): Promise<void>
  workBreakEnd(at?: number): Promise<void>
  /** Nachtragen oder korrigieren, mit Rückgängig */
  editWork(fn: (list: WorkSession[]) => WorkSession[]): Promise<void>
  undoWork(): Promise<void>
  importRecords(recs: Rec[], mode?: BackupImportMode): Promise<number>
  mergeRecords(recs: Rec[], dirty?: boolean, accepted?: () => boolean, mode?: BackupImportMode): Promise<number>
  celebrate(c: Celebration): void
  popCelebration(): void
  showToast(t: string, action?: ToastAction): void
  runToastAction(): Promise<void>
}

let repo: Repository
// SQLite writes and reloads must observe the same order as the optimistic store updates.
let persistence: Promise<void> = Promise.resolve()
function persist<T>(write: () => Promise<T>): Promise<T> {
  const next = persistence.then(write)
  persistence = next.then(() => undefined, () => undefined)
  return next
}
let pendingAtomicAction: Promise<void> | undefined
async function waitForAtomicActions() {
  while (pendingAtomicAction) await pendingAtomicAction
}
/** Kurze atomare Änderungen teilen die Sperre mit bestätigten Erinnerungsaktionen. */
function atomic<T>(operation: () => Promise<T>): Promise<T> {
  const task = (pendingAtomicAction ?? Promise.resolve()).then(() => persist(operation))
  const barrier = task.then(() => undefined, () => undefined)
  pendingAtomicAction = barrier
  void barrier.then(() => { if (pendingAtomicAction === barrier) pendingAtomicAction = undefined })
  return task
}
const listeners = new Set<() => void>()
let changeTimer: ReturnType<typeof setTimeout> | undefined
let timeCatalogUsed = false
let timeCatalogRuntime: TimeCatalogRuntime | undefined
let toastVersion = 0

/** LocalData enthält im UI den angefügten Cache; die echte private Quellgruppe bleibt cachefrei. */
function sourceLocal(local: LocalData): LocalData {
  const data = { ...local }
  delete data.timeCatalog
  return data
}

// Dieselbe lokale Schreibsperre wie alle Quelländerungen, kein weiterer Planer oder Writer.
const refreshTimeCatalog = coalesceAsync(() => atomic(async () => {
  const st = useApp.getState()
  if (!st.ready) return
  const now = Date.now()
  if (currentTimeCatalog(st, now, timeCatalogRuntime ?? {})) return
  const plans = timeCatalogPlanDates(st, now).map((date) => planFor(date, st))
  const snapshot = buildTimeCatalog({ ...st, nowMs: now, plans, runtime: timeCatalogRuntime })
  if (!validTimeCatalog(snapshot)) throw new Error('Die Zeitübersicht konnte nicht vollständig berechnet werden. Deine Originaldaten bleiben erhalten.')
  const local = { ...st.local, timeCatalog: snapshot }
  await repo.put('meta', TIME_CATALOG_RECORD_ID, snapshot)
  useApp.setState({ local })
  // Absichtlich kein changed(): ein Cachewrite plant keine Wecker/Erinnerungen neu.
}))

/** Registriert einen Callback für Plan-Änderungen (Erinnerungen, Widget, PC-Stopp, Sync). */
export function onPlanChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function changed() {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    listeners.forEach((fn) => fn())
    if (timeCatalogUsed || useApp.getState().local.timeCatalog) void refreshTimeCatalog().catch(() => {
      console.warn('Die lokale Zeitübersicht konnte nicht aktualisiert werden.')
    })
  }, 400)
}

interface TaskData { local: LocalData; inbox: InboxItem[] }
const sameRef = (a: TaskRef | undefined, b: TaskRef): boolean => a?.kind === b.kind && a.id === b.id
function focusedOn(local: LocalData, ref: TaskRef): boolean {
  const target = local.focus?.target
  return !!target && target.kind !== 'routine' && sameRef(target, ref)
}

/** Eine Teilreferenz darf bei alten Import-/Syncständen niemals zum Elternfokus werden. */
function taskFocusIsOpen(target: TaskFocusTarget, data: TaskData): boolean {
  const task = resolveTask(target, data.inbox, data.local.work)
  return !!task && taskIsOpen(task) && (target.partId === undefined
    || !!task.subtasks?.some((part) => part.id === target.partId && part.doneAt === undefined))
}

function archiveFocus(data: TaskData): void {
  const focus = data.local.focus
  if (!focus) return
  if (focus.target.kind !== 'routine') {
    const previous = resolveTask(focus.target, data.inbox, data.local.work)
    if (previous?.state === 'active') previous.state = 'paused'
  }
  data.local.focusHistory = [...(data.local.focusHistory ?? []).filter((old) => !sameFocusTarget(old.target, focus.target)), { ...focus, timer: pauseCountdown(focus.timer, Date.now()) }]
  data.local.focus = undefined
}

function archivedFocus(data: TaskData, target: FocusTarget): FocusSession | undefined {
  const saved = data.local.focusHistory?.find((focus) => sameFocusTarget(focus.target, target))
  data.local.focusHistory = data.local.focusHistory?.filter((focus) => !sameFocusTarget(focus.target, target))
  return saved
}

/** Der gleiche alte Benachrichtigungsknopf darf nach Rücknahme oder Bearbeitung nicht wieder aktuell werden. */
function stampTaskChanges<T extends InboxItem | WorkTask>(before: readonly T[], after: T[]): void {
  const previous = new Map(before.map((task) => [task.id, task]))
  for (const task of after) if (JSON.stringify(previous.get(task.id)) !== JSON.stringify(task)) task.reminderRevision = randomId()
}

/** Arbeitsintervalle und ihre Rücknahme erst nach gemeinsam erfolgreichem Commit veröffentlichen. */
function changeWork(edit: (local: LocalData) => LocalData, undoable = false): Promise<void> {
  return atomic(async () => {
    const before = useApp.getState()
    const local = edit(structuredClone(before.local))
    assertWorkChanges(before.local.workSessions, local.workSessions, Date.now())
    if (JSON.stringify(local) === JSON.stringify(before.local)) return
    const workUndo = undoable ? { before: structuredClone(before.local.workSessions), revision: JSON.stringify(local.workSessions) } : undefined
    await repo.put('meta', 'local', sourceLocal(local))
    useApp.setState({ local, workUndo })
    changed()
  })
}

/** Alle zusammengehörigen Task-/Fokus-/Notizänderungen werden gemeinsam sichtbar und dauerhaft. */
function editTaskData(edit: (data: TaskData) => void): Promise<void> {
  return atomic(async () => {
    const before = useApp.getState()
    const data: TaskData = { local: structuredClone(before.local), inbox: structuredClone(before.inbox) }
    edit(data)
    data.local.resume = usableResume(data.local.resume, data.inbox, data.local.work)
    if (data.local.focus?.target.kind !== 'routine' && data.local.focus) {
      if (!taskFocusIsOpen(data.local.focus.target, data)) data.local.focus = undefined
    }
    data.local.focusHistory = data.local.focusHistory?.filter((focus) => {
      if (focus.target.kind === 'routine') return focus.target.date === today() && !before.days[focus.target.date]?.steps[stepKey(focus.target.routine, focus.target.stepId)]
      return taskFocusIsOpen(focus.target, data)
    })
    stampTaskChanges(before.inbox, data.inbox)
    stampTaskChanges(before.local.work, data.local.work)
    const records: RepositoryWrite[] = []
    const previous = new Map(before.inbox.map((item) => [item.id, item]))
    for (const item of data.inbox) {
      if (JSON.stringify(item) !== JSON.stringify(previous.get(item.id))) records.push({ collection: 'inbox', id: item.id, data: item })
      previous.delete(item.id)
    }
    for (const id of previous.keys()) records.push({ collection: 'inbox', id, data: null, deleted: true })
    if (JSON.stringify(data.local) !== JSON.stringify(before.local)) records.push({ collection: 'meta', id: 'local', data: sourceLocal(data.local) })
    if (!records.length) return
    await repo.putMany(records)
    useApp.setState({ local: data.local, inbox: data.inbox })
    changed()
  })
}

function completeTaskData(ref: TaskRef, task: InboxItem | WorkTask, data: TaskData, done: boolean, minimal = false, confirmedMinutes?: number, at = Date.now()): void {
  if (!!task.done === done) return
  task.done = done
  if (!done) {
    if (data.local.taskLearning && task.doneAt !== undefined) {
      const suffix = `:${task.id}:${task.doneAt}`
      data.local.taskLearning.samples = data.local.taskLearning.samples.filter((sample) => sample.id !== `task${suffix}` && sample.id !== `work${suffix}`)
    }
    delete task.doneAt; delete task.doneMode
    task.state = task.subtasks?.some((part) => part.doneAt !== undefined) ? 'partial' : 'pending'
    return
  }
  task.doneAt = at; task.doneMode = minimal ? 'minimal' : 'full'
  task.state = 'pending'
  if (data.local.taskLearning?.enabled && confirmedMinutes !== undefined) {
    if (!Number.isFinite(confirmedMinutes) || confirmedMinutes <= 0 || confirmedMinutes > 1440) throw new Error('Die bestätigte Dauer ist ungültig.')
    data.local.taskLearning.samples = [...data.local.taskLearning.samples, { id: `${ref.kind}:${ref.id}:${task.doneAt}`, key: taskLearningKey(ref, task), label: taskTitle(task), minutes: confirmedMinutes, at: task.doneAt, confirmed: true as const }].slice(-60)
  }
  const next = nextTaskOccurrence(task, today())
  if (next && !resolveTask({ kind: ref.kind, id: next.id }, data.inbox, data.local.work)) {
    const recurrence: InboxItem | WorkTask = { ...structuredClone(task), id: next.id, createdAt: Date.now(), recurrence: next.recurrence, source: { kind: 'repeat', id: task.id }, done: false, state: 'pending' }
    delete recurrence.doneAt; delete recurrence.doneMode; delete recurrence.startedAt; delete recurrence.deferredUntil
    delete recurrence.deadline; delete recurrence.earliestStart
    recurrence.subtasks = recurrence.subtasks?.map(({ doneAt: _done, ...part }) => part)
    if (ref.kind === 'task') { (recurrence as InboxItem).taskDate = next.date; data.inbox.push(recurrence as InboxItem) }
    else { recurrence.earliestStart = zonedToUtc(next.date, 4 * 60); data.local.work.push(recurrence as WorkTask) }
  }
}

function editTask(ref: TaskRef, edit: (task: InboxItem | WorkTask, data: TaskData) => void, required = false): Promise<void> {
  if (!validTaskRef(ref)) return Promise.reject(new Error('Die Aufgabenreferenz ist ungültig.'))
  return editTaskData((data) => {
    const task = resolveTask(ref, data.inbox, data.local.work)
    if (!task) {
      if (required) throw new Error('Die Aufgabe ist nicht mehr vorhanden. Es wurde nichts übernommen.')
      return
    }
    edit(task, data)
    if (!validTaskFields(task)) throw new Error('Die Aufgabenangaben sind ungültig. Deine bisherigen Daten bleiben erhalten.')
  })
}

/** Planänderung und private Rücknahmebasis werden gemeinsam gespeichert, ohne echte Handlungen zu erfinden. */
function editDayPlan(date: DateStr, label: string, edit: (log: DayLog, local: LocalData) => DayLog, accept?: () => boolean): Promise<void> {
  return atomic(async () => {
    if (accept && !accept()) throw new Error('Dieser Vorschlag passt nicht mehr zum aktuellen Plan. Bitte prüfe den Termin erneut.')
    const st = useApp.getState()
    const local = structuredClone(st.local)
    let log = structuredClone(st.days[date] ?? emptyLog(date))
    local.planUndo ??= {}
    local.planUndo[date] ??= { at: Date.now(), commitments: structuredClone(local.commitments.filter((commitment) => commitment.date === date)) }
    const before = log.before ?? { override: structuredClone(log.override), steps: structuredClone(log.steps) }
    const performed = Object.fromEntries(Object.entries(log.steps).filter(([, result]) => result === 'done' || result === 'minimal'))
    const confirmedBackAt = log.override.backAt
    log = edit(log, local)
    log = { ...log, before, steps: { ...log.steps, ...performed }, override: { ...log.override, adjusted: true, ...(confirmedBackAt !== undefined ? { backAt: confirmedBackAt } : {}) }, changes: [...(log.changes ?? []), label] }
    pauseChangedRoutine(local, log)
    const plan = planFor(date, { ...st, local, days: { ...st.days, [date]: log } })
    const award = applyAwards(plan, log, st.game, st.settings)
    const records: RepositoryWrite[] = [{ collection: 'days', id: date, data: award.log }, { collection: 'meta', id: 'local', data: sourceLocal(local) }]
    if (award.gained) records.push({ collection: 'game', id: 'main', data: award.game })
    await repo.putMany(records)
    useApp.setState({ days: { ...st.days, [date]: award.log }, local, game: award.game })
    changed()
  })
}

function pauseChangedRoutine(local: LocalData, log: DayLog): void {
  const focus = local.focus
  if (focus?.target.kind === 'routine' && focus.target.date === log.date) {
    if (log.steps[stepKey(focus.target.routine, focus.target.stepId)]) local.focus = undefined
    else focus.timer = pauseCountdown(focus.timer, Date.now())
  }
  local.focusHistory = local.focusHistory?.filter((focus) => focus.target.kind !== 'routine' || focus.target.date !== log.date || !log.steps[stepKey(focus.target.routine, focus.target.stepId)])
}

export function today(): DateStr {
  return activePlanDate(Date.now(), todayBerlin)
}

export function emptyLog(date: DateStr): DayLog {
  return { date, override: {}, steps: {} }
}

const planCache = new Map<string, { key: unknown[]; plan: DayPlan }>()

/** Dieselbe bestätigte Bedarfprojektion wird in Planer und Oberfläche verwendet. */
function coveredBy(date: DateStr, st: Pick<AppState, 'settings' | 'days'>): string {
  return routineCoverage(date, st.settings, st.days).filter((row) => row.covered).map((row) => row.key).join(',')
}

export function planFor(date: DateStr, st: Pick<AppState, 'settings' | 'days' | 'events' | 'local'> = useApp.getState()): DayPlan {
  const override = st.days[date]?.override
  const covered = coveredBy(date, st)
  const sessions = st.local.workSessions
  // Laufende Arbeit: Die Prognose hängt von der Uhr ab, also je Minute neu
  const nowMs = Date.now()
  const minute = sessions.some((x) => x.endAt === undefined) ? Math.floor(nowMs / 60_000) : 0
  const key = [st.settings, override, st.events, st.local.commitments, st.local.places, covered, sessions, minute]
  const hit = planCache.get(date)
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.plan
  const plan = buildDayPlan({ date, settings: st.settings, override, events: eventsFor(date, st.events), commitments: st.local.commitments.filter((c) => c.date === date), places: st.local.places, covered: covered ? covered.split(',') : undefined, sessions, nowMs })
  planCache.set(date, { key, plan })
  return plan
}

function eventsFor(date: DateStr, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => {
    const s = minutesOnPlanDay(date, e.start)
    const end = minutesOnPlanDay(date, e.end)
    return end > 0 && s < 1440 + 360
  })
}

export function statusOf(date: DateStr, st = useApp.getState()): DayStatus {
  const t = today()
  if (date > t) return 'open'
  const plan = planFor(date, st)
  return dayStatus(plan, st.days[date], st.settings, date < t)
}

/** Gleiche Normalisierung für DB-Load und die temporäre, rein lesende Importprojektion. */
async function readAppData(commitMigration = true, snapshot?: readonly Rec[]) {
  const records = snapshot && new Map(snapshot.map((record) => [key(record), record]))
  const source: Pick<Repository, 'get' | 'list'> = records ? {
    async get<T>(collection: Collection, id: string) {
      const record = records.get(`${collection}/${id}`)
      return record && !record.deleted ? record.data as T : undefined
    },
    async list<T>(collection: Collection) {
      return [...records.values()].filter((record) => record.collection === collection && !record.deleted).map((record) => record.data as T)
    },
  } : repo
  const t = today()
  const settings = (await source.get<Settings>('settings', 'main')) ?? defaultSettings(t)
  const game = (await source.get<GameState>('game', 'main')) ?? initialGame(t)
  const days: Record<string, DayLog> = {}
  for (const d of await source.list<DayLog>('days')) days[d.date] = d
  const inbox = (await source.list<InboxItem>('inbox')).map(normaliseTask)
  const reviews = await source.list<WeeklyReview>('reviews')
  const events = (await source.get<CalendarEvent[]>('meta', 'events')) ?? []
  const savedLocal = await source.get<LocalData>('meta', 'local')
  const savedRecovery = recoveryFields(savedLocal)
  const local = { ...emptyLocal(), ...savedLocal, ...eveningLocalFields(savedLocal), ...savedRecovery, deviceTests: deviceTestsFromLocal(savedLocal) }
  // Alte/ungültige Cachekopien bleiben ohne Einfluss auf die echten Quelldaten.
  const savedCatalog = await source.get<TimeCatalogSnapshot>('meta', TIME_CATALOG_RECORD_ID)
  local.timeCatalog = validTimeCatalog(savedCatalog) ? savedCatalog : undefined
  if (!validPlanUndo(local.planUndo)) local.planUndo = undefined
  if (!validConflictAcknowledgements(local.acknowledgedPlanConflicts)) local.acknowledgedPlanConflicts = undefined
  local.work = local.work.map(normaliseTask)
  local.resume = usableResume(local.resume, inbox, local.work)
  const relevant = (focus: FocusSession): boolean => focus.target.kind === 'routine'
    ? focus.target.date === t && !days[t]?.steps[stepKey(focus.target.routine, focus.target.stepId)]
    : taskFocusIsOpen(focus.target, { inbox, local })
  if (local.focus && !relevant(local.focus)) local.focus = undefined
  local.focusHistory = local.focusHistory?.filter(relevant)
  // Ungültige Teilreferenzen dauerhaft vergessen, damit ein späterer alter Taskrecord
  // dieselbe laufende Deadline nicht ohne bewussten Start wiederbeleben kann.
  const recoveryCleanup = !!(savedRecovery.focus && savedRecovery.focus.target.kind !== 'routine'
    && savedRecovery.focus.target.partId !== undefined && !local.focus)
    || !!savedRecovery.focusHistory?.some((focus) => focus.target.kind !== 'routine' && focus.target.partId !== undefined && !relevant(focus))
    || !!(savedRecovery.resume?.partId !== undefined && !local.resume)
  const weather = migrateWeatherState(migrateSettings(settings, t), local)
  const persistMigration = commitMigration && snapshot === undefined
  if ((weather.changed || recoveryCleanup) && persistMigration) await repo.putMany([
    ...(weather.changed ? [{ collection: 'settings' as const, id: 'main', data: weather.settings }] : []),
    { collection: 'meta', id: 'local', data: sourceLocal(weather.local) },
  ])
  return { data: { settings: weather.settings, game, days, inbox, reviews, events, local: weather.local }, needsWeatherMigration: weather.changed && !persistMigration, needsRecoveryCleanup: recoveryCleanup && !persistMigration }
}

/** Die bestehende E09-Vorschau hat LWW und fehlende Privatfelder bereits aufgelöst.
 * Wetterkanonisierung gehört vor dieselbe Merge-Transaktion, damit ein Import nie halb migriert ist. */
function canonicalWeatherImport(prepared: Rec[], current: Rec[]): Rec[] {
  const combined = new Map([...current, ...prepared].map((record) => [key(record), record]))
  const settingsRecord = combined.get('settings/main')
  const localRecord = combined.get('meta/local')
  const settings = migrateSettings(settingsRecord && !settingsRecord.deleted ? settingsRecord.data as Settings : defaultSettings(today()), today())
  const local = { ...emptyLocal(), ...(localRecord && !localRecord.deleted ? localRecord.data as LocalData : {}) }
  const weather = migrateWeatherState(settings, local)
  if (!weather.changed) return prepared
  const next = new Map(prepared.map((record) => [key(record), record]))
  const replace = (collection: 'settings' | 'meta', id: string, data: unknown) => {
    // Auch ein frisch übernommener/weit in die Zukunft datierter Altbestand muss
    // die zusammengehörige kanonische Version im selben LWW-Batch erhalten.
    const updated_at = Math.max(Date.now(), combined.get(`${collection}/${id}`)?.updated_at ?? 0) + 1
    if (!Number.isFinite(new Date(updated_at).getTime())) throw new Error('Der Datenzeitpunkt dieser Sicherung lässt sich nicht sicher migrieren. Es wurde nichts importiert.')
    next.set(`${collection}/${id}`, { collection, id, data, updated_at, deleted: false })
  }
  replace('settings', 'main', weather.settings)
  // Ein expliziter privater Löschrecord bleibt ein Löschrecord; keine Wiederbelebung
  // aus alten Settings-Ortsfeldern. Ein fehlender lokaler Record darf additiv entstehen.
  if (!prepared.some((record) => record.collection === 'meta' && record.id === 'local' && record.deleted)) replace('meta', 'local', weather.local)
  return validatedRecords([...next.values()])
}

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  settings: defaultSettings(todayBerlin()),
  game: initialGame(todayBerlin()),
  days: {},
  inbox: [],
  reviews: [],
  events: [],
  local: emptyLocal(),
  celebrations: [],

  refreshTimeCatalog(runtime) {
    timeCatalogUsed = true
    if (runtime !== undefined) timeCatalogRuntime = structuredClone(runtime)
    return refreshTimeCatalog()
  },

  async load() {
    if (pendingAtomicAction) await waitForAtomicActions()
    repo = await getRepository()
    for (;;) {
      const before = get()
      await persistence
      const { data: loaded, needsWeatherMigration, needsRecoveryCleanup } = await readAppData(false)
      const current = get()
      // Read again after concurrent edits settle: keep optimistic changes visible while also
      // picking up newly synced records instead of hiding an entire changed collection.
      const conflicted = (Object.keys(loaded) as (keyof typeof loaded)[]).some((field) => current[field] !== before[field])
      if (conflicted) continue
      if (needsWeatherMigration || needsRecoveryCleanup) {
        // Nach dem optimistischen Lesen unter derselben UI-Schreibsperre neu lesen.
        await atomic(async () => { set({ ...(await readAppData()).data, ready: true }) })
      } else set({ ...loaded, ready: true })
      if (get().settings.onboarded) await get().evaluateProgress()
      changed()
      return
    }
  },

  async saveSettings(fn) {
    await atomic(async () => {
      const settings = fn(structuredClone(get().settings))
      await repo.put('settings', 'main', settings)
      set({ settings })
    })
    changed()
  },

  acknowledgePlanConflict(date, conflictId) {
    return atomic(async () => {
      const st = get()
      // Eine veraltete Hinweis-Karte bestätigt keine geänderte Überschneidung.
      if (!planConflicts(planFor(date, st)).some((conflict) => conflict.id === conflictId)) return
      const previous = st.local.acknowledgedPlanConflicts?.[date] ?? []
      if (previous.includes(conflictId)) return
      const local = { ...st.local, acknowledgedPlanConflicts: {
        ...st.local.acknowledgedPlanConflicts, [date]: [...previous, conflictId],
      } }
      await repo.put('meta', 'local', sourceLocal(local))
      set({ local })
      // Keine neue Planung, keine Erledigung und keine Punkte aus einer Quittierung.
    })
  },

  async updateDay(date, fn) {
    await atomic(async () => {
      const st = get()
      let log = fn(structuredClone(st.days[date] ?? emptyLog(date)))
      const plan = planFor(date, { ...st, days: { ...st.days, [date]: log } })
      const eveningDismissed = log.dismissed?.includes('evening')
      const eveningResumed = eveningDismissed && plan.blocks.find((b) => b.routine === 'evening')?.steps?.some((step) => {
        const key = stepKey('evening', step.id)
        return (log.steps[key] === 'done' || log.steps[key] === 'minimal') && log.steps[key] !== st.days[date]?.steps[key]
      })
      // Eine spätere Notiz bestätigt keine entfallene Routine. Ein bewusst neu
      // erledigter Schritt darf dagegen wieder nach den gemeinsamen Regeln zählen.
      if (!log.eveningRoutineDoneAt && (!eveningDismissed || eveningResumed) && routineCompleted(plan, log, 'evening')) log.eveningRoutineDoneAt = Date.now()
      const a = applyAwards(plan, log, st.game, st.settings)
      log = a.log
      const records: RepositoryWrite[] = [{ collection: 'days', id: date, data: log }]
      if (a.gained) records.push({ collection: 'game', id: 'main', data: a.game })
      await repo.putMany(records)
      set({ days: { ...st.days, [date]: log }, game: a.game })
      if (a.gained) {
      // XP zählen weiter, aber bei Überlastung oder abgeschaltetem Spiel erscheint nichts davon
      if (st.settings.support.gameVisible && log.override.mode !== 'ueberlastet') {
        get().celebrate({ kind: 'xp', title: `+${a.gained} ${theme(st.settings.themeId).xpWord}` })
        const t = theme(st.settings.themeId)
        const lb = levelFor(st.game.xp, t)
        const la = levelFor(a.game.xp, t)
        if (la.level > lb.level) get().celebrate({ kind: 'level', title: `Level ${la.level}`, text: t.levelUp(la.name) })
      }
      }
    })
    changed()
  },

  async setStep(date, r, stepId, result) {
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().updateDay(date, (log) => {
      const k = stepKey(r, stepId)
      if (result) log.steps[k] = result
      else delete log.steps[k]
      return log
    })
  },

  async mark(date, field, at = Date.now()) {
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().updateDay(date, (log) => ({ ...log, [field]: at }))
  },

  applyReminderAction(action) {
    // During this short database transaction normal mutations wait, so a concurrent UI edit
    // cannot overwrite an unacknowledged effect or capture a receipt from a failed write.
    return atomic(async (): Promise<ReminderApplyResult> => {
      if (!validReminderAction(action)) return 'obsolete'
      const localEffect = action.action === 'done' && (action.key.startsWith('go:') || /^deadline-(day|hour):/.test(action.key))
      const stored = localEffect ? await repo.get<LocalData>('meta', 'local') : await repo.get<DayLog>('days', action.date)
      if (stored?.reminderReceipts?.includes(action.id)) return 'duplicate'
      const st = get()
      const extras = { deadlines: st.local.work.filter((w) => w.deadline && taskIsOpen(w)).map((w) => ({ id: w.id, at: w.deadline!, reminderRevision: w.reminderRevision })), thoughtReviews: st.inbox, tomorrowSteps: st.local.tomorrowSteps }
      const plans = [-1, 0, 1].map((offset) => planFor(addDays(action.date, offset), st))
      if (!currentReminderAction(action, plans, st.days, st.settings, extras, Date.now())) return 'obsolete'

      if (localEffect) {
        const local = structuredClone(st.local)
        if (action.key.startsWith('go:')) {
          const item = local.commitments.find((c) => c.id === action.key.slice(3) && c.date === action.date)
          if (!item || item.leftAt !== undefined || item.arrivedAt !== undefined || item.backAt !== undefined) return 'obsolete'
          item.leftAt = action.at
        } else {
          const item = local.work.find((w) => w.id === action.key.replace(/^deadline-(day|hour):/, ''))
          if (!item || !taskIsOpen(item) || item.doneAt !== undefined) return 'obsolete'
          const ref: TaskRef = { kind: 'work', id: item.id }
          completeTaskData(ref, item, { local, inbox: st.inbox }, true, false, undefined, action.at)
          stampTaskChanges(st.local.work, local.work)
          local.resume = usableResume(local.resume, st.inbox, local.work)
          if (focusedOn(local, ref)) delete local.focus
          local.focusHistory = local.focusHistory?.filter((focus) => focus.target.kind === 'routine' || !sameRef(focus.target, ref))
        }
        local.reminderReceipts = withReminderReceipt(local.reminderReceipts, action.id)
        await repo.putMany([{ collection: 'meta', id: 'local', data: sourceLocal(local) }])
        set({ local }); changed()
        return 'applied'
      }

      const log = structuredClone(st.days[action.date] ?? emptyLog(action.date))
      const plan = planFor(action.date, st)
      const fields = { leave: 'leftAt', 'leave-10': 'leftAt', pcstop: 'pcOffAt', 'pcstop-15': 'pcOffAt', bed: 'bedAt', evening: 'eveningRoutineDoneAt' } as const
      const field = fields[action.key as keyof typeof fields]
      if (action.action === 'done' && field) {
        if (log[field] !== undefined) return 'obsolete'
        log[field] = action.at
      } else {
        if (log.dismissed?.includes(action.key)) return 'obsolete'
        log.dismissed = [...(log.dismissed ?? []), action.key]
      }
      if (action.key === 'evening') {
        for (const step of openSteps(plan, log, 'evening')) {
          log.steps[stepKey('evening', step.id)] = action.action === 'skip' ? 'not-needed' : step.useMinimal ? 'minimal' : 'done'
        }
        if (action.action === 'skip') log.override.adjusted = true
      }
      log.reminderReceipts = withReminderReceipt(log.reminderReceipts, action.id)
      // Eine bewusste Ablehnung ist keine Handlung und verdient keine neuen Punkte.
      const award = action.action === 'skip' ? { log, game: st.game, gained: 0 } : applyAwards(plan, log, st.game, st.settings)
      const records: Pick<Rec, 'collection' | 'id' | 'data'>[] = [{ collection: 'days', id: action.date, data: award.log }]
      if (award.gained) records.push({ collection: 'game', id: 'main', data: award.game })
      await repo.putMany(records)
      set({ days: { ...get().days, [action.date]: award.log }, game: award.game })
      if (award.gained && st.settings.support.gameVisible && log.override.mode !== 'ueberlastet') get().celebrate({ kind: 'xp', title: `+${award.gained} ${theme(st.settings.themeId).xpWord}` })
      changed()
      return 'applied'
    })
  },

  async setOverride(date, patch) {
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().updateDay(date, (log) => ({ ...log, override: { ...log.override, ...patch } }))
  },

  async addInbox(text, context) {
    const trimmed = text.trim()
    if (!trimmed) return undefined
    let id: string | undefined
    await editTaskData((data) => {
      const draft = data.local.captureDraft
      id = draft?.text.trim() === trimmed ? draft.id : randomId()
      const storedContext = draft?.context?.kind === 'work' ? 'Arbeit' : context
      if (!data.inbox.some((item) => item.id === id)) data.inbox.push({ id, text: trimmed, createdAt: Date.now(), status: 'open', source: { kind: 'capture' }, ...(storedContext ? { captureContext: storedContext } : {}) })
      if (draft?.id === id) data.local.captureDraft = undefined
    })
    return id
  },

  saveCaptureDraft(text, context) {
    return editTaskData((data) => {
      const draft = { id: data.local.captureDraft?.id ?? randomId(), text, context, updatedAt: Date.now() }
      if (!validCaptureDraft(draft)) throw new Error('Der Entwurf ist ungültig.')
      data.local.captureDraft = text ? draft : undefined
    })
  },

  async addWorkTask(title) {
    if (!title.trim()) return undefined
    const id = randomId()
    await editTaskData((data) => { data.local.work.push({ id, title: title.trim(), createdAt: Date.now(), source: { kind: 'manual' } }) })
    return id
  },

  moveWorkTaskToTop(id) {
    return editTaskData((data) => {
      const task = data.local.work.find((item) => item.id === id)
      if (task) { task.priority = 'high'; data.local.work = [task, ...data.local.work.filter((item) => item.id !== id)] }
    })
  },

  updateTask(ref, patch, expected) {
    return editTask(ref, (task, data) => {
      if (expected && (expected.purpose !== 'ai' || !assistanceAllowed(data.local.assistance, 'ai'))) throw new Error('Die KI-Freigabe ist ausgeschaltet. Es wurde nichts übernommen.')
      if (expected && taskAssistanceRevision(ref, task) !== expected.revision) throw new Error('Die Aufgabe hat sich geändert. Prüfe den Vorschlag erneut; es wurde nichts übernommen.')
      if (expected && !taskIsOpen(task)) throw new Error('Die Aufgabe ist nicht mehr offen. Es wurde nichts übernommen.')
      const { text, title, taskDate, ...fields } = patch
      if (fields.subtasks) {
        // Eine neue Detailtiefe kann echte Teilabschlüsse niemals unbemerkt entfernen.
        const done = task.subtasks?.filter((part) => part.doneAt !== undefined) ?? []
        fields.subtasks = [...fields.subtasks.map((part) => {
          const previous = done.find((old) => old.id === part.id)
          return previous ? expected ? previous : { ...part, doneAt: previous.doneAt } : part
        }), ...done.filter((part) => !fields.subtasks!.some((next) => next.id === part.id))]
      }
      Object.assign(task, fields)
      const nextTitle = ref.kind === 'work' ? title ?? text : text ?? title
      if (nextTitle !== undefined) {
        if (!nextTitle.trim()) throw new Error('Ein Titel ist nötig.')
        if ('text' in task) task.text = nextTitle
        else task.title = nextTitle
      }
      if (taskDate !== undefined && ref.kind === 'task') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate) || new Date(`${taskDate}T12:00:00Z`).toISOString().slice(0, 10) !== taskDate) throw new Error('Wähle ein gültiges Datum.')
        ;(task as InboxItem).taskDate = taskDate
        if (task.state === 'deferred') task.deferredUntil = zonedToUtc(taskDate, 4 * 60)
      }
      if (patch.state && patch.state !== 'active' && focusedOn(data.local, ref) && data.local.focus) {
        data.local.focus.timer = pauseCountdown(data.local.focus.timer, Date.now())
      }
    }, !!expected)
  },

  setTaskState(ref, state) {
    return get().updateTask(ref, { state })
  },

  completeTask(ref, done, minimal = false, confirmedMinutes) {
    return editTask(ref, (task, data) => completeTaskData(ref, task, data, done, minimal, confirmedMinutes))
  },

  removeTask(ref) {
    return editTaskData((data) => {
      if (ref.kind === 'work') data.local.work = data.local.work.filter((task) => task.id !== ref.id)
      else data.inbox = data.inbox.filter((task) => task.id !== ref.id)
      for (const item of data.inbox) if (sameRef(item.linkedTo, ref)) delete item.linkedTo
    })
  },

  startTaskFocus(ref, minutes, partId) {
    return editTask(ref, (task, data) => {
      if (!taskIsOpen(task)) return
      const target: TaskFocusTarget = { kind: ref.kind, id: ref.id, ...(partId !== undefined ? { partId } : {}) }
      if (!validFocusTarget(target)) throw new Error('Der Teilschritt ist ungültig.')
      const part = partId === undefined ? undefined : task.subtasks?.find((part) => part.id === partId && part.doneAt === undefined)
      // Ein verspäteter Start aus einer alten Ansicht darf weder einen anderen Fokus
      // pausieren noch die fehlende Teilreferenz in eine ganze Aufgabe umdeuten.
      if (partId !== undefined && !part) return
      const duration = minutes ?? part?.timerMin ?? part?.estimateMin ?? 25
      if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) throw new Error('Wähle eine Dauer über 0 und bis 1440 Minuten.')
      const focus = data.local.focus
      if (focus && !sameFocusTarget(focus.target, target)) archiveFocus(data)
      task.state = 'active'; task.startedAt ??= Date.now()
      const previous = focus && sameFocusTarget(focus.target, target) ? focus : archivedFocus(data, target)
      if (previous && remainingMs(previous.timer, Date.now()) > 0) data.local.focus = { ...previous, timer: resumeCountdown(previous.timer, Date.now()) }
      else {
        if (part) part.timerMin = duration
        data.local.focus = { id: randomId(), target, timer: createCountdown(duration * 60, Date.now()) }
      }
    })
  },

  pauseTaskFocus(ref, nextStep, note, expectedPartId) {
    return editTask(ref, (task, data) => {
      if (!taskIsOpen(task)) return
      const saved = data.local.resume
      const target = focusedOn(data.local, ref) ? data.local.focus?.target : undefined
      if (expectedPartId !== undefined && (!target || target.kind === 'routine' || target.partId !== expectedPartId)) return
      const partId = target && target.kind !== 'routine' ? target.partId : saved?.kind === ref.kind && saved.refId === ref.id ? saved.partId : undefined
      const part = task.subtasks?.find((part) => part.id === partId)
      if (nextStep !== undefined && (!part || nextStep.trim() !== part.title.trim())) task.nextStep = nextStep
      if (note !== undefined) task.resumeNote = note.trim() || undefined
      else if (task.resumeNote === undefined && saved?.kind === ref.kind && saved.refId === ref.id) task.resumeNote = saved.note
      task.state = 'paused'
      if (focusedOn(data.local, ref) && data.local.focus) data.local.focus.timer = pauseCountdown(data.local.focus.timer, Date.now())
      data.local.resume = { kind: ref.kind, title: taskTitle(task), nextStep: taskNextStep(task, taskTitle(task)), refId: ref.id, ...(partId !== undefined ? { partId } : {}), at: Date.now(), route: `/aufgabe/${ref.kind}/${encodeURIComponent(ref.id)}`, ...(task.resumeNote ? { note: task.resumeNote } : {}) }
    })
  },

  setTaskPartDone(ref, partId, done) {
    return editTask(ref, (task) => {
      const part = task.subtasks?.find((item) => item.id === partId)
      if (!part || (part.doneAt !== undefined) === done) return
      if (done) part.doneAt = Date.now()
      else delete part.doneAt
      if (task.state !== 'active') task.state = task.subtasks?.some((item) => item.doneAt !== undefined) ? 'partial' : 'pending'
    })
  },

  replaceTaskParts(ref, parts, expected) {
    if (!validTaskParts(parts)) return Promise.reject(new Error('Die Teilschritte sind ungültig.'))
    return get().updateTask(ref, { subtasks: parts }, expected)
  },

  moveInboxToWork(id) {
    return editTaskData((data) => {
      const item = data.inbox.find((note) => note.id === id)
      if (!item) return
      if (data.local.work.some((work) => work.id === id)) throw new Error('Diese Arbeitsaufgabe ist bereits vorhanden. Dein Gedanke bleibt erhalten. Prüfe beide Einträge, bevor du ihn überträgst.')
      const fields: Partial<InboxItem> = { ...item }
      for (const key of ['text', 'status', 'taskDate', 'captureContext', 'reviewAt', 'reviewNotify', 'linkedTo'] as const) delete fields[key]
      data.local.work.push({ ...fields, id: item.id, createdAt: item.createdAt, title: item.text })
      data.inbox = data.inbox.filter((note) => note.id !== id)
      for (const note of data.inbox) if (note.linkedTo?.kind === 'task' && note.linkedTo.id === id) note.linkedTo = { kind: 'work', id }
      if (data.local.resume?.kind === 'task' && data.local.resume.refId === id) data.local.resume = { ...data.local.resume, kind: 'work', route: `/aufgabe/work/${encodeURIComponent(id)}` }
      if (focusedOn(data.local, { kind: 'task', id }) && data.local.focus && data.local.focus.target.kind !== 'routine') data.local.focus.target = { ...data.local.focus.target, kind: 'work' }
      for (const focus of data.local.focusHistory ?? []) if (focus.target.kind === 'task' && focus.target.id === id) focus.target = { ...focus.target, kind: 'work' }
      if (data.local.captureDraft?.context?.kind === 'task' && data.local.captureDraft.context.refId === id) data.local.captureDraft.context.kind = 'work'
    })
  },

  linkInbox(id, ref) {
    return editTaskData((data) => {
      const note = data.inbox.find((item) => item.id === id)
      if (!note || (ref.kind === 'task' && ref.id === id)) return
      if (!validTaskRef(ref) || !resolveTask(ref, data.inbox, data.local.work)) throw new Error('Diese Aufgabe ist nicht mehr vorhanden.')
      note.status = 'kept'; note.linkedTo = ref
      delete note.taskDate
    })
  },

  setTaskLearning(enabled) {
    return editTaskData((data) => { data.local.taskLearning = { enabled, samples: data.local.taskLearning?.samples ?? [] } })
  },

  clearTaskLearning() {
    return editTaskData((data) => { data.local.taskLearning = { enabled: false, samples: [] } })
  },

  ensureFocus(target, seconds, legacyStartedAt) {
    return editTaskData((data) => {
      if (!validFocusTarget(target)) throw new Error('Der Fokus ist ungültig.')
      if (target.kind === 'routine') {
        const st = get()
        if (target.date !== today() || st.days[target.date]?.steps[stepKey(target.routine, target.stepId)]
          || !planFor(target.date, st).blocks.some((block) => block.routine === target.routine && block.steps?.some((step) => step.id === target.stepId))) return
      } else if (!taskFocusIsOpen(target, data)) return
      if (data.local.focus && sameFocusTarget(data.local.focus.target, target)) return
      const previous = data.local.focus
      if (previous) archiveFocus(data)
      const archived = archivedFocus(data, target)
      if (archived) { data.local.focus = archived; return }
      const now = Date.now()
      const start = !previous && Number.isSafeInteger(legacyStartedAt) && legacyStartedAt! > 0 && legacyStartedAt! <= now ? legacyStartedAt! : now
      data.local.focus = { id: randomId(), target, timer: createCountdown(seconds, start) }
    })
  },

  updateFocus(id, fn) {
    return editTaskData((data) => {
      if (data.local.focus?.id !== id) return
      const next = fn(data.local.focus)
      if (next.id !== id || !sameFocusTarget(next.target, data.local.focus.target) || !isFocusSession(next)) throw new Error('Der Fokuszustand ist ungültig.')
      data.local.focus = next
    })
  },

  clearFocus(id) {
    return editTaskData((data) => {
      if (data.local.focus?.id === id) delete data.local.focus
      data.local.focusHistory = data.local.focusHistory?.filter((focus) => focus.id !== id)
    })
  },

  saveStuck(fn) {
    return editTaskData((data) => {
      const next = fn(data.local.stuck)
      if (!validStuck(next)) throw new Error('Der Hilfetimer ist ungültig.')
      data.local.stuck = next
    })
  },

  async parkThought(text, reviewAt, notify = false) {
    const trimmed = text.trim()
    if (!trimmed) return undefined
    const nowMs = Date.now()
    if (!Number.isFinite(reviewAt) || !Number.isFinite(new Date(reviewAt).getTime()) || reviewAt <= nowMs) throw new Error('Wähle einen Zeitpunkt in der Zukunft.')
    const item: InboxItem = { id: randomId(), text: trimmed, createdAt: nowMs, status: 'open', reviewAt, reviewNotify: notify }
    // Ein Datensatz statt erst Anlegen und dann Ergänzen: Die Wiedervorlage ist ab dem ersten Speichern vollständig.
    await editTaskData((data) => { data.inbox.push(item) })
    return item.id
  },

  async updateInbox(id, patch) {
    await editTaskData((data) => {
      const item = data.inbox.find((note) => note.id === id)
      if (!item) return
      Object.assign(item, patch)
      if (!validTaskFields(item)) throw new Error('Die Aufgabenangaben sind ungültig.')
      if (item.linkedTo && !validTaskRef(item.linkedTo)) throw new Error('Die Verknüpfung ist ungültig.')
    })
  },

  async setInboxDone(id, done) {
    await get().completeTask({ kind: 'task', id }, done)
  },

  async removeInbox(id) {
    await get().removeTask({ kind: 'task', id })
  },

  async saveReview(r) {
    if (pendingAtomicAction) await waitForAtomicActions()
    const first = get().reviews.length === 0
    const before = get().reviews.find((x) => x.id === r.id)
    set({ reviews: [...get().reviews.filter((x) => x.id !== r.id), r] })
    await persist(() => repo.put('reviews', r.id, r))
    if (r.change.trim() && r.change.trim() !== before?.change.trim()) {
      await get().saveSettings((s) => ({
        ...s,
        suggestions: [...s.suggestions, { id: randomId(), text: r.change.trim(), createdAt: r.id }],
      }))
    }
    if (first) await get().evaluateProgress()
  },

  async redeem(rewardId) {
    const redeemed = await atomic(async () => {
      const st = get()
      const reward = st.settings.rewards.find((item) => item.id === rewardId)
      if (!reward || st.game.xp - st.game.spent < reward.price) return undefined
      const game = {
        ...st.game,
        spent: st.game.spent + reward.price,
        redeemed: [...st.game.redeemed, { rewardId, title: reward.title, price: reward.price, at: Date.now() }],
      }
      await repo.put('game', 'main', game)
      set({ game })
      return reward
    })
    if (!redeemed) return false
    get().celebrate({ kind: 'achievement', title: 'Gönn dir!', text: redeemed.title })
    await get().evaluateProgress()
    return true
  },

  async setGame(fn) {
    await atomic(async () => {
      const game = fn(structuredClone(get().game))
      await repo.put('game', 'main', game)
      set({ game })
    })
  },

  async evaluateProgress() {
    await atomic(async () => {
    const st = get()
    const t = today()
    const th = theme(st.settings.themeId)
    const logs = Object.values(st.days).filter((l) => l.date <= t)
    const { game, events } = advanceGame(st.game, {
      today: t,
      settings: st.settings,
      theme: th,
      statusOf: (d) => statusOf(d, st),
      goalsOf: (d) => dayGoals(planFor(d, st), st.days[d], st.settings),
      logs,
      reviewCount: st.reviews.length,
    })
    if (JSON.stringify(game) === JSON.stringify(st.game)) return
    await repo.put('game', 'main', game)
    set({ game })
    for (const e of events) {
      if (e.type === 'chapter-completed') get().celebrate({ kind: 'chapter', title: `${th.chapterWord} geschafft!`, text: e.text })
      if (e.type === 'achievement') get().celebrate({ kind: 'achievement', title: 'Erfolg freigeschaltet', text: e.text })
      if (e.type === 'level-up') get().celebrate({ kind: 'level', title: 'Level-Aufstieg', text: e.text })
      if (e.type === 'chapter-restarted') get().celebrate({ kind: 'restart', title: 'Neuer Anlauf', text: e.text })
      if (e.type === 'stage-offer') get().celebrate({ kind: 'stage', title: 'Nächste Stufe?', text: e.text })
    }
    })
  },

  applyCalendarSnapshot(events, status, accept) {
    return atomic(async () => {
      if (!accept()) return false
      if (!validCalendarStatus(status)) throw new Error('Der Kalenderstand ist ungültig.')
      const local = { ...get().local, extras: { ...get().local.extras, calendar: status } }
      await repo.putMany([{ collection: 'meta', id: 'events', data: events }, { collection: 'meta', id: 'local', data: sourceLocal(local) }])
      set({ events, local }); changed()
      return true
    })
  },

  async setEvents(events) {
    if (pendingAtomicAction) await waitForAtomicActions()
    set({ events })
    await persist(() => repo.put('meta', 'events', events))
    changed()
  },

  async saveLocal(fn) {
    await atomic(async () => {
      const before = get().local
      const local = fn(structuredClone(before))
      stampTaskChanges(before.work, local.work)
      await repo.put('meta', 'local', sourceLocal(local))
      set({ local })
    })
    changed()
  },

  async saveDeviceTests(fn) {
    await atomic(async () => {
      const local = { ...get().local, deviceTests: fn(structuredClone(deviceTestsFromLocal(get().local))) }
      if (!validDeviceTests(local.deviceTests)) throw new Error('Die Testangaben sind ungültig.')
      await repo.put('meta', 'local', sourceLocal(local))
      set({ local })
    })
  },

  async setResume(r) {
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().saveLocal((l) => {
      const next = { ...l }
      if (r) next.resume = r
      else delete next.resume
      return next
    })
  },

  async saveTomorrowStep(title, nextStep, resumeAt, remind = false) {
    if (pendingAtomicAction) await waitForAtomicActions()
    const trimmedTitle = title.trim()
    const trimmedStep = nextStep.trim()
    if (!trimmedTitle || !trimmedStep) return undefined
    const nowMs = Date.now()
    if (!Number.isFinite(resumeAt) || !Number.isFinite(new Date(resumeAt).getTime()) || resumeAt <= nowMs) throw new Error('Wähle einen Zeitpunkt in der Zukunft.')
    const step: TomorrowStep = { id: randomId(), title: trimmedTitle, nextStep: trimmedStep, resumeAt, createdAt: nowMs, remind }
    await get().saveLocal((local) => ({ ...local, tomorrowSteps: [...local.tomorrowSteps, step] }))
    return step.id
  },

  async finishTomorrowStep(id) {
    if (pendingAtomicAction) await waitForAtomicActions()
    if (!get().local.tomorrowSteps.some((step) => step.id === id && step.doneAt === undefined)) return
    const doneAt = Date.now()
    await get().saveLocal((local) => ({ ...local, tomorrowSteps: local.tomorrowSteps.map((step) => step.id === id && step.doneAt === undefined ? { ...step, doneAt } : step) }))
  },

  async removeTomorrowStep(id) {
    if (pendingAtomicAction) await waitForAtomicActions()
    if (!get().local.tomorrowSteps.some((step) => step.id === id)) return
    await get().saveLocal((local) => ({ ...local, tomorrowSteps: local.tomorrowSteps.filter((step) => step.id !== id) }))
  },

  async saveSleepEntry(date, entry) {
    if (pendingAtomicAction) await waitForAtomicActions()
    const normalized = validateSleepEntry(date, entry)
    await get().saveLocal((local) => {
      const sleepDiary = { ...local.sleepDiary }
      if (Object.keys(normalized).length) sleepDiary[date] = normalized
      else delete sleepDiary[date]
      return { ...local, sleepDiary }
    })
  },

  async removeSleepEntry(date) {
    if (pendingAtomicAction) await waitForAtomicActions()
    if (!Object.hasOwn(get().local.sleepDiary, date)) return
    await get().saveLocal((local) => {
      const sleepDiary = { ...local.sleepDiary }
      delete sleepDiary[date]
      return { ...local, sleepDiary }
    })
  },

  async setMeds(date, status) {
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().saveLocal((l) => {
      const meds = { ...l.meds }
      if (status) meds[date] = { status, at: Date.now() }
      else delete meds[date]
      return { ...l, meds }
    })
  },

  adjustDay(date, label, fn) {
    return editDayPlan(date, label, (log) => fn(log))
  },

  restoreDay(date) {
    return atomic(async () => {
      const st = get()
      const current = st.days[date]
      // Alte Daten ohne Rücknahmebasis niemals durch vermutete Terminabsagen verändern.
      if (!current?.before) return
      const local = structuredClone(st.local)
      const log = structuredClone(current)
      const real = Object.fromEntries(Object.entries(log.steps).filter(([, value]) => value === 'done' || value === 'minimal'))
      const override = { ...log.before!.override, ...(log.override.backAt !== undefined ? { backAt: log.override.backAt } : {}) }
      const restored: DayLog = { ...log, override, steps: { ...log.before!.steps, ...real } }
      delete restored.before; delete restored.changes
      const snapshot = local.planUndo?.[date]
      if (snapshot) local.commitments = restoreCommitments(date, local.commitments, snapshot.commitments, local.workSessions)
      if (local.planUndo) {
        delete local.planUndo[date]
        if (!Object.keys(local.planUndo).length) delete local.planUndo
      }
      pauseChangedRoutine(local, restored)
      const plan = planFor(date, { ...st, local, days: { ...st.days, [date]: restored } })
      const award = applyAwards(plan, restored, st.game, st.settings)
      const records: RepositoryWrite[] = [{ collection: 'days', id: date, data: award.log }, { collection: 'meta', id: 'local', data: sourceLocal(local) }]
      if (award.gained) records.push({ collection: 'game', id: 'main', data: award.game })
      await repo.putMany(records)
      set({ days: { ...st.days, [date]: award.log }, local, game: award.game })
      changed()
    })
  },

  async saveCommitment(c) {
    if (!validCommitment(c)) throw new Error('Prüfe Datum, Uhrzeit und die freiwilligen Angaben zum Termin. Deine bisherigen Daten bleiben erhalten.')
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().saveLocal((local) => ({ ...local, commitments: [...local.commitments.filter((commitment) => commitment.id !== c.id), c] }))
  },

  adjustCommitment(c, label, reason) {
    if (!validCommitment(c)) return Promise.reject(new Error('Prüfe die Angaben zum Termin. Es wurde nichts geändert.'))
    return editDayPlan(c.date, label, (log, local) => {
      if (c.source && c.status !== 'cancelled' && local.commitments.some((other) => other.id !== c.id && other.date === c.date && other.status !== 'cancelled' && other.source?.provider === c.source!.provider && other.source.id === c.source!.id)) {
        throw new Error('Dieser Kalendertermin ist bereits verbunden. Bearbeite den vorhandenen Termin, statt eine zweite Fahrt anzulegen.')
      }
      local.commitments = [...local.commitments.filter((commitment) => commitment.id !== c.id), structuredClone(c)]
      return reason ? { ...log, override: { ...log.override, reason } } : log
    })
  },

  updateCommitment(id, patch, label = 'Termin angepasst', accept) {
    const initial = get().local.commitments.find((commitment) => commitment.id === id)
    if (!initial) return Promise.reject(new Error('Dieser Termin ist nicht mehr vorhanden.'))
    return editDayPlan(initial.date, label, (log, local) => {
      const current = local.commitments.find((commitment) => commitment.id === id)
      if (!current || current.date !== initial.date) throw new Error('Der Termin wurde inzwischen geändert. Bitte öffne ihn erneut.')
      const next = { ...current, ...structuredClone(patch), id: current.id, date: current.date }
      if (!validCommitment(next)) throw new Error('Prüfe die Angaben zum Termin. Es wurde nichts geändert.')
      if (next.source && next.status !== 'cancelled' && local.commitments.some((other) => other.id !== id && other.date === next.date && other.status !== 'cancelled' && other.source?.provider === next.source!.provider && other.source.id === next.source!.id)) {
        throw new Error('Dieser Kalendertermin ist bereits verbunden. Es wurde keine zweite Fahrt angelegt.')
      }
      local.commitments = local.commitments.map((commitment) => commitment.id === id ? next : commitment)
      return log
    }, accept)
  },

  async markCommitment(id, field, at = Date.now()) {
    if (!['leftAt', 'arrivedAt', 'backAt'].includes(field) || !Number.isFinite(at) || at < 0) throw new Error('Der Zeitpunkt ist ungültig.')
    await get().saveLocal((local) => ({ ...local, commitments: local.commitments.map((commitment) => commitment.id === id && commitment.status !== 'cancelled' ? { ...commitment, [field]: commitment[field] ?? at } : commitment) }))
  },

  async savePlace(place) {
    if (!validPlace(place)) throw new Error('Prüfe die Angaben zum Ort. Koordinaten und Wegzeiten dürfen offen bleiben.')
    await get().saveLocal((local) => ({ ...local, places: [...local.places.filter((old) => old.id !== place.id), structuredClone(place)] }))
  },

  async removePlace(id) {
    await get().saveLocal((local) => {
      const place = local.places.find((candidate) => candidate.id === id)
      if (!place) return local
      return {
        ...local,
        places: local.places.filter((candidate) => candidate.id !== id),
        commitments: local.commitments.map((commitment) => ({
          ...commitment,
          ...(commitment.placeId === id ? { placeId: undefined, placeLabel: commitment.placeLabel || place.label, address: commitment.address || place.address, items: commitment.items ?? place.items } : {}),
          ...(commitment.originPlaceId === id ? { originPlaceId: 'unknown' } : {}),
        })),
      }
    })
  },

  async workStart(i = {}) {
    const at = i.at ?? Date.now()
    await changeWork((local) => ({ ...local, workSessions: startSession(local.workSessions, { id: randomId(), date: today(), at, kind: i.kind, label: i.label, commitmentId: i.commitmentId }) }))
  },

  async workStop(at = Date.now()) {
    await changeWork((local) => {
      const open = local.workSessions.find((session) => session.endAt === undefined)
      const commitments = open?.commitmentId ? local.commitments.map((c) => (c.id === open.commitmentId && c.routeMode === 'none' ? { ...c, backAt: at } : c)) : local.commitments
      return { ...local, commitments, workSessions: stopSession(local.workSessions, at) }
    })
  },

  async workBreakStart(at = Date.now()) {
    await changeWork((local) => ({ ...local, workSessions: startBreak(local.workSessions, randomId(), at) }))
  },

  async workBreakEnd(at = Date.now()) {
    await changeWork((local) => ({ ...local, workSessions: endBreak(local.workSessions, at) }))
  },

  async editWork(fn) {
    await changeWork((local) => ({ ...local, workSessions: fn(local.workSessions) }), true)
  },

  async undoWork() {
    await atomic(async () => {
      const state = get()
      const undo = state.workUndo
      if (!undo) return
      if (JSON.stringify(state.local.workSessions) !== undo.revision) {
        set({ workUndo: undefined })
        throw new Error('Seit dieser Korrektur wurden Arbeitszeiten geändert. Deine neueren Zeiten bleiben erhalten; öffne den betreffenden Eintrag zum Korrigieren.')
      }
      const local = { ...state.local, workSessions: structuredClone(undo.before) }
      await repo.put('meta', 'local', sourceLocal(local))
      set({ local, workUndo: undefined })
      changed()
    })
  },

  setAlarmStatus(a) {
    set({ alarmStatus: a })
  },

  async importRecords(recs, mode = 'merge') {
    // mergeRecords veröffentlicht bereits die gemeinsam vorbereitete Projektion.
    return get().mergeRecords(recs, true, () => true, mode)
  },

  mergeRecords(recs, dirty = false, accepted = () => true, mode = 'merge') {
    return atomic(async () => {
      if (!accepted()) return 0
      const checked = validatedRecords(recs)
      // Vorschau erst in der Schreibbarriere gegen den wirklich aktuellen Bestand berechnen.
      const current = await repo.all()
      if (!accepted()) return 0
      const prepared = previewImport(checked, current, mode).records
      let canonical = canonicalWeatherImport(prepared, current)
      const snapshot = [...new Map([...current, ...canonical].map((record) => [key(record), record])).values()]
      const projection = await readAppData(false, snapshot)
      if (projection.needsWeatherMigration) throw new Error('Die Wetterdaten konnten nicht vollständig für den Import vorbereitet werden. Es wurde nichts importiert.')
      if (projection.needsRecoveryCleanup && !canonical.some((record) => record.collection === 'meta' && record.id === 'local' && record.deleted)) {
        const previous = snapshot.find((record) => record.collection === 'meta' && record.id === 'local')
        const updated_at = Math.max(Date.now(), previous?.updated_at ?? 0) + 1
        if (!Number.isFinite(new Date(updated_at).getTime())) throw new Error('Der Datenzeitpunkt dieser Sicherung lässt sich nicht sicher übernehmen. Es wurde nichts importiert.')
        canonical = validatedRecords([...canonical.filter((record) => record.collection !== 'meta' || record.id !== 'local'),
          { collection: 'meta', id: 'local', data: sourceLocal(projection.data.local), updated_at, deleted: false }])
      }
      if (!accepted()) return 0
      const count = await repo.merge(canonical, { dirty })
      // Bevor die nächste lokale Detailänderung beginnt, muss sie die übernommenen Daten sehen.
      if (count) {
        // Nach dem Commit nur publizieren: kein fallibler DB-Read und kein weiterer Write.
        set(projection.data)
        changed()
      }
      return count
    })
  },

  celebrate(c) {
    if (!get().settings.support.gameVisible || get().days[today()]?.override.mode === 'ueberlastet') return
    set({ celebrations: [...get().celebrations, c] })
  },
  popCelebration() {
    set({ celebrations: get().celebrations.slice(1) })
  },
  showToast(t, action) {
    const version = ++toastVersion
    set({ toast: t, toastAction: action })
    setTimeout(() => {
      if (toastVersion === version) set({ toast: undefined, toastAction: undefined })
    }, action ? 8000 : 2500)
  },
  async runToastAction() {
    const action = get().toastAction
    if (!action) return
    const version = toastVersion
    // Auch schnelles Doppeltippen führt dieselbe Rücknahme nur einmal aus.
    set({ toastAction: undefined })
    try {
      await action.run()
      if (version === toastVersion) get().showToast('Rückgängig gemacht.')
    } catch {
      if (version === toastVersion) get().showToast('Die Änderung konnte noch nicht zurückgenommen werden.', action)
    }
  },
}))

export function repository(): Repository {
  return repo
}

export function yesterday(): DateStr {
  return addDays(today(), -1)
}
