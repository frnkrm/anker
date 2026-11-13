import type { NextAction } from '../support'
import type { DayPlan, Settings } from '../types'
import type { GuidancePreferences, GuidanceView } from './types'

/** Bestehender Einstieg in die gemeinsame Nachtansicht, auch nach einer Routine. */
export function guidanceNightVisible(view: GuidanceView, options: GuidancePreferences): boolean {
  return options.enabled && (view.phase === 'NIGHT_LOCK' && (options.bedtimeQr || options.pcLock)
    || view.phase === 'BEDTIME_HARD_CUT' && (options.eveningEscalation || options.bedtimeQr || options.pcLock))
}

/** Nur Begleittext zur bereits gewählten Handlung; keine eigene Reihenfolge oder Wirkung. */
export function transitionHint(action: NextAction, plan: DayPlan, settings: Settings): string | undefined {
  if (action.type === 'pcoff') return 'Speichere deinen aktuellen Stand. Bestätige erst, wenn du den PC selbst ausgeschaltet hast.'
  if (action.type === 'free') return plan.openEnd ? 'Dein Abend bleibt offen. Du entscheidest, wann du wechselst.' : 'Zum Aufhören zuerst den aktuellen Stand speichern. Deine Abendzeit kannst du bewusst ändern.'
  // Diesen bestehenden Nach-PC-Hinweis präzisieren, keine Termin-/Aufgabentexte ersetzen.
  if (action.type === 'info' && !action.block && action.title === 'Runterkommen' && settings.support.windDown.enabled && settings.support.windDown.activity.trim()) return settings.support.windDown.activity.trim()
  return action.sub
}
