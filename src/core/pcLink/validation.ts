import { PC_ACK_WARNINGS, PC_EVENT_KINDS, type PcAck, type PcBridgeLocal, type PcEnvelope, type PcLinkEvent, type PcLinkPayload, type PcPairingCode } from './types'

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const keys = (v: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => required.every((k) => Object.hasOwn(v, k)) && Object.keys(v).every((k) => required.includes(k) || optional.includes(k))
const text = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length <= max && [...v].every(c => {
  const code = c.codePointAt(0)!
  return (code > 31 || code === 9 || code === 10 || code === 13) && (code < 0xd800 || code > 0xdfff)
})
/** The shared limit counts UTF-16 units, while truncation keeps each scalar whole. */
export function pcTextPreview(value: string, max = 500): string {
  let result = ''
  for (const character of value) {
    if (!text(character, 2)) continue
    if (result.length + character.length > max) break
    result += character
  }
  return result
}
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(v)
const bool = (v: unknown): v is boolean => typeof v === 'boolean'
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const one = (v: unknown, list: readonly unknown[]): boolean => list.includes(v)
const optional = (v: Record<string, unknown>, k: string, test: (v: unknown) => boolean): boolean => v[k] === undefined || test(v[k])
export const pcDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v
export const pcInstant = (v: unknown): v is string => {
  if (typeof v !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(v)
  return !!match && pcDate(match[1]) && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59
    && (match[5] === undefined || Number(match[5]) <= 23 && Number(match[6]) <= 59) && Number.isFinite(Date.parse(v))
}
const nullableInstant = (v: unknown): boolean => v === null || pcInstant(v)
const b64 = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]+$/.test(v) && v.length % 4 !== 1

export class PcLinkValidationError extends Error { constructor() { super('PC_LINK_INVALID'); this.name = 'PcLinkValidationError' } }
function ensure(v: unknown): asserts v { if (!v) throw new PcLinkValidationError() }
export function base64UrlBytes(value: string): Uint8Array {
  ensure(b64(value))
  try { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), (c) => c.charCodeAt(0)) }
  catch { throw new PcLinkValidationError() }
}
export function bytesBase64Url(value: Uint8Array): string { return btoa(Array.from(value, (v) => String.fromCharCode(v)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }

function preferences(v: unknown): boolean {
  return record(v) && keys(v, ['enforceEnabled', 'strictLock', 'dimEnabled', 'dimMax', 'audioDuck', 'shareBrainDump', 'morningCountdown', 'offlinePolicy', 'stopAction', 'graceSeconds'], ['ifThen', 'bedtimeSequence'])
    && ['enforceEnabled', 'strictLock', 'dimEnabled', 'audioDuck', 'shareBrainDump', 'morningCountdown'].every((k) => bool(v[k]))
    && typeof v.dimMax === 'number' && Number.isFinite(v.dimMax) && v.dimMax >= 0 && v.dimMax <= 0.4
    && one(v.offlinePolicy, ['pause', 'fixed-time']) && one(v.stopAction, ['lock', 'hibernate', 'shutdown']) && integer(v.graceSeconds, 60, 600)
    && optional(v, 'ifThen', (s) => text(s)) && optional(v, 'bedtimeSequence', bool)
}
export function isPcAck(v: unknown): v is PcAck {
  return record(v) && keys(v, ['type', 'revision', 'receivedAt', 'effective', 'companion', 'warnings'], ['commandId', 'emergencyUntil']) && v.type === 'ack' && id(v.revision) && pcInstant(v.receivedAt)
    && record(v.effective) && keys(v.effective, ['date', 'mode'], ['stopAt']) && pcDate(v.effective.date) && one(v.effective.mode, ['scheduled', 'paused', 'suspended-today', 'legacy-conflict', 'locked', 'released']) && optional(v.effective, 'stopAt', pcInstant)
    && record(v.companion) && keys(v.companion, ['version', 'protocol']) && text(v.companion.version, 40) && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(String(v.companion.version)) && v.companion.protocol === 3
    && optional(v, 'commandId', id) && optional(v, 'emergencyUntil', pcInstant)
    && Array.isArray(v.warnings) && v.warnings.length <= PC_ACK_WARNINGS.length && v.warnings.every((w) => one(w, PC_ACK_WARNINGS))
}
export function isPcLinkEvent(v: unknown): v is PcLinkEvent {
  if (!record(v) || !keys(v, ['id', 'seq', 'at', 'date', 'kind'], ['basis', 'newStopAt', 'text', 'nextStep', 'anchor']) || !id(v.id) || !integer(v.seq, 1) || !pcInstant(v.at) || !pcDate(v.date) || !one(v.kind, PC_EVENT_KINDS)) return false
  if (!optional(v, 'basis', (s) => one(s, ['anker-shutdown', 'user-shutdown', 'sleep', 'lock', 'logoff', 'idle'])) || !optional(v, 'newStopAt', pcInstant) || !optional(v, 'text', text) || !optional(v, 'nextStep', text)) return false
  return optional(v, 'anchor', value => v.kind === 'extended' && one(value, ['bed', 'pc-stop']))
    && (v.kind !== 'extended' || pcInstant(v.newStopAt)) && (!one(v.kind, ['save-point', 'thought']) || typeof v.text === 'string' && !!v.text.trim())
}
/** This container is deliberately incapable of holding a native key, pin or pairing code. */
export function validPcBridgeLocal(v: unknown): v is PcBridgeLocal {
  if (!record(v) || !keys(v, ['enabled', 'preferences', 'automaticRestEvents', 'status', 'events', 'receipts', 'cursor'], ['pcName', 'wantedRevision', 'ack', 'lastAttemptAt', 'wakeOnLan'])
    || !bool(v.enabled) || !bool(v.automaticRestEvents) || !one(v.status, ['unpaired', 'paired-never-reached', 'confirmed', 'unreachable', 'rejected', 'companion-outdated']) || !integer(v.cursor)) return false
  const p = v.preferences
  if (!record(p) || !preferences({ enforceEnabled: false, ...p, strictLock: false })) return false
  if (!keys(p, ['dimEnabled', 'dimMax', 'audioDuck', 'shareBrainDump', 'morningCountdown', 'offlinePolicy', 'stopAction', 'graceSeconds'], ['enforceEnabled'])) return false
  return optional(v, 'pcName', name => text(name, 100)) && optional(v, 'wantedRevision', id) && optional(v, 'ack', isPcAck)
    && optional(v, 'lastAttemptAt', n => integer(n, 0, 8.64e15)) && Array.isArray(v.events) && v.events.length <= 256 && v.events.every(isPcLinkEvent)
    && Array.isArray(v.receipts) && v.receipts.length <= 512 && v.receipts.every(id) && new Set(v.receipts).size === v.receipts.length
    && optional(v, 'wakeOnLan', wol => record(wol) && keys(wol, ['enabled', 'mac', 'broadcast'], ['lastMorning']) && bool(wol.enabled)
      && typeof wol.mac === 'string' && /^(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/.test(wol.mac)
      && typeof wol.broadcast === 'string' && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(wol.broadcast) && wol.broadcast.split('.').every(octet => integer(Number(octet), 0, 255)) && optional(wol, 'lastMorning', pcDate))
}
export function parsePcEnvelope(v: unknown): PcEnvelope {
  ensure(record(v) && keys(v, ['v', 'kind', 'pair', 'from', 'seq', 'sentAt', 'nonce', 'ct']))
  ensure(v.v === 3 && v.kind === 'anker-link' && id(v.pair) && one(v.from, ['phone', 'pc']) && integer(v.seq, 1) && pcInstant(v.sentAt))
  ensure(b64(v.nonce) && v.nonce.length === 16 && base64UrlBytes(v.nonce).length === 12 && b64(v.ct) && v.ct.length <= 87384 && base64UrlBytes(v.ct).length >= 16)
  ensure(new TextEncoder().encode(JSON.stringify(v)).length <= 65536)
  return v as unknown as PcEnvelope
}
export function validatePcPayload(v: unknown): v is PcLinkPayload {
  if (!record(v)) return false
  if (v.type === 'ack') return isPcAck(v)
  if (v.type === 'pull') return keys(v, ['type', 'after']) && integer(v.after)
  if (v.type === 'events') return keys(v, ['type', 'items', 'lastSeq']) && Array.isArray(v.items) && v.items.length <= 100 && v.items.every(isPcLinkEvent) && integer(v.lastSeq) && v.items.every((e, index, items) => e.seq <= Number(v.lastSeq) && (index === 0 || e.seq > items[index - 1]!.seq)) && new Set(v.items.map(e => e.id)).size === v.items.length
  if (v.type === 'command') {
    if (!keys(v, ['type', 'id', 'action'], ['minutes', 'token']) || !id(v.id) || !one(v.action, ['ping', 'unpair', 'test-evening', 'resume-today', 'suspend-today', 'extend', 'EMERGENCY_EXTENSION']) || !optional(v, 'minutes', (n) => integer(n, 1, 1440))) return false
    if (v.action !== 'EMERGENCY_EXTENSION') return v.token === undefined
    const t = v.token
    return record(t) && keys(t, ['v', 'pair', 'sessionId', 'date', 'issuedAt', 'expiresAt', 'until', 'nonce', 'signature']) && t.v === 3 && id(t.pair) && id(t.sessionId) && pcDate(t.date) && pcInstant(t.issuedAt) && pcInstant(t.expiresAt) && pcInstant(t.until) && b64(t.nonce) && b64(t.signature)
      && Date.parse(t.expiresAt) > Date.parse(t.issuedAt) && Date.parse(t.expiresAt) - Date.parse(t.issuedAt) <= 300000 && Date.parse(t.until) > Date.parse(t.issuedAt) && Date.parse(t.until) - Date.parse(t.issuedAt) <= 7200000
  }
  if (v.type === 'briefing') {
    if (!keys(v, ['type', 'revision', 'generatedAt', 'validUntil', 'days', 'prefs']) || !id(v.revision) || !pcInstant(v.generatedAt) || !pcInstant(v.validUntil) || !preferences(v.prefs) || !Array.isArray(v.days) || v.days.length < 1 || v.days.length > 14) return false
    return v.days.every((d) => record(d) && keys(d, ['date', 'validUntil', 'pc'], ['bedAt', 'wakeAt', 'windDownAt', 'brainDumpAt', 'morningDeadlineAt', 'morning']) && pcDate(d.date) && pcInstant(d.validUntil)
      && record(d.pc) && keys(d.pc, ['mode'], ['stopAt', 'localTime']) && one(d.pc.mode, ['scheduled', 'paused']) && (d.pc.mode === 'paused' ? d.pc.stopAt === undefined && d.pc.localTime === undefined : pcInstant(d.pc.stopAt) && typeof d.pc.localTime === 'string' && /^\d{2}:\d{2}$/.test(d.pc.localTime))
      && ['bedAt', 'wakeAt', 'windDownAt', 'brainDumpAt', 'morningDeadlineAt'].every((k) => optional(d, k, pcInstant))
      && optional(d, 'morning', (m) => record(m) && keys(m, ['homeOffice'], ['leaveAt', 'workStartAt']) && bool(m.homeOffice) && optional(m, 'leaveAt', pcInstant) && optional(m, 'workStartAt', pcInstant)))
  }
  if (v.type !== 'state' || !keys(v, ['type', 'state', 'sessionId', 'revision', 'date', 'generatedAt', 'validUntil', 'remainingSeconds', 'routineStep', 'lockEnforced', 'schedule', 'prefs'], ['brainDump'])) return false
  if (!one(v.state, ['DAY_ACTIVE', 'IDLE', 'MORNING_PENDING', 'MORNING_ACTIVE', 'MORNING_COMPLETED', 'ALARM_RINGING', 'EVENING_WIND_DOWN', 'WIND_DOWN_T30', 'BRAIN_DUMP_T10', 'BEDTIME_HARD_CUT', 'NIGHT_LOCK', 'ZOMBIE_MODE']) || !id(v.sessionId) || !id(v.revision) || !pcDate(v.date) || !pcInstant(v.generatedAt) || !pcInstant(v.validUntil) || !integer(v.remainingSeconds, 0, 64800) || !bool(v.lockEnforced) || !preferences(v.prefs)) return false
  if (v.routineStep !== null && !(record(v.routineStep) && keys(v.routineStep, ['index', 'total']) && integer(v.routineStep.total, 1, 200) && integer(v.routineStep.index, 0, Number(v.routineStep.total) - 1))) return false
  const s = v.schedule
  if (!record(s) || !keys(s, ['windDownAt', 'brainDumpAt', 'bedAt', 'wakeAt', 'morningDeadlineAt'], ['pcStopAt', 'leaveAt', 'workStartAt', 'homeOffice']) || !['windDownAt', 'brainDumpAt', 'bedAt', 'wakeAt', 'morningDeadlineAt'].every((k) => nullableInstant(s[k])) || !['pcStopAt', 'leaveAt', 'workStartAt'].every((k) => optional(s, k, nullableInstant)) || !optional(s, 'homeOffice', bool)) return false
  if (Date.parse(v.validUntil) <= Date.parse(v.generatedAt) || Date.parse(v.validUntil) - Date.parse(v.generatedAt) > 18 * 3600000) return false
  if (typeof s.wakeAt === 'string' && typeof s.morningDeadlineAt === 'string' && (Date.parse(s.morningDeadlineAt) < Date.parse(s.wakeAt) || Date.parse(s.morningDeadlineAt) - Date.parse(s.wakeAt) > 3 * 3600000)) return false
  if (v.brainDump !== undefined && !(record(v.prefs) && v.prefs.shareBrainDump === true && record(v.brainDump) && keys(v.brainDump, ['text'], ['nextStep']) && text(v.brainDump.text) && optional(v.brainDump, 'nextStep', text))) return false
  return true
}
export function parsePcPayload(v: unknown): PcLinkPayload { ensure(validatePcPayload(v)); return v }

/** Local discovery never supplies trust. Only a separately verified pairing QR supplies the pin. */
export function privatePcAddress(value: string): boolean {
  const match = /^(\[[0-9a-fA-F:]+\]|(?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})$/.exec(value)
  if (!match || !integer(Number(match[2]), 1, 65535)) return false
  const host = match[1]!
  if (host.startsWith('[')) {
    try {
      const normalized = new URL(`https://${value}`).hostname.toLowerCase()
      return normalized === '[::1]' || /^\[(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/.test(normalized)
    } catch { return false }
  }
  const octets = host.split('.').map(Number)
  if (!octets.every((v) => integer(v, 0, 255))) return false
  if (octets.some((n, i) => String(n) !== host.split('.')[i])) return false
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31 || octets[0] === 169 && octets[1] === 254
}
export function parsePairingCode(raw: string, now = Date.now()): PcPairingCode {
  ensure(raw.length <= 8192)
  let value: unknown
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlBytes(raw.replace(/^anker-pc-pair:v3:/, '')))) } catch { throw new PcLinkValidationError() }
  ensure(record(value) && keys(value, ['t', 'v', 'id', 'n', 'k', 'c', 's', 'a', 'e']))
  ensure(value.t === 'anker-pc-pair' && value.v === 3 && id(value.id) && text(value.n, 100) && b64(value.k) && base64UrlBytes(value.k).length === 65 && base64UrlBytes(value.k)[0] === 4 && typeof value.c === 'string' && /^[a-fA-F0-9]{64}$/.test(value.c) && b64(value.s) && base64UrlBytes(value.s).length === 32)
  ensure(Array.isArray(value.a) && value.a.length >= 1 && value.a.length <= 8 && value.a.every((a) => typeof a === 'string' && privatePcAddress(a)))
  ensure(pcInstant(value.e) && Date.parse(value.e) > now && Date.parse(value.e) <= now + 10 * 60000)
  return value as unknown as PcPairingCode
}
