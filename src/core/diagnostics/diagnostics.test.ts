import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { parseBackup } from '../export/backup'
import { DIAGNOSTIC_CATEGORIES, DIAGNOSTIC_SETTINGS_GROUPS, defaultDiagnosticSelection, makeDiagnosticExport,
  type DiagnosticEvent, type DiagnosticExportInput, type DiagnosticExportSelection } from './index'

const NOW = Date.parse('2026-11-09T10:00:00Z')
const HOUR = 3_600_000
const row = (seq: number, category: DiagnosticEvent['category'] = 'alarm', code = 'player_started', at = NOW - HOUR): DiagnosticEvent =>
  ({ seq, at, elapsedMs: seq * 1000, category, code, details: { kind: 'main', started: true, targetAt: at } })
const journal = (events: unknown[]) => ({ version: 1, retentionDays: 7, maxEntries: 800, droppedEvents: 3, events })
const input = (events: unknown[] = []): DiagnosticExportInput => ({ app: { version: '1.5.0-rc.2', build: '16', sourceFingerprint: 'a'.repeat(64), platform: 'android' },
  journal: journal(events), settings: defaultSettings('2026-11-09'),
  alarmDiagnostics: { sdk: 36, scheduledAt: NOW + HOUR, ringing: false, alarmVolume: 5, alarmVolumeMax: 7, audioOk: true,
    notificationsEnabled: true, device: 'PRIVATE_DEVICE_NAME', error: 'PRIVATE_ERROR: content://audio/PRIVATE_FILE',
    reminderDelivery: { nextAt: NOW + 500, nextChannel: 'sanft', activeNotifications: 1, channels: [{ id: 'sanft', importance: 3, blocked: false }] } },
  bedtimeStatus: { phase: 'waiting', sessionId: 'PRIVATE_SESSION', dueAt: NOW + 60_000, overlayPermission: true, exact: true },
  pcStatus: { state: 'connected', connected: true, pcName: 'PRIVATE_PC_NAME', pairId: 'PRIVATE_PAIR', code: 'PRIVATE_CODE', ack: { token: 'PRIVATE_TOKEN' }, error: 'PRIVATE_PC_ERROR' },
})
const all = (): DiagnosticExportSelection => ({ ...defaultDiagnosticSelection(NOW), categories: [...DIAGNOSTIC_CATEGORIES], settingsGroups: [...DIAGNOSTIC_SETTINGS_GROUPS] })

