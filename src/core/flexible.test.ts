import { describe, expect, it } from 'vitest'
import { buildAlarmConfig, nextAlarmTimes } from './alarm'
import { applySchedule, defaultSettings, migrateSettings } from './defaults'
import { applyAwards, dayStatus } from './game'
import { initialGame } from './game'
import { routineCompleted, routineDone } from './now'
import { buildDayPlan, mapsUrl, parseQuickTime } from './planner'
import { buildReminders } from './reminders/build'
import { morningNeed, sleepOutlook, wakeProposal } from './sleep'
import { nextAction } from './support'
import { addDays, zonedToUtc } from './time'
import type { Commitment, DayLog, DayOverride, Settings } from './types'
import { outdoorWindow, weatherAdvice } from './weather'

const MON = '2026-11-02'
const TUE = '2026-11-03'
const s = defaultSettings('2026-11-01')
const c = (patch: Partial<Commitment> = {}): Commitment => ({ id: 'c1', date: MON, label: 'Film', context: 'social', commitment: 'soft', start: 17 * 60, status: 'planned', ...patch })
const plan = (o: { override?: DayOverride; commitments?: Commitment[]; date?: string; settings?: Settings; covered?: string[] } = {}) => buildDayPlan({ date: o.date ?? MON, settings: o.settings ?? s, override: o.override, commitments: o.commitments, covered: o.covered })
const ho: DayOverride = { homeOffice: true }
const log = (patch: Partial<DayLog> = {}): DayLog => ({ date: MON, override: {}, steps: {}, wakeAt: 1, ...patch })
const next = (p: ReturnType<typeof plan>, m: number, l = log()) => nextAction({ plan: p, log: l, m, nowMs: zonedToUtc(p.date, m), settings: s, inbox: [], work: [] })

describe('T1 Homeoffice', () => {
  it('kein Arbeitsweg, und am nächsten Tag gilt wieder der Standard', () => {
    const today = plan({ override: ho })
    expect(today.blocks.some((b) => b.kind === 'commute')).toBe(false)
    const tomorrow = plan({ date: TUE })
    expect(tomorrow.blocks.some((b) => b.kind === 'commute')).toBe(true)
    expect(s.work[0]!.homeOffice).toBe(false)
  })
  it('schlägt eine spätere Weckzeit vor, ändert sie aber nicht selbst', () => {
    const p = plan({ override: ho })
    expect(p.wake).toBe(s.anchor.wake)
    const w = wakeProposal(p, s)!
    expect(w.later).toBe(true)
    expect(w.wake).toBeGreaterThan(s.anchor.wake)
  })
})

describe('T2 Film bei Freundin', () => {
  const film = c({ placeLabel: 'Bei Lena', travelMin: 20 })
  const p = plan({ override: ho, commitments: [film] })
  const leg = p.legs![0]!

  it('Weg von zuhause, kein Heimweg von der Arbeit, Vorbereitung vorher', () => {
    expect(leg.fromLabel).toBe('Zuhause')
    expect(leg.leave).toBe(17 * 60 - 10 - 20)
    expect(leg.prepStart).toBe(leg.leave! - s.travel.prepMin)
    expect(p.blocks.some((b) => b.title === 'Heimweg')).toBe(false)
  })
  it('Abendroutine wartet ohne erfundene Rückkehr und gilt nicht als erledigt', () => {
    expect(p.pendingEvening).toBe(true)
    expect(p.blocks.some((b) => b.routine === 'evening')).toBe(false)
    expect(routineCompleted(p, log(), 'evening')).toBe(false)
  })
  it('während des Films keine Abendroutine, kein PC-Stopp, kein Bett als Ping', () => {
    const r = buildReminders([p], {}, s, zonedToUtc(MON, 12 * 60))
    expect(r.some((x) => x.key === 'evening')).toBe(false)
    expect(r.some((x) => x.key === 'pcstop' || x.key === 'bed' || x.key === 'pcstop-15')).toBe(false)
    expect(r.some((x) => x.key === `go:${film.id}`)).toBe(true)
    expect(r.find((x) => x.key === `go:${film.id}`)!.at).toBe(zonedToUtc(MON, leg.leave!))
  })
  it('Erinnerungstexte nennen weder Anlass noch Ort', () => {
    const r = buildReminders([p], {}, s, zonedToUtc(MON, 12 * 60)).filter((x) => x.key.includes(film.id))
    expect(JSON.stringify(r)).not.toMatch(/Film|Lena/)
  })
  it('die Startseite führt Schritt für Schritt: Vorbereiten, los, unterwegs, dort', () => {
    expect(next(p, leg.prepStart!).action.type).toBe('prep')
    expect(next(p, leg.leave!).action.type).toBe('go')
    const left = plan({ override: ho, commitments: [{ ...film, leftAt: 1 }] })
    expect(next(left, leg.leave! + 5).action.type).toBe('underway')
    expect(next(p, 18 * 60).action.type).toBe('away')
  })
})

