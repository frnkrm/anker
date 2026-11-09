import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal, migrateSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { addDays, zonedToUtc } from '../time'
import type { DayLog, LocalData } from '../types'
import { parseBackup, makeBackup } from '../export/backup'
import { deriveGuidance, genuineMorningCompleted, guidancePlanDate, guidancePreferences, validGuidanceLocal, validGuidancePreferences, zombieRoutineSteps } from './index'
import { recordForSync } from '../syncPrivacy'

const date = '2026-11-12'
const at = (minutes: number, day = date) => zonedToUtc(day, minutes)
function settings() {
  const value = defaultSettings(date)
  value.anchor = { ...value.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  value.bed = 1380; value.pcStop = 1350
  value.sport.days = value.sport.days.map(() => false)
  value.guidance = { ...guidancePreferences(), enabled: true, eveningEscalation: true, pcLock: true }
  return value
}
const day = (): DayLog => ({ date, override: {}, steps: {} })

describe('Freiwillige Führungspräferenzen und alte Daten', () => {
  it('beginnt mit ausgeschalteten Eingriffen und nur sichtbarer Zeit als Standard', () => {
    const value = guidancePreferences()
    for (const [key, setting] of Object.entries(value)) if (typeof setting === 'boolean') expect(setting, key).toBe(key === 'timeArc')
    expect(value).toMatchObject({ paceIntervalMin: 1, antiRelapseMinutes: 5, autoZombieAfterSeconds: 60, sleepNoiseMinutes: 20 })
  })
  it('erhält alte Routine-IDs, Texte und explizite Entscheidungen', () => {
    const original = settings(); delete original.guidance
    original.routines.morning = [{ id: 'my-custom', title: 'Mein eigener Anfang', minutes: 3 }]
    const result = migrateSettings(original, date)
    expect(result.routines.morning).toEqual(original.routines.morning)
    expect(guidancePreferences(result.guidance).enabled).toBe(false)
    expect(guidancePreferences({ enabled: true, preWakeFadeIn: false }).preWakeFadeIn).toBe(false)
  })
  it.each([{ unknownControl: true }, { pcLock: 'true' }, { autoZombieAfterSeconds: -1 }, { sleepNoiseMinutes: 999 }])('weist beschädigte oder unbekannte Führungswerte zurück: %j', value => {
    expect(validGuidancePreferences(value)).toBe(false)
    expect(() => parseBackup(JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data: { ...settings(), guidance: value }, updated_at: at(720), deleted: false }])))).toThrow(/ungültige/)
  })
  it('weist beschädigte neue lokale Fakten und essentielle Markierungen vor Import ab', () => {
    expect(validGuidanceLocal({ days: { [date]: { nightLockedAt: -1 } }, receipts: [] })).toBe(false)
    expect(validGuidanceLocal({ days: {}, receipts: [], secretKey: 'nicht erlaubt' })).toBe(false)
    const value = settings()
    const invalid = { ...value, routines: { ...value.routines, morning: [{ id: 'water', title: 'Wasser', minutes: 1, isEssentialForZombieMode: 'yes' }] } }
    expect(() => parseBackup(JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data: invalid, updated_at: at(720), deleted: false }])))).toThrow(/ungültige/)
  })
  it('überträgt die neuen Gerätefreigaben nicht per Settings-Sync', () => {
    const s = settings()
    expect((recordForSync({ collection: 'settings', id: 'main', data: s, updated_at: at(720), deleted: false })?.data as Record<string, unknown>).guidance).toBeUndefined()
  })
})

