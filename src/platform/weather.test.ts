import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import type { LocalData, Settings } from '../core/types'
import { loadWeather } from './weather'

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
    const fetch = vi.fn(async () => { await pending; return { ok: true, json: async () => payload() } })
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
    const fetch = vi.fn(async () => { await pending; return { ok: true, json: async () => payload() } })
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
})
