import { buildPcStopCommands } from '../pcStop'
import { deriveGuidance, eveningLightMinute } from '../guidance'
import { addDays, zonedToUtc } from '../time'
import type { DayLog, DayPlan, LocalData, Settings } from '../types'
import type { PcBriefingPayload, PcLinkPreferences, PcStatePayload } from './types'
import { canonicalJson } from './crypto'
import { parsePcPayload, pcTextPreview } from './validation'

export function pcRevision(value: unknown): string {
  let hash = 2166136261
  const input = canonicalJson(value)
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619)
  return `pc3:${(hash >>> 0).toString(16)}`
}
const iso = (value: number): string => new Date(value).toISOString()

/** These are projections of existing choices, never a second set of PC schedules. */
function wirePreferences(settings: Settings, prefs: PcLinkPreferences): PcLinkPreferences {
  return { ...prefs, singleTransition: settings.support.windDown.enabled && prefs.singleTransition === true,
    bedAfterStopMin: Math.min(settings.sleep.screenOffMin, 30) }
}

function eveningTimes(plan: DayPlan, settings: Settings, prefs: PcLinkPreferences) {
  if (plan.openEnd) return { windDownAt: null, brainDumpAt: null }
  const bed = zonedToUtc(plan.date, plan.bed)
  // Match the existing reminder's 04:00 plan-day boundary, including DST.
  const chosen = settings.support.windDown.at
  return { windDownAt: prefs.singleTransition ? iso(zonedToUtc(plan.date, chosen < 240 ? chosen + 1440 : chosen)) : iso(bed - 30 * 60000),
    brainDumpAt: prefs.singleTransition ? null : iso(bed - 10 * 60000) }
}

/** Uses exactly the existing phone planner and v2 dated PC commands, with no desktop replanning. */
export function buildPcBriefing(plans: readonly DayPlan[], settings: Settings, prefs: PcLinkPreferences, nowMs: number): PcBriefingPayload {
  prefs = wirePreferences(settings, prefs)
  const selected = plans.slice(0, 14)
  const commands = buildPcStopCommands(selected)
  const days = selected.map((plan, index) => {
    const pc = commands[index]!
    const bedAt = zonedToUtc(plan.date, plan.bed)
    const morningPlan = plans.find((candidate) => candidate.date === addDays(plan.date, 1))
    const wakeAt = zonedToUtc(addDays(plan.date, 1), morningPlan?.wake ?? settings.anchor.wake)
    const times = eveningTimes(plan, settings, prefs)
    const day: PcBriefingPayload['days'][number] = {
      date: plan.date, validUntil: pc.validUntil,
      ...(eveningLightMinute(plan, settings) === undefined ? {} : { lightHintAt: iso(zonedToUtc(plan.date, eveningLightMinute(plan, settings)!)) }),
      pc: pc.mode === 'paused' ? { mode: 'paused' } : { mode: 'scheduled', stopAt: pc.stopAt, localTime: pc.localTime },
      ...(!plan.openEnd ? { bedAt: iso(bedAt), wakeAt: iso(wakeAt), windDownAt: times.windDownAt!, ...(times.brainDumpAt === null ? {} : { brainDumpAt: times.brainDumpAt }), morningDeadlineAt: iso(wakeAt + 3 * 3600000) } : {}),
    }
    if (prefs.morningCountdown && morningPlan) day.morning = { homeOffice: morningPlan.homeOffice, ...(morningPlan.leave === undefined ? {} : { leaveAt: iso(zonedToUtc(morningPlan.date, morningPlan.leave)) }), ...(morningPlan.workInfo ? { workStartAt: iso(zonedToUtc(morningPlan.date, morningPlan.workInfo.plannedStart)) } : {}) }
    return day
  })
  const result: PcBriefingPayload = { type: 'briefing', revision: pcRevision({ days, prefs }), generatedAt: iso(nowMs), validUntil: days.at(-1)?.validUntil ?? iso(nowMs + 60000), days, prefs }
  parsePcPayload(result)
  return result
}

