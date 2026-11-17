export type ProviderFailure = { event: 'assistant_provider_failure'; provider: 'Gemini' | 'TomTom'; httpStatus: number }

/** Operationsdiagnose ohne URL, Header, Schlüssel, Anfrage- oder Antwortinhalt. */
export function providerDiagnosticFetch(run: typeof fetch, report: (event: ProviderFailure) => void): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const provider = url.protocol === 'https:' && ({ 'generativelanguage.googleapis.com': 'Gemini', 'api.tomtom.com': 'TomTom' } as const)[url.hostname as 'generativelanguage.googleapis.com' | 'api.tomtom.com']
    const response = await run(input, init)
    if (!response.ok && provider) report({ event: 'assistant_provider_failure', provider, httpStatus: response.status })
    return response
  }
}
