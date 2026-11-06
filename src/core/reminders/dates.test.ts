import { describe, expect, it } from 'vitest'
import { knownReminderDates } from './dates'

describe('Bekannte datierte Ausnahmen der Erinnerungsregeln', () => {
  it('behält künftige Tage außerhalb des normalen Vorrats und Kalendertage ohne Mitternachtsduplikat', () => {
    const dates = knownReminderDates('2026-11-06', {
      '2026-12-01': { date: '2026-12-01', steps: {}, override: { dayType: 'vacation' } },
      '2026-11-01': { date: '2026-11-01', steps: {}, override: {} },
    }, [{ id: 'event', title: 'Privater Inhalt', start: Date.parse('2026-12-01T12:00:00+01:00'), end: Date.parse('2026-12-03T00:00:00+01:00') }], [])
    expect(dates).toEqual(['2026-12-01', '2026-12-02'])
    expect(JSON.stringify(dates)).not.toContain('Privater Inhalt')
  })
  it('berücksichtigt für einen Termin nach Mitternacht auch den vorherigen Plantag', () => {
    expect(knownReminderDates('2026-11-06', {}, [{ id: 'night', title: '', start: Date.parse('2026-12-07T00:30:00+01:00'), end: Date.parse('2026-12-07T01:00:00+01:00') }], [])).toEqual(['2026-12-06', '2026-12-07'])
  })
  it('verwirft ungültige Daten und Zeitwerte vor der Planberechnung', () => {
    expect(knownReminderDates('2026-11-06', { '2027-02-30': { date: '2027-02-30', steps: {}, override: {} } }, [{ id: 'bad', title: '', start: NaN, end: Infinity }], [])).toEqual([])
  })
})
