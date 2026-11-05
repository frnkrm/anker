import { describe, expect, it } from 'vitest'
import { buildAlarmConfig } from './alarm'
import { defaultSettings, emptyLocal, migrateSettings } from './defaults'
import { dayStatus } from './game'
import { nowView, widgetEntry } from './now'
import { buildDayPlan } from './planner'
import { buildReminders } from './reminders/build'
import { morningNeed, wakeProposal } from './sleep'
import { nextAction } from './support'
import { addDays, zonedToUtc } from './time'
import type { Commitment, DayLog, DayOverride, Settings, WorkSession } from './types'
import {
  breakHint,
  dayActual,
  dayBalance,
  endBreak,
  forecastEnd,
  isSundayWork,
  latestInfo,
  manualSession,
  normalizeIntervals,
  overLatest,
  restConflict,
  staleSession,
  startBreak,
  startRisk,
  startSession,
  stopSession,
  weekSummary,
  nextObligation,
  withUsualBreak,
  workHints,
  workRule,
} from './worktime'

const MON = '2026-11-02'
const FRI = '2026-11-06'
const SAT = '2026-11-07'
const SUN = '2026-11-08'
const h = (hh: number, mm = 0) => hh * 60 + mm
const base = defaultSettings('2026-11-01')
const withCommute = (min: number, buf: number): Settings => ({ ...base, commute: { ...base.commute, minutes: min, bufferMin: buf } })
const session = (date: string, start: number, end?: number, breaks: [number, number | undefined][] = [], patch: Partial<WorkSession> = {}): WorkSession => ({
  id: `s${start}`,
  date,
  kind: 'regular',
  startAt: zonedToUtc(date, start),
  ...(end !== undefined ? { endAt: zonedToUtc(date, end) } : {}),
  breaks: breaks.map(([a, b], n) => ({ id: `b${n}`, startAt: zonedToUtc(date, a), ...(b !== undefined ? { endAt: zonedToUtc(date, b) } : {}) })),
  ...patch,
})
const plan = (o: { date?: string; settings?: Settings; override?: DayOverride; sessions?: WorkSession[]; nowMs?: number; commitments?: Commitment[] } = {}) =>
  buildDayPlan({ date: o.date ?? MON, settings: o.settings ?? base, override: o.override, sessions: o.sessions, nowMs: o.nowMs, commitments: o.commitments })
const work = (p: ReturnType<typeof plan>) => p.blocks.find((b) => b.kind === 'work')

describe('A: normaler Gleitzeittag', () => {
  const s = withCommute(35, 10)
  it('zeigt Wunschbeginn und erkennt die späteste Abfahrt, ohne daraus ein Ziel zu machen', () => {
    const p = plan({ settings: s })
    expect(p.workInfo?.plannedStart).toBe(h(8))
    expect(p.leave).toBe(h(7, 15))
    expect(latestInfo(s, false)).toEqual({ latestStart: h(9), latestLeave: h(8, 15) })
    expect(p.workInfo?.latestLeave).toBe(h(8, 15))
  })
  it('ein bestätigter Beginn 08:30 rechnet Morgen und Feierabend neu, die Grenze bleibt gewahrt', () => {
    const p = plan({ settings: s, override: { workStart: h(8, 30) } })
    expect(p.leave).toBe(h(7, 45))
    expect(p.workEnd).toBe(h(17, 30))
    expect(overLatest(p.workInfo!.plannedStart, latestInfo(s, false))).toBe(false)
    expect(p.notes.join(' ')).not.toMatch(/spät|verpasst/)
  })
  it('ein Beginn nach der Grenze wird benannt, aber nicht verschoben', () => {
    const p = plan({ settings: s, override: { workStart: h(9, 15) } })
    expect(work(p)!.start).toBe(h(9, 15))
    expect(p.notes.join(' ')).toMatch(/nach deiner Grenze 09:00/)
  })
  it('warnt rechtzeitig, knapp und nach der Grenze still', () => {
    const r = (m: number) => startRisk({ plannedStart: h(8), latest: latestInfo(s, false), fixedMorning: false, started: false, m })
    expect(r(h(7))).toBeUndefined()
    expect(r(h(8, 5))?.level).toBe('info')
    expect(r(h(8, 20))?.level).toBe('tight')
    expect(r(h(9, 10))).toBeUndefined()
  })
})

