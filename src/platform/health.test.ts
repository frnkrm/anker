import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../core/defaults'
import type { DayLog, Settings } from '../core/types'

const mocks = vi.hoisted(() => ({
  state: { settings: undefined as unknown as Settings, days: {} as Record<string, DayLog>, updateDay: vi.fn() },
  available: vi.fn(), workouts: vi.fn(),
}))
vi.mock('../state/store', () => ({ useApp: { getState: () => mocks.state } }))
vi.mock('@capgo/capacitor-health', () => ({ Health: { isAvailable: () => mocks.available(), queryWorkouts: () => mocks.workouts() } }))
vi.mock('./native', () => ({
  isNative: () => true,
  safe: async <T>(run: () => Promise<T>, fallback: T): Promise<T> => { try { return await run() } catch { return fallback } },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const date = '2026-11-02'
beforeEach(() => {
  vi.resetModules()
  const settings = defaultSettings(date); settings.integrations.healthConnect = true
  mocks.state = { settings, days: {}, updateDay: vi.fn(async (day: string, update: (log: DayLog) => DayLog) => {
    mocks.state.days = { ...mocks.state.days, [day]: update(mocks.state.days[day] ?? { date: day, override: {}, steps: {} }) }
  }) }
  mocks.available.mockReset().mockResolvedValue({ available: true })
  mocks.workouts.mockReset().mockResolvedValue({ workouts: [{ duration: 8 * 60 }] })
})
afterEach(() => vi.restoreAllMocks())

describe('Späte Health-Antworten', () => {
  it('überschreibt keine inzwischen manuell bestätigte Sporthandlung', async () => {
    const gate = deferred<{ workouts: { duration: number }[] }>()
    mocks.workouts.mockReturnValueOnce(gate.promise)
    const { syncWorkout } = await import('./health')
    const first = syncWorkout(date)
    await vi.waitFor(() => expect(mocks.workouts).toHaveBeenCalled())
    mocks.state.days = { [date]: { date, override: {}, steps: {}, sport: 'manual' } }
    gate.resolve({ workouts: [{ duration: 8 * 60 }] }); await first
    expect(mocks.state.updateDay).not.toHaveBeenCalled()
    expect(mocks.state.days[date]?.sport).toBe('manual')
  })

  it('schreibt nach Abschalten während der Abfrage keine Gesundheitsableitung mehr', async () => {
    const gate = deferred<{ workouts: { duration: number }[] }>()
    mocks.workouts.mockReturnValueOnce(gate.promise)
    const { syncWorkout } = await import('./health')
    const first = syncWorkout(date)
    await vi.waitFor(() => expect(mocks.workouts).toHaveBeenCalled())
    mocks.state.settings = { ...mocks.state.settings, integrations: { ...mocks.state.settings.integrations, healthConnect: false } }
    gate.resolve({ workouts: [{ duration: 8 * 60 }] }); await first
    expect(mocks.state.updateDay).not.toHaveBeenCalled()
  })

  it('beginnt nach Abschalten während der Verfügbarkeitsprüfung keine Trainingsabfrage', async () => {
    const gate = deferred<{ available: boolean }>()
    mocks.available.mockReturnValueOnce(gate.promise)
    const { syncWorkout } = await import('./health')
    const first = syncWorkout(date)
    mocks.state.settings = { ...mocks.state.settings, integrations: { ...mocks.state.settings.integrations, healthConnect: false } }
    gate.resolve({ available: true }); await first
    expect(mocks.workouts).not.toHaveBeenCalled()
  })

  it('behält den manuellen Zustand auch bei einer Änderung erst direkt vor der Store-Aktion', async () => {
    mocks.state.updateDay.mockImplementationOnce(async (day: string, update: (log: DayLog) => DayLog) => {
      const manual: DayLog = { date: day, override: {}, steps: {}, sport: 'manual' }
      mocks.state.days = { [day]: update(manual) }
    })
    const { syncWorkout } = await import('./health')
    await syncWorkout(date)
    expect(mocks.state.days[date]?.sport).toBe('manual')
  })

  it('ergänzt einen frischen bestätigten Trainingsfund wie bisher', async () => {
    const { syncWorkout } = await import('./health')
    await syncWorkout(date)
    expect(mocks.state.days[date]?.sport).toBe('health')
    await syncWorkout(date)
    expect(mocks.workouts).toHaveBeenCalledTimes(1)
  })
})
