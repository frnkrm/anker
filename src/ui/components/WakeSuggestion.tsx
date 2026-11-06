import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { buildAlarmConfig } from '../../core/alarm'
import { morningNeed, wakeProposal } from '../../core/sleep'
import { fmtTime } from '../../core/time'
import { isNative } from '../../platform/native'
import { applyWakeChange } from '../../platform/wakeChange'
import { planFor, today, useApp } from '../../state/store'
import { Button, Card } from './ui'

/** Konkrete Vorschau und bewusst bestätigte Ausnahme; Plan und Android-Bestätigung getrennt anzeigen. */
export function WakeSuggestion({ date }: { date: string }) {
  const st = useApp()
  const plan = planFor(date)
  const proposal = wakeProposal(plan, st.settings, Date.now())
  const need = morningNeed(plan, st.settings)
  const override = st.days[date]?.override.wakeOverride
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const apply = async (wake: number | undefined) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try { setMessage((await applyWakeChange(date, wake)).message) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Weckänderung konnte nicht sicher übernommen werden.') }
    finally { pending.current = false; setBusy(false) }
  }
  const confirmed = st.alarmStatus?.ok && st.alarmStatus.configurationKey === JSON.stringify(buildAlarmConfig(st.settings, st.days, today()))
  const outsideDay = need && (need.latestWake < 0 || need.latestWake >= 1440)
  if (!proposal && override === undefined && !need?.uncertain && !outsideDay && !message && !error) return null
  return <Card className="space-y-3">
    <h3 className="font-semibold">Einmalige Aufstehzeit</h3>
    <p className="text-sm text-muted">{new Date(`${date}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' })}{need ? ` · nächster wichtiger Punkt: ${need.label} (${fmtTime(need.readyAt)})` : ''}</p>
    {override !== undefined ? <>
      <p>Für diesen Tag im Plan: <strong>{fmtTime(override)}</strong>. Danach gilt wieder der Standard {fmtTime(st.settings.anchor.wake)}.</p>
      <p className="text-sm text-muted">{!isNative() ? 'Nur im Plan gespeichert; kein Android-Wecker in der Web-Version.' : !st.settings.alarm.enabled ? 'Der Hauptwecker ist ausgeschaltet.' : confirmed ? 'Die aktuelle Konfiguration wurde an Android übertragen. Hörbarkeit und Zustellung sind damit noch nicht geprüft.' : 'Die aktuelle Übernahme durch Android ist noch nicht bestätigt.'}</p>
      <Button disabled={busy} size="sm" onClick={() => void apply(undefined)}>Zurück zu {fmtTime(st.settings.anchor.wake)}</Button>
    </> : outsideDay ? <p className="text-muted">Mit den angegebenen Vorbereitungen liegt die nötige Aufstehzeit außerhalb dieses Morgens. Anker stellt keinen rückwirkenden Wecker. Prüfe den Termin und die Wege, bereite freiwillig etwas vorher vor oder sprich eine Änderung selbst ab.</p> : need?.uncertain ? <p className="text-muted">Ort oder Wegzeit für einen Morgenpunkt ist noch offen. Deshalb schlägt Anker keine vermeintlich sichere spätere Weckzeit vor. Du kannst den Termin bearbeiten.</p> : proposal ? <>
      <p>{proposal.text}</p>
      <p className="text-sm text-muted">Vorschau: {fmtTime(plan.wake)} → {fmtTime(proposal.wake)}, nur an diesem Tag. Dein Wochenstandard, andere Alarmarten und das Einnahmeprotokoll bleiben unberührt.</p>
      <Button disabled={busy} size="sm" onClick={() => void apply(proposal.wake)}>{isNative() ? `Einmalig um ${fmtTime(proposal.wake)} wecken` : `Einmalig ${fmtTime(proposal.wake)} im Plan verwenden`}</Button>
    </> : null}
    {busy && <p role="status" className="text-sm text-muted">{isNative() ? 'Wird gespeichert und mit Android abgeglichen …' : 'Wird im Plan gespeichert …'}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {(error || isNative()) && <Link to="/wecker" className="flex min-h-11 items-center text-sm text-accent">Weckerstatus & Diagnose öffnen</Link>}
  </Card>
}
