import { nfcConfirmation, nfcScanResult, nfcStatusResult, type NfcScanResult, type NfcStatus, type NfcTarget } from '../core/nfc'
import { AnkerNative, isNative } from './native'

export async function nfcStatus(): Promise<NfcStatus> {
  if (!isNative()) return { status: 'unsupported', canOpen: true }
  try { return nfcStatusResult(await AnkerNative.getNfcStatus()) }
  catch { return { status: 'unavailable', canOpen: false } }
}
export async function readNfcAnchor(sessionId: string): Promise<NfcScanResult> {
  if (!isNative()) return { status: 'unsupported' }
  try { return nfcScanResult(await AnkerNative.scanNfcAnchor({ sessionId })) }
  catch { return { status: 'unavailable' } }
}
export async function cancelNfcAnchor(sessionId: string): Promise<void> {
  if (isNative()) { try { await AnkerNative.cancelNfcScan({ sessionId }) } catch { /* Keine Rohfehler oder Tagdaten ausgeben. */ } }
}
export async function confirmNfcAnchor(sessionId: string, target: NfcTarget): Promise<boolean> {
  if (!isNative()) return false
  try { return nfcConfirmation(await AnkerNative.confirmNfcAnchor({ sessionId, target })) }
  catch { return false }
}
