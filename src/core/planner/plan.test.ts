import { describe, expect, it } from 'vitest'
import { defaultSettings, deriveSchedule, suggestSchedule } from '../defaults'
import { zonedToUtc } from '../time'
import type { CalendarEvent, Settings } from '../types'
import { buildDayPlan, currentBlock, extendPcStop, fitSteps, nextHardTime, placeAfter, busyMinutes, workLonger } from './index'

const MON = '2026-11-02'
const TUE = '2026-11-03'
const FRI = '2026-11-06'
const SAT = '2026-11-07'
const SUN = '2026-11-08'

function settings(patch: Partial<Settings> = {}): Settings {
  return { ...defaultSettings('2026-11-01'), ...patch }
}

function ev(date: string, from: number, to: number, title = 'Termin'): CalendarEvent {
  return { id: `${date}-${from}`, title, start: zonedToUtc(date, from), end: zonedToUtc(date, to) }
}

const kinds = (p: ReturnType<typeof buildDayPlan>) => p.blocks.map((b) => b.kind)
const block = (p: ReturnType<typeof buildDayPlan>, k: string) => p.blocks.find((b) => b.kind === k)!

describe('Zeitplan-Vorschlag', () => {
  it('rechnet rückwärts vom Arbeitsbeginn', () => {
    const s = suggestSchedule({ workStart: 480, commuteMin: 35, bufferMin: 10, morningMin: 53, sportExtraMin: 10, sleepNeedMin: 480, fallAsleepMin: 15, screenOffMin: 30 })
    expect(s).toEqual({ leave: 435, wake: 370, bed: 1315, pcStop: 1285 })
  })
  it('Standardwerte ergeben 06:10 / 21:25 / 21:55', () => {
    const s = settings()
    expect(s.anchor.wake).toBe(370)
    expect(s.pcStop).toBe(1285)
    expect(s.bed).toBe(1315)
    expect(deriveSchedule(s).leave).toBe(435)
  })
})

describe('Arbeitstag', () => {
  const p = buildDayPlan({ date: MON, settings: settings() })

  it('hat die richtige Reihenfolge', () => {
    expect(kinds(p)).toEqual(['wake', 'morning', 'commute', 'work', 'commute', 'evening-plan', 'evening-routine', 'free', 'pc-stop', 'bed'])
  })
  it('harte Zeiten: Aufstehen, Losgehen, PC-Stopp, Bett', () => {
    expect(p.hardTimes.map((h) => [h.key, h.at])).toEqual([
      ['wake', 370],
      ['leave', 435],
      ['pc-stop', 1285],
      ['bed', 1315],
    ])
  })
  it('Morgenroutine endet spätestens beim Losgehen', () => {
    expect(block(p, 'morning').end).toBeLessThanOrEqual(435)
    expect(block(p, 'morning').minimal).toBe(false)
  })
  it('Montag ist Sporttag: Training zu Hause ersetzt die Bewegung', () => {
    const move = block(p, 'morning').steps!.find((s) => s.tag === 'movement')!
    expect(move.minutes).toBe(20)
    expect(move.title).toContain('Training zu Hause')
  })
  it('Dienstag ohne Sport: 10 Minuten Bewegung', () => {
    const t = buildDayPlan({ date: TUE, settings: settings() })
    expect(block(t, 'morning').steps!.find((s) => s.tag === 'movement')!.minutes).toBe(10)
  })
  it('Feierabend 17:00, zu Hause 17:35, Abendroutine vor der Freizeit', () => {
    expect(p.workEnd).toBe(17 * 60)
    expect(block(p, 'evening-plan').start).toBe(17 * 60 + 35)
    expect(block(p, 'evening-routine').end).toBeLessThanOrEqual(block(p, 'free').start)
    expect(block(p, 'free').end).toBe(1285)
  })
  it('keine Hinweise an einem normalen Tag', () => {
    expect(p.notes).toEqual([])
  })
})

describe('Ich mache heute länger', () => {
  it('verschiebt den Abend, PC-Stopp und Bett bleiben fix', () => {
    const s = settings()
    const base = buildDayPlan({ date: MON, settings: s })
    const o = workLonger({}, base, 120)
    const p = buildDayPlan({ date: MON, settings: s, override: o })
    expect(p.workEnd).toBe(19 * 60)
    expect(p.pcStop).toBe(base.pcStop)
    expect(p.bed).toBe(base.bed)
    expect(block(p, 'evening-plan').start).toBe(19 * 60 + 35)
    expect(p.notes.some((n) => n.includes('Heute länger'))).toBe(true)
  })
  it('sehr spät: Abendroutine kurz, Abendplan gekürzt, alles vor dem PC-Stopp', () => {
    const p = buildDayPlan({ date: MON, settings: settings(), override: { workEnd: 20 * 60 + 15 } })
    const r = block(p, 'evening-routine')
    expect(r.end).toBeLessThanOrEqual(p.pcStop)
    expect(r.minimal).toBe(true)
    expect(p.notes.join(' ')).toMatch(/Wenig Zeit|kurzer Version/)
  })
})

