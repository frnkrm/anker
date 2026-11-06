import { currentBlock, nextHardTime, previousHardTime } from './planner'
import { addDays, fmtTime, minutesOnPlanDay, type DateStr } from './time'
import type { Block, DayLog, DayPlan, HardTime, PlannedStep, RoutineId } from './types'

/** Bis 4 Uhr morgens gilt noch der Plan des Vortags (Bettzeit nach Mitternacht). */
export const DAY_ROLLOVER_MIN = 4 * 60

export function activePlanDate(nowMs: number, today: (ms: number) => DateStr): DateStr {
  const d = today(nowMs)
  return minutesOnPlanDay(d, nowMs) < DAY_ROLLOVER_MIN ? addDays(d, -1) : d
}

export type NowAction =
  | { type: 'sleep'; title: string; sub?: string }
  | { type: 'wake'; title: string; sub?: string }
  | { type: 'step'; title: string; sub?: string; routine: RoutineId; step: PlannedStep; index: number; total: number }
  | { type: 'leave'; title: string; sub?: string }
  | { type: 'work'; title: string; sub?: string }
  | { type: 'info'; title: string; sub?: string; block?: Block }
  | { type: 'free'; title: string; sub?: string; canExtend: boolean }
  | { type: 'pcoff'; title: string; sub?: string }
  | { type: 'bed'; title: string; sub?: string }
  | { type: 'night'; title: string; sub?: string }

export interface NowView {
  action: NowAction
  block?: Block
  hard?: HardTime
  /** 0..1, wie viel Zeit bis zur nächsten harten Zeit schon verstrichen ist */
  elapsed: number
}

export function stepKey(r: RoutineId, id: string): string {
  return `${r}:${id}`
}

export function openSteps(plan: DayPlan, log: DayLog | undefined, r: RoutineId): PlannedStep[] {
  const b = plan.blocks.find((x) => x.routine === r)
  return (b?.steps ?? []).filter((s) => !log?.steps[stepKey(r, s.id)])
}

/** Wurde die Routine wirklich gemacht? Weggelassene und bewusst entfallene Schritte zählen nicht als Handlung. */
export function routineCompleted(plan: DayPlan, log: DayLog | undefined, r: RoutineId): boolean {
  const b = plan.blocks.find((x) => x.routine === r)
  if (!b?.steps?.length || openSteps(plan, log, r).length) return false
  return b.steps.some((s) => {
    const v = log?.steps[stepKey(r, s.id)]
    return v === 'done' || v === 'minimal'
  })
}

export function routineDone(plan: DayPlan, log: DayLog | undefined, r: RoutineId): boolean {
  const b = plan.blocks.find((x) => x.routine === r)
  return !!b?.steps?.length && openSteps(plan, log, r).length === 0
}

function stepAction(plan: DayPlan, log: DayLog | undefined, r: RoutineId): NowAction | undefined {
  const b = plan.blocks.find((x) => x.routine === r)
  const steps = b?.steps ?? []
  const open = openSteps(plan, log, r)
  const step = open[0]
  if (!step) return undefined
  const index = steps.indexOf(step)
  const title = step.useMinimal && step.minimal ? step.minimal.title : step.title
  return {
    type: 'step',
    title,
    sub: `${r === 'morning' ? 'Morgenroutine' : 'Abendroutine'} · Schritt ${index + 1} von ${steps.length}`,
    routine: r,
    step,
    index,
    total: steps.length,
  }
}

