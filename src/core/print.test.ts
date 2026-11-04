import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { printSheets } from './print'

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
})