describe('T3 Später schlafen mit festem Termin', () => {
  const kunde = c({ id: 'k', date: TUE, label: 'Kunde', context: 'customer', commitment: 'hard', start: 8 * 60 + 30, placeLabel: 'Kunde A', travelMin: 40, replacesCommute: true })
  const tomorrow = plan({ date: TUE, commitments: [kunde] })
  it('der Kunde wird nicht verschoben, und der Morgen rechnet rückwärts', () => {
    expect(tomorrow.legs![0]!.commitment.start).toBe(8 * 60 + 30)
    expect(tomorrow.leave).toBe(8 * 60 + 30 - 10 - 40)
    const need = morningNeed(tomorrow, s)!
    expect(need.readyAt).toBe(tomorrow.leave)
    expect(need.latestWakeMinimal).toBeGreaterThanOrEqual(need.latestWake)
  })
  it('zeigt die kurze Nacht neutral, ohne Empfehlung', () => {
    const o = sleepOutlook(1440 + 30, 6 * 60, s)
    expect(o.short).toBe(true)
    expect(o.sleepMin).toBe(5 * 60 + 15)
    expect(o.text).not.toMatch(/musst|solltest|schlecht|Fehler|versäum/i)
  })
  it('„Länger wach“ verschiebt nur Grenzen des Abends, keine anderen Tage', () => {
    const late = plan({ override: { lateUntil: 1440 + 30 } })
    expect(late.pcStop).toBe(1440 + 30)
    expect(late.bed).toBeGreaterThan(late.pcStop)
    expect(plan({ date: TUE }).pcStop).toBe(plan().pcStop)
    const r = buildReminders([late], {}, s, zonedToUtc(MON, 12 * 60))
    expect(r.find((x) => x.key === 'pcstop')!.at).toBe(zonedToUtc(MON, 1440 + 30))
  })
  it('„Weiß ich noch nicht“: keine erfundene Bettzeit, keine Pings, Wecker bleibt', () => {
    const open = plan({ override: { lateUntil: 'open' } })
    expect(open.openEnd).toBe(true)
    expect(open.hardTimes.some((h) => h.key === 'bed' || h.key === 'pc-stop')).toBe(false)
    const r = buildReminders([open], {}, s, zonedToUtc(MON, 12 * 60))
    expect(r.some((x) => x.key === 'bed' || x.key === 'pcstop')).toBe(false)
    expect(nextAlarmTimes(buildAlarmConfig(s, {}, MON), zonedToUtc(MON, 23 * 60)).mainAt).toBe(zonedToUtc(TUE, s.anchor.wake))
  })
})

describe('T4 und T16 Einmalige Weckzeit', () => {
  it('gilt nur für diesen Tag, Standard und Folgetag bleiben', () => {
    const days = { [TUE]: { date: TUE, override: { wakeOverride: 8 * 60 }, steps: {} } }
    const cfg = buildAlarmConfig(s, days, MON)
    expect(nextAlarmTimes(cfg, zonedToUtc(MON, 12 * 60)).mainAt).toBe(zonedToUtc(TUE, 8 * 60))
    expect(nextAlarmTimes(cfg, zonedToUtc(TUE, 9 * 60)).mainAt).toBe(zonedToUtc('2026-11-04', s.anchor.wake))
    expect(s.anchor.wake).not.toBe(8 * 60)
  })
  it('vergangene Ausnahmen werden nicht mehr übertragen', () => {
    const days = { [MON]: { date: MON, override: { wakeOverride: 8 * 60 }, steps: {} } }
    expect(buildAlarmConfig(s, days, TUE).wakeOverrides).toEqual({})
  })
  it('der Plan nutzt die Ausnahme, die anderen Tage nicht', () => {
    expect(plan({ override: { wakeOverride: 8 * 60 } }).wake).toBe(8 * 60)
    expect(plan({ date: TUE }).wake).toBe(s.anchor.wake)
  })
})

