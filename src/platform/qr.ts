import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { isNative, safe } from './native'

export type ScanOutcome = { ok: true; value: string } | { ok: false; reason: 'unavailable' | 'cancelled' | 'denied' }

/** Scannt einen QR-Code mit dem Google-Code-Scanner (kein Kamera-Recht nötig). */
export async function scanQr(): Promise<ScanOutcome> {
  if (!isNative()) return { ok: false, reason: 'unavailable' }
  try {
    const avail = await safe(async () => (await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available, false)
    if (!avail) {
      await safe(() => BarcodeScanner.installGoogleBarcodeScannerModule(), undefined)
      return { ok: false, reason: 'unavailable' }
    }
    const r = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })
    const value = r.barcodes[0]?.rawValue
    return value ? { ok: true, value } : { ok: false, reason: 'cancelled' }
  } catch (e) {
    const msg = String(e)
    return { ok: false, reason: /cancel/i.test(msg) ? 'cancelled' : /permission/i.test(msg) ? 'denied' : 'unavailable' }
  }
}

export async function scannerReady(): Promise<boolean> {
  if (!isNative()) return false
  return safe(async () => (await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available, false)
}

export async function installScanner(): Promise<void> {
  if (isNative()) await safe(() => BarcodeScanner.installGoogleBarcodeScannerModule(), undefined)
}
