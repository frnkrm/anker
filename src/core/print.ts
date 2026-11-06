import { fmtTime } from './time'
import type { DayLog, DayPlan, RoutineId, Settings } from './types'
import type { RoutineCoverage } from './flexible'
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

export interface DayPrintContext {
  plan: DayPlan
  log?: DayLog
  coverage?: readonly RoutineCoverage[]
}

function routineSheet(routine: RoutineId, settings: Settings, context?: DayPrintContext): PrintSheet {
  const title = routine === 'morning' ? 'Morgenroutine' : 'Abendroutine'
  if (!context) return { kind: 'list', id: routine, title, ...(routine === 'morning' ? { subtitle: `Ab ${fmtTime(settings.anchor.wake)}` } : {}), items: settings.routines[routine].map((step) => step.title), footer: 'Die kleine Version zählt auch.' }
  const block = context.plan.blocks.find((candidate) => candidate.routine === routine)
  const planned = new Map(block?.steps?.map((step) => [step.id, step]) ?? [])
  const items = settings.routines[routine].flatMap((step) => {
    const key = `${routine}:${step.id}`
    const result = context.log?.steps[key]
    const coverage = context.coverage?.find((row) => row.key === key)
    if (result === 'done') return [`Erledigt: ${step.title}`]
    if (result === 'minimal') return [`Kleine Version erledigt: ${step.minimal?.title ?? step.title}`]
    if (result === 'not-needed') return [`Heute nicht nötig: ${step.title}`]
    if (result === 'skipped') return [`Übersprungen: ${step.title}`]
    if (coverage?.covered) return [`Schon versorgt: ${step.title}${coverage.source?.kind === 'previous-evening' ? ` (Vorabend ${coverage.source.date}: ${coverage.source.title})` : ' (deine Tagesauswahl)'}`]
    const selected = planned.get(step.id)
    return selected ? [selected.useMinimal && selected.minimal ? selected.minimal.title : selected.title] : []
  })
  return { kind: 'list', id: routine, title, subtitle: `Für ${context.plan.date}${context.plan.pendingEvening && routine === 'evening' ? ' · wartet auf deine Rückkehr' : ''}`, items: items.length ? items : [routine === 'evening' && context.plan.pendingEvening ? 'Die Routine bleibt offen und wartet auf deine Rückkehr.' : 'Für diesen Tag ist hier nichts eingeplant.'], footer: 'Nur wirklich Gemachtes zählt als erledigt. Deine Standardroutine bleibt erhalten.' }
}

/** Vorlage oder ausdrücklich gewählte Tagesinstanz; beide nativen Renderer erhalten dieselbe Projektion. */
export function printSheets(choice: PrintChoice, s: Settings, context?: DayPrintContext): PrintSheet[] {
  const morning = routineSheet('morning', s, context)
  const evening = routineSheet('evening', s, context)
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
