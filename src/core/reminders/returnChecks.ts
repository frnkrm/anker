import { minutesOnPlanDay, zonedToUtc } from '../time'
import type { DayPlan, Settings } from '../types'

/** Eine Rückfrage ist weder eine errechnete Rückkehr noch eine Ankunftsbestätigung. */
export function returnChecks(plan: DayPlan, settings: Settings) {
  const delay = settings.reminders.returnCheckAfterMin
  const enabled = delay !== undefined && Number.isInteger(delay) && delay >= 15 && delay <= 240
  return (plan.legs ?? []).flatMap(({ commitment: c }) => {
    // Arbeit und Termine zu Hause besitzen eigene Abläufe.
    if (c.status === 'cancelled' || c.backAt !== undefined || c.workKind || c.locationKind === 'home' || c.locationKind === 'remote') return []
    if (!enabled && c.returnCheckAt === undefined) return []
    const minute = c.returnCheckAt === undefined ? Math.max(c.start + delay!, c.end ?? c.start) : minutesOnPlanDay(plan.date, c.returnCheckAt)
    // Keine nächtliche Nachholung und keine Hinweise aus einem alten Plantag.
    if (!Number.isFinite(minute) || minute < c.start || minute >= plan.bed) return []
    return [{
      key: `return-check:${c.id}`, at: minute,
      validUntil: zonedToUtc(plan.date, Math.min(minute + 60, plan.bed)),
      channel: 'sanft' as const, title: 'Ist dein Unterwegs-Status noch aktuell?',
      body: 'Öffne Anker, wenn du deinen Status prüfen oder deine Rückkehr bestätigen möchtest.',
      escalate: false,
      revisionFacts: [c.start, c.end, c.leftAt, c.arrivedAt, c.returnCheckAt],
      returnCheckChoice: c.returnCheckAt,
    }]
  })
}
