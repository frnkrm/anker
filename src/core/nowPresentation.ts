import { addDays, fmtDuration, fmtTime, todayBerlin, type DateStr } from './time'
import type { HardTime } from './types'

/** Display only: plan minutes keep their actual calendar day across midnight. */
export function planTimeLabel(date: DateStr, minute: number, nowMs: number): string {
  const day = addDays(date, Math.floor(minute / 1440))
  const today = todayBerlin(nowMs)
  const label = day === today ? 'Heute' : day === addDays(today, 1) ? 'Morgen' : day === addDays(today, -1) ? 'Gestern'
    : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(`${day}T12:00:00Z`))
  return `${label} um ${fmtTime(minute)}`
}

export function nowAnchorLabel(hard: HardTime, date: DateStr, minute: number, nowMs: number) {
  const label = hard.key === 'commitment' ? hard.label.startsWith('Los') ? 'Losgehen' : 'Termin' : hard.label
  const remaining = Math.ceil(hard.at - minute)
  return {
    title: remaining > 0 && remaining <= 120 ? `${label} in ${fmtDuration(remaining)}` : label,
    time: planTimeLabel(date, hard.at, nowMs),
  }
}
