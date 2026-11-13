import { focusTargetKey, isFocusSession, sameFocusTarget, type FocusTarget } from './focus'
import { recoveryPreview } from './recovery'

export type CompanionInput = Parameters<typeof recoveryPreview>[0]
export interface CompanionView { key: string; status: 'running' | 'paused' | 'expired' }

/** Nur der aktuelle sichtbare Fokus; weder alte Merker noch Archivtimer übernehmen. */
export function focusCompanion(input: CompanionInput, target: FocusTarget): CompanionView | undefined {
  const current = input.local.focus
  if (!isFocusSession(current) || !sameFocusTarget(current.target, target)) return undefined
  const view = recoveryPreview({ ...input, local: { focus: current, guidance: input.local.guidance } })
  if (!view?.focus || view.focus !== current || view.timer === 'none') return undefined
  const timer = current.timer
  return {
    key: JSON.stringify([current.id, focusTargetKey(target), view.timer, timer.startedAt,
      timer.status === 'running' ? timer.deadlineAt : timer.pausedAt]),
    status: view.timer,
  }
}
