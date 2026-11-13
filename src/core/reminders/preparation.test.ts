import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import type { Commitment, DayLog, DayPlan, StepResult } from '../types'
import { buildReminders, reminderRevisions } from './build'
import { buildReminderRuleSnapshot } from './rules'

const date = '2026-11-02'
const at = (minute: number, day = date) => zonedToUtc(day, minute)
function settings() {
  const s = defaultSettings(date)
  s.work[0] = { ...s.work[0]!, start: 540, homeOffice: false }
  s.commute.minutes = 20; s.commute.bufferMin = 10
  s.travel.activationMin = 10
  s.sport.days = s.sport.days.map(() => false)
  s.routines.morning = [
    { id: 'first', title: 'PRIVATE-FIRST', minutes: 20, minimal: { title: 'PRIVATE-SHORT', minutes: 2 } },
    { id: 'second', title: 'PRIVATE-SECOND', minutes: 5 },
  ]
  return s
}
const log = (steps: Record<string, StepResult> = {}): DayLog => ({ date, steps, override: {} })
const work = (s = settings(), facts = log()) => buildDayPlan({ date, settings: s, override: facts.override })
const events = (plan: DayPlan, facts = log(), s = settings(), now = at(240)) => buildReminders([plan], { [plan.date]: facts }, s, now)
const impulse = (plan = work(), facts = log(), s = settings()) => events(plan, facts, s).find(e => e.key.startsWith('prepare:'))!
const revisions = (plan: DayPlan, facts = log(), s = settings()) => reminderRevisions([plan], { [plan.date]: facts }, s)
const visit = (patch: Partial<Commitment> = {}): Commitment => ({ id: 'visit', date, label: 'PRIVATE-VISIT',
  context: 'personal', commitment: 'hard', locationKind: 'onsite', placeLabel: 'PRIVATE-PLACE',
  start: 540, end: 600, travelMin: 20, arrivalBufferMin: 10, prepMin: 8, ...patch })
function appointments(cs: Commitment[], s = settings()) {
  s.work[0]!.homeOffice = true
  return buildDayPlan({ date, settings: s, commitments: cs })
}

