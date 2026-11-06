import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { buildReminders } from '../core/reminders/build'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from '../state/store'
import type { AnkerNativePlugin, ReminderActionInfo } from './native'
import { drainActions, rescheduleAll } from './notifications'

const mocks = vi.hoisted(() => ({
  repo: undefined as Repository | undefined,
  read: vi.fn<AnkerNativePlugin['drainReminderActions']>(),
  ack: vi.fn<AnkerNativePlugin['ackReminderActions']>(),
  sync: vi.fn<AnkerNativePlugin['syncReminders']>(),
}))
vi.mock('../data', () => ({ getRepository: async () => mocks.repo! }))
vi.mock('./native', () => ({
  AnkerNative: { drainReminderActions: mocks.read, ackReminderActions: mocks.ack, syncReminders: mocks.sync },
  isNative: () => true,
  safe: async <T>(fn: () => Promise<T>, fallback: T) => { try { return await fn() } catch { return fallback } },
}))

const date = '2026-11-02'
let queue: ReminderActionInfo[]

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(zonedToUtc(date, 17 * 60))
  mocks.repo = new MemoryRepository()
  mocks.read.mockReset(); mocks.ack.mockReset(); mocks.sync.mockReset()
  queue = []
  mocks.read.mockImplementation(async () => ({ actions: [...queue] }))
  mocks.ack.mockImplementation(async ({ ids }) => { queue = queue.filter((a) => !ids.includes(a.id)) })
  mocks.sync.mockResolvedValue()
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
  })
})
