import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** Eigenes Kotlin-Plugin (android/app/src/main/java/.../AnkerNativePlugin.kt). */
export interface AnkerNativePlugin {
  /** Wecker zur festen Zeit (AlarmManager.setAlarmClock, Vollbild-Alarm) */
  scheduleAlarm(o: { at: number; label: string }): Promise<void>
  cancelAlarm(): Promise<void>
  /** Klingeln beenden (nach QR-Scan oder Rechenaufgaben) */
  stopAlarm(): Promise<void>
  /** Einmal 5 Minuten schlummern. ok=false, wenn schon geschlummert wurde. */
  snoozeAlarm(o: { minutes: number }): Promise<{ ok: boolean }>
  getAlarmState(): Promise<{ ringing: boolean; scheduledAt?: number; snoozed: number }>
  canUseFullScreenIntent(): Promise<{ granted: boolean }>
  openFullScreenIntentSettings(): Promise<void>
  isIgnoringBatteryOptimizations(): Promise<{ granted: boolean }>
  openBatteryOptimizationSettings(): Promise<void>
  hasDndAccess(): Promise<{ granted: boolean }>
  openDndSettings(): Promise<void>
  openAppSettings(): Promise<void>
  /** Einträge: ab `at` (UTC ms) zeigt das Widget diesen Text. */
  updateWidget(o: { entries: { at: number; action: string; sub: string; hardLabel: string; hardTime: string }[] }): Promise<void>
  isWidgetPlaced(): Promise<{ placed: boolean }>
  addListener(event: 'alarmRinging', fn: () => void): Promise<PluginListenerHandle>
}

const web: Partial<AnkerNativePlugin> = {
  async scheduleAlarm() {},
  async cancelAlarm() {},
  async stopAlarm() {},
  async snoozeAlarm() {
    return { ok: true }
  },
  async getAlarmState() {
    return { ringing: false, snoozed: 0 }
  },
  async canUseFullScreenIntent() {
    return { granted: false }
  },
  async openFullScreenIntentSettings() {},
  async isIgnoringBatteryOptimizations() {
    return { granted: false }
  },
  async openBatteryOptimizationSettings() {},
  async hasDndAccess() {
    return { granted: false }
  },
  async openDndSettings() {},
  async openAppSettings() {},
  async updateWidget() {},
  async isWidgetPlaced() {
    return { placed: false }
  },
}

export const AnkerNative = registerPlugin<AnkerNativePlugin>('AnkerNative', {
  web: () => web as AnkerNativePlugin,
})

export const isNative = () => Capacitor.isNativePlatform()

/** Führt eine optionale Plattform-Funktion aus. Fehler werden geschluckt, die App läuft weiter. */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.warn('[Anker] optionale Funktion fehlgeschlagen:', e)
    return fallback
  }
}
