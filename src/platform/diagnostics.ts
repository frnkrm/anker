import { App } from '@capacitor/app'
import { version } from '../../package.json'
import type { DiagnosticExportInput } from '../core/diagnostics'
import { useApp } from '../state/store'
import { BedtimeNative } from './bedtimePrompt'
import { AnkerNative, isNative } from './native'

export interface DiagnosticRead {
  input: DiagnosticExportInput
  capturedAt: number
  unavailable: ('alarm' | 'bedtime' | 'journal' | 'pc')[]
}

/** Einzelne fehlende Antworten dürfen die übrigen Belege und die Dateiauswahl nicht blockieren. */
async function bounded<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('DIAGNOSTIC_TIMEOUT')), 5_000)
    })])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

/** Nur lokale Lesepfade. Die spätere Exportprojektion wählt und redigiert sämtliche Inhalte. */
export async function readDiagnostics(sourceFingerprint: string, includePc = false): Promise<DiagnosticRead> {
  const unavailable: DiagnosticRead['unavailable'] = []
  const journalUnavailable = { version: 1, available: false, retentionDays: 7, maxEntries: 800, events: [] }
  const app: DiagnosticExportInput['app'] = { version, platform: isNative() ? 'android' : 'web', sourceFingerprint }
  if (!isNative()) return { input: { app, settings: useApp.getState().settings, journal: journalUnavailable }, capturedAt: Date.now(), unavailable }
  const optional = async <T>(key: DiagnosticRead['unavailable'][number], read: () => Promise<T>): Promise<T | undefined> => {
    try { return await bounded(read) } catch { unavailable.push(key); return undefined }
  }
  const [info, alarmDiagnostics, bedtimeStatus, pcStatus] = await Promise.all([
    bounded(() => App.getInfo()).catch(() => undefined),
    optional('alarm', () => AnkerNative.getAlarmDiagnostics()),
    optional('bedtime', () => BedtimeNative.getBedtimePromptState()),
    includePc ? optional('pc', () => AnkerNative.pcBridgeGetState()) : undefined,
  ])
  if (info) { app.version = info.version; app.build = info.build }
  // Die Statusleser können selbst einen Zustandswechsel protokollieren. Das Journal zuletzt flushen.
  const journal = await optional('journal', () => AnkerNative.getDiagnosticJournal())
  return {
    input: { app, settings: useApp.getState().settings, journal: journal ?? journalUnavailable, alarmDiagnostics, bedtimeStatus, ...(includePc ? { pcStatus } : {}) },
    capturedAt: Date.now(), unavailable,
  }
}
