import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { selectBackupRecords, validatedRecords } from '../core/export/backup'
import { planConflicts } from '../core/planConflicts'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const DATE = '2026-11-09'

beforeEach(async () => {
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(DATE), local: emptyLocal(), toast: undefined, toastAction: undefined })
  await useApp.getState().load()
})
afterEach(() => vi.useRealTimers())

describe('Private Quittierung einer Planüberschneidung', () => {
  async function prepare() {
    await useApp.getState().saveSettings(s => ({ ...s, sport: { ...s.sport, days: s.sport.days.map(() => false) } }))
    await useApp.getState().saveLocal(local => ({ ...local, commitments: [{ id: 'books', date: DATE, label: 'Bücher zurückbringen', context: 'personal', commitment: 'hard', start: 1080, end: 1110, locationKind: 'onsite', placeLabel: 'Bibliothek', originPlaceId: 'home', travelMin: 15, travelHomeMin: 15, prepMin: 15, arrivalBufferMin: 10 }] }))
    return planConflicts(planFor(DATE))[0]!
  }

  it('speichert nur die lokale Quittierung atomar, erhält Aufgaben, Spielstand und Tageslog und übersteht Reload', async () => {
    const conflict = await prepare()
    expect(conflict).toBeDefined()
    const game = structuredClone(useApp.getState().game), days = structuredClone(useApp.getState().days), commitments = structuredClone(useApp.getState().local.commitments)
    const put = vi.spyOn(storage.repo!, 'put')
    await Promise.all([useApp.getState().acknowledgePlanConflict(DATE, conflict.id), useApp.getState().acknowledgePlanConflict(DATE, conflict.id)])
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]?.slice(0, 2)).toEqual(['meta', 'local'])
    expect(useApp.getState().local.acknowledgedPlanConflicts?.[DATE]).toEqual([conflict.id])
    expect(useApp.getState().game).toEqual(game)
    expect(useApp.getState().days).toEqual(days)
    expect(useApp.getState().local.commitments).toEqual(commitments)
    await useApp.getState().load()
    expect(useApp.getState().local.acknowledgedPlanConflicts?.[DATE]).toEqual([conflict.id])
    expect(useApp.getState().local.acknowledgedPlanConflicts?.['2026-11-10']).toBeUndefined()
  })

  it('bestätigt keine veraltete Überschneidung und zeigt bei Schreibfehler keinen gespeicherten Erfolg', async () => {
    const conflict = await prepare()
    await useApp.getState().saveLocal(local => ({ ...local, commitments: local.commitments.map(c => ({ ...c, prepMin: 20 })) }))
    await useApp.getState().acknowledgePlanConflict(DATE, conflict.id)
    expect(useApp.getState().local.acknowledgedPlanConflicts).toBeUndefined()
    const current = planConflicts(planFor(DATE))[0]!
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Offline-Speicher nicht verfügbar'))
    await expect(useApp.getState().acknowledgePlanConflict(DATE, current.id)).rejects.toThrow()
    expect(useApp.getState().local.acknowledgedPlanConflicts).toBeUndefined()
  })

  it('nimmt Quittierungen nur in vollständige passende Privatgruppen auf und prüft fehlerhafte Importwerte', async () => {
    const conflict = await prepare()
    await useApp.getState().acknowledgePlanConflict(DATE, conflict.id)
    const records = await storage.repo!.all()
    const getLocal = (choice: { work?: boolean; places?: boolean }) => selectBackupRecords(records, choice).find(r => r.collection === 'meta' && r.id === 'local')!.data
    expect(getLocal({})).toHaveProperty('acknowledgedPlanConflicts')
    expect(getLocal({ places: false })).not.toHaveProperty('acknowledgedPlanConflicts')
    expect(getLocal({ work: false })).not.toHaveProperty('acknowledgedPlanConflicts')
    expect(() => validatedRecords([{ collection: 'meta', id: 'local', data: { ...emptyLocal(), acknowledgedPlanConflicts: { [DATE]: 42 } }, updated_at: 1, deleted: false }])).toThrow('Sicherung enthält ungültige')
  })
})

describe('Flüchtige Rückgängig-Aktionen', () => {
  it('führt Doppeltippen einmal aus und speichert weder Funktion noch Toast im Repository', async () => {
    let finish!: () => void
    const run = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const before = await storage.repo!.all()
    useApp.getState().showToast('Entfernt.', { label: 'Rückgängig', run })
    const first = useApp.getState().runToastAction()
    await useApp.getState().runToastAction()
    expect(run).toHaveBeenCalledTimes(1)
    finish(); await first
    expect(useApp.getState().toast).toBe('Rückgängig gemacht.')
    expect(await storage.repo!.all()).toEqual(before)
  })

  it('hält dieselbe Rücknahme bei Schreibfehler erneut bereit', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('Schreibfehler')).mockResolvedValueOnce(undefined)
    useApp.getState().showToast('Entfernt.', { label: 'Rückgängig', run })
    await useApp.getState().runToastAction()
    expect(useApp.getState().toastAction?.run).toBe(run)
    await useApp.getState().runToastAction()
    expect(run).toHaveBeenCalledTimes(2)
    expect(useApp.getState().toastAction).toBeUndefined()
  })

  it('lässt einen älteren gleichlautenden Toast den jüngeren nicht vorzeitig schließen', () => {
    vi.useFakeTimers()
    useApp.getState().showToast('Gespeichert')
    vi.advanceTimersByTime(2000)
    useApp.getState().showToast('Gespeichert', { label: 'Rückgängig', run: () => undefined })
    vi.advanceTimersByTime(600)
    expect(useApp.getState().toastAction?.label).toBe('Rückgängig')
    vi.advanceTimersByTime(7400)
    expect(useApp.getState().toast).toBeUndefined()
    expect(useApp.getState().toastAction).toBeUndefined()
  })
})
