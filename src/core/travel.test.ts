import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan, legSpan, planLegs } from './planner'
import { morningNeed, wakeProposal } from './sleep'
import { locationKind, normalizeCommitment, normalizePlace, validCommitment, validPlace, validPlanningLocal } from './travel'
import type { Commitment, Place } from './types'

const date = '2026-11-02'
const settings = () => {
  const s = defaultSettings(date)
  s.sport.days = s.sport.days.map(() => false)
  s.travel.activationMin = 10
  s.travel.homeOfficeStartupMin = 5
  s.work[0] = { ...s.work[0]!, start: 9 * 60 }
  s.routines.morning = [{ id: 'prepare', title: 'Vorbereitung', minutes: 30 }]
  return s
}
const task = (patch: Partial<Commitment> = {}): Commitment => ({ id: 'customer', date, label: 'Kunde', context: 'customer', commitment: 'hard', start: 9 * 60, ...patch })

describe('Offene Orte und echte manuelle Ortsfolge', () => {
  it('macht einen unbekannten Kundenort nicht zu einem Remote-Termin', () => {
    const [leg] = planLegs([task()], { settings: settings(), places: [] })
    expect(leg).toMatchObject({ locationOpen: true, travelOpen: true })
    expect(leg?.leave).toBeUndefined()
    const remote = planLegs([task({ locationKind: 'remote' })], { settings: settings(), places: [] })[0]!
    expect(remote.travelOpen).toBe(false)
    expect(remote.locationOpen).not.toBe(true)
    expect(locationKind(task({ routeMode: 'none' }))).toBe('remote')
  })

  it('behält den realen Ort über einen Remote-Termin und erlaubt die manuelle Startortkorrektur', () => {
    const list = [task({ placeLabel: 'Kunde B', travelMin: 20, thenTo: 'next' }), task({ id: 'remote', locationKind: 'remote', start: 11 * 60, thenTo: 'home', backAt: 1 }), task({ id: 'private', context: 'social', placeLabel: 'Freundin', travelMin: 15, start: 18 * 60 })]
    const legs = planLegs(list, { settings: settings(), places: [], office: { start: 8 * 60, end: 16 * 60 } })
    expect(legs[2]?.fromLabel).toBe('Kunde B')
    const corrected = planLegs([{ ...list[2]!, originPlaceId: 'office' }], { settings: settings(), places: [] })
    expect(corrected[0]?.fromLabel).toBe('Büro')
    const unknown = planLegs([{ ...list[2]!, originPlaceId: 'unknown' }], { settings: settings(), places: [] })
    expect(unknown[0]).toMatchObject({ originOpen: true, travelOpen: true })
    expect(unknown[0]?.leave).toBeUndefined()
  })

  it('nimmt nach der geplanten Heimfahrt nicht weiterhin das Büro als Startort an', () => {
    const [leg] = planLegs([task({ context: 'social', start: 20 * 60, placeLabel: 'Freundin', travelMin: 20 })], { settings: settings(), places: [], office: { start: 8 * 60, end: 16 * 60 } })
    expect(leg?.fromLabel).toBe('Zuhause')
  })

  it('erfindet keine Rückfahrt aus der Fahrt vom Büro zum Kunden und fährt bei nächstem Ziel nicht heim', () => {
    const c = task({ start: 14 * 60, end: 15 * 60, placeLabel: 'Kunde', travelMin: 45 })
    const [unknownReturn] = planLegs([c], { settings: settings(), places: [], office: { start: 8 * 60, end: 16 * 60 } })
    expect(unknownReturn?.returnMin).toBeUndefined()
    expect(unknownReturn?.returnOpen).toBe(true)
    const [next] = planLegs([{ ...c, thenTo: 'next', travelHomeMin: 30 }], { settings: settings(), places: [] })
    expect(legSpan(next!)).toEqual({ start: next!.prepStart, end: 15 * 60 })
  })

  it('nimmt eine geplante Rückkehr erst bei bekanntem Ende und ausreichender Rückfahrzeit an', () => {
    const first = task({ locationKind: 'onsite', placeLabel: 'Kunde', thenTo: 'home' })
    const second = task({ id: 'next', start: 12 * 60, locationKind: 'onsite', placeLabel: 'Nächstes Ziel', travelMin: 20 })
    for (const patch of [{}, { end: 11 * 60 }, { end: 11 * 60 + 50, travelHomeMin: 20 }, { end: 11 * 60 + 25, travelHomeMin: 20 }]) {
      const legs = planLegs([{ ...first, ...patch }, second], { settings: settings(), places: [] })
      expect(legs[1]).toMatchObject({ originOpen: true, travelOpen: true })
      expect(legs[1]?.leave).toBeUndefined()
    }
    const known = planLegs([{ ...first, end: 11 * 60, travelHomeMin: 20 }, second], { settings: settings(), places: [] })
    expect(known[1]?.fromKey).toBe('home')
  })
})

