import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from '../defaults'
import { buildDayPlan } from '../planner'
import { addDays, zonedToUtc } from '../time'
import { buildPcBriefing, buildPcState, defaultPcBridgeLocal, parsePcPayload, validPcBridgeLocal, type PcLinkPreferences } from './index'

const date = '2026-11-12'
const options = (): PcLinkPreferences => {
  const { followGentleEvening, ...wire } = defaultPcBridgeLocal().preferences
  return { ...wire, strictLock: false, singleTransition: followGentleEvening !== false }
}
const setup = () => {
  const settings = defaultSettings(date)
  settings.anchor.manual = { ...settings.anchor.manual, bed: true, pcStop: true }
  settings.pcStop = 22 * 60; settings.bed = 23 * 60
  settings.support.windDown = { enabled: true, at: 21 * 60 + 17, activity: 'PRIVATE_GENTLE_ACTIVITY' }
  return settings
}

describe('Gewählter sanfter PC-Übergang bleibt eine Projektion des vorhandenen Plans', () => {
  it('überträgt nur die gewählte Uhrzeit und ersetzt T30/T10 ohne private Tätigkeit', () => {
    const settings = setup(), plan = buildDayPlan({ date, settings })
    const state = buildPcState({ plan, settings, local: emptyLocal(), prefs: options(), nowMs: zonedToUtc(date, 1200) })
    const briefing = buildPcBriefing([plan], settings, options(), zonedToUtc(date, 1200))
    expect(state.prefs.singleTransition).toBe(true)
    expect(state.schedule.windDownAt).toBe('2026-11-12T20:17:00.000Z')
    expect(state.schedule.brainDumpAt).toBeNull()
    expect(briefing.days[0]?.windDownAt).toBe(state.schedule.windDownAt)
    expect(briefing.days[0]).not.toHaveProperty('brainDumpAt')
    expect(briefing.days[0]?.pc.stopAt).toBe(state.schedule.pcStopAt)
    expect(JSON.stringify({ state, briefing })).not.toContain('PRIVATE_GENTLE_ACTIVITY')
    expect(JSON.stringify({ state, briefing })).not.toContain('followGentleEvening')
  })

  it.each([
    ['2026-11-12', 30, '2026-11-12T23:30:00.000Z'],
    ['2026-11-12', 239, '2026-11-13T02:59:00.000Z'],
    ['2026-11-12', 240, '2026-11-12T03:00:00.000Z'],
    ['2026-03-28', 150, '2026-03-29T01:30:00.000Z'],
    ['2026-10-24', 150, '2026-10-25T01:30:00.000Z'],
  ] as const)('datiert %s Minute %s mit der bestehenden Berliner 04-Uhr-/DST-Regel', (day, minute, expected) => {
    const settings = setup(); settings.support.windDown.at = minute
    const plan = buildDayPlan({ date: day, settings })
    const state = buildPcState({ plan, settings, local: emptyLocal(), prefs: options(), nowMs: zonedToUtc(day, 1200) })
    const briefing = buildPcBriefing([plan], settings, options(), zonedToUtc(day, 1200))
    expect(state.schedule.windDownAt).toBe(expected)
    expect(briefing.days[0]?.windDownAt).toBe(expected)
  })

  it('lässt den gewählten Uhrzeithinweis bei einer datierten Verlängerung unverändert und entfernt ihn bei offenem Ende', () => {
    const settings = setup(); settings.support.windDown.at = 30
    const normal = buildDayPlan({ date, settings })
    const later = buildDayPlan({ date, settings, override: { lateUntil: 1500 } })
    const open = buildDayPlan({ date, settings, override: { lateUntil: 'open' } })
    const build = (plan: typeof normal) => buildPcState({ plan, settings, local: emptyLocal(), prefs: options(), nowMs: zonedToUtc(date, 1200) })
    expect(build(later).schedule.windDownAt).toBe(build(normal).schedule.windDownAt)
    expect(build(later).schedule.pcStopAt).toBe(new Date(zonedToUtc(date, later.pcStop)).toISOString())
    expect(build(later).schedule.bedAt).toBe(new Date(zonedToUtc(date, later.bed)).toISOString())
    expect(build(open).schedule).toMatchObject({ pcStopAt: null, bedAt: null, windDownAt: null, brainDumpAt: null })
    const briefing = buildPcBriefing([open], settings, options(), zonedToUtc(date, 1200))
    expect(briefing.days[0]?.pc.mode).toBe('paused')
    expect(briefing.days[0]).not.toHaveProperty('windDownAt')
    expect(briefing.days[0]).not.toHaveProperty('brainDumpAt')
  })

  it('erhält die bisherige Serie bei abgeschalteter Sanftoption oder bewusster PC-Abwahl', () => {
    for (const enabled of [true, false]) {
      const settings = setup(); settings.support.windDown.enabled = enabled
      const plan = buildDayPlan({ date, settings })
      const prefs = { ...options(), singleTransition: enabled ? false : true }
      const state = buildPcState({ plan, settings, local: emptyLocal(), prefs, nowMs: zonedToUtc(date, 1200) })
      expect(state.prefs.singleTransition).toBe(false)
      expect(state.schedule.windDownAt).toBe(new Date(zonedToUtc(date, plan.bed) - 30 * 60_000).toISOString())
      expect(state.schedule.brainDumpAt).toBe(new Date(zonedToUtc(date, plan.bed) - 10 * 60_000).toISOString())
      expect(buildPcBriefing([plan], settings, prefs, zonedToUtc(date, 1200)).days[0]?.brainDumpAt).toBe(state.schedule.brainDumpAt)
    }
  })

  it.each([0, 12, 30, 90])('liefert den vorhandenen Bildschirm-aus-Puffer %s auf höchstens 30 Minuten begrenzt', screenOffMin => {
    const settings = setup(); settings.sleep.screenOffMin = screenOffMin
    const plan = buildDayPlan({ date, settings })
    const state = buildPcState({ plan, settings, local: emptyLocal(), prefs: options(), nowMs: zonedToUtc(date, 1200) })
    expect(state.prefs.bedAfterStopMin).toBe(Math.min(screenOffMin, 30))
    expect(buildPcBriefing([plan], settings, options(), zonedToUtc(date, 1200)).prefs.bedAfterStopMin).toBe(state.prefs.bedAfterStopMin)
  })

  it('behält freigegebene Morgenzeiten trotz Einzelübergang und über den Mitternachtswechsel', () => {
    const settings = setup(), next = addDays(date, 1)
    const plan = buildDayPlan({ date, settings }), morning = buildDayPlan({ date: next, settings, override: { homeOffice: true, workStart: 8 * 60 } })
    const prefs = { ...options(), morningCountdown: true }
    const state = buildPcState({ plan, settings, local: emptyLocal(), prefs, nextPlan: morning, nowMs: zonedToUtc(date, 1450) })
    expect(state.schedule.homeOffice).toBe(true)
    expect(state.schedule.workStartAt).toBe(new Date(zonedToUtc(next, morning.workInfo!.plannedStart)).toISOString())
    expect(buildPcBriefing([plan, morning], settings, prefs, zonedToUtc(date, 1200)).days[0]?.morning?.workStartAt).toBe(state.schedule.workStartAt)
  })
})

