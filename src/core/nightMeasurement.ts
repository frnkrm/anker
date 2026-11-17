import type { Settings } from './types'
/** Der Hintergrundpfad erinnert nur; er darf kein Mikrofon einschalten. */
export function dailyMeasurementDecision(input: {
  settings: Settings; now: number; bedAt: number; targetAt: number; active: boolean; lastTargetAt?: number;
  foreground: boolean; microphoneGranted: boolean; alarmRinging: boolean;
}): 'none' | 'start-visible' | 'remind' {
  const { settings: s, now, bedAt, targetAt } = input
  if (!s.alarm.enabled || !s.alarm.smartWake.enabled || s.alarm.smartWake.autoDaily !== true
    || !Number.isFinite(now) || !Number.isFinite(bedAt) || !Number.isFinite(targetAt)
    || now < bedAt || now >= bedAt + 2 * 3600_000 || now >= targetAt || input.active || input.lastTargetAt === targetAt || input.alarmRinging) return 'none'
  return input.foreground && input.microphoneGranted ? 'start-visible' : 'remind'
}