describe('T5 Dusch-Regel', () => {
  it('der Schritt entfällt morgen, gilt dort aber nicht als erledigt', () => {
    const p = plan({ date: TUE, covered: ['morning:shower'] })
    const steps = p.blocks.find((b) => b.routine === 'morning')!.steps!
    expect(steps.some((x) => x.id === 'shower')).toBe(false)
    const g = initialGame('2026-11-01')
    const a = applyAwards(p, { date: TUE, override: {}, steps: {} }, g, s)
    expect(a.gained).toBe(0)
  })
  it('lässt sich für einen Tag übersteuern und betrifft nur diesen Tag', () => {
    const p = plan({ date: TUE, covered: ['morning:shower'], override: { uncoveredSteps: ['morning:shower'] } })
    expect(p.blocks.find((b) => b.routine === 'morning')!.steps!.some((x) => x.id === 'shower')).toBe(true)
    expect(plan().blocks.find((b) => b.routine === 'morning')!.steps!.some((x) => x.id === 'shower')).toBe(true)
  })
  it('ohne gesetzte Regel passiert nichts', () => {
    expect(s.routineLinks).toEqual([])
  })
})

describe('T6 und T15 Fahrzeit und Konflikte', () => {
  it('ohne Fahrzeit keine erfundene Abfahrt, und das steht auch da', () => {
    const p = plan({ commitments: [c({ placeLabel: 'Kunde', context: 'customer', commitment: 'hard', start: 14 * 60 })] })
    const leg = p.legs![0]!
    expect(leg.travelOpen).toBe(true)
    expect(leg.leave).toBeUndefined()
    expect(p.notes.join()).toMatch(/Fahrzeit/)
  })
  it('eine neue Schätzung rechnet den Weg neu, Ankunft bleibt', () => {
    const base = { placeLabel: 'Kunde', commitment: 'hard' as const, context: 'customer' as const, start: 9 * 60, date: TUE, replacesCommute: true }
    const a = plan({ date: TUE, commitments: [c({ ...base, travelMin: 40 })] })
    const b = plan({ date: TUE, commitments: [c({ ...base, travelMin: 55 })] })
    expect(a.leave! - b.leave!).toBe(15)
    expect(b.legs![0]!.commitment.start).toBe(9 * 60)
  })
  it('zwei harte Termine: Konflikt wird benannt, nichts wird verschoben', () => {
    const hard = { commitment: 'hard' as const, context: 'personal' as const, routeMode: 'none' as const }
    const p = plan({ commitments: [c({ ...hard, id: 'a', label: 'Arzt', start: 18 * 60, end: 19 * 60 }), c({ ...hard, id: 'b', label: 'Bank', start: 18 * 60 + 30 })] })
    expect(p.conflicts).toEqual(['„Arzt“ und „Bank“ überschneiden sich.'])
    expect(p.legs!.map((l) => l.commitment.start)).toEqual([18 * 60, 18 * 60 + 30])
  })
  it('Karten-Link ohne Key, Adresse sauber kodiert', () => {
    const u = mapsUrl('Musterstr. 1, Köln', 'transit')
    expect(u).toContain('https://www.google.com/maps/dir/?api=1&destination=Musterstr.%201%2C%20K%C3%B6ln')
    expect(u).toContain('travelmode=transit')
    expect(u).not.toMatch(/key=/)
  })
})

