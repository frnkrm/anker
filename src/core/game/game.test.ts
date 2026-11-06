import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { addDays, zonedToUtc, type DateStr } from '../time'
import type { DayLog, Settings } from '../types'
import { applyAwards } from './awards'
import { evaluateChapter } from './chapter'
import { dayGoals, dayStatus, type DayStatus } from './evaluate'
import { advanceGame, chapterStatus, initialGame } from './progress'
import { THEMES, THEME_LIST } from './themes'
import { levelFor, levelThreshold } from './xp'

const MON = '2026-11-02'

function s(): Settings {
  return defaultSettings('2026-11-01')
}

function perfectLog(date: DateStr, settings: Settings): DayLog {
  const plan = buildDayPlan({ date, settings })
  const steps: DayLog['steps'] = {}
  for (const b of plan.blocks) for (const st of b.steps ?? []) steps[`${b.routine}:${st.id}`] = 'done'
  return {
    date,
    override: {},
    steps,
    wakeAt: zonedToUtc(date, plan.wake + 2),
    leftAt: plan.leave !== undefined ? zonedToUtc(date, plan.leave) : undefined,
    eveningRoutineDoneAt: zonedToUtc(date, plan.pcStop - 30),
    pcOffAt: zonedToUtc(date, plan.pcStop),
    bedAt: zonedToUtc(date, plan.bed),
  }
}

function statuses(map: Record<string, DayStatus>) {
  return (d: DateStr) => map[d] ?? 'open'
}

describe('Themen', () => {
  it('jedes Thema hat 10 Level, 3 Stufen und Abzeichen für alle Kapitel', () => {
    for (const t of THEME_LIST) {
      expect(t.levels).toHaveLength(10)
      expect(t.stageNames).toHaveLength(3)
      for (const len of [7, 14, 30, 66]) expect(t.badges[len]).toBeTruthy()
    }
  })
})

describe('Level', () => {
  it('Schwellen steigen', () => {
    expect(levelThreshold(1)).toBe(0)
    expect(levelThreshold(2)).toBe(150)
    expect(levelFor(0, THEMES.seefahrt)).toMatchObject({ level: 1, name: 'Landratte' })
    expect(levelFor(450, THEMES.seefahrt)).toMatchObject({ level: 3, name: 'Matrose' })
  })
  it('über Level 10 hinaus mit Sternen', () => {
    expect(levelFor(levelThreshold(12), THEMES.kampfkunst).name).toBe('Über 9000 ★★')
  })
})

describe('Tagesziele', () => {
  it('perfekter Arbeitstag = geschafft', () => {
    const st = s()
    const plan = buildDayPlan({ date: MON, settings: st })
    expect(dayStatus(plan, perfectLog(MON, st), st, true)).toBe('success')
  })
  it('20 Minuten zu spät aufgestanden = Ziel nicht erfüllt, Tag offen bzw. verpasst', () => {
    const st = s()
    const plan = buildDayPlan({ date: MON, settings: st })
    const log = { ...perfectLog(MON, st), wakeAt: zonedToUtc(MON, plan.wake + 20) }
    expect(dayGoals(plan, log, st).find((g) => g.key === 'wake')!.met).toBe(false)
    expect(dayStatus(plan, log, st, false)).toBe('open')
    expect(dayStatus(plan, log, st, true)).toBe('missed')
  })
  it('Wochenende: ±60 Minuten erlaubt, kein Losgehen', () => {
    const st = s()
    const sat = '2026-11-07'
    const plan = buildDayPlan({ date: sat, settings: st })
    const log = { ...perfectLog(sat, st), wakeAt: zonedToUtc(sat, plan.wake + 55) }
    const goals = dayGoals(plan, log, st)
    expect(goals.map((g) => g.key)).toEqual(['wake', 'evening', 'pcstop'])
    expect(goals.every((g) => g.met)).toBe(true)
  })
  it('Minimal-Versionen zählen für die Abendroutine', () => {
    const st = s()
    const plan = buildDayPlan({ date: MON, settings: st })
    const log = perfectLog(MON, st)
    delete log.eveningRoutineDoneAt
    for (const k of Object.keys(log.steps)) if (k.startsWith('evening')) log.steps[k] = 'minimal'
    expect(dayGoals(plan, log, st).find((g) => g.key === 'evening')!.met).toBe(true)
  })
  it('Krank = neutral, keine Ziele', () => {
    const st = s()
    const plan = buildDayPlan({ date: MON, settings: st, override: { dayType: 'sick' } })
    expect(dayGoals(plan, undefined, st)).toEqual([])
    expect(dayStatus(plan, undefined, st, true)).toBe('neutral')
  })
  it('Stufe 2 und 3 fügen Ziele hinzu', () => {
    const st = s()
    st.game.stage = 3
    const plan = buildDayPlan({ date: MON, settings: st })
    const keys = dayGoals(plan, perfectLog(MON, st), st).map((g) => g.key)
    expect(keys).toEqual(['wake', 'leave', 'evening', 'pcstop', 'movement', 'gym', 'tidy'])
    const sun = '2026-11-08'
    const sunKeys = dayGoals(buildDayPlan({ date: sun, settings: st }), undefined, st).map((g) => g.key)
    expect(sunKeys).toContain('prepcook')
  })
})

