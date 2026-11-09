import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { guidancePreferences } from '../core/guidance'
import { buildDayPlan } from '../core/planner'
import { makeBackup, parseBackup, previewImport } from '../core/export/backup'
import { defaultPcBridgeLocal, reducePcEvents, validPcBridgeLocal } from '../core/pcLink'
import type { PcEventsPayload, PcLinkEvent } from '../core/pcLink'
import { addDays, zonedToUtc } from '../core/time'
import type { DayLog, LocalData, Settings } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-12'
const at = (minutes: number, day = date) => zonedToUtc(day, minutes)
const event = (seq: number, kind: PcLinkEvent['kind'] = 'pc-rest', patch: Partial<PcLinkEvent> = {}): PcLinkEvent => ({ id: `event-${seq}`, seq, at: new Date(at(1320)).toISOString(), date, kind, ...(kind === 'pc-rest' ? { basis: 'lock' as const } : {}), ...patch })
const payload = (...items: PcLinkEvent[]): PcEventsPayload => ({ type: 'events', items, lastSeq: Math.max(0, ...items.map(e => e.seq)) })
const local = (): LocalData => ({ ...emptyLocal(), pcBridge: { ...defaultPcBridgeLocal(), enabled: true, automaticRestEvents: true } })
const reduce = (data: PcEventsPayload, value = local(), nowMs = at(1321)) => reducePcEvents({ payload: data, local: value, days: {}, inbox: [], nowMs })
const bedtimeSettings = (screenOffMin = 30): Settings => {
  const settings = defaultSettings(date)
  settings.anchor.manual = { wake: true, pcStop: true, bed: true }
  settings.pcStop = 1350
  settings.bed = 1380
  settings.sleep.screenOffMin = screenOffMin
  settings.guidance = { ...guidancePreferences(), enabled: true, eveningEscalation: true }
  return settings
}

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
  it('übernimmt eine Bettzeitverlängerung genau einmal ohne zusätzliche Bildschirm-aus-Minuten und hält Speichern atomar', async () => {
    await useApp.getState().saveSettings(() => bedtimeSettings())
    const before = { local: structuredClone(useApp.getState().local), days: structuredClone(useApp.getState().days), game: structuredClone(useApp.getState().game) }
    const data = payload(event(1, 'extended', { anchor: 'bed', newStopAt: new Date(at(1395)).toISOString() }))
    const writes = vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('disk'))
    await expect(useApp.getState().applyPcEvents(data)).rejects.toThrow('disk')
    expect(useApp.getState()).toMatchObject(before)
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.pcBridge?.cursor).toBe(0)
    expect(await storage.repo!.get('days', date)).toBeUndefined()
    writes.mockClear()
    expect(await useApp.getState().applyPcEvents(data)).toEqual({ appliedIds: ['event-1'], cursor: 1 })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(writes.mock.calls[0]![0].map(record => [record.collection, record.id])).toEqual([['meta', 'local'], ['days', date]])
    expect(useApp.getState().days[date]?.override).toEqual({ lateUntil: 1365, adjusted: true })
    expect(planFor(date).bed).toBe(1395)
    expect(useApp.getState().game).toEqual(before.game)
    expect(useApp.getState().days[date]?.steps).toEqual({})
    expect((await storage.repo!.get<DayLog>('days', date))?.override.lateUntil).toBe(1365)
    writes.mockClear()
    expect(await useApp.getState().applyPcEvents(data)).toEqual({ appliedIds: ['event-1'], cursor: 1 })
    expect(writes).not.toHaveBeenCalled()
    expect(planFor(date).bed).toBe(1395)
  })
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

