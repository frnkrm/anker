import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { nextAlarmTimes } from '../core/alarm'
import { zonedToUtc } from '../core/time'
import type { AnkerNativePlugin } from './native'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from '../state/store'
import { applyWakeChange } from './wakeChange'

const mocks = vi.hoisted(() => ({ repo: undefined as Repository | undefined, native: true, sync: vi.fn<AnkerNativePlugin['syncAlarmConfig']>() }))
vi.mock('../data', () => ({ getRepository: async () => mocks.repo! }))
vi.mock('./native', () => ({ isNative: () => mocks.native, AnkerNative: { syncAlarmConfig: mocks.sync } }))
const date = '2026-11-02'
const tomorrow = '2026-11-03'
const at = zonedToUtc(date, 19 * 60)
const app = () => useApp.getState()

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  mocks.repo = new MemoryRepository(); mocks.native = true
  mocks.sync.mockReset().mockImplementation(async (config) => ({ ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: nextAlarmTimes(config, Date.now()).mainAt }))
  useApp.setState({ ready: false, settings: { ...defaultSettings(date), onboarded: true }, local: emptyLocal(), days: {}, inbox: [], game: initialGame(date), alarmStatus: undefined })
  await app().load()
  await app().saveSettings((settings) => ({ ...settings, onboarded: true }))
})
afterEach(() => vi.useRealTimers())

describe('Bewusste einmalige Weckänderung', () => {
  it('speichert im Web nur den Plan und behauptet keine Android-Bestätigung', async () => {
    mocks.native = false
    const result = await applyWakeChange(tomorrow, 7 * 60 + 25)
    expect(result).toMatchObject({ kind: 'plan' }); expect(result.message).toContain('keinen Android-Wecker')
    expect(app().days[tomorrow]?.override.wakeOverride).toBe(445)
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('wartet auf die aktuelle native Bestätigung und überträgt ausschließlich die Tagesausnahme', async () => {
    let release!: () => void; let reached!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve }); const started = new Promise<void>((resolve) => { reached = resolve })
    mocks.sync.mockImplementationOnce(async (config) => { reached(); await gate; return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: nextAlarmTimes(config, Date.now()).mainAt } })
    let resolved = false
    const result = applyWakeChange(tomorrow, 445).then((value) => { resolved = true; return value })
    await started
    expect(resolved).toBe(false)
    expect(app().alarmStatus?.configurationKey).toBeUndefined()
    release()
    expect(await result).toMatchObject({ kind: 'native' })
    expect(mocks.sync.mock.calls.at(-1)?.[0].wakeOverrides).toEqual({ [tomorrow]: 445 })
    expect(app().settings.anchor.wake).not.toBe(445)
    expect(app().local.meds).toEqual({})
  })

  it('behält bei nativem Fehler die vorherige Planzeit und echte Tageserledigungen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await app().updateDay(tomorrow, (log) => ({ ...log, override: { ...log.override, wakeOverride: 450 }, steps: { 'morning:teeth': 'done' } }))
    const game = structuredClone(app().game)
    mocks.sync.mockRejectedValueOnce(new Error('Android nicht erreichbar'))
    await expect(applyWakeChange(tomorrow, 500)).rejects.toThrow('vorherige Planzeit')
    expect(app().days[tomorrow]?.override.wakeOverride).toBe(450)
    expect(app().days[tomorrow]?.steps['morning:teeth']).toBe('done')
    expect(app().game).toEqual(game)
    expect(mocks.sync.mock.calls.map(([config]) => config.wakeOverrides[tomorrow])).toEqual([500, 450])
  })

  it('lässt einen alten Fehler keine neuere bewusste Weckentscheidung zurückrollen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let release!: () => void; let reached!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve }); const entered = new Promise<void>((resolve) => { reached = resolve })
    mocks.sync.mockImplementationOnce(async () => { reached(); await gate; throw new Error('Alte Antwort') })
    const first = applyWakeChange(tomorrow, 445)
    await entered
    const second = applyWakeChange(tomorrow, 500)
    await expect.poll(() => app().days[tomorrow]?.override.wakeOverride).toBe(500)
    release()
    expect(await first).toMatchObject({ kind: 'plan' })
    expect(await second).toMatchObject({ kind: 'native' })
    expect(app().days[tomorrow]?.override.wakeOverride).toBe(500)
  })

  it('weist ungültige oder vergangene Zeitpunkte ab, bevor der Plan verändert wird', async () => {
    const before = structuredClone(app().days)
    for (const [d, value] of [[date, 8 * 60], ['2026-02-30', 500], [tomorrow, -5], [tomorrow, NaN], [tomorrow, 1440], [tomorrow, 445.5]] as const) {
      await expect(applyWakeChange(d, value)).rejects.toThrow()
    }
    expect(app().days).toEqual(before)
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('schaltet einen deaktivierten Wecker durch die Tagesausnahme nicht heimlich ein', async () => {
    await app().saveSettings((settings) => ({ ...settings, alarm: { ...settings.alarm, enabled: false } }))
    const result = await applyWakeChange(tomorrow, 445)
    expect(result.kind).toBe('plan'); expect(result.message).toContain('ausgeschaltet')
    expect(app().settings.alarm.enabled).toBe(false)
  })
})