describe('B: längere Mittagspause', () => {
  const pause = (end: number) => [session(MON, h(8), undefined, [[h(12), end]])]
  const fc = (sessions: WorkSession[], now: number) => forecastEnd({ ...workRule(MON, base), date: MON, actual: dayActual(sessions, MON, zonedToUtc(MON, now)), nowMs: zonedToUtc(MON, now) })
  it('ohne Erfassung nur Planwerte: 17:00', () => {
    expect(plan().workEnd).toBe(h(17))
  })
  it('vor der Pause bleibt die übliche Pause eingerechnet', () => {
    expect(fc([session(MON, h(8))], h(10))).toBe(h(17))
  })
  it('Pause bis 13:30: 17:30, korrigiert auf 13:15: 17:15, Soll bleibt', () => {
    expect(fc(pause(h(13, 30)), h(14))).toBe(h(17, 30))
    expect(fc(pause(h(13, 15)), h(14))).toBe(h(17, 15))
  })
  it('während der Pause wächst die Prognose mit, ohne das Soll zu ändern', () => {
    const running = [session(MON, h(8), undefined, [[h(12), undefined]])]
    expect(fc(running, h(12, 30))).toBe(h(16, 30))
    expect(fc(running, h(13, 30))).toBe(h(17, 30))
  })
  it('eine kürzere Pause zieht vor, und eine knappe Pause wird benannt', () => {
    expect(fc(pause(h(12, 30)), h(14))).toBe(h(16, 30))
    expect(breakHint(8 * 60, 15)).toMatch(/betrieblichen Regeln/)
    expect(breakHint(8 * 60, 30)).toBeUndefined()
    expect(breakHint(9 * 60 + 30, 30)).toMatch(/knapp/)
    expect(breakHint(5 * 60, 0)).toBeUndefined()
  })
  it('die Prognose fließt in den Plan und verschiebt den flexiblen Abend', () => {
    const now = zonedToUtc(MON, h(14))
    const p = plan({ sessions: pause(h(13, 30)), nowMs: now, settings: { ...base, commute: { ...base.commute, minutes: 0 } } })
    expect(p.workEnd).toBe(h(17, 30))
    expect(p.blocks.find((b) => b.kind === 'evening-plan')!.start).toBeGreaterThanOrEqual(h(17, 30))
  })
})

describe('C: kürzerer Freitag', () => {
  const s: Settings = { ...base, work: base.work.map((w, i) => (i === 4 ? { ...w, durationMin: 330, pauseMin: 30 } : w)) }
  it('eigener Wert ergibt 14:00, andere Tage bleiben', () => {
    expect(plan({ settings: s, date: FRI }).workEnd).toBe(h(14))
    expect(plan({ settings: s, date: MON }).workEnd).toBe(h(17))
  })
  it('ein einzelner Freitag ändert die nächste Woche nicht', () => {
    const today = plan({ settings: s, date: FRI, override: { pauseMin: 90 } })
    expect(today.workEnd).toBe(h(15))
    expect(plan({ settings: s, date: addDays(FRI, 7) }).workEnd).toBe(h(14))
    expect(s.work[4]!.pauseMin).toBe(30)
  })
  it('rät keinen Freitagswert: Standard bleibt, was eingestellt ist, und mehr Arbeit ist möglich', () => {
    expect(defaultSettings('2026-11-01').work[4]!.durationMin).toBe(defaultSettings('2026-11-01').work[0]!.durationMin)
    expect(plan({ settings: s, date: FRI, override: { workEnd: h(16) } }).workEnd).toBe(h(16))
  })
  it('nennt den kürzeren Freitag nur, wenn er wirklich eingetragen ist', () => {
    expect(plan({ settings: s, date: FRI }).notes.join(' ')).toMatch(/kürzerer Freitag.*14:00/)
    expect(plan({ date: FRI }).notes.join(' ')).not.toMatch(/kürzerer Freitag/)
  })
})

