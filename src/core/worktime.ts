// Gleitzeit: rechnet erfasste Arbeitszeiten und den voraussichtlichen Feierabend. Reine Funktionen.
// Plan und Ist bleiben getrennt: Hier zählt nur, was wirklich erfasst wurde. Keine Zeiterfassung im
// Sinne eines Arbeitgebers, keine Rechtsauskunft, keine Annahme über Bezahlung.

import { fmtDuration, fmtTime, minutesOnPlanDay, utcToZoned, weekday, zonedToUtc, type DateStr } from './time'
import type { DayOverride, DayPlan, Settings, WorkBreak, WorkSession, WorkSessionKind } from './types'

const MIN = 60_000

type Interval = [number, number]

/** Sortiert und verschmilzt Überschneidungen, damit nichts doppelt zählt. */
export function normalizeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out: Interval[] = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

function total(list: Interval[]): number {
  return list.reduce((sum, [a, b]) => sum + (b - a), 0)
}

/** Schnittmenge zweier normalisierter Listen */
function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = []
  for (const [x1, x2] of a) {
    for (const [y1, y2] of b) {
      const s = Math.max(x1, y1)
      const e = Math.min(x2, y2)
      if (e > s) out.push([s, e])
    }
  }
  return out
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && value >= 0 && Number.isFinite(new Date(value).getTime())
const text = (value: unknown): value is string => typeof value === 'string'
const dateString = (value: unknown): value is DateStr => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value + 'T12:00:00Z').getTime()) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value

/** Formprüfung für Sicherungen. Fachliche Überschneidungen bleiben erhalten und werden separat benannt. */
export function validWorkSession(value: unknown): value is WorkSession {
  if (!object(value) || !text(value.id) || !value.id.trim() || !dateString(value.date)
    || !['regular', 'maintenance', 'incident', 'onsite', 'other'].includes(String(value.kind)) || !timestamp(value.startAt)
    || (value.endAt !== undefined && !timestamp(value.endAt)) || !Array.isArray(value.breaks)) return false
  if (['label', 'note', 'commitmentId'].some((key) => value[key] !== undefined && !text(value[key]))) return false
  if (value.manual !== undefined && typeof value.manual !== 'boolean') return false
  return value.breaks.every((pause) => object(pause) && text(pause.id) && !!pause.id.trim() && timestamp(pause.startAt)
    && (pause.endAt === undefined || timestamp(pause.endAt)) && (pause.expectedEndAt === undefined || timestamp(pause.expectedEndAt)))
}

export interface WorkIssue {
  /** Stabiler Vergleich erlaubt die Korrektur eines Altproblems, ohne andere alte Angaben zu löschen. */
  key: string
  sessionIds: string[]
  /** Ausmaß des Konflikts; eine schrittweise Korrektur darf ihn verkleinern, aber nicht vergrößern. */
  magnitude: number
  text: string
}

