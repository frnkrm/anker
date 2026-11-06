import { assistanceAllowed, record, validAssistantRequest, validAssistantResult, type AssistantCapabilities, type AssistantRequest, type AssistantResult } from '../core/assistance'
import { useApp } from '../state/store'
import { sb, supabaseConfigured } from './supabase'

type Issue = 'not-configured' | 'signed-out' | 'consent' | 'daily-limit' | 'offline' | 'invalid-response' | 'cancelled' | 'timeout'
type Purpose = 'ai' | 'routes'
const generations: Record<Purpose, number> = { ai: 0, routes: 0 }
const running = new Map<AbortController, Purpose>()

/** Widerruf beendet auch Anfragen, die gerade noch auf ihre Anmeldung warten. */
export function cancelAssistanceRequests(purpose?: Purpose): void {
  for (const key of purpose ? [purpose] : ['ai', 'routes'] as const) generations[key]++
  for (const [controller, key] of running) if (!purpose || purpose === key) controller.abort()
}
export class AssistanceError extends Error {
  constructor(readonly issue: Issue) {
    super({
      'not-configured': 'Der optionale Vorschlagsdienst ist auf deinem Server noch nicht eingerichtet.',
      'signed-out': 'Für den optionalen Dienst ist eine gültige Anmeldung erforderlich. Deine lokalen Daten bleiben erhalten.',
      consent: 'Diese optionale Datenübertragung ist ausgeschaltet.',
      'daily-limit': 'Die gewählte Tagesgrenze ist erreicht. Du kannst mit den lokalen Funktionen weitermachen.',
      offline: 'Die Verbindung ist gerade nicht verfügbar. Deine Aufgabe und deine manuelle Planung bleiben unverändert.',
      'invalid-response': 'Die Antwort ist nicht verwendbar. Es wurde nichts an deinem Plan geändert.',
      cancelled: 'Die Anfrage wurde beendet. Es wurde nichts übernommen.',
      timeout: 'Die Anfrage dauert zu lange. Du kannst die manuelle Planung weiterverwenden.',
    }[issue])
  }
}

async function invoke(input?: AssistantRequest, externalSignal?: AbortSignal, allowed?: () => boolean, purpose?: Purpose): Promise<unknown> {
  const client = sb()
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!supabaseConfigured || !client || !base) throw new AssistanceError('not-configured')
  const { data, error } = await client.auth.getSession()
  if (error || !data.session?.access_token) throw new AssistanceError('signed-out')
  if (allowed && !allowed()) throw new AssistanceError('consent')
  const controller = new AbortController()
  if (purpose) running.set(controller, purpose)
  let timedOut = false
  const cancel = () => controller.abort()
  externalSignal?.addEventListener('abort', cancel, { once: true })
  if (externalSignal?.aborted) controller.abort()
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 25_000)
  try {
    if (controller.signal.aborted) throw new AssistanceError('cancelled')
    if (allowed && !allowed()) throw new AssistanceError('consent')
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/assistant`, {
      method: input ? 'POST' : 'GET', signal: controller.signal,
      headers: { authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string, 'content-type': 'application/json' },
      ...(input ? { body: JSON.stringify(input) } : {}),
    })
    if (controller.signal.aborted) throw new AssistanceError(timedOut ? 'timeout' : 'cancelled')
    if (!response.ok) throw new AssistanceError(response.status === 401 || response.status === 403 ? 'signed-out' : response.status === 429 ? 'daily-limit' : response.status === 503 ? 'not-configured' : 'offline')
    const result: unknown = await response.json()
    if (controller.signal.aborted) throw new AssistanceError(timedOut ? 'timeout' : 'cancelled')
    return result
  } catch (error) {
    if (error instanceof AssistanceError) throw error
    throw new AssistanceError(controller.signal.aborted ? timedOut ? 'timeout' : 'cancelled' : 'offline')
  } finally {
    running.delete(controller)
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', cancel)
  }
}

/** Nur der bewusste Verbindungscheck; kein Aufgaben-/Ortsinhalt und kein automatisches Einschalten. */
export async function assistantCapabilities(signal?: AbortSignal): Promise<AssistantCapabilities> {
  const data = await invoke(undefined, signal)
  if (!record(data) || !record(data.ai) || !record(data.routes) || !record(data.dailyLimits)
    || typeof data.ai.configured !== 'boolean' || data.ai.provider !== 'OpenAI'
    || typeof data.routes.configured !== 'boolean' || data.routes.provider !== 'Google Routes'
    || !Array.isArray(data.routes.modes) || !data.routes.modes.every((mode) => ['driving', 'transit', 'cycling', 'walking'].includes(String(mode)))
    || typeof data.dailyLimits.steps !== 'number' || typeof data.dailyLimits.route !== 'number') throw new AssistanceError('invalid-response')
  return data as unknown as AssistantCapabilities
}

export async function requestAssistance(input: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
  if (!validAssistantRequest(input)) throw new AssistanceError('invalid-response')
  const purpose = input.kind === 'steps' ? 'ai' : 'routes'
  const generation = generations[purpose]
  const allowed = () => generation === generations[purpose] && assistanceAllowed(useApp.getState().local.assistance, purpose)
  if (!allowed()) throw new AssistanceError('consent')
  const result = await invoke(input, signal, allowed, purpose)
  if (!allowed()) throw new AssistanceError('consent')
  if (!validAssistantResult(result) || result.kind !== input.kind || result.revision !== input.revision) throw new AssistanceError('invalid-response')
  return result
}
