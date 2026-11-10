/** Cache-only PGlite dependency, real PostgreSQL migration/RLS execution, no service. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

if (process.argv.length !== 4 || process.argv[2] !== '--module') throw new Error('Usage: node scripts/test-pc-relay-sql.mjs --module /cache/node_modules/@electric-sql/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(process.argv[3]).href)
const db = new PGlite()
const sql = await readFile(new URL('../supabase/migrations/20261110000001_pc_link_relay.sql', import.meta.url), 'utf8')
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const PAIR = 'synthetic-pair', PC = '1'.repeat(64), PHONE = '2'.repeat(64), OTHER_PC = '3'.repeat(64), OTHER_PHONE = '4'.repeat(64)
let passed = 0
const check = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]
const rpc = async (name, args, casts) => (await one(`select public.${name}(${args.map((_, i) => `$${i + 1}::${casts[i]}`).join(',')}) as value`, args)).value
const provision = (owner, pc = PC, phone = PHONE) => rpc('pc_link_relay_provision', [owner, PAIR, pc, phone], ['uuid', 'text', 'text', 'text'])
const put = (owner, hash, envelope, expires) => rpc('pc_link_relay_put', [owner, PAIR, hash, envelope.from, envelope.seq, envelope, expires], ['uuid', 'text', 'text', 'text', 'bigint', 'jsonb', 'timestamptz'])
const get = (owner, hash, after = 0) => rpc('pc_link_relay_get', [owner, PAIR, hash, after], ['uuid', 'text', 'text', 'bigint'])
const lookup = hash => rpc('pc_link_relay_lookup', [hash], ['text'])
const role = async (name, owner, fn) => {
  await db.exec(`set role ${name}`)
  try { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner ?? '']); return await fn() }
  finally { await db.exec('reset role') }
}
const denied = async fn => { await assert.rejects(fn, error => error.code === '42501') }

try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`)
  await check('migration compiles in real PostgreSQL', () => db.exec(sql))
  await db.query('insert into auth.users(id) values($1),($2)', [A, B])
  const now = (await one('select clock_timestamp() as now')).now.getTime()
  const frame = (direction = 'phone', seq = 1) => ({ v: 3, kind: 'anker-link', pair: PAIR, from: direction, seq,
    sentAt: new Date(now).toISOString(), nonce: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAA' })
  const expiry = new Date(now + 3600_000).toISOString()
  await check('only service_role can provision scoped hashed capabilities', async () => {
    await role('anon', null, () => denied(() => provision(A)))
    await role('authenticated', A, () => denied(() => provision(A)))
    assert.equal((await role('service_role', null, () => provision(A))).ok, true)
    assert.equal((await role('service_role', null, () => provision(B, OTHER_PC, OTHER_PHONE))).ok, true)
  })
  await check('token lookup returns exact owner/pair and fixed role', async () => {
    assert.deepEqual(await role('service_role', null, () => lookup(PC)), { owner: A, pair: PAIR, role: 'pc' })
    assert.deepEqual(await role('service_role', null, () => lookup(PHONE)), { owner: A, pair: PAIR, role: 'phone' })
    await role('authenticated', A, () => denied(() => lookup(PC)))
  })
  await check('token directions are independently enforced inside SQL RPC', async () => {
    assert.equal((await role('service_role', null, () => put(A, PC, frame(), expiry))).error, 'unauthorized')
    assert.equal((await role('service_role', null, () => put(A, PHONE, frame('pc'), expiry))).error, 'unauthorized')
    assert.equal((await role('service_role', null, () => put(A, OTHER_PC, frame('pc'), expiry))).error, 'unauthorized')
  })
  await check('owner phone and PC can enqueue only their encrypted directions', async () => {
    assert.deepEqual(await role('service_role', null, () => put(A, null, frame(), expiry)), { ok: true })
    assert.equal((await role('service_role', null, () => put(A, PC, frame('pc'), expiry))).ok, true)
    assert.equal((await role('service_role', null, () => put(B, OTHER_PHONE, frame(), expiry))).ok, true)
  })
  await check('authenticated table reads are owner-isolated and hashes remain inaccessible', async () => {
    const rowsA = await role('authenticated', A, () => db.query('select user_id,pair_id,seq,direction from public.pc_link_mailbox'))
    assert.equal(rowsA.rows.length, 2); assert.ok(rowsA.rows.every(row => row.user_id === A))
    const rowsB = await role('authenticated', B, () => db.query('select user_id from public.pc_link_mailbox'))
    assert.equal(rowsB.rows.length, 1); assert.ok(rowsB.rows.every(row => row.user_id === B))
    await role('authenticated', A, () => denied(() => db.query('select token_hash from public.pc_link_devices')))
    await role('anon', null, () => denied(() => db.query('select * from public.pc_link_mailbox')))
  })
  await check('authenticated and anon cannot bypass Edge validation with direct mailbox mutation', async () => {
    await role('authenticated', A, () => denied(() => db.query('delete from public.pc_link_mailbox where user_id=$1', [A])))
    await role('authenticated', A, () => denied(() => db.query('update public.pc_link_devices set revoked=false')))
    await role('authenticated', A, () => denied(() => get(A, null)))
    await role('anon', null, () => denied(() => get(A, PC)))
  })
  await check('SQL envelope/size/sequence validators reject invalid structured rows', async () => {
    for (const change of [{ v: true }, { seq: true }, { seq: 0 }, { extra: true }, { pair: 'foreign' }, { nonce: 'x' }, { ct: 'a'.repeat(90_000) }]) {
      const e = { ...frame(), ...change }
      assert.equal((await one('select public.pc_link_valid_envelope($1::jsonb,$2,$3,$4::bigint) as valid', [e, PAIR, 'phone', 1])).valid, false)
    }
  })
  await check('SQL refuses expired/future retention beyond fourteen days', async () => {
    for (const at of [now - 1000, now + 15 * 86_400_000]) assert.equal((await role('service_role', null, () => put(A, PHONE, frame('phone', 2), new Date(at).toISOString()))).error, 'expired')
    const future = { ...frame('phone', 2), sentAt: new Date(now + 300_000).toISOString() }
    assert.equal((await role('service_role', null, () => put(A, PHONE, future, expiry))).error, 'expired')
  })
  await check('idempotence never overwrites changed ciphertext or permits a lower sequence', async () => {
    assert.equal((await role('service_role', null, () => put(A, PHONE, frame(), expiry))).ok, true)
    assert.equal((await role('service_role', null, () => put(A, PHONE, { ...frame(), nonce: 'BBBBBBBBBBBBBBBB' }, expiry))).error, 'conflict')
    assert.equal((await role('service_role', null, () => put(A, PHONE, frame('phone', 4), expiry))).ok, true)
    assert.equal((await role('service_role', null, () => put(A, PHONE, frame('phone', 3), expiry))).error, 'replay')
  })
  await check('get returns only the counterpart direction, ascending and after the actual cursor', async () => {
    assert.deepEqual((await role('service_role', null, () => get(A, PC))).envelopes.map(e => e.seq), [1, 4])
    assert.deepEqual((await role('service_role', null, () => get(A, PHONE))).envelopes.map(e => e.from), ['pc'])
    assert.deepEqual((await role('service_role', null, () => get(A, PC, 1))).envelopes.map(e => e.seq), [4])
    assert.equal((await role('service_role', null, () => get(B, PC))).error, 'unauthorized')
  })
  await check('get page bound remains eight even for a larger queued history', async () => {
    for (let seq = 5; seq <= 15; seq++) assert.equal((await role('service_role', null, () => put(A, PHONE, frame('phone', seq), expiry))).ok, true)
    assert.equal((await role('service_role', null, () => get(A, PC))).envelopes.length, 8)
  })
  await check('expired phone capability is refused inside RPC and renewal preserves PC key and counters', async () => {
    await db.query("update public.pc_link_devices set phone_expires_at=clock_timestamp()-interval '1 second' where user_id=$1", [A])
    assert.equal(await role('service_role', null, () => lookup(PHONE)), null)
    assert.equal((await role('service_role', null, () => get(A, PHONE))).error, 'unauthorized')
    const renewed = await role('service_role', null, () => rpc('pc_link_relay_renew_phone', [A, PAIR, '5'.repeat(64)], ['uuid', 'text', 'text']))
    assert.equal(renewed.ok, true)
    assert.equal((await role('service_role', null, () => lookup(PC))).role, 'pc')
    assert.equal((await one('select phone_seq from public.pc_link_devices where user_id=$1', [A])).phone_seq, 15)
  })
  await check('revocation blocks previously issued hashes and deletes only the chosen owners mailbox', async () => {
    assert.equal((await role('service_role', null, () => rpc('pc_link_relay_revoke', [A, PAIR], ['uuid', 'text']))).ok, true)
    assert.equal(await role('service_role', null, () => lookup(PC)), null)
    assert.equal((await role('service_role', null, () => put(A, PC, frame('pc', 2), expiry))).error, 'unauthorized')
    assert.equal((await one('select count(*)::int as count from public.pc_link_mailbox where user_id=$1', [A])).count, 0)
    assert.equal((await one('select count(*)::int as count from public.pc_link_mailbox where user_id=$1', [B])).count, 1)
  })
  await check('rotation retains replay high-water marks rather than accepting old frames again', async () => {
    await role('service_role', null, () => provision(A, '6'.repeat(64), '7'.repeat(64)))
    assert.equal((await role('service_role', null, () => put(A, '7'.repeat(64), frame('phone', 2), expiry))).error, 'replay')
    assert.equal((await role('service_role', null, () => put(A, '7'.repeat(64), frame('phone', 16), expiry))).ok, true)
  })
  await check('real cleanup removes expired rows and active RLS hides them before cleanup', async () => {
    await db.query("insert into public.pc_link_mailbox(user_id,pair_id,direction,seq,envelope,created_at,expires_at) values($1,$2,'phone',99,$3::jsonb,clock_timestamp()-interval '15 days',clock_timestamp()-interval '1 day')", [B, PAIR, frame('phone', 99)])
    const before = await role('authenticated', B, () => db.query('select seq from public.pc_link_mailbox'))
    assert.deepEqual(before.rows.map(row => row.seq), [1])
    assert.equal(await role('service_role', null, () => rpc('pc_link_relay_cleanup', [], [])), 1)
    assert.equal((await one('select count(*)::int as count from public.pc_link_mailbox where seq=99')).count, 0)
  })
  console.log(JSON.stringify({ engine: 'PGlite real PostgreSQL', pglite: '0.5.16', passed, migrationSha256: createHash('sha256').update(sql).digest('hex'), migrationExecuted: true, rlsExecuted: true, liveSupabase: false, pgCronExecuted: false }))
} finally { await db.close() }
