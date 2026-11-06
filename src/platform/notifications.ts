import { LocalNotifications } from '@capacitor/local-notifications'
import { buildReminders, reminderPolicy, reminderRevisions, reopenHint } from '../core/reminders/build'
import { validReminderAction } from '../core/reminders/actions'
import { addDays, zonedToUtc } from '../core/time'
import type { DayLog } from '../core/types'
import { planFor, today, useApp } from '../state/store'
import { AnkerNative, isNative, safe, type ReminderActionInfo } from './native'

/** So weit legt die App Erinnerungen beim nativen Teil ab. Danach folgt ein einziger Hinweis. */
export const HORIZON_DAYS = 14

let setupDone = false

export async function setupNotifications() {
  if (!isNative() || setupDone) return
  setupDone = true
  await safe(cleanupLegacy, undefined)
  await safe(async () => {
    await AnkerNative.addListener('reminderAction', () => void drainActions())
  }, undefined)
  await drainActions()
}

/** Bis 1.0.1 lagen Erinnerungen im Plugin. Einmal abräumen, sonst kämen sie doppelt und ohne Slot-Grenze. */
async function cleanupLegacy() {
  const pending = (await LocalNotifications.getPending()).notifications
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
  const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications
  // Eigene Slots und den laufenden Wecker nicht anfassen
  const old = delivered.filter((n) => !(n.id >= 1001 && n.id <= 1003) && n.id !== 7001 && n.id !== 7002)
  if (old.length) await LocalNotifications.removeDeliveredNotifications({ notifications: old })
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative()) return typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'granted' : 'prompt'
  return safe(async () => {
    const p = await LocalNotifications.checkPermissions()
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt'
  }, 'prompt' as const)
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) {
    if (typeof Notification === 'undefined') return false
    return (await Notification.requestPermission()) === 'granted'
  }
  return safe(async () => (await LocalNotifications.requestPermissions()).display === 'granted', false)
}

export async function exactAlarmStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative()) return 'denied'
  return safe(async () => ((await AnkerNative.getAlarmState()).exact ? 'granted' : 'denied'), 'prompt' as 'granted' | 'denied' | 'prompt')
}

export async function openExactAlarmSettings() {
  if (isNative()) await safe(() => AnkerNative.openExactAlarmSettings(), undefined)
}

/** Übergibt die Erinnerungen der nächsten zwei Wochen an den nativen Teil. */
export async function rescheduleAll() {
  if (!isNative()) return
  await safe(async () => {
    const st = useApp.getState()
    if (!st.settings.onboarded) return
    const t = today()
    const dates = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(t, i))
    const plans = dates.map((d) => planFor(d))
    // Auch ältere offene Gedanken behalten ihre Dismissals und ihre sichtbare Meldung,
    // bis sie in der Inbox erledigt, anders einsortiert oder abgewählt werden.
    const logs: Record<string, DayLog | undefined> = st.days
    const now = Date.now()
    const deadlines = st.local.work.filter((w) => w.deadline && !w.done).map((w) => ({ id: w.id, at: w.deadline! }))
    const horizonEnd = zonedToUtc(dates[dates.length - 1]!, 18 * 60)
    const extras = { deadlines, thoughtReviews: st.inbox, tomorrowSteps: st.local.tomorrowSteps }
    const specs = buildReminders(plans, logs, st.settings, now, horizonEnd - now, extras)
    const last = dates[dates.length - 1]!
    const reminders = [...specs, reopenHint(horizonEnd, last)].map(({ key, date, at, channel, title, body, actions, slot, rank, exact, revision, token, critical }) => ({ key, date, at, channel, title, body, actions, slot, rank, exact, revision, token, critical }))
    const revisions = reminderRevisions(plans, logs, st.settings, extras)
    for (const r of reminders.filter((r) => r.key === 'open-app')) revisions[`${r.date}|${r.key}`] = r.revision
    await AnkerNative.syncReminders({ reminders, relevant: Object.keys(revisions), revisions, policy: reminderPolicy(plans, st.settings) })
  }, undefined)
}

/** Knöpfe in Meldungen wirken auch bei geschlossener App: Hier werden sie im Store nachgetragen. */
let activeDrain: Promise<void> | undefined

export function drainActions(): Promise<void> {
  if (activeDrain) return activeDrain
  const task = (async () => {
    for (;;) {
      const { actions } = await AnkerNative.drainReminderActions()
      if (!actions.length) return
      const ids: string[] = []
      let failure: unknown
      let legacy = false
      for (const a of actions) {
        const id = a?.id
        if (typeof id !== 'string' || !id || id.length > 256) { legacy = true; continue }
        if (!validReminderAction(a)) { ids.push(id); legacy = true; continue }
        try {
          await applyAction(a)
          ids.push(a.id)
        } catch (error) { failure = error; break }
      }
      if (ids.length) await AnkerNative.ackReminderActions({ ids })
      if (legacy) useApp.getState().showToast('Eine ältere Rückmeldung konnte nicht sicher zugeordnet werden. Bitte prüfe den Eintrag in Anker.')
      if (failure) throw failure
      // Unknown legacy records without an ID need native migration; never spin or apply them blindly.
      if (!ids.length || legacy) return
    }
  })().catch((error: unknown) => {
    console.warn('[Anker] Erinnerungsrückmeldung bleibt zur erneuten Verarbeitung erhalten.', error)
    useApp.getState().showToast('Deine Rückmeldung konnte noch nicht gespeichert werden. Anker versucht es beim nächsten Öffnen erneut.')
  }).finally(() => { if (activeDrain === task) activeDrain = undefined })
  activeDrain = task
  return task
}

export async function applyAction(a: ReminderActionInfo) {
  return useApp.getState().applyReminderAction(a)
}
