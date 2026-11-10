import { describe, expect, it } from 'vitest'
import { defaultSettings, migrateSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import type { DayLog } from '../types'
import { makeBackup, parseBackup } from '../export/backup'
import { buildReminders, reminderPolicy, reminderRevisions } from './build'
import { buildReminderRuleSnapshot } from './rules'

const date = '2026-11-06', now = zonedToUtc(date, 16 * 60)
function settings() {
  const s = defaultSettings(date)
  s.anchor.manual = { bed: true, wake: true, pcStop: true }; s.bed = 23 * 60 + 30; s.reminders.intensity = 'persistent'
  return s
}
describe('Eigene stille Bettzeitfolge auf dem vorhandenen Erinnerungsanker', () => {
  it('beginnt aus und übernimmt weder fehlende alte Werte noch eine Overlaywahl als neue Einwilligung', () => {
    const s = settings(); expect(s.sleep.bedtimeFollowUpsEnabled).toBe(false)
    delete s.sleep.bedtimeFollowUpsEnabled; s.sleep.bedtimePromptEnabled = true
    expect(migrateSettings(s, date).sleep.bedtimeFollowUpsEnabled).toBe(false)
    s.sleep.bedtimeFollowUpsEnabled = true
    expect(migrateSettings(s, date).sleep.bedtimeFollowUpsEnabled).toBe(true)
    s.sleep.bedtimeFollowUpsEnabled = false
    expect(migrateSettings(s, date).sleep.bedtimeFollowUpsEnabled).toBe(false)
  })
  it('liefert genau einen stillen bed-Trigger auch bei sanftem Übergang, eigener Bettbestätigung und Ruhefenster', () => {
    const s = settings(); s.sleep.bedtimeFollowUpsEnabled = true; s.support.windDown.enabled = true
    const plan = buildDayPlan({ date, settings: s }); plan.quiet = [[plan.bed - 30, plan.bed + 60]]
    const log: DayLog = { date, override: {}, steps: {}, bedAt: now }
    const before = structuredClone({ s, plan, log })
    const entries = buildReminders([plan], { [date]: log }, s, now)
    const bed = entries.filter(entry => entry.key === 'bed')
    expect(bed).toHaveLength(1); expect(bed[0]).toMatchObject({ at: zonedToUtc(date, plan.bed), quietFollowUps: true, channel: 'sanft', escalation: 0, exact: false, actions: false })
    expect(entries.filter(entry => entry.quietFollowUps).map(entry => entry.key)).toEqual(['bed'])
    expect({ s, plan, log }).toEqual(before)
  })
  it('respektiert offenes Ende und Heute nicht, ohne andere Buchungen zu ändern', () => {
    const s = settings(); s.sleep.bedtimeFollowUpsEnabled = true
    const log: DayLog = { date, override: {}, steps: {}, dismissed: ['bed'] }
    expect(buildReminders([buildDayPlan({ date, settings: s })], { [date]: log }, s, now).some(entry => entry.key === 'bed')).toBe(false)
    const open = buildDayPlan({ date, settings: s, override: { lateUntil: 'open' } })
    expect(buildReminders([open], {}, s, now).some(entry => entry.key === 'bed')).toBe(false)
    expect(reminderRevisions([open], {}, s)[date + '|bed']).toBeUndefined()
    expect(log.steps).toEqual({}); expect(log.bedAt).toBeUndefined()
  })
  it('verändert weder andere Reminder noch ihre Laut-/Aktions-/Revisionswerte', () => {
    const s = settings(), plan = buildDayPlan({ date, settings: s })
    const before = buildReminders([plan], {}, s, now).filter(entry => entry.key !== 'bed')
    s.sleep.bedtimeFollowUpsEnabled = true
    expect(buildReminders([plan], {}, s, now).filter(entry => entry.key !== 'bed')).toEqual(before)
  })
  it('bindet Wahl und Einschlafdauer an die Revision, nicht an neue Planzeiten', () => {
    const s = settings(), plan = buildDayPlan({ date, settings: s })
    const legacy = reminderRevisions([plan], {}, s)[date + '|bed']
    s.sleep.bedtimeFollowUpsEnabled = true
    const first = reminderRevisions([plan], {}, s)[date + '|bed']
    expect(first).not.toBe(legacy)
    s.sleep.fallAsleepMin = 45
    expect(reminderRevisions([plan], {}, s)[date + '|bed']).not.toBe(first)
    expect(buildReminders([plan], {}, s, now).find(entry => entry.key === 'bed')?.at).toBe(zonedToUtc(date, plan.bed))
    expect(reminderPolicy([plan], s)).toMatchObject({ bedtimeFollowUpsEnabled: true, bedtimeFollowUpsDelayMinutes: 45 })
  })
  it('verwendet ungültige bestehende Einschlafwerte niemals als stillschweigende laute Rückfallebene', () => {
    const s = settings(); s.sleep.bedtimeFollowUpsEnabled = true
    const plan = buildDayPlan({ date, settings: s })
    for (const invalid of [-1, 61, 1.5, NaN]) {
      s.sleep.fallAsleepMin = invalid
      expect(reminderPolicy([plan], s)).toMatchObject({ bedtimeFollowUpsEnabled: false, bedtimeFollowUpsDelayMinutes: 0 })
      expect(buildReminders([plan], {}, s, now).filter(entry => entry.key === 'bed')).toEqual([expect.objectContaining({ quietFollowUps: true, channel: 'sanft', actions: false, exact: false })])
    }
  })
  it('führt dieselbe stille Wahl nach dem datierten Vorrat ohne zweite Serie fort und versieht ihre Regeln mit Delayrevision', () => {
    const s = settings(); s.sleep.bedtimeFollowUpsEnabled = true; s.support.windDown.enabled = true
    const first = buildReminderRuleSnapshot(s, [], zonedToUtc(date, 4 * 60))
    const bed = first.rules.filter(rule => rule.key === 'bed')
    expect(bed).toHaveLength(7); expect(bed.every(rule => rule.quietFollowUps === true && rule.channel === 'sanft' && !rule.exact)).toBe(true)
    expect(first.rules.filter(rule => rule.key !== 'bed').every(rule => rule.quietFollowUps === undefined)).toBe(true)
    s.sleep.fallAsleepMin = 45
    const second = buildReminderRuleSnapshot(s, [], first.validFrom)
    expect(second.rules.find(rule => rule.ruleId === bed[0]!.ruleId)?.revision).not.toBe(bed[0]?.revision)
    expect(second.rules.filter(rule => rule.key !== 'bed')).toEqual(first.rules.filter(rule => rule.key !== 'bed'))
  })
  it('prüft den neuen Sicherungsschalter, erhält ältere Daten und restauriert keinen nativen Sitzungszustand', () => {
    const s = settings(); s.sleep.bedtimeFollowUpsEnabled = true
    const record = { collection: 'settings' as const, id: 'main', data: s, updated_at: now, deleted: false }
    const backup = makeBackup([record])
    expect(parseBackup(JSON.stringify(backup))[0]?.data).toEqual(s)
    expect(JSON.stringify(backup)).not.toMatch(/quietVisible|quietDueAt|quietUntilAt|sessionId/)
    const bad = structuredClone(backup) as unknown as { records: { data: { sleep: { bedtimeFollowUpsEnabled: unknown } } }[] }
    bad.records[0]!.data.sleep.bedtimeFollowUpsEnabled = 'ja'
    expect(() => parseBackup(JSON.stringify(bad))).toThrow()
  })
})
