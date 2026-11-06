import { App as CapApp } from '@capacitor/app'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import catalog, { BUILD_FINGERPRINT } from 'virtual:anker-device-tests'
import { version as webVersion } from '../../../package.json'
import { DEVICE_TEST_SUITE, TEST_RESULT_LABEL, currentTestReport, deviceTestsFromLocal, type DeviceTestCase } from '../../core/deviceTests'
import { fmtTime } from '../../core/time'
import type { DeviceTestReport, DeviceTestResult } from '../../core/types'
import { saveFile } from '../../platform/files'
import { AnkerNative, isNative } from '../../platform/native'
import { useApp } from '../../state/store'
import { Button, Card, Page, Row, Section, TextInput } from '../components/ui'
import { AlarmDiagnosis, fmtDateTime } from './Alarm'

const SELECT_CLASS = 'min-h-12 w-full rounded-xl bg-surface-2 px-3 text-base'
const TEST_ALARM_CASES = new Set([1, 2, 3, 9, 14, 15, 16, 17, 18, 19, 20, 47, 48])
const HARDWARE_CASES = new Set([...Array.from({ length: 30 }, (_, i) => i + 1), 35, 37, 38, 41, 45, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 65])

function linksFor(id: number): { label: string; to: string }[] {
  if (id === 64) return [{ label: 'Mehr öffnen', to: '/mehr' }, { label: 'Tag öffnen', to: '/tag' }, { label: 'Wecker öffnen', to: '/wecker' }]
  if (id === 65) return [{ label: 'Messung und Vorwecker prüfen', to: '/wecker' }]
  if (id === 62) return [{ label: 'Uhrzeiten direkt ändern', to: '/einstellungen/schlaf' }, { label: 'Fahrzeit direkt ändern', to: '/einstellungen/weg' }]
  if (id === 63) return [{ label: 'Schlaf & Anker öffnen', to: '/einstellungen/schlaf' }]
  if (id >= 53 && id <= 59) return [{ label: 'Aktivitäts-Weckfenster öffnen', to: '/wecker' }]
  if (id === 49) return [{ label: 'Idee parken', to: '/abend' }, { label: 'Gedanken ansehen', to: '/inbox' }]
  if (id === 50) return [{ label: 'Nächsten Schritt merken', to: '/abend' }]
  if (id === 51) return [{ label: 'Sanften Übergang einstellen', to: '/einstellungen/abenduebergang' }]
  if (id === 52) return [{ label: 'Schlafüberblick öffnen', to: '/schlaf' }]
  if (id === 34) return [{ label: 'Schriftgröße einstellen', to: '/einstellungen/darstellung' }, { label: 'Alltag ausprobieren', to: '/' }]
  if (id >= 31 && id <= 32) return [{ label: 'Fokus-Puls einstellen', to: '/einstellungen/hilfen' }, { label: 'Morgenfokus öffnen', to: '/fokus/morning' }]
  if ([12, 26, 33, 46].includes(id)) return [{ label: 'Sicherung vor Update', to: '/backup' }, { label: 'Wecker prüfen', to: '/wecker' }, { label: 'Arbeitszeit prüfen', to: '/arbeitszeit' }]
  if (id >= 27 && id <= 30) return [{ label: 'Druckauswahl öffnen', to: id === 29 ? '/druck?typ=qr' : '/druck' }, { label: 'QR-Wecker öffnen', to: '/wecker' }]
  if (id >= 21 && id <= 25) return [{ label: 'Erinnerungen einstellen', to: '/einstellungen/erinnerungen' }, { label: 'Tagesplan öffnen', to: '/tag' }]
  if (id >= 41 && id <= 46) return [{ label: 'Arbeit & Gleitzeit einstellen', to: '/einstellungen/arbeit' }, { label: 'Arbeitszeit & Einsätze öffnen', to: '/arbeitszeit' }]
  if (id >= 35 && id <= 40) return [{ label: 'Tag und Morgen anders planen', to: '/tag' }, { label: 'Heute anders öffnen', to: '/' }, { label: 'Weckerdiagnose öffnen', to: '/wecker' }]
  const links = [{ label: 'Weckeroptionen & Diagnose öffnen', to: '/wecker' }]
  if ([4, 60, 61].includes(id)) links.unshift({ label: 'Aufstehzeit direkt einstellen', to: '/einstellungen/schlaf' })
  return links
}

