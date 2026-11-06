import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { morningNeed } from '../sleep'
import type { Commitment } from '../types'
import { buildDayPlan } from './plan'

const date = '2026-11-09'
function settings() {
  const s = defaultSettings(date)
  s.sport.days = s.sport.days.map(() => false)
  s.work[0] = { ...s.work[0]!, start: 480, durationMin: 480, pauseMin: 60 }
  s.commute.minutes = 35
  return s
}
const visit = (patch: Partial<Commitment> = {}): Commitment => ({ id: 'fixed', date, label: 'Fester Termin', context: 'personal', commitment: 'hard', start: 18 * 60, end: 19 * 60, locationKind: 'onsite', placeLabel: 'Bekannter Ort', travelMin: 45, arrivalBufferMin: 5, prepMin: 0, ...patch })

describe('Ein gemeinsamer Plan auch bei Krankheit und knapper Heimfahrt', () => {
  it('bewahrt feste Vor-Ort-/Remote-Termine, Weg und Morgenbedarf im minimalen Krank-Modus', () => {
    const s = settings()
    const original = structuredClone(s)
    const commitments = [visit({ start: 9 * 60, end: 10 * 60 }), visit({ id: 'remote', label: 'Remote-Termin', start: 7 * 60, end: 7 * 60 + 30, locationKind: 'remote', prepMin: 5 }), visit({ id: 'cancelled', status: 'cancelled' })]
    const plan = buildDayPlan({ date, settings: s, override: { dayType: 'sick' }, commitments })
    expect(plan.legs?.map((leg) => leg.commitment.id)).toEqual(['remote', 'fixed'])
    expect(plan.blocks.filter((block) => block.kind === 'commitment')).toHaveLength(2)
    expect(plan.blocks.some((block) => block.kind === 'travel')).toBe(true)
    expect(plan.hardTimes.some((time) => time.key === 'commitment' && time.at === 7 * 60)).toBe(true)
    expect(morningNeed(plan, s)).toMatchObject({ label: 'Remote-Termin', readyAt: 7 * 60 })
    expect(plan.blocks.some((block) => block.kind === 'work')).toBe(false)
    expect(plan.blocks.find((block) => block.routine === 'morning')?.steps?.every((step) => ['teeth', 'face'].includes(step.tag ?? ''))).toBe(true)
    expect(s).toEqual(original)
    expect(commitments[0]?.status).toBeUndefined()
  })

  it('erfindet bei offenem Abendtermin auch im Krank-Modus keine Rückkehr für die Routine', () => {
    const plan = buildDayPlan({ date, settings: settings(), override: { dayType: 'sick' }, commitments: [visit({ end: undefined, thenTo: 'next' })] })
    expect(plan.pendingEvening).toBe(true)
    expect(plan.blocks.some((block) => block.routine === 'evening')).toBe(false)
    expect(plan.legs?.[0]?.commitment.end).toBeUndefined()
  })

  it('erzeugt im Krank-Modus aus einem bewusst offenen Abend keinen03:59-Bettanker', () => {
    const plan = buildDayPlan({ date, settings: settings(), override: { dayType: 'sick', lateUntil: 'open' } })
    expect(plan.openEnd).toBe(true)
    expect(plan.blocks.some((block) => block.kind === 'bed')).toBe(false)
    expect(plan.hardTimes.some((time) => time.key === 'bed' || time.key === 'pc-stop')).toBe(false)
  })

  it('bleibt für einen knappen Anschlusstermin am Büro, wenn zuhause erst nach der nötigen Abfahrt erreicht wäre', () => {
    const plan = buildDayPlan({ date, settings: settings(), commitments: [visit()] })
    expect(plan.workEnd).toBe(17 * 60)
    expect(plan.legs?.[0]).toMatchObject({ fromKey: 'office', leave: 17 * 60 + 10 })
    expect(plan.blocks.some((block) => block.id === `${date}:commute-home`)).toBe(false)
    expect(plan.legs?.[0]?.commitment.start).toBe(18 * 60)
  })

  it('erhält den ausdrücklich gewählten Start zuhause und benennt die unmögliche Überschneidung mit dem Heimweg', () => {
    const c = visit({ originPlaceId: 'home' })
    const plan = buildDayPlan({ date, settings: settings(), commitments: [c] })
    expect(plan.legs?.[0]?.fromKey).toBe('home')
    expect(plan.conflicts?.some((text) => text.includes('Heimweg'))).toBe(true)
    expect(c.start).toBe(18 * 60)
  })

  it('benennt Vorbereitung vor Feierabend und einen Remote-Termin während des Heimwegs', () => {
    const prep = buildDayPlan({ date, settings: settings(), commitments: [visit({ travelMin: 40, prepMin: 30 })] })
    expect(prep.legs?.[0]?.leave).toBe(17 * 60 + 15)
    expect(prep.conflicts?.some((text) => text.includes('Vorbereitung'))).toBe(true)
    const remote = buildDayPlan({ date, settings: settings(), commitments: [visit({ locationKind: 'remote', start: 17 * 60 + 20, end: 18 * 60, prepMin: 0 })] })
    expect(remote.conflicts?.some((text) => text.includes('Heimweg'))).toBe(true)
    expect(remote.workEnd).toBe(17 * 60)
  })
})
