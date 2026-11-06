import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const context = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => context.repo! }))
beforeEach(async () => {
  context.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-06'), local: emptyLocal(), events: [] })
  await useApp.getState().load()
})
afterEach(() => vi.restoreAllMocks())
const event = { id: 'calendar', title: 'Termin', start: 1000, end: 2000, allDay: false }
it('persistiert Kalenderinhalt und Aktualitätsstatus zusammen vor RAM-Erfolg und erhält beides beim Fehler', async () => {
  const app = () => useApp.getState()
  const write = vi.spyOn(context.repo!, 'putMany').mockRejectedValueOnce(new Error('Disk full'))
  await expect(app().applyCalendarSnapshot([event], { state: 'ready', checkedAt: 2000, fetchedAt: 2000 }, () => true)).rejects.toThrow('Disk full')
  expect(app().events).toEqual([]); expect(app().local.extras?.calendar).toBeUndefined()
  expect(await app().applyCalendarSnapshot([event], { state: 'ready', checkedAt: 2000, fetchedAt: 2000 }, () => true)).toBe(true)
  expect(write.mock.calls.at(-1)![0].map((row) => row.id).sort()).toEqual(['events', 'local'])
  await app().load(); expect(app().events).toEqual([event]); expect(app().local.extras?.calendar?.state).toBe('ready')
})
it('prüft den Importauftrag erst innerhalb der Schreibbarriere nach einer wartenden UI-Aktion', async () => {
  const original = context.repo!.put.bind(context.repo!)
  let release!: () => void; let reached!: () => void
  const held = new Promise<void>((resolve) => { release = resolve }); const entered = new Promise<void>((resolve) => { reached = resolve })
  vi.spyOn(context.repo!, 'put').mockImplementationOnce(async (...args) => { reached(); await held; await original(...args) })
  const saving = useApp.getState().saveLocal((local) => ({ ...local, taskContext: 'home' }))
  await entered
  let accepted = true
  const fetching = useApp.getState().applyCalendarSnapshot([event], { state: 'ready', checkedAt: 2000 }, () => accepted)
  accepted = false; release(); await saving
  expect(await fetching).toBe(false); expect(useApp.getState().events).toEqual([])
})
