import { coalesceAsync } from '../core/coalesced'
import { guidancePlanDate, guidancePreferences } from '../core/guidance'
import { openSteps } from '../core/now'
import { todayBerlin } from '../core/time'
import { planFor, today, useApp } from '../state/store'
import { AnkerNative, isNative } from './native'
import { scanQr } from './qr'
import { requestPcEmergencyExtension, syncPcBridge } from './pcLink'

let handoffWork: Promise<boolean> | undefined
const deliveredHandoffs = new Set<string>()

/** Android owns the receipt; it is acknowledged only after the complete Store transaction. */
export function completeMorningAlarmHandoff(): Promise<boolean> {
  if (handoffWork) return handoffWork
  handoffWork = (async () => {
    if (!isNative()) return false
    const st = useApp.getState()
    const preferences = guidancePreferences(st.settings.guidance)
    if (!st.ready || !preferences.enabled || !preferences.zeroGapMorning) return false
    const receipt = await AnkerNative.getMorningHandoff()
    if (!receipt.pending) return false
    if (!receipt.token || !Number.isSafeInteger(receipt.targetAt) || !Number.isSafeInteger(receipt.at)) throw new Error('Der Morgenübergang ist noch nicht lesbar.')
    const saved = await useApp.getState().activateMorningFromAlarm({ occurrenceId: String(receipt.targetAt), targetDate: todayBerlin(receipt.targetAt!), alarmAt: receipt.targetAt!, confirmedAt: receipt.at! })
    if (!saved) return false
    // A failed native ACK may be retried, but must never keep redirecting an already-open app.
    const firstDelivery = !deliveredHandoffs.has(receipt.token)
    deliveredHandoffs.add(receipt.token)
    try { await AnkerNative.ackMorningHandoff({ token: receipt.token }) } catch { /* Durable Store state is already safe. */ }
    return firstDelivery
  })().finally(() => { handoffWork = undefined })
  return handoffWork
}

export const resumeGuidanceHandoff = completeMorningAlarmHandoff
/** Only for the once-per-launch entry coordinator; later explicit widget taps remain usable. */
export const hasHandledMorningHandoff = (): boolean => deliveredHandoffs.size > 0

export async function confirmBedtimeByQr(): Promise<boolean> {
  const st = useApp.getState()
  const preferences = guidancePreferences(st.settings.guidance)
  if (!preferences.enabled || !preferences.bedtimeQr) return false
  if (!isNative()) { st.showToast('Der Anker-Code lässt sich auf deinem Android-Handy scannen.'); return false }
  const result = await scanQr()
  if (!result.ok) { st.showToast(result.reason === 'cancelled' ? 'Der Abendübergang bleibt offen.' : 'Der QR-Scanner ist gerade nicht bereit. Die Optionen bleiben erreichbar.'); return false }
  if (result.value !== useApp.getState().settings.alarm.qrSecret) { st.showToast('Das ist nicht dein Anker-Code.'); return false }
  await useApp.getState().verifyBedtime(today(), crypto.randomUUID())
  if (guidancePreferences(useApp.getState().settings.guidance).sleepNoise) {
    try { await startSleepNoise() } catch { st.showToast('Abendübergang gespeichert. Das Schlafrauschen konnte noch nicht starten.') }
  }
  // A missing PC must not turn a successfully saved local confirmation into a failure.
  void syncGuidanceRuntime().catch(() => undefined)
  return true
}

export async function requestEmergencyExtensionByQr(minutes: number): Promise<boolean> {
  const st = useApp.getState()
  const preferences = guidancePreferences(st.settings.guidance)
  if (!isNative() || !preferences.enabled || !preferences.pcLock) { st.showToast('Die QR-Verlängerung gehört zur eingeschalteten PC-Begleitung auf Android.'); return false }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw new Error('Wähle zwischen 1 und 120 Minuten.')
  const result = await scanQr()
  if (!result.ok) return false
  // The native bridge verifies the QR hash and signs with its non-exportable hardware key.
  const confirmed = await requestPcEmergencyExtension(result.value, minutes)
  if (!confirmed) st.showToast('Noch keine Bestätigung vom PC. Die Verlängerung ist dort noch nicht bestätigt.')
  return confirmed
}

