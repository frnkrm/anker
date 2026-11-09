import { openSteps, routineCompleted, stepKey } from '../now'
import { addDays, todayBerlin, zonedToUtc, type DateStr } from '../time'
import type { DayLog, DayPlan, LocalData, Settings } from '../types'
import { guidancePreferences } from './settings'
import { remainingMs } from '../focus'
import type { GuidanceAlarmSnapshot, GuidanceView } from './types'

/** A strict morning gate never derives physical progress from elapsed time or skipped steps. */
export function genuineMorningCompleted(plan: DayPlan, log: DayLog | undefined): boolean {
  const steps = plan.blocks.find(block => block.routine === 'morning')?.steps ?? []
  return routineCompleted(plan, log, 'morning') && steps.length > 0
    && steps.every(step => ['done', 'minimal'].includes(log?.steps[stepKey('morning', step.id)] ?? ''))
}

export interface GuidanceInput {
  plan: DayPlan
  log?: DayLog
  local: LocalData
  settings: Settings
  alarm?: GuidanceAlarmSnapshot
  nowMs: number
}

/** An actual early alarm may activate the next morning before the ordinary 04:00 rollover. */
export function guidancePlanDate(local: LocalData, activeDate: DateStr, nowMs: number): DateStr {
  const wallDate = todayBerlin(nowMs)
  if (wallDate !== activeDate && wallDate !== addDays(activeDate, 1)) return activeDate
  const day = local.guidance?.days[wallDate]
  if (!day?.alarmOccurrenceId || day.morningActivatedAt === undefined || day.alarmAt === undefined
    || day.morningActivatedAt > nowMs || nowMs - day.morningActivatedAt >= 12 * 3600_000) return activeDate
  return wallDate
}

