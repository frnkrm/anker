import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLocal, defaultSettings } from '../core/defaults'
import { createCountdown } from '../core/focus'
import { DEFAULT_GUIDANCE } from '../core/guidance'
import { buildDayPlan } from '../core/planner'
import type { DayLog, LocalData, Settings } from '../core/types'

const mocks = vi.hoisted(() => ({ native: true, state: {} as Record<string, unknown>, api: {
  getMorningHandoff: vi.fn(), ackMorningHandoff: vi.fn(), confirmMorningActivity: vi.fn(),
  syncRoutinePaceKeeper: vi.fn(), stopRoutinePaceKeeper: vi.fn(), stopSleepAudio: vi.fn(),
  startSleepAudio: vi.fn(), getSleepAudioState: vi.fn(),
}, scan: vi.fn(), pcSync: vi.fn(), emergency: vi.fn() }))
vi.mock('./native', () => ({ isNative: () => mocks.native, AnkerNative: mocks.api }))
vi.mock('./pcLink', () => ({ syncPcBridge: mocks.pcSync, requestPcEmergencyExtension: mocks.emergency }))
vi.mock('./qr', () => ({ scanQr: mocks.scan }))
vi.mock('../state/store', () => ({ useApp: { getState: () => mocks.state }, today: () => '2026-11-08', planFor: (date: string, state: { settings: Settings; days: Record<string, DayLog> }) => buildDayPlan({ date, settings: state.settings, override: state.days[date]?.override }) }))

