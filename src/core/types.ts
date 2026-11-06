import type { DateStr } from './time'
import type { FocusSession, StuckSession } from './focus'
import type { AssistancePreferences } from './assistance'
import type { ExtraLocal, ExtraSettings } from './extras'

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
  /** Nicht gesetzt: globale Grenze; null: für diesen Wochentag keine Grenze. */
  latestStart?: number | null
  /** Freiwilliger Feierabendwunsch, keine Ist-Zeit und keine Erledigungsbestätigung. */
  endPreference?: number
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
  /** Freiwilliges Aktivitäts-Weckfenster. Jede Nacht bewusst starten; keine Schlafphasenmessung. */
  smartWake: { enabled: boolean; windowMinutes: number }
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
  /** Gleitzeit. Wunsch-Beginn, Netto-Soll und Pause je Tag stehen in `work`. */
  flex: {
    /** Spätester normaler Arbeitsbeginn (Plan-Minuten), null = keine Grenze. Eine Grenze, kein Ziel. */
    latestStart: number | null
    /** Arbeit starten, Pause und Feierabend auf der Startseite anbieten. Erfassen bleibt freiwillig. */
    tracking: boolean
    /** Sachliche Hinweise zu Pausen, Ruhezeit und Sonntag */
    legalHints: boolean
    /** Entwurf zum Kopieren, Anker sendet nichts */
    lateMessage: string
  }
  /** Eigene Minuten für Wege und Übergänge */
  travel: { arrivalBufferMin: number; prepMin: number; homeOfficeStartupMin: number; activationMin: number }
  /** Ausdrücklich gesetzt: Ist der Abendschritt erledigt, ist der Morgenschritt am Folgetag nicht nötig */
  routineLinks: { eveningStepId: string; morningStepId: string }[]
  /** Nach dem Grund fragen, wenn etwas verschoben wird (nie Pflicht) */
  askReason: boolean
  homeOfficeMessage: string
  /** Legacy-Ortsfelder werden lokal nach weatherProfile übernommen. Nur Kleidungsvorlieben bleiben im Settings-Sync. */
  weather: { enabled: boolean; city: string; lat?: number; lng?: number; rules: { jacketBelowC: number; rainAbovePct: number } }
  focus: { pulse: FocusPulseMode; everyMin: 2 | 5; halfway: boolean; lastMinute: boolean }
  extras?: ExtraSettings
  support: {
    /** Berufliche Aufgaben und Wiedereinstiege nach Feierabend auf der Startseite ruhigstellen */
    workAfterHoursQuiet: boolean
    /** Spiel, XP und Level anzeigen */
    gameVisible: boolean
    /** Abends einen Modus vorschlagen (nur Vorschlag, nie automatisch) */
    eveningPreset: { enabled: boolean; from: number; mode: SupportMode }
    /** Freiwillige Ankommen-Schritte nach der Arbeit */
    arrival: { enabled: boolean; steps: string[] }
    /** Ein selbst gewählter ruhiger Übergang. Verändert weder Wecker noch Plan. */
    windDown: { enabled: boolean; at: number; activity: string }
  }
  /** Vorschläge aus dem Wochenrückblick */
  suggestions: { id: string; text: string; createdAt: DateStr }[]
}

/** done und minimal sind echte Handlungen. skipped und not-needed sind wertungsfrei und nie „erledigt“. */
export type StepResult = 'done' | 'minimal' | 'skipped' | 'not-needed'

export interface DayOverride {
  dayType?: DayType
  evening?: EveningPlan
  /** „Ich mache heute länger“: neue Feierabendzeit */
  workEnd?: number
  homeOffice?: boolean
  /** Nur dieser Tag: anderer Arbeitsbeginn, anderes Netto-Soll, andere Pause */
  workStart?: number
  targetNetMin?: number
  latestStart?: number | null
  pauseMin?: number
  /** Historische Verlängerung; neue freie Entscheidungen verwenden lateUntil. */
  pcStopExtendMin?: number
  /** Unterstützungsmodus für diesen Tag */
  mode?: SupportMode
  /** „Tag neu sortieren“: Rest des Tages in kleinen Versionen */
  light?: boolean
  /** Einmalige Weckzeit für diesen Tag, nach Bestätigung. Ändert nie den Standard. */
  wakeOverride?: number
  /** Länger wach: bis zu dieser Zeit (Plan-Minuten) oder offen */
  lateUntil?: number | 'open'
  /** Routine später: Uhrzeit oder „wenn ich zurück bin“ */
  routineAt?: Partial<Record<RoutineId, number | 'return'>>
  /** „Wieder zuhause“ gemeldet (UTC ms), ohne dass ein Termin dazugehört */
  backAt?: number
  /** Erst dann erneut nach Rückkehr fragen (Plan-Minuten); behauptet keine Rückkehr. */
  returnCheckAfter?: number
  /** Schritte, die an diesem Tag schon anderweitig versorgt sind, z. B. "morning:shower" */
  coveredSteps?: string[]
  /** Regel für diesen Tag übersteuern */
  uncoveredSteps?: string[]
  /** Der Tag lief bewusst anders: zählt nicht als verfehlt */
  adjusted?: boolean
  reason?: string
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
  /** Bounded opaque receipts, committed with the corresponding reminder action. */
  reminderReceipts?: string[]
  /** Bereits vergebene XP-Gründe, damit nichts doppelt zählt */
  awarded?: string[]
  /** Erledigte Ankommen-Schritte (Index) */
  arrival?: number[]
  /** Stand vor dem ersten „Heute anders“, für „Zurück zum ursprünglichen Plan“ */
  before?: { override: DayOverride; steps: Record<string, StepResult> }
  /** Kurze Liste, was heute geändert wurde */
  changes?: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  start: number // UTC ms
  end: number
  allDay?: boolean
}