describe('D: Homeoffice', () => {
  const o: DayOverride = { homeOffice: true, workStart: h(8, 45) }
  it('kein Weg, kein Losgehen, keine Losgehen-Meldung, kein Ziel „Pünktlich los“', () => {
    const p = plan({ override: o })
    expect(p.blocks.some((b) => b.kind === 'commute')).toBe(false)
    expect(p.leave).toBeUndefined()
    expect(p.workInfo?.latestLeave).toBeUndefined()
    const rs = buildReminders([p], {}, base, zonedToUtc(MON, h(5)))
    expect(rs.some((r) => r.key === 'leave' || r.key === 'leave-10')).toBe(false)
    expect(nowView(p, { date: MON, override: o, steps: {}, wakeAt: 1 }, h(8, 40)).action.type).not.toBe('leave')
  })
  it('die Morgenroutine läuft bis zum Arbeitsbeginn weiter', () => {
    const a = nowView(plan({ override: o }), { date: MON, override: o, steps: {}, wakeAt: 1 }, h(8, 30)).action
    expect(a.type).toBe('step')
  })
  it('Weckzeit nur als Vorschlag für diesen Tag', () => {
    const p = plan({ override: o })
    expect(p.wake).toBe(base.anchor.wake)
    expect(morningNeed(p, base)!.readyAt).toBe(h(8, 45) - base.travel.homeOfficeStartupMin)
    expect(wakeProposal(p, base)!.later).toBe(true)
    expect(buildAlarmConfig(base, {}, MON).wakeOverrides).toEqual({})
  })
  it('08:55 ist ein sanfter Hinweis, 09:05 ist still', () => {
    const r = (m: number) => startRisk({ plannedStart: h(8, 45), latest: latestInfo(base, true), fixedMorning: false, started: false, m })
    expect(r(h(8, 55))?.text).toBe('Bis 09:00 sind noch 5 Minuten.')
    expect(r(h(8, 55))?.text).not.toMatch(/zu spät/)
    expect(r(h(9, 5))).toBeUndefined()
  })
})

describe('E: Kunde früher und anderswo', () => {
  const kunde: Commitment = { id: 'k', date: MON, label: 'Kunde', context: 'customer', commitment: 'hard', start: h(8, 30), status: 'planned', placeLabel: 'Kunde A', travelMin: 40, replacesCommute: true, arrivalBufferMin: 5 }
  it('die Ankunft bestimmt den Morgen, nur eine Fahrt, ein Arbeitsbeginn', () => {
    const p = plan({ commitments: [kunde] })
    expect(p.leave).toBe(h(7, 45))
    expect(p.blocks.filter((b) => b.kind === 'commute' && b.title === 'Losgehen')).toHaveLength(0)
    expect(p.blocks.filter((b) => b.kind === 'travel')).toHaveLength(1)
    expect(p.blocks.filter((b) => b.kind === 'work')).toHaveLength(1)
    expect(work(p)!.start).toBe(h(8, 30))
    expect(p.workInfo!.fixedMorning).toBe(true)
  })
  it('der harte Termin gewinnt gegen eine Tagesabweichung', () => {
    const p = plan({ commitments: [kunde], override: { workStart: h(9) } })
    expect(work(p)!.start).toBe(h(8, 30))
  })
  it('09:00 entschuldigt nichts: keine Grenz-Warnung statt des Termins', () => {
    const p = plan({ commitments: [kunde] })
    expect(startRisk({ plannedStart: p.workInfo!.plannedStart, latest: latestInfo(base, false), fixedMorning: p.workInfo!.fixedMorning, started: false, m: h(8, 20) })).toBeUndefined()
  })
  it('ein später Kundentermin ersetzt den Wunschbeginn nicht', () => {
    const p = plan({ commitments: [{ ...kunde, start: h(10, 30) }] })
    expect(work(p)!.start).toBe(h(8))
  })
})

describe('F: längere Pause gegen freiwillige Mehrarbeit', () => {
  const sessions = [session(MON, h(8), h(18), [[h(12), h(13, 30)]])]
  it('8 h 30 netto, +30, ohne Aussage über Geld', () => {
    const a = dayActual(sessions, MON, zonedToUtc(MON, h(20)))
    expect(a.netMin).toBe(510)
    const b = dayBalance(a, 480)
    expect(b.diffMin).toBe(30)
    expect(b.text).toBe('30 min zusätzlich gearbeitet')
    expect(b.text).not.toMatch(/€|Überstunde|bezahl/i)
  })
  it('früher Schluss steht neutral da', () => {
    const b = dayBalance(dayActual([session(MON, h(8), h(16), [[h(12), h(13)]])], MON, zonedToUtc(MON, h(20))), 480)
    expect(b.text).toBe('1 h weniger als geplant')
  })
  it('das reale Ende beendet den Arbeitsblock, auch gegen ein gesetztes Ende', () => {
    const p = plan({ sessions, nowMs: zonedToUtc(MON, h(19)), override: { workEnd: h(17) } })
    expect(p.workEnd).toBe(h(18))
    expect(p.workInfo!.closed).toBe(true)
  })
})

