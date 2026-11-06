import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import type { LocalData, Settings } from '../core/types'
import { findCity, loadWeather } from './weather'

const context = vi.hoisted(() => ({ settings: undefined as unknown as Settings, local: undefined as unknown as LocalData, saveLocal: vi.fn() }))
vi.mock('../state/store', () => ({ useApp: { getState: () => context } }))
let fixture = 0
const at = Date.parse('2026-11-06T19:00:00+01:00')
const payload = (temp: unknown = 8) => ({ hourly: { time: ['2026-11-07T07:00'], temperature_2m: [temp], apparent_temperature: [temp], precipitation_probability: [20], wind_speed_10m: [12] } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  context.settings = defaultSettings('2026-11-06')
  context.settings.weather = { ...context.settings.weather, enabled: true, city: 'Ort A', lat: 50, lng: 9 }
  context.local = { ...emptyLocal(), weatherProfile: { enabled: true, city: 'Ort A', lat: 50, lng: 9, revision: `fixture-${++fixture}` } }
  context.saveLocal = vi.fn(async (fn: (local: LocalData) => LocalData) => { context.local = fn(context.local) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Wetter ist eine freiwillige validierte Eingabe', () => {
  it('macht aus fehlender Temperatur keine erfundenen null Grad', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload(null) })))
    expect(await loadWeather()).toBeUndefined()
    expect(context.saveLocal).not.toHaveBeenCalled()
  })

  it('fasst gleichzeitige gleiche Abrufe zusammen', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const fetch = vi.fn(async (_input?: unknown) => { await pending; return { ok: true, json: async () => payload() } })
    vi.stubGlobal('fetch', fetch)
    const first = loadWeather(); const second = loadWeather()
    release()
    expect(await first).toMatchObject({ key: '50,9' })
    expect(await second).toMatchObject({ key: '50,9' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(context.saveLocal).toHaveBeenCalledTimes(1)
  })

  it('verwirft eine alte Ortsantwort nach einer neueren Wahl', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(async () => { await pending; return { ok: true, json: async () => payload() } }))
    const loading = loadWeather()
    context.settings = { ...context.settings, weather: { ...context.settings.weather, city: 'Ort B', lat: 52, lng: 10 } }
    context.local = { ...context.local, weatherProfile: { enabled: true, city: 'Ort B', lat: 52, lng: 10 } }
    release()
    expect(await loading).toBeUndefined()
    expect(context.local.weather).toBeUndefined()
  })

  it('speichert nach Ausschalten keine späte Antwort und fragt ausgeschaltet nichts ab', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const fetch = vi.fn(async (_input?: unknown) => { await pending; return { ok: true, json: async () => payload() } })
    vi.stubGlobal('fetch', fetch)
    const loading = loadWeather()
    context.settings = { ...context.settings, weather: { ...context.settings.weather, enabled: false } }
    context.local = { ...context.local, weatherProfile: { ...context.local.weatherProfile!, enabled: false } }
    release()
    expect(await loading).toBeUndefined()
    expect(await loadWeather()).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(context.saveLocal).not.toHaveBeenCalled()
  })

  it('zeigt einen beschriftbaren alten Cache bei Netzausfall, nutzt aber keine ungeprüften oder zu alten Nulldaten', async () => {
    const hour = { date: '2026-11-07', minutes: 420, tempC: 8, apparentC: 6, rainPct: 20, windKmh: 12 }
    context.local.weather = { key: '50,9', fetchedAt: at - 4 * 3600_000, validated: true, hours: [hour] }
    const fetch = vi.fn(async (_input?: unknown) => { throw new Error('offline') })
    vi.stubGlobal('fetch', fetch)
    expect(await loadWeather()).toEqual(context.local.weather)
    expect(await loadWeather(true)).toEqual(context.local.weather)
    expect(fetch).toHaveBeenCalledTimes(1) // Wiederholen innerhalb einer Minute erzeugt keine Abrufflut.
    vi.setSystemTime(at + 25 * 3600_000)
    expect(await loadWeather()).toBeUndefined()
    expect(context.local.weather.hours).toEqual([hour]) // Altdaten werden weder gelöscht noch als frisch ausgegeben.
  })

  it('benutzt einen geprüften frischen Cache ohne Netz und verwirft Antworten auch innerhalb der wartenden Storeaktion', async () => {
    const cache = { key: '50,9', fetchedAt: at, validated: true as const, hours: [{ date: '2026-11-07', minutes: 420, tempC: 8, apparentC: 6, rainPct: 20, windKmh: 12 }] }
    context.local.weather = cache
    const fetch = vi.fn(async (_input?: unknown) => ({ ok: true, json: async () => payload() }))
    vi.stubGlobal('fetch', fetch)
    expect(await loadWeather()).toBe(cache)
    expect(fetch).not.toHaveBeenCalled()
    let reached!: () => void; let release!: () => void
    const writing = new Promise<void>((resolve) => { reached = resolve })
    const blocked = new Promise<void>((resolve) => { release = resolve })
    context.saveLocal = vi.fn(async (fn: (local: LocalData) => LocalData) => { reached(); await blocked; context.local = fn(context.local) })
    const loading = loadWeather(true)
    await writing
    context.local = { ...context.local, weatherProfile: { ...context.local.weatherProfile!, enabled: false } }
    release()
    expect(await loading).toBeUndefined()
    expect(context.local.weather).toEqual(cache)
  })

  it('überträgt von einem freigegebenen Kundenort nur Koordinaten und prüft eine inzwischen entzogene Freigabe', async () => {
    context.local.places = [{ id: 'customer', label: 'Privater Kundenname', address: 'Private Adresse', latitude: 52, longitude: 10, externalUse: { weather: true } }]
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const fetch = vi.fn(async (_input?: unknown) => { await pending; return { ok: true, json: async () => payload() } })
    vi.stubGlobal('fetch', fetch)
    const loading = loadWeather(false, { key: '52,10', label: 'Privater Kundenname', source: 'place', placeId: 'customer', lat: 52, lng: 10 })
    expect(String(fetch.mock.calls[0]?.[0])).toContain('latitude=52&longitude=10')
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain('Privat')
    context.local.places[0]!.externalUse = { weather: false }
    release()
    expect(await loading).toBeUndefined()
    expect(context.local.weather).toBeUndefined()
  })

  it('validiert Stadtsuche ohne Koordinaten zu raten und kodiert den bewussten Suchtext', async () => {
    const fetch = vi.fn(async (_input?: unknown): Promise<{ ok: boolean; json: () => Promise<unknown> }> => ({ ok: true, json: async () => ({ results: [{ name: 'Teststadt', latitude: 51, longitude: 9 }] }) }))
    vi.stubGlobal('fetch', fetch)
    expect(await findCity('Stadt & Umgebung')).toEqual({ name: 'Teststadt', lat: 51, lng: 9 })
    expect(String(fetch.mock.calls[0]?.[0])).toContain('Stadt%20%26%20Umgebung')
    fetch.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ results: [{ name: 'Ungültig', latitude: null, longitude: 9 }] }) }))
    expect(await findCity('Ungültig')).toBeNull()
    expect(await findCity('')).toBeNull()
  })
})
