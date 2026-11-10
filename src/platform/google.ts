import { SocialLogin } from '@capgo/capacitor-social-login'
import type { CalendarStatus } from '../core/extras'
import { recurringEntries } from '../core/export/ics'
import { addDays, zonedToUtc, type DateStr } from '../core/time'
import type { CalendarEvent } from '../core/types'
import { planFor, today, useApp } from '../state/store'
import { safe } from './native'
import { calendarSourceRevision, invalidateCalendarSource } from './calendarSource'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined
export const GOOGLE_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
/** Nur Kalender, die diese App selbst angelegt hat; kein Schreibrecht auf fremde Termine. */
export const GOOGLE_WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_KEY = 'anker.google'
export const googleConfigured = !!CLIENT_ID
let initialized = false
let authGeneration = 0
let readGeneration = 0
let writeGeneration = 0

interface Token { token: string; exp: number; scopes?: string[]; accountId?: string }
function storedToken(): Token | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || !('token' in value) || !('exp' in value)) return null
    const token = value as Token
    if (token.scopes !== undefined && (!Array.isArray(token.scopes) || !token.scopes.every((scope) => typeof scope === 'string'))) return null
    if (token.accountId !== undefined && (typeof token.accountId !== 'string' || !token.accountId)) return null
    return typeof token.token === 'string' && !!token.token && Number.isFinite(token.exp) && Number.isFinite(new Date(token.exp).getTime()) && token.exp > Date.now() + 60_000 ? token : null
  } catch { return null }
}
async function init() {
  if (initialized || !CLIENT_ID) return
  await SocialLogin.initialize({ google: { webClientId: CLIENT_ID, mode: 'online' } })
  initialized = true
}
/** Nur auf bewussten Anmeldetipp; ein abgelaufener Zugang startet nie heimlich einen Login. */
export async function connectGoogle(write = false, accept: () => boolean = () => true): Promise<boolean> {
  if (!CLIENT_ID || !accept()) return false
  const generation = ++authGeneration
  invalidateCalendarRequests()
  const source = calendarSourceRevision()
  const current = () => generation === authGeneration && accept() && (write || source === calendarSourceRevision())
  return safe(async () => {
    await init()
    if (!current()) return false
    const requested = write ? [GOOGLE_READ_SCOPE, GOOGLE_WRITE_SCOPE] : [GOOGLE_READ_SCOPE]
    const response = await SocialLogin.login({ provider: 'google', options: { scopes: requested, prompt: 'consent' } })
    if (!current() || response.provider !== 'google' || !('accessToken' in response.result)) return false
    const access = response.result.accessToken
    if (!access?.token || access.isExpired) return false
    const scopes = (access.permissions ?? requested).filter((scope) => !access.declinedPermissions?.includes(scope))
    if (!scopes.includes(GOOGLE_READ_SCOPE) || (write && !scopes.includes(GOOGLE_WRITE_SCOPE))) return false
    if (write && !response.result.profile.id) return false
    const numericExpiry = Number(access.expires)
    const parsedExpiry = access.expires ? Number.isFinite(numericExpiry) && numericExpiry > 0 ? numericExpiry < 1e12 ? numericExpiry * 1000 : numericExpiry : Date.parse(access.expires) : NaN
    const exp = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 55 * 60_000
    if (exp <= Date.now() + 60_000) return false
    // A read-source switch is explicit. Separate authorization for writing the
    // app's own calendar must not disconnect the selected device calendars.
    if (!write && useApp.getState().local.extras?.deviceCalendar?.enabled) {
      await useApp.getState().saveLocal(local => !current() ? local : { ...local, extras: { ...local.extras,
        deviceCalendar: { enabled: false, calendarIds: [], selectedAt: Date.now() } } })
      if (!current()) return false
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: access.token, exp, scopes, accountId: response.result.profile.id ?? undefined } satisfies Token))
    return true
  }, false)
}
export const googleConnected = (): boolean => !!storedToken()
export const googleWriteAuthorized = (): boolean => storedToken()?.scopes?.includes(GOOGLE_WRITE_SCOPE) === true
export function invalidateCalendarRequests(): void { readGeneration++; writeGeneration++; invalidateCalendarSource() }
export async function disconnectGoogle() {
  authGeneration++; invalidateCalendarRequests()
  localStorage.removeItem(TOKEN_KEY)
  await safe(async () => { await init(); await SocialLogin.logout({ provider: 'google' }) }, undefined)
}
class CalendarFailure extends Error {
  constructor(readonly issue: NonNullable<CalendarStatus['issue']>) { super(issue) }
}
async function api<T>(path: string, token: Token, options: RequestInit = {}): Promise<T> {
  let response: Response
  try { response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json', ...options.headers } }) }
  catch { throw new CalendarFailure('network') }
  if (response.status === 401) {
    if (storedToken()?.token === token.token) localStorage.removeItem(TOKEN_KEY)
    throw new CalendarFailure('auth')
  }
  if (response.status === 403) throw new CalendarFailure('permission')
  if (!response.ok) throw new CalendarFailure('network')
  try { return (response.status === 204 ? {} : await response.json()) as T }
  catch { throw new CalendarFailure('invalid-response') }
}
interface GEvent {
  id: string; summary?: string; status?: string
  start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function parseEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) throw new CalendarFailure('invalid-response')
  const result: CalendarEvent[] = []
  for (const raw of value) {
    if (!object(raw) || typeof raw.id !== 'string' || !raw.id) throw new CalendarFailure('invalid-response')
    if (raw.status === 'cancelled') continue
    if (!object(raw.start) || !object(raw.end)) throw new CalendarFailure('invalid-response')
    const event = raw as unknown as GEvent
    if (event.status === 'cancelled' || event.extendedProperties?.private?.anker) continue
    const allDay = typeof event.start.date === 'string'
    const start = allDay ? zonedToUtc(event.start.date!, 0) : Date.parse(event.start.dateTime ?? '')
    const end = allDay && event.end.date ? zonedToUtc(event.end.date, 0) : Date.parse(event.end.dateTime ?? '')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new CalendarFailure('invalid-response')
    result.push({ id: event.id, title: typeof event.summary === 'string' ? event.summary : 'Termin', start, end, allDay })
  }
  return result
}
async function failedCalendar(issue: CalendarStatus['issue'], stillCurrent: () => boolean): Promise<void> {
  await useApp.getState().saveLocal((local) => !stillCurrent() ? local : ({ ...local, extras: { ...local.extras, calendar: {
    state: useApp.getState().events.length ? 'stale' : 'error', fetchedAt: local.extras?.calendar?.fetchedAt,
    checkedAt: Date.now(), issue, writtenAt: local.extras?.calendar?.writtenAt,
  } } }))
}
/** Alle Seiten vollständig validieren; alte Termine bleiben bei Fehlern mit sichtbarem Aktualitätsstatus erhalten. */
export async function refreshCalendar(): Promise<boolean> {
  const st = useApp.getState()
  if (!st.settings.integrations.googleCalendar) return false
  if (st.local.extras?.deviceCalendar?.enabled) return (await import('./deviceCalendar')).refreshDeviceCalendar()
  const request = ++readGeneration
  const auth = authGeneration
  const source = calendarSourceRevision()
  const token = storedToken()
  const intent = () => request === readGeneration && auth === authGeneration && source === calendarSourceRevision()
    && !useApp.getState().local.extras?.deviceCalendar?.enabled && useApp.getState().settings.integrations.googleCalendar
  if (!token) { await failedCalendar('auth', intent); return false }
  const current = () => intent() && storedToken()?.token === token.token
  try {
    const from = today()
    const query = `singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${encodeURIComponent(new Date(zonedToUtc(from, 0)).toISOString())}&timeMax=${encodeURIComponent(new Date(zonedToUtc(addDays(from, 3), 0)).toISOString())}`
    const events = new Map<string, CalendarEvent>()
    const seen = new Set<string>()
    let pageToken = ''
    do {
      if (!current()) return false
      const response = await api<{ items?: unknown; nextPageToken?: unknown }>(`/calendars/primary/events?${query}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token)
      if (!object(response)) throw new CalendarFailure('invalid-response')
      for (const event of parseEvents(response.items ?? [])) events.set(event.id, event)
      if (response.nextPageToken !== undefined && typeof response.nextPageToken !== 'string') throw new CalendarFailure('invalid-response')
      pageToken = response.nextPageToken as string || ''
      if (pageToken && (seen.has(pageToken) || seen.size >= 100)) throw new CalendarFailure('invalid-response')
      if (pageToken) seen.add(pageToken)
    } while (pageToken)
    if (!current()) return false
    return await useApp.getState().applyCalendarSnapshot([...events.values()], { state: 'ready', fetchedAt: Date.now(), checkedAt: Date.now(), writtenAt: useApp.getState().local.extras?.calendar?.writtenAt }, current)
  } catch (error) { await failedCalendar(error instanceof CalendarFailure ? error.issue : 'network', intent); return false }
}
/** Google erlaubt eigene Event-IDs aus [a-v0-9]; Terminart und stabile Block-ID unterscheiden Instanzen. */
function eventId(date: DateStr, id: string): string {
  return Array.from(`anker${date.replace(/-/g, '')}${id}`.toLowerCase(), (char) => /[a-v0-9]/.test(char) ? char : (char.charCodeAt(0) % 32).toString(32)).join('')
}
/** Nur nach zusätzlicher Schreibfreigabe: eigener app-erstellter Kalender, niemals fremde gleichnamige Kalender übernehmen. */
export async function writeAnkerBlocks(): Promise<boolean> {
  const st = useApp.getState()
  if (!st.settings.integrations.writeCalendar) return false
  const token = storedToken()
  const request = ++writeGeneration
  const auth = authGeneration
  const intent = () => request === writeGeneration && auth === authGeneration && useApp.getState().settings.integrations.writeCalendar
  if (!token || !token.scopes?.includes(GOOGLE_WRITE_SCOPE) || !token.accountId) { await failedCalendar('auth', intent); return false }
  const current = () => intent() && storedToken()?.token === token.token
  try {
    const previous = st.local.extras?.ownCalendar
    let calendarId = previous?.accountId === token.accountId ? previous.id : undefined
    if (!calendarId) {
      const created = await api<{ id?: unknown }>('/calendars', token, { method: 'POST', body: JSON.stringify({ summary: 'Anker', timeZone: 'Europe/Berlin' }) })
      if (!current()) return false
      if (typeof created.id !== 'string' || !created.id) throw new CalendarFailure('invalid-response')
      calendarId = created.id
      await useApp.getState().saveLocal((local) => !current() ? local : ({ ...local, extras: { ...local.extras, ownCalendar: { id: created.id as string, accountId: token.accountId! } } }))
    }
    const calendar = encodeURIComponent(calendarId)
    const kinds = new Set(recurringEntries(st.settings, today()).map((event) => event.title))
    for (const date of [today(), addDays(today(), 1)]) {
      for (const block of planFor(date).blocks) {
        if (!current()) return false
        if (!kinds.has(block.title)) continue
        const body = { id: eventId(date, block.id), summary: block.title,
          start: { dateTime: new Date(zonedToUtc(date, block.start)).toISOString(), timeZone: 'Europe/Berlin' },
          end: { dateTime: new Date(zonedToUtc(date, Math.max(block.start + 5, block.end))).toISOString(), timeZone: 'Europe/Berlin' },
          transparency: 'transparent', extendedProperties: { private: { anker: '1' } }, reminders: { useDefault: false, overrides: [] } }
        let response: Response
        try { response = await fetch(`${API}/calendars/${calendar}/events/${body.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
        catch { throw new CalendarFailure('network') }
        if (response.status === 404) await api(`/calendars/${calendar}/events`, token, { method: 'POST', body: JSON.stringify(body) })
        else if (response.status === 401) { if (storedToken()?.token === token.token) localStorage.removeItem(TOKEN_KEY); throw new CalendarFailure('auth') }
        else if (response.status === 403) throw new CalendarFailure('permission')
        else if (!response.ok) throw new CalendarFailure('network')
      }
    }
    if (!current()) return false
    await useApp.getState().saveLocal((local) => !current() ? local : ({ ...local, extras: { ...local.extras, calendar: {
      ...local.extras?.calendar, state: local.extras?.calendar?.state ?? 'disconnected', checkedAt: Date.now(), writtenAt: Date.now(),
    } } }))
    return current()
  } catch (error) { await failedCalendar(error instanceof CalendarFailure ? error.issue : 'network', intent); return false }
}