describe('Ein gemeinsamer relevanter Morgenbedarf', () => {
  it('rechnet Q65/Q66 mit einmaliger Vorbereitung und Aktivierung rückwärts', () => {
    const s = settings(); s.routines.morning = []
    const c = task({ locationKind: 'onsite', placeLabel: 'Kunde', travelMin: 45, arrivalBufferMin: 10, prepMin: 30, replacesCommute: true })
    const a = buildDayPlan({ date, settings: s, commitments: [c] })
    const b = buildDayPlan({ date, settings: s, commitments: [{ ...c, travelMin: 60 }] })
    expect(morningNeed(a, s)?.latestWake).toBe(7 * 60 + 25)
    expect(morningNeed(b, s)?.latestWake).toBe(7 * 60 + 10)
    expect(a.wake).toBe(s.anchor.wake)
  })

  it('rechnet Q67 im Homeoffice ohne Büroweg und doppelte Aktivierung', () => {
    const s = settings()
    const p = buildDayPlan({ date, settings: s, override: { homeOffice: true } })
    expect(morningNeed(p, s)?.latestWake).toBe(8 * 60 + 15)
    expect(p.blocks.some((block) => block.kind === 'commute')).toBe(false)
  })

  it('richtet freie Tage und Homeoffice am früheren harten Remote-Termin aus', () => {
    const s = settings()
    const c = task({ start: 7 * 60 + 30, locationKind: 'remote', prepMin: 5 })
    for (const override of [{ homeOffice: true }, { dayType: 'weekend' as const }]) {
      const p = buildDayPlan({ date, settings: s, override, commitments: [c] })
      expect(morningNeed(p, s)?.latestWake).toBe(6 * 60 + 45)
      expect(morningNeed(p, s)?.label).toBe('Kunde')
    }
  })

  it('schlägt bei einem frühen Kalendertermin oder unklarem Weg keine gefährlich späte Uhrzeit vor', () => {
    const s = settings()
    const events = [{ id: 'meeting', title: 'Früher Termin', start: Date.parse(`${date}T07:30:00+01:00`), end: Date.parse(`${date}T08:00:00+01:00`) }]
    const p = buildDayPlan({ date, settings: s, override: { homeOffice: true }, events })
    expect(morningNeed(p, s)?.latestWake).toBeLessThanOrEqual(7 * 60 + 30)
    expect(wakeProposal(p, s)?.later).not.toBe(true)
    const unknown = buildDayPlan({ date, settings: s, commitments: [task({ start: 7 * 60 + 30, locationKind: 'unknown', replacesCommute: true })] })
    expect(wakeProposal(unknown, s)).toBeUndefined()
  })

  it('berücksichtigt harte Pflichten vor vier Uhr samt Remote-Rechnerstart ohne Doppelerfassung', () => {
    const s = settings()
    const remote = buildDayPlan({ date, settings: s, override: { dayType: 'weekend' }, commitments: [task({ start: 3 * 60, locationKind: 'remote' })] })
    expect(morningNeed(remote, s)?.latestWake).toBe(2 * 60 + 15)
    const event = { id: 'night', title: 'Früher Kalendertermin', start: Date.parse(`${date}T03:00:00+01:00`), end: Date.parse(`${date}T03:30:00+01:00`) }
    const calendar = buildDayPlan({ date, settings: s, override: { dayType: 'weekend' }, events: [event] })
    expect(morningNeed(calendar, s)?.latestWake).toBe(2 * 60 + 15)
    expect(wakeProposal(calendar, s)).toBeUndefined()
  })

  it('plant zusätzliche Vorbereitung vor dem Weg und überlappt keine Morgenroutine damit', () => {
    const s = settings()
    const c = task({ placeLabel: 'Kunde', travelMin: 45, arrivalBufferMin: 10, prepMin: 30, replacesCommute: true })
    const p = buildDayPlan({ date, settings: s, commitments: [c] })
    const need = morningNeed(p, s)!
    const adjusted = buildDayPlan({ date, settings: s, override: { wakeOverride: need.latestWake }, commitments: [c] })
    const morning = adjusted.blocks.find((block) => block.routine === 'morning')!
    const prep = adjusted.blocks.find((block) => block.id === 'prep:customer')!
    expect(need.latestWake).toBe(6 * 60 + 55)
    expect(morning.end).toBeLessThanOrEqual(prep.start)
    expect(prep.end).toBe(adjusted.leave)
    const included = buildDayPlan({ date, settings: s, commitments: [{ ...c, prepIncludesMorning: true }] })
    expect(morningNeed(included, s)?.latestWake).toBe(7 * 60 + 25)
  })

  it('führt nur ausdrücklich verknüpfte Kalenderquellen einmal im Plan', () => {
    const s = settings()
    const event = { id: 'google-1', title: 'Kunde aus Kalender', start: Date.parse(`${date}T09:00:00+01:00`), end: Date.parse(`${date}T10:00:00+01:00`) }
    const c = task({ end: 10 * 60, locationKind: 'remote', source: { provider: 'google', id: event.id } })
    const p = buildDayPlan({ date, settings: s, commitments: [c], events: [event] })
    expect(p.blocks.some((block) => block.id === `event:${event.id}`)).toBe(false)
    const unlinked = buildDayPlan({ date, settings: s, commitments: [{ ...c, source: undefined }], events: [event] })
    expect(unlinked.blocks.some((block) => block.id === `event:${event.id}`)).toBe(true)
  })
})