describe('G: Einsatz am freien Sonntag', () => {
  const maint: Commitment = { id: 'w', date: SUN, label: 'Update Kunde A', context: 'customer', commitment: 'hard', start: h(10), end: h(11, 30), status: 'planned', routeMode: 'none', prepMin: 15, workKind: 'maintenance' }
  const done = [session(SUN, h(10, 5), h(11, 20), [], { kind: 'maintenance', commitmentId: 'w' })]
  it('bucht 1 h 15, Soll 0, die Grundeinstellung bleibt frei', () => {
    const a = dayActual(done, SUN, zonedToUtc(SUN, h(12)))
    expect(a.netMin).toBe(75)
    expect(workRule(SUN, base).targetNetMin).toBe(0)
    expect(dayBalance(a, 0).text).toBe('1 h 15 min zusätzlich gearbeitet')
    expect(base.work[6]!.isWorkDay).toBe(false)
    expect(plan({ date: SUN, commitments: [maint], sessions: done, nowMs: zonedToUtc(SUN, h(12)) }).dayType).toBe('weekend')
    expect(plan({ date: addDays(SUN, 7) }).dayType).toBe('weekend')
  })
  it('ohne Start bleibt der Plan ein Plan, nichts gilt als gearbeitet', () => {
    expect(dayActual([], SUN, zonedToUtc(SUN, h(12))).netMin).toBe(0)
  })
  it('die Startseite bietet den Einsatz an, danach ist wieder Ruhe', () => {
    const p = plan({ date: SUN, commitments: [maint] })
    const log: DayLog = { date: SUN, override: {}, steps: {}, wakeAt: 1 }
    const at = (m: number, sessions: WorkSession[] = [], commitments = [maint]) => nextAction({ plan: plan({ date: SUN, commitments, sessions, nowMs: zonedToUtc(SUN, m) }), log, m, nowMs: zonedToUtc(SUN, m), settings: base, inbox: [], work: [], sessions }).action
    expect(p.blocks.some((b) => b.kind === 'prep')).toBe(true)
    expect(at(h(9, 50)).type).toBe('einsatz-start')
    expect(at(h(10, 10)).type).toBe('einsatz-start')
    const running = [session(SUN, h(10, 5), undefined, [], { kind: 'maintenance', commitmentId: 'w' })]
    expect(at(h(10, 30), running).type).toBe('einsatz-running')
    expect(at(h(11, 25), done).type).not.toMatch(/einsatz/)
  })
  it('früher fertig: Das restliche Planfenster zeigt nicht mehr den Einsatz', () => {
    const early = { ...maint, backAt: zonedToUtc(SUN, h(10, 20)) }
    const sessions = [session(SUN, h(10, 5), h(10, 20), [], { kind: 'maintenance', commitmentId: 'w' })]
    const p = plan({ date: SUN, commitments: [early], sessions, nowMs: zonedToUtc(SUN, h(10, 25)) })
    expect(nowView(p, { date: SUN, override: {}, steps: {}, wakeAt: 1 }, h(10, 25)).action.title).not.toBe(maint.label)
  })
  it('eine Vorab-Erinnerung, ohne Anlass im Text', () => {
    const rs = buildReminders([plan({ date: SUN, commitments: [maint] })], {}, base, zonedToUtc(SUN, h(5))).filter((r) => r.key === 'prep:w')
    expect(rs).toHaveLength(1)
    expect(rs[0]!.title + rs[0]!.body).not.toMatch(/Kunde|Update/)
  })
  it('das Widget nennt weder Kunde noch Anlass', () => {
    const p = plan({ date: SUN, commitments: [maint] })
    const e = widgetEntry(1, nowView(p, { date: SUN, override: {}, steps: {}, wakeAt: 1 }, h(10, 30)))
    expect(JSON.stringify(e)).not.toMatch(/Update|Kunde/)
    expect(e.action).toBe('Termin')
  })
  it('Sonntag wird sachlich benannt, Samstag nicht', () => {
    expect(isSundayWork(zonedToUtc(SUN, h(10)))).toBe(true)
    expect(isSundayWork(zonedToUtc(SAT, h(10)))).toBe(false)
  })
  it('Rufbereitschaft zählt nicht und blockiert den Tag nicht', () => {
    const onCall: Commitment = { ...maint, id: 'r', label: 'Rufbereitschaft', workKind: 'oncall', commitment: 'soft', prepMin: 0, start: h(9), end: h(18) }
    const p = plan({ date: SUN, commitments: [onCall] })
    const a = nextAction({ plan: p, log: { date: SUN, override: {}, steps: {}, wakeAt: 1 }, m: h(12), nowMs: zonedToUtc(SUN, h(12)), settings: base, inbox: [], work: [], sessions: [] }).action
    expect(a.type).not.toMatch(/einsatz|away/)
    expect(dayActual([], SUN, zonedToUtc(SUN, h(12))).netMin).toBe(0)
  })
})

