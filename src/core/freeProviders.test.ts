import { describe, expect, it, vi } from 'vitest'
import { createAssistantHandler, type AssistantServerConfig } from '../../supabase/functions/_shared/assistantHandler'

const config: AssistantServerConfig = { supabaseUrl: 'https://test.supabase.co', anonKey: 'public', allowedUsers: ['owner'], origins: [],
  freeOnly: true, freePlanConfirmed: true, geminiKey: 'test-gemini', tomtomKey: 'test-tomtom', aiKey: 'NEVER-USE-PAID', routesKey: 'NEVER-USE-PAID' }
const now = Date.parse('2026-11-17T12:00:00Z')
const steps = { kind: 'steps', revision: 'test', title: 'Ein Blatt bereitlegen', depth: 'three' }
const route = { kind: 'route', revision: 'test', origin: { latitude: 52, longitude: 13 }, destination: { latitude: 53, longitude: 14 }, mode: 'driving', timing: 'departure', at: new Date(now + 3600_000).toISOString() }
const request = (input: unknown) => new Request('https://test.supabase.co/functions/v1/assistant', { method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json', 'x-anker-cost-policy': 'free-only' }, body: JSON.stringify(input) })
function setup(patch: Partial<AssistantServerConfig> = {}, failure = false) {
  const fetcher = vi.fn<typeof fetch>(async url => {
    const u = String(url)
    if (u.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' })
    if (u.includes('claim_assistant_request')) return Response.json(true)
    if (failure) return Response.json({}, { status: 429 })
    if (u.includes('generativelanguage.googleapis.com')) return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ steps: [{ title: 'Ein Blatt bereitlegen' }] }) }] } }] })
    if (u.includes('/routing/')) return Response.json({ routes: [{ summary: { travelTimeInSeconds: 1801 } }] })
    if (u.includes('/geocode/')) return Response.json({ results: [{ position: { lat: 52, lon: 13 } }, { position: { lat: 53, lon: 14 } }] })
    throw new Error('Unerwarteter Anbieter')
  })
  return { fetcher, handler: createAssistantHandler({ ...config, ...patch }, { fetch: fetcher, now: () => now }) }
}
describe('Kostenfreie Anbieter ohne kostenpflichtigen Fallback', () => {
  it('bleibt ohne bestätigten Free-Tier trotz vorhandener Schlüssel geschlossen', async () => {
    const { handler, fetcher } = setup({ freePlanConfirmed: false })
    expect((await handler(request(steps))).status).toBe(503)
    expect(fetcher.mock.calls).toHaveLength(1)
  })
  it('weist einen kostenpflichtigen Altserver vor Budget/Provideraufruf zurück', async () => {
    const { handler, fetcher } = setup({ freeOnly: false, aiModel: 'paid' })
    expect((await handler(request(steps))).status).toBe(503)
    expect(fetcher.mock.calls).toHaveLength(1)
  })
  it('verwendet Gemini JSON ohne Tools und meldet Grenzen ohne Ersatzanbieter', async () => {
    const { handler, fetcher } = setup()
    expect(await (await handler(request(steps))).json()).toMatchObject({ kind: 'steps', steps: [{ title: 'Ein Blatt bereitlegen' }] })
    const body = JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body)) as Record<string, unknown>
    expect(body).not.toHaveProperty('tools')
    const failed = setup({}, true)
    expect((await failed.handler(request(steps))).status).toBe(502)
    expect(failed.fetcher.mock.calls.some(([u]) => /openai|routes.googleapis/.test(String(u)))).toBe(false)
  })
  it('liefert eine TomTom-Schätzung mit ehrlicher Quelle und genau einer Koordinatenroute', async () => {
    const { handler, fetcher } = setup()
    expect(await (await handler(request(route))).json()).toMatchObject({ kind: 'route', route: { source: 'TomTom', durationMin: 31, estimated: true, trafficAware: true } })
    expect(fetcher.mock.calls).toHaveLength(3)
  })
  it('erfindet weder eine unklare Adresse noch einen ÖPNV-Ersatz', async () => {
    const { handler, fetcher } = setup()
    expect((await handler(request({ ...route, mode: 'transit' }))).status).toBe(400)
    expect(fetcher.mock.calls).toHaveLength(1)
    expect((await handler(request({ ...route, origin: { address: 'Unklarer Ort' } }))).status).toBe(502)
    expect(fetcher.mock.calls.some(([u]) => String(u).includes('/routing/'))).toBe(false)
  })
})
