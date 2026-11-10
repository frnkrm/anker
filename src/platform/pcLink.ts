import { coalesceAsync } from '../core/coalesced'
import { guidancePlanDate, guidancePreferences } from '../core/guidance'
import { buildPcBriefing, buildPcState, defaultPcBridgeLocal, isPcAck, isPcLinkEvent, matchingPcAck, parsePairingCode, parsePcPayload, pcConnectionStatus, pcConnectionText, validPcBridgeLocal, type PcAck, type PcBridgeLocal, type PcCommandPayload, type PcEventsPayload, type PcLinkPreferences, type PcStatePayload } from '../core/pcLink'
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
  const { followGentleEvening, ...wire } = local.preferences
  const result: PcLinkPreferences = { ...wire, enforceEnabled: local.enabled && local.preferences.enforceEnabled, strictLock: guidance.enabled && guidance.pcLock,
    singleTransition: state.settings.support.windDown.enabled && followGentleEvening !== false,
    ...(ifThen?.showOnPc && ifThen.sentence.trim() ? { ifThen: ifThen.sentence } : {}) }
  if (guidance.enabled && guidance.eveningEscalation) result.bedtimeSequence = true
  else delete result.bedtimeSequence
  return result
}

export function pcBridgeSnapshot(now = Date.now(), alarm?: { ringing: boolean; kind?: string | null }): PcStatePayload {
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
  const state = pcBridgeSnapshot(Date.now(), isNative() ? await AnkerNative.getAlarmState() : undefined)
  return { state, briefing: briefingFor(state) }
}

export async function getPcBridgeView(): Promise<PcBridgeView> {
  if (!isNative()) return { state: 'unpaired', connected: false, active: false, currentConfirmation: false, confirmationText: 'Die lokale PC-Kopplung ist in der Android-App verfügbar.' }
  const native: NativePcView = await AnkerNative.pcBridgeGetState()
  const ack = isPcAck(native.ack) ? native.ack : undefined
  const state = useApp.getState()
  if (!state.ready) return { ...native, ack, currentConfirmation: false, confirmationText: 'Die App lädt deinen aktuellen Plan.' }
  const wanted = pcBridgeSnapshot(Date.now(), await AnkerNative.getAlarmState())
  const status = pcConnectionStatus({ nativeState: native.state, connected: native.connected, ack: native.ack, wanted, nowMs: Date.now() })
  return { ...native, ack, currentConfirmation: localBridge().enabled && status === 'confirmed', confirmationText: pcConnectionText({ ...localBridge(), status, ack }) }
}

export async function discoverPcCompanions(): Promise<{ services: { name: string; host: string; port: number }[]; available: boolean }> {
  if (!isNative()) return { services: [], available: false }
  const result = await AnkerNative.pcBridgeDiscover({ timeoutMs: 2500 })
  return { services: result.devices.map(({ name, host, port }) => ({ name, host, port })), available: true }
}

let configured = ''
let pairingGeneration = 0
let pairingOperations = 0
const samePair = (generation: number) => generation === pairingGeneration && pairingOperations === 0
async function configureBridge(enabled: boolean): Promise<void> {
  const generation = pairingGeneration
  const raw = useApp.getState().settings.alarm.qrSecret
  // Only the hash crosses this configuration boundary. The QR itself is submitted solely on a scan.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  if (generation !== pairingGeneration) return
  const qrHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const key = `${enabled}:${qrHash}`
  if (configured === key) return
  await AnkerNative.pcBridgeConfigure({ qrHash, autoReconnect: enabled })
  if (generation === pairingGeneration) configured = key
}

export async function pairPcCompanion(qr: string): Promise<void> {
  if (!isNative()) throw new Error('Die PC-Kopplung ist auf Android verfügbar.')
  if (pairingOperations) throw new Error('Die vorherige Kopplungsänderung wird noch abgeschlossen.')
  parsePairingCode(qr)
  const generation = ++pairingGeneration
  pairingOperations++
  try {
    await configureBridge(true)
    if (generation !== pairingGeneration) return
    await AnkerNative.pcBridgePair({ qr, deviceName: 'Anker Android' })
    if (generation !== pairingGeneration) return
    await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), enabled: true, status: 'paired-never-reached', events: [], receipts: [], cursor: 0, ack: undefined, wantedRevision: undefined } }))
    lastStateRevision = ''; lastBriefingRevision = ''
  } finally { pairingOperations-- }
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
  ++pairingGeneration
  pairingOperations++
  try {
    if (isNative()) await AnkerNative.pcBridgeUnpair()
    await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...(local.pcBridge ?? defaultPcBridgeLocal()), enabled: false, status: 'unpaired', ack: undefined, wantedRevision: undefined, pcName: undefined, events: [], receipts: [], cursor: 0 } }))
    configured = ''; lastStateRevision = ''; lastBriefingRevision = ''
  } finally { pairingOperations-- }
}

export async function updatePcBridgePreferences(patch: Partial<PcLinkPreferences> & { followGentleEvening?: boolean }): Promise<void> {
  const { strictLock, ifThen, bedtimeSequence, singleTransition, bedAfterStopMin, ...localPatch } = patch
  if (strictLock !== undefined || ifThen !== undefined || bedtimeSequence !== undefined || singleTransition !== undefined || bedAfterStopMin !== undefined) throw new Error('Abendfolge, Puffer und Nachtschutz werden aus deinen vorhandenen Einstellungen übernommen.')
  await useApp.getState().saveLocal(local => {
    const bridge = local.pcBridge ?? defaultPcBridgeLocal()
    const candidate = { ...bridge, preferences: { ...bridge.preferences, ...localPatch } }
    // Validate and merge inside the Store queue so simultaneous independent choices survive.
    if (!validPcBridgeLocal(candidate)) throw new Error('Die lokale PC-Auswahl ist ungültig.')
    parsePcPayload({ ...pcBridgeSnapshot(), prefs: { ...preferences(candidate), enforceEnabled: candidate.preferences.enforceEnabled } })
    return { ...local, pcBridge: candidate }
  })
  await syncPcBridge()
}

