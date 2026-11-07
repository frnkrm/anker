import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { APP_ID } from '../../app.config'
const context = vi.hoisted(() => ({ listener: undefined as ((event: { url: string }) => Promise<void>) | undefined, exchange: vi.fn(), rpc: vi.fn(), toast: vi.fn() }))
vi.mock('@capacitor/app', () => ({ App: { addListener: (_event: string, listener: (event: { url: string }) => Promise<void>) => { context.listener = listener; return Promise.resolve({ remove() {} }) } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { exchangeCodeForSession: (code: string) => context.exchange(code) }, rpc: context.rpc }) }))
vi.mock('../state/store', () => ({ useApp: { getState: () => ({ settings: { integrations: { sync: false } }, showToast: context.toast }) }, repository: () => undefined }))
vi.mock('./native', () => ({ isNative: () => true, safe: async <T>(run: () => Promise<T>, fallback: T) => { try { return await run() } catch { return fallback } } }))
beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only'); context.exchange.mockReset().mockResolvedValue({ error: null }); context.rpc.mockReset(); context.toast.mockReset(); context.listener = undefined })
afterEach(() => vi.unstubAllEnvs())
it('meldet den Benutzer für eine optionale Integration an, ohne abgeschalteten Sync zu starten', async () => {
  const { listenForAuthLinks } = await import('./supabase'); listenForAuthLinks()
  await context.listener!({ url: `${APP_ID}://login?code=synthetic-code` })
  expect(context.exchange).toHaveBeenCalledWith('synthetic-code'); expect(context.rpc).not.toHaveBeenCalled()
  expect(context.toast).toHaveBeenCalledWith('Angemeldet. Automatischer Sync bleibt ausgeschaltet.')
})
it('meldet nach fehlgeschlagenem Austausch keinen falschen Login-Erfolg', async () => {
  context.exchange.mockResolvedValueOnce({ error: { message: 'Synthetic failure' } })
  const { listenForAuthLinks } = await import('./supabase'); listenForAuthLinks()
  await context.listener!({ url: `${APP_ID}://login?code=synthetic-code` })
  expect(context.toast.mock.calls[0]![0]).toContain('nicht geklappt'); expect(context.rpc).not.toHaveBeenCalled()
})
it('verwendet nur den vorgesehenen Auth-Rückweg und ignoriert fremde Links', async () => {
  const { listenForAuthLinks } = await import('./supabase'); listenForAuthLinks()
  for (const url of ['broken', 'https://example.org?code=x', 'de.frnkrm.anker://login?code=x', `${APP_ID}://inbox?code=x`, `${APP_ID}://login/other?code=x`]) await context.listener!({ url })
  expect(context.exchange).not.toHaveBeenCalled(); expect(context.toast).not.toHaveBeenCalled()
})
