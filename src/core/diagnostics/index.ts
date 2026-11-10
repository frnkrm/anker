import type { GuidancePreferences } from '../guidance/types'
import type { Settings } from '../types'
import { DIAGNOSTIC_CATEGORIES, DIAGNOSTIC_SETTINGS_GROUPS,
  type DiagnosticCategory, type DiagnosticEvent, type DiagnosticExport, type DiagnosticExportInput,
  type DiagnosticExportSelection, type DiagnosticRecord, type DiagnosticSettingsGroup, type DiagnosticValue } from './types'

export * from './types'

const DAY_MS = 86_400_000
const MAX_ENTRIES = 800
const MAX_INPUT_ENTRIES = 4_000
const DATE_LIMIT = 8_640_000_000_000_000
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const timestamp = (value: unknown): value is number => integer(value) && value >= 0 && value <= DATE_LIMIT

type Rule = 'boolean' | 'integer' | readonly string[]
type Projection = Record<string, Rule>
const fields = (keys: string, rule: Rule): Projection => Object.fromEntries(keys.split(' ').filter(Boolean).map(key => [key, rule]))
function project(value: unknown, rules: Projection): DiagnosticRecord {
  if (!object(value)) return {}
  const out: DiagnosticRecord = {}
  for (const [key, rule] of Object.entries(rules)) {
    const item = value[key]
    if (rule === 'boolean' ? typeof item === 'boolean' : rule === 'integer' ? integer(item) : typeof item === 'string' && rule.includes(item)) out[key] = item as string | number | boolean
  }
  return out
}

const KINDS = ['main', 'snooze', 'prewake', 'wakecheck', 'test'] as const
const REASONS = ['boot', 'locked-boot', 'package-replaced', 'time-changed', 'timezone-changed', 'exact-permission-changed',
  'system', 'config', 'fired', 'timeout', 'stopped', 'snoozed', 'smart-fired', 'smart-prepared', 'morning-confirmed',
  'legacy-fire', 'unknown', 'qr', 'nfc', 'math', 'emergency', 'locked', 'prewake', 'wakecheck', 'test', 'test-stop',
  'invalid-target', 'replaced-target', 'already-consumed', 'priority', 'ignored', 'no-active-alarm', 'expired', 'normal',
  'exact-fallback', 'restart', 'screen-off', 'permission-revoked', 'alarm-active', 'acknowledged', 'cancelled',
  'user', 'permission-denied', 'overlay-failed', 'launch-failed', 'display-off', 'display-doze', 'display-unknown',
  'updated', 'storage-failed', 'schedule-failed', 'interrupted', 'overlay-not-drawn', 'foreground-unconfirmed',
  'foreground-requested', 'foreground-confirmed', 'activity-start-failed', 'inexact-schedule', 'stale-session', 'not-due', 'focus', 'quiet-hours', 'budget', 'channel-blocked', 'quiet-finished', 'quiet-disabled'] as const
const ERROR_CLASSES = new Set(['Exception', 'Error', 'RuntimeException', 'SecurityException', 'IllegalStateException',
  'IllegalArgumentException', 'IOException', 'FileNotFoundException', 'UnsupportedOperationException',
  'ForegroundServiceStartNotAllowedException', 'MissingForegroundServiceTypeException', 'RemoteServiceException',
  'ForegroundServiceDidNotStartInTimeException', 'BadTokenException', 'IllegalAccessException', 'NullPointerException'])

