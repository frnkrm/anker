import { minutesOnPlanDay } from '../time'
import type { DayLog, DayPlan, GameState, Settings } from '../types'
import { dayGoals } from './evaluate'
import { XP } from './xp'

/** Alle XP-Gründe, die der Tag bisher verdient hat: [Grund, Betrag]. */
export function earnedAwards(plan: DayPlan, log: DayLog, s: Settings): [string, number][] {
  const out: [string, number][] = []
  for (const [k, v] of Object.entries(log.steps)) {
    if (v === 'done') out.push([`step:${k}`, XP.step])
    else if (v === 'minimal') out.push([`step:${k}`, XP.minimal])
  }
  const goals = dayGoals(plan, log, s)
  const met = (key: string) => goals.some((g) => g.key === key && g.met)
  if (met('wake')) out.push(['bonus:wake', XP.bonusWake])
  if (met('leave')) out.push(['bonus:leave', XP.bonusLeave])
  if (met('pcstop')) out.push(['bonus:pcstop', XP.bonusPcStop])
  if (log.bedAt !== undefined && minutesOnPlanDay(plan.date, log.bedAt) <= Math.max(s.bedBonusLatest, plan.bed)) {
    out.push(['bonus:bed', XP.bonusBed])
  }
  if (log.tidyDone) out.push(['tidy', XP.tidy])
  if (goals.length > 0 && goals.every((g) => g.met)) out.push(['day', XP.daySuccess])
  return out
}

/** Vergibt noch nicht vergebene XP. Jeder Grund zählt pro Tag genau einmal. */
export function applyAwards(plan: DayPlan, log: DayLog, game: GameState, s: Settings): { log: DayLog; game: GameState; gained: number } {
  const awarded = new Set(log.awarded ?? [])
  let gained = 0
  for (const [reason, amount] of earnedAwards(plan, log, s)) {
    if (awarded.has(reason)) continue
    awarded.add(reason)
    gained += amount
  }
  if (!gained) return { log, game, gained }
  return { log: { ...log, awarded: [...awarded] }, game: { ...game, xp: game.xp + gained }, gained }
}
