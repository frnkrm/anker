import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../core/defaults'
import { MemoryRepository } from '../data/memory'
import type { Rec, Repository } from '../data/types'

const context = vi.hoisted(() => ({ enabled: true, client: {} as unknown, repo: undefined as Repository | undefined }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => context.client }))
vi.mock('../state/store', () => ({
  repository: () => context.repo, today: () => '2026-11-06', planFor: () => ({ pcStop: 1200 }),
  useApp: { getState: () => ({ settings: { integrations: { sync: context.enabled } }, days: {}, inbox: [], load: async () => undefined, mergeRecords: (records: Rec[]) => context.repo!.merge(records) }) },
}))
vi.mock('./native', () => ({ isNative: () => false, safe: async <T>(run: () => Promise<T>, fallback: T) => { try { return await run() } catch { return fallback } } }))
function client(getSession = async () => ({ data: { session: { user: { id: 'test-user' } } } })) {
  const rpc = vi.fn(async (_name: string, _payload: unknown): Promise<{ error: Error | null }> => ({ error: null }))
  const publication = vi.fn(async () => ({ error: null }))
  context.client = { auth: { getSession }, rpc, from: (table: string) => {
    if (table === 'pc_stop') return { upsert: publication }
    const query = { select() { return query }, order() { return query }, limit() { return query }, or() { return query }, gte() { return query }, then(resolve: (value: { data: never[]; error: null }) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve) } }
    return query
  } }
  return { rpc, publication }
}
beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  context.enabled = true; context.repo = new MemoryRepository()
  await context.repo.put('inbox', 'private', { id: 'private', text: 'Bewusst synchronisierbare private Notiz', status: 'open', createdAt: 1 })
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules() })

describe('Syncfreigabe und explizit lokale Inhalte', () => {
  it('beginnt ohne eingeschalteten automatischen Sync keinen Upload', async () => {
    context.enabled = false
    const { rpc, publication } = client()
    const { syncNow } = await import('./supabase')
    await syncNow()
    expect(rpc).not.toHaveBeenCalled(); expect(publication).not.toHaveBeenCalled()
  })
  it('führt einen ausdrücklich manuellen Sync aus, ohne die Automatik selbst einzuschalten', async () => {
    context.enabled = false
    const { rpc } = client()
    const { syncNow } = await import('./supabase')
    await syncNow({ manual: true })
    expect(rpc).toHaveBeenCalledOnce(); expect(context.enabled).toBe(false)
  })
  it('blockiert neue automatische Abrufe schon vor dem gespeicherten Ausschaltwert bis zur bewussten neuen Freigabe', async () => {
    const { rpc } = client()
    const { automaticSyncEnableConfirmation, cancelSyncRequests, syncNow } = await import('./supabase')
    cancelSyncRequests()
    await syncNow()
    expect(rpc).not.toHaveBeenCalled()
    await syncNow({ manual: true })
    expect(rpc).toHaveBeenCalledOnce()
    await context.repo!.put('inbox', 'later', { id: 'later', text: 'Späterer lokaler Entwurf', status: 'open', createdAt: 2 })
    await syncNow()
    expect(rpc).toHaveBeenCalledOnce()
    automaticSyncEnableConfirmation()()
    await syncNow()
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it.each(['auth', 'dirty'] as const)('prüft den Widerruf nach wartendem %s erneut vor dem Upload', async (stage) => {
    let entered!: () => void; let release!: () => void
    const waiting = new Promise<void>((resolve) => { entered = resolve })
    const hold = new Promise<void>((resolve) => { release = resolve })
    const { rpc } = client(stage === 'auth' ? async () => { entered(); await hold; return { data: { session: { user: { id: 'test-user' } } } } } : undefined)
    if (stage === 'dirty') {
      const original = context.repo!.dirty.bind(context.repo!)
      vi.spyOn(context.repo!, 'dirty').mockImplementationOnce(async () => { entered(); await hold; return original() })
    }
    const { syncNow } = await import('./supabase')
    const sync = syncNow(); await waiting
    context.enabled = false; release(); await sync
    expect(rpc).not.toHaveBeenCalled()
    expect((await context.repo!.dirty()).some((record) => record.id === 'private')).toBe(true)
  })
  it('überträgt weder QR-Geheimnis und Medoptionen noch explizite Geschäftsaufnahmen oder Tombstone-Inhalte', async () => {
    const settings = defaultSettings('2026-11-06')
    settings.alarm = { ...settings.alarm, qrSecret: 'LOKALES-QR-GEHEIMNIS', medicationEnabled: true, medicationReminderAt: 1234 }
    await context.repo!.put('settings', 'main', settings)
    await context.repo!.put('inbox', 'business', { id: 'business', text: 'Geschäftsaufnahme-GEHEIM', status: 'open', createdAt: 1, captureContext: 'Arbeit' })
    await context.repo!.put('inbox', 'linked', { id: 'linked', text: 'Arbeitsverknüpfung-GEHEIM', status: 'kept', createdAt: 1, linkedTo: { kind: 'work', id: 'work' } })
    await context.repo!.put('inbox', 'deleted', { id: 'deleted', text: 'Gelöschter-GEHEIMTEXT', status: 'open', createdAt: 1 })
    await context.repo!.remove('inbox', 'deleted')
    const { rpc } = client()
    const { syncNow } = await import('./supabase')
    await syncNow()
    const text = JSON.stringify(rpc.mock.calls)
    for (const value of ['LOKALES-QR-GEHEIMNIS', 'medicationEnabled', 'medicationReminderAt', 'Geschäftsaufnahme-GEHEIM', 'Arbeitsverknüpfung-GEHEIM', 'Gelöschter-GEHEIMTEXT']) expect(text).not.toContain(value)
    expect(text).toContain('Bewusst synchronisierbare private Notiz')
    expect((await context.repo!.get<typeof settings>('settings', 'main'))?.alarm.qrSecret).toBe(settings.alarm.qrSecret)
  })
  it('speichert und zeigt keine private Rohfehlermeldung des Servers', async () => {
    const { rpc } = client()
    rpc.mockResolvedValueOnce({ error: new Error('Kundenadresse-und-Servergeheimnis') })
    const { syncNow } = await import('./supabase')
    const result = await syncNow()
    expect(result.error).toBeDefined()
    expect(JSON.stringify(result)).not.toContain('Kundenadresse-und-Servergeheimnis')
    expect(JSON.stringify(await context.repo!.get('meta', 'sync'))).not.toContain('Kundenadresse-und-Servergeheimnis')
  })
})
