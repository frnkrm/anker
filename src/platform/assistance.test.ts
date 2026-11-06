import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistancePreferences } from '../core/assistance'
import { assistantCapabilities, cancelAssistanceRequests, requestAssistance } from './assistance'

const context = vi.hoisted(() => ({ profile: undefined as AssistancePreferences | undefined, token: true, sessionDelay: undefined as Promise<void> | undefined }))
vi.mock('../state/store', () => ({ useApp: { getState: () => ({ local: { assistance: context.profile } }) } }))
vi.mock('./supabase', () => ({ supabaseConfigured: true, sb: () => ({ auth: { getSession: async () => { await context.sessionDelay; return { data: { session: context.token ? { access_token: 'local-test-session' } : null }, error: null } } } }) }))

const input = { kind: 'steps' as const, revision: 'current-revision', title: 'Eigener bewusst gewählter Text', depth: 'three' as const }
const result = { kind: 'steps', revision: input.revision, steps: [{ title: 'Eine Unterlage öffnen', estimateMin: 2 }] }
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  context.profile = { ai: { enabled: true, version: 1, at: 1 } }; context.token = true; context.sessionDelay = undefined
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('Vorschläge nur nach Zweckfreigabe, ohne stille Planänderungen', () => {
  it('sendet bei fehlender Freigabe oder Anmeldung keine Aufgabe', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    context.profile = undefined
    await expect(requestAssistance(input)).rejects.toMatchObject({ issue: 'consent' })
    context.profile = { ai: { enabled: true, version: 1, at: 1 } }; context.token = false
    await expect(requestAssistance(input)).rejects.toMatchObject({ issue: 'signed-out' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('liefert nur einen Vorschlag und verwendet den vorhandenen angemeldeten Serverweg ohne Providerkey', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(result))
    vi.stubGlobal('fetch', fetcher)
    const before = structuredClone(context.profile)
    expect(await requestAssistance(input)).toEqual(result)
    expect(context.profile).toEqual(before)
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://example.supabase.co/functions/v1/assistant')
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: 'Bearer local-test-session' })
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain('api_key')
  })
  it('verwirft eine Antwort nach zwischenzeitlichem Ausschalten', async () => {
    let finish!: (value: Response) => void
    const pending = new Promise<Response>((resolve) => { finish = resolve })
    vi.stubGlobal('fetch', () => pending)
    const requesting = requestAssistance(input)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    context.profile = { ai: { enabled: false, version: 1, at: 1 } }
    finish(Response.json(result))
    await expect(requesting).rejects.toMatchObject({ issue: 'consent' })
  })
  it('sendet nach einer während der Sitzungsprüfung widerrufenen Freigabe gar keinen Inhalt', async () => {
    let release!: () => void
    context.sessionDelay = new Promise<void>((resolve) => { release = resolve })
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const requesting = requestAssistance(input)
    context.profile = { ai: { enabled: false, version: 1, at: 1 } }
    release()
    await expect(requesting).rejects.toMatchObject({ issue: 'consent' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('verwirft eine trotz Abbruch spät eintreffende Antwort', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    const requesting = requestAssistance(input, controller.signal)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    controller.abort(); finish(Response.json(result))
    await expect(requesting).rejects.toMatchObject({ issue: 'cancelled' })
  })
  it('bricht bei Widerruf auf Anmeldung wartende Anfragen ab, auch wenn die lokale Speicherung noch läuft', async () => {
    let release!: () => void
    context.sessionDelay = new Promise<void>((resolve) => { release = resolve })
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const requesting = requestAssistance(input)
    cancelAssistanceRequests('ai')
    release()
    await expect(requesting).rejects.toMatchObject({ issue: 'consent' })
    expect(fetcher).not.toHaveBeenCalled()
    // Neue bewusste Anfragen nach einer weiterhin bestehenden/erneuten Freigabe bleiben möglich.
    vi.stubGlobal('fetch', async () => Response.json(result))
    expect(await requestAssistance(input)).toEqual(result)
  })
  it('bricht nur den widerrufenen Zweck ab und verwirft eine späte Antwort', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const requesting = requestAssistance(input)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    cancelAssistanceRequests('routes')
    const signal = fetcher.mock.calls[0]![1]!.signal!
    expect(signal.aborted).toBe(false)
    cancelAssistanceRequests('ai')
    expect(signal.aborted).toBe(true)
    finish(Response.json(result))
    await expect(requesting).rejects.toMatchObject({ issue: 'cancelled' })
  })
  it('weist falsche Revisionen und beschädigte Vorschläge zurück', async () => {
    for (const response of [{ ...result, revision: 'old' }, { ...result, steps: [{ title: '' }] }]) {
      vi.stubGlobal('fetch', async () => Response.json(response))
      await expect(requestAssistance(input)).rejects.toMatchObject({ issue: 'invalid-response' })
    }
  })
  it('zeigt Kostenlimit oder Verbindungsfehler ohne private Rohmeldung', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ private: 'never-display' }, { status: 429 }))
    await expect(requestAssistance(input)).rejects.toMatchObject({ issue: 'daily-limit' })
    vi.stubGlobal('fetch', async () => { throw new Error('customer-address-and-secret') })
    const failed = await requestAssistance(input).catch((error: unknown) => error)
    expect(failed).toMatchObject({ issue: 'offline' })
    expect(String(failed)).not.toContain('customer-address-and-secret')
  })
  it('prüft Fähigkeiten bewusst ohne dadurch eine Datenfreigabe anzulegen', async () => {
    context.profile = undefined
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ai: { configured: false, provider: 'OpenAI' }, routes: { configured: false, provider: 'Google Routes', modes: ['driving'] }, dailyLimits: { steps: 8, route: 6 } }))
    vi.stubGlobal('fetch', fetcher)
    expect((await assistantCapabilities()).ai.configured).toBe(false)
    expect(context.profile).toBeUndefined()
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' })
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined()
  })
})
