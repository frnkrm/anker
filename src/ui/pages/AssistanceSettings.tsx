import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ASSISTANCE_NOTICE_VERSION, assistanceAllowed, type AssistantCapabilities } from '../../core/assistance'
import { AssistanceError, assistantCapabilities, cancelAssistanceRequests } from '../../platform/assistance'
import { supabaseConfigured } from '../../platform/supabase'
import { useApp } from '../../state/store'
import { Button, Card, Page, Section, Toggle } from '../components/ui'

type Purpose = 'ai' | 'routes'
const privacy = 'Diese Freigabe und die Abrufmerker liegen lokal. Auf deinem Server bleiben Tagesbudget-Zähler mit Nutzerkennung, Zweck und Datum für 14 Tage; Aufgaben- und Adressinhalte werden dort nicht als Prompt-Protokoll gespeichert. Die Anbieter verarbeiten die übermittelten Inhalte nach ihren aktuellen Bedingungen.'

export default function AssistanceSettings() {
  const st = useApp()
  const [capabilities, setCapabilities] = useState<AssistantCapabilities>()
  const [acceptedAI, acceptAI] = useState(false)
  const [acceptedRoutes, acceptRoutes] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  const mounted = useRef(false)
  const controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setMessage('')
    controller.current = new AbortController()
    try { await action(controller.current.signal) } catch (reason) {
      if (mounted.current) setError(reason instanceof AssistanceError ? reason.message : 'Die Änderung konnte nicht sicher gespeichert werden. Prüfe den angezeigten Schalterstand und versuche es erneut.')
    } finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  const check = () => run(async (signal) => {
    const result = await assistantCapabilities(signal)
    if (mounted.current) { setCapabilities(result); setMessage('Verbindung geprüft. Dabei wurden keine Aufgaben oder Adressen übertragen und keine Freigaben eingeschaltet.') }
  })
  const change = (purpose: Purpose, enabled: boolean) => run(async (signal) => {
    if (enabled) {
      if (!(purpose === 'ai' ? acceptedAI : acceptedRoutes)) return
      // Vor jeder neuen Freigabe nochmals prüfen: ein alter Check schaltet keinen fehlenden Dienst ein.
      const latest = await assistantCapabilities(signal)
      if (!mounted.current || signal.aborted) return
      setCapabilities(latest)
      if (!latest[purpose].configured) throw new AssistanceError('not-configured')
    } else cancelAssistanceRequests(purpose)
    if (signal.aborted || !mounted.current) return
    await st.saveLocal((local) => ({ ...local, assistance: {
      ...local.assistance,
      [purpose]: { ...local.assistance?.[purpose], enabled, at: Date.now(), version: ASSISTANCE_NOTICE_VERSION,
        ...(purpose === 'routes' ? { automatic: false } : {}) },
    } }))
    if (mounted.current) {
      if (!enabled) { if (purpose === 'ai') acceptAI(false); else acceptRoutes(false) }
      setMessage(enabled ? 'Freigabe gespeichert. Ein Vorschlag wird erst durch deine eigene Anfrage abgerufen.' : 'Freigabe ausgeschaltet. Laufende Anfragen wurden beendet; dein Plan bleibt erhalten.')
    }
  })
  const clear = () => run(async () => {
    cancelAssistanceRequests()
    await st.saveLocal((local) => ({ ...local, assistance: undefined }))
    if (mounted.current) { acceptAI(false); acceptRoutes(false); setMessage('Lokale Freigaben und Abrufmerker gelöscht. Aufgaben, Orte und manuelle Fahrzeiten bleiben erhalten. Server-Budgetzähler laufen nach 14 Tagen aus.') }
  })
  const ai = assistanceAllowed(st.local.assistance, 'ai')
  const routes = assistanceAllowed(st.local.assistance, 'routes')
  return <Page title="Optionale Vorschläge" back="/einstellungen">
    <Card className="space-y-3">
      <p>Lokale Teilschritt-Vorlagen und manuelle Fahrzeiten funktionieren weiterhin ohne diese Dienste. Beide Datenfreigaben sind eine eigene Wahl.</p>
      <p className="text-sm text-muted">Die App nutzt deinen eingerichteten Supabase-Server und dessen Anmeldung. Datensynchronisation muss dafür nicht eingeschaltet sein. Anbieter-Schlüssel gehören ausschließlich auf den Server.</p>
      {!supabaseConfigured && <p role="status" className="text-sm text-warm">Dieser App-Build hat noch keine Backend-Verbindung. Die Dienste können erst nach Einrichtung des Servers und einem erfolgreichen Verbindungscheck freigegeben werden.</p>}
      <Link className="flex min-h-11 items-center text-accent" to="/verbindungen">Anmeldung und Verbindungen öffnen</Link>
      <Button disabled={busy || !supabaseConfigured} onClick={() => void check()}>Verbindung prüfen</Button>
      <p className="text-xs text-muted">Der Check sendet nur deine Anmeldung an deinen Server. Er ruft keine Anbieter auf und überträgt keine Aufgaben oder Adressen.</p>
      {capabilities && <p role="status" className="text-sm">Server: KI {capabilities.ai.configured ? 'eingerichtet' : 'noch nicht eingerichtet'} · Verkehr {capabilities.routes.configured ? 'eingerichtet' : 'noch nicht eingerichtet'}. Tagesgrenzen: {capabilities.dailyLimits.steps} KI-Anfragen und {capabilities.dailyLimits.route} Verkehrsprüfungen. Diese Grenzen sind keine Kostenobergrenze beim Anbieter.</p>}
    </Card>
    <Section title="KI für kleine Schritte">
      <Card className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
        <p className="text-sm">Empfänger: dein Supabase-Server und OpenAI. Übermittelt werden der von dir bearbeitbare Aufgabentext und die Detailtiefe. Beschreibung und nächster Schritt sind je Anfrage freiwillig abgewählt. Vor jedem Senden siehst du die Inhalte und bestätigst sie gesondert; berufliche Angaben prüfst du selbst.</p>
        <p className="text-sm text-muted">Es können Kosten bei OpenAI und deinem Server entstehen. Prüfe vor echter Aktivierung die <a className="text-accent underline" href="https://openai.com/api/pricing/" target="_blank" rel="noreferrer">aktuellen API-Preise</a> und <a className="text-accent underline" href="https://openai.com/policies/business-terms/" target="_blank" rel="noreferrer">Anbieterbedingungen</a>.</p>
        {!ai && <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" checked={acceptedAI} disabled={busy} onChange={(event) => acceptAI(event.target.checked)} /><span>Übertragung an OpenAI und mögliche Anbieter-/Serverkosten für KI-Vorschläge sind für mich in Ordnung.</span></label>}
        <fieldset className="min-w-0" disabled={busy || (!ai && (!acceptedAI || !capabilities?.ai.configured))}><div className="flex flex-wrap items-center justify-between gap-3"><span>KI-Vorschläge erlauben</span><Toggle label="KI-Vorschläge erlauben" checked={ai} onChange={(value) => void change('ai', value)} /></div></fieldset>
      </Card>
    </Section>
    <Section title="Verkehr für Fahrzeiten">
      <Card className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
        <p className="text-sm">Empfänger: dein Supabase-Server und Google Routes. Übermittelt werden die für die gewählte Fahrt ausdrücklich freigegebenen Start-/Zieladressen, Verkehrsmittel und Abfahrtszeit. Aufgaben, Medikamente und Routinentexte werden nicht automatisch angehängt. Keine laufende Standortverfolgung.</p>
        <p className="text-sm text-muted">Anbieter und Server können Kosten verursachen. Prüfe die <a className="text-accent underline" href="https://mapsplatform.google.com/pricing/" target="_blank" rel="noreferrer">aktuellen Maps-Preise</a> und <a className="text-accent underline" href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noreferrer">Google-Maps-Bedingungen</a>. Eine Verkehrsfreigabe aktiviert keine automatischen Abrufe; dafür gibt es eine eigene Wahl bei deiner Fahrt.</p>
        {!routes && <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" checked={acceptedRoutes} disabled={busy} onChange={(event) => acceptRoutes(event.target.checked)} /><span>Übertragung der gewählten Fahrtdaten an Google Routes und mögliche Anbieter-/Serverkosten sind für mich in Ordnung.</span></label>}
        <fieldset className="min-w-0" disabled={busy || (!routes && (!acceptedRoutes || !capabilities?.routes.configured))}><div className="flex flex-wrap items-center justify-between gap-3"><span>Verkehrsvorschläge erlauben</span><Toggle label="Verkehrsvorschläge erlauben" checked={routes} onChange={(value) => void change('routes', value)} /></div></fieldset>
      </Card>
    </Section>
    <Card className="space-y-3">
      <p className="text-sm text-muted">{privacy}</p>
      <p className="text-sm text-muted">Du kannst beide Freigaben jederzeit auch ohne Verbindung ausschalten. Ein Abbruch beendet die weitere Verarbeitung in der App; bereits beim Anbieter eingegangene Inhalte lassen sich dadurch nicht zurückholen.</p>
      <Button disabled={busy} variant="ghost" onClick={() => void clear()}>Freigaben und Abrufmerker löschen</Button>
    </Card>
    {error && <p role="alert" className="text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Page>
}
