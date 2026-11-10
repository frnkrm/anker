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
export interface DeviceCalendarOption { id: string; name: string; account: string }
export interface DeviceCalendarEvent { id: string; title: string; start: number; end: number; allDay: boolean; startDate?: string; endDate?: string }
export interface VoiceResult { status: 'text' | 'cancelled' | 'unavailable' | 'permission-denied' | 'busy' | 'empty' | 'timeout' | 'spoken'; text?: string }

export interface MorningHandoff {
  pending: boolean
  antiRelapseAt: number
  token?: string
  activityToken?: string
  at?: number
  targetAt?: number
  method?: 'qr' | 'math' | 'emergency'
  expiresAt?: number
}

/** A disabled mirror needs no timer data; Android validates all fields before an enabled start. */
export interface RoutinePaceRequest {
  enabled: boolean
  sessionId?: string
  stepId?: string
  title?: string
  durationMs?: number
  deadlineAt?: number
  status?: 'running' | 'paused' | 'stopped'
  intervalSeconds?: number
  hapticsEnabled?: boolean
  thresholds?: boolean
  speakStep?: boolean
  strength?: 'gentle' | 'strong'
  quietStart?: number
  quietEnd?: number
}

export interface RoutinePaceState {
  active: boolean
  phase: 'idle' | 'prepared' | 'running' | 'paused' | 'stopped' | 'expired' | 'blocked' | 'interrupted' | 'error'
  sessionId?: string
  stepId?: string
  deadlineAt?: number
  /** requested means accepted by the local engine, not proof that a cue was heard. */
  speechStatus: 'idle' | 'initializing' | 'requested' | 'unavailable' | 'blocked' | 'interrupted'
  error?: string
}

export interface SleepAudioState {
  active: boolean
  phase: 'idle' | 'prepared' | 'playing' | 'stopped' | 'finished' | 'interrupted' | 'error'
  localOnly: true
  sessionId?: string
  deadlineAt?: number
  error?: string
}

export interface NativePcBridgeState {
  state: 'unpaired' | 'pairing' | 'paired-never-reached' | 'connected' | 'unreachable' | 'rejected' | 'companion-outdated'
  connected: boolean
  active: boolean
  requestedActive?: boolean
  autoReconnect?: boolean
  lastReceivedAt?: number
  pairId?: string
  pcName?: string
  code?: string
  ack?: unknown
  emergencyAck?: { commandId: string; until: number; receivedAt: number }
  error?: string
}

export interface NativePcDevice { name: string; host: string; port: number; version: number }

export interface NativePcRelayState {
  enabled: boolean
  paired: boolean
  status: 'off' | 'lan' | 'waiting' | 'received' | 'expired' | 'unavailable' | 'unauthorized' | 'rejected'
  phoneExpiresAt?: number
  lastExchangeAt?: number
}

export type NativeGeofenceVisit = GeofenceVisit
export interface GeofenceState extends GeofenceStatus { suggestions: GeofenceSuggestion[] }