export type BlockKind =
  | 'commitment'
  | 'session'
  | 'prep'
  | 'travel'
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

/** Was der Planer zur Arbeit dieses Tages weiß. Prognose bleibt Prognose. */
export interface WorkInfo {
  plannedStart: number
  targetNetMin: number
  plannedBreakMin: number
  /** Rechnerische Prognose unabhängig vom freiwilligen Feierabendwunsch. */
  forecastEnd?: number
  forecastLowerBound?: boolean
  unconfirmed?: boolean
  endPreference?: number
  latestStart?: number
  latestLeave?: number
  /** Ein fester Termin gibt den Morgen vor */
  fixedMorning: boolean
  /** Es läuft oder lief heute eine reguläre oder andere Arbeit */
  started: boolean
  closed: boolean
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
  key: 'wake' | 'leave' | 'pc-stop' | 'bed' | 'commitment'
  label: string
  at: number
}

/** Abgeleitete harte Morgenpflicht aus derselben Tagesplanung; kein eigener persistierter Plan. */
export interface MorningAnchor {
  id: string
  label: string
  readyAt: number
  prepMin: number
  prepIncludesMorning?: boolean
  uncertain?: boolean
}

export interface DayPlan {
  morningAnchors?: MorningAnchor[]
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
  /** Wege und Termine des Tages */
  legs?: Leg[]
  /** Abendroutine wartet auf „Wieder zuhause“ */
  pendingEvening?: boolean
  /** Zeiträume ohne Haushalts-Erinnerungen (Freizeit, soziale Termine) */
  quiet?: [number, number][]
  /** Länger wach ohne festes Ende: keine erfundene Bettzeit */
  openEnd?: boolean
  /** Echte Konflikte, immer sichtbar */
  conflicts?: string[]
  /** Nur an Arbeitstagen */
  workInfo?: WorkInfo
}

export type TaskRef = { kind: 'task' | 'work'; id: string }
/** Erledigung bleibt kompatibel in done/doneAt; diese Zustände gelten für offene Handlungen. */
export type TaskState = 'pending' | 'active' | 'paused' | 'partial' | 'deferred' | 'not-needed' | 'cancelled'
export interface TaskPart {
  id: string
  title: string
  estimateMin?: number
  doneAt?: number
}
export interface TaskFields {
  /** Bewusste Änderungen machen ältere Benachrichtigungsaktionen ungültig. */
  reminderRevision?: string
  description?: string
  /** Eigener freiwilliger Grund, keine vorgegebene Motivation. */
  why?: string
  nextStep?: string
  /** Unterbrechungsnotiz gehört zur Aufgabe und bleibt beim bewussten Wechsel erhalten. */
  resumeNote?: string
  priority?: 'low' | 'normal' | 'high'
  deadline?: number
  earliestStart?: number
  estimateMin?: number
  context?: 'any' | 'home' | 'work' | 'errand'
  energy?: 'low' | 'medium' | 'high'
  state?: TaskState
  startedAt?: number
  deferredUntil?: number
  done?: boolean
  doneAt?: number
  doneMode?: 'full' | 'minimal'
  subtasks?: TaskPart[]
  recurrence?: { seriesId: string; everyDays: number; occurrenceDate: DateStr }
  source?: { kind: 'capture' | 'manual' | 'repeat'; id?: string }
}

export interface TaskDurationSample {
  id: string
  key: string
  label: string
  minutes: number
  at: number
  confirmed: true
}

export interface InboxItem extends TaskFields {
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
  /** Selbst gewählter Wiedervorlagezeitpunkt (UTC ms). Wird niemals von selbst zur Aufgabe. */
  reviewAt?: number
  /** Freiwillige Erinnerung zur Wiedervorlage, ohne Gedankeninhalt auf dem Sperrbildschirm. */
  reviewNotify?: boolean
  /** Verknüpfte Notiz; keine Kopie der verknüpften Aufgabe. */
  linkedTo?: TaskRef
}

