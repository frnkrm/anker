import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import type { Settings } from '../types'
import { buildReminders, idsForKey, relevantReminderKeys, reminderId, reopenHint, slotFor } from './build'

describe('Slots und lange Vorausplanung', () => {
  const now = zonedToUtc('2026-11-02', 5 * 60)
  const plansFor = (s: Settings, n: number) => Array.from({ length: n }, (_, i) => buildDayPlan({ date: `2026-11-${String(2 + i).padStart(2, '0')}`, settings: s }))

  it('harte Zeiten vor Aufgaben vor Kleinigkeiten', () => {
    expect(slotFor('leave')).toEqual({ slot: 1, rank: 4 })
    expect(slotFor('morning').slot).toBe(0)
    expect(slotFor('review').slot).toBe(2)
    expect(slotFor('leave').rank).toBeGreaterThan(slotFor('morning').rank)
    expect(slotFor('morning').rank).toBeGreaterThan(slotFor('review').rank)
  })

  it('nach drei Tagen ohne Öffnen sind Erinnerungen weiter geplant, ohne alte nachzuholen', () => {
    const s = defaultSettings('2026-11-01')
    const r = buildReminders(plansFor(s, 14), {}, s, now, 14 * 24 * 3600_000)
    const threeDaysLater = now + 3 * 24 * 3600_000
    expect(r.some((x) => x.key === 'leave' && x.at > threeDaysLater)).toBe(true)
    expect(r.every((x) => x.at > now)).toBe(true)
  })

  it('nur Zeitkritisches weckt exakt', () => {
    const s = defaultSettings('2026-11-01')
    const r = buildReminders(plansFor(s, 2), {}, s, now)
    expect(r.find((x) => x.key === 'leave')!.exact).toBe(true)
    expect(r.find((x) => x.key === 'morning')!.exact).toBe(false)
  })

  it('Erledigtes ist nicht mehr relevant und wird aus der Leiste geräumt', () => {
    const s = defaultSettings('2026-11-01')
    const plans = plansFor(s, 1)
    const date = plans[0]!.date
    expect(relevantReminderKeys(plans, {}, s)).toContain(`${date}|leave`)
    const logs = { [date]: { date, override: {}, steps: {}, leftAt: now, dismissed: ['bed'] } }
    const after = relevantReminderKeys(plans, logs, s)
    expect(after).not.toContain(`${date}|leave`)
    expect(after).not.toContain(`${date}|bed`)
  })

  it('Deadline: früh, ruhig und ohne Arbeitsinhalt im Text', () => {
    const s = defaultSettings('2026-11-01')
    const at = now + 48 * 3600_000
    const r = buildReminders([], {}, s, now, 7 * 24 * 3600_000, { deadlines: [{ id: 'x', at }] })
    expect(r.map((x) => x.at).sort()).toEqual([at - 24 * 3600_000, at - 3600_000])
    expect(r.every((x) => x.slot === 1 && !x.body.includes('x'))).toBe(true)
  })

  it('Deadline-Erinnerung bleibt nach „Erledigt“ weg', () => {
    const s = defaultSettings('2026-11-01')
    const at = zonedToUtc('2026-11-06', 720)
    const logs = { '2026-11-06': { date: '2026-11-06', override: {}, steps: {}, dismissed: ['deadline-hour:x'] } }
    const r = buildReminders([], logs, s, now, 7 * 24 * 3600_000, { deadlines: [{ id: 'x', at }] })
    expect(r.map((x) => x.key)).toEqual(['deadline-day:x'])
  })

  it('auf Kurs: nur noch, was zählt', () => {
    const s = defaultSettings('2026-11-01')
    const plans = plansFor(s, 1)
    const date = plans[0]!.date
    const r = buildReminders(plans, { [date]: { date, override: { mode: 'auf-kurs' }, steps: {} } }, s, now)
    expect(r.some((x) => x.key === 'morning')).toBe(false)
    expect(r.some((x) => x.key === 'leave')).toBe(true)
  })

  it('Hinweis vor dem Ende der Vorausplanung', () => {
    const h = reopenHint(now, '2026-11-15')
    expect(h.channel).toBe('sanft')
    expect(h.slot).toBe(2)
    expect(h.exact).toBe(false)
  })
})

