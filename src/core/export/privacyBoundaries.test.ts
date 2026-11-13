import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import type { Rec } from '../../data/types'
import { makeBackup, parseBackup, previewImport } from './backup'

const at = Date.parse('2026-11-13T12:00:00+01:00')
const rec = (collection: Rec['collection'], id: string, data: unknown, deleted = false): Rec => ({ collection, id, data, updated_at: at, deleted })

describe('T-005: Datensicherung ist keine neue Gerätefreigabe', () => {
  it.each(['merge', 'restore'] as const)('erhält bei %s die Freigaben des Zielgeräts statt fremde Integrationen einzuschalten', mode => {
    const before = defaultSettings('2026-11-13'), incoming = structuredClone(before)
    incoming.integrations = { sync: true, healthConnect: true, googleCalendar: true, writeCalendar: true }
    incoming.bed = 1470
    const current = rec('settings', 'main', before)
    const source = { ...rec('settings', 'main', incoming), updated_at: at + 1 }
    const snapshot = structuredClone({ current, source })
    const imported = previewImport([source], [current], mode, at + 2).records[0]!
    expect(imported.data).toMatchObject({ integrations: before.integrations, bed: 1470 })
    expect({ current, source }).toEqual(snapshot)
  })
  it('übernimmt auch in einem frischen Bestand keine Integrationsfreigabe oder Schlaf-Lesewahl aus Altdateien', () => {
    const settings = defaultSettings('2026-11-13')
    settings.integrations.sync = true
    const records = [rec('settings', 'main', settings), rec('meta', 'local', { work: [], healthSleepEnabled: true })]
    const parsed = parseBackup(JSON.stringify({ app: 'anker', version: 1, records }))
    const imported = previewImport(parsed, []).records
    expect((imported.find(r => r.collection === 'settings')!.data as Record<string, unknown>).integrations).toBeUndefined()
    expect((imported.find(r => r.collection === 'meta')!.data as Record<string, unknown>).healthSleepEnabled).toBeUndefined()
  })
  it('erhält eine tatsächlich vorhandene Gerätefreigabe beim Import einer widersprechenden Altdatei', () => {
    const settings = defaultSettings('2026-11-13'); settings.integrations.sync = true
    const current = [rec('settings', 'main', settings), rec('meta', 'local', { work: [], healthSleepEnabled: true })]
    const incoming = [rec('settings', 'main', { ...settings, integrations: { ...settings.integrations, sync: false } }), rec('meta', 'local', { work: [], healthSleepEnabled: false })]
    const imported = previewImport(incoming, current, 'restore', at + 1).records
    expect(imported.find(r => r.collection === 'settings')?.data).toMatchObject({ integrations: { sync: true } })
    expect(imported.find(r => r.collection === 'meta')?.data).toMatchObject({ healthSleepEnabled: true })
  })
  it('verwirft beschädigte Freigabefelder vor der Projektion statt sie still zu reparieren', () => {
    const records = [rec('meta', 'local', { healthSleepEnabled: 'ja' })]
    expect(() => parseBackup(JSON.stringify({ app: 'anker', version: 1, records }))).toThrow('ungültige')
    expect(() => previewImport(records, [])).toThrow('ungültige')
  })
  it('überträgt keine fremden KI-/Automatik-, Audio- oder PC-Freigaben, erhält aber deren lokale Daten', () => {
    const settings = defaultSettings('2026-11-13')
    settings.extras = { dictation: true, spokenCues: true }
    const incoming = [rec('settings', 'main', { ...settings, guidance: { ...settings.guidance, enabled: true, pcLock: true } }),
      rec('meta', 'local', { work: [], assistance: { ai: { enabled: true, at, version: 1 }, routes: { enabled: true, at, version: 1, automatic: true }, routeChecks: {} },
        extras: { geofences: { enabled: true, visits: {} } } })]
    const result = previewImport(incoming, []).records
    const s = result.find(r => r.collection === 'settings')!.data as Record<string, unknown>
    const local = result.find(r => r.collection === 'meta')!.data as Record<string, unknown>
    expect(s.extras).toBeUndefined(); expect(s.guidance).toBeUndefined()
    expect(local.assistance).toEqual({ routeChecks: {} })
    expect(local.extras).toEqual({})
    expect(local.work).toEqual([])
  })
  it('importiert Wetterorte und private Wenn-dann-Texte ohne fremde Abruf-/PC-Textfreigabe', () => {
    const settings = defaultSettings('2026-11-13')
    settings.weather = { ...settings.weather, enabled: true, city: 'Alter Wetterort', lat: 50, lng: 9 }
    const incoming = [rec('settings', 'main', settings), rec('meta', 'local', {
      work: [], weatherProfile: { enabled: true, city: 'Bewusster Ort', lat: 51, lng: 10 },
      guidance: { days: {}, receipts: [], ifThen: { wish: 'Privat', outcome: 'Privat', obstacle: 'Privat', sentence: 'PRIVATE-SENTENCE', showOnPc: true } },
    })]
    const local = previewImport(incoming, []).records.find(r => r.collection === 'meta')!.data
    expect(local).toMatchObject({ weatherProfile: { enabled: false, city: 'Bewusster Ort', lat: 51, lng: 10 },
      guidance: { ifThen: { sentence: 'PRIVATE-SENTENCE', showOnPc: false } } })
    expect(previewImport(incoming, []).records.find(r => r.collection === 'settings')?.data).toMatchObject({ weather: { enabled: false } })
  })
})

