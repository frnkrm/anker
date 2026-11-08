import { describe, expect, it } from 'vitest'
import { clockMinutes, countdownLabel, germanDateValue, remainingFraction } from './fieldValues'

describe('Sprachunabhängige Zeit- und Datumsfelder', () => {
  it('nimmt gültige 24-Stunden-Eingaben an und speichert unvollständige Werte nicht', () => {
    for (const [input, minutes] of [['00:00', 0], ['23:59', 1439], ['7:30', 450], ['0730', 450], ['20.15', 1215]] as const) expect(clockMinutes(input)).toBe(minutes)
    for (const input of ['', '2', '20:', '20:0', '24:00', '12:60', '-1:00', '07:30 PM', 'hello']) expect(clockMinutes(input)).toBeUndefined()
  })
  it('zeigt Datum und Uhrzeit unabhängig von der Gerätesprache deutsch an', () => {
    expect(germanDateValue('2026-11-09')).toBe('09.11.2026')
    expect(germanDateValue('2026-11-09T22:30', true)).toBe('09.11.2026 · 22:30')
    expect(germanDateValue('', true)).toBe('')
  })
})

describe('Gemeinsamer Countdown-Ring', () => {
  it('rundet Restzeit auf ganze Sekunden auf und hält den Ring im gültigen Bereich', () => {
    expect(countdownLabel(59.1)).toBe('1:00')
    expect(countdownLabel(210)).toBe('3:30')
    expect(countdownLabel(-1)).toBe('0:00')
    expect(countdownLabel(NaN)).toBe('0:00')
    expect(remainingFraction(30, 60)).toBe(.5)
    expect(remainingFraction(120, 60)).toBe(1)
    expect(remainingFraction(-1, 60)).toBe(0)
    expect(remainingFraction(1, 0)).toBe(0)
    expect(remainingFraction(Infinity, 60)).toBe(0)
  })
})
