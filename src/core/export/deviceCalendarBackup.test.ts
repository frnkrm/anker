import { describe, expect, it } from 'vitest'
import type { Rec } from '../../data/types'
import type { LocalData } from '../types'
import { makeBackup, parseBackup, previewImport } from './backup'

const at = Date.parse('2026-11-06T10:00:00Z')
const selection = { enabled: true, calendarIds: ['17:' + 'a'.repeat(64)], selectedAt: at }
const record = (deviceCalendar: unknown, updated_at = at): Rec => ({ collection: 'meta', id: 'local', updated_at, deleted: false, data: { extras: { deviceCalendar, calendar: { state: 'ready', fetchedAt: at, checkedAt: at } }, work: [{ id: 'mine', title: 'Eigene Aufgabe', createdAt: at }] } })

describe('Gerätekalender-Zustimmung gehört zum Handy, nicht in eine Sicherung', () => {
  it('exportiert selbst bei vollständiger Sicherung und gelöschtem Record keine Kontoauswahl', () => {
    const original = [record(selection), { ...record(selection), deleted: true }]
    const before = structuredClone(original), backup = makeBackup(original)
    expect(JSON.stringify(backup)).not.toContain('deviceCalendar'); expect(JSON.stringify(backup)).not.toContain(selection.calendarIds[0])
    expect((backup.records[0]!.data as LocalData).work?.[0]?.title).toBe('Eigene Aufgabe'); expect(original).toEqual(before)
  })
  it('entfernt fremde Auswahl vor der Validierung und aktiviert auf einem neuen Gerät keinen Zugriff', () => {
    for (const foreign of [selection, { enabled: true, calendarIds: ['foreign-malformed'], selectedAt: 'not-a-time' }]) {
      const incoming = record(foreign)
      const parsed = parseBackup(JSON.stringify({ app: 'anker', version: 1, records: [incoming] }))
      expect((parsed[0]!.data as LocalData).extras?.deviceCalendar).toBeUndefined()
      const restored = previewImport([incoming], [], 'restore', at + 100)
      expect((restored.records[0]!.data as LocalData).extras?.deviceCalendar).toBeUndefined()
      expect((restored.records[0]!.data as LocalData).work?.[0]?.title).toBe('Eigene Aufgabe')
    }
  })
  it.each(['merge', 'restore'] as const)('bewahrt im Modus %s ausschließlich die aktuelle Geräteentscheidung', mode => {
    const current = record(selection, at), foreign = record({ enabled: true, calendarIds: ['22:' + 'b'.repeat(64)], selectedAt: at + 1 }, at + 1)
    const imported = previewImport([foreign], [current], mode, at + 100)
    expect((imported.records[0]!.data as LocalData).extras?.deviceCalendar).toEqual(selection)
    const disabled = record({ enabled: false, calendarIds: [], selectedAt: at })
    expect((previewImport([foreign], [disabled], mode, at + 100).records[0]!.data as LocalData).extras?.deviceCalendar).toEqual({ enabled: false, calendarIds: [], selectedAt: at })
  })
})
