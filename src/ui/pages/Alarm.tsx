import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { guidancePreferences } from '../../core/guidance'
import { completeMorningAlarmHandoff, confirmMorningActivity } from '../../platform/guidance'
import { alarmPlanningStatus, STOP_METHOD_LABEL } from '../../core/alarm'
import { randomId } from '../../core/defaults'
import { fmtTime, todayBerlin, utcToZoned } from '../../core/time'
import type { AlarmPreferences, MedsStatus } from '../../core/types'
import { makeMathTask, syncAlarm } from '../../platform/alarm'
import { AnkerNative, isNative, safe, type AlarmDiagnostics, type AlarmKindWire, type ReminderChannelId } from '../../platform/native'
import { scanQr } from '../../platform/qr'
import { today, useApp } from '../../state/store'
import { QrCode } from '../components/QrCode'
import { SmartWake } from '../components/SmartWake'
import { Ampel, Button, Card, notifySaved, Page, Row, Section, SettingRow, Segmented, Stepper, TimeField, Toggle } from '../components/ui'

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
function DiagRow({ state, label, hint, action, actionLabel, run, disabled }: { state: 'ok' | 'warn' | 'off'; label: string; hint?: string; action?: string; actionLabel?: string; run?: () => void; disabled?: boolean }) {
  return (
    <Card className="flex flex-wrap items-start gap-3">
      <span className="mt-1.5">
        <Ampel state={state} />
      </span>
      <div className="min-w-0 flex-1 basis-[12ch] break-words">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {action && run && (
        <Button size="sm" onClick={run} disabled={disabled} aria-label={actionLabel}>
          {action}
        </Button>
      )}
    </Card>
  )
}

