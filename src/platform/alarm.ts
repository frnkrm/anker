import { buildAlarmConfig } from '../core/alarm'
import { useApp, today } from '../state/store'
import { AnkerNative, isNative, type AlarmStateInfo } from './native'

function statusFrom(st: AlarmStateInfo, enabled: boolean) {
  if (!enabled) return { ok: true }
  if (st.scheduledAt && st.mainConfirmed) {
    return st.error === 'exact_denied'
      ? { ok: false, scheduledAt: st.scheduledAt, message: 'Android erlaubt gerade keine exakten Wecker. Der Wecker kann sich verspäten.' }
      : { ok: true, scheduledAt: st.scheduledAt }
  }
  return { ok: false, message: 'Der nächste Wecker ist von Android nicht bestätigt.' }
}

/**
 * Überträgt die Konfiguration an den nativen Wecker. Der plant selbst, auch ohne geöffnete App.
 * Kritisch und deshalb nicht über safe(): Ein Fehler wird im Store sichtbar und auf der Startseite gezeigt.
 */
export async function syncAlarm() {
  if (!isNative()) return
  const st = useApp.getState()
  if (!st.settings.onboarded) return
  try {
    const state = await AnkerNative.syncAlarmConfig(buildAlarmConfig(st.settings, st.days, today()))
    st.setAlarmStatus(statusFrom(state, st.settings.alarm.enabled))
  } catch (e) {
    console.warn('[Anker] Weckerplanung fehlgeschlagen')
    st.setAlarmStatus({ ok: false, message: e instanceof Error && e.message ? e.message : 'Der Wecker konnte nicht geplant werden.' })
  }
}

export function makeMathTask(seed = Math.random): { q: string; a: number } {
  const a = 12 + Math.floor(seed() * 38)
  const b = 6 + Math.floor(seed() * 19)
  return seed() < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} − ${b}`, a }
}
