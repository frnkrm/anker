// Rechnet Morgen und Schlaf nachvollziehbar aus. Keine Schlaftherapie und keine Empfehlung, weniger zu schlafen.
// Die Weckzeit ändert sich nur nach ausdrücklicher Bestätigung, Medikation spielt hier keine Rolle.

import { fmtDuration, fmtTime, roundDownTo, zonedToUtc } from './time'
import { additionalPreparation } from './morning'
import type { DayPlan, Settings } from './types'

export interface MorningNeed {
  /** Woran sich der Morgen ausrichtet */
  label: string
  /** Zeitpunkt, zu dem die Vorbereitung fertig sein muss (Losgehen oder Rechnerstart) */
  readyAt: number
  /** Späteste Weckzeit mit der vollen Morgenroutine */
  latestWake: number
  /** Späteste Weckzeit nur mit den kleinen Versionen */
  latestWakeMinimal: number
  /** Unklarer Ort/Weg verhindert einen vermeintlich sicheren späteren Weckvorschlag. */
  uncertain?: boolean
}

/** Späteste realistische Aufstehzeit. Ohne feste Verpflichtung am Morgen gibt es keine. */
export function morningNeed(plan: DayPlan, s: Settings): MorningNeed | undefined {
  const morning = plan.blocks.find((block) => block.routine === 'morning')
  const steps = morning?.steps ?? []
  const sportMin = plan.blocks.filter((block) => block.kind === 'sport' && morning && block.end <= morning.start).reduce((sum, block) => sum + block.end - block.start, 0)
  const full = steps.reduce((sum, step) => sum + step.minutes, 0)
  const minimal = steps.reduce((sum, step) => sum + (step.minimal?.minutes ?? step.minutes), 0)
  const anchors = plan.morningAnchors ?? (plan.leave !== undefined ? [{ id: 'legacy', label: 'Losgehen', readyAt: plan.leave, prepMin: 0 }] : [])
  if (!anchors.length) return undefined
  const calculate = (routineMin: number) => anchors.map((anchor) => ({
    anchor,
    wake: roundDownTo(anchor.readyAt - additionalPreparation(anchor, routineMin) - routineMin - sportMin - s.travel.activationMin, 5),
  })).sort((a, b) => a.wake - b.wake)[0]!
  const normal = calculate(full)
  const small = calculate(minimal)
  return {
    label: normal.anchor.label,
    readyAt: normal.anchor.readyAt,
    latestWake: normal.wake,
    latestWakeMinimal: small.wake,
    uncertain: anchors.some((anchor) => anchor.uncertain) || undefined,
  }
}

export interface SleepOutlook {
  /** Geschätzte Schlafzeit, keine Messung */
  sleepMin: number
  short: boolean
  /** Sachlicher Satz, ohne Wertung */
  text: string
}

/** Was eine Bettzeit (Plan-Minuten heute, nach Mitternacht > 1440) für den nächsten Morgen bedeutet. */
export function sleepOutlook(bedMin: number, wakeNextDay: number, s: Settings): SleepOutlook {
  const sleepMin = Math.max(0, wakeNextDay + 1440 - bedMin - s.sleep.fallAsleepMin)
  const short = sleepMin < s.sleep.needMin
  const text = short
    ? `Bis ${fmtTime(bedMin)} wach und um ${fmtTime(wakeNextDay)} aufstehen: etwa ${fmtDuration(sleepMin)} mögliche Schlafzeit. Das ist kürzer als deine gewünschten ${fmtDuration(s.sleep.needMin)}.`
    : `Bis ${fmtTime(bedMin)} wach und um ${fmtTime(wakeNextDay)} aufstehen: etwa ${fmtDuration(sleepMin)} mögliche Schlafzeit.`
  return { sleepMin, short, text }
}

export interface WakeProposal {
  wake: number
  later: boolean
  text: string
}

/**
 * Vorschlag für eine einmalige Weckzeit. Nur ein Angebot: Anwenden erfordert eine Bestätigung,
 * Standardwecker und andere Tage bleiben unberührt. Undefined, wenn sich nichts ändern würde.
 */
export function wakeProposal(tomorrow: DayPlan, s: Settings, nowMs?: number): WakeProposal | undefined {
  const need = morningNeed(tomorrow, s)
  if (!need || need.uncertain || need.latestWake < 0 || need.latestWake >= 1440) return undefined
  if (nowMs !== undefined && zonedToUtc(tomorrow.date, need.latestWake) <= nowMs) return undefined
  if (need.latestWake === tomorrow.wake) return undefined
  const later = need.latestWake > tomorrow.wake
  return {
    wake: need.latestWake,
    later,
    text: later
      ? `Für ${need.label} reicht ${fmtTime(need.latestWake)} statt ${fmtTime(tomorrow.wake)}.`
      : `Für ${need.label} brauchst du ${fmtTime(need.latestWake)} statt ${fmtTime(tomorrow.wake)}.`,
  }
}

/** Passt es selbst mit den kleinen Versionen nicht? Dann ehrlich sagen, keinen unmöglichen Plan speichern. */
export function arrivalImpossible(need: MorningNeed, nowInPlanMin: number): boolean {
  return need.latestWakeMinimal < nowInPlanMin
}
