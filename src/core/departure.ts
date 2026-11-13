import { activePlanDate, openSteps } from './now'
import { stepMinutes } from './planner/fit'
import { todayBerlin, zonedToUtc } from './time'
import type { DayLog, DayPlan, Leg } from './types'

export interface DepartureReadiness {
  label: string
  leave?: number
  /** Real elapsed minutes, including Berlin's clock changes. Negative stays overdue. */
  remainingMin?: number
  preparationMin: number
  openSteps: number
  openItems: number
  durationOpen: boolean
  journeyOpen: boolean
  bufferMin?: number
}

type Candidate = { id: string; label: string; leave?: number; anchor: number; leg?: Leg }
const durationKnown = (value: number) => Number.isFinite(value) && value >= 0

/** Projection of the existing plan and explicit facts; never plans or completes anything. */
export function departureReadiness(plan: DayPlan, log: DayLog | undefined, nowMs: number): DepartureReadiness | undefined {
  if (!Number.isFinite(nowMs) || plan.date !== activePlanDate(nowMs, todayBerlin)) return undefined
  const facts = log?.date === plan.date ? log : undefined
  const at = (minute: number) => zonedToUtc(plan.date, minute)
  const candidates: Candidate[] = []
  for (const leg of plan.legs ?? []) {
    const c = leg.commitment
    if (c.date !== plan.date || c.status === 'cancelled' || c.workKind === 'oncall'
      || c.leftAt !== undefined || c.arrivedAt !== undefined || c.backAt !== undefined
      || c.locationKind === 'remote' || leg.fromKey === leg.toKey && leg.fromKey !== undefined
      || c.end !== undefined && at(c.end) <= nowMs) continue
    // An unknown location/journey is displayed honestly, not converted into a departure.
    if (leg.leave === undefined && !leg.travelOpen && !leg.locationOpen && !leg.originOpen) continue
    const anchor = leg.leave ?? c.start
    if (!Number.isFinite(anchor)) continue
    candidates.push({ id: `commitment:${c.id}`, label: c.label, leave: leg.leave, anchor, leg })
  }
  // Only the planner's actual outbound commute, never its return journey or a duplicated morning leg.
  if (!plan.homeOffice && plan.leave !== undefined && Number.isFinite(plan.leave)
    && facts?.leftAt === undefined && !plan.workInfo?.started && !plan.workInfo?.closed
    && (plan.workEnd === undefined || at(plan.workEnd) > nowMs)
    && plan.blocks.some(b => b.kind === 'commute' && b.start === plan.leave)) {
    candidates.push({ id: 'work', label: 'Zur Arbeit', leave: plan.leave, anchor: plan.leave })
  }
  const target = candidates.sort((a, b) => at(a.anchor) - at(b.anchor))[0]
  if (!target) return undefined

  const usesMorning = target.id === 'work' || plan.morningAnchors?.[0]?.id === target.id
  const steps = usesMorning ? openSteps(plan, facts, 'morning') : []
  const durations = steps.map(stepMinutes)
  // The planner already removes prepIncludesMorning overlap in this block.
  const prep = target.leg ? plan.blocks.find(b => b.id === `prep:${target.leg!.commitment.id}`) : undefined
  if (prep) durations.push(prep.end - prep.start)
  const preparationMin = durations.filter(durationKnown).reduce((sum, value) => sum + value, 0)
  const openItems = target.leg?.items.filter(item => !target.leg!.commitment.preparedItems?.includes(item)).length ?? 0
  const durationOpen = durations.some(value => !durationKnown(value)) || openItems > 0 && !prep
  const journeyOpen = target.leg?.travelOpen === true || target.leg?.locationOpen === true || target.leg?.originOpen === true
  const remainingMin = target.leave === undefined ? undefined : (at(target.leave) - nowMs) / 60_000
  return {
    label: target.label, leave: target.leave, remainingMin, preparationMin,
    openSteps: steps.length, openItems, durationOpen, journeyOpen,
    bufferMin: remainingMin !== undefined && !durationOpen && !journeyOpen ? remainingMin - preparationMin : undefined,
  }
}
