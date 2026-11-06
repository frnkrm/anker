// Reine Entscheidungslogik für die Alltagshilfe: Modi, flexible Aufgaben, nächste Aktion, Wiedereinstieg.
// Alles regelbasiert, erklärbar und offline. Keine Annahmen über Medikamente oder deren Wirkung.

import { nowView, type NowAction, type NowView } from './now'
import { fmtTime, minutesOnPlanDay, type DateStr } from './time'
import type { DayLog, DayPlan, InboxItem, Leg, Meal, ResumePoint, Settings, SupportMode, WorkSession, WorkSessionKind, WorkTask } from './types'
import { currentWorkActual, staleSession } from './worktime'
import { usableResume } from './recovery'
import { taskIsActionable, taskIsOpen, taskNextStep, taskPriority } from './tasks'

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
  return inbox.filter((x) => x.status === 'task' && taskIsOpen(x) && (x.taskDate ?? date) <= date)
    .sort((a, b) => Number(b.state === 'active') - Number(a.state === 'active') || taskPriority(b) - taskPriority(a) || (a.deadline ?? Infinity) - (b.deadline ?? Infinity) || (a.taskDate ?? '').localeCompare(b.taskDate ?? '') || a.createdAt - b.createdAt)
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
export function suggestTaskWindow(plan: DayPlan, minutes = DEFAULT_TASK_MIN, from?: number): TaskWindow | undefined {
  const fromBlock = plan.blocks.find((b) => b.kind === 'evening-plan' || b.kind === 'free' || b.kind === 'day' || b.kind === 'rest')
  if (!fromBlock) return undefined
  const firstEvening = plan.blocks.filter((b) => b.kind === 'free' || b.kind === 'evening-plan' || b.kind === 'day' || b.kind === 'rest')
  const blocked = plan.blocks.filter((b) => b.kind === 'event' || b.kind === 'commute' || b.kind === 'commitment' || b.kind === 'prep').sort((a, b) => a.start - b.start)
  let small: TaskWindow | undefined
  for (const b of firstEvening) {
    let start = Math.max(b.start, from ?? b.start)
    if (start >= b.end) continue
    for (const e of blocked) {
      if (e.end <= start || e.start >= b.end) continue
      if (e.start > start) {
        if (e.start - start >= minutes) return { start, end: start + minutes, fits: true }
        small ??= { start, end: e.start, fits: false }
        if (from !== undefined && start === from) return small
      }
      start = Math.max(start, e.end)
    }
    if (start + minutes <= b.end) return { start, end: start + minutes, fits: true }
    if (start < b.end) {
      small ??= { start, end: b.end, fits: false }
      if (from !== undefined && start === from) return small
    }
  }
  return small
}

// ---------- Berufliche Aufgaben ----------

export const MAX_WORK_VISIBLE = 3

export function openWork(work: WorkTask[]): WorkTask[] {
  return work.filter(taskIsOpen).sort((a, b) => Number(b.state === 'active') - Number(a.state === 'active') || taskPriority(b) - taskPriority(a))
}

/** Top-1 ist die erste offene Aufgabe in der vom Nutzer gewählten Reihenfolge. */
export function topWork(work: WorkTask[]): WorkTask | undefined {
  return openWork(work)[0]
}

export type DeadlineRisk = 'none' | 'soon' | 'today' | 'past'

/** Sachlich, ohne Vorwurf. Berücksichtigt die eigene Schätzung plus etwas Luft. */
export function deadlineRisk(w: WorkTask, nowMs: number): DeadlineRisk {
  if (!w.deadline || !taskIsOpen(w)) return 'none'
  const left = w.deadline - nowMs
  if (left <= 0) return 'past'
  const need = ((w.estimateMin ?? 30) + 30) * 60_000
  if (left <= need) return 'soon'
  if (left <= 12 * 3600_000) return 'today'
  return 'none'
}

export function workStepText(w: WorkTask): string {
  return taskNextStep(w, w.title)
}

// ---------- Nächste Aktion ----------

