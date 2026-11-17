import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup, previewImport } from '../core/export/backup'
import { recordForSync } from '../core/syncPrivacy'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const now = zonedToUtc('2026-11-03', 720), date = '2026-11-02', onset = zonedToUtc(date, 1400)
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal() })
  await useApp.getState().load()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
describe('Neue lokale Alltagsdaten', () => {
  it('speichert Hobbys dauerhaft, weist ungültige Änderungen ohne Datenverlust ab', async () => {
    await useApp.getState().saveHobbies(() => ({ items: [{ id: 'photo', name: 'Fotografieren' }] }))
    await expect(useApp.getState().saveHobbies(() => ({ items: [{ id: 'bad', name: '' }] }))).rejects.toThrow()
    await useApp.getState().load()
    expect(useApp.getState().local.hobbies?.items[0]?.name).toBe('Fotografieren')
    const backup = parseBackup(JSON.stringify(makeBackup(await storage.repo!.all())))
    expect(backup.find(r => r.id === 'local')?.data).toMatchObject({ hobbies: { items: [{ id: 'photo' }] } })
  })
  it('ersetzt eine eigene Schlafkorrektur nicht durch wiederholte native Schätzungen', async () => {
    await useApp.getState().recordSleepEstimate(date, onset)
    expect(useApp.getState().local.sleepDiary[date]?.onset?.status).toBe('estimated')
    await useApp.getState().recordSleepEstimate(date, onset, true)
    expect(useApp.getState().local.sleepDiary[date]?.onset?.status).toBe('discarded')
    await useApp.getState().saveSleepEntry(date, { onset: { at: onset - 1000, status: 'confirmed', source: 'manual' } })
    await useApp.getState().recordSleepEstimate(date, onset)
    expect(useApp.getState().local.sleepDiary[date]?.onset).toEqual({ at: onset - 1000, status: 'confirmed', source: 'manual' })
  })
  it('überträgt neue Audio-/Automatik-/Sperrwahlen weder per Sync noch als Importfreigabe', () => {
    const settings = defaultSettings(date)
    settings.alarm.smartWake.autoDaily = true; settings.alarm.smartWake.lockOnStart = true; settings.sleep.onsetEstimationEnabled = true
    const record = { collection: 'settings' as const, id: 'main', data: settings, updated_at: now, deleted: false, dirty: 1 }
    const synced = recordForSync(record)!.data as typeof settings
    expect(synced.alarm.smartWake.autoDaily).toBeUndefined()
    expect(synced.sleep.onsetEstimationEnabled).toBeUndefined()
    const imported = previewImport([record], [], 'restore').records.find(r => r.id === 'main')!.data as typeof settings
    expect(imported.alarm.smartWake.lockOnStart).toBeUndefined()
    expect(imported.sleep.onsetEstimationEnabled).toBeUndefined()
  })
})