describe('Sport abhaken', () => {
  const gymGoal = (st: Settings, log: DayLog | undefined) =>
    dayGoals(buildDayPlan({ date: MON, settings: st }), log, st).find((g) => g.key === 'gym')!.met
  const stage3 = (patch: Partial<Settings['sport']> = {}) => {
    const st = s()
    st.game.stage = 3
    st.sport = { ...st.sport, ...patch }
    return st
  }
  const log = (patch: Partial<DayLog>): DayLog => ({ date: MON, override: {}, steps: {}, ...patch })

  it('offen, solange nichts abgehakt ist', () => {
    expect(gymGoal(stage3(), log({}))).toBe(false)
  })
  it('von Hand und über Health Connect', () => {
    expect(gymGoal(stage3({ kind: 'gym' }), log({ sport: 'manual' }))).toBe(true)
    expect(gymGoal(stage3({ kind: 'gym' }), log({ sport: 'health' }))).toBe(true)
  })
  it('Training zu Hause am Morgen: Routine-Schritt zählt, auch als Minimal-Version', () => {
    expect(gymGoal(stage3({ kind: 'home' }), log({ steps: { 'morning:move': 'done' } }))).toBe(true)
    expect(gymGoal(stage3({ kind: 'run' }), log({ steps: { 'morning:move': 'minimal' } }))).toBe(true)
  })
  it('übersprungener Schritt zählt nicht', () => {
    expect(gymGoal(stage3({ kind: 'home' }), log({ steps: { 'morning:move': 'skipped' } }))).toBe(false)
  })
  it('Fitnessstudio: Bewegung in der Routine ersetzt das Studio nicht', () => {
    expect(gymGoal(stage3({ kind: 'gym' }), log({ steps: { 'morning:move': 'done' } }))).toBe(false)
  })
  it('Sport nach der Arbeit: Bewegung am Morgen zählt nicht', () => {
    expect(gymGoal(stage3({ kind: 'home', time: 'afterWork' }), log({ steps: { 'morning:move': 'done' } }))).toBe(false)
  })
})

