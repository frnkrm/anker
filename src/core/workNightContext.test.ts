import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { nowView } from './now'
import { buildDayPlan } from './planner'
import { nextAction, type NextInput } from './support'
import { zonedToUtc } from './time'
import type { Commitment, Settings, WorkSession } from './types'
import { dayActual, needsWorkConfirmation, staleSession, stopSession } from './worktime'

const beforeDate = '2026-11-02'
const date = '2026-11-03'
const startAt = zonedToUtc(beforeDate, 23 * 60 + 40)
const nowMs = zonedToUtc(date, 4 * 60 + 30)
const settings: Settings = { ...defaultSettings(beforeDate), work: defaultSettings(beforeDate).work.map((day) => ({ ...day, isWorkDay: false })) }
const session = (kind: WorkSession['kind'] = 'incident'): WorkSession => ({ id: 'night', date: beforeDate, kind, startAt, breaks: [] })
function input(sessions: WorkSession[], at = nowMs, config = settings, commitments: Commitment[] = []): NextInput {
  const plan = buildDayPlan({ date, settings: config, sessions, nowMs: at, commitments })
  return { plan, settings: config, log: undefined, nowMs: at, m: (at - zonedToUtc(date, 0)) / 60_000, sessions, inbox: [], work: [] }
}

describe('Laufender Nachtkontext über die 04:00-Plangrenze', () => {
  it.each(['regular', 'incident'] as const)('bleibt mit einer echten kurzen %s-Sitzung aktiv und wird nicht allein wegen des Datums veraltet', (kind) => {
    const night = session(kind)
    expect(needsWorkConfirmation(night, nowMs)).toBe(false)
    expect(staleSession([night], date, nowMs)).toBeUndefined()
    const i = input([night])
    expect(nowView(i.plan, i.log, i.m).action.type).toBe('sleep')
    expect(nextAction(i).action.type).toBe(kind === 'regular' ? 'work' : 'einsatz-running')
    expect(night.endAt).toBeUndefined()
  })

  it.each(['regular', 'incident'] as const)('erhält eine vor 04:00 begonnene Pause in einer %s-Sitzung', (kind) => {
    const night: WorkSession = { ...session(kind), breaks: [{ id: 'pause', startAt: zonedToUtc(date, 230) }] }
    expect(nextAction(input([night])).action).toMatchObject({ type: 'work-break', session: { id: 'night', date: beforeDate } })
    expect(night.breaks[0]?.endAt).toBeUndefined()
  })

  it('ersetzt bei laufendem Einsatz nur den geplanten Aufstehhinweis und verändert keinen Weckerwert', () => {
    const early = { ...settings, anchor: { ...settings.anchor, wake: 270 } }
    const original = structuredClone(early)
    const i = input([session()], nowMs, early)
    expect(nowView(i.plan, i.log, i.m).action.type).toBe('wake')
    expect(nextAction(i).action.type).toBe('einsatz-running')
    expect(early).toEqual(original)
  })

  it('lässt eine feste Abfahrt trotz Schlafplan und laufendem Einsatz sichtbar', () => {
    const appointment: Commitment = { id: 'fixed', date, label: 'Fester Termin', context: 'personal', commitment: 'hard', start: 300, end: 360, placeLabel: 'Fester Zielort', travelMin: 30, arrivalBufferMin: 0, prepMin: 0, routeMode: 'driving' }
    const i = input([session()], nowMs, settings, [appointment])
    // Explizite reale Wegannahme, keine erfundene Nullfahrt oder automatische Planänderung.
    expect(i.plan.legs?.[0]?.leave).toBe(270)
    expect(nextAction(i).action).toMatchObject({ type: 'go', leg: { commitment: { id: 'fixed' } } })
    expect(i.sessions?.[0]?.endAt).toBeUndefined()
  })

  it('kehrt nach tatsächlich erfasstem Ende um 05:00 zum normalen freien Morgen zurück und verschiebt keine Datumssummen', () => {
    const night = session()
    const endAt = zonedToUtc(date, 300)
    const done = stopSession([night], endAt)
    const early = input(done, endAt)
    expect(nextAction(early).action).toEqual(nowView(early.plan, early.log, early.m).action)
    const morning = input(done, zonedToUtc(date, 600))
    expect(nextAction(morning).action.type).not.toMatch(/einsatz|work-break|work-stale/)
    expect(dayActual(done, beforeDate, endAt)).toMatchObject({ netMin: 320, lastEnd: endAt })
    expect(dayActual(done, date, endAt)).toMatchObject({ netMin: 0, sessions: [] })
    expect(night.endAt).toBeUndefined()
  })

  it('behält 72 Stunden offene Arbeit als unbestätigte Endkorrektur ohne automatisches Ende', () => {
    const forgotten = { ...session(), startAt: nowMs - 72 * 3600_000 }
    const original = structuredClone(forgotten)
    expect(needsWorkConfirmation(forgotten, nowMs)).toBe(true)
    expect(staleSession([forgotten], date, nowMs)).toEqual(forgotten)
    expect(dayActual([forgotten], beforeDate, nowMs).unconfirmed).toBe(true)
    const later = input([forgotten], zonedToUtc(date, 12 * 60))
    expect(nextAction(later).action.type).toBe('work-stale')
    expect(forgotten).toEqual(original)
  })

  it('lässt genau 16 Stunden bedienbar und verlangt erst darüber die Endkorrektur', () => {
    const night = session()
    expect(staleSession([night], date, startAt + 16 * 3600_000)).toBeUndefined()
    expect(staleSession([night], date, startAt + 16 * 3600_000 + 1)).toEqual(night)
  })
})
