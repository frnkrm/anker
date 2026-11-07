import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { MemoryRepository } from '../data/memory'
import type { Rec, Repository } from '../data/types'
import { useApp } from './store'
const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const old = Date.parse(`${date}T10:00:00+01:00`)
const now = old + 86_400_000
const app = () => useApp.getState()
const record = (collection: Rec['collection'], data: unknown): Rec => ({ collection, id: collection === 'meta' ? 'local' : 'main', data, updated_at: old, deleted: false })
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready:false, settings:defaultSettings(date), game:initialGame(date), local:emptyLocal(), days:{}, inbox:[], reviews:[] })
  await app().load()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

it('stellt alte Settings und echten Spielstand trotz neuer Ersteinrichtung dauerhaft wieder her', async () => {
  await app().saveSettings((s) => ({ ...s, onboarded:true }))
  await app().setGame(() => ({ ...initialGame(date), xp:0 }))
  const incoming = [record('settings', { ...defaultSettings(date), onboarded:true, bed:1470 }), record('game', { ...initialGame(date), xp:720 })]
  expect(await app().importRecords(incoming)).toBe(0)
  expect(app().game.xp).toBe(0)
  expect(await app().importRecords(incoming, 'restore')).toBe(2)
  expect(app().settings.bed).toBe(1470)
  expect(app().game.xp).toBe(720)
  const saved = await storage.repo!.all()
  expect(saved.every((r) => r.updated_at > now)).toBe(true)
  // Kein neuer Erfolg, keine Ist-Arbeitszeit; die Zahlen stammen ausschließlich aus der Sicherung.
  expect(app().local.workSessions).toEqual([])
  expect(app().days).toEqual({})
  await app().load()
  expect(app().game.xp).toBe(720)
  expect(app().settings.bed).toBe(1470)
})

it('wiederholt die Wiederherstellung unter der bestehenden Schreibbarriere gegen eine wartende Änderung', async () => {
  let release!: () => void; let began!: () => void
  const held = new Promise<void>((resolve) => { release=resolve })
  const started = new Promise<void>((resolve) => { began=resolve })
  const put = storage.repo!.put.bind(storage.repo!)
  vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { began(); await held; await put(...args) })
  const saving = app().saveLocal((l) => ({ ...l, work:[{id:'keep',title:'Gerade gespeichert',createdAt:now}] }))
  await started
  const restoring = app().importRecords([record('meta', { handover:{[date]:{open:'Altbestand',next:'Datei öffnen'}} })], 'restore')
  release();await saving
  expect(await restoring).toBe(1)
  expect(app().local.work[0]?.title).toBe('Gerade gespeichert')
  expect(app().local.handover[date]?.next).toBe('Datei öffnen')
})

it('behält bei ungültigem Batch oder echtem Mergefehler sämtliche bisherigen Werte', async () => {
  await app().saveSettings((s) => ({ ...s,onboarded:true }))
  const beforeRecords = structuredClone(await storage.repo!.all())
  const beforeSettings = structuredClone(app().settings)
  await expect(app().importRecords([record('settings', { ...beforeSettings,bed:1460 }),record('game',{xp:4})], 'restore')).rejects.toThrow('Spielstände')
  expect(await storage.repo!.all()).toEqual(beforeRecords)
  vi.spyOn(storage.repo!,'merge').mockRejectedValueOnce(new Error('Speicherfehler'))
  await expect(app().importRecords([record('settings',{...beforeSettings,bed:1460})], 'restore')).rejects.toThrow('Speicherfehler')
  expect(app().settings).toEqual(beforeSettings)
  expect(await storage.repo!.all()).toEqual(beforeRecords)
})