/** Session/phase facts extend the current schedule; no routine/task titles enter the transport. */
export function buildPcState(input: { plan: DayPlan; log?: DayLog; local: LocalData; settings: Settings; prefs: PcLinkPreferences; nowMs: number; nextPlan?: DayPlan; alarm?: { ringing: boolean; kind?: string | null } }): PcStatePayload {
  const { plan, local, settings, nowMs } = input
  const prefs = wirePreferences(settings, input.prefs)
  const view = deriveGuidance(input)
  const nights = Object.entries(local.guidance?.days ?? {}).filter(([, d]) => d.nightLockedAt !== undefined && d.nightLockedAt <= nowMs && nowMs - d.nightLockedAt < 18 * 3600000).sort((a, b) => b[1].nightLockedAt! - a[1].nightLockedAt!)
  const night = nights[0]
  const sessionId = night ? `night:${night[0]}:${night[1].nightLockedAt}` : `day:${plan.date}`
  // UI completion cards may have disappeared at lunch; genuine completion still
  // releases the same prior-night session after a delayed PC reconnect.
  const state = night && plan.date > night[0] && view.morningCompleted ? 'MORNING_COMPLETED' : view.phase
  const evening = !plan.openEnd
  const bedAt = evening ? zonedToUtc(plan.date, plan.bed) : null
  // A latched night keeps its actual next morning across the 04:00 plan change.
  // Before that change an early ringing alarm still belongs to the next plan;
  // after it NIGHT_LOCK alone must not move wakeAt another day into the future.
  const isMorning = night ? plan.date > night[0]
    : ['MORNING_PENDING', 'MORNING_ACTIVE', 'MORNING_COMPLETED', 'ALARM_RINGING', 'ZOMBIE_MODE'].includes(state)
  const morningPlan = isMorning ? plan : input.nextPlan?.date === addDays(plan.date, 1) ? input.nextPlan : undefined
  const wakeAt = zonedToUtc(isMorning ? plan.date : addDays(plan.date, 1), morningPlan?.wake ?? settings.anchor.wake)
  const deadline = wakeAt + 3 * 3600000
  // A reconnect must never move the original night lease into another evening.
  const validUntil = night ? night[1].nightLockedAt! + 18 * 3600000 : Math.min(nowMs + 18 * 3600000, Math.max(nowMs + 60000, deadline))
  const schedule: PcStatePayload['schedule'] = {
    ...(eveningLightMinute(plan, settings, input.log) === undefined ? {} : { lightHintAt: iso(zonedToUtc(plan.date, eveningLightMinute(plan, settings, input.log)!)) }),
    ...eveningTimes(plan, settings, prefs), bedAt: bedAt === null ? null : iso(bedAt), wakeAt: iso(wakeAt), morningDeadlineAt: iso(deadline),
    pcStopAt: evening ? iso(zonedToUtc(plan.date, plan.pcStop)) : null,
    ...(prefs.morningCountdown && morningPlan ? { homeOffice: morningPlan.homeOffice, ...(morningPlan.workInfo ? { workStartAt: iso(zonedToUtc(morningPlan.date, morningPlan.workInfo.plannedStart)) } : {}), ...(morningPlan.leave === undefined ? {} : { leaveAt: iso(zonedToUtc(morningPlan.date, morningPlan.leave)) }) } : {}),
  }
  const shareIds = view.brainDumpIds.length ? view.brainDumpIds : state === 'MORNING_COMPLETED' ? night?.[1].brainDumpIds ?? [] : []
  const share = prefs.shareBrainDump && shareIds.length ? local.tomorrowSteps.find((step) => step.id === shareIds[0]) : undefined
  const body = { state, sessionId, date: plan.date, routineStep: view.routineStep ? { index: view.routineStep.index, total: view.routineStep.total } : null, lockEnforced: view.lockEnforced && prefs.enforceEnabled, schedule, prefs, ...(share ? { brainDump: { text: pcTextPreview(share.title), nextStep: pcTextPreview(share.nextStep) } } : {}) }
  const result: PcStatePayload = { type: 'state', ...body, revision: pcRevision(body), generatedAt: iso(nowMs), validUntil: iso(validUntil), remainingSeconds: Math.min(64800, view.remainingSeconds ?? Math.max(0, Math.ceil(((bedAt ?? nowMs) - nowMs) / 1000))) }
  parsePcPayload(result)
  return result
}
