import { Health } from '@capgo/capacitor-health'
import { healthSleepSuggestions, type HealthSleepSuggestion } from '../core/healthSleep'
import { addDays, todayBerlin, zonedToUtc } from '../core/time'
import { useApp } from '../state/store'
import { isNative } from './native'

let generation = 0
let stopped = false
export const canReadHealthSleep = (): boolean => isNative() && !stopped && useApp.getState().local.healthSleepEnabled === true
export type HealthSleepChoice = 'enabled' | 'disabled' | 'unavailable' | 'permission-needed' | 'error' | 'cancelled'
export interface HealthSleepResult { status: 'ready' | Exclude<HealthSleepChoice, 'enabled' | 'disabled'> | 'off'; suggestions: HealthSleepSuggestion[] }

/** Nur dieser bewusste Schalter fragt nach einem neuen Android-Leserecht. */
export async function chooseHealthSleep(enabled: boolean): Promise<HealthSleepChoice> {
  const current = ++generation
  stopped = true // wirkt sofort, auch wenn ein Repositorywrite noch wartet
  const accepted = () => current === generation
  if (!enabled) {
    await useApp.getState().saveLocal(local => accepted() ? { ...local, healthSleepEnabled: false } : local)
    return accepted() ? 'disabled' : 'cancelled'
  }
  if (!isNative()) return 'unavailable'
  try {
    if (!(await Health.isAvailable()).available) return accepted() ? 'unavailable' : 'cancelled'
    if (!accepted()) return 'cancelled'
    const auth = await Health.requestAuthorization({ read: ['sleep'] })
    if (!accepted()) return 'cancelled'
    if (!auth.readAuthorized.includes('sleep')) return 'permission-needed'
    await useApp.getState().saveLocal(local => accepted() ? { ...local, healthSleepEnabled: true } : local)
    if (!accepted()) return 'cancelled'
    stopped = false
    return 'enabled'
  } catch { return accepted() ? 'error' : 'cancelled' }
}

/** Ausstehende Antworten verlassen die Plattform erst nach erneuter Freigabeprüfung. */
export async function readHealthSleep(nowMs = Date.now()): Promise<HealthSleepResult> {
  const current = generation
  const accepted = () => current === generation && canReadHealthSleep()
  const empty = (status: HealthSleepResult['status']): HealthSleepResult => ({ status, suggestions: [] })
  if (!accepted()) return empty('off')
  try {
    if (!(await Health.isAvailable()).available) return empty(accepted() ? 'unavailable' : 'off')
    if (!accepted()) return empty('off')
    const auth = await Health.checkAuthorization({ read: ['sleep'] })
    if (!accepted()) return empty('off')
    if (!auth.readAuthorized.includes('sleep')) return empty('permission-needed')
    const result = await Health.readSamples({ dataType: 'sleep', startDate: new Date(zonedToUtc(addDays(todayBerlin(nowMs), -14), 0)).toISOString(), endDate: new Date(nowMs).toISOString(), limit: 500, ascending: false })
    if (!accepted()) return empty('off')
    return { status: 'ready', suggestions: healthSleepSuggestions(result.samples, nowMs) }
  } catch { return empty(accepted() ? 'error' : 'off') }
}

export async function importHealthSleep(suggestion: HealthSleepSuggestion): Promise<boolean> {
  const current = generation
  return useApp.getState().acceptHealthSleep(suggestion.date, suggestion, () => generation === current && canReadHealthSleep())
}
