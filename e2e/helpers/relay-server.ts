/// <reference lib="dom" />
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Page } from '@playwright/test'

export const relayProject = 'abcdefghijklmnopqrst'
export const relayHost = `https://${relayProject}.supabase.co`
export const relayStart = Date.parse('2026-11-10T10:00:00+01:00')
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'relay-browser-fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-11-06T09:00:00Z' }
const accessToken = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: 2208988800 })).toString('base64url'), 'controlled-relay-test-signature'].join('.')

/** Synthetic public configuration only. No real Supabase project, secret or cloud activation. */
export async function startRelayServer(port: number, configured: boolean): Promise<{ url: string; close: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), 'anker-relay-ui-e2e-')), vite = resolve('node_modules/vite/bin/vite.js')
  const env = { ...process.env, VITE_SUPABASE_URL: configured ? relayHost : '', VITE_SUPABASE_ANON_KEY: configured ? 'public-relay-browser-test-key' : '' }
  let server: ChildProcess | undefined
  try {
    await new Promise<void>((done, reject) => {
      const build = spawn(process.execPath, [vite, 'build', '--outDir', directory, '--emptyOutDir'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''
      build.stdout.on('data', (data: Buffer) => { output += data.toString() }); build.stderr.on('data', (data: Buffer) => { output += data.toString() })
      build.on('error', reject); build.on('exit', code => code === 0 ? done() : reject(new Error(`Relay-Fixture-Build fehlgeschlagen (${code}): ${output}`)))
    })
    server = spawn(process.execPath, [vite, 'preview', '--outDir', directory, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    const url = `http://127.0.0.1:${port}`
    let output = ''
    server.stdout?.on('data', (data: Buffer) => { output += data.toString() }); server.stderr?.on('data', (data: Buffer) => { output += data.toString() })
    await new Promise<void>((ready, reject) => {
      const deadline = Date.now() + 10_000
      const poll = async () => {
        if (server?.exitCode !== null) { reject(new Error(`Relay-Fixture-Server beendet: ${output}`)); return }
        try { if ((await fetch(url)).ok) { ready(); return } } catch { /* Preview startup only. */ }
        if (Date.now() > deadline) { reject(new Error('Relay-Fixture-Server wurde nicht erreichbar.')); return }
        setTimeout(() => { void poll() }, 50)
      }
      void poll()
    })
    return { url, close: async () => { await stop(server); await rm(directory, { recursive: true, force: true }) } }
  } catch (error) { await stop(server); await rm(directory, { recursive: true, force: true }); throw error }
}
async function stop(child?: ChildProcess) {
  if (!child || child.exitCode !== null) return
  await new Promise<void>(done => { child.once('exit', () => done()); child.kill() })
}

/** SDK getSession consumes a synthetic local fixture; every project HTTP request is intercepted. */
export async function installRelaySession(page: Page) {
  await page.addInitScript(({ project, user, accessToken }) => {
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: accessToken, refresh_token: 'test-only-relay-refresh-token', token_type: 'bearer', expires_at: 2208988800, expires_in: 3600, user }))
  }, { project: relayProject, user, accessToken })
  await page.route(`${relayHost}/**`, async route => { await route.fulfill({ status: 503, json: { message: 'Kein echter Dienst in dieser kontrollierten Relay-UI-Fixture.' } }) })
}