describe('Additive lokale Datengrenzen', () => {
  const place: Place = { id: 'p', label: 'Ort', latitude: 50, longitude: 7, externalUse: { weather: false, routes: false } }
  it('akzeptiert alte gültige Felder und weist unbekannte oder nichtendliche neue Angaben zurück', () => {
    expect(validPlanningLocal({ places: [{ id: 'p', label: 'Ort' }], commitments: [task()] })).toBe(true)
    expect(validPlace(place)).toBe(true)
    expect(validCommitment(task({ workKind: 'other' }))).toBe(true)
    for (const change of [{ latitude: NaN }, { longitude: 181 }, { externalUse: { weather: 'yes' } }, { travelFromHomeMin: null }]) expect(validPlace({ ...place, ...change })).toBe(false)
    for (const change of [{ travelMin: NaN }, { locationKind: 'erfunden' }, { end: 8 * 60 }, { source: { id: 'x' } }]) expect(validCommitment({ ...task(), ...change })).toBe(false)
    expect(validPlanningLocal({ commitments: [task(), task()] })).toBe(false)
    expect(validPlanningLocal({ commitments: [task({ source: { provider: 'google', id: 'event' } }), task({ id: 'second', source: { provider: 'google', id: 'event' } })] })).toBe(false)
  })

  it('führt kaputte Zusatzfelder nicht aus und verändert den ursprünglichen Altbestand nicht', () => {
    const old = { ...task(), travelMin: NaN, locationKind: 'erfunden', description: 'Behalten' }
    expect(normalizeCommitment(old)).toMatchObject({ id: old.id, label: old.label, description: 'Behalten' })
    expect(normalizeCommitment(old)?.travelMin).toBeUndefined()
    expect(old.locationKind).toBe('erfunden')
    expect(normalizePlace({ ...place, latitude: 95 })?.latitude).toBeUndefined()
    expect(normalizePlace({ ...place, latitude: 95 })?.longitude).toBeUndefined()
  })
})