describe('H: Störung in der Nacht', () => {
  it('23:40 bis 00:30 sind 50 Minuten, nichts geht verloren', () => {
    const s = manualSession('n', SAT, h(23, 40), h(0, 30), [], 'incident')
    expect(s.endAt! - s.startAt).toBe(50 * 60_000)
    expect(dayActual([s], SAT, s.endAt!).netMin).toBe(50)
    expect(dayActual([s], SUN, s.endAt!).netMin).toBe(0)
  })
  it('benennt knappe Ruhe, ohne zu urteilen, und ohne Hinweis bei genug Abstand', () => {
    const end = zonedToUtc(SUN, h(23))
    const next = zonedToUtc(addDays(SUN, 1), h(8))
    expect(restConflict(end, next, 'dem nächsten Arbeitsbeginn', false)!.gapMin).toBe(540)
    expect(restConflict(zonedToUtc(SUN, h(20)), next, 'x', false)).toBeUndefined()
  })
  it('ein Plan nach Mitternacht: das Ende der Einsatzzeit bleibt am selben Plantag', () => {
    const s = manualSession('n', SAT, h(23, 40), h(0, 30), [], 'incident')
    const p = plan({ date: SAT, sessions: [s], nowMs: s.endAt! })
    expect(p.blocks.find((b) => b.id === 'session:n')!.end).toBe(h(24, 30))
  })
})

describe('I: mehrere Abschnitte ohne Doppelzählung', () => {
  it('zwei Sitzungen, drei Pausen, ein Nachtrag', () => {
    const a = session(MON, h(8), h(12), [[h(9), h(9, 15)], [h(11), h(11, 10)]])
    const b = session(MON, h(13), h(16), [[h(14), h(14, 30)]])
    const c = manualSession('m', MON, h(16, 30), h(17), [])
    const d = dayActual([a, b, c], MON, zonedToUtc(MON, h(20)))
    expect(d.grossMin).toBe(240 + 180 + 30)
    expect(d.breakMin).toBe(55)
    expect(d.netMin).toBe(395)
    expect(d.countedBreakMin).toBe(45)
  })
  it('Überschneidungen zählen einmal', () => {
    expect(normalizeIntervals([[0, 10], [5, 20], [30, 40]])).toEqual([[0, 20], [30, 40]])
    const a = session(MON, h(8), h(12))
    const b = { ...session(MON, h(10), h(14)), id: 'x' }
    expect(dayActual([a, b], MON, zonedToUtc(MON, h(20))).netMin).toBe(360)
  })
  it('Mehrfaches Tippen ändert nichts', () => {
    const at = zonedToUtc(MON, h(8))
    const one = startSession([], { id: 'a', date: MON, at })
    expect(startSession(one, { id: 'b', date: MON, at: at + 1000 })).toEqual(one)
    const br = startBreak(one, 'p', at + 3600_000)
    expect(startBreak(br, 'q', at + 3700_000)).toEqual(br)
    const ended = endBreak(br, at + 7200_000)
    expect(endBreak(ended, at + 7300_000)).toEqual(ended)
    const stopped = stopSession(ended, at + 9000_000)
    expect(stopSession(stopped, at + 9500_000)).toEqual(stopped)
    expect(startBreak(stopped, 'r', at + 9600_000)).toEqual(stopped)
  })
  it('Feierabend schließt eine laufende Pause mit, und ein Einsatz startet nur einmal', () => {
    const at = zonedToUtc(MON, h(8))
    const stopped = stopSession(startBreak(startSession([], { id: 'a', date: MON, at }), 'p', at + 60_000), at + 120_000)
    expect(stopped[0]!.breaks[0]!.endAt).toBe(at + 120_000)
    const done = stopSession(startSession([], { id: 'a', date: SUN, at, commitmentId: 'w' }), at + 1000)
    expect(startSession(done, { id: 'b', date: SUN, at: at + 2000, commitmentId: 'w' })).toEqual(done)
  })
  it('Zustand übersteht das Neuladen: eine Sitzung ist nur Daten', () => {
    const at = zonedToUtc(MON, h(8))
    const list = startBreak(startSession([], { id: 'a', date: MON, at }), 'p', at + 3600_000)
    const restored = JSON.parse(JSON.stringify(list)) as WorkSession[]
    expect(dayActual(restored, MON, at + 4 * 3600_000).netMin).toBe(60)
    expect(dayActual(restored, MON, at + 4 * 3600_000).openBreak?.id).toBe('p')
  })
  it('Sommerzeit: Dauer ist echte Zeit, auch über die Umstellung', () => {
    const spring = '2026-03-28'
    const s = manualSession('n', spring, h(23), h(4), [], 'incident')
    expect(dayActual([s], spring, s.endAt!).netMin).toBe(4 * 60)
    const autumn = '2026-10-24'
    const t = manualSession('n', autumn, h(23), h(4), [], 'incident')
    expect(dayActual([t], autumn, t.endAt!).netMin).toBe(6 * 60)
  })
})