/** Receipt effects and the native outbox acknowledgement have deliberately separate commits. */
async function drainPcEvents(generation: number): Promise<boolean> {
  const pending = await AnkerNative.pcBridgeDrainEvents()
  if (!samePair(generation)) return false
  if (!Array.isArray(pending.events) || pending.events.length > 1000 || !pending.events.every(isPcLinkEvent)) throw new Error('Die PC-Rückmeldung ist ungültig.')
  const events = pending.events.filter(isPcLinkEvent)
  for (let offset = 0; offset < events.length; offset += 100) {
    const items = events.slice(offset, offset + 100)
    const payload: PcEventsPayload = { type: 'events', items, lastSeq: Math.max(pending.lastSeq, ...items.map(item => item.seq)) }
    parsePcPayload(payload)
    const committed = await useApp.getState().applyPcEvents(payload)
    if (!samePair(generation)) return false
    if (committed.appliedIds.length) await AnkerNative.pcBridgeAckEvents({ ids: committed.appliedIds })
    if (!samePair(generation)) return false
  }
  return true
}

let lastStateRevision = ''
let lastBriefingRevision = ''
let lastStateSentAt = 0
let lastRemainingSeconds = -1
let disabled = false
let lastReconnectAt = 0

const reconcilePcBridge = coalesceAsync(async () => {
  if (!isNative() || !useApp.getState().ready || !useApp.getState().settings.onboarded) return
  if (pairingOperations) return
  if (!localBridge().enabled && disabled) return
  const generation = pairingGeneration
  // Apply offline PC actions before a fresh planner snapshot can overwrite their intent.
  if (!await drainPcEvents(generation)) return
  const local = localBridge()
  if (!local.enabled) {
    if (!disabled) {
      await configureBridge(false)
      if (!samePair(generation)) return
      await AnkerNative.pcBridgeStop()
      if (!samePair(generation)) return
      disabled = true
    }
    return
  }
  disabled = false
  await configureBridge(true)
  if (!samePair(generation)) return
  let native: NativePcView = await AnkerNative.pcBridgeGetState()
  if (!samePair(generation)) return
  if (native.requestedActive && !native.active && Date.now() - lastReconnectAt >= 30000 && globalThis.document?.visibilityState === 'visible') {
    lastReconnectAt = Date.now()
    native = await AnkerNative.pcBridgeStart()
  }
  if (['unpaired', 'pairing', 'rejected', 'companion-outdated'].includes(native.state)) return
  const now = Date.now()
  const alarm = await AnkerNative.getAlarmState()
  if (!samePair(generation)) return
  const wanted = pcBridgeSnapshot(now, alarm)
  const briefing = briefingFor(wanted)
  if (briefing.revision !== lastBriefingRevision) {
    const result = await AnkerNative.pcBridgeSend({ payload: briefing })
    if (!samePair(generation)) return
    if (result.sent) lastBriefingRevision = briefing.revision
  }
  const runningStepChanged = ['MORNING_ACTIVE', 'ZOMBIE_MODE'].includes(wanted.state) && wanted.remainingSeconds !== lastRemainingSeconds
  if (wanted.revision !== lastStateRevision || runningStepChanged || now - lastStateSentAt >= 25000) {
    const result = await AnkerNative.pcBridgeSend({ payload: wanted })
    if (!samePair(generation)) return
    if (result.sent) { lastStateRevision = wanted.revision; lastStateSentAt = now; lastRemainingSeconds = wanted.remainingSeconds }
  }
  native = await AnkerNative.pcBridgeGetState()
  if (!samePair(generation)) return
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
    if (!samePair(generation)) return
    if (sent.sent) await useApp.getState().saveLocal(localData => {
      const bridge = localData.pcBridge ?? defaultPcBridgeLocal()
      const current = bridge.wakeOnLan
      if (!current || current.mac !== wol.mac || current.broadcast !== wol.broadcast) return localData
      return { ...localData, pcBridge: { ...bridge, wakeOnLan: { ...current, lastMorning: wanted.date } } }
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
  const generation = pairingGeneration
  await syncPcBridge()
  if (!samePair(generation)) return false
  const expected = pcBridgeSnapshot(Date.now(), await AnkerNative.getAlarmState())
  if (!samePair(generation) || !expected.prefs.strictLock || !expected.prefs.enforceEnabled) return false
  if (!expected.lockEnforced) {
    // An automatic PC night has no local bed-QR fact yet. Let the authenticated
    // state ACK arrive before asking native code to verify and sign the fresh scan.
    const ackDeadline = Date.now() + 2000
    let confirmed = false
    do {
      const view: NativePcView = await AnkerNative.pcBridgeGetState()
      if (!samePair(generation)) return false
      if (view.connected && matchingPcAck(view.ack, expected, Date.now())
        && ['locked', 'scheduled'].includes(view.ack.effective.mode) && !view.ack.warnings.length) { confirmed = true; break }
      if (!view.connected) return false
      await waitTick()
    } while (Date.now() < ackDeadline)
    if (!confirmed) return false
  }
  const request = await AnkerNative.pcBridgeEmergency({ qr, minutes })
  if (!samePair(generation)) return false
  if (!request.sent) return false
  const deadline = Date.now() + 5000
  do {
    const view: NativePcView = await AnkerNative.pcBridgeGetState()
    if (!samePair(generation)) return false
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
