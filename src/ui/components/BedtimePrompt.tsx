import { useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { BEDTIME_PROMPT_TEXT, BedtimeNative, bedtimePromptSupported, type BedtimePromptState } from '../../platform/bedtimePrompt'
import { Button, Card } from './ui'

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
export function BedtimePrompt({ available, delayMinutes, nowMs }: { available: boolean; delayMinutes: number; nowMs: number }) {
  const supported = bedtimePromptSupported()
  const [state, setState] = useState<BedtimePromptState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settingsOpened, setSettingsOpened] = useState(false)
  const pending = useRef(false)
  const foreground = useRef(true)
  const epoch = useRef(0)
  const latest = useRef<BedtimePromptState | undefined>(undefined)
  const refresh = useRef<((force?: boolean) => Promise<void>) | undefined>(undefined)
  const flush = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    if (!supported) return
    let active = true
    let reading: number | undefined
    let queued = false
    const flushQueued = () => { if (queued && active && !pending.current && reading === undefined) { queued = false; void read() } }
    const read = async (force = false, queueOnBusy = true) => {
      if ((pending.current || reading !== undefined) && !force) { if (queueOnBusy) queued = true; return }
      const request = ++epoch.current
      reading = request; queued = false
      try {
        const value = await BedtimeNative.getBedtimePromptState()
        if (active && request === epoch.current && !queued) { latest.current = value; setState(value); setError('') }
      } catch {
        if (active && request === epoch.current && !queued) setError('Der Schlafhinweis-Status konnte nicht gelesen werden. Prüfe die installierte App-Version oder versuche es erneut.')
      } finally { if (reading === request) { reading = undefined; flushQueued() } }
    }
    refresh.current = read
    flush.current = flushQueued
    void read()
    const visible = () => { if (document.visibilityState === 'visible' && foreground.current) void read() }
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', visible)
    // Nur Statusanzeige: Deadline und Lebenszyklus gehören vollständig Android.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && foreground.current && latest.current?.phase === 'waiting') void read(false, false)
    }, 2000)
    const appListener = App.addListener('appStateChange', ({ isActive }) => { foreground.current = isActive; if (isActive) visible() })
    void appListener.catch(() => { /* Der zusätzliche Dokument-Abgleich bleibt verfügbar. */ })
    const listener = BedtimeNative.addListener('bedtimePromptChanged', visible)
    void listener.catch(() => { /* Ältere Builds werden durch den Statusabruf erkennbar; Vordergrundabgleich bleibt. */ })
    return () => {
      active = false; refresh.current = undefined; flush.current = undefined
      clearInterval(interval)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('focus', visible)
      void listener.then((handle) => handle.remove(), () => undefined)
      void appListener.then((handle) => handle.remove(), () => undefined)
    }
  }, [supported])

  const run = async (action: () => Promise<void>) => {
    if (pending.current || !supported) return
    pending.current = true; ++epoch.current; setBusy(true); setError('')
    try { await action(); await refresh.current?.(true) }
    catch { setError('Der Schlafhinweis konnte nicht sicher aktualisiert werden. Bitte versuche es erneut.') }
    finally { pending.current = false; setBusy(false); flush.current?.() }
  }
  const waiting = state?.phase === 'waiting'
  const shown = state?.phase === 'shown'
  const finished = !!state?.sessionId && (state.phase === 'skipped' || state.phase === 'error')
  const validDelay = Number.isInteger(delayMinutes) && delayMinutes >= 0 && delayMinutes <= 60
  const acknowledge = () => {
    if (!state?.sessionId || !foreground.current || document.visibilityState !== 'visible') return
    void run(() => BedtimeNative.ackBedtimePrompt({ sessionId: state.sessionId! }))
  }
  if (!available && !waiting && !shown && !finished) return null

  return <Card className="min-w-0 space-y-3">
    <h2 className="break-words font-semibold">Stummer Schlafhinweis</h2>
    {!supported ? <p className="text-sm text-muted">Der Hinweis über anderen Apps ist nur in der Android-App verfügbar. Im Browser wird kein Schlafhinweis gestartet.</p> : <>
      {shown ? <div role="status" className="space-y-3">
        <p className="break-words">{BEDTIME_PROMPT_TEXT}</p>
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
        {state ? state.overlayPermission ? <Button disabled={busy || !validDelay} className="w-full" onClick={() => void run(() => BedtimeNative.startBedtimePrompt({ delayMinutes }))}>Ich gehe ins Bett – stummen Hinweis starten</Button>
          : <>
            <p className="text-sm text-muted">Dafür braucht Anker die Android-Freigabe „Über anderen Apps einblenden“. Die Freigabe allein startet keinen Hinweis.</p>
            <Button disabled={busy} className="w-full" onClick={() => void run(async () => { await BedtimeNative.openOverlayPermissionSettings(); setSettingsOpened(true) })}>Android-Freigabe einrichten</Button>
          </> : !error && <p role="status" className="text-sm text-muted">Android-Status wird geprüft …</p>}
      </>}
      {settingsOpened && !waiting && !shown && <p role="status" className="text-sm text-muted">Erlaube das Einblenden in Android, wenn du es möchtest. Wenn du zurückkommst, startest du den Schlafhinweis anschließend selbst.</p>}
      {error && <div className="space-y-2"><p role="alert" className="text-sm text-warm">{error}</p><Button disabled={busy} onClick={() => void refresh.current?.()}>Status erneut prüfen</Button></div>}
      {busy && <p role="status" className="text-sm text-muted">Wird übernommen …</p>}
    </>}
  </Card>
}