/** Beantwortet „Was mache ich JETZT?“ – genau eine Aktion. Reine Funktion. */
export function nowView(plan: DayPlan, log: DayLog | undefined, m: number): NowView {
  const hard = nextHardTime(plan, m)
  const from = previousHardTime(plan, m)
  const elapsed = hard ? Math.min(1, Math.max(0, (m - from) / Math.max(1, hard.at - from))) : 1
  const block = currentBlock(plan, m)
  const view = (action: NowAction): NowView => ({ action, block, hard, elapsed })
  const t = fmtTime
  const sick = plan.dayType === 'sick'

  if (m < plan.wake - 30 || (!plan.openEnd && m >= plan.bed + 120)) {
    return view(m >= plan.bed ? { type: 'night', title: 'Gute Nacht', sub: 'Schlaf ist heute dein wichtigster Schritt.' } : { type: 'sleep', title: 'Schlafen', sub: `Aufstehen um ${t(plan.wake)}` })
  }
  if (!log?.wakeAt && !sick && m < plan.wake + 120) {
    return view({ type: 'wake', title: 'Aufstehen', sub: m < plan.wake ? `Um ${t(plan.wake)}` : 'Füße auf den Boden. Jetzt.' })
  }

  // Morgen: bis zum Losgehen (bzw. Ende Morgenblock + 30 min am freien Tag)
  const morning = plan.blocks.find((b) => b.routine === 'morning')
  const later = morning !== undefined && morning.start > plan.wake + 1 && !plan.blocks.some((b) => b.kind === 'sport')
  const started = !!plan.workInfo?.started
  const readyAt = plan.homeOffice && plan.workInfo ? plan.workInfo.plannedStart : undefined
  const morningUntil = later ? morning!.end + 30 : (plan.leave ?? readyAt ?? (morning ? morning.end + 30 : plan.wake))
  if (!started && m < morningUntil && (!later || m >= morning!.start)) {
    const a = stepAction(plan, log, 'morning')
    if (a) return view(a)
  }
  if (plan.leave !== undefined && !started && !log?.leftAt && m >= plan.leave - 20 && m < plan.leave + 45) {
    return view({ type: 'leave', title: m < plan.leave ? `Losgehen um ${t(plan.leave)}` : 'Jetzt losgehen', sub: 'Schlüssel, Handy, Tasche.' })
  }

  const evening = plan.blocks.find((b) => b.routine === 'evening')
  if (evening && m >= evening.start && m < Math.max(plan.pcStop + 30, evening.end + 30)) {
    const a = stepAction(plan, log, 'evening')
    if (a) return view(a)
  }

  if (m >= plan.bed && !plan.openEnd) {
    return view(log?.bedAt ? { type: 'night', title: 'Gute Nacht', sub: 'Morgen früh klingelt der Anker.' } : { type: 'bed', title: 'Ab ins Bett', sub: 'Handy weg, Licht aus.' })
  }
  if (m >= plan.pcStop && !sick && !plan.openEnd) {
    return view(log?.pcOffAt ? { type: 'info', title: 'Runterkommen', sub: `Bett um ${t(plan.bed)}. Lesen, Musik, Dehnen.` } : { type: 'pcoff', title: 'PC aus', sub: 'Bildschirme aus, der Tag ist geschafft.' })
  }

  if (!block) return view({ type: 'info', title: 'Kurz durchatmen', sub: hard ? `${hard.label} um ${t(hard.at)}` : undefined })
  switch (block.kind) {
    case 'work':
      return view({ type: 'work', title: block.title, sub: `Bis ${t(block.end)}` })
    case 'free':
      return view({ type: 'free', title: 'Freizeit – zocken erlaubt', sub: `Bis ${t(plan.pcStop)}`, canExtend: !(log?.override.pcStopExtendMin ?? 0) })
    case 'commute':
      return view({ type: 'info', title: block.title, sub: `Bis ${t(block.end)}`, block })
    default:
      return view({ type: 'info', title: block.title, sub: `Bis ${t(block.end)}`, block })
  }
}

interface WidgetView extends Pick<NowView, 'block' | 'hard'> {
  action: { type: string; title: string; sub?: string }
}

const WIDGET_ACTIONS: Record<string, string> = {
  task: 'Deine Aufgabe', worktask: 'Arbeit weiterführen', resume: 'Wieder einsteigen',
  arrival: 'Ankommen', prep: 'Termin vorbereiten', go: 'Losgehen', underway: 'Unterwegs', away: 'Termin',
  'return-check': 'Wieder zuhause?', 'work-break': 'Pause läuft', 'work-stale': 'Arbeitszeit prüfen',
  'einsatz-start': 'Arbeitseinsatz starten', 'einsatz-running': 'Arbeitseinsatz läuft',
}
const BASE_WIDGET_ACTIONS = new Set(['sleep', 'wake', 'step', 'leave', 'work', 'info', 'free', 'pcoff', 'bed', 'night'])

/** Gleiche Handlungsauswahl wie Jetzt; private Inhalte bleiben unabhängig vom Actiontyp in der App. */
export function widgetEntry(at: number, v: WidgetView) {
  const privateBlock = !!v.block && ['commitment', 'prep', 'travel', 'event', 'session'].includes(v.block.kind)
  const label = Object.hasOwn(WIDGET_ACTIONS, v.action.type) ? WIDGET_ACTIONS[v.action.type] : undefined
  const unknown = !label && !BASE_WIDGET_ACTIONS.has(v.action.type)
  return {
    at,
    action: label ?? (privateBlock ? 'Termin' : unknown ? 'Anker öffnen' : v.action.title),
    sub: label || privateBlock || unknown ? '' : (v.action.sub ?? ''),
    hardLabel: v.hard?.key === 'commitment' || v.hard?.label.startsWith('Los:') ? 'Losgehen' : (v.hard?.label ?? ''),
    hardTime: v.hard ? fmtTime(v.hard.at) : '',
  }
}
