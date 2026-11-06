import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantRequest, AssistantResult, RouteRequest } from '../core/assistance'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { zonedToUtc } from '../core/time'
import type { Commitment, Place } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from '../state/store'
import { AssistanceError } from './assistance'
import { acceptRouteProposal, clearRouteProposal, currentTrafficContext, proposalCurrent, refreshRouteEstimates, requestRouteEstimate, routeIssue, routeProposal } from './traffic'

const mocks = vi.hoisted(() => ({ repo: undefined as Repository | undefined, request: vi.fn<(input: AssistantRequest, signal?: AbortSignal) => Promise<AssistantResult>>() }))
vi.mock('../data', () => ({ getRepository: async () => mocks.repo! }))
vi.mock('./assistance', async (original) => ({ ...await original<typeof import('./assistance')>(), requestAssistance: mocks.request }))

const date = '2026-11-09'
const places: Place[] = [
  { id: 'h', label: 'Startname', kind: 'home', address: 'Eigene Startadresse', externalUse: { routes: true } },
  { id: 'c', label: 'Zielname', kind: 'customer', latitude: 52, longitude: 13, externalUse: { routes: true } },
]
const visit: Commitment = { id: 'visit', date, label: 'Ein Besuch', context: 'customer', commitment: 'hard', start: 9 * 60, locationKind: 'onsite', originPlaceId: 'home', placeId: 'c', routeMode: 'driving', travelMin: 45, items: ['Mappe'] }
function options() {
  const context = currentTrafficContext(visit.id)!
  return { origin: context.origin!, destination: context.destination!, mode: 'driving' as const, timing: 'arrival' as const, at: new Date(context.arrivalAt).toISOString() }
}
function result(input: RouteRequest): AssistantResult {
  return { kind: 'route', revision: input.revision, route: { durationMin: 65, estimated: true, source: 'Google Routes', fetchedAt: Date.now(), travelAt: input.at, mode: input.mode, trafficAware: true } }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(zonedToUtc(date, 6 * 60))
  mocks.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
  await useApp.getState().saveLocal((local) => ({ ...local, places: structuredClone(places), commitments: [{ ...visit }], assistance: { routes: { enabled: true, version: 1, at: 1 } } }))
  clearRouteProposal(visit.id)
  mocks.request.mockReset()
  mocks.request.mockImplementation(async (input) => result(input as RouteRequest))
})
afterEach(() => { clearRouteProposal(visit.id); vi.useRealTimers(); vi.restoreAllMocks() })