/** Was Android gerade tatsächlich meldet. Nur auf dem Handy verfügbar. */
export function AlarmDiagnosis() {
  const enabled = useApp((s) => s.settings.alarm.enabled)
  const [d, setD] = useState<AlarmDiagnostics>()
  const [failed, setFailed] = useState(false)
  const [toneError, setToneError] = useState('')
  const [toneBusy, setToneBusy] = useState(false)
  const [channelError, setChannelError] = useState('')
  const tonePending = useRef(false)
  const playTone = async () => {
    if (tonePending.current) return
    tonePending.current = true
    setToneBusy(true); setToneError('')
    try {
      const result = await AnkerNative.playTestTone()
      if (!result.ok) throw new Error('Audio nicht verfügbar')
    } catch {
      setToneError('Der Testton konnte nicht starten. Prüfe andere Audioausgaben und versuche es bei geöffneter App erneut.')
    } finally {
      tonePending.current = false
      setToneBusy(false)
    }
  }
  const openReminderChannel = async (channel: ReminderChannelId) => {
    setChannelError('')
    try { await AnkerNative.openReminderChannelSettings({ channel }) }
    catch { setChannelError('Die Android-Kanaleinstellungen konnten nicht geöffnet werden. Öffne Anker unter Android → Apps → Benachrichtigungen.') }
  }
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
    const interval = setInterval(onVis, 2000)
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(interval) }
  }, [load])

  if (!isNative()) return <p className="px-1 text-muted">Der Wecker läuft nur in der Android-App. Die Web-Version kann nicht wecken.</p>
  if (failed) return <p className="px-1 text-warm">Android hat keine Auskunft gegeben. Öffne die App neu.</p>
  if (!d) return null

  const quietVolume = d.alarmVolume <= Math.ceil(d.alarmVolumeMax * 0.3)
  const dndOn = d.interruptionFilter !== 1
  const planning = alarmPlanningStatus(d, enabled)
  const preWakePlanning = alarmPlanningStatus({ scheduledAt: d.preWakeAt, mainConfirmed: d.preWakeConfirmed, exact: d.exact, error: d.error }, enabled)
  return (
    <Section title="So steht dein Wecker" hint="Alle Werte kommen direkt von Android.">
      <DiagRow
        state={!enabled ? 'off' : planning.ok ? 'ok' : 'warn'}
        label={d.scheduledAt ? `Nächster Hauptwecker: ${fmtDateTime(d.scheduledAt)}` : 'Kein Hauptwecker geplant'}
        hint={planning.message}
      />
      <DiagRow state={d.preWakeAt ? (preWakePlanning.ok ? 'ok' : 'warn') : 'off'} label={d.preWakeAt ? `Vorwecker: ${fmtDateTime(d.preWakeAt)}` : d.preWakePausedForTargetAt === d.scheduledAt && d.scheduledAt ? 'Vorwecker: für diese Messnacht pausiert' : 'Vorwecker: aus oder heute schon vorbei'} hint={d.preWakeAt ? preWakePlanning.message : undefined} />
      {d.reminderRuleCount !== undefined && <DiagRow state="off" label={`${d.reminderRuleCount} wichtige Wochenregeln hinterlegt`} hint={d.reminderRulesFrom ? `Ab ${fmtDateTime(d.reminderRulesFrom)} führen sie deine gespeicherten Basiszeiten fort. Öffne Anker für neue Tagesänderungen. Die Anzeige bestätigt noch keine Zustellung.` : 'Öffne Anker nach einer Planänderung, damit deine Hinweise aktualisiert werden.'} />}
      {d.missedMainAt > 0 && <DiagRow state="warn" label={`Termin nicht regulär ausgelöst: ${fmtDateTime(d.missedMainAt)}`} hint="Die Ursache ist unbekannt. Danach wurde weitergeplant; prüfe die aktuelle Planung und den Testton." />}
      <DiagRow state={d.testResult === 'heard' ? 'ok' : 'warn'} label="Letzter Test" hint={`${TEST_LABEL[d.testResult] ?? ''}${d.testResultAt ? ` (${fmtDateTime(d.testResultAt)})` : ''}`} />
      <DiagRow state={quietVolume ? 'warn' : 'ok'} label={`Wecker-Lautstärke: ${d.alarmVolume} von ${d.alarmVolumeMax}`} hint={quietVolume ? 'Das ist leise. Stelle sie mit den Lauter-Tasten höher, während ein Testton läuft. Anker ändert sie nicht von selbst.' : undefined} action="Testton" disabled={toneBusy} run={() => void playTone()} />
      {toneError && <p role="alert" className="px-1 text-sm text-warm">{toneError}</p>}
      {(d.bluetooth || d.wired) && <DiagRow state="warn" label={d.bluetooth ? 'Bluetooth-Audio verbunden' : 'Kopfhörer verbunden'} hint="Der Ton kann dort zusätzlich oder statt am Handy zu hören sein. Mach einen Test mit deiner üblichen Nacht-Einstellung." />}
      {!d.audioOk && <DiagRow state="warn" label="Die letzte Tonausgabe war unterbrochen oder konnte nicht starten" hint="Prüfe die Hörbarkeit mit einem Test. Auch andere Audioausgaben oder Android-Regeln können den Ton unterbrechen." />}
      <DiagRow state={d.notificationsEnabled ? 'ok' : 'warn'} label="Benachrichtigungen" hint={d.notificationsEnabled ? undefined : 'Ohne sie siehst du die Wecker-Meldung nicht.'} action={d.notificationsEnabled ? undefined : 'Öffnen'} run={() => void AnkerNative.openAppSettings()} />
      {d.reminderDelivery && <section aria-label="Alltags-Erinnerungen" className="space-y-3 rounded-2xl border border-line p-3">
        <h3 className="font-semibold">Alltags-Erinnerungen</h3>
        <p className="text-sm text-muted">Diese Werte zeigen die einzelnen Kanäle und die aktuelle Zustellplanung.</p>
        {d.reminderDelivery.channels.map((channel) => {
          const name = { sanft: 'Sanfte Hinweise', uebergang: 'Übergangshinweise', wecker: 'Weckerbezogene Hinweise' }[channel.id]
          const state = channel.importance < 0 ? 'off' : channel.blocked ? 'warn' : 'ok'
          return <DiagRow key={channel.id} state={state} label={`${name}: ${channel.importance < 0 ? 'noch nicht angelegt' : channel.blocked ? 'in Android blockiert' : 'zugelassen'}`} hint={channel.importance > 0 && channel.importance < 3 ? 'Dieser Kanal ist leise eingestellt.' : channel.blocked ? 'Die allgemeine Freigabe allein schaltet diesen Kanal nicht ein.' : undefined} action="Öffnen" actionLabel={`${name} in Android öffnen`} run={() => void openReminderChannel(channel.id)} />
        })}
        {channelError && <p role="alert" className="text-sm text-warm">{channelError}</p>}
        {d.reminderDelivery.focusUntil > Date.now() && <p className="text-sm text-muted">Fokusschutz bis {fmtDateTime(d.reminderDelivery.focusUntil)}. Normale Hinweise werden während des Fokus unterdrückt.</p>}
        {Math.max(d.reminderDelivery.quietUntil, d.reminderDelivery.planQuietUntil) > Date.now() && <p className="text-sm text-muted">Ruhezeit bis {fmtDateTime(Math.max(d.reminderDelivery.quietUntil, d.reminderDelivery.planQuietUntil))}.</p>}
        <p className="text-sm text-muted">{d.reminderDelivery.nextAt > 0 ? `${d.reminderDelivery.nextAt <= Date.now() ? 'Noch fälliger' : 'Nächster'} Warteschlangenhinweis: ${fmtDateTime(d.reminderDelivery.nextAt)}.` : 'Kein Zeitpunkt in der aktuellen Warteschlange.'}</p>
        <p className="text-sm text-muted">{d.reminderDelivery.activeNotifications < 0 ? 'Android konnte die aktuell eingetragenen Alltagskarten nicht melden.' : `Android meldet aktuell ${d.reminderDelivery.activeNotifications} Alltagskarten.`} Gespeicherte Plätze: {d.reminderDelivery.storedSlots}. Das bestätigt noch nicht, dass du einen Hinweis gesehen hast.</p>
        <p className="text-xs text-muted">{d.reminderDelivery.lastSyncAt > 0 ? `Letzter Erinnerungsabgleich: ${fmtDateTime(d.reminderDelivery.lastSyncAt)}.` : 'Seit dieser Diagnoseversion wurde noch kein erfolgreicher Erinnerungsabgleich erfasst.'}</p>
        <Link to="/einstellungen/erinnerungen" className="flex min-h-11 items-center text-accent">Ruhezeiten und Erinnerungen einstellen</Link>
      </section>}
      <DiagRow state={d.exact ? 'ok' : 'warn'} label="Exakte Wecker" hint={d.exact ? undefined : 'Ohne dieses Recht kann sich der Wecker verspäten.'} action={d.exact ? undefined : 'Erlauben'} run={() => void AnkerNative.openExactAlarmSettings()} />
      <DiagRow state={d.fullScreen ? 'ok' : 'warn'} label="Vollbild über dem Sperrbildschirm" hint={d.fullScreen ? undefined : 'Sonst erscheint nur eine Meldung. Teste den Ton unabhängig davon.'} action={d.fullScreen ? undefined : 'Erlauben'} run={() => void AnkerNative.openFullScreenIntentSettings()} />
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
        <summary className="min-h-11 py-2">Technische Angaben</summary>
        <p>
          {d.device}, Android-API {d.sdk}. Letzter Abgleich: {d.lastReconcileAt ? fmtDateTime(d.lastReconcileAt) : 'nie'} ({d.lastReconcileReason || 'unbekannt'}). Vom System gemeldeter nächster Wecker: {d.systemNextAt ? fmtDateTime(d.systemNextAt) : 'keiner'}. Fehler: {d.error || 'keiner'}. Erinnerungen: {d.reminderQueue} geplant bis {d.reminderHorizon ? fmtDateTime(d.reminderHorizon) : 'nie'}, {d.remindersVisible < 0 ? 'aktuelle Android-Karten nicht abfragbar' : `${d.remindersVisible} aktuell bei Android eingetragen`}.
        </p>
      </details>
      <Card>
        <p className="text-sm">Bis du den Wecker auf diesem Handy selbst geprüft hast: Lass zusätzlich den Android-Wecker gestellt.</p>
      </Card>
    </Section>
  )
}

