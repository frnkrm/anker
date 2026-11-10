/** Optional ciphertext mailbox. No key, decrypted payload, owner chosen by client or arbitrary upstream. */
export const RELAY_MAX_BYTES = 65_536
export const RELAY_MAX_AGE_MS = 14 * 86_400_000
const MAX_SEQ = 9_007_199_254_740_991
const pairPattern = /^[A-Za-z0-9._:-]{1,160}$/
const tokenPattern = /^[a-f0-9]{64}$/
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export interface RelayEnvelope { v: 3; kind: 'anker-link'; pair: string; from: 'phone' | 'pc'; seq: number; sentAt: string; nonce: string; ct: string }
export interface RelayIdentity { owner: string; pair: string; tokenHash: string | null; role: 'owner' | 'phone' | 'pc' }
export type RelayStoreError = 'unauthorized' | 'invalid' | 'expired' | 'conflict' | 'replay' | 'full'
export interface RelayStoreResult { ok: boolean; error?: RelayStoreError | null; envelopes?: RelayEnvelope[]; phoneExpiresAt?: string }
export interface RelayRepository {
  ownerForToken(hash: string): Promise<{ owner: string; pair: string; role: 'phone' | 'pc' } | null>
  provision(owner: string, pair: string, hash: string, phoneHash: string): Promise<RelayStoreResult>
  renewPhone(owner: string, pair: string, phoneHash: string): Promise<RelayStoreResult>
  revoke(owner: string, pair: string): Promise<RelayStoreResult>
  put(identity: RelayIdentity, envelope: RelayEnvelope, expiresAt: string): Promise<RelayStoreResult>
  get(identity: RelayIdentity, after: number): Promise<RelayStoreResult>
}
export interface RelayDependencies {
  authenticate(token: string): Promise<string | null>
  repository: RelayRepository
  now(): number
  random(bytes: Uint8Array): Uint8Array
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, fields: string[]) => fields.length === Object.keys(value).length && fields.every(field => Object.hasOwn(value, field))
const sequence = (value: unknown, zero = false): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= (zero ? 0 : 1) && value <= MAX_SEQ
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
class RelayInputError extends Error { constructor(readonly status: number) { super('invalid-input') } }

export function relayTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
  if (!m) return null
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number)
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined || hour > 23 || minute > 59 || second > 59) return null
  const check = new Date(0); check.setUTCFullYear(year, month - 1, day); check.setUTCHours(hour, minute, second, 0)
  const at = Date.parse(value)
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day && Number.isFinite(at) ? at : null
}
function base64(value: unknown, bytes: number | null): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return false
  try {
    const raw = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4))
    return (bytes === null || raw.length === bytes) && btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') === value
  } catch { return false }
}
export function relayEnvelope(value: unknown, pair: string, from: 'phone' | 'pc', now: number): RelayEnvelope | null {
  if (!record(value) || !exact(value, ['v', 'kind', 'pair', 'from', 'seq', 'sentAt', 'nonce', 'ct']) || value.v !== 3 || value.kind !== 'anker-link' || value.pair !== pair || value.from !== from || !sequence(value.seq)) return null
  const sent = relayTimestamp(value.sentAt)
  if (sent === null || sent > now + 120_000 || sent < now - RELAY_MAX_AGE_MS || !base64(value.nonce, 12) || !base64(value.ct, null) || value.ct.length < 22 || new TextEncoder().encode(JSON.stringify(value)).byteLength > RELAY_MAX_BYTES) return null
  return value as unknown as RelayEnvelope
}
async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
async function body(request: Request): Promise<unknown> {
  const stream = request.body?.getReader()
  if (!stream) throw new RelayInputError(400)
  const chunks: Uint8Array[] = []; let total = 0
  try {
    while (true) {
      const next = await stream.read(); if (next.done) break
      total += next.value.byteLength
      if (total > RELAY_MAX_BYTES + 2048) { await stream.cancel(); throw new RelayInputError(413) }
      chunks.push(next.value)
    }
  } finally { stream.releaseLock() }
  const bytes = new Uint8Array(total); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
  catch { throw new RelayInputError(400) }
}
function storeReply(result: RelayStoreResult) {
  if (result.ok !== true) {
    const error = result.error
    const status = error === 'unauthorized' ? 401 : error === 'full' ? 429 : error === 'conflict' || error === 'replay' ? 409 : 400
    return json({ error: ['unauthorized', 'invalid', 'expired', 'conflict', 'replay', 'full'].includes(error ?? '') ? error : 'unavailable' }, status)
  }
  return json({ ok: true })
}

