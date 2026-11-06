import { afterEach, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
afterEach(() => vi.restoreAllMocks())

it('übernimmt nach Widerruf keinen hinter einer lokalen Schreiboperation wartenden Sync-Pull', async () => {
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-06'), local: emptyLocal(), days: {}, inbox: [], game: initialGame('2026-11-06') })
  await useApp.getState().load()
  const original = storage.repo.put.bind(storage.repo)
  let entered!: () => void; let release!: () => void
  const waiting = new Promise<void>((resolve) => { entered = resolve })
  const hold = new Promise<void>((resolve) => { release = resolve })
  vi.spyOn(storage.repo, 'put').mockImplementationOnce(async (...args) => { entered(); await hold; return original(...args) })
  const local = useApp.getState().saveLocal((value) => ({ ...value, taskContext: 'home' }))
  await waiting
  let accepted = true
  const pull = useApp.getState().mergeRecords([{ collection: 'inbox', id: 'remote', data: { id: 'remote', text: 'Alter Remoteentwurf', status: 'open', createdAt: 1 }, updated_at: Date.now() + 1000, deleted: false }], false, () => accepted)
  accepted = false; release(); await local
  expect(await pull).toBe(0)
  expect(useApp.getState().inbox.some((note) => note.id === 'remote')).toBe(false)
  expect(await storage.repo.get('inbox', 'remote')).toBeUndefined()
})