/** Keine stillen Korrekturen: Vorhandene widersprüchliche Angaben bleiben für die Bearbeitung erhalten. */
export function workSessionIssues(list: readonly WorkSession[], nowMs: number): WorkIssue[] {
  const issues: WorkIssue[] = []
  const add = (code: string, ids: string[], message: string, part = '', magnitude = 0) => issues.push({ key: [code, ...[...ids].sort(), part].join('|'), sessionIds: ids, magnitude, text: message })
  const ids = new Set<string>()
  const valid = list.filter((session) => {
    const id = session?.id
    if (!validWorkSession(session)) { add('shape', [typeof id === 'string' ? id : 'unbekannt'], 'Ein Arbeitszeiteintrag ist nicht vollständig lesbar. Die ursprünglichen Angaben bleiben erhalten.'); return false }
    return true
  })
  for (const session of valid) {
    if (ids.has(session.id)) add('duplicate', [session.id], 'Zwei Arbeitszeiteinträge haben dieselbe Kennung. Bitte korrigiere die doppelten Angaben.')
    ids.add(session.id)
    const end = session.endAt ?? nowMs
    if (end < session.startAt) add('order', [session.id], 'Das Arbeitsende liegt vor dem Beginn. Bitte prüfe beide Zeiten.', '', session.startAt - end)
    if (nowMs > 0 && (session.startAt > nowMs || (session.endAt !== undefined && session.endAt > nowMs))) add('future', [session.id], 'Diese Arbeitszeit liegt noch in der Zukunft. Plane einen Einsatz, statt ihn als gearbeitet einzutragen.', '', Math.max(session.startAt, session.endAt ?? 0) - nowMs)
    const pauseIds = new Set<string>()
    const pauses = session.breaks.map((pause) => ({ pause, end: pause.endAt ?? end }))
    if (session.breaks.filter((pause) => pause.endAt === undefined).length > 1) add('open-breaks', [session.id], 'Mehrere Pausen sind gleichzeitig offen. Bitte bestätige die passenden Endzeiten.')
    for (const { pause, end: pauseEnd } of pauses) {
      if (pauseIds.has(pause.id)) add('duplicate-break', [session.id], 'Eine Pause ist doppelt enthalten. Bitte prüfe die Angaben.', pause.id)
      pauseIds.add(pause.id)
      if (pauseEnd < pause.startAt) add('break-order', [session.id], 'Das Pausenende liegt vor dem Pausenbeginn. Bitte prüfe beide Zeiten.', pause.id, pause.startAt - pauseEnd)
      if (pause.startAt < session.startAt || pauseEnd > end || pause.startAt > end || (session.endAt !== undefined && pause.endAt === undefined)) add('break-outside', [session.id], 'Die Pause liegt nicht vollständig innerhalb dieses Arbeitsabschnitts. Bitte korrigiere die Zeiten.', pause.id, Math.max(1, session.startAt - pause.startAt, pauseEnd - end, pause.startAt - end))
      if (nowMs > 0 && (pause.startAt > nowMs || (pause.endAt !== undefined && pause.endAt > nowMs))) add('future-break', [session.id], 'Diese Pause liegt noch in der Zukunft. Eine Endschätzung ist noch keine erfasste Pause.', pause.id, Math.max(pause.startAt, pause.endAt ?? 0) - nowMs)
      if (pause.endAt === undefined && pause.expectedEndAt !== undefined && pause.expectedEndAt < pause.startAt) add('estimate', [session.id], 'Die geschätzte Rückkehr liegt vor dem Pausenbeginn.', pause.id, pause.startAt - pause.expectedEndAt)
    }
    for (let a = 0; a < pauses.length; a++) for (let b = a + 1; b < pauses.length; b++) {
      const x = pauses[a]!; const y = pauses[b]!
      if (Math.min(x.end, y.end) > Math.max(x.pause.startAt, y.pause.startAt)) add('overlap-break', [session.id], 'Zwei Pausen überschneiden sich. Bitte prüfe beide Angaben.', [x.pause.id, y.pause.id].sort().join(':'), Math.min(x.end, y.end) - Math.max(x.pause.startAt, y.pause.startAt))
    }
  }
  const open = valid.filter((session) => session.endAt === undefined)
  if (open.length > 1) add('open-work', open.map((session) => session.id), 'Mehrere Arbeitsabschnitte sind offen. Bitte bestätige ihre tatsächlichen Endzeiten.')
  const chronological = [...valid].sort((a, b) => a.startAt - b.startAt)
  for (let a = 0; a < chronological.length; a++) for (let b = a + 1; b < chronological.length; b++) {
    const x = chronological[a]!; const y = chronological[b]!
    if (y.startAt >= (x.endAt ?? nowMs)) break
    if (Math.min(x.endAt ?? nowMs, y.endAt ?? nowMs) > Math.max(x.startAt, y.startAt)) add('overlap-work', [x.id, y.id], 'Zwei Arbeitsabschnitte überschneiden sich. Bitte korrigiere die Zeiten; Anker löscht keinen Eintrag von selbst.', '', Math.min(x.endAt ?? nowMs, y.endAt ?? nowMs) - Math.max(x.startAt, y.startAt))
  }
  return issues
}

