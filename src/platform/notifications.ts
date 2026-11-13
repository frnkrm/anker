import { LocalNotifications } from '@capacitor/local-notifications'
import { coalesceAsync } from '../core/coalesced'
import { buildReminders, reminderPolicy, reminderRevisions, reopenHint } from '../core/reminders/build'
import { validReminderAction } from '../core/reminders/actions'
import { knownReminderDates } from '../core/reminders/dates'
import { buildReminderRuleSnapshot } from '../core/reminders/rules'
import { guidancePreferences } from '../core/guidance'
import { pcBridgeSnapshot } from './pcLink'
import { DAY_ROLLOVER_MIN } from '../core/now'
import { addDays, zonedToUtc } from '../core/time'
import { taskIsOpen } from '../core/tasks'
import type { DayLog } from '../core/types'
import { planFor, today, useApp } from '../state/store'
import { AnkerNative, isNative, safe, type ReminderActionInfo } from './native'

/** Minimum dated planning; known future exceptions are compiled as dated plans too. */
export const HORIZON_DAYS = 14

let setupDone = false
let activeSetup: Promise<void> | undefined
let legacyCleanupStarted = false

export function setupNotifications(): Promise<void> {
  if (!isNative()) return Promise.resolve()
  if (activeSetup) return activeSetup
  if (setupDone) return Promise.resolve()
  const task = (async () => {
    if (!legacyCleanupStarted) {
      legacyCleanupStarted = true
      await safe(cleanupLegacy, undefined)
    }
    await AnkerNative.addListener('reminderAction', () => void drainActions())
    setupDone = true
    await drainActions()
  })().finally(() => { if (activeSetup === task) activeSetup = undefined })
  activeSetup = task
  return task
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

let activeSchedule: Promise<void> | undefined
let scheduleAgain = false

/** Serialize native snapshots; rapid edits must leave the newest plan last. */
export function rescheduleAll(): Promise<void> {
  if (!isNative()) return Promise.resolve()
  scheduleAgain = true
  if (activeSchedule) return activeSchedule
  const task = (async () => {
    do { scheduleAgain = false; await scheduleSnapshot() } while (scheduleAgain)
    // Clear before resolving, so a change in the next microtask starts a fresh pass.
    activeSchedule = undefined
  })().finally(() => { if (activeSchedule === task) activeSchedule = undefined })
  activeSchedule = task
  return task
}

/** Dated plans and critical weekly continuation share the existing native queue. */
async function scheduleSnapshot() {
  if (!isNative()) return
  await safe(async () => {
    const st = useApp.getState()
    if (!st.settings.onboarded) return
    const t = today()
    const ordinaryDates = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(t, i))
    const knownDates = knownReminderDates(t, st.days, st.events, st.local.commitments)
    const dates = [...new Set([...ordinaryDates, ...knownDates])].sort()
    const plans = dates.map((d) => planFor(d))
    // Auch ältere offene Gedanken behalten ihre Dismissals und ihre sichtbare Meldung,
    // bis sie in der Inbox erledigt, anders einsortiert oder abgewählt werden.
    const logs: Record<string, DayLog | undefined> = st.days
    const now = Date.now()
    const deadlines = st.local.work.filter((w) => w.deadline && taskIsOpen(w)).map((w) => ({ id: w.id, at: w.deadline!, reminderRevision: w.reminderRevision }))
    const horizonEnd = zonedToUtc(addDays(ordinaryDates[ordinaryDates.length - 1]!, 1), DAY_ROLLOVER_MIN)
    const datedEnd = zonedToUtc(addDays(dates[dates.length - 1]!, 1), DAY_ROLLOVER_MIN)
    const extras = { deadlines, thoughtReviews: st.inbox, tomorrowSteps: st.local.tomorrowSteps }
    const specs = buildReminders(plans, logs, st.settings, now, datedEnd - now, extras)
    const last = ordinaryDates[ordinaryDates.length - 1]!
    const hintAt = zonedToUtc(last, 18 * 60)
    const reminders = [...specs, reopenHint(hintAt, last)].map(({ key, date, at, channel, title, body, actions, slot, rank, exact, revision, token, critical, quietFollowUps, validUntil }) => ({ key, date, at, channel, title, body, actions, slot, rank, exact, revision, token, critical, ...(quietFollowUps === true && key === 'bed' ? { quietFollowUps: true } : {}), ...(validUntil !== undefined ? { validUntil } : {}) }))
    const revisions = reminderRevisions(plans, logs, st.settings, extras)
    for (const r of reminders.filter((r) => r.key === 'open-app')) revisions[`${r.date}|${r.key}`] = r.revision
    const policy = reminderPolicy(plans, st.settings)
    const preferences = guidancePreferences(st.settings.guidance)
    if (preferences.enabled && preferences.suppressPhonePcWhenConfirmed && st.local.pcBridge?.enabled) {
      const wanted = pcBridgeSnapshot(now, await AnkerNative.getAlarmState())
      policy.pcConfirmation = { revision: wanted.revision, date: wanted.date, validUntil: Date.parse(wanted.validUntil) }
    }
    await AnkerNative.syncReminders({ reminders, relevant: Object.keys(revisions), revisions, policy, ruleSnapshot: buildReminderRuleSnapshot(st.settings, knownDates, horizonEnd) })
  }, undefined)
}

/** Knöpfe in Meldungen wirken auch bei geschlossener App: Hier werden sie im Store nachgetragen. */
export const drainActions = coalesceAsync(async () => {
  try {
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
  } catch {
    console.warn('[Anker] Erinnerungsrückmeldung bleibt zur erneuten Verarbeitung erhalten.')
    useApp.getState().showToast('Deine Rückmeldung konnte noch nicht gespeichert werden. Anker versucht es beim nächsten Öffnen erneut.')
  }
})

export async function applyAction(a: ReminderActionInfo) {
  return useApp.getState().applyReminderAction(a)
}

let focusUpdates: Promise<void> = Promise.resolve()
/** Preserve ordering when a step ends while the next one starts, or when leaving the page. */
export function mirrorReminderFocus(until: number): void {
  if (!isNative()) return
  focusUpdates = focusUpdates.catch(() => undefined).then(() => AnkerNative.setReminderFocus({ until })).catch(() => { console.warn('[Anker] Fokusruhe konnte nicht übernommen werden.') })
}
