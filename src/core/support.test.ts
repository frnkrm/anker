import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { routineDone } from './now'
import { buildDayPlan } from './planner'
import { buildReminders } from './reminders/build'
import { deadlineRisk, inQuietHours, isBehind, nextAction, pulseDue, remainingSec, rescueItems, stuckLadder, suggestedMode, suggestMeal, suggestTaskWindow, tasksFor, topWork, type NextInput } from './support'
import { addDays, zonedToUtc } from './time'
import type { DayLog, DayOverride, InboxItem, Settings, WorkSession, WorkTask } from './types'

const MON = '2026-11-02'
const s = defaultSettings('2026-11-01')
const planWith = (override?: DayOverride, settings: Settings = s) => buildDayPlan({ date: MON, settings, override })
const plan = planWith()
const wakeLog = (patch: Partial<DayLog> = {}): DayLog => ({ date: MON, override: {}, steps: {}, wakeAt: 1, ...patch })
const allMorningDone = () => Object.fromEntries(plan.blocks.find((b) => b.routine === 'morning')!.steps!.map((x) => [`morning:${x.id}`, 'done' as const]))
const task = (patch: Partial<InboxItem> = {}): InboxItem => ({ id: 't1', text: 'Zahnarzt anrufen', createdAt: 1, status: 'task', taskDate: MON, ...patch })
const work = (patch: Partial<WorkTask> = {}): WorkTask => ({ id: 'w1', title: 'Bericht', createdAt: 1, ...patch })

function input(patch: Partial<NextInput> & { m: number }): NextInput {
  return { plan, log: wakeLog(), nowMs: zonedToUtc(MON, patch.m), settings: s, inbox: [], work: [], ...patch }
}

