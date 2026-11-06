import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { taskAssistanceRevision } from '../core/assistance'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { resolveTask } from '../core/tasks'
import type { TaskRef } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const app = () => useApp.getState()
const done = { id: 'done', title: 'Wirklich erledigt', doneAt: 7, estimateMin: 4 }
const proposed = [{ id: 'new', title: 'Kleiner Vorschlag', estimateMin: 2 }]
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T09:00:00Z'))
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-06'), local: emptyLocal(), days: {}, inbox: [], game: initialGame('2026-11-06') })
  await app().load()
  await app().saveLocal((local) => ({ ...local, assistance: { ai: { enabled: true, at: 1, version: 1 } } }))
})
afterEach(() => vi.useRealTimers())
async function create(kind: TaskRef['kind'] = 'task') {
  const ref: TaskRef = kind === 'work' ? { kind, id: (await app().addWorkTask('Bericht'))! } : { kind, id: (await app().addInbox('Privater Entwurf'))! }
  if (kind === 'task') await app().updateInbox(ref.id, { status: 'task' })
  await app().replaceTaskParts(ref, [done, { id: 'open', title: 'Bisher offen' }])
  const task = () => resolveTask(ref, app().inbox, app().local.work)!
  return { ref, task, expected: { purpose: 'ai' as const, revision: taskAssistanceRevision(ref, task()) } }
}
describe('Atomare bewusste KI-Übernahme in bestehende Aufgaben', () => {
  it.each(['task', 'work'] as const)('erhält echte abgeschlossene Teile und Spielstand bei %s', async (kind) => {
    const { ref, task, expected } = await create(kind)
    const game = structuredClone(app().game)
    await app().replaceTaskParts(ref, [...proposed, { id: done.id, title: 'Darf Abschluss nicht ändern', estimateMin: 99 }], expected)
    expect(task().subtasks).toEqual([...proposed, done])
    expect(task().done).not.toBe(true)
    expect(app().game).toEqual(game)
    await app().load()
    expect(task().subtasks).toEqual([...proposed, done])
  })
  it.each(['edit', 'done'] as const)('verwirft eine hinter einer laufenden %s-Änderung wartende alte Vorschau', async (mode) => {
    const { ref, task, expected } = await create()
    const original = storage.repo!.putMany.bind(storage.repo!)
    let entered!: () => void; let release!: () => void
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve })
    const hold = new Promise<void>((resolve) => { release = resolve })
    const writes = vi.spyOn(storage.repo!, 'putMany').mockImplementationOnce(async (records) => { entered(); await hold; await original(records) })
    const edit = mode === 'edit' ? app().replaceTaskParts(ref, [done, { id: 'open', title: 'Inzwischen bearbeitet' }]) : app().setTaskPartDone(ref, 'open', true)
    await enteredPromise
    const apply = app().replaceTaskParts(ref, proposed, expected)
    const rejected = expect(apply).rejects.toThrow('Aufgabe hat sich geändert')
    release(); await edit; await rejected
    expect(writes).toHaveBeenCalledTimes(1)
    expect(task().subtasks?.find((part) => part.id === done.id)).toEqual(done)
    expect(task().subtasks?.find((part) => part.id === 'open')).toMatchObject(mode === 'edit' ? { title: 'Inzwischen bearbeitet' } : { doneAt: Date.now() })
    expect(task().subtasks?.some((part) => part.id === 'new')).toBe(false)
  })
  it('prüft Widerruf innerhalb der Schreibwarteschlange und erhält offene und erledigte Teile', async () => {
    const { ref, task, expected } = await create()
    const original = storage.repo!.put.bind(storage.repo!)
    let entered!: () => void; let release!: () => void
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve })
    const hold = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { entered(); await hold; return original(...args) })
    const before = structuredClone(task())
    const revoke = app().saveLocal((local) => ({ ...local, assistance: { ai: { enabled: false, at: Date.now(), version: 1 } } }))
    await enteredPromise
    const apply = app().replaceTaskParts(ref, proposed, expected)
    const rejected = expect(apply).rejects.toThrow('KI-Freigabe ist ausgeschaltet')
    release(); await revoke; await rejected
    expect(task()).toEqual(before)
    await app().load(); expect(task()).toEqual(before)
  })
  it('meldet eine entfernte oder bereits abgeschlossene Aufgabe statt einer falschen Erfolgsbestätigung', async () => {
    const { ref, expected } = await create()
    await app().completeTask(ref, true)
    await expect(app().replaceTaskParts(ref, proposed, expected)).rejects.toThrow('Aufgabe hat sich geändert')
    await expect(app().replaceTaskParts({ kind: 'task', id: 'missing' }, proposed, expected)).rejects.toThrow('nicht mehr vorhanden')
  })
})
