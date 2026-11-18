import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { onPlanChange, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-18T10:00:00Z'))
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-18'), local: emptyLocal(), celebrations: [] })
  await useApp.getState().load(); vi.runOnlyPendingTimers()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

it('serialisiert schnelle Favoritenwahlen ohne Planänderung und behält sie nach erneutem Laden', async () => {
  const changed = vi.fn(), off = onPlanChange(changed)
  const before = structuredClone({ settings: useApp.getState().settings, days: useApp.getState().days, game: useApp.getState().game })
  try {
    await Promise.all(['pc', 'wake', 'hobbies'].map(id => useApp.getState().toggleFunctionFavorite(id)))
    vi.runOnlyPendingTimers()
    expect(useApp.getState().local.functionFavorites).toEqual(['pc', 'wake', 'hobbies'])
    expect(changed).not.toHaveBeenCalled()
    expect({ settings: useApp.getState().settings, days: useApp.getState().days, game: useApp.getState().game }).toEqual(before)
  } finally { off() }
  await useApp.getState().load()
  expect(useApp.getState().local.functionFavorites).toEqual(['pc', 'wake', 'hobbies'])
})

it('zeigt bei einem Schreibfehler keinen scheinbar gespeicherten Favoriten und lehnt fremde Ziele ab', async () => {
  vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Speicherfehler'))
  await expect(useApp.getState().toggleFunctionFavorite('pc')).rejects.toThrow('Speicher')
  expect(useApp.getState().local.functionFavorites).toBeUndefined()
  await expect(useApp.getState().toggleFunctionFavorite('javascript:evil')).rejects.toThrow('Unbekannte')
})
