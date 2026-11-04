import { create } from 'zustand'
import { defaultSettings, emptyLocal, migrateSettings, randomId } from '../core/defaults'
import { applyAwards, advanceGame, dayGoals, dayStatus, initialGame, levelFor, theme, type DayStatus } from '../core/game'
import { activePlanDate, routineCompleted, stepKey } from '../core/now'
import { buildDayPlan } from '../core/planner'
import { addDays, minutesOnPlanDay, todayBerlin, type DateStr } from '../core/time'
import type {
  CalendarEvent,
  Commitment,
  DayLog,
  DayOverride,
  DayPlan,
  GameState,
  InboxItem,
  LocalData,
  MedsStatus,
  ResumePoint,
  RoutineId,
  Settings,
  StepResult,
  WeeklyReview,
  WorkSession,
  WorkSessionKind,
} from '../core/types'
import { endBreak, startBreak, startSession, stopSession } from '../core/worktime'
import { getRepository, type Rec, type Repository } from '../data'

export interface AlarmStatus {
  ok: boolean
  /** Alltagssprache, falls etwas nicht stimmt */
  message?: string
  scheduledAt?: number
}

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
  workUndo?: WorkSession[]

  load(): Promise<void>
  saveSettings(fn: (s: Settings) => Settings): Promise<void>
  updateDay(date: DateStr, fn: (log: DayLog) => DayLog): Promise<void>
  setStep(date: DateStr, r: RoutineId, stepId: string, result: StepResult | undefined): Promise<void>
  mark(date: DateStr, field: 'wakeAt' | 'leftAt' | 'pcOffAt' | 'bedAt' | 'eveningRoutineDoneAt', at?: number): Promise<void>
  setOverride(date: DateStr, patch: Partial<DayOverride>): Promise<void>
  addInbox(text: string, context?: string): Promise<string | undefined>
  updateInbox(id: string, patch: Partial<InboxItem>): Promise<void>
  removeInbox(id: string): Promise<void>
  saveReview(r: WeeklyReview): Promise<void>
  redeem(rewardId: string): Promise<boolean>
  setGame(fn: (g: GameState) => GameState): Promise<void>
  evaluateProgress(): Promise<void>
  setEvents(e: CalendarEvent[]): Promise<void>
  saveLocal(fn: (l: LocalData) => LocalData): Promise<void>
  setResume(r: ResumePoint | undefined): Promise<void>
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
  celebrate(c: Celebration): void
  popCelebration(): void
  showToast(t: string): void
}

let repo: Repository
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

export function today(): DateStr {
  return activePlanDate(Date.now(), todayBerlin)
}

export function emptyLog(date: DateStr): DayLog {
  return { date, override: {}, steps: {} }
}

const planCache = new Map<string, { key: unknown[]; plan: DayPlan }>()

