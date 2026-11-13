import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { guidancePreferences } from '../core/guidance'
import { defaultPcBridgeLocal } from '../core/pcLink'
import { pcBridgeSnapshot } from './pcLink'
import { buildReminders } from '../core/reminders/build'
import { addDays, zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from '../state/store'
import type { AnkerNativePlugin, ReminderActionInfo } from './native'
import { drainActions, rescheduleAll, setupNotifications } from './notifications'

const mocks = vi.hoisted(() => ({
  repo: undefined as Repository | undefined,
  read: vi.fn<AnkerNativePlugin['drainReminderActions']>(),
  ack: vi.fn<AnkerNativePlugin['ackReminderActions']>(),
  sync: vi.fn<AnkerNativePlugin['syncReminders']>(),
  alarm: vi.fn(async () => ({ ringing: false })),
  listener: vi.fn<AnkerNativePlugin['addListener']>(),
}))
vi.mock('../data', () => ({ getRepository: async () => mocks.repo! }))
vi.mock('./native', () => ({
  AnkerNative: { getAlarmState: mocks.alarm, drainReminderActions: mocks.read, ackReminderActions: mocks.ack, syncReminders: mocks.sync, addListener: mocks.listener },
  isNative: () => true,
  safe: async <T>(fn: () => Promise<T>, fallback: T) => { try { return await fn() } catch { return fallback } },
}))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  getPending: async () => ({ notifications: [] }), getDeliveredNotifications: async () => ({ notifications: [] }),
} }))

const date = '2026-11-02'
let queue: ReminderActionInfo[]

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(zonedToUtc(date, 17 * 60))
  mocks.repo = new MemoryRepository()
  mocks.read.mockReset(); mocks.ack.mockReset(); mocks.sync.mockReset(); mocks.listener.mockReset()
  queue = []
  mocks.read.mockImplementation(async () => ({ actions: [...queue] }))
  mocks.ack.mockImplementation(async ({ ids }) => { queue = queue.filter((a) => !ids.includes(a.id)) })
  mocks.sync.mockResolvedValue()
  mocks.listener.mockResolvedValue({ remove: async () => undefined })
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal() })
  await useApp.getState().load()
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

function bedAction(): ReminderActionInfo {
  const st = useApp.getState()
  const event = buildReminders([planFor(date)], st.days, st.settings, Date.now()).find((e) => e.key === 'bed')!
  vi.setSystemTime(event.at + 1000)
  return { id: 'native-action-id', action: 'done', key: event.key, date, at: event.at, revision: event.revision, token: event.token }
}

