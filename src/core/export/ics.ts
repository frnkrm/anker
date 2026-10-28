import { buildDayPlan } from '../planner'
import { addDays, pad, weekday, type DateStr } from '../time'
import type { Block, Settings } from '../types'

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Zeilen nach RFC 5545 auf 75 Oktette falten. */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts: string[] = []
  let cur = ''
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74
    if (enc.encode(cur + ch).length > limit) {
      parts.push(cur)
      cur = ch
    } else cur += ch
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

function localStamp(date: DateStr, minutes: number): string {
  const d = addDays(date, Math.floor(minutes / 1440))
  const m = ((minutes % 1440) + 1440) % 1440
  return `${d.replace(/-/g, '')}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`
}

const EXPORT_KINDS: Block['kind'][] = ['wake', 'morning', 'sport', 'commute', 'evening-routine', 'pc-stop', 'bed']

export interface IcsEntry {
  key: string
  title: string
  start: number
  end: number
  days: number[]
  firstDate: DateStr
  alarmMin: number
}

/** Fasst wiederkehrende Blöcke der nächsten 7 Tage nach (Art, Titel, Zeit) zusammen. */
export function recurringEntries(s: Settings, from: DateStr): IcsEntry[] {
  const map = new Map<string, IcsEntry>()
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i)
    const plan = buildDayPlan({ date, settings: s, override: { dayType: s.work[weekday(date)]!.isWorkDay ? 'work' : 'weekend' } })
    for (const b of plan.blocks) {
      if (!EXPORT_KINDS.includes(b.kind)) continue
      if (b.kind === 'commute' && b.title !== 'Losgehen') continue
      const end = b.end > b.start ? b.end : b.start + 5
      const k = `${b.kind}|${b.title}|${b.start}|${end}`
      const e = map.get(k)
      if (e) e.days.push(weekday(date))
      else map.set(k, { key: k, title: b.title, start: b.start, end: b.kind === 'pc-stop' ? b.start + 5 : end, days: [weekday(date)], firstDate: date, alarmMin: b.hard ? 0 : 5 })
    }
  }
  return [...map.values()]
}

export function buildIcs(s: Settings, from: DateStr, nowStamp = '20260101T000000Z'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Anker//Tagesplan//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Anker', 'X-WR-TIMEZONE:Europe/Berlin', ...VTIMEZONE]
  for (const e of recurringEntries(s, from)) {
    const days = [...e.days].sort((a, b) => a - b)
    lines.push(
      'BEGIN:VEVENT',
      `UID:anker-${e.key.replace(/[^a-z0-9]/gi, '-')}@anker`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;TZID=Europe/Berlin:${localStamp(e.firstDate, e.start)}`,
      `DTEND;TZID=Europe/Berlin:${localStamp(e.firstDate, e.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`,
      `SUMMARY:${escapeText(e.title)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.title)}`,
      `TRIGGER:-PT${e.alarmMin}M`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
