import type { PlannedStep, RoutineStep } from '../types'

export function stepMinutes(s: PlannedStep): number {
  return s.useMinimal && s.minimal ? s.minimal.minutes : s.minutes
}

export function totalMinutes(steps: PlannedStep[]): number {
  return steps.reduce((sum, s) => sum + stepMinutes(s), 0)
}

export function minimalMinutes(steps: RoutineStep[]): number {
  return steps.reduce((sum, s) => sum + (s.minimal ? s.minimal.minutes : s.minutes), 0)
}

/**
 * Passt eine Routine in ein Zeitfenster ein. Ist sie zu lang, werden zuerst die Schritte
 * mit der größten Ersparnis auf ihre Minimal-Version umgestellt.
 */
export function fitSteps(steps: RoutineStep[], windowMin: number): { steps: PlannedStep[]; minimal: boolean; fits: boolean } {
  const planned: PlannedStep[] = steps.map((s) => ({ ...s, useMinimal: false }))
  let total = totalMinutes(planned)
  if (total <= windowMin) return { steps: planned, minimal: false, fits: true }

  const bySaving = planned
    .filter((s) => s.minimal && s.minimal.minutes < s.minutes)
    .sort((a, b) => b.minutes - b.minimal!.minutes - (a.minutes - a.minimal!.minutes))
  for (const s of bySaving) {
    s.useMinimal = true
    total = totalMinutes(planned)
    if (total <= windowMin) break
  }
  return { steps: planned, minimal: true, fits: total <= windowMin }
}

/** Alle Schritte als Minimal-Version (Krank-Modus, „Ich hänge fest“). */
export function allMinimal(steps: RoutineStep[]): PlannedStep[] {
  return steps.map((s) => ({ ...s, useMinimal: !!s.minimal }))
}

type Interval = [number, number]

/** Frühester Start ≥ from, an dem `dur` Minuten ohne Überschneidung mit `busy` frei sind. */
export function placeAfter(from: number, dur: number, busy: Interval[]): number {
  let t = from
  const sorted = [...busy].sort((a, b) => a[0] - b[0])
  let moved = true
  while (moved) {
    moved = false
    for (const [s, e] of sorted) {
      if (t < e && t + dur > s) {
        t = e
        moved = true
      }
    }
  }
  return t
}

/** Summe der Minuten, die `busy` im Fenster [from, to) belegt (Überlappungen zusammengeführt). */
export function busyMinutes(from: number, to: number, busy: Interval[]): number {
  const clipped = busy
    .map(([s, e]) => [Math.max(s, from), Math.min(e, to)] as Interval)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  let sum = 0
  let curS = -Infinity
  let curE = -Infinity
  for (const [s, e] of clipped) {
    if (s > curE) {
      if (curE > curS) sum += curE - curS
      curS = s
      curE = e
    } else curE = Math.max(curE, e)
  }
  if (curE > curS) sum += curE - curS
  return sum
}
