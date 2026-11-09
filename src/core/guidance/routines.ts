import type { RoutineStep } from '../types'

/** Legacy/custom routines without a selection keep their steps, never become empty. */
export function zombieRoutineSteps(steps: readonly RoutineStep[], enabled: boolean): RoutineStep[] {
  const essential = enabled ? steps.filter(step => step.isEssentialForZombieMode === true) : []
  return [...(essential.length ? essential : steps)]
}
