import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../core/defaults'
import type { Settings } from '../core/types'
import { readDiagnostics } from './diagnostics'

const mocks = vi.hoisted(() => ({
  native: true, state: { settings: undefined as unknown as Settings },
  app: vi.fn(), alarm: vi.fn(), bedtime: vi.fn(), journal: vi.fn(), pc: vi.fn(),
}))
vi.mock('../state/store', () => ({ useApp: { getState: () => mocks.state } }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: mocks.app } }))
vi.mock('./native', () => ({ isNative: () => mocks.native, AnkerNative: { getAlarmDiagnostics: mocks.alarm, getDiagnosticJournal: mocks.journal, pcBridgeGetState: mocks.pc } }))
vi.mock('./bedtimePrompt', () => ({ BedtimeNative: { getBedtimePromptState: mocks.bedtime } }))

beforeEach(() => {
  mocks.native = true; mocks.state.settings = defaultSettings('2026-11-09')
  mocks.app.mockReset().mockResolvedValue({ version: '1.5.0-rc.2', build: '16' })
  mocks.alarm.mockReset().mockResolvedValue({ sdk: 36, audioOk: true })
  mocks.bedtime.mockReset().mockResolvedValue({ phase: 'idle' })
  mocks.journal.mockReset().mockResolvedValue({ version: 1, retentionDays: 7, maxEntries: 800, events: [] })
  mocks.pc.mockReset().mockResolvedValue({ connected: false })
})
afterEach(() => vi.useRealTimers())

describe('Lokale Diagnose lesen', () => {
  it('erfindet im Web keine Androidbelege und liest keine nativen Quellen', async () => {
    mocks.native = false
    const result = await readDiagnostics('a'.repeat(64), true)
    expect(result.input.app.platform).toBe('web')
    expect(result.input.journal).toMatchObject({ available: false, events: [] })
    for (const reader of [mocks.app, mocks.alarm, mocks.bedtime, mocks.journal, mocks.pc]) expect(reader).not.toHaveBeenCalled()
  })

  it('liest das Journal nach den Statuslesern und kontaktiert den PC nur bei eigener Auswahl', async () => {
    const order: string[] = []
    mocks.alarm.mockImplementation(async () => { order.push('alarm'); return { sdk: 36 } })
    mocks.bedtime.mockImplementation(async () => { order.push('bedtime'); return { phase: 'idle' } })
    mocks.journal.mockImplementation(async () => { order.push('journal'); return { version: 1, retentionDays: 7, maxEntries: 800, events: [] } })
    const result = await readDiagnostics('a'.repeat(64))
    expect(order.at(-1)).toBe('journal')
    expect(result.input.app).toMatchObject({ platform: 'android', version: '1.5.0-rc.2', build: '16' })
    expect(mocks.pc).not.toHaveBeenCalled()
    await readDiagnostics('a'.repeat(64), true)
    expect(mocks.pc).toHaveBeenCalledTimes(1)
  })

  it('begrenzt eine hängende Brücke, erhält andere Belege und übernimmt keine Rohfehlermeldung', async () => {
    vi.useFakeTimers()
    mocks.alarm.mockRejectedValue(new Error('PRIVATE_FILENAME'))
    mocks.journal.mockImplementation(() => new Promise(() => undefined))
    const read = readDiagnostics('b'.repeat(64))
    await vi.advanceTimersByTimeAsync(5_001)
    const result = await read
    expect(result.unavailable).toEqual(['alarm', 'journal'])
    expect(result.input.bedtimeStatus).toEqual({ phase: 'idle' })
    expect(result.input.journal).toMatchObject({ available: false, events: [] })
    expect(JSON.stringify(result)).not.toContain('PRIVATE_FILENAME')
  })
})