describe('nextAction', () => {
  it('Wecker und feste Zeiten gehen immer vor', () => {
    const v = nextAction(input({ m: plan.wake, log: undefined, inbox: [task()], work: [work({ deadline: zonedToUtc(MON, plan.wake + 5) })] }))
    expect(v.action.type).toBe('wake')
  })

  it('auf dem Arbeitsweg gibt es keine Unterbrechung', () => {
    const v = nextAction(input({ m: plan.leave! + 5, log: wakeLog({ leftAt: 1, steps: allMorningDone() }), work: [work({ deadline: zonedToUtc(MON, plan.leave! + 10) })], resume: { kind: 'work', title: 'x', at: zonedToUtc(MON, plan.leave!) } }))
    expect(v.action.type).not.toBe('worktask')
    expect(v.action.type).not.toBe('resume')
  })

  it('gefährdete Deadline vor Wiedereinstieg und Routine', () => {
    const m = plan.pcStop - 60
    const v = nextAction(input({ m, work: [work({ deadline: zonedToUtc(MON, m + 30), estimateMin: 20 })], resume: { kind: 'task', title: 'y', at: zonedToUtc(MON, m - 5) } }))
    expect(v.action.type).toBe('worktask')
    expect(v.reason).toMatch(/Frist/)
    expect(v.reason).not.toMatch(/zu spät|versäumt|verpasst/i)
  })

  it('Wiedereinstieg bevorzugt, mit nächstem Schritt', () => {
    const v = nextAction(input({ m: 10 * 60, log: wakeLog({ leftAt: 1, steps: allMorningDone() }), resume: { kind: 'work', title: 'Bericht', nextStep: 'Tabelle öffnen', at: zonedToUtc(MON, 9 * 60) } }))
    expect(v.action).toMatchObject({ type: 'resume', title: 'Tabelle öffnen', sub: 'Du warst bei: Bericht' })
  })

  it('älterer Wiedereinstieg bleibt ohne Zeitstrafe erhalten', () => {
    const v = nextAction(input({ m: 16 * 60, log: wakeLog({ leftAt: 1, steps: allMorningDone() }), resume: { kind: 'work', title: 'Alt', at: zonedToUtc(addDays(MON, -3), 6 * 60) } }))
    expect(v.action.type).toBe('resume')
  })

  it('im Arbeitsblock: die wichtigste Aufgabe statt nichts', () => {
    const log = wakeLog({ leftAt: 1, steps: allMorningDone() })
    const v = nextAction(input({ m: 10 * 60, log, work: [work({ nextStep: 'Tabelle öffnen' }), work({ id: 'w2', title: 'Zweites' })] }))
    expect(v.action).toMatchObject({ type: 'worktask', title: 'Tabelle öffnen' })
    expect(nextAction(input({ m: 10 * 60, log })).action.type).toBe('work')
  })

  it('morgens bleibt die Routine vorn, auch wenn Aufgaben warten', () => {
    const v = nextAction(input({ m: plan.wake + 2, inbox: [task()] }))
    expect(v.action.type).toBe('step')
  })

  it('freie Aufgabe wird nie zum festen Termin und überdeckt keine festen Zeiten', () => {
    const evening = Object.fromEntries(plan.blocks.find((b) => b.routine === 'evening')!.steps!.map((x) => [`evening:${x.id}`, 'done' as const]))
    const log = wakeLog({ leftAt: 1, steps: { ...allMorningDone(), ...evening } })
    expect(nextAction(input({ m: plan.pcStop + 1, log, inbox: [task()] })).action.type).toBe('pcoff')
    // Auch bei offener Abendroutine kommt nach dem PC-Stopp keine neue Aufgabe mehr
    expect(nextAction(input({ m: plan.pcStop + 1, log: wakeLog({ leftAt: 1, steps: allMorningDone() }), inbox: [task()] })).action.type).toBe('step')
    expect(plan.hardTimes.some((h) => h.label.includes('Zahnarzt'))).toBe(false)
  })

  it('überlastet: keine zusätzlichen Aufgaben', () => {
    const p = planWith({ mode: 'ueberlastet' })
    const log = wakeLog({ override: { mode: 'ueberlastet' }, leftAt: 1, steps: {} })
    const win = suggestTaskWindow(p)!
    const v = nextAction(input({ plan: p, m: win.start + 1, log, inbox: [task()] }))
    expect(v.action.type).not.toBe('task')
  })

  it('Ankommen ist aus, bis du es einschaltest', () => {
    const log = wakeLog({ leftAt: 1, steps: allMorningDone() })
    const home = plan.blocks.find((b) => b.kind === 'evening-plan')!.start
    expect(nextAction(input({ m: home + 1, log })).action.type).not.toBe('arrival')
    const on = structuredClone(s)
    on.support.arrival.enabled = true
    const v = nextAction(input({ m: home + 1, log, settings: on }))
    expect(v.action).toMatchObject({ type: 'arrival', index: 0, total: 3 })
    const next = nextAction(input({ m: home + 1, log: { ...log, arrival: [0] }, settings: on }))
    expect(next.action).toMatchObject({ type: 'arrival', index: 1 })
  })

  it('Begründung nur mit echten Daten', () => {
    const v = nextAction(input({ m: plan.leave! - 30 }))
    expect(v.reason).toContain('Losgehen')
    expect(nextAction(input({ m: plan.pcStop - 4 * 60, log: wakeLog({ leftAt: 1, steps: allMorningDone() }) })).reason).toBeUndefined()
  })

  it('nach drei Tagen Pause: kein Rückstand, einfach der nächste Schritt', () => {
    const later = buildDayPlan({ date: addDays(MON, 3), settings: s })
    const old = [task({ taskDate: MON }), task({ id: 't2', taskDate: addDays(MON, 1) })]
    const v = nextAction({ plan: later, log: undefined, m: later.wake + 200, nowMs: zonedToUtc(later.date, later.wake + 200), settings: s, inbox: old, work: [] })
    expect(JSON.stringify(v)).not.toMatch(/verpasst|überfällig|rückstand|versäumt/i)
  })
})

