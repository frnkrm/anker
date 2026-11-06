import { daysBetween } from './time'
import type { LocalData } from './types'

type Trial = NonNullable<LocalData['trial']>

/** Nur freiwillige Antworten innerhalb der gewählten Probe; keine Ableitung aus App-Nutzung oder Gesundheit. */
export function trialLearningPoints(trial: Trial): string[] {
  const answers = Object.entries(trial.answers).filter(([date]) => {
    const day = daysBetween(trial.startedAt, date)
    return day >= 0 && day < trial.days
  }).map(([, value]) => value)
  const yes = answers.filter((value) => value === 'ja').length
  const partly = answers.filter((value) => value === 'teilweise').length
  const no = answers.filter((value) => value === 'nein').length
  if (!yes && !partly && !no) return ['Du hast keine Tagesantworten festgehalten. Daraus entsteht keine Bewertung.']
  return [
    `Deine Antworten: ${yes}× geholfen, ${partly}× teilweise, ${no}× nicht geholfen.`,
    ...(yes ? ['Was dir geholfen hat, kannst du in deinem Alltag beibehalten.'] : []),
    ...(partly || no ? ['Was dich stört, kannst du kleiner einstellen oder abschalten. Du entscheidest.'] : []),
  ]
}
