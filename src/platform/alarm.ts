import { addDays, zonedToUtc } from '../core/time'
import { planFor, today, useApp } from '../state/store'
import { AnkerNative, isNative, safe } from './native'

/** Plant den nächsten Wecker (heute, falls noch nicht vorbei, sonst morgen). */
export async function scheduleNextAlarm() {
  if (!isNative()) return
  const st = useApp.getState()
  if (!st.settings.onboarded) return
  if (!st.settings.alarm.enabled) {
    await safe(() => AnkerNative.cancelAlarm(), undefined)
    return
  }
  const now = Date.now()
  for (const d of [today(), addDays(today(), 1), addDays(today(), 2)]) {
    const plan = planFor(d)
    if (plan.dayType === 'sick') continue
    const at = zonedToUtc(d, plan.wake)
    if (at > now + 30_000) {
      await safe(() => AnkerNative.scheduleAlarm({ at, label: 'Aufstehen – der Anker ruft' }), undefined)
      return
    }
  }
}

export function makeMathTask(seed = Math.random): { q: string; a: number } {
  const a = 12 + Math.floor(seed() * 38)
  const b = 6 + Math.floor(seed() * 19)
  return seed() < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} − ${b}`, a }
}
