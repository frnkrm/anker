import type { Rec } from '../../data/types'
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { makeBackup, parseBackup } from './backup'
import { buildIcs, foldLine, recurringEntries } from './ics'
import { pcStopFiles } from './pcstop'

describe('Sicherung', () => {
  it('nimmt neue lokale Daten mit und liest Sicherungen aus 1.0.x weiter', () => {
    const recs: Rec[] = [
      { collection: 'meta', id: 'local', data: { work: [{ id: 'a', title: 'x', createdAt: 1 }], handover: {}, meds: {} }, updated_at: 5, deleted: false, dirty: 1 },
      { collection: 'settings', id: 'main', data: { version: 1, onboarded: true }, updated_at: 3, deleted: false },
    ]
    const parsed = parseBackup(JSON.stringify(makeBackup(recs)))
    expect(parsed.map((r) => r.id)).toEqual(['local', 'main'])
    expect(parsed[0]!.dirty).toBeUndefined()
    expect(() => parseBackup('{"app":"andere"}')).toThrow()
  })
})

describe('.ics-Export', () => {
  const s = defaultSettings('2026-11-01')
  const ics = buildIcs(s, '2026-11-02')

  it('gültiger Rahmen mit Zeitzone', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('TZID:Europe/Berlin')
    expect(ics.split('BEGIN:VEVENT').length).toBe(ics.split('END:VEVENT').length)
  })
  it('Wiederholungen mit Wochentagen und Erinnerungen', () => {
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\n')
    expect(ics).toContain('SUMMARY:Losgehen')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20261102T061000')
  })
  it('Aufstehen gilt an allen 7 Tagen', () => {
    const wake = recurringEntries(s, '2026-11-02').find((e) => e.title === 'Aufstehen')!
    expect(wake.days.sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
  it('lange Zeilen werden gefaltet', () => {
    const line = 'SUMMARY:' + 'ä'.repeat(80)
    const folded = foldLine(line)
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })
})

describe('Backup', () => {
  it('Roundtrip', () => {
    const recs = [{ collection: 'inbox' as const, id: 'a', data: { t: 1 }, updated_at: 5, deleted: false, dirty: 1 }]
    const parsed = parseBackup(JSON.stringify(makeBackup(recs)))
    expect(parsed).toEqual([{ collection: 'inbox', id: 'a', data: { t: 1 }, updated_at: 5, deleted: false }])
  })
  it('weist vorhandene Einstellungen mit falschen Datentypen vollständig zurück', () => {
    for (const data of [null, {}, { version: 1, onboarded: true, anchor: null }, { version: 1, onboarded: true, work: [] }, { version: 1, onboarded: true, routines: { morning: 'falsch' } }]) {
      const text = JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data, updated_at: 1, deleted: false }]))
      expect(() => parseBackup(text)).toThrow('ungültige Einstellungen')
    }
    const settings = defaultSettings('2026-11-02')
    const invalidWindow = structuredClone(settings)
    invalidWindow.alarm.smartWake = { enabled: true, windowMinutes: 0 }
    expect(() => parseBackup(JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data: invalidWindow, updated_at: 1, deleted: false }])))).toThrow('ungültige Einstellungen')
    settings.flex.latestStart = null
    settings.alarm.medicationReminderAt = 480
    expect(parseBackup(JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data: settings, updated_at: 1, deleted: false }])))).toHaveLength(1)
  })

  it('weist unvollständige Einträge vorhandener Listen und ungültige manuelle Anker zurück', () => {
    const base = { version: 1, onboarded: true }
    const malformed = [
      { work: Array.from({ length: 7 }, () => ({})) },
      { routines: { morning: [{}] } },
      { routines: { morning: [{ id: 'water', title: 'Wasser' }] } },
      { routines: { morning: [{ id: 'water', title: 'Wasser', minutes: 1, minimal: {} }] } },
      { rewards: [{}] },
      { meals: [{}] },
      { suggestions: [{}] },
      { routineLinks: [{}] },
      { anchor: { manual: 'falsch' } },
      { anchor: { manual: { wake: 'falsch' } } },
    ]
    for (const fields of malformed) {
      const text = JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data: { ...base, ...fields }, updated_at: 1, deleted: false }]))
      expect(() => parseBackup(text)).toThrow('ungültige Einstellungen')
    }
    const valid = {
      ...base,
      routines: { morning: [{ id: 'water', title: 'Wasser', minutes: 1 }] },
      anchor: { manual: { wake: true } },
      routineLinks: [{ eveningStepId: 'prep', morningStepId: 'dress' }],
      suggestions: [{ id: 'a', text: 'Kleiner anfangen', createdAt: '2026-11-02' }],
    }
    expect(parseBackup(JSON.stringify(makeBackup([{ collection: 'settings', id: 'main', data: valid, updated_at: 1, deleted: false }])))).toHaveLength(1)
  })

  it('verständliche Fehler', () => {
    expect(() => parseBackup('kein json')).toThrow('kein gültiges JSON')
    expect(() => parseBackup('{"app":"x"}')).toThrow('keine Anker-Sicherung')
  })
  it('filtert ungültige Datensätze', () => {
    const t = JSON.stringify({ app: 'anker', version: 1, records: [{ collection: 'hack', id: 'x', updated_at: 1, deleted: false }] })
    expect(parseBackup(t)).toEqual([])
  })
})

describe('PC-Stopp-Paket', () => {
  it('enthält alle Dateien und die Konfiguration', () => {
    const f = pcStopFiles({ endpoint: 'https://x.supabase.co/functions/v1/pc-stop', token: 'abc', fallbackTime: '21:25' })
    expect(Object.keys(f).sort()).toEqual(['ANLEITUNG.txt', 'config.json', 'install.ps1', 'pc-stop-abbrechen.ps1', 'pc-stop.ps1', 'uninstall.ps1'])
    expect(JSON.parse(f['config.json']!)).toEqual({ endpoint: 'https://x.supabase.co/functions/v1/pc-stop', token: 'abc', fallbackTime: '21:25' })
    expect(f['pc-stop.ps1']).toContain('x-anker-token')
    // Kein erzwungenes Herunterfahren: /t mit Wartezeit würde laut Windows-Doku /f einschließen
    expect(f['pc-stop.ps1']).not.toMatch(/shutdown\.exe \/s \/t (?!0 )/)
    expect(f['pc-stop.ps1']).not.toMatch(/shutdown\.exe[^\n]*\/f/)
    expect(f['pc-stop-abbrechen.ps1']).toContain('paused')
    expect(f['install.ps1']).toContain('Register-ScheduledTask')
    expect(f['uninstall.ps1']).toContain('Unregister-ScheduledTask')
  })
})