describe('T7 Zwei Orte, kein Umweg', () => {
  it('Büro → Kunde → Freundin, ohne Heimfahrt', () => {
    const sets = structuredClone(s)
    sets.work[0] = { ...sets.work[0]!, start: 8 * 60, durationMin: 8 * 60, pauseMin: 0 }
    const p = plan({
      settings: sets,
      commitments: [
        c({ id: 'b', label: 'Kunde B', context: 'customer', commitment: 'hard', start: 16 * 60 + 30, end: 17 * 60 + 30, placeLabel: 'Kunde B', travelMin: 20 }),
        c({ id: 'f', label: 'Freundin', start: 18 * 60, placeLabel: 'Freundin', travelMin: 15 }),
      ],
    })
    expect(p.legs!.map((l) => `${l.fromLabel} → ${l.toLabel}`)).toEqual(['Büro → Kunde B', 'Kunde B → Freundin'])
    expect(p.blocks.some((b) => b.title === 'Heimweg')).toBe(false)
  })
})

describe('T8 und T9 Rückkehr und Absage', () => {
  const offen = c({ placeLabel: 'Freunde', travelMin: 10, start: 19 * 60 })
  it('keine erfundene Rückkehr. Spät zurück: nur die kurze Routine, keine Liste', () => {
    const p = plan({ commitments: [offen] })
    expect(p.pendingEvening).toBe(true)
    const back = plan({ commitments: [{ ...offen, backAt: zonedToUtc(MON, 23 * 60 + 30) }] })
    const e = back.blocks.find((b) => b.routine === 'evening')!
    expect(e.start).toBeGreaterThanOrEqual(23 * 60 + 30)
    expect(e.steps!.filter((x) => x.minimal).every((x) => x.useMinimal)).toBe(true)
    expect(back.bed).toBeGreaterThanOrEqual(e.end)
    expect(next(back, 23 * 60 + 31, log({ leftAt: 1 })).action.type).toBe('step')
  })
  it('mit festem Ende kommt die Routine danach', () => {
    const p = plan({ commitments: [c({ ...offen, end: 21 * 60, travelHomeMin: 20 })] })
    expect(p.blocks.find((b) => b.routine === 'evening')!.start).toBeGreaterThanOrEqual(21 * 60 + 10)
  })
  it('Absage: Plan wie vorher, kein doppelter Satz', () => {
    const p = plan({ commitments: [{ ...offen, status: 'cancelled' }] })
    expect(p.legs).toEqual([])
    expect(p.blocks.filter((b) => b.routine === 'evening')).toHaveLength(1)
    expect(p.blocks.find((b) => b.routine === 'evening')).toEqual(plan().blocks.find((b) => b.routine === 'evening'))
  })
})

describe('T14 Freie Entscheidung und Spiel', () => {
  const notNeeded = Object.fromEntries(plan().blocks.find((b) => b.routine === 'evening')!.steps!.map((x) => [`evening:${x.id}`, 'not-needed' as const]))
  it('„Heute nicht nötig“ ist kein Erledigt und bringt keine XP', () => {
    const p = plan()
    const l: DayLog = { date: MON, override: { adjusted: true }, steps: notNeeded }
    expect(routineDone(p, l, 'evening')).toBe(true)
    expect(routineCompleted(p, l, 'evening')).toBe(false)
    expect(applyAwards(p, l, initialGame('2026-11-01'), s).gained).toBe(0)
  })
  it('ein bewusst anderer Tag zählt nicht als verfehlt, ein gewöhnlicher bleibt wie bisher', () => {
    const p = plan()
    expect(dayStatus(p, { date: MON, override: { adjusted: true, lateUntil: 1500 }, steps: {} }, s, true)).toBe('neutral')
    expect(dayStatus(p, { date: MON, override: {}, steps: {} }, s, true)).toBe('missed')
  })
  it('kein XP-Verlust: Bereits Verdientes bleibt', () => {
    const g = { ...initialGame('2026-11-01'), xp: 500 }
    const l: DayLog = { date: MON, override: { adjusted: true }, steps: notNeeded }
    expect(applyAwards(plan(), l, g, s).game.xp).toBe(500)
  })
  it('wirklich Gemachtes zählt auch an einem anderen Tag', () => {
    const p = plan()
    const key = `evening:${p.blocks.find((b) => b.routine === 'evening')!.steps![0]!.id}`
    const l: DayLog = { date: MON, override: { adjusted: true }, steps: { ...notNeeded, [key]: 'done' } }
    expect(routineCompleted(p, l, 'evening')).toBe(true)
    expect(applyAwards(p, l, initialGame('2026-11-01'), s).gained).toBeGreaterThan(0)
  })
  it('„Heute nicht nötig“ ändert den Standard nicht', () => {
    expect(s.routines.evening.length).toBeGreaterThan(0)
    expect(plan({ date: TUE }).blocks.find((b) => b.routine === 'evening')!.steps!.length).toBe(s.routines.evening.length)
  })
})

