import { addDays, type DateStr } from './time'
import type { Commitment, DayLog, LocalData, RoutineStep, Settings, WorkSession } from './types'

export interface RoutineCoverage {
  key: string
  step: RoutineStep
  covered: boolean
  overridden: boolean
  source?: { kind: 'day-choice' } | { kind: 'previous-evening'; date: DateStr; stepId: string; title: string; result: 'done' | 'minimal' }
}

/** Eine Projektion der vorhandenen Regel und echten Vorabendhandlung, keine zweite Bedarfsliste. */
export function routineCoverage(date: DateStr, settings: Settings, days: Readonly<Record<DateStr, DayLog>>): RoutineCoverage[] {
  const previousDate = addDays(date, -1)
  const previous = days[previousDate]
  const override = days[date]?.override
  return settings.routines.morning.map((step) => {
    const key = `morning:${step.id}`
    const overridden = override?.uncoveredSteps?.includes(key) ?? false
    let source: RoutineCoverage['source']
    if (override?.coveredSteps?.includes(key)) source = { kind: 'day-choice' }
    else {
      const rule = settings.routineLinks.find((candidate) => candidate.morningStepId === step.id
        && ['done', 'minimal'].includes(previous?.steps[`evening:${candidate.eveningStepId}`] ?? ''))
      const sourceStep = rule && settings.routines.evening.find((candidate) => candidate.id === rule.eveningStepId)
      const result = sourceStep && previous?.steps[`evening:${sourceStep.id}`]
      if (sourceStep && (result === 'done' || result === 'minimal')) source = { kind: 'previous-evening', date: previousDate, stepId: sourceStep.id, title: sourceStep.title, result }
    }
    return { key, step, covered: !!source && !overridden, overridden, ...(source ? { source } : {}) }
  })
}

/** Echte Ausführung und verknüpfte Arbeitszeit sind unumkehrbar durch bloßes Plan-Undo. */
export function commitmentStarted(commitment: Commitment, sessions: readonly WorkSession[]): boolean {
  return commitment.leftAt !== undefined || commitment.arrivedAt !== undefined || commitment.backAt !== undefined || sessions.some((session) => session.commitmentId === commitment.id)
}

/** Nur die in dieser Rücknahmebasis enthaltene Tagesplanung ändern. Andere Tage bleiben exakt. */
export function restoreCommitments(date: DateStr, current: readonly Commitment[], original: readonly Commitment[], sessions: readonly WorkSession[]): Commitment[] {
  const before = new Map(original.map((commitment) => [commitment.id, commitment]))
  const restored = current.map((commitment) => {
    if (commitment.date !== date) return commitment
    const baseline = before.get(commitment.id)
    before.delete(commitment.id)
    if (commitmentStarted(commitment, sessions)) return commitment
    return baseline ? structuredClone(baseline) : { ...commitment, status: 'cancelled' as const }
  })
  for (const commitment of before.values()) restored.push(structuredClone(commitment))
  return restored
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(new Date(value).getTime()) && value >= 0
const dateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

/** Additives Feld: alte Sicherungen dürfen fehlen, beschädigte Rücknahme darf keine Termine ersetzen. */
export function validPlanUndo(value: unknown): value is LocalData['planUndo'] {
  if (value === undefined) return true
  return object(value) && Object.entries(value).every(([date, entry]) => dateString(date) && object(entry) && timestamp(entry.at)
    && Array.isArray(entry.commitments) && entry.commitments.every((commitment) => object(commitment)
      && typeof commitment.id === 'string' && !!commitment.id && commitment.date === date && typeof commitment.label === 'string'
      && typeof commitment.start === 'number' && Number.isFinite(commitment.start)
      && ['work', 'customer', 'social', 'personal', 'other'].includes(String(commitment.context))
      && ['hard', 'soft', 'optional'].includes(String(commitment.commitment))))
}
