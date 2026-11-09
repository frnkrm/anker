import { deriveGuidance, guidancePlanDate } from '../core/guidance'
import { useNow } from './hooks'
import { emptyLog, planFor, today, useApp } from './store'

/** The guidance view reads the existing plan; it never keeps a second clock or schedule. */
export function useGuidanceView() {
  const now = useNow(1000)
  const settings = useApp(state => state.settings)
  const local = useApp(state => state.local)
  const days = useApp(state => state.days)
  const events = useApp(state => state.events)
  const date = guidancePlanDate(local, today(), now)
  const plan = planFor(date, { settings, days, events, local })
  const log = days[date] ?? emptyLog(date)
  return deriveGuidance({ plan, log, local, settings, nowMs: now })
}
