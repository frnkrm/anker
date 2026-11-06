/// <reference lib="dom" />
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Page, Route } from '@playwright/test'
import type { AssistantRequest } from '../../src/core/assistance'

export const assistanceHost = 'https://assistance-fixture.supabase.co'
export const configuredCapabilities = {
  ai: { configured: true, provider: 'OpenAI', model: 'controlled-browser-fixture' },
  routes: { configured: true, provider: 'Google Routes', modes: ['driving', 'transit', 'cycling', 'walking'] },
  dailyLimits: { steps: 8, route: 6 },
}

/** Realer Produktionsbuild mit öffentlicher Test-Konfiguration, ohne Testschalter im Produkt. */
export async function startAssistanceServer(port = 4222, backendConfigured = true): Promise<{ url: string; close: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), 'anker-assistance-e2e-'))
  const vite = resolve('node_modules/vite/bin/vite.js')
  const env = { ...process.env, VITE_SUPABASE_URL: backendConfigured ? assistanceHost : '', VITE_SUPABASE_ANON_KEY: backendConfigured ? 'public-browser-test-key' : '' }
  let server: ChildProcess | undefined
  try {
    await new Promise<void>((resolveBuild, reject) => {
      const build = spawn(process.execPath, [vite, 'build', '--outDir', directory, '--emptyOutDir'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''
      build.stdout.on('data', (data: Buffer) => { output += data.toString() })
      build.stderr.on('data', (data: Buffer) => { output += data.toString() })
      build.on('error', reject)
      build.on('exit', (code) => code === 0 ? resolveBuild() : reject(new Error(`Fixture-Build fehlgeschlagen (${code}): ${output}`)))
    })
    server = spawn(process.execPath, [vite, 'preview', '--outDir', directory, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    const url = `http://127.0.0.1:${port}`
    let serverError = ''
    server.stdout?.on('data', (data: Buffer) => { serverError += data.toString() })
    server.stderr?.on('data', (data: Buffer) => { serverError += data.toString() })
    await new Promise<void>((ready, reject) => {
      const deadline = Date.now() + 10_000
      const poll = async () => {
        if (server?.exitCode !== null) { reject(new Error(`Fixture-Server beendet: ${serverError}`)); return }
        try { if ((await fetch(url)).ok) { ready(); return } } catch { /* Server startet. */ }
        if (Date.now() > deadline) { reject(new Error('Fixture-Server wurde nicht erreichbar.')); return }
        setTimeout(() => { void poll() }, 50)
      }
      void poll()
    })
    return { url, close: async () => { await stop(server); await rm(directory, { recursive: true, force: true }) } }
  } catch (error) { await stop(server); await rm(directory, { recursive: true, force: true }); throw error }
}
async function stop(child?: ChildProcess) {
  if (!child || child.exitCode !== null) return
  await new Promise<void>((done) => { child.once('exit', () => done()); child.kill() })
}

/** Nur dieser Testpfad simuliert Sitzung und HTTP-Antworten; kein echter Anbieteraufruf. */
export async function installAssistanceBackend(page: Page, respond?: (request: AssistantRequest, route: Route) => Promise<void>): Promise<AssistantRequest[]> {
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'browser-fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-11-06T09:00:00Z' }
  const accessToken = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: 2208988800 })).toString('base64url'), 'controlled-test-signature'].join('.')
  await page.addInitScript(({ user, accessToken }) => {
    localStorage.setItem('sb-assistance-fixture-auth-token', JSON.stringify({ access_token: accessToken, refresh_token: 'test-only-refresh-token', token_type: 'bearer', expires_at: 2208988800, expires_in: 3600, user }))
  }, { user, accessToken })
  const requests: AssistantRequest[] = []
  await page.route(`${assistanceHost}/**`, async (route) => {
    const request = route.request()
    if (request.url().endsWith('/functions/v1/assistant')) {
      if (request.method() === 'GET') { await route.fulfill({ json: configuredCapabilities }); return }
      const payload = request.postDataJSON() as AssistantRequest
      requests.push(payload)
      if (respond) { await respond(payload, route); return }
      if (payload.kind === 'steps') { await route.fulfill({ json: { kind: 'steps', revision: payload.revision, steps: [{ title: 'Eine Unterlage öffnen', estimateMin: 2 }, { title: 'Eine Zeile ansehen', estimateMin: 3 }] } }); return }
    }
    if (request.url().includes('/auth/v1/user')) { await route.fulfill({ json: user }); return }
    await route.fulfill({ status: 404, json: { message: 'Kein Endpunkt in dieser kontrollierten Testumgebung' } })
  })
  return requests
}
