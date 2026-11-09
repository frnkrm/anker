// Synthetic loopback integration only: never instantiates a Windows adapter.
import assert from 'node:assert/strict'
import { createCipheriv, createDecipheriv, createECDH, createHash, createHmac, generateKeyPairSync, hkdfSync, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { request } from 'node:https'
import { createInterface } from 'node:readline'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const python = process.env.ANKER_PC_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
const child = spawn(python, ['-u', join(directory, 'interop_server.py')], { cwd: resolve(directory, '..'), stdio: ['pipe', 'pipe', 'pipe'], env: process.env })
const lines = createInterface({ input: child.stdout })
const queued = [], waiters = []
let stderr = '', sendSeq = 0, receiveSeq = 0
child.stderr.on('data', data => { stderr += data.toString() })
lines.on('line', line => { const waiter = waiters.shift(); if (waiter) waiter.resolve(JSON.parse(line)); else queued.push(JSON.parse(line)) })
child.on('error', error => { for (const waiter of waiters.splice(0)) waiter.reject(error) })
child.on('exit', code => { if (code) for (const waiter of waiters.splice(0)) waiter.reject(new Error('Synthetic server failed')) })
function nextLine() {
  if (queued.length) return Promise.resolve(queued.shift())
  return new Promise((resolvePromise, reject) => {
    const waiter = { resolve: value => { clearTimeout(timer); resolvePromise(value) }, reject }
    const timer = setTimeout(() => { const at = waiters.indexOf(waiter); if (at >= 0) waiters.splice(at, 1); reject(new Error('Synthetic server response timed out')) }, 15000)
    waiters.push(waiter)
  })
}
async function ipc(command) { child.stdin.write(JSON.stringify(command) + '\n'); return nextLine() }
const bytes = value => Buffer.from(value, 'base64url')
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))
function aad(value) { return Buffer.from(canonical(Object.fromEntries(['v', 'kind', 'pair', 'from', 'seq', 'sentAt'].map(key => [key, value[key]])))) }
let config, incoming, outgoing
function seal(payload) {
  const envelope = { v: 3, kind: 'anker-link', pair: config.qr.id, from: 'phone', seq: ++sendSeq, sentAt: new Date(config.now * 1000).toISOString() }
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', incoming, nonce)
  cipher.setAAD(aad(envelope))
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final(), cipher.getAuthTag()])
  return { ...envelope, nonce: nonce.toString('base64url'), ct: ct.toString('base64url') }
}
function open(envelope) {
  assert.equal(envelope.pair, config.qr.id); assert.equal(envelope.from, 'pc'); assert.ok(envelope.seq > receiveSeq)
  const cipher = bytes(envelope.ct), decipher = createDecipheriv('aes-256-gcm', outgoing, bytes(envelope.nonce))
  decipher.setAAD(aad(envelope)); decipher.setAuthTag(cipher.subarray(-16))
  const plaintext = Buffer.concat([decipher.update(cipher.subarray(0, -16)), decipher.final()])
  receiveSeq = envelope.seq
  return JSON.parse(plaintext.toString('utf8'))
}
function https(path, payload, badPin = false) {
  return new Promise((resolvePromise, reject) => {
    const encoded = payload === undefined ? undefined : Buffer.from(JSON.stringify(payload))
    const req = request({ hostname: '127.0.0.1', port: config.port, path, method: encoded ? 'POST' : 'GET',
      ca: config.certificate, minVersion: 'TLSv1.2',
      checkServerIdentity(_host, cert) { return createHash('sha256').update(cert.raw).digest('hex') === (badPin ? '0'.repeat(64) : config.pin) ? undefined : new Error('Certificate pin mismatch') },
      headers: encoded ? { 'content-type': 'application/json', 'content-length': encoded.length } : {},
    }, response => {
      const chunks = []; let size = 0
      response.on('data', chunk => { size += chunk.length; if (size > 65536) response.destroy(new Error('Oversized reply')); else chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => { try { resolvePromise({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }) } catch { reject(new Error('Malformed synthetic reply')) } })
    })
    req.setTimeout(5000, () => req.destroy(new Error('HTTPS timeout')))
    req.on('error', reject)
    if (encoded) req.write(encoded)
    req.end()
  })
}
try {
  config = await nextLine()
  const phone = createECDH('prime256v1'); phone.generateKeys()
  const publicPhone = phone.getPublicKey().toString('base64url')
  const signing = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' })
  const signingKey = Buffer.concat([Buffer.from([4]), bytes(signing.x), bytes(signing.y)]).toString('base64url')
  const secret = bytes(config.qr.s), shared = phone.computeSecret(bytes(config.qr.k))
  incoming = Buffer.from(hkdfSync('sha256', shared, secret, 'anker-link v3 phone->pc', 32))
  outgoing = Buffer.from(hkdfSync('sha256', shared, secret, 'anker-link v3 pc->phone', 32))
  const proof = createHmac('sha256', secret).update(`pair|${config.qr.id}|${publicPhone}|${signingKey}`).digest('base64url')
  const paired = await https('/v3/pair', { id: config.qr.id, n: 'Node synthetic phone', k: publicPhone, signingKey, proof })
  assert.equal(paired.status, 200); assert.equal(paired.body.status, 'pending')
  const code = createHash('sha256').update(Buffer.concat([bytes(config.qr.k), bytes(publicPhone)])).digest().readUInt32BE(0) % 10000
  assert.equal(paired.body.code, String(code).padStart(4, '0'))
  await ipc({ action: 'approve', id: config.qr.id })
  assert.equal((await https('/v3/pair/' + config.qr.id)).body.status, 'paired')
  const state = await https('/v3/link', seal(config.state))
  assert.equal(state.status, 200); assert.equal(open(state.body).revision, config.state.revision)
  await ipc({ action: 'savepoint' })
  const envelope = seal({ type: 'pull', after: 0 }), events = await https('/v3/link', envelope)
  assert.equal(events.status, 200)
  const payload = open(events.body)
  assert.equal(payload.type, 'events'); assert.equal(payload.items[0].kind, 'save-point'); assert.equal(payload.items[0].text, 'Fixture save point')
  assert.equal((await https('/v3/link', envelope)).status, 400)
  const tamper = seal({ type: 'pull', after: 0 }); tamper.ct = 'AA'
  assert.equal((await https('/v3/link', tamper)).status, 400)
  await assert.rejects(() => https('/health', undefined, true))
  const stopped = await ipc({ action: 'stop' })
  assert.deepEqual(stopped.effects, [])
  console.log(JSON.stringify({ passed: true, transport: 'Node HTTPS ↔ Python pinned TLS', physicalConfirmation: true, ack: true, outbox: true, replayRejected: true, tamperRejected: true, wrongPinRejected: true, systemEffects: 0 }))
} catch (error) {
  console.error(JSON.stringify({ passed: false, error: error.name, detail: error.message, childFailed: Boolean(stderr) }))
  process.exitCode = 1
} finally {
  lines.close(); child.stdin.end()
  if (child.exitCode === null) child.kill()
}
