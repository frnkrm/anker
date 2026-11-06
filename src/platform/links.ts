import { APP_ID } from '../../app.config'

/** Nur bekannte App-Einstiege öffnen, ohne Inhalte aus einer URL zu übernehmen. */
export function nativeDestination(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${APP_ID}:` || (parsed.pathname !== '' && parsed.pathname !== '/')) return undefined
    return ({ inbox: '/gedanke', alarm: '/wecker/klingelt', now: '/', evening: '/abend', thoughts: '/inbox', smartwake: '/wecker' } as Record<string, string>)[parsed.hostname]
  } catch {
    return undefined
  }
}
