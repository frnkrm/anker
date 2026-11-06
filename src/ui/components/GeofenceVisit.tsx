import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { geofencePlace, removeGeofenceChoice, selectGeofenceVisit, type GeofenceSuggestion } from '../../core/geofences'
import { answerGeofenceSuggestion, refreshGeofences, requestGeofencePermission } from '../../platform/geofences'
import { isNative } from '../../platform/native'
import { useGeofenceState } from '../../state/useGeofences'
import { useApp } from '../../state/store'
import { Button, Stepper } from './ui'

const issues: Record<string, string> = {
  'foreground-permission-required': 'Für den Standorthinweis fehlt noch der genaue Standort.',
  'background-permission-required': 'Für den Hinweis bei geschlossener App fehlt noch die separate Hintergrundfreigabe.',
  'permission-required': 'Die Standortfreigabe wurde geändert. Manuelle Ankunft funktioniert weiter.',
  'location-disabled': 'Der Android-Standort ist ausgeschaltet.',
  'location-service-unavailable': 'Die benötigten Google Play Dienste sind gerade nicht verfügbar.',
  'storage-unavailable': 'Die Standortauswahl konnte auf Android nicht sicher gespeichert werden.',
  'removal-unconfirmed': 'Android hat das Entfernen noch nicht bestätigt. Bitte Anker erneut öffnen.',
  'registration-unconfirmed': 'Android hat den Standorthinweis noch nicht bestätigt. Manuelle Ankunft funktioniert weiter.',
  'unlock-required': 'Bitte entsperre dein Handy für den Standortabgleich.',
  'native-unavailable': 'Der Standortabgleich ist gerade nicht erreichbar. Manuelle Ankunft funktioniert weiter.',
  'invalid-snapshot': 'Die Auswahl ist nicht mehr gültig. Bitte wähle den Besuch erneut.',
}

function Suggestion({ suggestion }: { suggestion: GeofenceSuggestion }) {
  const commitment = useApp((state) => state.local.commitments.find((item) => item.id === suggestion.visitId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  if (!commitment) return null
  const answer = async (arrived: boolean) => {
    if (active.current) return
    active.current = true; setBusy(true); setError('')
    try {
      if (!await answerGeofenceSuggestion(suggestion, arrived)) setError('Dieser Hinweis ist inzwischen veraltet. Deine Ankunft kannst du weiterhin selbst bestätigen.')
    } catch { setError('Deine Antwort konnte nicht gespeichert werden. Bitte versuche es erneut.') }
    finally { active.current = false; setBusy(false) }
  }
  return <div className="space-y-2 rounded-xl border border-line p-3" role="group" aria-label={`Ankunftshinweis ${commitment.label}`}>
    <p>Du scheinst bei „{commitment.label}“ angekommen zu sein. Stimmt das?</p>
    <p className="text-sm text-muted">Das ist ein ungefährer Standorthinweis. Erst dein Ja speichert die Ankunft; Arbeitszeit und Medikamente bestätigst du selbst.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => void answer(true)}>Ja, angekommen</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void answer(false)}>Stimmt nicht</Button>
    </div>
    {error && <p role="status" className="text-sm text-warm">{error}</p>}
  </div>
}

/** Nur Vorschläge innerhalb der App; niemals eine Benachrichtigung mit Besuchsdaten. */
export function GeofenceSuggestions() {
  const { suggestions, error } = useGeofenceState()
  const removal = error === 'removal-unconfirmed'
  return suggestions.length || removal ? <section aria-label="Optionale Ankunftshinweise" className="space-y-2">
    {removal && <div className="space-y-2 rounded-xl border border-line p-3"><p role="status" className="text-sm text-warm">{issues['removal-unconfirmed']} Deine ausgeschaltete Auswahl erzeugt in Anker keine neuen Ankunftsvorschläge.</p><Button size="sm" onClick={() => void refreshGeofences()}>Entfernen erneut prüfen</Button></div>}
    {suggestions.map((suggestion) => <Suggestion key={suggestion.id} suggestion={suggestion} />)}
  </section> : null
}

