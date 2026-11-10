import type { DateStr } from '../time'
import type { GuidancePhase } from '../guidance/types'

export type PcPhase = GuidancePhase | 'IDLE'
export type PcStopAction = 'lock' | 'hibernate' | 'shutdown'
export type PcLinkStatus = 'unpaired' | 'paired-never-reached' | 'confirmed' | 'unreachable' | 'rejected' | 'companion-outdated'
export interface PcLinkPreferences {
  enforceEnabled: boolean
  strictLock: boolean
  dimEnabled: boolean
  dimMax: number
  audioDuck: boolean
  shareBrainDump: boolean
  morningCountdown: boolean
  offlinePolicy: 'pause' | 'fixed-time'
  stopAction: PcStopAction
  graceSeconds: number
  ifThen?: string
  /** The explicitly chosen v7 evening sequence ends at bedtime; absent keeps the PC-stop flow. */
  bedtimeSequence?: boolean
  /** Use the already chosen gentle evening cue instead of separate T30/T10 cards. */
  singleTransition?: boolean
  /** Display-only bedtime estimate after a PC stop, derived from the existing planner buffer. */
  bedAfterStopMin?: number
}
export interface PcSchedule {
  lightHintAt?: string
  windDownAt: string | null
  brainDumpAt: string | null
  bedAt: string | null
  wakeAt: string | null
  morningDeadlineAt: string | null
  pcStopAt?: string | null
  leaveAt?: string | null
  workStartAt?: string | null
  homeOffice?: boolean
}
export interface PcStatePayload {
  type: 'state'
  state: PcPhase
  sessionId: string
  revision: string
  date: DateStr
  generatedAt: string
  validUntil: string
  remainingSeconds: number
  routineStep: { index: number; total: number } | null
  lockEnforced: boolean
  schedule: PcSchedule
  prefs: PcLinkPreferences
  brainDump?: { text: string; nextStep?: string }
}
export interface PcBriefingDay {
  lightHintAt?: string
  date: DateStr
  validUntil: string
  pc: { mode: 'scheduled' | 'paused'; stopAt?: string; localTime?: string }
  bedAt?: string
  wakeAt?: string
  windDownAt?: string
  brainDumpAt?: string
  morningDeadlineAt?: string
  morning?: { leaveAt?: string; workStartAt?: string; homeOffice: boolean }
}
export interface PcBriefingPayload { type: 'briefing'; revision: string; generatedAt: string; validUntil: string; days: PcBriefingDay[]; prefs: PcLinkPreferences }
export const PC_ACK_WARNINGS = ['clock-skew', 'local-enforcement-off', 'legacy-conflict', 'source-expired', 'no-schedule', 'morning-deadline-reached', 'pairing-required', 'link-stale'] as const
export interface PcAck {
  type: 'ack'
  revision: string
  receivedAt: string
  effective: { date: DateStr; mode: 'scheduled' | 'paused' | 'suspended-today' | 'legacy-conflict' | 'locked' | 'released'; stopAt?: string }
  companion: { version: string; protocol: 3 }
  warnings: (typeof PC_ACK_WARNINGS)[number][]
  commandId?: string
  emergencyUntil?: string
}
export const PC_EVENT_KINDS = ['pc-rest', 'pc-resumed', 'extended', 'suspended-today', 'resumed-today', 'shutdown-started', 'shutdown-blocked', 'save-point', 'thought', 'unpaired'] as const
export interface PcLinkEvent {
  id: string
  seq: number
  at: string
  date: DateStr
  kind: (typeof PC_EVENT_KINDS)[number]
  basis?: 'anker-shutdown' | 'user-shutdown' | 'sleep' | 'lock' | 'logoff' | 'idle'
  newStopAt?: string
  /** The extended instant is either the PC stop or the v7 bedtime, never an inferred completion. */
  anchor?: 'bed' | 'pc-stop'
  text?: string
  nextStep?: string
}
export interface PcEventsPayload { type: 'events'; items: PcLinkEvent[]; lastSeq: number }
export interface PcEmergencyToken { v: 3; pair: string; sessionId: string; date: DateStr; issuedAt: string; expiresAt: string; until: string; nonce: string; signature: string }
export interface PcCommandPayload { type: 'command'; id: string; action: 'ping' | 'unpair' | 'test-evening' | 'resume-today' | 'suspend-today' | 'extend' | 'EMERGENCY_EXTENSION'; minutes?: number; token?: PcEmergencyToken }
export type PcLinkPayload = PcStatePayload | PcBriefingPayload | PcAck | PcEventsPayload | PcCommandPayload | { type: 'pull'; after: number }
export interface PcEnvelope { v: 3; kind: 'anker-link'; pair: string; from: 'phone' | 'pc'; seq: number; sentAt: string; nonce: string; ct: string }
export interface PcPairingCode { t: 'anker-pc-pair'; v: 3; id: string; n: string; k: string; c: string; s: string; a: string[]; e: string }
/** Non-secret local control data. All actual pairing keys/pins stay in native CE Keystore storage. */
export interface PcBridgeLocal {
  enabled: boolean
  preferences: Omit<PcLinkPreferences, 'strictLock' | 'ifThen' | 'bedtimeSequence' | 'singleTransition' | 'bedAfterStopMin'> & {
    /** Local choice only. The wire receives the derived singleTransition, never this field. */
    followGentleEvening?: boolean
  }
  automaticRestEvents: boolean
  status: PcLinkStatus
  pcName?: string
  wantedRevision?: string
  ack?: PcAck
  lastAttemptAt?: number
  events: PcLinkEvent[]
  receipts: string[]
  cursor: number
  wakeOnLan?: { enabled: boolean; mac: string; broadcast: string; lastMorning?: string }
}

export function defaultPcBridgeLocal(): PcBridgeLocal {
  return { enabled: false, preferences: { enforceEnabled: false, dimEnabled: false, dimMax: 0.25, audioDuck: false, shareBrainDump: false, morningCountdown: false, followGentleEvening: true, offlinePolicy: 'pause', stopAction: 'lock', graceSeconds: 60 }, automaticRestEvents: false, status: 'unpaired', events: [], receipts: [], cursor: 0 }
}
