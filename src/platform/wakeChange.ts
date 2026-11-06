import { buildAlarmConfig } from '../core/alarm'
import { fmtTime, zonedToUtc } from '../core/time'
import { today, useApp } from '../state/store'
import { syncAlarm } from './alarm'
import { isNative } from './native'

export interface WakeChangeResult { kind: 'native' | 'plan'; message: string }
const revisions = new Map<string, number>()
let serial = 0

/** Bewusste Tagesausnahme, danach Abgleich über den bestehenden Alarmbesitzer. Keine neue Planung. */
export async function applyWakeChange(date: string, wake: number | undefined): Promise<WakeChangeResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
    || (wake !== undefined && (!Number.isInteger(wake) || wake < 0 || wake >= 1440))) throw new Error('Datum oder Weckzeit ist ungültig.')
  if (wake !== undefined && zonedToUtc(date, wake) <= Date.now()) throw new Error('Diese Uhrzeit liegt bereits zurück. Es wurde kein rückwirkender Wecker gestellt.')
  const revision = ++serial
  revisions.set(date, revision)
  try {
    const before = useApp.getState().days[date]
    const oldWake = before?.override.wakeOverride
    const label = wake === undefined ? 'Einmalige Weckzeit zurückgenommen' : `Wecker ${fmtTime(wake)} nur an diesem Tag`
    await useApp.getState().adjustDay(date, label, (log) => {
      const override = { ...log.override }
      if (wake === undefined) delete override.wakeOverride
      else override.wakeOverride = wake
      return { ...log, override }
    })
    if (!isNative()) return { kind: 'plan', message: 'Im Plan gespeichert. Die Web-Version stellt keinen Android-Wecker.' }
    await syncAlarm()
    const current = useApp.getState()
    const key = JSON.stringify(buildAlarmConfig(current.settings, current.days, today()))
    if (revisions.get(date) !== revision || current.days[date]?.override.wakeOverride !== wake) return { kind: 'plan', message: 'Eine neuere Entscheidung gilt. Prüfe den aktuellen Weckerstatus.' }
    if (current.alarmStatus?.ok && current.alarmStatus.configurationKey === key) {
      return current.settings.alarm.enabled
        ? { kind: 'native', message: 'Die aktuelle Konfiguration wurde von Android angenommen. Die tatsächliche Zustellung bleibt am Handy zu prüfen.' }
        : { kind: 'plan', message: 'Die Tageszeit ist gespeichert. Der Hauptwecker ist weiterhin ausgeschaltet.' }
    }
    const failure = current.alarmStatus?.message || 'Android hat die aktuelle Weckerplanung nicht bestätigt.'
    // Nur unsere noch unveränderte Ausnahme zurücknehmen. Neuere Tagesentscheidungen bleiben erhalten.
    await current.updateDay(date, (log) => {
      if (revisions.get(date) !== revision || log.override.wakeOverride !== wake) return log
      const override = { ...log.override }
      if (oldWake === undefined) delete override.wakeOverride
      else override.wakeOverride = oldWake
      return { ...log, override, changes: [...(log.changes ?? []), 'Weckänderung von Android nicht bestätigt; vorherige Planzeit erhalten'] }
    })
    await syncAlarm()
    throw new Error(`${failure} Die vorherige Planzeit bleibt erhalten. Öffne die Weckerdiagnose.`)
  } finally {
    if (revisions.get(date) === revision) revisions.delete(date)
  }
}
