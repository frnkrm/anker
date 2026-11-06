import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { zonedToUtc } from '../time'
import { buildReminderRuleSnapshot } from './rules'

const validFrom = zonedToUtc('2026-11-20', 4 * 60)

describe('Kritische Wochenregeln nach dem datierten Planungsvorrat', () => {
  it('spiegelt nur kritische Basisrollen ohne Eskalationsserien oder private Inhalte', () => {
    const settings = defaultSettings('2026-11-01')
    settings.reminders.intensity = 'persistent'
    settings.routines.morning[0]!.title = 'PRIVATE-MORGENNOTIZ'
    settings.alarm.qrSecret = 'PRIVATER-QR-CODE'
    const before = structuredClone(settings)
    const snapshot = buildReminderRuleSnapshot(settings, [], validFrom)
    expect(snapshot.validFrom).toBe(validFrom)
    expect(new Set(snapshot.rules.map((rule) => rule.ruleId)).size).toBe(snapshot.rules.length)
    expect(snapshot.rules.every((rule) => ['leave', 'latest-leave', 'latest-start', 'pcstop', 'bed', 'meds'].includes(rule.key))).toBe(true)
    expect(snapshot.rules.filter((rule) => rule.key === 'leave').map((rule) => rule.weekday)).toEqual([0, 1, 2, 3, 4])
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE-MORGENNOTIZ|PRIVATER-QR-CODE|Noch offen|Morgenroutine|Sporttasche/)
    expect(settings).toEqual(before)
  })

  it('erhält die Nachtzuordnung und unterscheidet Homeoffice vom Losgehen', () => {
    const settings = defaultSettings('2026-11-01')
    settings.bed = 30
    settings.work[0]!.homeOffice = true
    const { rules } = buildReminderRuleSnapshot(settings, [], validFrom)
    expect(rules.find((rule) => rule.weekday === 0 && rule.key === 'bed')?.minute).toBe(1470)
    expect(rules.some((rule) => rule.weekday === 0 && rule.key === 'leave')).toBe(false)
    expect(rules.find((rule) => rule.weekday === 0 && rule.key === 'latest-start')?.minute).toBe(8 * 60 + 50)
    expect(rules.some((rule) => rule.weekday === 1 && rule.key === 'leave')).toBe(true)
  })

  it('übernimmt die freiwillige private Erinnerungszeit nur bei ausdrücklicher Konfiguration', () => {
    const settings = defaultSettings('2026-11-01')
    expect(buildReminderRuleSnapshot(settings, [], validFrom).rules.some((rule) => rule.key === 'meds')).toBe(false)
    settings.alarm.medicationEnabled = true
    settings.alarm.medicationReminderAt = 8 * 60
    const rules = buildReminderRuleSnapshot(settings, [], validFrom).rules.filter((rule) => rule.key === 'meds')
    expect(rules).toHaveLength(7)
    expect(rules.every((rule) => rule.minute === 480 && rule.title === 'Deine private Erinnerung')).toBe(true)
  })

  it('führt bei gewähltem sanftem Abendübergang keine PC-/Bett-Regeln weiter', () => {
    const settings = defaultSettings('2026-11-01')
    settings.support.windDown.enabled = true
    const { rules } = buildReminderRuleSnapshot(settings, [], validFrom)
    expect(rules.some((rule) => ['pcstop', 'bed', 'wind-down'].includes(rule.key))).toBe(false)
    expect(rules.some((rule) => rule.key === 'leave')).toBe(true)
  })

  it('normalisiert bekannte Ausnahmetage, ohne ungültige Daten zu erfinden', () => {
    const dates = ['2026-11-23', '2026-11-22', '2026-11-23', '2026-02-30', 'keine-zeit', '2026-2-1']
    const { excludedDates } = buildReminderRuleSnapshot(defaultSettings('2026-11-01'), dates, validFrom)
    expect(excludedDates).toEqual(['2026-11-22', '2026-11-23'])
    expect(dates).toHaveLength(6)
  })

  it('ändert nur betroffene Regelrevisionen und trennt Profil von Gültigkeitsgrenze', () => {
    const settings = defaultSettings('2026-11-01')
    const before = buildReminderRuleSnapshot(settings, [], validFrom)
    expect(buildReminderRuleSnapshot(settings, [], validFrom + 1).rules).toEqual(before.rules)
    settings.pcStop += 15
    const after = buildReminderRuleSnapshot(settings, [], validFrom)
    const find = (rules: typeof before.rules, key: string) => rules.find((rule) => rule.weekday === 0 && rule.key === key)!
    expect(find(after.rules, 'pcstop').ruleId).toBe(find(before.rules, 'pcstop').ruleId)
    expect(find(after.rules, 'pcstop').revision).not.toBe(find(before.rules, 'pcstop').revision)
    expect(find(after.rules, 'leave').revision).toBe(find(before.rules, 'leave').revision)
  })

  it('weist ungültige Gültigkeitsgrenzen zurück', () => {
    for (const value of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(() => buildReminderRuleSnapshot(defaultSettings('2026-11-01'), [], value)).toThrow('Ungültiger Beginn')
    }
  })
})
