import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { preparePrintSheets, printSheets } from './print'
import QRCode from 'qrcode'

const s = defaultSettings('2026-11-01')

describe('Druckauswahl', () => {
  it('jeder Drucktyp enthält genau das Gewählte', () => {
    expect(printSheets('morning', s).map((x) => x.id)).toEqual(['morning'])
    expect(printSheets('evening', s).map((x) => x.id)).toEqual(['evening'])
    expect(printSheets('both', s).map((x) => x.id)).toEqual(['morning', 'evening'])
    expect(printSheets('qr', s).map((x) => x.id)).toEqual(['qr'])
    expect(printSheets('door', s).map((x) => x.id)).toEqual(['door'])
  })

  it('Routinen zeigen ihre Schritte', () => {
    const m = printSheets('morning', s)[0]!
    expect(m.kind === 'list' && m.items).toEqual(s.routines.morning.map((x) => x.title))
  })

  it('Drucken liest den QR-Wert nur', () => {
    const before = s.alarm.qrSecret
    const q = printSheets('qr', s)[0]!
    expect(q.kind === 'qr' && q.value).toBe(before)
    expect(s.alarm.qrSecret).toBe(before)
  })

  it('native Druck- und PDF-Auswahl übernimmt dieselbe QR-Matrix ohne einen neuen Code oder Klartextwert', () => {
    const source = printSheets('qr', s)
    const before = JSON.stringify(source)
    const prepared = preparePrintSheets(source)[0]!
    const expected = QRCode.create(s.alarm.qrSecret, { errorCorrectionLevel: 'M' }).modules
    expect(prepared.kind === 'qr' && prepared.qr).toEqual({ size: expected.size, modules: Array.from(expected.data) })
    expect(JSON.stringify(prepared)).not.toContain(s.alarm.qrSecret)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('lange Listen, gleiche Titel und Unicode bleiben für beide Renderer vollständig erhalten', () => {
    const settings = structuredClone(s)
    settings.routines.morning = Array.from({ length: 120 }, (_, i) => ({ id: `print-${i}`, title: i % 2 ? 'Äpfel, Öl und Grüße – 🧠' : 'Gleicher Schritt', minutes: 1 }))
    const sheets = printSheets('morning', settings)
    const prepared = preparePrintSheets(sheets)
    expect(prepared).toEqual(sheets)
    expect(prepared[0]?.kind === 'list' && prepared[0].items).toHaveLength(120)
    if (prepared[0]?.kind === 'list') prepared[0].items.push('Nur in dieser Kopie')
    expect(sheets[0]?.kind === 'list' && sheets[0].items).toHaveLength(120)
    expect(settings.routines.morning).toHaveLength(120)
  })
})
