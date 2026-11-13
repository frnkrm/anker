import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { departureReadiness } from './departure'
import { buildDayPlan } from './planner'
import { zonedToUtc } from './time'
import type { Commitment, DayLog, DayPlan, StepResult } from './types'

const date = '2026-11-02'
const log = (steps: Record<string, StepResult> = {}): DayLog => ({ date, steps, override: {} })
function settings(homeOffice = false) {
  const s = defaultSettings(date)
  s.work[0] = { ...s.work[0]!, start: 540, homeOffice }
  s.commute.minutes = 20
  s.commute.bufferMin = 10
  s.sport.days = s.sport.days.map(() => false)
  s.routines.morning = [
    { id: 'first', title: 'Erster Schritt', minutes: 10, minimal: { title: 'Kurz', minutes: 2 } },
    { id: 'second', title: 'Zweiter Schritt', minutes: 5 },
  ]
  return s
}
const work = () => buildDayPlan({ date, settings: settings() })
const read = (p: DayPlan, facts = log(), minute = 480) => departureReadiness(p, facts, zonedToUtc(p.date, minute))
const appointment = (patch: Partial<Commitment> = {}): Commitment => ({
  id: 'visit', date, label: 'Besuch', context: 'personal', commitment: 'hard',
  locationKind: 'onsite', placeLabel: 'Anderer Ort', start: 540, end: 600,
  travelMin: 20, arrivalBufferMin: 10, prepMin: 8, ...patch,
})
const visit = (commitments: Commitment[]) => buildDayPlan({ date, settings: settings(true), commitments })

