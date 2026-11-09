import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { minutesOnPlanDay, zonedToUtc } from '../time'
import type { DayLog, Settings } from '../types'
import { buildReminders, relevantReminderKeys } from './build'
import { buildReminderRuleSnapshot } from './rules'

const date = '2026-11-02'
const now = zonedToUtc(date, 12 * 60)
const keys = ['guidance-wind-down', 'guidance-brain-dump', 'bed']
const preferences = (settings: Settings) => Object.assign(settings, { guidance: { enabled: true, eveningEscalation: true } })
const eveningEntries = (settings: Settings, log?: DayLog, bed?: number, openEnd = false, sick = false) => {
  const plan = buildDayPlan({ date, settings })
  if (bed !== undefined) plan.bed = bed
  if (openEnd) plan.openEnd = true
  if (sick) plan.dayType = 'sick'
  return buildReminders([plan], { [date]: log }, settings, now).filter(entry => keys.includes(entry.key))
}

describe('Native Hinweise für die freiwillige Abendbegleitung', () => {
  it('fügt ohne ausdrückliche Freigabe keine neuen Hinweise hinzu', () => {
    const settings = defaultSettings(date)
    expect(eveningEntries(settings).some(entry => entry.key.startsWith('guidance-'))).toBe(false)
    const enabled = preferences(settings)
    enabled.guidance.enabled = false
    expect(eveningEntries(enabled).some(entry => entry.key.startsWith('guidance-'))).toBe(false)
    enabled.guidance.enabled = true
    enabled.guidance.eveningEscalation = false
    expect(eveningEntries(enabled).some(entry => entry.key.startsWith('guidance-'))).toBe(false)
  })

  it('plant genau T30, T10 und einen bestehenden Bett-Anker ohne parallele Übergangsserie', () => {
    const settings = preferences(defaultSettings(date))
    settings.reminders.intensity = 'persistent'
    settings.support.windDown = { enabled: true, at: 21 * 60 + 30, activity: 'PRIVATE RUHEAKTIVITÄT' }
    const plan = buildDayPlan({ date, settings })
    const all = buildReminders([plan], {}, settings, now)
    const entries = all.filter(entry => keys.includes(entry.key))
    expect(entries.map(entry => entry.key)).toEqual(keys)
    expect(entries.map(entry => minutesOnPlanDay(date, entry.at))).toEqual([plan.bed - 30, plan.bed - 10, plan.bed])
    expect(all.some(entry => ['wind-down', 'pcstop-15', 'pcstop'].includes(entry.key))).toBe(false)
    expect(entries.slice(0, 2).every(entry => entry.channel === 'sanft' && !entry.exact && !entry.critical && !entry.actions && entry.escalation === 0)).toBe(true)
    expect(entries[2]).toMatchObject({ key: 'bed', critical: true, actions: false, escalation: 0 })
    expect(JSON.stringify(entries)).not.toContain('PRIVATE RUHEAKTIVITÄT')
  })

  it('lässt Krankheit, offenen Abend und bewusste Erledigung oder Abwahl frei', () => {
    const settings = preferences(defaultSettings(date))
    const base: DayLog = { date, override: {}, steps: {} }
    expect(eveningEntries(settings, undefined, undefined, true)).toEqual([])
    expect(eveningEntries(settings, undefined, undefined, false, true)).toEqual([])
    for (const log of [{ ...base, bedAt: now }, { ...base, eveningRoutineDoneAt: now }, { ...base, dismissed: ['evening'] }]) {
      expect(eveningEntries(settings, log)).toEqual([])
      expect(relevantReminderKeys([buildDayPlan({ date, settings })], { [date]: log }, settings).some(key => key.includes('guidance-'))).toBe(false)
    }
  })

  it('respektiert für Vorhinweise Ruhezeiten und ordnet die Nacht dem richtigen Plantag zu', () => {
    const settings = preferences(defaultSettings(date))
    const bed = 24 * 60 + 30
    expect(eveningEntries(settings, undefined, bed).map(entry => entry.key)).toEqual(['bed'])
    settings.reminders.quietStart = 5 * 60
    settings.reminders.quietEnd = 6 * 60
    const entries = eveningEntries(settings, undefined, bed)
    expect(entries.map(entry => entry.date)).toEqual([date, date, date])
    expect(entries.map(entry => entry.at)).toEqual([zonedToUtc('2026-11-03', 0), zonedToUtc('2026-11-03', 20), zonedToUtc('2026-11-03', 30)])
  })

  it('stellt die freiwilligen Hinweise nach dem datierten Vorrat als allgemeine Wochenregeln bereit', () => {
    const settings = preferences(defaultSettings(date))
    const snapshot = buildReminderRuleSnapshot(settings, ['2026-11-23'], zonedToUtc('2026-11-20', 4 * 60))
    const hints = snapshot.rules.filter(rule => rule.key.startsWith('guidance-'))
    expect(hints).toHaveLength(14)
    expect(hints.every(rule => rule.channel === 'sanft' && !rule.exact)).toBe(true)
    expect(snapshot.rules.filter(rule => rule.key === 'bed')).toHaveLength(7)
    expect(snapshot.rules.some(rule => ['pcstop', 'pcstop-15', 'wind-down'].includes(rule.key))).toBe(false)
    expect(snapshot.excludedDates).toEqual(['2026-11-23'])
  })
})
