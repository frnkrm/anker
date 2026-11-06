import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildDayPlan } from './planner'
import { nextAction, openWork, suggestTaskWindow, type NextInput } from './support'
import { taskIsActionable } from './tasks'
import { zonedToUtc } from './time'
import type { DayLog, InboxItem, WorkTask } from './types'

const date = '2026-11-02'
const settings = defaultSettings(date)
const plan = buildDayPlan({ date, settings })
const log: DayLog = { date, override: {}, wakeAt: 1, leftAt: 1, steps: Object.fromEntries(settings.routines.morning.map((step) => [`morning:${step.id}`, 'done'])) }
const work = (id: string, patch: Partial<WorkTask> = {}): WorkTask => ({ id, title: id, createdAt: 1, ...patch })
const task = (patch: Partial<InboxItem> = {}): InboxItem => ({ id: 'private', text: 'Privat', status: 'task', taskDate: date, createdAt: 1, ...patch })
const input = (m = 600, patch: Partial<NextInput> = {}): NextInput => ({ plan, log, m, nowMs: zonedToUtc(date, m), settings, inbox: [], work: [], ...patch })

describe('Gemeinsame nächste Aufgabenhandlung', () => {
  it('hält aktive wichtige Arbeit stabil, solange keine unmittelbar notwendige Frist vorgeht', () => {
    const now = zonedToUtc(date, 600)
    const active = work('läuft', { state: 'active', priority: 'high', nextStep: 'Tabelle öffnen' })
    const optional = work('neu', { priority: 'high', deadline: now + 35 * 60_000, estimateMin: 10 })
    expect(nextAction(input(600, { work: [optional, active] })).action).toMatchObject({ type: 'worktask', task: { id: 'läuft' } })
    expect(nextAction(input(600, { work: [{ ...optional, deadline: now + 5 * 60_000 }, active] })).action).toMatchObject({ type: 'worktask', task: { id: 'neu' } })
  })

  it('ordnet Nicht-nötig und abgesagt nicht als offene Prioritäten ein', () => {
    expect(openWork([work('aus', { state: 'cancelled' }), work('nicht', { state: 'not-needed' }), work('hoch', { priority: 'high' }), work('normal')]).map((item) => item.id)).toEqual(['hoch', 'normal'])
  })

  it('sieht eine erledigte oder gelöschte Referenz nicht als Wiedereinstieg an', () => {
    const resume = { kind: 'work' as const, refId: 'weg', title: 'Alter Text', at: zonedToUtc(date, 100) }
    expect(nextAction(input(600, { resume })).action.type).not.toBe('resume')
    expect(nextAction(input(600, { resume, work: [work('weg', { done: true })] })).action.type).not.toBe('resume')
  })

  it('berücksichtigt frühesten Start, bewusste Rückstellung und die explizite Startentscheidung', () => {
    const now = zonedToUtc(date, 600)
    expect(taskIsActionable(work('future', { earliestStart: now + 1000 }), now)).toBe(false)
    expect(taskIsActionable(work('later', { state: 'deferred' }), now)).toBe(false)
    expect(taskIsActionable(work('chosen', { state: 'active', earliestStart: now + 1000 }), now)).toBe(true)
    expect(nextAction(input(600, { work: [work('future', { earliestStart: now + 1000 })] })).action.type).toBe('work')
  })

  it('behauptet in einem kurzen aktuellen Fenster keine Passung für die ganze Aufgabe', () => {
    const free = plan.blocks.find((block) => (block.kind === 'free' || block.kind === 'evening-plan') && block.end - block.start > 15)!
    const m = free.end - 3
    const window = suggestTaskWindow(plan, 60, m)
    expect(window).toMatchObject({ start: m, end: free.end, fits: false })
    const result = nextAction(input(m, { inbox: [task({ estimateMin: 60, nextStep: 'Die Unterlage öffnen' })] }))
    expect(result.action).toMatchObject({ type: 'task', title: 'Die Unterlage öffnen', focusMinutes: 2 })
    expect(result.reason).toContain('eng')
    expect(result.alternative).toBeDefined()
    expect(result.estimatedMin).toBeLessThanOrEqual(3)
  })

  it('prüft den gewählten Kontext und wenig Energie ohne Standortmessung', () => {
    const p = input(600, { context: 'home', work: [work('draußen', { context: 'errand', priority: 'high' }), work('daheim', { context: 'home' })] })
    expect(nextAction(p).action).toMatchObject({ type: 'worktask', task: { id: 'daheim' } })
    const low = { ...p, log: { ...log, override: { mode: 'wenig-energie' as const } }, work: [work('viel', { energy: 'high' }), work('klein', { energy: 'low' })] }
    expect(nextAction(low).action).toMatchObject({ type: 'worktask', task: { id: 'klein' } })
  })

  it('überlagert eine aktuelle Abendroutine nicht mit einem schon vergangenen Aufgabenfenster', () => {
    const evening = plan.blocks.find((block) => block.routine === 'evening')!
    const result = nextAction(input(evening.start + 1, { inbox: [task()] }))
    expect(result.action).toMatchObject({ type: 'step', routine: 'evening' })
  })
})