function extraHelp(id: number): string[] {
  if (id === 64) return ['Öffne Anker über sein Widget oder eine Benachrichtigung. Rufe danach über die Navigation andere Seiten auf.', 'Auch bei „Gute Nacht“ müssen die gewählten Seiten offen bleiben. Prüfe neue Benachrichtigungslinks und den separaten Testwecker anschließend getrennt.']
  if (id === 65) return ['Notiere zuerst deine eigenen Weckzeiten. Aktiviere den Vorwecker und prüfe die feste Hauptzeit, bevor du die Messung bewusst startest.', 'Der Status muss den Vorwecker für diese Messnacht als pausiert zeigen. Seine Einstellung bleibt gespeichert. Auch nach Messungsende oder Neustart bleibt die Pause für diesen Haupttermin erhalten.', 'Warte den Vorwecktermin und die feste Hauptzeit tatsächlich ab. Danach eine neue Weckzeit oder den nächsten Morgen ohne Messung prüfen und deine eigenen Einstellungen wiederherstellen. Teilprüfungen als „Teilweise“ speichern.']
  if (id === 3) return ['Lies vor dem Test den Android-Stand unten ein. Die geplante Hauptzeit und der Schlummerzähler werden zum Vergleich gespeichert.', 'Starte den separaten Testalarm, beende ihn und kehre über „Zurück zu Test 3“ hierher zurück.', 'Lies den Android-Stand erneut und vergleiche die Hauptzeit. Nur dein beobachtetes Ergebnis wird abgehakt.']
  if ([4, 60, 61].includes(id)) return ['Notiere deine bisherige Aufstehzeit. Der separate Testalarm kann Schlummern nicht prüfen; dieser Test braucht bewusst einen regulären Hauptwecker.', 'Öffne „Aufstehzeit direkt einstellen“ und wähle eine Zeit wenige Minuten voraus. Abends kann das die berechneten Schlafzeiten verändern; deine manuell gesetzten Werte bleiben geschützt.', 'Führe die beschriebene Änderung durch. Stelle danach deine eigene Aufstehzeit und den gewünschten Ein-/Aus-Zustand wieder her. Falls du vorher automatische Zeiten genutzt hast, kannst du „Vorschlag übernehmen“ wählen.']
  if (id === 47) return ['Samsung: Öffne die Systemeinstellungen und suche dort nach „Always On Display“. Schalte es für diesen Test ein; die genaue Menüposition hängt von deiner One-UI-Version ab.', 'Starte hier den Testalarm, sperre das Handy und warte zehn Sekunden. Beobachte Ton und Vollbild getrennt.']
  if (id === 48) return ['Lass Always On Display eingeschaltet, halte das Handy diesmal entsperrt und starte den separaten Testalarm.', 'Eine Meldung oben ist hier das erwartete Verhalten. Notiere Ton und Anzeige getrennt.']
  if (id === 10) return ['Dies ist ein Hauptweckertest, kein Testalarm. Wähle bewusst eine nahe Hauptweckzeit, starte das Handy neu und entsperre es vor dieser Zeit noch nicht.', 'Notiere, ob Ton und Beenden-Knopf verfügbar waren. Danach entsperren und deine eigenen Zeiten zurückstellen.']
  if (id === 11) return ['Wähle eine nahe Hauptweckzeit und schalte das Handy vorher aus. Schalte es zehn Minuten nach dem Termin wieder ein.', 'Beobachte einmaliges Nachholen und prüfe danach die nächste geplante Hauptzeit. Anschließend eigene Zeiten zurückstellen.']
  if (id === 5) return ['Benutze dafür bewusst einen regulären Hauptwecker. Reagiere 30 Minuten nicht und öffne die App auch nach dem Verstummen zunächst nicht.', 'Der Folgetag muss wirklich klingeln. Das Verstummen allein bestätigt diesen zweiten Teil noch nicht: speichere bis dahin „Teilweise“.']
  if (id === 6 || id === 7) return ['Öffne die Weckeroptionen und schalte „Vorwecker“ bewusst ein. Prüfe die angezeigten Zeiten für Vor- und Hauptwecker.', 'Ein separater Testalarm ersetzt diesen Ablauf nicht. Stelle die Option nach dem Versuch wieder so ein, wie du sie nutzen möchtest.']
  if (id === 8) return ['Schalte „Wachheits-Check“ in den Weckeroptionen ein. Beende einen regulären Hauptwecker und warte die eingestellte Verzögerung ab.', 'Nach dem Beenden des Checks darf kein weiterer Check entstehen. Stelle die Option anschließend nach deinem Wunsch ein.']
  if (id === 14) return ['Öffne „Nicht stören“ unten. Teste einmal mit und einmal ohne erlaubte Wecker-Ausnahme.', 'Notiere beide Ergebnisse. Stelle danach deine üblichen Nicht-stören-Einstellungen wieder her.']
  if (id === 15) return ['Öffne die Ton-Einstellungen. Stelle die Alarmlautstärke bewusst niedrig und kontrolliere die Warnung in der Diagnose.', 'Teste die tatsächliche Hörbarkeit und stelle danach deine übliche Lautstärke wieder her. Anker regelt sie nicht automatisch.']
  if (id >= 53 && id <= 59) return ['Öffne die Weckeroptionen, prüfe deinen festen Hauptwecker und schalte das Aktivitäts-Weckfenster nur für diesen Versuch bewusst ein.', 'Die Messung muss für jede Nacht bei geöffneter App gestartet werden. Sie wertet erst im gewählten Fenster aus; es gibt hier keinen beschleunigten Nachweis für Schlafphasen.', 'Dein Handy liegt auf der Matratze. Beobachte Bewegung, Geräusche und den festen Ersatztermin getrennt. Beende die Messung oder schalte die Option nach dem Versuch aus, wenn du sie nicht nutzen möchtest.']
  if (id === 62) return ['Notiere deine eigenen Zeiten und Dauern vor der Änderung.', 'Tippe in die angezeigte Uhrzeit und gib 20:00 bzw. 00:30 ein. Bei einer Dauer kannst du die Zahl direkt eingeben und das Feld verlassen.', 'Öffne die App neu, prüfe die Werte und stelle deine eigenen Einstellungen anschließend wieder her.']
  if (id === 63) return ['Speichere unten bewusst „Teilweise“ mit einer kurzen Beobachtung. Öffne die App neu und wähle diesen Test erneut.', 'Öffne die verlinkte Einstellung und kehre mit dem Test-Banner zurück. Kontrolliere, dass weder Routine noch Spiel dadurch als erledigt markiert wurden.']
  return ['Öffne den passenden Bereich über die Knöpfe unten.', 'Führe den beschriebenen Versuch aus. Falls du dafür Einstellungen änderst, notiere vorher deine Werte und stelle sie danach wieder her.', 'Vergleiche deine Beobachtung mit der Erwartung und speichere dein Ergebnis. „Teilweise“ ist sinnvoll, wenn noch ein Teil offen ist.']
}

