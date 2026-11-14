import { beforeEach, describe, expect, it, vi } from 'vitest'
const bridge = vi.hoisted(() => ({ native: false, getNfcStatus: vi.fn(), scanNfcAnchor: vi.fn(), cancelNfcScan: vi.fn(), confirmNfcAnchor: vi.fn() }))
vi.mock('./native', () => ({ isNative: () => bridge.native, AnkerNative: bridge }))
import { cancelNfcAnchor, confirmNfcAnchor, nfcStatus, readNfcAnchor } from './nfc'

beforeEach(() => { vi.resetAllMocks(); bridge.native = false })
describe('NFC-Plattformgrenze', () => {
  it('behält manuelle Webwege ohne native Scans', async () => {
    expect(await nfcStatus()).toEqual({ status: 'unsupported', canOpen: true })
    expect(await readNfcAnchor('session')).toEqual({ status: 'unsupported' })
    expect(await confirmNfcAnchor('session', 'now')).toBe(false)
    await cancelNfcAnchor('session')
    expect(bridge.scanNfcAnchor).not.toHaveBeenCalled()
    expect(bridge.cancelNfcScan).not.toHaveBeenCalled()
  })
  it('übergibt ausschließlich Sitzungskennung und festes Ziel', async () => {
    bridge.native = true
    bridge.getNfcStatus.mockResolvedValue({ status: 'ready', canOpen: true })
    bridge.scanNfcAnchor.mockResolvedValue({ status: 'read', target: 'prep' })
    bridge.confirmNfcAnchor.mockResolvedValue({ allowed: true })
    expect((await nfcStatus()).status).toBe('ready')
    expect(await readNfcAnchor('one')).toEqual({ status: 'read', target: 'prep' })
    expect(await confirmNfcAnchor('one', 'prep')).toBe(true)
    await cancelNfcAnchor('one')
    expect(bridge.scanNfcAnchor).toHaveBeenCalledWith({ sessionId: 'one' })
    expect(bridge.confirmNfcAnchor).toHaveBeenCalledWith({ sessionId: 'one', target: 'prep' })
    expect(bridge.cancelNfcScan).toHaveBeenCalledWith({ sessionId: 'one' })
  })
  it('gibt Rohantworten und native Fehler nicht an UI oder Logs weiter', async () => {
    bridge.native = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    bridge.scanNfcAnchor.mockResolvedValue({ status: 'read', target: 'now', uid: 'secret' })
    expect(await readNfcAnchor('one')).toEqual({ status: 'unavailable' })
    for (const method of [bridge.getNfcStatus, bridge.scanNfcAnchor, bridge.cancelNfcScan, bridge.confirmNfcAnchor]) method.mockRejectedValue(new Error('private tag data'))
    expect(await nfcStatus()).toEqual({ status: 'unavailable', canOpen: false })
    expect(await readNfcAnchor('one')).toEqual({ status: 'unavailable' })
    expect(await confirmNfcAnchor('one', 'now')).toBe(false)
    await expect(cancelNfcAnchor('one')).resolves.toBeUndefined()
    expect(log).not.toHaveBeenCalled(); log.mockRestore()
  })
})