/** Berufliche Aufgabe. Bleibt lokal auf dem Gerät und wird nicht synchronisiert. */
export interface WorkTask extends TaskFields {
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
  /** Konkreter Rückweg, statt den Merker beim Wiederfinden nur zu löschen. */
  route?: string
  note?: string
}

/** Privater nächster Schritt. Bleibt bis zur bewussten Erledigung oder Löschung auf diesem Gerät. */
export interface TomorrowStep {
  id: string
  title: string
  nextStep: string
  /** Selbst gewählter Zeitpunkt (UTC ms), ab dem der Schritt wieder sichtbar wird. */
  resumeAt: number
  createdAt: number
  doneAt?: number
  remind: boolean
}

/** Freiwillige Eingaben in UTC ms, keine automatisch erfassten Schlafdaten. */
export interface SleepDiaryEntry {
  sleepyAt?: number
  bedAt?: number
  wakeAt?: number
}

export type WorkSessionKind = 'regular' | 'maintenance' | 'incident' | 'onsite' | 'other'
/** Geplanter Einsatz. Rufbereitschaft ist ausdrücklich keine Arbeitszeit, bis ein Einsatz läuft. */
export type PlannedWorkKind = Exclude<WorkSessionKind, 'regular'> | 'oncall'

export interface WorkBreak {
  id: string
  startAt: number
  endAt?: number
  /** Nur eine freiwillige Schätzung; beendet die Pause nicht. */
  expectedEndAt?: number
}

/**
 * Wirklich gearbeitete Zeit in UTC-ms, nie geplant. Lokal, kein Sync, keine Arbeitgeber-Zeiterfassung.
 * Gehört ganz zu dem Plantag, an dem sie begann (Wechsel um 04:00), und wird nicht aufgeteilt.
 */
export interface WorkSession {
  id: string
  date: DateStr
  kind: WorkSessionKind
  startAt: number
  endAt?: number
  breaks: WorkBreak[]
  label?: string
  note?: string
  commitmentId?: string
  /** Nachgetragen oder korrigiert */
  manual?: boolean
}

export type CommitmentKind = 'hard' | 'soft' | 'optional'
export type EventContext = 'work' | 'customer' | 'social' | 'personal' | 'other'
export type RouteMode = 'driving' | 'transit' | 'cycling' | 'walking' | 'none'
export type LocationKind = 'unknown' | 'onsite' | 'remote' | 'home'
export type PlaceKind = 'home' | 'office' | 'customer' | 'private' | 'other'

/** Gespeicherter Ort. Bleibt auf dem Gerät. */
export interface Place {
  id: string
  label: string
  kind?: PlaceKind
  latitude?: number
  longitude?: number
  /** Nur ausdrücklich erlaubte Zwecke; Orte bleiben ansonsten ausschließlich lokal. */
  externalUse?: { weather?: boolean; routes?: boolean }
  address?: string
  travelFromHomeMin?: number
  /** Fahrzeit von anderen Orten, Schlüssel = Orts-ID oder "office" */
  travelFrom?: Record<string, number>
  items?: string[]
}

/** Ein konkreter Termin an einem Tag. Liegt nur auf dem Gerät und geht nie in Sync oder Kalender. */
export interface Commitment {
  id: string
  date: DateStr
  label: string
  context: EventContext
  commitment: CommitmentKind
  /** Plan-Minuten des Tages */
  start: number
  /** Ohne Angabe bleibt das Ende offen, es wird keine Rückkehr erfunden */
  end?: number
  locationKind?: LocationKind
  /** home, office, unknown oder ID eines gespeicherten Orts. */
  originPlaceId?: string
  placeId?: string
  placeLabel?: string
  address?: string
  routeMode?: RouteMode
  /** Von dir geschätzte Fahrzeit. Fehlt sie, bleibt sie offen. */
  travelMin?: number
  travelHomeMin?: number
  arrivalBufferMin?: number
  prepMin?: number
  /** Nur nach eigener Wahl: Vorbereitung ist bereits in der Morgenroutine enthalten. */
  prepIncludesMorning?: boolean
  items?: string[]
  /** Bewusst vorbereitete Packgegenstände; bleibt wie der Termin ausschließlich lokal. */
  preparedItems?: string[]
  source?: { provider: string; id: string }
  /** Ersetzt den Weg ins Büro an diesem Tag */
  replacesCommute?: boolean
  /** Ist ein geplanter Arbeitseinsatz. Ändert den Wochenstandard nicht. */
  workKind?: PlannedWorkKind
  thenTo?: 'home' | 'next'
  status?: 'planned' | 'cancelled'
  leftAt?: number
  arrivedAt?: number
  backAt?: number
}

