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
  /** Kompatibilitätsfeld: Nicht erfüllte Tage beenden kein Kapitel mehr. */
  ended: boolean
  endedOn?: DateStr
  completed: boolean
  completedOn?: DateStr
  /** Kompatibilitätsfeld: Aus Nichtnutzung entsteht keine Aufforderung zum Nachholen. */
  missedYesterday: boolean
}

/**
 * Nur tatsächlich geschaffte Tage erhöhen den Fortschritt. Pausen und nicht erfüllte
 * Tage nehmen nichts weg und verbrauchen keinen Joker. Historische Jokerwerte bleiben erhalten.
 */
export function evaluateChapter(
  start: DateStr,
  length: number,
  today: DateStr,
  statusOf: (d: DateStr) => DayStatus,
  jokerAlreadyUsed = false,
): ChapterResult {
  let progress = 0
  const days = daysBetween(start, today)
  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i)
    const st = statusOf(d)
    if (st === 'success') {
      progress++
      if (progress >= length) return { length, progress, jokerUsed: jokerAlreadyUsed, ended: false, completed: true, completedOn: d, missedYesterday: false }
    }
  }
  return { length, progress, jokerUsed: jokerAlreadyUsed, ended: false, completed: false, missedYesterday: false }
}
