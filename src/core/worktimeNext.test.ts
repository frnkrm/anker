import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan } from './planner'
import { zonedToUtc } from './time'
import type { Commitment } from './types'
import { dayActual, nextObligation, workHints } from './worktime'

const date = '2026-11-10'
const calendar = { id: 'early-calendar', title: 'Fester Kalendertermin', start: zonedToUtc(date, 7 * 60), end: zonedToUtc(date, 7 * 60 + 30) }

describe('Ruhehinweise projizieren denselben nächsten Morgen wie Plan und Weckbedarf', () => {
  it.each(['work', 'weekend', 'sick'] as const)('erkennt den festen frühen Kalenderanker bei %s und erfindet keine spätere Arbeitsfreigabe', (dayType) => {
    const settings = defaultSettings(date)
    const plan = buildDayPlan({ date, settings, override: { dayType }, events: [calendar] })
    const before = structuredClone(plan)
    expect(plan.morningAnchors?.some((anchor) => anchor.id === `event:${calendar.id}`)).toBe(true)
    const next = nextObligation(plan, date)
    expect(next).toEqual({ startMs: calendar.start, label: 'deinem Termin', hard: true })
    const actual = dayActual([{ id: 'night', date: '2026-11-09', kind: 'incident', startAt: zonedToUtc('2026-11-09', 20 * 60), endAt: zonedToUtc('2026-11-09', 23 * 60), breaks: [] }], '2026-11-09', calendar.start)
    expect(workHints({ settings, actual, next }).join(' ')).toContain('deinem Termin')
    expect(plan).toEqual(before)
  })

  it('bewahrt einen früheren Arbeitsbeginn und verwendet bei Vor-Ort-Pflichten die Ankunft statt der Abfahrt als Verpflichtungsbeginn', () => {
    const settings = defaultSettings(date)
    settings.work[1] = { ...settings.work[1]!, start: 8 * 60 }
    const laterCalendar = { ...calendar, start: zonedToUtc(date, 9 * 60), end: zonedToUtc(date, 10 * 60) }
    expect(nextObligation(buildDayPlan({ date, settings, events: [laterCalendar] }), date)).toEqual({ startMs: zonedToUtc(date, 8 * 60), label: 'dem nächsten Arbeitsbeginn', hard: false })
    const customer: Commitment = { id: 'customer', date, label: 'Kunde', context: 'customer', commitment: 'hard', start: 7 * 60 + 30, locationKind: 'onsite', placeLabel: 'Kunde', originPlaceId: 'home', travelMin: 45, arrivalBufferMin: 5, prepMin: 0 }
    const plan = buildDayPlan({ date, settings, commitments: [customer] })
    expect(plan.morningAnchors?.find((anchor) => anchor.id === 'commitment:customer')?.readyAt).toBeLessThan(customer.start)
    expect(nextObligation(plan, date)).toEqual({ startMs: zonedToUtc(date, customer.start), label: 'deinem Termin', hard: true })
  })
})
