import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from '../defaults'
import { buildDayPlan } from '../planner'
import { buildReminders } from '../reminders/build'
import { buildReminderRuleSnapshot } from '../reminders/rules'
import { buildTimeCatalog } from '../timeCatalog'
import { zonedToUtc } from '../time'
import { buildPcBriefing, buildPcState, defaultPcBridgeLocal, parsePcPayload } from '../pcLink'
import { makeBackup, parseBackup } from '../export/backup'
import { eveningLightMinute } from './eveningLight'
import { guidancePreferences, validGuidancePreferences } from './settings'

const date = '2026-11-12'
const now = zonedToUtc(date, 300)
const pcPrefs = () => {
  const { followGentleEvening, ...wire } = defaultPcBridgeLocal().preferences
  return { ...wire, strictLock: false, singleTransition: followGentleEvening !== false }
}
const setup = () => {
  const s = defaultSettings(date)
  s.support.windDown.enabled = false
  s.anchor.manual = { wake: true, pcStop: true, bed: true }
  s.bed = 1380
  s.reminders.quietStart = 0; s.reminders.quietEnd = 0
  s.guidance = { ...guidancePreferences(), enabled: true, eveningLight: true }
  return s
}

describe('Freiwilliges Abendlicht ohne zweite Abendplanung', () => {
  it('beginnt aus und validiert bestehende sowie neue Sicherungen streng', () => {
    expect(guidancePreferences()).toMatchObject({ eveningLight: false, eveningLightLeadMinutes: 120, suppressPhonePcWhenConfirmed: false })
    expect(validGuidancePreferences({ enabled: true })).toBe(true)
    for (const value of [{ eveningLight: 'ja' }, { eveningLightLeadMinutes: 14 }, { eveningLightLeadMinutes: 241 }, { suppressPhonePcWhenConfirmed: 1 }]) expect(validGuidancePreferences(value)).toBe(false)
    const s = setup()
    s.guidance!.suppressPhonePcWhenConfirmed = true
    const record = { collection: 'settings' as const, id: 'main', data: s, updated_at: now, deleted: false }
    expect(parseBackup(JSON.stringify(makeBackup([record])))[0]?.data).toEqual(s)
  })
  it('plant nur einen sanften Hinweis ohne Aktion, Eskalation oder Erledigung', () => {
    const s = setup(), plan = buildDayPlan({ date, settings: s })
    const reminders = buildReminders([plan], {}, s, now)
    expect(reminders.filter(r => r.key === 'guidance-evening-light')).toEqual([expect.objectContaining({ at: zonedToUtc(date, plan.bed - 120), channel: 'sanft', critical: false, exact: false, actions: false, escalation: 0, rank: 1 })])
    expect(buildReminderRuleSnapshot(s, [], now).rules.some(r => r.key === 'guidance-evening-light')).toBe(true)
  })
  it('wird durch gewählten Abendübergang oder T30/T10 ersetzt, auch am PC', () => {
    for (const kind of ['windDown', 'sequence'] as const) {
      const s = setup()
      if (kind === 'windDown') s.support.windDown.enabled = true
      else s.guidance!.eveningEscalation = true
      const plan = buildDayPlan({ date, settings: s })
      expect(eveningLightMinute(plan, s)).toBeUndefined()
      expect(buildReminders([plan], {}, s, now).some(r => r.key === 'guidance-evening-light')).toBe(false)
      const prefs = pcPrefs()
      expect(buildPcBriefing([plan], s, prefs, now).days[0]?.lightHintAt).toBeUndefined()
      expect(buildPcState({ plan, settings: s, prefs, local: emptyLocal(), nowMs: now }).schedule.lightHintAt).toBeUndefined()
    }
  })
  it('behält Ausnahmen, Bettbestätigung, Krankheit und globale Ruhezeiten', () => {
    const s = setup(), plan = buildDayPlan({ date, settings: s })
    expect(eveningLightMinute({ ...plan, openEnd: true }, s)).toBeUndefined()
    expect(eveningLightMinute({ ...plan, dayType: 'sick' }, s)).toBeUndefined()
    expect(eveningLightMinute(plan, s, { date, override: {}, steps: {}, bedAt: now })).toBeUndefined()
    s.reminders.quietStart = 1200; s.reminders.quietEnd = 1320
    expect(buildReminders([plan], {}, s, now).some(r => r.key === 'guidance-evening-light')).toBe(false)
  })
  it('nutzt datierte Bettverschiebungen und denselben optionalen Wire-Wert', () => {
    const s = setup(), plan = buildDayPlan({ date, settings: s, override: { lateUntil: 1470 } })
    const at = zonedToUtc(date, plan.bed - 120), prefs = pcPrefs()
    const state = buildPcState({ plan, settings: s, prefs, local: emptyLocal(), nowMs: now })
    expect(state.schedule.lightHintAt).toBe(new Date(at).toISOString())
    expect(buildPcBriefing([plan], s, prefs, now).days[0]?.lightHintAt).toBe(state.schedule.lightHintAt)
    expect(() => parsePcPayload({ ...state, schedule: { ...state.schedule, lightHintAt: false } })).toThrow()
    expect(() => parsePcPayload(state)).not.toThrow()
  })
  it('führt die Uhrzeit im chronologischen Abendkatalog einschließlich ersetztem Status', () => {
    const s = setup(), local = emptyLocal(), plan = buildDayPlan({ date, settings: s })
    const catalog = () => buildTimeCatalog({ settings: s, local, plans: [plan], days: {}, inbox: [], events: [], nowMs: now })
    expect(catalog().entries.find(e => e.functionId === 'reminder.guidance-evening-light')).toMatchObject({ category: 'sleep', status: 'planned', at: zonedToUtc(date, plan.bed - 120) })
    s.support.windDown.enabled = true
    expect(catalog().entries.find(e => e.functionId === 'reminder.guidance-evening-light')).toMatchObject({ category: 'sleep', status: 'inactive', reason: expect.stringContaining('Bereits abgestimmt') })
  })
})