/** Berechneter Weg zu einem Termin */
export interface Leg {
  commitment: Commitment
  fromLabel: string
  fromKey?: string
  toLabel?: string
  toKey?: string
  locationOpen?: boolean
  originOpen?: boolean
  returnOpen?: boolean
  travelMin?: number
  /** Ort bekannt, Fahrzeit nicht. Dann gibt es keine errechnete Abfahrt. */
  travelOpen: boolean
  leave?: number
  prepStart?: number
  items: string[]
  returnMin?: number
}

export interface WeatherCache {
  key: string
  fetchedAt: number
  /** Alte, ungeprüfte Parsercaches werden nicht als bestätigte Messwerte weiterverwendet. */
  validated?: true
  hours: { date: string; minutes: number; tempC: number; apparentC: number; rainPct: number; windKmh: number }[]
}

/** Gewählter Wetterort und Freigabe bleiben auf diesem Gerät, unabhängig vom Settings-Sync. */
export interface WeatherProfile {
  enabled: boolean
  city: string
  lat?: number
  lng?: number
  revision?: string
}

/** Wiederverwendbare persönliche Packvorlage, nicht Teil des allgemeinen Settings-Sync. */
export interface PackTemplate {
  id: string
  label: string
  context: 'customer' | 'sport' | 'going-out'
  items: string[]
}

export type MedsStatus = 'taken' | 'not-taken' | 'unsure'

export type DeviceTestResult = 'passed' | 'partial' | 'failed' | 'not-applicable'
/** A conscious user's observation, never a result inferred from a successful API call. */
export interface DeviceTestReport {
  result: DeviceTestResult
  note: string
  at: number
  platform: 'android' | 'web'
  device: string
  os: string
  appVersion: string
  build: string
  suiteVersion: string
  /** Unreleased builds can share version numbers; preserve older reports without treating them as current. */
  buildFingerprint?: string
}

export interface DeviceTestProgress {
  reports: Record<string, DeviceTestReport>
  drafts?: Record<string, { note: string; device: string; os: string }>
  activeId?: number
  device?: string
  os?: string
  /** Read-only comparison around the isolated test alarm, no restoration of alarm settings. */
  alarmBefore?: { at: number; mainAt: number; preWakeAt: number; snoozed: number }
}

/** Nur auf diesem Gerät (Sammlung meta, vom Sync ausgenommen): Arbeit, private Schritte und Protokolle. */
export interface LocalData {
  /** Bewusste Kontaktwahl je Homeoffice-Tag, kein Versand- oder Arbeitserfassungsnachweis. */
  homeOfficeContact?: Record<DateStr, { status: 'done' | 'not-needed' | 'later'; at: number; remindAt?: number }>
  /** Optionale Vorschlagsdienste: Zweckfreigaben und technische Abrufgrenzen ausschließlich lokal. */
  assistance?: AssistancePreferences
  /** Private Rücknahmebasis für bewusste Tagesänderungen, niemals Teil des synchronisierten DayLog. */
  planUndo?: Record<DateStr, { at: number; commitments: Commitment[] }>
  /** Receipts for reminder actions affecting local commitments. No private notification text. */
  reminderReceipts?: string[]
  deviceTests?: DeviceTestProgress
  commitments: Commitment[]
  places: Place[]
  weather?: WeatherCache
  weatherProfile?: WeatherProfile
  packTemplates?: PackTemplate[]
  work: WorkTask[]
  /** Erfasste Arbeitszeiten */
  workSessions: WorkSession[]
  resume?: ResumePoint
  /** Textentwurf bleibt lokal, auch wenn die Gedankenliste optional synchronisiert wird. */
  captureDraft?: { id: string; text: string; context?: ResumePoint; updatedAt: number }
  taskLearning?: { enabled: boolean; samples: TaskDurationSample[] }
  /** Freiwillig gewählter Aufgabenkontext, keine Standortmessung. */
  taskContext?: 'any' | 'home' | 'work' | 'errand'
  focus?: FocusSession
  /** Pausierte Uhren verwenden denselben Countdown-Typ; keine zweite Fokus-Engine. */
  focusHistory?: FocusSession[]
  stuck?: StuckSession
  tomorrowSteps: TomorrowStep[]
  /** Nächte nach Datum; weder Wecker noch Tagespunkte tragen hier etwas ein. */
  sleepDiary: Record<DateStr, SleepDiaryEntry>
  handover: Record<DateStr, { open: string; next: string }>
  /** Nie aus einem Wecker-Ereignis abgeleitet, immer eine bewusste Eingabe */
  meds: Record<DateStr, { status: MedsStatus; at: number }>
  trial?: { startedAt: DateStr; days: 7 | 14; answers: Record<DateStr, 'ja' | 'teilweise' | 'nein' | 'uebersprungen'> }
  extras?: ExtraLocal
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
