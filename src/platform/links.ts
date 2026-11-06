import { APP_ID } from '../../app.config'

/** Nur bekannte App-Einstiege öffnen, ohne Inhalte aus einer URL zu übernehmen. */
export function nativeDestination(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${APP_ID}:` || (parsed.pathname !== '' && parsed.pathname !== '/')) return undefined
    const routes: Readonly<Record<string, string>> = { inbox: '/gedanke', recover: '/wiedereinstieg', focus: '/fokus-start', alarm: '/wecker/klingelt', now: '/', evening: '/abend', thoughts: '/inbox', smartwake: '/wecker' }
    return Object.hasOwn(routes, parsed.hostname) ? routes[parsed.hostname] : undefined
  } catch {
    return undefined
  }
}
