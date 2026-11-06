import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { DEVICE_TEST_SUITE } from '../core/deviceTests'
import { makeBackup, parseBackup } from '../core/export/backup'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { onPlanChange, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T10:00:00Z'))
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-05'), local: emptyLocal(), celebrations: [] })
  await useApp.getState().load(); vi.runOnlyPendingTimers()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

it('speichert Testberichte lokal, ohne Planabgleich, XP, Erledigungen oder Hauptwecker zu verändern', async () => {
  await useApp.getState().saveLocal((p) => ({ ...p, work: [{ id: 'w', title: 'Eigene Aufgabe', done: false, createdAt: 1 }] }))
  vi.runOnlyPendingTimers()
  const before = structuredClone({ settings: useApp.getState().settings, game: useApp.getState().game, days: useApp.getState().days, inbox: useApp.getState().inbox, work: useApp.getState().local.work })
  const changed = vi.fn(); const off = onPlanChange(changed)
  try {
    await useApp.getState().saveDeviceTests((p) => ({ ...p, activeId: 3, reports: { ...p.reports, 3: { result: 'partial', at: Date.now(), note: 'Ton gehört, Vollbild offen', platform: 'android', device: 'Testgerät', os: 'API36', appVersion: '1', build: '3', suiteVersion: DEVICE_TEST_SUITE } } }))
    vi.runOnlyPendingTimers()
    expect(changed).not.toHaveBeenCalled()
    const after = useApp.getState()
    expect({ settings: after.settings, game: after.game, days: after.days, inbox: after.inbox, work: after.local.work }).toEqual(before)
    expect((await storage.repo!.dirty()).every((r) => r.collection === 'meta')).toBe(true)
    const restored = parseBackup(JSON.stringify(makeBackup(await storage.repo!.all())))
    expect(restored.find((r) => r.collection === 'meta' && r.id === 'local')?.data).toMatchObject({ deviceTests: { activeId: 3, reports: { 3: { result: 'partial' } } } })
    await useApp.getState().load()
    expect(useApp.getState().local.deviceTests?.reports[3]?.note).toBe('Ton gehört, Vollbild offen')
  } finally { off() }
})

it('behält andere Testergebnisse und Alltagsdaten beim Wiederöffnen eines einzelnen Tests', async () => {
  await useApp.getState().saveDeviceTests((p) => ({ ...p, activeId: 62, device: 'Eigenes Handy', reports: {} }))
  await useApp.getState().saveDeviceTests((p) => ({ ...p, activeId: undefined }))
  await useApp.getState().load()
  expect(useApp.getState().local.deviceTests).toMatchObject({ device: 'Eigenes Handy', reports: {} })
  await expect(useApp.getState().saveDeviceTests((p) => ({ ...p, activeId: -1 }))).rejects.toThrow('ungültig')
  expect(useApp.getState().local.deviceTests?.activeId).toBeUndefined()
})

it('zeigt nach einem Schreibfehler keinen nur scheinbar gespeicherten neuen Testbericht', async () => {
  const before = structuredClone(useApp.getState().local)
  vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Speicher nicht verfügbar'))
  await expect(useApp.getState().saveDeviceTests((p) => ({ ...p, activeId: 63, drafts: { 63: { note: 'Entwurf', device: '', os: '' } } }))).rejects.toThrow('Speicher')
  expect(useApp.getState().local).toEqual(before)
  await useApp.getState().load()
  expect(useApp.getState().local.deviceTests?.reports).toEqual({})
})
