import { assistanceAllowed, type AssistantTravelMode, type RouteEstimate, type RoutePoint, type RouteRequest } from '../core/assistance'
import { coalesceAsync } from '../core/coalesced'
import { automaticRouteRequest, routeRequestNeedsOneShot, trafficContext, type TrafficContext } from '../core/traffic'
import { addDays } from '../core/time'
import { planFor, today, useApp } from '../state/store'
import { AssistanceError, requestAssistance } from './assistance'

export interface RouteProposal {
  commitmentId: string
  signature: string
  request: RouteRequest
  estimate: RouteEstimate
  expiresAt: number
}
export class RoutePlanChanged extends Error {
  constructor() { super('Dein Plan hat sich geändert. Die frühere Schätzung wird nicht übernommen.') }
}

// Nur kurzlebige Anzeige. Keine Providerantwort, Adresse oder Bewegungsfolge wird gespeichert.
const proposals = new Map<string, RouteProposal>()
const issues = new Map<string, string>()
const listeners = new Set<() => void>()
const pending = new Map<string, { signature: string; automatic: boolean; controller: AbortController; promise: Promise<RouteProposal> }>()
const emit = () => listeners.forEach((listener) => listener())
const MAX_AGE = 15 * 60_000
let expiryTimer: ReturnType<typeof setTimeout> | undefined

/** Lokale Speicherbereinigung, kein Netzwerkabruf und kein Hintergrund-Tracking. */
function scheduleExpiry(): void {
  clearTimeout(expiryTimer)
  expiryTimer = undefined
  if (!proposals.size) return
  const next = Math.min(...[...proposals.values()].map((proposal) => proposal.expiresAt))
  expiryTimer = setTimeout(() => { expiryTimer = undefined; pruneProposals(Date.now()); scheduleExpiry() }, Math.max(0, next - Date.now()))
}

