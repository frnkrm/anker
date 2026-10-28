import { SocialLogin } from '@capgo/capacitor-social-login'
import { recurringEntries } from '../core/export/ics'
import { addDays, zonedToUtc, type DateStr } from '../core/time'
import type { CalendarEvent } from '../core/types'
import { planFor, today, useApp } from '../state/store'
import { safe } from './native'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']
const API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_KEY = 'anker.google'

export const googleConfigured = !!CLIENT_ID
let initialized = false

interface Token {
  token: string
  exp: number
}

function storedToken(): Token | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null
    return t && t.exp > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
}

async function init() {
  if (initialized || !CLIENT_ID) return
  await SocialLogin.initialize({ google: { webClientId: CLIENT_ID, mode: 'online' } })
  initialized = true
}

/** Google-Login mit Kalender-Rechten. Gibt true zurück, wenn ein Zugriffstoken vorliegt. */
export async function connectGoogle(): Promise<boolean> {
  if (!CLIENT_ID) return false
  return safe(async () => {
    await init()
    const r = await SocialLogin.login({ provider: 'google', options: { scopes: SCOPES } })
    const token = r.provider === 'google' && 'accessToken' in r.result ? r.result.accessToken?.token : undefined
    if (!token) return false
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60_000 }))
    return true
  }, false)
}

export function googleConnected(): boolean {
  return !!storedToken()
}

export async function disconnectGoogle() {
  localStorage.removeItem(TOKEN_KEY)
  await safe(async () => {
    await init()
    await SocialLogin.logout({ provider: 'google' })
  }, undefined)
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = storedToken()
  if (!t) throw new Error('Google nicht verbunden')
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json', ...init.headers } })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    throw new Error('Google-Anmeldung abgelaufen')
  }
  if (!res.ok && res.status !== 409) throw new Error(`Google ${res.status}`)
  return (res.status === 204 ? {} : await res.json()) as T
}

interface GEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status?: string
  extendedProperties?: { private?: Record<string, string> }
}

/** Liest Termine für heute bis übermorgen und speichert sie für den Tagesplan. Still bei Fehlern. */
export async function refreshCalendar(): Promise<boolean> {
  const st = useApp.getState()
  if (!st.settings.integrations.googleCalendar || !googleConnected()) return false
  return safe(async () => {
    const from = today()
    const timeMin = new Date(zonedToUtc(from, 0)).toISOString()
    const timeMax = new Date(zonedToUtc(addDays(from, 3), 0)).toISOString()
    const r = await api<{ items: GEvent[] }>(`/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
    const events: CalendarEvent[] = (r.items ?? [])
      .filter((e) => e.status !== 'cancelled' && !e.extendedProperties?.private?.anker)
      .map((e) => {
        const allDay = !!e.start.date
        const start = allDay ? zonedToUtc(e.start.date!, 0) : Date.parse(e.start.dateTime!)
        const end = allDay ? zonedToUtc(e.end.date!, 0) : Date.parse(e.end.dateTime!)
        return { id: e.id, title: e.summary ?? 'Termin', start, end, allDay }
      })
    await st.setEvents(events)
    return true
  }, false)
}

async function ankerCalendarId(): Promise<string> {
  const list = await api<{ items: { id: string; summary: string }[] }>('/users/me/calendarList')
  const found = list.items.find((c) => c.summary === 'Anker')
  if (found) return found.id
  const created = await api<{ id: string }>('/calendars', { method: 'POST', body: JSON.stringify({ summary: 'Anker', timeZone: 'Europe/Berlin' }) })
  return created.id
}

/** Google erlaubt eigene Event-IDs aus [a-v0-9]. */
function eventId(date: DateStr, kind: string): string {
  const raw = `anker${date.replace(/-/g, '')}${kind}`
  return Array.from(raw.toLowerCase(), (ch) => (/[a-v0-9]/.test(ch) ? ch : (ch.charCodeAt(0) % 32).toString(32))).join('')
}

/** Schreibt die Routine-Blöcke der nächsten 2 Tage in den Kalender „Anker“. */
export async function writeAnkerBlocks(): Promise<boolean> {
  const st = useApp.getState()
  if (!st.settings.integrations.writeCalendar || !googleConnected()) return false
  return safe(async () => {
    const cal = encodeURIComponent(await ankerCalendarId())
    const kinds = new Set(recurringEntries(st.settings, today()).map((e) => e.title))
    for (const d of [today(), addDays(today(), 1)]) {
      for (const b of planFor(d).blocks) {
        if (!kinds.has(b.title)) continue
        const end = b.end > b.start ? b.end : b.start + 5
        const body = {
          id: eventId(d, b.kind),
          summary: b.title,
          start: { dateTime: new Date(zonedToUtc(d, b.start)).toISOString(), timeZone: 'Europe/Berlin' },
          end: { dateTime: new Date(zonedToUtc(d, end)).toISOString(), timeZone: 'Europe/Berlin' },
          transparency: 'transparent',
          extendedProperties: { private: { anker: '1' } },
          reminders: { useDefault: false, overrides: [] },
        }
        const res = await fetch(`${API}/calendars/${cal}/events/${body.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${storedToken()!.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.status === 404) await api(`/calendars/${cal}/events`, { method: 'POST', body: JSON.stringify(body) })
      }
    }
    return true
  }, false)
}
