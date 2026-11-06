import { addDays, utcToZoned } from '../time'
import { activePlanDate } from '../now'
import type { CalendarEvent, Commitment, DayLog } from '../types'

/** Known dated exceptions remain dated; a weekly baseline must never invent their plan. */
export function knownReminderDates(today: string, days: Record<string, DayLog | undefined>, events: CalendarEvent[], commitments: Commitment[]): string[] {
  const dates = new Set<string>()
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  for (const date of Object.keys(days)) if (valid(date)) dates.add(date)
  for (const commitment of commitments) if (valid(commitment.date)) dates.add(commitment.date)
  for (const event of events) {
    if (!Number.isFinite(event.start) || !Number.isFinite(event.end) || !Number.isFinite(new Date(event.start).getTime()) || !Number.isFinite(new Date(event.end).getTime())) continue
    const first = activePlanDate(event.start, (at) => utcToZoned(at).date)
    const last = utcToZoned(Math.max(event.start, event.end - 1)).date
    // The existing native recurrence search has the same bounded planning horizon.
    const limit = addDays(first < today ? today : first, 400)
    for (let date = first < today ? today : first; date <= last && date <= limit; date = addDays(date, 1)) dates.add(date)
  }
  return [...dates].sort()
}
