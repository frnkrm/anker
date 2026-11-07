import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from '../defaults'
import { initialGame } from '../game'
import { DEVICE_TEST_SUITE } from '../deviceTests'
import type { DeviceTestReport } from '../types'
import type { Rec } from '../../data/types'
import { previewImport } from './backup'

const date = '2026-11-02'
const old = Date.parse(`${date}T10:00:00+01:00`)
const now = old + 86_400_000
const rec = (collection: Rec['collection'], data: unknown, updated_at = old): Rec => ({ collection, id: collection === 'meta' ? 'local' : 'main', data, updated_at, deleted: false })
const report = (result: DeviceTestReport['result'], fingerprint?: string): DeviceTestReport => ({ result, at: old, note: 'Originale Beobachtung', platform: 'android', device: 'Altes Gerät', os: 'API36', appVersion: 'alt', build: '9', suiteVersion: DEVICE_TEST_SUITE, ...(fingerprint ? { buildFingerprint: fingerprint } : {}) })

describe('Bewusstes Wiederherstellen vorhandener Sicherungswerte', () => {
  it('übernimmt ältere Einstellungen und Spielstand erst im ausdrücklich gewählten Modus', () => {
    const incoming = [rec('settings', { ...defaultSettings(date), onboarded: true, bed: 1440 + 20 }), rec('game', { ...initialGame(date), xp: 720 })]
    const current = [rec('settings', { ...defaultSettings(date), onboarded: true }, now), rec('game', initialGame(date), now)]
    const before = structuredClone({ incoming, current })
    expect(previewImport(incoming, current).records).toEqual([])
    const restored = previewImport(incoming, current, 'restore', now)
    expect(restored.changed).toBe(2)
    expect(restored.records[0]?.data).toEqual(incoming[0]?.data)
    expect(restored.records[1]?.data).toEqual(incoming[1]?.data)
    expect(restored.records.every((r) => r.updated_at > now && r.updated_at > old)).toBe(true)
    expect({ incoming, current }).toEqual(before)
  })

  it('bewahrt ausgelassene Privatgruppen, unbekannte Datensätze und echte Arbeitsdaten', () => {
    const work = [{ id: 'keep', title: 'Mein Auftrag', createdAt: old }]
    const current = [rec('meta', { ...emptyLocal(), work, meds: { [date]: { status: 'taken', at: old } } }, now), { ...rec('inbox', { id: 'note', text: 'Behalten', status: 'open', createdAt: old }), id: 'note' }]
    const incoming = [rec('meta', { handover: { [date]: { open: 'Gesichert', next: 'Datei öffnen' } } })]
    const restored = previewImport(incoming, current, 'restore', now)
    expect(restored.records).toHaveLength(1)
    expect(restored.records[0]?.data).toMatchObject({ work, meds: { [date]: { status: 'taken', at: old } }, handover: { [date]: { next: 'Datei öffnen' } } })
    expect(current[1]?.data).toMatchObject({ text: 'Behalten' })
  })

  it('behält innerhalb der Datei die neueste Version je ID statt willkürlich die letzte', () => {
    const first = rec('settings', { version: 1, onboarded: true, bed: 23 * 60 }, old + 10)
    const older = rec('settings', { version: 1, onboarded: true, bed: 22 * 60 }, old)
    const restored = previewImport([first, older], [], 'restore', now)
    expect(restored.records).toHaveLength(1)
    expect(restored.records[0]?.data).toMatchObject({ bed: 23 * 60 })
    expect(restored.skipped).toBe(1)
  })

  it('verwirft einen kaputten Batch oder unmögliche neue Revision vor der Übernahme', () => {
    expect(() => previewImport([rec('settings', { version: 1, onboarded: true }), rec('game', { xp: 4 })], [], 'restore', now)).toThrow('Spielstände')
    expect(() => previewImport([rec('settings', { version: 1, onboarded: true })], [], 'restore', 8_640_000_000_000_000)).toThrow('Datenzeitpunkt')
  })

  it('macht aus einer alten Berichtidentität keinen neu geprüften Codestand', () => {
    const original = report('passed')
    const current = [rec('meta', { deviceTests: { reports: { 1: report('failed', 'neuer-codestand') } } })]
    const incoming = [rec('meta', { deviceTests: { reports: { 1: original } } }, old + 10)]
    const result = previewImport(incoming, current).records[0]?.data as { deviceTests: { reports: Record<string, DeviceTestReport> } }
    expect(result.deviceTests.reports[1]).toEqual(original)
    expect(result.deviceTests.reports[1]?.buildFingerprint).toBeUndefined()
  })

  it('ergänzt beim Wiederherstellen Altberichte als Belege und erhält aktuelle Probleme', () => {
    const original = report('passed')
    const currentReport = { ...report('failed', 'neuer-codestand'), at: now, note: 'Aktuelles Problem' }
    const current = [rec('meta', { deviceTests: { reports: { 1: currentReport } } }, now)]
    const restored = previewImport([rec('meta', { deviceTests: { reports: { 1: original } } })], current, 'restore', now).records[0]?.data as { deviceTests: { reports: Record<string, DeviceTestReport>; history: Record<string, DeviceTestReport[]> } }
    expect(restored.deviceTests.reports[1]).toEqual(currentReport)
    expect(restored.deviceTests.history[1]).toContainEqual(original)
    expect(restored.deviceTests.history[1]?.[0]?.at).toBe(old)
  })
})
