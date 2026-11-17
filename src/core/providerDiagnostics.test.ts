import { describe, expect, it, vi } from 'vitest'
import { providerDiagnosticFetch } from '../../supabase/functions/_shared/providerDiagnostics'

describe('Inhaltsfreie Providerdiagnose', () => {
  it('meldet nur festen Anbieter und Status, niemals Schlüssel oder Eingaben', async () => {
    const report = vi.fn()
    const response = new Response('private provider detail', { status: 401 })
    const run = vi.fn<typeof fetch>().mockResolvedValue(response)
    const fetcher = providerDiagnosticFetch(run, report)
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/example:generateContent?key=SYNTHETIC_PRIVATE_KEY'
    const init = { method: 'POST', headers: { 'x-goog-api-key': 'SYNTHETIC_PRIVATE_KEY' }, body: 'private task' }
    expect(await fetcher(url, init)).toBe(response)
    expect(run).toHaveBeenCalledWith(url, init)
    expect(report).toHaveBeenCalledExactlyOnceWith({ event: 'assistant_provider_failure', provider: 'Gemini', httpStatus: 401 })
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/PRIVATE|task|detail|https/)
  })

  it('erhält TomTom-Antworten und protokolliert weder Erfolg noch Auth-/Budgetaufrufe', async () => {
    const report = vi.fn()
    const run = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('', { status: 403 }))
    const fetcher = providerDiagnosticFetch(run, report)
    await fetcher(new Request('https://api.tomtom.com/routing/1/example?key=SYNTHETIC_PRIVATE_KEY'))
    await fetcher('https://api.tomtom.com/routing/1/example')
    await fetcher('https://project.supabase.co/auth/v1/user')
    expect(report).toHaveBeenCalledExactlyOnceWith({ event: 'assistant_provider_failure', provider: 'TomTom', httpStatus: 429 })
  })
})