export type NextAction =
  | NowAction
  | { type: 'worktask'; title: string; sub?: string; task: WorkTask; focusMinutes?: number }
  | { type: 'task'; title: string; sub?: string; task: InboxItem; focusMinutes?: number }
  | { type: 'resume'; title: string; sub?: string; resume: ResumePoint }
  | { type: 'arrival'; title: string; sub?: string; index: number; total: number; meal?: string }
  | { type: 'prep'; title: string; sub?: string; leg: Leg }
  | { type: 'go'; title: string; sub?: string; leg: Leg }
  | { type: 'underway'; title: string; sub?: string; leg: Leg }
  | { type: 'away'; title: string; sub?: string; leg: Leg }
  | { type: 'return-check'; title: string; sub?: string }
  | { type: 'return-later'; title: string; sub?: string }
  | { type: 'work-break'; title: string; sub?: string; session: WorkSession }
  | { type: 'work-stale'; title: string; sub?: string; session: WorkSession }
  | { type: 'einsatz-start'; title: string; sub?: string; leg: Leg }
  | { type: 'einsatz-running'; title: string; sub?: string; session: WorkSession }

export interface NextView extends Omit<NowView, 'action'> {
  action: NextAction
  /** Ein Satz: warum das gerade dran ist. Nur mit echten Daten, sonst leer. */
  reason?: string
  estimatedMin?: number
  estimatedEndAt?: number
  alternative?: { title: string; reason: string }
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
  /** Erfasste Arbeitszeiten. Ohne sie bleibt alles wie geplant. */
  sessions?: WorkSession[]
  /** Freiwillige explizite Auswahl; keine automatische Ortsbestimmung. */
  context?: 'any' | 'home' | 'work' | 'errand'
}

export const SESSION_LABEL: Record<WorkSessionKind, string> = {
  regular: 'Arbeit',
  maintenance: 'Wartung',
  incident: 'Störung',
  onsite: 'Vor-Ort-Termin',
  other: 'Andere Arbeit',
}

const FIXED: NowAction['type'][] = ['sleep', 'night', 'wake', 'leave', 'pcoff', 'bed']