/** Unknown/future codes keep their timing but never export arbitrary strings from a native error. */
const EVENT_CODES: Readonly<Record<DiagnosticCategory, ReadonlySet<string>>> = {
  alarm: new Set(['scheduled', 'schedule_cancelled', 'schedule_fallback', 'schedule_error', 'reconcile', 'fired_accepted', 'fired_rejected',
    'service_requested', 'service_start_error', 'service_entered', 'foreground_started', 'foreground_error', 'screen_wake_requested', 'screen_wake_error', 'screen_wake_notify_error',
    'audio_focus_result', 'audio_focus_change', 'audio_focus_error', 'player_started', 'player_error', 'player_route_changed', 'tone_started', 'tone_error', 'audio_stopped',
    'service_destroyed', 'stop_requested', 'stop_error', 'snooze_accepted', 'snooze_rejected', 'timeout', 'smart_fired_accepted', 'smart_fired_rejected', 'test_confirmed', 'fallback_posted', 'fallback_error']),
  bedtime: new Set(['scheduled', 'schedule_failed', 'due_received', 'due_rejected', 'due_accepted', 'overlay_requested', 'overlay_attached',
    'foreground_requested', 'foreground_confirmed', 'foreground_unconfirmed', 'foreground_failed', 'stopped', 'acknowledged', 'session_skipped', 'session_error', 'app_paused', 'quiet_scheduled', 'quiet_posted', 'quiet_deferred', 'quiet_snoozed', 'quiet_stopped', 'quiet_expired', 'quiet_source_rejected']),
  system: new Set(['reconcile', 'journal_dropped']),
  reminder: new Set(['scheduled', 'delivered', 'delivery_rejected', 'action_accepted', 'action_rejected']),
  pc: new Set(['connected', 'disconnected', 'ack_accepted', 'ack_rejected']),
}
const DETAIL_RULES: Projection = {
  ...fields('targetAt driftMs alarmVolume alarmVolumeMax interruptionFilter channelImportance focusChange focusResult playerSource playerError playerExtra displayState remainingMs timeoutMs sdk observedAt count routedDeviceType foregroundAttempts', 'integer'),
  ...fields('interactive keyguardLocked userUnlocked alarmMuted notificationsEnabled exactAllowed fullScreenAllowed batteryIgnored powerSave bluetooth wired overlayAllowed accepted started foreground attached alarmEnabled', 'boolean'),
  kind: KINDS, reasonCode: REASONS, audioSource: ['alarm-default', 'notification-default', 'ringtone-default', 'generated'],
}
function eventDetails(value: unknown): DiagnosticRecord {
  const out = project(value, DETAIL_RULES)
  if (!object(value)) return out
  if (typeof value.errorClass === 'string' && value.errorClass.length <= 160) {
    // Keep only a known simple class name; never the package/message or a bespoke class encoding data.
    const simple = value.errorClass.split(/[.$]/).at(-1)
    if (simple && ERROR_CLASSES.has(simple)) out.errorClass = simple
  }
  if (Array.isArray(value.outputTypes) && value.outputTypes.length <= 32 && value.outputTypes.every(item => integer(item) && item >= 0 && item <= 100)) out.outputTypes = [...value.outputTypes]
  return out
}

function normalizeSelection(selection: DiagnosticExportSelection): DiagnosticExportSelection {
  if (!timestamp(selection.from) || !timestamp(selection.to) || selection.to < selection.from) throw new Error('Prüfe den Beginn und das Ende des Diagnosezeitraums.')
  if (!Array.isArray(selection.categories) || !selection.categories.every(value => DIAGNOSTIC_CATEGORIES.includes(value))
    || !Array.isArray(selection.settingsGroups) || !selection.settingsGroups.every(value => DIAGNOSTIC_SETTINGS_GROUPS.includes(value))
    || typeof selection.includeCurrentStatus !== 'boolean') throw new Error('Die Diagnoseauswahl ist nicht gültig.')
  return { from: selection.from, to: selection.to,
    categories: DIAGNOSTIC_CATEGORIES.filter(value => selection.categories.includes(value)),
    settingsGroups: DIAGNOSTIC_SETTINGS_GROUPS.filter(value => selection.settingsGroups.includes(value)),
    includeCurrentStatus: selection.includeCurrentStatus }
}

export function defaultDiagnosticSelection(nowMs = Date.now()): DiagnosticExportSelection {
  if (!timestamp(nowMs)) throw new Error('Der Exportzeitpunkt ist nicht gültig.')
  return { from: Math.max(0, nowMs - DAY_MS), to: nowMs, categories: ['alarm', 'bedtime', 'system'], settingsGroups: [], includeCurrentStatus: true }
}

const ALARM_FIELDS: Projection = {
  ...fields('enabled preWakeEnabled wakeCheckEnabled', 'boolean'),
  ...fields('preWakeLeadMinutes wakeCheckDelayMinutes mathTasks', 'integer'),
}
const GUIDANCE_BOOLEANS = ['enabled', 'circadianUi', 'timeArc', 'depletionColors', 'paceKeeper', 'paceThresholds', 'speakSteps',
  'zeroGapMorning', 'preWakeFadeIn', 'antiRelapse', 'autoZombie', 'eveningEscalation', 'bedtimeQr', 'sleepNoise', 'eveningLight',
  'suppressPhonePcWhenConfirmed', 'pcLock'] satisfies (keyof GuidancePreferences)[]
