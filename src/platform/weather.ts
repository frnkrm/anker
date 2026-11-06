import { addDays } from '../core/time'
import { currentWeatherProfile, weatherTarget, type WeatherTarget } from '../core/weatherProfile'
import { parseForecast, WEATHER_CACHE_MS, weatherAge } from '../core/weather'
import type { WeatherCache } from '../core/types'
import { useApp } from '../state/store'

// Open-Meteo: freiwillig, ohne API-Key für private nichtkommerzielle Nutzung; Daten CC BY 4.0.
// Anfragen enthalten ausschließlich freigegebene Koordinaten, nie Termintexte oder eine GPS-Abfrage.
const RETRY_MS = 60_000
const inFlight = new Map<string, Promise<WeatherCache | undefined>>()
const attemptedAt = new Map<string, number>()
let latestRequest = 0

interface City { name: string; lat: number; lng: number }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const coordinate = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max

export async function findCity(name: string): Promise<City | null> {
  const query = name.trim()
  if (!query || query.length > 200) return null
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&format=json&name=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const first: unknown = object(body) && Array.isArray(body.results) ? body.results[0] : undefined
    if (!object(first) || typeof first.name !== 'string' || !first.name.trim() || !coordinate(first.latitude, 90) || !coordinate(first.longitude, 180)) return null
    return { name: first.name, lat: first.latitude, lng: first.longitude }
  } catch { return null }
}

function contextFor(target: WeatherTarget): string | undefined {
  const state = useApp.getState()
  const profile = currentWeatherProfile(state.settings, state.local)
  if (!profile?.enabled) return undefined
  const current = weatherTarget(profile, state.local.places, target.source === 'place' ? target.placeId : undefined)
  if (!current || current.key !== target.key || current.source !== target.source || current.placeId !== target.placeId) return undefined
  return JSON.stringify([profile.enabled, profile.city, profile.lat, profile.lng, profile.revision, current.source, current.placeId, current.key])
}

/** Eine freie Offline-Erweiterung: niemals Wecker/Termine verändern oder fremde Ortsantworten übernehmen. */
export function loadWeather(force = false, requested?: WeatherTarget): Promise<WeatherCache | undefined> {
  const state = useApp.getState()
  const target = requested ?? weatherTarget(currentWeatherProfile(state.settings, state.local), state.local.places)
  if (!target) return Promise.resolve(undefined)
  const context = contextFor(target)
  if (!context) return Promise.resolve(undefined)
  const running = inFlight.get(context)
  if (running) return running
  const requestId = ++latestRequest
  const cache = state.local.weather
  const age = cache?.key === target.key ? weatherAge(cache) : undefined
  const fallback = age === undefined ? undefined : cache
  if (!force && age !== undefined && age < WEATHER_CACHE_MS) return Promise.resolve(fallback)
  const lastAttempt = attemptedAt.get(context)
  if (lastAttempt !== undefined && Date.now() - lastAttempt >= 0 && Date.now() - lastAttempt < RETRY_MS) return Promise.resolve(fallback)
  attemptedAt.set(context, Date.now())
  if (attemptedAt.size > 64) attemptedAt.delete(attemptedAt.keys().next().value!)
  const current = () => latestRequest === requestId && contextFor(target) === context
  const loading = (async (): Promise<WeatherCache | undefined> => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lng}&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m&forecast_days=3&timezone=Europe%2FBerlin`
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
      if (!response.ok) return current() ? fallback : undefined
      const hours = parseForecast(await response.json())
      if (!hours || !current()) return current() ? fallback : undefined
      const next: WeatherCache = { key: target.key, fetchedAt: Date.now(), validated: true, hours }
      let saved = false
      await useApp.getState().saveLocal((local) => {
        // Dieser Callback läuft erst in der Store-Schreibbarriere; Freigabe auch hier erneut prüfen.
        if (!current()) return local
        saved = true
        return { ...local, weather: next }
      })
      return saved && current() ? next : undefined
    } catch { return current() ? fallback : undefined }
  })()
  inFlight.set(context, loading)
  void loading.finally(() => { if (inFlight.get(context) === loading) inFlight.delete(context) })
  return loading
}

export function tomorrowOf(today: string) { return addDays(today, 1) }
