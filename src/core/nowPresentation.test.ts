import { describe, expect, it } from 'vitest'
import { nowAnchorLabel, planTimeLabel } from './nowPresentation'

describe('Eindeutige Jetzt-Zeiten', () => {
  const now = Date.parse('2026-11-18T06:30:00+01:00')
  it('benennt den Countdown und rundet Restminuten nach oben', () => {
    expect(nowAnchorLabel({ key: 'wake', label: 'Aufstehen', at: 400 }, '2026-11-18', 390.4, now))
      .toEqual({ title: 'Aufstehen in 10 min', time: 'Heute um 06:40' })
  })
  it('zeigt nach Mitternacht den echten Tag statt den alten Plantag', () => {
    expect(planTimeLabel('2026-11-18', 1470, now)).toBe('Morgen um 00:30')
    expect(planTimeLabel('2026-11-17', 1470, now)).toBe('Heute um 00:30')
  })
  it('nennt entfernte Tage und erfindet keine negative Restzeit', () => {
    expect(planTimeLabel('2026-11-20', 400, now)).toBe('20.11. um 06:40')
    expect(nowAnchorLabel({ key: 'bed', label: 'Bett', at: 390 }, '2026-11-18', 391, now).title).toBe('Bett')
  })
})