const GUIDANCE_NUMBERS = ['paceIntervalMin', 'antiRelapseMinutes', 'autoZombieAfterSeconds', 'sleepNoiseMinutes', 'eveningLightLeadMinutes'] satisfies (keyof GuidancePreferences)[]
function selectSettings(settings: Settings, groups: readonly DiagnosticSettingsGroup[]): Partial<Record<DiagnosticSettingsGroup, DiagnosticRecord>> {
  const out: Partial<Record<DiagnosticSettingsGroup, DiagnosticRecord>> = {}
  for (const group of groups) {
    switch (group) {
      case 'alarm':
        out.alarm = { ...project(settings.alarm, ALARM_FIELDS),
          qrConfigured: typeof settings.alarm?.qrSecret === 'string' && settings.alarm.qrSecret.trim().length > 0,
          anchor: project(settings.anchor, fields('wake wakeToleranceMin weekendToleranceMin', 'integer')),
          smartWake: project(settings.alarm?.smartWake, { enabled: 'boolean', windowMinutes: 'integer' }) }
        break
      case 'sleep':
        out.sleep = { ...project(settings.sleep, { ...fields('needMin fallAsleepMin screenOffMin', 'integer'), bedtimePromptEnabled: 'boolean', bedtimeFollowUpsEnabled: 'boolean' }),
          ...project(settings, fields('bed pcStop', 'integer')),
          manualAnchors: project(settings.anchor?.manual, fields('wake pcStop bed', 'boolean')),
          guidance: project(settings.guidance, { ...fields(GUIDANCE_BOOLEANS.join(' '), 'boolean'), ...fields(GUIDANCE_NUMBERS.join(' '), 'integer') }),
          windDown: project(settings.support?.windDown, { enabled: 'boolean', at: 'integer' }),
          eveningPreset: project(settings.support?.eveningPreset, { enabled: 'boolean', from: 'integer' }) }
        break
      case 'routines': {
        const routine = (value: unknown): DiagnosticValue[] => Array.isArray(value) ? value.slice(0, 200).map((step, position) => ({ position,
          ...project(step, { minutes: 'integer', isEssentialForZombieMode: 'boolean' }),
          minimal: project(object(step) ? step.minimal : undefined, { minutes: 'integer' }) })) : []
        out.routines = { morning: routine(settings.routines?.morning), evening: routine(settings.routines?.evening) }
        break
      }
      case 'reminders':
        out.reminders = project(settings.reminders, { intensity: ['gentle', 'normal', 'persistent'], ...fields('repeatAfterMin quietStart quietEnd', 'integer') })
        break
      case 'appearance':
        out.appearance = { ...project(settings, { themeId: ['seefahrt', 'piraten', 'weltraum', 'kampfkunst', 'schlicht'] }),
          ...project(settings.appearance, { dark: 'boolean', fontScale: 'integer', developerTools: 'boolean' }) }
        // Font scaling is the only selected fractional scalar; never stringify arbitrary values.
        if (typeof settings.appearance?.fontScale === 'number' && Number.isFinite(settings.appearance.fontScale)
          && settings.appearance.fontScale >= 0.5 && settings.appearance.fontScale <= 3) out.appearance.fontScale = settings.appearance.fontScale
        break
      case 'workTimes':
        out.workTimes = { week: (Array.isArray(settings.work) ? settings.work.slice(0, 7) : []).map((day, weekday) => ({ weekday,
          ...project(day, { ...fields('isWorkDay homeOffice', 'boolean'), ...fields('start durationMin pauseMin latestStart endPreference', 'integer') }),
          ...(object(day) && day.latestStart === null ? { latestStart: null } : {}) })),
          ...project(settings.flex, { latestStart: 'integer' }), ...(settings.flex?.latestStart === null ? { latestStart: null } : {}) }
        break
    }
  }
  return out
}