describe('Wochenende, Urlaub, Krank, Homeoffice', () => {
  it('Wochenende: gleiche Aufstehzeit, kein Losgehen', () => {
    const p = buildDayPlan({ date: SAT, settings: settings() })
    expect(p.wake).toBe(370)
    expect(p.hardTimes.find((h) => h.key === 'leave')).toBeUndefined()
    expect(kinds(p)).toContain('day')
    expect(block(p, 'evening-plan').start).toBe(18 * 60)
  })
  it('Urlaub an einem Arbeitstag', () => {
    const p = buildDayPlan({ date: MON, settings: settings(), override: { dayType: 'vacation' } })
    expect(p.dayType).toBe('vacation')
    expect(kinds(p)).not.toContain('work')
    // Kein Sport im Urlaub als Pflicht
    expect(block(p, 'morning').steps!.find((s) => s.tag === 'movement')!.minutes).toBe(10)
  })
  it('Krank: nur Basis-Routine, nur Bett als harte Zeit', () => {
    const p = buildDayPlan({ date: MON, settings: settings(), override: { dayType: 'sick' } })
    expect(p.hardTimes.map((h) => h.key)).toEqual(['bed'])
    expect(block(p, 'morning').steps!.every((s) => s.tag === 'teeth' || s.tag === 'face')).toBe(true)
    expect(p.notes[0]).toContain('Krank-Modus')
  })
  it('Homeoffice: kein Arbeitsweg', () => {
    const p = buildDayPlan({ date: MON, settings: settings(), override: { homeOffice: true } })
    expect(kinds(p)).not.toContain('commute')
    expect(p.hardTimes.find((h) => h.key === 'leave')).toBeUndefined()
    expect(block(p, 'evening-plan').start).toBe(17 * 60)
  })
})

describe('Kalendertermine', () => {
  it('Termin vor der Arbeit verkürzt die Morgenroutine auf Minimal-Version', () => {
    const p = buildDayPlan({ date: TUE, settings: settings(), events: [ev(TUE, 6 * 60 + 40, 7 * 60, 'Arzt')] })
    const m = block(p, 'morning')
    expect(m.end).toBeLessThanOrEqual(6 * 60 + 40)
    expect(m.minimal).toBe(true)
    expect(p.notes.some((n) => n.includes('Arzt') && n.includes('Minimal'))).toBe(true)
  })
  it('Termin am Abend: Abendroutine überschneidet sich nicht', () => {
    const e = ev(TUE, 18 * 60 + 20, 19 * 60 + 30, 'Physio')
    const p = buildDayPlan({ date: TUE, settings: settings(), events: [e] })
    const r = block(p, 'evening-routine')
    const plan = block(p, 'evening-plan')
    for (const b of [r, plan]) expect(b.end <= 18 * 60 + 20 || b.start >= 19 * 60 + 30).toBe(true)
    expect(kinds(p)).toContain('event')
  })
  it('Termin bis nach dem PC-Stopp wird gemeldet', () => {
    const p = buildDayPlan({ date: TUE, settings: settings(), events: [ev(TUE, 20 * 60, 23 * 60, 'Konzert')] })
    expect(p.notes.some((n) => n.includes('Konzert') && n.includes('PC-Stopp'))).toBe(true)
  })
  it('Termin über Mitternacht', () => {
    const e: CalendarEvent = { id: 'x', title: 'Nachtschicht', start: zonedToUtc(TUE, 23 * 60), end: zonedToUtc('2026-11-04', 60) }
    const p = buildDayPlan({ date: TUE, settings: settings(), events: [e] })
    const b = p.blocks.find((x) => x.kind === 'event')!
    expect([b.start, b.end]).toEqual([1380, 1500])
  })
  it('Ganztägige Termine erscheinen nur als Hinweis', () => {
    const p = buildDayPlan({ date: TUE, settings: settings(), events: [{ id: 'g', title: 'Geburtstag Mama', start: zonedToUtc(TUE, 0), end: zonedToUtc(TUE, 1440), allDay: true }] })
    expect(p.notes).toContain('Heute: Geburtstag Mama')
    expect(kinds(p)).not.toContain('event')
  })
  it('Termin als Abendplan ersetzt den Standard-Block', () => {
    const p = buildDayPlan({ date: TUE, settings: settings(), override: { evening: 'appointment' }, events: [ev(TUE, 19 * 60, 20 * 60, 'Elternabend')] })
    expect(kinds(p)).not.toContain('evening-plan')
    expect(block(p, 'evening-routine').start).toBeGreaterThanOrEqual(20 * 60)
  })
})

