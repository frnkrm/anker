import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { createCountdown, pauseCountdown, resumeCountdown, type FocusSession, type FocusTarget } from './focus'
import { focusCompanion, type CompanionInput } from './focusCompanion'
import { buildDayPlan } from './planner'
import { zonedToUtc } from './time'
import type { WorkTask } from './types'

const date = '2026-11-13', now = zonedToUtc(date, 600)
const settings = defaultSettings(date)
settings.sport.days = settings.sport.days.map(() => false)
settings.routines.morning = [{ id: 'first', title: 'Privater Schritt', minutes: 5, minimal: { title: 'Kleine Variante', minutes: 2 } }, { id: 'second', title: 'Danach', minutes: 5 }]
const plan = () => buildDayPlan({ date, settings })
const target = { kind: 'work' as const, id: 'work', partId: 'b' }
const work: WorkTask = { id: 'work', title: 'PRIVATE-TITLE', nextStep: 'PRIVATE-NEXT', resumeNote: 'PRIVATE-NOTE', state: 'active', createdAt: now, subtasks: [{ id: 'a', title: 'Vorher' }, { id: 'b', title: 'PRIVATE-PART' }] }
const focus: FocusSession = { id: 'focus', target, timer: createCountdown(300, now) }
const input = (patch: Partial<CompanionInput> = {}): CompanionInput => ({ plan: plan(), nowMs: now, local: { focus }, inbox: [], work: [work], ...patch })
const read = (patch: Partial<CompanionInput> = {}, visible: FocusTarget = target) => focusCompanion(input(patch), visible)

describe('F-009: bestehender Fokus ist alleiniger Kontext- und Zeitbesitzer', () => {
  it('ist eine reine neutrale Projektion ohne private Titel, Notizen oder neue Zeitdaten', () => {
    const source = input(), before = structuredClone(source)
    const view = focusCompanion(source, target)
    expect(view?.status).toBe('running')
    expect(Object.keys(view!)).toEqual(['key', 'status'])
    expect(JSON.stringify(view)).not.toContain('PRIVATE-')
    expect(source).toEqual(before)
  })
  it('übernimmt weder fremde aktuelle Ziele noch alte Merker oder Archivtimer', () => {
    expect(read({}, { ...target, partId: 'a' })).toBeUndefined()
    expect(read({ local: { focusHistory: [focus], resume: { kind: 'work', refId: 'work', partId: 'b', title: 'Alt', at: now } } })).toBeUndefined()
    expect(read({ local: { focus: { ...focus, target: { kind: 'work', id: 'removed' } }, resume: { kind: 'work', refId: 'work', partId: 'b', title: 'Alt', at: now } } }, { kind: 'work', id: 'removed' })).toBeUndefined()
  })
  it.each([{ done: true }, { state: 'cancelled' as const }, { state: 'not-needed' as const }, { state: 'deferred' as const, deferredUntil: now + 60_000 }, { state: 'pending' as const, earliestStart: now + 60_000 }])('schließt überholte Aufgaben aus: %j', patch => {
    expect(read({ work: [{ ...work, ...patch }] })).toBeUndefined()
  })
  it('erfindet für entfernte/erledigte Teile, Notizen und fehlende Aufgaben keinen Ersatz', () => {
    expect(read({ work: [] })).toBeUndefined()
    expect(read({ work: [{ ...work, subtasks: [] }] })).toBeUndefined()
    expect(read({ work: [{ ...work, subtasks: [{ id: 'b', title: 'Fertig', doneAt: now }] }] })).toBeUndefined()
    expect(read({ local: { focus: { ...focus, target: { kind: 'task', id: 'note' } } }, inbox: [{ id: 'note', text: 'Notiz', status: 'open', createdAt: now }] }, { kind: 'task', id: 'note' })).toBeUndefined()
  })
  it('respektiert Arbeitsruhe; eine private Aufgabe bleibt unabhängig davon nutzbar', () => {
    expect(read({ workQuiet: true })).toBeUndefined()
    const privateTarget = { kind: 'task' as const, id: 'private' }
    expect(read({ workQuiet: true, local: { focus: { ...focus, target: privateTarget } }, inbox: [{ id: 'private', text: 'Privat', status: 'task', createdAt: now }] }, privateTarget)?.status).toBe('running')
  })
  it('trennt Pause, bewusste Wiederaufnahme, Zeitablauf und neues Zeitfenster', () => {
    const running = read()!
    const paused = pauseCountdown(focus.timer, now + 30_000)
    const pause = read({ local: { focus: { ...focus, timer: paused } }, nowMs: now + 60_000 })!
    const resumed = read({ local: { focus: { ...focus, timer: resumeCountdown(paused, now + 120_000) } }, nowMs: now + 120_000 })!
    const expired = read({ nowMs: now + 300_000 })!
    const next = read({ local: { focus: { ...focus, id: 'new', timer: createCountdown(300, now + 300_000) } }, nowMs: now + 300_000 })!
    expect([running.status, pause.status, resumed.status, expired.status, next.status]).toEqual(['running', 'paused', 'running', 'expired', 'running'])
    expect(new Set([running.key, pause.key, resumed.key, expired.key, next.key]).size).toBe(5)
    expect(read({ nowMs: now + 1000 })?.key).toBe(running.key)
  })
  it('verwirft beschädigte Timer und zukünftige Plan-/Aufgabenreferenzen', () => {
    expect(read({ local: { focus: { ...focus, timer: {} } as FocusSession } })).toBeUndefined()
    expect(read({ nowMs: NaN })).toBeUndefined()
    const privateTarget = { kind: 'task' as const, id: 'private' }
    expect(read({ local: { focus: { ...focus, target: privateTarget } }, inbox: [{ id: 'private', text: 'Privat', status: 'task', taskDate: '2026-11-14', createdAt: now }] }, privateTarget)).toBeUndefined()
  })
  it('übernimmt nur den ersten offenen aktuellen Routinen-/Variantenkontext', () => {
    const routine = { kind: 'routine' as const, date, routine: 'morning' as const, stepId: 'first', minimal: false }
    const f = { ...focus, target: routine }
    expect(read({ local: { focus: f } }, routine)?.status).toBe('running')
    expect(read({ local: { focus: f }, log: { date, steps: { 'morning:first': 'done' }, override: {} } }, routine)).toBeUndefined()
    const changed = plan(); changed.blocks.find(b => b.routine === 'morning')!.steps![0]!.useMinimal = true
    expect(read({ local: { focus: f }, plan: changed }, routine)).toBeUndefined()
    expect(read({ local: { focus: f }, nowMs: zonedToUtc('2026-11-14', 241) }, routine)).toBeUndefined()
  })
})
