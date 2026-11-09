import type { DayLog, DayPlan, Settings } from '../types'
import { guidancePreferences } from './settings'

/** One existing-plan offset, not a second evening schedule. Broader transitions replace this hint. */
export function eveningLightMinute(plan: DayPlan, settings: Settings, log?: DayLog): number | undefined {
  const preferences = guidancePreferences(settings.guidance)
  if (!preferences.enabled || !preferences.eveningLight || settings.support.windDown.enabled || preferences.eveningEscalation
    || plan.openEnd || plan.dayType === 'sick' || log?.bedAt !== undefined || log?.dismissed?.includes('evening')) return undefined
  return Math.max(240, plan.bed - preferences.eveningLightLeadMinutes)
}