export default function DeviceTests() {
  const progress = useApp((s) => s.local.deviceTests)
  const saved = deviceTestsFromLocal({ deviceTests: progress })
  const [params, setParams] = useSearchParams()
  const [group, setGroup] = useState('Alle')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const platform = isNative() ? 'android' : 'web'
  const requested = Number(params.get('fall') ?? saved.activeId ?? 1)
  const visible = catalog.filter((test) => (group === 'Alle' || test.group === group) && (!onlyOpen || currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result !== 'passed'))
  const selected = visible.find((test) => test.id === requested) ?? visible[0]
  const passed = catalog.filter((test) => currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result === 'passed').length
  const select = (id: number) => setParams({ fall: String(id) })

  return <Page title="Gemeinsam testen" back="/mehr">
    <Card className="space-y-2">
      <p>Ein Versuch nach dem anderen. Du kannst jederzeit aufhören und später weitermachen.</p>
      <p className="text-sm text-muted">{passed} von {catalog.length} {platform === 'android' ? 'auf Android' : 'im Browser'} von dir als „Hat geklappt“ gemeldet. Frühere Geräteberichte werden hier nicht automatisch abgehakt.</p>
      {platform === 'web' && <p className="text-sm text-warm">Du bist in der Web-Version. Klingeln, Sperrbildschirm, Sensoren und Android-Druck lassen sich nur auf dem Handy prüfen. Deine Einträge hier bleiben Browserberichte.</p>}
    </Card>
    <Section title="Womit möchtest du anfangen?">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setGroup('Alle'); setOnlyOpen(false); select(1) }}>Erster Weckertest</Button>
        <Button onClick={() => { setGroup('Alle'); setOnlyOpen(false); select(53) }}>Weckfenster prüfen</Button>
        <Button onClick={() => { setGroup('Alle'); setOnlyOpen(false); select(62) }}>Zeiteingabe prüfen</Button>
      </div>
      <label className="block space-y-1"><span>Bereich</span><select aria-label="Testbereich" className={SELECT_CLASS} value={group} onChange={(e) => { setGroup(e.target.value); setParams({}) }}>
        {['Alle', ...new Set(catalog.map((test) => test.group))].map((name) => <option key={name}>{name}</option>)}
      </select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />Nur noch nicht bestandene Tests</label>
      <label className="block space-y-1"><span>Test auswählen</span><select aria-label="Test auswählen" className={SELECT_CLASS} value={selected?.id ?? ''} onChange={(e) => select(Number(e.target.value))}>
        <option value="" disabled>{visible.length ? 'Test auswählen' : 'Hier ist gerade nichts offen'}</option>
        {visible.map((test) => <option key={test.id} value={test.id}>{currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result === 'passed' ? '✓ ' : ''}{test.id}: {test.action}</option>)}
      </select></label>
    </Section>
    {selected ? <>
      <TestView key={selected.id} test={selected} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={selected === visible[0]} onClick={() => select(visible[Math.max(0, visible.indexOf(selected) - 1)]!.id)}>Vorheriger Test</Button>
        <Button disabled={selected === visible.at(-1)} onClick={() => select(visible[Math.min(visible.length - 1, visible.indexOf(selected) + 1)]!.id)}>Nächster Test</Button>
      </div>
    </> : <Card><p>In dieser Auswahl ist gerade nichts offen. Du kannst die Filter ändern oder für heute aufhören.</p></Card>}
    <Section title="Nachweise getrennt halten">
      <Card><p className="text-sm text-muted">Logik, Speicherung und Bedienwege werden zusätzlich automatisch geprüft. Das bestätigt keinen Ton und kein Vollbild auf deinem Handy. Hier setzt nur deine bewusste Rückmeldung einen Haken. Es gibt dafür weder Punkte noch Strafen.</p></Card>
      <ReportExport />
    </Section>
  </Page>
}

