import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { MemoryRepository } from '../data/memory'
import type { Rec, Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const at = Date.parse(`${date}T10:00:00+01:00`)
const app = () => useApp.getState()
const incoming = (collection: Rec['collection'], id: string, data: unknown): Rec => ({ collection, id, data, updated_at: at + 1000, deleted: false })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), game: initialGame(date), days: {}, inbox: [] })
  await app().load()
})
afterEach(() => vi.useRealTimers())

describe('Ein gemeinsamer sicherer Import-/Sync-Schreibweg', () => {
  it('weist einen beschädigten kompletten Batch vor dem ersten Merge zurück', async () => {
    const merge = vi.spyOn(storage.repo!, 'merge')
    const before = { settings: structuredClone(app().settings), local: structuredClone(app().local), game: structuredClone(app().game) }
    await expect(app().mergeRecords([
      incoming('inbox', 'note', { id: 'note', text: 'Nicht teilweise übernehmen', createdAt: at, status: 'open' }),
      incoming('game', 'main', { xp: 4 }),
    ])).rejects.toThrow('Spielstände')
    expect(merge).not.toHaveBeenCalled()
    expect(await storage.repo!.all()).toEqual([])
    expect(app().settings).toEqual(before.settings)
    expect(app().local).toEqual(before.local)
    expect(app().game).toEqual(before.game)
  })

  it('berechnet eine Teilsicherung nach vorherigen wartenden lokalen Änderungen aus dem frischen Bestand', async () => {
    let release!: () => void; let reached!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    const began = new Promise<void>((resolve) => { reached = resolve })
    const put = storage.repo!.put.bind(storage.repo!)
    vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { reached(); await held; await put(...args) })
    const saving = app().saveLocal((local) => ({ ...local, work: [{ id: 'new-work', title: 'Gerade gespeicherte Arbeit', createdAt: at }] }))
    await began
    const importing = app().importRecords([incoming('meta', 'local', { handover: { [date]: { open: 'Importiert', next: 'Datei öffnen' } } })])
    release(); await saving
    expect(await importing).toBe(1)
    expect(app().local.work).toEqual([{ id: 'new-work', title: 'Gerade gespeicherte Arbeit', createdAt: at, reminderRevision: expect.any(String) }])
    expect(app().local.handover[date]?.next).toBe('Datei öffnen')
    await app().load()
    expect(app().local.work[0]?.title).toBe('Gerade gespeicherte Arbeit')
  })

  it('publiziert bei einem Mergefehler weder einen neuen Spielstand noch einen Importerfolg', async () => {
    const before = structuredClone(app().game)
    vi.spyOn(storage.repo!, 'merge').mockRejectedValueOnce(new Error('Test-Speicherfehler'))
    await expect(app().importRecords([incoming('game', 'main', { ...before, xp: 123 })])).rejects.toThrow('Test-Speicherfehler')
    expect(app().game).toEqual(before)
    expect(await storage.repo!.all()).toEqual([])
  })
})