/** State is a projection of one existing plan plus actual confirmations, never a second schedule. */
export function deriveGuidance({ plan, log, local, settings, alarm, nowMs }: GuidanceInput): GuidanceView {
  const preferences = guidancePreferences(settings.guidance)
  const facts = local.guidance?.days ?? {}
  const day = facts[plan.date]
  const open = openSteps(plan, log, 'morning')
  const all = plan.blocks.find(block => block.routine === 'morning')?.steps ?? []
  const complete = genuineMorningCompleted(plan, log)
  const nightEntry = Object.entries(facts).filter(([, value]) => value.nightLockedAt !== undefined
    && value.nightLockedAt <= nowMs && nowMs - value.nightLockedAt < 18 * 3600_000)
    .sort((a, b) => b[1].nightLockedAt! - a[1].nightLockedAt!)[0]
  const night = nightEntry?.[1]
  const completedAt = Math.max(0, ...Object.entries(facts).filter(([date]) => !nightEntry || date > nightEntry[0])
    .map(([, value]) => value.morningCompletedAt !== undefined && value.morningCompletedAt <= nowMs ? value.morningCompletedAt : 0))
  const completeAfterNight = complete && !!nightEntry && plan.date > nightEntry[0]
  const unreleased = !!night?.nightLockedAt && night.nightLockedAt > completedAt && !completeAfterNight
  const emergency = (night?.emergencyUntil ?? 0) > nowMs
  const lockEnforced = preferences.enabled && preferences.pcLock && unreleased && !emergency
  const session = local.focus
  const target = session?.target
  const active = !!target && target.kind === 'routine' && target.date === plan.date
    && target.routine === 'morning' && open.some(step => step.id === target.stepId)
  const activated = day?.morningActivatedAt !== undefined && day.morningActivatedAt <= nowMs
  const morningEnd = plan.blocks.find(block => block.routine === 'morning')?.end ?? plan.wake
  const morningVisibleUntil = zonedToUtc(plan.date, Math.max(plan.wake + 120, morningEnd + 30))
  const currentMorning = (activated || active) && (!nightEntry || plan.date > nightEntry[0])
  const recentlyCompleted = day?.morningCompletedAt !== undefined && day.morningCompletedAt <= nowMs && nowMs - day.morningCompletedAt < 2 * 3600_000
  const morningVisible = nowMs < morningVisibleUntil || recentlyCompleted
  const morningAfterUnreleasedNight = unreleased && !!nightEntry && plan.date > nightEntry[0]
  const interactedSinceActivation = day?.firstInteractionAt !== undefined && day.morningActivatedAt !== undefined
    && day.firstInteractionAt >= day.morningActivatedAt && day.firstInteractionAt <= nowMs
  const autoZombieDue = preferences.enabled && preferences.autoZombie && activated && !complete && !interactedSinceActivation
    && (morningVisible || morningAfterUnreleasedNight)
    && !log?.override.zombie && nowMs - day.morningActivatedAt! >= preferences.autoZombieAfterSeconds * 1000
  const brainDumpIds = complete && currentMorning && morningVisible ? [...new Set([
    ...(facts[addDays(plan.date, -1)]?.brainDumpShownAt ? [] : facts[addDays(plan.date, -1)]?.brainDumpIds ?? []),
  ])].filter(id => local.tomorrowSteps.some(step => step.id === id && step.doneAt === undefined)) : []
  const effectiveComplete = complete && (!nightEntry || plan.date > nightEntry[0])
  const view: GuidanceView = { phase: 'DAY_ACTIVE', date: plan.date, lockEnforced, autoZombieDue, morningCompleted: effectiveComplete, brainDumpIds }
  if (active && session) view.remainingSeconds = Math.ceil(remainingMs(session.timer, nowMs) / 1000)
  if (open[0]) view.routineStep = { id: open[0].id, index: all.findIndex(step => step.id === open[0]!.id), total: all.length }
  if (alarm?.ringing) return { ...view, phase: 'ALARM_RINGING' }
  if (!preferences.enabled) return log?.override.zombie && active && morningVisible ? { ...view, phase: 'ZOMBIE_MODE' } : view
  if (complete && currentMorning && morningVisible) return { ...view, phase: 'MORNING_COMPLETED' }
  // Ein offener, alter Morgen bleibt wiederaufnehmbar, verdrängt aber keinen neuen Abend.
  if (currentMorning && morningVisible && !complete) return { ...view, phase: log?.override.zombie ? 'ZOMBIE_MODE' : active ? 'MORNING_ACTIVE' : 'MORNING_PENDING' }
  if (!complete && nowMs >= zonedToUtc(plan.date, plan.wake) && (nowMs < morningVisibleUntil || unreleased && !!nightEntry && plan.date > nightEntry[0])) {
    return { ...view, phase: log?.override.zombie ? 'ZOMBIE_MODE' : active ? 'MORNING_ACTIVE' : 'MORNING_PENDING' }
  }
  if (unreleased) return { ...view, phase: emergency ? 'DAY_ACTIVE' : 'NIGHT_LOCK' }
  // Ein bewusst beendeter oder für heute abgewählter Abend löst keine neue
  // Eskalation aus. Eine bereits bestätigte Nachtsperre bleibt davon unabhängig.
  if (log?.bedAt !== undefined || log?.dismissed?.includes('evening')) return view
  if (!preferences.eveningEscalation || plan.openEnd || plan.dayType === 'sick') return view
  const bedAt = zonedToUtc(plan.date, plan.bed)
  const remainingSeconds = Math.max(0, Math.ceil((bedAt - nowMs) / 1000))
  if (nowMs >= bedAt) return { ...view, phase: 'BEDTIME_HARD_CUT', remainingSeconds }
  if (nowMs >= bedAt - 10 * 60_000) return { ...view, phase: 'BRAIN_DUMP_T10', remainingSeconds }
  if (nowMs >= bedAt - 30 * 60_000) return { ...view, phase: 'WIND_DOWN_T30', remainingSeconds }
  if (settings.support.windDown.enabled && nowMs >= zonedToUtc(plan.date, settings.support.windDown.at)) return { ...view, phase: 'EVENING_WIND_DOWN', remainingSeconds }
  return view
}