export async function startSleepNoise(): Promise<void> {
  const st = useApp.getState()
  const preferences = guidancePreferences(st.settings.guidance)
  if (!isNative() || !preferences.enabled || !preferences.sleepNoise) throw new Error('Schlafrauschen ist auf Android nach deiner Wahl verfügbar.')
  let state = await AnkerNative.startSleepAudio({ durationMinutes: preferences.sleepNoiseMinutes, volume: 0.25 })
  for (let attempt = 0; !state.active && !state.error && state.phase === 'prepared' && attempt < 12; attempt++) {
    await new Promise<void>(resolve => setTimeout(resolve, 100))
    state = await AnkerNative.getSleepAudioState()
  }
  if (state.error || !state.active) throw new Error('Das Schlafrauschen konnte noch nicht starten.')
}

export async function stopSleepNoise(): Promise<void> {
  if (isNative()) await AnkerNative.stopSleepAudio()
}

export async function confirmMorningActivity(): Promise<void> {
  const st = useApp.getState()
  const preferences = guidancePreferences(st.settings.guidance)
  if (!isNative() || !preferences.enabled || !preferences.antiRelapse) return
  const now = Date.now()
  const date = guidancePlanDate(st.local, today(), now)
  await st.recordGuidanceInteraction(date, now)
  const pending = await AnkerNative.getMorningHandoff()
  if (pending.activityToken) {
    const confirmed = await AnkerNative.confirmMorningActivity({ token: pending.activityToken })
    if (!confirmed.confirmed) throw new Error('Der Wach-Check ist nicht mehr aktuell.')
  }
}

let paceKey = ''
let disabledAudio = false
let sleepDisabled = false
let activityToken = ''

const syncNativeGuidance = coalesceAsync(async () => {
  const st = useApp.getState()
  if (!isNative() || !st.ready || !st.settings.onboarded) return
  const preferences = guidancePreferences(st.settings.guidance)
  if (!preferences.enabled) {
    if (!disabledAudio) {
      await Promise.all([AnkerNative.stopRoutinePaceKeeper({}), AnkerNative.stopSleepAudio()])
      disabledAudio = true; paceKey = ''; activityToken = ''
    }
    return
  }
  disabledAudio = false
  if (!preferences.sleepNoise && !sleepDisabled) {
    await AnkerNative.stopSleepAudio()
    sleepDisabled = true
  } else if (preferences.sleepNoise) sleepDisabled = false
  const now = Date.now()
  const date = guidancePlanDate(st.local, today(), now)
  const focus = st.local.focus
  const target = focus?.target
  const step = target?.kind === 'routine' && target.date === date
    ? openSteps(planFor(date, st), st.days[date], target.routine).find(value => value.id === target.stepId) : undefined
  const enabled = !!focus && !!step && (preferences.paceKeeper || preferences.speakSteps)
  const payload = enabled && focus && target?.kind === 'routine' && step ? {
    enabled: true, sessionId: `routine:${date}:${target.routine}:${st.local.guidance?.days[date]?.alarmOccurrenceId ?? 'manual'}`,
    stepId: step.id, title: target.minimal && step.minimal ? step.minimal.title : step.title,
    durationMs: focus.timer.durationMs, deadlineAt: focus.timer.status === 'running' ? focus.timer.deadlineAt : 0,
    status: focus.timer.status, intervalSeconds: preferences.paceIntervalMin * 60,
    hapticsEnabled: preferences.paceKeeper, thresholds: preferences.paceThresholds,
    speakStep: preferences.speakSteps, strength: 'gentle' as const,
    quietStart: st.settings.reminders.quietStart, quietEnd: st.settings.reminders.quietEnd,
  } : { enabled: false }
  const key = JSON.stringify(payload)
  if (key !== paceKey) {
    await AnkerNative.syncRoutinePaceKeeper(payload)
    paceKey = key
  }
  // Only an actual user action can satisfy this guard; an automatic countdown/Zombie switch cannot.
  const day = st.local.guidance?.days[date]
  if (preferences.antiRelapse && day?.firstInteractionAt && day.morningActivatedAt !== undefined && day.firstInteractionAt >= day.morningActivatedAt) {
    const pending = await AnkerNative.getMorningHandoff()
    if (pending.activityToken && pending.activityToken !== activityToken) {
      const result = await AnkerNative.confirmMorningActivity({ token: pending.activityToken })
      if (result.confirmed) activityToken = pending.activityToken
    }
  }
})

/** PC transport cannot delay local routine/alarm work. Each subsystem retains its own queue. */
export async function syncGuidanceRuntime(): Promise<void> {
  const results = await Promise.allSettled([syncNativeGuidance(), syncPcBridge()])
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (rejected) throw rejected.reason
}