function TestView({ test }: { test: DeviceTestCase }) {
  const nav = useNavigate()
  const st = useApp()
  const progress = deviceTestsFromLocal(st.local)
  const report = progress.reports[test.id]
  const draft = progress.drafts?.[test.id]
  const native = isNative()
  const [note, setNote] = useState(draft?.note ?? report?.note ?? '')
  const [device, setDevice] = useState(draft?.device ?? progress.device ?? '')
  const [os, setOs] = useState(draft?.os ?? progress.os ?? '')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [comparison, setComparison] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(''); setStatus('')
    try { await action() } catch { setError('Das hat nicht geklappt. Es wurde kein Testerfolg eingetragen. Versuche es erneut.') } finally { setBusy(false) }
  }
  const saveDraft = () => st.saveDeviceTests((p) => ({ ...p, device, os, drafts: { ...p.drafts, [test.id]: { note, device, os } } }))
  const draftBlur = () => void saveDraft().catch(() => setError('Der Notizentwurf konnte nicht gespeichert werden. Bitte kopiere deinen Text vor dem Verlassen.'))
  const activate = async () => { await saveDraft(); await st.saveDeviceTests((p) => ({ ...p, activeId: test.id })) }
  const readAndroid = async () => {
    const d = await AnkerNative.getAlarmDiagnostics()
    setDevice((value) => value || d.device)
    setOs((value) => value || `Android-API ${d.sdk}; One UI noch nicht angegeben`)
    const before = progress.alarmBefore
    setComparison(`Jetzt: Hauptwecker ${d.scheduledAt ? fmtDateTime(d.scheduledAt) : 'nicht hinterlegt'}, Schlummerzähler ${d.snoozed}.${before ? ` Vor Teststart: ${before.mainAt ? fmtDateTime(before.mainAt) : 'nicht hinterlegt'}, Schlummerzähler ${before.snoozed}.` : ''} Das ist ein Planvergleich, noch kein bestandener Hörtest.`)
    await st.saveDeviceTests((p) => ({ ...p, device: device.trim() || d.device, os: os.trim() || `Android-API ${d.sdk}; One UI noch nicht angegeben` }))
  }
  const startTest = async () => {
    const state = await AnkerNative.getAlarmState()
    if (state.ringing) throw new Error('Ein Alarm klingelt bereits.')
    await st.saveDeviceTests((p) => ({ ...p, activeId: test.id, alarmBefore: { at: Date.now(), mainAt: state.scheduledAt ?? 0, preWakeAt: state.preWakeAt ?? 0, snoozed: state.snoozed } }))
    const result = await AnkerNative.testAlarm({ seconds: 10 })
    setStatus(`Separater Test angefordert für ${fmtDateTime(result.at)}. Sperre das Handy, wenn dieser Test das verlangt. Deine Beobachtung trägst du anschließend hier ein.`)
  }
  const saveResult = async (result: DeviceTestResult) => {
    const info = native ? await CapApp.getInfo().catch(() => ({ version: webVersion, build: 'Nicht ermittelt' })) : { version: webVersion, build: 'Web' }
    const next: DeviceTestReport = { result, note: note.trim(), at: Date.now(), platform: native ? 'android' : 'web', device: device.trim() || 'Nicht angegeben', os: os.trim() || 'Nicht angegeben', appVersion: info.version, build: info.build, suiteVersion: DEVICE_TEST_SUITE, buildFingerprint: BUILD_FINGERPRINT }
    await st.saveDeviceTests((p) => ({ ...p, activeId: test.id, device: device.trim(), os: os.trim(), reports: { ...p.reports, [test.id]: next } }))
    setStatus(`Deine Rückmeldung wurde gespeichert: ${TEST_RESULT_LABEL[result]}.`)
  }

  return <Section title={`Test ${test.id} · ${test.group}`}>
    <Card className="space-y-4">
      <h2 className="text-xl font-semibold">{test.action}</h2>
      {!native && HARDWARE_CASES.has(test.id) && <p className="text-sm text-warm">Dieser Versuch braucht ein echtes Android-Gerät. Ein Ergebnis im Browser bestätigt ihn dafür nicht.</p>}
      <div><p className="font-medium">Daran erkennst du, dass es klappt</p><p>{test.expected}</p></div>
      <ol className="list-decimal space-y-2 pl-5">{extraHelp(test.id).map((step) => <li key={step}>{step}</li>)}</ol>
      <p className="text-sm text-muted">Deine gespeicherte Standard-Aufstehzeit: {fmtTime(st.settings.anchor.wake)}. Einstellungen änderst du nur selbst; ein Test-Haken verändert weder Weckregel noch Routine oder Spielstand.</p>
      <div className="space-y-2">{linksFor(test.id).map((link) => <Row key={link.to} label={link.label} onClick={() => void run(async () => { await activate(); nav(link.to) })} />)}</div>
      {native && <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run(readAndroid)}>Android-Stand lesen</Button>
        {TEST_ALARM_CASES.has(test.id) && <Button disabled={busy} variant="primary" onClick={() => void run(startTest)}>Separaten Test in 10 Sekunden starten</Button>}
        {[14].includes(test.id) && <Button disabled={busy} onClick={() => void run(() => AnkerNative.openDndSettings())}>Nicht stören öffnen</Button>}
        {[15, 16, 17].includes(test.id) && <Button disabled={busy} onClick={() => void run(() => AnkerNative.openAlarmChannelSettings())}>Ton-Einstellungen öffnen</Button>}
        {test.id === 18 && <Button disabled={busy} onClick={() => void run(() => AnkerNative.openBatteryOptimizationSettings())}>Akku-Einstellungen öffnen</Button>}
      </div>}
      {comparison && <p role="status" className="text-sm text-muted">{comparison}</p>}
      {native && <details><summary className="min-h-11 py-2">Weckerdiagnose anzeigen</summary><AlarmDiagnosis /></details>}
    </Card>
    <Card className="space-y-3">
      <h2 className="text-lg font-medium">Deine Beobachtung</h2>
      <label className="block space-y-1"><span>Gerät (optional)</span><TextInput aria-label="Testgerät" value={device} placeholder="Zum Beispiel Galaxy S26 Ultra" onChange={(e) => setDevice(e.target.value)} onBlur={draftBlur} /></label>
      <label className="block space-y-1"><span>Android / One UI oder Browser (optional)</span><TextInput aria-label="Systemversion beim Test" value={os} placeholder="In den Systemeinstellungen unter Telefoninfo" onChange={(e) => setOs(e.target.value)} onBlur={draftBlur} /></label>
      <label className="block space-y-1"><span>Was hast du beobachtet? (optional)</span><textarea aria-label="Testbeobachtung" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={draftBlur} className="w-full rounded-xl bg-surface-2 p-3" /></label>
      <p className="text-sm text-muted">Deine Notiz bleibt beim Verlassen des Feldes als Entwurf gespeichert. Ein Entwurf setzt keinen Haken.</p>
      <p className="text-sm text-muted">Tippe erst nach deinem Versuch auf das passende Ergebnis. „Nicht relevant“ zählt nicht als bestanden.</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(TEST_RESULT_LABEL) as DeviceTestResult[]).map((result) => <Button key={result} disabled={busy} variant={result === 'passed' ? 'primary' : 'secondary'} onClick={() => void run(() => saveResult(result))}>{result === 'passed' ? '✓ ' : ''}{TEST_RESULT_LABEL[result]}</Button>)}</div>
      {report && <div className="space-y-2 text-sm">
        <p>{report.platform === 'android' ? 'Dein Android-Bericht' : 'Dein Browserbericht'}: {TEST_RESULT_LABEL[report.result]} · {fmtDateTime(report.at)} · App {report.appVersion} ({report.build}) · {report.device} · {report.os}</p>
        <p className="text-muted">Codestand: {report.buildFingerprint?.slice(0, 12) ?? 'Nicht ermittelt'}</p>
        {(report.suiteVersion !== DEVICE_TEST_SUITE || report.buildFingerprint !== BUILD_FINGERPRINT) && <p className="text-warm">Dieses Ergebnis gehört zu einem anderen Codestand. Es bleibt erhalten und zählt für diesen Stand als offen.</p>}
        <Button size="sm" disabled={busy} onClick={() => void run(async () => { await st.saveDeviceTests((p) => { const reports = { ...p.reports }; const drafts = { ...p.drafts }; delete reports[test.id]; delete drafts[test.id]; return { ...p, reports, drafts } }); setNote(''); setStatus('Nur dieser Testbericht wurde entfernt. Deine Alltagsdaten bleiben erhalten.') })}>Diesen Test wieder öffnen</Button>
      </div>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert" className="text-warm">{error}</p>}
      {progress.activeId !== undefined && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await st.saveDeviceTests((p) => ({ ...p, activeId: undefined })); setStatus('Testbegleitung pausiert. Deine Ergebnisse bleiben gespeichert.') })}>Testbegleitung pausieren</Button>}
    </Card>
  </Section>
}

function ReportExport() {
  const progress = useApp((s) => s.local.deviceTests)
  const [message, setMessage] = useState('')
  return <>
    <Button onClick={async () => {
      try { await saveFile('anker-testberichte.json', JSON.stringify({ app: 'anker', exportedAt: new Date().toISOString(), reports: progress?.reports ?? {} }, null, 2), 'application/json'); setMessage('Datei an den Download bzw. das Teilen-Menü übergeben. Du entscheidest, ob du sie weitergibst.') }
      catch { setMessage('Export nicht abgeschlossen. Deine Berichte bleiben in der App.') }
    }}>Testberichte als Datei exportieren</Button>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </>
}
