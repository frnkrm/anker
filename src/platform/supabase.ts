import { App } from '@capacitor/app'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { APP_ID } from '../../app.config'
import { addDays, fmtTime, zonedToUtc } from '../core/time'
import { planFor, repository, today, useApp } from '../state/store'
import { isNative, safe } from './native'
import { pullRecords } from './syncPull'

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
  await safe(async () => void (await sb()?.auth.signOut()), undefined)
}

/** Magic-Link-Rückkehr in die Android-App (de.frnkrm.anker://login?code=…). */
export function listenForAuthLinks() {
  if (!isNative() || !supabaseConfigured) return
  void App.addListener('appUrlOpen', async ({ url }) => {
    const code = new URL(url).searchParams.get('code')
    if (code) {
      await safe(async () => void (await sb()!.auth.exchangeCodeForSession(code)), undefined)
      useApp.getState().showToast('Angemeldet. Sync läuft.')
      await syncNow()
    }
  })
}

interface SyncMeta {
  cursor?: string
  lastSync?: number
  error?: string
}

/** Lädt geänderte Datensätze hoch und holt neue vom Server (last-write-wins pro Datensatz). */
export async function syncNow(): Promise<SyncMeta> {
  const c = sb()
  const repo = repository()
  if (!c || !repo) return {}
  const user = await currentUser()
  if (!user) return {}
  const meta = (await repo.get<SyncMeta>('meta', 'sync')) ?? {}
  try {
    // Push: lokale Änderungen (ohne gerätespezifische Meta-Daten)
    const dirty = (await repo.dirty()).filter((r) => r.collection !== 'meta')
    if (dirty.length) {
      const { error } = await c.rpc('upsert_records', {
        recs: dirty.map((r) => ({ collection: r.collection, id: r.id, data: r.data, updated_at: r.updated_at, deleted: r.deleted })),
      })
      if (error) throw error
      await repo.markClean(dirty)
    }
    // Pull: alle Seiten, auch bei mehr als 1000 Datensätzen mit demselben Zeitstempel.
    const pulled = await pullRecords(c, { merge: (records) => useApp.getState().mergeRecords(records) }, meta.cursor)
    const next: SyncMeta = { cursor: pulled.cursor, lastSync: Date.now() }
    await repo.put('meta', 'sync', next)
    if (pulled.changed) await useApp.getState().load()
    await pushPcStop()
    return next
  } catch (e) {
    const next = { ...meta, error: String((e as Error).message ?? e) }
    await safe(() => repo.put('meta', 'sync', next), undefined)
    return next
  }
}

/** Schreibt die PC-Stopp-Zeiten für heute und morgen (nur diese Daten liest die Edge Function). */
export async function pushPcStop() {
  const c = sb()
  const user = await currentUser()
  if (!c || !user) return
  const entries = [today(), addDays(today(), 1)].map((d) => {
    const p = planFor(d)
    return { date: d, stopAt: new Date(zonedToUtc(d, p.pcStop)).toISOString(), localTime: fmtTime(p.pcStop), extended: (useApp.getState().days[d]?.override.pcStopExtendMin ?? 0) > 0 }
  })
  await safe(async () => {
    const { error } = await c.from('pc_stop').upsert({ user_id: user.id, entries, updated_at: new Date().toISOString() })
    if (error) throw error
  }, undefined)
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
  await pushPcStop()
  return token
}

export async function syncStatus(): Promise<SyncMeta> {
  return (await repository()?.get<SyncMeta>('meta', 'sync')) ?? {}
}
