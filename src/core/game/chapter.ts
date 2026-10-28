import { addDays, daysBetween, type DateStr } from '../time'
import type { DayStatus } from './evaluate'

export const CHAPTER_LENGTHS = [7, 14, 30, 66] as const

export function chapterLength(index: number): number {
  return CHAPTER_LENGTHS[Math.min(index, CHAPTER_LENGTHS.length - 1)]!
}

export interface ChapterResult {
  length: number
  progress: number
  jokerUsed: boolean
  /** zwei verpasste Tage hintereinander (ohne Joker) */
  ended: boolean
  endedOn?: DateStr
  completed: boolean
  completedOn?: DateStr
  /** aktuell 1 verpasster Tag: morgen zählt doppelt („Nie zweimal“) */
  missedYesterday: boolean
}

/**
 * Regel „Nie zweimal“: Ein verpasster Tag unterbricht nichts. Erst der zweite verpasste Tag
 * in Folge beendet das Kapitel – außer der Joker (1× pro Kapitel) fängt ihn ab.
 * Neutrale Tage (krank) werden übersprungen.
 */
export function evaluateChapter(
  start: DateStr,
  length: number,
  today: DateStr,
  statusOf: (d: DateStr) => DayStatus,
  jokerAlreadyUsed = false,
): ChapterResult {
  let progress = 0
  let missedStreak = 0
  let jokerUsed = jokerAlreadyUsed
  const days = daysBetween(start, today)
  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i)
    const st = statusOf(d)
    if (st === 'success') {
      progress++
      missedStreak = 0
      if (progress >= length) return { length, progress, jokerUsed, ended: false, completed: true, completedOn: d, missedYesterday: false }
    } else if (st === 'missed') {
      missedStreak++
      if (missedStreak >= 2) {
        if (!jokerUsed) {
          jokerUsed = true
          missedStreak = 1
        } else {
          return { length, progress, jokerUsed, ended: true, endedOn: d, completed: false, missedYesterday: false }
        }
      }
    }
    // 'neutral' und 'open' ändern nichts
  }
  return { length, progress, jokerUsed, ended: false, completed: false, missedYesterday: missedStreak === 1 }
}
