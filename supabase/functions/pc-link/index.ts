// Optional; deploy explicitly with --no-verify-jwt: this handler verifies handset JWTs
// using Auth.getUser and separately verifies a scoped, hashed desktop device token.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createPcLinkRelayHandler, type RelayIdentity, type RelayStoreResult } from '../_shared/pcLinkRelayHandler.ts'

const url = Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const unavailable = () => new Response('{"error":"unavailable"}', { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
if (!url || !key) Deno.serve(unavailable)
else {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const rpc = async (name: string, params: Record<string, unknown>): Promise<RelayStoreResult> => {
    const { data, error } = await db.rpc(name, params)
    if (error || !data || typeof data !== 'object' || typeof data.ok !== 'boolean') throw new Error('relay-store-unavailable')
    return data as RelayStoreResult
  }
  const args = (identity: RelayIdentity) => ({ p_owner: identity.owner, p_pair: identity.pair, p_hash: identity.tokenHash })
  Deno.serve(createPcLinkRelayHandler({
    now: Date.now, random: bytes => crypto.getRandomValues(bytes),
    async authenticate(token) {
      const { data, error } = await db.auth.getUser(token)
      return error ? null : data.user?.id ?? null
    },
    repository: {
      async ownerForToken(hash) {
        const { data, error } = await db.rpc('pc_link_relay_lookup', { p_hash: hash })
        if (error) throw new Error('relay-store-unavailable')
        return data ?? null
      },
      provision: (owner, pair, hash, phoneHash) => rpc('pc_link_relay_provision', { p_owner: owner, p_pair: pair, p_hash: hash, p_phone_hash: phoneHash }),
      renewPhone: (owner, pair, phoneHash) => rpc('pc_link_relay_renew_phone', { p_owner: owner, p_pair: pair, p_phone_hash: phoneHash }),
      revoke: (owner, pair) => rpc('pc_link_relay_revoke', { p_owner: owner, p_pair: pair }),
      put: (identity, envelope, expiresAt) => rpc('pc_link_relay_put', { ...args(identity), p_direction: envelope.from, p_seq: envelope.seq, p_envelope: envelope, p_expires: expiresAt }),
      get: (identity, after) => rpc('pc_link_relay_get', { ...args(identity), p_after: after }),
    },
  }))
}
