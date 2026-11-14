import { useEffect, useState } from 'react'
import { currentSupportView, type NextView } from '../core/support'
import { minutesOnPlanDay } from '../core/time'
import type { DayLog, DayPlan } from '../core/types'
import { emptyLog, planFor, supportInput, today, useApp } from './store'

/** Aktuelle Zeit, aktualisiert alle `ms` Millisekunden. */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    const vis = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [ms])
  return now
}

/** Plan, Log und Plan-Minuten für den aktiven Tag. */
export function useToday(tick = 15_000): { date: string; plan: DayPlan; log: DayLog; m: number; now: number } {
  const now = useNow(tick)
  const settings = useApp((s) => s.settings)
  const days = useApp((s) => s.days)
  const events = useApp((s) => s.events)
  const local = useApp((s) => s.local)
  const date = today()
  const plan = planFor(date, { settings, days, events, local })
  return { date, plan, log: days[date] ?? emptyLog(date), m: minutesOnPlanDay(date, now), now }
}

/** Was gerade dran ist, außerhalb von React gelesen (z. B. beim Speichern eines Gedankens). */
export function nextNow(st = useApp.getState(), now = Date.now()): NextView {
  return currentSupportView(supportInput(st, now), st.local)
}

export function usePlan(date: string): DayPlan {
  const settings = useApp((s) => s.settings)
  const days = useApp((s) => s.days)
  const events = useApp((s) => s.events)
  const local = useApp((s) => s.local)
  return planFor(date, { settings, days, events, local })
}
