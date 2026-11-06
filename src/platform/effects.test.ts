import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { buildDayPlan } from '../core/planner'
import { zonedToUtc } from '../core/time'
import type { useApp } from '../state/store'
import type { AnkerNativePlugin } from './native'

const mocks = vi.hoisted(() => ({
  state: undefined as unknown as ReturnType<typeof useApp.getState>,
  changed: undefined as (() => void) | undefined,
  resumed: undefined as ((state: { isActive: boolean }) => void) | undefined,
  subscribe: vi.fn(), addListener: vi.fn(), setup: vi.fn(), drain: vi.fn(), schedule: vi.fn(), alarm: vi.fn(), workout: vi.fn(),
  widget: vi.fn<AnkerNativePlugin['updateWidget']>(),
}))
vi.mock('../state/store', () => ({
  useApp: { getState: () => mocks.state },
  today: () => '2026-11-02',
  planFor: (date: string, state = mocks.state) => buildDayPlan({ date, settings: state.settings, override: state.days[date]?.override, events: state.events, commitments: state.local.commitments, places: state.local.places, sessions: state.local.workSessions, nowMs: Date.now() }),
  onPlanChange: (callback: () => void) => { mocks.changed = callback; mocks.subscribe(); return () => undefined },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: (event: string, callback: (state: { isActive: boolean }) => void) => { mocks.resumed = callback; return mocks.addListener(event, callback) } } }))