describe('Freiwilliger Feierabend-Schutz', () => {
  const quiet = (): Settings => ({ ...s, support: { ...s.support, workAfterHoursQuiet: true } })
  const eveningMinute = plan.blocks.find((b) => b.routine === 'evening')!.start + 1
  const urgent = (m: number) => work({ deadline: zonedToUtc(MON, m - 5) })

  it('ist standardmäßig aus und lässt die bisherige Deadline-Priorität bestehen', () => {
    expect(s.support.workAfterHoursQuiet).toBe(false)
    expect(nextAction(input({ m: eveningMinute, work: [urgent(eveningMinute)] })).action.type).toBe('worktask')
  })

  it('lässt eine berufliche Deadline nach Feierabend die Abendroutine nicht verdrängen', () => {
    const v = nextAction(input({ settings: quiet(), m: eveningMinute, work: [urgent(eveningMinute)] }))
    expect(v.action).toMatchObject({ type: 'step', routine: 'evening' })
  })

  it('stellt nur berufliche Wiedereinstiege ruhig, private bleiben möglich', () => {
    const at = zonedToUtc(MON, eveningMinute - 5)
    const resume = { kind: 'work' as const, title: 'Bericht', at }
    expect(nextAction(input({ m: eveningMinute, resume })).action.type).toBe('resume')
    expect(nextAction(input({ settings: quiet(), m: eveningMinute, resume })).action.type).toBe('step')
    expect(nextAction(input({ settings: quiet(), m: eveningMinute, resume: { ...resume, kind: 'task' } })).action.type).toBe('resume')
  })

  it('lässt berufliche Aufgaben während der geplanten Arbeit unverändert', () => {
    const m = 10 * 60
    expect(nextAction(input({ settings: quiet(), m, work: [urgent(m)] })).action.type).toBe('worktask')
  })

  it('lässt weiterlaufende Arbeit auch nach dem geplanten Ende bedienbar', () => {
    const m = 19 * 60
    const sessions: WorkSession[] = [{ id: 'work', date: MON, kind: 'regular', startAt: zonedToUtc(MON, 8 * 60), breaks: [] }]
    const p = buildDayPlan({ date: MON, settings: quiet(), override: { homeOffice: true }, sessions, nowMs: zonedToUtc(MON, m) })
    expect(nextAction(input({ plan: p, settings: quiet(), m, sessions, work: [urgent(m)] })).action.type).toBe('worktask')
  })

  it('lässt einen laufenden Arbeitseinsatz am Abend unverändert', () => {
    const m = 19 * 60
    const sessions: WorkSession[] = [{ id: 'call', date: MON, kind: 'incident', startAt: zonedToUtc(MON, m - 5), breaks: [] }]
    expect(nextAction(input({ settings: quiet(), m, sessions, work: [urgent(m)] })).action.type).toBe('einsatz-running')
  })

  it('richtet sich nach einem tatsächlich früher erfassten Feierabend', () => {
    const m = 13 * 60
    const sessions: WorkSession[] = [{ id: 'work', date: MON, kind: 'regular', startAt: zonedToUtc(MON, 8 * 60), endAt: zonedToUtc(MON, 12 * 60), breaks: [] }]
    const p = buildDayPlan({ date: MON, settings: quiet(), sessions, nowMs: zonedToUtc(MON, m) })
    expect(nextAction(input({ plan: p, settings: quiet(), m, sessions, work: [urgent(m)] })).action.type).not.toBe('worktask')
  })

  it('lässt private Aufgaben nach Feierabend verfügbar', () => {
    const m = suggestTaskWindow(plan)!.start + 1
    const v = nextAction(input({ settings: quiet(), m, work: [urgent(m)], inbox: [task()] }))
    expect(v.action.type).toBe('task')
  })

  it('lässt feste Termine und Losgehen unverändert', () => {
    const m = 19 * 60
    const p = buildDayPlan({ date: MON, settings: quiet(), commitments: [{ id: 'a', date: MON, label: 'Besuch', context: 'personal', commitment: 'hard', status: 'planned', start: m + 10, end: m + 60, placeLabel: 'Freunde', travelMin: 0 }] })
    expect(nextAction(input({ plan: p, settings: quiet(), m, work: [urgent(m)] })).action.type).toBe('go')
  })
})

