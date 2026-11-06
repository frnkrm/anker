import type { Rec } from '../data/types'
import type { LocalData, Place, Settings, WeatherProfile } from './types'

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const coordinate = (value: unknown, limit: number): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit

export function validWeatherProfile(value: unknown): value is WeatherProfile {
  return object(value) && typeof value.enabled === 'boolean' && typeof value.city === 'string'
    && (value.lat === undefined || coordinate(value.lat, 90)) && (value.lng === undefined || coordinate(value.lng, 180))
    && (value.revision === undefined || typeof value.revision === 'string')
}

/** Settings behalten Kleidungsvorlieben, Ort und Aktivierung sind ausschließlich lokal. */
export function weatherSettingsForSync(settings: Settings): Settings {
  const weather = { ...settings.weather, enabled: false, city: '' }
  delete weather.lat; delete weather.lng
  return { ...settings, weather }
}

/** Für Sync in beide Richtungen; ein bewusst importiertes lokales Backup nutzt diese Projektion nicht. */
export function weatherRecordForSync(record: Rec): Rec {
  if (record.collection !== 'settings' || record.deleted || !object(record.data) || !object(record.data.weather)) return record
  const weather: Record<string, unknown> = { ...record.data.weather, enabled: false, city: '' }
  delete weather.lat; delete weather.lng
  return { ...record, data: { ...record.data, weather } }
}

/** Additive Übernahme am zentralen Store-Load; Settings und LocalData anschließend gemeinsam committen. */
export function migrateWeatherState(settings: Settings, local: LocalData): { settings: Settings; local: LocalData; changed: boolean } {
  const legacy = settings.weather
  const supplied = local.weatherProfile
  // Beschädigte neue Felder nicht automatisch überschreiben. Der Nutzer kann den Ort neu wählen.
  if (supplied !== undefined && !validWeatherProfile(supplied)) return { settings, local, changed: false }
  const hasLegacy = legacy.enabled || !!legacy.city || legacy.lat !== undefined || legacy.lng !== undefined
  if (!hasLegacy) return { settings, local, changed: false }
  const profile = supplied ?? {
    enabled: legacy.enabled,
    city: legacy.city,
    ...(coordinate(legacy.lat, 90) ? { lat: legacy.lat } : {}),
    ...(coordinate(legacy.lng, 180) ? { lng: legacy.lng } : {}),
    revision: 'legacy-weather',
  }
  return { settings: weatherSettingsForSync(settings), local: { ...local, weatherProfile: profile }, changed: true }
}

/** Vor dem Store-Migrationsanschluss bleibt der bestehende Ort ohne erneute Freigabe nutzbar. */
export function currentWeatherProfile(settings: Settings, local: LocalData): WeatherProfile | undefined {
  if (local.weatherProfile !== undefined) return validWeatherProfile(local.weatherProfile) ? local.weatherProfile : undefined
  const legacy = settings.weather
  return validWeatherProfile(legacy) ? legacy : undefined
}

export interface WeatherTarget { key: string; label: string; lat: number; lng: number; source: 'city' | 'place'; placeId?: string }

export function weatherTarget(profile: WeatherProfile | undefined, places: readonly Place[], placeId?: string, placeKind?: 'home' | 'office'): WeatherTarget | undefined {
  if (!profile?.enabled) return undefined
  const place = placeId ? places.find((item) => item.id === placeId) : placeKind ? places.find((item) => item.kind === placeKind) : undefined
  if (place?.externalUse?.weather && coordinate(place.latitude, 90) && coordinate(place.longitude, 180)) {
    return { key: `${place.latitude},${place.longitude}`, label: place.label, lat: place.latitude, lng: place.longitude, source: 'place', placeId: place.id }
  }
  if (!coordinate(profile.lat, 90) || !coordinate(profile.lng, 180)) return undefined
  return { key: `${profile.lat},${profile.lng}`, label: profile.city || 'Dein gewählter Wetterort', lat: profile.lat, lng: profile.lng, source: 'city' }
}

export function validWeatherLocal(value: unknown): boolean {
  return object(value) && (value.weatherProfile === undefined || validWeatherProfile(value.weatherProfile))
}
