import type { PcAck, PcBridgeLocal, PcLinkStatus, PcStatePayload } from './types'
import { isPcAck } from './validation'

/** Stored or queued is never receipt. Only the matching authenticated ACK is confirmation. */
export function matchingPcAck(value: unknown, wanted: Pick<PcStatePayload, 'revision' | 'date' | 'generatedAt' | 'validUntil'>, nowMs: number): value is PcAck {
  return isPcAck(value) && value.revision === wanted.revision && value.effective.date === wanted.date && Date.parse(value.receivedAt) >= Date.parse(wanted.generatedAt) - 120000 && Date.parse(value.receivedAt) <= nowMs + 120000 && Date.parse(wanted.validUntil) > nowMs
}
export function pcConnectionStatus(input: { nativeState: string; connected: boolean; ack?: unknown; wanted: PcStatePayload; nowMs: number }): PcLinkStatus {
  if (input.nativeState === 'unpaired') return 'unpaired'
  if (input.nativeState === 'rejected') return 'rejected'
  if (input.nativeState === 'companion-outdated') return 'companion-outdated'
  if (!input.connected) return 'unreachable'
  return matchingPcAck(input.ack, input.wanted, input.nowMs) ? 'confirmed' : 'paired-never-reached'
}
export function pcConnectionText(local: PcBridgeLocal): string {
  switch (local.status) {
    case 'unpaired': return 'Noch kein PC gekoppelt.'
    case 'paired-never-reached': return 'Gekoppelt. Der aktuelle Plan wurde vom PC noch nicht bestätigt.'
    case 'confirmed': return local.ack?.warnings.includes('legacy-conflict') ? 'Vom PC bestätigt. Das klassische Paket ist noch aktiv; der Begleiter führt keine Sperre aus.' : 'Der aktuelle Plan wurde vom PC bestätigt.'
    case 'rejected': return 'Der PC hat die Verbindung abgelehnt. Prüfe die Kopplung.'
    case 'companion-outdated': return 'Der PC-Begleiter braucht eine passende Version.'
    case 'unreachable': return local.ack ? 'PC gerade nicht erreichbar. Die letzte Bestätigung bleibt unten sichtbar.' : 'PC gerade nicht erreichbar. Der aktuelle Plan ist nicht bestätigt.'
  }
}
