import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup, previewImport } from '../core/export/backup'
import { recordForSync } from '../core/syncPrivacy'
import { zonedToUtc } from '../core/time'
import { currentTimeCatalog, TIME_CATALOG_RECORD_ID, timeCatalogSourceRevision, type TimeCatalogRuntime, type TimeCatalogSnapshot } from '../core/timeCatalog'
import type { LocalData } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Rec, Repository } from '../data/types'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const now = zonedToUtc(date, 9 * 60)
let store: typeof import('./store')

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
const sourceData = () => {
  const st = store.useApp.getState()
  const local = { ...st.local }
  delete local.timeCatalog
  return structuredClone({ settings: st.settings, game: st.game, days: st.days, inbox: st.inbox, events: st.events, local })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(now)
  vi.resetModules()
  storage.repo = new MemoryRepository()
  store = await import('./store')
  store.useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal() })
  await store.useApp.getState().load()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('Persistierter lokaler Lesecache ohne zweiten Zeitplanbesitzer', () => {
  it('schreibt bei Altständen ohne Öffnen der Übersicht keinen Katalog', async () => {
    const write = vi.spyOn(storage.repo!, 'put')
    await vi.advanceTimersByTimeAsync(400)
    await store.useApp.getState().saveSettings((s) => ({ ...s, bed: s.bed + 5 }))
    await vi.advanceTimersByTimeAsync(400)
    expect(store.useApp.getState().local.timeCatalog).toBeUndefined()
    expect(write.mock.calls.filter(([c, id]) => c === 'meta' && id === 'local')).toHaveLength(0)
  })

  it('initialisiert bewusst, koalesziert parallele Aufrufe und bewahrt sämtliche Quelldaten', async () => {
    await store.useApp.getState().saveLocal((local) => ({ ...local, work: [{ id: 'secret', title: 'Vertrauliche Arbeit', createdAt: now, deadline: now + 3600_000 }] }))
    const before = sourceData()
    const write = vi.spyOn(storage.repo!, 'put')
    const action = store.useApp.getState().refreshTimeCatalog
    await Promise.all([action(), action(), action()])
    const cache = store.useApp.getState().local.timeCatalog!
    expect(cache.entries.some((entry) => entry.label.includes('Vertrauliche Arbeit'))).toBe(true)
    expect(currentTimeCatalog(store.useApp.getState(), now)).toBe(cache)
    expect(await storage.repo!.get<TimeCatalogSnapshot>('meta', TIME_CATALOG_RECORD_ID)).toEqual(cache)
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.timeCatalog).toBeUndefined()
    expect(write.mock.calls.filter(([c, id]) => c === 'meta' && id === TIME_CATALOG_RECORD_ID)).toHaveLength(1)
    await action()
    expect(write).toHaveBeenCalledTimes(1)
    expect(sourceData()).toEqual(before)
  })

  it('aktualisiert nach echten Quellenänderungen einmal und löst aus Cachewrites keine Planänderungsschleife aus', async () => {
    await vi.advanceTimersByTimeAsync(400)
    await store.useApp.getState().refreshTimeCatalog()
    const before = store.useApp.getState().local.timeCatalog!
    const revision = timeCatalogSourceRevision(store.useApp.getState(), Date.now())
    const listener = vi.fn()
    const unsubscribe = store.onPlanChange(listener)
    const write = vi.spyOn(storage.repo!, 'put')
    await store.useApp.getState().saveSettings((s) => ({ ...s, support: { ...s.support, windDown: { ...s.support.windDown, enabled: true } } }))
    expect(currentTimeCatalog(store.useApp.getState(), Date.now())).toBeUndefined()
    await vi.advanceTimersByTimeAsync(400)
    const after = store.useApp.getState().local.timeCatalog!
    expect(after.sourceRevision).not.toBe(revision)
    expect(after).not.toBe(before)
    expect(after.entries.some((entry) => entry.functionId === 'reminder.wind-down' && entry.status === 'planned')).toBe(true)
    expect(currentTimeCatalog(store.useApp.getState(), Date.now())).toBe(after)
    await vi.advanceTimersByTimeAsync(4000)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(write.mock.calls.filter(([c, id]) => c === 'meta' && id === TIME_CATALOG_RECORD_ID)).toHaveLength(1)
    unsubscribe()
  })

  it('verliert eine während des Cachewrites eingehende echte Änderung nicht und projiziert zuletzt die neue Quelle', async () => {
    const reached = deferred(); const release = deferred()
    const put = storage.repo!.put.bind(storage.repo!)
    let held = false
    vi.spyOn(storage.repo!, 'put').mockImplementation(async (collection, id, data) => {
      if (collection === 'meta' && id === TIME_CATALOG_RECORD_ID && !held) { held = true; reached.resolve(); await release.promise }
      await put(collection, id, data)
    })
    const first = store.useApp.getState().refreshTimeCatalog()
    await reached.promise
    const edit = store.useApp.getState().saveLocal((local) => ({ ...local, work: [{ id: 'new', title: 'Neue echte Quelle', createdAt: now, earliestStart: now + 3600_000 }] }))
    const again = store.useApp.getState().refreshTimeCatalog()
    release.resolve()
    await Promise.all([first, edit, again])
    const st = store.useApp.getState()
    expect(st.local.work).toEqual([expect.objectContaining({ id: 'new', title: 'Neue echte Quelle' })])
    expect(st.local.timeCatalog?.entries.some((entry) => entry.label.includes('Neue echte Quelle'))).toBe(true)
    expect(currentTimeCatalog(st, now)).toBe(st.local.timeCatalog)
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.work).toEqual(st.local.work)
  })

  it('lässt echte LWW-Zeitstempel bei Cacheupdates unberührt und nimmt einen dazwischen erstellten Teilimport an', async () => {
    await store.useApp.getState().saveLocal((local) => ({ ...local, work: [{ id: 'keep', title: 'Bestehende Arbeit', createdAt: now }] }))
    const original = (await storage.repo!.all()).find((record) => record.collection === 'meta' && record.id === 'local')!
    await storage.repo!.markClean(await storage.repo!.all())
    vi.setSystemTime(now + 10_000)
    await store.useApp.getState().refreshTimeCatalog()
    vi.setSystemTime(now + 70_000)
    await store.useApp.getState().refreshTimeCatalog()
    const source = (await storage.repo!.all()).find((record) => record.collection === 'meta' && record.id === 'local')!
    expect(source.updated_at).toBe(original.updated_at)
    expect(source.data).toEqual(original.data)
    expect((source.data as LocalData).timeCatalog).toBeUndefined()
    expect((await storage.repo!.dirty()).flatMap((record) => recordForSync(record) ?? [])).toEqual([])
    const imported: Rec = { collection: 'meta', id: 'local', updated_at: now + 5_000, deleted: false,
      data: { handover: { [date]: { open: 'Auf anderem Gerät früher ergänzt', next: 'Bewusst weiter' } } } }
    expect(await store.useApp.getState().importRecords([imported])).toBe(1)
    expect(store.useApp.getState().local.handover[date]?.open).toBe('Auf anderem Gerät früher ergänzt')
    expect(store.useApp.getState().local.work).toEqual([expect.objectContaining({ id: 'keep' })])
  })

  it('hält echte native Evidenz beim Hintergrundrefresh und verwirft sie nach Ablauf ihrer Frische', async () => {
    const runtime: TimeCatalogRuntime = { alarm: { observedAt: now, state: { snoozeAt: now + 5 * 60_000 } } }
    await store.useApp.getState().refreshTimeCatalog(runtime)
    await store.useApp.getState().saveSettings((s) => ({ ...s, bed: s.bed + 5 }))
    await vi.advanceTimersByTimeAsync(400)
    expect(store.useApp.getState().local.timeCatalog?.entries.find((entry) => entry.functionId === 'alarm.snooze' && entry.at)?.evidence).toBe('native-snapshot')
    await vi.advanceTimersByTimeAsync(2 * 60_000)
    expect(currentTimeCatalog(store.useApp.getState(), Date.now())).toBeUndefined()
    await store.useApp.getState().refreshTimeCatalog()
    expect(store.useApp.getState().local.timeCatalog?.entries.some((entry) => entry.evidence === 'native-snapshot')).toBe(false)
    expect(currentTimeCatalog(store.useApp.getState(), Date.now())).toBe(store.useApp.getState().local.timeCatalog)
  })

  it('lässt den abgeleiteten Privatinhalt in allen Backupwahlen und Sync weg, auch in Tombstones', async () => {
    await store.useApp.getState().saveLocal((local) => ({ ...local, work: [{ id: 'secret', title: 'GEHEIM-NUR-CACHE', createdAt: now, deadline: now + 3600_000 }] }))
    await store.useApp.getState().refreshTimeCatalog()
    const saved = await storage.repo!.all()
    const localRecord = saved.find((record) => record.collection === 'meta' && record.id === 'local')!
    const cacheRecord = saved.find((record) => record.collection === 'meta' && record.id === TIME_CATALOG_RECORD_ID)!
    expect(JSON.stringify(cacheRecord.data)).toContain('GEHEIM-NUR-CACHE')
    for (const selection of [{}, { work: false }, { places: false }, { health: false }, { deviceTests: false }, { work: false, places: false, health: false, deviceTests: false }]) {
      const backup = makeBackup(saved, new Date(now), selection)
      expect(JSON.stringify(backup)).not.toContain('timeCatalog')
      expect(backup.records.some((record) => record.id === TIME_CATALOG_RECORD_ID)).toBe(false)
      if (selection.work === false) expect(JSON.stringify(backup)).not.toContain('GEHEIM-NUR-CACHE')
      expect((backup.records.find((record) => record.collection === 'meta' && record.id === 'local')?.data as LocalData).timeCatalog).toBeUndefined()
    }
    expect(recordForSync(localRecord)).toBeUndefined()
    expect(recordForSync(cacheRecord)).toBeUndefined()
    expect(JSON.stringify(makeBackup([{ ...localRecord, deleted: true }]))).not.toContain('timeCatalog')
    expect(makeBackup([{ ...cacheRecord, deleted: true }]).records).toEqual([])
  })

  it('ignoriert sogar gefälschte Importcaches ohne echte Daten zu verwerfen und erhält ausgelassene Teilbackupgruppen', async () => {
    await store.useApp.getState().saveLocal((local) => ({ ...local, work: [{ id: 'keep', title: 'Bestehende Arbeit', createdAt: now }] }))
    await store.useApp.getState().refreshTimeCatalog()
    const incoming: Rec = { collection: 'meta', id: 'local', updated_at: now + 1, deleted: false, data: {
      handover: { [date]: { open: 'Bewusste neue Notiz', next: 'Kleiner nächster Schritt' } }, timeCatalog: { version: 1, sourceRevision: 'forged', entries: [{ label: 'GEFÄLSCHTE-QUELLE' }] },
    } }
    const injectedCache = { ...incoming, id: TIME_CATALOG_RECORD_ID, data: { forged: 'GEFÄLSCHTE-CACHE-DB' } }
    const parsed = parseBackup(JSON.stringify({ app: 'anker', version: 1, records: [incoming, injectedCache] }))
    expect(parsed).toHaveLength(1)
    expect((parsed[0]?.data as LocalData).timeCatalog).toBeUndefined()
    expect(previewImport([injectedCache], await storage.repo!.all()).records).toEqual([])
    expect(await store.useApp.getState().importRecords([injectedCache])).toBe(0)
    const preview = previewImport([incoming], await storage.repo!.all())
    expect((preview.records[0]?.data as LocalData).timeCatalog).toBeUndefined()
    await store.useApp.getState().importRecords([incoming])
    expect(store.useApp.getState().local.work).toEqual([expect.objectContaining({ id: 'keep' })])
    expect(store.useApp.getState().local.handover[date]?.open).toBe('Bewusste neue Notiz')
    expect(JSON.stringify(store.useApp.getState().local)).not.toContain('GEFÄLSCHTE-QUELLE')
    await store.useApp.getState().refreshTimeCatalog()
    expect(currentTimeCatalog(store.useApp.getState(), now)).toBe(store.useApp.getState().local.timeCatalog)
  })

  it('veröffentlicht nach Schreibfehlern keinen halben Cache und erlaubt einen erneuten Versuch', async () => {
    const before = sourceData()
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Disk full'))
    await expect(store.useApp.getState().refreshTimeCatalog()).rejects.toThrow('Disk full')
    expect(store.useApp.getState().local.timeCatalog).toBeUndefined()
    expect(sourceData()).toEqual(before)
    await store.useApp.getState().refreshTimeCatalog()
    expect(currentTimeCatalog(store.useApp.getState(), now)).toBeDefined()
  })
})
