import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { base64UrlBytes, bytesBase64Url, derivePcKeys, envelopeAad, openPcEnvelope, parsePairingCode, parsePcEnvelope, parsePcPayload, pcInstant, pcTextPreview, privatePcAddress, sealPcPayload } from './index'
import type { PcEnvelope } from './types'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v3-crypto.json', import.meta.url), 'utf8')) as {
  phonePrivateScalarHex: string; phonePublic: string; pcPublic: string; salt: string; phoneToPcKey: string; pcToPhoneKey: string; aadUtf8: string; envelope: PcEnvelope
}
const subtle = webcrypto.subtle as SubtleCrypto
const hex = (value: string) => Uint8Array.from(value.match(/../g)!, byte => parseInt(byte, 16))

describe('PC-Protokoll v3: deterministische sprachübergreifende Kryptofikstur', () => {
  it('leitet getrennte Richtungsschlüssel mit P-256/HKDF ab und reproduziert AES-GCM exakt', async () => {
    const pub = base64UrlBytes(fixture.phonePublic)
    const privateKey = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: bytesBase64Url(hex(fixture.phonePrivateScalarHex)), x: bytesBase64Url(pub.slice(1, 33)), y: bytesBase64Url(pub.slice(33)) }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
    const keys = await derivePcKeys(subtle, privateKey, base64UrlBytes(fixture.pcPublic), base64UrlBytes(fixture.salt))
    expect(bytesBase64Url(keys.phoneToPc)).toBe(fixture.phoneToPcKey)
    expect(bytesBase64Url(keys.pcToPhone)).toBe(fixture.pcToPhoneKey)
    expect(new TextDecoder().decode(envelopeAad(fixture.envelope))).toBe(fixture.aadUtf8)
    const { pair, from, seq, sentAt } = fixture.envelope
    const sealed = await sealPcPayload(subtle, keys.phoneToPc, { pair, from, seq, sentAt }, { type: 'pull', after: 0 }, base64UrlBytes(fixture.envelope.nonce))
    expect(sealed).toEqual(fixture.envelope)
    expect((await openPcEnvelope(subtle, keys.phoneToPc, sealed, { pair, from, lastSequence: 0 })).payload).toEqual({ type: 'pull', after: 0 })
  })
  it('verwirft Wiederholung, Richtung, Kopplung, falschen Schlüssel und manipulierte authentisierte Header', async () => {
    const key = base64UrlBytes(fixture.phoneToPcKey)
    const expected = { pair: fixture.envelope.pair, from: 'phone' as const, lastSequence: 0 }
    for (const identity of [{ ...expected, lastSequence: 1 }, { ...expected, from: 'pc' as const }, { ...expected, pair: 'other' }]) await expect(openPcEnvelope(subtle, key, fixture.envelope, identity)).rejects.toThrow('PC_LINK_REPLAY_OR_IDENTITY')
    await expect(openPcEnvelope(subtle, base64UrlBytes(fixture.pcToPhoneKey), fixture.envelope, expected)).rejects.toThrow('PC_LINK_AUTHENTICATION_FAILED')
    for (const changed of [{ ...fixture.envelope, seq: 2 }, { ...fixture.envelope, sentAt: '2026-11-12T21:00:01.000Z' }, { ...fixture.envelope, ct: `B${fixture.envelope.ct.slice(1)}` }]) await expect(openPcEnvelope(subtle, key, changed, expected)).rejects.toThrow('PC_LINK_AUTHENTICATION_FAILED')
  })
  it('weist kaputte Schlüssel, Nonces, unbekannte Felder und große Nachrichten ab', async () => {
    await expect(sealPcPayload(subtle, new Uint8Array(31), { pair: 'p', from: 'phone', seq: 1, sentAt: fixture.envelope.sentAt }, { type: 'pull', after: 0 })).rejects.toThrow('PC_LINK_KEY_INVALID')
    expect(() => parsePcEnvelope({ ...fixture.envelope, nonce: 'AAAA' })).toThrow('PC_LINK_INVALID')
    expect(() => parsePcEnvelope({ ...fixture.envelope, secret: 'no' })).toThrow('PC_LINK_INVALID')
    expect(() => parsePcEnvelope({ ...fixture.envelope, ct: 'a'.repeat(90000) })).toThrow('PC_LINK_INVALID')
  })
})

