import { App } from '@capacitor/app'
import { coalesceAsync } from '../core/coalesced'
import { widgetSnapshot } from '../core/widget'
import { activePlanDate, widgetEntry } from '../core/now'
import { nextAction } from '../core/support'
import { addDays, minutesOnPlanDay, todayBerlin, zonedToUtc } from '../core/time'
import { onPlanChange, planFor, today, useApp } from '../state/store'
import { syncAlarm } from './alarm'
import { syncWorkout } from './health'
import { AnkerNative, isNative, safe } from './native'
import { drainActions, rescheduleAll, setupNotifications } from './notifications'
import { refreshRouteEstimates } from './traffic'

const reconcileWidget = coalesceAsync(async () => {
  if (!isNative()) return
  await safe(async () => {
    for (;;) {
      const before = useApp.getState()
      const date = today()
      await AnkerNative.updateWidget(widgetSnapshot(widgetEntries(), Date.now()))
      const current = useApp.getState()
      if (before.settings !== current.settings || before.days !== current.days || before.local !== current.local
        || before.inbox !== current.inbox || before.events !== current.events || today() !== date) continue
      return
    }
  }, undefined)
})

/** Direkte und periodische Aufrufe dürfen ältere Widgetdaten nicht zuletzt schreiben. */
export function updateWidget(): Promise<void> {
  return reconcileWidget()
}

/** Zeitleiste fürs Widget: ab jedem Zeitpunkt gilt der jeweilige Eintrag (auch bei geschlossener App). */
export function widgetEntries(now = Date.now()) {
  const st = useApp.getState()
  const date = activePlanDate(now, todayBerlin)
  const entries: { at: number; action: string; sub: string; hardLabel: string; hardTime: string }[] = []
  for (const d of [date, addDays(date, 1)]) {
    const plan = planFor(d, st)
    const points = new Set<number>([plan.wake - 30, ...plan.blocks.flatMap((b) => [b.start, b.end]), ...plan.hardTimes.flatMap((h) => [h.at - 20, h.at]), plan.bed + 120])
    // E04: die bewusst vertagte Rückkehrfrage hat einen eigenen nächsten Umschaltpunkt.
    const returnCheckAfter = (st.days[d]?.override as { returnCheckAfter?: number } | undefined)?.returnCheckAfter
    if (typeof returnCheckAfter === 'number' && Number.isFinite(returnCheckAfter) && returnCheckAfter >= 0) points.add(returnCheckAfter)
    for (const task of st.local.work) if (task.deadline && !task.done) {
      for (const at of [task.deadline, task.deadline - ((task.estimateMin ?? 30) + 30) * 60_000]) {
        const m = minutesOnPlanDay(d, at)
        if (m >= 0 && m <= Math.max(1440, plan.bed + 120)) points.add(m)
      }
    }
    for (const task of [...st.local.work, ...st.inbox.filter((item) => item.status === 'task')]) {
      for (const at of [task.earliestStart, task.deferredUntil, task.deadline, task.deadline === undefined ? undefined : task.deadline - (task.estimateMin ?? 5) * 60_000]) {
        if (at === undefined) continue
        const m = minutesOnPlanDay(d, at)
        if (m >= 0 && m <= Math.max(1440, plan.bed + 120)) points.add(m)
      }
    }
    for (const m of [...points].sort((a, b) => a - b)) {
      const at = zonedToUtc(d, m)
      const v = nextAction({ plan, log: st.days[d], m, nowMs: at, settings: st.settings, inbox: st.inbox, work: st.local.work, resume: st.local.resume, sessions: st.local.workSessions, context: st.local.taskContext })
      entries.push(widgetEntry(at, v))
    }
  }
  // Aktuellen Zustand als ersten Eintrag sichern
  const cur = nextAction({ plan: planFor(date, st), log: st.days[date], m: minutesOnPlanDay(date, now), nowMs: now, settings: st.settings, inbox: st.inbox, work: st.local.work, resume: st.local.resume, sessions: st.local.workSessions, context: st.local.taskContext })
  entries.push(widgetEntry(now, cur))
  return entries.sort((a, b) => a.at - b.at).filter((e) => e.at > now - 36 * 3600_000)
}

