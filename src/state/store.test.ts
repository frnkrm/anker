import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup } from '../core/export/backup'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(async () => {
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-02'), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
})

describe('Speichern und erneutes Laden', () => {
  it('behält gerade gestartete Arbeit, wenn ein Hintergrund-Laden noch einen alten Stand liest', async () => {
    const repo = storage.repo!
    const read = repo.get.bind(repo)
    const reached = deferred()
    const release = deferred()
    vi.spyOn(repo, 'get').mockImplementation(async (collection, id) => {
      const value = await read(collection, id)
      if (collection === 'meta' && id === 'local') {
        reached.resolve()
        await release.promise
      }
      return value
    })
    const reload = useApp.getState().load()
    await reached.promise
    await useApp.getState().workStart()
    release.resolve()
    await reload
    await useApp.getState().workStart() // Ein weiterer Tipp darf keine zweite Sitzung erzeugen.
    expect(useApp.getState().local.workSessions).toHaveLength(1)
    expect(await read('meta', 'local')).toEqual(useApp.getState().local)
  })

  it('zeigt nach gleichzeitiger lokaler Eingabe sowohl neue Sync-Daten als auch den eigenen Eintrag', async () => {
    const repo = storage.repo!
    await repo.merge([{
      collection: 'inbox', id: 'remote', updated_at: 1, deleted: false,
      data: { id: 'remote', text: 'Vom anderen Gerät', status: 'open', createdAt: 1 },
    }])
    const list = repo.list.bind(repo)
    const reached = deferred()
    const release = deferred()
    vi.spyOn(repo, 'list').mockImplementation(async (collection) => {
      const value = await list(collection)
      if (collection === 'inbox') {
        reached.resolve()
        await release.promise
      }
      return value
    })
    const reload = useApp.getState().load()
    await reached.promise
    await useApp.getState().addInbox('Mein neuer Gedanke')
    release.resolve()
    await reload
    expect(useApp.getState().inbox.map((item) => item.text).sort()).toEqual(['Mein neuer Gedanke', 'Vom anderen Gerät'])
  })

  it('wartet vor einem erneuten Laden auf bereits laufende Schreibvorgänge', async () => {
    const repo = storage.repo!
    const put = repo.put.bind(repo)
    const reached = deferred()
    const release = deferred()
    vi.spyOn(repo, 'put').mockImplementation(async (collection, id, data) => {
      if (collection === 'meta' && id === 'local') {
        reached.resolve()
        await release.promise
      }
      await put(collection, id, data)
    })
    const start = useApp.getState().workStart()
    await reached.promise
    let loaded = false
    const reload = useApp.getState().load().then(() => { loaded = true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(loaded).toBe(false)
    release.resolve()
    await Promise.all([start, reload])
    expect(useApp.getState().local.workSessions).toHaveLength(1)
  })

  it('schreibt Tagespunkte vor einer späteren Spieländerung und verliert keine Einlösung', async () => {
    const repo = storage.repo!
    const put = repo.put.bind(repo)
    const reached = deferred()
    const release = deferred()
    let first = true
    vi.spyOn(repo, 'put').mockImplementation(async (collection, id, data) => {
      if (first) {
        first = false
        reached.resolve()
        await release.promise
      }
      await put(collection, id, data)
    })
    const step = useApp.getState().setStep('2026-11-02', 'morning', 'water', 'done')
    await reached.promise
    const game = useApp.getState().setGame((current) => ({ ...current, spent: 10 }))
    release.resolve()
    await Promise.all([step, game])
    await useApp.getState().load()
    expect(useApp.getState().game.spent).toBe(10)
    expect(useApp.getState().game.xp).toBeGreaterThan(0)
  })

  it('speichert Start und Stopp in Eingabereihenfolge und startet bei Doppeltippen nur einmal', async () => {
    const repo = storage.repo!
    const put = repo.put.bind(repo)
    const reached = deferred()
    const release = deferred()
    let writes = 0
    vi.spyOn(repo, 'put').mockImplementation(async (collection, id, data) => {
      writes++
      if (writes === 1) {
        reached.resolve()
        await release.promise
      }
      await put(collection, id, data)
    })
    const start = useApp.getState().workStart({ at: 100 })
    await reached.promise
    const duplicate = useApp.getState().workStart({ at: 200 })
    const stop = useApp.getState().workStop(300)
    expect(writes).toBe(1)
    release.resolve()
    await Promise.all([start, duplicate, stop])
    await useApp.getState().load()
    expect(useApp.getState().local.workSessions).toHaveLength(1)
    expect(useApp.getState().local.workSessions[0]).toMatchObject({ startAt: 100, endAt: 300 })
  })
})

describe('Sicherungsimport', () => {
  it('ergänzt fehlende Einstellungen aus älteren Sicherungen und bleibt nach Neustart ladbar', async () => {
    const records = parseBackup(JSON.stringify(makeBackup([
      { collection: 'settings', id: 'main', data: { version: 1, onboarded: true }, updated_at: Date.now() + 1000, deleted: false },
    ])))
    expect(await useApp.getState().importRecords(records)).toBe(1)
    expect((await storage.repo!.dirty()).some((record) => record.collection === 'settings' && record.id === 'main')).toBe(true)
    await useApp.getState().load()
    const settings = useApp.getState().settings
    expect(settings.onboarded).toBe(true)
    expect(settings.anchor.wake).toBeTypeOf('number')
    expect(settings.work).toHaveLength(7)
  })

  it('weist beschädigte Einstellungen vor dem Schreiben ab und erhält vorhandene Daten', async () => {
    await useApp.getState().saveSettings((settings) => ({ ...settings, homeOfficeMessage: 'Mein gespeicherter Text' }))
    const before = await storage.repo!.all()
    const malformed = [
      {},
      { version: 1, onboarded: true, work: Array.from({ length: 7 }, () => ({})) },
      { version: 1, onboarded: true, routines: { morning: [{ id: 'water', title: 'Wasser' }] } },
    ]
    for (const data of malformed) {
      await expect(async () => {
        const records = parseBackup(JSON.stringify(makeBackup([
          { collection: 'settings', id: 'main', data, updated_at: Date.now() + 1000, deleted: false },
        ])))
        await useApp.getState().importRecords(records)
      }).rejects.toThrow('ungültige Einstellungen')
      expect(await storage.repo!.all()).toEqual(before)
    }
    await useApp.getState().load()
    expect(useApp.getState().settings.homeOfficeMessage).toBe('Mein gespeicherter Text')
  })
})
