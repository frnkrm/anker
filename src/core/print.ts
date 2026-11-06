import { fmtTime } from './time'
import type { Settings } from './types'
import QRCode from 'qrcode'

export type PrintChoice = 'morning' | 'evening' | 'both' | 'qr' | 'door'
export type PaperSize = 'A5' | 'A4'

export const PRINT_CHOICES: { value: PrintChoice; label: string }[] = [
  { value: 'morning', label: 'Morgenroutine' },
  { value: 'evening', label: 'Abendroutine' },
  { value: 'both', label: 'Beide Routinen' },
  { value: 'qr', label: 'QR-Code' },
  { value: 'door', label: 'Haustür-Check' },
]

export type PrintSheet =
  | { kind: 'list'; id: string; title: string; subtitle?: string; items: string[]; footer?: string }
  | { kind: 'qr'; id: string; title: string; subtitle: string; footer: string; value: string }

/** Same selected content for the native renderers; no duplicate planning or QR generation. */
export type PrintDocumentSheet =
  | Extract<PrintSheet, { kind: 'list' }>
  | Omit<Extract<PrintSheet, { kind: 'qr' }>, 'value'> & { qr: { size: number; modules: number[] } }

export function preparePrintSheets(sheets: PrintSheet[]): PrintDocumentSheet[] {
  return sheets.map((sheet) => {
    if (sheet.kind === 'list') return { ...sheet, items: [...sheet.items] }
    const { value, ...rest } = sheet
    const matrix = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules
    return { ...rest, qr: { size: matrix.size, modules: Array.from(matrix.data) } }
  })
}

/** Genau das Gewählte, je Blatt eine Seite. Der QR-Wert wird nur gelesen, nie verändert. */
export function printSheets(choice: PrintChoice, s: Settings): PrintSheet[] {
  const morning: PrintSheet = { kind: 'list', id: 'morning', title: 'Morgenroutine', subtitle: `Ab ${fmtTime(s.anchor.wake)}`, items: s.routines.morning.map((x) => x.title), footer: 'Die kleine Version zählt auch.' }
  const evening: PrintSheet = { kind: 'list', id: 'evening', title: 'Abendroutine', items: s.routines.evening.map((x) => x.title), footer: 'Die kleine Version zählt auch.' }
  switch (choice) {
    case 'morning':
      return [morning]
    case 'evening':
      return [evening]
    case 'both':
      return [morning, evening]
    case 'door':
      return [
        {
          kind: 'list',
          id: 'door',
          title: 'Haustür',
          items: ['Schlüssel', 'Handy', 'Geldbeutel', 'Tasche / Laptop', ...(s.sport.kind === 'gym' ? ['Sporttasche (an Sporttagen)'] : [])],
        },
      ]
    case 'qr':
      return [{ kind: 'qr', id: 'qr', title: 'Guten Morgen', subtitle: 'Scannen beendet den Anker-Wecker.', footer: 'Hängt am besten im Bad.', value: s.alarm.qrSecret }]
  }
}
