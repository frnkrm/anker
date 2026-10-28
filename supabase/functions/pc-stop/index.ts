// Supabase Edge Function "pc-stop" (Deno).
// Liefert dem PC-Skript die heutige PC-Stopp-Zeit. Nur lesend, nur diese eine Information.
// Authentifizierung über einen persönlichen Token im Header "x-anker-token" (nicht über Supabase-JWT),
// deshalb mit `--no-verify-jwt` deployen:
//   supabase functions deploy pc-stop --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Entry {
  date: string
  stopAt: string
  localTime: string
  extended: boolean
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Der passende Eintrag: der früheste, dessen Stopp nicht länger als 6 Stunden zurückliegt. */
export function pickEntry(entries: Entry[], now: number): Entry | undefined {
  return entries
    .filter((e) => Date.parse(e.stopAt) + 6 * 3600_000 > now)
    .sort((a, b) => Date.parse(a.stopAt) - Date.parse(b.stopAt))[0]
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ error: 'method' }, 405)
  const token = req.headers.get('x-anker-token') ?? ''
  if (!/^[a-f0-9]{48}$/.test(token)) return json({ error: 'token' }, 401)

  // Service-Role nur serverseitig; liest ausschließlich pc_stop_tokens und pc_stop.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: t } = await db.from('pc_stop_tokens').select('user_id').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (!t) return json({ error: 'token' }, 401)

  const { data: row } = await db.from('pc_stop').select('entries').eq('user_id', t.user_id).maybeSingle()
  const entry = pickEntry((row?.entries ?? []) as Entry[], Date.now())
  if (!entry) return json({ error: 'keine Zeit hinterlegt' }, 404)

  return json({ date: entry.date, stopAt: entry.stopAt, localTime: entry.localTime, extended: entry.extended })
})
