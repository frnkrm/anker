import type { EveningPlan, LocalData, RoutineStep, Settings, WorkDay } from './types'
import { roundDownTo } from './time'

export const DEFAULT_MORNING: RoutineStep[] = [
  { id: 'water', title: 'Aufstehen, Glas Wasser', minutes: 3, minimal: { title: 'Ein Schluck Wasser', minutes: 1 } },
  { id: 'move', title: 'Bewegung', minutes: 10, tag: 'movement', minimal: { title: '1 Liegestütz', minutes: 1 } },
  { id: 'shower', title: 'Duschen', minutes: 10, minimal: { title: 'Gesicht kalt waschen', minutes: 2 } },
  { id: 'face', title: 'Gesichtspflege', minutes: 5, tag: 'face', minimal: { title: 'Creme drauf', minutes: 1 } },
  { id: 'teeth', title: 'Zähne putzen', minutes: 3, tag: 'teeth', minimal: { title: 'Kurz putzen', minutes: 1 } },
  { id: 'dress', title: 'Anziehen', minutes: 5, minimal: { title: 'Bereitgelegte Sachen an', minutes: 3 } },
  { id: 'breakfast', title: 'Frühstück', minutes: 15, tag: 'breakfast', minimal: { title: 'Banane einpacken', minutes: 2 } },
  { id: 'keys', title: 'Schlüssel, Handy, Tasche', minutes: 2 },
]

export const DEFAULT_EVENING: RoutineStep[] = [
  { id: 'tidy', title: '10 Minuten aufräumen', minutes: 10, tag: 'tidy', minimal: { title: 'Eine Sache wegräumen', minutes: 2 } },
  { id: 'prep', title: 'Morgen vorbereiten', minutes: 5, tag: 'prep', minimal: { title: 'Kleidung rauslegen', minutes: 2 } },
  { id: 'inbox', title: 'Gedanken durchsehen', minutes: 2, tag: 'inbox' },
  { id: 'face', title: 'Gesichtspflege', minutes: 5, tag: 'face', minimal: { title: 'Gesicht waschen', minutes: 1 } },
  { id: 'teeth', title: 'Zähne putzen', minutes: 3, tag: 'teeth', minimal: { title: 'Kurz putzen', minutes: 1 } },
]

export const EVENING_LABELS: Record<EveningPlan, string> = {
  free: 'Frei',
  friends: 'Freunde',
  sport: 'Sport',
  cook: 'Kochen',
  appointment: 'Termin',
}

export const DEFAULT_EVENING_DURATIONS: Record<EveningPlan, number> = {
  free: 45,
  friends: 180,
  sport: 90,
  cook: 60,
  appointment: 90,
}

export function sumMinutes(steps: RoutineStep[]): number {
  return steps.reduce((s, x) => s + x.minutes, 0)
}

export interface ScheduleInput {
  workStart: number
  commuteMin: number
  bufferMin: number
  morningMin: number
  /** Zusätzliche Minuten für Sport am Morgen (an Sporttagen) */
  sportExtraMin: number
  sleepNeedMin: number
  fallAsleepMin: number
  screenOffMin: number
}

export interface ScheduleSuggestion {
  wake: number
  leave: number
  pcStop: number
  bed: number
}

/** Leitet Aufstehzeit, PC-Stopp und Bettzeit aus Arbeitsbeginn und Schlafbedarf ab. */
export function suggestSchedule(i: ScheduleInput): ScheduleSuggestion {
  const leave = i.workStart - i.commuteMin - i.bufferMin
  const wake = roundDownTo(leave - i.morningMin - i.sportExtraMin, 5)
  let bed = wake + 1440 - i.sleepNeedMin - i.fallAsleepMin
  bed = roundDownTo(bed, 5)
  const pcStop = bed - i.screenOffMin
  return { wake, leave, pcStop, bed }
}

