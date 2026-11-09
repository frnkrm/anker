import { coalesceAsync } from '../core/coalesced'
import { guidancePlanDate, guidancePreferences } from '../core/guidance'
import { buildPcBriefing, buildPcState, defaultPcBridgeLocal, isPcAck, isPcLinkEvent, parsePairingCode, parsePcPayload, pcConnectionStatus, pcConnectionText, type PcAck, type PcBridgeLocal, type PcCommandPayload, type PcEventsPayload, type PcLinkPreferences, type PcStatePayload } from '../core/pcLink'
import { addDays } from '../core/time'
import { planFor, today, useApp } from '../state/store'
import { AnkerNative, isNative } from './native'

export type PcBridgeConnectionState = 'unpaired' | 'pairing' | 'paired-never-reached' | 'connected' | 'unreachable' | 'rejected' | 'companion-outdated'
interface NativePcView {
  state: PcBridgeConnectionState
  connected: boolean
  active: boolean
  requestedActive?: boolean
  autoReconnect?: boolean
  pcName?: string
  code?: string
  ack?: unknown
  lastReceivedAt?: number
  error?: string
  emergencyAck?: { commandId: string; until: number; receivedAt: number }
}
export interface PcBridgeView extends Omit<NativePcView, 'ack'> { ack?: PcAck; currentConfirmation: boolean; confirmationText: string }

function localBridge(): PcBridgeLocal { return useApp.getState().local.pcBridge ?? defaultPcBridgeLocal() }
function preferences(local = localBridge()): PcLinkPreferences {
  const state = useApp.getState()
  const guidance = guidancePreferences(state.settings.guidance)
  const ifThen = state.local.guidance?.ifThen
  return { ...local.preferences, enforceEnabled: local.enabled && local.preferences.enforceEnabled, strictLock: guidance.enabled && guidance.pcLock, ...(ifThen?.showOnPc && ifThen.sentence.trim() ? { ifThen: ifThen.sentence } : {}) }
}

function snapshot(now = Date.now(), alarm?: { ringing: boolean; kind?: string | null }): PcStatePayload {
  const state = useApp.getState()
  const date = guidancePlanDate(state.local, today(), now)
  return buildPcState({ plan: planFor(date, state), nextPlan: planFor(addDays(date, 1), state), log: state.days[date], settings: state.settings, local: state.local, prefs: preferences(), nowMs: now, alarm })
}

function briefingFor(wanted: PcStatePayload) {
  const state = useApp.getState()
  return buildPcBriefing(Array.from({ length: 15 }, (_, index) => planFor(addDays(wanted.date, index), state)), state.settings, preferences(), Date.parse(wanted.generatedAt))
}

/** The preview uses the same builders and choices as actual delivery; it proves no receipt. */
export async function getPcBridgePreview() {
  const state = snapshot(Date.now(), isNative() ? await AnkerNative.getAlarmState() : undefined)
  return { state, briefing: briefingFor(state) }
}

export async function getPcBridgeView(): Promise<PcBridgeView> {
  if (!isNative()) return { state: 'unpaired', connected: false, active: false, currentConfirmation: false, confirmationText: 'Die lokale PC-Kopplung ist in der Android-App verfügbar.' }
  const native: NativePcView = await AnkerNative.pcBridgeGetState()
  const ack = isPcAck(native.ack) ? native.ack : undefined
  const state = useApp.getState()
  if (!state.ready) return { ...native, ack, currentConfirmation: false, confirmationText: 'Die App lädt deinen aktuellen Plan.' }
  const wanted = snapshot(Date.now(), await AnkerNative.getAlarmState())
  const status = pcConnectionStatus({ nativeState: native.state, connected: native.connected, ack: native.ack, wanted, nowMs: Date.now() })
  return { ...native, ack, currentConfirmation: localBridge().enabled && status === 'confirmed', confirmationText: pcConnectionText({ ...localBridge(), status, ack }) }
}

export async function discoverPcCompanions(): Promise<{ services: { name: string; host: string; port: number }[]; available: boolean }> {
  if (!isNative()) return { services: [], available: false }
  const result = await AnkerNative.pcBridgeDiscover({ timeoutMs: 2500 })
  return { services: result.devices.map(({ name, host, port }) => ({ name, host, port })), available: true }
}