const ALARM_STATUS_RULES: Projection = {
  ...fields('ringing mainConfirmed preWakeConfirmed exact notificationsEnabled channelBypassDnd dndAccess fullScreen batteryIgnored powerSave bluetooth wired audioOk interactive screenInteractive keyguardLocked userUnlocked alarmMuted overlayAllowed', 'boolean'),
  ...fields('scheduledAt preWakeAt preWakePausedForTargetAt snoozeAt wakeCheckAt testAt snoozed systemNextAt channelImportance interruptionFilter alarmVolume alarmVolumeMax testResultAt lastStopAt lastTimeoutAt missedMainAt lastReconcileAt displayState routedDeviceType', 'integer'),
  kind: KINDS, testResult: ['', 'scheduled', 'rang', 'heard', 'not-heard', 'failed'], lastStopMethod: REASONS, lastReconcileReason: REASONS,
}
const BEDTIME_STATUS_RULES: Projection = {
  ...fields('active overlayAllowed overlayPermission exact overlayVisible navigationAcknowledged screenInteractive overlayAttached wakeup allowWhileIdle quietReady quietVisible', 'boolean'),
  ...fields('dueAt startedAt lastShownAt lastFiredAt lastAttemptAt remainingMs deliveryGraceMs displayState foregroundAttempts', 'integer'),
  phase: ['idle', 'waiting', 'shown', 'quiet', 'skipped', 'error'], reason: REASONS,
  ...fields('quietDueAt quietUntilAt', 'integer'),
  foregroundStatus: ['not-requested', 'requested', 'confirmed', 'unconfirmed', 'failed'],
}
function currentRuntime(input: DiagnosticExportInput, categories: readonly DiagnosticCategory[]): NonNullable<DiagnosticExport['runtime']> {
  const out: NonNullable<DiagnosticExport['runtime']> = {}
  const device = project(input.alarmDiagnostics, { sdk: 'integer' })
  if (Object.keys(device).length) out.device = device
  if (categories.includes('system')) {
    const system = project(input.alarmDiagnostics, { ...fields('interactive screenInteractive keyguardLocked userUnlocked powerSave', 'boolean'), displayState: 'integer' })
    if (Object.keys(system).length) out.system = system
  }
  if (categories.includes('alarm')) out.alarm = project(input.alarmDiagnostics, ALARM_STATUS_RULES)
  if (categories.includes('bedtime')) out.bedtime = project(input.bedtimeStatus, BEDTIME_STATUS_RULES)
  if (categories.includes('reminder')) {
    out.reminder = project(input.alarmDiagnostics, fields('reminderQueue reminderHorizon remindersVisible reminderRuleCount reminderRulesFrom', 'integer'))
    const delivery = object(input.alarmDiagnostics) ? input.alarmDiagnostics.reminderDelivery : undefined
    if (object(delivery)) {
      out.reminder.delivery = project(delivery, { ...fields('nextAt focusUntil quietUntil planQuietUntil storedSlots activeNotifications lastSyncAt', 'integer'), nextChannel: ['sanft', 'uebergang', 'wecker'] })
      if (Array.isArray(delivery.channels)) out.reminder.channels = delivery.channels.slice(0, 3).map(channel => project(channel, { id: ['sanft', 'uebergang', 'wecker'], importance: 'integer', blocked: 'boolean' }))
    }
  }
  if (categories.includes('pc')) out.pc = project(input.pcStatus, {
    state: ['unpaired', 'pairing', 'paired-never-reached', 'connected', 'unreachable', 'rejected', 'companion-outdated'],
    ...fields('connected active requestedActive autoReconnect', 'boolean'), lastReceivedAt: 'integer',
  })
  return out
}

const WARNINGS = [
  'Eine Planung ist kein Nachweis, dass Android den Wecker ausgelöst hat.',
  'Ein gestarteter Audioplayer belegt weder Hörbarkeit noch Aufwachen.',
  'Ein bereitstehender oder still zugestellter Schlafhinweis belegt weder Wachsein noch Schlaf.',
  'Aktuelle Einstellungen und Gerätestatus zeigen nur den Exportzeitpunkt, nicht rückwirkend die damalige Konfiguration.',
  'Fehlende Ereignisse beweisen keinen stummen Wecker: ältere App-Versionen, Aufbewahrungsgrenzen oder ein abgebrochener Prozess können Lücken hinterlassen.',
  'Die Zeitfilter verwenden die damalige Geräteuhr. Bei einer Uhrkorrektur können Zeitstempel außerhalb des gewählten Bereichs liegen; die native Sequenz bleibt erhalten.',
  'Noch wartende oder verworfene Journaleinträge können in dieser Momentaufnahme fehlen.',
] as const

