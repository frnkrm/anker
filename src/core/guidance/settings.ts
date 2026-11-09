import type { GuidancePreferences } from './types'

export const DEFAULT_GUIDANCE: Readonly<GuidancePreferences> = {
  enabled: false, circadianUi: false, timeArc: true, depletionColors: false,
  paceKeeper: false, paceIntervalMin: 1, paceThresholds: false, speakSteps: false,
  zeroGapMorning: false, preWakeFadeIn: false, antiRelapse: false, antiRelapseMinutes: 5,
  autoZombie: false, autoZombieAfterSeconds: 60,
  eveningEscalation: false, bedtimeQr: false, sleepNoise: false, sleepNoiseMinutes: 20,
  pcLock: false,
}

const booleanKeys = ['enabled', 'circadianUi', 'timeArc', 'depletionColors', 'paceKeeper', 'paceThresholds', 'speakSteps', 'zeroGapMorning', 'preWakeFadeIn', 'antiRelapse', 'autoZombie', 'eveningEscalation', 'bedtimeQr', 'sleepNoise', 'pcLock'] as const
const ranges = { paceIntervalMin: [1, 10], antiRelapseMinutes: [1, 30], autoZombieAfterSeconds: [10, 600], sleepNoiseMinutes: [1, 60] } as const

export function guidancePreferences(value?: Partial<GuidancePreferences>): GuidancePreferences {
  const result = { ...DEFAULT_GUIDANCE }
  for (const key of booleanKeys) result[key] = typeof value?.[key] === 'boolean' ? value[key]! : DEFAULT_GUIDANCE[key]
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const number = value?.[key]
    if (typeof number === 'number' && Number.isInteger(number) && number >= ranges[key][0] && number <= ranges[key][1]) result[key] = number
  }
  return result
}

/** Optional old containers are accepted; unknown or malformed new fields are not. */
export function validGuidancePreferences(value: unknown): boolean {
  if (value === undefined) return true
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([key, field]) => {
    if ((booleanKeys as readonly string[]).includes(key)) return typeof field === 'boolean'
    if (!Object.hasOwn(ranges, key)) return false
    const bounds = ranges[key as keyof typeof ranges]
    return typeof field === 'number' && Number.isInteger(field) && field >= bounds[0] && field <= bounds[1]
  })
}
