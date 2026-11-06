import { alarmPlanningStatus, buildAlarmConfig, type AlarmPlanningStatus } from '../core/alarm'
import { coalesceAsync } from '../core/coalesced'
import { useApp, today } from '../state/store'
import { AnkerNative, isNative } from './native'

/**
 * Überträgt die Konfiguration an den nativen Wecker. Der plant selbst, auch ohne geöffnete App.
 * Kritisch und deshalb nicht über safe(): Ein Fehler wird im Store sichtbar und auf der Startseite gezeigt.
 */
const reconcileAlarm = coalesceAsync(async () => {
  if (!isNative()) return
  // Auch ein direkter Aufruf aus den Weckeroptionen darf einen laufenden Abgleich nicht überholen.
  for (;;) {
    const st = useApp.getState()
    const date = today()
    if (!st.settings.onboarded) return
    let status: AlarmPlanningStatus
    try {
      const state = await AnkerNative.syncAlarmConfig(buildAlarmConfig(st.settings, st.days, date))
      status = alarmPlanningStatus(state, st.settings.alarm.enabled)
    } catch (e) {
      console.warn('[Anker] Weckerplanung fehlgeschlagen')
      status = { ok: false, message: e instanceof Error && e.message ? e.message : 'Der Wecker konnte nicht geplant werden.' }
    }
    const current = useApp.getState()
    if (current.settings !== st.settings || current.days !== st.days || today() !== date) continue
    current.setAlarmStatus(status)
    return
  }
})

export function syncAlarm(): Promise<void> {
  return reconcileAlarm()
}

export function makeMathTask(seed = Math.random): { q: string; a: number } {
  const a = 12 + Math.floor(seed() * 38)
  const b = 6 + Math.floor(seed() * 19)
  return seed() < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} − ${b}`, a }
}
