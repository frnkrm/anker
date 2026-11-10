import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import type { CalendarStatus } from '../core/extras'
import type { CalendarEvent, LocalData, Settings } from '../core/types'
import { zonedToUtc } from '../core/time'

interface State {
  settings: Settings; local: LocalData; events: CalendarEvent[]
  saveLocal: (edit: (local: LocalData) => LocalData) => Promise<void>
  saveSettings: (edit: (settings: Settings) => Settings) => Promise<void>
  applyCalendarSnapshot: (events: CalendarEvent[], status: CalendarStatus, accept: () => boolean) => Promise<boolean>
}
const ctx = vi.hoisted(() => ({ state: undefined as State | undefined, native: true, date: '2026-11-06', permission: vi.fn(), list: vi.fn(), read: vi.fn(), login: vi.fn(), initialize: vi.fn(), logout: vi.fn() }))
vi.mock('./native', () => ({ isNative: () => ctx.native, AnkerNative: { deviceCalendarPermission: (...args: unknown[]) => ctx.permission(...args), listDeviceCalendars: (...args: unknown[]) => ctx.list(...args), readDeviceCalendarEvents: (...args: unknown[]) => ctx.read(...args) }, safe: async <T>(action: () => Promise<T>, fallback: T) => { try { return await action() } catch { return fallback } } }))
vi.mock('../state/store', () => ({ useApp: { getState: () => ctx.state! }, today: () => ctx.date, planFor: vi.fn() }))
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: { initialize: (...args: unknown[]) => ctx.initialize(...args), login: (...args: unknown[]) => ctx.login(...args), logout: (...args: unknown[]) => ctx.logout(...args) } }))

