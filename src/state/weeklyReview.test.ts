import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { weeklyEvidence } from '../core/weeklyReview'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-13', now = Date.parse(`${date}T10:00:00+01:00`)
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), days: {}, inbox: [], reviews: [], game: initialGame(date) })
  await useApp.getState().load()
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('F-010: Übersicht beim bestehenden Daten-/Storebesitzer', () => {
  it('liest vorhandene Tagesstände ohne Repositoryschreiben, Awards oder Vorschläge', async () => {
    await useApp.getState().adjustDay(date, 'PRIVATE-CHANGE', log => ({ ...log, override: { ...log.override, mode: 'wenig-energie' } }))
    const before = structuredClone(await storage.repo!.all())
    const game = structuredClone(useApp.getState().game)
    const put = vi.spyOn(storage.repo!, 'put'), batch = vi.spyOn(storage.repo!, 'putMany')
    expect(weeklyEvidence(useApp.getState().days, now, 'current')?.modes).toEqual({ 'wenig-energie': 1 })
    weeklyEvidence(useApp.getState().days, now, 'previous')
    expect(put).not.toHaveBeenCalled(); expect(batch).not.toHaveBeenCalled()
    expect(await storage.repo!.all()).toEqual(before)
    expect(useApp.getState().game).toEqual(game)
    expect(useApp.getState().reviews).toEqual([])
    expect(useApp.getState().settings.suggestions).toEqual([])
  })
  it('übernimmt nach Reload den vorhandenen Tageswert ohne eine gespeicherte Auswertungswahl', async () => {
    await useApp.getState().adjustDay(date, 'Kleine Version', log => ({ ...log, override: { ...log.override, shortMorning: true } }))
    const facts = weeklyEvidence(useApp.getState().days, now, 'current')
    await useApp.getState().load()
    expect(weeklyEvidence(useApp.getState().days, now, 'current')).toEqual(facts)
    expect(Object.keys(useApp.getState().local)).not.toContain('weeklyEvidence')
    expect(useApp.getState().reviews).toEqual([])
  })
})
