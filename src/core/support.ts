// Reine Entscheidungslogik für die Alltagshilfe: Modi, flexible Aufgaben, nächste Aktion, Wiedereinstieg.
// Alles regelbasiert, erklärbar und offline. Keine Annahmen über Medikamente oder deren Wirkung.

import { nowView, type NowAction, type NowView } from './now'
import { fmtTime, minutesOnPlanDay, type DateStr } from './time'
import type { DayLog, DayPlan, InboxItem, Meal, ResumePoint, Settings, SupportMode, WorkTask } from './types'

export const MODE_LABEL: Record<SupportMode, string> = {
  normal: 'Normal',
  startschwierigkeit: 'Einfach anfangen',
  'wenig-energie': 'Wenig Energie',
  ueberlastet: 'Überlastet',
  'auf-kurs': 'Auf Kurs',
}

export const MODE_HINT: Record<SupportMode, string> = {
  normal: 'Alles wie geplant.',
  startschwierigkeit: 'Ein winziger Schritt und 2 Minuten Timer.',
  'wenig-energie': 'Kleine Versionen, weniger Entscheidungen.',
  ueberlastet: 'Nur das Nötigste. Pausen sind erlaubt, das Spiel ist ausgeblendet.',
  'auf-kurs': 'So wenig Unterbrechungen wie möglich.',
}

/** Aktuell gewählter Modus. Ohne Wahl: normal. Nie aus Uhrzeit oder Medikation abgeleitet. */
export function currentMode(log: DayLog | undefined): SupportMode {
  return log?.override.mode ?? 'normal'
}

/** Abendmodus als Vorschlag: nur wenn eingeschaltet, zur eigenen Uhrzeit und noch nichts gewählt. */
export function suggestedMode(s: Settings, log: DayLog | undefined, m: number): SupportMode | undefined {
  const p = s.support.eveningPreset
  if (!p.enabled || log?.override.mode) return undefined
  return m >= p.from ? p.mode : undefined
}

// ---------- Flexible Aufgaben aus der Inbox ----------

export const DEFAULT_TASK_MIN = 5

/** Aufgaben, die an diesem Tag dran sind. Älteres bleibt ruhig dabei, ohne Rückstands-Anzeige. */
export function tasksFor(inbox: InboxItem[], date: DateStr): InboxItem[] {
  return inbox.filter((x) => x.status === 'task' && !x.done && (x.taskDate ?? date) <= date).sort((a, b) => (a.taskDate ?? '').localeCompare(b.taskDate ?? '') || a.createdAt - b.createdAt)
}

export interface TaskWindow {
  start: number
  end: number
  /** Passt die Schätzung hinein? Sonst Minimalversion anbieten */
  fits: boolean
}

/**
 * Flexibles Zeitfenster nach Feierabend, nie im Schlaf, bei der Arbeit oder in Terminen.
 * Eine Schätzung, kein Termin: Die Aufgabe bleibt verschiebbar.
 */
export function suggestTaskWindow(plan: DayPlan, minutes = DEFAULT_TASK_MIN): TaskWindow | undefined {
  const fromBlock = plan.blocks.find((b) => b.kind === 'evening-plan' || b.kind === 'free' || b.kind === 'day' || b.kind === 'rest')
  if (!fromBlock) return undefined
  const firstEvening = plan.blocks.filter((b) => b.kind === 'free' || b.kind === 'evening-plan' || b.kind === 'day' || b.kind === 'rest')
  const blocked = plan.blocks.filter((b) => b.kind === 'event')
  for (const b of firstEvening) {
    let start = b.start
    for (const e of blocked) if (e.start < start + minutes && e.end > start) start = e.end
    if (start + minutes <= b.end) return { start, end: start + minutes, fits: true }
  }
  const b = firstEvening[0]!
  return { start: b.start, end: b.end, fits: false }
}

// ---------- Berufliche Aufgaben ----------

export const MAX_WORK_VISIBLE = 3

export function openWork(work: WorkTask[]): WorkTask[] {
  return work.filter((w) => !w.done)
}

