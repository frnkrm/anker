import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLocal } from '../core/defaults'
import { geofenceSnapshot, type GeofenceSuggestion } from '../core/geofences'
import { zonedToUtc } from '../core/time'
import type { LocalData } from '../core/types'

const mocks = vi.hoisted(() => ({
  native: true, state: { local: undefined as unknown as LocalData, saveLocal: vi.fn<(fn: (local: LocalData) => LocalData) => Promise<void>>() },
  sync: vi.fn<(input: unknown) => Promise<unknown>>(), get: vi.fn<() => Promise<unknown>>(), ack: vi.fn<(input: unknown) => Promise<void>>(), permission: vi.fn<(input: unknown) => Promise<unknown>>(),
  onChange: undefined as (() => void) | undefined, onActive: undefined as ((state: { isActive: boolean }) => void) | undefined,
  remove: vi.fn<() => Promise<void>>(), unsubscribe: vi.fn(),
}))
vi.mock('./native', () => ({ isNative: () => mocks.native, AnkerNative: { syncGeofences: mocks.sync, getGeofenceState: mocks.get, ackGeofenceSuggestions: mocks.ack, requestGeofencePermission: mocks.permission } }))
vi.mock('../state/store', () => ({ useApp: { getState: () => mocks.state }, onPlanChange: (fn: () => void) => { mocks.onChange = fn; return mocks.unsubscribe } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: async (_event: string, fn: (state: { isActive: boolean }) => void) => { mocks.onActive = fn; return { remove: mocks.remove } } } }))

const now = zonedToUtc('2026-11-06', 8 * 60)
function fixture(): LocalData {
  return { ...emptyLocal(), commitments: [{ id: 'visit', label: 'Privater Besuchstitel', date: '2026-11-06', start: 9 * 60, context: 'customer', commitment: 'hard', placeId: 'place', locationKind: 'onsite' }],
    places: [{ id: 'place', label: 'Privater Ortsname', latitude: 52, longitude: 13 }],
    extras: { geofences: { enabled: true, visits: { visit: { radiusM: 150, dwellMs: 120_000, consentedAt: now - 1000, placeId: 'place', latitude: 52, longitude: 13 } } } } }
}
function proposal(): GeofenceSuggestion { return { id: 'suggest:one', visitId: 'visit', revision: geofenceSnapshot(mocks.state.local, now).visits[0]!.revision, at: now } }
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done }); return { resolve, promise } }
const nativeState = (suggestions: GeofenceSuggestion[] = []) => ({ registered: 1, fineGranted: true, backgroundGranted: true, suggestions })