export function sportExtraMinutes(s: Pick<Settings, 'sport' | 'routines'>): number {
  if (s.sport.time !== 'morning' || !s.sport.days.some(Boolean) || s.sport.kind === 'gym') return 0
  const move = s.routines.morning.find((x) => x.tag === 'movement')
  return Math.max(0, s.sport.durationMin - (move?.minutes ?? 0))
}

export function earliestWorkStart(work: WorkDay[]): number {
  const starts = work.filter((w) => w.isWorkDay).map((w) => w.start)
  return starts.length ? Math.min(...starts) : 9 * 60
}

/** Plan-Werte aus Settings neu ableiten (nach Änderung von Arbeit, Weg oder Schlaf). */
export function deriveSchedule(s: Settings): ScheduleSuggestion {
  return suggestSchedule({
    workStart: earliestWorkStart(s.work),
    commuteMin: s.commute.minutes,
    bufferMin: s.commute.bufferMin,
    morningMin: sumMinutes(s.routines.morning),
    sportExtraMin: sportExtraMinutes(s),
    sleepNeedMin: s.sleep.needMin,
    fallAsleepMin: s.sleep.fallAsleepMin,
    screenOffMin: s.sleep.screenOffMin,
  })
}

export function randomId(len = 12): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

export function defaultSettings(today: string): Settings {
  const work: WorkDay[] = Array.from({ length: 7 }, (_, i) => ({
    isWorkDay: i < 5,
    start: 8 * 60,
    durationMin: 8 * 60,
    pauseMin: 60,
    homeOffice: false,
  }))
  const s: Settings = {
    version: 2,
    onboarded: false,
    goal: 'on-time-rested',
    themeId: 'seefahrt',
    appearance: { dark: true, fontScale: 1 },
    work,
    commute: { minutes: 35, mode: 'auto', bufferMin: 10 },
    sleep: { needMin: 480, fallAsleepMin: 15, screenOffMin: 30 },
    anchor: { wake: 6 * 60 + 15, wakeToleranceMin: 15, weekendToleranceMin: 60 },
    pcStop: 21 * 60 + 30,
    bed: 22 * 60,
    bedBonusLatest: 23 * 60 + 30,
    sport: { days: [true, false, true, false, true, false, false], kind: 'home', time: 'morning', durationMin: 20, gymWayMin: 10 },
    evenings: ['cook', 'free', 'cook', 'free', 'friends', 'free', 'cook'],
    eveningDurations: { ...DEFAULT_EVENING_DURATIONS },
    routines: { morning: DEFAULT_MORNING.map((x) => ({ ...x })), evening: DEFAULT_EVENING.map((x) => ({ ...x })) },
    reminders: { intensity: 'normal', repeatAfterMin: 5, quietStart: 23 * 60 + 30, quietEnd: 5 * 60 },
    rewards: [
      { id: 'game', title: 'Neues Spiel kaufen', price: 1500 },
      { id: 'food', title: 'Lieblingsessen bestellen', price: 500 },
      { id: 'late', title: 'Wochenende: 1 Stunde länger zocken', price: 800 },
    ],
    meals: [
      { id: 'pasta', title: 'Pasta mit Tomatensoße', minutes: 20 },
      { id: 'omelett', title: 'Omelett mit Gemüse', minutes: 15 },
      { id: 'bowl', title: 'Reis-Bowl mit Hähnchen', minutes: 25 },
      { id: 'wrap', title: 'Wraps', minutes: 15 },
      { id: 'curry', title: 'Linsen-Curry (gut zum Vorkochen)', minutes: 35 },
      { id: 'chili', title: 'Chili (gut zum Vorkochen)', minutes: 40 },
    ],
    prepDay: 6,
    tidyZones: ['Küche', 'Bad', 'Wohnzimmer', 'Schlafzimmer', 'Flur'],
    eveningPrep: ['Kleidung rausgelegt', 'Tasche gepackt', 'Handy-Wecker geprüft'],
    game: { stage: 1, startDate: today },
    integrations: { healthConnect: false, googleCalendar: false, writeCalendar: false, sync: false },
    alarm: {
      enabled: true,
      qrSecret: `ANKER-WACH-${randomId(16)}`,
      preWakeEnabled: false,
      preWakeLeadMinutes: 30,
      wakeCheckEnabled: false,
      wakeCheckDelayMinutes: 5,
      mathTasks: 3,
      medicationEnabled: false,
      medicationReminderAt: null,
    },
    travel: { arrivalBufferMin: 10, prepMin: 15, homeOfficeStartupMin: 10, activationMin: 5 },
    routineLinks: [],
    askReason: true,
    homeOfficeMessage: 'Bin heute im Homeoffice und ab [Uhrzeit] erreichbar.',
    weather: { enabled: false, city: '', rules: { jacketBelowC: 12, rainAbovePct: 40 } },
    focus: { pulse: 'off', everyMin: 5, halfway: false, lastMinute: false },
    support: {
      gameVisible: true,
      eveningPreset: { enabled: false, from: 18 * 60, mode: 'wenig-energie' },
      arrival: { enabled: false, steps: ['Tasche ablegen', 'Wasser trinken, Essen prüfen', 'Eine kleine Sache erledigen'] },
    },
    suggestions: [],
  }
  return applySchedule(s)
}

