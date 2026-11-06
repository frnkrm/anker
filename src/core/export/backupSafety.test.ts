import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from '../defaults'
import { initialGame } from '../game'
import type { LocalData } from '../types'
import type { Collection, Rec } from '../../data/types'
import { makeBackup, parseBackup, previewImport } from './backup'

const date = '2026-11-02'
const at = Date.parse(`${date}T10:00:00+01:00`)
const record = (collection: Collection, id: string, data: unknown): Rec => ({ collection, id, data, updated_at: at, deleted: false })
const parse = (records: unknown[]) => parseBackup(JSON.stringify({ app: 'anker', version: 1, exportedAt: new Date(at).toISOString(), records }))

describe('Sicherungen prüfen den ganzen Bestand vor irgendeinem Import', () => {
  it('lässt ausgeschlossene Geschäftsaufnahmen samt Rückkehr/Lernkopien weg und gibt Tombstones ohne Privatbody aus', () => {
    const business = { id: 'business', text: 'GEHEIM-Geschäftsnotiz', status: 'task', createdAt: at, captureContext: 'Arbeit' }
    const linked = { id: 'linked', text: 'GEHEIM-verknüpft', status: 'kept', createdAt: at, linkedTo: { kind: 'work', id: 'w' } }
    const removed = { ...record('inbox', 'removed', { ...business, id: 'removed' }), deleted: true }
    const privateRemoved = { ...record('inbox', 'deleted-private', { id: 'deleted-private', text: 'GEHEIM-gelöschter-Privatbody', status: 'open', createdAt: at }), deleted: true }
    const privateNote = { id: 'private', text: 'Kunde als freies Wort ist keine Arbeitszuordnung', status: 'kept', createdAt: at }
    const local = { resume: { kind: 'task', refId: business.id, title: business.text, at },
      captureDraft: { id: 'draft', text: business.text, updatedAt: at, context: { kind: 'task', refId: business.id, title: business.text, at } },
      taskLearning: { enabled: true, samples: [{ id: 'learned', key: `task:${business.id}`, label: business.text, at, minutes: 5, confirmed: true }] } }
    const records = [record('inbox', business.id, business), record('inbox', linked.id, linked), removed, privateRemoved, record('inbox', privateNote.id, privateNote), record('meta', 'local', local)]
    const before = structuredClone(records)
    const partial = makeBackup(records, new Date(at), { work: false })
    expect(JSON.stringify(partial)).not.toContain('GEHEIM')
    expect(partial.records.some((record) => ['business', 'linked', 'removed'].includes(record.id))).toBe(false)
    expect(partial.records.find((record) => record.id === 'deleted-private')).toMatchObject({ deleted: true, data: null })
    expect(partial.records.find((record) => record.id === 'private')?.data).toEqual(privateNote)
    expect(parseBackup(JSON.stringify(partial))).toEqual(partial.records)
    expect(makeBackup(records, new Date(at)).records).toEqual(records)
    expect(records).toEqual(before)
  })
  it('verwirft einen gemischten Batch mit kaputtem Header statt nur seinen gültigen Teil zu übernehmen', () => {
    const valid = record('settings', 'main', { version: 1, onboarded: true })
    for (const broken of [null, {}, { ...valid, collection: 'unbekannt' }, { ...valid, id: '' }, { ...valid, updated_at: -1 }]) {
      expect(() => parse([valid, broken])).toThrow()
    }
  })

  it('weist einen unbrauchbaren Spielstand zurück, bevor er den vorhandenen ersetzt', () => {
    const game = initialGame(date)
    for (const data of [null, {}, { xp: 4 }, { ...game, chapter: null }, { ...game, xp: -1 }, { ...game, chaptersDone: [{}] }, { ...game, redeemed: [{ price: 'falsch' }] }]) {
      expect(() => parse([record('game', 'main', data)])).toThrow()
    }
    expect(parse([record('game', 'main', game)])[0]?.data).toEqual(game)
  })

  it('weist kaputte Tageslogs und vom Record abweichende Daten-IDs zurück', () => {
    const day = { date, override: {}, steps: {} }
    for (const data of [null, {}, { ...day, date: '2026-11-03' }, { ...day, steps: null }, { ...day, steps: { 'morning:water': 'automatisch' } }, { ...day, override: { homeOffice: 'ja' } }]) {
      expect(() => parse([record('days', date, data)])).toThrow()
    }
    expect(() => parse([record('reviews', date, { id: '2026-11-03', good: '', hard: '', change: '' })])).toThrow()
    const note = { id: 'a', text: 'Behalten', status: 'open', createdAt: at }
    for (const data of [{ t: 1 }, { ...note, id: 'b' }, { ...note, text: 7 }, { ...note, status: 'falsch' }, { ...note, createdAt: 'gestern' }]) {
      expect(() => parse([record('inbox', 'a', data)])).toThrow()
    }
  })

  it('weist kaputte echte Zeitintervalle und Kalenderdaten zurück, erhält aber strukturell gültige Konflikte', () => {
    const session = { id: 'w', date, kind: 'regular', startAt: at, endAt: at + 60_000, breaks: [] }
    for (const workSessions of [null, [{}], [{ ...session, breaks: null }], [{ ...session, breaks: [{ id: 'b', startAt: 'falsch' }] }]]) {
      expect(() => parse([record('meta', 'local', { workSessions })])).toThrow()
    }
    const conflicts = [session, { ...session, startAt: at - 60_000, endAt: at - 120_000 }]
    expect((parse([record('meta', 'local', { workSessions: conflicts })])[0]?.data as LocalData).workSessions).toEqual(conflicts)
    for (const data of [null, [{}], [{ id: 'e', title: 'Termin', start: 'morgen', end: at }]]) {
      expect(() => parse([record('meta', 'events', data)])).toThrow()
    }
  })

  it('liest echte alte Datenformen ohne neue Pflichtfelder und bewahrt unbekannte Zusatzangaben', () => {
    const records = [
      record('settings', 'main', { version: 1, onboarded: true, oldChoice: { keep: true } }),
      record('inbox', 'old', { id: 'old', text: 'Alte Notiz', status: 'open', createdAt: 1, oldExtra: 'bleibt' }),
      record('days', date, { date, override: {}, steps: { 'morning:water': 'done' } }),
      record('game', 'main', { ...initialGame(date), xp: 84, spent: 12, badges: ['alt'] }),
      record('meta', 'local', { work: [{ id: 'old-work', title: 'Alte Arbeit', createdAt: 1 }], handover: {}, meds: {} }),
    ]
    expect(parse(records)).toEqual(records)
  })

  it('verwirft falsche bekannte Einstellungen, akzeptiert aber echte manuelle Nachtzeiten', () => {
    const settings = defaultSettings(date)
    for (const patch of [{ themeId: 'falsch' }, { goal: 'falsch' }, { focus: { ...settings.focus, pulse: 'falsch' } }, { game: { ...settings.game, stage: 99 } }, { version: 999 }]) {
      expect(() => parse([record('settings', 'main', { ...settings, ...patch })])).toThrow()
    }
    const night = { ...settings, bed: 25 * 60, anchor: { ...settings.anchor, manual: { bed: true } } }
    expect(parse([record('settings', 'main', night)])[0]?.data).toEqual(night)
  })

  it('behält erlaubte Tombstones ohne behauptete Erledigung', () => {
    const deleted = { ...record('inbox', 'entfernt', null), deleted: true }
    expect(parse([deleted])).toEqual([deleted])
  })

  it('prüft auch Rücknahme-Snapshots vollständig, bevor ein alter Termin später wieder eingesetzt wird', () => {
    const commitment = { id: 'c', date, label: 'Termin', context: 'personal', commitment: 'hard', start: 600 }
    const planUndo = { [date]: { at, commitments: [commitment] } }
    expect(parse([record('meta', 'local', { planUndo })])).toHaveLength(1)
    for (const patch of [{ end: 'offen' }, { end: 500 }, { travelMin: -1 }, { routeMode: 'falsch' }, { preparedItems: [42] }]) {
      expect(() => parse([record('meta', 'local', { planUndo: { [date]: { at, commitments: [{ ...commitment, ...patch }] } } })])).toThrow('lokale Planungs- oder Arbeitsdaten')
    }
  })

  it('prüft vorhandene optionale Freigaben und Packlisten ohne sie alten Sicherungen vorzuschreiben', () => {
    for (const assistance of [null, { ai: { enabled: 'ja', at, version: 1 } }, { routes: { enabled: true, at, version: 2 } }, { routeChecks: { c: { at: -1, revision: 'r' } } }]) {
      expect(() => parse([record('meta', 'local', { assistance })])).toThrow()
    }
    for (const packTemplates of [[{}], [{ id: 'p', label: 'Test', context: 'customer', items: [42] }]]) {
      expect(() => parse([record('meta', 'local', { packTemplates })])).toThrow()
    }
    const assistance = { ai: { enabled: false, at, version: 1 } }
    expect(parse([record('meta', 'local', { assistance })])[0]?.data).toEqual({ assistance })
  })

  it('Vollbackup bleibt unabhängig von Sensitivitätsoptionen als vollständiger Roundtrip verfügbar', () => {
    const local = { ...emptyLocal(), meds: { [date]: { status: 'taken' as const, at } }, work: [{ id: 'w', title: 'Privat', createdAt: at }] }
    const records = [record('meta', 'local', local)]
    expect(parseBackup(JSON.stringify(makeBackup(records)))).toEqual(records)
  })

  it('lässt ausgeschlossene sensible Gruppen wirklich aus und verändert die Quelldaten nicht', () => {
    const local = { ...emptyLocal(), meds: { [date]: { status: 'taken' as const, at } }, work: [{ id: 'w', title: 'Kundengeheimnis', createdAt: at }],
      places: [{ id: 'p', label: 'Privater Ort', address: 'Geheime Adresse' }], deviceTests: { reports: {} },
      resume: { kind: 'work' as const, title: 'Kundengeheimnis', at },
      captureDraft: { id: 'draft', text: 'Kundengeheimnis', updatedAt: at, context: { kind: 'work' as const, title: 'Kundengeheimnis', at } },
      packTemplates: [{ id: 'pack', label: 'Kundengeheimnis', context: 'customer', items: ['Geheime Adresse'] }],
      assistance: { ai: { enabled: false, at, version: 1 }, routeChecks: { 'private-route': { at, revision: 'revision' } } } }
    const note = { id: 'note', text: 'Notiz behalten', createdAt: at, status: 'kept', linkedTo: { kind: 'work', id: 'w' } }
    const records = [record('meta', 'local', local), record('inbox', 'note', note)]
    const snapshot = structuredClone(records)
    const backup = makeBackup(records, new Date(at), { work: false, health: false, places: false, deviceTests: false })
    const text = JSON.stringify(backup)
    expect(text).not.toContain('Kundengeheimnis')
    expect(text).not.toContain('Geheime Adresse')
    expect(text).not.toContain('"meds"')
    expect(text).not.toContain('private-route')
    expect(text).not.toContain('captureDraft')
    expect((backup.records[0]!.data as Record<string, unknown>).assistance).toEqual({ ai: { enabled: false, at, version: 1 } })
    expect((backup.records[0]!.data as Record<string, unknown>).deviceTests).toBeUndefined()
    expect(parseBackup(text)).toHaveLength(1) // Die ausdrücklich mit Arbeit verknüpfte Notiz bleibt als ganzer Record lokal.
    expect(records).toEqual(snapshot)
  })

  it('bewahrt beim Teilimport ausgelassene Gruppen im Ziel und zeigt nur tatsächlich gewinnende Änderungen', () => {
    const target = record('meta', 'local', { ...emptyLocal(), work: [{ id: 'bestehend', title: 'Nicht löschen', createdAt: 1 }], meds: { [date]: { status: 'taken', at } } })
    const incoming = { ...record('meta', 'local', { handover: { [date]: { open: 'Neu', next: 'Öffnen' } } }), updated_at: at + 1 }
    const old = { ...record('inbox', 'alt', { id: 'alt', text: 'Alt', createdAt: 1, status: 'open' }), updated_at: at - 1 }
    const current = [target, { ...old, updated_at: at }]
    const before = structuredClone(current)
    const preview = previewImport([incoming, old], current)
    expect(preview).toMatchObject({ incoming: 2, changed: 1, skipped: 1, deletions: 0 })
    expect(preview.records[0]?.data).toMatchObject({ work: (target.data as LocalData).work, meds: (target.data as LocalData).meds, handover: (incoming.data as LocalData).handover })
    expect(current).toEqual(before)
    expect((preview.records[0]?.data as LocalData).handover).toEqual((incoming.data as LocalData).handover)
  })

  it('berechnet doppelte Recordversionen monoton und unterscheidet echte Löschung von Auslassung', () => {
    const original = record('inbox', 'n', { id: 'n', text: 'Alt', createdAt: 1, status: 'open' })
    const latest: Rec = { ...original, data: { ...original.data as object, text: 'Neu' }, updated_at: at + 2 }
    const older = { ...original, updated_at: at + 1 }
    const deleted = { ...record('inbox', 'entfernt', null), deleted: true }
    const preview = previewImport([latest, older, deleted], [original])
    expect(preview).toMatchObject({ changed: 2, skipped: 1, deletions: 1 })
    expect(preview.records.find((r) => r.id === 'n')?.data).toMatchObject({ text: 'Neu' })
    latest.data = { changedOutside: true }
    expect(preview.records.find((r) => r.id === 'n')?.data).toMatchObject({ text: 'Neu' })
  })

  it('ersetzt bewusst übermittelte Listen vollständig und ergänzt nur ausgelassene Objektfelder', () => {
    const before = record('meta', 'local', { work: [{ id: 'alt', title: 'Alt', createdAt: 1 }], handover: { [date]: { open: 'Behalten', next: 'Öffnen' } } })
    const incoming = { ...record('meta', 'local', { work: [] }), updated_at: at + 1 }
    expect(previewImport([incoming], [before]).records[0]?.data).toEqual({ work: [], handover: { [date]: { open: 'Behalten', next: 'Öffnen' } } })
    const settings = record('settings', 'main', { version: 1, onboarded: true, alarm: { enabled: true, qrSecret: 'BEHALTEN' } })
    const partial = { ...record('settings', 'main', { version: 1, onboarded: true, alarm: { enabled: false } }), updated_at: at + 1 }
    expect(previewImport([partial], [settings]).records[0]?.data).toEqual({ version: 1, onboarded: true, alarm: { enabled: false, qrSecret: 'BEHALTEN' } })
  })
})
