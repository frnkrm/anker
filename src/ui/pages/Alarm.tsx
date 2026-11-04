import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { STOP_METHOD_LABEL } from '../../core/alarm'
import { randomId } from '../../core/defaults'
import { fmtTime, todayBerlin, utcToZoned } from '../../core/time'
import type { AlarmPreferences, MedsStatus } from '../../core/types'
import { makeMathTask, syncAlarm } from '../../platform/alarm'
import { AnkerNative, isNative, safe, type AlarmDiagnostics, type AlarmKindWire } from '../../platform/native'
import { scanQr } from '../../platform/qr'
import { today, useApp } from '../../state/store'
import { QrCode } from '../components/QrCode'
import { Ampel, Button, Card, Page, Row, Section, Segmented, Stepper, TimeField, Toggle } from '../components/ui'

export function fmtDateTime(ms: number): string {
  const z = utcToZoned(ms)
  const label = z.date === todayBerlin() ? 'Heute' : new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  return `${label}, ${fmtTime(z.minutes)}`
}

const TEST_LABEL: Record<string, string> = {
  '': 'Noch nicht getestet',
  scheduled: 'Test läuft gleich',
  rang: 'Ausgelöst, aber noch nicht als hörbar bestätigt',
  heard: 'Von dir als hörbar bestätigt',
  'not-heard': 'Du hast nichts gehört. Prüfe die Punkte unten',
  failed: 'Test kam nicht an',
}

/** Eine Zeile mit echtem Android-Wert und, falls nötig, dem Weg in die richtige Systemansicht. */
function DiagRow({ state, label, hint, action, run }: { state: 'ok' | 'warn' | 'off'; label: string; hint?: string; action?: string; run?: () => void }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="mt-1.5">
        <Ampel state={state} />
      </span>
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {action && run && (
        <Button size="sm" onClick={run}>
          {action}
        </Button>
      )}
    </Card>
  )
}