describe('Modi', () => {
  it('Wenig Energie: sofort kleine Versionen, ohne Rückfrage', () => {
    const p = planWith({ mode: 'wenig-energie' })
    const m = p.blocks.find((b) => b.routine === 'morning')!
    expect(m.steps!.filter((x) => x.minimal).every((x) => x.useMinimal)).toBe(true)
    expect(p.notes.join()).not.toMatch(/Minimal-Version/)
    expect(m.end - m.start).toBeLessThan(plan.blocks.find((b) => b.routine === 'morning')!.end - plan.blocks.find((b) => b.routine === 'morning')!.start)
  })

  it('Überlastet: nur das Nötigste am Abend', () => {
    const p = planWith({ mode: 'ueberlastet' })
    const e = p.blocks.find((b) => b.routine === 'evening')!.steps!
    expect(e.every((x) => x.tag === 'teeth' || x.tag === 'face')).toBe(true)
  })

  it('Normal und Auf Kurs ändern den Plan nicht', () => {
    expect(planWith({ mode: 'auf-kurs' }).blocks).toEqual(plan.blocks)
    expect(planWith({ mode: 'normal' }).blocks).toEqual(plan.blocks)
  })

  it('harte Zeiten bleiben in jedem Modus gleich', () => {
    for (const mode of ['wenig-energie', 'ueberlastet', 'startschwierigkeit', 'auf-kurs'] as const) {
      expect(planWith({ mode }).hardTimes).toEqual(plan.hardTimes)
    }
  })

  it('Abendmodus ist nur ein Vorschlag und standardmäßig aus', () => {
    expect(suggestedMode(s, undefined, 20 * 60)).toBeUndefined()
    const on = structuredClone(s)
    on.support.eveningPreset.enabled = true
    expect(suggestedMode(on, undefined, 17 * 60)).toBeUndefined()
    expect(suggestedMode(on, undefined, 19 * 60)).toBe('wenig-energie')
    expect(suggestedMode(on, { date: MON, override: { mode: 'normal' }, steps: {} }, 19 * 60)).toBeUndefined()
  })

  it('Routine abschließen klappt auch mit der gekürzten Version', () => {
    const p = planWith({ mode: 'ueberlastet' })
    const steps = Object.fromEntries(p.blocks.find((b) => b.routine === 'evening')!.steps!.map((x) => [`evening:${x.id}`, 'minimal' as const]))
    expect(routineDone(p, { date: MON, override: {}, steps }, 'evening')).toBe(true)
  })
})

describe('Inbox als eine Wahrheit', () => {
  it('„Morgen erledigen“ erscheint erst am richtigen Tag', () => {
    const t = task({ taskDate: addDays(MON, 1) })
    expect(tasksFor([t], MON)).toEqual([])
    expect(tasksFor([t], addDays(MON, 1))).toEqual([t])
  })

  it('einmal erledigt ist überall erledigt', () => {
    const t = task({ done: true })
    expect(tasksFor([t], MON)).toEqual([])
    const win = suggestTaskWindow(plan)!
    const log = wakeLog({ leftAt: 1, steps: allMorningDone() })
    expect(nextAction(input({ m: win.start + 1, log, inbox: [t] })).action.type).not.toBe('task')
  })

  it('offene Aufgaben ziehen ruhig mit, ohne Stapel', () => {
    const list = tasksFor([task({ taskDate: addDays(MON, -5) }), task({ id: 't2', taskDate: MON })], MON)
    expect(list.map((x) => x.id)).toEqual(['t1', 't2'])
  })

  it('geparkte Gedanken landen nicht im Plan', () => {
    expect(tasksFor([{ id: 'p', text: 'Idee', createdAt: 1, status: 'open' }, { id: 'k', text: 'Idee', createdAt: 1, status: 'kept' }], MON)).toEqual([])
  })

  it('Zeitfenster kollidiert nicht mit Arbeit, Schlaf oder Terminen', () => {
    const win = suggestTaskWindow(plan, 5)!
    expect(win.fits).toBe(true)
    const work = plan.blocks.find((b) => b.kind === 'work')!
    expect(win.start).toBeGreaterThanOrEqual(work.end)
    expect(win.end).toBeLessThanOrEqual(plan.pcStop)
    const blocked = buildDayPlan({ date: MON, settings: s, events: [{ id: 'e', title: 'Termin', start: zonedToUtc(MON, win.start - 1), end: zonedToUtc(MON, win.start + 30) }] })
    const w2 = suggestTaskWindow(blocked, 5)!
    expect(w2.start).toBeGreaterThanOrEqual(win.start + 30)
  })
})

