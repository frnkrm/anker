export const NFC_TARGETS = {
  now: { label: 'Jetzt', route: '/' },
  prep: { label: 'Vorbereitung', route: '/vorbereitung' },
  recover: { label: 'Wiedereinstieg', route: '/wiedereinstieg' },
} as const
export type NfcTarget = keyof typeof NFC_TARGETS
export const NFC_WINDOW_MS = 30_000
export type NfcAvailability = 'ready' | 'unsupported' | 'disabled' | 'blocked' | 'unavailable'
export interface NfcStatus { status: NfcAvailability; canOpen: boolean }
export type NfcScanResult = { status: 'read'; target: NfcTarget } | { status: 'cancelled' | 'timeout' | 'invalid' | 'busy' | Exclude<NfcAvailability, 'ready'> }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key))
export const isNfcTarget = (value: unknown): value is NfcTarget => typeof value === 'string' && Object.hasOwn(NFC_TARGETS, value)

/** Nur bekannte neutrale Felder weiterreichen, keine native Rohantwort in UI/Logs speichern. */
export function nfcStatusResult(value: unknown): NfcStatus {
  if (object(value) && keys(value, ['status', 'canOpen']) && typeof value.canOpen === 'boolean'
    && ['ready', 'unsupported', 'disabled', 'blocked', 'unavailable'].includes(String(value.status))) {
    return { status: value.status as NfcAvailability, canOpen: value.canOpen && value.status !== 'blocked' }
  }
  return { status: 'unavailable', canOpen: false }
}
export function nfcScanResult(value: unknown): NfcScanResult {
  if (object(value) && keys(value, ['status', 'target']) && value.status === 'read' && isNfcTarget(value.target)) return { status: 'read', target: value.target }
  if (object(value) && keys(value, ['status']) && ['cancelled', 'timeout', 'invalid', 'busy', 'unsupported', 'disabled', 'blocked', 'unavailable'].includes(String(value.status))) return { status: value.status as Exclude<NfcScanResult['status'], 'read'> }
  return { status: 'unavailable' }
}
export function nfcConfirmation(value: unknown): boolean {
  return object(value) && keys(value, ['allowed']) && value.allowed === true
}
