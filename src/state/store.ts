import { create } from 'zustand'
import type { AlarmPlanningStatus } from '../core/alarm'
import { defaultSettings, emptyLocal, migrateSettings, randomId } from '../core/defaults'
import { eveningLocalFields } from '../core/evening'
import { restoreCommitments, routineCoverage, validPlanUndo } from '../core/flexible'
import { deviceTestsFromLocal, validDeviceTests } from '../core/deviceTests'
import { createCountdown, isFocusSession, pauseCountdown, remainingMs, resumeCountdown, sameFocusTarget, validFocusTarget, validStuck, type FocusSession, type FocusTarget, type StuckSession } from '../core/focus'
import { normaliseTask, recoveryFields, usableResume, validCaptureDraft } from '../core/recovery'
import { nextTaskOccurrence, resolveTask, taskIsOpen, taskLearningKey, taskNextStep, taskTitle, validTaskFields, validTaskParts, validTaskRef } from '../core/tasks'
import { applyAwards, advanceGame, dayGoals, dayStatus, initialGame, levelFor, theme, type DayStatus } from '../core/game'
import { activePlanDate, routineCompleted, stepKey } from '../core/now'
import { buildDayPlan } from '../core/planner'
import { currentReminderAction, validReminderAction, withReminderReceipt, type ReminderAction, type ReminderApplyResult } from '../core/reminders/actions'
import { validateSleepEntry } from '../core/sleepDiary'
import { addDays, minutesOnPlanDay, todayBerlin, zonedToUtc, type DateStr } from '../core/time'
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
import { getRepository, type Rec, type Repository } from '../data'
import type { RepositoryWrite } from '../data/types'

export type AlarmStatus = AlarmPlanningStatus

export interface Celebration {
  kind: 'level' | 'chapter' | 'achievement' | 'xp' | 'restart' | 'stage'
  title: string
  text?: string
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
  /** Was Android zuletzt zur Weckerplanung gemeldet hat. Nicht gespeichert. */
  alarmStatus?: AlarmStatus
  /** Stand vor der letzten Korrektur an Arbeitszeiten, für „Rückgängig“. Nicht gespeichert. */
  workUndo?: { before: WorkSession[]; revision: string }

  load(): Promise<void>
  saveSettings(fn: (s: Settings) => Settings): Promise<void>
  updateDay(date: DateStr, fn: (log: DayLog) => DayLog): Promise<void>
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
  updateTask(ref: TaskRef, patch: Partial<TaskFields> & { text?: string; title?: string; taskDate?: DateStr }): Promise<void>
  setTaskState(ref: TaskRef, state: TaskState): Promise<void>
  completeTask(ref: TaskRef, done: boolean, minimal?: boolean, confirmedMinutes?: number): Promise<void>
  removeTask(ref: TaskRef): Promise<void>
  startTaskFocus(ref: TaskRef, minutes?: number): Promise<void>
  pauseTaskFocus(ref: TaskRef, nextStep?: string, note?: string): Promise<void>
  setTaskPartDone(ref: TaskRef, partId: string, done: boolean): Promise<void>
  replaceTaskParts(ref: TaskRef, parts: TaskPart[]): Promise<void>
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
  saveLocal(fn: (l: LocalData) => LocalData): Promise<void>
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
  /** Arbeit starten. Läuft schon etwas, bleibt es dabei. */
  workStart(i?: { kind?: WorkSessionKind; label?: string; commitmentId?: string; at?: number }): Promise<void>
  /** Beendet, was läuft. Mehrfaches Tippen ändert nichts. */
  workStop(at?: number): Promise<void>
  workBreakStart(at?: number): Promise<void>
  workBreakEnd(at?: number): Promise<void>
  /** Nachtragen oder korrigieren, mit Rückgängig */
  editWork(fn: (list: WorkSession[]) => WorkSession[]): Promise<void>
  undoWork(): Promise<void>
  importRecords(recs: Rec[]): Promise<number>
  mergeRecords(recs: Rec[], dirty?: boolean): Promise<number>
  celebrate(c: Celebration): void
  popCelebration(): void
  showToast(t: string): void
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

/** Registriert einen Callback für Plan-Änderungen (Erinnerungen, Widget, PC-Stopp, Sync). */
export function onPlanChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function changed() {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => listeners.forEach((fn) => fn()), 400)
}

