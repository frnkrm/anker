import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { checkpointPulse, elapsedMs, pulseMark, remainingMs, type CountdownState, type FocusSession } from '../core/focus'
import { inQuietHours } from '../core/support'
import { minutesOnPlanDay } from '../core/time'
import { AnkerNative, isNative, safe } from '../platform/native'
import { mirrorReminderFocus } from '../platform/notifications'
import { today, useApp } from './store'

/** Die Deadline läuft ohne Hintergrund-Ticks weiter; sichtbar wird nur die Anzeige aktualisiert. */
export function useFocusClock(timer?: CountdownState, active = true): number {
  const [now, setNow] = useState(Date.now())
  const running = active && timer?.status === 'running'
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    const refresh = () => {
      if (interval !== undefined) clearInterval(interval)
      interval = undefined
      if (!active) return
      setNow(Date.now())
      if (running && document.visibilityState === 'visible') interval = setInterval(() => setNow(Date.now()), 1000)
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => {
      if (interval !== undefined) clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [active, running])
  return now
}

/** Gemeinsame Pulse und E02-Ruhespiegelung; niemals Abschluss oder Arbeitszeit daraus ableiten. */
export function useFocusPulse(session?: FocusSession, suppliedNow?: number): void {
  // Bei einer Router-Transition kann die URL bereits wechseln, bevor diese Ansicht unmountet.
  // An den gerenderten Fokuspfad binden, nicht an eine erst später gelesene Browseradresse.
  const sourcePath = useLocation().pathname
  const ownNow = useFocusClock(suppliedNow === undefined ? session?.timer : undefined, suppliedNow === undefined)
  const now = suppliedNow ?? ownNow
  const config = useApp((state) => state.settings.focus)
  const quiet = useApp((state) => state.settings.reminders)
  const last = useRef({ id: '', elapsed: 0 })
  const liveSession = useRef<string | undefined>(undefined)
  const until = session?.timer.status === 'running' && remainingMs(session.timer, now) > 0 ? session.timer.deadlineAt : 0

  useEffect(() => {
    liveSession.current = session?.id
    return () => { liveSession.current = undefined }
  }, [session?.id])

  useEffect(() => {
    mirrorReminderFocus(until)
    return () => mirrorReminderFocus(0)
  }, [until])

  useEffect(() => {
    const skipHiddenTime = () => {
      const current = useApp.getState().local.focus
      if (current) last.current = { id: current.id, elapsed: elapsedMs(current.timer, Date.now()) }
    }
    document.addEventListener('visibilitychange', skipHiddenTime)
    return () => document.removeEventListener('visibilitychange', skipHiddenTime)
  }, [])

  useEffect(() => {
    if (!session) { last.current = { id: '', elapsed: 0 }; return }
    const elapsed = elapsedMs(session.timer, now)
    if (last.current.id !== session.id) {
      last.current = { id: session.id, elapsed }
      return // Wiederöffnen holt keine früheren Signale nach.
    }
    const previous = last.current.elapsed
    last.current.elapsed = elapsed
    const blocked = window.location.pathname !== sourcePath || document.visibilityState !== 'visible' || inQuietHours(minutesOnPlanDay(today(), now), useApp.getState().settings)
    const mark = pulseMark(session.timer, config, now, previous, blocked)
    if (mark === undefined || !isNative()) return
    const sessionId = session.id
    void safe(async () => {
      await useApp.getState().updateFocus(sessionId, (current) => ({ ...current, timer: checkpointPulse(current.timer, mark) }))
      if (liveSession.current !== sessionId || window.location.pathname !== sourcePath) return
      const alarm = await AnkerNative.getAlarmState()
      const state = useApp.getState()
      const current = state.local.focus
      const at = Date.now()
      if (liveSession.current !== sessionId || window.location.pathname !== sourcePath || alarm.ringing || document.visibilityState !== 'visible' || state.settings.focus.pulse === 'off'
        || current?.id !== sessionId || current.timer.status !== 'running' || remainingMs(current.timer, at) === 0
        || inQuietHours(minutesOnPlanDay(today(), at), state.settings)) return
      await AnkerNative.vibratePulse({ strength: state.settings.focus.pulse === 'strong' ? 'strong' : 'gentle' })
    }, undefined)
  }, [session, now, config, quiet, sourcePath])
}
