import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { BUILD_FINGERPRINT } from 'virtual:anker-device-tests'
import { DIAGNOSTIC_CATEGORIES, DIAGNOSTIC_CATEGORY_LABELS, DIAGNOSTIC_SETTINGS_GROUPS, DIAGNOSTIC_SETTINGS_LABELS,
  defaultDiagnosticSelection, makeDiagnosticExport, type DiagnosticCategory, type DiagnosticEvent, type DiagnosticSettingsGroup } from '../../core/diagnostics'
import { fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { readDiagnostics, type DiagnosticRead } from '../../platform/diagnostics'
import { saveFile } from '../../platform/files'
import { isNative } from '../../platform/native'
import { Button, Card, Checkbox, Choice, DateField, MoreInfo, Page, Section } from '../components/ui'

const format = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const LABELS: Record<string, string> = {
  scheduled: 'Termin vorgemerkt', schedule_cancelled: 'Termin aufgehoben', schedule_fallback: 'Planung mit Ersatzweg', schedule_error: 'Planung fehlgeschlagen',
  reconcile: 'Planung neu abgeglichen', fired_accepted: 'Wecksignal angenommen', fired_rejected: 'Wecksignal verworfen',
  service_requested: 'Weckerdienst angefordert', service_entered: 'Weckerdienst gestartet', foreground_started: 'Weckerdienst im Vordergrund',
  foreground_error: 'Weckerdienst konnte nicht im Vordergrund starten', audio_focus_result: 'Audiofreigabe beantwortet', audio_focus_change: 'Audiofreigabe geändert',
  player_started: 'Playerstart bestätigt', player_error: 'Playerfehler', tone_started: 'Ersatzton gestartet', tone_error: 'Ersatzton fehlgeschlagen',
  player_route_changed: 'Tatsächlicher Audioausgang geändert', audio_focus_error: 'Audiofreigabe fehlgeschlagen',
  service_start_error: 'Weckerdienst konnte nicht starten', screen_wake_requested: 'Weckeranzeige angefordert', screen_wake_error: 'Weckeranzeige fehlgeschlagen',
  screen_wake_notify_error: 'Weckermeldung fehlgeschlagen', stop_error: 'Beenden konnte nicht abgeschlossen werden', fallback_posted: 'Ersatzmeldung angefordert', fallback_error: 'Ersatzmeldung fehlgeschlagen',
  audio_stopped: 'Tonausgabe beendet', service_destroyed: 'Weckerdienst beendet', stop_requested: 'Beenden angefordert', timeout: 'Weckerdauer abgelaufen',
  snooze_accepted: 'Schlummern angenommen', snooze_rejected: 'Schlummern abgelehnt', test_confirmed: 'Eigene Hörbeobachtung gespeichert',
  due_received: 'Schlafhinweis-Termin zugestellt', accepted: 'Schlafhinweis zugelassen', rejected: 'Schlafhinweis ausgelassen',
  due_accepted: 'Schlafhinweis zugelassen', due_skipped: 'Schlafhinweis ausgelassen',
  overlay_requested: 'Einblendung angefordert', overlay_attached: 'Fenster angehängt', overlay_error: 'Einblendung fehlgeschlagen',
  foreground_requested: 'Öffnen von Anker angefordert', foreground_confirmed: 'Anker tatsächlich fortgesetzt',
  foreground_unconfirmed: 'Öffnen von Anker nicht bestätigt', foreground_failed: 'Öffnen von Anker fehlgeschlagen',
  due_rejected: 'Schlafhinweis ausgelassen', schedule_failed: 'Schlafhinweis konnte nicht geplant werden', session_error: 'Schlafhinweis fehlgeschlagen',
  stopped: 'Schlafhinweis gestoppt', acknowledged: 'Schlafhinweis geschlossen', session_skipped: 'Schlafhinweis ausgelassen',
  error: 'Technischer Fehler', app_paused: 'Anker verlassen', unrecognized_event: 'Weiteres technisches Ereignis',
}
const kindLabel: Record<string, string> = { main: 'Hauptwecker', snooze: 'Schlummern', prewake: 'Vorwecker', wakecheck: 'Wachheits-Check', test: 'Testwecker' }
const toggle = <T,>(values: readonly T[], value: T, checked: boolean): T[] => checked ? [...new Set([...values, value])] : values.filter(item => item !== value)

function EventRow({ event }: { event: DiagnosticEvent }) {
  const kind = typeof event.details.kind === 'string' ? kindLabel[event.details.kind] : undefined
  const label = event.code === 'audio_focus_result' && event.details.focusResult === 0 ? 'Android hat die Audiofreigabe verweigert'
    : event.code === 'audio_focus_result' && event.details.focusResult === 1 ? 'Audiofreigabe erhalten' : LABELS[event.code] ?? 'Technisches Ereignis'
  return <li className="rounded-xl border border-line p-3 space-y-1">
    <p className="text-sm text-muted">{format.format(event.at)} · {kind ?? DIAGNOSTIC_CATEGORY_LABELS[event.category]}</p>
    <p className="font-medium">{label}</p>
    <details className="text-sm text-muted"><summary className="min-h-11 py-2">Technische Einzelheiten</summary>
      <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify({ code: event.code, ...event.details }, null, 2)}</pre>
      <p>Ein Gerätezustand mit observedAt kann kurz nach dem Ereignis erfasst worden sein.</p>
    </details>
  </li>
}