describe('J: nichts erfasst', () => {
  const log: DayLog = { date: MON, override: {}, steps: {}, wakeAt: 1, leftAt: 1 }
  it('keine erfundene Ist-Zeit, der Plan bleibt nutzbar', () => {
    const a = dayActual([], MON, zonedToUtc(MON, h(11)))
    expect(a.netMin).toBe(0)
    expect(a.firstStart).toBeUndefined()
    const p = plan()
    expect(p.workInfo!.started).toBe(false)
    expect(nextAction({ plan: p, log, m: h(11), nowMs: zonedToUtc(MON, h(11)), settings: base, inbox: [], work: [], sessions: [] }).action.type).toBe('work')
  })
  it('Donnerstag ohne Erfassung: der Freitag plant normal, und die Woche zählt nur Erfasstes', () => {
    expect(plan({ date: FRI }).workEnd).toBe(h(17))
    const w = weekSummary([{ date: MON, targetMin: 480, netMin: 500 }, { date: addDays(MON, 3), targetMin: 480 }])
    expect(w.diffMin).toBe(20)
    expect(w.trackedDays).toBe(1)
    expect(w.targetMin).toBe(960)
  })
  it('Arbeit nachtragen ohne Timer: 08:15–17:30 mit Pause', () => {
    const s = manualSession('m', MON, h(8, 15), h(17, 30), [{ start: h(12, 15), end: h(13, 30) }])
    expect(s.manual).toBe(true)
    expect(dayActual([s], MON, zonedToUtc(MON, h(20))).netMin).toBe(480)
  })
  it('vergessene Pause lässt sich nur auf Wunsch eintragen', () => {
    const s = session(MON, h(8), h(17))
    expect(dayActual([s], MON, s.endAt!).breakCount).toBe(0)
    const fixed = withUsualBreak(s, 60, 'p')
    expect(dayActual([fixed], MON, s.endAt!).netMin).toBe(480)
  })
  it('eine vergessene Sitzung wird gefunden, nicht still beendet', () => {
    const s = session(MON, h(8))
    expect(staleSession([s], MON, zonedToUtc(MON, h(12)))).toBeUndefined()
    const next = addDays(MON, 1)
    expect(staleSession([s], next, zonedToUtc(next, h(7)))?.id).toBe(s.id)
    expect(s.endAt).toBeUndefined()
    const a = nextAction({ plan: plan({ date: next }), log: { date: next, override: {}, steps: {}, wakeAt: 1 }, m: h(9), nowMs: zonedToUtc(next, h(9)), settings: base, inbox: [], work: [], sessions: [s] }).action
    expect(a.type).toBe('work-stale')
  })
})

