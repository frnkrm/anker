import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { zonedToUtc } from '../core/time'
import type { Commitment, LocalData } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const at = zonedToUtc(date, 12 * 60)
const app = () => useApp.getState()
const commitment = (patch: Partial<Commitment> = {}): Commitment => ({ id: 'customer', date, label: 'Kundenbesuch', context: 'customer', commitment: 'hard', start: 14 * 60, locationKind: 'onsite', ...patch })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), days: {}, inbox: [], game: initialGame(date) })
  await app().load()
})
afterEach(() => vi.useRealTimers())

describe('Lokale Orte und unverfälschte Terminaktionen', () => {
  it('speichert Orte ausschließlich lokal und erhält beim Entfernen die gewählten Terminangaben', async () => {
    const game = structuredClone(app().game)
    await app().savePlace({ id: 'p', label: 'Privater Kunde', address: 'Nur lokal', kind: 'customer', externalUse: { weather: false, routes: false } })
    await app().saveCommitment(commitment({ placeId: 'p', originPlaceId: 'p' }))
    const records = await storage.repo!.dirty()
    expect(records.every((record) => record.collection === 'meta')).toBe(true)
    await app().removePlace('p')
    await app().load()
    expect(app().local.places).toEqual([])
    expect(app().local.commitments[0]).toMatchObject({ id: 'customer', placeLabel: 'Privater Kunde', address: 'Nur lokal', originPlaceId: 'unknown' })
    expect(app().local.commitments[0]?.placeId).toBeUndefined()
    expect(app().game).toEqual(game)
  })

  it('weist ungültige Koordinaten und Minuten vor der ersten Schreiboperation zurück', async () => {
    const before = structuredClone(app().local)
    const write = vi.spyOn(storage.repo!, 'put')
    const batch = vi.spyOn(storage.repo!, 'putMany')
    await expect(app().savePlace({ id: 'p', label: 'Ort', latitude: 50 })).rejects.toThrow('Angaben')
    await expect(app().saveCommitment(commitment({ travelMin: NaN }))).rejects.toThrow('Angaben')
    await expect(app().adjustCommitment(commitment({ travelMin: -3 }), 'Ungültig')).rejects.toThrow('Angaben')
    expect(write).not.toHaveBeenCalled(); expect(batch).not.toHaveBeenCalled()
    expect(app().local).toEqual(before)
  })

  it('erhält nach Speicherfehler den Altbestand und kann denselben Ort erneut speichern', async () => {
    await app().savePlace({ id: 'p', label: 'Alt' })
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Speicher voll'))
    await expect(app().savePlace({ id: 'p', label: 'Neu' })).rejects.toThrow('Speicher voll')
    expect(app().local.places[0]?.label).toBe('Alt')
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.places[0]?.label).toBe('Alt')
    await app().savePlace({ id: 'p', label: 'Neu' })
    expect(app().local.places).toHaveLength(1)
    expect(app().local.places[0]?.label).toBe('Neu')
  })

  it('setzt tatsächliche Ankunft auf den neuesten Termin und bewahrt geänderte Wegdaten', async () => {
    await app().saveCommitment(commitment({ travelMin: 30 }))
    await app().adjustCommitment(commitment({ travelMin: 45 }), 'Neue Schätzung')
    await Promise.all([app().markCommitment('customer', 'arrivedAt', at), app().markCommitment('customer', 'arrivedAt', at + 1000)])
    expect(app().local.commitments[0]).toMatchObject({ travelMin: 45, arrivedAt: at })
    expect(app().local.workSessions).toEqual([])
    await app().adjustCommitment({ ...app().local.commitments[0]!, status: 'cancelled' }, 'Absage')
    await app().markCommitment('customer', 'leftAt', at)
    expect(app().local.commitments[0]?.leftAt).toBeUndefined()
  })

  it('legt bei doppelter bewusster Übernahme derselben ID keine zweite Instanz an', async () => {
    const c = commitment({ locationKind: 'remote', routeMode: 'none', workKind: 'other' })
    await Promise.all([app().adjustCommitment(c, 'Termin'), app().adjustCommitment(c, 'Termin')])
    expect(app().local.commitments).toHaveLength(1)
    await app().load()
    expect(app().local.commitments).toHaveLength(1)
  })

  it('verbindet dieselbe Kalenderquelle auch aus zwei Formularen nur einmal', async () => {
    const c = commitment({ source: { provider: 'google', id: 'event-one' } })
    const results = await Promise.allSettled([app().adjustCommitment(c, 'Termin'), app().adjustCommitment({ ...c, id: 'second' }, 'Termin')])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
    expect(app().local.commitments).toHaveLength(1)
    expect(app().local.commitments[0]?.id).toBe(c.id)
  })

  it('prüft einen verspäteten Vorschlag erst innerhalb der Schreibbarriere und lässt Bestand und Undo unverändert', async () => {
    await app().saveCommitment(commitment({ travelMin: 30 }))
    const before = structuredClone(app().local)
    const writes = vi.spyOn(storage.repo!, 'putMany')
    let release!: () => void
    let reached!: () => void
    const waiting = new Promise<void>((resolve) => { release = resolve })
    const began = new Promise<void>((resolve) => { reached = resolve })
    const original = storage.repo!.put.bind(storage.repo!)
    vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { reached(); await waiting; await original(...args) })
    let current = true
    const first = app().saveLocal((local) => local)
    await began
    const applying = app().updateCommitment('customer', { travelMin: 60 }, 'Fahrzeit übernommen', () => current)
    const rejected = expect(applying).rejects.toThrow('passt nicht mehr')
    current = false; release()
    await first; await rejected
    expect(app().local).toEqual(before)
    expect(app().days[date]).toBeUndefined()
    expect(writes).not.toHaveBeenCalled()
  })

  it('patcht Planfelder ohne zwischenzeitliche Ankunft, Material oder stabile Referenzen zu verlieren', async () => {
    await app().saveCommitment(commitment({ travelMin: 30, items: ['Laptop'] }))
    const arriving = app().markCommitment('customer', 'arrivedAt', at)
    const editing = app().updateCommitment('customer', { travelMin: 45 }, 'Bewusst neue Fahrzeit')
    await Promise.all([arriving, editing])
    expect(app().local.commitments[0]).toMatchObject({ id: 'customer', date, travelMin: 45, items: ['Laptop'], arrivedAt: at })
    await app().load()
    expect(app().local.commitments[0]).toMatchObject({ travelMin: 45, arrivedAt: at })
    expect(app().local.workSessions).toEqual([])
  })
})
