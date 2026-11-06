import { addDays, fmtTime, zonedToUtc } from './time'
import type { DayPlan } from './types'
import type { PcStopCommand } from '../../supabase/functions/_shared/pcStopProtocol'

export { pcPlanDate, pickPcStopCommand, validPcStopCommand, type PcStopCommand } from '../../supabase/functions/_shared/pcStopProtocol'

/** Gleichbleibender gewünschter Auftrag behält seine Revision; Abrufzeit ist kein Planwechsel. */
function revision(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return `pc2:${(hash >>> 0).toString(16)}`
}

export function buildPcStopCommands(plans: readonly Pick<DayPlan, 'date' | 'pcStop' | 'openEnd'>[], planRevision?: string): PcStopCommand[] {
  return plans.map((plan) => {
    const validUntil = new Date(zonedToUtc(addDays(plan.date, 1), 4 * 60)).toISOString()
    const body = plan.openEnd
      ? { mode: 'paused' as const }
      : { mode: 'scheduled' as const, stopAt: new Date(zonedToUtc(plan.date, plan.pcStop)).toISOString(), localTime: fmtTime(plan.pcStop), extended: false }
    return { version: 2, date: plan.date, ...body, validUntil, revision: revision(JSON.stringify([plan.date, body, planRevision])) }
  })
}

export interface PcStopPublication {
  status: 'published' | 'disabled' | 'unconfigured' | 'signed-out' | 'error'
  message: string
}

/** Veröffentlichung bestätigt keinen Empfang und keine spätere Ausführung am PC. */
export function pcStopPublicationText(status: PcStopPublication['status']): string {
  return {
    published: 'Plan bereitgestellt. Ob dein PC ihn übernommen hat, ist nicht bestätigt.',
    disabled: 'Automatischer Abgleich ist aus. Ein vorhandener PC-Auftrag kann weiter gelten.',
    unconfigured: 'Kein Server eingerichtet. Ein vorhandener PC-Auftrag kann weiter gelten.',
    'signed-out': 'Nicht angemeldet. Ein vorhandener PC-Auftrag kann weiter gelten.',
    error: 'Bereitstellen fehlgeschlagen. Ein vorhandener PC-Auftrag kann weiter gelten.',
  }[status]
}
