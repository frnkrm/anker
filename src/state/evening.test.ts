import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { openThoughts, pendingTomorrowSteps } from '../core/evening'
import { makeBackup, parseBackup } from '../core/export/backup'
import { tasksFor } from '../core/support'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const now = zonedToUtc('2026-11-02', 22 * 60)
const tomorrow = zonedToUtc('2026-11-03', 18 * 60)

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-02'), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('Gespeicherte Abendhilfen', () => {
  it('speichert eine geparkte Idee als einen Gedanken und legt sie nach Neustart zur richtigen Zeit vor', async () => {
    const id = await useApp.getState().parkThought(' Neue Idee ', tomorrow)
    await useApp.getState().load()
    const inbox = useApp.getState().inbox
    expect(inbox).toHaveLength(1)
    expect(inbox[0]).toMatchObject({ id, text: 'Neue Idee', status: 'open', reviewNotify: false })
    expect(openThoughts(inbox, now)).toEqual([])
    expect(openThoughts(inbox, tomorrow)).toHaveLength(1)
    expect(tasksFor(inbox, '2026-11-03')).toEqual([])
    expect((await storage.repo!.all()).filter((record) => record.collection === 'inbox')).toHaveLength(1)
  })

  it('weist ungültige Wiedervorlagen vor dem Schreiben zurück', async () => {
    await expect(useApp.getState().parkThought('Idee', NaN)).rejects.toThrow(/Zukunft/)
    await expect(useApp.getState().saveTomorrowStep('Modell', 'Teile holen', now - 1)).rejects.toThrow(/Zukunft/)
    expect(useApp.getState().inbox).toEqual([])
    expect(useApp.getState().local.tomorrowSteps).toEqual([])
  })

  it('beendet keine laufende Arbeit und vergibt keine Punkte für einen privaten Wiedereinstieg', async () => {
    await useApp.getState().workStart()
    const game = structuredClone(useApp.getState().game)
    const id = await useApp.getState().saveTomorrowStep(' Modell ', ' Teile bereitlegen ', tomorrow, true)
    expect(useApp.getState().local.workSessions[0]?.endAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
    vi.setSystemTime(tomorrow + 5 * 86_400_000)
    await useApp.getState().load()
    expect(pendingTomorrowSteps(useApp.getState().local.tomorrowSteps, Date.now())).toHaveLength(1)
    const afterReload = structuredClone(useApp.getState().game)
    await useApp.getState().finishTomorrowStep(id!)
    const doneAt = useApp.getState().local.tomorrowSteps[0]?.doneAt
    vi.setSystemTime(Date.now() + 1000)
    await useApp.getState().finishTomorrowStep(id!)
    expect(useApp.getState().local.tomorrowSteps[0]?.doneAt).toBe(doneAt)
    expect(useApp.getState().game).toEqual(afterReload)
    expect((await storage.repo!.dirty()).filter((record) => record.collection !== 'meta')).toEqual([])
    await useApp.getState().removeTomorrowStep(id!)
    await useApp.getState().load()
    expect(useApp.getState().local.tomorrowSteps).toEqual([])
  })

  it('speichert nur bewusst eingetragene Schlafdaten lokal und lässt sie löschen', async () => {
    const game = structuredClone(useApp.getState().game)
    const bedAt = zonedToUtc('2026-11-01', 23 * 60)
    await useApp.getState().saveSleepEntry('2026-11-01', { bedAt })
    await useApp.getState().load()
    expect(useApp.getState().local.sleepDiary['2026-11-01']).toEqual({ bedAt })
    expect(useApp.getState().game).toEqual(game)
    expect(useApp.getState().days).toEqual({})
    expect((await storage.repo!.all()).every((record) => record.collection === 'meta')).toBe(true)
    await useApp.getState().removeSleepEntry('2026-11-01')
    await useApp.getState().load()
    expect(useApp.getState().local.sleepDiary).toEqual({})
  })

  it('stellt alte lokale Daten wieder her und blockiert beschädigte neue Felder vor Import', async () => {
    await storage.repo!.put('meta', 'local', { commitments: [], places: [], work: [], workSessions: [], handover: {}, meds: {} })
    await useApp.getState().load()
    expect(useApp.getState().local.tomorrowSteps).toEqual([])
    expect(useApp.getState().local.sleepDiary).toEqual({})
    for (const data of [{ tomorrowSteps: null }, { sleepDiary: { '2026-11-02': { wakeAt: 'ungültig' } } }]) {
      expect(() => parseBackup(JSON.stringify(makeBackup([{ collection: 'meta', id: 'local', data, updated_at: now, deleted: false }])))).toThrow(/private Abend-/)
    }
  })
})