describe('Neue Auswahl bleibt lokal, neue Wire-Felder werden eng geprüft', () => {
  it('akzeptiert alte lokale Daten und die neue boolesche Wahl, aber keine abgeleiteten Wire-Parameter im lokalen Datensatz', () => {
    const local = defaultPcBridgeLocal()
    expect(local.preferences.followGentleEvening).toBe(true)
    expect(validPcBridgeLocal(local)).toBe(true)
    delete local.preferences.followGentleEvening
    expect(validPcBridgeLocal(local)).toBe(true)
    expect(validPcBridgeLocal({ ...local, preferences: { ...local.preferences, followGentleEvening: false } })).toBe(true)
    for (const patch of [{ followGentleEvening: 'ja' }, { singleTransition: true }, { bedAfterStopMin: 20 }]) {
      expect(validPcBridgeLocal({ ...local, preferences: { ...local.preferences, ...patch } })).toBe(false)
    }
  })

  it('verwirft fremde Typen und Werte in Wire-Prefs und hält bestehende Payloads ohne die neuen Felder gültig', () => {
    const settings = setup(), plan = buildDayPlan({ date, settings })
    const state = buildPcState({ plan, settings, local: emptyLocal(), prefs: options(), nowMs: zonedToUtc(date, 1200) })
    expect(() => parsePcPayload(state)).not.toThrow()
    const legacy = structuredClone(state); delete legacy.prefs.singleTransition; delete legacy.prefs.bedAfterStopMin
    expect(() => parsePcPayload(legacy)).not.toThrow()
    for (const patch of [{ singleTransition: 1 }, { singleTransition: 'true' }, { bedAfterStopMin: -1 }, { bedAfterStopMin: 31 }, { bedAfterStopMin: 0.5 }, { bedAfterStopMin: true }, { bedAfterStopMin: '20' }, { followGentleEvening: true }]) {
      expect(() => parsePcPayload({ ...state, prefs: { ...state.prefs, ...patch } })).toThrow()
    }
  })
})
