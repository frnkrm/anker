// Supabase Edge Function "pc-stop" (Deno).
// Liefert dem PC-Skript die heutige PC-Stopp-Zeit. Nur lesend, nur diese eine Information.
// Authentifizierung über einen persönlichen Token im Header "x-anker-token" (nicht über Supabase-JWT),
// deshalb mit `--no-verify-jwt` deployen:
//   supabase functions deploy pc-stop --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { pickPcStopCommand } from '../_shared/pcStopProtocol.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Kompatibler Export, dieselbe datumsgebundene Protokollprüfung wie in der App. */
export const pickEntry = pickPcStopCommand

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ error: 'method' }, 405)
  const token = req.headers.get('x-anker-token') ?? ''
  if (!/^[a-f0-9]{48}$/.test(token)) return json({ error: 'token' }, 401)

  // Service-Role nur serverseitig; liest ausschließlich pc_stop_tokens und pc_stop.
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'nicht eingerichtet' }, 503)
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data: t } = await db.from('pc_stop_tokens').select('user_id').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (!t) return json({ error: 'token' }, 401)

  const { data: row } = await db.from('pc_stop').select('entries').eq('user_id', t.user_id).maybeSingle()
  const entry = pickEntry(Array.isArray(row?.entries) ? row.entries : [], Date.now())
  if (!entry) return json({ error: 'keine Zeit hinterlegt' }, 404)

  return json(entry)
})
