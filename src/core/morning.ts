import type { CalendarEvent, Leg, MorningAnchor, Settings } from './types'
import { minutesOnPlanDay, type DateStr } from './time'
import { locationKind } from './travel'

/** Harte Morgenpflichten werden einmal im Tagesplan gesammelt und für Anzeige und Weckbedarf benutzt. */
export function morningAnchors(input: {
  date: DateStr
  settings: Settings
  legs: readonly Leg[]
  events: readonly CalendarEvent[]
  work?: { readyAt: number; label: string }
}): MorningAnchor[] {
  const result: MorningAnchor[] = []
  if (input.work && input.work.readyAt < 12 * 60) result.push({ id: 'work', ...input.work, prepMin: 0 })
  for (const leg of input.legs) {
    const c = leg.commitment
    if (c.commitment !== 'hard' || c.workKind === 'oncall' || c.start < 4 * 60 || c.start >= 12 * 60) continue
    const kind = leg.toKey === 'home' ? 'home' : locationKind(c)
    const prepMin = c.prepMin ?? (kind === 'remote' ? input.settings.travel.homeOfficeStartupMin : kind === 'home' ? 0 : input.settings.travel.prepMin)
    result.push({
      id: `commitment:${c.id}`,
      label: c.label,
      readyAt: leg.leave ?? c.start,
      prepMin,
      prepIncludesMorning: c.prepIncludesMorning,
      uncertain: leg.travelOpen || leg.locationOpen || leg.originOpen || undefined,
    })
  }
  for (const event of input.events) {
    if (event.allDay) continue
    const start = minutesOnPlanDay(input.date, event.start)
    if (start < 4 * 60 || start >= 12 * 60) continue
    // Ohne bewusst verknüpften lokalen Termin wissen wir nicht, ob eine Fahrt nötig ist.
    result.push({ id: `event:${event.id}`, label: event.title, readyAt: start, prepMin: input.settings.travel.homeOfficeStartupMin, uncertain: true })
  }
  return result.sort((a, b) => a.readyAt - a.prepMin - (b.readyAt - b.prepMin))
}

export function additionalPreparation(anchor: MorningAnchor, routineMin: number): number {
  return anchor.prepIncludesMorning ? Math.max(0, anchor.prepMin - routineMin) : anchor.prepMin
}

export function routineDeadline(anchors: readonly MorningAnchor[], routineMin: number): number | undefined {
  return anchors.length ? Math.min(...anchors.map((anchor) => anchor.readyAt - additionalPreparation(anchor, routineMin))) : undefined
}
