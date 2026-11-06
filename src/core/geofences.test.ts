import { describe, expect, it } from 'vitest'
import { currentGeofenceSuggestion, geofenceSnapshot, geofenceSuggestions, removeGeofenceChoice, selectGeofenceVisit } from './geofences'
import { emptyLocal } from './defaults'
import type { Commitment, LocalData, Place } from './types'
import { zonedToUtc } from './time'

const date = '2026-11-06'
const now = zonedToUtc(date, 8 * 60)
const place: Place = { id: 'selected-place', label: 'Bleibt lokal', latitude: 52, longitude: 13 }
const commitment: Commitment = { id: 'visit', date, label: 'Bleibt lokal', context: 'customer', commitment: 'hard', start: 9 * 60, placeId: place.id, locationKind: 'onsite' }
function local(patch: Partial<LocalData> = {}): Pick<LocalData, 'extras' | 'commitments' | 'places'> {
  return { commitments: [commitment], places: [place], extras: { geofences: { enabled: true, visits: { visit: { radiusM: 150, dwellMs: 120_000, consentedAt: now - 1000, placeId: place.id, latitude: place.latitude, longitude: place.longitude } } } }, ...patch }
}

describe('Besuchsgebundene Geofence-Auswahl ohne Ankunftsbehauptung', () => {
  it('bleibt ohne bewusste Wahl aus und erfindet keine Koordinaten', () => {
    expect(geofenceSnapshot(local({ extras: undefined }), now)).toEqual({ enabled: false, visits: [] })
    expect(geofenceSnapshot(local({ places: [{ id: place.id, label: 'Nur ein Name' }] }), now).visits).toEqual([])
  })
  it('überträgt nur minimale Definitionen ohne Titel, Adresse, Einnahme oder Arbeit', () => {
    const snapshot = geofenceSnapshot(local(), now)
    expect(snapshot.visits).toHaveLength(1)
    expect(JSON.stringify(snapshot)).not.toContain('Bleibt lokal')
    expect(snapshot.visits[0]).toMatchObject({ id: 'visit', radiusM: 150, dwellMs: 120_000, startsAt: zonedToUtc(date, 6 * 60), expiresAt: zonedToUtc(date, 13 * 60) })
    expect(commitment.arrivedAt).toBeUndefined()
  })
  it('verwendet feste Revisionen ohne Reset bei jedem Uhrtick', () => {
    expect(geofenceSnapshot(local(), now).visits).toEqual(geofenceSnapshot(local(), now + 60_000).visits)
    const changed = local({ places: [{ ...place, latitude: 53 }] })
    expect(geofenceSnapshot(changed, now).visits).toEqual([])
    changed.extras!.geofences!.visits.visit!.latitude = 53
    expect(geofenceSnapshot(changed, now).visits[0]?.revision).not.toBe(geofenceSnapshot(local(), now).visits[0]?.revision)
  })
  it('behandelt alte ungebundene Auswahl und einen anderen Zielort ohne neue Zustimmung als inaktiv', () => {
    const old = local()
    delete old.extras!.geofences!.visits.visit!.placeId
    expect(geofenceSnapshot(old, now).visits).toEqual([])
    const changed = local({ places: [place, { ...place, id: 'another' }], commitments: [{ ...commitment, placeId: 'another' }] })
    expect(geofenceSnapshot(changed, now).visits).toEqual([])
  })
  it('entfernt abgesagte, angekommene, beendete, entfernte und remote Besuche', () => {
    for (const patch of [{ status: 'cancelled' as const }, { arrivedAt: now }, { backAt: now }, { locationKind: 'remote' as const }, { routeMode: 'none' as const }]) {
      expect(geofenceSnapshot(local({ commitments: [{ ...commitment, ...patch }] }), now).visits).toEqual([])
    }
    expect(geofenceSnapshot(local({ commitments: [] }), now).visits).toEqual([])
    expect(geofenceSnapshot(local(), now + 6 * 3600_000).visits).toEqual([])
  })
  it('führt verletzte Grenzen, Zukunftseinwilligung oder ungültige Koordinaten nicht aus', () => {
    for (const changed of [{ radiusM: 20 }, { dwellMs: 0 }, { consentedAt: now + 100_000 }]) {
      const input = local()
      Object.assign(input.extras!.geofences!.visits.visit!, changed)
      expect(geofenceSnapshot(input, now).visits).toEqual([])
    }
    expect(geofenceSnapshot(local({ places: [{ ...place, latitude: 91 }] }), now).visits).toEqual([])
  })
  it('akzeptiert nur aktuelle deduplizierte Vorschläge innerhalb desselben Besuchsfensters', () => {
    const snapshot = geofenceSnapshot(local(), now)
    const suggestion = { id: 'suggestion', visitId: 'visit', revision: snapshot.visits[0]!.revision, at: now }
    expect(currentGeofenceSuggestion(suggestion, snapshot, now)).toBe(true)
    expect(geofenceSuggestions([suggestion, suggestion], snapshot, now)).toEqual([suggestion])
    for (const changed of [{ revision: 'old' }, { visitId: 'other' }, { at: zonedToUtc(date, 5 * 60) }, { at: now + 100_000 }]) {
      expect(currentGeofenceSuggestion({ ...suggestion, ...changed }, snapshot, now)).toBe(false)
    }
    expect(currentGeofenceSuggestion(suggestion, geofenceSnapshot(local({ commitments: [{ ...commitment, arrivedAt: now }] }), now), now)).toBe(false)
  })
  it('gibt das Auswahl-Limit nach alten, abgesagten oder manuell angekommenen Besuchen frei', () => {
    const input: LocalData = { ...emptyLocal(), ...local() }
    const choice = input.extras!.geofences!.visits.visit!
    input.extras!.geofences!.visits = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`old-${i}`, choice]))
    input.commitments.push({ ...commitment, id: 'old-0', arrivedAt: now }, { ...commitment, id: 'old-1', status: 'cancelled' })
    const next = selectGeofenceVisit(input, 'visit', choice, now)!
    expect(Object.keys(next.extras!.geofences!.visits)).toEqual(['visit'])
    expect(next.commitments).toEqual(input.commitments)
    expect(next.workSessions).toEqual(input.workSessions)
  })
  it('bestätigt keine inzwischen geänderten Ziele oder abgelaufenen Besuche und entfernt nur Auswahl', () => {
    const input: LocalData = { ...emptyLocal(), ...local() }
    const choice = input.extras!.geofences!.visits.visit!
    expect(selectGeofenceVisit({ ...input, places: [{ ...place, latitude: 53 }] }, 'visit', choice, now)).toBeUndefined()
    expect(selectGeofenceVisit(input, 'visit', choice, now + 6 * 3600_000)).toBeUndefined()
    expect(selectGeofenceVisit(input, 'visit', { ...choice, radiusM: 5 }, now)).toBeUndefined()
    const next = removeGeofenceChoice(input, 'visit')
    expect(next.extras!.geofences).toEqual({ enabled: false, visits: {} })
    expect(next.commitments).toEqual(input.commitments)
  })
})