describe('T17 Tageswechsel und Zeitgrenzen', () => {
  it('Ereignis über Mitternacht: keine negativen Dauern', () => {
    const p = plan({ commitments: [c({ start: 22 * 60 + 30, end: 1440 + 60, routeMode: 'none' })] })
    for (const b of p.blocks) expect(b.end).toBeGreaterThanOrEqual(b.start)
    expect(p.blocks.find((b) => b.routine === 'evening')!.start).toBeGreaterThanOrEqual(1440 + 60)
    expect(p.bed).toBeGreaterThanOrEqual(p.blocks.find((b) => b.routine === 'evening')!.end)
  })
  it('Sommerzeit: Termin und Weg bleiben Wandzeit', () => {
    const d = '2026-03-29'
    const p = plan({ date: d, commitments: [c({ date: d, start: 9 * 60, placeLabel: 'X', travelMin: 30, commitment: 'hard', context: 'personal' })] })
    const r = buildReminders([p], {}, s, zonedToUtc(addDays(d, -1), 12 * 60)).find((x) => x.key === 'go:c1')!
    expect(r.at).toBe(Date.parse('2026-03-29T06:20:00Z'))
  })
  it('alle Blöcke bleiben auch bei offenem Ende gültig', () => {
    const p = plan({ override: { lateUntil: 'open' }, commitments: [c({ routeMode: 'none' })] })
    for (const b of p.blocks) expect(b.end).toBeGreaterThanOrEqual(b.start)
  })
})

describe('T18 Datenschutz', () => {
  it('Termine erreichen den Wecker-Spiegel nicht', () => {
    const cfg = JSON.stringify(buildAlarmConfig(s, {}, MON))
    expect(cfg).not.toMatch(/commit|place|address/i)
  })
  it('neue Felder werden migriert, alte Einstellungen bleiben', () => {
    const old = structuredClone(s) as unknown as Record<string, unknown>
    delete old.travel
    delete old.weather
    delete old.routineLinks
    delete old.askReason
    const m = migrateSettings(old as unknown as Settings, MON)
    expect(m.travel.arrivalBufferMin).toBe(10)
    expect(m.weather.enabled).toBe(false)
    expect(m.routineLinks).toEqual([])
    expect(m.routines).toEqual(s.routines)
    expect(applySchedule(m).anchor.wake).toBe(s.anchor.wake)
  })
})

describe('Schnelleingabe', () => {
  it('liest nur eine klar genannte Uhrzeit', () => {
    expect(parseQuickTime('Film ab 17 Uhr bei Lena')).toBe(17 * 60)
    expect(parseQuickTime('18:30 Arzt')).toBe(18 * 60 + 30)
    expect(parseQuickTime('Film bei Lena')).toBeUndefined()
    expect(parseQuickTime('25 Uhr')).toBeUndefined()
  })
})

describe('T11 Wetter', () => {
  const hours = [6, 7, 8, 9].map((h) => ({ minutes: h * 60, tempC: 10, apparentC: 8 + h - 6, rainPct: h === 8 ? 60 : 10, windKmh: 5 }))
  const rules = s.weather.rules
  it('nur für die tatsächliche Zeit draußen, Regeln sind die eigenen', () => {
    const a = weatherAdvice(hours, { from: 7 * 60 + 15, to: 8 * 60 }, rules)!
    expect(a.summary).toContain('9 bis 10 °C')
    expect(a.summary).toContain('60 %')
    expect(a.suggestions).toEqual(['Jacke', 'Regenjacke oder Schirm'])
  })
  it('ohne Daten keine Aussage', () => {
    expect(weatherAdvice([], { from: 420, to: 480 }, rules)).toBeUndefined()
  })
  it('Homeoffice ohne Termin: keine Karte', () => {
    expect(outdoorWindow(plan({ override: ho }))).toBeUndefined()
    expect(outdoorWindow(plan())).toBeDefined()
  })
})