beforeEach(() => {
  vi.resetModules(); mocks.native = true
  vi.spyOn(Date, 'now').mockReturnValue(now)
  mocks.state.local = fixture()
  mocks.state.saveLocal.mockReset().mockImplementation(async (fn) => { mocks.state.local = fn(structuredClone(mocks.state.local)) })
  mocks.sync.mockReset().mockResolvedValue(nativeState()); mocks.get.mockReset().mockResolvedValue(nativeState())
  mocks.ack.mockReset().mockResolvedValue(); mocks.permission.mockReset().mockResolvedValue({ fineGranted: true, backgroundGranted: true })
  mocks.remove.mockReset().mockResolvedValue(); mocks.unsubscribe.mockReset(); mocks.onChange = undefined; mocks.onActive = undefined
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Geofence-Abgleich, Rechte und bewusste Ankunft', () => {
  it('bleibt im Web ohne Sensoren, Bridge und Freigabedialoge', async () => {
    mocks.native = false
    const geo = await import('./geofences')
    await geo.refreshGeofences(); await geo.requestGeofencePermission('foreground'); geo.listenGeofences()()
    expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.permission).not.toHaveBeenCalled()
    expect(geo.geofenceViewState().registered).toBe(0)
  })
  it('entfernt ausgeschaltete Auswahl promptfrei und fordert Rechte nur ausdrücklich getrennt an', async () => {
    mocks.state.local.extras!.geofences!.enabled = false
    mocks.get.mockResolvedValue({ ...nativeState(), registered: 0 })
    const geo = await import('./geofences')
    await geo.refreshGeofences()
    expect(mocks.sync).toHaveBeenCalledWith({ enabled: false, visits: [] }); expect(mocks.permission).not.toHaveBeenCalled()
    await geo.requestGeofencePermission('foreground'); await geo.requestGeofencePermission('background')
    expect(mocks.permission.mock.calls).toEqual([[{ kind: 'foreground' }], [{ kind: 'background' }]])
  })
  it('verwirft eine verspätete Antwort nach Abschalten und schickt die neue leere Auswahl', async () => {
    const gate = deferred()
    mocks.sync.mockImplementationOnce(async () => { await gate.promise; return nativeState() })
    const geo = await import('./geofences')
    const stale = proposal()
    const first = geo.refreshGeofences()
    mocks.state.local.extras!.geofences!.enabled = false
    mocks.get.mockResolvedValue({ ...nativeState([stale]), registered: 0 })
    gate.resolve(); await first
    expect(mocks.sync.mock.calls.at(-1)?.[0]).toEqual({ enabled: false, visits: [] })
    expect(geo.geofenceViewState().suggestions).toEqual([])
    expect(JSON.stringify(mocks.sync.mock.calls)).not.toContain('Privater')
  })
  it('ein Hinweis allein bucht nichts; Bestätigung erhält zwischenzeitlich geänderte Termindaten', async () => {
    const suggestion = proposal(); const before = structuredClone(mocks.state.local)
    mocks.get.mockResolvedValue(nativeState([suggestion]))
    const geo = await import('./geofences')
    await geo.refreshGeofences()
    expect(mocks.state.saveLocal).not.toHaveBeenCalled()
    mocks.state.local.commitments[0]!.label = 'Inzwischen umbenannt'
    expect(await geo.answerGeofenceSuggestion(suggestion, true)).toBe(true)
    expect(mocks.state.local.commitments[0]).toMatchObject({ label: 'Inzwischen umbenannt', arrivedAt: now })
    expect(mocks.state.local.workSessions).toEqual(before.workSessions)
    expect(mocks.state.local.work).toEqual(before.work)
    expect(mocks.state.local.extras!.geofences).toEqual({ enabled: false, visits: {} })
    expect(mocks.ack).toHaveBeenCalledWith({ ids: [suggestion.id] })
  })
  it('prüft Revision und Zustimmung erneut innerhalb der atomaren Speicheraktion', async () => {
    const suggestion = proposal()
    mocks.state.saveLocal.mockImplementationOnce(async (fn) => {
      mocks.state.local.places[0]!.latitude = 53
      mocks.state.local = fn(structuredClone(mocks.state.local))
    })
    const { answerGeofenceSuggestion } = await import('./geofences')
    expect(await answerGeofenceSuggestion(suggestion, true)).toBe(false)
    expect(mocks.state.local.commitments[0]!.arrivedAt).toBeUndefined(); expect(mocks.ack).not.toHaveBeenCalled()
  })
  it('akzeptiert keine alte Revision nach Neuplanung und kein Ja für einen inzwischen abgesagten Besuch', async () => {
    const suggestion = proposal()
    mocks.state.local.commitments[0]!.start += 30
    const { answerGeofenceSuggestion } = await import('./geofences')
    expect(await answerGeofenceSuggestion(suggestion, true)).toBe(false)
    const current = proposal(); mocks.state.local.commitments[0]!.status = 'cancelled'
    expect(await answerGeofenceSuggestion(current, true)).toBe(false)
    expect(mocks.state.local.commitments[0]!.arrivedAt).toBeUndefined(); expect(mocks.ack).not.toHaveBeenCalled()
  })
  it('Stimmt nicht entfernt nur die optionale Auswahl und verhindert doppelte Antworten', async () => {
    const suggestion = proposal(); const before = structuredClone(mocks.state.local.commitments)
    const { answerGeofenceSuggestion } = await import('./geofences')
    expect(await answerGeofenceSuggestion(suggestion, false)).toBe(true)
    expect(await answerGeofenceSuggestion(suggestion, true)).toBe(false)
    expect(mocks.state.local.commitments).toEqual(before); expect(mocks.ack).toHaveBeenCalledTimes(1)
  })
  it('rollt eine gespeicherte echte Ankunft bei Bridgefehlern nicht zurück und zeigt sichere Fehler', async () => {
    const suggestion = proposal(); mocks.ack.mockRejectedValueOnce(new Error('Privater roher Fehler'))
    mocks.sync.mockRejectedValue(new Error('Privater roher Fehler'))
    const geo = await import('./geofences')
    expect(await geo.answerGeofenceSuggestion(suggestion, true)).toBe(true)
    expect(mocks.state.local.commitments[0]!.arrivedAt).toBe(now)
    expect(geo.geofenceViewState().error).toBe('native-unavailable')
    expect(JSON.stringify(geo.geofenceViewState())).not.toContain('Privater')
  })
  it('bestätigt Android nichts, wenn das lokale Speichern scheitert', async () => {
    const suggestion = proposal(); mocks.state.saveLocal.mockRejectedValueOnce(new Error('Storage'))
    const { answerGeofenceSuggestion } = await import('./geofences')
    await expect(answerGeofenceSuggestion(suggestion, true)).rejects.toThrow('Storage')
    expect(mocks.state.local.commitments[0]!.arrivedAt).toBeUndefined(); expect(mocks.ack).not.toHaveBeenCalled()
  })
  it('zeigt unbestätigte Entfernung auch bei ausgeschalteter Auswahl und keine alten Registrierungserfolge bei busy', async () => {
    mocks.state.local.extras!.geofences!.enabled = false
    mocks.get.mockResolvedValue({ ...nativeState(), error: 'removal-unconfirmed', updating: true })
    const geo = await import('./geofences')
    await geo.refreshGeofences()
    expect(geo.geofenceViewState()).toMatchObject({ enabled: false, registered: 0, error: 'removal-unconfirmed', updating: true })
  })
  it('liest gespeicherte Hinweise im Vordergrund und pausiert Timer im Hintergrund', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const geo = await import('./geofences')
    const stop = geo.listenGeofences()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.get).toHaveBeenCalledTimes(2)
    mocks.onActive!({ isActive: false })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(mocks.get).toHaveBeenCalledTimes(2)
    mocks.onActive!({ isActive: true }); await vi.advanceTimersByTimeAsync(0)
    expect(mocks.get).toHaveBeenCalledTimes(3)
    stop(); await vi.advanceTimersByTimeAsync(120_000)
    expect(mocks.get).toHaveBeenCalledTimes(3); expect(mocks.remove).toHaveBeenCalled(); expect(mocks.unsubscribe).toHaveBeenCalled()
  })
})