/** Neue Konflikte zurückweisen, die schrittweise Korrektur alter Konflikte aber zulassen. */
export function assertWorkChanges(before: readonly WorkSession[], after: readonly WorkSession[], nowMs: number): void {
  const previous = new Map<string, { count: number; magnitude: number }>()
  for (const issue of workSessionIssues(before, nowMs)) {
    const old = previous.get(issue.key)
    previous.set(issue.key, { count: (old?.count ?? 0) + 1, magnitude: Math.max(old?.magnitude ?? 0, issue.magnitude) })
  }
  const counts = new Map<string, number>()
  for (const issue of workSessionIssues(after, nowMs)) {
    const count = (counts.get(issue.key) ?? 0) + 1
    counts.set(issue.key, count)
    const old = previous.get(issue.key)
    if (!old || count > old.count || issue.magnitude > old.magnitude) throw new Error(issue.text)
  }
}

export interface DayActual {
  /** Sitzungen dieses Plantags */
  sessions: WorkSession[]
  issues: WorkIssue[]
  /** Widersprüchliche oder ungewöhnlich lange offene Zeit ist keine geprüfte Mehrarbeit. */
  unconfirmed: boolean
  grossMin: number
  /** Nur Pausen innerhalb der Arbeit */
  breakMin: number
  netMin: number
  breakCount: number
  /** Längste zusammenhängende Pausen ab 15 Minuten, wie sie für die Pausenregel zählen */
  countedBreakMin: number
  open?: WorkSession
  openBreak?: WorkBreak
  firstStart?: number
  lastEnd?: number
  /** Eine reguläre Sitzung ist beendet und keine läuft: Der Arbeitstag ist abgeschlossen */
  closed: boolean
}

/** Alles, was an einem Plantag wirklich erfasst wurde. Offene Abschnitte laufen bis `nowMs`. */
export function dayActual(all: WorkSession[], date: DateStr, nowMs: number): DayActual {
  const sessions = all.filter((x) => x?.date === date && validWorkSession(x)).sort((a, b) => a.startAt - b.startAt)
  const selected = new Set(sessions.map((session) => session.id))
  // Für künftige/leere Plantage keine gesamte Historie paarweise prüfen. Reale Überschneidungen über Mitternacht bleiben erkennbar.
  const related = sessions.length ? all.filter((session) => session && (selected.has(session.id) || sessions.some((other) => Math.min(session.endAt ?? nowMs, other.endAt ?? nowMs) > Math.max(session.startAt, other.startAt)))) : []
  const issues = workSessionIssues(related, nowMs).filter((issue) => issue.sessionIds.some((id) => selected.has(id)))
  const unconfirmed = issues.length > 0 || sessions.some((session) => needsWorkConfirmation(session, nowMs))
  const work = normalizeIntervals(sessions.map((x) => [x.startAt, Math.max(x.startAt, x.endAt ?? nowMs)]))
  const rawBreaks = normalizeIntervals(sessions.flatMap((x) => x.breaks.map((b): Interval => [b.startAt, Math.max(b.startAt, b.endAt ?? nowMs)])))
  const breaks = intersect(rawBreaks, work)
  const open = sessions.find((x) => x.endAt === undefined)
  const grossMs = total(work)
  const breakMs = total(breaks)
  return {
    sessions,
    issues,
    unconfirmed,
    grossMin: Math.round(grossMs / MIN),
    breakMin: Math.round(breakMs / MIN),
    netMin: Math.round((grossMs - breakMs) / MIN),
    breakCount: breaks.length,
    countedBreakMin: Math.round(breaks.filter(([a, b]) => b - a >= 15 * MIN).reduce((sum, [a, b]) => sum + (b - a), 0) / MIN),
    open,
    openBreak: open?.breaks.find((b) => b.endAt === undefined),
    firstStart: sessions[0]?.startAt,
    lastEnd: sessions.length && !open ? Math.max(...sessions.map((x) => x.endAt ?? x.startAt)) : undefined,
    closed: !open && sessions.some((x) => x.kind === 'regular'),
  }
}