/** Vom Vortag versorgte Schritte, nur über ausdrücklich gesetzte Regeln. */
function coveredBy(date: DateStr, st: Pick<AppState, 'settings' | 'days'>): string {
  const prev = st.days[addDays(date, -1)]
  return st.settings.routineLinks
    .filter((l) => ['done', 'minimal'].includes(prev?.steps[`evening:${l.eveningStepId}`] ?? ''))
    .map((l) => `morning:${l.morningStepId}`)
    .join(',')
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
    repo = await getRepository()
    const t = today()
    const settings = (await repo.get<Settings>('settings', 'main')) ?? defaultSettings(t)
    const game = (await repo.get<GameState>('game', 'main')) ?? initialGame(t)
    const days: Record<string, DayLog> = {}
    for (const d of await repo.list<DayLog>('days')) days[d.date] = d
    const inbox = await repo.list<InboxItem>('inbox')
    const reviews = await repo.list<WeeklyReview>('reviews')
    const events = (await repo.get<CalendarEvent[]>('meta', 'events')) ?? []
    const local = { ...emptyLocal(), ...(await repo.get<LocalData>('meta', 'local')) }
    set({ settings: migrateSettings(settings, t), game, days, inbox, reviews, events, local, ready: true })
    if (settings.onboarded) await get().evaluateProgress()
    changed()
  },

  async saveSettings(fn) {
    const settings = fn(get().settings)
    set({ settings })
    await repo.put('settings', 'main', settings)
    changed()
  },

  async updateDay(date, fn) {
    const st = get()
    let log = fn(structuredClone(st.days[date] ?? emptyLog(date)))
    const plan = planFor(date, { ...st, days: { ...st.days, [date]: log } })
    // Abendroutine komplett → Zeitpunkt merken
    if (!log.eveningRoutineDoneAt && routineCompleted(plan, log, 'evening')) log.eveningRoutineDoneAt = Date.now()
    const a = applyAwards(plan, log, st.game, st.settings)
    log = a.log
    set({ days: { ...st.days, [date]: log }, game: a.game })
    await repo.put('days', date, log)
    if (a.gained) {
      await repo.put('game', 'main', a.game)
      // XP zählen weiter, aber bei Überlastung oder abgeschaltetem Spiel erscheint nichts davon
      if (st.settings.support.gameVisible && log.override.mode !== 'ueberlastet') {
        get().celebrate({ kind: 'xp', title: `+${a.gained} ${theme(st.settings.themeId).xpWord}` })
        const t = theme(st.settings.themeId)
        const lb = levelFor(st.game.xp, t)
        const la = levelFor(a.game.xp, t)
        if (la.level > lb.level) get().celebrate({ kind: 'level', title: `Level ${la.level}`, text: t.levelUp(la.name) })
      }
    }
    changed()
  },

  async setStep(date, r, stepId, result) {
    await get().updateDay(date, (log) => {
      const k = stepKey(r, stepId)
      if (result) log.steps[k] = result
      else delete log.steps[k]
      return log
    })
  },

  async mark(date, field, at = Date.now()) {
    await get().updateDay(date, (log) => ({ ...log, [field]: at }))
  },

  async setOverride(date, patch) {
    await get().updateDay(date, (log) => ({ ...log, override: { ...log.override, ...patch } }))
  },

  async addInbox(text, context) {
    const item: InboxItem = { id: randomId(), text: text.trim(), createdAt: Date.now(), status: 'open', ...(context ? { captureContext: context } : {}) }
    if (!item.text) return undefined
    set({ inbox: [...get().inbox, item] })
    await repo.put('inbox', item.id, item)
    return item.id
  },

  async updateInbox(id, patch) {
    const inbox = get().inbox.map((x) => (x.id === id ? { ...x, ...patch } : x))
    set({ inbox })
    const item = inbox.find((x) => x.id === id)
    if (item) await repo.put('inbox', id, item)
    // Eingeplante Aufgaben gehören zum Tagesplan
    changed()
  },

  async setInboxDone(id, done) {
    await get().updateInbox(id, { done, doneAt: done ? Date.now() : undefined })
    changed()
  },

  async removeInbox(id) {
    set({ inbox: get().inbox.filter((x) => x.id !== id) })
    await repo.remove('inbox', id)
  },

  async saveReview(r) {
    const first = get().reviews.length === 0
    const before = get().reviews.find((x) => x.id === r.id)
    set({ reviews: [...get().reviews.filter((x) => x.id !== r.id), r] })
    await repo.put('reviews', r.id, r)
    if (r.change.trim() && r.change.trim() !== before?.change.trim()) {
      await get().saveSettings((s) => ({
        ...s,
        suggestions: [...s.suggestions, { id: randomId(), text: r.change.trim(), createdAt: r.id }],
      }))
    }
    if (first) await get().evaluateProgress()
  },

  async redeem(rewardId) {
    const st = get()
    const reward = st.settings.rewards.find((x) => x.id === rewardId)
    if (!reward || st.game.xp - st.game.spent < reward.price) return false
    await get().setGame((g) => ({
      ...g,
      spent: g.spent + reward.price,
      redeemed: [...g.redeemed, { rewardId, title: reward.title, price: reward.price, at: Date.now() }],
    }))
    get().celebrate({ kind: 'achievement', title: 'Gönn dir!', text: reward.title })
    await get().evaluateProgress()
    return true
  },

  async setGame(fn) {
    const game = fn(get().game)
    set({ game })
    await repo.put('game', 'main', game)
  },

  async evaluateProgress() {
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
    await get().setGame(() => game)
    for (const e of events) {
      if (e.type === 'chapter-completed') get().celebrate({ kind: 'chapter', title: `${th.chapterWord} geschafft!`, text: e.text })
      if (e.type === 'achievement') get().celebrate({ kind: 'achievement', title: 'Erfolg freigeschaltet', text: e.text })
      if (e.type === 'level-up') get().celebrate({ kind: 'level', title: 'Level-Aufstieg', text: e.text })
      if (e.type === 'chapter-restarted') get().celebrate({ kind: 'restart', title: 'Neuer Anlauf', text: e.text })
      if (e.type === 'stage-offer') get().celebrate({ kind: 'stage', title: 'Nächste Stufe?', text: e.text })
    }
  },

  async setEvents(events) {
    set({ events })
    await repo.put('meta', 'events', events)
    changed()
  },

  async saveLocal(fn) {
    const local = fn(get().local)
    set({ local })
    await repo.put('meta', 'local', local)
    changed()
  },

  async setResume(r) {
    await get().saveLocal((l) => {
      const next = { ...l }
      if (r) next.resume = r
      else delete next.resume
      return next
    })
  },

  async setMeds(date, status) {
    await get().saveLocal((l) => {
      const meds = { ...l.meds }
      if (status) meds[date] = { status, at: Date.now() }
      else delete meds[date]
      return { ...l, meds }
    })
  },

  async adjustDay(date, label, fn) {
    await get().updateDay(date, (log) => {
      const before = log.before ?? { override: structuredClone(log.override), steps: structuredClone(log.steps) }
      const next = fn(log)
      return { ...next, before, override: { ...next.override, adjusted: true }, changes: [...(log.changes ?? []), label] }
    })
  },

  async restoreDay(date) {
    await get().updateDay(date, (log) => {
      if (!log.before) return log
      const real = Object.fromEntries(Object.entries(log.steps).filter(([, v]) => v === 'done' || v === 'minimal'))
      const restored: DayLog = { ...log, override: log.before.override, steps: { ...log.before.steps, ...real } }
      delete restored.before
      delete restored.changes
      return restored
    })
    await get().saveLocal((l) => ({ ...l, commitments: l.commitments.map((c) => (c.date === date && !c.arrivedAt && !l.workSessions.some((x) => x.commitmentId === c.id) ? { ...c, status: 'cancelled' as const } : c)) }))
  },

  async saveCommitment(c) {
    await get().saveLocal((l) => ({ ...l, commitments: [...l.commitments.filter((x) => x.id !== c.id), c] }))
  },

  async workStart(i = {}) {
    const at = i.at ?? Date.now()
    await get().saveLocal((l) => ({ ...l, workSessions: startSession(l.workSessions, { id: randomId(), date: today(), at, kind: i.kind, label: i.label, commitmentId: i.commitmentId }) }))
  },

  async workStop(at = Date.now()) {
    await get().saveLocal((l) => {
      const open = l.workSessions.find((x) => x.endAt === undefined)
      // Ein Einsatz ohne Weg ist mit dem Beenden abgeschlossen. Vor Ort folgt noch „Bin wieder da“.
      const commitments = open?.commitmentId ? l.commitments.map((c) => (c.id === open.commitmentId && c.routeMode === 'none' ? { ...c, backAt: at } : c)) : l.commitments
      return { ...l, commitments, workSessions: stopSession(l.workSessions, at) }
    })
  },

  async workBreakStart(at = Date.now()) {
    await get().saveLocal((l) => ({ ...l, workSessions: startBreak(l.workSessions, randomId(), at) }))
  },

  async workBreakEnd(at = Date.now()) {
    await get().saveLocal((l) => ({ ...l, workSessions: endBreak(l.workSessions, at) }))
  },

  async editWork(fn) {
    set({ workUndo: get().local.workSessions })
    await get().saveLocal((l) => ({ ...l, workSessions: fn(l.workSessions) }))
  },

  async undoWork() {
    const before = get().workUndo
    if (!before) return
    set({ workUndo: undefined })
    await get().saveLocal((l) => ({ ...l, workSessions: before }))
  },

  setAlarmStatus(a) {
    set({ alarmStatus: a })
  },

  async importRecords(recs) {
    const n = await repo.merge(recs)
    if (n) await get().load()
    return n
  },

  celebrate(c) {
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
