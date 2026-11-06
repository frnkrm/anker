import { afterEach, expect, it, vi } from 'vitest'
import { defaultSettings } from '../core/defaults'
import type { Rec, Repository } from '../data/types'
import { MemoryRepository } from '../data/memory'

const context = vi.hoisted(() => ({
  client: {} as unknown,
  repo: undefined as Repository | undefined,
  load: vi.fn(async () => {}),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => context.client }))
vi.mock('../state/store', () => ({
  repository: () => context.repo,
  today: () => '2026-11-05',
  planFor: () => ({ pcStop: 1200 }),
  useApp: { getState: () => ({ load: context.load, days: {}, mergeRecords: (records: Rec[]) => context.repo!.merge(records) }) },
}))
vi.mock('./native', () => ({
  isNative: () => false,
  safe: async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await run() } catch { return fallback }
  },
}))

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('übernimmt exakt 1000 Datensätze erst nach der leeren Schlussseite und lädt den Store nach einem Retry', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only')
  const before = '2026-11-04T12:00:00+00:00'
  const at = '2026-11-05T12:00:00+00:00'
  const rows = Array.from({ length: 1000 }, (_, i): Rec & { server_updated_at: string } => ({
    collection: 'inbox', id: String(i).padStart(4, '0'), data: { title: String(i) }, updated_at: i + 1, deleted: false, server_updated_at: at,
  }))
  const pages = [
    { data: rows.slice(0, 1000), error: null },
    { data: null, error: new Error('connection lost') },
    { data: rows.slice(0, 1000), error: null },
    { data: rows.slice(1000), error: null },
  ]
  const lowerBounds: string[] = []
  context.client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user' } } } }) },
    from(table: string) {
      if (table === 'pc_stop') return { upsert: async () => ({ error: null }) }
      expect(table).toBe('records')
      const query = {
        select() { return query }, order() { return query }, limit() { return query }, or() { return query },
        gte(_field: string, value: string) { lowerBounds.push(value); return query },
        then(resolve: (value: (typeof pages)[number]) => unknown) {
          const page = pages.shift()
          if (!page) throw new Error('unexpected query')
          return Promise.resolve(page).then(resolve)
        },
      }
      return query
    },
  }
  context.repo = new MemoryRepository()
  await context.repo.put('meta', 'sync', { cursor: before, lastSync: 123 })
  const { syncNow } = await import('./supabase')

  expect(await syncNow()).toEqual({ cursor: before, lastSync: 123, error: 'connection lost' })
  expect(await context.repo.get('meta', 'sync')).toEqual({ cursor: before, lastSync: 123, error: 'connection lost' })
  expect(await context.repo.list('inbox')).toHaveLength(0)
  expect(context.load).not.toHaveBeenCalled()

  const result = await syncNow()
  expect(result).toEqual({ cursor: at, lastSync: expect.any(Number) })
  expect(await context.repo.get('meta', 'sync')).toEqual(result)
  expect(await context.repo.list('inbox')).toHaveLength(1000)
  expect(context.load).toHaveBeenCalledOnce()
  expect(lowerBounds).toEqual([before, before, before, before])
})

it('überträgt Wetterstadt und Koordinaten weder aus Settings noch aus altem Remote-Sync', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-only')
  context.load.mockClear()
  const settings = defaultSettings('2026-11-06')
  settings.weather = { ...settings.weather, enabled: true, city: 'Lokale Teststadt', lat: 51.12345, lng: 9.12345 }
  context.repo = new MemoryRepository()
  await context.repo.put('settings', 'main', settings)
  const pushed: unknown[] = []
  const pages = [
    { data: [{ collection: 'settings', id: 'main', data: { ...settings, weather: { ...settings.weather, city: 'Alter Remoteort', lat: 53.45678 } }, updated_at: Date.now() + 1000, deleted: false, server_updated_at: '2026-11-07T12:00:00Z' }], error: null },
    { data: [], error: null },
  ]
  context.client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user' } } } }) },
    async rpc(_name: string, payload: unknown) { pushed.push(payload); return { error: null } },
    from(table: string) {
      if (table === 'pc_stop') return { upsert: async () => ({ error: null }) }
      const query = {
        select() { return query }, order() { return query }, limit() { return query }, or() { return query }, gte() { return query },
        then(resolve: (page: (typeof pages)[number]) => unknown) { return Promise.resolve(pages.shift()!).then(resolve) },
      }
      return query
    },
  }
  const { syncNow } = await import('./supabase')
  await syncNow()
  expect(pushed).toHaveLength(1)
  expect(JSON.stringify(pushed)).not.toContain('Lokale Teststadt')
  expect(JSON.stringify(pushed)).not.toContain('51.12345')
  expect(JSON.stringify(pushed)).not.toContain('9.12345')
  const received = await context.repo.get<typeof settings>('settings', 'main')
  expect(received?.weather).toEqual({ enabled: false, city: '', rules: settings.weather.rules })
  expect(JSON.stringify(received)).not.toContain('Alter Remoteort')
})