describe('Kapitel ohne Verlust durch nicht erfüllte Tage', () => {
  const start = '2026-11-02'
  const d = (i: number) => addDays(start, i)

  it('7 geschaffte Tage = Kapitel abgeschlossen', () => {
    const m: Record<string, DayStatus> = {}
    for (let i = 0; i < 7; i++) m[d(i)] = 'success'
    const r = evaluateChapter(start, 7, d(6), statuses(m))
    expect(r).toMatchObject({ completed: true, completedOn: d(6), progress: 7 })
  })
  it('ein verpasster Tag unterbricht nichts', () => {
    const m = { [d(0)]: 'success', [d(1)]: 'missed', [d(2)]: 'success' } as Record<string, DayStatus>
    const r = evaluateChapter(start, 7, d(2), statuses(m))
    expect(r).toMatchObject({ progress: 2, ended: false, jokerUsed: false })
  })
  it('zwei nicht erfüllte Tage verbrauchen keinen Joker', () => {
    const m = { [d(0)]: 'missed', [d(1)]: 'missed', [d(2)]: 'success' } as Record<string, DayStatus>
    const r = evaluateChapter(start, 7, d(2), statuses(m))
    expect(r).toMatchObject({ ended: false, jokerUsed: false, progress: 1 })
  })
  it('mehrere nicht erfüllte Tage beenden kein Kapitel und zählen nicht als Fortschritt', () => {
    const m = { [d(0)]: 'missed', [d(1)]: 'missed', [d(2)]: 'missed' } as Record<string, DayStatus>
    const r = evaluateChapter(start, 7, d(3), statuses(m))
    expect(r).toMatchObject({ ended: false, progress: 0, jokerUsed: false, completed: false })
    expect(r.endedOn).toBeUndefined()
  })
  it('krank (neutral) zählt weder als verpasst noch als geschafft', () => {
    const m = { [d(0)]: 'missed', [d(1)]: 'neutral', [d(2)]: 'neutral', [d(3)]: 'success' } as Record<string, DayStatus>
    const r = evaluateChapter(start, 7, d(3), statuses(m))
    expect(r).toMatchObject({ ended: false, jokerUsed: false, progress: 1 })
  })
  it('erzeugt keine Nachholaufforderung nach einem nicht erfüllten Tag', () => {
    const m = { [d(0)]: 'success', [d(1)]: 'missed' } as Record<string, DayStatus>
    expect(evaluateChapter(start, 7, d(2), statuses(m)).missedYesterday).toBe(false)
  })
  it('zählt sieben echte Erfolgstage auch mit längeren Pausen und erhält historische Jokerwerte', () => {
    const m: Record<string, DayStatus> = {}
    for (let i = 0; i < 28; i++) m[d(i)] = i % 4 === 0 ? 'success' : 'missed'
    const r = evaluateChapter(start, 7, d(27), statuses(m), true)
    expect(r).toMatchObject({ completed: true, completedOn: d(24), progress: 7, jokerUsed: true, ended: false })
  })
})

