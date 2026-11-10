import { buildAlarmConfig, nextAlarmTimes } from './alarm'
import { eveningLightMinute, guidancePreferences } from './guidance'
import { extraSettings } from './extras'
import { remainingMs } from './focus'
import { activePlanDate } from './now'
import { buildPcStopCommands } from './pcStop'
import { buildReminders, reminderRevision } from './reminders/build'
import { taskIsOpen, taskTitle } from './tasks'
import { addDays, utcToZoned, zonedToUtc } from './time'
import type { CalendarEvent, DayLog, DayPlan, InboxItem, LocalData, Settings } from './types'
import { minuteText } from './uiText'

export const TIME_CATEGORIES = {
  sleep: 'Abend & Schlaf', work: 'Arbeit', routines: 'Routinen', travel: 'Termine & Wege',
  health: 'Bewegung & Gesundheit', household: 'Haushalt', focus: 'Fokus & Pausen',
  reflection: 'Reflexion', technology: 'Technik',
} as const
export type TimeCategory = keyof typeof TIME_CATEGORIES
/** Eigener lokaler Cache-Record: darf die LWW-Zeit echter LocalData nie verändern. */
export const TIME_CATALOG_RECORD_ID = 'time-catalog'
export const TIME_STATUS_LABELS = { planned: 'Geplant', inactive: 'Inaktiv / abgestimmt', conditional: 'Bedingt', paused: 'Pausiert' } as const
export const TIME_EFFECT_LABELS = {
  alarm: 'Wecker', notification: 'Erinnerung', display: 'Anzeige', 'pc-command': 'Gewünschter PC-Befehl',
  check: 'Bedingte Prüfung', calculation: 'Berechnung', vibration: 'Fokus-Puls', speech: 'Zeitansage', fetch: 'Optionaler Abruf',
} as const
export interface TimeCatalogEntry {
  id: string
  functionId: string
  category: TimeCategory
  label: string
  source: { kind: 'alarm' | 'reminder' | 'plan' | 'task' | 'timer' | 'optional' | 'native'; refId?: string; date?: string; route: string }
  at?: number
  endAt?: number
  status: keyof typeof TIME_STATUS_LABELS
  effect: keyof typeof TIME_EFFECT_LABELS
  evidence: 'calculated' | 'native-snapshot'
  observedAt?: number
  reason?: string
}
export interface TimeCatalogSuggestion {
  id: string
  kind: 'overlap' | 'order' | 'missing'
  title: string
  detail: string
  entryIds: string[]
  route: string
}
export interface TimeCatalogSnapshot {
  version: 1
  sourceRevision: string
  /** Getrennte Evidenzrevision: die Anzeige braucht keine native Abfrage zum Lesen des Caches. */
  runtimeRevision?: string
  generatedAt: number
  validUntil: number
  planDate: string
  rangeStart: number
  rangeEnd: number
  entries: TimeCatalogEntry[]
  suggestions: TimeCatalogSuggestion[]
}
export interface TimeCatalogState {
  settings: Settings
  days: Record<string, DayLog>
  inbox: InboxItem[]
  events: CalendarEvent[]
  local: LocalData
}
/** Nur wirklich gelesene Momentaufnahmen. Der Katalog startet oder plant nichts nativ. */
export interface TimeCatalogRuntime {
  alarm?: { observedAt: number; state: { scheduledAt?: number | null; mainConfirmed?: boolean; preWakeAt?: number | null; preWakeConfirmed?: boolean; preWakePausedForTargetAt?: number; snoozeAt?: number | null; wakeCheckAt?: number | null; testAt?: number | null } }
  bedtimePrompt?: { observedAt: number; state: { phase: 'idle' | 'waiting' | 'shown' | 'quiet' | 'skipped' | 'error'; sessionId?: string; dueAt?: number; reason?: string; quietDueAt?: number; quietUntilAt?: number; quietVisible?: boolean; quietReady?: boolean } }
  tidy?: { date: string; startedAt: number }
}
export interface TimeCatalogInput extends TimeCatalogState { nowMs: number; plans: DayPlan[]; runtime?: TimeCatalogRuntime }

const MINUTE = 60_000
const DAY = 86400_000
const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isFinite(new Date(v).getTime())
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v
const planDate = (now: number) => activePlanDate(now, (at) => utcToZoned(at).date)
const identity = (...parts: unknown[]) => JSON.stringify(parts)
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const internalRoute = (v: unknown): v is string => typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')
  && !v.includes('\\') && [...v].every((c) => c.charCodeAt(0) > 31)

/** Vierzehn echte Plantage; einzelne bekannte Termine behalten ihre eigene Planung außerhalb. */
export function timeCatalogPlanDates(state: TimeCatalogState, now: number): string[] {
  const first = planDate(now)
  const dates = new Set(Array.from({ length: 14 }, (_, n) => addDays(first, n)))
  for (const c of state.local.commitments) if (validDate(c.date) && c.date >= first && c.status !== 'cancelled') dates.add(c.date)
  for (const log of Object.values(state.days)) if (Object.keys(log.override).length && validDate(log.date) && log.date >= first) dates.add(log.date)
  return [...dates].sort()
}

/** Cacheinhalt und Schreibzeit sind ausdrücklich keine Quellenrevision. */
export function timeCatalogSourceRevision(state: TimeCatalogState, now: number): string {
  const local = { ...state.local }
  delete local.timeCatalog
  return reminderRevision(['time-catalog-1', planDate(now), state.settings, state.days, state.inbox, state.events, local])
}

