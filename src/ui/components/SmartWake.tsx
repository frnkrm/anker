import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { buildAlarmConfig, nextAlarmTimes } from '../../core/alarm'
import { smartWakeWindow } from '../../core/smartWake'
import { syncAlarm } from '../../platform/alarm'
import { AnkerNative, isNative, type SmartWakeState } from '../../platform/native'
import { startNightMeasurement } from '../../platform/nightMeasurement'
import { BedtimeNative } from '../../platform/bedtimePrompt'
import { today, useApp } from '../../state/store'
import { useNow } from '../../state/hooks'
import { Button, Card, Info, Section, Stepper, Toggle } from './ui'

const format = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })

/** Opt-in für eine einzige Nacht. Einstellungen allein starten weder Mikrofon noch Sensoren. */
export function SmartWake({ compact = false }: { compact?: boolean }) {
  const st = useApp()
  const settings = st.settings.alarm.smartWake
  const now = useNow()
  const [state, setState] = useState<SmartWakeState>()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  useEffect(() => {
    if (!isNative()) return
    let active = true
    const refresh = () => { if (document.visibilityState !== 'visible') return; void AnkerNative.getSmartWakeState().then((value) => { if (active) setState(value) }, () => { if (active) setError('Der Messstatus konnte nicht gelesen werden. Prüfe die installierte App-Version.') }) }
    refresh()
    const interval = setInterval(refresh, 2000)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', visible) }
  }, [])
  const run = async (action: () => Promise<void>, success: string) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht ausgeführt werden. Der feste Wecker bleibt gestellt.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const save = (patch: Partial<typeof settings>) => void run(async () => {
    if (isNative() && (patch.enabled === false || state?.active && patch.windowMinutes !== undefined)) await AnkerNative.stopSmartWake()
    await st.saveSettings((s) => ({ ...s, alarm: { ...s.alarm, smartWake: { ...s.alarm.smartWake, ...patch } } }))
    await syncAlarm()
  }, 'Einstellung gespeichert. Deine gewählten Startregeln gelten für die nächste Messung.')
  const planned = nextAlarmTimes(buildAlarmConfig(st.settings, st.days, today()), now).mainAt
  const window = smartWakeWindow(planned, settings.windowMinutes)
  const targetChanged = state?.active && state.targetAt !== planned
  const pausedUntil = state?.preWakePausedForTargetAt ?? 0

  return (
    <div id={compact ? undefined : 'nachtmessung'}><Section title={compact ? 'Nachtmessung' : 'Aktivitäts-Weckfenster'} hint="Experimentell: Bewegungen und Geräuschaktivität sind Hinweise, keine verlässliche Erkennung von Schlaf oder Wachheit. Die lokale Mikrofonmessung läuft ab dem Start; keine Tondateien. Nur im morgendlichen Weckfenster kann ein früherer Wecker ausgelöst werden. Eine ganze Nacht zu messen erhöht den Akkuverbrauch.">
      <Card className={compact ? 'space-y-2 !border-0 !bg-transparent !p-0' : 'space-y-4'}>
        {!compact && <div className="flex items-center justify-between gap-3">
          <span>Früheres Wecken bei Aktivität anbieten</span>
          <Toggle label="Aktivitäts-Weckfenster" checked={settings.enabled} onChange={(enabled) => save({ enabled })} />
        </div>}
        {pausedUntil > Date.now() && <div className="flex items-center justify-between gap-2"><p role="status" className="text-sm text-accent">Vorwecker bis {format.format(pausedUntil)} pausiert.</p><Info title="Vorwecker-Pause"><p>Die Pause bleibt auch nach Messungsende bis zu diesem Haupttermin bestehen. Der feste Hauptwecker wird nicht verschoben. Für eine spätere Nacht gilt wieder deine Vorwecker-Einstellung.</p></Info></div>}
        {settings.enabled && <>
          {!compact && <><div className="flex flex-wrap items-center justify-between gap-3">
            <span>Höchstens früher</span>
            <Stepper label="Weckfenster Minuten" min={5} max={90} step={5} value={settings.windowMinutes} onChange={(windowMinutes) => save({ windowMinutes })} />
          </div>
          <div className="flex items-center justify-between gap-3"><span>Täglich zur Bettzeit vormerken</span><Toggle label="Tägliche Nachtmessung" checked={settings.autoDaily === true} onChange={autoDaily => save({ autoDaily })} /></div>
          {settings.autoDaily && <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted">Im Hintergrund: Erinnerung zum Öffnen.</p><Info title="Tägliche Nachtmessung"><p>Bei geöffneter App und vorhandener Mikrofonfreigabe startet die Messung zur Bettzeit. Im Hintergrund erinnert Android dich ans Öffnen; dort kann sie nicht verlässlich selbst starten.</p></Info></div>}
          <div className="flex items-center justify-between gap-3"><span>Bildschirm nach Messstart sperren</span><Toggle label="Bildschirm nach Messstart sperren" checked={settings.lockOnStart === true} onChange={lockOnStart => save({ lockOnStart })} /></div>
          {settings.lockOnStart && <><p className="text-sm text-muted">Die Sperre benötigt eine eigene Android-Freigabe. Sie garantiert nicht, dass Instagram oder andere Apps keine Medien mehr abspielen. Du kannst jederzeit selbst sperren.</p>{isNative() && !state?.screenLockAvailable && <Button onClick={() => void run(() => AnkerNative.requestSleepScreenLock(), 'Android-Freigabe geöffnet. Entscheide dort selbst über die reine Bildschirmsperre.')}>Android-Sperrfreigabe öffnen</Button>}</>}
          <div className="flex items-center justify-between gap-3"><span>Einschlafzeit vorsichtig schätzen</span><Toggle label="Einschlafzeit schätzen" checked={st.settings.sleep.onsetEstimationEnabled === true} onChange={onsetEstimationEnabled => void run(async () => { if (!onsetEstimationEnabled && isNative()) await AnkerNative.stopSmartWake(); await st.saveSettings(s => ({ ...s, sleep: { ...s.sleep, onsetEstimationEnabled } })) }, 'Auswahl gespeichert. Einschalten gilt beim nächsten Messstart; Ausschalten beendet eine laufende Messung.')} /></div>
          <Info title="Einschlafzeit schätzen"><p>Wenn die sichtbar beobachtete stille Frage eine Minute unbeantwortet bleibt, wird nur eine unsichere Schätzung vorgemerkt. Bei ausgeschaltetem oder gesperrtem Display und bei Beobachtungslücken entsteht keine solche Schätzung. Andere Systemeinblendungen können die Anzeige begrenzen. Morgens kannst du die Zeit bestätigen, korrigieren oder verwerfen.</p><p>Zusätzliche Fragen kommen frühestens fünf Minuten nach Messstart, höchstens alle zehn Minuten und nur in den ersten zwei Stunden. Kein Bildschirmwecken, Ton oder Vibrieren. „Heute Ruhe“ beendet die Fragen.</p><p>Für die Frage über anderen Apps brauchst du eine eigene Android-Einblendfreigabe. Die Freigabe allein startet keine Messung.</p></Info>
          {st.settings.sleep.onsetEstimationEnabled && isNative() && <Button onClick={() => void run(() => BedtimeNative.openOverlayPermissionSettings(), 'Android-Freigabe geöffnet. Du entscheidest dort über Einblendungen.')}>Android-Einblendfreigabe öffnen</Button>}
          {settings.lockOnStart && st.settings.sleep.onsetEstimationEnabled && <p className="text-sm text-muted">Bei sofortiger Sperre entfallen Fragen, bis du das Handy wieder benutzt. Aus einer Sperre wird keine Einschlafzeit abgeleitet.</p>}
          </>}
          {window && <p className="text-sm">Geplantes Fenster: {format.format(window.from)} bis {format.format(window.to)}. Die feste Weckzeit bleibt die Absicherung.</p>}
          {targetChanged && <p role="status" className="text-sm text-warm">Die laufende Messung gehört zu einer anderen Weckzeit. Beende sie und starte sie für den aktuellen Termin bewusst neu.</p>}
          {!compact && <Info title="Was wird gemessen?"><p>Ab Start werden nur technische Bewegungs- und Lautstärkeindikatoren ausgewertet, keine Tondateien. Das lokale Diagnoseprotokoll unterscheidet gültige stille Intervalle von fehlenden Eingängen.</p></Info>}
          {!compact && <Info title="Ablauf und Grenzen der Messung">
          <div className="space-y-3 pt-2">
          <p className="text-sm text-muted">Lege das Handy so auf die Matratze, dass es ihre Bewegungen mitbekommt. Bewegung und Geräuschaktivität werden kombiniert. Auch Umdrehen, Schnarchen oder andere Personen können ein Signal auslösen.</p>
          <p className="text-sm text-muted">Starte die Messung abends bei geöffneter App und erlaube das Mikrofon. Technische Sensorwerte werden ab Start lokal ausgewertet. Nur im morgendlichen Fenster darf daraus ein früherer Wecker entstehen. Es werden keine Tonaufnahmen gespeichert oder versendet.</p>
          <p className="text-sm text-muted">Ohne brauchbare Signale oder bei Abbruch klingelt der reguläre Wecker. Ein vorgezogener Wecker kann deine Schlafzeit um bis zu {settings.windowMinutes} Minuten verkürzen. Nach dem bestätigten Beenden gibt es keinen zweiten Hauptwecker zur ursprünglichen Zeit.</p>
          </div>
          <p>Beim Start wird der Vorwecker für diese Nacht pausiert, damit sein Ton und seine Vibration die Messung nicht beeinflussen. Die Pause bleibt auch nach Messungsende bestehen. Für die nächste Nacht ohne Messung gilt wieder deine Vorwecker-Einstellung.</p>
          </Info>}
          <p className="text-sm text-muted">Start pausiert den Vorwecker für diese Nacht.</p>
          {isNative() ? <>
            {state?.hasMotion === false && <p role="status" className="text-warm">Android meldet keinen verfügbaren Bewegungssensor.</p>}
            {state?.active ? <Button disabled={busy} className="w-full" onClick={() => void run(() => AnkerNative.stopSmartWake(), 'Messungsende angefragt. Der feste Wecker bleibt gestellt.')}>Messung beenden</Button>
              : <Button variant={compact ? 'secondary' : 'primary'} disabled={busy || !st.settings.alarm.enabled || state?.hasMotion === false} className="w-full" onClick={() => void run(startNightMeasurement, 'Start angefragt. Den tatsächlichen Laufstatus siehst du unten.')}>Messung für diese Nacht starten</Button>}
            {state && <div className="flex items-center justify-between gap-2"><p role="status" className="text-sm text-muted">{compact && state.active ? 'Messung läuft' : state.message}</p>{compact && state.active && <Info title="Messstatus"><p>{state.message}</p><p>Die Anzeige stammt von der laufenden nativen Messung. Fehlende Eingänge und stille Intervalle sind im Diagnosejournal getrennt.</p><Link to="/diagnose" className="flex min-h-12 items-center underline">Weckerverlauf & Diagnose öffnen</Link></Info>}</div>}
          </> : <p className="text-sm text-muted">Messung nur in der Android-App.</p>}
          {compact && <Link to="/wecker#nachtmessung" className="flex min-h-11 items-center text-sm text-accent">Messung einrichten ›</Link>}
        </>}
        {busy && <p className="text-sm text-muted" role="status">Wird übernommen …</p>}
        {message && <p role="status" className="text-sm text-accent">{message}</p>}
        {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      </Card>
    </Section></div>
  )
}
