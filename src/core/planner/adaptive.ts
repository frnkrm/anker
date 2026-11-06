// Wege und Termine des Tages. Reine Logik: Der Ursprung einer Strecke ist der letzte bekannte Ort,
// nicht immer die Wohnung. Fehlt eine Fahrzeit, wird sie nicht erfunden, sondern als offen gemeldet.

import type { Commitment, Leg, Place, Settings } from '../types'
import { locationKind, normalizeCommitment } from '../travel'

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

/** Findet ausschließlich ausdrücklich hinterlegte Zeiten für die jeweilige Richtung. */
function travelBetween(c: Commitment, originKey: string, destinationKey: string, ctx: LegContext): number | undefined {
  if (originKey === 'unknown') return undefined
  if (originKey === destinationKey) return 0
  if (c.travelMin !== undefined) return c.travelMin
  if (destinationKey === 'home' && originKey === 'office') return ctx.settings.commute.minutes
  const place = placeOf(c, ctx.places)
  return originKey === 'home' ? place?.travelFromHomeMin : place?.travelFrom?.[originKey]
}

function originPlace(key: string, places: readonly Place[]): { key: string; label: string } {
  if (key === 'home') return { key, label: HOME_LABEL }
  if (key === 'office') return { key, label: OFFICE_LABEL }
  const place = places.find((candidate) => candidate.id === key)
  return place ? { key, label: place.label } : { key: 'unknown', label: 'Startort noch offen' }
}

/** Baut tatsächliche oder ausdrücklich geplante Ortsfolgen, ohne einen Umweg zu erfinden. */
export function planLegs(commitments: Commitment[], ctx: LegContext): Leg[] {
  const active = commitments.map(normalizeCommitment).filter((c): c is Commitment => !!c && c.status !== 'cancelled').sort((a, b) => a.start - b.start)
  const t = ctx.settings.travel
  const legs: Leg[] = []
  let origin = originPlace('home', ctx.places)

  for (let i = 0; i < active.length; i++) {
    const c = active[i]!
    const previous = active[i - 1]
    if (previous) {
      const kind = locationKind(previous, ctx.places)
      if (previous.backAt !== undefined || previous.thenTo === 'home' || kind === 'home') origin = originPlace('home', ctx.places)
      else if (kind === 'onsite') {
        const label = placeLabel(previous, ctx.places)
        origin = label ? { key: previous.placeId ?? previous.id, label } : originPlace('unknown', ctx.places)
      } else if (kind === 'unknown') origin = originPlace('unknown', ctx.places)
      // Ein Remote-Termin verändert den Aufenthaltsort nicht.
    } else if (ctx.office && c.start >= ctx.office.start && !c.replacesCommute) {
      const homeAt = ctx.office.end + ctx.settings.commute.minutes
      origin = originPlace(c.start < homeAt ? 'office' : 'home', ctx.places)
    }
    if (c.originPlaceId) origin = originPlace(c.originPlaceId, ctx.places)

    const kind = locationKind(c, ctx.places)
    const remote = kind === 'remote'
    const toLabel = kind === 'home' ? HOME_LABEL : remote ? undefined : placeLabel(c, ctx.places)
    const toKey = kind === 'home' ? 'home' : c.placeId ?? c.id
    const locationOpen = kind === 'unknown' || (!remote && !toLabel)
    const travelMin = remote ? 0 : travelBetween(c, origin.key, toKey, ctx)
    const noJourney = remote || (kind === 'home' && origin.key === 'home')
    const arrivalBuffer = noJourney ? 0 : (c.arrivalBufferMin ?? t.arrivalBufferMin)
    const prepMin = c.prepMin ?? (remote ? t.homeOfficeStartupMin : kind === 'home' ? 0 : t.prepMin)
    const leave = remote || travelMin === undefined ? undefined : c.start - arrivalBuffer - travelMin
    const prepAnchor = leave ?? c.start - arrivalBuffer
    const returnMin = remote || kind === 'home' || c.thenTo === 'next' ? undefined : c.travelHomeMin
    const returnOpen = !remote && kind !== 'home' && c.thenTo !== 'next' && returnMin === undefined
    legs.push({
      commitment: c,
      fromLabel: origin.label,
      fromKey: origin.key,
      toLabel,
      toKey: remote ? origin.key : toKey,
      locationOpen: locationOpen || undefined,
      originOpen: origin.key === 'unknown' || undefined,
      travelMin: remote ? undefined : travelMin,
      travelOpen: !remote && (locationOpen || origin.key === 'unknown' || travelMin === undefined),
      leave,
      prepStart: prepMin > 0 ? prepAnchor - prepMin : undefined,
      items: [...(c.items ?? placeOf(c, ctx.places)?.items ?? [])],
      returnMin,
      returnOpen: returnOpen || undefined,
    })
  }
  return legs
}

/** Ohne bekanntes Ende oder bekannte Rückfahrt bleibt die Rückkehr offen. */
export function legSpan(leg: Leg): { start: number; end?: number } {
  const c = leg.commitment
  const start = leg.prepStart ?? leg.leave ?? c.start
  if (c.end === undefined) return { start }
  if (c.thenTo !== 'next' && leg.returnOpen) return { start }
  return { start, end: c.end + (c.thenTo === 'next' ? 0 : leg.returnMin ?? 0) }
}

/** Überschneidungen harter Termine. Anker benennt sie, ändert aber nie selbst etwas daran. */
export function hardConflicts(legs: Leg[], labelFor = (l: Leg) => l.commitment.label): string[] {
  const out: string[] = []
  const hard = legs.filter((l) => l.commitment.commitment === 'hard')
  for (let i = 1; i < hard.length; i++) {
    const a = hard[i - 1]!
    const b = hard[i]!
    const aEnd = a.commitment.end ?? a.commitment.start
    const bStart = b.prepStart ?? b.leave ?? b.commitment.start
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