/** Strict projection, not backup/export of the complete Settings or LocalData object. */
export function makeDiagnosticExport(input: DiagnosticExportInput, choice: DiagnosticExportSelection, nowMs = Date.now()): DiagnosticExport {
  if (!timestamp(nowMs)) throw new Error('Der Exportzeitpunkt ist nicht gültig.')
  const selection = normalizeSelection(choice)
  const source = object(input.journal) ? input.journal : undefined
  const unavailable = source === undefined || source.available === false
  const available = !unavailable && source.version === 1 && source.retentionDays === 7 && source.maxEntries === 800 && Array.isArray(source.events)
  const journal: DiagnosticExport['manifest']['journal'] = {
    availability: selection.categories.length === 0 ? 'not-requested' : unavailable ? 'unavailable' : available ? 'available' : 'unsupported',
    retentionDays: 7, maxEntries: 800, invalidEvents: 0, truncatedEvents: 0, futureTimestampEvents: 0, unrecognizedCodes: 0,
  }
  if (available && integer(source.droppedEvents) && source.droppedEvents >= 0) journal.droppedEvents = source.droppedEvents
  if (available && integer(source.pendingEvents) && source.pendingEvents >= 0) journal.pendingEvents = source.pendingEvents
  const logs: DiagnosticEvent[] = []
  if (available && selection.categories.length) {
    const raw = source.events as unknown[]
    journal.truncatedEvents = Math.max(0, raw.length - MAX_INPUT_ENTRIES)
    const seen = new Set<number>()
    for (const row of raw.slice(-MAX_INPUT_ENTRIES)) {
      if (!object(row) || !integer(row.seq) || row.seq < 1 || !timestamp(row.at) || !integer(row.elapsedMs) || row.elapsedMs < 0
        || !DIAGNOSTIC_CATEGORIES.includes(row.category as DiagnosticCategory) || typeof row.code !== 'string' || !object(row.details)
        || seen.has(row.seq)) { journal.invalidEvents++; continue }
      seen.add(row.seq)
      if (!selection.categories.includes(row.category as DiagnosticCategory)) continue
      if (row.at > nowMs) journal.futureTimestampEvents++
      if (row.at < selection.from || row.at > selection.to) continue
      const code = EVENT_CODES[row.category as DiagnosticCategory].has(row.code) ? row.code : 'unrecognized_event'
      if (code === 'unrecognized_event') journal.unrecognizedCodes++
      logs.push({ seq: row.seq, at: row.at, elapsedMs: row.elapsedMs, category: row.category as DiagnosticCategory, code, details: eventDetails(row.details) })
    }
  }
  logs.sort((a, b) => a.seq - b.seq)
  journal.truncatedEvents += Math.max(0, logs.length - MAX_ENTRIES)
  if ((selection.categories.length && !available) || journal.invalidEvents > 0 || journal.truncatedEvents > 0
    || (journal.droppedEvents ?? 0) > 0 || (journal.pendingEvents ?? 0) > 0) journal.incomplete = true
  const version = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(input.app.version) ? input.app.version : 'unknown'
  const app: DiagnosticExport['app'] = { name: 'Anker', version, platform: input.app.platform === 'android' ? 'android' : 'web' }
  if (input.app.build && /^(?:\d{1,15}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.app.build)) app.build = input.app.build
  if (input.app.sourceFingerprint && /^[a-f0-9]{64}$/i.test(input.app.sourceFingerprint)) app.sourceFingerprint = input.app.sourceFingerprint
  const result: DiagnosticExport = { kind: 'anker-diagnostics', schemaVersion: 1, app, exportedAt: new Date(nowMs).toISOString(),
    manifest: { selection, omitted: { categories: DIAGNOSTIC_CATEGORIES.filter(category => !selection.categories.includes(category)),
      settingsGroups: DIAGNOSTIC_SETTINGS_GROUPS.filter(group => !selection.settingsGroups.includes(group)) }, journal, warnings: WARNINGS },
    logs: logs.slice(-MAX_ENTRIES) }
  const unavailableSources = (['alarm', 'bedtime', 'journal', 'pc'] as const).filter(source => input.unavailable?.includes(source)
    && (source === 'journal' ? selection.categories.length > 0 : selection.includeCurrentStatus
      && (selection.categories.includes(source) || source === 'alarm' && selection.categories.some(category => category === 'system' || category === 'reminder'))))
  if (unavailableSources.length) result.manifest.unavailableSources = unavailableSources
  if (selection.settingsGroups.length && input.settings) result.settings = selectSettings(input.settings, selection.settingsGroups)
  if (selection.includeCurrentStatus) result.runtime = currentRuntime(input, selection.categories)
  return result
}
