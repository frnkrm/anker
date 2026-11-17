import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import type { Commitment } from '../types'
import { buildReminders, reminderRevisions } from './build'
import { currentReminderAction } from './actions'

const date = '2026-11-02'
const at = (m: number) => zonedToUtc(date, m)
function setup(patch: Partial<Commitment> = {}, delay: number | undefined = 60) {
  const s = defaultSettings(date)
  s.reminders.returnCheckAfterMin = delay
  const c: Commitment = { id: 'visit', date, label: 'PRIVATE-TITLE', context: 'personal', commitment: 'hard', start: 1080, locationKind: 'onsite', placeLabel: 'PRIVATE-PLACE', ...patch }
  const p = buildDayPlan({ date, settings: s, commitments: [c] })
  const checks = (now = at(1000)) => buildReminders([p], {}, s, now).filter(e => e.key.startsWith('return-check:'))
  return { s, p, c, checks }
}

describe('Rückfrage zum offenen Unterwegs-Status', () => {
  it('plant nach bewusster Wahl genau eine private Rückfrage ohne Rückkehrbuchung', () => {
    const { checks, c } = setup()
    const result = checks()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ at: at(1140), validUntil: at(1200), channel: 'sanft', actions: false, critical: false, exact: false, escalation: 0, slot: 2 })
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE-/)
    expect(c.backAt).toBeUndefined()
  })
  it.each([undefined, 0, 14, 241, NaN, Infinity, 30.5])('bleibt ohne gültige Wahl %s aus', delay => {
    const { s, checks } = setup()
    s.reminders.returnCheckAfterMin = delay
    expect(checks()).toEqual([])
  })
  it('fragt bei bekanntem Ende frühestens dann, ohne eine Heimfahrt zu erfinden', () => {
    expect(setup({ end: 1200, travelHomeMin: 90 }).checks()[0]?.at).toBe(at(1200))
  })
  it.each([{ backAt: at(1100) }, { status: 'cancelled' as const }, { locationKind: 'home' as const }, { locationKind: 'remote' as const }])('entfernt den Hinweis bei %o', patch => {
    const { checks, p, s } = setup(patch)
    expect(checks()).toEqual([])
    expect(reminderRevisions([p], {}, s)[`${date}|return-check:visit`]).toBeUndefined()
  })
  it('erhält die Rückfrage auch nach bewusst bestätigter Abfahrt und Ankunft', () => {
    expect(setup({ leftAt: at(1050), arrivedAt: at(1080) }).checks()).toHaveLength(1)
  })
  it('eine bewusst gewählte spätere Rückfrage erhält eine neue Zustellgelegenheit', () => {
    const before = setup().checks()[0]!
    const { checks, s } = setup({ returnCheckAt: at(1200) })
    s.reminders.returnCheckAfterMin = undefined
    const after = checks()[0]!
    expect(after.at).toBe(at(1200))
    expect(after.token).not.toBe(before.token)
    expect(after.actions).toBe(false)
  })
  it('aktualisiert Planänderungen, ohne nach Zustellung eine zweite Gelegenheit zu erzeugen', () => {
    const before = setup().checks()[0]!
    const after = setup({ start: 1110, arrivedAt: at(1110) }).checks()[0]!
    expect(after.at).not.toBe(before.at)
    expect(after.revision).not.toBe(before.revision)
    expect(after.token).toBe(before.token)
    expect(setup({ id: 'other' }).checks()[0]!.token).not.toBe(before.token)
  })
  it('holt verpasste Hinweise weder nachts noch am Folgetag nach', () => {
    const { checks } = setup()
    expect(checks(at(1141))).toEqual([])
    expect(checks(at(1500))).toEqual([])
    expect(setup({ start: 1500 }).checks()).toEqual([])
  })
  it('respektiert Ruhezeit, Fokus und bewusstes Verwerfen', () => {
    const { s, p } = setup()
    s.reminders.quietStart = 1100; s.reminders.quietEnd = 1220
    expect(buildReminders([p], {}, s, at(1000)).some(e => e.key === 'return-check:visit')).toBe(false)
    s.reminders.quietStart = 1410; s.reminders.quietEnd = 300
    expect(buildReminders([p], {}, s, at(1000), undefined, { focusUntil: at(1200) }).some(e => e.key === 'return-check:visit')).toBe(false)
    expect(buildReminders([p], { [date]: { date, override: {}, steps: {}, dismissed: ['return-check:visit'] } }, s, at(1000)).some(e => e.key === 'return-check:visit')).toBe(false)
  })
  it('weist selbst syntaktisch passende native Erledigt-Aktionen zurück', () => {
    const { s, p, checks } = setup()
    const e = checks()[0]!
    expect(currentReminderAction({ id: 'receipt', action: 'done', key: e.key, date, at: e.at, revision: e.revision, token: e.token }, [p], {}, s, {}, at(1141))).toBe(false)
  })
})
