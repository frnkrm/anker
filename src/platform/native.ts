import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { NativeAlarmConfig } from '../core/alarm'

export type AlarmKindWire = 'main' | 'snooze' | 'prewake' | 'wakecheck' | 'test'

export interface SmartWakeState {
  active: boolean
  phase: 'idle' | 'waiting' | 'measuring' | 'triggered' | 'finished' | 'stopped' | 'interrupted' | 'error'
  message: string
  targetAt: number
  windowAt: number
  hasMotion: boolean
  microphoneGranted: boolean
  preWakePausedForTargetAt?: number
}

export interface AlarmStateInfo {
  ringing: boolean
  kind?: AlarmKindWire | null
  scheduledAt?: number | null
  preWakeAt?: number | null
  preWakePausedForTargetAt?: number
  snoozeAt?: number | null
  wakeCheckAt?: number | null
  testAt?: number | null
  snoozed: number
  /** Android hat einen PendingIntent für den Hauptwecker */
  mainConfirmed?: boolean
  preWakeConfirmed?: boolean
  exact?: boolean
  error?: string
}

export interface AlarmDiagnostics extends AlarmStateInfo {
  systemNextAt?: number | null
  notificationsEnabled: boolean
  channelImportance: number
  channelBypassDnd: boolean
  /** NotificationManager.INTERRUPTION_FILTER_*: 1 = alles erlaubt */
  interruptionFilter: number
  dndAccess: boolean
  fullScreen: boolean
  batteryIgnored: boolean
  powerSave: boolean
  alarmVolume: number
  alarmVolumeMax: number
  bluetooth: boolean
  wired: boolean
  audioOk: boolean
  testResult: '' | 'scheduled' | 'rang' | 'heard' | 'not-heard' | 'failed'
  testResultAt: number
  lastStopMethod: string
  lastStopAt: number
  lastTimeoutAt: number
  missedMainAt: number
  lastReconcileAt: number
  lastReconcileReason: string
  reminderQueue: number
  reminderHorizon: number
  remindersVisible: number
  sdk: number
  device: string
}

export interface NativeReminder {
  key: string
  date: string
  at: number
  channel: string
  title: string
  body: string
  actions: boolean
  slot: number
  rank: number
  exact: boolean
}

export interface ReminderActionInfo {
  action: 'done' | 'skip'
  key: string
  date: string
  at: number
}

/** Eigenes Kotlin-Plugin (android/app/src/main/java/.../AnkerNativePlugin.kt). */
export interface AnkerNativePlugin {
  /** Konfiguration für den nativen Wecker. Kotlin plant damit jeden nächsten Morgen selbst. */
  syncAlarmConfig(c: NativeAlarmConfig): Promise<AlarmStateInfo>
  getAlarmState(): Promise<AlarmStateInfo>
  getSmartWakeState(): Promise<SmartWakeState>
  startSmartWake(): Promise<void>
  stopSmartWake(): Promise<void>
  /** Klingeln beenden. method erscheint nur in der eigenen Diagnose. */
  stopAlarm(o: { method: string }): Promise<AlarmStateInfo>
  /** Einmal schlummern. ok=false, wenn schon geschlummert wurde oder es kein Hauptwecker ist. */
  snoozeAlarm(o: { minutes: number }): Promise<{ ok: boolean }>
  /** Eigener Alarm, berührt weder Hauptwecker noch Vorwecker noch Schlummer-Regel */
  testAlarm(o: { seconds: number }): Promise<{ at: number }>
  confirmTest(o: { heard: boolean }): Promise<void>
  playTestTone(): Promise<{ ok: boolean }>
  getAlarmDiagnostics(): Promise<AlarmDiagnostics>
  syncReminders(o: { reminders: NativeReminder[]; relevant: string[] }): Promise<void>
  drainReminderActions(): Promise<{ actions: ReminderActionInfo[] }>
  /** Öffnet den Android-Druckdialog. opened=false, wenn das System ihn nicht zeigen konnte. */
  printPage(o: { jobName: string; size: 'A5' | 'A4' }): Promise<{ opened: boolean }>
  vibratePulse(o: { strength: 'gentle' | 'strong' }): Promise<void>
  canUseFullScreenIntent(): Promise<{ granted: boolean }>
  openFullScreenIntentSettings(): Promise<void>
  openExactAlarmSettings(): Promise<void>
  openAlarmChannelSettings(): Promise<void>
  openFocusSettings(): Promise<void>
  isIgnoringBatteryOptimizations(): Promise<{ granted: boolean }>
  openBatteryOptimizationSettings(): Promise<void>
  hasDndAccess(): Promise<{ granted: boolean }>
  openDndSettings(): Promise<void>
  openAppSettings(): Promise<void>
  /** Einträge: ab `at` (UTC ms) zeigt das Widget diesen Text. */
  updateWidget(o: { entries: { at: number; action: string; sub: string; hardLabel: string; hardTime: string }[] }): Promise<void>
  isWidgetPlaced(): Promise<{ placed: boolean }>
  addListener(event: 'alarmRinging' | 'reminderAction', fn: () => void): Promise<PluginListenerHandle>
}

// Im Web gibt es keinen Wecker: nur still antworten, nie so tun, als wäre etwas geplant
const web: Partial<AnkerNativePlugin> = {
  async syncAlarmConfig() {
    return { ringing: false, snoozed: 0 }
  },
  async getAlarmState() {
    return { ringing: false, snoozed: 0 }
  },
  async stopAlarm() {
    return { ringing: false, snoozed: 0 }
  },
  async snoozeAlarm() {
    return { ok: false }
  },
  async drainReminderActions() {
    return { actions: [] }
  },
  async syncReminders() {},
  async vibratePulse({ strength }) {
    navigator.vibrate?.(strength === 'strong' ? [140, 120, 140] : [60, 120, 60])
  },
  async canUseFullScreenIntent() {
    return { granted: false }
  },
  async openFullScreenIntentSettings() {},
  async openExactAlarmSettings() {},
  async openAlarmChannelSettings() {},
  async openFocusSettings() {},
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
