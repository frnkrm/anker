import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { nextAction } from '../support'
import { zonedToUtc } from '../time'
import type { DayLog, Settings } from '../types'
import { guidancePreferences } from './settings'
import { guidanceNightVisible, transitionHint } from './transitions'

const date = '2026-11-13'
const settings = defaultSettings(date)
settings.anchor.manual = { wake: true, pcStop: true, bed: true }
settings.anchor.wake = 420; settings.pcStop = 1350; settings.bed = 1380
settings.sport.days = settings.sport.days.map(() => false)
const plan = buildDayPlan({ date, settings })
const log: DayLog = { date, override: {}, wakeAt: zonedToUtc(date, 420), steps: {} }
const done = (routine: 'morning' | 'evening') => Object.fromEntries(plan.blocks.find(b => b.routine === routine)!.steps!.map(s => [`${routine}:${s.id}`, 'done' as const]))
const read = (m: number, facts = log, p = plan, s = settings) => nextAction({ plan: p, log: facts, settings: s, m, nowMs: zonedToUtc(date, m), inbox: [], work: [] }).action

describe('F-006: Übergänge bleiben beim vorhandenen Planer', () => {
  it('zeigt den bestehenden Nachteinstieg nur bei der gewählten Begleitung und passenden Phase', () => {
    const night = { phase: 'BEDTIME_HARD_CUT' as const, date, lockEnforced: false, autoZombieDue: false, morningCompleted: false, brainDumpIds: [] }
    const options = { ...guidancePreferences(), eveningEscalation: true, bedtimeQr: true }
    expect(guidanceNightVisible(night, options)).toBe(false)
    expect(guidanceNightVisible(night, { ...options, enabled: true })).toBe(true)
    expect(guidanceNightVisible({ ...night, phase: 'DAY_ACTIVE' }, { ...options, enabled: true })).toBe(false)
    expect(guidanceNightVisible({ ...night, phase: 'NIGHT_LOCK' }, { ...guidancePreferences(), enabled: true })).toBe(false)
  })
  it('bietet einen beendeten Morgenblock nicht erneut als nächste Tätigkeit an', () => {
    const facts = { ...log, steps: done('morning') }
    const p = buildDayPlan({ date, settings, override: { homeOffice: true } })
    const m = p.blocks.find(b => b.routine === 'morning')!.start + 1
    const next = read(m, facts, p)
    expect(next.type).toBe('info')
    expect(next.title).toBe('Kurz durchatmen')
    expect(read(m, log, p).type).toBe('step')
  })
  it('wechselt nach dem letzten Abendschritt zu Freizeit, PC-Stopp und Bett ohne Uhrzeit-Häkchen', () => {
    const facts = { ...log, steps: { ...done('morning'), ...done('evening') } }
    const before = structuredClone(facts)
    const m = plan.blocks.find(b => b.routine === 'evening')!.start + 1
    expect(read(m, facts).type).toBe('free')
    const stop = read(plan.pcStop, facts)
    expect(stop.type).toBe('pcoff')
    expect(transitionHint(stop, plan, settings)).toContain('selbst ausgeschaltet')
    expect(read(plan.pcStop + 5, facts).type).toBe('pcoff')
    expect(read(plan.pcStop + 5, { ...facts, pcOffAt: zonedToUtc(date, plan.pcStop) })).toMatchObject({ type: 'info', title: 'Runterkommen' })
    expect(read(plan.bed, facts).type).toBe('bed')
    expect(facts).toEqual(before)
  })
  it('erhält entfallene Schritte als Entfall und verwendet dasselbe freie Folgeverhalten', () => {
    const facts = { ...log, steps: Object.fromEntries(Object.keys(done('evening')).map(key => [key, 'not-needed' as const])) }
    expect(read(plan.blocks.find(b => b.routine === 'evening')!.start + 1, facts).type).toBe('free')
    expect(Object.values(facts.steps).every(value => value === 'not-needed')).toBe(true)
  })
  it('verwirft durch Umplanung überholte PC-Stopp-Hinweise und erfindet im offenen Abend keine Grenze', () => {
    const facts = { ...log, steps: { ...done('morning'), ...done('evening') }, override: { lateUntil: 'open' as const } }
    const p = buildDayPlan({ date, settings, override: facts.override })
    const next = read(plan.pcStop + 1, facts, p)
    expect(next.type).toBe('free')
    expect(transitionHint(next, p, settings)).toContain('offen')
    expect(transitionHint(next, p, settings)).not.toMatch(/\d\d:\d\d/)
    const extended = buildDayPlan({ date, settings, override: { lateUntil: plan.bed + 60 } })
    expect(read(plan.pcStop + 1, { ...facts, override: { lateUntil: plan.bed + 60 } }, extended).type).toBe('free')
  })
  it('nutzt einen freiwillig gewählten ruhigen Handgriff ausschließlich nach der PC-Rückmeldung', () => {
    const s: Settings = { ...settings, support: { ...settings.support, windDown: { enabled: true, at: 1260, activity: 'Eine Seite lesen' } } }
    const facts = { ...log, steps: done('evening'), pcOffAt: zonedToUtc(date, plan.pcStop) }
    expect(transitionHint(read(plan.pcStop + 1, facts), plan, s)).toBe('Eine Seite lesen')
    expect(transitionHint({ type: 'info', title: 'Runterkommen', sub: 'Privater Termin', block: { id: 'event', kind: 'event', title: 'Runterkommen', start: 0, end: 1 } }, plan, s)).toBe('Privater Termin')
    expect(transitionHint(read(plan.pcStop + 1, facts), plan, settings)).toContain('Bett')
  })
})
