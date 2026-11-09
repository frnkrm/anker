import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { buildDayPlan } from '../core/planner'
import { defaultPcBridgeLocal, type PcAck, type PcEventsPayload, type PcStatePayload } from '../core/pcLink'
import type { DayLog, LocalData, Settings } from '../core/types'

const mocks = vi.hoisted(() => ({ native: true, state: {} as Record<string, unknown>, api: {
  pcBridgeDrainEvents: vi.fn(), pcBridgeAckEvents: vi.fn(), pcBridgeConfigure: vi.fn(), pcBridgeGetState: vi.fn(),
  pcBridgeSend: vi.fn(), pcBridgeStart: vi.fn(), pcBridgeStop: vi.fn(), pcBridgeEmergency: vi.fn(),
  pcBridgeUnpair: vi.fn(),
  pcBridgeWakeOnLan: vi.fn(), getAlarmState: vi.fn(),
}, view: {} as { state: 'connected'; connected: boolean; active: boolean; requestedActive: boolean; ack?: unknown; emergencyAck?: { commandId: string; until: number; receivedAt: number } } }))
vi.mock('./native', () => ({ isNative: () => mocks.native, AnkerNative: mocks.api }))
vi.mock('../state/store', () => ({ useApp: { getState: () => mocks.state }, today: () => '2026-11-09', planFor: (date: string, state: { settings: Settings; days: Record<string, DayLog> }) => buildDayPlan({ date, settings: state.settings, override: state.days[date]?.override }) }))