/** Im bestehenden Termindetail einhängen. Die Grundfunktion Ankunft bleibt davon unabhängig. */
export function GeofenceVisit({ commitmentId }: { commitmentId: string }) {
  const local = useApp((state) => state.local)
  const commitment = local.commitments.find((item) => item.id === commitmentId)
  const choice = local.extras?.geofences?.visits[commitmentId]
  const [radius, setRadius] = useState(choice?.radiusM ?? 150)
  const [minutes, setMinutes] = useState((choice?.dwellMs ?? 120_000) / 60_000)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const state = useGeofenceState()
  if (!commitment) return null
  const place = geofencePlace(commitment, local.places)
  const selected = !!choice && local.extras?.geofences?.enabled === true
  const bound = !!place && choice?.placeId === place.id && choice?.latitude === place.latitude && choice?.longitude === place.longitude
  const eligible = commitment.status !== 'cancelled' && commitment.arrivedAt === undefined && commitment.backAt === undefined
    && commitment.locationKind !== 'remote' && commitment.locationKind !== 'home' && commitment.routeMode !== 'none'
  const proposal = state.suggestions.find((item) => item.visitId === commitmentId)
  const run = async (fn: () => Promise<void>) => {
    if (active.current) return
    active.current = true; setBusy(true); setError('')
    try { await fn() } catch { setError('Die Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.') }
    finally { active.current = false; setBusy(false) }
  }
  const select = async () => {
    if (!consent || !place) return
    // Zustimmung bezieht sich auf genau den beim Antippen sichtbaren Ort, nicht einen späteren Storewert.
    const target = { id: place.id, latitude: place.latitude, longitude: place.longitude }
    let saved = false
    await useApp.getState().saveLocal((latest) => {
      const next = selectGeofenceVisit(latest, commitmentId, { radiusM: radius, dwellMs: minutes * 60_000, consentedAt: Date.now(), placeId: target.id, latitude: target.latitude, longitude: target.longitude }, Date.now())
      if (!next) return latest
      saved = true
      return next
    })
    if (!saved) { setError('Der Besuch wurde geändert, liegt zu weit in der Zukunft oder die Auswahl ist voll. Bitte prüfe den Termin.'); return }
    setConsent(false)
    await refreshGeofences()
  }
  const remove = async () => {
    await useApp.getState().saveLocal((latest) => removeGeofenceChoice(latest, commitmentId))
    await refreshGeofences()
  }
  return <details className="space-y-3 rounded-xl border border-line p-3">
    <summary className="min-h-11 cursor-pointer content-center">Optionaler Standorthinweis{selected ? ' · ausgewählt' : ''}</summary>
    <p className="text-sm text-muted">Für diesen Besuch kann Android einen möglichen Aufenthalt erkennen. Der Hinweis kann verspätet oder ungenau sein. Deine Ankunft bestätigst du selbst; Arbeitszeit und Medikamente werden dadurch nicht gebucht.</p>
    {!isNative() ? <p className="text-sm text-muted">Standorthinweise gibt es nur in der Android-App. Manuelle Ankunft bleibt verfügbar.</p> : <>
      <p className="text-sm text-muted">Android und Google Play Dienste verarbeiten dafür die ausgewählten Koordinaten. Auswahl und Vorschläge bleiben lokale Appdaten. Anker erstellt keine fortlaufende Standortbiografie. Du kannst die Auswahl hier wieder entfernen.</p>
      {selected && !bound && <p role="status" className="text-sm text-warm">Der Zielort wurde geändert. Die alte Zustimmung aktiviert diesen Ort nicht. Bitte wähle ihn bei Bedarf erneut.</p>}
      {!place && <p className="text-sm text-muted">Für den gewählten Ort fehlen genaue Koordinaten. Du kannst sie unter <Link to="/orte" className="underline">Orte</Link> eintragen. Ein Name oder eine Adresse allein wird nicht geortet.</p>}
      {!eligible && <p className="text-sm text-muted">Für einen abgesagten, beendeten oder bereits angekommenen Besuch ist kein Standorthinweis aktiv.</p>}
      {place && eligible && <>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Umkreis</span><Stepper label={`Umkreis ${commitment.label}`} value={radius} onChange={setRadius} min={100} max={1000} step={50} unit="m" /></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Mindestaufenthalt</span><Stepper label={`Mindestaufenthalt ${commitment.label}`} value={minutes} onChange={setMinutes} min={1} max={15} step={1} /></div>
        <label className="flex min-h-11 items-start gap-3 py-2"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span className="text-sm">Ich möchte für diesen Besuch bei „{place.label}“ den Standorthinweis mit Android und Google Play Diensten verwenden.</span></label>
        <Button size="sm" disabled={!consent || busy} onClick={() => void run(select)}>{selected ? 'Auswahl erneut bestätigen' : 'Für diesen Besuch auswählen'}</Button>
      </>}
      {selected && <>
        <p className="text-sm text-muted">{state.updating ? 'Android gleicht die Auswahl gerade ab.' : state.registered > 0 ? `Android bestätigt insgesamt ${state.registered} aktive Standorthinweise.` : 'Auswahl gespeichert. Ein aktiver Standorthinweis ist derzeit noch nicht bestätigt.'}</p>
        {bound && !state.fineGranted && <Button size="sm" disabled={busy} onClick={() => void run(() => requestGeofencePermission('foreground'))}>Genauen Standort freigeben</Button>}
        {bound && state.fineGranted && !state.backgroundGranted && <>
          <p className="text-sm text-muted">Für eine Erkennung bei geschlossener App kannst du anschließend separat „Immer zulassen“ in Android wählen. Das ist freiwillig.</p>
          <Button size="sm" disabled={busy} onClick={() => void run(() => requestGeofencePermission('background'))}>Hintergrundstandort separat freigeben</Button>
        </>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(remove)}>Standorthinweis entfernen</Button>
      </>}
      {(selected || state.error === 'removal-unconfirmed') && state.error && <p role="status" className="text-sm text-warm">{issues[state.error] ?? issues['native-unavailable']}</p>}
    </>}
    {proposal && <Suggestion suggestion={proposal} />}
    {error && <p role="status" className="text-sm text-warm">{error}</p>}
  </details>
}