export const timeCatalogRuntimeRevision = (runtime?: TimeCatalogRuntime): string => reminderRevision(runtime ?? {})

/** Nicht vertrauenswürdige Cachekopien können niemals Handlungen oder die Planung steuern. */
export function validTimeCatalog(value: unknown): value is TimeCatalogSnapshot {
  if (!object(value) || value.version !== 1 || typeof value.sourceRevision !== 'string'
    || (value.runtimeRevision !== undefined && typeof value.runtimeRevision !== 'string') || !validDate(String(value.planDate))
    || !timestamp(value.generatedAt) || !timestamp(value.validUntil) || !timestamp(value.rangeStart) || !timestamp(value.rangeEnd)
    || value.validUntil <= value.generatedAt || value.rangeEnd <= value.rangeStart
    || !Array.isArray(value.entries) || !Array.isArray(value.suggestions)) return false
  return value.entries.every((entry) => object(entry) && typeof entry.id === 'string' && typeof entry.functionId === 'string'
    && Object.hasOwn(TIME_CATEGORIES, String(entry.category)) && typeof entry.label === 'string' && object(entry.source)
    && internalRoute(entry.source.route) && (entry.source.refId === undefined || typeof entry.source.refId === 'string')
    && (entry.source.date === undefined || typeof entry.source.date === 'string' && validDate(entry.source.date))
    && ['alarm', 'reminder', 'plan', 'task', 'timer', 'optional', 'native'].includes(String(entry.source.kind))
    && Object.hasOwn(TIME_STATUS_LABELS, String(entry.status)) && Object.hasOwn(TIME_EFFECT_LABELS, String(entry.effect))
    && ['calculated', 'native-snapshot'].includes(String(entry.evidence)) && (entry.at === undefined || timestamp(entry.at))
    && (entry.endAt === undefined || timestamp(entry.endAt)) && (entry.observedAt === undefined || timestamp(entry.observedAt))
    && (entry.reason === undefined || typeof entry.reason === 'string'))
    && value.suggestions.every((s) => object(s) && typeof s.id === 'string' && ['overlap', 'order', 'missing'].includes(String(s.kind))
      && typeof s.title === 'string' && typeof s.detail === 'string' && Array.isArray(s.entryIds) && s.entryIds.every((id) => typeof id === 'string')
      && internalRoute(s.route))
}

export function currentTimeCatalog(state: TimeCatalogState, now: number, runtime?: TimeCatalogRuntime): TimeCatalogSnapshot | undefined {
  const saved = state.local.timeCatalog
  return validTimeCatalog(saved) && saved.generatedAt <= now && saved.validUntil > now
    && saved.sourceRevision === timeCatalogSourceRevision(state, now)
    && (runtime === undefined || saved.runtimeRevision === timeCatalogRuntimeRevision(runtime)) ? saved : undefined
}

const reminderCategory = (key: string): TimeCategory => {
  if (key.startsWith('deadline') || key === 'latest-start') return 'work'
  if (key.startsWith('prep:') || key.startsWith('go:') || key.startsWith('leave') || key === 'latest-leave') return 'travel'
  if (key === 'meds' || key === 'gymbag') return 'health'
  if (key === 'prepcook') return 'household'
  if (key === 'review' || key.startsWith('thought-review:') || key.startsWith('tomorrow-step:')) return 'reflection'
  if (key === 'morning' || key === 'evening') return 'routines'
  if (['pcstop-15', 'pcstop', 'bed', 'wind-down', 'guidance-wind-down', 'guidance-brain-dump', 'guidance-evening-light'].includes(key)) return 'sleep'
  return 'technology'
}
const reminderRoute = (key: string) => key.startsWith('guidance-') ? '/einstellungen/begleitung'
  : key === 'wind-down' ? '/einstellungen/abenduebergang'
  : ['pcstop-15', 'pcstop', 'bed'].includes(key) ? '/einstellungen/schlaf'
    : key === 'morning' ? '/einstellungen/morgenroutine' : key === 'evening' ? '/einstellungen/abendroutine'
      : key.startsWith('deadline-') ? `/aufgabe/work/${encodeURIComponent(key.slice(key.indexOf(':') + 1))}`
  : key === 'review' ? '/rueckblick' : key === 'meds' ? '/wecker'
    : key.startsWith('thought-review:') || key.startsWith('tomorrow-step:') ? '/abend'
      : reminderCategory(key) === 'work' ? '/arbeit' : reminderCategory(key) === 'travel' ? '/tag'
        : reminderCategory(key) === 'health' ? '/vorbereitung' : reminderCategory(key) === 'household' ? '/essen' : '/einstellungen/erinnerungen'

