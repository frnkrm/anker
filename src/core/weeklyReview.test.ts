import { describe, expect, it } from 'vitest'
import { weeklyEvidence } from './weeklyReview'
import { zonedToUtc } from './time'
import type { DayLog } from './types'

const now = zonedToUtc('2026-11-13', 600)
const day = (date: string, patch: Partial<DayLog> = {}): DayLog => ({ date, override: {}, steps: {}, ...patch })

describe('F-010: vorhandene Wochenstände ohne neue Beobachtung', () => {
  it('zählt fehlende und automatisch leere Tagesrecords nicht als Hindernis oder Nutzung', () => {
    const result = weeklyEvidence({ '2026-11-09': day('2026-11-09'), '2026-11-10': day('2026-11-10', { wakeAt: 1, reminderReceipts: ['technical'] }) }, now, 'current')!
    expect(result).toMatchObject({ from: '2026-11-09', to: '2026-11-13', totalDays: 5, dataDays: 0, missingDays: 5, modes: {}, steps: { done: 0, minimal: 0, skipped: 0, 'not-needed': 0 } })
  })
  it('zählt nur bekannte gespeicherte Auswahl und tatsächlich eingetragene Routinenresultate', () => {
    const result = weeklyEvidence({
      '2026-11-09': day('2026-11-09', { override: { mode: 'startschwierigkeit', shortMorning: true }, steps: { 'morning:old': 'minimal', 'evening:removed': 'done' } }),
      '2026-11-10': day('2026-11-10', { override: { mode: 'wenig-energie', light: true, adjusted: true }, steps: { 'morning:one': 'skipped', 'evening:two': 'not-needed' } }),
      '2026-11-11': day('2026-11-11', { override: { mode: 'normal' } }),
    }, now, 'current')!
    expect(result).toMatchObject({ totalDays: 5, dataDays: 3, missingDays: 2, modes: { startschwierigkeit: 1, 'wenig-energie': 1, normal: 1 }, shortMorningDays: 1, lightDays: 1, adjustedDays: 1, steps: { done: 1, minimal: 1, skipped: 1, 'not-needed': 1 } })
  })
  it('behandelt Mehrfachangaben als einen Tagesstand und spätere Umwahl nicht als Verlauf', () => {
    const logs = { '2026-11-09': day('2026-11-09', { override: { mode: 'startschwierigkeit', adjusted: true, light: true }, steps: { 'morning:a': 'minimal', 'morning:b': 'minimal' } }) }
    expect(weeklyEvidence(logs, now, 'current')).toMatchObject({ dataDays: 1, steps: { minimal: 2 }, modes: { startschwierigkeit: 1 } })
    logs['2026-11-09'].override.mode = 'auf-kurs'
    expect(weeklyEvidence(logs, now, 'current')?.modes).toEqual({ 'auf-kurs': 1 })
  })
  it('liest keine freien Gründe, geänderten Texte, privaten IDs, technischen Belege oder anderen Tagesbereiche aus', () => {
    const log = day('2026-11-09', { override: { reason: 'PRIVATE-REASON', mode: 'ueberlastet' }, changes: ['PRIVATE-CHANGE'], reminderReceipts: ['PRIVATE-RECEIPT'], steps: { 'morning:PRIVATE-STEP': 'minimal', 'work:PRIVATE-TASK': 'done' } })
    const logs = { [log.date]: log }, before = structuredClone(logs)
    const result = weeklyEvidence(logs, now, 'current')!
    expect(result).toMatchObject({ modes: { ueberlastet: 1 }, steps: { done: 0, minimal: 1 } })
    expect(JSON.stringify(result)).not.toContain('PRIVATE-')
    expect(logs).toEqual(before)
  })
  it('schließt frühere/future Tage, falsche Datensatzdaten und fremde Schlüssel aus', () => {
    const logs = { '2026-11-08': day('2026-11-08', { override: { light: true } }), '2026-11-14': day('2026-11-14', { override: { light: true } }), '2026-11-09': day('2026-11-10', { override: { light: true } }), wrong: day('2026-11-11', { override: { light: true } }) }
    expect(weeklyEvidence(logs, now, 'current')?.dataDays).toBe(0)
    expect(weeklyEvidence(logs, now, 'previous')).toMatchObject({ from: '2026-11-02', to: '2026-11-08', dataDays: 1, totalDays: 7 })
  })
  it('übernimmt unbekannte Modi, Resultate oder bloß ähnliche Felder nicht stillschweigend', () => {
    const bad = { date: '2026-11-09', override: { mode: '__proto__', shortMorning: 'true', light: 1, adjusted: false }, steps: { 'morning:': 'done', 'work:one': 'done', 'morning:one': 'ended', 'evening:two': 'constructor' } } as unknown as DayLog
    expect(weeklyEvidence({ [bad.date]: bad }, now, 'current')?.dataDays).toBe(0)
  })
  it('akzeptiert alte unbekannte Schritt-IDs ohne aus heutigen Routinen einen Sollwert zu rekonstruieren', () => {
    const log = day('2026-11-09', { steps: { 'evening:Alter Schritt': 'done' } })
    expect(weeklyEvidence({ [log.date]: log }, now, 'current')?.steps.done).toBe(1)
  })
  it.each([
    ['2026-11-16', 239, '2026-11-09', '2026-11-15', 7],
    ['2026-11-16', 240, '2026-11-16', '2026-11-16', 1],
    ['2026-11-15', 1440, '2026-11-09', '2026-11-15', 7],
    ['2027-01-01', 600, '2026-12-28', '2027-01-01', 5],
  ] as const)('respektiert Berliner Plan-/Wochengrenzen %s/%s', (date, minutes, from, to, totalDays) => {
    expect(weeklyEvidence({}, zonedToUtc(date, minutes), 'current')).toMatchObject({ from, to, totalDays })
  })
  it.each([['2026-03-30', '2026-03-23', '2026-03-29'], ['2026-10-26', '2026-10-19', '2026-10-25']])('zählt über den Zeitwechsel sieben lokale Tage (%s)', (date, from, to) => {
    expect(weeklyEvidence({}, zonedToUtc(date!, 600), 'previous')).toMatchObject({ from, to, totalDays: 7, missingDays: 7 })
  })
  it('lehnt eine ungültige Uhr ab, statt Zeiträume zu erfinden', () => {
    for (const value of [NaN, Infinity, Number.MAX_VALUE]) expect(weeklyEvidence({}, value, 'current')).toBeUndefined()
  })
})
