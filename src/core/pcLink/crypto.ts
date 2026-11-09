import type { PcEnvelope, PcLinkPayload } from './types'
import { base64UrlBytes, bytesBase64Url, parsePcEnvelope, parsePcPayload } from './validation'

const encoder = new TextEncoder()
const buffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer

/** RFC-independent canonical object format used for the six authenticated header fields. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}
export function envelopeAad(value: Omit<PcEnvelope, 'nonce' | 'ct'>): Uint8Array {
  const { v, kind, pair, from, seq, sentAt } = value
  return encoder.encode(canonicalJson({ v, kind, pair, from, seq, sentAt }))
}
export async function derivePcKeys(subtle: SubtleCrypto, privateKey: CryptoKey, peerPublic: Uint8Array, salt: Uint8Array): Promise<{ phoneToPc: Uint8Array; pcToPhone: Uint8Array }> {
  if (salt.length !== 32 || peerPublic.length !== 65 || peerPublic[0] !== 4) throw new Error('PC_LINK_KEY_INVALID')
  const peer = await subtle.importKey('raw', buffer(peerPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = await subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256)
  const source = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits'])
  const direction = async (info: string) => new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buffer(salt), info: buffer(encoder.encode(info)) }, source, 256))
  return { phoneToPc: await direction('anker-link v3 phone->pc'), pcToPhone: await direction('anker-link v3 pc->phone') }
}

/** Pure transport reference. Runtime native transport owns durable sequence reservation. */
export async function sealPcPayload(subtle: SubtleCrypto, keyBytes: Uint8Array, header: Omit<PcEnvelope, 'v' | 'kind' | 'nonce' | 'ct'>, payload: PcLinkPayload, nonce: Uint8Array = crypto.getRandomValues(new Uint8Array(12))): Promise<PcEnvelope> {
  parsePcPayload(payload)
  if (keyBytes.length !== 32 || nonce.length !== 12) throw new Error('PC_LINK_KEY_INVALID')
  const aad = { v: 3 as const, kind: 'anker-link' as const, ...header }
  // Validate the header before encrypting, without allocating a real message or reserving counters here.
  parsePcEnvelope({ ...aad, nonce: bytesBase64Url(nonce), ct: bytesBase64Url(new Uint8Array(16)) })
  const key = await subtle.importKey('raw', buffer(keyBytes), 'AES-GCM', false, ['encrypt'])
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv: buffer(nonce), additionalData: buffer(envelopeAad(aad)), tagLength: 128 }, key, buffer(encoder.encode(JSON.stringify(payload))))
  return parsePcEnvelope({ ...aad, nonce: bytesBase64Url(nonce), ct: bytesBase64Url(new Uint8Array(ciphertext)) })
}
export async function openPcEnvelope(subtle: SubtleCrypto, keyBytes: Uint8Array, raw: unknown, expected: { pair: string; from: PcEnvelope['from']; lastSequence: number }): Promise<{ envelope: PcEnvelope; payload: PcLinkPayload }> {
  const envelope = parsePcEnvelope(raw)
  if (envelope.pair !== expected.pair || envelope.from !== expected.from || envelope.seq <= expected.lastSequence || keyBytes.length !== 32) throw new Error('PC_LINK_REPLAY_OR_IDENTITY')
  try {
    const key = await subtle.importKey('raw', buffer(keyBytes), 'AES-GCM', false, ['decrypt'])
    const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv: buffer(base64UrlBytes(envelope.nonce)), additionalData: buffer(envelopeAad(envelope)), tagLength: 128 }, key, buffer(base64UrlBytes(envelope.ct)))
    return { envelope, payload: parsePcPayload(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext))) }
  } catch { throw new Error('PC_LINK_AUTHENTICATION_FAILED') }
}