const MON = '2026-11-02'
const TUE = '2026-11-03'

function setup(patch: (s: Settings) => void = () => {}) {
  const s = defaultSettings('2026-11-01')
  patch(s)
  const plans = [buildDayPlan({ date: MON, settings: s }), buildDayPlan({ date: TUE, settings: s })]
  return { s, plans }
}

describe('buildReminders', () => {
  const now = zonedToUtc(MON, 5 * 60)

  it('plant nur Zukünftiges innerhalb von 48 h', () => {
    const { s, plans } = setup()
    const r = buildReminders(plans, {}, s, now)
    expect(r.length).toBeGreaterThan(10)
    expect(r.every((x) => x.at > now && x.at <= now + 48 * 3600_000)).toBe(true)
    expect(r.map((x) => x.at)).toEqual([...r.map((x) => x.at)].sort((a, b) => a - b))
  })

  it('sprechende Texte mit Uhrzeit', () => {
    const { s, plans } = setup()
    const r = buildReminders(plans, {}, s, now)
    const evening = r.find((x) => x.key === 'evening' && x.escalation === 0 && x.date === MON)!
    expect(evening.title).toMatch(/^\d\d:\d\d – .*Gesicht.*Zähne$/)
    expect(evening.title).not.toContain('darfst')
    expect(r.find((x) => x.key === 'leave' && x.date === MON)!.title).toBe('07:15 – Losgehen!')
  })

  it('Eskalation je nach Intensität', () => {
    const count = (i: Settings['reminders']['intensity']) => {
      const { s, plans } = setup((x) => (x.reminders.intensity = i))
      return buildReminders(plans, {}, s, now).filter((x) => x.key === 'leave' && x.date === MON).length
    }
    expect(count('gentle')).toBe(1)
    expect(count('normal')).toBe(2)
    expect(count('persistent')).toBe(3)
    const { s, plans } = setup((x) => (x.reminders.intensity = 'persistent'))
    const last = buildReminders(plans, {}, s, now).filter((x) => x.key === 'leave' && x.date === MON)[2]!
    expect(last.channel).toBe('wecker')
  })

  it('Erledigtes und „Heute nicht“ fallen weg', () => {
    const { s, plans } = setup()
    const logs = { [MON]: { date: MON, override: {}, steps: {}, leftAt: now, dismissed: ['bed'] } }
    const r = buildReminders(plans, logs, s, now).filter((x) => x.date === MON)
    expect(r.some((x) => x.key === 'leave')).toBe(false)
    expect(r.some((x) => x.key === 'bed')).toBe(false)
    expect(r.some((x) => x.key === 'pcstop')).toBe(true)
  })

  it('Ruhezeiten unterdrücken sanfte Erinnerungen, harte Zeiten bleiben', () => {
    const { s, plans } = setup((x) => {
      x.reminders.quietStart = 21 * 60
      x.reminders.quietEnd = 6 * 60
    })
    const r = buildReminders(plans, {}, s, now).filter((x) => x.date === MON)
    expect(r.some((x) => x.key === 'pcstop-15')).toBe(false)
    expect(r.some((x) => x.key === 'pcstop')).toBe(true)
    expect(r.some((x) => x.key === 'bed')).toBe(true)
  })

  it('Krank: nur Abend-Basics und Bett', () => {
    const s = defaultSettings('2026-11-01')
    const plan = buildDayPlan({ date: MON, settings: s, override: { dayType: 'sick' } })
    const keys = new Set(buildReminders([plan], {}, s, now).map((x) => x.key))
    expect([...keys].sort()).toEqual(['bed', 'evening'])
  })

  it('stabile, eindeutige IDs', () => {
    const { s, plans } = setup((x) => (x.reminders.intensity = 'persistent'))
    const r = buildReminders(plans, {}, s, now)
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length)
    expect(reminderId('a')).toBe(reminderId('a'))
    expect(idsForKey(MON, 'leave')).toContain(r.find((x) => x.key === 'leave')!.id)
  })
})
