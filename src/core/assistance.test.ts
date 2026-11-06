import { describe, expect, it, vi } from 'vitest'
import { createAssistantHandler, type AssistantServerConfig } from '../../supabase/functions/_shared/assistantHandler'
import { validAssistantRequest } from '../../supabase/functions/_shared/assistanceProtocol'

const now = Date.parse('2026-11-06T10:00:00+01:00')
const config: AssistantServerConfig = {
  supabaseUrl: 'https://example.supabase.co', anonKey: 'public-test-key', allowedUsers: ['owner'], origins: ['https://anker.test'],
  aiKey: 'server-ai-test', aiModel: 'configured-model', routesKey: 'server-routes-test',
}
const steps = { kind: 'steps', revision: 'task:revision', title: 'Eine Unterlage öffnen', depth: 'three' }
const route = { kind: 'route', revision: 'plan:revision', origin: { address: 'Manuell gewählter Start' }, destination: { latitude: 52, longitude: 13 }, mode: 'driving', at: new Date(now + 3600_000).toISOString(), timing: 'departure' }
const request = (input: unknown, auth = 'Bearer test-user-session', method = 'POST') => new Request('https://example.supabase.co/functions/v1/assistant', {
  method, headers: { origin: 'https://anker.test', authorization: auth, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
})
function harness(options: { user?: string; budget?: boolean; budgetFailure?: boolean; providerFailure?: boolean; malformed?: boolean } = {}) {
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const path = String(url)
    if (path.endsWith('/auth/v1/user')) return Response.json({ id: options.user ?? 'owner' })
    if (path.includes('/rpc/claim_assistant_request')) return options.budgetFailure ? Response.json({}, { status: 404 }) : Response.json(options.budget ?? true)
    if (options.providerFailure) return Response.json({ sensitive: 'private-provider-detail' }, { status: 500 })
    if (path.includes('api.openai.com')) return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: options.malformed ? [{ title: '' }] : [{ title: 'Die Unterlage öffnen', estimateMin: 2 }, { title: 'Eine Zeile auswählen' }] }) } }] })
    if (path.includes('routes.googleapis.com')) return Response.json({ routes: options.malformed ? [] : [{ duration: '2400s' }] })
    throw new Error('unexpected test destination')
  })
  return { fetcher, handler: createAssistantHandler(config, { fetch: fetcher, now: () => now }) }
}

