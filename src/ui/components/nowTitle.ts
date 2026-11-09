import type { NextAction } from '../../core/support'
import type { DayPlan } from '../../core/types'

/** Keep capture context and the visible Now headline in the same words. */
export function nowActionTitle(action: Pick<NextAction, 'type' | 'title'>, plan: Pick<DayPlan, 'openEnd' | 'bed'>, minutes: number): string {
  return !plan.openEnd && minutes >= plan.bed && ['bed', 'night', 'sleep'].includes(action.type) ? 'Ab ins Bett' : action.title
}
