import { fmtTime } from './time'
import type { Block, DayPlan, Leg } from './types'

/** Nur die Hinweise erhalten ein Zeitfenster; der Terminplan wird nicht verändert. */
export const CONFLICT_NOTICE_LEAD_MINUTES = 120

export interface PlanConflict {
  id: string
  date: string
  kind: 'home-journey' | 'commitments' | 'work'
  start: number
  end: number
  blockIds: string[]
  blockLabels: Record<string, string>
  summary: string
  shortLabel: string
}

export type ConflictVisibility = 'quiet' | 'active' | 'hidden'

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd
const startOf = (leg: Leg) => leg.prepStart ?? leg.leave ?? leg.commitment.start
const endOf = (leg: Leg) => leg.commitment.end ?? leg.commitment.start + 1
const sourceIds = (leg: Leg) => [`prep:${leg.commitment.id}`, `travel:${leg.commitment.id}`, `commitment:${leg.commitment.id}`]

function involved(plan: DayPlan, leg: Leg, start: number, end: number): Block[] {
  const ids = sourceIds(leg)
  return plan.blocks.filter((block) => ids.includes(block.id) && overlap(block.start, Math.max(block.start + 1, block.end), start, end))
}

/**
 * Lesende Projektion aus genau den vorhandenen Planblöcken und Wegen.
 * Die bisherigen plan.conflicts bleiben für Export und ältere Aufrufer erhalten.
 * Weder Termine noch Wege werden hier umgeplant oder gespeichert.
 */
export function planConflicts(plan: DayPlan): PlanConflict[] {
  const conflicts: PlanConflict[] = []
  const legs = plan.legs ?? []
  const add = (kind: PlanConflict['kind'], keys: string[], start: number, end: number, blocks: Block[], label: string, shortLabel: string, labels: Record<string, string> = {}) => {
    if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) return
    const id = `${plan.date}:${kind}:${keys.map(encodeURIComponent).join(':')}:${start}:${end}`
    if (conflicts.some((entry) => entry.id === id)) return
    const blockIds = [...new Set(blocks.map((block) => block.id))]
    conflicts.push({ id, date: plan.date, kind, start, end, blockIds,
      blockLabels: Object.fromEntries(blockIds.map((key) => [key, labels[key] ?? shortLabel])),
      summary: `Überschneidung um ${fmtTime(start)}: ${label}.`, shortLabel })
  }

  const home = plan.blocks.find((block) => block.id === `${plan.date}:commute-home`)
  if (home) for (const leg of legs) {
    const c = leg.commitment
    if (c.commitment !== 'hard' || c.workKind === 'oncall' || c.backAt !== undefined || c.arrivedAt !== undefined) continue
    const start = Math.max(startOf(leg), home.start)
    const end = Math.min(endOf(leg), home.end)
    if (start >= end) continue
    const blocks = involved(plan, leg, start, end)
    add('home-journey', [c.id, home.id], start, end, [home, ...blocks], `${c.label} und Heimweg`, 'überschneidet sich mit Heimweg', {
      [home.id]: `überschneidet sich mit ${c.label}`,
    })
  }

  const hard = legs.filter((leg) => leg.commitment.commitment === 'hard').sort((a, b) => a.commitment.start - b.commitment.start)
  for (let i = 0; i < hard.length; i++) for (let j = i + 1; j < hard.length; j++) {
    const a = hard[i]!, b = hard[j]!
    // Unbekannte Enden bleiben unbekannt und werden nicht künstlich verlängert.
    if (a.commitment.end === undefined) continue
    const start = Math.max(a.commitment.start, startOf(b))
    const end = Math.min(a.commitment.end, endOf(b))
    const aBlocks = involved(plan, a, start, end), bBlocks = involved(plan, b, start, end)
    add('commitments', [a.commitment.id, b.commitment.id], start, end, [...aBlocks, ...bBlocks], `${a.commitment.label} und ${b.commitment.label}`, 'überschneidet sich mit einem Termin', {
      ...Object.fromEntries(aBlocks.map((block) => [block.id, `überschneidet sich mit ${b.commitment.label}`])),
      ...Object.fromEntries(bBlocks.map((block) => [block.id, `überschneidet sich mit ${a.commitment.label}`])),
    })
  }

  const work = plan.blocks.find((block) => block.kind === 'work')
  if (work && !plan.workInfo?.closed) for (const leg of legs) {
    const c = leg.commitment
    if (c.commitment !== 'hard' || c.workKind === 'oncall' || c.replacesCommute || c.backAt !== undefined || c.context === 'work') continue
    const start = Math.max(work.start, startOf(leg)), end = Math.min(work.end, endOf(leg))
    if (start >= end) continue
    add('work', [c.id, work.id], start, end, [work, ...involved(plan, leg, start, end)], `${c.label} und Arbeit`, 'überschneidet sich mit Arbeitszeit', {
      [work.id]: `überschneidet sich mit ${c.label}`,
    })
  }
  return conflicts.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
}

/** Nach Beginn kein Handlungsaufruf mehr; nach Ende auch kein stiller Hinweis. */
export function conflictVisibility(conflict: PlanConflict, minute: number, acknowledgedIds: readonly string[] = []): ConflictVisibility {
  if (!Number.isFinite(minute) || acknowledgedIds.includes(conflict.id) || minute > conflict.start || minute >= conflict.end) return 'hidden'
  return minute >= conflict.start - CONFLICT_NOTICE_LEAD_MINUTES ? 'active' : 'quiet'
}

export function nowConflictNotice(plan: DayPlan, minute: number, acknowledgedIds: readonly string[] = []): { active: PlanConflict[]; upcomingCount: number } {
  const pending = planConflicts(plan).map((conflict) => ({ conflict, visibility: conflictVisibility(conflict, minute, acknowledgedIds) }))
  return {
    active: pending.filter((item) => item.visibility === 'active').map((item) => item.conflict),
    upcomingCount: pending.filter((item) => item.visibility === 'quiet').length,
  }
}

export const conflictsForBlock = (plan: DayPlan, blockId: string): PlanConflict[] => planConflicts(plan).filter((conflict) => conflict.blockIds.includes(blockId))

/** Ältere Backups dürfen das neue private Feld auslassen. */
export function validConflictAcknowledgements(value: unknown): value is Record<string, string[]> | undefined {
  if (value === undefined) return true
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([date, ids]) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
    && Array.isArray(ids) && ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 1200))
}
