import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup, previewImport } from '../core/export/backup'
import { defaultPcBridgeLocal, reducePcEvents, validPcBridgeLocal } from '../core/pcLink'
import type { PcEventsPayload, PcLinkEvent } from '../core/pcLink'
import { addDays, zonedToUtc } from '../core/time'
import type { LocalData } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-12'
const at = (minutes: number, day = date) => zonedToUtc(day, minutes)
const event = (seq: number, kind: PcLinkEvent['kind'] = 'pc-rest', patch: Partial<PcLinkEvent> = {}): PcLinkEvent => ({ id: `event-${seq}`, seq, at: new Date(at(1320)).toISOString(), date, kind, ...(kind === 'pc-rest' ? { basis: 'lock' as const } : {}), ...patch })
const payload = (...items: PcLinkEvent[]): PcEventsPayload => ({ type: 'events', items, lastSeq: Math.max(0, ...items.map(e => e.seq)) })
const local = (): LocalData => ({ ...emptyLocal(), pcBridge: { ...defaultPcBridgeLocal(), enabled: true, automaticRestEvents: true } })
const reduce = (data: PcEventsPayload, value = local(), nowMs = at(1321)) => reducePcEvents({ payload: data, local: value, days: {}, inbox: [], nowMs })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(1321))
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
  await useApp.getState().saveLocal(() => local())
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('Reine PC-Ereignisprojektion', () => {
  it('hält Beobachtung, Quittungen und Cursor zusammen und verändert die Quellen nicht', () => {
    const source = local(); const original = structuredClone(source)
    const result = reduce(payload(event(1)), source)
    expect(source).toEqual(original)
    expect(result.days[date]?.pcOffAt).toBe(at(1320))
    expect(result.days[date]?.steps).toEqual({})
    expect(result.local.pcBridge).toMatchObject({ cursor: 1, receipts: ['event-1'], events: [event(1)] })
    expect(result.appliedIds).toEqual(['event-1'])
  })
  it('beobachtet ohne ausdrückliche Ruhefreigabe nur im lokalen Journal', () => {
    const source = local(); source.pcBridge!.automaticRestEvents = false
    expect(reduce(payload(event(1)), source).days).toEqual({})
    source.pcBridge!.automaticRestEvents = true; source.pcBridge!.enabled = false
    expect(reduce(payload(event(1)), source).days).toEqual({})
    expect(defaultPcBridgeLocal().preferences.enforceEnabled).toBe(false)
  })
  it('übernimmt thought/save-point in die bestehende Inbox, ohne Titel als Aufgabe oder Erledigung zu interpretieren', () => {
    const result = reduce(payload(event(1, 'thought', { text: '  Gedanke  ' }), event(2, 'save-point', { text: '  Stand  ', nextStep: '  weiter  ' })))
    expect(result.inbox).toMatchObject([{ id: 'pc:event-1', text: 'Gedanke', status: 'open', captureContext: 'PC' }, { id: 'pc:event-2', text: 'Stand', nextStep: 'weiter', status: 'open' }])
    expect(result.days).toEqual({})
    const replay = reducePcEvents({ payload: payload(event(1, 'thought', { text: '  Gedanke  ' }), event(2, 'save-point', { text: '  Stand  ', nextStep: '  weiter  ' })), ...result, nowMs: at(1322) })
    expect(replay.inbox).toEqual(result.inbox)
    expect(replay.appliedIds).toEqual(['event-1', 'event-2'])
  })
  it('verschiebt einen offenen oder schon später gewählten Abend nicht und hält eine alte Nachricht neutral', () => {
    const value = event(1, 'extended', { newStopAt: new Date(at(1400)).toISOString() })
    const initial = reduce(payload(value))
    expect(initial.days[date]?.override).toMatchObject({ lateUntil: 1400, adjusted: true })
    for (const lateUntil of ['open', 1420] as const) {
      const day = { date, override: { lateUntil }, steps: {} }
      const result = reducePcEvents({ payload: payload(value), local: local(), days: { [date]: day }, inbox: [], nowMs: at(1321) })
      expect(result.days[date]).toEqual(day)
    }
    expect(reduce(payload(value), local(), at(1330)).days).toEqual({})
    expect(reduce(payload(value), local(), at(1321, addDays(date, 1))).days).toEqual({})
  })
  it('ordnet eine Verlängerung vor 04 Uhr dem Vortag zu und überträgt keine PC-Pause auf den gesamten Handyplan', () => {
    const value = event(1, 'extended', { at: new Date(at(1470)).toISOString(), newStopAt: new Date(at(1500)).toISOString() })
    expect(reduce(payload(value), local(), at(1471)).days[date]?.override.lateUntil).toBe(1500)
    expect(reduce(payload(event(1, 'suspended-today'), event(2, 'resumed-today'))).days).toEqual({})
    const tooLate = { ...value, newStopAt: new Date(at(1680)).toISOString() }
    expect(reduce(payload(tooLate), local(), at(1471)).days).toEqual({})
  })
  it('überspringt keinen ungesehenen Tail anhand lastSeq und quittiert verlorene ACKs erneut', () => {
    const result = reduce({ ...payload(event(1)), lastSeq: 100 })
    expect(result.cursor).toBe(1)
    const empty = reducePcEvents({ payload: { type: 'events', items: [], lastSeq: 100 }, ...result, nowMs: at(1322) })
    expect(empty.cursor).toBe(1)
    const replay = reducePcEvents({ payload: payload(event(1)), ...result, nowMs: at(1322) })
    expect(replay.appliedIds).toEqual(['event-1'])
    expect(replay.cursor).toBe(1)
  })
  it('verwirft einen vollständigen Batch bei widersprüchlichen IDs, Reihenfolge, Datum oder Zukunft', () => {
    expect(() => reduce(payload(event(2), event(1)))).toThrow()
    expect(() => reduce(payload(event(1), event(2, 'thought', { id: 'event-1', text: 'A' })))).toThrow()
    expect(() => reduce(payload(event(1, 'thought', { text: 'A', date: addDays(date, 1) })))).toThrow('PC_LINK_EVENT_TIME_INVALID')
    expect(() => reduce(payload(event(1, 'thought', { text: 'A', at: new Date(at(1330)).toISOString() })))).toThrow('PC_LINK_EVENT_TIME_INVALID')
    const result = reduce(payload(event(1)))
    expect(() => reducePcEvents({ payload: payload(event(1, 'thought', { text: 'anders' })), ...result, nowMs: at(1322) })).toThrow('PC_LINK_EVENT_IDENTITY_CONFLICT')
  })
  it('erhält manuelle PC-Ruhe und strenge Nachtfakten und begrenzt das Journal', () => {
    const value = local(); value.guidance = { receipts: [], days: { [date]: { nightLockedAt: at(1300) } } }
    const day = { date, override: {}, steps: {}, pcOffAt: at(1290) }
    let result = reducePcEvents({ payload: payload(event(1)), local: value, days: { [date]: day }, inbox: [], nowMs: at(1321) })
    expect(result.days[date]).toEqual(day)
    for (let i = 2; i <= 600; i++) result = reducePcEvents({ payload: payload(event(i, 'pc-resumed')), ...result, nowMs: at(1321) })
    expect(result.local.pcBridge?.events).toHaveLength(256)
    expect(result.local.pcBridge?.receipts).toHaveLength(512)
    expect(result.local.guidance).toEqual(value.guidance)
    expect(validPcBridgeLocal(result.local.pcBridge)).toBe(true)
    expect(validPcBridgeLocal({ ...defaultPcBridgeLocal(), privateKey: 'never' })).toBe(false)
  })
})

