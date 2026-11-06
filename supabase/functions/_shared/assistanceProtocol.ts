/** JSON-Vertrag für bewusst angeforderte Vorschläge. Keine Schlüssel oder automatischen Planänderungen. */
export type AssistantTravelMode = 'driving' | 'transit' | 'cycling' | 'walking'
export type RoutePoint = { address: string } | { latitude: number; longitude: number }
export interface StepsRequest {
  kind: 'steps'
  revision: string
  title: string
  description?: string
  nextStep?: string
  depth: 'three' | 'normal' | 'tiny'
}
export interface RouteRequest {
  kind: 'route'
  revision: string
  origin: RoutePoint
  destination: RoutePoint
  mode: AssistantTravelMode
  at: string
  timing: 'departure' | 'arrival'
}
export type AssistantRequest = StepsRequest | RouteRequest
export interface SuggestedStep { title: string; estimateMin?: number }
export interface RouteEstimate {
  durationMin: number
  source: 'Google Routes'
  fetchedAt: number
  travelAt: string
  mode: AssistantTravelMode
  trafficAware: boolean
  estimated: true
  /** Begrenzte zeitabhängige Näherung ist noch nicht stabil. */
  uncertain?: boolean
}
export type AssistantResult = { kind: 'steps'; revision: string; steps: SuggestedStep[] }
  | { kind: 'route'; revision: string; route: RouteEstimate }
export interface AssistantCapabilities {
  ai: { configured: boolean; provider: 'OpenAI'; model?: string }
  routes: { configured: boolean; provider: 'Google Routes'; modes: AssistantTravelMode[] }
  dailyLimits: { steps: number; route: number }
}

export const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const boundedText = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max
const optionalText = (value: unknown, max: number): boolean => value === undefined || (typeof value === 'string' && value.length <= max)
export const validTravelMode = (value: unknown): value is AssistantTravelMode => ['driving', 'transit', 'cycling', 'walking'].includes(String(value))
const stamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

export function validRoutePoint(value: unknown): value is RoutePoint {
  return record(value) && (boundedText(value.address, 300)
    || (typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
      && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180))
}

export function validAssistantRequest(value: unknown): value is AssistantRequest {
  if (!record(value) || !boundedText(value.revision, 120)) return false
  if (value.kind === 'steps') return boundedText(value.title, 300) && optionalText(value.description, 2000)
    && optionalText(value.nextStep, 300) && ['three', 'normal', 'tiny'].includes(String(value.depth))
  return value.kind === 'route' && validRoutePoint(value.origin) && validRoutePoint(value.destination)
    && validTravelMode(value.mode) && stamp(value.at) && ['departure', 'arrival'].includes(String(value.timing))
}

/** Nur überprüfbare, begrenzte Vorschlagdaten übernehmen, fremde Zusatzfelder nicht weiterreichen. */
export function parseSuggestedSteps(value: unknown): SuggestedStep[] | undefined {
  if (!record(value) || !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 12) return undefined
  if (!value.steps.every((step) => record(step) && boundedText(step.title, 300)
    && (step.estimateMin === undefined || (typeof step.estimateMin === 'number' && Number.isFinite(step.estimateMin) && step.estimateMin >= 1 && step.estimateMin <= 480)))) return undefined
  return value.steps.map((step) => ({ title: step.title.trim(), ...(step.estimateMin !== undefined ? { estimateMin: step.estimateMin } : {}) }))
}

export function validAssistantResult(value: unknown): value is AssistantResult {
  if (!record(value) || !boundedText(value.revision, 120)) return false
  if (value.kind === 'steps') return !!parseSuggestedSteps(value)
  const route = value.route
  return value.kind === 'route' && record(route) && route.source === 'Google Routes' && route.estimated === true
    && typeof route.durationMin === 'number' && Number.isFinite(route.durationMin) && route.durationMin > 0 && route.durationMin <= 24 * 60
    && typeof route.fetchedAt === 'number' && Number.isFinite(route.fetchedAt) && route.fetchedAt >= 0
    && stamp(route.travelAt) && validTravelMode(route.mode) && typeof route.trafficAware === 'boolean'
    && (route.uncertain === undefined || typeof route.uncertain === 'boolean')
}
