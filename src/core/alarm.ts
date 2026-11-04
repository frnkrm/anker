import { addDays, utcToZoned, zonedToUtc, type DateStr } from './time'
import type { DayLog, Settings } from './types'

/**
 * Kleiner Spiegel für den nativen Wecker. Quelle und Konfliktregel: Der Store der App ist die Wahrheit,
 * Kotlin hält die letzte Kopie und plant damit auch bei geschlossener App jeden nächsten Morgen.
 * Nicht enthalten: Arbeitsinhalte, Einnahmeprotokoll, QR-Code.
 */
export interface NativeAlarmConfig {
  enabled: boolean
  wakeMinutes: number
  /** Tage ohne Wecker (als krank markiert) */
  skipDates: DateStr[]
  /** Einmalige Weckzeiten, nur nach Bestätigung. Andere Tage bleiben beim Standard. */
  wakeOverrides: Record<DateStr, number>
  preWakeEnabled: boolean
  preWakeLeadMinutes: number
  wakeCheckEnabled: boolean
  wakeCheckDelayMinutes: number
  label: string
}

export function buildAlarmConfig(s: Settings, days: Record<DateStr, DayLog | undefined>, today: DateStr): NativeAlarmConfig {
  const skipDates = Object.values(days)
    .filter((l): l is DayLog => !!l && l.date >= today && l.override.dayType === 'sick')
    .map((l) => l.date)
    .sort()
  const wakeOverrides: Record<DateStr, number> = {}
  for (const l of Object.values(days)) {
    if (l && l.date >= today && l.override.wakeOverride !== undefined) wakeOverrides[l.date] = l.override.wakeOverride
  }
  return {
    enabled: s.alarm.enabled,
    wakeMinutes: s.anchor.wake,
    skipDates,
    wakeOverrides,
    preWakeEnabled: s.alarm.preWakeEnabled,
    preWakeLeadMinutes: s.alarm.preWakeLeadMinutes,
    wakeCheckEnabled: s.alarm.wakeCheckEnabled,
    wakeCheckDelayMinutes: s.alarm.wakeCheckDelayMinutes,
    label: 'Aufstehen',
  }
}

/** Gleiche Regel wie AlarmPlanner.next in Kotlin. Für Anzeigen und als Vergleich in den Tests. */
export function nextAlarmTimes(c: NativeAlarmConfig, nowMs: number): { mainAt: number; preWakeAt: number } {
  if (!c.enabled) return { mainAt: 0, preWakeAt: 0 }
  const start = utcToZoned(nowMs).date
  const skip = new Set(c.skipDates)
  for (let i = 0; i <= 400; i++) {
    const d = addDays(start, i)
    if (skip.has(d)) continue
    const at = zonedToUtc(d, c.wakeOverrides[d] ?? c.wakeMinutes)
    if (at > nowMs) {
      const pre = c.preWakeEnabled && c.preWakeLeadMinutes > 0 ? at - c.preWakeLeadMinutes * 60_000 : 0
      return { mainAt: at, preWakeAt: pre > nowMs ? pre : 0 }
    }
  }
  return { mainAt: 0, preWakeAt: 0 }
}

/** Reihenfolge der Wege zum Beenden, in Klartext für die Diagnose. */
export const STOP_METHOD_LABEL: Record<string, string> = {
  qr: 'QR-Code',
  math: 'Rechenaufgaben',
  emergency: 'Notfall-Stopp',
  locked: 'Knopf in der Meldung',
  test: 'Test beendet',
  prewake: 'Vorwecker beendet',
  check: 'Wachheits-Check',
}
