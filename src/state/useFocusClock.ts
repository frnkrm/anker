import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { extraSettings } from '../core/extras'
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
  const spoken = useApp((state) => extraSettings(state.settings.extras).spokenCues)
  const last = useRef({ id: '', elapsed: 0 })
  const liveSession = useRef<string | undefined>(undefined)
  const until = session?.timer.status === 'running' && remainingMs(session.timer, now) > 0 ? session.timer.deadlineAt : 0

  useEffect(() => {
    liveSession.current = session?.id
    return () => { liveSession.current = undefined; if (isNative()) void safe(() => AnkerNative.stopSpeaking(), undefined) }
  }, [session?.id])

  useEffect(() => {
    if ((!spoken || session?.timer.status !== 'running') && isNative()) void safe(() => AnkerNative.stopSpeaking(), undefined)
  }, [spoken, session?.timer.status])

  useEffect(() => {
    mirrorReminderFocus(until)
    return () => mirrorReminderFocus(0)
  }, [until])

  useEffect(() => {
    const skipHiddenTime = () => {
      if (document.visibilityState !== 'visible' && isNative()) void safe(() => AnkerNative.stopSpeaking(), undefined)
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
    const mark = pulseMark(session.timer, spoken && config.pulse === 'off' ? { ...config, pulse: 'gentle' } : config, now, previous, blocked)
    if (mark === undefined || !isNative()) return
    const sessionId = session.id
    void safe(async () => {
      await useApp.getState().updateFocus(sessionId, (current) => ({ ...current, timer: checkpointPulse(current.timer, mark) }))
      if (liveSession.current !== sessionId || window.location.pathname !== sourcePath) return
      const alarm = await AnkerNative.getAlarmState()
      const state = useApp.getState()
      const current = state.local.focus
      const at = Date.now()
      if (liveSession.current !== sessionId || window.location.pathname !== sourcePath || alarm.ringing || document.visibilityState !== 'visible' || (state.settings.focus.pulse === 'off' && !extraSettings(state.settings.extras).spokenCues)
        || current?.id !== sessionId || current.timer.status !== 'running' || remainingMs(current.timer, at) === 0
        || inQuietHours(minutesOnPlanDay(today(), at), state.settings)) return
      if (state.settings.focus.pulse !== 'off') await safe(() => AnkerNative.vibratePulse({ strength: state.settings.focus.pulse === 'strong' ? 'strong' : 'gentle' }), undefined)
      const latest = useApp.getState()
      if (liveSession.current !== sessionId || window.location.pathname !== sourcePath || !extraSettings(latest.settings.extras).spokenCues
        || latest.local.focus?.id !== sessionId || latest.local.focus.timer.status !== 'running' || document.visibilityState !== 'visible'
        || inQuietHours(minutesOnPlanDay(today(), Date.now()), latest.settings)) return
      const minutes = Math.ceil(remainingMs(latest.local.focus.timer, Date.now()) / 60_000)
      if (minutes > 0) await AnkerNative.speakCue({ text: `Noch etwa ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} in deinem Zeitfenster.` })
    }, undefined)
  }, [session, now, config, quiet, sourcePath, spoken])
}
