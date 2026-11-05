import { LocalNotifications } from '@capacitor/local-notifications'
import { buildReminders, relevantReminderKeys, reopenHint } from '../core/reminders/build'
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
    const logs: Record<string, DayLog | undefined> = Object.fromEntries(dates.map((d) => [d, st.days[d]]))
    const now = Date.now()
    const deadlines = st.local.work.filter((w) => w.deadline && !w.done).map((w) => ({ id: w.id, at: w.deadline! }))
    const horizonEnd = zonedToUtc(dates[dates.length - 1]!, 18 * 60)
    const specs = buildReminders(plans, logs, st.settings, now, horizonEnd - now, { deadlines })
    const last = dates[dates.length - 1]!
    const reminders = [...specs, reopenHint(horizonEnd, last)].map(({ key, date, at, channel, title, body, actions, slot, rank, exact }) => ({ key, date, at, channel, title, body, actions, slot, rank, exact }))
    const relevant = [
      ...relevantReminderKeys(plans, logs, st.settings),
      ...reminders.filter((r) => r.key.startsWith('deadline') || r.key === 'open-app').map((r) => `${r.date}|${r.key}`),
    ]
    await AnkerNative.syncReminders({ reminders, relevant })
  }, undefined)
}

/** Knöpfe in Meldungen wirken auch bei geschlossener App: Hier werden sie im Store nachgetragen. */
export async function drainActions() {
  const { actions } = await safe(() => AnkerNative.drainReminderActions(), { actions: [] as ReminderActionInfo[] })
  for (const a of actions) await applyAction(a)
}

export async function applyAction(a: ReminderActionInfo) {
  const st = useApp.getState()
  const { key, date } = a
  if (key.startsWith('go:') && a.action === 'done') {
    const id = key.slice(3)
    return st.saveLocal((l) => ({ ...l, commitments: l.commitments.map((c) => (c.id === id ? { ...c, leftAt: a.at } : c)) }))
  }
  if (a.action === 'done') {
    if (key === 'leave') return st.mark(date, 'leftAt', a.at)
    if (key === 'pcstop') return st.mark(date, 'pcOffAt', a.at)
    if (key === 'bed') return st.mark(date, 'bedAt', a.at)
    if (key === 'evening') return st.mark(date, 'eveningRoutineDoneAt', a.at)
  }
  await st.updateDay(date, (l) => ({ ...l, dismissed: [...new Set([...(l.dismissed ?? []), key])] }))
}
