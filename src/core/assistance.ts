import type { InboxItem, TaskRef, WorkTask } from './types'
export * from '../../supabase/functions/_shared/assistanceProtocol'

export const ASSISTANCE_NOTICE_VERSION = 1
export interface AssistanceConsent { enabled: boolean; at: number; version: 1 }
export interface AssistancePreferences {
  ai?: AssistanceConsent
  routes?: AssistanceConsent & { automatic?: boolean; changeThresholdMin?: number }
  /** Technische Abrufgrenzen, keine Route/Adresse oder Bewegungsbiografie. */
  routeChecks?: Record<string, { at: number; revision: string }>
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
export function validAssistancePreferences(value: unknown): value is AssistancePreferences | undefined {
  if (value === undefined) return true
  if (!object(value)) return false
  for (const purpose of ['ai', 'routes']) {
    const consent = value[purpose]
    if (consent !== undefined && (!object(consent) || typeof consent.enabled !== 'boolean' || consent.version !== 1 || !timestamp(consent.at)
      || (consent.automatic !== undefined && typeof consent.automatic !== 'boolean')
      || (consent.changeThresholdMin !== undefined && (typeof consent.changeThresholdMin !== 'number' || !Number.isInteger(consent.changeThresholdMin) || consent.changeThresholdMin < 1 || consent.changeThresholdMin > 120)))) return false
  }
  return value.routeChecks === undefined || (object(value.routeChecks) && Object.entries(value.routeChecks).length <= 100
    && Object.values(value.routeChecks).every((entry) => object(entry) && timestamp(entry.at) && typeof entry.revision === 'string'))
}

export function assistanceAllowed(profile: AssistancePreferences | undefined, purpose: 'ai' | 'routes'): boolean {
  return validAssistancePreferences(profile) && profile?.[purpose]?.enabled === true && profile[purpose]?.version === ASSISTANCE_NOTICE_VERSION
}

/** Identische relevante Eingaben bleiben identisch. Keine Inhalte in Logs oder Anfrage-IDs schreiben. */
export function assistanceRevision(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return `request:${(hash >>> 0).toString(16)}`
}

export interface TaskSuggestionExpectation { revision: string; purpose: 'ai' }

/** Exakter lokaler Snapshot für die atomare Übernahme; dieser Text wird nicht übertragen. */
export function taskAssistanceRevision(ref: TaskRef, task: InboxItem | WorkTask): string {
  return JSON.stringify([ref.kind, ref.id, task])
}