let configured = ''
async function configureBridge(enabled: boolean): Promise<void> {
  const raw = useApp.getState().settings.alarm.qrSecret
  // Only the hash crosses this configuration boundary. The QR itself is submitted solely on a scan.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const qrHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const key = `${enabled}:${qrHash}`
  if (configured === key) return
  await AnkerNative.pcBridgeConfigure({ qrHash, autoReconnect: enabled })
  configured = key
}

export async function pairPcCompanion(qr: string): Promise<void> {
  if (!isNative()) throw new Error('Die PC-Kopplung ist auf Android verfügbar.')
  parsePairingCode(qr)
  await configureBridge(true)
  await AnkerNative.pcBridgePair({ qr, deviceName: 'Anker Android' })
  await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), enabled: true, status: 'paired-never-reached', events: [], receipts: [], cursor: 0, ack: undefined, wantedRevision: undefined } }))
  lastStateRevision = ''; lastBriefingRevision = ''
}

export async function startPcCompanion(): Promise<void> {
  if (!isNative()) throw new Error('Die lokale PC-Verbindung ist auf Android verfügbar.')
  await configureBridge(true)
  await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), enabled: true } }))
  await AnkerNative.pcBridgeStart()
  lastStateRevision = ''; lastBriefingRevision = ''
  await syncPcBridge()
}

export async function stopPcCompanion(): Promise<void> {
  await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), enabled: false } }))
  if (isNative()) { await configureBridge(false); await AnkerNative.pcBridgeStop() }
}

export async function unpairPcCompanion(): Promise<void> {
  if (isNative()) await AnkerNative.pcBridgeUnpair()
  await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), enabled: false, status: 'unpaired', ack: undefined, wantedRevision: undefined, pcName: undefined, events: [], receipts: [], cursor: 0 } }))
  configured = ''; lastStateRevision = ''; lastBriefingRevision = ''
}

export async function updatePcBridgePreferences(patch: Partial<PcLinkPreferences>): Promise<void> {
  const { strictLock, ifThen, ...localPatch } = patch
  if (strictLock !== undefined || ifThen !== undefined) throw new Error('Die strenge Nachtbegleitung wird in Abend & Morgen gewählt.')
  const candidate = { ...localBridge(), preferences: { ...localBridge().preferences, ...localPatch } }
  // Reuse the exact wire validator before persisting a setting; no relaxed UI-only schema.
  const state = snapshot()
  parsePcPayload({ ...state, prefs: { ...preferences(candidate), enforceEnabled: candidate.preferences.enforceEnabled } })
  await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), preferences: candidate.preferences } }))
  await syncPcBridge()
}

/** Receipt effects and the native outbox acknowledgement have deliberately separate commits. */
async function drainPcEvents(): Promise<void> {
  const pending = await AnkerNative.pcBridgeDrainEvents()
  if (!Array.isArray(pending.events) || pending.events.length > 1000 || !pending.events.every(isPcLinkEvent)) throw new Error('Die PC-Rückmeldung ist ungültig.')
  const events = pending.events.filter(isPcLinkEvent)
  for (let offset = 0; offset < events.length; offset += 100) {
    const items = events.slice(offset, offset + 100)
    const payload: PcEventsPayload = { type: 'events', items, lastSeq: Math.max(pending.lastSeq, ...items.map(item => item.seq)) }
    parsePcPayload(payload)
    const committed = await useApp.getState().applyPcEvents(payload)
    if (committed.appliedIds.length) await AnkerNative.pcBridgeAckEvents({ ids: committed.appliedIds })
  }
}

let lastStateRevision = ''
let lastBriefingRevision = ''
let lastStateSentAt = 0
let lastRemainingSeconds = -1
let disabled = false
let lastReconnectAt = 0

