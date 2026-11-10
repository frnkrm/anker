import { useState } from 'react'
import { Link } from 'react-router'
import { BEDTIME_PROMPT_TEXT, BedtimeNative } from '../../platform/bedtimePrompt'
import { Button, Card } from './ui'
import { useBedtimeSession } from './BedtimeSession'

const time = (at: number) => new Date(at).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
const reasons: Record<string, string> = {
  'screen-off': 'Der Bildschirm wurde ausgeschaltet. Dieser Schlafhinweis wurde beendet.',
  locked: 'Das Handy war gesperrt. Dieser Schlafhinweis wurde ausgelassen.',
  'permission-revoked': 'Die Android-Freigabe zum Einblenden ist nicht mehr vorhanden. Dieser Schlafhinweis wurde beendet.',
  expired: 'Der vorgesehene Zeitpunkt ist verstrichen. Dieser Schlafhinweis wird nicht nachgeholt.',
  restart: 'Nach dem Neustart wird dieser Schlafhinweis nicht nachgeholt.',
  updated: 'Nach dem App-Update wird dieser Schlafhinweis nicht nachgeholt.',
  'alarm-active': 'Der Wecker hat Vorrang. Dieser Schlafhinweis wurde ausgelassen.',
  interrupted: 'Dieser Schlafhinweis wurde unterbrochen.',
  'schedule-failed': 'Android konnte diesen Schlafhinweis nicht vormerken.',
  'overlay-failed': 'Android konnte diesen Schlafhinweis nicht über anderen Apps anzeigen.',
  'storage-failed': 'Dieser Schlafhinweis konnte nicht sicher vorbereitet werden.',
}

