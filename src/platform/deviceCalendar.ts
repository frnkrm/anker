import { deviceCalendarSelectionId, type CalendarStatus } from '../core/extras'
import { addDays, zonedToUtc } from '../core/time'
import type { CalendarEvent } from '../core/types'
import { today, useApp } from '../state/store'
import { AnkerNative, isNative, type DeviceCalendarOption } from './native'
import { calendarSourceRevision, invalidateCalendarSource } from './calendarSource'

let reads = 0
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const instant = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253_402_300_799_999
const choice = () => useApp.getState().local.extras?.deviceCalendar
const sameChoice = (value: ReturnType<typeof choice>) => JSON.stringify(choice()) === JSON.stringify(value)
export const deviceCalendarSelected = (): boolean => choice()?.enabled === true

class DeviceCalendarFailure extends Error {
  constructor(readonly issue: NonNullable<CalendarStatus['issue']>) { super(issue) }
}
function selectedIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 20 && ids.every(deviceCalendarSelectionId)
    && new Set(ids).size === ids.length && new Set(ids.map(id => id.slice(0, id.indexOf(':')))).size === ids.length
}
function day(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DeviceCalendarFailure('invalid-response')
  const parsed = Date.parse(value + 'T00:00:00Z')
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new DeviceCalendarFailure('invalid-response')
  return value
}
function events(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value) || value.length > 2000) throw new DeviceCalendarFailure('invalid-response')
  const result = new Map<string, CalendarEvent>()
  for (const row of value) {
    if (!object(row) || typeof row.id !== 'string' || !row.id || row.id.length > 500 || typeof row.title !== 'string' || row.title.length > 500
      || !instant(row.start) || !instant(row.end) || row.end <= row.start || typeof row.allDay !== 'boolean') throw new DeviceCalendarFailure('invalid-response')
    let start = row.start, end = row.end
    if (row.allDay) {
      const startDate = day(row.startDate), endDate = day(row.endDate)
      if (new Date(start).toISOString().slice(0, 10) !== startDate || new Date(end).toISOString().slice(0, 10) !== endDate) throw new DeviceCalendarFailure('invalid-response')
      start = zonedToUtc(startDate, 0); end = zonedToUtc(endDate, 0)
      if (end <= start) throw new DeviceCalendarFailure('invalid-response')
    }
    if (result.has(row.id)) throw new DeviceCalendarFailure('invalid-response')
    result.set(row.id, { id: row.id, title: row.title.trim() || 'Termin', start, end, allDay: row.allDay })
  }
  return [...result.values()]
}
function issue(error: unknown): NonNullable<CalendarStatus['issue']> {
  if (error instanceof DeviceCalendarFailure) return error.issue
  const message = error instanceof Error ? error.message : ''
  return ['DEVICE_CALENDAR_PERMISSION_REQUIRED', 'DEVICE_CALENDAR_SELECTION_CHANGED'].includes(message) ? 'permission' : 'network'
}
async function failed(reason: CalendarStatus['issue'], current: () => boolean): Promise<void> {
  await useApp.getState().saveLocal(local => !current() ? local : { ...local, extras: { ...local.extras, calendar: {
    state: useApp.getState().events.length ? 'stale' : 'error', checkedAt: Date.now(), issue: reason,
    fetchedAt: local.extras?.calendar?.fetchedAt, writtenAt: local.extras?.calendar?.writtenAt,
  } } })
}

