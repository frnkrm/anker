// Macht aus einer Vorhersage einen kurzen Hinweis für die tatsächliche Zeit draußen.
// Die Regeln sind persönliche Einstellungen, keine Wahrheit. Ohne Daten gibt es keine Aussage.

import type { DayPlan, Settings } from './types'

export interface WeatherHour {
  /** Plan-Minuten des Vorhersagetages */
  minutes: number
  tempC: number
  apparentC: number
  rainPct: number
  windKmh: number
}

export interface WeatherAdvice {
  windowLabel: string
  summary: string
  suggestions: string[]
}

/** Wann bist du morgen draußen? Homeoffice ohne Termin: gar nicht, dann entfällt die Karte. */
export function outdoorWindow(plan: DayPlan): { from: number; to: number } | undefined {
  const leg = plan.legs?.find((l) => l.leave !== undefined)
  if (leg?.leave !== undefined) return { from: leg.leave, to: leg.commitment.start }
  if (plan.leave !== undefined && !plan.homeOffice) return { from: plan.leave, to: plan.leave + 60 }
  return undefined
}

export function weatherAdvice(hours: WeatherHour[], window: { from: number; to: number }, rules: Settings['weather']['rules']): WeatherAdvice | undefined {
  const from = Math.floor(window.from / 60) * 60
  const relevant = hours.filter((h) => h.minutes >= from && h.minutes <= window.to)
  if (!relevant.length) return undefined
  const temps = relevant.map((h) => h.apparentC)
  const low = Math.round(Math.min(...temps))
  const high = Math.round(Math.max(...temps))
  const rain = Math.max(...relevant.map((h) => h.rainPct))
  const hour = (m: number) => String(Math.floor(m / 60)).padStart(2, '0')
  const suggestions: string[] = []
  if (low < rules.jacketBelowC) suggestions.push('Jacke')
  if (rain >= rules.rainAbovePct) suggestions.push('Regenjacke oder Schirm')
  const range = low === high ? `gefühlt ${low} °C` : `gefühlt ${low} bis ${high} °C`
  return {
    windowLabel: `Morgen ${hour(from)} bis ${hour(window.to + 59)} Uhr`,
    summary: `${range}, Regenrisiko ${Math.round(rain)} %`,
    suggestions,
  }
}