/** Nur der aktuelle Bedienkontext folgt einer offenen Nachtschicht; Tages- und Wochensummen bleiben bei ihrem Datum. */
export function currentWorkActual(all: WorkSession[], date: DateStr, nowMs: number): DayActual {
  const openSession = all.find((session) => validWorkSession(session) && session.endAt === undefined && session.startAt <= nowMs)
  return dayActual(all, openSession?.date ?? date, nowMs)
}

export interface WorkDayRule {
  /** Wunsch-Beginn für heute, Plan-Minuten */
  plannedStart: number
  targetNetMin: number
  plannedBreakMin: number
  endPreference?: number
}

/** Tagesabweichung vor Wochenregel. Dass ein Termin den Beginn vorgeben kann, regelt der Planer. */
export function workRule(date: DateStr, s: Settings, o?: DayOverride, isWorkDay = !!s.work[weekday(date)]?.isWorkDay): WorkDayRule {
  const w = s.work[weekday(date)]!
  return {
    plannedStart: o?.workStart ?? w.start,
    targetNetMin: isWorkDay ? (o?.targetNetMin ?? w.durationMin) : (o?.targetNetMin ?? 0),
    plannedBreakMin: o?.pauseMin ?? w.pauseMin,
    endPreference: o?.workEnd ?? (w.endPreference === undefined ? undefined : w.endPreference < w.start ? w.endPreference + 1440 : w.endPreference),
  }
}

export interface ForecastInput extends WorkDayRule {
  date: DateStr
  actual: DayActual
  nowMs: number
}

export interface WorkForecast {
  end: number
  /** Ohne bekanntes Pausenende ist dies nur der früheste mögliche Wert. */
  lowerBound: boolean
  unconfirmed: boolean
}

/** Restarbeit beginnt nie vor jetzt; eine Endschätzung beendet keine laufende Pause. */
export function workForecast(i: ForecastInput): WorkForecast {
  const { actual: a } = i
  if (a.closed && a.lastEnd !== undefined) return { end: minutesOnPlanDay(i.date, a.lastEnd), lowerBound: false, unconfirmed: a.unconfirmed }
  const remaining = Math.max(0, i.targetNetMin - (a.unconfirmed ? 0 : a.netMin))
  if (a.open) {
    const unknownPause = !!a.openBreak && (a.openBreak.expectedEndAt === undefined || a.openBreak.expectedEndAt <= i.nowMs)
    const resumeAt = Math.max(i.nowMs, a.openBreak?.expectedEndAt ?? i.nowMs)
    const extra = a.breakCount > 0 || a.openBreak || remaining === 0 ? 0 : i.plannedBreakMin
    return { end: minutesOnPlanDay(i.date, resumeAt + (remaining + extra) * MIN), lowerBound: unknownPause || a.unconfirmed, unconfirmed: a.unconfirmed }
  }
  const futureStart = a.sessions.length ? Math.max(i.plannedStart, minutesOnPlanDay(i.date, i.nowMs)) : i.plannedStart
  const extra = a.breakCount > 0 || remaining === 0 ? 0 : i.plannedBreakMin
  return { end: futureStart + remaining + extra, lowerBound: a.unconfirmed, unconfirmed: a.unconfirmed }
}

/** Kompatible Zahlenprojektion für bestehende Aufrufer; UI verwendet zusätzlich die Prognosemerkmale. */
export function forecastEnd(i: ForecastInput): number { return workForecast(i).end }

export interface DayBalance {
  netMin: number
  targetMin: number
  /** Positiv: zusätzlich gearbeitet. Negativ: heute weniger als geplant. Keine Aussage über Bezahlung. */
  diffMin: number
  text: string
}