describe('K: Schlaf- und Arbeitskonflikt', () => {
  it('ein fester früher Termin bleibt fest und wird als Konflikt benannt', () => {
    const end = zonedToUtc(MON, h(23, 45))
    const c = restConflict(end, zonedToUtc(addDays(MON, 1), h(7)), 'deinem Termin', true)!
    expect(c.hard).toBe(true)
    expect(c.text).toMatch(/nicht auflösen/)
    expect(c.text).not.toMatch(/weniger schlafen|empfehl/i)
  })
  it('ein später Einsatz verschiebt weder Wecker noch Termin von selbst', () => {
    const t = addDays(MON, 1)
    const hard: Commitment = { id: 't', date: t, label: 'Früh', context: 'customer', commitment: 'hard', start: h(7), status: 'planned', routeMode: 'none' }
    expect(plan({ date: t, commitments: [hard] }).wake).toBe(base.anchor.wake)
    expect(plan({ date: t, commitments: [hard] }).blocks.find((b) => b.id === 'commitment:t')!.start).toBe(h(7))
  })
})

describe('Hinweise zu Pause, Ruhezeit und Sonntag', () => {
  const t = addDays(MON, 1)
  it('später Einsatz: Ruhezeit bis zum nächsten Beginn, fester Termin hat Vorrang', () => {
    const late = dayActual([session(MON, h(23), h(23, 45), [], { kind: 'incident' })], MON, zonedToUtc(MON, h(23, 50)))
    expect(workHints({ settings: base, actual: late, next: nextObligation(plan({ date: t }), t) }).join(' ')).toMatch(/nächsten Arbeitsbeginn.*Ruhezeit/)
    const hard: Commitment = { id: 'h', date: t, label: 'Früh', context: 'customer', commitment: 'hard', start: h(7), status: 'planned', routeMode: 'none' }
    expect(nextObligation(plan({ date: t, commitments: [hard] }), t)).toMatchObject({ hard: true, label: 'deinem Termin' })
  })
  it('lange ohne erfasste Pause und Sonntag werden benannt, abschaltbar', () => {
    const long = dayActual([session(SUN, h(8), h(16))], SUN, zonedToUtc(SUN, h(17)))
    const text = workHints({ settings: base, actual: long }).join(' ')
    expect(text).toMatch(/Pause/)
    expect(text).toMatch(/betriebliche Regelung/)
    expect(workHints({ settings: { ...base, flex: { ...base.flex, legalHints: false } }, actual: long })).toEqual([])
  })
  it('ohne Erfassung kein Hinweis', () => {
    expect(workHints({ settings: base, actual: dayActual([], MON, 0) })).toEqual([])
  })
})

describe('L: Daten und Altbestand', () => {
  it('alte Einstellungen bleiben, neue Felder sind da', () => {
    const old: Partial<Settings> = { ...defaultSettings('2026-01-01'), work: base.work.map((w) => ({ ...w, start: h(7, 30), durationMin: 450 })) }
    delete old.flex
    const m = migrateSettings(old as Settings, '2026-11-01')
    expect(m.work[0]!.start).toBe(h(7, 30))
    expect(m.work[0]!.durationMin).toBe(450)
    expect(m.flex.latestStart).toBe(h(9))
    expect(m.flex.tracking).toBe(true)
  })
  it('eine geänderte Grenze bleibt erhalten, und keine Grenze ist erlaubt', () => {
    const m = migrateSettings({ ...base, flex: { ...base.flex, latestStart: h(9, 30) } }, '2026-11-01')
    expect(m.flex.latestStart).toBe(h(9, 30))
    expect(latestInfo({ ...base, flex: { ...base.flex, latestStart: null } }, false)).toBeUndefined()
    expect(plan({ settings: { ...base, flex: { ...base.flex, latestStart: null } } }).workInfo!.latestStart).toBeUndefined()
  })
  it('alte lokale Daten bekommen eine leere Liste', () => {
    const stored = { commitments: [], places: [], work: [], handover: {}, meds: {} }
    expect({ ...emptyLocal(), ...stored }.workSessions).toEqual([])
  })
  it('alte Tageslogs mit workEnd funktionieren weiter', () => {
    expect(plan({ override: { workEnd: h(19) } }).workEnd).toBe(h(19))
  })
  it('ein Freitags-Override lässt den Montag unberührt', () => {
    plan({ date: FRI, override: { workStart: h(9), pauseMin: 90, targetNetMin: 300 } })
    expect(plan({ date: addDays(FRI, 3) }).workEnd).toBe(h(17))
  })
  it('kürzer gearbeitet zählt nicht gegen den Tag, und Erfassung wirkt nicht aufs Spiel', () => {
    const log: DayLog = { date: MON, override: { adjusted: true, workEnd: h(14) }, steps: {} }
    expect(dayStatus(plan({ override: log.override }), log, base, true)).not.toBe('missed')
    const noTrack = dayStatus(plan(), { date: MON, override: {}, steps: {} }, base, false)
    const tracked = dayStatus(plan({ sessions: [session(MON, h(8), h(17))], nowMs: zonedToUtc(MON, h(18)) }), { date: MON, override: {}, steps: {} }, base, false)
    expect(tracked).toBe(noTrack)
  })
  it('der Wecker bleibt von Erfassung unberührt', () => {
    const before = buildAlarmConfig(base, {}, MON)
    plan({ sessions: [session(MON, h(8))], nowMs: zonedToUtc(MON, h(9)) })
    expect(buildAlarmConfig(base, {}, MON)).toEqual(before)
  })
})

