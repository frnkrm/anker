import { addDays, utcToZoned, zonedToUtc, type DateStr } from './time'
import type { DayLog, Settings } from './types'
import { guidancePreferences } from './guidance/settings'

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
  smartWakeEnabled: boolean
  smartWakeWindowMinutes: number
  preWakeFadeIn: boolean
  antiRelapseEnabled: boolean
  antiRelapseDelayMinutes: number
  zeroGapEnabled: boolean
  label: string
}

export interface AlarmPlanningStatus {
  ok: boolean
  message?: string
  scheduledAt?: number
  /** Konfiguration, deren Übertragung gerade abgeschlossen wurde; enthält keine privaten Inhalte. */
  configurationKey?: string
}

/** Planning evidence only: a token and exact permission never prove future delivery or sound. */
export function alarmPlanningStatus(state: { scheduledAt?: number | null; mainConfirmed?: boolean; exact?: boolean; error?: string }, enabled: boolean): AlarmPlanningStatus {
  if (!enabled) return { ok: true, message: 'Der Hauptwecker ist ausgeschaltet.' }
  const scheduledAt = state.scheduledAt && Number.isFinite(state.scheduledAt) && state.scheduledAt > 0 ? state.scheduledAt : undefined
  if (state.error === 'exact_denied' || state.exact === false) {
    return { ok: false, scheduledAt, message: 'Android erlaubt gerade keine exakten Wecker. Der Wecker kann sich verspäten.' }
  }
  if (state.error) return { ok: false, scheduledAt, message: 'Android hat einen Fehler beim Planen oder Starten des Weckers gemeldet. Öffne die Diagnose und teste den Ton.' }
  if (!scheduledAt || !state.mainConfirmed) return { ok: false, scheduledAt, message: 'Für den nächsten Hauptwecker ist keine aktuelle Planung hinterlegt.' }
  if (state.exact !== true) return { ok: false, scheduledAt, message: 'Die Freigabe für exakte Wecker konnte nicht geprüft werden.' }
  return { ok: true, scheduledAt, message: 'Planung hinterlegt. Ob Ton und Vollbild auf deinem Handy funktionieren, prüfst du mit einem Test.' }
}

export function buildAlarmConfig(s: Settings, days: Record<DateStr, DayLog | undefined>, today: DateStr): NativeAlarmConfig {
  const guidance = guidancePreferences(s.guidance)
  const antiRelapseEnabled = guidance.enabled && guidance.antiRelapse
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
    wakeCheckEnabled: s.alarm.wakeCheckEnabled || antiRelapseEnabled,
    wakeCheckDelayMinutes: s.alarm.wakeCheckDelayMinutes,
    smartWakeEnabled: s.alarm.smartWake.enabled,
    smartWakeWindowMinutes: s.alarm.smartWake.windowMinutes,
    preWakeFadeIn: guidance.enabled && guidance.preWakeFadeIn,
    antiRelapseEnabled,
    antiRelapseDelayMinutes: guidance.antiRelapseMinutes,
    zeroGapEnabled: guidance.enabled && guidance.zeroGapMorning,
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
