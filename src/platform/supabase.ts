import { App } from '@capacitor/app'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { APP_ID } from '../../app.config'
import { addDays } from '../core/time'
import { buildPcStopCommands, pcStopPublicationText, type PcStopPublication } from '../core/pcStop'
import { planFor, repository, today, useApp } from '../state/store'
import { isNative, safe } from './native'
import { pullRecords } from './syncPull'
import { localBusinessNote, recordForSync } from '../core/syncPrivacy'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = !!(URL_ && KEY)
let client: SupabaseClient | null = null

export function sb(): SupabaseClient | null {
  if (!supabaseConfigured) return null
  client ??= createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce', detectSessionInUrl: !isNative() } })
  return client
}

export function pcStopEndpoint(): string {
  return supabaseConfigured ? `${URL_!.replace(/\/$/, '')}/functions/v1/pc-stop` : ''
}

export async function currentUser(): Promise<{ id: string; email?: string } | null> {
  const c = sb()
  if (!c) return null
  return safe(async () => (await c.auth.getSession()).data.session?.user ?? null, null)
}

export async function sendMagicLink(email: string): Promise<string | null> {
  const c = sb()
  if (!c) return 'Sync ist nicht konfiguriert.'
  const redirect = isNative() ? `${APP_ID}://login` : `${(import.meta.env.VITE_PUBLIC_URL as string) || location.origin}/verbindungen`
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
  return error ? error.message : null
}

export async function signOut() {
  cancelSyncRequests()
  await safe(async () => void (await sb()?.auth.signOut()), undefined)
}

let syncGeneration = 0
let syncBlocked = false
/** Sofortiger Stopp, auch wenn das Speichern des ausgeschalteten Schalters noch wartet. */
export function cancelSyncRequests(): void { syncGeneration++; syncBlocked = true }

/** Magic-Link-Rückkehr in die Android-App (de.frnkrm.anker://login?code=…). */
export function listenForAuthLinks() {
  if (!isNative() || !supabaseConfigured) return
  void App.addListener('appUrlOpen', async ({ url }) => {
    let code: string | null
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== `${APP_ID}:` || parsed.hostname !== 'login' || (parsed.pathname !== '' && parsed.pathname !== '/')) return
      code = parsed.searchParams.get('code')
    } catch { return }
    if (!code) return
    const signedIn = await safe(async () => {
      const result = await sb()!.auth.exchangeCodeForSession(code)
      return !result.error
    }, false)
    if (!signedIn) { useApp.getState().showToast('Die Anmeldung hat nicht geklappt. Deine lokalen Daten bleiben erhalten.'); return }
    const syncEnabled = useApp.getState().settings.integrations.sync
    useApp.getState().showToast(syncEnabled ? 'Angemeldet. Sync läuft.' : 'Angemeldet. Automatischer Sync bleibt ausgeschaltet.')
    if (syncEnabled) await syncNow()
  })
}

interface SyncMeta {
  cursor?: string
  lastSync?: number
  error?: string
}
const SYNC_ERROR = 'Die Verbindung konnte nicht abgeschlossen werden. Deine lokalen Daten bleiben erhalten.'
const syncMeta = (value: SyncMeta): SyncMeta => ({ ...value, ...(value.error ? { error: SYNC_ERROR } : {}) })