vi.mock('./notifications', () => ({ setupNotifications: () => mocks.setup(), drainActions: () => mocks.drain(), rescheduleAll: () => mocks.schedule() }))
vi.mock('./alarm', () => ({ syncAlarm: () => mocks.alarm() }))
vi.mock('./health', () => ({ syncWorkout: (date: string) => mocks.workout(date) }))
vi.mock('./native', () => ({
  isNative: () => true,
  AnkerNative: { updateWidget: (options: Parameters<AnkerNativePlugin['updateWidget']>[0]) => mocks.widget(options) },
  safe: async <T>(run: () => Promise<T>, fallback: T): Promise<T> => { try { return await run() } catch { return fallback } },
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(zonedToUtc('2026-11-02', 15 * 60))
  for (const fn of [mocks.subscribe, mocks.addListener, mocks.setup, mocks.drain, mocks.schedule, mocks.alarm, mocks.workout, mocks.widget]) fn.mockReset()
  mocks.changed = undefined; mocks.resumed = undefined
  mocks.addListener.mockResolvedValue({ remove: async () => undefined })
  mocks.setup.mockResolvedValue(undefined); mocks.drain.mockResolvedValue(undefined); mocks.schedule.mockResolvedValue(undefined)
  mocks.alarm.mockResolvedValue(undefined); mocks.workout.mockResolvedValue(undefined); mocks.widget.mockResolvedValue(undefined)
  mocks.state = {
    settings: { ...defaultSettings('2026-11-02'), onboarded: true }, days: {}, inbox: [], events: [], local: emptyLocal(),
    evaluateProgress: vi.fn(async () => undefined), setAlarmStatus: vi.fn(),
  } as unknown as ReturnType<typeof useApp.getState>
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('Ein sequenzierter lokaler Abgleich bei Start, Änderung und Resume', () => {
  it('fasst schnelle Planänderungen und Resume zusammen, ohne laufende Schritte zu überholen', async () => {
    const effects = await import('./effects')
    effects.startEffects(); await effects.reconcileEffects()
    mocks.schedule.mockClear(); mocks.alarm.mockClear(); mocks.widget.mockClear()
    const entered = deferred(); const gate = deferred()
    const observed: string[] = []
    mocks.schedule.mockImplementationOnce(async () => { observed.push('reminders-1'); entered.resolve(); await gate.promise })
    mocks.schedule.mockImplementation(async () => { observed.push('reminders') })
    mocks.alarm.mockImplementation(async () => { observed.push(`alarm-${mocks.state.settings.anchor.wake}`) })
    const first = effects.reconcileEffects(); await entered.promise
    mocks.state = { ...mocks.state, settings: { ...mocks.state.settings, anchor: { ...mocks.state.settings.anchor, wake: 500 } } }
    mocks.changed!(); mocks.changed!(); mocks.resumed!({ isActive: true })
    expect(mocks.schedule).toHaveBeenCalledTimes(1)
    expect(mocks.alarm).not.toHaveBeenCalled()
    gate.resolve(); await first
    expect(observed).toEqual(['reminders-1', 'alarm-500', 'reminders', 'alarm-500'])
    expect(mocks.schedule).toHaveBeenCalledTimes(2)
  })

  it('plant weiter lokal, während eine optionale Verbindung noch keine Antwort liefert', async () => {
    const gate = deferred(); const entered = deferred()
    const sync = vi.fn(async () => { entered.resolve(); await gate.promise })
    const effects = await import('./effects')
    effects.startEffects({ sync }); await entered.promise
    await effects.reconcileEffects()
    mocks.schedule.mockClear(); mocks.alarm.mockClear()
    mocks.state = { ...mocks.state, settings: { ...mocks.state.settings, bed: mocks.state.settings.bed + 30 } }
    mocks.changed!()
    await effects.reconcileEffects()
    expect(mocks.schedule).toHaveBeenCalled()
    expect(mocks.alarm).toHaveBeenCalled()
    expect(sync).toHaveBeenCalledTimes(1)
    gate.resolve()
    await vi.advanceTimersByTimeAsync(0)
  })

  it('isoliert Setup-, Reminder- und Health-Fehler und versucht beim nächsten Anlass erneut', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.setup.mockRejectedValueOnce(new Error('private setup detail'))
    mocks.schedule.mockRejectedValueOnce(new Error('private task detail'))
    mocks.workout.mockRejectedValueOnce(new Error('private health detail'))
    const sync = vi.fn(async () => undefined)
    const effects = await import('./effects')
    effects.startEffects({ sync }); await effects.reconcileEffects()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.alarm).toHaveBeenCalled()
    expect(mocks.widget).toHaveBeenCalled()
    expect(sync).toHaveBeenCalled()
    expect(warn.mock.calls.flat().join(' ')).not.toContain('private')
    await effects.reconcileEffects()
    expect(mocks.schedule.mock.calls.length).toBeGreaterThan(1)
  })

  it('führt einen unerwarteten Weckerfehler sichtbar und bricht das Widget nicht ab', async () => {
    const effects = await import('./effects')
    mocks.alarm.mockRejectedValueOnce(new Error('native unavailable'))
    await effects.reconcileEffects()
    expect(mocks.state.setAlarmStatus).toHaveBeenCalledWith({ ok: false, message: 'Der Wecker konnte nicht geplant werden.' })
    expect(mocks.widget).toHaveBeenCalled()
    await effects.reconcileEffects()
    expect(mocks.alarm).toHaveBeenCalledTimes(2)
  })

  it('registriert beim wiederholten Start nur einen Takt und aktualisiert periodisch über dieselbe Queue', async () => {
    const effects = await import('./effects')
    effects.startEffects(); effects.startEffects()
    await effects.reconcileEffects()
    expect(mocks.subscribe).toHaveBeenCalledTimes(1)
    expect(mocks.addListener).toHaveBeenCalledTimes(1)
    expect(mocks.setup).toHaveBeenCalledTimes(1)
    mocks.schedule.mockClear(); mocks.alarm.mockClear(); mocks.widget.mockClear()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(mocks.widget).toHaveBeenCalledTimes(1)
    expect(mocks.schedule).not.toHaveBeenCalled()
    expect(mocks.alarm).not.toHaveBeenCalled()
  })
})

describe('Widget: gemeinsame Auswahl, aktuelle Daten und private Texte', () => {
  it('verhindert, dass ein direkter älterer Widget-Aufruf neuere Daten überschreibt', async () => {
    const entered = deferred(); const gate = deferred()
    mocks.widget.mockImplementationOnce(async () => { entered.resolve(); await gate.promise })
    const effects = await import('./effects')
    const first = effects.updateWidget(); await entered.promise
    mocks.state = { ...mocks.state, local: { ...mocks.state.local, work: [{ id: 'w', title: 'Geheimer Kunde', nextStep: 'Private Tabelle öffnen', createdAt: 1 }] } }
    expect(effects.updateWidget()).toBe(first)
    expect(mocks.widget).toHaveBeenCalledTimes(1)
    gate.resolve(); await first
    const last = mocks.widget.mock.calls.at(-1)![0].entries.filter((entry) => entry.at <= Date.now()).at(-1)!
    expect(last.action).toBe('Arbeit weiterführen')
    expect(JSON.stringify(mocks.widget.mock.calls.at(-1))).not.toMatch(/Geheimer Kunde|Private Tabelle/)
  })

  it('verwendet denselben Wiederanlauf wie Jetzt ohne Inhalt im Widget', async () => {
    mocks.state = { ...mocks.state, local: { ...mocks.state.local, resume: { kind: 'free', title: 'Privates Modell', nextStep: 'Geheimes Bauteil holen', at: Date.now() - 60_000 } } }
    const effects = await import('./effects')
    const current = effects.widgetEntries().filter((entry) => entry.at <= Date.now()).at(-1)!
    expect(current.action).toBe('Wieder einsteigen')
    expect(JSON.stringify(current)).not.toMatch(/Privates|Geheimes/)
  })

  it('schreibt nach abgelehntem Widget-Aufruf beim nächsten Request wieder', async () => {
    mocks.widget.mockRejectedValueOnce(new Error('widget unavailable'))
    const effects = await import('./effects')
    await effects.updateWidget(); await effects.updateWidget()
    expect(mocks.widget).toHaveBeenCalledTimes(2)
  })
})