describe('Spielfortschritt', () => {
  const ctxBase = (st: Settings, m: Record<string, DayStatus>, today: string) => ({
    today,
    settings: st,
    theme: THEMES.seefahrt,
    statusOf: statuses(m),
    goalsOf: () => [],
    logs: [] as DayLog[],
    reviewCount: 0,
  })

  it('Kapitel-Abschluss: Abzeichen, XP, nächstes Kapitel', () => {
    const st = s()
    const m: Record<string, DayStatus> = {}
    for (let i = 0; i < 7; i++) m[addDays('2026-11-01', i)] = 'success'
    const { game, events } = advanceGame(initialGame('2026-11-01'), ctxBase(st, m, '2026-11-08'))
    expect(game.chaptersDone).toEqual([{ length: 7, endDate: '2026-11-07' }])
    expect(game.badges).toEqual(['Kompass'])
    expect(game.chapter).toMatchObject({ index: 1, startDate: '2026-11-08' })
    expect(events.map((e) => e.type)).toContain('chapter-completed')
    expect(game.xp).toBeGreaterThan(0)
  })
  it('nicht erfüllte Tage behalten Kapitel, Joker und XP ohne Neustart', () => {
    const st = s()
    const m: Record<string, DayStatus> = {}
    for (let i = 0; i < 4; i++) m[addDays('2026-11-01', i)] = 'missed'
    const g0 = { ...initialGame('2026-11-01'), xp: 500 }
    const { game, events } = advanceGame(g0, ctxBase(st, m, '2026-11-05'))
    expect(game.xp).toBe(500)
    expect(game.chapter).toEqual(g0.chapter)
    expect(events).toEqual([])
    expect(chapterStatus(game, '2026-11-05', statuses(m))).toMatchObject({ progress: 0, completed: false, jokerUsed: false })
  })
  it.each([3, 30])('behält nach %i Tagen Nichtnutzung echte Kapitel-Tage und den alten Spielstand', (absentDays) => {
    const st = s()
    const start = '2026-11-01'
    const today = addDays(start, absentDays + 2)
    const m: Record<string, DayStatus> = { [start]: 'success', [addDays(start, 1)]: 'success' }
    const context = {
      ...ctxBase(st, m, today),
      statusOf: (date: string) => m[date] ?? dayStatus(buildDayPlan({ date, settings: st }), undefined, st, date < today),
    }
    const g0 = {
      ...initialGame(start), xp: 500, spent: 60,
      chapter: { index: 0, startDate: start, jokerUsed: true, attempt: 3 },
      badges: ['Vorhandenes Abzeichen'], achievements: { 'first-step': '2026-10-31' },
    }
    const before = structuredClone(g0)
    const { game, events } = advanceGame(g0, context)
    expect(game.chapter).toEqual(g0.chapter)
    expect(chapterStatus(game, today, context.statusOf)).toMatchObject({ progress: 2, ended: false, jokerUsed: true, missedYesterday: false })
    expect(game.xp).toBe(500)
    expect(game.spent).toBe(60)
    expect(game.badges).toEqual(g0.badges)
    expect(game.achievements).toEqual(g0.achievements)
    expect(game.chaptersDone).toEqual(g0.chaptersDone)
    expect(events).toEqual([])
    expect(g0).toEqual(before)

    m[today] = 'success'
    const resumed = advanceGame(game, context)
    expect(chapterStatus(resumed.game, today, context.statusOf).progress).toBe(3)
    const repeated = advanceGame(resumed.game, context)
    expect(repeated.game).toEqual(resumed.game)
    expect(repeated.events).toEqual([])
  })
  it('vergibt den Kapitelbonus nach sieben echten Tagen mit Pausen nur einmal', () => {
    const st = s()
    const start = '2026-11-01'
    const today = addDays(start, 12)
    const m: Record<string, DayStatus> = {}
    for (let i = 0; i <= 12; i++) m[addDays(start, i)] = i % 2 === 0 ? 'success' : 'missed'
    const context = ctxBase(st, m, today)
    const first = advanceGame(initialGame(start), context)
    expect(first.game.chaptersDone).toEqual([{ length: 7, endDate: today }])
    expect(first.game.chapter).toMatchObject({ index: 1, startDate: addDays(today, 1), attempt: 1 })
    expect(first.events.filter((event) => event.type === 'chapter-completed')).toHaveLength(1)
    expect(first.events.some((event) => event.type === 'chapter-restarted')).toBe(false)
    const repeated = advanceGame(first.game, context)
    expect(repeated.game).toEqual(first.game)
    expect(repeated.events).toEqual([])
  })
  it('Stufen-Angebot erst nach geschafftem Kapitel und ab Woche 3', () => {
    const st = s()
    st.game.startDate = '2026-10-01'
    const m: Record<string, DayStatus> = {}
    for (let i = 0; i < 7; i++) m[addDays('2026-11-01', i)] = 'success'
    const { game } = advanceGame(initialGame('2026-11-01'), ctxBase(st, m, '2026-11-08'))
    expect(game.stageOffer).toBe(2)
  })
})

describe('XP-Vergabe', () => {
  it('jeder Grund nur einmal pro Tag', () => {
    const st = s()
    const plan = buildDayPlan({ date: MON, settings: st })
    const log = perfectLog(MON, st)
    const a = applyAwards(plan, log, initialGame(MON), st)
    expect(a.gained).toBeGreaterThan(100)
    const b = applyAwards(plan, a.log, a.game, st)
    expect(b.gained).toBe(0)
    expect(b.game.xp).toBe(a.game.xp)
  })
  it('Minimal-Version gibt weniger, aber XP', () => {
    const st = s()
    const plan = buildDayPlan({ date: MON, settings: st })
    const r = applyAwards(plan, { date: MON, override: {}, steps: { 'morning:move': 'minimal' } }, initialGame(MON), st)
    expect(r.gained).toBe(6)
  })
})
