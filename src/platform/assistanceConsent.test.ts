import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from '../state/store'
import { assistanceEnableConfirmation, cancelAssistanceRequests, requestAssistance } from './assistance'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
vi.mock('./supabase', () => ({ supabaseConfigured: true, sb: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'local-test-session' } }, error: null }) } }) }))
const app = () => useApp.getState()
const inputs = {
  ai: { kind: 'steps' as const, revision: 'test-revision', title: 'Lokaler Testinhalt', depth: 'three' as const },
  routes: { kind: 'route' as const, revision: 'test-revision', origin: { address: 'Nur Teststart' }, destination: { address: 'Nur Testziel' }, mode: 'driving' as const, timing: 'arrival' as const, at: '2026-11-07T10:00:00Z' },
}
const results = {
  ai: { kind: 'steps', revision: 'test-revision', steps: [{ title: 'Kleiner Testschritt' }] },
  routes: { kind: 'route', revision: 'test-revision', route: { durationMin: 20, source: 'Google Routes', fetchedAt: Date.now(), travelAt: inputs.routes.at, mode: 'driving', trafficAware: true, estimated: true } },
}

beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-06'), local: emptyLocal(), days: {}, inbox: [], game: initialGame('2026-11-06') })
  await app().load()
  await app().saveLocal((local) => ({ ...local, assistance: { ai: { enabled: true, at: 1, version: 1 }, routes: { enabled: true, at: 1, version: 1 } } }))
  assistanceEnableConfirmation('ai')(); assistanceEnableConfirmation('routes')()
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Sofortiger Widerruf trotz belegter Store-Schreibbarriere', () => {
  it.each(['ai', 'routes'] as const)('sendet nach %s-Widerruf keinen neu begonnenen Request, obwohl RAM noch den alten gespeicherten Wert enthält', async (purpose) => {
    const original = storage.repo!.put.bind(storage.repo!)
    let entered!: () => void; let release!: () => void
    const waiting = new Promise<void>((resolve) => { entered = resolve })
    const hold = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { entered(); await hold; return original(...args) })
    const previous = app().saveLocal((local) => ({ ...local, taskContext: 'home' }))
    await waiting
    cancelAssistanceRequests(purpose)
    const revoke = app().saveLocal((local) => ({ ...local, assistance: { ...local.assistance, [purpose]: { enabled: false, at: 2, version: 1 } } }))
    expect(app().local.assistance?.[purpose]?.enabled).toBe(true)
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(results[purpose]))
    vi.stubGlobal('fetch', fetcher)
    try {
      await expect(requestAssistance(inputs[purpose])).rejects.toMatchObject({ issue: 'consent' })
      expect(fetcher).not.toHaveBeenCalled()
    } finally { release(); await previous; await revoke }
    expect(app().local.assistance?.[purpose]?.enabled).toBe(false)
  })
  it.each(['ai', 'routes'] as const)('erlaubt %s erst nach erfolgreichem bewusstem Wiedereinschalten', async (purpose) => {
    cancelAssistanceRequests(purpose)
    await app().saveLocal((local) => ({ ...local, assistance: { ...local.assistance, [purpose]: { enabled: false, at: 2, version: 1 } } }))
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(results[purpose]))
    vi.stubGlobal('fetch', fetcher)
    const failedConfirmation = assistanceEnableConfirmation(purpose)
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Lokaler Test-Speicherfehler'))
    await expect(app().saveLocal((local) => ({ ...local, assistance: { ...local.assistance, [purpose]: { enabled: true, at: 3, version: 1 } } })).then(failedConfirmation)).rejects.toThrow('Test-Speicherfehler')
    await expect(requestAssistance(inputs[purpose])).rejects.toMatchObject({ issue: 'consent' })
    expect(fetcher).not.toHaveBeenCalled()
    const confirm = assistanceEnableConfirmation(purpose)
    await app().saveLocal((local) => ({ ...local, assistance: { ...local.assistance, [purpose]: { enabled: true, at: 4, version: 1 } } })).then(confirm)
    expect(await requestAssistance(inputs[purpose])).toEqual(results[purpose])
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('lässt eine ältere Einschaltbestätigung keinen neueren Widerruf aufheben', async () => {
    const confirm = assistanceEnableConfirmation('ai')
    cancelAssistanceRequests('ai')
    confirm()
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    await expect(requestAssistance(inputs.ai)).rejects.toMatchObject({ issue: 'consent' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
