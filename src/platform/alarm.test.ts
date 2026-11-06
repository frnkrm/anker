import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../core/defaults'
import type { AlarmPlanningStatus } from '../core/alarm'
import type { DayLog, Settings } from '../core/types'
import type { AnkerNativePlugin } from './native'

const mocks = vi.hoisted(() => ({
  state: { settings: undefined as unknown as Settings, days: {} as Record<string, DayLog>, setAlarmStatus: vi.fn<(status: AlarmPlanningStatus) => void>() },
  sync: vi.fn<AnkerNativePlugin['syncAlarmConfig']>(),
  native: true,
}))
vi.mock('../state/store', () => ({ useApp: { getState: () => mocks.state }, today: () => '2026-11-02' }))
vi.mock('./native', () => ({ isNative: () => mocks.native, AnkerNative: { syncAlarmConfig: mocks.sync } }))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetModules()
  mocks.native = true
  mocks.state = { settings: { ...defaultSettings('2026-11-02'), onboarded: true }, days: {}, setAlarmStatus: vi.fn() }
  mocks.sync.mockReset().mockImplementation(async (config) => ({ ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: config.wakeMinutes * 60_000 }))
})
afterEach(() => vi.restoreAllMocks())

describe('Serieller Weckerkonfigurationsabgleich', () => {
  it('lässt direkte Aufrufer nicht überholen und meldet keinen alten Planungsstatus nach neuer Einstellung', async () => {
    const gate = deferred(); const entered = deferred()
    mocks.sync.mockImplementationOnce(async () => {
      entered.resolve(); await gate.promise
      return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: 1 }
    })
    const { syncAlarm } = await import('./alarm')
    const first = syncAlarm(); await entered.promise
    const settings = { ...mocks.state.settings, anchor: { ...mocks.state.settings.anchor, wake: 500 } }
    mocks.state = { ...mocks.state, settings }
    expect(syncAlarm()).toBe(first)
    expect(mocks.sync).toHaveBeenCalledTimes(1)
    expect(mocks.state.setAlarmStatus).not.toHaveBeenCalled()
    gate.resolve(); await first
    expect(mocks.sync.mock.calls.at(-1)?.[0].wakeMinutes).toBe(500)
    expect(mocks.state.setAlarmStatus.mock.calls.every(([status]) => status.scheduledAt === 500 * 60_000)).toBe(true)
  })

  it('holt eine Änderung auch nach, wenn der aufrufende UI-Abgleich noch nicht ausgelöst wurde', async () => {
    const gate = deferred(); const entered = deferred()
    mocks.sync.mockImplementationOnce(async () => {
      entered.resolve(); await gate.promise
      return { ringing: false, snoozed: 0, exact: false, scheduledAt: 1 }
    })
    const { syncAlarm } = await import('./alarm')
    const first = syncAlarm(); await entered.promise
    mocks.state = { ...mocks.state, days: { '2026-11-03': { date: '2026-11-03', override: { wakeOverride: 600 }, steps: {} } } }
    gate.resolve(); await first
    expect(mocks.sync.mock.calls.at(-1)?.[0].wakeOverrides).toEqual({ '2026-11-03': 600 })
    expect(mocks.state.setAlarmStatus).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ok: true }))
  })

  it('führt Fehler sichtbar und kann danach wieder erfolgreich planen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.sync.mockRejectedValueOnce(new Error('Native Planung fehlgeschlagen'))
    const { syncAlarm } = await import('./alarm')
    await syncAlarm()
    expect(mocks.state.setAlarmStatus).toHaveBeenLastCalledWith({ ok: false, message: 'Native Planung fehlgeschlagen' })
    await syncAlarm()
    expect(mocks.state.setAlarmStatus).toHaveBeenLastCalledWith(expect.objectContaining({ ok: true }))
  })

  it('überträgt weder im Web noch vor der bewussten Einrichtung eine Konfiguration', async () => {
    const { syncAlarm } = await import('./alarm')
    mocks.native = false; await syncAlarm()
    mocks.native = true; mocks.state.settings = { ...mocks.state.settings, onboarded: false }; await syncAlarm()
    expect(mocks.sync).not.toHaveBeenCalled()
  })
})