describe('Atomare persistierte PC-Quittierung', () => {
  it('schreibt Cursor, Receipts, Tagesfakt und Inbox in genau einer Transaktion; kein Arbeitsende/XP', async () => {
    await useApp.getState().workStart({ at: at(1000) })
    const before = structuredClone({ local: useApp.getState().local, game: useApp.getState().game })
    const write = vi.spyOn(storage.repo!, 'putMany')
    const result = await useApp.getState().applyPcEvents(payload(event(1), event(2, 'thought', { text: 'Notiz' })))
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0]![0].map(record => [record.collection, record.id])).toEqual([['meta', 'local'], ['days', date], ['inbox', 'pc:event-2']])
    expect(result).toEqual({ appliedIds: ['event-1', 'event-2'], cursor: 2 })
    expect(useApp.getState().local.workSessions).toEqual(before.local.workSessions)
    expect(useApp.getState().game).toEqual(before.game)
    expect(useApp.getState().days[date]?.steps).toEqual({})
    expect(await storage.repo!.get<LocalData>('meta', 'local')).toMatchObject({ pcBridge: { cursor: 2, receipts: ['event-1', 'event-2'] } })
    await useApp.getState().load()
    write.mockClear()
    expect(await useApp.getState().applyPcEvents(payload(event(1), event(2, 'thought', { text: 'Notiz' })))).toEqual(result)
    expect(write).not.toHaveBeenCalled()
    expect(useApp.getState().inbox.filter(item => item.id === 'pc:event-2')).toHaveLength(1)
  })
  it('publiziert bei Datenbankfehler keine Wirkung und quittiert erst nach erfolgreichem Wiederholen', async () => {
    const before = { local: structuredClone(useApp.getState().local), days: structuredClone(useApp.getState().days), inbox: structuredClone(useApp.getState().inbox) }
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('disk'))
    await expect(useApp.getState().applyPcEvents(payload(event(1), event(2, 'thought', { text: 'Notiz' })))).rejects.toThrow('disk')
    expect(useApp.getState()).toMatchObject(before)
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.pcBridge?.cursor).toBe(0)
    expect(await storage.repo!.get('days', date)).toBeUndefined()
    expect(await storage.repo!.get('inbox', 'pc:event-2')).toBeUndefined()
    expect(await useApp.getState().applyPcEvents(payload(event(1), event(2, 'thought', { text: 'Notiz' })))).toMatchObject({ cursor: 2 })
  })
  it('serialisiert doppelte native Zustellungen und einmalige Inbox-Wirkung', async () => {
    const write = vi.spyOn(storage.repo!, 'putMany')
    const data = payload(event(1, 'thought', { text: 'Einmal' }))
    expect(await Promise.all([useApp.getState().applyPcEvents(data), useApp.getState().applyPcEvents(data)])).toEqual([{ appliedIds: ['event-1'], cursor: 1 }, { appliedIds: ['event-1'], cursor: 1 }])
    expect(write).toHaveBeenCalledTimes(1)
    expect(useApp.getState().inbox).toHaveLength(1)
  })
})

describe('PC-Verbindung ist weder Sicherungs- noch Importinhalt', () => {
  it('entfernt lokale Metadaten aus allen Exportauswahlen und aus einem importierten Container', () => {
    const data = local(); data.pcBridge!.pcName = 'Privater Rechner'
    const record = { collection: 'meta' as const, id: 'local', data, updated_at: at(1321), deleted: false }
    for (const selection of [{}, { health: false, work: false, places: false, deviceTests: false }]) {
      const backup = makeBackup([record], new Date(at(1321)), selection)
      expect(JSON.stringify(backup)).not.toContain('pcBridge')
      expect(JSON.stringify(backup)).not.toContain('Privater Rechner')
    }
    expect(JSON.stringify(makeBackup([{ ...record, deleted: true }]))).not.toContain('pcBridge')
    const parsed = parseBackup(JSON.stringify({ app: 'anker', version: 1, records: [record] }))
    expect((parsed[0]!.data as LocalData).pcBridge).toBeUndefined()
    const merged = previewImport(parsed, [record], 'restore', at(1322)).records[0]!.data as LocalData
    expect(merged.pcBridge).toEqual(data.pcBridge)
  })
})