/** Top-1 ist die erste offene Aufgabe in der vom Nutzer gewählten Reihenfolge. */
export function topWork(work: WorkTask[]): WorkTask | undefined {
  return openWork(work)[0]
}

export type DeadlineRisk = 'none' | 'soon' | 'today' | 'past'

/** Sachlich, ohne Vorwurf. Berücksichtigt die eigene Schätzung plus etwas Luft. */
export function deadlineRisk(w: WorkTask, nowMs: number): DeadlineRisk {
  if (!w.deadline || w.done) return 'none'
  const left = w.deadline - nowMs
  if (left <= 0) return 'past'
  const need = ((w.estimateMin ?? 30) + 30) * 60_000
  if (left <= need) return 'soon'
  if (left <= 12 * 3600_000) return 'today'
  return 'none'
}

export function workStepText(w: WorkTask): string {
  return w.nextStep?.trim() || w.title
}

// ---------- Nächste Aktion ----------

export type NextAction =
  | NowAction
  | { type: 'worktask'; title: string; sub?: string; task: WorkTask }
  | { type: 'task'; title: string; sub?: string; task: InboxItem }
  | { type: 'resume'; title: string; sub?: string; resume: ResumePoint }
  | { type: 'arrival'; title: string; sub?: string; index: number; total: number; meal?: string }

export interface NextView extends Omit<NowView, 'action'> {
  action: NextAction
  /** Ein Satz: warum das gerade dran ist. Nur mit echten Daten, sonst leer. */
  reason?: string
}

export interface NextInput {
  plan: DayPlan
  log: DayLog | undefined
  m: number
  nowMs: number
  settings: Settings
  inbox: InboxItem[]
  work: WorkTask[]
  resume?: ResumePoint
}

/** Wiedereinstieg gilt nur am selben Tag und höchstens 8 Stunden. */
const RESUME_MAX_MS = 8 * 3600_000

const FIXED: NowAction['type'][] = ['sleep', 'night', 'wake', 'leave', 'pcoff', 'bed']