/** Ausschließlich Projektion des aktuellen Stores und bestehender Plan-/Reminderfunktionen. */
export function buildTimeCatalog(input: TimeCatalogInput): TimeCatalogSnapshot {
  const { settings: s, local, nowMs: now, runtime } = input
  const guidanceEvening = s.guidance?.enabled === true && s.guidance.eveningEscalation === true
  if (!timestamp(now)) throw new Error('Der Zeitpunkt der Übersicht ist ungültig.')
  const first = planDate(now)
  const rangeStart = zonedToUtc(first, 4 * 60)
  const last = addDays(first, 14)
  const rangeEnd = zonedToUtc(last, 4 * 60)
  const regular = input.plans.filter((plan) => plan.date >= first && plan.date < last)
  const entries: TimeCatalogEntry[] = []
  const suggestions: TimeCatalogSuggestion[] = []
  const add = (functionId: string, category: TimeCategory, label: string, source: TimeCatalogEntry['source'], rest: Partial<Omit<TimeCatalogEntry, 'id' | 'functionId' | 'category' | 'label' | 'source'>> = {}, variant?: unknown) => {
    const entry: TimeCatalogEntry = { id: identity(functionId, source.date ?? null, source.refId ?? null, variant ?? null), functionId, category, label, source, status: 'planned', effect: 'display', evidence: 'calculated', ...rest }
    entries.push(entry)
    return entry
  }
  const suggest = (kind: TimeCatalogSuggestion['kind'], title: string, detail: string, related: TimeCatalogEntry[], route: string) => {
    suggestions.push({ id: identity(kind, ...related.map((e) => e.id).sort(), detail), kind, title, detail, entryIds: related.map((e) => e.id), route })
  }
  const openWork = local.work.filter(taskIsOpen)
  const extras = { deadlines: openWork.filter((task) => timestamp(task.deadline)).map((task) => ({ id: task.id, at: task.deadline!, reminderRevision: task.reminderRevision })), thoughtReviews: input.inbox, tomorrowSteps: local.tomorrowSteps }
  const explicitAt = [...openWork.map((task) => task.deadline), ...input.inbox.map((task) => task.reviewAt), ...local.tomorrowSteps.map((step) => step.resumeAt)].filter(timestamp)
  const datedEnds = input.plans.map((plan) => zonedToUtc(plan.date, Math.max(2 * 1440, plan.bed, plan.pcStop, ...plan.blocks.map((block) => block.end))))
  const lookahead = Math.max(rangeEnd, ...explicitAt, ...datedEnds) - rangeStart + DAY
  const oneOffReminder = (key: string, date: string) => {
    if (/^(deadline-|thought-review:|tomorrow-step:|prep:|go:)/.test(key)) return true
    const o = input.days[date]?.override
    if (!o) return false
    if (['pcstop-15', 'pcstop', 'bed', 'guidance-wind-down', 'guidance-brain-dump', 'guidance-evening-light'].includes(key)) return o.lateUntil !== undefined || !!o.pcStopExtendMin
    if (key === 'morning' || key === 'evening') return typeof o.routineAt?.[key] === 'number'
    return ['leave', 'leave-10', 'latest-start', 'latest-leave'].includes(key)
      && [o.workStart, o.workEnd, o.latestStart, o.homeOffice, o.targetNetMin, o.pauseMin, o.dayType].some((v) => v !== undefined)
  }
  const reminders = buildReminders(input.plans, input.days, s, rangeStart - 1, lookahead, extras)
    .filter((entry) => entry.at < rangeEnd || oneOffReminder(entry.key, entry.date))
  for (const reminder of reminders) add(`reminder.${reminder.key.split(':')[0]}`, reminderCategory(reminder.key), reminder.title,
    { kind: 'reminder', refId: reminder.key, date: reminder.date, route: guidanceEvening && reminder.key === 'bed' ? '/einstellungen/begleitung' : reminderRoute(reminder.key) },
    { at: reminder.at, effect: 'notification', reason: reminder.escalation ? `Berechnete Wiederholung ${reminder.escalation}. Keine Zustellbestätigung.` : 'Aus den geltenden Erinnerungsregeln berechnet. Keine Zustellbestätigung.' }, reminder.escalation)

  const inactiveEvening = (plan: DayPlan) => {
    const prefs = guidancePreferences(s.guidance)
    if (!reminders.some(r => r.date === plan.date && r.key === 'guidance-evening-light')) add('reminder.guidance-evening-light', 'sleep', 'Warmes Abendlicht', { kind: 'optional', refId: 'guidance-evening-light', date: plan.date, route: '/einstellungen/begleitung' },
      { at: zonedToUtc(plan.date, Math.max(240, plan.bed - prefs.eveningLightLeadMinutes)), status: 'inactive', effect: 'notification', reason: !prefs.enabled || !prefs.eveningLight ? 'Ausgeschaltet.' : s.support.windDown.enabled || prefs.eveningEscalation ? 'Bereits abgestimmt: Dein gewählter Abendübergang übernimmt den Abendhinweis.' : eveningLightMinute(plan, s, input.days[plan.date]) === undefined ? 'Für den heutigen offenen oder abgeschlossenen Abend nicht vorgesehen.' : 'Ruhezeiten und andere Erinnerungsgrenzen bleiben wirksam.' })

    for (const [key, at, label] of [['pcstop-15', plan.pcStop - 15, 'PC-Stopp vorab'], ['pcstop', plan.pcStop, 'PC-Stopp-Erinnerung'], ['bed', plan.bed, 'Bettzeit-Erinnerung']] as const) {
      if (reminders.some((r) => r.date === plan.date && r.key === key)) continue
      add(`reminder.${key}`, 'sleep', label, { kind: 'reminder', refId: key, date: plan.date, route: guidanceEvening ? '/einstellungen/begleitung' : s.support.windDown.enabled ? '/einstellungen/abenduebergang' : '/einstellungen/schlaf' },
        { ...(plan.openEnd ? {} : { at: zonedToUtc(plan.date, at) }), status: 'inactive', effect: 'notification', reason: guidanceEvening && key !== 'bed' ? 'Bereits abgestimmt: Abend & Morgen begleiten ersetzt die bisherigen PC-Stopp-Hinweise.' : plan.openEnd ? 'Heute ist kein festes Abendende gewählt.' : guidanceEvening ? 'Der Abendanker ist nach Tageszustand, Bettbestätigung oder bewusster Abwahl nicht vorgesehen.' : s.support.windDown.enabled ? 'Bereits abgestimmt: Der Abendübergang ersetzt diesen Hinweis.' : 'Nach Tageszustand, Erledigung oder Ruhekontext nicht vorgesehen.' }, 0)
    }
    if (guidanceEvening && s.support.windDown.enabled) add('reminder.wind-down', 'sleep', 'Abendübergang', { kind: 'reminder', refId: 'wind-down', date: plan.date, route: '/einstellungen/begleitung' },
      { at: zonedToUtc(plan.date, s.support.windDown.at < 240 ? s.support.windDown.at + 1440 : s.support.windDown.at), status: 'inactive', effect: 'notification', reason: 'Bereits abgestimmt: Abend & Morgen begleiten ersetzt den bisherigen Abendübergang.' }, 0)
  }

  const config = buildAlarmConfig(s, input.days, first)
  const nextAlarm = nextAlarmTimes(config, now)
  for (const plan of regular) {
    const date = plan.date
    const alarmDate = date
    const wakeAt = zonedToUtc(alarmDate, config.wakeOverrides[alarmDate] ?? config.wakeMinutes)
    const skipped = config.skipDates.includes(alarmDate)
    const main = add('alarm.main', 'sleep', 'Hauptwecker', { kind: 'alarm', date: alarmDate, route: '/wecker' },
      { at: wakeAt, status: !config.enabled || skipped ? 'inactive' : 'planned', effect: 'alarm', reason: skipped ? 'Für diesen Tag als krank ausgenommen.' : !config.enabled ? 'Der Hauptwecker ist ausgeschaltet.' : wakeAt === nextAlarm.mainAt ? 'Nächste berechnete Weckzeit; Ton und Zustellung sind nicht bestätigt.' : 'Berechnete Weckzeit; Ton und Zustellung sind nicht bestätigt.' })
    if (config.preWakeEnabled && config.preWakeLeadMinutes > 0) add('alarm.prewake', 'health', 'Vorwecker', { kind: 'alarm', date: alarmDate, route: '/wecker' },
      { at: wakeAt - config.preWakeLeadMinutes * MINUTE, status: main.status, effect: 'alarm', reason: main.reason })
    if (config.smartWakeEnabled) add('alarm.smart-window', 'sleep', 'Aktivitäts-Weckfenster', { kind: 'alarm', date: alarmDate, route: '/wecker' },
      { at: wakeAt - config.smartWakeWindowMinutes * MINUTE, endAt: wakeAt, status: main.status === 'inactive' ? 'inactive' : 'conditional', effect: 'check', reason: 'Jede Nacht bewusst starten. Kein Schlafphasen- oder Hörbarkeitsnachweis.' })
    inactiveEvening(plan)
    add('sleep.screen-off-calculation', 'sleep', 'Bildschirmabstand vor der Bettzeit', { kind: 'plan', date, route: '/einstellungen/schlaf' },
      { ...(plan.openEnd ? {} : { at: zonedToUtc(date, plan.bed - s.sleep.screenOffMin) }), status: 'inactive', effect: 'calculation', reason: plan.openEnd ? 'Ohne feste Bettzeit auch kein berechneter Bildschirmabstand.' : s.anchor.manual?.pcStop ? 'Nur ein Rechenvorschlag. Deine manuelle PC-Stopp-Zeit bleibt erhalten.' : 'Rechenvorschlag Bettzeit minus Bildschirmabstand; kein eigener zusätzlicher Hinweis.' })
    const command = buildPcStopCommands([plan])[0]!
    add('pc.stop-command', 'sleep', 'PC-Stopp-Auftrag', { kind: 'plan', date, route: '/pc-stopp' },
      { ...(command.mode === 'scheduled' && command.stopAt ? { at: Date.parse(command.stopAt) } : {}), status: command.mode === 'paused' ? 'paused' : 'conditional', effect: 'pc-command', reason: command.mode === 'paused' ? 'Der vorhandene PC-Plan ist für diesen Tag pausiert.' : 'Gewünschter Auftrag. Bereitstellen, PC-Empfang und Ausführung sind hier nicht bestätigt; eine ruhige Aktivität ist eine andere Wirkung.' })
    add('plan.bedtime', 'sleep', 'Geplante Bettzeit', { kind: 'plan', date, route: '/schlaf' }, { ...(plan.openEnd ? {} : { at: zonedToUtc(date, plan.bed) }), status: plan.openEnd ? 'paused' : 'planned', reason: plan.openEnd ? 'Bewusst offen gelassen; keine feste Bettzeit.' : 'Anzeige der vorhandenen Planung. Keine Aussage darüber, ob du schläfst.' })
    for (const block of plan.blocks) {
      if (!['morning', 'evening-routine', 'sport', 'work', 'prep', 'commute'].includes(block.kind)) continue
      const category = block.kind === 'sport' ? 'health' : block.kind === 'work' ? 'work' : block.kind === 'commute' ? 'travel' : block.kind === 'prep' ? 'household' : 'routines'
      add(`plan.${block.kind}`, category, block.title, { kind: 'plan', refId: block.id, date, route: block.routine ? `/einstellungen/${block.routine === 'morning' ? 'morgenroutine' : 'abendroutine'}` : block.kind === 'work' ? '/arbeitszeit' : '/tag' },
        { at: zonedToUtc(date, block.start), endAt: zonedToUtc(date, block.end), reason: 'Geplante Anzeige. Startet keine Routine, Arbeit oder Erledigung.' })
    }
    if (!plan.openEnd && plan.pcStop > plan.bed) {
      const pc = entries.find((e) => e.functionId === 'pc.stop-command' && e.source.date === date)!
      suggest('order', 'PC-Stopp liegt nach der Bettzeit', 'Prüfe deine selbst gewählten Zeiten. Anker verändert sie nicht.', [pc], '/einstellungen/schlaf')
    }
    for (const conflict of plan.conflicts ?? []) suggest('order', 'Ein vorhandener Plankonflikt', conflict, entries.filter((e) => e.source.date === date && e.source.kind === 'plan').slice(0, 1), '/tag')
  }
  if (!config.preWakeEnabled || config.preWakeLeadMinutes <= 0) add('alarm.prewake', 'health', 'Vorwecker', { kind: 'alarm', route: '/wecker' }, { status: 'inactive', effect: 'alarm', reason: 'Kein Vorwecker mit positivem Abstand gewählt.' })
  if (!config.smartWakeEnabled) add('alarm.smart-window', 'sleep', 'Aktivitäts-Weckfenster', { kind: 'alarm', route: '/wecker' }, { status: 'inactive', effect: 'check', reason: 'Das optionale Aktivitäts-Weckfenster ist ausgeschaltet.' })
  if (!s.support.windDown.enabled) add('reminder.wind-down', 'sleep', 'Abendübergang', { kind: 'optional', route: guidanceEvening ? '/einstellungen/begleitung' : '/einstellungen/abenduebergang' }, { status: 'inactive', effect: 'notification', reason: guidanceEvening ? 'Ausgeschaltet. Die gewählte Abendbegleitung übernimmt bereits die Abendhinweise.' : 'Ausgeschaltet. Bei Aktivierung ersetzt er bereits die PC-/Bett-Hinweise.' })
  add('alarm.wakecheck', 'sleep', 'Wachheits-Check', { kind: 'alarm', route: '/wecker' }, { status: config.wakeCheckEnabled ? 'conditional' : 'inactive', effect: 'alarm', reason: config.wakeCheckEnabled ? 'Erst nach einem passenden tatsächlichen Weckerende. Keine Uhrzeit aus der Einstellung allein ableitbar.' : 'Der Wachheits-Check ist ausgeschaltet.' })
  add('alarm.snooze', 'sleep', 'Schlummerwecker', { kind: 'alarm', route: '/wecker' }, { status: config.enabled ? 'conditional' : 'inactive', effect: 'alarm', reason: 'Entsteht erst nach bewusstem Schlummern; keine pauschal berechnete Uhrzeit.' })
  add('alarm.test', 'technology', 'Separater Testalarm', { kind: 'alarm', route: '/wecker' }, { status: 'conditional', effect: 'alarm', reason: 'Nur nach bewusstem Teststart.' })
  for (const [date, minute] of Object.entries(config.wakeOverrides)) if (date >= last) {
    const at = zonedToUtc(date, minute)
    const status = config.enabled && !config.skipDates.includes(date) ? 'planned' : 'inactive'
    add('alarm.main', 'sleep', 'Einmalige Weckzeit', { kind: 'alarm', date, route: '/wecker' }, { at, status, effect: 'alarm', reason: 'Bewusst gewählte Tagesausnahme außerhalb des Wiederholungsausblicks.' })
    if (config.preWakeEnabled && config.preWakeLeadMinutes > 0) add('alarm.prewake', 'health', 'Vorwecker zur einmaligen Weckzeit', { kind: 'alarm', date, route: '/wecker' }, { at: at - config.preWakeLeadMinutes * MINUTE, status, effect: 'alarm', reason: 'Abhängiger Vorwecker zur bewusst gewählten Tagesausnahme. Keine Zustellbestätigung.' })
    if (config.smartWakeEnabled) add('alarm.smart-window', 'sleep', 'Aktivitätsfenster zur einmaligen Weckzeit', { kind: 'alarm', date, route: '/wecker' }, { at: at - config.smartWakeWindowMinutes * MINUTE, endAt: at, status: status === 'inactive' ? 'inactive' : 'conditional', effect: 'check', reason: 'Fenster der bewusst gewählten Tagesausnahme. Jede Nacht bewusst starten; kein Schlafphasennachweis.' })
  }
  for (const plan of input.plans) {
    const o = input.days[plan.date]?.override
    if (o?.returnCheckAfter !== undefined) add('routines.return-check', 'routines', 'Rückkehr erneut erfragen', { kind: 'plan', date: plan.date, route: '/' }, { at: zonedToUtc(plan.date, o.returnCheckAfter), status: o.routineAt?.evening === 'return' && !o.backAt && plan.pendingEvening ? 'conditional' : 'inactive', effect: 'check', reason: 'Nur in der passenden Jetzt-Ansicht, wenn die Abendroutine noch auf Rückkehr wartet. Keine automatische Rückkehr.' })
    if (plan.date < last || !o) continue
    if (o.lateUntil !== undefined || o.pcStopExtendMin) {
      inactiveEvening(plan)
      const command = buildPcStopCommands([plan])[0]!
      add('pc.stop-command', 'sleep', 'Einmaliger PC-Stopp-Auftrag', { kind: 'plan', date: plan.date, route: '/pc-stopp' }, { ...(command.stopAt ? { at: Date.parse(command.stopAt) } : {}), status: command.mode === 'paused' ? 'paused' : 'conditional', effect: 'pc-command', reason: 'Aus der ausdrücklich datierten Abendentscheidung. Empfang und Ausführung sind nicht bestätigt.' })
      add('plan.bedtime', 'sleep', 'Einmalige Bettzeit', { kind: 'plan', date: plan.date, route: '/schlaf' }, { ...(plan.openEnd ? {} : { at: zonedToUtc(plan.date, plan.bed) }), status: plan.openEnd ? 'paused' : 'planned', reason: 'Bestehende datierte Abendplanung. Kein automatischer Schlafbeginn.' })
    }
    for (const block of plan.blocks) if (block.routine && typeof o.routineAt?.[block.routine] === 'number') add(`plan.${block.kind}`, 'routines', block.title, { kind: 'plan', refId: block.id, date: plan.date, route: `/einstellungen/${block.routine === 'morning' ? 'morgenroutine' : 'abendroutine'}` }, { at: zonedToUtc(plan.date, block.start), endAt: zonedToUtc(plan.date, block.end), reason: 'Bestehende datierte Routineverschiebung. Kein automatischer Start.' })
  }

  for (const event of input.events) if (timestamp(event.start) && event.end >= rangeStart) add('calendar.event', 'travel', event.title,
    { kind: 'plan', refId: event.id, date: utcToZoned(event.start).date, route: '/tag' }, { at: event.start, endAt: event.end, reason: 'Gelesener Kalendertermin. Kein automatischer Start oder Abschluss.' })
  for (const c of local.commitments) if (validDate(c.date) && c.date >= first && c.status !== 'cancelled') add('commitment.start', 'travel', c.label,
    { kind: 'plan', refId: c.id, date: c.date, route: '/tag' }, { at: zonedToUtc(c.date, c.start), ...(c.end !== undefined ? { endAt: zonedToUtc(c.date, c.end) } : {}), reason: 'Ausdrücklich geplanter Termin oder Einsatz. Keine Ist-Zeit.' })
  for (const plan of input.plans) for (const leg of plan.legs ?? []) {
    const c = leg.commitment
    if (c.date < first || c.status === 'cancelled') continue
    if (leg.leave !== undefined) add('travel.departure', 'travel', `Abfahrt: ${c.label}`, { kind: 'plan', refId: c.id, date: c.date, route: '/tag' }, { at: zonedToUtc(c.date, leg.leave), reason: 'Aus dem bestehenden Wegplan berechnet. Kein Nachweis einer Abfahrt.' })
    else if (leg.travelOpen) add('travel.departure', 'travel', `Abfahrt offen: ${c.label}`, { kind: 'plan', refId: c.id, date: c.date, route: '/tag' }, { status: 'conditional', reason: 'Die Fahrzeit ist noch offen. Die Übersicht erfindet keine Abfahrt.' })
  }
  for (const task of [...local.work.map((task) => ({ task, kind: 'work' as const })), ...input.inbox.filter((task) => task.status === 'task').map((task) => ({ task, kind: 'task' as const }))]) {
    if (!taskIsOpen(task.task)) continue
    const route = `/aufgabe/${task.kind}/${encodeURIComponent(task.task.id)}`
    const related: TimeCatalogEntry[] = []
    for (const [role, at, label] of [['earliest', task.task.earliestStart, 'Frühester Start'], ['deadline', task.task.deadline, 'Frist'], ['deferred', task.task.deferredUntil, 'Wiedervorlage']] as const) if (timestamp(at) && at >= rangeStart) related.push(add(`task.${role}`, task.kind === 'work' ? 'work' : 'reflection', `${label}: ${taskTitle(task.task)}`, { kind: 'task', refId: task.task.id, date: utcToZoned(at).date, route }, { at, reason: 'Zeitabhängige Anzeige der bestehenden Aufgabe; startet keine Arbeit.' }))
    if (task.task.deadline !== undefined && ((task.task.earliestStart ?? 0) > task.task.deadline || (task.task.deferredUntil ?? 0) > task.task.deadline)) suggest('order', 'Start liegt nach der Frist', 'Prüfe Start, Wiedervorlage oder Frist dieser Aufgabe. Es wird nichts verschoben.', related, route)
  }
  for (const thought of input.inbox) if (thought.status === 'open' && !thought.done && timestamp(thought.reviewAt) && thought.reviewAt >= rangeStart) add('thought.review', 'reflection', 'Geparkter Gedanke wieder sichtbar', { kind: 'task', refId: thought.id, date: utcToZoned(thought.reviewAt).date, route: '/abend' }, { at: thought.reviewAt, reason: thought.reviewNotify ? 'Wiedersichtbarkeit; ein möglicher Hinweis wird separat geführt.' : 'Nur Anzeige; die Erinnerung ist nicht gewählt.' })
  for (const step of local.tomorrowSteps) if (step.doneAt === undefined && timestamp(step.resumeAt) && step.resumeAt >= rangeStart) add('tomorrow.resume', 'reflection', 'Nächster Schritt wieder sichtbar', { kind: 'task', refId: step.id, date: utcToZoned(step.resumeAt).date, route: '/abend' }, { at: step.resumeAt, reason: step.remind ? 'Anzeige; eine mögliche Erinnerung wird separat geführt.' : 'Nur Anzeige; die Erinnerung ist nicht gewählt.' })

  const timerEntries = (id: string, timer: NonNullable<LocalData['focus']>['timer'], label: string, route: string, category: TimeCategory = 'focus') => add(id, category, label, { kind: 'timer', refId: id === 'focus.end' ? local.focus?.id : local.stuck?.contextKey, route }, { ...(timer.status === 'running' ? { at: timer.deadlineAt } : {}), status: timer.status === 'paused' ? 'paused' : 'planned', reason: timer.status === 'paused' ? `${minuteText(Math.ceil(remainingMs(timer, now) / MINUTE))} Restzeit. Kein aktiver Endtermin.` : 'Nur Timeranzeige. Ablauf erledigt nichts, vergibt keine XP und bucht keine Arbeitszeit.' })
  if (local.focus) {
    const focus = local.focus
    const target = focus.target
    const route = target.kind === 'routine' ? `/fokus/${target.routine}` : `/aufgabe/${target.kind}/${encodeURIComponent(target.id)}${target.partId ? `?teil=${encodeURIComponent(target.partId)}` : ''}`
    timerEntries('focus.end', focus.timer, 'Fokus-Zeitfenster endet', route)
    const speech = extraSettings(s.extras).spokenCues
    if (focus.timer.status === 'running' && (s.focus.pulse !== 'off' || speech)) {
      const marks = new Set<number>()
      const duration = focus.timer.durationMs
      for (let mark = s.focus.everyMin * MINUTE; mark < duration; mark += s.focus.everyMin * MINUTE) marks.add(mark)
      if (s.focus.halfway) marks.add(duration / 2)
      if (s.focus.lastMinute && duration > MINUTE) marks.add(duration - MINUTE)
      for (const mark of marks) {
        const at = focus.timer.deadlineAt - duration + mark
        if (at <= now || mark <= focus.timer.pulseCheckpointMs) continue
        add('focus.pulse', 'focus', speech ? 'Fokus-Puls / Zeitansage' : 'Fokus-Puls', { kind: 'timer', refId: focus.id, route }, { at, status: 'conditional', effect: s.focus.pulse === 'off' ? 'speech' : 'vibration', reason: 'Nur in der sichtbaren passenden Fokusansicht und bei erlaubtem Ruhe-/Alarmkontext. Kein autonomer Hintergrundwecker.' }, mark)
      }
    }
  }
  if (local.stuck?.timer) timerEntries('stuck.end', local.stuck.timer, 'Starthilfe-Zeitfenster endet', '/wiedereinstieg')
  if (runtime?.tidy && runtime.tidy.date === first && timestamp(runtime.tidy.startedAt) && runtime.tidy.startedAt <= now) add('tidy.end', 'household', 'Aufräum-Zeitfenster endet', { kind: 'timer', refId: first, route: '/aufraeumen' }, { at: runtime.tidy.startedAt + 10 * MINUTE, reason: 'Aus dem tatsächlich gelesenen lokalen Start. Ablauf bestätigt keine Erledigung.' })
  else add('tidy.end', 'household', 'Aufräum-Zeitfenster', { kind: 'optional', route: '/aufraeumen' }, { status: 'conditional', reason: 'Bewusst starten. Ohne gelesenen lokalen Start wird keine Endzeit erfunden.' })
  for (const [date, contact] of Object.entries(local.homeOfficeContact ?? {})) if (contact.status === 'later' && timestamp(contact.remindAt)) add('work.contact-return', 'work', 'Kontaktwahl erneut anbieten', { kind: 'optional', refId: date, date, route: '/arbeit' }, { at: contact.remindAt, status: 'conditional', reason: 'Einmaliger Vorschlag im ruhigen passenden Appkontext. Kein Versand.' })
  if (s.support.eveningPreset.enabled) for (const plan of regular) if (!input.days[plan.date]?.override.mode) add('sleep.evening-mode', 'sleep', 'Abendmodus vorschlagen', { kind: 'optional', date: plan.date, route: '/einstellungen/abendmodus' }, { at: zonedToUtc(plan.date, s.support.eveningPreset.from), status: 'conditional', reason: 'Nur Vorschlag beim Öffnen; ändert keinen Modus selbst.' })
  add('weather.refresh', 'technology', 'Wetter aktualisieren', { kind: 'optional', route: '/vorbereitung' }, { status: local.weatherProfile?.enabled ? 'conditional' : 'inactive', effect: 'fetch', reason: 'Nur bei passendem Appaufruf und bestehender Freigabe. Cachealter ist kein zugesagter Abruftermin.' })
  add('voice.dictation', 'technology', 'Lokale Spracheingabe', { kind: 'optional', route: '/einstellungen/hilfen' }, { status: extraSettings(s.extras).dictation ? 'conditional' : 'inactive', effect: 'check', reason: 'Nur bewusst gestartet, kein zeitlicher Hintergrundauslöser.' })
  add('voice.time-cue', 'focus', 'Gesprochene Zeitinfo', { kind: 'optional', route: '/einstellungen/hilfen' }, { status: extraSettings(s.extras).spokenCues ? 'conditional' : 'inactive', effect: 'speech', reason: 'An erlaubte Fokus-Pulse gebunden, kein zusätzlicher Wecker.' })
  add('geofence.suggestion', 'travel', 'Standorthinweis', { kind: 'optional', route: '/orte' }, { status: local.extras?.geofences?.enabled ? 'conditional' : 'inactive', reason: 'Nur für bewusst gewählte Besuche, passende Rechte und tatsächlichen Aufenthalt. Keine automatische Ankunft.' })
  add('traffic.opportunity', 'travel', 'Verkehrsschätzung prüfen', { kind: 'optional', route: '/einstellungen/assistenz' }, { status: local.assistance?.routes?.enabled && local.assistance.routes.automatic ? 'conditional' : 'inactive', effect: 'fetch', reason: 'Nur bei Appaktivität: passende Vorabend-, Morgen- oder Abfahrtsgelegenheit. Keine feste Hintergrundanfrage.' })

  const observed = runtime?.alarm
  if (observed && timestamp(observed.observedAt) && observed.observedAt <= now && now - observed.observedAt < 2 * MINUTE) {
    for (const [role, at, confirmed] of [['main', observed.state.scheduledAt, observed.state.mainConfirmed], ['prewake', observed.state.preWakeAt, observed.state.preWakeConfirmed], ['snooze', observed.state.snoozeAt, true], ['wakecheck', observed.state.wakeCheckAt, true], ['test', observed.state.testAt, true]] as const) {
      if (!timestamp(at) || at === 0) continue
      const matched = entries.find((e) => e.functionId === `alarm.${role}` && e.at === at && e.status !== 'inactive')
      if (matched) Object.assign(matched, { evidence: 'native-snapshot', observedAt: observed.observedAt, reason: confirmed ? 'Zu diesem Prüfzeitpunkt nativ hinterlegt. Keine Hör- oder Zustellbestätigung.' : 'Native Momentaufnahme ohne bestätigte Planung.' })
      else {
        const native = add(`alarm.${role}`, role === 'test' ? 'technology' : 'sleep', { main: 'Hauptwecker', prewake: 'Vorwecker', snooze: 'Schlummerwecker', wakecheck: 'Wachheits-Check', test: 'Testalarm' }[role], { kind: 'native', refId: role, route: '/wecker' }, { at, effect: 'alarm', evidence: 'native-snapshot', observedAt: observed.observedAt, reason: confirmed ? 'Zum Prüfzeitpunkt nativ hinterlegt; keine Zustellbestätigung.' : 'Native Momentaufnahme ohne bestätigte Planung.' })
        if (role === 'main' || role === 'prewake') suggest('order', 'Gerätestand und Berechnung weichen ab', 'Der ausgelesene native Zeitpunkt passt nicht zur aktuellen aktiven Berechnung. Prüfe die bestehende Weckerdiagnose; diese Übersicht ändert nichts.', [native], '/wecker')
      }
    }
    for (const entry of entries) if (entry.functionId === 'alarm.prewake' && entry.source.date && zonedToUtc(entry.source.date, config.wakeOverrides[entry.source.date] ?? config.wakeMinutes) === observed.state.preWakePausedForTargetAt) { entry.status = 'inactive'; entry.reason = 'Für dieses tatsächlich gelesene Aktivitäts-Weckfenster pausiert.' }
  }
  const bedtime = runtime?.bedtimePrompt
  if (bedtime && timestamp(bedtime.observedAt) && bedtime.observedAt <= now && now - bedtime.observedAt < 2 * MINUTE) {
    const quiet = bedtime.state.phase === 'quiet'
    const at = quiet ? bedtime.state.quietDueAt : bedtime.state.phase !== 'idle' ? bedtime.state.dueAt : undefined
    add('sleep.native-prompt', 'sleep', quiet ? 'Leiser Schlafenszeit-Folgehinweis' : 'Stummer Einschlafhinweis', { kind: 'native', refId: bedtime.state.sessionId, route: '/' }, {
      ...(timestamp(at) ? { at } : {}), status: quiet ? 'conditional' : bedtime.state.phase === 'waiting' ? 'planned' : 'inactive',
      effect: 'display', evidence: 'native-snapshot', observedAt: bedtime.observedAt,
      reason: quiet ? 'Früheste native Möglichkeit, kein zugesagter Anzeigetermin. Vollkommen still und ohne Bildschirmwecken; keine Schlaf- oder Wachmessung. Diese Übersicht startet nichts.' : bedtime.state.phase === 'waiting' ? 'Nur die gelesene native Einmalsitzung. Anzeige bei ausgeschaltetem/gesperrtem Bildschirm wird nicht zugesagt.' : `Gelesener Zustand: ${bedtime.state.phase}. Keine neue Sitzung aus dieser Übersicht.`,
    })
  }
  else add('sleep.native-prompt', 'sleep', 'Stummer Einschlafhinweis', { kind: 'optional', route: '/' }, { status: 'conditional', reason: 'Bewusst gestartete native Einmalsitzung. Ohne aktuellen Status wird keine Uhrzeit angenommen.' })
  if (s.alarm.medicationEnabled && s.alarm.medicationReminderAt === null) suggest('missing', 'Eine private Erinnerungszeit fehlt', 'Die Funktion ist gewählt, eine eigene Uhrzeit ist noch offen.', [], '/wecker')

  // Gleiche Anzeige/Planung oder ein PC-Befehl ist kein doppelter Hinweis. Nur tatsächlich
  // gleichzeitig berechnete Hinweise verschiedener Rollen werden sanft angeboten.
  const groups = new Map<string, TimeCatalogEntry[]>()
  for (const entry of entries) if (entry.status === 'planned' && entry.effect === 'notification' && entry.at !== undefined && entry.at >= now) {
    const key = identity(entry.at)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  for (const group of groups.values()) if (new Set(group.map((e) => e.id)).size > 1) suggest('overlap', 'Mehrere Hinweise zur gleichen Zeit', 'Das kann passen. Prüfe bei Bedarf die jeweiligen Quellen; nichts wird automatisch ausgeschaltet.', group, group[0]!.source.route)
  entries.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
  const next = entries.find((entry) => entry.at !== undefined && entry.at > now)?.at ?? now + MINUTE
  const evidenceExpiry = [runtime?.alarm?.observedAt, runtime?.bedtimePrompt?.observedAt].filter(timestamp)
    .map((at) => at + 2 * MINUTE).filter((at) => at > now)
  const validUntil = Math.min(now + MINUTE, next, ...evidenceExpiry)
  return { version: 1, sourceRevision: timeCatalogSourceRevision(input, now), runtimeRevision: timeCatalogRuntimeRevision(runtime), generatedAt: now, validUntil, planDate: first, rangeStart, rangeEnd, entries, suggestions }
}
