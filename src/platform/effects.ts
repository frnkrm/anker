import { App } from '@capacitor/app'
import { nowView, widgetEntry } from '../core/now'
import { addDays, minutesOnPlanDay, zonedToUtc } from '../core/time'
import { onPlanChange, planFor, today, useApp } from '../state/store'
import { syncAlarm } from './alarm'
import { syncWorkout } from './health'
import { AnkerNative, isNative, safe } from './native'
import { drainActions, rescheduleAll, setupNotifications } from './notifications'

/** Widget auf dem Homescreen aktualisieren. */
export async function updateWidget() {
  if (!isNative()) return
  await safe(() => AnkerNative.updateWidget({ entries: widgetEntries() }), undefined)
}

/** Zeitleiste fürs Widget: ab jedem Zeitpunkt gilt der jeweilige Eintrag (auch bei geschlossener App). */
export function widgetEntries() {
  const st = useApp.getState()
  const now = Date.now()
  const entries: { at: number; action: string; sub: string; hardLabel: string; hardTime: string }[] = []
  for (const d of [today(), addDays(today(), 1)]) {
    const plan = planFor(d)
    const points = new Set<number>([plan.wake - 30, ...plan.blocks.flatMap((b) => [b.start, b.end]), ...plan.hardTimes.flatMap((h) => [h.at - 20, h.at]), plan.bed + 120])
    for (const m of [...points].sort((a, b) => a - b)) {
      const at = zonedToUtc(d, m)
      const v = nowView(plan, st.days[d], m)
      entries.push(widgetEntry(at, v))
    }
  }
  // Aktuellen Zustand als ersten Eintrag sichern
  const d = today()
  const cur = nowView(planFor(d), st.days[d], minutesOnPlanDay(d, now))
  entries.push(widgetEntry(now, cur))
  return entries.sort((a, b) => a.at - b.at).filter((e) => e.at > now - 36 * 3600_000)
}

let started = false

/**
 * Verbindet die optionalen Extras mit dem Plan. Jede Funktion ist einzeln abgesichert:
 * Fällt eine aus, läuft der Rest weiter.
 */
export function startEffects(extra: { sync?: () => Promise<void> } = {}) {
  if (started) return
  started = true
  const run = async () => {
    if (isNative()) await drainActions()
    await rescheduleAll()
    await syncAlarm()
    await updateWidget()
    if (extra.sync) await safe(extra.sync, undefined)
  }
  void setupNotifications().then(run)
  onPlanChange(() => void run())

  // Beim Zurückkehren in die App: Training prüfen, alles neu planen
  if (isNative()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      void syncWorkout(today())
      void useApp.getState().evaluateProgress()
      void run()
    })
  }
  void syncWorkout(today())
  // Widget alle 5 Minuten frisch halten, solange die App läuft
  setInterval(() => void updateWidget(), 5 * 60_000)
}