export function subscribeRouteProposals(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const routeProposal = (id: string): RouteProposal | undefined => proposals.get(id)
export const routeIssue = (id: string): string | undefined => issues.get(id)

export function currentTrafficContext(id: string): TrafficContext | undefined {
  const state = useApp.getState()
  const commitment = state.local.commitments.find((item) => item.id === id)
  return commitment ? trafficContext(state, planFor(commitment.date, state), id) : undefined
}

export function proposalCurrent(proposal: RouteProposal, now = Date.now()): boolean {
  return proposal.expiresAt > now && currentTrafficContext(proposal.commitmentId)?.signature === proposal.signature
    && assistanceAllowed(useApp.getState().local.assistance, 'routes')
}

export function clearRouteProposal(id: string): void {
  if (proposals.delete(id)) { scheduleExpiry(); emit() }
}

function pruneProposals(now: number): void {
  let changed = false
  for (const [id, proposal] of proposals) if (proposal.expiresAt <= now || currentTrafficContext(id)?.signature !== proposal.signature) changed = proposals.delete(id) || changed
  while (proposals.size > 20) { proposals.delete(proposals.keys().next().value!); changed = true }
  if (changed) emit()
}

export function cancelRouteRequest(id: string): void {
  pending.get(id)?.controller.abort()
}
export function cancelAutomaticRouteRequests(): void {
  for (const request of pending.values()) if (request.automatic) request.controller.abort()
}

export function requestRouteEstimate(id: string, options: { origin: RoutePoint; destination: RoutePoint; mode: AssistantTravelMode; at: string; timing: 'departure' | 'arrival'; oneShot?: boolean; expectedSignature?: string; automatic?: boolean }, externalSignal?: AbortSignal): Promise<RouteProposal> {
  if (!assistanceAllowed(useApp.getState().local.assistance, 'routes')) return Promise.reject(new AssistanceError('consent'))
  if (options.automatic && useApp.getState().local.assistance?.routes?.automatic !== true) return Promise.reject(new AssistanceError('cancelled'))
  const context = currentTrafficContext(id)
  if (!context || context.arrivalAt <= Date.now() || (options.expectedSignature !== undefined && options.expectedSignature !== context.signature)) return Promise.reject(new RoutePlanChanged())
  if (!Number.isFinite(Date.parse(options.at)) || Date.parse(options.at) <= Date.now()) return Promise.reject(new AssistanceError('invalid-response'))
  if (routeRequestNeedsOneShot(context, options.origin, options.destination) && options.oneShot !== true) return Promise.reject(new AssistanceError('consent'))
  const request: RouteRequest = { kind: 'route', revision: context.revision, origin: options.origin, destination: options.destination, mode: options.mode, at: options.at, timing: options.timing }
  const signature = JSON.stringify([context.signature, request])
  const existing = pending.get(id)
  if (existing?.signature === signature) {
    // Eine inzwischen bewusst angeforderte identische Anfrage hängt nicht mehr an der Automatik.
    if (!options.automatic) existing.automatic = false
    return existing.promise
  }
  existing?.controller.abort()
  const controller = new AbortController()
  const abort = () => controller.abort()
  externalSignal?.addEventListener('abort', abort, { once: true })
  if (externalSignal?.aborted) controller.abort()
  const task = (async (): Promise<RouteProposal> => {
    const result = await requestAssistance(request, controller.signal)
    if (controller.signal.aborted) throw new AssistanceError('cancelled')
    if (result.kind !== 'route' || currentTrafficContext(id)?.signature !== context.signature) throw new RoutePlanChanged()
    if (result.route.mode !== request.mode || Date.parse(result.route.travelAt) !== Date.parse(request.at)) throw new AssistanceError('invalid-response')
    const now = Date.now()
    const proposal: RouteProposal = { commitmentId: id, signature: context.signature, request, estimate: result.route, expiresAt: Math.min(now + MAX_AGE, result.route.fetchedAt + MAX_AGE, context.arrivalAt) }
    proposals.set(id, proposal)
    pruneProposals(now)
    issues.delete(id)
    scheduleExpiry()
    emit()
    return proposal
  })().finally(() => {
    externalSignal?.removeEventListener('abort', abort)
    if (pending.get(id)?.promise === task) pending.delete(id)
  })
  pending.set(id, { signature, automatic: options.automatic === true, controller, promise: task })
  return task
}

/** Die bestätigte Zahl wird zur eigenen Planung. Kein Providerpayload und keine neue Weckzeit werden gespeichert. */
export async function acceptRouteProposal(proposal: RouteProposal): Promise<void> {
  if (!proposalCurrent(proposal)) throw new RoutePlanChanged()
  await useApp.getState().updateCommitment(proposal.commitmentId, {
    travelMin: proposal.estimate.durationMin,
    routeMode: proposal.request.mode,
  }, 'Fahrzeit bewusst als eigenen Planwert übernommen', () => proposalCurrent(proposal))
  clearRouteProposal(proposal.commitmentId)
}

/** Diskrete Vorabend-/Morgen-/Abfahrtschecks über den vorhandenen Effektweg, keine Netz-Pollingschleife. */
export const refreshRouteEstimates = coalesceAsync(async () => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  const state = useApp.getState()
  if (!assistanceAllowed(state.local.assistance, 'routes')) {
    for (const request of pending.values()) request.controller.abort()
    proposals.clear(); issues.clear(); scheduleExpiry(); emit()
    return
  }
  if (state.local.assistance?.routes?.automatic !== true) { cancelAutomaticRouteRequests(); return }
  pruneProposals(Date.now())
  const dates = new Set([today(), addDays(today(), 1)])
  for (const commitment of [...state.local.commitments].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)) {
    if (!dates.has(commitment.date)) continue
    const context = currentTrafficContext(commitment.id)
    if (!context) continue
    const next = automaticRouteRequest(useApp.getState(), context, Date.now())
    if (!next) continue
    let claimed = false
    await useApp.getState().saveLocal((local) => {
      const current = currentTrafficContext(commitment.id)
      if (!current || current.signature !== context.signature || !assistanceAllowed(local.assistance, 'routes')
        || local.assistance?.routes?.automatic !== true || local.assistance.routeChecks?.[next.key]) return local
      const recent = Object.entries(local.assistance.routeChecks ?? {}).filter(([, value]) => value.at > Date.now() - 3 * 86400_000)
      // Noch relevante Abrufmerker niemals verdrängen: das würde alte Besuche erneut abrechnen.
      if (recent.length >= 100) return local
      claimed = true
      return { ...local, assistance: { ...local.assistance, routeChecks: { ...Object.fromEntries(recent), [next.key]: { at: Date.now(), revision: context.revision } } } }
    })
    if (!claimed) continue
    try {
      await requestRouteEstimate(commitment.id, { ...next.request, oneShot: false, expectedSignature: context.signature, automatic: true })
    } catch (error) {
      if (error instanceof AssistanceError && error.issue !== 'cancelled') {
        issues.set(commitment.id, error.message)
        while (issues.size > 20) issues.delete(issues.keys().next().value!)
        emit()
      }
      // Der manuelle Wert bleibt. Technische Fehlversuche werden nicht alle fünf Minuten erneut bezahlt.
      if (error instanceof AssistanceError && ['daily-limit', 'signed-out', 'not-configured', 'offline'].includes(error.issue)) break
    }
  }
})