let started = false
let notificationSetup: Promise<void> = Promise.resolve()
let replanRequested = false

/** Fehler einer Erweiterung dürfen die übrigen Abgleiche nicht abbrechen. Keine privaten Fehlerdetails loggen. */
async function attempt(label: string, work: () => Promise<unknown>): Promise<void> {
  try { await work() } catch { console.warn(`[Anker] ${label} konnte noch nicht aktualisiert werden.`) }
}

const localEffects = coalesceAsync(async () => {
  const replan = replanRequested
  replanRequested = false
  // Ein frischer Start darf vor Einrichtung oder bewusster Wiederherstellung nichts planen.
  if (!useApp.getState().settings.onboarded) return
  if (replan) {
    await notificationSetup
    if (isNative()) await attempt('Erinnerungsrückmeldung', drainActions)
    await attempt('Erinnerungsplanung', rescheduleAll)
    // syncAlarm führt seinen sichtbaren Fehlerstatus selbst, auch für direkte Aufrufer.
    try { await syncAlarm() } catch {
      useApp.getState().setAlarmStatus({ ok: false, message: 'Der Wecker konnte nicht geplant werden.' })
    }
  }
  await attempt('Widget', updateWidget)
})

/** Ein einziger lokaler/native Abgleich, Änderungen währenddessen landen im nächsten Durchlauf. */
export function reconcileEffects(): Promise<void> {
  replanRequested = true
  return localEffects()
}

/**
 * Verbindet die optionalen Extras mit dem Plan. Jede Funktion ist einzeln abgesichert:
 * Fällt eine aus, läuft der Rest weiter.
 */
export function startEffects(extra: { sync?: () => Promise<void> } = {}) {
  if (started) return
  started = true
  // Optionale Dienste dürfen eine neue lokale Weckerplanung nicht auf ihre Netzantwort warten lassen.
  const optionalEffects = coalesceAsync(async () => {
    if (!useApp.getState().settings.onboarded) return
    await attempt('Training', () => syncWorkout(today()))
    await attempt('Fortschritt', () => useApp.getState().evaluateProgress())
    await attempt('Fahrtschätzung', refreshRouteEstimates)
    if (extra.sync) await attempt('Optionale Verbindung', extra.sync)
  })
  const request = () => {
    void reconcileEffects().catch(() => console.warn('[Anker] Lokaler Abgleich wird beim nächsten Anlass erneut versucht.'))
    void optionalEffects().catch(() => console.warn('[Anker] Optionale Aktualisierung wird beim nächsten Anlass erneut versucht.'))
  }
  notificationSetup = Promise.resolve().then(setupNotifications).catch(() => {
    console.warn('[Anker] Erinnerungen konnten noch nicht eingerichtet werden.')
  })
  onPlanChange(request)
  void notificationSetup.then(request)

  // Beim Zurückkehren in die App: Training prüfen, alles neu planen
  if (isNative()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      request()
    }).catch(() => { console.warn('[Anker] Rückkehr in die App konnte noch nicht beobachtet werden.') })
  }
  // Gleiche Queue auch für den Widget-Takt; ohne neue Planänderung ist kein voller Abgleich nötig.
  setInterval(() => {
    if (!useApp.getState().settings.onboarded) return
    void localEffects().catch(() => console.warn('[Anker] Widget wird beim nächsten Anlass erneut versucht.'))
    // Prüft nur diskrete noch offene Gelegenheiten. Keine Anfrage bei jedem Takt.
    void attempt('Fahrtschätzung', refreshRouteEstimates)
  }, 5 * 60_000)
}