/** Wählt genau eine Handlung. Reihenfolge: Sicherheit und feste Zeiten, gefährdete Arbeit, Wiedereinstieg, Heutiges, Routine, Pause. */
export function nextAction(i: NextInput): NextView {
  const base = nowView(i.plan, i.log, i.m)
  const mode = currentMode(i.log)
  const view = (action: NextAction, reason?: string): NextView => ({ ...base, action, reason })
  const a = base.action
  const hardReason = base.hard && base.hard.at - i.m <= 60 && base.hard.at > i.m ? `Als Nächstes sinnvoll, weil um ${fmtTime(base.hard.at)} ${base.hard.label} ansteht.` : undefined

  // 1. Feste Zeiten, Termine und der Weg zur Arbeit: nie überlagern, schon gar nicht während der Fahrt
  if (FIXED.includes(a.type)) return view(a)
  if (base.block?.kind === 'event' || base.block?.kind === 'commute') return view(a)
  if (i.plan.dayType === 'sick') return view(a, hardReason)

  // 2. Berufliche Aufgabe mit echter Deadline-Gefahr
  const risky = openWork(i.work).find((w) => {
    const r = deadlineRisk(w, i.nowMs)
    return r === 'soon' || r === 'past'
  })
  if (risky) {
    const r = deadlineRisk(risky, i.nowMs)
    return view({ type: 'worktask', title: workStepText(risky), sub: risky.title !== workStepText(risky) ? risky.title : undefined, task: risky }, r === 'past' ? 'Die Frist ist erreicht. Ein kleiner nächster Schritt hilft trotzdem.' : 'Die Frist rückt näher, deshalb jetzt.')
  }

  // 3. Begonnene Aufgabe wieder aufnehmen
  const r = i.resume
  if (r && i.nowMs - r.at <= RESUME_MAX_MS && minutesOnPlanDay(i.plan.date, r.at) >= 0) {
    return view({ type: 'resume', title: r.nextStep?.trim() || r.title, sub: r.nextStep ? `Du warst bei: ${r.title}` : 'Hier warst du', resume: r }, 'Du warst gerade dabei.')
  }

  // Arbeitsblock: die wichtigste Aufgabe statt „Nichts zu tun“
  if (a.type === 'work') {
    const top = topWork(i.work)
    if (top) return view({ type: 'worktask', title: workStepText(top), sub: top.title !== workStepText(top) ? top.title : `Heute am wichtigsten · bis ${fmtTime(base.block?.end ?? i.m)}`, task: top }, top.deadline ? `Frist: ${new Date(top.deadline).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : undefined)
    return view(a)
  }

  // Morgens hat die Routine Vorrang, sonst gerät das Losgehen in Gefahr
  if (a.type === 'step' && a.routine === 'morning') return view(a, hardReason)

  // Ankommen nach der Arbeit: freiwillig, kurz, ohne Entscheidung
  const arrival = arrivalStep(i)
  if (arrival) return view(arrival)

  // 4. Heute fällige, bewusst geplante Aufgabe
  if (mode !== 'ueberlastet' && i.m < i.plan.pcStop) {
    const due = tasksFor(i.inbox, i.plan.date)[0]
    const win = suggestTaskWindow(i.plan, due?.estimateMin ?? DEFAULT_TASK_MIN)
    if (due && (!win || i.m >= win.start)) {
      return view({ type: 'task', title: due.text, sub: `Etwa ${due.estimateMin ?? DEFAULT_TASK_MIN} Minuten`, task: due }, 'Hast du dir für heute vorgenommen.')
    }
  }

  // 5. Routine, 7. Pause oder Freizeit. Beides ist in Ordnung.
  return view(a, a.type === 'step' ? hardReason : undefined)
}

function arrivalStep(i: NextInput): NextAction | undefined {
  const cfg = i.settings.support.arrival
  if (!cfg.enabled || !cfg.steps.length || i.plan.dayType !== 'work') return undefined
  const home = i.plan.blocks.find((b) => b.kind === 'evening-plan' || b.kind === 'evening-routine')?.start
  if (home === undefined || i.m < home || i.m > home + 60) return undefined
  const done = new Set(i.log?.arrival ?? [])
  const index = cfg.steps.findIndex((_, n) => !done.has(n))
  if (index < 0) return undefined
  return { type: 'arrival', title: cfg.steps[index]!, sub: `Ankommen · ${index + 1} von ${cfg.steps.length}`, index, total: cfg.steps.length, meal: suggestMeal(i.settings.meals, i.plan.date)?.title }
}

/** Gleicher Tag, gleiches Gericht. Nur aus eigenen Gerichten, jederzeit austauschbar. */
export function suggestMeal(meals: Meal[], date: DateStr, skip = 0): Meal | undefined {
  if (!meals.length) return undefined
  let h = 0
  for (let n = 0; n < date.length; n++) h = (h * 31 + date.charCodeAt(n)) >>> 0
  return meals[(h + skip) % meals.length]
}

// ---------- „Ich hänge fest“ ----------

const GENERIC_STEP: Record<string, string> = {
  wake: 'Setz dich auf.',
  leave: 'Zieh die Schuhe an.',
  work: 'Öffne das eine Dokument.',
  free: 'Steh auf und hol dir Wasser.',
  pcoff: 'Speichere, was offen ist.',
  bed: 'Geh ins Schlafzimmer.',
  info: 'Steh auf und hol dir Wasser.',
}

const SMALLER: Record<string, string> = {
  wake: 'Stell einen Fuß auf den Boden.',
  leave: 'Nimm einen Schuh in die Hand.',
  work: 'Leg die Hand auf die Maus.',
  free: 'Steh einmal auf.',
  pcoff: 'Drück Strg+S.',
  bed: 'Steh auf.',
  info: 'Steh einmal auf.',
}

/** Immer kleinere Schritte: zuerst 120 Sekunden, danach 30. Die erste Stufe ist die konkrete Handlung. */
export function stuckLadder(a: NextAction): { text: string; seconds: number }[] {
  if (a.type === 'step') {
    const first = a.step.minimal?.title ?? a.title
    return [
      { text: first, seconds: 120 },
      { text: `Stell dich dorthin, wo du „${a.title}“ machst.`, seconds: 30 },
    ]
  }
  if (a.type === 'worktask' || a.type === 'task' || a.type === 'resume') {
    return [
      { text: a.title, seconds: 120 },
      { text: 'Öffne nur, was du dafür brauchst.', seconds: 30 },
    ]
  }
  if (a.type === 'arrival') return [{ text: a.title, seconds: 120 }, { text: 'Steh auf.', seconds: 30 }]
  return [
    { text: GENERIC_STEP[a.type] ?? GENERIC_STEP.info!, seconds: 120 },
    { text: SMALLER[a.type] ?? SMALLER.info!, seconds: 30 },
  ]
}

// ---------- Fokus-Puls ----------

export interface PulseConfig {
  pulse: Settings['focus']['pulse']
  everyMin: number
  halfway: boolean
  lastMinute: boolean
}

/**
 * Soll jetzt ein Puls kommen? Aus = nie. Ruhezeiten und laufender Wecker schließen ihn aus.
 * Zeiten in Sekunden seit Schrittbeginn, `lastSec` ist die zuletzt geprüfte Sekunde.
 */
export function pulseDue(c: PulseConfig, elapsedSec: number, lastSec: number, totalSec: number, blocked: boolean): boolean {
  if (c.pulse === 'off' || blocked || elapsedSec <= lastSec) return false
  const crossed = (mark: number) => mark > 0 && lastSec < mark && elapsedSec >= mark
  const every = c.everyMin * 60
  if (Math.floor(elapsedSec / every) > Math.floor(lastSec / every)) return true
  if (c.halfway && crossed(totalSec / 2)) return true
  if (c.lastMinute && totalSec > 60 && crossed(totalSec - 60)) return true
  return false
}

export function inQuietHours(m: number, s: Settings): boolean {
  const x = ((m % 1440) + 1440) % 1440
  const { quietStart: a, quietEnd: b } = s.reminders
  return a <= b ? x >= a && x < b : x >= a || x < b
}

/** Restzeit aus einem gespeicherten Startzeitpunkt: Pausieren oder Neuöffnen setzt nichts zurück. */
export function remainingSec(startedAt: number, totalSec: number, nowMs: number): number {
  return Math.max(0, Math.round(totalSec - (nowMs - startedAt) / 1000))
}

// ---------- Tag neu sortieren ----------

/** Zeit verloren? Dann lohnt sich das Angebot. Nie als Fehler formuliert. */
export function isBehind(plan: DayPlan, log: DayLog | undefined, m: number): boolean {
  if (plan.dayType === 'sick' || log?.override.light) return false
  const open = (r: 'morning' | 'evening') => (plan.blocks.find((b) => b.routine === r)?.steps ?? []).some((s) => !log?.steps[`${r}:${s.id}`])
  const morning = plan.blocks.find((b) => b.routine === 'morning')
  if (morning && m > morning.end + 15 && m < (plan.workEnd ?? 18 * 60) && open('morning')) return true
  const evening = plan.blocks.find((b) => b.routine === 'evening')
  return !!evening && m > evening.end + 15 && m < plan.pcStop && open('evening')
}

export interface RescueItem {
  title: string
  when?: string
}

/** Höchstens drei Dinge ab jetzt: feste Zeit, wichtigste Arbeit, eine kleine Sache. Kein Aufhol-Stapel. */
export function rescueItems(i: NextInput): RescueItem[] {
  const out: RescueItem[] = []
  const hard = nowView(i.plan, i.log, i.m).hard
  if (hard) out.push({ title: hard.label, when: fmtTime(hard.at) })
  const top = topWork(i.work)
  const inWork = i.plan.workEnd !== undefined && i.m < i.plan.workEnd
  if (top && inWork) out.push({ title: workStepText(top) })
  const task = tasksFor(i.inbox, i.plan.date)[0]
  if (task && out.length < 3) out.push({ title: task.text })
  const evening = (i.plan.blocks.find((b) => b.routine === 'evening')?.steps ?? []).filter((s) => !i.log?.steps[`evening:${s.id}`])
  if (out.length < 3 && evening.some((s) => s.tag === 'teeth')) out.push({ title: 'Zähne putzen', when: 'heute Abend' })
  return out.slice(0, 3)
}
