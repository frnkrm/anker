import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import type { CalendarStatus } from '../core/extras'
import { buildDayPlan } from '../core/planner'
import type { CalendarEvent, LocalData, Settings } from '../core/types'

interface State {
  settings: Settings; local: LocalData; events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => Promise<void>
  saveLocal: (edit: (local: LocalData) => LocalData) => Promise<void>
  applyCalendarSnapshot: (events: CalendarEvent[], status: CalendarStatus, accept: () => boolean) => Promise<boolean>
}
const context = vi.hoisted(() => ({ state: undefined as State | undefined, login: vi.fn(), initialize: vi.fn(), logout: vi.fn() }))
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: { initialize: (...args: unknown[]) => context.initialize(...args), login: (...args: unknown[]) => context.login(...args), logout: (...args: unknown[]) => context.logout(...args) } }))
vi.mock('../state/store', () => ({ useApp: { getState: () => context.state! }, today: () => '2026-11-06', planFor: (date: string) => buildDayPlan({ date, settings: context.state!.settings }) }))
const readScope = 'https://www.googleapis.com/auth/calendar.readonly'
const writeScope = 'https://www.googleapis.com/auth/calendar.app.created'
const old: CalendarEvent = { id: 'old', title: 'Bleibt erhalten', start: 1000, end: 2000, allDay: false }
const remote = (id: string) => ({ id, summary: `Termin ${id}`, start: { dateTime: '2026-11-06T12:00:00+01:00' }, end: { dateTime: '2026-11-06T13:00:00+01:00' } })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let values: Map<string, string>
function token(scopes = [readScope]) { values.set('anker.google', JSON.stringify({ token: 'test-token', exp: Date.now() + 3600_000, scopes, accountId: 'person-1' })) }

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T10:00:00+01:00'))
  vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'test-client')
  values = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  context.initialize.mockReset().mockResolvedValue(undefined); context.logout.mockReset().mockResolvedValue(undefined)
  context.login.mockReset().mockImplementation(async ({ options }: { options: { scopes: string[] } }) => ({ provider: 'google', result: { accessToken: { token: 'new-token', permissions: options.scopes }, profile: { id: 'person-1' } } }))
  context.state = {
    settings: defaultSettings('2026-11-06'), local: emptyLocal(), events: [old],
    async setEvents(events) { context.state!.events = events },
    async saveLocal(edit) { context.state!.local = edit(structuredClone(context.state!.local)) },
    async applyCalendarSnapshot(events, status, accept) { if (!accept()) return false; context.state!.events = events; context.state!.local = { ...context.state!.local, extras: { ...context.state!.local.extras, calendar: status } }; return true },
  }
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe('Freiwilliger Googlezugriff ohne falsche Erfolge oder stille Datenverluste', () => {
  it('fordert Lesen zuerst an und Schreiben nur nach eigenem bewussten Aufruf', async () => {
    const google = await import('./google')
    expect(await google.connectGoogle()).toBe(true)
    expect(context.login.mock.calls[0]![0].options.scopes).toEqual([readScope])
    expect(google.googleWriteAuthorized()).toBe(false)
    expect(await google.connectGoogle(true)).toBe(true)
    expect(context.login.mock.calls[1]![0].options.scopes).toEqual([readScope, writeScope])
    expect(google.googleWriteAuthorized()).toBe(true)
  })
  it('lässt verweigerte zusätzliche Rechte ausgeschaltet', async () => {
    context.login.mockResolvedValueOnce({ provider: 'google', result: { accessToken: { token: 'denied-write', permissions: [readScope], declinedPermissions: [writeScope] }, profile: { id: 'person-1' } } })
    const google = await import('./google')
    expect(await google.connectGoogle(true)).toBe(false)
    expect(google.googleWriteAuthorized()).toBe(false)
  })
  it('bleibt bei abgeschaltetem Import auch mit vorhandenem Token vollständig offline', async () => {
    token(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(await (await import('./google')).refreshCalendar()).toBe(false)
    expect(fetch).not.toHaveBeenCalled(); expect(context.state!.events).toEqual([old])
  })
  it('übernimmt mehrere Seiten vollständig, dedupliziert IDs und bewahrt Berlin-Zeiten', async () => {
    token(); context.state!.settings.integrations.googleCalendar = true
    const fetch = vi.fn().mockResolvedValueOnce(response({ items: Array.from({ length: 100 }, (_, id) => remote(String(id))), nextPageToken: 'second-page' })).mockResolvedValueOnce(response({ items: [remote('99'), remote('100')] }))
    vi.stubGlobal('fetch', fetch)
    expect(await (await import('./google')).refreshCalendar()).toBe(true)
    expect(context.state!.events).toHaveLength(101)
    expect(context.state!.events[0]!.start).toBe(Date.parse('2026-11-06T12:00:00+01:00'))
    expect(fetch.mock.calls[1]![0]).toContain('pageToken=second-page')
    expect(context.state!.local.extras?.calendar).toMatchObject({ state: 'ready', fetchedAt: Date.now() })
  })
  it('lässt nach einem Fehler auf Seite zwei keine halb eingelesene Planung zurück', async () => {
    token(); context.state!.settings.integrations.googleCalendar = true
    context.state!.local.extras = { calendar: { state: 'ready', fetchedAt: 123, checkedAt: 123 } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ items: [remote('new')], nextPageToken: 'next' })).mockResolvedValueOnce(response({}, 500)))
    expect(await (await import('./google')).refreshCalendar()).toBe(false)
    expect(context.state!.events).toEqual([old])
    expect(context.state!.local.extras?.calendar).toMatchObject({ state: 'stale', fetchedAt: 123, issue: 'network' })
  })
  it('markiert abgelaufene Anmeldung ehrlich und behält vorhandene Termine', async () => {
    token(); context.state!.settings.integrations.googleCalendar = true
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 401)))
    const google = await import('./google')
    expect(await google.refreshCalendar()).toBe(false)
    expect(google.googleConnected()).toBe(false)
    expect(context.state!.events).toEqual([old])
    expect(context.state!.local.extras?.calendar?.issue).toBe('auth')
    expect(context.login).not.toHaveBeenCalled()
  })
  it('verwirft eine alte Antwort nach Abwahl und erneutem Einschalten', async () => {
    token(); context.state!.settings.integrations.googleCalendar = true
    let release!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve })))
    const google = await import('./google'); const pending = google.refreshCalendar()
    google.invalidateCalendarRequests(); context.state!.settings.integrations.googleCalendar = false
    context.state!.settings.integrations.googleCalendar = true
    release(response({ items: [remote('outdated')] }))
    expect(await pending).toBe(false); expect(context.state!.events).toEqual([old])
  })
  it('verwirft Antworten nach Logout und entfernt nie Termine als angeblich leere Erfolgsantwort', async () => {
    token(); context.state!.settings.integrations.googleCalendar = true
    let release!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve })))
    const google = await import('./google'); const pending = google.refreshCalendar()
    await google.disconnectGoogle(); release(response({ items: [] }))
    expect(await pending).toBe(false); expect(context.state!.events).toEqual([old])
  })
  it('weist kaputte Daten und zyklische Pagination ab, statt teilweise zu überschreiben', async () => {
    token(); context.state!.settings.integrations.googleCalendar = true
    const fetch = vi.fn().mockResolvedValueOnce(response({ items: [remote('good'), { id: 'broken' }] }))
    vi.stubGlobal('fetch', fetch)
    const google = await import('./google')
    expect(await google.refreshCalendar()).toBe(false); expect(context.state!.events).toEqual([old])
    fetch.mockResolvedValue(response({ items: [], nextPageToken: 'same' }))
    expect(await google.refreshCalendar()).toBe(false); expect(context.state!.events).toEqual([old])
  })
  it('meldet einen abgelehnten PUT nie als erfolgreichen Kalenderexport', async () => {
    token([readScope, writeScope]); context.state!.settings.integrations.writeCalendar = true
    context.state!.local.extras = { ownCalendar: { id: 'app-calendar', accountId: 'person-1' } }
    const fetch = vi.fn(async (url: string, _options?: RequestInit) => url.endsWith('/users/me/calendarList') ? response({ items: [{ id: 'app-calendar', summary: 'Anker' }] }) : response({}, 500)); vi.stubGlobal('fetch', fetch)
    expect(await (await import('./google')).writeAnkerBlocks()).toBe(false)
    expect(fetch.mock.calls[0]![1]?.method).toBe('PUT')
    expect(context.state!.local.extras?.calendar?.writtenAt).toBeUndefined()
  })
  it('schreibt ohne ausdrücklich erteilten Appkalender-Scope keine Daten', async () => {
    token(); context.state!.settings.integrations.writeCalendar = true
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(await (await import('./google')).writeAnkerBlocks()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