describe('Optionale echte Backendadapter mit geschlossener Daten- und Kostengrenze', () => {
  it('bleibt ohne explizit freigegebene Serverkonten geschlossen und fragt keinen Anbieter an', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const handler = createAssistantHandler({ ...config, allowedUsers: [] }, { fetch: fetcher, now: () => now })
    expect((await handler(request(steps))).status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('verweigert fehlende Sitzung, fremde Konten und nicht erlaubte Webherkunft', async () => {
    const { handler, fetcher } = harness({ user: 'somebody-else' })
    expect((await handler(request(steps, ''))).status).toBe(401)
    expect((await handler(request(steps))).status).toBe(403)
    const other = new Request('https://example.supabase.co/functions/v1/assistant', { method: 'GET', headers: { origin: 'https://unknown.test' } })
    expect((await handler(other)).status).toBe(403)
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith('/auth/v1/user'))).toBe(true)
  })
  it('erfordert das serverseitige atomare Tagesbudget statt bei fehlender Migration unbeschränkt fortzufahren', async () => {
    for (const options of [{ budget: false }, { budgetFailure: true }]) {
      const { handler, fetcher } = harness(options)
      const result = await handler(request(steps))
      expect(result.status).toBe(options.budgetFailure ? 503 : 429)
      expect(fetcher.mock.calls).toHaveLength(2)
    }
  })
  it('sendet nur bewusst gewählte Aufgabenfelder und hält Providerkeys ausschließlich im Serveraufruf', async () => {
    const { handler, fetcher } = harness()
    const response = await handler(request({ ...steps, unknownSecret: 'nicht-übertragen', workSessions: [{ private: true }] }))
    const output: unknown = await response.json()
    expect(output).toMatchObject({ kind: 'steps', revision: steps.revision, steps: [{ title: 'Die Unterlage öffnen', estimateMin: 2 }, { title: 'Eine Zeile auswählen' }] })
    const call = fetcher.mock.calls.find(([url]) => String(url).includes('api.openai.com'))!
    expect(String(call[1]?.body)).not.toContain('nicht-übertragen')
    expect(String(call[1]?.body)).not.toContain('workSessions')
    expect(JSON.stringify(output)).not.toContain(config.aiKey)
    expect(call[1]?.headers).toMatchObject({ authorization: `Bearer ${config.aiKey}` })
  })
  it('liefert bei fehlender Route keine Nullminuten und bei Providerfehler keine privaten Rohmeldungen', async () => {
    const bad = harness({ malformed: true })
    expect((await bad.handler(request(route))).status).toBe(502)
    const failed = harness({ providerFailure: true })
    const response = await failed.handler(request(steps))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private-provider-detail')
  })
  it('lehnt beschädigte/viel zu große Aufgaben und mehrdeutige Uhrzeiten vor Anbieterabfrage ab', async () => {
    expect(validAssistantRequest({ ...route, at: '2026-11-06T11:00' })).toBe(false)
    expect(validAssistantRequest({ ...route, destination: { latitude: 200, longitude: 13 } })).toBe(false)
    const { handler, fetcher } = harness()
    expect((await handler(request({ ...steps, title: 'x'.repeat(13_000) }))).status).toBe(413)
    expect(fetcher.mock.calls).toHaveLength(1)
  })
  it('übernimmt ÖPNV-Ankunftszeit und fordert dafür keine Auto-Stauoption an', async () => {
    const { handler, fetcher } = harness()
    const response = await handler(request({ ...route, mode: 'transit', timing: 'arrival' }))
    expect(await response.json()).toMatchObject({ kind: 'route', revision: route.revision, route: { durationMin: 40, trafficAware: false, estimated: true, source: 'Google Routes' } })
    const call = fetcher.mock.calls.find(([url]) => String(url).includes('routes.googleapis.com'))!
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({ arrivalTime: route.at, travelMode: 'TRANSIT' })
    expect(String(call[1]?.body)).not.toContain('routingPreference')
  })
  it('begrenzt die Auto-Ankunftsnäherung auf höchstens drei Anbieteraufrufe', async () => {
    const { handler, fetcher } = harness()
    const response = await handler(request({ ...route, timing: 'arrival' }))
    expect(response.status).toBe(200)
    const calls = fetcher.mock.calls.filter(([url]) => String(url).includes('routes.googleapis.com'))
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.length).toBeLessThanOrEqual(3)
    for (const [, init] of calls) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body.routingPreference).toBe('TRAFFIC_AWARE')
      expect(body.arrivalTime).toBeUndefined()
    }
  })
  it('holt nur Fähigkeiten beim expliziten Verbindungscheck, ohne Inhalte oder Budgetverbrauch', async () => {
    const { handler, fetcher } = harness()
    expect(await (await handler(request(undefined, undefined, 'GET'))).json()).toMatchObject({ ai: { configured: true }, routes: { configured: true } })
    expect(fetcher.mock.calls).toHaveLength(1)
  })
  it('kennzeichnet eine nach drei Auto-Anfragen weiter schwankende Ankunftsschätzung als unsicher', async () => {
    let call = 0
    const times = [900, 2700, 600]
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'owner' })
      if (String(url).includes('/rpc/')) return Response.json(true)
      return Response.json({ routes: [{ duration: `${times[call++]}s` }] })
    })
    const handler = createAssistantHandler(config, { fetch: fetcher, now: () => now })
    expect(await (await handler(request({ ...route, timing: 'arrival' }))).json()).toMatchObject({ route: { uncertain: true, estimated: true } })
    expect(call).toBe(3)
  })
})
