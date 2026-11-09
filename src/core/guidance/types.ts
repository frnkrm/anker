import type { DateStr } from '../time'

/** Optional daily guidance layered on the existing DayPlan and real routine results. */
export type GuidancePhase =
  | 'DAY_ACTIVE' | 'MORNING_PENDING' | 'MORNING_ACTIVE' | 'MORNING_COMPLETED'
  | 'ZOMBIE_MODE' | 'EVENING_WIND_DOWN' | 'WIND_DOWN_T30' | 'BRAIN_DUMP_T10'
  | 'BEDTIME_HARD_CUT' | 'NIGHT_LOCK' | 'ALARM_RINGING'

export interface GuidancePreferences {
  enabled: boolean
  circadianUi: boolean
  timeArc: boolean
  depletionColors: boolean
  paceKeeper: boolean
  paceIntervalMin: number
  paceThresholds: boolean
  speakSteps: boolean
  zeroGapMorning: boolean
  preWakeFadeIn: boolean
  antiRelapse: boolean
  antiRelapseMinutes: number
  autoZombie: boolean
  autoZombieAfterSeconds: number
  eveningEscalation: boolean
  bedtimeQr: boolean
  sleepNoise: boolean
  sleepNoiseMinutes: number
  eveningLight: boolean
  eveningLightLeadMinutes: number
  suppressPhonePcWhenConfirmed: boolean
  pcLock: boolean
}

/** Native confirmation facts; no QR contents, second plan or inferred completion. */
export interface MorningAlarmHandoff {
  occurrenceId: string
  targetDate: DateStr
  alarmAt: number
  confirmedAt: number
}

export interface GuidanceDay {
  alarmOccurrenceId?: string
  alarmAt?: number
  morningActivatedAt?: number
  morningCompletedAt?: number
  firstInteractionAt?: number
  nightLockedAt?: number
  bedVerifiedAt?: number
  emergencyUntil?: number
  brainDumpIds?: string[]
  brainDumpShownAt?: number
}

export interface IfThenPlan {
  wish: string
  outcome: string
  obstacle: string
  sentence: string
  showOnPc: boolean
}

export interface GuidanceLocal {
  days: Record<DateStr, GuidanceDay>
  /** Bounded opaque idempotency receipts, never secret hardware credentials. */
  receipts: string[]
  ifThen?: IfThenPlan
  lightSuggestion?: 'accepted' | 'declined'
}

export interface GuidanceAlarmSnapshot {
  ringing: boolean
  kind?: string | null
}

export interface GuidanceView {
  phase: GuidancePhase
  date: DateStr
  remainingSeconds?: number
  routineStep?: { id: string; index: number; total: number }
  lockEnforced: boolean
  autoZombieDue: boolean
  morningCompleted: boolean
  brainDumpIds: string[]
}