/** Eigenes Kotlin-Plugin (android/app/src/main/java/.../AnkerNativePlugin.kt). */
export interface AnkerNativePlugin {
  getVoiceCapabilities(): Promise<VoiceCapabilities>
  startDictation(): Promise<VoiceResult>
  stopDictation(): Promise<void>
  speakCue(o: { text: string }): Promise<VoiceResult>
  stopSpeaking(): Promise<void>
  getMorningHandoff(): Promise<MorningHandoff>
  ackMorningHandoff(o: { token: string }): Promise<{ acknowledged: boolean }>
  confirmMorningActivity(o: { token?: string }): Promise<{ confirmed: boolean }>
  syncRoutinePaceKeeper(o: RoutinePaceRequest): Promise<RoutinePaceState>
  stopRoutinePaceKeeper(o: { sessionId?: string }): Promise<RoutinePaceState>
  getRoutinePaceKeeperState(): Promise<RoutinePaceState>
  startSleepAudio(o: { durationMinutes: number; volume?: number }): Promise<SleepAudioState>
  stopSleepAudio(): Promise<SleepAudioState>
  getSleepAudioState(): Promise<SleepAudioState>
  pcBridgeDiscover(o: { timeoutMs?: number }): Promise<{ devices: NativePcDevice[] }>
  pcBridgePair(o: { qr: string; deviceName: string }): Promise<NativePcBridgeState>
  pcBridgeGetState(): Promise<NativePcBridgeState>
  pcBridgeConfigure(o: { qrHash?: string; autoReconnect?: boolean }): Promise<NativePcBridgeState>
  pcBridgeSend(o: { payload: object }): Promise<{ sent: boolean; queued: boolean }>
  pcBridgeStart(): Promise<NativePcBridgeState>
  pcBridgeStop(): Promise<NativePcBridgeState>
  pcBridgeDrainEvents(): Promise<{ events: unknown[]; lastSeq: number }>
  pcBridgeAckEvents(o: { ids: string[] }): Promise<{ lastSeq: number }>
  pcBridgeUnpair(): Promise<NativePcBridgeState>
  pcBridgeEmergency(o: { qr: string; minutes: number }): Promise<{ until: number; tokenId: string; sent: boolean }>
  pcBridgeWakeOnLan(o: { mac: string; broadcast?: string }): Promise<{ sent: boolean }>
  pcRelaySetup(o: { project: string; accessToken: string }): Promise<{ desktopSetup: string; state: NativePcRelayState }>
  pcRelayRenew(o: { accessToken: string }): Promise<{ state: NativePcRelayState }>
  pcRelayRevoke(o: { accessToken: string }): Promise<{ state: NativePcRelayState; cloudRevoked: boolean }>
  pcRelayDisable(): Promise<{ state: NativePcRelayState }>
  pcRelayClear(): Promise<{ state: NativePcRelayState }>
  pcRelayStatus(): Promise<NativePcRelayState>
  deviceCalendarPermission(o?: { request?: boolean }): Promise<{ granted: boolean }>
  listDeviceCalendars(): Promise<{ calendars: DeviceCalendarOption[] }>
  readDeviceCalendarEvents(o: { calendarIds: string[]; from: number; to: number }): Promise<{ events: DeviceCalendarEvent[]; readAt: number }>
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
  /** Begrenztes lokales Diagnosejournal; niemals Logcat, private Inhalte oder ein Zustellbeleg. */
  getDiagnosticJournal(): Promise<unknown>
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
  async getDiagnosticJournal() { return { version: 1, available: false, retentionDays: 7, maxEntries: 800, events: [] } },
  async getVoiceCapabilities() { return { dictationSupported: false, speechSupported: false, localOnly: true } },
  async startDictation() { return { status: 'unavailable' } },
  async stopDictation() {},
  async speakCue() { return { status: 'unavailable' } },
  async stopSpeaking() {},
  async getMorningHandoff() { return { pending: false, antiRelapseAt: 0 } },
  async ackMorningHandoff() { return { acknowledged: false } },
  async confirmMorningActivity() { return { confirmed: false } },
  async syncRoutinePaceKeeper() { return { active: false, phase: 'idle', speechStatus: 'unavailable', error: 'unavailable' } },
  async stopRoutinePaceKeeper() { return { active: false, phase: 'stopped', speechStatus: 'unavailable' } },
  async getRoutinePaceKeeperState() { return { active: false, phase: 'idle', speechStatus: 'unavailable' } },
  async startSleepAudio() { return { active: false, phase: 'error', localOnly: true, error: 'unavailable' } },
  async stopSleepAudio() { return { active: false, phase: 'stopped', localOnly: true } },
  async getSleepAudioState() { return { active: false, phase: 'idle', localOnly: true } },
  async pcBridgeDiscover() { return { devices: [] } },
  async pcBridgePair() { return { state: 'unpaired', connected: false, active: false, error: 'unavailable' } },
  async pcBridgeGetState() { return { state: 'unpaired', connected: false, active: false } },
  async pcBridgeConfigure() { return { state: 'unpaired', connected: false, active: false, error: 'unavailable' } },
  async pcBridgeSend() { return { sent: false, queued: false } },
  async pcBridgeStart() { return { state: 'unpaired', connected: false, active: false, error: 'unavailable' } },
  async pcBridgeStop() { return { state: 'unpaired', connected: false, active: false } },
  async pcBridgeDrainEvents() { return { events: [], lastSeq: 0 } },
  async pcBridgeAckEvents() { return { lastSeq: 0 } },
  async pcBridgeUnpair() { return { state: 'unpaired', connected: false, active: false } },
  async pcBridgeEmergency() { return { until: 0, tokenId: '', sent: false } },
  async pcBridgeWakeOnLan() { return { sent: false } },
  async pcRelaySetup() { throw new Error('PC_RELAY_NATIVE_REQUIRED') },
  async pcRelayRenew() { throw new Error('PC_RELAY_NATIVE_REQUIRED') },
  async pcRelayRevoke() { return { state: { enabled: false, paired: false, status: 'off' }, cloudRevoked: false } },
  async pcRelayDisable() { return { state: { enabled: false, paired: false, status: 'off' } } },
  async pcRelayClear() { return { state: { enabled: false, paired: false, status: 'off' } } },
  async pcRelayStatus() { return { enabled: false, paired: false, status: 'off' } },
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