export function createPcLinkRelayHandler(deps: RelayDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'method' }, 405)
    if (request.headers.has('origin')) return json({ error: 'native-client-required' }, 403)
    if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return json({ error: 'content-type' }, 415)
    try {
      const input = await body(request)
      if (!record(input) || typeof input.pair !== 'string' || !pairPattern.test(input.pair) || typeof input.operation !== 'string') return json({ error: 'invalid' }, 400)
      const bearer = request.headers.get('authorization'), deviceToken = request.headers.get('x-anker-relay-token')
      if ((bearer === null) === (deviceToken === null)) return json({ error: 'unauthorized' }, 401)
      let identity: RelayIdentity
      if (bearer !== null) {
        if (!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(bearer)) return json({ error: 'unauthorized' }, 401)
        const owner = await deps.authenticate(bearer.slice(7))
        if (!owner || !uuidPattern.test(owner)) return json({ error: 'unauthorized' }, 401)
        identity = { owner, pair: input.pair, tokenHash: null, role: 'owner' }
      } else {
        if (!deviceToken || !tokenPattern.test(deviceToken)) return json({ error: 'unauthorized' }, 401)
        const tokenHash = await sha256(deviceToken), found = await deps.repository.ownerForToken(tokenHash)
        if (!found || found.pair !== input.pair || !uuidPattern.test(found.owner) || !['phone', 'pc'].includes(found.role)) return json({ error: 'unauthorized' }, 401)
        identity = { owner: found.owner, pair: found.pair, tokenHash, role: found.role }
      }
      const phone = identity.role !== 'pc'
      if (['provision', 'revoke', 'renew-phone'].includes(input.operation)) {
        if (identity.role !== 'owner') return json({ error: 'forbidden' }, 403)
        if (!exact(input, ['operation', 'pair'])) return json({ error: 'invalid' }, 400)
        if (input.operation === 'revoke') return storeReply(await deps.repository.revoke(identity.owner, identity.pair))
        const bytes = deps.random(new Uint8Array(32))
        if (bytes.length !== 32) return json({ error: 'unavailable' }, 503)
        const phoneToken = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
        let deviceToken: string | undefined, result: RelayStoreResult
        if (input.operation === 'renew-phone') result = await deps.repository.renewPhone(identity.owner, identity.pair, await sha256(phoneToken))
        else {
          const pcBytes = deps.random(new Uint8Array(32))
          if (pcBytes.length !== 32) return json({ error: 'unavailable' }, 503)
          deviceToken = Array.from(pcBytes, b => b.toString(16).padStart(2, '0')).join('')
          if (deviceToken === phoneToken) return json({ error: 'unavailable' }, 503)
          result = await deps.repository.provision(identity.owner, identity.pair, await sha256(deviceToken), await sha256(phoneToken))
        }
        if (result.ok !== true) return storeReply(result)
        const expiry = relayTimestamp(result.phoneExpiresAt), now = deps.now()
        if (expiry === null || expiry <= now || expiry > now + RELAY_MAX_AGE_MS + 5000) return json({ error: 'unavailable' }, 503)
        return json({ ok: true, phoneToken, phoneExpiresAt: result.phoneExpiresAt, ...(deviceToken ? { deviceToken } : {}) })
      }
      if (input.operation === 'put') {
        if (!exact(input, ['operation', 'pair', 'envelope', 'expiresAt'])) return json({ error: 'invalid' }, 400)
        const now = deps.now(), envelope = relayEnvelope(input.envelope, identity.pair, phone ? 'phone' : 'pc', now), expires = relayTimestamp(input.expiresAt)
        if (!envelope || expires === null || expires <= now || expires > now + RELAY_MAX_AGE_MS || expires > (relayTimestamp(envelope.sentAt) ?? 0) + RELAY_MAX_AGE_MS) return json({ error: 'invalid' }, 400)
        return storeReply(await deps.repository.put(identity, envelope, input.expiresAt as string))
      }
      if (input.operation === 'get') {
        if (!exact(input, ['operation', 'pair', 'after']) || !sequence(input.after, true)) return json({ error: 'invalid' }, 400)
        const result = await deps.repository.get(identity, input.after)
        if (result.ok !== true) return storeReply(result)
        const envelopes = result.envelopes
        if (!Array.isArray(envelopes) || envelopes.length > 8) return json({ error: 'unavailable' }, 503)
        let last = input.after
        for (const item of envelopes) {
          if (!relayEnvelope(item, identity.pair, phone ? 'pc' : 'phone', deps.now()) || item.seq <= last) return json({ error: 'unavailable' }, 503)
          last = item.seq
        }
        return json({ ok: true, envelopes })
      }
      return json({ error: 'invalid' }, 400)
    } catch (error) { return error instanceof RelayInputError ? json({ error: 'invalid' }, error.status) : json({ error: 'unavailable' }, 503) }
  }
}