describe('Arbeit im Tagesablauf', () => {
  const log: DayLog = { date: MON, override: {}, steps: {}, wakeAt: 1 }
  it('gestartete Arbeit beendet Losgehen und seine Meldungen, ohne „pünktlich los“ zu behaupten', () => {
    const s = [session(MON, h(7, 10))]
    const p = plan({ sessions: s, nowMs: zonedToUtc(MON, h(7, 20)) })
    expect(p.workInfo!.started).toBe(true)
    expect(nowView(p, log, h(7, 20)).action.type).not.toBe('leave')
    expect(buildReminders([p], {}, base, zonedToUtc(MON, h(7, 12))).some((r) => r.key === 'leave')).toBe(false)
    expect(log.leftAt).toBeUndefined()
  })
  it('nach Feierabend steht nicht mehr Arbeit da', () => {
    const s = [session(MON, h(8), h(16), [[h(12), h(13)]])]
    const p = plan({ sessions: s, nowMs: zonedToUtc(MON, h(16, 30)), settings: { ...base, commute: { ...base.commute, minutes: 0 } } })
    expect(nowView(p, { ...log, leftAt: 1 }, h(16, 30)).action.type).not.toBe('work')
  })
  it('während der Pause ist die Pause die eine Aktion', () => {
    const s = [session(MON, h(8), undefined, [[h(12), undefined]])]
    const p = plan({ sessions: s, nowMs: zonedToUtc(MON, h(12, 30)) })
    const a = nextAction({ plan: p, log: { ...log, leftAt: 1 }, m: h(12, 30), nowMs: zonedToUtc(MON, h(12, 30)), settings: base, inbox: [], work: [], sessions: s }).action
    expect(a.type).toBe('work-break')
    expect(a.sub).toMatch(/Feierabend/)
  })
  it('über das Soll hinaus bleibt der Arbeitsblock offen', () => {
    const s = [session(MON, h(8), undefined, [[h(12), h(13)]])]
    const p = plan({ sessions: s, nowMs: zonedToUtc(MON, h(17, 40)) })
    expect(p.workEnd).toBe(h(17, 40))
    expect(nowView(p, { ...log, leftAt: 1 }, h(17, 39)).action.type).toBe('work')
  })
  it('spätes Ende gegen Abendtermin wird benannt, der Termin bleibt', () => {
    const film: Commitment = { id: 'f', date: MON, label: 'Film', context: 'social', commitment: 'hard', start: h(18), status: 'planned', placeLabel: 'Kino', travelMin: 30 }
    const p = plan({ commitments: [film], override: { workEnd: h(18) } })
    expect(p.conflicts?.join(' ')).toMatch(/Feierabend 18:00.*Film/)
    expect(p.blocks.find((b) => b.id === 'commitment:f')!.start).toBe(h(18))
  })
  it('späteste Abfahrt und Grenze melden sich je einmal, ohne Slot-Sonderweg', () => {
    const rs = buildReminders([plan()], {}, base, zonedToUtc(MON, h(5)))
    expect(rs.filter((r) => r.key === 'latest-leave')).toHaveLength(1)
    const ho = buildReminders([plan({ override: { homeOffice: true } })], {}, base, zonedToUtc(MON, h(5)))
    expect(ho.filter((r) => r.key === 'latest-start')).toHaveLength(1)
    expect(rs.find((r) => r.key === 'latest-leave')!.slot).toBe(1)
    const none = buildReminders([plan({ sessions: [session(MON, h(7))], nowMs: zonedToUtc(MON, h(7, 5)) })], {}, base, zonedToUtc(MON, h(7, 5)))
    expect(none.some((r) => r.key === 'latest-leave')).toBe(false)
  })
})
