import { describe, expect, it } from 'vitest'
import { germanDate, germanDateTime, germanDayDate, minuteText, planNoteForDate, plural, thoughtCount } from './uiText'

describe('Gemeinsame deutsche UI-Texte', () => {
  it('verwendet Einzahl nur für genau ein Objekt', () => {
    expect(thoughtCount(0)).toBe('0 offene Gedanken')
    expect(thoughtCount(1)).toBe('1 offener Gedanke')
    expect(thoughtCount(2)).toBe('2 offene Gedanken')
    expect(minuteText(1)).toBe('1 Minute')
    expect(minuteText(2)).toBe('2 Minuten')
    expect(minuteText(3.5)).toBe('3,5 Minuten')
    expect(plural(1, 'bestätigte Zeit', 'bestätigte Zeiten')).toBe('1 bestätigte Zeit')
    expect(plural(4, 'bestätigte Zeit', 'bestätigte Zeiten')).toBe('4 bestätigte Zeiten')
  })

  it('bezieht heute in Planungshinweisen auf den angezeigten Tag', () => {
    const text = 'Morgenroutine passt heute nur in Minimal-Version – mach, was geht.'
    expect(planNoteForDate(text, '2026-11-09', '2026-11-09')).toBe(text)
    expect(planNoteForDate(text, '2026-11-10', '2026-11-09')).toBe('Morgenroutine passt morgen nur in Minimal-Version – mach, was geht.')
    expect(planNoteForDate(text, '2026-11-11', '2026-11-09')).toBe('Morgenroutine passt am Mi., 11.11. nur in Minimal-Version – mach, was geht.')
    expect(planNoteForDate('Ein anderer Hinweis.', '2026-11-10', '2026-11-09')).toBe('Ein anderer Hinweis.')
  })

  it('formatiert deutsche Datums- und 24-Stundenangaben unabhängig von der Host-Zeitzone', () => {
    expect(germanDate('2026-11-09')).toBe('09.11.2026')
    expect(germanDate('2026-11-09', false)).toBe('09.11.')
    expect(germanDayDate('2026-11-10')).toBe('Di., 10.11.')
    expect(germanDateTime(Date.parse('2026-11-09T21:30:00Z'))).toBe('09.11. · 22:30')
    expect(germanDateTime(Date.parse('2026-11-09T23:00:00Z'), true)).toBe('10.11.2026 · 00:00')
    expect(germanDate('unvollständig')).toBe('unvollständig')
  })
})