const id = '17:' + 'a'.repeat(64), otherId = '22:' + 'b'.repeat(64)
const old: CalendarEvent = { id: 'old', title: 'Letzter vollständiger Stand', start: 1000, end: 2000, allDay: false }
const row = { id: 'opaque-account-bound/instance:123', title: 'Besprechung', start: Date.parse('2026-11-06T10:00:00Z'), end: Date.parse('2026-11-06T11:00:00Z'), allDay: false }
const defer = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const choice = (calendarIds = [id]) => ({ enabled: true, calendarIds, selectedAt: Date.now() })
let values: Map<string, string>

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T09:00:00Z'))
  vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'synthetic-client'); ctx.native = true; ctx.date = '2026-11-06'
  values = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  ctx.permission.mockReset().mockResolvedValue({ granted: true }); ctx.list.mockReset().mockResolvedValue({ calendars: [{ id, name: 'Privat', account: 'person@example.test' }] })
  ctx.read.mockReset().mockResolvedValue({ events: [row], readAt: Date.now() }); ctx.initialize.mockReset().mockResolvedValue(undefined); ctx.logout.mockReset().mockResolvedValue(undefined)
  ctx.login.mockReset().mockImplementation(async ({ options }: { options: { scopes: string[] } }) => ({ provider: 'google', result: { accessToken: { token: 'synthetic-token', permissions: options.scopes }, profile: { id: 'synthetic-account' } } }))
  const settings = defaultSettings(ctx.date); settings.integrations.googleCalendar = true
  ctx.state = { settings, local: { ...emptyLocal(), extras: { deviceCalendar: choice(), calendar: { state: 'ready', fetchedAt: 123, checkedAt: 123, writtenAt: 99 } } }, events: [old],
    async saveLocal(edit) { ctx.state!.local = edit(structuredClone(ctx.state!.local)) },
    async saveSettings(edit) { ctx.state!.settings = edit(structuredClone(ctx.state!.settings)) },
    async applyCalendarSnapshot(events, status, accept) { if (!accept()) return false; ctx.state!.events = events; ctx.state!.local = { ...ctx.state!.local, extras: { ...ctx.state!.local.extras, calendar: status } }; return true },
  }
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe('Explizite Android-Google-Kalenderauswahl mit bestehendem atomarem Cache', () => {
  it('liest Optionen nur nach Berechtigung, fordert Zustimmung ausschließlich ausdrücklich an und bleibt im Web offline', async () => {
    const api = await import('./deviceCalendar')
    ctx.native = false
    expect(await api.deviceCalendarOptions(true)).toEqual({ granted: false, calendars: [] })
    expect(await api.refreshDeviceCalendar()).toBe(false); expect(ctx.permission).not.toHaveBeenCalled()
    ctx.native = true; ctx.permission.mockResolvedValueOnce({ granted: false })
    expect(await api.deviceCalendarOptions(true)).toEqual({ granted: false, calendars: [] })
    expect(ctx.permission).toHaveBeenLastCalledWith({ request: true }); expect(ctx.list).not.toHaveBeenCalled()
    const options = await api.deviceCalendarOptions()
    expect(options.calendars).toEqual([{ id, name: 'Privat', account: 'person@example.test' }]); expect(ctx.permission).toHaveBeenLastCalledWith({ request: false })
    let accept = true; ctx.permission.mockImplementationOnce(async () => { accept = false; return { granted: true } })
    expect(await api.deviceCalendarOptions(true, () => accept)).toEqual({ granted: false, calendars: [] }); expect(ctx.list).toHaveBeenCalledTimes(1)
  })
  it('nutzt normalen Kalenderrefresh ohne OAuth, Netzwerk oder zweite Terminmodelle', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(await (await import('./google')).refreshCalendar()).toBe(true)
    expect(ctx.state!.events).toEqual([row]); expect(ctx.state!.local.extras?.calendar).toEqual({ state: 'ready', fetchedAt: Date.now(), checkedAt: Date.now(), writtenAt: 99 })
    expect(ctx.permission).toHaveBeenCalledWith({ request: false }); expect(ctx.login).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
    expect(ctx.read).toHaveBeenCalledWith({ calendarIds: [id], from: zonedToUtc('2026-11-06', 0), to: zonedToUtc('2026-11-09', 0) })
  })
  it.each([['2026-03-29', '2026-03-30', 23], ['2026-10-25', '2026-10-26', 25]])('wandelt Ganztag %s bis %s exklusiv in Berliner Mitternächte (%i h) um', async (startDate, endDate, hours) => {
    ctx.date = startDate
    ctx.read.mockResolvedValueOnce({ events: [{ ...row, allDay: true, start: Date.parse(startDate + 'T00:00:00Z'), end: Date.parse(endDate + 'T00:00:00Z'), startDate, endDate }], readAt: Date.now() })
    expect(await (await import('./deviceCalendar')).refreshDeviceCalendar()).toBe(true)
    expect(ctx.state!.events[0]).toMatchObject({ start: zonedToUtc(startDate, 0), end: zonedToUtc(endDate, 0), allDay: true })
    expect(ctx.state!.events[0]!.end - ctx.state!.events[0]!.start).toBe(hours * 3600_000)
    const window = ctx.read.mock.calls[0]![0] as { from: number; to: number }
    expect(window.to - window.from).toBeLessThanOrEqual(73 * 3600_000)
  })
  it('behält den letzten Stand bei verweigerter Berechtigung oder neu gebundenem Konto, ohne Hintergrunddialog', async () => {
    const api = await import('./deviceCalendar')
    ctx.permission.mockResolvedValueOnce({ granted: false })
    expect(await api.refreshDeviceCalendar()).toBe(false); expect(ctx.read).not.toHaveBeenCalled()
    ctx.read.mockRejectedValueOnce(new Error('DEVICE_CALENDAR_SELECTION_CHANGED'))
    expect(await api.refreshDeviceCalendar()).toBe(false); expect(ctx.state!.events).toEqual([old])
    expect(ctx.state!.local.extras?.calendar).toMatchObject({ state: 'stale', issue: 'permission', fetchedAt: 123, writtenAt: 99 })
    expect(ctx.permission.mock.calls.every(call => call[0].request === false)).toBe(true)
  })
  it.each([
    [{ ...row }, { ...row, title: 'Doppelte ID' }],
    [{ ...row }, { ...row, id: 'bad', end: -1 }],
    [{ ...row, allDay: true, startDate: '2026-02-30', endDate: '2026-03-01' }],
    [{ ...row, allDay: true, startDate: '2026-11-07', endDate: '2026-11-08' }],
  ])('übernimmt bei ungültigen Daten niemals einen Teil des Snapshots %#', async (...input) => {
    ctx.read.mockResolvedValueOnce({ events: input, readAt: Date.now() })
    expect(await (await import('./deviceCalendar')).refreshDeviceCalendar()).toBe(false); expect(ctx.state!.events).toEqual([old])
    expect(ctx.state!.local.extras?.calendar).toMatchObject({ state: 'stale', issue: 'invalid-response' })
  })
  it('weist fremde oder doppelte Auswahlidentitäten vor einem Providerzugriff zurück', async () => {
    const api = await import('./deviceCalendar')
    for (const ids of [[], ['17'], ['017:' + 'a'.repeat(64)], [id, id], [id, '17:' + 'b'.repeat(64)]]) {
      expect(await api.connectDeviceCalendars(ids)).toBe(false)
    }
    expect(ctx.permission).not.toHaveBeenCalled(); expect(ctx.read).not.toHaveBeenCalled()
    ctx.list.mockResolvedValueOnce({ calendars: [{ id: '17', name: 'Falsch', account: 'user' }] })
    await expect(api.deviceCalendarOptions(true)).rejects.toThrow('invalid-response')
  })
  it('trennt während eines laufenden Imports und ignoriert die verspäteten Termine; eigene Daten bleiben', async () => {
    const delayed = defer<{ events: typeof row[]; readAt: number }>(); ctx.read.mockReturnValueOnce(delayed.promise)
    ctx.state!.local.work = [{ id: 'personal', title: 'Eigene Aufgabe', createdAt: 1 }]
    const api = await import('./deviceCalendar'); const pending = api.refreshDeviceCalendar()
    await vi.waitFor(() => expect(ctx.read).toHaveBeenCalledTimes(1))
    await api.disconnectDeviceCalendars()
    delayed.resolve({ events: [row], readAt: Date.now() }); expect(await pending).toBe(false)
    expect(ctx.state!.events).toEqual([]); expect(ctx.state!.settings.integrations.googleCalendar).toBe(false)
    expect(ctx.state!.local.extras?.deviceCalendar).toMatchObject({ enabled: false, calendarIds: [] }); expect(ctx.state!.local.extras?.calendar?.state).toBe('disconnected')
    expect(ctx.state!.local.work).toEqual([{ id: 'personal', title: 'Eigene Aufgabe', createdAt: 1 }])
  })
  it('verwirft alte Antworten nach Quellenwechsel und erneutem Auswählen, selbst bei gleicher Uhrzeit', async () => {
    const delayed = defer<{ events: typeof row[]; readAt: number }>(); ctx.read.mockReturnValueOnce(delayed.promise)
    const api = await import('./deviceCalendar'); const pending = api.refreshDeviceCalendar()
    await vi.waitFor(() => expect(ctx.read).toHaveBeenCalledTimes(1))
    ctx.read.mockResolvedValueOnce({ events: [{ ...row, id: 'new', title: 'Neue Quelle' }], readAt: Date.now() })
    expect(await api.connectDeviceCalendars([otherId])).toBe(true)
    delayed.resolve({ events: [row], readAt: Date.now() }); expect(await pending).toBe(false)
    expect(ctx.state!.events[0]?.title).toBe('Neue Quelle'); expect(ctx.state!.local.extras?.deviceCalendar?.calendarIds).toEqual([otherId])
  })
  it('prüft die Auswahl erneut innerhalb der zentralen Schreibbarriere', async () => {
    const entered = defer<void>(), release = defer<void>(), original = ctx.state!.applyCalendarSnapshot
    ctx.state!.applyCalendarSnapshot = async (events, status, accept) => { entered.resolve(); await release.promise; return original(events, status, accept) }
    const api = await import('./deviceCalendar'); const pending = api.refreshDeviceCalendar()
    await entered.promise
    ;(await import('./calendarSource')).invalidateCalendarSource()
    release.resolve(); expect(await pending).toBe(false); expect(ctx.state!.events).toEqual([old])
  })
  it('lässt eine verspätete Fehlermeldung keinen neueren Erfolg überschreiben und gibt keine rohen Fehler aus', async () => {
    const delayed = defer<{ events: typeof row[]; readAt: number }>(); ctx.read.mockReturnValueOnce(delayed.promise)
    const api = await import('./deviceCalendar'); const first = api.refreshDeviceCalendar()
    await vi.waitFor(() => expect(ctx.read).toHaveBeenCalledTimes(1))
    expect(await api.refreshDeviceCalendar()).toBe(true)
    delayed.resolve({ events: [{ ...row, end: -1 }], readAt: Date.now() }); expect(await first).toBe(false)
    expect(ctx.state!.local.extras?.calendar?.state).toBe('ready')
    ctx.read.mockRejectedValueOnce(new Error('private-account@example.test secret'))
    expect(await api.refreshDeviceCalendar()).toBe(false)
    expect(JSON.stringify(ctx.state!.local.extras?.calendar)).not.toContain('private-account')
    expect(ctx.state!.local.extras?.calendar?.issue).toBe('network')
  })
  it('übernimmt keine Auswahl nach abgebrochenem Dialog oder fehlgeschlagenem Einstellungswrite', async () => {
    const api = await import('./deviceCalendar'); let accept = true
    ctx.permission.mockImplementationOnce(async () => { accept = false; return { granted: true } })
    expect(await api.connectDeviceCalendars([otherId], () => accept)).toBe(false)
    expect(ctx.state!.local.extras?.deviceCalendar?.calendarIds).toEqual([id])
    ctx.state!.saveSettings = async () => { throw new Error('disk') }
    await expect(api.connectDeviceCalendars([otherId])).rejects.toThrow('disk')
    expect(ctx.state!.local.extras?.deviceCalendar?.calendarIds).toEqual([id]); expect(ctx.read).not.toHaveBeenCalled()
  })
  it('wechselt erst nach erfolgreicher Google-Leseanmeldung; Schreiben und abgelehnte Anmeldung lassen Handyquelle bestehen', async () => {
    const google = await import('./google')
    ctx.login.mockRejectedValueOnce(new Error('cancelled'))
    expect(await google.connectGoogle(false)).toBe(false); expect(ctx.state!.local.extras?.deviceCalendar?.enabled).toBe(true)
    expect(await google.connectGoogle(true)).toBe(true); expect(ctx.state!.local.extras?.deviceCalendar?.enabled).toBe(true); expect(google.googleWriteAuthorized()).toBe(true)
    expect(await google.connectGoogle(false)).toBe(true); expect(ctx.state!.local.extras?.deviceCalendar).toMatchObject({ enabled: false, calendarIds: [] })
  })
  it('lässt eine alte Google-Anmeldung keine inzwischen bewusst gewählte Handyquelle verdrängen', async () => {
    const login = defer<unknown>(); ctx.login.mockReturnValueOnce(login.promise)
    const google = await import('./google'); const oauth = google.connectGoogle()
    await vi.waitFor(() => expect(ctx.login).toHaveBeenCalledTimes(1))
    expect(await (await import('./deviceCalendar')).connectDeviceCalendars([otherId])).toBe(true)
    login.resolve({ provider: 'google', result: { accessToken: { token: 'late-token' }, profile: { id: 'old-account' } } })
    expect(await oauth).toBe(false); expect(google.googleConnected()).toBe(false)
    expect(ctx.state!.local.extras?.deviceCalendar?.calendarIds).toEqual([otherId])
  })
})