export function balanceText(diff: number): string {
  if (diff > 0) return `${fmtDuration(diff)} zusätzlich gearbeitet`
  if (diff < 0) return `${fmtDuration(-diff)} weniger als geplant`
  return 'Genau wie geplant'
}

export function dayBalance(a: DayActual, targetMin: number): DayBalance {
  const diffMin = a.netMin - targetMin
  return { netMin: a.netMin, targetMin, diffMin, text: balanceText(diffMin) }
}

// ---------- Zustandsänderungen, wiederholbar: Mehrfaches Tippen ändert nichts ----------

export interface StartInput {
  id: string
  date: DateStr
  at: number
  kind?: WorkSessionKind
  label?: string
  commitmentId?: string
}

/** Läuft schon etwas, bleibt es dabei. Ein Einsatz zum selben Termin startet nur einmal. */
export function startSession(list: WorkSession[], i: StartInput): WorkSession[] {
  if (list.some((x) => x.endAt === undefined)) return list
  if (i.commitmentId && list.some((x) => x.commitmentId === i.commitmentId)) return list
  const session: WorkSession = { id: i.id, date: i.date, kind: i.kind ?? 'regular', startAt: i.at, breaks: [] }
  if (i.label) session.label = i.label
  if (i.commitmentId) session.commitmentId = i.commitmentId
  return [...list, session]
}

function closeBreaks(x: WorkSession, at: number): WorkBreak[] {
  return x.breaks.map((b) => (b.endAt === undefined ? { ...b, endAt: Math.max(b.startAt, at) } : b))
}

/** Beendet, was läuft. Eine offene Pause endet mit. Die Endzeit liegt nie vor dem Beginn. */
export function stopSession(list: WorkSession[], at: number): WorkSession[] {
  return list.map((x) => (x.endAt === undefined ? { ...x, endAt: Math.max(x.startAt, at), breaks: closeBreaks(x, at) } : x))
}

export function startBreak(list: WorkSession[], id: string, at: number): WorkSession[] {
  return list.map((x) => (x.endAt === undefined && !x.breaks.some((b) => b.endAt === undefined) ? { ...x, breaks: [...x.breaks, { id, startAt: Math.max(x.startAt, at) }] } : x))
}

export function endBreak(list: WorkSession[], at: number): WorkSession[] {
  return list.map((x) => (x.endAt === undefined ? { ...x, breaks: closeBreaks(x, at) } : x))
}

/** Plan-Minuten als Eingabe in eine Sitzung. Ein Ende vor dem Beginn liegt nach Mitternacht. */
export function manualSession(id: string, date: DateStr, start: number, end: number, breaks: { start: number; end: number }[], kind: WorkSessionKind = 'regular'): WorkSession {
  const planStart = start < 240 ? start + 1440 : start
  const startAt = zonedToUtc(date, planStart)
  const fix = (minute: number) => {
    const onPlanDay = minute < 240 ? minute + 1440 : minute
    return onPlanDay < planStart ? onPlanDay + 1440 : onPlanDay
  }
  return {
    id,
    date,
    kind,
    startAt,
    endAt: zonedToUtc(date, fix(end)),
    breaks: breaks.map((b, n) => ({ id: `${id}-p${n}`, startAt: zonedToUtc(date, fix(b.start)), endAt: zonedToUtc(date, fix(b.end)) })),
    manual: true,
  }
}

/** Trägt die übliche Pause nach, in der Mitte der Sitzung. Nur nach deiner Bestätigung aufrufen. */
export function withUsualBreak(x: WorkSession, minutes: number, id: string): WorkSession {
  if (x.endAt === undefined) return x
  const span = x.endAt - x.startAt
  const len = Math.min(minutes * MIN, span)
  const startAt = x.startAt + Math.round((span - len) / 2)
  return { ...x, breaks: [...x.breaks, { id, startAt, endAt: startAt + len }] }
}

