import { Health } from '@capgo/capacitor-health'
import { zonedToUtc, type DateStr } from '../core/time'
import { useApp } from '../state/store'
import { isNative, safe } from './native'

export async function healthAvailable(): Promise<boolean> {
  if (!isNative()) return false
  return safe(async () => (await Health.isAvailable()).available, false)
}

export async function requestHealth(): Promise<boolean> {
  if (!(await healthAvailable())) return false
  return safe(async () => {
    const r = await Health.requestAuthorization({ read: ['workouts', 'steps'] })
    return (r.readAuthorized ?? []).includes('workouts')
  }, false)
}

export async function healthAuthorized(): Promise<boolean> {
  if (!(await healthAvailable())) return false
  return safe(async () => {
    const r = await Health.checkAuthorization({ read: ['workouts', 'steps'] })
    return (r.readAuthorized ?? []).includes('workouts')
  }, false)
}

/** Hakt Sport automatisch ab, wenn Health Connect für den Tag ein Training meldet. Still bei Fehlern. */
export async function syncWorkout(date: DateStr) {
  const st = useApp.getState()
  if (!st.settings.integrations.healthConnect || st.days[date]?.sport) return
  if (!(await healthAvailable())) return
  if (!useApp.getState().settings.integrations.healthConnect || useApp.getState().days[date]?.sport) return
  const found = await safe(async () => {
    const r = await Health.queryWorkouts({
      startDate: new Date(zonedToUtc(date, 0)).toISOString(),
      endDate: new Date(zonedToUtc(date, 1440)).toISOString(),
      limit: 20,
    })
    return r.workouts.some((w) => w.duration >= 8 * 60)
  }, false)
  const current = useApp.getState()
  if (found && current.settings.integrations.healthConnect && !current.days[date]?.sport) {
    await current.updateDay(date, (l) => l.sport || !useApp.getState().settings.integrations.healthConnect ? l : ({ ...l, sport: 'health' }))
  }
}
