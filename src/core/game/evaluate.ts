import { minutesOnPlanDay, weekday } from '../time'
import type { DayLog, DayPlan, Settings } from '../types'

export type DayStatus = 'success' | 'missed' | 'neutral' | 'open'

export interface Goal {
  key: 'wake' | 'leave' | 'evening' | 'pcstop' | 'movement' | 'gym' | 'prepcook' | 'tidy'
  label: string
  met: boolean
}

const LEAVE_TOLERANCE = 3
const PCSTOP_TOLERANCE = 5

function done(log: DayLog | undefined, routine: string, pred: (id: string) => boolean): boolean {
  if (!log) return false
  return Object.entries(log.steps).some(([k, v]) => {
    const [r, id] = k.split(':')
    return r === routine && pred(id ?? '') && (v === 'done' || v === 'minimal')
  })
}

function at(date: string, ms: number | undefined): number | undefined {
  return ms === undefined ? undefined : minutesOnPlanDay(date, ms)
}

/** Kernziele des Tages je nach Stufe. Minimal-Versionen zählen als erfüllt. */
export function dayGoals(plan: DayPlan, log: DayLog | undefined, s: Settings): Goal[] {
  if (plan.dayType === 'sick') return []
  const date = plan.date
  const goals: Goal[] = []
  const tol = plan.dayType === 'work' ? s.anchor.wakeToleranceMin : s.anchor.weekendToleranceMin
  const wakeAt = at(date, log?.wakeAt)
  goals.push({ key: 'wake', label: 'Aufgestanden', met: wakeAt !== undefined && Math.abs(wakeAt - plan.wake) <= tol })

  if (plan.leave !== undefined) {
    const leftAt = at(date, log?.leftAt)
    goals.push({ key: 'leave', label: 'Pünktlich los', met: leftAt !== undefined && leftAt <= plan.leave + LEAVE_TOLERANCE })
  }

  const eveningIds = new Set(plan.blocks.find((b) => b.routine === 'evening')?.steps?.map((x) => x.id) ?? [])
  const allEveningDone =
    eveningIds.size > 0 && [...eveningIds].every((id) => ['done', 'minimal'].includes(log?.steps[`evening:${id}`] ?? ''))
  const eveningDoneAt = at(date, log?.eveningRoutineDoneAt)
  goals.push({
    key: 'evening',
    label: 'Abendroutine vor dem Zocken',
    met: allEveningDone || (eveningDoneAt !== undefined && eveningDoneAt <= plan.pcStop),
  })

  const pcOff = at(date, log?.pcOffAt)
  goals.push({ key: 'pcstop', label: 'PC-Stopp eingehalten', met: pcOff !== undefined && pcOff <= plan.pcStop + PCSTOP_TOLERANCE })

  const stage = s.game.stage
  if (stage >= 2) {
    goals.push({ key: 'movement', label: '10 Minuten Bewegung', met: done(log, 'morning', (id) => isMovement(plan, id)) || !!log?.sport })
  }
  if (stage >= 3) {
    if (s.sport.days[weekday(date)] && plan.dayType !== 'vacation') {
      goals.push({ key: 'gym', label: s.sport.kind === 'gym' ? 'Fitnessstudio' : 'Sport', met: sportDone(plan, log, s) })
    }
    if (weekday(date) === s.prepDay) goals.push({ key: 'prepcook', label: 'Vorgekocht', met: !!log?.prepCooked })
    goals.push({ key: 'tidy', label: '10 Minuten aufräumen', met: !!log?.tidyDone || done(log, 'evening', (id) => isTidy(plan, id)) })
  }
  return goals
}

/** Ist das Training Teil der Morgenroutine? Dann zählt der Routine-Schritt als Sport (nicht beim Fitnessstudio). */
export function sportInRoutine(s: Settings): boolean {
  return s.sport.kind !== 'gym' && s.sport.time === 'morning'
}

/** Sport gilt als erledigt: von Hand, über Health Connect oder über den Trainings-Schritt der Morgenroutine. */
export function sportDone(plan: DayPlan, log: DayLog | undefined, s: Settings): boolean {
  return !!log?.sport || (sportInRoutine(s) && done(log, 'morning', (id) => isMovement(plan, id)))
}

function isMovement(plan: DayPlan, id: string) {
  return plan.blocks.some((b) => b.routine === 'morning' && b.steps?.some((x) => x.id === id && x.tag === 'movement'))
}
function isTidy(plan: DayPlan, id: string) {
  return plan.blocks.some((b) => b.routine === 'evening' && b.steps?.some((x) => x.id === id && x.tag === 'tidy'))
}

/** Status eines Tages. `isPast` = Tag ist vorbei (sonst „open“, solange nicht alles erfüllt ist). */
export function dayStatus(plan: DayPlan, log: DayLog | undefined, s: Settings, isPast: boolean): DayStatus {
  if (plan.dayType === 'sick') return 'neutral'
  const goals = dayGoals(plan, log, s)
  if (goals.every((g) => g.met)) return 'success'
  // Bewusst anders entschieden: zählt weder dafür noch dagegen
  if (log?.override.adjusted && isPast) return 'neutral'
  return isPast ? 'missed' : 'open'
}