describe('Abfahrtsbereitschaft aus bestehendem Plan', () => {
  it('vergleicht Restzeit mit offenen Schritten, ohne Ankunftspuffer erneut abzuziehen', () => {
    expect(read(work())).toMatchObject({ leave: 510, remainingMin: 30, preparationMin: 15, bufferMin: 15, openSteps: 2 })
  })
  it.each(['done', 'minimal', 'skipped', 'not-needed'] as const)('zählt ausdrücklich abgeschlossene/entfallene Schritte (%s) nicht erneut', result => {
    expect(read(work(), log({ 'morning:first': result }))).toMatchObject({ preparationMin: 5, openSteps: 1, bufferMin: 25 })
  })
  it('verwendet die bereits gewählte Minimalvariante, ohne etwas umzustellen', () => {
    const p = work()
    p.blocks.find(b => b.routine === 'morning')!.steps![0]!.useMinimal = true
    expect(read(p)?.preparationMin).toBe(7)
  })
  it('erledigt beim Verstreichen von Zeit keinen Schritt und behält negativen Puffer', () => {
    expect(read(work(), log(), 515)).toMatchObject({ remainingMin: -5, preparationMin: 15, bufferMin: -20 })
  })
  it('zeigt nach explizitem Losgehen, Arbeitsstart oder Arbeitsschluss keine Büroabfahrt mehr', () => {
    expect(read(work(), { ...log(), leftAt: 1 })).toBeUndefined()
    const p = work()
    p.workInfo!.started = true
    expect(read(p)).toBeUndefined()
    p.workInfo!.started = false
    p.workInfo!.closed = true
    expect(read(p)).toBeUndefined()
  })
  it('erfindet im Homeoffice oder an einem freien Tag keine Abfahrt', () => {
    expect(read(buildDayPlan({ date, settings: settings(true) }))).toBeUndefined()
    expect(read(buildDayPlan({ date, settings: settings(), override: { dayType: 'vacation' } }))).toBeUndefined()
  })
  it('reagiert auf Planwechsel und verwechselt ein fremdes Tageslog nicht mit heutigen Fakten', () => {
    const s = settings()
    s.work[0]!.start = 600
    const changed = buildDayPlan({ date, settings: s })
    expect(read(changed)?.remainingMin).toBe(90)
    expect(read(work(), { ...log({ 'morning:first': 'done' }), date: '2026-11-01', leftAt: 1 })?.openSteps).toBe(2)
  })
  it('nimmt im Homeoffice einen tatsächlichen frühen Terminweg und zählt Vorbereitung zusätzlich', () => {
    expect(read(visit([appointment()]))).toMatchObject({ label: 'Besuch', preparationMin: 23, remainingMin: 30, bufferMin: 7 })
  })
  it('übernimmt die vom Planer bereits bereinigte überlappende Vorbereitung', () => {
    const p = visit([appointment({ prepMin: 20, prepIncludesMorning: true })])
    expect(read(p)).toMatchObject({ preparationMin: 20 })
    expect(read(p, log({ 'morning:first': 'done' }))).toMatchObject({ preparationMin: 10 })
  })
  it('zeigt unbekannte Reisezeit ohne erfundene Restzeit oder Puffer', () => {
    expect(read(visit([appointment({ travelMin: undefined })]))).toMatchObject({ journeyOpen: true, remainingMin: undefined, bufferMin: undefined })
  })
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('weist unbrauchbare Schrittdauern (%s) als offen aus', minutes => {
    const p = work()
    p.blocks.find(b => b.routine === 'morning')!.steps![0]!.minutes = minutes
    expect(read(p)).toMatchObject({ preparationMin: 5, durationOpen: true, bufferMin: undefined })
  })
  it('setzt leere Routine auf null, aber offene Packgegenstände ohne Zeitbudget nicht auf erledigt', () => {
    const p = visit([appointment({ prepMin: 0, items: ['Tasche'] })])
    p.blocks.find(b => b.routine === 'morning')!.steps = []
    expect(read(p)).toMatchObject({ preparationMin: 0, openItems: 1, durationOpen: true, bufferMin: undefined })
    p.legs![0]!.commitment.preparedItems = ['Tasche']
    expect(read(p)).toMatchObject({ openItems: 0, durationOpen: false, bufferMin: 30 })
  })
  it('wählt den nächsten Weg, überspringt entfernte/abgesagte/bestätigte und abgelaufene Termine', () => {
    const p = visit([
      appointment({ id: 'cancelled', status: 'cancelled', start: 400 }),
      appointment({ id: 'expired', start: 420, end: 470 }),
      appointment({ id: 'left', leftAt: 1, start: 500 }),
      appointment({ id: 'arrived', arrivedAt: 1, start: 510 }),
      appointment({ id: 'returned', backAt: 1, start: 520 }),
      appointment({ id: 'next', label: 'Nächster Weg', start: 900 }),
    ])
    expect(read(p)?.label).toBe('Nächster Weg')
    expect(read(p)?.openSteps).toBe(0)
    expect(read(visit([]))).toBeUndefined()
  })
  it('macht Remote-/Zuhause-Termine nicht zu Wegen', () => {
    expect(read(visit([appointment({ locationKind: 'remote' })]))).toBeUndefined()
    expect(read(visit([appointment({ locationKind: 'home' })]))).toBeUndefined()
  })
  it.each([
    ['2026-03-28', '2026-03-29T01:30:00+01:00', 1630, 40],
    ['2026-10-24', '2026-10-25T01:30:00+02:00', 1590, 120],
    [date, '2026-11-03T00:05:00+01:00', 1460, 15],
  ])('rechnet nach Mitternacht und beim Berliner Zeitwechsel mit echten Minuten (%s)', (day, time, leave, expected) => {
    const p = work()
    p.date = day
    p.leave = leave
    p.workEnd = 1670
    p.blocks = [{ id: 'out', kind: 'commute', title: 'Losgehen', start: leave, end: leave + 20 }]
    expect(departureReadiness(p, undefined, Date.parse(time))?.remainingMin).toBe(expected)
    expect(departureReadiness(p, undefined, zonedToUtc(day, 1680))).toBeUndefined()
  })
  it('verändert weder Plan noch Fakten und speichert keine neuen Daten', () => {
    const p = work(), facts = log()
    const before = structuredClone({ p, facts })
    read(p, facts)
    expect({ p, facts }).toEqual(before)
  })
})