/** Wählt genau eine Handlung. Reihenfolge: Sicherheit und feste Zeiten, gefährdete Arbeit, Wiedereinstieg, Heutiges, Routine, Pause. */
export function nextAction(i: NextInput): NextView {
  const base = nowView(i.plan, i.log, i.m)
  const mode = currentMode(i.log)
  const view = (action: NextAction, reason?: string): NextView => ({ ...base, action, reason })
  let a = base.action
  const hardReason = base.hard && base.hard.at - i.m <= 60 && base.hard.at > i.m ? `Als Nächstes sinnvoll, weil um ${fmtTime(base.hard.at)} ${base.hard.label} ansteht.` : undefined

  const sessions = i.sessions ?? []
  const actual = currentWorkActual(sessions, i.plan.date, i.nowMs)
  // Ein geplanter Schlaf-/Aufstehhinweis beendet keinen bewusst gestarteten Abschnitt.
  // Ein wirklich klingelnder Wecker wird weiterhin vom nativen Alarmzustand angezeigt.
  const running = actual.unconfirmed ? undefined : actual.open
  const leg = legAction(i.plan, i.m, sessions)
  if (leg?.action.type === 'go') return view(leg.action, leg.reason)
  if ((a.type === 'sleep' || a.type === 'wake') && !running) return view(a)

  // Eine vergessene Sitzung wird angesprochen, aber nie selbst beendet: Das Ende kennst nur du
  const stale = staleSession(sessions, i.plan.date, i.nowMs)
  if (stale) return view({ type: 'work-stale', title: 'Läuft deine Arbeit noch?', sub: `Gestartet um ${fmtTime(minutesOnPlanDay(stale.date, stale.startAt))}. Trag einfach das Ende ein.`, session: stale })

  // Ein Termin läuft oder steht an: Er bestimmt den Moment, ohne weitere Fragen
  if (actual.open && actual.openBreak) {
    const since = fmtTime(minutesOnPlanDay(i.plan.date, actual.openBreak.startAt))
    return view({ type: 'work-break', title: 'Pause läuft', sub: actual.open.date === i.plan.date && i.plan.workEnd !== undefined ? `Seit ${since} · Feierabend ${i.plan.workInfo?.forecastLowerBound ? 'frühestens' : 'gerade etwa'} ${fmtTime(i.plan.workInfo?.forecastEnd ?? i.plan.workEnd)}` : `Seit ${since}`, session: actual.open })
  }
  if (actual.open && actual.open.kind !== 'regular') {
    return view({ type: 'einsatz-running', title: actual.open.label?.trim() || SESSION_LABEL[actual.open.kind], sub: `Läuft seit ${fmtTime(minutesOnPlanDay(i.plan.date, actual.open.startAt))}`, session: actual.open })
  }
  if (leg) return view(leg.action, leg.reason)
  if (running && a.type !== 'leave' && base.block?.kind !== 'event' && base.block?.kind !== 'commute') {
    a = { type: 'work', title: 'Arbeit läuft', sub: `Seit ${fmtTime(minutesOnPlanDay(running.date, running.startAt))}` }
  }
  if (!actual.open && i.plan.pendingEvening && i.m >= (i.plan.workEnd ?? 18 * 60) && !i.log?.override.backAt && i.log?.override.routineAt?.evening === 'return') {
    return i.log.override.returnCheckAfter !== undefined && i.m < i.log.override.returnCheckAfter
      ? view({ type: 'return-later', title: 'Dein Abend bleibt offen', sub: 'Die Routine wartet. Sag Bescheid, wenn du zurück bist.' })
      : view({ type: 'return-check', title: 'Bist du wieder zuhause?', sub: 'Dann schauen wir, was heute noch sinnvoll ist.' })
  }

  // 1. Feste Zeiten, Termine und der Weg zur Arbeit: nie überlagern, schon gar nicht während der Fahrt
  if (FIXED.includes(a.type)) return view(a)
  if (base.block?.kind === 'event' || base.block?.kind === 'commute') return view(a)
  if (i.plan.dayType === 'sick') return view(a, hardReason)

  // Freiwilliger Feierabend-Schutz: laufende Einsätze bleiben bedienbar, private Aufgaben unverändert.
  const quietWork = i.settings.support.workAfterHoursQuiet && !actual.open
    && (actual.closed || i.plan.workInfo?.closed || i.plan.workEnd === undefined || i.m >= i.plan.workEnd)

  const activeWork = quietWork ? undefined : openWork(i.work).find((task) => task.state === 'active')
  const activePrivate = tasksFor(i.inbox, i.plan.date).find((task) => task.state === 'active')

  // 2. Eine echte unmittelbar gefährdete Frist darf vorgehen; ein neuer optionaler Task nicht.
  const risky = quietWork ? undefined : openWork(i.work).filter((w) => {
    if (!taskIsActionable(w, i.nowMs)) return false
    const r = deadlineRisk(w, i.nowMs)
    if (r !== 'soon' && r !== 'past') return false
    if (activeWork && activeWork.id !== w.id && w.deadline! > i.nowMs + (w.estimateMin ?? 30) * 60_000) return false
    return true
  }).sort((a, b) => a.deadline! - b.deadline!)[0]
  const privateRisk = tasksFor(i.inbox, i.plan.date).filter((task) => taskIsActionable(task, i.nowMs) && task.deadline !== undefined
    && task.deadline - i.nowMs <= (task.estimateMin ?? DEFAULT_TASK_MIN) * 60_000).sort((a, b) => a.deadline! - b.deadline!)[0]
  if (privateRisk && (!risky || privateRisk.deadline! < risky.deadline!)) return taskView(i, base, privateRisk, false, 'Deine gewählte Frist rückt näher. Du entscheidest über den nächsten Schritt.')
  if (risky) {
    const r = deadlineRisk(risky, i.nowMs)
    return taskView(i, base, risky, true, r === 'past' ? 'Die Frist ist erreicht. Ein kleiner nächster Schritt hilft trotzdem.' : 'Die Frist rückt näher, deshalb jetzt.')
  }

  // 3. Begonnene Aufgabe wieder aufnehmen
  if (activeWork) return taskView(i, base, activeWork, true, 'Hier machst du gerade weiter.')
  if (activePrivate && !(a.type === 'step' && a.routine === 'morning')) return taskView(i, base, activePrivate, false, 'Hier machst du gerade weiter.')
  const r = usableResume(i.resume, i.inbox, i.work)
  if (r && !(quietWork && r.kind === 'work') && !(a.type === 'step' && a.routine === 'morning')) {
    return view({ type: 'resume', title: r.nextStep?.trim() || r.title, sub: r.nextStep ? `Du warst bei: ${r.title}` : 'Hier warst du', resume: r }, 'Du warst gerade dabei.')
  }

  // Arbeitsblock: die wichtigste Aufgabe statt „Nichts zu tun“
  if (a.type === 'work') {
    const candidates = openWork(i.work).filter((task) => taskIsActionable(task, i.nowMs))
    const top = candidates.find((task) => taskContextFits(i, task) && !(mode === 'wenig-energie' && task.energy === 'high')) ?? candidates[0]
    if (top) return taskView(i, base, top, true, top.deadline ? `Frist: ${new Date(top.deadline).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : undefined)
    return view(a)
  }

  // Morgens hat die Routine Vorrang, sonst gerät das Losgehen in Gefahr
  if (a.type === 'step' && a.routine === 'morning') return view(a, hardReason)

  // Ankommen nach der Arbeit: freiwillig, kurz, ohne Entscheidung
  const arrival = arrivalStep(i)
  if (arrival) return view(arrival)

  // 4. Heute fällige, bewusst geplante Aufgabe
  if (mode !== 'ueberlastet' && i.m < i.plan.pcStop) {
    const candidates = tasksFor(i.inbox, i.plan.date).filter((task) => taskIsActionable(task, i.nowMs))
    const due = candidates.find((task) => taskContextFits(i, task) && !(mode === 'wenig-energie' && task.energy === 'high')) ?? candidates[0]
    const win = suggestTaskWindow(i.plan, due?.estimateMin ?? DEFAULT_TASK_MIN, i.m)
    if (due && win && i.m >= win.start && i.m < win.end) {
      return taskView(i, base, due, false, 'Hast du dir für heute vorgenommen.')
    }
  }

  // 5. Routine, 7. Pause oder Freizeit. Beides ist in Ordnung.
  return view(a, a.type === 'step' ? hardReason : undefined)
}

function taskContextFits(i: NextInput, task: InboxItem | WorkTask): boolean {
  if (!task.context || task.context === 'any') return true
  if (i.context && i.context !== 'any') return i.context === task.context
  const working = i.plan.blocks.some((block) => block.kind === 'work' && block.start <= i.m && i.m < block.end)
    || !!currentWorkActual(i.sessions ?? [], i.plan.date, i.nowMs).open
  return working && (task.context === 'work' || (task.context === 'home' && i.plan.homeOffice))
}

function taskView(i: NextInput, base: NowView, task: InboxItem | WorkTask, work: boolean, reason?: string): NextView {
  const title = 'text' in task ? task.text : task.title
  const estimate = task.estimateMin ?? (work ? 30 : DEFAULT_TASK_MIN)
  const hard = i.plan.hardTimes.filter((time) => time.at > i.m).sort((a, b) => a.at - b.at)[0]?.at
  const window = work ? undefined : suggestTaskWindow(i.plan, estimate, i.m)
  const end = Math.min(hard ?? Infinity, task.deadline === undefined ? Infinity : minutesOnPlanDay(i.plan.date, task.deadline), work ? (base.block?.end ?? Infinity) : (window?.end ?? Infinity))
  const available = Math.max(0, end - i.m)
  const context = taskContextFits(i, task)
  const small = available < estimate || !context || (currentMode(i.log) === 'wenig-energie' && task.energy === 'high')
  const minutes = Math.max(1, Math.min(small ? 2 : estimate, Number.isFinite(available) ? available : estimate))
  const step = taskNextStep(task, title)
  const action: NextAction = work
    ? { type: 'worktask', title: step, sub: title !== step ? title : `Grob geschätzt ${estimate} Minuten`, task: task as WorkTask, focusMinutes: Math.min(25, minutes) }
    : { type: 'task', title: step, sub: title !== step ? title : `Grob geschätzt ${estimate} Minuten`, task: task as InboxItem, focusMinutes: Math.min(25, minutes) }
  return { ...base, action, estimatedMin: minutes, estimatedEndAt: i.nowMs + minutes * 60_000,
    reason: !context ? `${reason ? reason + ' ' : ''}Der Aufgabenkontext ist noch nicht bestätigt. Du kannst ihn unter Plan & Optionen wählen oder später anfangen.`
      : available < estimate ? `${reason ? reason + ' ' : ''}Für die ganze Aufgabe wird es bis zum nächsten festen Punkt eng. Ein kleiner Anfang ist möglich.` : reason,
    ...(small ? { alternative: { title: 'Später oder kleiner anfangen', reason: 'Die Aufgabe bleibt offen; du entscheidest.' } } : {}),
  }
}

function legSub(l: Leg): string | undefined {
  const parts: string[] = []
  if (l.travelMin) parts.push(`Fahrt etwa ${l.travelMin} min (deine Schätzung)`)
  if (l.travelOpen) parts.push('Fahrzeit noch offen')
  if (l.items.length) parts.push(l.items.slice(0, 3).join(', '))
  return parts.join(' · ') || undefined
}

/** Was ein Termin gerade verlangt. Undefined, wenn keiner dran ist. Das Ende wird nie erfunden. */
function legAction(plan: DayPlan, m: number, sessions: WorkSession[]): { action: NextAction; reason?: string } | undefined {
  for (const l of plan.legs ?? []) {
    const c = l.commitment
    if (c.backAt !== undefined || c.workKind === 'oncall') continue
    const linked = c.workKind ? sessions.find((x) => x.commitmentId === c.id) : undefined
    // Ein Einsatz ohne Weg ist nach dem Beenden vorbei, auch wenn das geplante Ende noch aussteht
    if (linked?.endAt !== undefined && !l.toLabel) continue
    const startsAt = l.prepStart ?? l.leave ?? c.start
    if (m < startsAt) continue
    const ended = c.end !== undefined && m >= c.end + (l.returnMin ?? 0)
    if (ended) continue
    const offerStart = !!c.workKind && !linked
    if (offerStart && !l.toLabel) return { action: { type: 'einsatz-start', title: c.label, sub: `Geplant ab ${fmtTime(c.start)}`, leg: l } }
    if (m >= c.start || c.arrivedAt) {
      if (l.toLabel && c.leftAt && !c.arrivedAt && m < c.start + 60) return { action: { type: 'underway', title: `Unterwegs zu ${c.label}`, leg: l } }
      if (offerStart) return { action: { type: 'einsatz-start', title: c.label, sub: `Geplant ab ${fmtTime(c.start)}`, leg: l } }
      return { action: { type: 'away', title: c.label, sub: c.end !== undefined ? `Bis ${fmtTime(c.end)}` : 'Melde dich einfach, wenn du wieder da bist.', leg: l } }
    }
    if (c.leftAt) return { action: { type: 'underway', title: `Unterwegs zu ${c.label}`, sub: `Um ${fmtTime(c.start)} dort`, leg: l } }
    if (l.leave !== undefined && m >= l.leave) return { action: { type: 'go', title: `Los zu ${c.label}`, sub: legSub(l), leg: l }, reason: `Dann bist du um ${fmtTime(c.start)} da.` }
    return { action: { type: 'prep', title: `Fertig machen für ${c.label}`, sub: legSub(l), leg: l }, reason: l.leave !== undefined ? `Um ${fmtTime(l.leave)} solltest du los.` : `Um ${fmtTime(c.start)} geht es los.` }
  }
  return undefined
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
  if (a.type === 'worktask' || a.type === 'task' || a.type === 'resume' || a.type === 'einsatz-start' || a.type === 'einsatz-running') {
    return [
      { text: a.title, seconds: 120 },
      { text: 'Öffne nur, was du dafür brauchst.', seconds: 30 },
    ]
  }
  if (a.type === 'arrival') return [{ text: a.title, seconds: 120 }, { text: 'Steh auf.', seconds: 30 }]
  if (a.type === 'prep' || a.type === 'go') return [{ text: 'Zieh die Schuhe an.', seconds: 120 }, { text: 'Nimm den Schlüssel in die Hand.', seconds: 30 }]
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
