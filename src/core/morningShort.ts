import { departureReadiness } from './departure'
import { openSteps } from './now'
import { shorterSteps, stepMinutes } from './planner/fit'
import type { DayLog, DayPlan } from './types'

export interface MorningShortOffer {
  revision: string
  changes: { id: string; title: string; shortTitle: string; minutes: number; shortMinutes: number }[]
  preparationMin: number
  shortPreparationMin: number
  savingMin: number
  stillTight: boolean
}

/** No new plan: proposes existing morning variants only when the current departure is tight. */
export function morningShortOffer(plan: DayPlan, log: DayLog | undefined, nowMs: number): MorningShortOffer | undefined {
  const facts = log?.date === plan.date ? log : undefined
  if (facts?.override.shortMorning) return undefined
  const view = departureReadiness(plan, facts, nowMs)
  if (!view || view.bufferMin === undefined || view.bufferMin >= 0 || view.remainingMin === undefined
    || view.remainingMin <= 0 || !view.openSteps) return undefined
  const open = openSteps(plan, facts, 'morning')
  const shorter = shorterSteps(open)
  const changes = open.flatMap((step, index) => {
    const short = shorter[index]!
    return stepMinutes(short) < stepMinutes(step) ? [{
      id: step.id, title: step.title, shortTitle: short.minimal!.title,
      minutes: stepMinutes(step), shortMinutes: stepMinutes(short),
    }] : []
  })
  const savingMin = changes.reduce((sum, change) => sum + change.minutes - change.shortMinutes, 0)
  if (savingMin <= 0) return undefined
  const shortPreparationMin = view.preparationMin - savingMin
  return {
    // Clock ticks may change urgency but not the accepted content. Eligibility is rechecked at write time.
    revision: JSON.stringify([plan, facts?.steps ?? {}, facts?.override ?? {}]), changes,
    preparationMin: view.preparationMin, shortPreparationMin, savingMin,
    stillTight: shortPreparationMin > view.remainingMin,
  }
}
