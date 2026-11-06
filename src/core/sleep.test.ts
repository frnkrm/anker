import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan } from './planner'
import { morningNeed, wakeProposal } from './sleep'

const MON = '2026-11-02'

describe('Morgenplanung im Homeoffice', () => {
  it('hält die eingestellte Rechnerstart-Zeit vor der Arbeit frei', () => {
    const s = defaultSettings('2026-11-01')
    s.travel.homeOfficeStartupMin = 60
    const p = buildDayPlan({ date: MON, settings: s, override: { homeOffice: true } })
    const morning = p.blocks.find((b) => b.routine === 'morning')!
    const work = p.blocks.find((b) => b.kind === 'work')!

    expect(morning.minimal).toBe(true)
    expect(morning.end).toBeLessThanOrEqual(work.start - 60)
    expect(morningNeed(p, s)!.readyAt).toBe(work.start - 60)
    expect(p.blocks.some((b) => b.kind === 'commute')).toBe(false)
  })

  it('kürzt eine passende Routine ohne Rechnerstart-Puffer nicht', () => {
    const s = defaultSettings('2026-11-01')
    s.travel.homeOfficeStartupMin = 0
    s.travel.activationMin = 0
    s.sport.days = s.sport.days.map(() => false)
    s.routines.morning = [{ id: 'prepare', title: 'Fertig machen', minutes: 60, minimal: { title: 'Kurz fertig machen', minutes: 10 } }]
    const p = buildDayPlan({ date: MON, settings: s, override: { homeOffice: true, wakeOverride: 7 * 60 } })
    const morning = p.blocks.find((b) => b.routine === 'morning')!

    expect(morning.minimal).toBe(false)
    expect(morning.end).toBe(8 * 60)
  })
})

describe('Späteste Weckzeit', () => {
  it('lässt vor der vollen Routine auch Zeit für den geplanten Weg ins Fitnessstudio', () => {
    const s = defaultSettings('2026-11-01')
    s.anchor.wake = 5 * 60
    s.sport.kind = 'gym'
    s.sport.durationMin = 20
    s.sport.gymWayMin = 5
    const early = buildDayPlan({ date: MON, settings: s })
    const proposal = wakeProposal(early, s)!
    const adjusted = buildDayPlan({ date: MON, settings: s, override: { wakeOverride: proposal.wake } })
    const morning = adjusted.blocks.find((b) => b.routine === 'morning')!

    expect(adjusted.blocks.some((b) => b.kind === 'sport')).toBe(true)
    expect(morning.minimal).toBe(false)
    expect(morning.end).toBeLessThanOrEqual(adjusted.leave!)
  })

  it('berechnet die volle Routine unabhängig von einer schon gekürzten Planung', () => {
    const s = defaultSettings('2026-11-01')
    const early = buildDayPlan({ date: MON, settings: s, override: { homeOffice: true } })
    const late = buildDayPlan({ date: MON, settings: s, override: { homeOffice: true, wakeOverride: 7 * 60 } })
    const earlyNeed = morningNeed(early, s)!
    const lateNeed = morningNeed(late, s)!

    expect(early.blocks.find((b) => b.routine === 'morning')!.minimal).toBe(false)
    expect(late.blocks.find((b) => b.routine === 'morning')!.minimal).toBe(true)
    expect(lateNeed.latestWake).toBe(earlyNeed.latestWake)
    expect(lateNeed.latestWakeMinimal).toBe(earlyNeed.latestWakeMinimal)
    expect(lateNeed.latestWakeMinimal).toBeGreaterThan(lateNeed.latestWake)
  })
})
