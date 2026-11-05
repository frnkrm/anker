// Wege und Termine des Tages. Reine Logik: Der Ursprung einer Strecke ist der letzte bekannte Ort,
// nicht immer die Wohnung. Fehlt eine Fahrzeit, wird sie nicht erfunden, sondern als offen gemeldet.

import type { Commitment, Leg, Place, Settings } from '../types'

export const HOME_LABEL = 'Zuhause'
export const OFFICE_LABEL = 'Büro'

export interface LegContext {
  settings: Settings
  places: Place[]
  /** Büro vor Ort an diesem Tag, sonst undefined (Homeoffice, frei, Kundentag) */
  office?: { start: number; end: number }
}

function placeOf(c: Commitment, places: Place[]): Place | undefined {
  return c.placeId ? places.find((p) => p.id === c.placeId) : undefined
}

function placeLabel(c: Commitment, places: Place[]): string | undefined {
  return c.placeLabel?.trim() || placeOf(c, places)?.label
}

/** Findet nur Zeiten, die wirklich hinterlegt sind. Keine Annahme, keine Null-Minuten-Fahrt. */
function travelBetween(c: Commitment, originKey: string, places: Place[]): number | undefined {
  if (c.travelMin !== undefined) return c.travelMin
  const p = placeOf(c, places)
  if (!p) return undefined
  if (originKey === 'home') return p.travelFromHomeMin
  return p.travelFrom?.[originKey]
}

/** Baut aus den Terminen eines Tages die tatsächlichen Wege, in zeitlicher Reihenfolge. */
export function planLegs(commitments: Commitment[], ctx: LegContext): Leg[] {
  const active = commitments.filter((c) => c.status !== 'cancelled').sort((a, b) => a.start - b.start)
  const t = ctx.settings.travel
  const legs: Leg[] = []
  let origin = { key: 'home', label: HOME_LABEL }

  active.forEach((c, i) => {
    const previous = active[i - 1]
    if (previous) {
      // Nach einem Termin startet die Strecke dort, außer es ging ausdrücklich erst nach Hause
      const prevLabel = placeLabel(previous, ctx.places)
      if (previous.thenTo === 'home' || !prevLabel) origin = { key: 'home', label: HOME_LABEL }
      else origin = { key: previous.placeId ?? previous.id, label: prevLabel }
    } else if (ctx.office && c.start >= ctx.office.start && !c.replacesCommute) {
      origin = { key: 'office', label: OFFICE_LABEL }
    }

    const toLabel = placeLabel(c, ctx.places)
    const remote = c.routeMode === 'none' || !toLabel
    const travelMin = remote ? 0 : travelBetween(c, origin.key, ctx.places)
    const arrivalBuffer = remote ? 0 : (c.arrivalBufferMin ?? t.arrivalBufferMin)
    const prepMin = c.prepMin ?? (remote ? 0 : t.prepMin)
    const leave = travelMin === undefined ? undefined : c.start - arrivalBuffer - travelMin
    const prepAnchor = leave ?? c.start - arrivalBuffer
    const prepStart = prepMin > 0 ? prepAnchor - prepMin : undefined
    const items = [...(c.items ?? placeOf(c, ctx.places)?.items ?? [])]

    legs.push({
      commitment: c,
      fromLabel: origin.label,
      toLabel: remote ? undefined : toLabel,
      travelMin: remote ? undefined : travelMin,
      travelOpen: !remote && travelMin === undefined,
      leave: remote ? undefined : leave,
      prepStart,
      items,
      returnMin: remote ? undefined : c.travelHomeMin ?? placeOf(c, ctx.places)?.travelFromHomeMin ?? c.travelMin,
    })
  })
  return legs
}

/** Zeitraum, den ein Weg samt Termin im Tag belegt. `end` = undefined heißt: Ende offen. */
export function legSpan(leg: Leg): { start: number; end?: number } {
  const c = leg.commitment
  const start = leg.prepStart ?? leg.leave ?? c.start
  if (c.end === undefined) return { start }
  return { start, end: c.end + (leg.returnMin ?? 0) }
}

/** Überschneidungen harter Termine. Anker benennt sie, ändert aber nie selbst etwas daran. */
export function hardConflicts(legs: Leg[], labelFor = (l: Leg) => l.commitment.label): string[] {
  const out: string[] = []
  const hard = legs.filter((l) => l.commitment.commitment === 'hard')
  for (let i = 1; i < hard.length; i++) {
    const a = hard[i - 1]!
    const b = hard[i]!
    const aEnd = a.commitment.end ?? a.commitment.start
    const bStart = b.leave ?? b.commitment.start
    if (bStart < aEnd) out.push(`„${labelFor(a)}“ und „${labelFor(b)}“ überschneiden sich.`)
  }
  return out
}

/** Link zu Google Maps, ohne API-Key. Maps liefert Anker keine Fahrzeit zurück. */
export function mapsUrl(destination: string, mode: Commitment['routeMode'] = 'driving'): string {
  const travelmode = mode === 'transit' ? 'transit' : mode === 'cycling' ? 'bicycling' : mode === 'walking' ? 'walking' : 'driving'
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${travelmode}`
}

/** Liest aus einem kurzen Text höchstens eine Uhrzeit heraus. Der Nutzer bestätigt sie immer. */
export function parseQuickTime(text: string): number | undefined {
  const withColon = /\b(\d{1,2})[:.](\d{2})\b/.exec(text)
  const withWord = /\b(\d{1,2})\s*uhr\b/i.exec(text)
  const h = Number(withColon?.[1] ?? withWord?.[1])
  const m = Number(withColon?.[2] ?? 0)
  if (!Number.isInteger(h) || h > 23 || m > 59) return undefined
  return h * 60 + m
}