/** Ein bloßer 04:00-Tagwechsel macht eine kurze laufende Nachtschicht nicht zu vergessen gearbeiteten Stunden. */
export function needsWorkConfirmation(session: WorkSession, nowMs: number): boolean {
  return session.endAt === undefined && nowMs - session.startAt > 16 * 60 * MIN
}

/** Ungewöhnlich lange offene Sitzung. Ein reiner Plantagwechsel verlangt noch keine Endkorrektur. */
export function staleSession(list: WorkSession[], _date: DateStr, nowMs: number): WorkSession | undefined {
  return list.find((session) => needsWorkConfirmation(session, nowMs))
}

// ---------- Hinweise. Sachlich, abschaltbar, keine Rechtsauskunft ----------

const CHECK = 'Bitte prüfe deine betrieblichen Regeln.'

/** Orientierung an § 4 ArbZG: über 6 Stunden 30 Minuten, über 9 Stunden 45 Minuten, Teilpausen ab 15 Minuten. */
export function requiredBreakMin(netMin: number): number {
  if (netMin > 9 * 60) return 45
  if (netMin > 6 * 60) return 30
  return 0
}

export function breakHint(netMin: number, breakMin: number): string | undefined {
  const need = requiredBreakMin(netMin)
  return breakMin < need ? `Bei ${fmtDuration(netMin)} könnte die Pause mit ${fmtDuration(breakMin)} knapp werden. ${CHECK}` : undefined
}

/** Orientierung an § 5 ArbZG: 11 Stunden Ruhezeit, mit Ausnahmen, die Anker nicht beurteilt. */
export const REST_MIN = 11 * 60

export interface RestConflict {
  gapMin: number
  /** Der nächste Beginn ist fest und lässt sich hier nicht auflösen */
  hard: boolean
  text: string
}

export function restConflict(endMs: number, nextStartMs: number, nextLabel: string, hard: boolean, restMin = REST_MIN): RestConflict | undefined {
  const gapMin = Math.round((nextStartMs - endMs) / MIN)
  if (gapMin < 0 || gapMin >= restMin) return undefined
  const base = `Zwischen Arbeitsende und ${nextLabel} liegen ${fmtDuration(gapMin)}. Die Ruhezeit könnte knapp werden. ${CHECK}`
  return { gapMin, hard, text: hard ? `${base} Der Termin steht fest. Das lässt sich hier nicht auflösen, sprich ihn bei Bedarf selbst ab.` : base }
}

/** Sonntag nach Kalender in Berlin. Feiertage kennt Anker nicht. */
export function isSundayWork(startMs: number): boolean {
  return weekday(utcToZoned(startMs).date) === 6
}

export const SUNDAY_HINT = 'Sonn- und Feiertagsarbeit ist besonders geregelt. Ob das hier passt, kann Anker nicht beurteilen. Bitte prüfe die betriebliche Regelung.'

export interface NextObligation {
  startMs: number
  label: string
  hard: boolean
}

/** Was am Folgetag zuerst ansteht. Ein fester Termin geht vor dem eigenen Wunsch-Beginn. */
export function nextObligation(plan: DayPlan, date: DateStr): NextObligation | undefined {
  const firstHard = (plan.legs ?? []).find((l) => l.commitment.commitment === 'hard')
  const wi = plan.workInfo
  if (firstHard && (!wi || firstHard.commitment.start <= wi.plannedStart || wi.fixedMorning)) {
    return { startMs: zonedToUtc(date, firstHard.commitment.start), label: 'deinem Termin', hard: true }
  }
  return wi ? { startMs: zonedToUtc(date, wi.plannedStart), label: 'dem nächsten Arbeitsbeginn', hard: false } : undefined
}

