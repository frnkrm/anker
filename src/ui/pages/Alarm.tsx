import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { randomId } from '../../core/defaults'
import { fmtTime } from '../../core/time'
import { makeMathTask, scheduleNextAlarm } from '../../platform/alarm'
import { AnkerNative, isNative, safe } from '../../platform/native'
import { scanQr } from '../../platform/qr'
import { today, useApp } from '../../state/store'
import { QrCode } from '../components/QrCode'
import { Button, Card, Page, Row, Toggle } from '../components/ui'

/** Einrichtung: Wecker an/aus, QR-Code zum Aufhängen im Bad, Vollbild-Check. */
export function AlarmSetup() {
  const st = useApp()
  const s = st.settings
  const [fullscreen, setFullscreen] = useState<boolean | null>(null)
  useEffect(() => {
    void safe(async () => (await AnkerNative.canUseFullScreenIntent()).granted, false).then(setFullscreen)
  }, [])

  return (
    <Page title="Wecker" back="/mehr">
      <Card className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-lg font-medium">Wecker um {fmtTime(s.anchor.wake)}</p>
          <p className="text-sm text-muted">Jeden Tag gleich. Ausschalten nur mit QR-Code.</p>
        </div>
        <Toggle label="Wecker" checked={s.alarm.enabled} onChange={(v) => st.saveSettings((x) => ({ ...x, alarm: { ...x.alarm, enabled: v } }))} />
      </Card>

      {isNative() && fullscreen === false && (
        <Card className="bg-warm-soft text-warm">
          <p className="mb-3">Damit der Wecker über dem Sperrbildschirm erscheint, braucht Anker die Vollbild-Berechtigung.</p>
          <Button variant="warm" onClick={() => AnkerNative.openFullScreenIntentSettings()}>
            Erlauben
          </Button>
        </Card>
      )}

      <Card className="flex flex-col items-center gap-3 text-center">
        <QrCode value={s.alarm.qrSecret} label="QR-Code zum Ausschalten des Weckers" />
        <p className="text-muted">Ausdrucken und im Bad aufhängen. Morgens scannst du ihn zum Ausschalten.</p>
        <div className="flex w-full gap-2">
          <Link to="/druck" className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-surface-2">
            Drucken
          </Link>
          <Button
            className="flex-1"
            onClick={() => {
              if (confirm('Neuen Code erzeugen? Der alte Ausdruck funktioniert dann nicht mehr.')) {
                void st.saveSettings((x) => ({ ...x, alarm: { ...x.alarm, qrSecret: `ANKER-WACH-${randomId(16)}` } }))
              }
            }}
          >
            Neuer Code
          </Button>
        </div>
      </Card>

      {isNative() && (
        <Row
          label="Wecker testen"
          sub="Klingelt in 10 Sekunden"
          onClick={async () => {
            await AnkerNative.scheduleAlarm({ at: Date.now() + 10_000, label: 'Test-Wecker' })
            st.showToast('Test-Wecker in 10 Sekunden. Sperr ruhig das Handy.')
          }}
        />
      )}
      <p className="px-1 text-sm text-muted">Notfall-Ausweg ohne QR-Code: 3 Rechenaufgaben. Schlummern geht einmal für 5 Minuten.</p>
    </Page>
  )
}

/** Klingel-Bildschirm. Ausschalten nur per QR-Scan oder 3 Rechenaufgaben. */
export function AlarmRinging() {
  const st = useApp()
  const nav = useNavigate()
  const [msg, setMsg] = useState<string>()
  const [mode, setMode] = useState<'main' | 'math'>('main')
  const [snoozed, setSnoozed] = useState(0)
  const tasks = useMemo(() => [makeMathTask(), makeMathTask(), makeMathTask()], [])
  const [solved, setSolved] = useState(0)
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    void safe(async () => (await AnkerNative.getAlarmState()).snoozed, 0).then(setSnoozed)
  }, [])

  const stop = async () => {
    await safe(() => AnkerNative.stopAlarm(), undefined)
    const d = today()
    if (!st.days[d]?.wakeAt) await st.mark(d, 'wakeAt')
    await scheduleNextAlarm()
    nav('/fokus/morning', { replace: true })
  }

  const scan = async () => {
    setMsg(undefined)
    const r = await scanQr()
    if (r.ok && r.value === st.settings.alarm.qrSecret) return stop()
    if (r.ok) setMsg('Das ist nicht dein Anker-Code. Der hängt im Bad.')
    else if (r.reason === 'unavailable') setMsg('Scanner gerade nicht verfügbar. Nimm die Rechenaufgaben.')
    else if (r.reason === 'denied') setMsg('Kamera nicht erlaubt. Nimm die Rechenaufgaben.')
  }

  const snooze = async () => {
    const r = await safe(() => AnkerNative.snoozeAlarm({ minutes: 5 }), { ok: false })
    if (r.ok) {
      setSnoozed(1)
      setMsg('5 Minuten. Danach gibt’s kein Schlummern mehr.')
    } else setMsg('Schlummern ist schon verbraucht.')
  }

  const task = tasks[solved]
  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-bg px-6 py-10 text-center safe-top">
      <div>
        <p className="text-7xl font-light tabular-nums">{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="mt-3 text-2xl">Guten Morgen! Ab ins Bad. ☀️</p>
      </div>

      {mode === 'main' ? (
        <div className="w-full max-w-sm space-y-3">
          <Button variant="primary" size="xl" className="w-full" onClick={scan}>
            QR-Code scannen
          </Button>
          {snoozed === 0 && (
            <Button size="lg" className="w-full" onClick={snooze}>
              5 Minuten schlummern (1×)
            </Button>
          )}
          <Button variant="ghost" size="lg" className="w-full" onClick={() => setMode('math')}>
            Notfall: Rechenaufgaben
          </Button>
          {msg && (
            <p className="text-warm" role="status">
              {msg}
            </p>
          )}
        </div>
      ) : (
        <form
          className="w-full max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!task) return
            if (Number(answer) === task.a) {
              setAnswer('')
              if (solved + 1 >= tasks.length) void stop()
              else setSolved(solved + 1)
            } else setMsg('Nicht ganz. Nochmal.')
          }}
        >
          <p className="text-muted">Aufgabe {solved + 1} von 3</p>
          <p className="text-5xl font-semibold">{task?.q} =</p>
          <input autoFocus inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))} className="min-h-16 w-full rounded-2xl bg-surface-2 text-center text-3xl" aria-label="Ergebnis" />
          <Button type="submit" variant="primary" size="xl" className="w-full">
            Prüfen
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setMode('main')}>
            Zurück zum QR-Code
          </Button>
          {msg && <p className="text-warm">{msg}</p>}
        </form>
      )}
    </div>
  )
}
