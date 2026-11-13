import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { createCountdown, pauseCountdown } from './focus'
import { buildDayPlan } from './planner'
import { recoveryPreview } from './recovery'
import { zonedToUtc } from './time'
import type { WorkTask } from './types'

const date = '2026-11-13', now = zonedToUtc(date, 600)
const settings = defaultSettings(date)
settings.sport.days = settings.sport.days.map(() => false)
settings.routines.morning = [{ id: 'first', title: 'Aktueller Schritt', minutes: 5, minimal: { title: 'Kleiner Schritt', minutes: 2 } }, { id: 'second', title: 'Danach', minutes: 5 }]
const plan = () => buildDayPlan({ date, settings })
const task: WorkTask = { id: 'work', title: 'Aktueller Auftrag', nextStep: 'Tabelle öffnen', resumeNote: 'Zweite Zeile', createdAt: now, state: 'paused', subtasks: [{ id: 'a', title: 'Erster Teil' }, { id: 'b', title: 'Neuer Teiltitel' }] }
const point = { kind: 'work' as const, refId: task.id, title: 'Alter Titel', nextStep: 'Alt', at: now }
const focus = { id: 'focus', target: { kind: 'work' as const, id: task.id, partId: 'b' }, timer: pauseCountdown(createCountdown(300, now), now + 60_450) }
const read = (patch: Partial<Parameters<typeof recoveryPreview>[0]> = {}) => recoveryPreview({ plan: plan(), local: { resume: point, focus }, inbox: [], work: [task], nowMs: now + 120_000, ...patch })

describe('F-005: vorhandene Wiederaufnahme sicher projizieren', () => {
  it('zeigt aktuellen Teil, Notiz und pausierte Restzeit statt alter Titel oder eines Elternschritts', () => {
    expect(read()).toMatchObject({ point: { title: task.title, nextStep: 'Neuer Teiltitel', partId: 'b', note: 'Zweite Zeile' }, timer: 'paused', remainingMs: 239_550 })
    expect(read({ nowMs: now + 5 * 3600_000 })?.remainingMs).toBe(239_550)
  })
  it('unterscheidet laufenden, abgelaufenen und fehlenden Timer ohne etwas zu starten', () => {
    expect(read({ local: { focus: { ...focus, timer: createCountdown(300, now) } } })).toMatchObject({ timer: 'running', remainingMs: 180_000 })
    expect(read({ local: { focus: { ...focus, timer: createCountdown(60, now) } } })).toMatchObject({ timer: 'expired', remainingMs: 0 })
    expect(read({ local: { resume: point } })).toMatchObject({ timer: 'none', point: { nextStep: 'Tabelle öffnen' } })
  })
  it.each([{ done: true }, { state: 'cancelled' as const }, { state: 'not-needed' as const }, { state: 'deferred' as const, deferredUntil: now + 86400_000 }, { earliestStart: now + 86400_000 }])('schließt überholte Aufgaben aus (%j)', patch => {
    expect(read({ work: [{ ...task, ...patch }] })).toBeUndefined()
  })
  it('erfindet für entfernte oder erledigte Teile keinen Ersatz; fremde Archivtimer werden nicht zugeordnet', () => {
    const local = { resume: { ...point, partId: 'b' }, focus }
    expect(read({ local, work: [{ ...task, subtasks: [] }] })).toBeUndefined()
    expect(read({ local, work: [{ ...task, subtasks: [{ id: 'b', title: 'Fertig', doneAt: now }] }] })).toBeUndefined()
    expect(read({ work: [] })).toBeUndefined()
    expect(read({ local: { resume: point, focusHistory: [focus] } })?.timer).toBe('none')
    expect(read({ local: { resume: { ...point, partId: 'b' }, focusHistory: [focus] } })?.timer).toBe('paused')
  })
  it('übernimmt keine Notiz eines anderen Teils, wenn kein aktueller Aufgabenmerker vorliegt', () => {
    const view = read({ work: [{ ...task, resumeNote: undefined }], local: { focus, resume: { ...point, partId: 'a', note: 'Nur Teil A' } } })
    expect(view?.point.note).toBeUndefined()
  })
  it('bewahrt die bestehende freiwillige Arbeitsruhe und einen offenen privaten Merker', () => {
    expect(read({ workQuiet: true })).toBeUndefined()
    const inbox = [{ id: 'private', text: 'Privat', status: 'task' as const, createdAt: now }]
    expect(read({ workQuiet: true, inbox, local: { resume: { kind: 'task', refId: 'private', title: 'Privat', at: now } } })?.point.title).toBe('Privat')
  })
  it('verwendet für Routinen den aktuellen offenen Planschritt und seine gewählte Variante', () => {
    const routine = { id: 'routine', target: { kind: 'routine' as const, date, routine: 'morning' as const, stepId: 'first', minimal: true }, timer: focus.timer }
    expect(read({ local: { focus: routine } })).toMatchObject({ point: { title: 'Kleiner Schritt', route: '/fokus/morning' }, timer: 'paused' })
    expect(read({ local: { focus: { ...routine, target: { ...routine.target, date: '2026-11-12' } } } })).toBeUndefined()
    expect(read({ local: { focus: { ...routine, target: { ...routine.target, stepId: 'second' } } } })).toBeUndefined()
    expect(read({ local: { focus: routine }, log: { date, steps: { 'morning:first': 'done' }, override: {} } })).toBeUndefined()
    const changed = plan(); changed.blocks = changed.blocks.filter(b => b.routine !== 'morning')
    expect(read({ local: { focus: routine }, plan: changed })).toBeUndefined()
  })
  it('behandelt Umplanung auf kurze Varianten und alte ungebundene Routinenrouten konservativ', () => {
    const p = plan(); p.blocks.find(b => b.routine === 'morning')!.steps![0]!.useMinimal = true
    const f = { id: 'routine', target: { kind: 'routine' as const, date, routine: 'morning' as const, stepId: 'first', minimal: false }, timer: focus.timer }
    expect(read({ plan: p, local: { focus: f } })).toBeUndefined()
    expect(read({ local: { resume: { kind: 'step', title: 'Alt', route: '/fokus/morning', at: now } } })).toBeUndefined()
  })
  it('ändert weder Plan, Timer, Aufgaben noch gespeicherte Merker und zeigt keinen vergangenen Plantag', () => {
    const input = { plan: plan(), local: { resume: point, focus }, inbox: [], work: [task], nowMs: now }
    const before = structuredClone(input)
    recoveryPreview(input)
    expect(input).toEqual(before)
    expect(read({ nowMs: zonedToUtc('2026-11-14', 300) })).toBeUndefined()
  })
  it('folgt vor 04:00 derselben ausdrücklich durch einen Wecker aktivierten Morgeninstanz wie der Fokus', () => {
    const early = zonedToUtc(date, 210)
    const routine = { id: 'early', target: { kind: 'routine' as const, date, routine: 'morning' as const, stepId: 'first', minimal: false }, timer: pauseCountdown(createCountdown(300, early), early) }
    expect(read({ nowMs: early, local: { focus: routine } })).toBeUndefined()
    const guidance = { days: { [date]: { alarmOccurrenceId: 'occurrence', alarmAt: early, morningActivatedAt: early } }, receipts: [] }
    expect(read({ nowMs: early, local: { focus: routine, guidance } })).toMatchObject({ point: { title: 'Aktueller Schritt' }, timer: 'paused' })
    const previous = buildDayPlan({ date: '2026-11-12', settings })
    expect(read({ nowMs: early, plan: previous, local: { focus: routine, guidance } })).toBeUndefined()
  })
})
