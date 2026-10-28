import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { activePlanDate, nowView } from './now'
import { buildDayPlan } from './planner'
import { todayBerlin, zonedToUtc } from './time'
import type { DayLog } from './types'

const MON = '2026-11-02'
const s = defaultSettings('2026-11-01')
const plan = buildDayPlan({ date: MON, settings: s })
const log = (patch: Partial<DayLog> = {}): DayLog => ({ date: MON, override: {}, steps: {}, ...patch })

describe('nowView', () => {
  it('nachts: Schlafen', () => {
    expect(nowView(plan, undefined, 300).action.type).toBe('sleep')
  })
  it('zur Weckzeit: Aufstehen', () => {
    expect(nowView(plan, undefined, plan.wake).action.type).toBe('wake')
  })
  it('nach dem Aufstehen: erster Routineschritt', () => {
    const v = nowView(plan, log({ wakeAt: 1 }), plan.wake + 2)
    expect(v.action).toMatchObject({ type: 'step', routine: 'morning', index: 0 })
    expect(v.hard!.key).toBe('leave')
  })
  it('erledigte Schritte werden übersprungen', () => {
    const v = nowView(plan, log({ wakeAt: 1, steps: { 'morning:water': 'done', 'morning:move': 'minimal' } }), plan.wake + 5)
    expect(v.action).toMatchObject({ type: 'step', index: 2 })
  })
  it('Routine fertig → Losgehen', () => {
    const steps = Object.fromEntries(plan.blocks.find((b) => b.routine === 'morning')!.steps!.map((x) => [`morning:${x.id}`, 'done' as const]))
    expect(nowView(plan, log({ wakeAt: 1, steps }), plan.leave! - 5).action.type).toBe('leave')
  })
  it('tagsüber: Arbeit', () => {
    expect(nowView(plan, log({ wakeAt: 1, leftAt: 1 }), 12 * 60).action.type).toBe('work')
  })
  it('abends: Abendroutine vor Freizeit', () => {
    const r = plan.blocks.find((b) => b.routine === 'evening')!
    expect(nowView(plan, log({ wakeAt: 1, leftAt: 1 }), r.start).action).toMatchObject({ type: 'step', routine: 'evening' })
  })
  it('Freizeit mit Verlängerungs-Option', () => {
    const steps = Object.fromEntries(plan.blocks.find((b) => b.routine === 'evening')!.steps!.map((x) => [`evening:${x.id}`, 'done' as const]))
    const v = nowView(plan, log({ wakeAt: 1, leftAt: 1, steps }), plan.pcStop - 10)
    expect(v.action).toMatchObject({ type: 'free', canExtend: true })
  })
  it('PC-Stopp, dann Bett', () => {
    const steps = Object.fromEntries(plan.blocks.find((b) => b.routine === 'evening')!.steps!.map((x) => [`evening:${x.id}`, 'done' as const]))
    expect(nowView(plan, log({ wakeAt: 1, leftAt: 1, steps }), plan.pcStop + 1).action.type).toBe('pcoff')
    expect(nowView(plan, log({ wakeAt: 1, leftAt: 1, steps, pcOffAt: 1 }), plan.bed).action.type).toBe('bed')
  })
  it('Countdown-Balken zwischen zwei harten Zeiten', () => {
    const v = nowView(plan, log({ wakeAt: 1 }), (plan.wake + plan.leave!) / 2)
    expect(v.elapsed).toBeCloseTo(0.5, 1)
  })
})

describe('activePlanDate', () => {
  it('bis 4 Uhr gilt der Vortag', () => {
    expect(activePlanDate(zonedToUtc('2026-11-03', 30), todayBerlin)).toBe(MON)
    expect(activePlanDate(zonedToUtc('2026-11-03', 300), todayBerlin)).toBe('2026-11-03')
  })
})
