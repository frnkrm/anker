import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({
  native: true, configured: true,
  status: vi.fn(), setup: vi.fn(), renew: vi.fn(), revoke: vi.fn(), disable: vi.fn(), clear: vi.fn(), session: vi.fn(),
}))
vi.mock('./native', () => ({ isNative: () => fake.native, AnkerNative: {
  pcRelayStatus: fake.status, pcRelaySetup: fake.setup, pcRelayRenew: fake.renew,
  pcRelayRevoke: fake.revoke, pcRelayDisable: fake.disable, pcRelayClear: fake.clear,
} }))
vi.mock('./supabase', () => ({ sb: () => fake.configured ? { auth: { getSession: fake.session } } : null }))
import { clearPcRelay, disablePcRelay, pcRelayProject, readPcRelayStatus, refreshPcRelayAuthorizationIfNeeded, renewPcRelay, revokePcRelay, setupPcRelay } from './pcRelay'
const OFF = { enabled: false, paired: true, status: 'off' }
const ON = { enabled: true, paired: true, status: 'waiting', phoneExpiresAt: Date.now() + 14 * 86_400_000 }
const PRIVATE = 'anker-pc-relay:v1:' + 'A'.repeat(100)

beforeEach(() => {
  vi.clearAllMocks(); fake.native = true; fake.configured = true
  vi.stubEnv('VITE_SUPABASE_URL', `https://${'a'.repeat(20)}.supabase.co`)
  fake.status.mockResolvedValue(OFF)
  fake.setup.mockResolvedValue({ state: ON, desktopSetup: PRIVATE })
  fake.renew.mockResolvedValue({ state: ON })
  fake.revoke.mockResolvedValue({ state: OFF, cloudRevoked: true })
  fake.disable.mockResolvedValue({ state: OFF }); fake.clear.mockResolvedValue({ state: OFF })
  fake.session.mockResolvedValue({ data: { session: { access_token: 'synthetic-owner-access-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('Native Relay-Einrichtung außerhalb von Store/Sync/Backup', () => {
  it('führt im Web weder Anmeldung noch native Einrichtung aus', async () => {
    fake.native = false
    expect(await readPcRelayStatus()).toEqual({ enabled: false, paired: false, status: 'off' })
    await expect(setupPcRelay()).rejects.toThrow('PC_RELAY_ANDROID_REQUIRED')
    expect(fake.status).not.toHaveBeenCalled(); expect(fake.session).not.toHaveBeenCalled()
  })
  it('fragt ohne konfigurierten Dienst auch beim Vordergrundabgleich keinen nativen Status oder Zugang ab', async () => {
    fake.configured = false
    await refreshPcRelayAuthorizationIfNeeded()
    expect(fake.status).not.toHaveBeenCalled()
    expect(fake.session).not.toHaveBeenCalled()
    expect(fake.renew).not.toHaveBeenCalled()
  })
  it('akzeptiert ausschließlich die feste eigene Supabase-Projektkennung', () => {
    expect(pcRelayProject(`https://${'a'.repeat(20)}.supabase.co/`)).toBe('a'.repeat(20))
    for (const url of ['https://attacker.invalid', 'http://' + 'a'.repeat(20) + '.supabase.co', 'https://user:pass@' + 'a'.repeat(20) + '.supabase.co', 'https://' + 'a'.repeat(20) + '.supabase.co/functions/evil', 'https://' + 'a'.repeat(20) + '.supabase.co?redirect=evil', 'https://' + 'a'.repeat(20) + '.supabase.co:444', null]) expect(pcRelayProject(url)).toBeNull()
  })
  it('überträgt den aktuellen SDK-Token nur an den bewussten nativen Setupaufruf', async () => {
    const result = await setupPcRelay()
    expect(fake.setup).toHaveBeenCalledExactlyOnceWith({ project: 'a'.repeat(20), accessToken: 'synthetic-owner-access-token' })
    expect(result).toEqual({ state: ON, desktopSetup: PRIVATE })
    expect(fake.session).toHaveBeenCalledTimes(1)
  })
  it('weist fehlendes Projekt oder eine fehlende/abgelaufene SDK-Sitzung vor dem nativen Setup zurück', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    await expect(setupPcRelay()).rejects.toThrow('PC_RELAY_NOT_CONFIGURED')
    vi.stubEnv('VITE_SUPABASE_URL', `https://${'a'.repeat(20)}.supabase.co`)
    fake.configured = false
    await expect(setupPcRelay()).rejects.toThrow('PC_RELAY_NOT_CONFIGURED')
    fake.configured = true
    for (const session of [null, { access_token: 'synthetic-owner-access-token', expires_at: 1 }, { access_token: 'wrong\ntoken', expires_at: 9999999999 }]) {
      fake.session.mockResolvedValue({ data: { session }, error: null })
      await expect(setupPcRelay()).rejects.toThrow('PC_RELAY_AUTH_REQUIRED')
    }
    expect(fake.setup).not.toHaveBeenCalled()
  })
  it('erneuert nur die Handyberechtigung und gibt keine privaten Nativefelder als Status weiter', async () => {
    expect(await renewPcRelay()).toEqual(ON)
    expect(fake.renew).toHaveBeenCalledExactlyOnceWith({ accessToken: 'synthetic-owner-access-token' })
    fake.status.mockResolvedValue({ ...ON, phoneToken: 'synthetic-private-token' })
    await expect(readPcRelayStatus()).rejects.toThrow('PC_RELAY_RESPONSE_INVALID')
  })
  it('trennt bestätigten Dienstwiderruf von lokalem Stoppen und braucht für lokale Aktionen keine Cloudsession', async () => {
    fake.revoke.mockResolvedValue({ state: OFF, cloudRevoked: false })
    expect((await revokePcRelay()).cloudRevoked).toBe(false)
    fake.session.mockClear(); fake.configured = false
    expect(await disablePcRelay()).toEqual(OFF)
    expect(await clearPcRelay()).toEqual(OFF)
    expect(fake.session).not.toHaveBeenCalled()
  })
  it('erneuert im Vordergrund nur eine bereits freiwillig eingerichtete bald ablaufende Handyberechtigung', async () => {
    await refreshPcRelayAuthorizationIfNeeded(); expect(fake.renew).not.toHaveBeenCalled()
    fake.status.mockResolvedValue(ON)
    await refreshPcRelayAuthorizationIfNeeded(); expect(fake.renew).not.toHaveBeenCalled()
    fake.status.mockResolvedValue({ ...ON, phoneExpiresAt: Date.now() - 1 })
    await refreshPcRelayAuthorizationIfNeeded(); expect(fake.renew).toHaveBeenCalledTimes(1)
  })
  it('verwirft unbekannte Statuswerte sowie Bool-/Text-Zeitpunkte und ungültige private Übergabecodes', async () => {
    for (const value of [{ ...OFF, status: 'plan-completed' }, { ...ON, phoneExpiresAt: true }, { ...ON, lastExchangeAt: 'yesterday' }]) {
      fake.status.mockResolvedValue(value)
      await expect(readPcRelayStatus()).rejects.toThrow('PC_RELAY_RESPONSE_INVALID')
    }
    fake.setup.mockResolvedValue({ state: ON, desktopSetup: 'https://attacker.invalid/private' })
    await expect(setupPcRelay()).rejects.toThrow('PC_RELAY_RESPONSE_INVALID')
  })
})
