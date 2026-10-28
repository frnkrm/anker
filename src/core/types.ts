import type { DateStr } from './time'

export type StepTag = 'movement' | 'tidy' | 'face' | 'teeth' | 'prep' | 'inbox' | 'gymbag' | 'breakfast'

export interface RoutineStep {
  id: string
  title: string
  minutes: number
  /** Kleinstmögliche Version, zählt ebenfalls als erfüllt. */
  minimal?: { title: string; minutes: number }
  tag?: StepTag
}

export type RoutineId = 'morning' | 'evening'

export interface WorkDay {
  isWorkDay: boolean
  start: number // Minuten ab Mitternacht
  durationMin: number
  pauseMin: number
  homeOffice: boolean
}

export type CommuteMode = 'auto' | 'oepnv' | 'rad' | 'fuss'
export type EveningPlan = 'free' | 'friends' | 'sport' | 'cook' | 'appointment'
export type DayType = 'work' | 'weekend' | 'vacation' | 'sick'
export type SportKind = 'gym' | 'home' | 'run'
export type ReminderIntensity = 'gentle' | 'normal' | 'persistent'
export type MainGoal = 'on-time-rested' | 'more-energy' | 'routine'
export type ThemeId = 'seefahrt' | 'piraten' | 'weltraum' | 'kampfkunst' | 'schlicht'

export interface Reward {
  id: string
  title: string
  price: number
}

export interface Meal {
  id: string
  title: string
  minutes: number
}

export interface Settings {
  version: 1
  onboarded: boolean
  goal: MainGoal
  themeId: ThemeId
  appearance: { dark: boolean; fontScale: number }
  /** Index 0 = Montag */
  work: WorkDay[]
  commute: { minutes: number; mode: CommuteMode; bufferMin: number }
  sleep: { needMin: number; fallAsleepMin: number; screenOffMin: number }
  anchor: { wake: number; wakeToleranceMin: number; weekendToleranceMin: number }
  pcStop: number
  bed: number
  /** Bonus „früh im Bett“, wenn bis zu dieser Zeit im Bett. */
  bedBonusLatest: number
  sport: {
    days: boolean[]
    kind: SportKind
    time: 'morning' | 'afterWork'
    durationMin: number
    gymWayMin: number
  }
  evenings: EveningPlan[]
  eveningDurations: Record<EveningPlan, number>
  routines: Record<RoutineId, RoutineStep[]>
  reminders: { intensity: ReminderIntensity; repeatAfterMin: number; quietStart: number; quietEnd: number }
  rewards: Reward[]
  meals: Meal[]
  prepDay: number
  tidyZones: string[]
  eveningPrep: string[]
  game: { stage: 1 | 2 | 3; startDate: DateStr }
  integrations: { healthConnect: boolean; googleCalendar: boolean; writeCalendar: boolean; sync: boolean }
  alarm: { enabled: boolean; qrSecret: string }
  /** Vorschläge aus dem Wochenrückblick */
  suggestions: { id: string; text: string; createdAt: DateStr }[]
}

export type StepResult = 'done' | 'minimal' | 'skipped'

export interface DayOverride {
  dayType?: DayType
  evening?: EveningPlan
  /** „Ich mache heute länger“: neue Feierabendzeit */
  workEnd?: number
  homeOffice?: boolean
  /** Verlängerung PC-Stopp in Minuten (max. 15) */
  pcStopExtendMin?: number
}

export interface DayLog {
  date: DateStr
  override: DayOverride
  /** Schlüssel `${routine}:${stepId}` */
  steps: Record<string, StepResult>
  wakeAt?: number
  snoozeCount?: number
  leftAt?: number
  eveningRoutineDoneAt?: number
  pcOffAt?: number
  bedAt?: number
  sport?: 'manual' | 'health'
  prepCooked?: boolean
  tidyDone?: boolean
  prepChecklist?: string[]
  /** Erinnerungs-Schlüssel, die für heute mit „Heute nicht“ abgelehnt wurden */
  dismissed?: string[]
  /** Bereits vergebene XP-Gründe, damit nichts doppelt zählt */
  awarded?: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  start: number // UTC ms
  end: number
  allDay?: boolean
}

export type BlockKind =
  | 'wake'
  | 'morning'
  | 'sport'
  | 'commute'
  | 'work'
  | 'evening-plan'
  | 'evening-routine'
  | 'free'
  | 'pc-stop'
  | 'bed'
  | 'event'
  | 'rest'
  | 'day'

export interface PlannedStep extends RoutineStep {
  useMinimal: boolean
}

export interface Block {
  id: string
  kind: BlockKind
  title: string
  start: number // Minuten ab Mitternacht des Plantages
  end: number
  hard?: boolean
  routine?: RoutineId
  steps?: PlannedStep[]
  minimal?: boolean
}

export interface HardTime {
  key: 'wake' | 'leave' | 'pc-stop' | 'bed'
  label: string
  at: number
}

export interface DayPlan {
  date: DateStr
  dayType: DayType
  homeOffice: boolean
  blocks: Block[]
  hardTimes: HardTime[]
  /** Freundliche Hinweise, z. B. „Morgenroutine passt heute nur in Minimal-Version“ */
  notes: string[]
  workEnd?: number
  pcStop: number
  bed: number
  wake: number
  leave?: number
}

export interface InboxItem {
  id: string
  text: string
  createdAt: number
  status: 'open' | 'kept' | 'task'
  /** Bei status 'task': für welchen Tag eingeplant */
  taskDate?: DateStr
  done?: boolean
}

export interface WeeklyReview {
  id: string // Datum des Sonntags
  good: string
  hard: string
  change: string
}

export interface GameState {
  xp: number
  spent: number
  chapter: { index: number; startDate: DateStr; jokerUsed: boolean; attempt: number }
  chaptersDone: { length: number; endDate: DateStr }[]
  badges: string[]
  achievements: Record<string, DateStr>
  redeemed: { rewardId: string; title: string; price: number; at: number }[]
  lastEvaluated?: DateStr
  pendingLevelUp?: number
  pendingChapter?: number
  stageOffer?: 2 | 3
}