describe('Selektiver Diagnoseexport', () => {
  it('erklärt stille Folgehinweise und Snooze-Sperren ohne deren private Sitzungs- oder Quellenkennungen', () => {
    const data = input([
      { ...row(1, 'bedtime', 'quiet_deferred'), details: { reasonCode: 'budget', targetAt: NOW, token: 'PRIVATE_TOKEN', sourceRevision: 'PRIVATE_REVISION' } },
      { ...row(2, 'reminder', 'delivery_rejected'), details: { kind: 'snooze', reasonCode: 'quiet-hours', targetAt: NOW, title: 'PRIVATE_TASK' } },
    ])
    data.bedtimeStatus = { phase: 'quiet', quietDueAt: NOW, quietUntilAt: NOW + HOUR, quietReady: true, quietVisible: false,
      sessionId: 'PRIVATE_SESSION', sourceDate: 'PRIVATE_DATE', sourceRevision: 'PRIVATE_REVISION' }
    const result = makeDiagnosticExport(data, all(), NOW)
    expect(result.logs.map(event => event.details.reasonCode)).toEqual(['budget', 'quiet-hours'])
    expect(result.runtime?.bedtime).toEqual({ phase: 'quiet', quietDueAt: NOW, quietUntilAt: NOW + HOUR, quietReady: true, quietVisible: false })
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
    const excluded = makeDiagnosticExport(data, { ...all(), categories: ['alarm'] }, NOW)
    expect(excluded.runtime?.bedtime).toBeUndefined()
    expect(excluded.logs).toEqual([])
  })
  it('beginnt mit Wecker, Schlafhinweis und System, aber ohne Einstellungsfreigabe', () => {
    const selection = defaultDiagnosticSelection(NOW)
    expect(selection).toEqual({ from: NOW - 24 * HOUR, to: NOW, categories: ['alarm', 'bedtime', 'system'], settingsGroups: [], includeCurrentStatus: true })
    const exported = makeDiagnosticExport(input([row(1), row(2, 'pc'), row(3, 'system', 'reconcile')]), selection, NOW)
    expect(exported.kind).toBe('anker-diagnostics')
    expect(exported.schemaVersion).toBe(1)
    expect(exported.logs.map(event => event.category)).toEqual(['alarm', 'system'])
    expect(exported.settings).toBeUndefined()
    expect(exported.runtime).toEqual({ device: { sdk: 36 }, alarm: { scheduledAt: NOW + HOUR, ringing: false, alarmVolume: 5, alarmVolumeMax: 7, audioOk: true, notificationsEnabled: true },
      bedtime: { phase: 'waiting', dueAt: NOW + 60_000, overlayPermission: true, exact: true } })
    expect(JSON.stringify(exported)).not.toContain('PRIVATE')
    expect(exported.manifest.omitted.settingsGroups).toEqual(DIAGNOSTIC_SETTINGS_GROUPS)
    expect(() => parseBackup(JSON.stringify(exported))).toThrow('keine Anker-Sicherung')
  })

  it('entfernt abgewählte Kategorien auch aus sämtlichen aktuellen Statusgruppen', () => {
    const choice = { ...defaultDiagnosticSelection(NOW), categories: ['bedtime'] as const }
    const exported = makeDiagnosticExport(input([row(1), row(2, 'bedtime', 'scheduled'), row(3, 'pc', 'connected')]), choice, NOW)
    expect(exported.logs.map(event => event.category)).toEqual(['bedtime'])
    expect(exported.runtime?.alarm).toBeUndefined()
    expect(exported.runtime?.pc).toBeUndefined()
    expect(exported.runtime?.reminder).toBeUndefined()
    expect(exported.runtime?.bedtime).toMatchObject({ overlayPermission: true })
    expect(exported.runtime?.device).toEqual({ sdk: 36 })
    const noStatus = makeDiagnosticExport(input([row(1)]), { ...choice, includeCurrentStatus: false }, NOW)
    expect(noStatus).not.toHaveProperty('runtime')
    expect(noStatus.app).toEqual({ name: 'Anker', version: '1.5.0-rc.2', build: '16', sourceFingerprint: 'a'.repeat(64), platform: 'android' })
    const onlySystem = makeDiagnosticExport({ ...input(), alarmDiagnostics: { sdk: 36, displayState: 2, powerSave: true, scheduledAt: NOW + HOUR, alarmVolume: 5 } },
      { ...choice, categories: ['system'] }, NOW)
    expect(onlySystem.runtime).toEqual({ device: { sdk: 36 }, system: { displayState: 2, powerSave: true } })
  })

  it('lässt jede Einstellungsgruppe einzeln weg statt sie über den Gesamtbestand nachzureichen', () => {
    for (const group of DIAGNOSTIC_SETTINGS_GROUPS) {
      const choice = { ...all(), settingsGroups: DIAGNOSTIC_SETTINGS_GROUPS.filter(value => value !== group) }
      const exported = makeDiagnosticExport(input(), choice, NOW)
      expect(exported.settings).not.toHaveProperty(group)
      expect(exported.manifest.omitted.settingsGroups).toEqual([group])
      expect(Object.keys(exported.settings!)).toHaveLength(DIAGNOSTIC_SETTINGS_GROUPS.length - 1)
    }
    const exported = makeDiagnosticExport(input(), { ...all(), settingsGroups: [], categories: [], includeCurrentStatus: false }, NOW)
    expect(exported.settings).toBeUndefined()
    expect(exported.logs).toEqual([])
    expect(exported.runtime).toBeUndefined()
    expect(exported.manifest.journal.availability).toBe('not-requested')
  })

  it('exportiert bei vollständiger Auswahl ausschließlich freigegebene Skalare, niemals private Inhalte oder IDs', () => {
    const source = input([row(1), { ...row(2), code: 'PRIVATE_EVENT_CODE', details: { kind: 'PRIVATE_KIND', reasonCode: 'PRIVATE_REASON', errorClass: 'PRIVATE_CUSTOM_Exception',
      qrSecret: 'PRIVATE_QR', token: 'PRIVATE_TOKEN', outputTypes: [2, 7], alarmVolume: 0, keyguardLocked: false,
      message: 'PRIVATE_MESSAGE', uri: 'content://PRIVATE', title: 'PRIVATE_TITLE', nested: { password: 'PRIVATE_PASSWORD' } } }])
    const settings = source.settings!
    settings.alarm.qrSecret = 'PRIVATE_QR_SECRET'
    settings.alarm.medicationEnabled = true
    settings.alarm.medicationReminderAt = 1234
    settings.routines.morning = [{ id: 'PRIVATE_STEP_ID', title: 'PRIVATE_STEP_TITLE', minutes: 3, isEssentialForZombieMode: true, minimal: { title: 'PRIVATE_MINIMAL_TEXT', minutes: 1 } }]
    settings.support.windDown.activity = 'PRIVATE_ACTIVITY'
    settings.flex.lateMessage = 'PRIVATE_LATE_MESSAGE'
    settings.homeOfficeMessage = 'PRIVATE_HOME_MESSAGE'
    settings.weather.city = 'PRIVATE_PLACE'
    settings.weather.lat = 48.2
    settings.weather.lng = 11.7
    settings.suggestions = [{ id: 'PRIVATE_SUGGESTION_ID', text: 'PRIVATE_SUGGESTION', createdAt: '2026-11-09' }]
    const before = structuredClone(source)
    const exported = makeDiagnosticExport(source, all(), NOW)
    expect(JSON.stringify(exported)).not.toContain('PRIVATE')
    expect(JSON.stringify(exported)).not.toContain('content://')
    expect(exported.settings?.alarm).toMatchObject({ qrConfigured: true })
    expect(exported.settings?.alarm).not.toHaveProperty('medicationEnabled')
    expect(exported.settings?.alarm).not.toHaveProperty('medicationReminderAt')
    expect(exported.settings?.routines).toMatchObject({ morning: [{ position: 0, minutes: 3, isEssentialForZombieMode: true, minimal: { minutes: 1 } }] })
    expect(exported.logs[1]).toMatchObject({ code: 'unrecognized_event', details: { outputTypes: [2, 7], alarmVolume: 0, keyguardLocked: false } })
    expect(exported.manifest.journal.unrecognizedCodes).toBe(1)
    expect(exported.runtime?.pc).toEqual({ state: 'connected', connected: true })
    expect(exported.runtime?.reminder).toMatchObject({ delivery: { nextChannel: 'sanft', activeNotifications: 1 }, channels: [{ id: 'sanft', importance: 3, blocked: false }] })
    expect(source).toEqual(before)
  })

  it('hält die gewählten Zeitgrenzen ein und bewahrt trotz Uhr-Rückstellung die ursprüngliche Sequenz', () => {
    const events = [row(4, 'alarm', 'player_started', NOW - 2 * HOUR), row(1, 'alarm', 'scheduled', NOW - 3 * HOUR),
      row(2, 'alarm', 'fired_accepted', NOW - HOUR), row(3, 'alarm', 'service_entered', NOW + HOUR), row(5, 'alarm', 'audio_stopped', NOW)]
    const choice = { ...defaultDiagnosticSelection(NOW), from: NOW - 2 * HOUR, to: NOW }
    const exported = makeDiagnosticExport(input(events), choice, NOW)
    expect(exported.logs.map(event => event.seq)).toEqual([2, 4, 5])
    expect(exported.logs.map(event => event.at)).toEqual([NOW - HOUR, NOW - 2 * HOUR, NOW])
    expect(exported.manifest.journal.futureTimestampEvents).toBe(1)
    const futureSelected = makeDiagnosticExport(input(events), { ...choice, to: NOW + HOUR }, NOW)
    expect(futureSelected.logs.map(event => event.seq)).toEqual([2, 3, 4, 5])
    expect(exported.manifest.warnings.some(text => text.includes('Uhrkorrektur'))).toBe(true)
  })

  it('bewahrt die tatsächliche Audio-Route getrennt von angeschlossenen Ausgaben und unbestätigte Vordergrundversuche', () => {
    const source = input([{ ...row(1, 'alarm', 'player_route_changed'), details: { audioSource: 'alarm-default', routedDeviceType: 2, outputTypes: [2, 8], bluetooth: true } },
      { ...row(2, 'bedtime', 'foreground_requested'), details: { started: true, attached: true, displayState: 2, reasonCode: 'foreground-requested' } }])
    source.bedtimeStatus = { phase: 'shown', overlayAttached: true, foregroundStatus: 'unconfirmed', foregroundAttempts: 1, screenInteractive: false, displayState: 2,
      wakeup: true, allowWhileIdle: true, reason: 'foreground-unconfirmed', sessionId: 'PRIVATE_ID' }
    const exported = makeDiagnosticExport(source, defaultDiagnosticSelection(NOW), NOW)
    expect(exported.logs[0]?.details).toEqual({ audioSource: 'alarm-default', routedDeviceType: 2, outputTypes: [2, 8], bluetooth: true })
    expect(exported.logs[1]?.code).toBe('foreground_requested')
    expect(exported.runtime?.bedtime).toEqual({ phase: 'shown', overlayAttached: true, foregroundStatus: 'unconfirmed', foregroundAttempts: 1, screenInteractive: false, displayState: 2,
      wakeup: true, allowWhileIdle: true, reason: 'foreground-unconfirmed' })
    expect(exported.runtime?.bedtime).not.toHaveProperty('seen')
    expect(JSON.stringify(exported)).not.toContain('PRIVATE')
  })

  it('weist auf noch nicht persistierte/verworfene Einträge hin statt Vollständigkeit zu behaupten', () => {
    const source = input([row(1)])
    source.journal = { ...journal([row(1)]), pendingEvents: 2, droppedEvents: 4 }
    const exported = makeDiagnosticExport(source, defaultDiagnosticSelection(NOW), NOW)
    expect(exported.manifest.journal).toMatchObject({ availability: 'available', pendingEvents: 2, droppedEvents: 4, incomplete: true })
    const stable = makeDiagnosticExport({ ...source, journal: { ...journal([row(1)]), pendingEvents: 0, droppedEvents: 0 } }, defaultDiagnosticSelection(NOW), NOW)
    expect(stable.manifest.journal).not.toHaveProperty('incomplete')
    expect(stable.manifest.warnings.some(text => text.includes('Lücken'))).toBe(true)
  })

  it('unterscheidet fehlende/fehlerhafte native Auskunft von einer nachweislich leeren Auswahl', () => {
    for (const raw of [undefined, null, { available: false }, { version: 1, available: false, events: [] }]) {
      expect(makeDiagnosticExport({ ...input(), journal: raw }, defaultDiagnosticSelection(NOW), NOW).manifest.journal.availability).toBe('unavailable')
    }
    for (const raw of [{ version: 2, events: [] }, { version: 1, events: 'PRIVATE' }, { version: 1, retentionDays: 30, maxEntries: 800, events: [] }]) {
      const exported = makeDiagnosticExport({ ...input(), journal: raw }, defaultDiagnosticSelection(NOW), NOW)
      expect(exported.manifest.journal.availability).toBe('unsupported')
      expect(exported.logs).toEqual([])
    }
    const ready = makeDiagnosticExport(input(), defaultDiagnosticSelection(NOW), NOW)
    expect(ready.manifest.journal.availability).toBe('available')
    expect(ready.manifest.journal.droppedEvents).toBe(3)
    expect(ready.logs).toEqual([])
  })

  it('lässt korruptes/dupliziertes Material und nichtprimitive Details nicht in den Export gelangen', () => {
    const exported = makeDiagnosticExport(input([row(1), null, {}, { ...row(2), at: NaN }, { ...row(3), elapsedMs: -1 },
      { ...row(4), category: 'PRIVATE' }, { ...row(5), seq: 1 }, { ...row(6), details: [] },
      { ...row(7), details: { alarmVolume: Infinity, started: 'PRIVATE', outputTypes: [2, 'PRIVATE'], reasonCode: 'config',
        errorClass: 'android.app.ForegroundServiceStartNotAllowedException', kind: 'main' } }]), all(), NOW)
    expect(exported.logs.map(event => event.seq)).toEqual([1, 7])
    expect(exported.manifest.journal.invalidEvents).toBe(7)
    expect(exported.logs[1]?.details).toEqual({ reasonCode: 'config', errorClass: 'ForegroundServiceStartNotAllowedException', kind: 'main' })
    expect(JSON.stringify(exported)).not.toContain('PRIVATE')
  })

  it('begrenzt den Export nachvollziehbar auf die letzten800 nativen Sequenzen', () => {
    const source = input(Array.from({ length: 900 }, (_, index) => row(index + 1)))
    const exported = makeDiagnosticExport(source, defaultDiagnosticSelection(NOW), NOW)
    expect(exported.logs).toHaveLength(800)
    expect(exported.logs[0]?.seq).toBe(101)
    expect(exported.logs.at(-1)?.seq).toBe(900)
    expect(exported.manifest.journal.truncatedEvents).toBe(100)
  })

  it('setzt fehlende Metadaten oder Runtimefehler nicht in erfundene Hörbarkeitsbeweise um', () => {
    const exported = makeDiagnosticExport({ ...input([row(1)]), app: { version: 'PRIVATE_VERSION', build: 'PRIVATE_BUILD', sourceFingerprint: 'PRIVATE_FINGERPRINT', platform: 'web' },
      alarmDiagnostics: { error: 'PRIVATE_ERROR', testResult: 'heard' } }, defaultDiagnosticSelection(NOW), NOW)
    expect(exported.app).toEqual({ name: 'Anker', version: 'unknown', platform: 'web' })
    expect(exported.manifest.warnings.some(text => text.includes('weder Hörbarkeit noch Aufwachen'))).toBe(true)
    expect(exported).not.toHaveProperty('heard')
    expect(exported).not.toHaveProperty('awake')
    expect(exported.runtime?.alarm).toEqual({ testResult: 'heard' })
    expect(JSON.stringify(exported)).not.toContain('PRIVATE')
  })

  it.each([NaN, Infinity, -1])('weist unbrauchbare Exportzeitpunkte %s vor jeder Datenprojektion zurück', now => {
    expect(() => defaultDiagnosticSelection(now)).toThrow('Exportzeitpunkt')
    expect(() => makeDiagnosticExport(input(), defaultDiagnosticSelection(NOW), now)).toThrow('Exportzeitpunkt')
  })

  it('weist eine ungültige Auswahl klar zurück und normalisiert doppelte erlaubte Gruppen', () => {
    const selection = defaultDiagnosticSelection(NOW)
    for (const change of [{ from: NOW + 1 }, { to: NaN }, { categories: ['PRIVATE'] }, { settingsGroups: ['PRIVATE'] }, { includeCurrentStatus: 'false' }]) {
      expect(() => makeDiagnosticExport(input(), { ...selection, ...change } as DiagnosticExportSelection, NOW)).toThrow()
    }
    const exported = makeDiagnosticExport(input(), { ...selection, categories: ['bedtime', 'alarm', 'bedtime'], settingsGroups: ['sleep', 'sleep'] }, NOW)
    expect(exported.manifest.selection.categories).toEqual(['alarm', 'bedtime'])
    expect(exported.manifest.selection.settingsGroups).toEqual(['sleep'])
  })
})
