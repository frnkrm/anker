import { assistanceAllowed, assistanceRevision, validRoutePoint, type RoutePoint, type RouteRequest } from './assistance'
import { addDays, utcToZoned, zonedToUtc } from './time'
import { locationKind } from './travel'
import type { CalendarEvent, Commitment, DayLog, DayPlan, LocalData, Place, Settings } from './types'

export type RouteCheckStage = 'evening' | 'morning' | 'departure'
export interface TrafficState {
  settings: Settings
  days: Record<string, DayLog>
  events: CalendarEvent[]
  local: Pick<LocalData, 'commitments' | 'places' | 'assistance'>
}
export interface TrafficContext {
  commitment: Commitment
  origin?: RoutePoint
  destination?: RoutePoint
  originLabel: string
  destinationLabel: string
  arrivalAt: number
  leaveAt?: number
  plannedMin?: number
  /** Nur lokal vergleichen. Private Eingaben niemals als Anfrage-ID senden. */
  signature: string
  revision: string
}

function placeFor(key: string | undefined, places: readonly Place[]): Place | undefined {
  return key === 'home' || key === 'office' ? places.find((place) => place.kind === key) : places.find((place) => place.id === key)
}

/** Ein Anzeigename ist kein maschinenlesbarer Standort. Gespeicherte Zwecke sind getrennt von GPS-Rechten. */
export function permittedRoutePoint(place: Place | undefined): RoutePoint | undefined {
  if (!place || place.externalUse?.routes !== true) return undefined
  const coordinates = { latitude: place.latitude, longitude: place.longitude }
  if (validRoutePoint(coordinates)) return coordinates as RoutePoint
  const address = { address: place.address?.trim() }
  return validRoutePoint(address) ? address as RoutePoint : undefined
}

export function sameRoutePoint(a: RoutePoint | undefined, b: RoutePoint | undefined): boolean {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b)
}

/** Formulare nehmen nur eine eingegebene Adresse oder ein vollständiges Koordinatenpaar an. */
export function parseRoutePoint(text: string): RoutePoint | undefined {
  const value = text.trim()
  if (!value || value.length > 300) return undefined
  const coordinates = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(value)
  if (coordinates) {
    const latitude = Number(coordinates[1]); const longitude = Number(coordinates[2])
    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : undefined
  }
  return { address: value }
}

export function routePointText(point: RoutePoint | undefined): string {
  return point ? 'address' in point ? point.address : `${point.latitude}, ${point.longitude}` : ''
}

export function trafficContext(state: TrafficState, plan: DayPlan, id: string): TrafficContext | undefined {
  const commitment = state.local.commitments.find((item) => item.id === id)
  if (!commitment || commitment.date !== plan.date || commitment.status === 'cancelled' || commitment.routeMode === 'none'
    || commitment.leftAt !== undefined || commitment.arrivedAt !== undefined || commitment.backAt !== undefined
    || locationKind(commitment, state.local.places) === 'remote') return undefined
  const leg = plan.legs?.find((item) => item.commitment.id === id)
  if (!leg || (leg.fromKey === 'home' && leg.toKey === 'home')) return undefined
  const originPlace = placeFor(leg.fromKey, state.local.places)
  const destinationPlace = placeFor(leg.toKey, state.local.places)
  const origin = permittedRoutePoint(originPlace)
  const destination = permittedRoutePoint(destinationPlace)
  const arrivalAt = zonedToUtc(commitment.date, commitment.start - (commitment.arrivalBufferMin ?? state.settings.travel.arrivalBufferMin))
  const signature = JSON.stringify({
    commitment, originPlace, destinationPlace,
    consent: state.local.assistance?.routes,
    rules: state.settings,
    day: state.days[commitment.date], previousDay: state.days[addDays(commitment.date, -1)], events: state.events,
    route: { fromKey: leg.fromKey, toKey: leg.toKey, leave: leg.leave, prepStart: leg.prepStart, travelMin: leg.travelMin },
  })
  return {
    commitment, origin, destination, arrivalAt, signature, revision: assistanceRevision(signature),
    plannedMin: leg.travelMin, originLabel: leg.fromLabel, destinationLabel: leg.toLabel ?? 'Ziel noch offen',
    ...(leg.leave === undefined ? {} : { leaveAt: zonedToUtc(commitment.date, leg.leave) }),
  }
}

export function routeRequestNeedsOneShot(context: TrafficContext, origin: RoutePoint, destination: RoutePoint): boolean {
  return !sameRoutePoint(context.origin, origin) || !sameRoutePoint(context.destination, destination)
}

/** Drei kontextbezogene Gelegenheiten; der bestehende Effekt-Takt darf öfter lokal prüfen, ohne neu anzufragen. */
export function routeCheckStage(context: TrafficContext, now: number): RouteCheckStage | undefined {
  if (context.arrivalAt <= now) return undefined
  const leave = context.leaveAt ?? context.arrivalAt - 60 * 60_000
  if (now >= leave - 45 * 60_000) return 'departure'
  const current = utcToZoned(now)
  const target = utcToZoned(context.arrivalAt)
  if (current.date === target.date && current.minutes >= 4 * 60) return 'morning'
  if (current.date === addDays(target.date, -1) && current.minutes >= 18 * 60) return 'evening'
  return undefined
}

export function routeCheckKey(context: TrafficContext, stage: RouteCheckStage): string {
  return `${encodeURIComponent(context.commitment.id)}|${context.commitment.date}|${stage}`
}

export function automaticRouteRequest(state: TrafficState, context: TrafficContext, now: number): { request: RouteRequest; key: string } | undefined {
  if (!assistanceAllowed(state.local.assistance, 'routes') || state.local.assistance?.routes?.automatic !== true
    || !context.origin || !context.destination) return undefined
  const stage = routeCheckStage(context, now)
  if (!stage) return undefined
  const key = routeCheckKey(context, stage)
  if (state.local.assistance.routeChecks?.[key]) return undefined
  const mode = context.commitment.routeMode
  if (!mode || mode === 'none') return undefined
  return { key, request: { kind: 'route', revision: context.revision, origin: context.origin, destination: context.destination, at: new Date(context.arrivalAt).toISOString(), timing: 'arrival', mode } }
}