describe('PC-Datengrenze', () => {
  it('bewahrt alte Verlängerungen und bindet die neue Bettzeit nur an ausdrückliche Erweiterungsereignisse', () => {
    const event = { id: 'extension', seq: 1, at: fixture.envelope.sentAt, date: '2026-11-12', kind: 'extended', newStopAt: '2026-11-12T23:15:00Z' }
    const message = (value: unknown) => ({ type: 'events', lastSeq: 1, items: [value] })
    expect(() => parsePcPayload(message(event))).not.toThrow()
    for (const anchor of ['bed', 'pc-stop']) expect(() => parsePcPayload(message({ ...event, anchor }))).not.toThrow()
    expect(() => parsePcPayload(message({ ...event, anchor: 'unknown' }))).toThrow('PC_LINK_INVALID')
    expect(() => parsePcPayload(message({ ...event, kind: 'pc-rest', anchor: 'bed' }))).toThrow('PC_LINK_INVALID')
  })
  it.each(['2026-02-30T12:00:00Z', '2026-11-12T24:00:00Z', '2026-11-12T23:60:00Z', '2026-11-12T23:59:60Z', '2026-11-12T23:59:00+24:00', '2026-11-12T23:59:00+01:60', '2026-11-12 12:00:00', '2026-11-12T12:00:00'])('weist ungültigen Zeitpunkt zurück: %s', value => expect(pcInstant(value)).toBe(false))
  it.each(['2026-11-12T23:59:59Z', '2026-11-12T23:59:59.123+01:00'])('akzeptiert eindeutigen ISO-Zeitpunkt %s', value => expect(pcInstant(value)).toBe(true))
  it('schneidet Emoji nie entzwei und übernimmt keine Steuerzeichen', () => {
    const text = `${'a'.repeat(499)}🌅x`
    expect(pcTextPreview(text)).toBe('a'.repeat(499))
    expect(pcTextPreview(`${'a'.repeat(498)}🌅x`)).toBe(`${'a'.repeat(498)}🌅`)
    expect(pcTextPreview('A\u0000\ud800B')).toBe('AB')
    const message = (count: number) => ({ type: 'events', lastSeq: 1, items: [{ id: 'a', seq: 1, at: fixture.envelope.sentAt, date: '2026-11-12', kind: 'thought', text: '🌅'.repeat(count) }] })
    expect(() => parsePcPayload(message(250))).not.toThrow()
    expect(() => parsePcPayload(message(251))).toThrow('PC_LINK_INVALID')
  })
  it('vertraut nur ablaufendem QR-Pin und privaten gültigen LAN-Adressen', () => {
    for (const value of ['192.168.1.2:8765', '10.0.0.1:443', '[fd00::1]:8765', '[fe80::123]:8765', '[::1]:8765']) expect(privatePcAddress(value), value).toBe(true)
    for (const value of ['8.8.8.8:8765', '192.168.999.1:1', '012.1.2.3:1', '[fd::::1]:2', '[2001:4860::1]:8765', 'localhost:8765', '127.0.0.1:0']) expect(privatePcAddress(value), value).toBe(false)
    const now = Date.parse(fixture.envelope.sentAt)
    const data = { t: 'anker-pc-pair', v: 3, id: 'p', n: 'Mein PC', k: fixture.pcPublic, c: 'a'.repeat(64), s: fixture.salt, a: ['192.168.1.2:8765'], e: new Date(now + 300_000).toISOString() }
    const code = (obj: unknown) => `anker-pc-pair:v3:${bytesBase64Url(new TextEncoder().encode(JSON.stringify(obj)))}`
    expect(parsePairingCode(code(data), now)).toEqual(data)
    expect(() => parsePairingCode(code({ ...data, e: fixture.envelope.sentAt }), now)).toThrow()
    expect(() => parsePairingCode(code({ ...data, a: ['8.8.8.8:443'] }), now)).toThrow()
    expect(() => parsePairingCode(code({ ...data, unknown: true }), now)).toThrow()
  })
})