const at = Date.parse('2026-11-09T02:30:00Z')
const local = () => mocks.state.local as LocalData
const settings = () => mocks.state.settings as Settings

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(at)
  mocks.native = true
  mocks.state = {
    ready: true, settings: { ...defaultSettings('2026-11-08'), onboarded: true, guidance: { ...DEFAULT_GUIDANCE, enabled: true, zeroGapMorning: true } },
    local: emptyLocal(), days: {}, showToast: vi.fn(),
    activateMorningFromAlarm: vi.fn().mockResolvedValue(true), verifyBedtime: vi.fn().mockResolvedValue(undefined), recordGuidanceInteraction: vi.fn().mockResolvedValue(undefined),
  }
  mocks.api.getMorningHandoff.mockResolvedValue({ pending: false })
  mocks.api.ackMorningHandoff.mockResolvedValue({ acknowledged: true })
  mocks.api.confirmMorningActivity.mockResolvedValue({ confirmed: true })
  mocks.pcSync.mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Dauerhafte Übergabe und freiwillige native Begleitung', () => {
  it('übergibt den echten frühen Wecktag und quittiert erst nach dauerhaftem Store-Erfolg', async () => {
    const order: string[] = []
    mocks.api.getMorningHandoff.mockResolvedValue({ pending: true, token: 'origin:stop', targetAt: at, at: at + 1000 })
    vi.mocked(mocks.state.activateMorningFromAlarm as (...args: unknown[]) => Promise<boolean>).mockImplementation(async () => { order.push('commit'); return true })
    mocks.api.ackMorningHandoff.mockImplementation(async () => { order.push('ack'); return { acknowledged: true } })
    const { completeMorningAlarmHandoff } = await import('./guidance')
    expect(await completeMorningAlarmHandoff()).toBe(true)
    expect(order).toEqual(['commit', 'ack'])
    expect(mocks.state.activateMorningFromAlarm).toHaveBeenCalledWith({ occurrenceId: String(at), targetDate: '2026-11-09', alarmAt: at, confirmedAt: at + 1000 })
  })

  it('bewahrt eine ungespeicherte Übergabe für den nächsten Versuch', async () => {
    mocks.api.getMorningHandoff.mockResolvedValue({ pending: true, token: 'one', targetAt: at, at })
    vi.mocked(mocks.state.activateMorningFromAlarm as (...args: unknown[]) => Promise<boolean>).mockRejectedValueOnce(new Error('storage'))
    const { completeMorningAlarmHandoff } = await import('./guidance')
    await expect(completeMorningAlarmHandoff()).rejects.toThrow('storage')
    expect(mocks.api.ackMorningHandoff).not.toHaveBeenCalled()
    expect(await completeMorningAlarmHandoff()).toBe(true)
  })

  it('leitet bei verlorenem Native-ACK nicht bei jeder Rückkehr erneut um', async () => {
    mocks.api.getMorningHandoff.mockResolvedValue({ pending: true, token: 'same', targetAt: at, at })
    mocks.api.ackMorningHandoff.mockRejectedValue(new Error('bridge'))
    const { resumeGuidanceHandoff } = await import('./guidance')
    expect(await resumeGuidanceHandoff()).toBe(true)
    expect(await resumeGuidanceHandoff()).toBe(false)
    expect(mocks.api.ackMorningHandoff).toHaveBeenCalledTimes(2)
  })

  it('erzeugt im Web und bei ausgeschaltetem Opt-in weder Weckfakten noch Dienste', async () => {
    const { completeMorningAlarmHandoff, syncGuidanceRuntime } = await import('./guidance')
    mocks.native = false
    expect(await completeMorningAlarmHandoff()).toBe(false)
    await syncGuidanceRuntime()
    expect(mocks.api.getMorningHandoff).not.toHaveBeenCalled()
    expect(mocks.api.syncRoutinePaceKeeper).not.toHaveBeenCalled()
    mocks.native = true; settings().guidance!.enabled = false
    expect(await completeMorningAlarmHandoff()).toBe(false)
    await syncGuidanceRuntime(); await syncGuidanceRuntime()
    expect(mocks.api.stopRoutinePaceKeeper).toHaveBeenCalledTimes(1)
    expect(mocks.state.activateMorningFromAlarm).not.toHaveBeenCalled()
  })

  it('nutzt die bestehende absolute Deadline und meldet automatischen Beginn nicht als Aktivität', async () => {
    settings().guidance = { ...DEFAULT_GUIDANCE, enabled: true, paceKeeper: true, speakSteps: true, antiRelapse: true }
    const plan = buildDayPlan({ date: '2026-11-08', settings: settings() })
    const step = plan.blocks.find(block => block.routine === 'morning')!.steps![0]!
    local().focus = { id: 'focus-one', target: { kind: 'routine', date: plan.date, routine: 'morning', stepId: step.id, minimal: false }, timer: createCountdown(120, at) }
    const { syncGuidanceRuntime } = await import('./guidance')
    await syncGuidanceRuntime(); await syncGuidanceRuntime()
    expect(mocks.api.syncRoutinePaceKeeper).toHaveBeenCalledTimes(1)
    expect(mocks.api.syncRoutinePaceKeeper).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, deadlineAt: at + 120000, durationMs: 120000, hapticsEnabled: true, speakStep: true }))
    expect(mocks.api.confirmMorningActivity).not.toHaveBeenCalled()
    expect(mocks.state.recordGuidanceInteraction).not.toHaveBeenCalled()
  })

  it('bestätigt den gescannten Abendübergang ohne einen Bettzeitpunkt zu erfinden', async () => {
    settings().guidance!.bedtimeQr = true
    mocks.scan.mockResolvedValue({ ok: true, value: settings().alarm.qrSecret })
    const { confirmBedtimeByQr } = await import('./guidance')
    expect(await confirmBedtimeByQr()).toBe(true)
    expect(mocks.state.verifyBedtime).toHaveBeenCalledWith('2026-11-08', expect.any(String))
    expect(local().guidance?.days['2026-11-08']?.nightLockedAt).toBeUndefined()
    mocks.scan.mockResolvedValue({ ok: true, value: 'wrong' })
    expect(await confirmBedtimeByQr()).toBe(false)
    expect(mocks.state.verifyBedtime).toHaveBeenCalledTimes(1)
  })

  it('wartet beim Schlafrauschen begrenzt auf den echten Vordergrundstart', async () => {
    settings().guidance!.sleepNoise = true
    mocks.api.startSleepAudio.mockResolvedValue({ active: false, phase: 'prepared' })
    mocks.api.getSleepAudioState.mockResolvedValue({ active: true, phase: 'playing' })
    const { startSleepNoise } = await import('./guidance')
    const started = startSleepNoise()
    await vi.advanceTimersByTimeAsync(100)
    await expect(started).resolves.toBeUndefined()
    expect(mocks.api.getSleepAudioState).toHaveBeenCalledTimes(1)
  })
})
