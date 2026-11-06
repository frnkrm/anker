import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { manualSession } from '../core/worktime'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const now = zonedToUtc(date, 19 * 60)
const app = () => useApp.getState()

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), game: initialGame(date), days: {}, inbox: [], workUndo: undefined })
  await app().load()
})
afterEach(() => vi.useRealTimers())

describe('E05: Korrigieren und Rücknahme ohne Zeitverlust', () => {
  it('weist widersprüchliche Überlappung zurück und bewahrt beide vorherigen Wahrheiten', async () => {
    const first = manualSession('first', date, 480, 720, [])
    await app().editWork(() => [first])
    await expect(app().editWork((list) => [...list, manualSession('second', date, 660, 840, [])])).rejects.toThrow('überschneiden')
    expect(app().local.workSessions).toEqual([first])
    await app().load()
    expect(app().local.workSessions).toEqual([first])
  })

  it('veröffentlicht eine Rücknahme erst nach erfolgreichem Schreiben', async () => {
    const before = app().workUndo
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Speicher voll'))
    await expect(app().editWork(() => [manualSession('first', date, 480, 720, [])])).rejects.toThrow('Speicher voll')
    expect(app().local.workSessions).toEqual([])
    expect(app().workUndo).toEqual(before)
  })

  it('löscht nach einer Korrektur keine später wirklich gestartete Arbeit durch alte Rücknahme', async () => {
    await app().editWork(() => [manualSession('first', date, 480, 720, [])])
    await app().workStart()
    const started = structuredClone(app().local.workSessions)
    await app().undoWork()
    expect(app().local.workSessions).toEqual(started)
    expect(app().local.workSessions.some((s) => s.endAt === undefined)).toBe(true)
  })

  it('erhält bei fehlgeschlagener Rücknahme sowohl den zuletzt gespeicherten Stand als auch Undo', async () => {
    await app().editWork(() => [manualSession('first', date, 480, 720, [])])
    const sessions = structuredClone(app().local.workSessions)
    const undo = structuredClone(app().workUndo)
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Speicher voll'))
    await expect(app().undoWork()).rejects.toThrow('Speicher voll')
    expect(app().local.workSessions).toEqual(sessions)
    expect(app().workUndo).toEqual(undo)
    await app().undoWork()
    expect(app().local.workSessions).toEqual([])
  })

  it('prüft die Revision auch nach anderweitig übernommenen Arbeitszeiten', async () => {
    await app().editWork(() => [manualSession('first', date, 480, 720, [])])
    await app().saveLocal((local) => ({ ...local, workSessions: [...local.workSessions, manualSession('imported', date, 780, 900, [])] }))
    await expect(app().undoWork()).rejects.toThrow('neueren Zeiten bleiben erhalten')
    expect(app().local.workSessions.map((s) => s.id)).toEqual(['first', 'imported'])
  })

  it('erlaubt die Korrektur eines importierten Alt-Konflikts ohne stilles Entfernen des anderen Eintrags', async () => {
    const before = [manualSession('a', date, 480, 720, []), manualSession('b', date, 660, 840, [])]
    await storage.repo!.put('meta', 'local', { ...emptyLocal(), workSessions: before })
    await app().load()
    await app().editWork((list) => list.map((s) => s.id === 'b' ? { ...s, startAt: zonedToUtc(date, 690) } : s))
    expect(app().local.workSessions).toHaveLength(2)
    await expect(app().editWork((list) => list.map((s) => s.id === 'b' ? { ...s, startAt: zonedToUtc(date, 600) } : s))).rejects.toThrow('überschneiden')
    await app().editWork((list) => list.map((s) => s.id === 'b' ? { ...s, startAt: zonedToUtc(date, 720) } : s))
    await app().load()
    expect(app().local.workSessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(app().local.workSessions[1]?.startAt).toBe(zonedToUtc(date, 720))
  })

  it('erzeugt beim Mehrfachtipp auf denselben Nachtrag keine zweite Ausführung', async () => {
    const data = manualSession('first', date, 480, 720, [])
    const writes = await Promise.allSettled([app().editWork((list) => [...list, data]), app().editWork((list) => [...list, { ...data, id: 'second' }])])
    expect(writes.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
    await app().load()
    expect(app().local.workSessions).toEqual([data])
  })
})
