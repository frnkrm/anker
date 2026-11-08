import { describe, expect, it } from 'vitest'
import { defaultSettings, migrateSettings } from './defaults'
import { validExtrasLocal } from './extras'
import { buildDayPlan } from './planner'
import { nextAction } from './support'
import { zonedToUtc } from './time'
import type { DayLog, Settings } from './types'

const DATE = '2026-11-09'

describe('Behutsame UI-Standardwerte', () => {
  it('schützt bei neuen und fehlenden Werten den Feierabend, bewahrt aber jedes gespeicherte Aus', () => {
    const fresh = defaultSettings(DATE)
    expect(fresh.support.workAfterHoursQuiet).toBe(true)
    const missing = structuredClone(fresh) as unknown as { support: Partial<Settings['support']> }
    delete missing.support.workAfterHoursQuiet
    expect(migrateSettings(missing as Settings, DATE).support.workAfterHoursQuiet).toBe(true)
    expect(migrateSettings({ ...fresh, support: { ...fresh.support, workAfterHoursQuiet: undefined } } as unknown as Settings, DATE).support.workAfterHoursQuiet).toBe(true)
    const optedOut = { ...fresh, support: { ...fresh.support, workAfterHoursQuiet: false } }
    expect(migrateSettings(optedOut, DATE).support.workAfterHoursQuiet).toBe(false)
    // Auch ein früherer Standard-Aus-Wert ist technisch keine erkennbare neue Wahl.
    // Er bleibt deshalb genauso erhalten wie ein bewusst ausgeschalteter Schalter.
    expect(migrateSettings(migrateSettings(optedOut, DATE), DATE)).toEqual(migrateSettings(optedOut, DATE))
  })

  it('schaltet Werkzeuge und stummen Schlafhinweis nicht aus einer Betriebssystemfreigabe heraus ein', () => {
    const fresh = defaultSettings(DATE)
    expect(fresh.appearance.developerTools).toBe(false)
    expect(fresh.sleep.bedtimePromptEnabled).toBe(false)
    const old = structuredClone(fresh)
    delete old.appearance.developerTools
    delete old.sleep.bedtimePromptEnabled
    const preserved = migrateSettings({ ...fresh, appearance: { ...fresh.appearance, developerTools: true }, sleep: { ...fresh.sleep, bedtimePromptEnabled: true } }, DATE)
    expect(migrateSettings(old, DATE).appearance.developerTools).toBe(false)
    expect(migrateSettings(old, DATE).sleep.bedtimePromptEnabled).toBe(false)
    expect(preserved.appearance.developerTools).toBe(true)
    expect(preserved.sleep.bedtimePromptEnabled).toBe(true)
    expect(validExtrasLocal({ pcStopSetupDone: true })).toBe(true)
    expect(validExtrasLocal({ pcStopSetupDone: false })).toBe(true)
    expect(validExtrasLocal({ pcStopSetupDone: 'ja' })).toBe(false)
  })

  const settings = () => {
    const s = defaultSettings(DATE)
    s.anchor.manual = { wake: true, pcStop: true, bed: true }
    s.anchor.wake = 420; s.pcStop = 22 * 60; s.bed = 22 * 60 + 30
    s.sport.days = s.sport.days.map(() => false)
    return s
  }
  const task = { id: 'work', title: 'Dokument öffnen', createdAt: 1, deadline: zonedToUtc(DATE, 12 * 60) }

  it.each([19 * 60, 21 * 60 + 45, 22 * 60 + 5])('zeigt mit neuen Standardwerten um %i keine berufliche Hauptaufgabe', (m) => {
    const s = settings(), plan = buildDayPlan({ date: DATE, settings: s })
    const log: DayLog = { date: DATE, override: {}, steps: {}, wakeAt: zonedToUtc(DATE, 420) }
    const view = nextAction({ settings: s, plan, log, m, nowMs: zonedToUtc(DATE, m), work: [task], inbox: [] })
    expect(view.action.type).not.toBe('worktask')
    expect(view.action.type).not.toBe('resume')
  })

  it('lässt die ausdrückliche Ausnahme Heute länger weiterhin berufliche Aufgaben anbieten', () => {
    const s = settings(), m = 19 * 60
    const log: DayLog = { date: DATE, override: { workEnd: 21 * 60 }, steps: {}, wakeAt: 1 }
    const plan = buildDayPlan({ date: DATE, settings: s, override: log.override })
    expect(nextAction({ settings: s, plan, log, m, nowMs: zonedToUtc(DATE, m), work: [task], inbox: [] }).action.type).toBe('worktask')
  })
})