describe('Explizite Bettzeit-Verlängerung aus demselben Tagesplan', () => {
  it.each([0, 5, 30, 90])('plant bei %s Bildschirm-aus-Minuten Bett +15 als genau +15 statt einer zweiten Pufferzugabe', screenOff => {
    const settings = bedtimeSettings(screenOff)
    const currentPlan = buildDayPlan({ date, settings })
    const value = event(1, 'extended', { anchor: 'bed', newStopAt: new Date(at(1395)).toISOString() })
    const result = reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs: at(1321), settings, currentPlan })
    const next = buildDayPlan({ date, settings, override: result.days[date]?.override })
    expect(result.days[date]?.override.lateUntil).toBe(1395 - Math.min(screenOff, 30))
    expect(next.bed).toBe(1395)
    expect(result.days[date]?.steps).toEqual({})
  })
  it('erhält die bisherige PC-Stopp-Semantik für explizite und alte Meldungen', () => {
    const settings = bedtimeSettings()
    const currentPlan = buildDayPlan({ date, settings })
    for (const anchor of [undefined, 'pc-stop'] as const) {
      const value = event(1, 'extended', { ...(anchor === undefined ? {} : { anchor }), newStopAt: new Date(at(1365)).toISOString() })
      const result = reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs: at(1321), settings, currentPlan })
      expect(result.days[date]?.override.lateUntil).toBe(1365)
      const next = buildDayPlan({ date, settings, override: result.days[date]?.override })
      expect(next.pcStop).toBe(1365)
      expect(next.bed).toBe(1395)
    }
  })
  it('rundet eine Sekunden-Zielzeit auf die nächste darstellbare Planminute auf', () => {
    const settings = bedtimeSettings()
    const value = event(1, 'extended', { anchor: 'bed', newStopAt: new Date(at(1395) + 30_000).toISOString() })
    const result = reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs: at(1321), settings, currentPlan: buildDayPlan({ date, settings }) })
    expect(buildDayPlan({ date, settings, override: result.days[date]?.override }).bed).toBe(1396)
  })
  it('ordnet eine Bettverlängerung nach Mitternacht weiterhin derselben Nacht zu', () => {
    const settings = bedtimeSettings()
    settings.pcStop = 0; settings.bed = 30
    const value = event(1, 'extended', { anchor: 'bed', at: new Date(at(1469)).toISOString(), newStopAt: new Date(at(1485)).toISOString() })
    const result = reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs: at(1469), settings, currentPlan: buildDayPlan({ date, settings }) })
    expect(result.days[date]?.override.lateUntil).toBe(1455)
    expect(result.days[addDays(date, 1)]).toBeUndefined()
    expect(buildDayPlan({ date, settings, override: result.days[date]?.override }).bed).toBe(1485)
  })
  it('bewahrt ein offenes Ende, spätere Handyentscheidungen und alte Nachrichten unverändert', () => {
    const settings = bedtimeSettings()
    const value = event(1, 'extended', { anchor: 'bed', newStopAt: new Date(at(1395)).toISOString() })
    for (const lateUntil of ['open', 1390] as const) {
      const day: DayLog = { date, override: { lateUntil }, steps: {} }
      const result = reducePcEvents({ payload: payload(value), local: local(), days: { [date]: day }, inbox: [], nowMs: at(1321), settings, currentPlan: buildDayPlan({ date, settings, override: day.override }) })
      expect(result.days[date]).toEqual(day)
    }
    const laterPhone = bedtimeSettings(); laterPhone.bed = 1410
    expect(reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs: at(1321), settings: laterPhone, currentPlan: buildDayPlan({ date, settings: laterPhone }) }).days).toEqual({})
    for (const nowMs of [at(1330), at(1321, addDays(date, 1))]) {
      expect(reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs, settings, currentPlan: buildDayPlan({ date, settings }) }).days).toEqual({})
    }
  })
  it('journalisiert ohne bekannte passende Abendfolge nur die ausdrückliche PC-Nachricht', () => {
    const settings = bedtimeSettings()
    const value = event(1, 'extended', { anchor: 'bed', newStopAt: new Date(at(1395)).toISOString() })
    const currentPlan = buildDayPlan({ date, settings })
    const masterOff = { ...settings, guidance: { ...settings.guidance!, enabled: false } }
    const sequenceOff = { ...settings, guidance: { ...settings.guidance!, eveningEscalation: false } }
    for (const context of [{ currentPlan }, { settings }, { settings: masterOff, currentPlan }, { settings: sequenceOff, currentPlan }, { settings, currentPlan: { ...currentPlan, date: addDays(date, 1) } }]) {
      const result = reducePcEvents({ payload: payload(value), local: local(), days: {}, inbox: [], nowMs: at(1321), ...context })
      expect(result.days).toEqual({})
      expect(result.appliedIds).toEqual(['event-1'])
      expect(result.local.pcBridge?.events).toEqual([value])
    }
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
