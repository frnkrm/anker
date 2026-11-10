import { webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createPcLinkRelayHandler, RELAY_MAX_AGE_MS, relayEnvelope, relayTimestamp, type RelayEnvelope, type RelayIdentity, type RelayRepository, type RelayStoreResult } from '../../supabase/functions/_shared/pcLinkRelayHandler'
import { openPcEnvelope, sealPcPayload } from '../core/pcLink/crypto'

const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const PAIR = 'synthetic-relay-pair'
const JWT = 'synthetic-owner-jwt-value'
const SECOND_JWT = 'synthetic-other-jwt-value'
const START = Date.parse('2026-11-12T21:00:00Z')
const subtle = webcrypto.subtle as SubtleCrypto
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
interface Device { pcHash: string; phoneHash: string; phoneExpires: number; revoked: boolean; phoneSeq: number; pcSeq: number }
interface Row { owner: string; pair: string; envelope: RelayEnvelope; expires: number }

/** Transaction seam for the production HTTP handler; SQL execution is a separate setup gate. */
class Repository implements RelayRepository {
  now = START
  devices = new Map<string, Device>()
  rows: Row[] = []
  afterLookup: (() => void) | undefined
  key(owner: string, pair: string) { return `${owner}/${pair}` }
  async ownerForToken(hash: string) {
    const entries = Array.from(this.devices.entries())
    const found = entries.find(([, d]) => !d.revoked && (d.pcHash === hash || d.phoneHash === hash && d.phoneExpires > this.now))
    if (!found) return null
    const [owner, pair] = found[0].split('/')
    if (!owner || !pair) return null
    const result = { owner, pair, role: found[1].pcHash === hash ? 'pc' as const : 'phone' as const }
    this.afterLookup?.()
    return result
  }
  async provision(owner: string, pair: string, pcHash: string, phoneHash: string): Promise<RelayStoreResult> {
    const old = this.devices.get(this.key(owner, pair))
    this.devices.set(this.key(owner, pair), { pcHash, phoneHash, phoneExpires: this.now + RELAY_MAX_AGE_MS, revoked: false, phoneSeq: old?.phoneSeq ?? 0, pcSeq: old?.pcSeq ?? 0 })
    this.rows = this.rows.filter(row => row.owner !== owner || row.pair !== pair)
    return { ok: true, phoneExpiresAt: new Date(this.now + RELAY_MAX_AGE_MS).toISOString() }
  }
  async renewPhone(owner: string, pair: string, phoneHash: string): Promise<RelayStoreResult> {
    const device = this.devices.get(this.key(owner, pair))
    if (!device || device.revoked) return { ok: false, error: 'unauthorized' }
    device.phoneHash = phoneHash; device.phoneExpires = this.now + RELAY_MAX_AGE_MS
    return { ok: true, phoneExpiresAt: new Date(device.phoneExpires).toISOString() }
  }
  async revoke(owner: string, pair: string): Promise<RelayStoreResult> {
    const device = this.devices.get(this.key(owner, pair))
    if (device) device.revoked = true
    this.rows = this.rows.filter(row => row.owner !== owner || row.pair !== pair)
    return { ok: true }
  }
  active(identity: RelayIdentity, direction?: 'pc' | 'phone') {
    const device = this.devices.get(this.key(identity.owner, identity.pair))
    return device && !device.revoked && (identity.tokenHash === null ||
      identity.tokenHash === device.pcHash && (!direction || direction === 'pc') ||
      identity.tokenHash === device.phoneHash && device.phoneExpires > this.now && (!direction || direction === 'phone')) ? device : null
  }
  async put(identity: RelayIdentity, envelope: RelayEnvelope, expiresAt: string): Promise<RelayStoreResult> {
    const device = this.active(identity, envelope.from)
    if (!device) return { ok: false, error: 'unauthorized' }
    this.rows = this.rows.filter(row => row.expires > this.now)
    const prior = this.rows.find(row => row.owner === identity.owner && row.pair === identity.pair && row.envelope.from === envelope.from && row.envelope.seq === envelope.seq)
    if (prior) return { ok: JSON.stringify(prior.envelope) === JSON.stringify(envelope), error: 'conflict' }
    const counter = envelope.from === 'pc' ? 'pcSeq' : 'phoneSeq'
    if (envelope.seq <= device[counter]) return { ok: false, error: 'replay' }
    device[counter] = envelope.seq
    this.rows.push({ owner: identity.owner, pair: identity.pair, envelope: structuredClone(envelope), expires: Date.parse(expiresAt) })
    return { ok: true }
  }
  async get(identity: RelayIdentity, after: number): Promise<RelayStoreResult> {
    if (!this.active(identity)) return { ok: false, error: 'unauthorized' }
    return { ok: true, envelopes: this.rows.filter(row => row.owner === identity.owner && row.pair === identity.pair && row.envelope.from !== (identity.role === 'pc' ? 'pc' : 'phone') && row.expires > this.now && row.envelope.seq > after).sort((a, b) => a.envelope.seq - b.envelope.seq).slice(0, 8).map(row => structuredClone(row.envelope)) }
  }
}
function fixture() {
  const repository = new Repository()
  let randomCount = 0
  const authenticate = vi.fn(async (token: string) => token === JWT ? OWNER : token === SECOND_JWT ? OTHER : null)
  const handler = createPcLinkRelayHandler({ repository, authenticate, now: () => repository.now,
    random: bytes => { bytes.fill(++randomCount); return bytes } })
  const invoke = (body: unknown, credential: string | null = JWT, owner = true, headers: Record<string, string> = {}) => handler(new Request('https://synthetic.invalid/functions/v1/pc-link', { method: 'POST', headers: { 'content-type': 'application/json', ...(credential ? owner ? { authorization: `Bearer ${credential}` } : { 'x-anker-relay-token': credential } : {}), ...headers }, body: JSON.stringify(body) }))
  const provision = async () => {
    const response = await invoke({ operation: 'provision', pair: PAIR })
    expect(response.status).toBe(200)
    return await response.json() as { deviceToken: string; phoneToken: string; phoneExpiresAt: string }
  }
  return { repository, handler, invoke, provision, authenticate }
}
const frame = (from: 'pc' | 'phone' = 'phone', seq = 1): RelayEnvelope => ({ v: 3, kind: 'anker-link', pair: PAIR, from, seq, sentAt: new Date(START).toISOString(), nonce: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAA' })
const put = (envelope = frame(), expiresAt = new Date(START + 3600_000).toISOString()) => ({ operation: 'put', pair: PAIR, envelope, expiresAt })

describe('Optionaler PC-Relay: echter HTTP-Handler mit kontrollierter Auth-/DB-Grenze', () => {
  it('erzeugt getrennte Rollen nur nach Auth.getUser-Verifikation und speichert ausschließlich Hashes', async () => {
    const f = fixture(), tokens = await f.provision()
    expect(f.authenticate).toHaveBeenCalledWith(JWT)
    expect(tokens.deviceToken).toMatch(/^[a-f0-9]{64}$/)
    expect(tokens.phoneToken).not.toBe(tokens.deviceToken)
    expect(Date.parse(tokens.phoneExpiresAt)).toBe(START + RELAY_MAX_AGE_MS)
    const device = f.repository.devices.get(`${OWNER}/${PAIR}`)!
    expect(device.pcHash).toBe(await digest(tokens.deviceToken))
    expect(device.phoneHash).toBe(await digest(tokens.phoneToken))
    expect(JSON.stringify(device)).not.toContain(tokens.deviceToken)
    expect(JSON.stringify(device)).not.toContain(tokens.phoneToken)
  })
  it('weist fehlende, gefälschte, gleichzeitig übergebene und falsche Authentifizierung zurück', async () => {
    const f = fixture(), body = { operation: 'get', pair: PAIR, after: 0 }
    for (const response of [await f.invoke(body, null), await f.invoke(body, 'synthetic-unknown-jwt-value'), await f.invoke(body, 'f'.repeat(64), false), await f.invoke(body, JWT, true, { 'x-anker-relay-token': 'a'.repeat(64) })]) expect(response.status).toBe(401)
    expect(f.repository.devices.size).toBe(0)
  })
  it('erlaubt PC-/Handycapabilities weder Provision noch Erneuerung noch Widerruf', async () => {
    const f = fixture(), t = await f.provision()
    for (const operation of ['provision', 'renew-phone', 'revoke']) for (const token of [t.deviceToken, t.phoneToken]) expect((await f.invoke({ operation, pair: PAIR }, token, false)).status).toBe(403)
  })
  it('bindet Konto, Paar und Richtung statt Client-Owner- oder Richtungsvorgaben zu vertrauen', async () => {
    const f = fixture(), t = await f.provision()
    expect((await f.invoke(put(), SECOND_JWT)).status).toBe(401)
    expect((await f.invoke({ ...put(), pair: 'other-pair' }, t.deviceToken, false)).status).toBe(401)
    expect((await f.invoke(put(), t.deviceToken, false)).status).toBe(400)
    expect((await f.invoke(put(frame('pc')), t.phoneToken, false)).status).toBe(400)
    expect((await f.invoke({ ...put(), owner: OTHER })).status).toBe(400)
    expect(f.repository.rows).toEqual([])
  })
  it('widerruft atomar auch eine schon nachgeschlagene Capability und löscht die Mailbox', async () => {
    const f = fixture(), t = await f.provision()
    expect((await f.invoke(put(), t.phoneToken, false)).status).toBe(200)
    f.repository.afterLookup = () => { void f.repository.revoke(OWNER, PAIR) }
    expect((await f.invoke(put(frame('pc')), t.deviceToken, false)).status).toBe(401)
    expect(f.repository.rows).toEqual([])
    expect((await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.phoneToken, false)).status).toBe(401)
  })
  it('erneuert nur die endliche Handyberechtigung; PCtoken und vorhandene Replayzähler bleiben gleich', async () => {
    const f = fixture(), t = await f.provision()
    await f.invoke(put(), t.phoneToken, false)
    f.repository.now += RELAY_MAX_AGE_MS + 1
    expect((await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.phoneToken, false)).status).toBe(401)
    const response = await f.invoke({ operation: 'renew-phone', pair: PAIR })
    const renewed = await response.json() as { phoneToken: string; phoneExpiresAt: string; deviceToken?: string }
    expect(response.status).toBe(200); expect(renewed.deviceToken).toBeUndefined()
    expect(Date.parse(renewed.phoneExpiresAt)).toBe(f.repository.now + RELAY_MAX_AGE_MS)
    expect(f.repository.devices.get(`${OWNER}/${PAIR}`)?.phoneSeq).toBe(1)
    expect((await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.deviceToken, false)).status).toBe(200)
    expect((await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.phoneToken, false)).status).toBe(401)
    expect((await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, renewed.phoneToken, false)).status).toBe(200)
  })
  it('ersetzt bei neuer Provision alte Token und Ciphertexte ohne Sequenzrücksetzung', async () => {
    const f = fixture(), old = await f.provision()
    await f.invoke(put(), old.phoneToken, false)
    const next = await f.provision()
    expect(next.phoneToken).not.toBe(old.phoneToken)
    expect(f.repository.rows).toEqual([])
    expect(f.repository.devices.get(`${OWNER}/${PAIR}`)?.phoneSeq).toBe(1)
    expect((await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, old.deviceToken, false)).status).toBe(401)
  })
  it('überträgt identische vorhandene AEAD-v3-Umschläge in beiden Richtungen; Klartext bleibt allein an Endpunkten', async () => {
    const f = fixture(), t = await f.provision(), phoneKey = crypto.getRandomValues(new Uint8Array(32)), pcKey = crypto.getRandomValues(new Uint8Array(32))
    const sealed = await sealPcPayload(subtle, phoneKey, { pair: PAIR, from: 'phone', seq: 1, sentAt: new Date(START).toISOString() }, { type: 'pull', after: 0 })
    expect((await f.invoke(put(sealed), t.phoneToken, false)).status).toBe(200)
    const pcResponse = await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.deviceToken, false)
    const pcInbox = await pcResponse.json() as { envelopes: RelayEnvelope[] }
    expect(pcInbox.envelopes).toEqual([sealed])
    expect((await openPcEnvelope(subtle, phoneKey, pcInbox.envelopes[0], { pair: PAIR, from: 'phone', lastSequence: 0 })).payload).toEqual({ type: 'pull', after: 0 })
    const reply = await sealPcPayload(subtle, pcKey, { pair: PAIR, from: 'pc', seq: 2, sentAt: new Date(START).toISOString() }, { type: 'events', items: [], lastSeq: 0 })
    expect((await f.invoke(put(reply), t.deviceToken, false)).status).toBe(200)
    const phoneInbox = await (await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.phoneToken, false)).json() as { envelopes: RelayEnvelope[] }
    expect((await openPcEnvelope(subtle, pcKey, phoneInbox.envelopes[0], { pair: PAIR, from: 'pc', lastSequence: 0 })).payload).toEqual({ type: 'events', items: [], lastSeq: 0 })
    expect(JSON.stringify(f.repository.rows)).not.toContain('"type":"pull"')
    expect(JSON.stringify(f.repository.rows)).not.toContain('"type":"events"')
    await expect(openPcEnvelope(subtle, pcKey, phoneInbox.envelopes[0], { pair: PAIR, from: 'pc', lastSequence: 2 })).rejects.toThrow('PC_LINK_REPLAY_OR_IDENTITY')
  })
  it('behandelt exakt denselben Ciphertext idempotent, verweigert Konflikte und alte Sequenzen', async () => {
    const f = fixture(), t = await f.provision()
    expect((await f.invoke(put(), t.phoneToken, false)).status).toBe(200)
    expect((await f.invoke(put(), t.phoneToken, false)).status).toBe(200)
    expect((await f.invoke(put({ ...frame(), nonce: 'BBBBBBBBBBBBBBBB' }), t.phoneToken, false)).status).toBe(409)
    expect((await f.invoke(put(frame('phone', 4)), t.phoneToken, false)).status).toBe(200)
    expect((await f.invoke(put(frame('phone', 3)), t.phoneToken, false)).status).toBe(409)
    expect(f.repository.rows).toHaveLength(2)
  })
  it('liefert höchstens acht aufsteigende Frames nach dem echten Cursor und nur die Gegenrichtung', async () => {
    const f = fixture(), t = await f.provision()
    for (let seq = 1; seq <= 12; seq++) await f.invoke(put(frame('phone', seq)), t.phoneToken, false)
    const first = await (await f.invoke({ operation: 'get', pair: PAIR, after: 2 }, t.deviceToken, false)).json() as { envelopes: RelayEnvelope[] }
    expect(first.envelopes.map(e => e.seq)).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
    expect(await (await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.phoneToken, false)).json()).toEqual({ ok: true, envelopes: [] })
  })
  it('begrenzt Aufbewahrung auf14Tage und gibt abgelaufene Einträge nicht zurück', async () => {
    const f = fixture(), t = await f.provision()
    for (const expiry of [START, START - 1, START + RELAY_MAX_AGE_MS + 1]) expect((await f.invoke(put(frame(), new Date(expiry).toISOString()), t.phoneToken, false)).status).toBe(400)
    expect((await f.invoke(put(frame(), new Date(START + 1000).toISOString()), t.phoneToken, false)).status).toBe(200)
    f.repository.now += 1001
    expect(await (await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.deviceToken, false)).json()).toEqual({ ok: true, envelopes: [] })
  })
  it('verwirft Bool-/unsaubere Sequenzen, falsches Paar, Feldzusätze, Zeitreisen und ungültige Kryptogrammformen', async () => {
    const f = fixture(), t = await f.provision()
    for (const changed of [{ seq: true }, { seq: 0 }, { seq: 1.5 }, { seq: Number.MAX_SAFE_INTEGER + 1 }, { pair: 'other' }, { v: 2 }, { secret: 'no' }, { nonce: 'a' }, { ct: 'A' }, { ct: 'AAAAAAAAAAAAAAAAAAAAAB' }, { sentAt: new Date(START + 120001).toISOString() }, { sentAt: new Date(START - RELAY_MAX_AGE_MS - 1).toISOString() }]) expect((await f.invoke(put({ ...frame(), ...changed } as RelayEnvelope), t.phoneToken, false)).status).toBe(400)
    for (const after of [true, -1, 0.1, Number.MAX_SAFE_INTEGER + 1]) expect((await f.invoke({ operation: 'get', pair: PAIR, after }, t.deviceToken, false)).status).toBe(400)
    expect(f.repository.rows).toEqual([])
  })
  it('verweigert Browser-Origin, falsche Methode und Content-Type ohne Zugangsdaten weiterzureichen', async () => {
    const f = fixture()
    expect((await f.handler(new Request('https://synthetic.invalid', { method: 'GET' }))).status).toBe(405)
    expect((await f.invoke({ operation: 'provision', pair: PAIR }, JWT, true, { origin: 'https://attacker.invalid' })).status).toBe(403)
    expect((await f.invoke({}, JWT, true, { 'content-type': 'text/plain' })).status).toBe(415)
    expect(f.authenticate).not.toHaveBeenCalled()
  })
  it('begrenzt den echten Requeststream und redigiert Parser-/Datenbankfehler', async () => {
    const f = fixture()
    const malformed = new Request('https://synthetic.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })
    expect((await f.handler(malformed)).status).toBe(400)
    expect((await f.invoke({ data: 'x'.repeat(70_000) })).status).toBe(413)
    f.repository.provision = async () => { throw new Error(`private ${JWT}`) }
    const response = await f.invoke({ operation: 'provision', pair: PAIR })
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('{"error":"unavailable"}')
  })
  it('verwirft eine unplausible oder fremde Datenbankseite statt sie als neuen Empfang auszugeben', async () => {
    const f = fixture(), t = await f.provision()
    for (const page of [[frame('pc')], [frame('phone'), frame('phone')], Array.from({ length: 9 }, (_, i) => frame('phone', i + 1))]) {
      f.repository.get = async () => ({ ok: true, envelopes: page })
      const response = await f.invoke({ operation: 'get', pair: PAIR, after: 0 }, t.deviceToken, false)
      expect(response.status).toBe(503)
    }
  })
})

describe('Relaymetadaten verändern den bestehenden v3-Vertrag nicht', () => {
  it('weist kalenderungültige oder zonenlose Zeitpunkte statt stiller Normalisierung zurück', () => {
    for (const value of ['2026-02-30T12:00:00Z', '2026-11-12T24:00:00Z', '2026-11-12T23:59:60Z', '2026-11-12T21:00:00', null, true]) expect(relayTimestamp(value)).toBeNull()
    expect(relayTimestamp('2026-11-12T22:00:00+01:00')).toBe(START)
  })
  it('prüft lediglich Hülle/Metadaten; Authentizität bleibt beim bestehenden AEAD-Empfänger', () => {
    expect(relayEnvelope(frame(), PAIR, 'phone', START)).toEqual(frame())
    expect(relayEnvelope({ ...frame(), ct: 'A'.repeat(90_000) }, PAIR, 'phone', START)).toBeNull()
  })
})
