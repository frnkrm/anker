import { departureReadinesses } from '../departure'
import { openSteps } from '../now'
import { stepMinutes } from '../planner/fit'
import { zonedToUtc } from '../time'
import type { DayLog, DayPlan, Settings } from '../types'

/** Dated projection only. The weekly baseline must never contain progress-dependent hints. */
export function preparationImpulses(plan: DayPlan, log: DayLog | undefined, settings: Settings) {
  const facts = log?.date === plan.date ? log : undefined
  return departureReadinesses(plan, facts, zonedToUtc(plan.date, 240)).map(view => {
    const validUntil = view.leave === undefined ? undefined : zonedToUtc(plan.date, view.leave)
    const reserve = settings.travel.activationMin
    const known = validUntil !== undefined && !view.durationOpen && !view.journeyOpen
      && Number.isFinite(reserve) && reserve >= 0
    const open = view.openSteps > 0 || view.openItems > 0 || view.preparationMin > 0
    const usesMorning = view.targetId === 'work' || plan.morningAnchors?.[0]?.id === view.targetId
    const steps = usesMorning ? openSteps(plan, facts, 'morning').map(step => [step.id, stepMinutes(step)]) : []
    const leg = plan.legs?.find(l => `commitment:${l.commitment.id}` === view.targetId)
    return {
      targetId: view.targetId, validUntil,
      // The arrival buffer is already included in leave. Only the existing activation reserve is added.
      at: known && open ? validUntil - Math.max(10, view.preparationMin + reserve) * 60_000 : undefined,
      open, known,
      revisionFacts: [steps, leg?.commitment.preparedItems, view.preparationMin, view.openItems],
    }
  })
}
