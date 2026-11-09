import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalData } from '../core/types'
import { emptyLocal } from '../core/defaults'

const mocks = vi.hoisted(() => ({ native: true, local: undefined as unknown as LocalData, available: vi.fn(), request: vi.fn(), check: vi.fn(), read: vi.fn(), accept: vi.fn(), save: vi.fn() }))
vi.mock('./native', () => ({ isNative: () => mocks.native }))
vi.mock('../state/store', () => ({ useApp: { getState: () => ({ local: mocks.local, saveLocal: mocks.save, acceptHealthSleep: mocks.accept }) } }))
vi.mock('@capgo/capacitor-health', () => ({ Health: { isAvailable: () => mocks.available(), requestAuthorization: (v: unknown) => mocks.request(v), checkAuthorization: (v: unknown) => mocks.check(v), readSamples: (v: unknown) => mocks.read(v) } }))
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { resolve, promise } }
const now = Date.parse('2026-11-09T09:00:00Z')
beforeEach(() => {
  vi.resetModules(); mocks.native = true; mocks.local = emptyLocal()
  mocks.available.mockReset().mockResolvedValue({ available: true })
  mocks.request.mockReset().mockResolvedValue({ readAuthorized: ['sleep'] })
  mocks.check.mockReset().mockResolvedValue({ readAuthorized: ['sleep'] })
  mocks.read.mockReset().mockResolvedValue({ samples: [{ dataType: 'sleep', startDate: '2026-11-08T22:00:00Z', endDate: '2026-11-09T06:00:00Z' }] })
  mocks.accept.mockReset().mockResolvedValue(true)
  mocks.save.mockReset().mockImplementation(async (fn: (local: LocalData) => LocalData) => { mocks.local = fn(mocks.local) })
})

describe('Gesonderte freiwillige Health-Schlafabfrage', () => {
  it('fragt ausgeschaltet und im Web weder Rechte noch Daten ab', async () => {
    const api = await import('./healthSleep')
    expect(await api.readHealthSleep(now)).toEqual({ status: 'off', suggestions: [] })
    mocks.native = false; mocks.local.healthSleepEnabled = true
    expect(await api.readHealthSleep(now)).toEqual({ status: 'off', suggestions: [] })
    expect(await api.chooseHealthSleep(true)).toBe('unavailable')
    expect(mocks.available).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
  })
  it('bittet nur nach eigener Wahl um sleep und liest erst nach Freigabe mit getrenntem Scope', async () => {
    const api = await import('./healthSleep')
    expect(await api.chooseHealthSleep(true)).toBe('enabled')
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith({ read: ['sleep'] })
    expect(mocks.read).not.toHaveBeenCalled()
    const result = await api.readHealthSleep(now)
    expect(result.status).toBe('ready'); expect(result.suggestions).toHaveLength(1)
    expect(mocks.check).toHaveBeenCalledExactlyOnceWith({ read: ['sleep'] })
    expect(mocks.read).toHaveBeenCalledWith({ dataType: 'sleep', startDate: '2026-10-25T23:00:00.000Z', endDate: '2026-11-09T09:00:00.000Z', limit: 500, ascending: false })
    expect(mocks.accept).not.toHaveBeenCalled()
  })
  it('belässt eine abgelehnte Freigabe aus und fragt beim Lesen nicht erneut nach Rechten', async () => {
    mocks.request.mockResolvedValue({ readAuthorized: [] })
    const api = await import('./healthSleep')
    expect(await api.chooseHealthSleep(true)).toBe('permission-needed')
    expect(mocks.local.healthSleepEnabled).not.toBe(true)
    mocks.local.healthSleepEnabled = true
    mocks.check.mockResolvedValue({ readAuthorized: [] })
    // Eigene vorherige Ablehnung hält diesen Lauf zusätzlich gestoppt.
    expect((await api.readHealthSleep(now)).suggestions).toEqual([])
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('beginnt nach Ausschalten während Verfügbarkeitsprüfung keine Sensorabfrage', async () => {
    mocks.local.healthSleepEnabled = true
    const gate = deferred<{ available: boolean }>(); mocks.available.mockReturnValueOnce(gate.promise)
    const api = await import('./healthSleep'), read = api.readHealthSleep(now)
    await api.chooseHealthSleep(false); gate.resolve({ available: true })
    expect(await read).toEqual({ status: 'off', suggestions: [] })
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
  })
  it('zeigt ein inzwischen entzogenes Leserecht ohne automatische neue Rechtefrage', async () => {
    mocks.local.healthSleepEnabled = true; mocks.check.mockResolvedValue({ readAuthorized: [] })
    const api = await import('./healthSleep')
    expect(await api.readHealthSleep(now)).toEqual({ status: 'permission-needed', suggestions: [] })
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
  })
  it('verwirft nach Ausschalten auch eine schon laufende Datenantwort', async () => {
    mocks.local.healthSleepEnabled = true
    const gate = deferred<{ samples: { dataType: string; startDate: string; endDate: string }[] }>(); mocks.read.mockReturnValueOnce(gate.promise)
    const api = await import('./healthSleep'), read = api.readHealthSleep(now)
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalled())
    await api.chooseHealthSleep(false); gate.resolve({ samples: [{ dataType: 'sleep', startDate: '2026-11-08T22:00:00Z', endDate: '2026-11-09T06:00:00Z' }] })
    expect(await read).toEqual({ status: 'off', suggestions: [] })
  })
  it('verwirft nach Aus-und-Ein auch ältere Antworten und überträgt den Guard in die Storequeue', async () => {
    mocks.local.healthSleepEnabled = true
    const gate = deferred<{ samples: [] }>(); mocks.read.mockReturnValueOnce(gate.promise)
    const api = await import('./healthSleep'), read = api.readHealthSleep(now)
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalled())
    await api.chooseHealthSleep(false); await api.chooseHealthSleep(true); gate.resolve({ samples: [] })
    expect(await read).toEqual({ status: 'off', suggestions: [] })
    const suggestion = { id: 'x', date: '2026-11-08', bedAt: 1, wakeAt: 2 }
    await api.importHealthSleep(suggestion)
    const guard = mocks.accept.mock.calls[0]?.[2] as () => boolean
    expect(guard()).toBe(true); await api.chooseHealthSleep(false); expect(guard()).toBe(false)
  })
  it('aktiviert nach Ausschalten während der Systemfreigabe keine alte Zustimmung', async () => {
    const gate = deferred<{ readAuthorized: string[] }>(); mocks.request.mockReturnValueOnce(gate.promise)
    const api = await import('./healthSleep'), choice = api.chooseHealthSleep(true)
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalled())
    await api.chooseHealthSleep(false); gate.resolve({ readAuthorized: ['sleep'] })
    expect(await choice).toBe('cancelled'); expect(mocks.local.healthSleepEnabled).toBe(false)
  })
  it('hält SDK-Ausfälle in der freiwilligen Funktion und verliert keine Daten', async () => {
    mocks.local.healthSleepEnabled = true; mocks.read.mockRejectedValue(new Error('private backend text'))
    const api = await import('./healthSleep')
    expect(await api.readHealthSleep(now)).toEqual({ status: 'error', suggestions: [] })
    expect(mocks.local.sleepDiary).toEqual({})
  })
})