describe('Kernschritte im vorhandenen Planer', () => {
  it('filtert nur ausgewählte Kernschritte und schreibt keine falschen Häkchen', () => {
    const s = settings(); s.routines.morning[0]!.isEssentialForZombieMode = true
    const log = { ...day(), override: { zombie: true } }
    const plan = buildDayPlan({ date, settings: s, override: log.override })
    expect(plan.blocks.find(block => block.routine === 'morning')?.steps?.map(step => step.id)).toEqual(['water'])
    expect(plan.blocks.find(block => block.routine === 'morning')?.steps?.[0]?.useMinimal).toBe(true)
    expect(log.steps).toEqual({})
    expect(genuineMorningCompleted(plan, log)).toBe(false)
  })
  it('erhält alte eigene Routinen ohne Markierungen statt sie als fertig zu leeren', () => {
    const steps = [{ id: 'a', title: 'A', minutes: 3 }, { id: 'b', title: 'B', minutes: 4 }]
    expect(zombieRoutineSteps(steps, true)).toEqual(steps)
    const s = settings(); s.routines.morning = steps
    const plan = buildDayPlan({ date, settings: s, override: { zombie: true } })
    expect(plan.blocks.find(block => block.routine === 'morning')?.steps?.map(step => step.id)).toEqual(['a', 'b'])
    expect(genuineMorningCompleted(plan, day())).toBe(false)
  })
  it('wertet ausschließlich echte Abschlüsse der geplanten Kernschritte', () => {
    const s = settings(); s.routines.morning = [{ id: 'a', title: 'A', minutes: 1, isEssentialForZombieMode: true }]
    const plan = buildDayPlan({ date, settings: s, override: { zombie: true } })
    expect(genuineMorningCompleted(plan, { ...day(), steps: { 'morning:a': 'skipped' } })).toBe(false)
    expect(genuineMorningCompleted(plan, { ...day(), steps: { 'morning:a': 'minimal' } })).toBe(true)
    s.routines.morning = []
    expect(genuineMorningCompleted(buildDayPlan({ date, settings: s }), day())).toBe(false)
  })
})

