import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan } from './planner'
import { assertWorkChanges, dayActual, forecastEnd, latestInfo, validWorkSession, workForecast, workRule, workSessionIssues } from './worktime'
import { zonedToUtc } from './time'
import type { Settings, WorkSession } from './types'

const date = '2026-11-02'
const settings = defaultSettings(date)
const at = (minute: number) => zonedToUtc(date, minute)
const session = (id: string, start: number, end?: number, kind: WorkSession['kind'] = 'regular'): WorkSession => ({ id, date, kind, startAt: at(start), ...(end !== undefined ? { endAt: at(end) } : {}), breaks: [] })

describe('E05: Arbeitsprognose mit realem Fortsetzungspunkt', () => {
  it('platziert Restarbeit nach beendetem Einsatz nicht vor jetzt', () => {
    const actual = dayActual([session('incident', 480, 600, 'incident')], date, at(840))
    expect(forecastEnd({ ...workRule(date, settings), date, actual, nowMs: at(840) })).toBe(1260)
  })

  it('markiert unbekanntes Pausenende als untere Prognose statt einer zugesagten Uhrzeit', () => {
    const s = session('regular', 480)
    s.breaks = [{ id: 'pause', startAt: at(720) }]
    const plan = buildDayPlan({ date, settings, sessions: [s], nowMs: at(750) })
    expect(plan.workInfo).toMatchObject({ forecastLowerBound: true })
    expect(plan.workEnd).toBe(990)
  })

  it('führt tagelang offene Stunden ausdrücklich als unbestätigt', () => {
    const actual = dayActual([session('forgotten', 480)], date, zonedToUtc('2026-11-05', 480))
    expect(actual).toMatchObject({ unconfirmed: true })
  })

  it('benennt auch im Homeoffice einen festen privaten Termin mitten in der Arbeit', () => {
    const plan = buildDayPlan({ date, settings, override: { homeOffice: true }, commitments: [{ id: 'private', date, label: 'Fester Termin', context: 'personal', commitment: 'hard', start: 900, end: 960, status: 'planned', routeMode: 'none' }] })
    expect(plan.conflicts?.join(' ')).toContain('Arbeitszeit')
    expect(plan.blocks.find((block) => block.id === 'commitment:private')?.start).toBe(900)
  })

  it('nimmt eine Tagesgrenze aus dem vorhandenen Wochenprofil vor der globalen Vorgabe', () => {
    const s: Settings = { ...settings, work: settings.work.map((day, index) => index === 0 ? { ...day, latestStart: 510 } : day) }
    expect(buildDayPlan({ date, settings: s }).workInfo?.latestStart).toBe(510)
    expect(latestInfo(s, false)).toMatchObject({ latestStart: 540 })
    expect(latestInfo(s, false, date, { latestStart: 555 })).toMatchObject({ latestStart: 555 })
    expect(latestInfo(s, false, date, { latestStart: null })).toBeUndefined()
  })

  it('schaltet nur die selbst gewählte Wochentagsgrenze aus und bewahrt den bisherigen Beginn', () => {
    const s: Settings = { ...settings, work: settings.work.map((day, index) => index === 0 ? { ...day, latestStart: null } : day) }
    const plan = buildDayPlan({ date, settings: s })
    expect(plan.workInfo?.latestStart).toBeUndefined()
    expect(plan.workInfo?.plannedStart).toBe(480)
    expect(buildDayPlan({ date: '2026-11-03', settings: s }).workInfo?.latestStart).toBe(540)
  })

  it('trennt einen Endwunsch vom Nettoziel und der rechnerischen Prognose', () => {
    const s: Settings = { ...settings, work: settings.work.map((day, index) => index === 0 ? { ...day, endPreference: 900 } : day) }
    const plan = buildDayPlan({ date, settings: s })
    expect(plan.workEnd).toBe(900)
    expect(plan.workInfo).toMatchObject({ targetNetMin: 480, forecastEnd: 1020, endPreference: 900 })
    expect(plan.notes.join(' ')).toContain('Feierabendwunsch')
  })

  it('verwendet die erwartete Restpause genau einmal, ohne sie als beendet auszugeben', () => {
    const s = session('regular', 480)
    s.breaks = [{ id: 'pause', startAt: at(720), expectedEndAt: at(810) }]
    const actual = dayActual([s], date, at(750))
    expect(workForecast({ ...workRule(date, settings), date, actual, nowMs: at(750) })).toEqual({ end: 1050, lowerBound: false, unconfirmed: false })
    expect(actual.openBreak?.endAt).toBeUndefined()
    expect(actual.breakMin).toBe(30)
    expect(workForecast({ ...workRule(date, settings), date, actual: dayActual([s], date, at(825)), nowMs: at(825) })).toMatchObject({ end: 1065, lowerBound: true })
  })

  it('erkennt Überlappung und Pausen außerhalb ihres Abschnitts, statt Rohangaben zu löschen', () => {
    const a = session('a', 480, 720)
    a.breaks = [{ id: 'pause', startAt: at(450), endAt: at(495) }]
    const b = session('b', 660, 840)
    const original = structuredClone([a, b])
    expect(workSessionIssues([a, b], at(1140)).map((issue) => issue.key)).toEqual(expect.arrayContaining(['break-outside|a|pause', 'overlap-work|a|b|']))
    expect(dayActual([a, b], date, at(1140)).unconfirmed).toBe(true)
    expect([a, b]).toEqual(original)
  })

  it('lässt alte Konflikte schrittweise korrigieren, aber nicht vergrößern', () => {
    const before = [session('a', 480, 720), session('b', 660, 840)]
    expect(() => assertWorkChanges(before, [before[0]!, session('b', 690, 840)], at(1140))).not.toThrow()
    expect(() => assertWorkChanges(before, [before[0]!, session('b', 600, 840)], at(1140))).toThrow('überschneiden')
    expect(() => assertWorkChanges(before, [before[0]!, session('b', 720, 840)], at(1140))).not.toThrow()
  })

  it('weist neu als Ist eingegebene Zukunft sowie widersprüchliche Pausen zurück', () => {
    expect(() => assertWorkChanges([], [session('future', 1200, 1260)], at(1140))).toThrow('Zukunft')
    const s = session('a', 480, 1020)
    s.breaks = [{ id: 'p', startAt: at(720), endAt: at(690) }]
    expect(() => assertWorkChanges([], [s], at(1140))).toThrow('Pausenende')
  })

  it('akzeptiert Legacy-Sessions ohne Endschätzung und prüft neue optionale Daten strukturell', () => {
    const s = session('a', 480, 1020)
    expect(validWorkSession(s)).toBe(true)
    for (const bad of [{ ...s, breaks: null }, { ...s, startAt: NaN }, { ...s, kind: 'automatic' }, { ...s, date: '2026-02-31' }, { ...s, breaks: [{ id: 'p', startAt: at(720), expectedEndAt: Infinity }] }]) expect(validWorkSession(bad)).toBe(false)
  })
})