/** Rechnet Zeiten automatisch neu. Von Hand gesetzte Zeiten bleiben unangetastet. */
export function applySchedule(s: Settings): Settings {
  const sug = deriveSchedule(s)
  const m = s.anchor.manual ?? {}
  const wake = m.wake ? s.anchor.wake : sug.wake
  // Eine von Hand gesetzte Aufstehzeit bestimmt auch die automatisch gerechnete Bettzeit
  const autoBed = roundDownTo(wake + 1440 - s.sleep.needMin - s.sleep.fallAsleepMin, 5)
  const bed = m.bed ? s.bed : autoBed
  return {
    ...s,
    anchor: { ...s.anchor, wake },
    pcStop: m.pcStop ? s.pcStop : bed - s.sleep.screenOffMin,
    bed,
  }
}

/** Alle automatischen Vorschläge übernehmen, Handeinträge aufheben. */
export function resetToSuggested(s: Settings): Settings {
  return applySchedule({ ...s, anchor: { ...s.anchor, manual: {} } })
}

export function emptyLocal(): LocalData {
  return { commitments: [], places: [], work: [], handover: {}, meds: {} }
}

/**
 * Ergänzt, was in älteren Einstellungen fehlt (1.0.0, 1.0.1), ohne Vorhandenes zu verändern.
 * Weicht eine gespeicherte Zeit vom Rechenwert ab, wurde sie von Hand gesetzt und bleibt künftig geschützt.
 */
export function migrateSettings(s: Settings, today: string): Settings {
  const d = defaultSettings(today)
  const merged: Settings = {
    ...d,
    ...s,
    version: d.version,
    sport: { ...d.sport, ...s.sport },
    reminders: { ...d.reminders, ...s.reminders },
    integrations: { ...d.integrations, ...s.integrations },
    game: { ...d.game, ...s.game },
    alarm: { ...d.alarm, ...s.alarm },
    appearance: { ...d.appearance, ...s.appearance },
    focus: { ...d.focus, ...s.focus },
    travel: { ...d.travel, ...s.travel },
    weather: { ...d.weather, ...s.weather, rules: { ...d.weather.rules, ...s.weather?.rules } },
    support: {
      ...d.support,
      ...s.support,
      eveningPreset: { ...d.support.eveningPreset, ...s.support?.eveningPreset },
      arrival: { ...d.support.arrival, ...s.support?.arrival },
    },
  }
  if (!s.anchor.manual && s.onboarded) {
    const sug = deriveSchedule(merged)
    merged.anchor = { ...merged.anchor, manual: { wake: s.anchor.wake !== sug.wake, pcStop: s.pcStop !== sug.pcStop, bed: s.bed !== sug.bed } }
  }
  return merged
}
