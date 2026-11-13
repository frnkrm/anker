import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { elapsedMs, remainingMs } from '../core/focus'
import { initialGame } from '../core/game'
import { makeBackup, parseBackup } from '../core/export/backup'
import { recordForSync } from '../core/syncPrivacy'
import type { LocalData, TaskRef } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-13', at = Date.parse(`${date}T10:00:00+01:00`)
const app = () => useApp.getState()
let ref: TaskRef
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), days: {}, inbox: [], game: initialGame(date) })
  await app().load()
  ref = { kind: 'work', id: (await app().addWorkTask('Bericht'))! }
})
afterEach(() => vi.useRealTimers())

it('erhält Timerlaufzeit bei Pause und Reload, verändert aber weder Schätzung noch Erledigung, Punkte oder Lernwerte', async () => {
  await app().updateTask(ref, { estimateMin: 30 })
  const game = structuredClone(app().game)
  await app().startTaskFocus(ref, 2)
  vi.setSystemTime(at + 180_450)
  await app().pauseTaskFocus(ref)
  expect(app().local.focus!.timer).toMatchObject({ status: 'paused', overrunMs: 60_450 })
  await app().load()
  vi.setSystemTime(at + 3 * 86400_000)
  expect(elapsedMs(app().local.focus!.timer, Date.now())).toBe(180_450)
  expect(app().local.work[0]).toMatchObject({ estimateMin: 30, state: 'paused' })
  expect(app().local.work[0]?.done).not.toBe(true)
  expect(app().local.taskLearning).toBeUndefined()
  expect(app().game).toEqual(game)
  await app().startTaskFocus(ref, 5)
  expect(app().local.focus!.timer).not.toHaveProperty('overrunMs')
  expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(300_000)
})

it('erhält angebrochene Sekunden ohne die Unterbrechung als Laufzeit mitzuzählen', async () => {
  await app().startTaskFocus(ref, 5)
  vi.setSystemTime(at + 90_450); await app().pauseTaskFocus(ref)
  vi.setSystemTime(at + 86400_000); await app().startTaskFocus(ref)
  expect(elapsedMs(app().local.focus!.timer, Date.now())).toBe(90_450)
  vi.setSystemTime(at + 86400_000 + 30_550)
  expect(elapsedMs(app().local.focus!.timer, Date.now())).toBe(121_000)
  expect(app().local.taskLearning).toBeUndefined()
})

it('sichert den lokalen Überzug validiert und lässt ihn bei abgewählter Arbeit sowie beim Sync weg', async () => {
  await app().startTaskFocus(ref, 2); vi.setSystemTime(at + 180_000); await app().pauseTaskFocus(ref)
  const records = await storage.repo!.all()
  const localRecord = records.find(r => r.collection === 'meta' && r.id === 'local')!
  expect(recordForSync(localRecord)).toBeUndefined()
  const full = parseBackup(JSON.stringify(makeBackup(records))).find(r => r.collection === 'meta' && r.id === 'local')!.data as LocalData
  expect(full.focus!.timer).toMatchObject({ overrunMs: 60_000 })
  expect(JSON.stringify(makeBackup(records, new Date(), { work: false }))).not.toContain('overrunMs')
  const before = structuredClone(await storage.repo!.all())
  const corrupted = { ...localRecord, data: { ...full, focus: { ...full.focus!, timer: { ...full.focus!.timer, overrunMs: -1 } } } }
  await expect(app().importRecords([corrupted], 'restore')).rejects.toThrow('ungültige')
  expect(await storage.repo!.all()).toEqual(before)
})

it('lernt weiterhin nur aus eigener ausdrücklicher Dauerbestätigung und erhält Doppelschutz/Rücknahme', async () => {
  await app().setTaskLearning(true)
  await app().startTaskFocus(ref, 2)
  vi.setSystemTime(at + 600_000)
  expect(app().local.taskLearning?.samples).toEqual([])
  expect(app().local.work[0]?.done).not.toBe(true)
  await Promise.all([app().completeTask(ref, true, false, 7), app().completeTask(ref, true, false, 7)])
  expect(app().local.taskLearning?.samples).toHaveLength(1)
  expect(app().local.taskLearning?.samples[0]).toMatchObject({ minutes: 7, confirmed: true, id: `work:${ref.id}:${Date.now()}` })
  await app().completeTask(ref, false)
  expect(app().local.taskLearning?.samples).toEqual([])
})
