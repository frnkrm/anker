import { describe, expect, it } from 'vitest'
import { trialLearningPoints } from './trial'
import type { LocalData } from './types'

const trial: NonNullable<LocalData['trial']> = { startedAt: '2026-11-02', days: 7, answers: {} }
describe('Freiwillige lokale Probe ohne Diagnose oder Nachholzwang', () => {
  it('erzeugt ohne Antworten und bei Überspringen keine erfundene Nutzenbewertung', () => {
    expect(trialLearningPoints(trial)).toEqual(['Du hast keine Tagesantworten festgehalten. Daraus entsteht keine Bewertung.'])
    expect(trialLearningPoints({ ...trial, answers: { '2026-11-02': 'uebersprungen' } })).toEqual(trialLearningPoints(trial))
  })
  it('zeigt höchstens drei sachliche Punkte und rät nicht, welche Funktion geholfen hat', () => {
    const answers = { '2026-11-02': 'ja', '2026-11-03': 'teilweise', '2026-11-04': 'nein' } as const
    const points = trialLearningPoints({ ...trial, answers })
    expect(points).toHaveLength(3)
    expect(points[0]).toBe('Deine Antworten: 1× geholfen, 1× teilweise, 1× nicht geholfen.')
    expect(points.join(' ')).not.toMatch(/Medikament|Diagnose|Symptom|wirkt|musst|versagt/)
  })
  it('zählt fremde frühere oder spätere Tage nicht als Teil der gewählten Probe', () => {
    expect(trialLearningPoints({ ...trial, answers: { '2026-11-01': 'ja', '2026-11-09': 'nein' } })).toEqual(trialLearningPoints(trial))
  })
})
