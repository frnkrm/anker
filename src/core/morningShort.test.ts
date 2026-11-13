import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { morningShortOffer } from './morningShort'
import { buildDayPlan } from './planner'
import { zonedToUtc } from './time'
import type { DayLog, DayOverride, StepResult } from './types'

const DATE = '2026-11-02'
const time = (minute = 502) => zonedToUtc(DATE, minute)
function settings() {
  const s = defaultSettings(DATE)
  s.anchor = { ...s.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  s.work[0] = { ...s.work[0]!, start: 540, homeOffice: false }
  s.commute.minutes = 20; s.commute.bufferMin = 10
  s.sport.days = s.sport.days.map(() => false)
  s.routines.morning = [
    { id: 'first', title: 'Frühstück', minutes: 10, minimal: { title: 'Banane mitnehmen', minutes: 2 } },
    { id: 'second', title: 'Schlüssel nehmen', minutes: 5 },
  ]
  s.routines.evening = [{ id: 'evening', title: 'Abend', minutes: 20, minimal: { title: 'Kurz', minutes: 1 } }]
  return s
}
const plan = (override: DayOverride = {}) => buildDayPlan({ date: DATE, settings: settings(), override })
const log = (steps: Record<string, StepResult> = {}): DayLog => ({ date: DATE, steps, override: {} })

describe('Bewusstes Kurzmodusangebot', () => {
  it('bietet bestehende Varianten erst bei Zeitmangel an, ohne Eingaben zu verändern', () => {
    const p = plan(), facts = log(), before = structuredClone({ p, facts })
    expect(morningShortOffer(p, facts, time(490))).toBeUndefined()
    const offer = morningShortOffer(p, facts, time())!
    expect(offer).toMatchObject({ preparationMin: 15, shortPreparationMin: 7, savingMin: 8, stillTight: false,
      changes: [{ id: 'first', title: 'Frühstück', shortTitle: 'Banane mitnehmen', minutes: 10, shortMinutes: 2 }] })
    expect({ p, facts }).toEqual(before)
  })
  it('verspricht bei weiterhin zu wenig Zeit keine passende Abfahrt', () => {
    expect(morningShortOffer(plan(), log(), time(509))?.stillTight).toBe(true)
  })
  it.each(['done', 'minimal', 'skipped', 'not-needed'] as const)('kürzt keinen bereits entschiedenen Schritt (%s)', result => {
    expect(morningShortOffer(plan(), log({ 'morning:first': result }), time(507))).toBeUndefined()
    expect(morningShortOffer(plan(), log({ 'morning:second': result }), time(505))?.changes.map(c => c.id)).toEqual(['first'])
  })
  it('bietet an und nach der Abfahrt, nach Losgehen und am falschen Plantag nichts an', () => {
    const p = plan()
    for (const at of [time(510), time(515), zonedToUtc('2026-11-03', 500)]) expect(morningShortOffer(p, log(), at)).toBeUndefined()
    expect(morningShortOffer(p, { ...log(), leftAt: time() }, time())).toBeUndefined()
  })
  it('unterdrückt das Angebot bei unbekannten Zeiten oder fehlender echter Ersparnis', () => {
    const p = plan()
    p.blocks.find(b => b.routine === 'morning')!.steps![0]!.minutes = Number.NaN
    expect(morningShortOffer(p, log(), time())).toBeUndefined()
    const noSaving = plan()
    noSaving.blocks.find(b => b.routine === 'morning')!.steps![0]!.minimal!.minutes = 15
    expect(morningShortOffer(noSaving, log(), time())).toBeUndefined()
  })
  it('macht Homeoffice nicht zu einer Abfahrt und Nachmittag nicht zum Morgen', () => {
    const s = settings(); s.work[0]!.homeOffice = true
    expect(morningShortOffer(buildDayPlan({ date: DATE, settings: s }), log(), time())).toBeUndefined()
    const p = plan(); p.blocks = p.blocks.filter(b => b.routine !== 'morning')
    expect(morningShortOffer(p, log(), time())).toBeUndefined()
  })
  it('ändert die Revision bei neuem Plan oder neuer Erledigung, nicht bei bloßem Uhrtick', () => {
    const p = plan(), first = morningShortOffer(p, log(), time())!
    expect(morningShortOffer(p, log(), time(503))?.revision).toBe(first.revision)
    expect(morningShortOffer(p, log({ 'morning:second': 'done' }), time(503))?.revision).not.toBe(first.revision)
    expect(morningShortOffer(plan({ workStart: 541 }), log(), time(503))?.revision).not.toBe(first.revision)
  })
  it('bewahrt im Kurzmodus alle Schritte, harte Zeiten, Abend und globale Einstellungen', () => {
    const p = plan(), short = plan({ shortMorning: true })
    const morning = (p: ReturnType<typeof plan>) => p.blocks.find(b => b.routine === 'morning')!
    expect(morning(short).steps!.map(s => s.id)).toEqual(morning(p).steps!.map(s => s.id))
    expect(morning(short).steps!.map(s => s.useMinimal)).toEqual([true, false])
    expect(short.hardTimes).toEqual(p.hardTimes)
    expect(short.blocks.find(b => b.routine === 'evening')).toEqual(p.blocks.find(b => b.routine === 'evening'))
    expect(morningShortOffer(short, { ...log(), override: { shortMorning: true } }, time())).toBeUndefined()
  })
})
