// Rechnet Morgen und Schlaf nachvollziehbar aus. Keine Schlaftherapie und keine Empfehlung, weniger zu schlafen.
// Die Weckzeit ändert sich nur nach ausdrücklicher Bestätigung, Medikation spielt hier keine Rolle.

import { fmtDuration, fmtTime, roundDownTo } from './time'
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
}

/** Späteste realistische Aufstehzeit. Ohne feste Verpflichtung am Morgen gibt es keine. */
export function morningNeed(plan: DayPlan, s: Settings): MorningNeed | undefined {
  const morningLeg = plan.legs?.find((l) => l.commitment.commitment === 'hard' && l.leave !== undefined && l.leave === plan.leave)
  let readyAt: number | undefined
  let label = ''
  if (morningLeg) {
    readyAt = morningLeg.leave
    label = morningLeg.commitment.label
  } else if (plan.dayType === 'work') {
    const work = plan.blocks.find((b) => b.kind === 'work')
    if (plan.homeOffice && work) {
      readyAt = work.start - s.travel.homeOfficeStartupMin
      label = 'Homeoffice'
    } else if (plan.leave !== undefined) {
      readyAt = plan.leave
      label = 'Losgehen'
    }
  }
  if (readyAt === undefined) return undefined
  const steps = plan.blocks.find((b) => b.routine === 'morning')?.steps ?? []
  const full = steps.reduce((sum, x) => sum + (x.useMinimal && x.minimal ? x.minimal.minutes : x.minutes), 0)
  const minimal = steps.reduce((sum, x) => sum + (x.minimal?.minutes ?? x.minutes), 0)
  return {
    label,
    readyAt,
    latestWake: roundDownTo(readyAt - full - s.travel.activationMin, 5),
    latestWakeMinimal: roundDownTo(readyAt - minimal - s.travel.activationMin, 5),
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
    ? `Bis ${fmtTime(bedMin)} wach und um ${fmtTime(wakeNextDay)} aufstehen: etwa ${fmtDuration(sleepMin)} Schlaf. Das ist kürzer als deine gewünschten ${fmtDuration(s.sleep.needMin)}.`
    : `Bis ${fmtTime(bedMin)} wach und um ${fmtTime(wakeNextDay)} aufstehen: etwa ${fmtDuration(sleepMin)} Schlaf.`
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
export function wakeProposal(tomorrow: DayPlan, s: Settings): WakeProposal | undefined {
  const need = morningNeed(tomorrow, s)
  if (!need) return undefined
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
