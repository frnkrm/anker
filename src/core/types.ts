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

/** Selbst gewählter Unterstützungsmodus. Ein Nutzerwunsch, kein aus Medikation berechneter Zustand. */
export type SupportMode = 'normal' | 'startschwierigkeit' | 'wenig-energie' | 'ueberlastet' | 'auf-kurs'
export type FocusPulseMode = 'off' | 'gentle' | 'strong'

export interface AlarmPreferences {
  enabled: boolean
  qrSecret: string
  /** Optionaler Vorwecker, Standard aus. Die Minuten sind deine Wahl, kein Arzneimittelmodell. */
  preWakeEnabled: boolean
  preWakeLeadMinutes: number
  /** Optionaler Wachheits-Check nach dem Beenden, Standard aus */
  wakeCheckEnabled: boolean
  wakeCheckDelayMinutes: number
  /** Rechenaufgaben auf dem anderen Weg zum Beenden */
  mathTasks: 3 | 5 | 8
  /** Freiwilliges privates Einnahmeprotokoll, Standard aus. Bleibt auf dem Gerät. */
  medicationEnabled: boolean
  /** Eigene Erinnerungszeit (Plan-Minuten), null = keine */
  medicationReminderAt: number | null
}

export interface Settings {
  version: number
  onboarded: boolean
  goal: MainGoal
  themeId: ThemeId
  appearance: { dark: boolean; fontScale: number }
  /** Index 0 = Montag */
  work: WorkDay[]
  commute: { minutes: number; mode: CommuteMode; bufferMin: number }
  sleep: { needMin: number; fallAsleepMin: number; screenOffMin: number }
  anchor: {
    wake: number
    wakeToleranceMin: number
    weekendToleranceMin: number
    /** Von Hand gesetzte Zeiten werden beim automatischen Neurechnen nicht überschrieben */
    manual?: { wake?: boolean; pcStop?: boolean; bed?: boolean }
  }
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
  alarm: AlarmPreferences
  focus: { pulse: FocusPulseMode; everyMin: 2 | 5; halfway: boolean; lastMinute: boolean }
  support: {
    /** Spiel, XP und Level anzeigen */
    gameVisible: boolean
    /** Abends einen Modus vorschlagen (nur Vorschlag, nie automatisch) */
    eveningPreset: { enabled: boolean; from: number; mode: SupportMode }
    /** Freiwillige Ankommen-Schritte nach der Arbeit */
    arrival: { enabled: boolean; steps: string[] }
  }
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
  /** Unterstützungsmodus für diesen Tag */
  mode?: SupportMode
  /** „Tag neu sortieren“: Rest des Tages in kleinen Versionen */
  light?: boolean
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
  /** Erledigte Ankommen-Schritte (Index) */
  arrival?: number[]
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
  doneAt?: number
  /** Bei welchem Schritt der Gedanke kam */
  captureContext?: string
  /** Flexible Schätzung in Minuten, Standard 5 */
  estimateMin?: number
}

/** Berufliche Aufgabe. Bleibt lokal auf dem Gerät und wird nicht synchronisiert. */
export interface WorkTask {
  id: string
  title: string
  nextStep?: string
  estimateMin?: number
  /** Feste Deadline (UTC ms), optional */
  deadline?: number
  done?: boolean
  doneAt?: number
  createdAt: number
}

/** „Hier mache ich weiter“. */
export interface ResumePoint {
  kind: 'work' | 'task' | 'step' | 'free'
  title: string
  nextStep?: string
  refId?: string
  at: number
}

export type MedsStatus = 'taken' | 'not-taken' | 'unsure'

/** Nur auf diesem Gerät (Sammlung meta, vom Sync ausgenommen): Arbeit, Einnahmeprotokoll, Wiedereinstieg. */
export interface LocalData {
  work: WorkTask[]
  resume?: ResumePoint
  handover: Record<DateStr, { open: string; next: string }>
  /** Nie aus einem Wecker-Ereignis abgeleitet, immer eine bewusste Eingabe */
  meds: Record<DateStr, { status: MedsStatus; at: number }>
  trial?: { startedAt: DateStr; days: 7 | 14; answers: Record<DateStr, 'ja' | 'teilweise' | 'nein' | 'uebersprungen'> }
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