describe('Native Rückmeldungen: lesen, dauerhaft verarbeiten, dann bestätigen', () => {
  it('überträgt datierten Impuls mit Abfahrtsfrist, ersetzt bei Fortschritt die Revision und entfernt alte Hinweise', async () => {
    vi.setSystemTime(zonedToUtc(date, 300))
    await useApp.getState().saveSettings(s => ({ ...s, onboarded: true }))
    const before = structuredClone({ days: useApp.getState().days, game: useApp.getState().game })
    await rescheduleAll()
    const request = () => mocks.sync.mock.calls.at(-1)![0]
    const hint = () => request().reminders.find(e => e.date === date && e.key === 'prepare:work')!
    const first = hint()
    expect(first).toMatchObject({ validUntil: zonedToUtc(date, planFor(date).leave!), actions: false, exact: false, critical: false, channel: 'sanft' })
    expect(request().reminders.some(e => e.date === date && e.key === 'leave-10')).toBe(false)
    expect(request().ruleSnapshot?.rules.some(r => r.key.startsWith('prepare:'))).toBe(false)
    expect({ days: useApp.getState().days, game: useApp.getState().game }).toEqual(before)
    const step = planFor(date).blocks.find(b => b.routine === 'morning')!.steps![0]!
    await useApp.getState().setStep(date, 'morning', step.id, 'done')
    await rescheduleAll()
    expect(hint().revision).not.toBe(first.revision)
    expect(hint().token).toBe(first.token)
    await useApp.getState().setOverride(date, { homeOffice: true })
    await rescheduleAll()
    expect(hint()).toBeUndefined()
    expect(request().revisions).not.toHaveProperty(`${date}|prepare:work`)
  })
  it('übermittelt die eigene stille Bettwahl und den vorhandenen Delay, ohne andere Keys umzuetikettieren', async () => {
    await useApp.getState().saveSettings(settings => ({ ...settings, onboarded: true, sleep: { ...settings.sleep, bedtimeFollowUpsEnabled: true, fallAsleepMin: 45 }, support: { ...settings.support, windDown: { ...settings.support.windDown, enabled: true } } }))
    await rescheduleAll()
    const request = mocks.sync.mock.calls.at(-1)![0]
    expect(request.policy).toMatchObject({ bedtimeFollowUpsEnabled: true, bedtimeFollowUpsDelayMinutes: 45 })
    const bed = request.reminders.filter(entry => entry.key === 'bed' && entry.date === date)
    expect(bed).toHaveLength(1)
    expect(bed[0]).toMatchObject({ quietFollowUps: true, actions: false, exact: false, channel: 'sanft' })
    expect(request.reminders.filter(entry => entry.key !== 'bed').every(entry => entry.quietFollowUps === undefined)).toBe(true)
    expect(request.ruleSnapshot?.rules.filter(rule => rule.key === 'bed').every(rule => rule.quietFollowUps === true)).toBe(true)
  })
  it('hält alle PC-/Bettregeln und liefert nur nach eigener Wahl die exakte aktuelle PC-Revision als Bedingung', async () => {
    await useApp.getState().saveSettings(s => ({ ...s, onboarded: true, guidance: { ...guidancePreferences(), enabled: true, suppressPhonePcWhenConfirmed: true } }))
    await useApp.getState().saveLocal(local => ({ ...local, pcBridge: { ...defaultPcBridgeLocal(), enabled: true } }))
    await rescheduleAll()
    const request = mocks.sync.mock.calls.at(-1)![0]
    const expected = pcBridgeSnapshot(Date.now(), { ringing: false })
    expect(request.policy?.pcConfirmation).toEqual({ revision: expected.revision, date: expected.date, validUntil: Date.parse(expected.validUntil) })
    expect(request.reminders.some(r => r.key === 'pcstop' && r.date === date)).toBe(true)
    expect(request.reminders.some(r => r.key === 'pcstop' && r.date === addDays(date, 1))).toBe(true)
    expect(request.reminders.some(r => r.key === 'bed' && r.date === date)).toBe(true)
    expect(request.ruleSnapshot?.rules.some(r => r.key === 'pcstop')).toBe(true)
    await useApp.getState().saveSettings(s => ({ ...s, pcStop: s.pcStop + 15 }))
    await rescheduleAll()
    expect(mocks.sync.mock.calls.at(-1)![0].policy?.pcConfirmation?.revision).not.toBe(expected.revision)
    await useApp.getState().saveSettings(s => ({ ...s, guidance: { ...guidancePreferences(s.guidance), suppressPhonePcWhenConfirmed: false } }))
    await rescheduleAll()
    expect(mocks.sync.mock.calls.at(-1)![0].policy?.pcConfirmation).toBeUndefined()
  })

  it('verliert einen neuen Drain am Ende einer leeren Abfrage nicht', async () => {
    const first = drainActions()
    // Die leere Bridge-Antwort ist eingetroffen, ihr Abschluss läuft noch in Microtasks.
    await Promise.resolve()
    const action = bedAction(); queue = [action]
    await drainActions(); await first
    expect(queue).toEqual([])
    expect(useApp.getState().days[date]?.bedAt).toBe(action.at)
    expect(mocks.ack).toHaveBeenCalledExactlyOnceWith({ ids: [action.id] })
  })

  it('bestätigt erst nach der Transaktion und fasst parallele Drains zusammen', async () => {
    const a = bedAction(); queue = [a]
    let entered!: () => void; let release!: () => void
    const reached = new Promise<void>((resolve) => { entered = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    const put = mocks.repo!.putMany.bind(mocks.repo!)
    vi.spyOn(mocks.repo!, 'putMany').mockImplementation(async (records) => { entered(); await gate; await put(records) })
    const first = drainActions()
    await reached
    expect(drainActions()).toBe(first)
    expect(mocks.ack).not.toHaveBeenCalled()
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    release(); await first
    expect(mocks.ack).toHaveBeenCalledExactlyOnceWith({ ids: [a.id] })
    expect((await mocks.repo!.get<{ bedAt: number }>('days', date))?.bedAt).toBe(a.at)
    expect(queue).toEqual([])
  })

  it('behält eine fehlgeschlagene Aktion für den nächsten Versuch ohne vorgezogenen RAM-Erfolg', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const a = bedAction(); queue = [a]
    vi.spyOn(mocks.repo!, 'putMany').mockRejectedValueOnce(new Error('disk full'))
    await drainActions()
    expect(mocks.ack).not.toHaveBeenCalled()
    expect(queue).toHaveLength(1)
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    await drainActions()
    expect(queue).toEqual([])
    expect(useApp.getState().days[date]?.bedAt).toBe(a.at)
  })

  it('verwirft Legacy-Aktionen ohne sichere Version ausdrücklich, statt neue Erledigungen zu raten', async () => {
    queue = [{ id: 'legacy-id', action: 'done', key: 'bed', date, at: Date.now() } as ReminderActionInfo]
    await drainActions()
    expect(mocks.ack).toHaveBeenCalledExactlyOnceWith({ ids: ['legacy-id'] })
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    expect(useApp.getState().toast).toContain('ältere Rückmeldung')
    expect(queue).toEqual([])
  })

  it('liefert native Relevanz, opaque Revisionen und identische Ruhepolitik gemeinsam', async () => {
    await useApp.getState().saveSettings((s) => ({ ...s, onboarded: true }))
    await rescheduleAll()
    const request = mocks.sync.mock.calls[0]![0]
    expect(request.reminders.length).toBeGreaterThan(5)
    expect(request.reminders.every((e) => typeof e.critical === 'boolean' && e.token && e.revision === request.revisions[`${e.date}|${e.key}`])).toBe(true)
    expect(new Set(request.relevant)).toEqual(new Set(Object.keys(request.revisions)))
    expect(request.policy).toMatchObject({ quietStart: useApp.getState().settings.reminders.quietStart, quietEnd: useApp.getState().settings.reminders.quietEnd })
    expect(request.ruleSnapshot?.validFrom).toBe(zonedToUtc(addDays(date, 14), 4 * 60))
    expect(request.ruleSnapshot?.rules.length).toBeGreaterThan(0)
  })

  it('spiegelt bekannte künftige Ausnahmen datiert und nimmt sie aus der Wochenfortsetzung aus', async () => {
    const future = addDays(date, 28)
    await useApp.getState().saveSettings((s) => ({ ...s, onboarded: true }))
    await useApp.getState().setOverride(future, { dayType: 'vacation' })
    await rescheduleAll()
    const request = mocks.sync.mock.calls[0]![0]
    expect(request.ruleSnapshot?.excludedDates).toContain(future)
    expect(request.reminders.some((e) => e.date === future && e.key === 'bed')).toBe(true)
  })

  it('überholt bei schnellen Änderungen keinen laufenden nativen Planabgleich', async () => {
    await useApp.getState().saveSettings((s) => ({ ...s, onboarded: true }))
    let entered!: () => void; let release!: () => void
    const reached = new Promise<void>((resolve) => { entered = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    mocks.sync.mockImplementationOnce(async () => { entered(); await gate })
    const first = rescheduleAll()
    await reached
    await useApp.getState().saveSettings((s) => ({ ...s, bed: s.bed + 5 }))
    expect(rescheduleAll()).toBe(first)
    expect(mocks.sync).toHaveBeenCalledTimes(1)
    release(); await first
    expect(mocks.sync).toHaveBeenCalledTimes(2)
    const [old, current] = mocks.sync.mock.calls.map(([request]) => request)
    expect(current!.revisions[`${date}|bed`]).not.toBe(old!.revisions[`${date}|bed`])
    expect(current!.revisions[`${date}|bed`]).toBe(buildReminders([planFor(date)], useApp.getState().days, useApp.getState().settings, Date.now()).find((e) => e.key === 'bed')!.revision)
  })

  it('versucht einen abgelehnten Listener erneut und richtet ihn bei parallelem Setup nur einmal ein', async () => {
    mocks.listener.mockRejectedValueOnce(new Error('bridge temporarily unavailable'))
    await expect(setupNotifications()).rejects.toThrow('temporarily unavailable')
    let entered!: () => void; let release!: () => void
    const reached = new Promise<void>((resolve) => { entered = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    mocks.listener.mockImplementationOnce(async () => { entered(); await gate; return { remove: async () => undefined } })
    const first = setupNotifications()
    await reached
    expect(setupNotifications()).toBe(first)
    expect(mocks.listener).toHaveBeenCalledTimes(2)
    release(); await first
    await setupNotifications()
    expect(mocks.listener).toHaveBeenCalledTimes(2)
    const listener = mocks.listener.mock.calls[1]![1]
    const action = bedAction(); queue = [action]
    listener()
    await drainActions()
    expect(queue).toEqual([])
    expect(useApp.getState().days[date]?.bedAt).toBe(action.at)
  })
})