describe('Arbeit', () => {
  const now = zonedToUtc(MON, 600)
  it('Reihenfolge bestimmt die Top-Aufgabe, Erledigtes rückt nach', () => {
    expect(topWork([work({ done: true }), work({ id: 'w2' })])?.id).toBe('w2')
  })
  it('Deadline-Gefahr nur bei echter Frist', () => {
    expect(deadlineRisk(work(), now)).toBe('none')
    expect(deadlineRisk(work({ deadline: now + 40 * 3600_000 }), now)).toBe('none')
    expect(deadlineRisk(work({ deadline: now + 5 * 3600_000 }), now)).toBe('today')
    expect(deadlineRisk(work({ deadline: now + 20 * 60_000 }), now)).toBe('soon')
    expect(deadlineRisk(work({ deadline: now - 1 }), now)).toBe('past')
    expect(deadlineRisk(work({ deadline: now - 1, done: true }), now)).toBe('none')
  })
  it('Arbeitsinhalte erscheinen nicht in Erinnerungstexten', () => {
    const r = buildReminders([], {}, s, now, 7 * 24 * 3600_000, { deadlines: [{ id: 'w1', at: now + 48 * 3600_000 }] })
    expect(JSON.stringify(r)).not.toContain('Bericht')
  })
})

describe('Ich hänge fest', () => {
  it('zeigt die Minimalversion zuerst, dann 30 Sekunden', () => {
    const v = nextAction(input({ m: plan.wake + 2 }))
    const l = stuckLadder(v.action)
    expect(l[0]!.seconds).toBe(120)
    expect(l[l.length - 1]!.seconds).toBe(30)
  })
  it('hat immer einen konkreten Schritt', () => {
    expect(stuckLadder({ type: 'leave', title: 'x' })[0]!.text).toMatch(/Schuhe/)
  })
})

describe('Fokus-Puls', () => {
  const c = { pulse: 'gentle' as const, everyMin: 2, halfway: false, lastMinute: false }
  it('ausgeschaltet: niemals', () => {
    const off = { ...c, pulse: 'off' as const, halfway: true, lastMinute: true }
    for (let t = 1; t < 1000; t++) expect(pulseDue(off, t, t - 1, 600, false)).toBe(false)
  })
  it('alle 2 Minuten einmal', () => {
    let n = 0
    for (let t = 1; t <= 600; t++) if (pulseDue(c, t, t - 1, 600, false)) n++
    expect(n).toBe(5)
  })
  it('zur Hälfte und in der letzten Minute', () => {
    const d = { ...c, everyMin: 5 as const, halfway: true, lastMinute: true }
    expect(pulseDue(d, 200, 199, 400, false)).toBe(true)
    expect(pulseDue(d, 340, 339, 400, false)).toBe(true)
    expect(pulseDue(d, 100, 99, 400, false)).toBe(false)
  })
  it('nicht in Ruhezeiten oder beim Wecker', () => {
    expect(pulseDue(c, 120, 119, 600, true)).toBe(false)
    expect(inQuietHours(23 * 60 + 45, s)).toBe(true)
    expect(inQuietHours(12 * 60, s)).toBe(false)
  })
  it('Restzeit läuft über Pausieren und Neuöffnen weiter', () => {
    expect(remainingSec(1000, 120, 61_000)).toBe(60)
    expect(remainingSec(1000, 120, 500_000)).toBe(0)
  })
})

describe('Tag neu sortieren', () => {
  it('bietet sich nur bei Zeitverlust an', () => {
    expect(isBehind(plan, wakeLog(), plan.wake)).toBe(false)
    expect(isBehind(plan, wakeLog(), 11 * 60)).toBe(true)
    expect(isBehind(plan, wakeLog({ steps: allMorningDone() }), 11 * 60)).toBe(false)
    expect(isBehind(plan, wakeLog({ override: { light: true } }), 11 * 60)).toBe(false)
  })
  it('höchstens drei Dinge, harte Termine bleiben fest', () => {
    const r = rescueItems(input({ m: 11 * 60, work: [work()], inbox: [task(), task({ id: 't2' })] }))
    expect(r.length).toBeLessThanOrEqual(3)
    expect(r[0]!.title).toBe('PC-Stopp')
  })
  it('kleine Versionen für den Rest, feste Zeiten unverändert', () => {
    const p = planWith({ light: true })
    expect(p.hardTimes).toEqual(plan.hardTimes)
    expect(p.blocks.find((b) => b.routine === 'evening')!.minimal).toBe(true)
  })
})

describe('Essensvorschlag', () => {
  it('ist am selben Tag gleich und nur aus eigenen Gerichten', () => {
    const a = suggestMeal(s.meals, MON)
    expect(suggestMeal(s.meals, MON)).toEqual(a)
    expect(s.meals).toContainEqual(a)
    expect(suggestMeal(s.meals, MON, 1)).not.toEqual(a)
    expect(suggestMeal([], MON)).toBeUndefined()
  })
})
