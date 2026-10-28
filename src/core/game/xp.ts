import type { Theme } from './themes'

export const XP = {
  step: 10,
  minimal: 6,
  bonusWake: 25,
  bonusLeave: 25,
  bonusPcStop: 25,
  bonusBed: 25,
  daySuccess: 50,
  chapterPerWeek: 100,
  achievement: 50,
  review: 30,
  inboxReview: 10,
  tidy: 15,
} as const

/** XP, ab der Level n (1-basiert) erreicht ist. */
export function levelThreshold(n: number): number {
  return 75 * n * (n - 1)
}

export interface LevelInfo {
  level: number
  name: string
  current: number
  next: number
  /** 0..1 Fortschritt zum nächsten Level */
  progress: number
}

export function levelFor(xp: number, t: Theme): LevelInfo {
  let level = 1
  while (xp >= levelThreshold(level + 1)) level++
  const current = levelThreshold(level)
  const next = levelThreshold(level + 1)
  const max = t.levels.length
  const name = level <= max ? t.levels[level - 1]! : `${t.levels[max - 1]} ${'★'.repeat(Math.min(5, level - max))}`
  return { level, name, current, next, progress: (xp - current) / (next - current) }
}
