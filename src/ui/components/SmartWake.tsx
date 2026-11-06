import { useEffect, useRef, useState } from 'react'
import { buildAlarmConfig, nextAlarmTimes } from '../../core/alarm'
import { smartWakeWindow } from '../../core/smartWake'
import { syncAlarm } from '../../platform/alarm'
import { AnkerNative, isNative, type SmartWakeState } from '../../platform/native'
import { today, useApp } from '../../state/store'
import { Button, Card, Section, Stepper, Toggle } from './ui'

const format = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })

/** Opt-in für eine einzige Nacht. Einstellungen allein starten weder Mikrofon noch Sensoren. */
export function SmartWake() {
  const st = useApp()
  const settings = st.settings.alarm.smartWake
  const [state, setState] = useState<SmartWakeState>()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  useEffect(() => {
    if (!isNative()) return
    let active = true
    const refresh = () => void AnkerNative.getSmartWakeState().then((value) => { if (active) setState(value) }, () => { if (active) setError('Der Messstatus konnte nicht gelesen werden. Prüfe die installierte App-Version.') })
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
    if (isNative() && (patch.enabled === false || state?.active)) await AnkerNative.stopSmartWake()
    await st.saveSettings((s) => ({ ...s, alarm: { ...s.alarm, smartWake: { ...s.alarm.smartWake, ...patch } } }))
    await syncAlarm()
  }, 'Einstellung gespeichert. Die Messung startest du für jede Nacht bewusst.')
  const planned = st.alarmStatus?.scheduledAt ?? nextAlarmTimes(buildAlarmConfig(st.settings, st.days, today()), Date.now()).mainAt
  const window = smartWakeWindow(state?.active ? state.targetAt : planned, settings.windowMinutes)
  const pausedUntil = state?.preWakePausedForTargetAt ?? 0

  return (
    <Section title="Aktivitäts-Weckfenster" hint="Experimentell: Bewegungen und Geräuschaktivität sind Hinweise, keine verlässliche Erkennung eines fast wachen Zustands.">
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span>Früheres Wecken bei Aktivität anbieten</span>
          <Toggle label="Aktivitäts-Weckfenster" checked={settings.enabled} onChange={(enabled) => save({ enabled })} />
        </div>
        {pausedUntil > Date.now() && <p role="status" className="text-sm text-accent">Vorwecker für {format.format(pausedUntil)} pausiert. Die Pause bleibt auch nach Messungsende bis zu diesem Haupttermin bestehen. Dein fester Hauptwecker bleibt aktiv.</p>}
        {settings.enabled && <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Höchstens früher</span>
            <Stepper label="Weckfenster Minuten" min={5} max={90} step={5} value={settings.windowMinutes} onChange={(windowMinutes) => save({ windowMinutes })} />
          </div>
          {window && <p className="text-sm">Geplantes Fenster: {format.format(window.from)} bis {format.format(window.to)}. Die feste Weckzeit bleibt die Absicherung.</p>}
          <p className="text-sm text-muted">Für jede Nacht bewusst starten. Bewegung und Geräusch werden nur im Fenster ausgewertet; Tonaufnahmen werden nicht gespeichert.</p>
          <details>
          <summary className="min-h-11 cursor-pointer content-center text-sm text-muted">Ablauf und Grenzen der Messung</summary>
          <div className="space-y-3 pt-2">
          <p className="text-sm text-muted">Lege das Handy so auf die Matratze, dass es ihre Bewegungen mitbekommt. Bewegung und Geräuschaktivität werden kombiniert. Auch Umdrehen, Schnarchen oder andere Personen können ein Signal auslösen.</p>
          <p className="text-sm text-muted">Starte die Messung abends bei geöffneter App und erlaube das Mikrofon. Vor dem Weckfenster werden keine Sensorwerte ausgewertet. Im Fenster bleibt alles kurzzeitig im Arbeitsspeicher; es werden keine Aufnahmen gespeichert oder versendet.</p>
          <p className="text-sm text-muted">Ohne brauchbare Signale oder bei Abbruch klingelt der reguläre Wecker. Ein vorgezogener Wecker kann deine Schlafzeit um bis zu {settings.windowMinutes} Minuten verkürzen. Nach dem bestätigten Beenden gibt es keinen zweiten Hauptwecker zur ursprünglichen Zeit.</p>
          </div>
          </details>
          <p className="text-sm text-muted">Beim Start wird der Vorwecker für diese Nacht pausiert, damit sein Ton und seine Vibration die Messung nicht beeinflussen. Die Pause bleibt auch nach Messungsende bestehen. Für die nächste Nacht ohne Messung gilt wieder deine Vorwecker-Einstellung.</p>
          {isNative() ? <>
            {state?.hasMotion === false && <p role="status" className="text-warm">Android meldet keinen verfügbaren Bewegungssensor.</p>}
            {state?.active ? <Button disabled={busy} className="w-full" onClick={() => void run(() => AnkerNative.stopSmartWake(), 'Messungsende angefragt. Der feste Wecker bleibt gestellt.')}>Messung beenden</Button>
              : <Button variant="primary" disabled={busy || !st.settings.alarm.enabled || state?.hasMotion === false} className="w-full" onClick={() => void run(async () => { await syncAlarm(); await AnkerNative.startSmartWake() }, 'Start angefragt. Den tatsächlichen Laufstatus siehst du unten.')}>Messung für diese Nacht starten</Button>}
            {state && <p role="status" className="text-sm text-muted">{state.message}</p>}
          </> : <p className="text-sm text-muted">Die Bewegungs- und Mikrofonmessung ist nur in der Android-App verfügbar. Hier kannst du die Option vorbereiten.</p>}
        </>}
        {busy && <p className="text-sm text-muted" role="status">Wird übernommen …</p>}
        {message && <p role="status" className="text-sm text-accent">{message}</p>}
        {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      </Card>
    </Section>
  )
}
