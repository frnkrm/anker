// Zeit-Hilfen für Europe/Berlin. Alle Tageszeiten sind "Minuten ab lokaler Mitternacht"
// des Plan-Tages; Werte >= 1440 liegen nach Mitternacht (z. B. 1470 = 00:30 am Folgetag).

export const TZ = 'Europe/Berlin'
export type DateStr = string // 'YYYY-MM-DD'

const MIN = 60_000
const DAY_MIN = 1440

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function zonedParts(utcMs: number) {
  const p: Record<string, number> = {}
  for (const part of partsFormatter.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Offset von Berlin gegenüber UTC in Minuten zum Zeitpunkt utcMs (+60 Winter, +120 Sommer). */
export function tzOffsetMinutes(utcMs: number): number {
  const p = zonedParts(utcMs)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / MIN)
}

function splitDate(date: DateStr): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y!, m!, d!]
}

/**
 * Lokale Berliner Wandzeit (Datum + Minuten) → UTC-Millisekunden.
 * Zeiten in der Sommerzeit-Lücke (02:00–03:00 im März) werden nach vorn verschoben.
 */
export function zonedToUtc(date: DateStr, minutes: number): number {
  const [y, m, d] = splitDate(date)
  const wall = Date.UTC(y, m - 1, d) + minutes * MIN
  let t = wall - tzOffsetMinutes(wall) * MIN
  const o2 = tzOffsetMinutes(t)
  if (o2 !== tzOffsetMinutes(wall)) t = wall - o2 * MIN
  return t
}

/** UTC-Millisekunden → Berliner Datum und Minuten ab Mitternacht. */
export function utcToZoned(utcMs: number): { date: DateStr; minutes: number } {
  const p = zonedParts(utcMs)
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute }
}

export function todayBerlin(nowMs = Date.now()): DateStr {
  return utcToZoned(nowMs).date
}

/** Minuten seit Mitternacht des angegebenen Plan-Tages (kann > 1440 oder < 0 sein). */
export function minutesOnPlanDay(date: DateStr, utcMs: number): number {
  const z = utcToZoned(utcMs)
  return z.minutes + daysBetween(date, z.date) * DAY_MIN
}

export function addDays(date: DateStr, n: number): DateStr {
  const [y, m, d] = splitDate(date)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function daysBetween(a: DateStr, b: DateStr): number {
  const [y1, m1, d1] = splitDate(a)
  const [y2, m2, d2] = splitDate(b)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (DAY_MIN * MIN))
}

/** ISO-Wochentag: 0 = Montag … 6 = Sonntag. */
export function weekday(date: DateStr): number {
  const [y, m, d] = splitDate(date)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 1470 → "00:30" */
export function fmtTime(minutes: number): string {
  const m = ((Math.round(minutes) % DAY_MIN) + DAY_MIN) % DAY_MIN
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** "07:15" → 435. Ungültig → NaN. */
export function parseTime(s: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!match) return NaN
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return NaN
  return h * 60 + m
}

/** Dauer menschlich: 95 → "1 h 35 min" */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

export function roundDownTo(minutes: number, step: number): number {
  return Math.floor(minutes / step) * step
}