describe('Eine Zustandsprojektion, kein zweiter Plan', () => {
  it('behält einen echten frühen Alarmtag auch zwischen zwei Routinen-Schritten bei', () => {
    const next = addDays(date, 1); const local = emptyLocal()
    local.guidance = { receipts: ['morning:native-id'], days: { [next]: { alarmOccurrenceId: 'native-id', alarmAt: at(210, next), morningActivatedAt: at(211, next) } } }
    expect(guidancePlanDate(local, date, at(212, next))).toBe(next)
    expect(local.focus).toBeUndefined()
    expect(guidancePlanDate(emptyLocal(), date, at(212, next))).toBe(date)
    expect(guidancePlanDate(local, date, at(212, next) + 13 * 3600_000)).toBe(date)
  })
  it.each([[1349, 'EVENING_WIND_DOWN'], [1350, 'WIND_DOWN_T30'], [1370, 'BRAIN_DUMP_T10'], [1380, 'BEDTIME_HARD_CUT']] as const)('zeigt um Minute %s genau %s', (minute, phase) => {
    const s = settings(); s.support.windDown = { enabled: true, at: 1320, activity: 'Lesen' }
    expect(deriveGuidance({ plan: buildDayPlan({ date, settings: s }), log: day(), settings: s, local: emptyLocal(), nowMs: at(minute) }).phase).toBe(phase)
  })
  it('lässt ein offenes Ende offen und eine bestätigte Sperre trotzdem bestehen', () => {
    const s = settings(); const local = emptyLocal()
    const plan = buildDayPlan({ date, settings: s, override: { lateUntil: 'open' } })
    expect(deriveGuidance({ plan, local, settings: s, nowMs: at(1400) }).phase).toBe('DAY_ACTIVE')
    local.guidance = { receipts: [], days: { [date]: { nightLockedAt: at(1380), bedVerifiedAt: at(1380) } } }
    expect(deriveGuidance({ plan, local, settings: s, nowMs: at(1400) })).toMatchObject({ phase: 'NIGHT_LOCK', lockEnforced: true })
  })
  it('eskaliert nach Bettbestätigung oder Heute nicht nicht erneut, hält aber eine echte Nachtsperre', () => {
    const s = settings(); const plan = buildDayPlan({ date, settings: s })
    for (const patch of [{ bedAt: at(1375) }, { dismissed: ['evening'] }]) {
      const log = { ...day(), ...patch }
      expect(deriveGuidance({ plan, log, local: emptyLocal(), settings: s, nowMs: at(1380) }).phase).toBe('DAY_ACTIVE')
      const local = { ...emptyLocal(), guidance: { receipts: [], days: { [date]: { nightLockedAt: at(1375) } } } }
      expect(deriveGuidance({ plan, log, local, settings: s, nowMs: at(1380) }).phase).toBe('NIGHT_LOCK')
    }
    expect(deriveGuidance({ plan, log: { ...day(), eveningRoutineDoneAt: at(1375) }, local: emptyLocal(), settings: s, nowMs: at(1380) }).phase).toBe('BEDTIME_HARD_CUT')
  })
  it('hält die Nacht über 03:59 und 04:00, beendet sie nur durch echte Morgenhandlung oder den begrenzten Schutzablauf', () => {
    const s = settings(); const tomorrow = addDays(date, 1)
    const local: LocalData = { ...emptyLocal(), guidance: { receipts: [], days: { [date]: { nightLockedAt: at(1380) } } } }
    for (const [planDate, minute] of [[date, 1440 + 239], [tomorrow, 240]] as const) {
      const plan = buildDayPlan({ date: planDate, settings: s })
      expect(deriveGuidance({ plan, settings: s, local, nowMs: at(minute, planDate) }).lockEnforced).toBe(true)
    }
    const plan = buildDayPlan({ date: tomorrow, settings: s })
    const log = { date: tomorrow, override: {}, steps: Object.fromEntries(plan.blocks.find(block => block.routine === 'morning')!.steps!.map(step => [`morning:${step.id}`, 'minimal' as const])) }
    expect(deriveGuidance({ plan, log, settings: s, local, nowMs: at(480, tomorrow) })).toMatchObject({ morningCompleted: true, lockEnforced: false })
    expect(deriveGuidance({ plan, settings: s, local, nowMs: at(1380 + 18 * 60) }).lockEnforced).toBe(false)
  })
  it.each(['2026-03-29', '2026-10-25'])('leitet Berliner Nachtphasen an der Zeitumstellung %s aus UTC ab', targetDate => {
    const s = settings(); s.bed = 26 * 60 + 30
    const plan = buildDayPlan({ date: targetDate, settings: s })
    const targetAt = zonedToUtc(targetDate, plan.bed)
    expect(deriveGuidance({ plan, settings: s, local: emptyLocal(), nowMs: targetAt - 10 * 60_000 }).phase).toBe('BRAIN_DUMP_T10')
    expect(deriveGuidance({ plan, settings: s, local: emptyLocal(), nowMs: targetAt }).phase).toBe('BEDTIME_HARD_CUT')
  })
  it('setzt automatische Kernschritte nur als fällige Auswahl und niemals als erledigt', () => {
    const s = settings(); s.guidance = { ...s.guidance, autoZombie: true, autoZombieAfterSeconds: 60 }
    const local = emptyLocal(); local.guidance = { receipts: [], days: { [date]: { morningActivatedAt: at(420) } } }
    const plan = buildDayPlan({ date, settings: s })
    expect(deriveGuidance({ plan, log: day(), settings: s, local, nowMs: at(421) }).autoZombieDue).toBe(true)
    expect(day().steps).toEqual({})
    local.guidance.days[date]!.firstInteractionAt = at(420) + 1000
    expect(deriveGuidance({ plan, settings: s, local, nowMs: at(421) }).autoZombieDue).toBe(false)
  })
  it('lässt zukünftige importierte Fakten weder die aktuelle Nacht lösen noch echte Interaktion vortäuschen', () => {
    const s = settings(); s.guidance = { ...s.guidance, autoZombie: true }
    const next = addDays(date, 1); const local = emptyLocal()
    local.guidance = { receipts: [], days: {
      [date]: { nightLockedAt: at(1380) },
      [next]: { morningActivatedAt: at(420, next), morningCompletedAt: at(800, next), firstInteractionAt: at(800, next) },
    } }
    const value = deriveGuidance({ plan: buildDayPlan({ date: next, settings: s }), local, settings: s, nowMs: at(421, next) })
    expect(value).toMatchObject({ lockEnforced: true, autoZombieDue: true, morningCompleted: false })
  })
  it('gibt einem tatsächlich klingelnden Wecker Vorrang und nie einer Uhrzeit einen Klingelstatus', () => {
    const s = settings(); const plan = buildDayPlan({ date, settings: s })
    expect(deriveGuidance({ plan, settings: s, local: emptyLocal(), nowMs: at(420), alarm: { ringing: true, kind: 'main' } }).phase).toBe('ALARM_RINGING')
    expect(deriveGuidance({ plan, settings: s, local: emptyLocal(), nowMs: at(420) }).phase).toBe('MORNING_PENDING')
  })
})