/** Sachliche Hinweise zu einem Tag. Aus, wenn du sie abschaltest. Entscheidet nichts und ändert nichts. */
export function workHints(i: { settings: Settings; actual: DayActual; next?: NextObligation }): string[] {
  if (!i.settings.flex.legalHints || !i.actual.sessions.length || i.actual.unconfirmed) return []
  const out: string[] = []
  const pause = breakHint(i.actual.netMin, i.actual.countedBreakMin)
  if (pause) out.push(pause)
  if (i.actual.lastEnd !== undefined && i.next) {
    const rest = restConflict(i.actual.lastEnd, i.next.startMs, i.next.label, i.next.hard)
    if (rest) out.push(rest.text)
  }
  if (i.actual.sessions.some((x) => isSundayWork(x.startAt))) out.push(SUNDAY_HINT)
  return out
}

export interface LatestInfo {
  latestStart: number
  /** Spätestes Losgehen für die Grenze, nur bei Arbeit vor Ort */
  latestLeave?: number
}

/** Rechnet die Grenze auf das Losgehen zurück: Fahrt und Puffer. Im Homeoffice gibt es keinen Weg. */
export function latestInfo(s: Settings, homeOffice: boolean, date?: DateStr, override?: DayOverride): LatestInfo | undefined {
  const dayLimit = date ? s.work[weekday(date)]?.latestStart : undefined
  const latestStart = override?.latestStart !== undefined ? override.latestStart : dayLimit !== undefined ? dayLimit : s.flex.latestStart
  if (latestStart === null) return undefined
  return homeOffice ? { latestStart } : { latestStart, latestLeave: latestStart - s.commute.minutes - s.commute.bufferMin }
}

export type StartRisk = { level: 'info' | 'tight' | 'over'; text: string }

export interface StartRiskInput {
  plannedStart: number
  latest?: LatestInfo
  /** Ein fester Termin gibt den Morgen vor, dann gilt die Grenze nicht */
  fixedMorning: boolean
  started: boolean
  leftAt?: number
  m: number
}

/** Rechtzeitig und handlungsorientiert. Nach der Grenze keine Vorwürfe, nur noch das Angebot, nachzutragen. */
export function startRisk(i: StartRiskInput): StartRisk | undefined {
  const l = i.latest
  if (!l || i.started || i.fixedMorning) return undefined
  const t = fmtTime(l.latestStart)
  if (l.latestLeave !== undefined) {
    if (i.leftAt) return undefined
    if (i.m >= l.latestStart) return undefined
    if (i.m >= l.latestLeave) return { level: 'tight', text: `Für ${t} wird es knapp. Die schnellste Morgenroutine oder eine vorbereitete Nachricht können helfen.` }
    if (i.m >= l.latestLeave - 15) return { level: 'info', text: `Für ${t} solltest du spätestens um ${fmtTime(l.latestLeave)} los.` }
    return undefined
  }
  if (i.m >= l.latestStart) return undefined
  if (i.m >= l.latestStart - 15) return { level: 'tight', text: `Bis ${t} sind noch ${l.latestStart - i.m} Minuten.` }
  return undefined
}

/** Gibt ein Tag einen Beginn nach der eigenen Grenze vor? Eine Ausnahme, die benannt wird, keine Rüge. */
export function overLatest(plannedStart: number, latest: LatestInfo | undefined): boolean {
  return !!latest && plannedStart > latest.latestStart
}

// ---------- Wochenblick, nur auf Wunsch ----------

export interface WeekRow {
  date: DateStr
  targetMin: number
  /** Undefiniert: nichts erfasst. Das ist keine Null und zählt nicht in die Differenz. */
  netMin?: number
}

export interface WeekSummary {
  rows: WeekRow[]
  targetMin: number
  netMin: number
  /** Nur Tage mit Erfassung */
  diffMin: number
  trackedDays: number
}

export function weekSummary(rows: WeekRow[]): WeekSummary {
  const tracked = rows.filter((r) => r.netMin !== undefined)
  const netMin = tracked.reduce((sum, r) => sum + r.netMin!, 0)
  const countedTarget = tracked.reduce((sum, r) => sum + r.targetMin, 0)
  return { rows, targetMin: rows.reduce((sum, r) => sum + r.targetMin, 0), netMin, diffMin: netMin - countedTarget, trackedDays: tracked.length }
}
