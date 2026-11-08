import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { assistanceAllowed, type AssistantTravelMode } from '../../core/assistance'
import { fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { parseRoutePoint, routePointText, routeRequestNeedsOneShot } from '../../core/traffic'
import { acceptRouteProposal, cancelAutomaticRouteRequests, cancelRouteRequest, clearRouteProposal, currentTrafficContext, proposalCurrent, requestRouteEstimate, routeIssue, routeProposal, subscribeRouteProposals } from '../../platform/traffic'
import { useNow } from '../../state/hooks'
import { useApp } from '../../state/store'
import { minuteText } from '../../core/uiText'
import { Button, Checkbox, Choice, DateField, Sheet, Stepper, TextInput, Toggle } from './ui'

const MODES: { value: AssistantTravelMode; label: string }[] = [
  { value: 'driving', label: 'Auto' }, { value: 'transit', label: 'ÖPNV' }, { value: 'cycling', label: 'Rad' }, { value: 'walking', label: 'Zu Fuß' },
]
const moment = (at: number) => new Date(at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** In vorhandenen Wegdetails montieren. Öffnen allein fragt keinen Dienst an. */
export function RouteEstimateCard({ commitmentId }: { commitmentId: string }) {
  const state = useApp()
  const now = useNow(30_000)
  const context = currentTrafficContext(commitmentId)
  const proposal = useSyncExternalStore(subscribeRouteProposals, () => routeProposal(commitmentId), () => undefined)
  const automaticIssue = useSyncExternalStore(subscribeRouteProposals, () => routeIssue(commitmentId), () => undefined)
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [mode, setMode] = useState<AssistantTravelMode>('driving')
  const [at, setAt] = useState('')
  const [timing, setTiming] = useState<'arrival' | 'departure'>('arrival')
  const [formSignature, setFormSignature] = useState('')
  const [oneShot, setOneShot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const controller = useRef<AbortController | undefined>(undefined)
  const pending = useRef(false)
  const allowed = assistanceAllowed(state.local.assistance, 'routes')
  const signature = context?.signature
  useEffect(() => () => { controller.current?.abort() }, [signature])
  useEffect(() => { if (!allowed) setOpen(false) }, [allowed])
  if (!context || context.arrivalAt <= now) return null

  const initialize = () => {
    setOrigin(routePointText(context.origin))
    setDestination(routePointText(context.destination) || context.commitment.address || '')
    setMode(context.commitment.routeMode && context.commitment.routeMode !== 'none' ? context.commitment.routeMode : 'driving')
    setAt(toBerlinDateTimeInput(context.arrivalAt))
    setTiming('arrival'); setOneShot(false); setError(''); setMessage(''); setFormSignature(context.signature)
  }
  const close = () => { controller.current?.abort(); setOpen(false) }
  const originPoint = parseRoutePoint(origin)
  const destinationPoint = parseRoutePoint(destination)
  const needsConsent = !originPoint || !destinationPoint || routeRequestNeedsOneShot(context, originPoint, destinationPoint)
  const formStale = formSignature !== context.signature
  const validProposal = !!proposal && proposalCurrent(proposal, now)
  const delta = validProposal && context.plannedMin !== undefined ? proposal.estimate.durationMin - context.plannedMin : undefined
  const significant = delta !== undefined && Math.abs(delta) >= (state.local.assistance?.routes?.changeThresholdMin ?? 10)
  const fetchEstimate = async () => {
    if (pending.current) return
    const timestamp = fromBerlinDateTimeInput(at)
    if (!originPoint || !destinationPoint) { setError('Gib einen bekannten Start und ein Ziel als Adresse oder vollständige Koordinaten ein. Ein Ortsname allein wird nicht ergänzt.'); return }
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) { setError('Wähle eine gültige zukünftige Reisezeit.'); return }
    if (formStale) { setError('Dein Plan hat sich geändert. Lade zuerst die aktuellen Angaben.'); return }
    if (needsConsent && !oneShot) { setError('Diese Ortsangaben sind noch nicht für diese Anfrage freigegeben.'); return }
    pending.current = true; setBusy(true); setError(''); setMessage('')
    const request = new AbortController(); controller.current = request
    try {
      await requestRouteEstimate(commitmentId, { origin: originPoint, destination: destinationPoint, mode, at: new Date(timestamp).toISOString(), timing, oneShot, expectedSignature: formSignature }, request.signal)
      if (!request.signal.aborted) setOpen(false)
    } catch (reason) {
      if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Die Schätzung ist gerade nicht verfügbar. Deine manuelle Planung bleibt erhalten.')
    } finally { pending.current = false; setBusy(false) }
  }
  return <div className="space-y-3 border-t border-line pt-3">
    <p className="font-medium">Fahrtschätzung</p>
    <p className="text-sm text-muted">{context.plannedMin === undefined ? 'Deine manuelle Fahrzeit ist noch offen.' : `Bisher etwa ${minuteText(context.plannedMin)} aus deiner Planung.`}</p>
    {!allowed ? <Link className="flex min-h-11 items-center text-accent" to="/einstellungen/assistenz">Optionalen Verkehrsdienst einrichten</Link> : <>
      {validProposal && <div className="space-y-2 rounded-xl bg-surface-2 p-3" role="status">
        <p className="text-lg">Vorschlag: etwa {minuteText(proposal.estimate.durationMin)}</p>
        <p className="text-sm text-muted">{proposal.estimate.source} · abgerufen {moment(proposal.estimate.fetchedAt)} · {proposal.request.timing === 'arrival' ? 'Ankunftsziel' : 'Abfahrtszeit'} {moment(Date.parse(proposal.estimate.travelAt))} · {MODES.find((item) => item.value === proposal.estimate.mode)?.label}</p>
        <p className="text-sm text-muted">{proposal.estimate.trafficAware ? 'Zeitabhängige Schätzung für die Autofahrt.' : 'Diese Schätzung verspricht keine aktuellen Stau- oder Störungsdaten.'}</p>
        {proposal.estimate.uncertain && <p className="text-sm text-warm">Die zeitabhängige Schätzung schwankt noch. Prüfe deinen Weg manuell, bevor du dich danach richtest.</p>}
        {significant && <p className="text-sm text-warm">{delta > 0 ? `Etwa ${minuteText(Math.ceil(delta))} länger als bisher geplant. Für deine Ankunft wäre früheres Losgehen sinnvoll.` : `Etwa ${minuteText(Math.ceil(-delta))} kürzer als bisher geplant.`} Termine und Wecker bleiben unverändert.</p>}
        <Button disabled={busy} size="sm" onClick={async () => {
          if (pending.current) return
          pending.current = true; setBusy(true); setError('')
          try { await acceptRouteProposal(proposal); setMessage('Als eigene Fahrzeit übernommen. Eine Weckänderung entscheidest du getrennt.') }
          catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Fahrzeit konnte nicht übernommen werden.') }
          finally { pending.current = false; setBusy(false) }
        }}>Als eigene Fahrzeit übernehmen</Button>
        <Button disabled={busy} size="sm" variant="ghost" onClick={() => clearRouteProposal(commitmentId)}>Vorschlag verwerfen</Button>
      </div>}
      {proposal && !validProposal && <p className="text-sm text-muted">Die frühere Schätzung passt nicht mehr zum aktuellen Stand oder ist älter als 15 Minuten. Deine manuelle Fahrzeit bleibt gültig.</p>}
      {automaticIssue && !validProposal && <p className="text-sm text-muted">{automaticIssue}</p>}
      <Button size="sm" disabled={busy} onClick={() => { initialize(); setOpen(true) }}>Fahrtzeit prüfen</Button>
      <Link className="flex min-h-11 items-center text-sm text-accent" to="/einstellungen/assistenz">Dienst und automatische Checks einstellen</Link>
    </>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    {error && !open && <p role="alert" className="text-sm text-warm">{error}</p>}
    <Sheet open={open} onClose={close} title="Fahrtzeit bewusst prüfen">
      <div className="space-y-4">
        <p className="text-sm text-muted">Google Routes erhält die unten gezeigten Ortsangaben, Reisezeit und Verkehrsmittel über deinen angemeldeten Server. Dabei können Kosten entstehen. Es wird keine Ortung gestartet.</p>
        <label className="block space-y-1"><span>Start ({context.originLabel})</span><TextInput aria-label="Start für die Fahrtschätzung" value={origin} onChange={(event) => { setOrigin(event.target.value); setOneShot(false) }} placeholder="Adresse oder Breite, Länge" /></label>
        <label className="block space-y-1"><span>Ziel ({context.destinationLabel})</span><TextInput aria-label="Ziel für die Fahrtschätzung" value={destination} onChange={(event) => { setDestination(event.target.value); setOneShot(false) }} placeholder="Adresse oder Breite, Länge" /></label>
        <Choice label="Verkehrsmittel für die Schätzung" value={mode} onChange={setMode} options={MODES} />
        <Choice label="Zeitbezug der Fahrtschätzung" value={timing} onChange={setTiming} options={[{ value: 'arrival', label: 'Bis dahin ankommen' }, { value: 'departure', label: 'Dann losfahren' }]} />
        <DateField label="Zeit für die Fahrtschätzung" type="datetime-local" value={at} onChange={setAt} />
        {needsConsent ? <Checkbox checked={oneShot} onChange={setOneShot}>Diese eingegebenen Orte für diese Anfrage freigeben</Checkbox> : <p className="text-sm text-muted">Für diese beiden gespeicherten Orte liegt deine Routenfreigabe vor.</p>}
        {formStale && <div className="space-y-2"><p className="text-warm">Dein Plan hat sich geändert.</p><Button onClick={initialize}>Aktuelle Angaben laden</Button></div>}
        {error && <p role="alert" className="text-warm">{error}</p>}
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void fetchEstimate()}>{busy ? 'Schätzung wird angefragt …' : 'Diese Daten senden und Schätzung anfragen'}</Button>
        {busy && <Button className="w-full" onClick={() => { cancelRouteRequest(commitmentId); controller.current?.abort() }}>Anfrage abbrechen</Button>}
        <p className="text-sm text-muted">Erst dein anschließendes Übernehmen ändert die persönliche Fahrzeit. Harte Termine und Wecker werden dabei nicht verschoben.</p>
      </div>
    </Sheet>
  </div>
}

/** In der gemeinsamen optionalen Assistenz-Einrichtung einfügen. */
export function RouteCheckPreferences() {
  const state = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const consent = state.local.assistance?.routes
  if (!assistanceAllowed(state.local.assistance, 'routes') || !consent) return null
  const save = async (patch: { automatic?: boolean; changeThresholdMin?: number }) => {
    if (busy) return
    if (patch.automatic === false) cancelAutomaticRouteRequests()
    setBusy(true); setError('')
    try { await state.saveLocal((local) => {
      if (!local.assistance?.routes || !assistanceAllowed(local.assistance, 'routes')) return local
      return { ...local, assistance: { ...local.assistance, routes: { ...local.assistance.routes, ...patch } } }
    }) } catch { setError('Die Auswahl konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return <fieldset disabled={busy} className="space-y-3">
    <div className="flex items-center justify-between gap-3"><span>Passende Wege automatisch prüfen</span><Toggle label="Automatische Fahrtschätzungen" checked={consent.automatic === true} onChange={(value) => void save({ automatic: value })} /></div>
    <p className="text-sm text-muted">Nur mit beiden Ortsfreigaben: höchstens ein Versuch je Besuch am Vorabend, morgens und vor der Abfahrt, solange die App aktiv ist. Eine Anfrage kann bis zu drei Anbieteraufrufe brauchen. Die Tagesgrenze deines Servers kann vorher erreicht sein.</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><span>Deutliche Änderung ab Minuten</span><Stepper label="Deutliche Fahrtänderung" min={1} max={120} value={consent.changeThresholdMin ?? 10} onChange={(value) => void save({ changeThresholdMin: value })} /></div>
    <p className="text-sm text-muted">Auch automatische Ergebnisse sind Vorschläge. Deine bestätigte Planung bleibt bis zu deinem Übernehmen unverändert.</p>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </fieldset>
}
