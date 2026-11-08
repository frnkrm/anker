import { addDays, fmtTime, weekday, WEEKDAYS } from './time'

/** Eine Stelle für deutsche Zähltexte; Einzahl gilt ausschließlich bei genau eins. */
export function plural(count: number, singular: string, multiple: string): string {
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(count)} ${count === 1 ? singular : multiple}`
}

export const minuteText = (count: number): string => plural(count, 'Minute', 'Minuten')
export const thoughtCount = (count: number): string => plural(count, 'offener Gedanke', 'offene Gedanken')

/** Der Planertext gehört zum betrachteten Tag, nicht zwingend zum heutigen. */
export function planNoteForDate(note: string, displayedDate: string, todayDate: string): string {
  if (displayedDate === todayDate) return note
  const day = displayedDate === addDays(todayDate, 1) ? 'morgen' : `am ${WEEKDAYS[weekday(displayedDate)]}., ${germanDate(displayedDate, false)}`
  return note.replace(/\bheute\b/g, day)
}

/** ISO-Datum immer deutsch, ohne eine lokale Browser-Zeitzone einzubeziehen. */
export function germanDate(date: string, year = true): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  return `${match[3]}.${match[2]}.${year ? match[1] : ''}`
}

export function germanDayDate(date: string): string {
  return `${WEEKDAYS[weekday(date)]}., ${germanDate(date, false)}`
}

export function germanDateTime(at: number, year = false): string {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: year ? 'numeric' : undefined,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('day')}.${value('month')}.${year ? value('year') : ''} · ${value('hour')}:${value('minute')}`
}

/** Knappe Zeitspanne im bestehenden Plan-Minuten-Modell (auch nach Mitternacht). */
export const timeRangeText = (start: number, end: number): string => `${fmtTime(start)}–${fmtTime(end)}`
