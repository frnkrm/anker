import { addDays } from '../core/time'
import type { WeatherCache } from '../core/types'
import { useApp } from '../state/store'

// Open-Meteo: kein API-Key, für private nichtkommerzielle Nutzung frei (CC BY 4.0, unter 10.000 Abrufen am Tag).
// Übertragen wird nur der gewählte Ort, keine Termine, keine GPS-Abfrage. Aus, bis du es einschaltest.
const CACHE_MS = 3 * 3600_000

interface ForecastResponse {
  hourly: { time: string[]; temperature_2m: number[]; apparent_temperature: number[]; precipitation_probability: number[]; wind_speed_10m: number[] }
}

/** Sucht den vom Nutzer eingegebenen Ort. null = nichts gefunden oder nicht erreichbar. */
export async function findCity(name: string): Promise<{ name: string; lat: number; lng: number } | null> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&format=json&name=${encodeURIComponent(name)}`)
    if (!r.ok) return null
    const first = ((await r.json()) as { results?: { name: string; latitude: number; longitude: number }[] }).results?.[0]
    return first ? { name: first.name, lat: first.latitude, lng: first.longitude } : null
  } catch {
    return null
  }
}

/** Liefert die Vorhersage aus dem Cache oder dem Netz. undefined heißt: gerade nicht verfügbar. Nie etwas Erfundenes. */
export async function loadWeather(force = false): Promise<WeatherCache | undefined> {
  const st = useApp.getState()
  const w = st.settings.weather
  if (!w.enabled || w.lat === undefined || w.lng === undefined) return undefined
  const key = `${w.lat},${w.lng}`
  const cached = st.local.weather
  if (!force && cached?.key === key && Date.now() - cached.fetchedAt < CACHE_MS) return cached
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lng}&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m&forecast_days=3&timezone=Europe%2FBerlin`
    const r = await fetch(url)
    if (!r.ok) return cached?.key === key ? cached : undefined
    const h = ((await r.json()) as ForecastResponse).hourly
    const hours = h.time.map((t, i) => ({
      date: t.slice(0, 10),
      minutes: Number(t.slice(11, 13)) * 60,
      tempC: h.temperature_2m[i] ?? 0,
      apparentC: h.apparent_temperature[i] ?? 0,
      rainPct: h.precipitation_probability[i] ?? 0,
      windKmh: h.wind_speed_10m[i] ?? 0,
    }))
    const next: WeatherCache = { key, fetchedAt: Date.now(), hours }
    await st.saveLocal((l) => ({ ...l, weather: next }))
    return next
  } catch {
    return cached?.key === key ? cached : undefined
  }
}

export function tomorrowOf(today: string) {
  return addDays(today, 1)
}
