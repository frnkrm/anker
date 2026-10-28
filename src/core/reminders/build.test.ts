import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import type { Settings } from '../types'
import { buildReminders, idsForKey, reminderId } from './build'

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
    expect(evening.title).toMatch(/^\d\d:\d\d – .*Gesicht.*dann darfst du zocken$/)
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
