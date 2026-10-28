import { create } from 'zustand'
import { defaultSettings, randomId } from '../core/defaults'
import { applyAwards, advanceGame, dayGoals, dayStatus, initialGame, levelFor, theme, type DayStatus } from '../core/game'
import { activePlanDate, routineDone, stepKey } from '../core/now'
import { buildDayPlan } from '../core/planner'
import { addDays, minutesOnPlanDay, todayBerlin, type DateStr } from '../core/time'
import type {
  CalendarEvent,
  DayLog,
  DayOverride,
  DayPlan,
  GameState,
  InboxItem,
  RoutineId,
  Settings,
  StepResult,
  WeeklyReview,
} from '../core/types'
import { getRepository, type Rec, type Repository } from '../data'

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
  celebrations: Celebration[]
  toast?: string

  load(): Promise<void>
  saveSettings(fn: (s: Settings) => Settings): Promise<void>
  updateDay(date: DateStr, fn: (log: DayLog) => DayLog): Promise<void>
  setStep(date: DateStr, r: RoutineId, stepId: string, result: StepResult | undefined): Promise<void>
  mark(date: DateStr, field: 'wakeAt' | 'leftAt' | 'pcOffAt' | 'bedAt' | 'eveningRoutineDoneAt', at?: number): Promise<void>
  setOverride(date: DateStr, patch: Partial<DayOverride>): Promise<void>
  addInbox(text: string): Promise<void>
  updateInbox(id: string, patch: Partial<InboxItem>): Promise<void>
  removeInbox(id: string): Promise<void>
  saveReview(r: WeeklyReview): Promise<void>
  redeem(rewardId: string): Promise<boolean>
  setGame(fn: (g: GameState) => GameState): Promise<void>
  evaluateProgress(): Promise<void>
  setEvents(e: CalendarEvent[]): Promise<void>
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

export function planFor(date: DateStr, st: Pick<AppState, 'settings' | 'days' | 'events'> = useApp.getState()): DayPlan {
  const override = st.days[date]?.override
  const key = [st.settings, override, st.events]
  const hit = planCache.get(date)
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.plan
  const plan = buildDayPlan({ date, settings: st.settings, override, events: eventsFor(date, st.events) })
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
    set({ settings: migrateSettings(settings, t), game, days, inbox, reviews, events, ready: true })
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
    if (!log.eveningRoutineDoneAt && routineDone(plan, log, 'evening')) log.eveningRoutineDoneAt = Date.now()
    const a = applyAwards(plan, log, st.game, st.settings)
    log = a.log
    set({ days: { ...st.days, [date]: log }, game: a.game })
    await repo.put('days', date, log)
    if (a.gained) {
      await repo.put('game', 'main', a.game)
      get().celebrate({ kind: 'xp', title: `+${a.gained} ${theme(st.settings.themeId).xpWord}` })
      const t = theme(st.settings.themeId)
      const lb = levelFor(st.game.xp, t)
      const la = levelFor(a.game.xp, t)
      if (la.level > lb.level) get().celebrate({ kind: 'level', title: `Level ${la.level}`, text: t.levelUp(la.name) })
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

  async addInbox(text) {
    const item: InboxItem = { id: randomId(), text: text.trim(), createdAt: Date.now(), status: 'open' }
    if (!item.text) return
    set({ inbox: [...get().inbox, item] })
    await repo.put('inbox', item.id, item)
  },

  async updateInbox(id, patch) {
    const inbox = get().inbox.map((x) => (x.id === id ? { ...x, ...patch } : x))
    set({ inbox })
    const item = inbox.find((x) => x.id === id)
    if (item) await repo.put('inbox', id, item)
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

/** Ergänzt Felder, die in älteren gespeicherten Einstellungen fehlen. */
function migrateSettings(s: Settings, t: DateStr): Settings {
  const d = defaultSettings(t)
  return { ...d, ...s, sport: { ...d.sport, ...s.sport }, reminders: { ...d.reminders, ...s.reminders }, integrations: { ...d.integrations, ...s.integrations }, game: { ...d.game, ...s.game }, alarm: { ...d.alarm, ...s.alarm }, appearance: { ...d.appearance, ...s.appearance } }
}

export function repository(): Repository {
  return repo
}

export function yesterday(): DateStr {
  return addDays(today(), -1)
}