describe('Datierter dynamischer Vorbereitungsimpuls', () => {
  it('startet bei offener Dauer plus Startreserve, ersetzt leave-10 und erhält den Abfahrtsanker', () => {
    const p = work(), all = events(p), e = impulse(p)
    expect(e.at).toBe(at(475)) // 08:30 - 25 min - 10 min; arrival buffer already in leave
    expect(e).toMatchObject({ validUntil: at(510), actions: false, channel: 'sanft', exact: false, critical: false, slot: 1, rank: 3, escalation: 0 })
    expect(all.filter(x => x.key.startsWith('prepare:'))).toHaveLength(1)
    expect(all.some(x => x.key === 'leave-10' || x.key === 'morning')).toBe(false)
    expect(all.find(x => x.key === 'leave')).toMatchObject({ at: at(510), critical: true, rank: 4 })
    expect(JSON.stringify(e)).not.toMatch(/PRIVATE-|pünktlich/)
  })
  it.each(['done', 'minimal', 'skipped', 'not-needed'] as const)('zählt %s nicht erneut und ersetzt die Revision ohne neuen Zustellungstoken', result => {
    const p = work(), before = impulse(p), after = impulse(p, log({ 'morning:first': result }))
    expect(after.at).toBe(at(495)); expect(after.revision).not.toBe(before.revision); expect(after.token).toBe(before.token)
  })
  it('übernimmt kurze Varianten aus F-002, ohne Schritte oder Tagesdaten selbst zu ändern', () => {
    const facts = { ...log(), override: { shortMorning: true } }, s = settings(), p = work(s, facts)
    const before = structuredClone({ p, facts, s })
    expect(impulse(p, facts, s).at).toBe(at(493))
    expect({ p, facts, s }).toEqual(before)
  })
  it('entfernt den Impuls bei vollständiger Vorbereitung und nach expliziter Büroabfahrt/Arbeitsstart', () => {
    const p = work()
    expect(impulse(p, log({ 'morning:first': 'done', 'morning:second': 'done' }))).toBeUndefined()
    expect(impulse(p, { ...log(), leftAt: 0 })).toBeUndefined()
    p.workInfo!.started = true
    expect(impulse(p)).toBeUndefined()
  })
  it('behält ohne Routine nur die bisherige Vorwarnung, begrenzt bis zur Abfahrt', () => {
    const s = settings(); s.routines.morning = []
    const all = events(work(s), log(), s)
    expect(all.some(e => e.key.startsWith('prepare:'))).toBe(false)
    expect(all.find(e => e.key === 'leave-10')).toMatchObject({ at: at(500), validUntil: at(510) })
  })
  it('beachtet bestehende bewusste Vorwarnungs-Ablehnungen und teilt den Zustellungstoken mit dem Fallback', () => {
    expect(impulse(work(), { ...log(), dismissed: ['leave-10'] })).toBeUndefined()
    expect(impulse(appointments([visit()]), { ...log(), dismissed: ['prep:visit'] })).toBeUndefined()
    const p = work(), before = impulse(p)
    p.blocks.find(b => b.routine === 'morning')!.steps![0]!.minutes = NaN
    const fallback = events(p).find(e => e.key === 'leave-10')!
    expect(fallback.token).toBe(before.token)
    expect(revisions(p)).not.toHaveProperty(`${date}|prepare:work`)
  })
  it.each([NaN, Infinity, -1])('erfindet aus unbrauchbarer Dauer %s keine dynamische Zeit', duration => {
    const p = work(); p.blocks.find(b => b.routine === 'morning')!.steps![0]!.minutes = duration
    expect(impulse(p)).toBeUndefined()
    expect(events(p).find(e => e.key === 'leave-10')?.body).not.toContain('pünktlich')
  })
  it('verwendet keine unbekannte Fahrzeit und erzeugt im Homeoffice keinen Büro-Weg', () => {
    expect(impulse(appointments([visit({ travelMin: undefined })]))).toBeUndefined()
    expect(impulse(appointments([]))).toBeUndefined()
  })
  it('erfindet keine Packdauer und verwendet nur ausdrücklich gespeicherte Tagesfakten', () => {
    const p = appointments([visit({ prepMin: 0, items: ['PRIVATE-ITEM'] })])
    p.blocks.find(b => b.routine === 'morning')!.steps = []
    expect(impulse(p)).toBeUndefined()
    expect(impulse(work(), { ...log({ 'morning:first': 'done' }), date: '2026-11-01' })?.at).toBe(at(475))
  })
  it('nutzt Terminvorbereitung plus überlappungsbereinigte Morgenroutine und ersetzt prep', () => {
    const p = appointments([visit({ prepMin: 30, prepIncludesMorning: true })])
    expect(impulse(p)).toMatchObject({ key: 'prepare:commitment:visit', at: at(470), validUntil: at(510) })
    expect(events(p).some(e => e.key === 'prep:visit' || e.key === 'leave')).toBe(false)
    expect(events(p).some(e => e.key === 'go:visit')).toBe(true)
  })
  it('projiziert mehrere vorhandene Wege jeweils einmal und ohne doppelte Morgenroutine', () => {
    const p = appointments([visit({ thenTo: 'next' }), visit({ id: 'later', start: 900, end: 960 })])
    const all = events(p).filter(e => e.key.startsWith('prepare:'))
    expect(all.map(e => e.key)).toEqual(['prepare:commitment:visit', 'prepare:commitment:later'])
    expect(all[0]!.at).toBe(at(467)) // 25 morning + 8 prep + 10 reserve
    expect(all[1]!.at).toBe(at(852)) // 8 prep + 10 reserve, no morning again
  })
  it.each([{ leftAt: 0 }, { arrivedAt: 0 }, { backAt: 0 }, { status: 'cancelled' as const }, { locationKind: 'remote' as const }])('entfernt einen erledigten/abgesagten/entfallenen Terminweg (%j)', patch => {
    expect(impulse(appointments([visit(patch)]))).toBeUndefined()
  })
  it('ändert Revision und Uhrzeit bei Planwechsel; alte Termine bleiben nicht relevant', () => {
    const s = settings(), before = impulse(work(s), log(), s)
    s.work[0]!.start = 600
    const after = impulse(work(s), log(), s)
    expect(after.at - before.at).toBe(60 * 60_000)
    expect(after.revision).not.toBe(before.revision); expect(after.token).toBe(before.token)
    expect(revisions(appointments([]))).not.toHaveProperty(`${date}|prepare:commitment:visit`)
  })
  it('holt keinen verstrichenen Impuls nach, auch nicht nach Abfahrt oder altem Plantag', () => {
    const p = work()
    for (const now of [at(475), at(510), at(1700)]) expect(events(p, log(), settings(), now).some(e => e.key.startsWith('prepare:'))).toBe(false)
  })
  it('achtet auf globale und geplante Ruhe, Fokus und bewusst reduzierte Unterstützung', () => {
    const p = work(), s = settings()
    expect(buildReminders([p], {}, s, at(240), undefined, { focusUntil: at(480) }).some(e => e.key.startsWith('prepare:'))).toBe(false)
    p.quiet = [[470, 480]]; expect(impulse(p)).toBeUndefined()
    p.quiet = []; s.reminders.quietStart = 470; s.reminders.quietEnd = 480
    expect(impulse(p, log(), s)).toBeUndefined()
    for (const mode of ['auf-kurs', 'ueberlastet'] as const) expect(impulse(work(), { ...log(), override: { mode } })).toBeUndefined()
  })
  it.each([
    ['2026-03-28', 1630], ['2026-10-24', 1590], [date, 1460],
  ] as const)('zieht echte Vorbereitungsminuten auch an Berliner Tages-/Zeitgrenzen ab (%s)', (day, leave) => {
    const p = work(); p.date = day; p.leave = leave; p.workEnd = 1679
    p.blocks = p.blocks.filter(b => b.kind !== 'commute')
    p.blocks.push({ id: 'out', kind: 'commute', title: 'Los', start: leave, end: leave + 20 })
    const s = settings(); s.reminders.quietStart = 0; s.reminders.quietEnd = 0; p.quiet = []
    const e = events(p, { ...log(), date: day }, s, at(240, day)).find(e => e.key.startsWith('prepare:'))!
    expect(e.validUntil).toBe(at(leave, day)); expect(e.at).toBe(at(leave, day) - 35 * 60_000)
  })
  it('hält Fortschritts- und Termindaten aus den neutralen Wochenbasisregeln fern', () => {
    const snapshot = buildReminderRuleSnapshot(settings(), [], at(240))
    expect(snapshot.rules.some(r => /^(prepare:|prep:|leave-10)/.test(r.key))).toBe(false)
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE-|preparation-once|validUntil/)
    expect(snapshot.rules.some(r => r.key === 'leave')).toBe(true)
  })
})