describe('E07: reale Store-Barriere, kurzlebige Routen und begrenzte optionale Effekte', () => {
  it('sendet ohne Zweck- oder Einmalfreigabe sowie unterwegs nichts', async () => {
    await expect(requestRouteEstimate(visit.id, { ...options(), origin: { address: 'Andere Adresse' } })).rejects.toMatchObject({ issue: 'consent' })
    await useApp.getState().saveLocal((local) => ({ ...local, assistance: undefined }))
    await expect(requestRouteEstimate(visit.id, options())).rejects.toMatchObject({ issue: 'consent' })
    await useApp.getState().saveLocal((local) => ({ ...local, assistance: { routes: { enabled: true, version: 1, at: 1 } } }))
    const request = options()
    await useApp.getState().markCommitment(visit.id, 'leftAt')
    await expect(requestRouteEstimate(visit.id, request)).rejects.toThrow('Plan hat sich geändert')
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('hält Quelle und Schätzung nur im Speicher; Öffnen und Vorschlag ändern den Plan nicht', async () => {
    expect(routeProposal(visit.id)).toBeUndefined()
    expect(mocks.request).not.toHaveBeenCalled()
    const before = structuredClone({ local: useApp.getState().local, days: useApp.getState().days, game: useApp.getState().game })
    const proposal = await requestRouteEstimate(visit.id, options())
    expect(proposal.estimate).toMatchObject({ source: 'Google Routes', durationMin: 65, estimated: true })
    expect(routeProposal(visit.id)).toBe(proposal)
    expect({ local: useApp.getState().local, days: useApp.getState().days, game: useApp.getState().game }).toEqual(before)
    const sent = mocks.request.mock.calls[0]![0]
    expect(JSON.stringify(sent)).not.toMatch(/Startname|Zielname|Ein Besuch|Mappe/)
    expect(sent).toMatchObject({ origin: { address: 'Eigene Startadresse' }, destination: { latitude: 52, longitude: 13 } })
    vi.setSystemTime(Date.now() + 16 * 60_000)
    expect(proposalCurrent(proposal)).toBe(false)
    await expect(acceptRouteProposal(proposal)).rejects.toThrow('Plan hat sich geändert')
  })

  it('verwirft späte Antworten nach einer neuen Tagesentscheidung', async () => {
    const gate = deferred<AssistantResult>()
    mocks.request.mockReturnValueOnce(gate.promise)
    const request = requestRouteEstimate(visit.id, options())
    const rejected = expect(request).rejects.toThrow('Plan hat sich geändert')
    await useApp.getState().updateDay(date, (log) => ({ ...log, override: { ...log.override, workEnd: 17 * 60 } }))
    gate.resolve(result(mocks.request.mock.calls[0]![0] as RouteRequest))
    await rejected
    expect(routeProposal(visit.id)).toBeUndefined()
    expect(useApp.getState().local.commitments[0]?.travelMin).toBe(45)
  })

  it('übernimmt nur nach Bestätigung eine eigene Fahrzeit; Termin, Wecken, Items und XP bleiben', async () => {
    const proposal = await requestRouteEstimate(visit.id, options())
    const wake = planFor(date).wake; const game = structuredClone(useApp.getState().game)
    await acceptRouteProposal(proposal)
    expect(useApp.getState().local.commitments[0]).toEqual({ ...visit, travelMin: 65 })
    expect(planFor(date).wake).toBe(wake)
    expect(useApp.getState().game).toEqual(game)
    expect(routeProposal(visit.id)).toBeUndefined()
    expect(JSON.stringify(useApp.getState().local)).not.toMatch(/Google Routes|durationMin|trafficAware|fetchedAt/)
  })

  it('prüft die Revision nochmals innerhalb der Schreibbarriere nach einer eingereihten Planänderung', async () => {
    const proposal = await requestRouteEstimate(visit.id, options())
    const entered = deferred<void>(); const release = deferred<void>()
    const write = mocks.repo!.putMany.bind(mocks.repo!)
    vi.spyOn(mocks.repo!, 'putMany').mockImplementationOnce(async (records) => { entered.resolve(); await release.promise; await write(records) })
    const changing = useApp.getState().updateDay(date, (log) => ({ ...log, override: { ...log.override, wakeOverride: 7 * 60 } }))
    await entered.promise
    const accepting = acceptRouteProposal(proposal)
    const rejected = expect(accepting).rejects.toThrow('Vorschlag passt nicht mehr')
    release.resolve(); await changing; await rejected
    expect(useApp.getState().local.commitments[0]?.travelMin).toBe(45)
    expect(planFor(date).wake).toBe(7 * 60)
  })

  it('führt höchstens die drei freigegebenen Gelegenheiten aus, ohne Fahrzeit oder Alarm zu ändern', async () => {
    await useApp.getState().saveLocal((local) => ({ ...local, assistance: { routes: { enabled: true, version: 1, at: 1, automatic: true } } }))
    const wake = planFor(date).wake
    for (const now of [zonedToUtc('2026-11-08', 19 * 60), zonedToUtc(date, 6 * 60), currentTrafficContext(visit.id)!.leaveAt! - 15 * 60_000]) {
      vi.setSystemTime(now)
      await refreshRouteEstimates(); await refreshRouteEstimates()
    }
    expect(mocks.request).toHaveBeenCalledTimes(3)
    expect(Object.keys(useApp.getState().local.assistance!.routeChecks!)).toHaveLength(3)
    expect(useApp.getState().local.commitments[0]?.travelMin).toBe(45)
    expect(planFor(date).wake).toBe(wake)
    expect(JSON.stringify(useApp.getState().local.assistance)).not.toMatch(/Google Routes|durationMin|Eigene Startadresse|latitude/)
  })

  it('beendet technische Fehler ohne wiederholte Versuche und erhält den manuellen Wert', async () => {
    await useApp.getState().saveLocal((local) => ({ ...local, assistance: { routes: { enabled: true, version: 1, at: 1, automatic: true } } }))
    mocks.request.mockRejectedValueOnce(new AssistanceError('not-configured'))
    await refreshRouteEstimates(); await refreshRouteEstimates()
    expect(mocks.request).toHaveBeenCalledOnce()
    expect(routeIssue(visit.id)).toContain('noch nicht eingerichtet')
    expect(routeProposal(visit.id)).toBeUndefined()
    expect(useApp.getState().local.commitments[0]?.travelMin).toBe(45)
  })

  it('startet ohne Automatik keine Anfrage und bricht bewusste manuelle Anfragen dabei nicht ab', async () => {
    await refreshRouteEstimates()
    expect(mocks.request).not.toHaveBeenCalled()
    const gate = deferred<AssistantResult>()
    mocks.request.mockReturnValueOnce(gate.promise)
    const querying = requestRouteEstimate(visit.id, options())
    await refreshRouteEstimates()
    expect(mocks.request.mock.calls[0]?.[1]?.aborted).toBe(false)
    gate.resolve(result(mocks.request.mock.calls[0]![0] as RouteRequest))
    expect(await querying).toBeDefined()
  })
})
