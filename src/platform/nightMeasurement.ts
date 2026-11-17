import { dailyMeasurementDecision } from '../core/nightMeasurement'
import { activePlanDate } from '../core/now'
import { todayBerlin, zonedToUtc } from '../core/time'
import { coalesceAsync } from '../core/coalesced'
import { planFor, useApp } from '../state/store'
import { AnkerNative, isNative } from './native'
import { syncAlarm } from './alarm'

/** Bewusster gemeinsamer Einstieg für Jetzt, Wecker und Bettbestätigung. */
export async function startNightMeasurement(): Promise<void> {
  const st = useApp.getState()
  if (!isNative() || !st.settings.alarm.smartWake.enabled) throw new Error('Aktiviere die Nachtmessung in der Android-App unter Schlaf & Wecker.')
  await collectSleepEstimate()
  await syncAlarm()
  if (!useApp.getState().alarmStatus?.ok) throw new Error('Prüfe zuerst den festen Wecker. Die Messung wurde nicht gestartet.')
  await AnkerNative.startSmartWake({ lockScreen: st.settings.alarm.smartWake.lockOnStart === true, estimateOnset: st.settings.sleep.onsetEstimationEnabled === true })
}

export async function markBedAndStartMeasurement(date: string): Promise<void> {
  await useApp.getState().mark(date, 'bedAt')
  if (isNative() && useApp.getState().settings.alarm.smartWake.enabled) {
    try { await startNightMeasurement() }
    catch { useApp.getState().showToast('Bettzeit gespeichert. Die Messung läuft noch nicht – prüfe den Messstatus auf Jetzt.') }
  }
}

let attemptedTarget = 0
export async function collectSleepEstimate(): Promise<void> {
  if (!isNative()) return
  const state = await AnkerNative.getSmartWakeState()
  const at = state.estimatedOnsetAt
  if (!at || !Number.isFinite(at) || at > Date.now()) return
  const date = activePlanDate(at, todayBerlin), old = useApp.getState().local.sleepDiary[date]?.onset
  if (old && (old.at !== at || old.status !== 'estimated' || !state.estimateInvalidated)) return
  await useApp.getState().recordSleepEstimate(date, at, state.estimateInvalidated === true)
}
/** Ausschließlich bei sichtbarer App; im Hintergrund erinnert der vorhandene Scheduler. */
export const reconcileDailyMeasurement = coalesceAsync(async () => {
  const before = useApp.getState()
  if (isNative() && before.settings.onboarded) await collectSleepEstimate()
  if (!isNative() || !before.settings.onboarded || before.settings.alarm.smartWake.autoDaily !== true
    || typeof document === 'undefined' || document.visibilityState !== 'visible') return
  const now = Date.now(), date = activePlanDate(now, todayBerlin), plan = planFor(date, before)
  const state = await AnkerNative.getSmartWakeState(), alarm = await AnkerNative.getAlarmState()
  if (before.settings !== useApp.getState().settings || document.visibilityState !== 'visible') return
  const targetAt = alarm.scheduledAt ?? 0
  if (attemptedTarget === targetAt) return
  const decision = dailyMeasurementDecision({ settings: before.settings, now, bedAt: zonedToUtc(date, plan.bed), targetAt,
    active: state.active, lastTargetAt: state.targetAt, foreground: true, microphoneGranted: state.microphoneGranted, alarmRinging: alarm.ringing })
  if (decision !== 'start-visible') return
  attemptedTarget = targetAt
  await AnkerNative.startSmartWake({ lockScreen: before.settings.alarm.smartWake.lockOnStart === true, estimateOnset: before.settings.sleep.onsetEstimationEnabled === true })
})
