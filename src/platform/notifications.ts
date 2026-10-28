import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications'
import { buildReminders, idsForKey, MAX_SNOOZE, snoozeId, type ReminderSpec } from '../core/reminders/build'
import { addDays } from '../core/time'
import type { DayLog } from '../core/types'
import { planFor, today, useApp } from '../state/store'
import { isNative, safe } from './native'

const ACTION_TYPE = 'anker-actions'
const CHANNELS = {
  wecker: { id: 'wecker', name: 'Wecker', importance: 5 as const, description: 'Aufstehen und dringende Erinnerungen' },
  uebergang: { id: 'uebergang', name: 'Übergänge', importance: 4 as const, description: 'Losgehen, PC-Stopp, Bett' },
  sanft: { id: 'sanft', name: 'Sanft', importance: 3 as const, description: 'Freundliche Hinweise' },
}

let setupDone = false

export async function setupNotifications() {
  if (!isNative() || setupDone) return
  setupDone = true
  await safe(async () => {
    for (const c of Object.values(CHANNELS)) {
      await LocalNotifications.createChannel({ ...c, visibility: 1, vibration: true, lights: true })
    }
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE,
          actions: [
            { id: 'done', title: 'Erledigt' },
            { id: 'snooze', title: '5 Min später' },
            { id: 'skip', title: 'Heute nicht' },
          ],
        },
      ],
    })
    await LocalNotifications.addListener('localNotificationActionPerformed', handleAction)
  }, undefined)
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
  return safe(async () => ((await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted' ? 'granted' : 'denied'), 'prompt' as 'granted' | 'denied' | 'prompt')
}

export async function openExactAlarmSettings() {
  if (isNative()) await safe(() => LocalNotifications.changeExactNotificationSetting(), undefined)
}

/** Plant alle Erinnerungen der nächsten 48 h neu (App-Start, Planänderung, Geräte-Neustart). */
export async function rescheduleAll() {
  if (!isNative()) return
  await safe(async () => {
    const st = useApp.getState()
    if (!st.settings.onboarded) return
    const t = today()
    const dates = [t, addDays(t, 1), addDays(t, 2)]
    const plans = dates.map((d) => planFor(d))
    const logs: Record<string, DayLog | undefined> = Object.fromEntries(dates.map((d) => [d, st.days[d]]))
    const specs = buildReminders(plans, logs, st.settings, Date.now())

    // Verschobene („5 Min später“) Erinnerungen bleiben stehen
    const pending = (await LocalNotifications.getPending()).notifications.filter((n) => !(n.extra as { snoozes?: number } | undefined)?.snoozes)
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
    if (!specs.length) return
    await LocalNotifications.schedule({ notifications: specs.map(toNotification) })
  }, undefined)
}

function toNotification(r: ReminderSpec) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    channelId: r.channel,
    schedule: { at: new Date(r.at), allowWhileIdle: true },
    actionTypeId: r.actions ? ACTION_TYPE : undefined,
    smallIcon: 'ic_stat_anker',
    autoCancel: true,
    extra: { key: r.key, date: r.date, title: r.title, body: r.body, channel: r.channel },
  }
}

async function handleAction(a: ActionPerformed) {
  const extra = (a.notification.extra ?? {}) as { key?: string; date?: string; title?: string; body?: string; channel?: string; snoozes?: number }
  const { key, date } = extra
  if (!key || !date) return
  const st = useApp.getState()
  if (a.actionId === 'done') {
    await LocalNotifications.cancel({ notifications: idsForKey(date, key).map((id) => ({ id })) })
    if (key === 'leave') await st.mark(date, 'leftAt')
    else if (key === 'pcstop') await st.mark(date, 'pcOffAt')
    else if (key === 'bed') await st.mark(date, 'bedAt')
    else if (key === 'evening') await st.mark(date, 'eveningRoutineDoneAt')
    else await st.updateDay(date, (l) => ({ ...l, dismissed: [...(l.dismissed ?? []), key] }))
  } else if (a.actionId === 'skip') {
    await LocalNotifications.cancel({ notifications: idsForKey(date, key).map((id) => ({ id })) })
    await st.updateDay(date, (l) => ({ ...l, dismissed: [...(l.dismissed ?? []), key] }))
  } else if (a.actionId === 'snooze') {
    const n = (extra.snoozes ?? 0) + 1
    if (n > MAX_SNOOZE) return
    await LocalNotifications.cancel({ notifications: idsForKey(date, key).map((id) => ({ id })) })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: snoozeId(date, key, n),
          title: extra.title ?? 'Erinnerung',
          body: n === MAX_SNOOZE ? `${extra.body ?? ''} (letztes Mal verschoben)` : (extra.body ?? ''),
          channelId: extra.channel ?? 'uebergang',
          schedule: { at: new Date(Date.now() + 5 * 60_000), allowWhileIdle: true },
          actionTypeId: n < MAX_SNOOZE ? ACTION_TYPE : undefined,
          smallIcon: 'ic_stat_anker',
          extra: { ...extra, snoozes: n },
        },
      ],
    })
  }
}
