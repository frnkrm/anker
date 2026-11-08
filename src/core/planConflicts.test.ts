import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan } from './planner'
import { CONFLICT_NOTICE_LEAD_MINUTES, conflictVisibility, conflictsForBlock, nowConflictNotice, planConflicts, validConflictAcknowledgements } from './planConflicts'
import type { Commitment } from './types'

const DATE = '2026-11-09'
function fixture(patch: Partial<Commitment> = {}) {
  const settings = defaultSettings(DATE)
  settings.sport.days = settings.sport.days.map(() => false)
  const commitment: Commitment = { id: 'books', date: DATE, label: 'Bücher zurückbringen', context: 'personal', commitment: 'hard', start: 18 * 60, end: 18 * 60 + 30, locationKind: 'onsite', placeLabel: 'Bibliothek', originPlaceId: 'home', travelMin: 15, travelHomeMin: 15, prepMin: 15, arrivalBufferMin: 10, ...patch }
  return { settings, commitment, plan: buildDayPlan({ date: DATE, settings, commitments: [commitment] }) }
}

describe('Zeitlich begrenzte Planhinweise', () => {
  it('leitet eine stabile konkrete Überschneidung und nur tatsächlich betroffene Timelineblöcke ab', () => {
    const { plan } = fixture()
    const before = structuredClone(plan)
    const conflicts = planConflicts(plan)
    expect(conflicts).toHaveLength(1)
    const conflict = conflicts[0]!
    expect(conflict).toMatchObject({ kind: 'home-journey', date: DATE, start: 17 * 60 + 20, end: 17 * 60 + 35,
      blockIds: [`${DATE}:commute-home`, 'prep:books'], summary: 'Überschneidung um 17:20: Bücher zurückbringen und Heimweg.' })
    expect(conflict.blockLabels['prep:books']).toBe('überschneidet sich mit Heimweg')
    expect(conflict.blockLabels[`${DATE}:commute-home`]).toBe('überschneidet sich mit Bücher zurückbringen')
    expect(conflictsForBlock(plan, 'prep:books')).toEqual(conflicts)
    expect(conflictsForBlock(plan, 'commitment:books')).toEqual([])
    expect(plan).toEqual(before)
    expect(plan.conflicts?.some(text => text.includes('Heimweg'))).toBe(true)
  })

  it.each([
    [7 * 60 + 5, 'quiet'], [10 * 60, 'quiet'], [15 * 60 + 19, 'quiet'],
    [15 * 60 + 20, 'active'], [16 * 60 + 30, 'active'], [17 * 60 + 20, 'active'],
    [17 * 60 + 21, 'hidden'], [17 * 60 + 35, 'hidden'], [19 * 60, 'hidden'], [22 * 60 + 45, 'hidden'],
  ] as const)('zeigt um Minute %i ausschließlich %s', (m, expected) => {
    const { plan } = fixture()
    expect(conflictVisibility(planConflicts(plan)[0]!, m)).toBe(expected)
  })

  it('hat ein zentrales 120-Minuten-Fenster und nur einen stillen Zähler davor', () => {
    const { plan } = fixture()
    expect(CONFLICT_NOTICE_LEAD_MINUTES).toBe(120)
    expect(nowConflictNotice(plan, 10 * 60)).toEqual({ active: [], upcomingCount: 1 })
    expect(nowConflictNotice(plan, 16 * 60 + 30)).toMatchObject({ active: [{ kind: 'home-journey' }], upcomingCount: 0 })
    expect(nowConflictNotice(plan, 19 * 60)).toEqual({ active: [], upcomingCount: 0 })
  })

  it('quittiert nur diese unveränderte Überschneidung an diesem Tag', () => {
    const { plan } = fixture()
    const conflict = planConflicts(plan)[0]!
    expect(nowConflictNotice(plan, 16 * 60 + 30, [conflict.id])).toEqual({ active: [], upcomingCount: 0 })
    const changed = fixture({ prepMin: 20 }).plan
    expect(planConflicts(changed)[0]?.id).not.toBe(conflict.id)
    expect(nowConflictNotice(changed, 16 * 60 + 30, [conflict.id]).active).toHaveLength(1)
  })

  it('erfindet keine Überschneidung bei flexiblem, entfallenem oder erreichtem Termin', () => {
    expect(planConflicts(fixture({ commitment: 'optional' }).plan)).toEqual([])
    expect(planConflicts(fixture({ status: 'cancelled' }).plan)).toEqual([])
    expect(planConflicts(fixture({ arrivedAt: Date.parse(`${DATE}T17:00:00+01:00`) }).plan)).toEqual([])
    expect(planConflicts(fixture({ start: 20 * 60, end: 21 * 60 }).plan)).toEqual([])
  })

  it('benennt auch harte Terminkollisionen und Vorbereitung während der Arbeit, ohne umzusetzen', () => {
    const { settings, commitment } = fixture()
    const a = { ...commitment, id: 'first', start: 12 * 60, end: 13 * 60, locationKind: 'remote' as const, prepMin: 0 }
    const b = { ...a, id: 'second', label: 'Zweiter Termin', start: 12 * 60 + 30, end: 13 * 60 + 30 }
    const plan = buildDayPlan({ date: DATE, settings, commitments: [a, b] })
    const conflicts = planConflicts(plan)
    expect(conflicts.some(c => c.kind === 'commitments' && c.start === b.start && c.end === a.end)).toBe(true)
    expect(conflicts.filter(c => c.kind === 'work')).toHaveLength(2)
    expect(a.start).toBe(12 * 60)
    expect(b.start).toBe(12 * 60 + 30)
  })

  it('prüft nur lokale Quittierungsdaten, lässt aber ältere Backups ohne Feld zu', () => {
    expect(validConflictAcknowledgements(undefined)).toBe(true)
    expect(validConflictAcknowledgements({ [DATE]: ['id'] })).toBe(true)
    expect(validConflictAcknowledgements({ nope: ['id'] })).toBe(false)
    expect(validConflictAcknowledgements({ '2026-02-30': ['id'] })).toBe(false)
    expect(validConflictAcknowledgements({ [DATE]: 'id' })).toBe(false)
    expect(validConflictAcknowledgements({ [DATE]: [1] })).toBe(false)
  })
})
