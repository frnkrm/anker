import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from './defaults'
import { buildDayPlan } from './planner'
import { automaticRouteRequest, parseRoutePoint, permittedRoutePoint, routeCheckStage, routeRequestNeedsOneShot, trafficContext, type TrafficState } from './traffic'
import { zonedToUtc } from './time'
import type { Commitment, Place } from './types'

const date = '2026-11-09'
const settings = defaultSettings(date)
const places: Place[] = [
  { id: 'home-id', label: 'Zuhause', kind: 'home', address: 'Gewählte Startadresse', externalUse: { routes: true } },
  { id: 'customer-id', label: 'Nur ein Name', kind: 'customer', latitude: 52, longitude: 13, externalUse: { routes: true } },
]
const commitment: Commitment = { id: 'visit', date, label: 'Kunde', context: 'customer', commitment: 'hard', start: 9 * 60, locationKind: 'onsite', placeId: 'customer-id', originPlaceId: 'home', travelMin: 45, routeMode: 'driving' }
function fixture(patch: Partial<Commitment> = {}, chosenPlaces = places) {
  const state: TrafficState = { settings, days: {}, events: [], local: { ...emptyLocal(), commitments: [{ ...commitment, ...patch }], places: chosenPlaces,
    assistance: { routes: { enabled: true, version: 1, at: 1, automatic: true } } } }
  const plan = buildDayPlan({ date, settings, commitments: state.local.commitments, places: state.local.places })
  return { state, plan, context: trafficContext(state, plan, commitment.id)! }
}

describe('Fahrtschätzungen bleiben bewusst gewählte Planvorschläge', () => {
  it('verwendet keine bloßen Ortsnamen oder nicht für Routen freigegebene Ortsdaten', () => {
    expect(permittedRoutePoint({ id: 'private', label: 'Kein Ziel', address: 'Privat' })).toBeUndefined()
    expect(permittedRoutePoint({ id: 'name', label: 'Büro', externalUse: { routes: true } })).toBeUndefined()
    expect(parseRoutePoint('')).toBeUndefined()
    expect(parseRoutePoint('200, 13')).toBeUndefined()
    expect(parseRoutePoint('52.5, 13.4')).toEqual({ latitude: 52.5, longitude: 13.4 })
  })
  it('fordert eine einmalige explizite Freigabe für abweichende manuelle Eingaben', () => {
    const { context } = fixture()
    expect(routeRequestNeedsOneShot(context, context.origin!, context.destination!)).toBe(false)
    expect(routeRequestNeedsOneShot(context, { address: 'Andere bewusst eingegebene Adresse' }, context.destination!)).toBe(true)
  })
  it('hat keine Abfrage oder interaktive Reiseaufforderung für unterwegs/angekommen/abgesagt/remote', () => {
    for (const patch of [{ leftAt: 1 }, { arrivedAt: 1 }, { status: 'cancelled' as const }, { locationKind: 'remote' as const }]) expect(fixture(patch).context).toBeUndefined()
  })
  it('verwendet pro Besuch höchstens Vorabend, Morgen und Abfahrtsnähe ohne Polling-Anfragen', () => {
    const { state, context } = fixture()
    const evening = zonedToUtc('2026-11-08', 19 * 60)
    const morning = zonedToUtc(date, 6 * 60)
    const departure = context.leaveAt! - 15 * 60_000
    expect(routeCheckStage(context, evening)).toBe('evening')
    expect(routeCheckStage(context, morning)).toBe('morning')
    expect(routeCheckStage(context, departure)).toBe('departure')
    expect(routeCheckStage(context, context.arrivalAt)).toBeUndefined()
    for (const now of [evening, morning, departure]) {
      const check = automaticRouteRequest(state, context, now)!
      expect(check).toBeDefined()
      state.local.assistance!.routeChecks ??= {}
      state.local.assistance!.routeChecks[check.key] = { at: now, revision: context.revision }
      expect(automaticRouteRequest(state, context, now + 1_000)).toBeUndefined()
    }
    expect(Object.keys(state.local.assistance!.routeChecks!)).toHaveLength(3)
  })
  it('lässt Automatik ohne beide Ortsfreigaben oder bei ausgeschalteter Wahl vollständig aus', () => {
    const { state, context } = fixture({}, places.map((place) => ({ ...place, externalUse: undefined })))
    expect(automaticRouteRequest(state, context, zonedToUtc(date, 6 * 60))).toBeUndefined()
    const ready = fixture()
    ready.state.local.assistance!.routes!.automatic = false
    expect(automaticRouteRequest(ready.state, ready.context, zonedToUtc(date, 6 * 60))).toBeUndefined()
  })
  it('ändert den lokalen Snapshot bei neuer Planentscheidung, aber nicht wegen technischer Abrufmarker', () => {
    const first = fixture()
    const original = first.context.signature
    first.state.local.assistance!.routeChecks = { seen: { at: 2, revision: 'technical' } }
    expect(trafficContext(first.state, first.plan, commitment.id)!.signature).toBe(original)
    const changed = fixture({ travelMin: 60 })
    expect(changed.context.signature).not.toBe(original)
  })
})
