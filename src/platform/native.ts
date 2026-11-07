import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { NativeAlarmConfig } from '../core/alarm'
import type { NativeReminderRuleSnapshot } from '../core/reminders/rules'
import type { ReminderAction } from '../core/reminders/actions'
import type { ReminderPolicy } from '../core/reminders/build'
import type { PaperSize, PrintDocumentSheet } from '../core/print'
import type { GeofenceSnapshot, GeofenceStatus, GeofenceSuggestion, GeofenceVisit } from '../core/geofences'

export type { GeofenceStatus, GeofenceSuggestion } from '../core/geofences'

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
  reminderRuleCount?: number
  reminderRulesFrom?: number
  reminderDelivery?: ReminderDeliveryDiagnostics
  sdk: number
  device: string
}

export type ReminderChannelId = 'sanft' | 'uebergang' | 'wecker'
export interface ReminderDeliveryDiagnostics {
  /** importance=-1: noch nicht angelegt;0: von Android blockiert. */
  channels: { id: ReminderChannelId; importance: number; blocked: boolean }[]
  nextAt: number
  nextChannel: string
  focusUntil: number
  quietUntil: number
  planQuietUntil: number
  storedSlots: number
  /** Von Android als aktiv geführt; -1 bei fehlender Auskunft. Kein Hör-/Wahrnehmungsnachweis. */
  activeNotifications: number
  lastSyncAt: number
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
  revision: string
  token: string
  critical: boolean
  ruleId?: string
}

export type ReminderActionInfo = ReminderAction

export interface VoiceCapabilities { dictationSupported: boolean; speechSupported: boolean | null; localOnly: boolean }
export interface VoiceResult { status: 'text' | 'cancelled' | 'unavailable' | 'permission-denied' | 'busy' | 'empty' | 'timeout' | 'spoken'; text?: string }

export type NativeGeofenceVisit = GeofenceVisit
export interface GeofenceState extends GeofenceStatus { suggestions: GeofenceSuggestion[] }

/** Eigenes Kotlin-Plugin (android/app/src/main/java/.../AnkerNativePlugin.kt). */
export interface AnkerNativePlugin {
  getVoiceCapabilities(): Promise<VoiceCapabilities>
  startDictation(): Promise<VoiceResult>
  stopDictation(): Promise<void>
  speakCue(o: { text: string }): Promise<VoiceResult>
  stopSpeaking(): Promise<void>
  syncGeofences(o: GeofenceSnapshot): Promise<GeofenceStatus>
  getGeofenceState(): Promise<GeofenceState>
  ackGeofenceSuggestions(o: { ids: string[] }): Promise<void>
  requestGeofencePermission(o: { kind: 'foreground' | 'background' }): Promise<{ fineGranted: boolean; backgroundGranted: boolean; settingsOpened?: boolean }>
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
  syncReminders(o: { reminders: NativeReminder[]; relevant: string[]; revisions: Record<string, string>; policy?: ReminderPolicy; ruleSnapshot?: NativeReminderRuleSnapshot }): Promise<void>
  drainReminderActions(): Promise<{ actions: ReminderActionInfo[] }>
  ackReminderActions(o: { ids: string[] }): Promise<void>
  setReminderFocus(o: { until: number }): Promise<void>
  /** Öffnet den Android-Druckdialog. opened=false, wenn das System ihn nicht zeigen konnte. */
  printPage(o: { jobName: string; size: PaperSize; fontScale: number; sheets: PrintDocumentSheet[] }): Promise<{ opened: boolean }>
  /** Local PDF export, also when Android's print service is unavailable. */
  exportPrintPdf(o: { size: PaperSize; fontScale: number; sheets: PrintDocumentSheet[] }): Promise<{ uri: string; pages: number }>
  vibratePulse(o: { strength: 'gentle' | 'strong' }): Promise<void>
  canUseFullScreenIntent(): Promise<{ granted: boolean }>
  openFullScreenIntentSettings(): Promise<void>
  openExactAlarmSettings(): Promise<void>
  openAlarmChannelSettings(): Promise<void>
  openReminderChannelSettings(o: { channel: ReminderChannelId }): Promise<void>
  openFocusSettings(): Promise<{ opened: boolean; destination: 'dnd' | 'settings' | 'unavailable' }>
  isIgnoringBatteryOptimizations(): Promise<{ granted: boolean }>
  openBatteryOptimizationSettings(): Promise<void>
  hasDndAccess(): Promise<{ granted: boolean }>
  openDndSettings(): Promise<void>
  openAppSettings(): Promise<void>
  /** Einträge: ab `at` (UTC ms) zeigt das Widget diesen Text. */
  updateWidget(o: { entries: { at: number; action: string; sub: string; hardLabel: string; hardTime: string }[]; generatedAt: number; expiresAt: number }): Promise<void>
  isWidgetPlaced(): Promise<{ placed: boolean }>
  addListener(event: 'alarmRinging' | 'reminderAction', fn: () => void): Promise<PluginListenerHandle>
}

// Im Web gibt es keinen Wecker: nur still antworten, nie so tun, als wäre etwas geplant
const web: Partial<AnkerNativePlugin> = {
  async getVoiceCapabilities() { return { dictationSupported: false, speechSupported: false, localOnly: true } },
  async startDictation() { return { status: 'unavailable' } },
  async stopDictation() {},
  async speakCue() { return { status: 'unavailable' } },
  async stopSpeaking() {},
  async syncGeofences() { return { registered: 0, fineGranted: false, backgroundGranted: false, error: 'unavailable' } },
  async getGeofenceState() { return { registered: 0, fineGranted: false, backgroundGranted: false, error: 'unavailable', suggestions: [] } },
  async ackGeofenceSuggestions() {},
  async requestGeofencePermission() { return { fineGranted: false, backgroundGranted: false, settingsOpened: false } },
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
  async ackReminderActions() {},
  async setReminderFocus() {},
  async syncReminders() {},
  async vibratePulse({ strength }) {
    navigator.vibrate?.(strength === 'strong' ? [140, 120, 140] : [60, 120, 60])
  },
  async canUseFullScreenIntent() {
    return { granted: false }
  },
  async openFullScreenIntentSettings() {},
  async openReminderChannelSettings() {},
  async openExactAlarmSettings() {},
  async openAlarmChannelSettings() {},
  async openFocusSettings() { return { opened: false, destination: 'unavailable' } },
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
  } catch {
    console.warn('[Anker] optionale Funktion fehlgeschlagen.')
    return fallback
  }
}