const at = Date.parse('2026-11-09T19:00:00Z')
const local = () => mocks.state.local as LocalData
function ack(state: PcStatePayload): PcAck { return { type: 'ack', revision: state.revision, receivedAt: new Date(at).toISOString(), effective: { date: state.date, mode: 'scheduled' }, companion: { version: '0.1.0', protocol: 3 }, warnings: [] } }

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(at)
  mocks.native = true
  const data = emptyLocal(); data.pcBridge = { ...defaultPcBridgeLocal(), enabled: true }
  mocks.state = { ready: true, settings: { ...defaultSettings('2026-11-09'), onboarded: true }, days: {}, inbox: [], events: [], local: data,
    saveLocal: vi.fn(async (fn: (value: LocalData) => LocalData) => { mocks.state.local = fn(local()) }),
    applyPcEvents: vi.fn(async (value: PcEventsPayload) => ({ appliedIds: value.items.map(event => event.id), cursor: Math.max(0, ...value.items.map(event => event.seq)) })),
    extendGuidanceEmergency: vi.fn(async () => undefined),
  }
  mocks.view = { state: 'connected', connected: true, active: true, requestedActive: true }
  mocks.api.pcBridgeGetState.mockImplementation(async () => mocks.view)
  mocks.api.getAlarmState.mockResolvedValue({ ringing: false, snoozed: 0 })
  mocks.api.pcBridgeDrainEvents.mockResolvedValue({ events: [], lastSeq: 0 })
  mocks.api.pcBridgeSend.mockResolvedValue({ sent: true, queued: false })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('PC-Plattformgrenzen und wahrheitsgemäße Bestätigungen', () => {
  it('startet im Web keine native Verbindung und behauptet dort keinen Empfang', async () => {
    mocks.native = false
    const { syncPcBridge, getPcBridgeView } = await import('./pcLink')
    await syncPcBridge()
    expect((await getPcBridgeView()).currentConfirmation).toBe(false)
    expect(mocks.api.pcBridgeDrainEvents).not.toHaveBeenCalled()
    expect(mocks.api.pcBridgeSend).not.toHaveBeenCalled()
  })

  it('erlaubt durch eine eingeschaltete Verbindung allein noch keine PC-Eingriffe', async () => {
    const { syncPcBridge } = await import('./pcLink')
    await syncPcBridge()
    const state = mocks.api.pcBridgeSend.mock.calls.map(([value]) => value.payload as PcStatePayload).find(value => value.type === 'state')!
    expect(state.prefs.enforceEnabled).toBe(false)
    expect(state.prefs.strictLock).toBe(false)
    expect(state.brainDump).toBeUndefined()
    expect(mocks.api.pcBridgeStart).not.toHaveBeenCalled()
  })

  it('bestätigt native Ereignisse erst nach erfolgreicher atomarer Anwendung', async () => {
    const order: string[] = []
    mocks.api.pcBridgeDrainEvents.mockResolvedValue({ events: [{ id: 'event-1', seq: 1, at: new Date(at).toISOString(), date: '2026-11-09', kind: 'pc-rest', basis: 'lock' }], lastSeq: 0 })
    vi.mocked(mocks.state.applyPcEvents as (payload: PcEventsPayload) => Promise<unknown>).mockImplementation(async value => { order.push('commit'); return { appliedIds: value.items.map(event => event.id), cursor: 1 } })
    mocks.api.pcBridgeAckEvents.mockImplementation(async () => { order.push('ack') })
    mocks.api.pcBridgeSend.mockImplementation(async () => { order.push('send'); return { sent: true, queued: false } })
    const { syncPcBridge } = await import('./pcLink')
    await syncPcBridge()
    expect(order.slice(0, 2)).toEqual(['commit', 'ack'])
    expect(order.indexOf('send')).toBeGreaterThan(1)
    expect(mocks.api.pcBridgeAckEvents).toHaveBeenCalledWith({ ids: ['event-1'] })
  })

  it('sendet nach einem Speicherfehler keinen alten Plan über ungeprüfte PC-Absichten', async () => {
    mocks.api.pcBridgeDrainEvents.mockResolvedValue({ events: [{ id: 'event-1', seq: 1, at: new Date(at).toISOString(), date: '2026-11-09', kind: 'extended', newStopAt: '2026-11-09T23:30:00Z' }], lastSeq: 0 })
    vi.mocked(mocks.state.applyPcEvents as (payload: PcEventsPayload) => Promise<unknown>).mockRejectedValue(new Error('storage'))
    const { syncPcBridge } = await import('./pcLink')
    await expect(syncPcBridge()).rejects.toThrow('storage')
    expect(mocks.api.pcBridgeAckEvents).not.toHaveBeenCalled()
    expect(mocks.api.pcBridgeSend).not.toHaveBeenCalled()
  })

  it('behandelt eine Sendewarteschlange und eine fremde Revision nicht als aktuelle Übernahme', async () => {
    mocks.api.pcBridgeSend.mockResolvedValue({ sent: false, queued: true })
    const { syncPcBridge, getPcBridgeView, getPcBridgePreview } = await import('./pcLink')
    mocks.view.ack = { ...ack((await getPcBridgePreview()).state), revision: 'old-revision' }
    await syncPcBridge()
    expect(local().pcBridge?.status).toBe('paired-never-reached')
    expect((await getPcBridgeView()).currentConfirmation).toBe(false)
  })

  it('vergleicht die Anzeige mit demselben echten Alarmzustand wie die Übertragung', async () => {
    mocks.api.getAlarmState.mockResolvedValue({ ringing: true, kind: 'main', snoozed: 0 })
    const { getPcBridgeView, getPcBridgePreview } = await import('./pcLink')
    const wanted = (await getPcBridgePreview()).state
    expect(wanted.state).toBe('ALARM_RINGING')
    mocks.view.ack = ack(wanted)
    expect((await getPcBridgeView()).currentConfirmation).toBe(true)
    mocks.view.ack = { ...ack(wanted), effective: { date: '2026-11-08', mode: 'scheduled' } }
    expect((await getPcBridgeView()).currentConfirmation).toBe(false)
  })

  it('übernimmt eine Notverlängerung nur nach passender nativer Befehlsbestätigung', async () => {
    mocks.api.pcBridgeEmergency.mockResolvedValue({ sent: true, tokenId: 'command-one', until: at + 15 * 60000 })
    mocks.view.emergencyAck = { commandId: 'command-one', until: at + 15 * 60000, receivedAt: at }
    const { requestPcEmergencyExtension } = await import('./pcLink')
    expect(await requestPcEmergencyExtension('fresh-hardware-scan', 15)).toBe(true)
    expect(mocks.state.extendGuidanceEmergency).toHaveBeenCalledWith('2026-11-09', 'command-one', at + 15 * 60000)
  })

  it('weist kaputte native Ereignisse vor jeder fachlichen Änderung zurück', async () => {
    mocks.api.pcBridgeDrainEvents.mockResolvedValue({ events: [{ id: 'bad', seq: 1.5, date: '2026-11-09', kind: 'pc-rest', at: new Date(at).toISOString() }], lastSeq: 0 })
    const { syncPcBridge } = await import('./pcLink')
    await expect(syncPcBridge()).rejects.toThrow()
    expect(mocks.state.applyPcEvents).not.toHaveBeenCalled()
    expect(mocks.api.pcBridgeAckEvents).not.toHaveBeenCalled()
  })

  it('mischt gleichzeitige unabhängige PC-Einstellungen erst innerhalb der Speicherqueue', async () => {
    let queue = Promise.resolve()
    vi.mocked(mocks.state.saveLocal as (fn: (value: LocalData) => LocalData) => Promise<void>).mockImplementation(fn => {
      queue = queue.then(() => { mocks.state.local = fn(local()) })
      return queue
    })
    const { updatePcBridgePreferences } = await import('./pcLink')
    await Promise.all([updatePcBridgePreferences({ dimEnabled: true }), updatePcBridgePreferences({ audioDuck: true })])
    expect(local().pcBridge?.preferences.dimEnabled).toBe(true)
    expect(local().pcBridge?.preferences.audioDuck).toBe(true)
  })

  it('verwirft eine verspätete Ereignisantwort nach dem Entkoppeln', async () => {
    let release!: (value: unknown) => void
    mocks.api.pcBridgeDrainEvents.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const { syncPcBridge, unpairPcCompanion } = await import('./pcLink')
    const running = syncPcBridge()
    await Promise.resolve()
    await unpairPcCompanion()
    release({ events: [{ id: 'old-pair-event', seq: 100, at: new Date(at).toISOString(), date: '2026-11-09', kind: 'thought', text: 'Alter PC' }], lastSeq: 0 })
    await running
    expect(mocks.state.applyPcEvents).not.toHaveBeenCalled()
    expect(mocks.api.pcBridgeAckEvents).not.toHaveBeenCalled()
    expect(local().pcBridge?.cursor).toBe(0)
    expect(local().pcBridge?.enabled).toBe(false)
  })
})
