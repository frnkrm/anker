import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
// Die bestehende Registrierung behält auch ihre Web-Fallbacks; beide Typen verwenden denselben Owner.
import './native'

export interface BedtimePromptState {
  phase: 'idle' | 'waiting' | 'shown' | 'skipped' | 'error'
  sessionId?: string
  dueAt?: number
  overlayPermission: boolean
  exact: boolean
  reason?: string
}

export interface BedtimeApi {
  getBedtimePromptState(): Promise<BedtimePromptState>
  startBedtimePrompt(options: { delayMinutes: number }): Promise<void>
  stopBedtimePrompt(options: { sessionId?: string }): Promise<void>
  ackBedtimePrompt(options: { sessionId: string }): Promise<void>
  openOverlayPermissionSettings(): Promise<void>
  addListener(event: 'bedtimePromptChanged', listener: (state: BedtimePromptState) => void): Promise<PluginListenerHandle>
}

export const BedtimeNative = registerPlugin<BedtimeApi>('AnkerNative')
export const bedtimePromptSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

export const BEDTIME_PROMPT_TEXT = 'Deine geplante Einschlafzeit ist erreicht. Du entscheidest, wie du weitermachst.'
