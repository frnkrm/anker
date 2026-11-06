import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan } from './planner'
import { dayActual, forecastEnd, latestInfo, workRule } from './worktime'
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
  })
})
