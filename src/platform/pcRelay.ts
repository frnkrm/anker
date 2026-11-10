import { AnkerNative, isNative, type NativePcRelayState } from './native'
import { sb } from './supabase'

export const PC_RELAY_STATUSES = ['off', 'lan', 'waiting', 'received', 'expired', 'unavailable', 'unauthorized', 'rejected'] as const
export type PcRelayState = NativePcRelayState
const native = AnkerNative
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function pcRelayProject(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value), host = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (!url.pathname || url.pathname === '/') && !url.search && !url.hash && host?.[1] ? host[1] : null
  } catch { return null }
}
function state(value: unknown): PcRelayState {
  if (!record(value) || Object.keys(value).some(key => !['enabled', 'paired', 'status', 'phoneExpiresAt', 'lastExchangeAt'].includes(key)) || typeof value.enabled !== 'boolean' || typeof value.paired !== 'boolean' || !PC_RELAY_STATUSES.some(status => status === value.status)) throw new Error('PC_RELAY_RESPONSE_INVALID')
  for (const name of ['phoneExpiresAt', 'lastExchangeAt']) if (value[name] !== undefined && (typeof value[name] !== 'number' || !Number.isSafeInteger(value[name]) || (value[name] as number) < 0)) throw new Error('PC_RELAY_RESPONSE_INVALID')
  return value as unknown as PcRelayState
}
function android() { if (!isNative()) throw new Error('PC_RELAY_ANDROID_REQUIRED') }
async function session(): Promise<string> {
  android()
  const client = sb()
  if (!client) throw new Error('PC_RELAY_NOT_CONFIGURED')
  const result = await client.auth.getSession()
  const token = result.data.session?.access_token, expires = result.data.session?.expires_at
  if (result.error || typeof token !== 'string' || !/^[A-Za-z0-9._~-]{20,8192}$/.test(token) || typeof expires !== 'number' || expires * 1000 <= Date.now()) throw new Error('PC_RELAY_AUTH_REQUIRED')
  return token
}
export async function readPcRelayStatus(): Promise<PcRelayState> {
  if (!isNative()) return { enabled: false, paired: false, status: 'off' }
  return state(await native.pcRelayStatus())
}
export async function setupPcRelay(): Promise<{ state: PcRelayState; desktopSetup: string }> {
  android()
  const project = pcRelayProject(import.meta.env.VITE_SUPABASE_URL)
  if (!project) throw new Error('PC_RELAY_NOT_CONFIGURED')
  const result = await native.pcRelaySetup({ project, accessToken: await session() })
  if (typeof result.desktopSetup !== 'string' || !/^anker-pc-relay:v1:[A-Za-z0-9_-]{40,2000}$/.test(result.desktopSetup)) throw new Error('PC_RELAY_RESPONSE_INVALID')
  return { state: state(result.state), desktopSetup: result.desktopSetup }
}
export async function renewPcRelay(): Promise<PcRelayState> { return state((await native.pcRelayRenew({ accessToken: await session() })).state) }
export async function revokePcRelay(): Promise<{ state: PcRelayState; cloudRevoked: boolean }> {
  const result = await native.pcRelayRevoke({ accessToken: await session() })
  if (typeof result.cloudRevoked !== 'boolean') throw new Error('PC_RELAY_RESPONSE_INVALID')
  return { state: state(result.state), cloudRevoked: result.cloudRevoked }
}
export async function disablePcRelay(): Promise<PcRelayState> { android(); return state((await native.pcRelayDisable()).state) }
export async function clearPcRelay(): Promise<PcRelayState> { android(); return state((await native.pcRelayClear()).state) }

/** Foreground-only renewal; no new refresh-token owner or background JWT copy. */
export async function refreshPcRelayAuthorizationIfNeeded(): Promise<void> {
  if (!isNative() || !sb()) return
  const current = await readPcRelayStatus()
  if (current.enabled && current.paired && (current.phoneExpiresAt ?? 0) <= Date.now() + 86_400_000 && sb()) await renewPcRelay()
}
