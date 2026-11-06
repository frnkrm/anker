import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { restoreCommitments, routineCoverage, validPlanUndo } from './flexible'
import { nowView } from './now'
import { buildDayPlan, extendPcStop } from './planner'
import { nextAction } from './support'
import { zonedToUtc } from './time'
import type { Commitment, DayLog } from './types'

const date = '2026-11-06'
const yesterday = '2026-11-05'
const settings = defaultSettings(date)
const log = (patch: Partial<DayLog> = {}): DayLog => ({ date, steps: {}, override: {}, ...patch })

describe('Tagesbedarf aus vorhandenen echten Handlungen', () => {
  const ruleSettings = { ...settings, routineLinks: [{ eveningStepId: 'prep', morningStepId: 'dress' }] }
  it('nennt Quelle und gültigen Tag und setzt niemals einen morgendlichen Erledigtstatus', () => {
    const days = { [yesterday]: log({ date: yesterday, steps: { 'evening:prep': 'done' } }) }
    const original = structuredClone(days)
    const dress = routineCoverage(date, ruleSettings, days).find((row) => row.step.id === 'dress')!
    expect(dress).toMatchObject({ covered: true, overridden: false, source: { kind: 'previous-evening', date: yesterday, stepId: 'prep', result: 'done' } })
    expect(days).toEqual(original)
    expect(routineCoverage('2026-11-07', ruleSettings, days).find((row) => row.step.id === 'dress')?.covered).toBe(false)
  })

  it('lässt die persönliche Regel genau für den ausgewählten Morgen übersteuern', () => {
    const days = { [yesterday]: log({ date: yesterday, steps: { 'evening:prep': 'minimal' } }), [date]: log({ override: { uncoveredSteps: ['morning:dress'] } }) }
    expect(routineCoverage(date, ruleSettings, days).find((row) => row.step.id === 'dress')).toMatchObject({ covered: false, overridden: true, source: { result: 'minimal' } })
    expect(ruleSettings.routineLinks).toHaveLength(1)
  })

  it('hält nicht bestätigt, übersprungen und heute nicht nötig von tatsächlicher Versorgung getrennt', () => {
    for (const status of [undefined, 'skipped', 'not-needed'] as const) {
      const days = { [yesterday]: log({ date: yesterday, steps: status ? { 'evening:prep': status } : {} }) }
      expect(routineCoverage(date, ruleSettings, days).find((row) => row.step.id === 'dress')?.covered).toBe(false)
    }
    expect(routineCoverage(date, { ...ruleSettings, routines: { ...settings.routines, evening: [] } }, { [yesterday]: log({ date: yesterday, steps: { 'evening:prep': 'done' } }) }).find((row) => row.step.id === 'dress')?.covered).toBe(false)
  })
})

describe('Freie Abende und klare Rückkehr', () => {
  it('erhält mehrfache historische Verlängerungen und erlaubt freie neue Endzeiten ohne15-Minuten-Limit', () => {
    const first = extendPcStop({}, 30)!
    const second = extendPcStop(first, 60)!
    expect(second.pcStopExtendMin).toBe(90)
    const plan = buildDayPlan({ date, settings, override: second })
    expect(plan.pcStop).toBeGreaterThanOrEqual(settings.pcStop + 90)
    expect(plan.bed).toBeGreaterThanOrEqual(plan.pcStop)
    expect(extendPcStop({}, -5)).toBeNull()
  })

  it('zeigt bei offenem Ende keine erfundene Freizeitgrenze', () => {
    const plan = buildDayPlan({ date, settings, override: { lateUntil: 'open' } })
    const free = plan.blocks.find((block) => block.kind === 'free')!
    const result = nowView(plan, log({ steps: Object.fromEntries(settings.routines.evening.map((step) => [`evening:${step.id}`, 'done' as const])) }), free.start + 1)
    expect(result.action).toMatchObject({ type: 'free', sub: 'Ohne festes Ende', canExtend: true })
  })

  it('verschiebt nur die Rückfrage und erfindet weder Rückkehr noch Routineerledigung', () => {
    const state = log({ override: { routineAt: { evening: 'return' }, returnCheckAfter: 21 * 60 } })
    const plan = buildDayPlan({ date, settings, override: state.override })
    const input = { plan, log: state, settings, inbox: [], work: [], m: 20 * 60, nowMs: zonedToUtc(date, 20 * 60) }
    expect(nextAction(input).action.type).toBe('return-later')
    expect(nextAction({ ...input, m: 21 * 60, nowMs: zonedToUtc(date, 21 * 60) }).action.type).toBe('return-check')
    expect(plan.pendingEvening).toBe(true)
    expect(state.override.backAt).toBeUndefined()
    expect(state.steps).toEqual({})
  })
})

describe('Private Rücknahmebasis', () => {
  const existing: Commitment = { id: 'original', date, label: 'Alt', context: 'social', commitment: 'soft', start: 1200 }
  it('restauriert nur unbegonnene Tagesplanung und bewahrt andere Tage samt Referenzen', () => {
    const begun = { ...existing, id: 'begun', leftAt: 0 }
    const session = { ...existing, id: 'session' }
    const other = { ...existing, id: 'other', date: '2026-11-07' }
    const result = restoreCommitments(date, [begun, session, other], [], [{ id: 'work', date, startAt: 1, breaks: [], kind: 'incident', commitmentId: session.id }])
    expect(result).toEqual([begun, session, other])
  })
  it('nimmt alte fehlende Zusatzfelder an und weist eine kaputte private Rücknahme zurück', () => {
    expect(validPlanUndo(undefined)).toBe(true)
    expect(validPlanUndo({ [date]: { at: 0, commitments: [existing] } })).toBe(true)
    for (const bad of [null, { [date]: { at: NaN, commitments: [] } }, { [date]: { at: 0, commitments: [{ ...existing, date: yesterday }] } }, { '2026-02-31': { at: 0, commitments: [] } }]) expect(validPlanUndo(bad)).toBe(false)
  })
})