describe('Randfälle', () => {
  it('Zeitumstellung (Sommerzeit-Ende): Termin 10:00 bleibt 10:00', () => {
    const date = '2026-10-25'
    const p = buildDayPlan({ date, settings: settings(), events: [ev(date, 600, 660)] })
    expect(p.blocks.find((b) => b.kind === 'event')!.start).toBe(600)
  })
  it('Zeitumstellung (Sommerzeit-Beginn): Termin 10:00 bleibt 10:00', () => {
    const date = '2027-03-28'
    const p = buildDayPlan({ date, settings: settings(), events: [ev(date, 600, 660)] })
    expect(p.blocks.find((b) => b.kind === 'event')!.start).toBe(600)
  })
  it('Bettzeit nach Mitternacht wird als 24+ Uhr behandelt', () => {
    const p = buildDayPlan({ date: SAT, settings: settings({ pcStop: 0, bed: 30 }) })
    expect(p.pcStop).toBe(1440)
    expect(p.bed).toBe(1470)
    expect(block(p, 'bed').start).toBe(1470)
  })
  it('historische PC-Stopp-Verlängerungen bleiben additiv und werden nicht auf15 begrenzt', () => {
    const o = extendPcStop({})!
    expect(o.pcStopExtendMin).toBe(15)
    expect(extendPcStop(o)?.pcStopExtendMin).toBe(30)
    const p = buildDayPlan({ date: MON, settings: settings(), override: { pcStopExtendMin: 60 } })
    expect(p.pcStop).toBe(1285 + 60)
  })
  it('Fitnessstudio morgens passt nicht vor 8 Uhr → freundlicher Hinweis, Training zu Hause', () => {
    const s = settings()
    s.sport = { ...s.sport, kind: 'gym', durationMin: 60 }
    const p = buildDayPlan({ date: MON, settings: s })
    expect(p.notes.some((n) => n.includes('Fitnessstudio passt heute morgens nicht'))).toBe(true)
    expect(kinds(p)).not.toContain('sport')
  })
  it('Fitnessstudio morgens passt bei spätem Arbeitsbeginn', () => {
    const s = settings()
    s.sport = { ...s.sport, kind: 'gym', durationMin: 45 }
    s.work = s.work.map((w) => ({ ...w, start: 10 * 60 }))
    const p = buildDayPlan({ date: MON, settings: s })
    const sport = block(p, 'sport')
    expect(sport.start).toBe(s.anchor.wake + 5)
    expect(block(p, 'morning').start).toBe(sport.end)
  })
  it('Sporttasche packen am Vorabend eines Gym-Tages', () => {
    const s = settings()
    s.sport = { ...s.sport, kind: 'gym' }
    const sun = buildDayPlan({ date: SUN, settings: s })
    expect(block(sun, 'evening-routine').steps!.some((x) => x.tag === 'gymbag')).toBe(true)
    const mon = buildDayPlan({ date: MON, settings: s })
    expect(block(mon, 'evening-routine').steps!.some((x) => x.tag === 'gymbag')).toBe(false)
  })
  it('Sport nach der Arbeit wird zum Abendplan', () => {
    const s = settings()
    s.sport = { ...s.sport, time: 'afterWork', kind: 'gym', durationMin: 60 }
    const p = buildDayPlan({ date: MON, settings: s })
    expect(block(p, 'evening-plan').title).toBe('Sport')
    expect(block(p, 'evening-plan').end - block(p, 'evening-plan').start).toBe(80)
  })
  it('Freitag mit Freunden passt komplett', () => {
    const p = buildDayPlan({ date: FRI, settings: settings() })
    expect(block(p, 'evening-plan').title).toBe('Freunde treffen')
    expect(block(p, 'evening-routine').minimal).toBe(false)
  })
  it('ist deterministisch', () => {
    const s = settings()
    expect(buildDayPlan({ date: MON, settings: s })).toEqual(buildDayPlan({ date: MON, settings: s }))
  })
})

describe('Abfragen', () => {
  const p = buildDayPlan({ date: MON, settings: settings() })
  it('currentBlock / nextHardTime', () => {
    expect(currentBlock(p, 380)!.kind).toBe('morning')
    expect(currentBlock(p, 600)!.kind).toBe('work')
    expect(nextHardTime(p, 380)!.key).toBe('leave')
    expect(nextHardTime(p, 600)!.key).toBe('pc-stop')
    expect(nextHardTime(p, 1400)).toBeUndefined()
  })
})

describe('fitSteps & Intervalle', () => {
  const steps = [
    { id: 'a', title: 'A', minutes: 20, minimal: { title: 'a', minutes: 2 } },
    { id: 'b', title: 'B', minutes: 10, minimal: { title: 'b', minutes: 5 } },
    { id: 'c', title: 'C', minutes: 5 },
  ]
  it('passt ohne Kürzung', () => {
    expect(fitSteps(steps, 35)).toMatchObject({ minimal: false, fits: true })
  })
  it('kürzt zuerst den Schritt mit der größten Ersparnis', () => {
    const r = fitSteps(steps, 20)
    expect(r.steps.map((s) => s.useMinimal)).toEqual([true, false, false])
    expect(r.fits).toBe(true)
  })
  it('meldet, wenn selbst die Minimal-Version nicht passt', () => {
    expect(fitSteps(steps, 5).fits).toBe(false)
  })
  it('placeAfter und busyMinutes', () => {
    expect(placeAfter(0, 30, [[10, 20], [50, 60]])).toBe(20)
    expect(placeAfter(0, 40, [[10, 20], [50, 60]])).toBe(60)
    expect(busyMinutes(0, 100, [[10, 30], [20, 40], [90, 120]])).toBe(40)
  })
})