/** Lädt geänderte Datensätze hoch und holt neue vom Server (last-write-wins pro Datensatz). */
export async function syncNow(options: { manual?: boolean } = {}): Promise<SyncMeta> {
  if (options.manual) syncBlocked = false
  const generation = syncGeneration
  const accepted = () => !syncBlocked && generation === syncGeneration && (options.manual === true || useApp.getState().settings.integrations.sync === true)
  const stopped = (meta: SyncMeta): SyncMeta => options.manual ? { ...meta, error: 'Sync wurde beendet. Deine lokalen Daten bleiben erhalten.' } : meta
  if (!accepted()) return {}
  const c = sb()
  const repo = repository()
  if (!c || !repo) return options.manual ? { error: SYNC_ERROR } : {}
  const user = await currentUser()
  if (!user || !accepted()) return options.manual ? { error: SYNC_ERROR } : {}
  const meta = syncMeta((await repo.get<SyncMeta>('meta', 'sync')) ?? {})
  try {
    if (!accepted()) return stopped(meta)
    // Push: lokale Änderungen (ohne gerätespezifische Meta-Daten)
    const dirty = await repo.dirty()
    if (!accepted()) return stopped(meta)
    const projected = dirty.flatMap((record) => { const next = recordForSync(record); return next ? [next] : [] })
    if (projected.length) {
      const { error } = await c.rpc('upsert_records', {
        recs: projected.map((r) => ({ collection: r.collection, id: r.id, data: r.data, updated_at: r.updated_at, deleted: r.deleted })),
      })
      if (error) throw error
      if (!accepted()) return stopped(meta)
      await repo.markClean(projected)
    }
    if (!accepted()) return stopped(meta)
    // Pull: alle Seiten, auch bei mehr als 1000 Datensätzen mit demselben Zeitstempel.
    const pulled = await pullRecords(c, { merge: (records) => {
      if (!accepted()) return Promise.resolve(0)
      const privateIds = new Set(useApp.getState().inbox.filter((note) => localBusinessNote(note)).map((note) => note.id))
      const incoming = records.flatMap((record) => {
        if (record.collection === 'inbox' && privateIds.has(record.id)) return []
        const next = recordForSync(record); return next ? [next] : []
      })
      return useApp.getState().mergeRecords(incoming, false, accepted)
    } }, meta.cursor, accepted)
    if (!accepted()) return stopped(meta)
    const next: SyncMeta = { cursor: pulled.cursor, lastSync: Date.now() }
    await repo.put('meta', 'sync', next)
    if (pulled.changed) await useApp.getState().load()
    await pushPcStop()
    return next
  } catch {
    if (!accepted()) return stopped(meta)
    const next = { ...meta, error: SYNC_ERROR }
    await safe(() => repo.put('meta', 'sync', next), undefined)
    return next
  }
}

let pcPublication: Promise<void> = Promise.resolve()

/** Veröffentlichungen sind serialisiert. Kein Rückgabewert behauptet einen Empfang am PC. */
export function pushPcStop(options: { manual?: boolean } = {}): Promise<PcStopPublication> {
  const task = pcPublication.then(async (): Promise<PcStopPublication> => {
    const result = (status: PcStopPublication['status']): PcStopPublication => ({ status, message: pcStopPublicationText(status) })
    if (!options.manual && useApp.getState().settings?.integrations.sync === false) return result('disabled')
    const c = sb()
    if (!c) return result('unconfigured')
    try {
      const user = await currentUser()
      if (!user) return result('signed-out')
      for (;;) {
        const desired = () => {
          const st = useApp.getState()
          return buildPcStopCommands([today(), addDays(today(), 1)].map((date) => ({ ...planFor(date), date })))
            .map((command) => ({ ...command, ...(command.mode === 'scheduled' ? { extended: typeof st.days[command.date]?.override.lateUntil === 'number' || (st.days[command.date]?.override.pcStopExtendMin ?? 0) > 0 } : {}) }))
        }
        if (!options.manual && useApp.getState().settings?.integrations.sync === false) return result('disabled')
        const entries = desired()
        const { error } = await c.from('pc_stop').upsert({ user_id: user.id, entries, updated_at: new Date().toISOString() })
        if (error) return result('error')
        if (!options.manual && useApp.getState().settings?.integrations.sync === false) return result('disabled')
        if (JSON.stringify(entries) !== JSON.stringify(desired())) continue
        return result('published')
      }
    } catch {
      return result('error')
    }
  })
  pcPublication = task.then(() => undefined, () => undefined)
  return task
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Erzeugt einen persönlichen PC-Stopp-Token. Gespeichert wird nur der Hash. */
export async function createPcStopToken(): Promise<string | null> {
  const c = sb()
  const user = await currentUser()
  if (!c || !user) return null
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const { error } = await c.from('pc_stop_tokens').insert({ user_id: user.id, token_hash: await sha256Hex(token) })
  if (error) return null
  await pushPcStop({ manual: true })
  return token
}

export async function syncStatus(): Promise<SyncMeta> {
  return syncMeta((await repository()?.get<SyncMeta>('meta', 'sync')) ?? {})
}
