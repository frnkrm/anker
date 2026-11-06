import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => ({
  sync: true, fail: false, open: true, writes: [] as unknown[],
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user' } } } }) },
  from: () => ({ upsert: async (value: unknown) => { context.writes.push(value); return { error: context.fail ? new Error('private-server-message') : null } } }),
}) }))
vi.mock('../state/store', () => ({
  today: () => '2026-11-06',
  planFor: (date: string) => ({ date, pcStop: context.open ? 1679 : 1350, openEnd: context.open }),
  repository: () => undefined,
  useApp: { getState: () => ({ settings: { integrations: { sync: context.sync } }, days: {} }) },
}))
vi.mock('./native', () => ({ isNative: () => false, safe: async <T>(action: () => Promise<T>, fallback: T) => { try { return await action() } catch { return fallback } } }))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  context.sync = true; context.fail = false; context.open = true; context.writes = []
})
afterEach(() => vi.unstubAllEnvs())

it('veröffentlicht eine echte Pause statt einer scheinbaren03:59-Abschaltung und behauptet keinen Empfang', async () => {
  const { pushPcStop } = await import('./supabase')
  const result = await pushPcStop()
  expect(context.writes[0]).toMatchObject({ entries: [expect.objectContaining({ date: '2026-11-06', mode: 'paused' }), expect.objectContaining({ date: '2026-11-07', mode: 'paused' })] })
  expect(result).toMatchObject({ status: 'published' })
  expect(JSON.stringify(context.writes)).not.toContain('stopAt')
})

it('meldet einen fehlgeschlagenen Publish ohne falsche Bestätigung oder privaten Fehlertext', async () => {
  context.fail = true
  const { pushPcStop } = await import('./supabase')
  const result = await pushPcStop()
  expect(result).toMatchObject({ status: 'error' })
  expect(JSON.stringify(result)).not.toContain('private-server-message')
})

it('schreibt bei ausgeschaltetem automatischem Abgleich nichts ohne ausdrücklichen manuellen Auftrag', async () => {
  context.sync = false
  const { pushPcStop } = await import('./supabase')
  expect(await pushPcStop()).toMatchObject({ status: 'disabled' })
  expect(context.writes).toEqual([])
})