/** Was Android gerade tatsächlich meldet. Nur auf dem Handy verfügbar. */
export function AlarmDiagnosis() {
  const [d, setD] = useState<AlarmDiagnostics>()
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    AnkerNative.getAlarmDiagnostics().then(
      (x) => {
        setD(x)
        setFailed(false)
      },
      () => setFailed(true),
    )
  }, [])
  useEffect(() => {
    if (!isNative()) return
    load()
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  if (!isNative()) return <p className="px-1 text-muted">Der Wecker läuft nur in der Android-App. Die Web-Version kann nicht wecken.</p>
  if (failed) return <p className="px-1 text-warm">Android hat keine Auskunft gegeben. Öffne die App neu.</p>
  if (!d) return null

  const quietVolume = d.alarmVolume <= Math.ceil(d.alarmVolumeMax * 0.3)
  const dndOn = d.interruptionFilter !== 1
  return (
    <Section title="So steht dein Wecker" hint="Alle Werte kommen direkt von Android.">
      <DiagRow
        state={d.scheduledAt && d.mainConfirmed ? 'ok' : 'warn'}
        label={d.scheduledAt ? `Nächster Hauptwecker: ${fmtDateTime(d.scheduledAt)}` : 'Kein Hauptwecker geplant'}
        hint={d.scheduledAt ? (d.mainConfirmed ? 'Von Android bestätigt.' : 'Von Android nicht bestätigt.') : undefined}
      />
      <DiagRow state={d.preWakeAt ? 'ok' : 'off'} label={d.preWakeAt ? `Vorwecker: ${fmtDateTime(d.preWakeAt)}` : 'Vorwecker: aus oder heute schon vorbei'} hint={d.preWakeAt && !d.preWakeConfirmed ? 'Von Android nicht bestätigt.' : undefined} />
      {d.missedMainAt > 0 && <DiagRow state="warn" label={`Einmal nicht geklingelt: ${fmtDateTime(d.missedMainAt)}`} hint="Das Handy war vermutlich aus. Danach wurde normal weitergeplant." />}
      <DiagRow state={d.testResult === 'heard' ? 'ok' : 'warn'} label="Letzter Test" hint={`${TEST_LABEL[d.testResult] ?? ''}${d.testResultAt ? ` (${fmtDateTime(d.testResultAt)})` : ''}`} />
      <DiagRow state={quietVolume ? 'warn' : 'ok'} label={`Wecker-Lautstärke: ${d.alarmVolume} von ${d.alarmVolumeMax}`} hint={quietVolume ? 'Das ist leise. Stelle sie mit den Lauter-Tasten höher, während ein Testton läuft. Anker ändert sie nicht von selbst.' : undefined} action="Testton" run={() => void AnkerNative.playTestTone()} />
      {(d.bluetooth || d.wired) && <DiagRow state="warn" label={d.bluetooth ? 'Bluetooth-Audio verbunden' : 'Kopfhörer verbunden'} hint="Der Ton kann dort zusätzlich oder statt am Handy zu hören sein. Mach einen Test mit deiner üblichen Nacht-Einstellung." />}
      {!d.audioOk && <DiagRow state="warn" label="Beim letzten Klingeln gab es keinen Ton" hint="Nur die Vibration lief. Prüfe den Wecker-Ton in den Android-Einstellungen." />}
      <DiagRow state={d.notificationsEnabled ? 'ok' : 'warn'} label="Benachrichtigungen" hint={d.notificationsEnabled ? undefined : 'Ohne sie siehst du die Wecker-Meldung nicht.'} action={d.notificationsEnabled ? undefined : 'Öffnen'} run={() => void AnkerNative.openAppSettings()} />
      <DiagRow state={d.exact ? 'ok' : 'warn'} label="Exakte Wecker" hint={d.exact ? undefined : 'Ohne dieses Recht kann sich der Wecker verspäten.'} action={d.exact ? undefined : 'Erlauben'} run={() => void AnkerNative.openExactAlarmSettings()} />
      <DiagRow state={d.fullScreen ? 'ok' : 'warn'} label="Vollbild über dem Sperrbildschirm" hint={d.fullScreen ? undefined : 'Sonst erscheint nur eine Meldung. Der Ton läuft trotzdem.'} action={d.fullScreen ? undefined : 'Erlauben'} run={() => void AnkerNative.openFullScreenIntentSettings()} />
      <DiagRow
        state={dndOn && !d.dndAccess ? 'warn' : d.dndAccess ? 'ok' : 'off'}
        label={dndOn ? '„Nicht stören“ ist gerade an' : '„Nicht stören“ ist gerade aus'}
        hint="Wecker sind dort meist erlaubt, das hängt aber von deinen Einstellungen ab. Anker schaltet „Nicht stören“ nie selbst um."
        action="Öffnen"
        run={() => void AnkerNative.openAlarmChannelSettings()}
      />
      <DiagRow state={d.batteryIgnored ? 'ok' : 'warn'} label={d.powerSave ? 'Akku: Energiesparen ist gerade an' : 'Akku-Optimierung'} hint={d.batteryIgnored ? 'Für Anker ausgenommen.' : 'Samsung beendet Apps gern im Hintergrund. Nimm Anker aus.'} action={d.batteryIgnored ? undefined : 'Öffnen'} run={() => void AnkerNative.openBatteryOptimizationSettings()} />
      {d.lastStopAt > 0 && <p className="px-1 text-sm text-muted">Zuletzt beendet: {fmtDateTime(d.lastStopAt)} ({STOP_METHOD_LABEL[d.lastStopMethod] ?? 'App'}).</p>}
      <details className="px-1 text-sm text-muted">
        <summary className="min-h-10 py-2">Technische Angaben</summary>
        <p>
          {d.device}, Android-API {d.sdk}. Letzter Abgleich: {d.lastReconcileAt ? fmtDateTime(d.lastReconcileAt) : 'nie'} ({d.lastReconcileReason || 'unbekannt'}). Vom System gemeldeter nächster Wecker: {d.systemNextAt ? fmtDateTime(d.systemNextAt) : 'keiner'}. Fehler: {d.error || 'keiner'}. Erinnerungen: {d.reminderQueue} geplant bis {d.reminderHorizon ? fmtDateTime(d.reminderHorizon) : 'nie'}, {d.remindersVisible} sichtbar.
        </p>
      </details>
      <Card>
        <p className="text-sm">Bis du den Wecker auf diesem Handy selbst geprüft hast: Lass zusätzlich den Android-Wecker gestellt.</p>
      </Card>
    </Section>
  )
}

/** Einrichtung: Wecker an/aus, Vorwecker, Wachheits-Check, QR-Code, Test und Diagnose. */
export function AlarmSetup() {
  const st = useApp()
  const s = st.settings
  const a = s.alarm
  const set = (patch: Partial<AlarmPreferences>) => void st.saveSettings((x) => ({ ...x, alarm: { ...x.alarm, ...patch } }))
  const [testing, setTesting] = useState(false)

  return (
    <Page title="Wecker" back="/mehr">
      <Card className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-lg font-medium">Aufstehen um {fmtTime(s.anchor.wake)}</p>
          <p className="text-sm text-muted">Jeden Tag gleich, außer an Kranktagen. Plant sich selbst weiter, auch wenn die App zu ist.</p>
        </div>
        <Toggle label="Wecker" checked={a.enabled} onChange={(v) => set({ enabled: v })} />
      </Card>

      <Section title="Optional">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium">Vorwecker</p>
              <p className="text-sm text-muted">Ein früherer, sanfter Ton. Der Hauptwecker klingelt immer, egal was du damit machst.</p>
            </div>
            <Toggle label="Vorwecker" checked={a.preWakeEnabled} onChange={(v) => set({ preWakeEnabled: v })} />
          </div>
          {a.preWakeEnabled && (
            <div className="flex items-center justify-between">
              <span>Wie lange vorher</span>
              <Stepper label="Vorwecker Minuten" value={a.preWakeLeadMinutes} step={5} min={5} max={120} onChange={(v) => set({ preWakeLeadMinutes: v })} />
            </div>
          )}
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium">Wachheits-Check</p>
              <p className="text-sm text-muted">Einmal kurz nachfragen, nachdem du den Wecker beendet hast. Keine Wiederholung.</p>
            </div>
            <Toggle label="Wachheits-Check" checked={a.wakeCheckEnabled} onChange={(v) => set({ wakeCheckEnabled: v })} />
          </div>
          {a.wakeCheckEnabled && (
            <div className="flex items-center justify-between">
              <span>Nach</span>
              <Stepper label="Wachheits-Check Minuten" value={a.wakeCheckDelayMinutes} step={1} min={3} max={10} onChange={(v) => set({ wakeCheckDelayMinutes: v })} />
            </div>
          )}
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium">Privates Einnahmeprotokoll</p>
              <p className="text-sm text-muted">Nur ein Notizbuch für dich. Bleibt auf dem Gerät, wird nicht synchronisiert und sagt dir nie, was oder wann du etwas nehmen sollst. Das klärst du mit deiner Ärztin oder deinem Arzt.</p>
            </div>
            <Toggle label="Einnahmeprotokoll" checked={a.medicationEnabled} onChange={(v) => set({ medicationEnabled: v, ...(v ? {} : { medicationReminderAt: null }) })} />
          </div>
          {a.medicationEnabled && (
            <div className="flex items-center justify-between gap-3">
              <span>Eigene Erinnerung</span>
              {a.medicationReminderAt === null ? (
                <Button size="sm" onClick={() => set({ medicationReminderAt: s.anchor.wake })}>
                  Hinzufügen
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <TimeField label="Erinnerungszeit" value={a.medicationReminderAt} onChange={(v) => set({ medicationReminderAt: v })} />
                  <Button size="sm" variant="ghost" onClick={() => set({ medicationReminderAt: null })}>
                    Entfernen
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </Section>

      <Card className="flex flex-col items-center gap-3 text-center">
        <QrCode value={a.qrSecret} label="QR-Code zum Beenden des Weckers" />
        <p className="text-muted">Ausdrucken und im Bad aufhängen. Morgens beendest du den Wecker damit.</p>
        <div className="flex w-full gap-2">
          <Link to="/druck?typ=qr" className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-surface-2">
            Drucken
          </Link>
          <Button
            className="flex-1"
            onClick={() => {
              if (confirm('Neuen Code erzeugen? Der alte Ausdruck funktioniert dann nicht mehr.')) set({ qrSecret: `ANKER-WACH-${randomId(16)}` })
            }}
          >
            Neuer Code
          </Button>
        </div>
      </Card>

      <Section title="Wenn der QR-Code nicht geht">
        <Card className="space-y-3">
          <p className="text-sm text-muted">Unter „Anderen Weg wählen“ gibt es Rechenaufgaben und immer auch einen Notfall-Stopp ohne Lesen und Rechnen.</p>
          <div className="flex items-center justify-between gap-2">
            <span>Rechenaufgaben</span>
            <Segmented<number>
              label="Anzahl Rechenaufgaben"
              value={a.mathTasks}
              options={[
                { value: 3, label: '3' },
                { value: 5, label: '5' },
                { value: 8, label: '8' },
              ]}
              onChange={(v) => set({ mathTasks: v as AlarmPreferences['mathTasks'] })}
            />
          </div>
        </Card>
      </Section>

      {isNative() && (
        <Row
          label={testing ? 'Test-Wecker kommt gleich …' : 'Wecker testen'}
          sub="Klingelt in 10 Sekunden. Dein echter Wecker bleibt gestellt."
          onClick={async () => {
            setTesting(true)
            await AnkerNative.testAlarm({ seconds: 10 })
            st.showToast('Test in 10 Sekunden. Sperr ruhig das Handy.')
            setTimeout(() => setTesting(false), 12_000)
          }}
        />
      )}
      <AlarmDiagnosis />
    </Page>
  )
}

const RING_TEXT: Record<AlarmKindWire, string> = {
  main: 'Guten Morgen. Ab ins Bad.',
  snooze: 'Guten Morgen. Ab ins Bad.',
  prewake: 'Vorwecker. Der Hauptwecker bleibt gestellt.',
  wakecheck: 'Bist du wach?',
  test: 'Das ist ein Test. Dein echter Wecker bleibt gestellt.',
}

/** Klingel-Bildschirm. Der Zustand kommt immer aus dem nativen Teil und übersteht einen Prozess-Neustart. */
export function AlarmRinging() {
  const st = useApp()
  const nav = useNavigate()
  const [kind, setKind] = useState<AlarmKindWire | 'none' | null>(null)
  const [snoozed, setSnoozed] = useState(0)
  const [msg, setMsg] = useState<string>()
  const [mode, setMode] = useState<'main' | 'other' | 'math' | 'emergency' | 'testAsk'>('main')

  useEffect(() => {
    void safe(() => AnkerNative.getAlarmState(), { ringing: false, snoozed: 0, kind: null }).then((s) => {
      setSnoozed(s.snoozed)
      setKind(s.ringing && s.kind ? s.kind : 'none')
    })
  }, [])

  // Alter Link oder Timeout: nichts klingelt, also auch keinen Klingel-Bildschirm zeigen
  useEffect(() => {
    if (kind === 'none') nav('/', { replace: true })
  }, [kind, nav])

  /** „Ich bin wach“ wird nur beim echten Wecken vermerkt, nicht bei Test oder Vorwecker. */
  const finishMain = async (method: string) => {
    await AnkerNative.stopAlarm({ method })
    const d = today()
    if (!useApp.getState().days[d]?.wakeAt) await st.mark(d, 'wakeAt')
    await syncAlarm()
    nav('/fokus/morning', { replace: true })
  }

  const finishOther = async (method: string, to = '/') => {
    await AnkerNative.stopAlarm({ method })
    await syncAlarm()
    nav(to, { replace: true })
  }

  const scan = async () => {
    setMsg(undefined)
    const r = await scanQr()
    if (r.ok && r.value === st.settings.alarm.qrSecret) return finishMain('qr')
    if (r.ok) setMsg('Das ist nicht dein Anker-Code.')
    else if (r.reason === 'unavailable' || r.reason === 'denied') {
      setMsg('Der Scanner geht gerade nicht. Nimm einen anderen Weg.')
      setMode('other')
    }
  }

  const snooze = async () => {
    const r = await safe(() => AnkerNative.snoozeAlarm({ minutes: 5 }), { ok: false })
    if (r.ok) {
      await syncAlarm()
      nav('/', { replace: true })
    } else setMsg('Schlummern geht nur einmal.')
  }

  if (!kind || kind === 'none') return <div className="min-h-dvh bg-bg" aria-busy="true" />

  const header = (
    <div>
      <p className="text-7xl font-light tabular-nums">{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="mt-3 text-2xl">{RING_TEXT[kind]}</p>
    </div>
  )
  const frame = (body: React.ReactNode) => (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-bg px-6 py-10 text-center safe-top">
      {header}
      <div className="w-full max-w-sm space-y-3">
        {body}
        {msg && (
          <p className="text-warm" role="status">
            {msg}
          </p>
        )}
      </div>
    </div>
  )

  if (kind === 'prewake') {
    return frame(
      <>
        <Button variant="primary" size="xl" className="w-full" onClick={() => finishOther('prewake')}>
          Vorwecker beenden
        </Button>
        {st.settings.alarm.medicationEnabled && <MedsButtons date={today()} />}
      </>,
    )
  }
  if (kind === 'wakecheck') {
    return frame(
      <Button variant="primary" size="xl" className="w-full" onClick={() => finishOther('check')}>
        Ich bin wach
      </Button>,
    )
  }
  if (kind === 'test') {
    if (mode === 'testAsk') {
      return frame(
        <>
          <p className="text-xl">War der Wecker gut hörbar?</p>
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={async () => {
              await AnkerNative.confirmTest({ heard: true })
              await finishOther('test', '/wecker')
            }}
          >
            Ja
          </Button>
          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              await AnkerNative.confirmTest({ heard: false })
              await finishOther('test', '/wecker')
            }}
          >
            Nein
          </Button>
        </>,
      )
    }
    return frame(
      <Button variant="primary" size="xl" className="w-full" onClick={() => setMode('testAsk')}>
        Test beenden
      </Button>,
    )
  }

  if (mode === 'other') {
    return frame(
      <>
        <Button size="xl" className="w-full" onClick={() => setMode('math')}>
          Rechenaufgaben
        </Button>
        <EmergencyEntry onOpen={() => setMode('emergency')} />
        <Button variant="ghost" size="lg" className="w-full" onClick={() => setMode('main')}>
          Zurück zum QR-Code
        </Button>
      </>,
    )
  }
  if (mode === 'math') return frame(<MathStop count={st.settings.alarm.mathTasks} onDone={() => void finishMain('math')} onBack={() => setMode('other')} />)
  if (mode === 'emergency') return frame(<EmergencyStop onStop={() => void finishMain('emergency')} onBack={() => setMode('other')} />)

  return frame(
    <>
      <Button variant="primary" size="xl" className="w-full" onClick={scan}>
        QR-Code scannen
      </Button>
      {kind === 'main' && snoozed === 0 && (
        <Button size="lg" className="w-full" onClick={snooze}>
          5 Minuten schlummern (1×)
        </Button>
      )}
      <Button variant="ghost" size="lg" className="w-full" onClick={() => setMode('other')}>
        Anderen Weg wählen
      </Button>
    </>,
  )
}

function EmergencyEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <Button size="xl" className="w-full" onClick={onOpen}>
      Notfall-Stopp
    </Button>
  )
}

/** Immer erreichbar: kein Lesen, kein Rechnen, keine Kamera, nur 10 Sekunden warten und einmal tippen. */
function EmergencyStop({ onStop, onBack }: { onStop: () => void; onBack: () => void }) {
  const [left, setLeft] = useState(10)
  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return (
    <>
      <p className="text-8xl font-light tabular-nums" aria-live="polite" aria-label={left > 0 ? `Noch ${left} Sekunden` : 'Jetzt möglich'}>
        {left > 0 ? left : '✓'}
      </p>
      <Button variant="primary" size="xl" className="w-full" disabled={left > 0} onClick={onStop}>
        Wecker beenden
      </Button>
      <Button variant="ghost" size="lg" className="w-full" onClick={onBack}>
        Zurück
      </Button>
    </>
  )
}

function MathStop({ count, onDone, onBack }: { count: number; onDone: () => void; onBack: () => void }) {
  const tasks = useMemo(() => Array.from({ length: count }, () => makeMathTask()), [count])
  const [solved, setSolved] = useState(0)
  const [answer, setAnswer] = useState('')
  const [msg, setMsg] = useState<string>()
  const task = tasks[solved]
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!task) return
        if (Number(answer) === task.a) {
          setAnswer('')
          setMsg(undefined)
          if (solved + 1 >= tasks.length) onDone()
          else setSolved(solved + 1)
        } else setMsg('Nicht ganz. Nochmal.')
      }}
    >
      <p className="text-muted">
        Aufgabe {solved + 1} von {tasks.length}
      </p>
      <p className="text-5xl font-semibold">{task?.q} =</p>
      <input autoFocus inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))} className="min-h-16 w-full rounded-2xl bg-surface-2 text-center text-3xl" aria-label="Ergebnis" />
      <Button type="submit" variant="primary" size="xl" className="w-full">
        Prüfen
      </Button>
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Zurück
      </Button>
      {msg && <p className="text-warm">{msg}</p>}
    </form>
  )
}

const MEDS_LABEL: Record<MedsStatus, string> = { taken: 'Einnahme bestätigt', 'not-taken': 'Noch nicht', unsure: 'Unsicher' }

/** Drei getrennte, bewusste Eingaben. Das Beenden eines Weckers trägt hier nie etwas ein. */
export function MedsButtons({ date }: { date: string }) {
  const st = useApp()
  const cur = st.local.meds[date]?.status
  return (
    <div className="space-y-2 pt-4">
      <p className="text-sm text-muted">Privates Protokoll, freiwillig</p>
      <div className="flex gap-2">
        {(Object.keys(MEDS_LABEL) as MedsStatus[]).map((k) => (
          <Button key={k} size="sm" className="flex-1" aria-pressed={cur === k} variant={cur === k ? 'primary' : 'secondary'} onClick={() => st.setMeds(date, cur === k ? undefined : k)}>
            {MEDS_LABEL[k]}
          </Button>
        ))}
      </div>
    </div>
  )
}
