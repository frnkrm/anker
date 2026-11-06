import type { Commitment, LocalData, Place } from './types'
import { zonedToUtc } from './time'
import { validExtrasLocal, type GeofenceChoice } from './extras'

export interface GeofenceVisit {
  id: string
  revision: string
  latitude: number
  longitude: number
  radiusM: number
  dwellMs: number
  startsAt: number
  expiresAt: number
}
export interface GeofenceSuggestion { id: string; visitId: string; revision: string; at: number }
export interface GeofenceStatus {
  enabled?: boolean
  available?: boolean
  registered: number
  fineGranted: boolean
  backgroundGranted: boolean
  updating?: boolean
  error?: string
  suggestions?: GeofenceSuggestion[]
}
export interface GeofenceSnapshot { enabled: boolean; visits: GeofenceVisit[] }

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && !!value && value.length <= max
export function validCoordinates(place: Pick<Place, 'latitude' | 'longitude'>): place is Pick<Place, 'latitude' | 'longitude'> & { latitude: number; longitude: number } {
  return typeof place.latitude === 'number' && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
    && typeof place.longitude === 'number' && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180
}

function hash(text: string): string {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return (value >>> 0).toString(16)
}

/** Nur bewusst gewählte aktuelle Besuche. Keine Standortabfrage, keine automatische Ankunft. */
export function geofenceSnapshot(local: Pick<LocalData, 'extras' | 'commitments' | 'places'>, now: number): GeofenceSnapshot {
  const selection = local.extras?.geofences
  if (!validExtrasLocal(local.extras) || !selection?.enabled || !timestamp(now)) return { enabled: false, visits: [] }
  const places = new Map(local.places.map((place) => [place.id, place]))
  const visits: GeofenceVisit[] = []
  for (const commitment of local.commitments) {
    const choice = selection.visits[commitment.id]
    const place = commitment.placeId && places.get(commitment.placeId)
    if (!choice || !place || !validCoordinates(place) || !bounded(commitment.id, 200)
      || choice.placeId !== place.id || choice.latitude !== place.latitude || choice.longitude !== place.longitude
      || commitment.status === 'cancelled' || commitment.arrivedAt !== undefined || commitment.backAt !== undefined
      || commitment.locationKind === 'remote' || commitment.locationKind === 'home' || commitment.routeMode === 'none'
      || !timestamp(choice.consentedAt) || choice.consentedAt > now + 60_000
      || !Number.isFinite(choice.radiusM) || choice.radiusM < 100 || choice.radiusM > 1000
      || !Number.isFinite(choice.dwellMs) || choice.dwellMs < 60_000 || choice.dwellMs > 900_000) continue
    try {
      const start = zonedToUtc(commitment.date, commitment.start)
      const end = commitment.end === undefined ? start + 4 * 3600_000 : zonedToUtc(commitment.date, commitment.end) + 3600_000
      const startsAt = Math.max(0, start - 3 * 3600_000)
      const expiresAt = Math.min(end, start + 12 * 3600_000)
      if (!timestamp(start) || !timestamp(end) || expiresAt <= now || expiresAt <= startsAt || startsAt > now + 24 * 3600_000) continue
      const raw = { id: commitment.id, latitude: place.latitude, longitude: place.longitude, radiusM: choice.radiusM, dwellMs: choice.dwellMs, startsAt, expiresAt }
      visits.push({ ...raw, revision: `geo2:${hash(JSON.stringify([raw, commitment.placeId, choice.consentedAt]))}` })
      if (visits.length === 20) break
    } catch { /* Fehlerhafter Altwert erzeugt keine native Ortungsdefinition. */ }
  }
  return { enabled: true, visits }
}

export function validGeofenceSuggestion(value: unknown): value is GeofenceSuggestion {
  return object(value) && bounded(value.id, 200) && bounded(value.visitId, 200) && bounded(value.revision, 100) && timestamp(value.at)
}

/** Ein verspäteter Callback einer alten Auswahl darf auch nach Neuplanung nicht aktuell werden. */
export function currentGeofenceSuggestion(value: unknown, snapshot: GeofenceSnapshot, now: number): value is GeofenceSuggestion {
  if (!snapshot.enabled || !validGeofenceSuggestion(value) || value.at > now + 60_000 || value.at < now - 6 * 3600_000) return false
  return snapshot.visits.some((visit) => visit.id === value.visitId && visit.revision === value.revision
    && value.at >= visit.startsAt && value.at < visit.expiresAt && now < visit.expiresAt)
}

export function geofenceSuggestions(values: readonly unknown[], snapshot: GeofenceSnapshot, now: number): GeofenceSuggestion[] {
  const seen = new Set<string>()
  return values.filter((value): value is GeofenceSuggestion => {
    if (!currentGeofenceSuggestion(value, snapshot, now) || seen.has(value.id)) return false
    seen.add(value.id); return true
  }).slice(0, 20)
}

/** UI darf die Auswahl zeigen, ohne einen unbekannten Ort aus einem Namen zu erraten. */
export function geofencePlace(commitment: Commitment, places: readonly Place[]): Place | undefined {
  const place = places.find((candidate) => candidate.id === commitment.placeId)
  return place && validCoordinates(place) ? place : undefined
}

/** Entfernt ausschließlich die optionale Auswahl; Buchungen bleiben unverändert. */
export function removeGeofenceChoice(local: LocalData, visitId: string): LocalData {
  const visits = { ...local.extras?.geofences?.visits }
  delete visits[visitId]
  return { ...local, extras: { ...local.extras, geofences: { enabled: Object.keys(visits).length > 0 && local.extras?.geofences?.enabled === true, visits } } }
}

/** Bewusste UI-Auswahl gegen den jüngsten Storewert prüfen; alte Auswahlreste verbrauchen kein Limit. */
export function selectGeofenceVisit(local: LocalData, visitId: string, choice: GeofenceChoice, now: number): LocalData | undefined {
  const commitment = local.commitments.find((item) => item.id === visitId)
  const place = commitment && geofencePlace(commitment, local.places)
  if (!place || place.id !== choice.placeId || place.latitude !== choice.latitude || place.longitude !== choice.longitude) return undefined
  const active = new Set(geofenceSnapshot(local, now).visits.map((visit) => visit.id))
  const visits = Object.fromEntries(Object.entries(local.extras?.geofences?.visits ?? {}).filter(([id]) => id === visitId || active.has(id)))
  if (!visits[visitId] && Object.keys(visits).length >= 20) return undefined
  visits[visitId] = choice
  const next = { ...local, extras: { ...local.extras, geofences: { enabled: true, visits } } }
  return geofenceSnapshot(next, now).visits.some((visit) => visit.id === visitId) ? next : undefined
}