export default function Diagnostics() {
  const initial = useMemo(() => defaultDiagnosticSelection(), [])
  const [categories, setCategories] = useState<readonly DiagnosticCategory[]>(initial.categories)
  const [settingsGroups, setSettingsGroups] = useState<readonly DiagnosticSettingsGroup[]>([])
  const [includeCurrentStatus, setIncludeCurrentStatus] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'custom'>('day')
  const [from, setFrom] = useState(toBerlinDateTimeInput(initial.from))
  const [to, setTo] = useState(toBerlinDateTimeInput(initial.to))
  const [read, setRead] = useState<DiagnosticRead>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const request = useRef(0)
  const mounted = useRef(true)
  const pending = useRef(false)
  useEffect(() => {
    mounted.current = true
    const current = ++request.current
    void readDiagnostics(BUILD_FINGERPRINT).then(result => { if (mounted.current && request.current === current) setRead(result) })
    return () => { mounted.current = false }
  }, [])

  const selectionAt = (nowMs: number) => ({ categories, settingsGroups, includeCurrentStatus,
    from: period === 'custom' ? fromBerlinDateTimeInput(from) : Math.max(0, nowMs - (period === 'day' ? 1 : 7) * 86_400_000),
    to: period === 'custom' ? fromBerlinDateTimeInput(to) : nowMs })
  let preview: ReturnType<typeof makeDiagnosticExport> | undefined
  try { if (read) preview = makeDiagnosticExport(read.input, selectionAt(read.capturedAt), read.capturedAt) } catch { /* Falsche Zeitangaben werden am Exportknopf erklärt. */ }
  const run = async (exportFile: boolean) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage(''); setError('')
    const current = ++request.current
    try {
      const choice = selectionAt(Date.now())
      if (!Number.isFinite(choice.from) || !Number.isFinite(choice.to) || choice.from > choice.to) throw new Error('Bitte prüfe den Zeitraum von/bis.')
      const fresh = await readDiagnostics(BUILD_FINGERPRINT, categories.includes('pc'))
      if (!mounted.current || request.current !== current) return
      setRead(fresh)
      const payload = makeDiagnosticExport(fresh.input, selectionAt(fresh.capturedAt), fresh.capturedAt)
      if (exportFile) {
        await saveFile(`Anker-Diagnose-${new Date(fresh.capturedAt).toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify(payload, null, 2), 'application/json')
        if (mounted.current) setMessage(isNative() ? 'Diagnosedatei erstellt. Im Teilen-Menü entscheidest du selbst, wohin sie geht.' : 'Die Diagnosedatei wurde zum Herunterladen bereitgestellt.')
      } else setMessage('Die verfügbaren Angaben wurden neu gelesen.')
    } catch { if (mounted.current) setError('Die Datei konnte nicht bereitgestellt werden oder der Vorgang wurde abgebrochen. Prüfe den Zeitraum und versuche es erneut.') }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }

  return <Page className="settings-page" title="Weckerverlauf & Diagnose" back="/wecker">
    <Card className="space-y-2">
      <p>Hier siehst du, ob Android einen Weckauftrag zugestellt und ob Anker die Tonausgabe gestartet hat. Das bestätigt nicht, dass du den Ton gehört hast oder aufgewacht bist.</p>
      <p className="text-sm text-muted">Das lokale Journal beginnt mit diesem Update: höchstens 800 Ereignisse und sieben Tage. Frühere Nächte werden nicht nachträglich ergänzt. Fehlende Einträge beweisen keinen ausgebliebenen Ton.</p>
      {!isNative() && <p className="text-sm text-warm">Im Browser gibt es kein Android-Weckerjournal. Ein Export hier ist ein Webbericht.</p>}
      <Link to="/wecker" className="flex min-h-11 items-center text-accent">Aktuelle Weckereinrichtung ansehen</Link>
    </Card>

    <Section title="Was soll in die Diagnosedatei?" hint="Die Datei bleibt zunächst auf deinem Gerät. Du kannst sie hier selbst anhängen; Anker sendet sie nicht automatisch.">
      <fieldset disabled={busy} className="space-y-3">
        <Choice label="Zeitraum" value={period} onChange={setPeriod} options={[{ value: 'day', label: 'Letzte 24 Stunden' }, { value: 'week', label: 'Letzte 7 Tage' }, { value: 'custom', label: 'Zeitraum wählen' }]} />
        {period === 'custom' && <div className="space-y-3"><DateField label="Von" type="datetime-local" value={from} onChange={setFrom} /><DateField label="Bis" type="datetime-local" value={to} onChange={setTo} /></div>}
        <MoreInfo summary="Log- und Einstellungsbereiche auswählen">
        <Card className="space-y-2"><h2 className="font-semibold">Log- und Statusbereiche</h2>
          <p className="text-sm text-muted">Neue Ereignisverläufe gibt es für Wecker, Schlafhinweis und System. Alltags-Erinnerungen und PC-Verbindung liefern hier zunächst ihren aktuellen technischen Status.</p>
          {DIAGNOSTIC_CATEGORIES.map(category => <Checkbox key={category} label={DIAGNOSTIC_CATEGORY_LABELS[category]} checked={categories.includes(category)} onChange={checked => setCategories(value => toggle(value, category, checked))} />)}
          <Checkbox label="Aktueller technischer Status: Planungszeiten, Lautstärke und Rechte" checked={includeCurrentStatus} onChange={setIncludeCurrentStatus} />
        </Card>
        <Card className="space-y-2"><h2 className="font-semibold">Einstellungen zusätzlich auswählen</h2>
          <p className="text-sm text-muted">Alle Bereiche beginnen abgewählt. Es ist der Stand beim Export, kein historischer Einstellungsverlauf.</p>
          {DIAGNOSTIC_SETTINGS_GROUPS.map(group => <Checkbox key={group} label={DIAGNOSTIC_SETTINGS_LABELS[group]} checked={settingsGroups.includes(group)} onChange={checked => setSettingsGroups(value => toggle(value, group, checked))} />)}
        </Card>
        </MoreInfo>
      </fieldset>
      <p className="px-1 text-sm text-muted">Aufgaben, Notizen, Medikamente, Schlafprotokolle, QR-Inhalte, Kopplungsschlüssel und Zugangsdaten sind ausgeschlossen. Routinen enthalten nur Dauern und Kernschritt-Auswahl.</p>
      {preview && <p className="px-1 text-sm" role="status">Auswahl: {preview.logs.length} Logeinträge · {settingsGroups.length} Einstellungsbereiche.</p>}
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      {message && <p role="status" className="text-sm text-accent">{message}</p>}
      <Button variant="primary" disabled={busy || !read} className="w-full" onClick={() => void run(true)}>{busy ? 'Angaben werden vorbereitet …' : 'Ausgewählte Diagnose exportieren'}</Button>
      <Button disabled={busy} className="w-full" onClick={() => void run(false)}>Verlauf aktualisieren</Button>
      {preview && <MoreInfo summary="Dateiinhalt vor dem Export ansehen"><pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(preview, null, 2)}</pre></MoreInfo>}
    </Section>

    <Section title="Verfügbare Ereignisse" hint={read ? `Stand ${format.format(read.capturedAt)}; angewählter Zeitraum und Logbereiche.` : 'Angaben werden gelesen.'}>
      {read?.unavailable.length ? <p className="text-sm text-warm">Nicht alle nativen Angaben konnten gelesen werden. Fehlende Belege werden nicht als Erfolg ausgegeben.</p> : null}
      {preview && !preview.logs.length && <p>Keine passenden Ereignisse im verfügbaren Journal.</p>}
      {preview && <ol className="space-y-2">{[...preview.logs].reverse().slice(0, 30).map(event => <EventRow key={event.seq} event={event} />)}</ol>}
      {preview && preview.logs.length > 30 && <p className="text-sm text-muted">Die Ansicht zeigt die letzten 30 Einträge. Der Export enthält alle {preview.logs.length} ausgewählten Einträge.</p>}
      {preview && <MoreInfo summary="Grenzen dieses Diagnoseberichts">{preview.manifest.warnings.map(warning => <p key={warning} className="text-sm text-muted">{warning}</p>)}</MoreInfo>}
    </Section>
    <MoreInfo summary="Spiel-Touchschutz und stummer Schlafhinweis">
      <p>Ein gedimmter Spiel-Touchschutz ist nicht dasselbe wie ein ausgeschaltetes Display. Anker protokolliert den tatsächlichen Android-Displayzustand und trennt eine angeforderte Einblendung vom bestätigten App-Vordergrund. Ein Systemfenster kann trotzdem darüberliegen.</p>
      <p>Der stumme Hinweis braucht die eingeschaltete Option, die Freigabe für Anzeigen über anderen Apps und den bewussten Start für diese Nacht. Bei ausgeschaltetem oder gesperrtem Bildschirm bleibt er aus.</p>
      <Link to="/einstellungen/schlaf" className="flex min-h-11 items-center text-accent">Schlafhinweis einstellen</Link>
    </MoreInfo>
  </Page>
}
