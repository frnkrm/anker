import { useEffect, useRef } from 'react'
import { guidancePreferences } from '../../core/guidance'
import { syncGuidanceRuntime } from '../../platform/guidance'
import { useApp } from '../../state/store'
import { useGuidanceView } from '../../state/useGuidanceView'

/** One mounted lifecycle owns foreground synchronization; native services own background work. */
export function GuidanceRuntime() {
  const settings = useApp(state => state.settings)
  const view = useGuidanceView()
  const attemptedZombie = useRef('')
  const preferences = guidancePreferences(settings.guidance)

  useEffect(() => {
    const sync = () => { void syncGuidanceRuntime().catch(() => undefined) }
    const visible = () => { if (document.visibilityState === 'visible') sync() }
    sync()
    const interval = window.setInterval(sync, 1000)
    document.addEventListener('visibilitychange', visible)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', visible) }
  }, [])

  useEffect(() => {
    if (!preferences.enabled || !view.autoZombieDue) { attemptedZombie.current = ''; return }
    const key = `${view.date}:${useApp.getState().local.guidance?.days[view.date]?.morningActivatedAt ?? ''}`
    if (attemptedZombie.current === key) return
    attemptedZombie.current = key
    void useApp.getState().setZombie(view.date, true, 'automatic').catch(() => useApp.getState().showToast('Die kleine Morgenroutine konnte noch nicht gespeichert werden. Du kannst sie im Fokus selbst wählen.'))
  }, [preferences.enabled, view.autoZombieDue, view.date])

  useEffect(() => {
    const theme = !preferences.enabled || !preferences.circadianUi ? undefined
      : ['NIGHT_LOCK', 'ZOMBIE_MODE', 'BEDTIME_HARD_CUT'].includes(view.phase) ? 'night'
        : ['MORNING_PENDING', 'MORNING_ACTIVE', 'MORNING_COMPLETED', 'ALARM_RINGING'].includes(view.phase) ? 'morning'
          : ['EVENING_WIND_DOWN', 'WIND_DOWN_T30', 'BRAIN_DUMP_T10'].includes(view.phase) ? 'evening' : undefined
    const root = document.documentElement
    if (theme) root.dataset.guidanceTheme = theme
    else delete root.dataset.guidanceTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#000000' : theme === 'morning' ? '#071c23' : theme === 'evening' ? '#1b1510' : settings.appearance.dark ? '#0f1115' : '#f6f5f1')
    return () => { delete root.dataset.guidanceTheme }
  }, [preferences.enabled, preferences.circadianUi, view.phase, settings.appearance.dark])

  return null
}
