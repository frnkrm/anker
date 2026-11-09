import type { Settings } from '../types'

export const DIAGNOSTIC_CATEGORIES = ['alarm', 'bedtime', 'reminder', 'system', 'pc'] as const
export type DiagnosticCategory = typeof DIAGNOSTIC_CATEGORIES[number]
export const DIAGNOSTIC_CATEGORY_LABELS: Readonly<Record<DiagnosticCategory, string>> = {
  alarm: 'Wecker', bedtime: 'Stummer Schlafhinweis', reminder: 'Alltags-Erinnerungen', system: 'Systemereignisse', pc: 'PC-Verbindung',
}
export const DIAGNOSTIC_SETTINGS_GROUPS = ['alarm', 'sleep', 'routines', 'reminders', 'appearance', 'workTimes'] as const
export type DiagnosticSettingsGroup = typeof DIAGNOSTIC_SETTINGS_GROUPS[number]
export type DiagnosticSource = 'alarm' | 'bedtime' | 'journal' | 'pc'
export const DIAGNOSTIC_SETTINGS_LABELS: Readonly<Record<DiagnosticSettingsGroup, string>> = {
  alarm: 'Wecker und Aufstehzeiten', sleep: 'Schlaf- und Abendoptionen', routines: 'Routinen: nur Dauern und Kernschritte',
  reminders: 'Erinnerungen und Ruhezeiten', appearance: 'Darstellung', workTimes: 'Arbeitszeiten: nur Wochenstruktur',
}

/** Nur diese Exportauswahl, keine zusätzliche persistierte Einstellung oder Datensicherung. */
export interface DiagnosticExportSelection {
  from: number
  to: number
  categories: readonly DiagnosticCategory[]
  settingsGroups: readonly DiagnosticSettingsGroup[]
  includeCurrentStatus: boolean
}
export type DiagnosticValue = string | number | boolean | null | DiagnosticValue[] | { [key: string]: DiagnosticValue }
export type DiagnosticRecord = { [key: string]: DiagnosticValue }

export interface DiagnosticEvent {
  seq: number
  at: number
  elapsedMs: number
  category: DiagnosticCategory
  code: string
  details: DiagnosticRecord
}

/** Native Antworten werden absichtlich nicht blind als vermeintlich sichere Typen übernommen. */
export interface DiagnosticExportInput {
  app: { version: string; build?: string; sourceFingerprint?: string; platform: 'android' | 'web' }
  settings?: Settings
  journal?: unknown
  alarmDiagnostics?: unknown
  bedtimeStatus?: unknown
  pcStatus?: unknown
  unavailable?: readonly DiagnosticSource[]
}

export interface DiagnosticExport {
  kind: 'anker-diagnostics'
  schemaVersion: 1
  app: { name: 'Anker'; version: string; build?: string; sourceFingerprint?: string; platform: 'android' | 'web' }
  exportedAt: string
  manifest: {
    selection: DiagnosticExportSelection
    omitted: { categories: DiagnosticCategory[]; settingsGroups: DiagnosticSettingsGroup[] }
    journal: {
      availability: 'available' | 'unavailable' | 'unsupported' | 'not-requested'
      retentionDays: 7
      maxEntries: 800
      droppedEvents?: number
      pendingEvents?: number
      /** Nur positiver Lückenhinweis; fehlend behauptet keinen vollständigen historischen Verlauf. */
      incomplete?: true
      invalidEvents: number
      truncatedEvents: number
      futureTimestampEvents: number
      unrecognizedCodes: number
    }
    warnings: readonly string[]
    unavailableSources?: DiagnosticSource[]
  }
  logs: DiagnosticEvent[]
  settings?: Partial<Record<DiagnosticSettingsGroup, DiagnosticRecord>>
  runtime?: { device?: DiagnosticRecord; alarm?: DiagnosticRecord; bedtime?: DiagnosticRecord; reminder?: DiagnosticRecord; system?: DiagnosticRecord; pc?: DiagnosticRecord }
}