/** Only the explicit selection button may request Android's permission dialog. */
export async function deviceCalendarOptions(request = false, accept = () => true): Promise<{ granted: boolean; calendars: DeviceCalendarOption[] }> {
  if (!isNative() || !accept()) return { granted: false, calendars: [] }
  const permission = await AnkerNative.deviceCalendarPermission({ request })
  if (!accept() || permission.granted !== true) return { granted: false, calendars: [] }
  const response = await AnkerNative.listDeviceCalendars()
  if (!accept()) return { granted: false, calendars: [] }
  if (!Array.isArray(response.calendars) || response.calendars.length > 100) throw new DeviceCalendarFailure('invalid-response')
  const ids = new Set<string>()
  const calendars = response.calendars.map(row => {
    if (!object(row) || !deviceCalendarSelectionId(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 300
      || typeof row.account !== 'string' || !row.account.trim() || row.account.length > 300 || ids.has(row.id)) throw new DeviceCalendarFailure('invalid-response')
    ids.add(row.id)
    return { id: row.id, name: row.name, account: row.account }
  })
  return { granted: true, calendars }
}

/** Native CalendarProvider reads require no OAuth client, service account or external request. */
export async function refreshDeviceCalendar(): Promise<boolean> {
  const selected = structuredClone(choice())
  if (!isNative() || !selected?.enabled || !useApp.getState().settings.integrations.googleCalendar) return false
  const request = ++reads, source = calendarSourceRevision()
  const current = () => request === reads && source === calendarSourceRevision() && sameChoice(selected)
    && useApp.getState().settings.integrations.googleCalendar && deviceCalendarSelected()
  try {
    if (!selectedIds(selected.calendarIds)) throw new DeviceCalendarFailure('invalid-response')
    const permission = await AnkerNative.deviceCalendarPermission({ request: false })
    if (!current()) return false
    if (permission.granted !== true) throw new DeviceCalendarFailure('permission')
    const date = today(), from = zonedToUtc(date, 0), to = zonedToUtc(addDays(date, 3), 0)
    const response = await AnkerNative.readDeviceCalendarEvents({ calendarIds: [...selected.calendarIds], from, to })
    if (!current()) return false
    if (!instant(response.readAt)) throw new DeviceCalendarFailure('invalid-response')
    const snapshot = events(response.events)
    return await useApp.getState().applyCalendarSnapshot(snapshot, { state: 'ready', fetchedAt: response.readAt, checkedAt: Date.now(),
      writtenAt: useApp.getState().local.extras?.calendar?.writtenAt }, current)
  } catch (error) { await failed(issue(error), current); return false }
}

/** Mode selection is explicit and guards every queued Store write against a newer choice. */
export async function connectDeviceCalendars(calendarIds: string[], accept = () => true): Promise<boolean> {
  if (!isNative() || !selectedIds(calendarIds) || !accept()) return false
  const source = invalidateCalendarSource(); reads++
  const current = () => source === calendarSourceRevision() && accept()
  const permission = await AnkerNative.deviceCalendarPermission({ request: false })
  if (!current() || permission.granted !== true) return false
  const before = structuredClone(choice()), selectedAt = Date.now()
  const selected = { enabled: true, calendarIds: [...calendarIds].sort(), selectedAt }
  await useApp.getState().saveLocal(local => !current() ? local : { ...local, extras: { ...local.extras, deviceCalendar: selected,
    calendar: { ...local.extras?.calendar, state: useApp.getState().events.length ? 'stale' : 'loading', checkedAt: Date.now(), issue: undefined } } })
  if (!current()) return false
  try {
    await useApp.getState().saveSettings(settings => !current() || !sameChoice(selected) ? settings : { ...settings, integrations: { ...settings.integrations, googleCalendar: true } })
  } catch (error) {
    await useApp.getState().saveLocal(local => !current() || !sameChoice(selected) ? local : { ...local, extras: { ...local.extras, deviceCalendar: before } })
    throw error
  }
  if (!current() || !sameChoice(selected)) return false
  return refreshDeviceCalendar()
}

export async function disconnectDeviceCalendars(): Promise<void> {
  const source = invalidateCalendarSource(); reads++
  const current = () => source === calendarSourceRevision()
  await useApp.getState().saveLocal(local => !current() ? local : { ...local, extras: { ...local.extras,
    deviceCalendar: { enabled: false, calendarIds: [], selectedAt: Date.now() } } })
  if (!current()) return
  await useApp.getState().saveSettings(settings => !current() ? settings : { ...settings, integrations: { ...settings.integrations, googleCalendar: false } })
  if (current()) await useApp.getState().applyCalendarSnapshot([], { state: 'disconnected', checkedAt: Date.now(),
    writtenAt: useApp.getState().local.extras?.calendar?.writtenAt }, current)
}