describe('T-005: Löschmarkierungen enthalten keinen alten Privatbody', () => {
  it.each([{}, { health: false }, { places: false }, { deviceTests: false }, { work: false }])('exportiert nur die Löschidentität bei Auswahl %j', selection => {
    const records = [
      rec('inbox', 'old', { id: 'old', text: 'PRIVATE-DELETED-NOTE' }, true),
      rec('meta', 'local', { meds: { old: 'PRIVATE-HEALTH' }, places: ['PRIVATE-PLACE'], deviceTests: { note: 'PRIVATE-TEST' }, work: [] }, true),
      rec('settings', 'main', { version: 1, onboarded: true, alarm: { qrSecret: 'PRIVATE-OLD-QR' } }, true),
    ]
    const before = structuredClone(records)
    const backup = makeBackup(records, new Date(at), selection)
    expect(backup.records).toHaveLength(3)
    expect(backup.records.every(r => r.deleted && r.data === null)).toBe(true)
    expect(JSON.stringify(backup)).not.toContain('PRIVATE-')
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup.records)
    expect(records).toEqual(before)
  })
})

it('lässt die tatsächlichen Lernkopien einer Geschäftsaufnahme weg und erhält sie beim privaten Teilimport im Ziel', () => {
  const business = rec('inbox', 'business', { id: 'business', text: 'PRIVATE-BUSINESS', captureContext: 'Arbeit', status: 'task', createdAt: at })
  // The store uses the source id in id, but a normalized title/series in key.
  const businessSample = { id: `task:business:${at}`, key: 'task:private-business', label: 'PRIVATE-BUSINESS', minutes: 5, at, confirmed: true }
  const privateSample = { id: `task:private:${at}`, key: 'task:privat', label: 'Privat', minutes: 3, at, confirmed: true }
  const current = [business, rec('inbox', 'private', { id: 'private', text: 'Privat', status: 'task', createdAt: at }),
    rec('meta', 'local', { work: [], taskLearning: { enabled: true, samples: [businessSample, privateSample] } })]
  const partial = makeBackup(current, new Date(at), { work: false })
  expect(JSON.stringify(partial)).not.toContain('PRIVATE-BUSINESS')
  const restored = previewImport(partial.records, current, 'restore', at + 1).records.find(r => r.collection === 'meta')!
  expect(restored.data).toMatchObject({ taskLearning: { enabled: true, samples: [privateSample, businessSample] } })
})

it('lässt bei gelöschter Herkunft keine unklassifizierbare Lernkopie oder Rückkehrnotiz im privaten Export', () => {
  const local = rec('meta', 'local', { work: [], taskLearning: { enabled: true, samples: [
    { id: `task:removed:${at}`, key: 'task:private-business', label: 'PRIVATE-ORPHAN', minutes: 5, at, confirmed: true },
  ] }, resume: { kind: 'task', refId: 'removed', title: 'PRIVATE-ORPHAN', at } })
  const current = [rec('inbox', 'removed', null, true), local]
  const partial = makeBackup(current, new Date(at), { work: false })
  expect(JSON.stringify(partial)).not.toContain('PRIVATE-ORPHAN')
  expect(previewImport(partial.records, current, 'restore', at + 1).records.find(r => r.collection === 'meta')?.data).toMatchObject(local.data as object)
})

it('stellt bestätigte Lernwerte auf einem neuen Gerät wieder her, ohne die Lernwahl einzuschalten', () => {
  const sample = { id: `task:private:${at}`, key: 'task:privat', label: 'Privat', minutes: 3, at, confirmed: true }
  const imported = previewImport([rec('meta', 'local', { taskLearning: { enabled: true, samples: [sample] } })], []).records[0]!
  expect(imported.data).toMatchObject({ taskLearning: { enabled: false, samples: [sample] } })
})
