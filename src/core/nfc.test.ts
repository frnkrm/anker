import { describe, expect, it } from 'vitest'
import { isNfcTarget, NFC_TARGETS, nfcConfirmation, nfcScanResult, nfcStatusResult } from './nfc'

describe('Neutrale NFC-Brückengrenze', () => {
  it('öffnet nur die drei vorhandenen lesenden Ziele', () => {
    expect(Object.values(NFC_TARGETS).map(value => value.route)).toEqual(['/', '/vorbereitung', '/wiedereinstieg'])
    for (const target of ['now', 'prep', 'recover']) expect(nfcScanResult({ status: 'read', target })).toEqual({ status: 'read', target })
    for (const target of ['constructor', '__proto__', 'alarm', '/fokus-start', null]) expect(isNfcTarget(target)).toBe(false)
  })
  it.each([null, [], {}, { status: 'read' }, { status: 'read', target: 'alarm' }, { status: 'read', target: 'now', uid: 'private' }, { status: 'invalid', raw: 'private' }, { status: 'ready' }])('verwirft unbekannte oder zusätzliche Scanfelder: %j', value => {
    expect(nfcScanResult(value)).toEqual({ status: 'unavailable' })
  })
  it('übernimmt ausschließlich bekannte neutrale Abbruchstatus', () => {
    for (const status of ['cancelled', 'timeout', 'invalid', 'busy', 'unsupported', 'disabled', 'blocked', 'unavailable']) expect(nfcScanResult({ status })).toEqual({ status })
  })
  it('sperrt manipulierte Statusantworten und verlangt eine echte boolesche Bestätigung', () => {
    expect(nfcStatusResult({ status: 'blocked', canOpen: true })).toEqual({ status: 'blocked', canOpen: false })
    expect(nfcStatusResult({ status: 'unsupported', canOpen: true })).toEqual({ status: 'unsupported', canOpen: true })
    for (const value of [{ status: 'ready', canOpen: 1 }, { status: 'ready', canOpen: true, raw: 'secret' }, null]) expect(nfcStatusResult(value).canOpen).toBe(false)
    expect(nfcConfirmation({ allowed: true })).toBe(true)
    for (const value of [null, {}, { allowed: 1 }, { allowed: false }, { allowed: true, raw: 'secret' }]) expect(nfcConfirmation(value)).toBe(false)
  })
})
