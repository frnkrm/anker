// Vorschläge für das tatsächliche Zeitfenster, keine Pflicht und keine erfundenen Messwerte.
import { daysBetween, fmtTime } from './time'
import type { DayPlan, Settings, WeatherCache } from './types'

export interface WeatherHour {
  minutes: number
  tempC: number
  apparentC: number
  rainPct: number
  windKmh: number
}
export interface OutdoorWindow { from: number; to: number; placeId?: string; placeKind?: 'home' | 'office'; label?: string }
export interface WeatherAdvice { windowLabel: string; summary: string; suggestions: string[] }
export const WEATHER_CACHE_MS = 3 * 3600_000
export const WEATHER_MAX_AGE_MS = 24 * 3600_000
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

function validReading(value: unknown): value is WeatherHour {
  return object(value) && finite(value.minutes) && finite(value.tempC) && value.tempC >= -100 && value.tempC <= 80
    && finite(value.apparentC) && value.apparentC >= -120 && value.apparentC <= 100
    && finite(value.rainPct) && value.rainPct >= 0 && value.rainPct <= 100 && finite(value.windKmh) && value.windKmh >= 0 && value.windKmh <= 500
}

/** API-Werte sind unbekannte Eingaben. Unvollständige Stunden bleiben unbekannt, auch wenn null geliefert wird. */
export function parseForecast(value: unknown): WeatherCache['hours'] | undefined {
  if (!object(value) || !object(value.hourly)) return undefined
  const hourly = value.hourly
  const keys = ['time', 'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'wind_speed_10m'] as const
  if (!keys.every((key) => Array.isArray(hourly[key])) || (hourly.time as unknown[]).length > 1000) return undefined
  const hours: WeatherCache['hours'] = []
  for (const [index, rawTime] of (hourly.time as unknown[]).entries()) {
    if (typeof rawTime !== 'string') continue
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(rawTime)
    if (!match || !date(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59) continue
    const hour = {
      date: match[1], minutes: Number(match[2]) * 60 + Number(match[3]),
      tempC: (hourly.temperature_2m as unknown[])[index], apparentC: (hourly.apparent_temperature as unknown[])[index],
      rainPct: (hourly.precipitation_probability as unknown[])[index], windKmh: (hourly.wind_speed_10m as unknown[])[index],
    }
    if (validReading(hour)) hours.push(hour)
  }
  return hours.length ? hours : undefined
}

export function validWeatherCache(value: unknown): value is WeatherCache {
  return object(value) && value.validated === true && typeof value.key === 'string' && finite(value.fetchedAt) && value.fetchedAt >= 0
    && Array.isArray(value.hours) && value.hours.length > 0 && value.hours.length <= 1000
    && value.hours.every((hour) => validReading(hour) && object(hour) && date(hour.date) && hour.minutes >= 0 && hour.minutes < 1440)
}

export function weatherAge(cache: WeatherCache | undefined, now = Date.now()): number | undefined {
  if (!validWeatherCache(cache)) return undefined
  const age = now - cache.fetchedAt
  return age >= 0 && age <= WEATHER_MAX_AGE_MS ? age : undefined
}

/** Sowohl Terminfahrten als auch reale Pendelblöcke vergleichen; keine pauschale Ein-Stunden-Fahrt. */
export function outdoorWindow(plan: DayPlan): OutdoorWindow | undefined {
  const windows: OutdoorWindow[] = []
  for (const leg of plan.legs ?? []) {
    if (leg.commitment.status === 'cancelled' || leg.commitment.routeMode === 'none'
      || leg.commitment.locationKind === 'remote' || leg.commitment.locationKind === 'home' || leg.leave === undefined) continue
    const to = leg.travelMin !== undefined ? leg.leave + leg.travelMin : leg.commitment.start
    if (to > leg.leave) windows.push({ from: leg.leave, to, placeId: leg.commitment.placeId, label: leg.toLabel })
  }
  if (!plan.homeOffice) {
    for (const block of plan.blocks.filter((block) => block.kind === 'commute' && block.end > block.start)) {
      windows.push({ from: block.start, to: block.end, placeKind: block.title === 'Heimweg' ? 'home' : 'office', label: block.title })
    }
    if (!windows.length && plan.leave !== undefined && plan.workInfo && plan.workInfo.plannedStart > plan.leave) {
      windows.push({ from: plan.leave, to: plan.workInfo.plannedStart, placeKind: 'office', label: 'Arbeitsweg' })
    }
  }
  return windows.sort((a, b) => a.from - b.from)[0]
}

/** Späte Planminuten können am nächsten Kalendertag liegen. */
export function weatherHoursForPlan(cache: WeatherCache, planDate: string): WeatherHour[] {
  return cache.hours.map((hour) => ({ ...hour, minutes: hour.minutes + daysBetween(planDate, hour.date) * 1440 }))
}

export function weatherAdvice(hours: WeatherHour[], window: OutdoorWindow, rules: Settings['weather']['rules'], dayLabel = 'Morgen'): WeatherAdvice | undefined {
  const from = Math.floor(window.from / 60) * 60
  const relevant = hours.filter((hour) => validReading(hour) && hour.minutes >= from && hour.minutes <= window.to)
  if (!relevant.length) return undefined
  const low = Math.round(Math.min(...relevant.map((hour) => hour.apparentC)))
  const high = Math.round(Math.max(...relevant.map((hour) => hour.apparentC)))
  const temp = Math.round(Math.min(...relevant.map((hour) => hour.tempC)))
  const rain = Math.max(...relevant.map((hour) => hour.rainPct))
  const wind = Math.round(Math.max(...relevant.map((hour) => hour.windKmh)))
  const suggestions: string[] = []
  if (low < rules.jacketBelowC) suggestions.push('Jacke')
  if (rain >= rules.rainAbovePct) suggestions.push('Regenjacke oder Schirm')
  const felt = low === high ? `gefühlt ${low} °C` : `gefühlt ${low} bis ${high} °C`
  return { windowLabel: `${dayLabel} ${fmtTime(window.from)} bis ${fmtTime(window.to)} Uhr`,
    summary: `${temp} °C, ${felt}, Regenrisiko ${Math.round(rain)} %, Wind bis ${wind} km/h`, suggestions }
}