/** Ein bewusster Start für diese Nacht; Android besitzt den flüchtigen Sitzungszustand. */
export function BedtimePrompt({ available, delayMinutes, nowMs, enabled = true, followUpsEnabled = false, integrated = false, settingsOnly = false, onBed }: { available: boolean; delayMinutes: number; nowMs: number; enabled?: boolean; followUpsEnabled?: boolean; integrated?: boolean; settingsOnly?: boolean; onBed?: () => Promise<void> }) {
  const { supported, state, busy, error, setError, foreground, run, refresh } = useBedtimeSession()
  const [settingsOpened, setSettingsOpened] = useState(false)
  const waiting = state?.phase === 'waiting'
  const shown = state?.phase === 'shown'
  const quiet = state?.phase === 'quiet'
  const chosen = enabled || followUpsEnabled
  const startOptions = { delayMinutes, ...(followUpsEnabled ? { followUps: true, ...(!enabled || !state?.overlayPermission ? { quietOnly: true } : {}) } : {}) }
  const mayStart = followUpsEnabled || state?.overlayPermission === true
  const foregroundMessage = state?.foregroundStatus === 'unconfirmed' || state?.foregroundStatus === 'failed'
    ? 'Android hat den Wechsel zu Anker nicht bestätigt. Öffne Anker bei Bedarf selbst. Eine Spiele- oder Systemeinblendung kann darüber liegen; den Spiel-Touchschutz löst du wie gewohnt am Handy.'
    : state?.foregroundStatus === 'requested' ? 'Das Öffnen von Anker wurde angefordert. Eine Rückmeldung zum Vordergrund steht noch aus.' : undefined
  const finished = !!state?.sessionId && (state.phase === 'skipped' || state.phase === 'error')
  const validDelay = Number.isInteger(delayMinutes) && delayMinutes >= 0 && delayMinutes <= 60
  const acknowledge = () => {
    if (!state?.sessionId || !foreground.current || document.visibilityState !== 'visible') return
    void run(() => BedtimeNative.ackBedtimePrompt({ sessionId: state.sessionId! }))
  }
  const markBed = () => run(async () => {
    await onBed?.()
    if (chosen && supported && !waiting && !shown && !quiet) {
      if (!mayStart) setError('Für den Schlafhinweis fehlt noch die Freigabe. Du findest sie unter „Heute anpassen“.')
      else if (!validDelay) setError('Prüfe die Einschlafzeit unter Schlaf & Anker.')
      else { await BedtimeNative.startBedtimePrompt(startOptions); await refresh.current?.(true) }
    }
  }, { allowWeb: true, refresh: false, failure: 'Die Auswahl konnte nicht sicher übernommen werden. Bitte versuche es erneut.' })

  if (!available && !waiting && !shown && !quiet && !finished) return null

  if (integrated) return <>
    <Button variant="primary" size="xl" className="w-full" disabled={busy} onClick={() => void markBed()}>Ich liege im Bett</Button>
    {chosen && !supported && <p className="text-sm text-muted">Im Browser wird kein Schlafhinweis gestartet.</p>}
    {chosen && waiting && <p role="status" className="text-sm text-muted">Stummer Schlafhinweis vorgemerkt{state?.dueAt ? ` · ${time(state.dueAt)}` : ''}.</p>}
    {shown && <p role="status" className="text-sm text-muted">{BEDTIME_PROMPT_TEXT}</p>}
    {shown && foregroundMessage && <p role="status" className="text-sm text-muted">{foregroundMessage}</p>}
    {error && <p role="alert" className="text-sm text-muted">{error}</p>}
  </>

  return <Card className="min-w-0 space-y-3">
    <h2 className="break-words font-semibold">Stummer Schlafhinweis</h2>
    {!chosen && !waiting && !shown && !quiet && !finished ? <p className="text-sm text-muted">Der Schlafhinweis ist aus. Du kannst ihn unter <Link className="underline" to="/einstellungen/schlaf">Schlaf & Anker</Link> einschalten.</p> : !supported ? <p className="text-sm text-muted">Der Hinweis über anderen Apps ist nur in der Android-App verfügbar. Im Browser wird kein Schlafhinweis gestartet.</p> : <>
      {quiet ? <p role="status" className="text-sm text-muted">Deine stille Abendrunde ist auf Jetzt erreichbar. Dort kannst du fünf Minuten Pause oder Ruhe für heute wählen.</p> : shown ? <div role="status" className="space-y-3">
        <p className="break-words">{BEDTIME_PROMPT_TEXT}</p>
        {foregroundMessage && <p className="text-sm text-muted">{foregroundMessage}</p>}
        <Button disabled={busy || !state.sessionId} className="w-full" onClick={acknowledge}>Hinweis beenden</Button>
      </div> : waiting ? <>
        <p role="status" className="text-sm text-muted">Schlafhinweis für diesen Start vorgemerkt.{state.dueAt !== undefined && Number.isFinite(state.dueAt) ? ` Vorgesehener Zeitpunkt: ${time(state.dueAt)}.${state.dueAt <= nowMs ? ' Der vorgesehene Zeitpunkt ist erreicht.' : ''}` : ''}</p>
        <p className="text-sm text-muted">Der Hinweis erscheint nur, wenn der Bildschirm zum vorgesehenen Zeitpunkt eingeschaltet und das Handy entsperrt ist. Sonst entfällt er und wird später nicht nachgeholt.</p>
        {!state.exact && <p className="text-sm text-muted">Android kann den vorgesehenen Zeitpunkt verzögern.</p>}
        <Button disabled={busy} className="w-full" onClick={() => void run(() => BedtimeNative.stopBedtimePrompt({ sessionId: state.sessionId }))}>Schlafhinweis abbrechen</Button>
      </> : finished ? <>
        <p role={state.phase === 'error' ? 'alert' : 'status'} className="text-sm text-muted">{reasons[state.reason ?? ''] ?? 'Dieser Schlafhinweis wurde beendet. Er wird nicht von selbst erneut gestartet.'}</p>
        <Button disabled={busy} className="w-full" onClick={() => void run(() => BedtimeNative.stopBedtimePrompt({ sessionId: state.sessionId }))}>Status schließen</Button>
      </> : <>
        <p className="text-sm text-muted">{delayMinutes === 0 ? 'Deine Einschlafzeit ist auf 0 Minuten eingestellt. Der Hinweis kann direkt erscheinen.' : `Nach deiner eingestellten Einschlafzeit (${delayMinutes} min) ist ein stummer Hinweis vorgesehen.`} Er erscheint nur bei eingeschaltetem, entsperrtem Bildschirm. Android kann die Anzeige begrenzen.</p>
        {!validDelay && <p role="alert" className="text-sm text-warm">Prüfe deine Einschlafzeit unter Einstellungen → Schlaf. Möglich sind 0 bis 60 Minuten.</p>}
        {state ? mayStart ? settingsOnly ? <p className="text-sm text-muted">Bereit. „Ich liege im Bett“ startet den Hinweis nach deiner Einschlafzeit.</p> : <Button disabled={busy || !validDelay} className="w-full" onClick={() => void run(() => BedtimeNative.startBedtimePrompt(startOptions))}>{followUpsEnabled && !enabled ? 'Leise Abendrunde starten' : 'Stummen Schlafhinweis starten'}</Button>
          : <>
            <p className="text-sm text-muted">Dafür braucht Anker die Android-Freigabe „Über anderen Apps einblenden“. Die Freigabe allein startet keinen Hinweis.</p>
            <Button disabled={busy} className="w-full" onClick={() => void run(async () => { await BedtimeNative.openOverlayPermissionSettings(); setSettingsOpened(true) })}>Android-Freigabe einrichten</Button>
          </> : !error && <p role="status" className="text-sm text-muted">Android-Status wird geprüft …</p>}
      </>}
      {enabled && followUpsEnabled && state && !state.overlayPermission && !waiting && !shown && !quiet && <div className="space-y-2">
        <p className="text-sm text-muted">Der getrennte einmalige Hinweis über anderen Apps braucht noch die Android-Freigabe. Die leisen Folgehinweise funktionieren unabhängig davon.</p>
        <Button disabled={busy} className="w-full" onClick={() => void run(async () => { await BedtimeNative.openOverlayPermissionSettings(); setSettingsOpened(true) })}>Android-Freigabe einrichten</Button>
      </div>}
      {settingsOpened && !waiting && !shown && !quiet && <p role="status" className="text-sm text-muted">Erlaube das Einblenden in Android, wenn du es möchtest. Wenn du zurückkommst, startest du den Schlafhinweis anschließend selbst.</p>}
      {error && <div className="space-y-2"><p role="alert" className="text-sm text-warm">{error}</p><Button disabled={busy} onClick={() => void refresh.current?.()}>Status erneut prüfen</Button></div>}
      {busy && <p role="status" className="text-sm text-muted">Wird übernommen …</p>}
    </>}
  </Card>
}