/** Einrichtung: Wecker an/aus, Vorwecker, Wachheits-Check, QR-Code, Test und Diagnose. */
export function AlarmSetup({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const s = st.settings
  const a = s.alarm
  const set = (patch: Partial<AlarmPreferences>) => void st.saveSettings((x) => ({ ...x, alarm: { ...x.alarm, ...patch } })).then(notifySaved).catch(() => st.showToast('Die Weckereinstellung konnte noch nicht gespeichert werden. Bitte versuche es erneut.'))
  const [testing, setTesting] = useState(false)

  const content = (
    <>
      {s.appearance.developerTools && <Row label="Wecker gemeinsam testen" sub="Geführte Schritte und deine Beobachtung" to="/geraetetest" />}
      <Card>
        <SettingRow label={<div>
          <p className="text-lg font-medium">Aufstehen um {fmtTime(s.anchor.wake)}</p>
          <p className="text-sm text-muted">Jeden Tag gleich, außer an Kranktagen. Plant sich selbst weiter, auch wenn die App zu ist.</p>
        </div>}>
          <Toggle label="Wecker" checked={a.enabled} onChange={(v) => set({ enabled: v })} />
        </SettingRow>
      </Card>

      <div className="[&_.setting-control]:ml-auto"><SmartWake /></div>
      <Section title="Optional">
        <Card className="space-y-3">
          <SettingRow label={<div>
            <p className="font-medium">Vorwecker</p>
            <p className="text-sm text-muted">Ein früherer, sanfter Ton. Der Hauptwecker bleibt unabhängig davon geplant.</p>
          </div>}>
            <Toggle label="Vorwecker" checked={a.preWakeEnabled} onChange={(v) => set({ preWakeEnabled: v })} />
          </SettingRow>
          {a.preWakeEnabled && (
            <SettingRow label="Wie lange vorher">
              <Stepper label="Vorwecker Minuten" value={a.preWakeLeadMinutes} step={5} min={5} max={120} onChange={(v) => set({ preWakeLeadMinutes: v })} />
            </SettingRow>
          )}
        </Card>
        <Card className="space-y-3">
          <SettingRow label={<div>
            <p className="font-medium">Wachheits-Check</p>
            <p className="text-sm text-muted">Einmal kurz nachfragen, nachdem du den Wecker beendet hast. Keine Wiederholung.</p>
          </div>}>
            <Toggle label="Wachheits-Check" checked={a.wakeCheckEnabled} onChange={(v) => set({ wakeCheckEnabled: v })} />
          </SettingRow>
          {a.wakeCheckEnabled && (
            <SettingRow label="Nach">
              <Stepper label="Wachheits-Check Minuten" value={a.wakeCheckDelayMinutes} step={1} min={3} max={10} onChange={(v) => set({ wakeCheckDelayMinutes: v })} />
            </SettingRow>
          )}
        </Card>
        <Card className="space-y-3">
          <SettingRow label={<div>
            <p className="font-medium">Privates Einnahmeprotokoll</p>
            <p className="text-sm text-muted">Nur ein Notizbuch für dich. Bleibt auf dem Gerät, wird nicht synchronisiert und sagt dir nie, was oder wann du etwas nehmen sollst. Das klärst du mit deiner Ärztin oder deinem Arzt.</p>
          </div>}>
            <Toggle label="Einnahmeprotokoll" checked={a.medicationEnabled} onChange={(v) => set({ medicationEnabled: v, ...(v ? {} : { medicationReminderAt: null }) })} />
          </SettingRow>
          {a.medicationEnabled && (
            <SettingRow label="Eigene Erinnerung">
              {a.medicationReminderAt === null ? (
                <Button size="sm" onClick={() => set({ medicationReminderAt: s.anchor.wake })}>
                  Hinzufügen
                </Button>
              ) : (
                <>
                  <TimeField label="Erinnerungszeit" value={a.medicationReminderAt} onChange={(v) => set({ medicationReminderAt: v })} />
                  <Button size="sm" variant="ghost" onClick={() => set({ medicationReminderAt: null })}>
                    Entfernen
                  </Button>
                </>
              )}
            </SettingRow>
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
          <SettingRow label="Rechenaufgaben">
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
          </SettingRow>
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
    </>
  )
  return embedded ? <div className="space-y-4">{content}</div> : <Page className="settings-page" title="Wecker" back="/mehr">{content}</Page>
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
    const load = () =>
      safe(() => AnkerNative.getAlarmState(), { ringing: false, snoozed: 0, kind: null }).then((s) => {
        setSnoozed(s.snoozed)
        setKind(s.ringing && s.kind ? s.kind : 'none')
      })
    void load()
    // Vorwecker kann in den Hauptwecker übergehen, während diese Seite offen ist
    const sub = isNative() ? AnkerNative.addListener('alarmRinging', () => void load()) : undefined
    return () => void sub?.then((h) => h.remove())
  }, [])

  // Alter Link oder Timeout: nichts klingelt, also auch keinen Klingel-Bildschirm zeigen
  useEffect(() => {
    if (kind === 'none') nav('/', { replace: true })
  }, [kind, nav])

  /** „Ich bin wach“ wird nur beim echten Wecken vermerkt, nicht bei Test oder Vorwecker. */
  const finishMain = async (method: string) => {
    try {
      await AnkerNative.stopAlarm({ method })
      const guidance = guidancePreferences(useApp.getState().settings.guidance)
      if (guidance.enabled && guidance.zeroGapMorning && await completeMorningAlarmHandoff()) {
        await syncAlarm()
        nav('/fokus/morning', { replace: true })
        return
      }
      const d = today()
      if (!useApp.getState().days[d]?.wakeAt) await st.mark(d, 'wakeAt')
      await syncAlarm()
      nav('/fokus/morning', { replace: true })
    } catch {
      setMsg('Der Morgenstart konnte noch nicht sicher gespeichert werden. Der bestätigte Übergang bleibt zur Wiederaufnahme erhalten. Bitte versuche es erneut.')
    }
  }

  const finishOther = async (method: string, to = '/') => {
    try {
      const guidance = guidancePreferences(useApp.getState().settings.guidance)
      if (method === 'check' && guidance.enabled && guidance.antiRelapse) await confirmMorningActivity()
      const after = await AnkerNative.stopAlarm({ method })
      // Inzwischen klingelt der Hauptwecker: nicht weggehen, sondern seine Seite zeigen
      if (after.ringing && after.kind) {
        setKind(after.kind)
        setMode('main')
        return
      }
      await syncAlarm()
      nav(to, { replace: true })
    } catch {
      setMsg('Die Bestätigung konnte noch nicht übernommen werden. Bitte versuche es erneut; der Notfall-Stopp bleibt erreichbar.')
    }
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
    <div className={`flex min-h-dvh flex-col items-center justify-between bg-bg px-6 py-10 text-center safe-top ${guidancePreferences(st.settings.guidance).enabled && guidancePreferences(st.settings.guidance).circadianUi ? 'guidance-alarm-active' : ''}`}>
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