interface TaskData { local: LocalData; inbox: InboxItem[] }
const sameRef = (a: TaskRef | undefined, b: TaskRef): boolean => a?.kind === b.kind && a.id === b.id
function focusedOn(local: LocalData, ref: TaskRef): boolean {
  const target = local.focus?.target
  return !!target && target.kind !== 'routine' && sameRef(target, ref)
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
    await repo.put('meta', 'local', local)
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
      const target = resolveTask(data.local.focus.target, data.inbox, data.local.work)
      if (!target || !taskIsOpen(target)) data.local.focus = undefined
    }
    data.local.focusHistory = data.local.focusHistory?.filter((focus) => {
      if (focus.target.kind === 'routine') return focus.target.date === today() && !before.days[focus.target.date]?.steps[stepKey(focus.target.routine, focus.target.stepId)]
      const task = resolveTask(focus.target, data.inbox, data.local.work)
      return !!task && taskIsOpen(task)
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
    if (JSON.stringify(data.local) !== JSON.stringify(before.local)) records.push({ collection: 'meta', id: 'local', data: data.local })
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

function editTask(ref: TaskRef, edit: (task: InboxItem | WorkTask, data: TaskData) => void): Promise<void> {
  if (!validTaskRef(ref)) return Promise.reject(new Error('Die Aufgabenreferenz ist ungültig.'))
  return editTaskData((data) => {
    const task = resolveTask(ref, data.inbox, data.local.work)
    if (!task) return
    edit(task, data)
    if (!validTaskFields(task)) throw new Error('Die Aufgabenangaben sind ungültig. Deine bisherigen Daten bleiben erhalten.')
  })
}

/** Planänderung und private Rücknahmebasis werden gemeinsam gespeichert, ohne echte Handlungen zu erfinden. */
function editDayPlan(date: DateStr, label: string, edit: (log: DayLog, local: LocalData) => DayLog): Promise<void> {
  return atomic(async () => {
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
    const records: RepositoryWrite[] = [{ collection: 'days', id: date, data: award.log }, { collection: 'meta', id: 'local', data: local }]
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

/** Gemeinsame Projektion nach Load, Import und Sync; innerhalb einer Schreibbarriere ohne erneutes Warten lesbar. */
async function readAppData() {
  const t = today()
  const settings = (await repo.get<Settings>('settings', 'main')) ?? defaultSettings(t)
  const game = (await repo.get<GameState>('game', 'main')) ?? initialGame(t)
  const days: Record<string, DayLog> = {}
  for (const d of await repo.list<DayLog>('days')) days[d.date] = d
  const inbox = (await repo.list<InboxItem>('inbox')).map(normaliseTask)
  const reviews = await repo.list<WeeklyReview>('reviews')
  const events = (await repo.get<CalendarEvent[]>('meta', 'events')) ?? []
  const savedLocal = await repo.get<LocalData>('meta', 'local')
  const local = { ...emptyLocal(), ...savedLocal, ...eveningLocalFields(savedLocal), ...recoveryFields(savedLocal), deviceTests: deviceTestsFromLocal(savedLocal) }
  if (!validPlanUndo(local.planUndo)) local.planUndo = undefined
  local.work = local.work.map(normaliseTask)
  local.resume = usableResume(local.resume, inbox, local.work)
  const relevant = (focus: FocusSession): boolean => focus.target.kind === 'routine'
    ? focus.target.date === t && !days[t]?.steps[stepKey(focus.target.routine, focus.target.stepId)]
    : !!resolveTask(focus.target, inbox, local.work) && taskIsOpen(resolveTask(focus.target, inbox, local.work)!)
  if (local.focus && !relevant(local.focus)) local.focus = undefined
  local.focusHistory = local.focusHistory?.filter(relevant)
  return { settings: migrateSettings(settings, t), game, days, inbox, reviews, events, local }
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

  async load() {
    if (pendingAtomicAction) await waitForAtomicActions()
    repo = await getRepository()
    for (;;) {
      const before = get()
      await persistence
      const loaded = await readAppData()
      const current = get()
      // Read again after concurrent edits settle: keep optimistic changes visible while also
      // picking up newly synced records instead of hiding an entire changed collection.
      const conflicted = (Object.keys(loaded) as (keyof typeof loaded)[]).some((field) => current[field] !== before[field])
      if (conflicted) continue
      set({ ...loaded, ready: true })
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

  async updateDay(date, fn) {
    await atomic(async () => {
      const st = get()
      let log = fn(structuredClone(st.days[date] ?? emptyLog(date)))
      const plan = planFor(date, { ...st, days: { ...st.days, [date]: log } })
      if (!log.eveningRoutineDoneAt && routineCompleted(plan, log, 'evening')) log.eveningRoutineDoneAt = Date.now()
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
        await repo.putMany([{ collection: 'meta', id: 'local', data: local }])
        set({ local }); changed()
        return 'applied'
      }

      const log = structuredClone(st.days[action.date] ?? emptyLog(action.date))
      const field = ({ leave: 'leftAt', pcstop: 'pcOffAt', bed: 'bedAt', evening: 'eveningRoutineDoneAt' } as const)[action.key as 'leave' | 'pcstop' | 'bed' | 'evening']
      if (action.action === 'done' && field) {
        if (log[field] !== undefined) return 'obsolete'
        log[field] = action.at
      } else {
        if (log.dismissed?.includes(action.key)) return 'obsolete'
        log.dismissed = [...(log.dismissed ?? []), action.key]
      }
      log.reminderReceipts = withReminderReceipt(log.reminderReceipts, action.id)
      const award = applyAwards(planFor(action.date, st), log, st.game, st.settings)
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

  updateTask(ref, patch) {
    return editTask(ref, (task, data) => {
      const { text, title, taskDate, ...fields } = patch
      if (fields.subtasks) {
        // Eine neue Detailtiefe kann echte Teilabschlüsse niemals unbemerkt entfernen.
        const done = task.subtasks?.filter((part) => part.doneAt !== undefined) ?? []
        fields.subtasks = [...fields.subtasks.map((part) => {
          const previous = done.find((old) => old.id === part.id)
          return previous ? { ...part, doneAt: previous.doneAt } : part
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
    })
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

  startTaskFocus(ref, minutes = 25) {
    return editTask(ref, (task, data) => {
      if (!taskIsOpen(task)) return
      const focus = data.local.focus
      if (focus && !sameFocusTarget(focus.target, ref)) archiveFocus(data)
      task.state = 'active'; task.startedAt ??= Date.now()
      const previous = focus && sameFocusTarget(focus.target, ref) ? focus : archivedFocus(data, ref)
      if (previous && remainingMs(previous.timer, Date.now()) > 0) data.local.focus = { ...previous, timer: resumeCountdown(previous.timer, Date.now()) }
      else data.local.focus = { id: randomId(), target: ref, timer: createCountdown(minutes * 60, Date.now()) }
    })
  },

  pauseTaskFocus(ref, nextStep, note) {
    return editTask(ref, (task, data) => {
      if (!taskIsOpen(task)) return
      if (nextStep !== undefined) task.nextStep = nextStep
      const saved = data.local.resume
      if (note !== undefined) task.resumeNote = note.trim() || undefined
      else if (task.resumeNote === undefined && saved?.kind === ref.kind && saved.refId === ref.id) task.resumeNote = saved.note
      task.state = 'paused'
      if (focusedOn(data.local, ref) && data.local.focus) data.local.focus.timer = pauseCountdown(data.local.focus.timer, Date.now())
      data.local.resume = { kind: ref.kind, title: taskTitle(task), nextStep: taskNextStep(task, taskTitle(task)), refId: ref.id, at: Date.now(), route: `/aufgabe/${ref.kind}/${encodeURIComponent(ref.id)}`, ...(task.resumeNote ? { note: task.resumeNote } : {}) }
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

  replaceTaskParts(ref, parts) {
    if (!validTaskParts(parts)) return Promise.reject(new Error('Die Teilschritte sind ungültig.'))
    return get().updateTask(ref, { subtasks: parts })
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
      if (focusedOn(data.local, { kind: 'task', id }) && data.local.focus) data.local.focus.target = { kind: 'work', id }
      for (const focus of data.local.focusHistory ?? []) if (focus.target.kind === 'task' && focus.target.id === id) focus.target = { kind: 'work', id }
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
      }
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
      await repo.put('meta', 'local', local)
      set({ local })
    })
    changed()
  },

  async saveDeviceTests(fn) {
    await atomic(async () => {
      const local = { ...get().local, deviceTests: fn(structuredClone(deviceTestsFromLocal(get().local))) }
      if (!validDeviceTests(local.deviceTests)) throw new Error('Die Testangaben sind ungültig.')
      await repo.put('meta', 'local', local)
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
      const records: RepositoryWrite[] = [{ collection: 'days', id: date, data: award.log }, { collection: 'meta', id: 'local', data: local }]
      if (award.gained) records.push({ collection: 'game', id: 'main', data: award.game })
      await repo.putMany(records)
      set({ days: { ...st.days, [date]: award.log }, local, game: award.game })
      changed()
    })
  },

  async saveCommitment(c) {
    if (pendingAtomicAction) await waitForAtomicActions()
    await get().saveLocal((local) => ({ ...local, commitments: [...local.commitments.filter((commitment) => commitment.id !== c.id), c] }))
  },

  adjustCommitment(c, label, reason) {
    return editDayPlan(c.date, label, (log, local) => {
      local.commitments = [...local.commitments.filter((commitment) => commitment.id !== c.id), structuredClone(c)]
      return reason ? { ...log, override: { ...log.override, reason } } : log
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
      await repo.put('meta', 'local', local)
      set({ local, workUndo: undefined })
      changed()
    })
  },

  setAlarmStatus(a) {
    set({ alarmStatus: a })
  },

  async importRecords(recs) {
    const n = await get().mergeRecords(recs, true)
    if (n) await get().load()
    return n
  },

  mergeRecords(recs, dirty = false) {
    return atomic(async () => {
      const count = await repo.merge(recs, { dirty })
      // Bevor die nächste lokale Detailänderung beginnt, muss sie die übernommenen Daten sehen.
      if (count) {
        set(await readAppData())
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
  showToast(t) {
    set({ toast: t })
    setTimeout(() => {
      if (get().toast === t) set({ toast: undefined })
    }, 2500)
  },
}))

export function repository(): Repository {
  return repo
}

export function yesterday(): DateStr {
  return addDays(today(), -1)
}
