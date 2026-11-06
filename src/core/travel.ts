import type { Commitment, LocationKind, Place } from './types'

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const nonempty = (value: unknown): value is string => text(value) && !!value.trim()
const choice = (value: unknown, options: readonly string[]): boolean => text(value) && options.includes(value)
const number = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const minutes = (value: unknown): value is number => number(value, 0, 2880)
const timestamp = (value: unknown): value is number => number(value, 0, 8.64e15)
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 500 && value.every(text)
const date = (value: unknown): boolean => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

export function validPlace(value: unknown): value is Place {
  if (!object(value) || !nonempty(value.id) || !nonempty(value.label)) return false
  if (value.kind !== undefined && !choice(value.kind, ['home', 'office', 'customer', 'private', 'other'])) return false
  if (value.address !== undefined && !text(value.address)) return false
  if (value.travelFromHomeMin !== undefined && !minutes(value.travelFromHomeMin)) return false
  if (value.travelFrom !== undefined && (!object(value.travelFrom) || !Object.values(value.travelFrom).every(minutes))) return false
  if (value.items !== undefined && !stringList(value.items)) return false
  if ((value.latitude === undefined) !== (value.longitude === undefined)) return false
  if (value.latitude !== undefined && (!number(value.latitude, -90, 90) || !number(value.longitude, -180, 180))) return false
  if (value.externalUse !== undefined && (!object(value.externalUse)
    || ['weather', 'routes'].some((key) => value.externalUse !== undefined && object(value.externalUse)
      && value.externalUse[key] !== undefined && typeof value.externalUse[key] !== 'boolean'))) return false
  return true
}

export function validCommitment(value: unknown): value is Commitment {
  if (!object(value) || !nonempty(value.id) || !date(value.date) || !nonempty(value.label)
    || !choice(value.context, ['work', 'customer', 'social', 'personal', 'other'])
    || !choice(value.commitment, ['hard', 'soft', 'optional']) || !minutes(value.start)) return false
  if (value.end !== undefined && (!minutes(value.end) || value.end <= value.start)) return false
  if (value.locationKind !== undefined && !choice(value.locationKind, ['unknown', 'onsite', 'remote', 'home'])) return false
  for (const key of ['originPlaceId', 'placeId']) if (value[key] !== undefined && !nonempty(value[key])) return false
  for (const key of ['placeLabel', 'address']) if (value[key] !== undefined && !text(value[key])) return false
  for (const key of ['travelMin', 'travelHomeMin', 'arrivalBufferMin', 'prepMin']) if (value[key] !== undefined && !minutes(value[key])) return false
  for (const key of ['leftAt', 'arrivedAt', 'backAt']) if (value[key] !== undefined && !timestamp(value[key])) return false
  for (const key of ['items', 'preparedItems']) if (value[key] !== undefined && !stringList(value[key])) return false
  for (const key of ['replacesCommute', 'prepIncludesMorning']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return false
  if (value.routeMode !== undefined && !choice(value.routeMode, ['driving', 'transit', 'cycling', 'walking', 'none'])) return false
  if (value.workKind !== undefined && !choice(value.workKind, ['onsite', 'maintenance', 'incident', 'other', 'oncall'])) return false
  if (value.thenTo !== undefined && !choice(value.thenTo, ['home', 'next'])) return false
  if (value.status !== undefined && !choice(value.status, ['planned', 'cancelled'])) return false
  if (value.source !== undefined && (!object(value.source) || !nonempty(value.source.provider) || !nonempty(value.source.id))) return false
  return true
}

/** Fehlende Felder alter Sicherungen sind erlaubt, vorhandene Planungsdaten müssen nutzbar sein. */
export function validPlanningLocal(value: unknown): boolean {
  if (!object(value)) return false
  return (value.places === undefined || (Array.isArray(value.places) && unique(value.places, validPlace)))
    && (value.commitments === undefined || (Array.isArray(value.commitments) && unique(value.commitments, validCommitment)))
}

function unique<T extends { id: string }>(values: unknown[], valid: (value: unknown) => value is T): boolean {
  const ids = new Set<string>()
  return values.every((value) => valid(value) && !ids.has(value.id) && !!ids.add(value.id))
}

/** Alte gültige Records behalten ihre Inhalte; kaputte optionale neue Felder werden nicht ausgeführt. */
export function normalizePlace(value: unknown): Place | undefined {
  if (!object(value) || !nonempty(value.id) || !nonempty(value.label)) return undefined
  const next = { ...value }
  for (const key of ['kind', 'address', 'travelFromHomeMin', 'travelFrom', 'items', 'externalUse'] as const) {
    if (!validPlace({ id: value.id, label: value.label, [key]: next[key] })) delete next[key]
  }
  if (!validPlace({ id: value.id, label: value.label, latitude: next.latitude, longitude: next.longitude })) { delete next.latitude; delete next.longitude }
  return next as unknown as Place
}

export function normalizeCommitment(value: unknown): Commitment | undefined {
  if (!object(value)) return undefined
  const base = { id: value.id, date: value.date, label: value.label, context: value.context, commitment: value.commitment, start: value.start }
  if (!validCommitment(base)) return undefined
  const next = { ...value }
  for (const key of ['end', 'locationKind', 'originPlaceId', 'placeId', 'placeLabel', 'address', 'travelMin', 'travelHomeMin', 'arrivalBufferMin', 'prepMin', 'leftAt', 'arrivedAt', 'backAt', 'items', 'preparedItems', 'replacesCommute', 'prepIncludesMorning', 'routeMode', 'workKind', 'thenTo', 'status', 'source']) {
    if (!validCommitment({ ...base, [key]: next[key] })) delete next[key]
  }
  return next as unknown as Commitment
}

/** Legacy: Nur ausdrücklich ohne Fahrt ist remote. Ein leerer Ort ist keine Zusage darüber. */
export function locationKind(c: Commitment, places: readonly Place[] = []): LocationKind {
  if (c.locationKind) return c.locationKind
  if (c.routeMode === 'none') return 'remote'
  if (c.placeId && places.find((place) => place.id === c.placeId)?.kind === 'home') return 'home'
  return c.placeLabel?.trim() || c.placeId || c.address?.trim() ? 'onsite' : 'unknown'
}