const reconcilePcBridge = coalesceAsync(async () => {
  if (!isNative() || !useApp.getState().ready || !useApp.getState().settings.onboarded) return
  // Apply offline PC actions before a fresh planner snapshot can overwrite their intent.
  await drainPcEvents()
  const local = localBridge()
  if (!local.enabled) {
    if (!disabled) { await configureBridge(false); await AnkerNative.pcBridgeStop(); disabled = true }
    return
  }
  disabled = false
  await configureBridge(true)
  let native: NativePcView = await AnkerNative.pcBridgeGetState()
  if (native.requestedActive && !native.active && Date.now() - lastReconnectAt >= 30000 && globalThis.document?.visibilityState === 'visible') {
    lastReconnectAt = Date.now()
    native = await AnkerNative.pcBridgeStart()
  }
  if (['unpaired', 'pairing', 'rejected', 'companion-outdated'].includes(native.state)) return
  const now = Date.now()
  const alarm = await AnkerNative.getAlarmState()
  const wanted = snapshot(now, alarm)
  const briefing = briefingFor(wanted)
  if (briefing.revision !== lastBriefingRevision) {
    const result = await AnkerNative.pcBridgeSend({ payload: briefing })
    if (result.sent) lastBriefingRevision = briefing.revision
  }
  const runningStepChanged = ['MORNING_ACTIVE', 'ZOMBIE_MODE'].includes(wanted.state) && wanted.remainingSeconds !== lastRemainingSeconds
  if (wanted.revision !== lastStateRevision || runningStepChanged || now - lastStateSentAt >= 25000) {
    const result = await AnkerNative.pcBridgeSend({ payload: wanted })
    if (result.sent) { lastStateRevision = wanted.revision; lastStateSentAt = now; lastRemainingSeconds = wanted.remainingSeconds }
  }
  native = await AnkerNative.pcBridgeGetState()
  const status = pcConnectionStatus({ nativeState: native.state, connected: native.connected, ack: native.ack, wanted, nowMs: Date.now() })
  const previous = localBridge()
  const ack = isPcAck(native.ack) ? native.ack : previous.ack
  const ackChanged = ack?.revision !== previous.ack?.revision || ack?.effective.mode !== previous.ack?.effective.mode || JSON.stringify(ack?.warnings) !== JSON.stringify(previous.ack?.warnings)
  if (previous.status !== status || previous.wantedRevision !== wanted.revision || previous.pcName !== native.pcName || ackChanged) {
    await useApp.getState().saveLocal(localData => ({ ...localData, pcBridge: { ...(localData.pcBridge ?? defaultPcBridgeLocal()), status, wantedRevision: wanted.revision, pcName: native.pcName, ack, lastAttemptAt: now } }))
  }
  // A genuine completion, not the clock or a skipped step, is the only WoL trigger.
  const wol = localBridge().wakeOnLan
  if (wanted.state === 'MORNING_COMPLETED' && wol?.enabled && wol.lastMorning !== wanted.date) {
    const sent = await AnkerNative.pcBridgeWakeOnLan({ mac: wol.mac, broadcast: wol.broadcast })
    if (sent.sent) await useApp.getState().saveLocal(localData => {
      const bridge = localData.pcBridge ?? defaultPcBridgeLocal()
      return { ...localData, pcBridge: { ...bridge, wakeOnLan: { ...wol, lastMorning: wanted.date } } }
    })
  }
})

export function syncPcBridge(): Promise<void> { return reconcilePcBridge() }
const waitTick = () => new Promise<void>(resolve => setTimeout(resolve, 150))

export async function sendPcBridgeCommand(action: PcCommandPayload['action'], minutes?: number): Promise<{ confirmed: boolean }> {
  if (!isNative() || !localBridge().enabled) throw new Error('Verbinde zuerst deinen PC.')
  if (action === 'EMERGENCY_EXTENSION') throw new Error('Eine Notverlängerung braucht den gescannten Anker-Code.')
  const id = crypto.randomUUID()
  const payload: PcCommandPayload = { type: 'command', id, action, ...(minutes === undefined ? {} : { minutes }) }
  parsePcPayload(payload)
  const result = await AnkerNative.pcBridgeSend({ payload })
  if (!result.sent) return { confirmed: false }
  const deadline = Date.now() + 4000
  do {
    const view = await AnkerNative.pcBridgeGetState()
    if (isPcAck(view.ack) && view.ack.commandId === id) { await syncPcBridge(); return { confirmed: true } }
    await waitTick()
  } while (Date.now() < deadline)
  return { confirmed: false }
}

export async function requestPcEmergencyExtension(qr: string, minutes: number): Promise<boolean> {
  if (!isNative() || !localBridge().enabled) return false
  await syncPcBridge()
  const request = await AnkerNative.pcBridgeEmergency({ qr, minutes })
  if (!request.sent) return false
  const deadline = Date.now() + 5000
  do {
    const view: NativePcView = await AnkerNative.pcBridgeGetState()
    const ack = view.emergencyAck
    if (ack && ack.commandId === request.tokenId && ack.until === request.until && ack.until > Date.now()) {
      const state = useApp.getState()
      const date = guidancePlanDate(state.local, today(), Date.now())
      await state.extendGuidanceEmergency(date, request.tokenId, ack.until)
      return true
    }
    await waitTick()
  } while (Date.now() < deadline)
  return false
}
