import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { defaultPcBridgeLocal, isPcAck, pcConnectionText, type PcAck, type PcBridgeLocal, type PcCommandPayload, type PcLinkPreferences, type PcPhase } from '../../core/pcLink'
import { guidancePreferences } from '../../core/guidance'
import { requestEmergencyExtensionByQr } from '../../platform/guidance'
import { isNative } from '../../platform/native'
import { discoverPcCompanions, getPcBridgePreview, getPcBridgeView, pairPcCompanion, sendPcBridgeCommand, startPcCompanion, stopPcCompanion, syncPcBridge, unpairPcCompanion, updatePcBridgePreferences } from '../../platform/pcLink'
import { scanQr } from '../../platform/qr'
import { useApp } from '../../state/store'
import { Button, Card, Choice, MoreInfo, Section, SettingRow, Stepper, TextInput, Toggle } from '../components/ui'

type BridgeView = Awaited<ReturnType<typeof getPcBridgeView>>
type Discovery = Awaited<ReturnType<typeof discoverPcCompanions>>
type Preview = Awaited<ReturnType<typeof getPcBridgePreview>>
const time = (value: string) => new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const WARNING_TEXT: Record<PcAck['warnings'][number] | 'link-stale', string> = {
  'clock-skew': 'Die Uhren von Handy und PC passen noch nicht zusammen. Prüfe die automatische Uhrzeit.',
  'local-enforcement-off': 'Am PC ist die lokale Ausführung noch nicht freigegeben. Eine App-Auswahl allein sperrt ihn nicht.',
  'legacy-conflict': 'Das klassische Windows-Paket ist noch aktiv. Der lokale Begleiter führt deshalb keine zusätzliche Sperre aus.',
  'source-expired': 'Der übernommene Plan ist abgelaufen. Öffne Anker für einen neuen Abgleich.',
  'no-schedule': 'Der PC hat für diesen Tag keine feste Zeit übernommen.',
  'morning-deadline-reached': 'Das vorbereitete Morgenfenster ist zu Ende. Die weitere Freigabe richtet sich nach deiner PC-Einstellung.',
  'pairing-required': 'Die Kopplung muss am Handy erneut bestätigt werden.',
  'link-stale': 'Handy gerade nicht erreichbar. Der PC folgt deiner gewählten Offline-Regel.',
}
const PHASE_TEXT: Record<PcPhase, string> = {
  IDLE: 'Ruhig', DAY_ACTIVE: 'Alltag', MORNING_PENDING: 'Morgenbeginn bereit', MORNING_ACTIVE: 'Morgenroutine läuft', MORNING_COMPLETED: 'Morgenroutine tatsächlich abgeschlossen',
  ZOMBIE_MODE: 'Kleine Morgenroutine', EVENING_WIND_DOWN: 'Abendübergang', WIND_DOWN_T30: 'Abend vorbereiten', BRAIN_DUMP_T10: 'Gedanken für morgen parken',
  BEDTIME_HARD_CUT: 'Abend abschließen', NIGHT_LOCK: 'Gewählte Nachtbegleitung', ALARM_RINGING: 'Wecker klingelt',
}
const MODE_TEXT: Record<PcAck['effective']['mode'], string> = {
  scheduled: 'Stoppzeit übernommen', paused: 'ohne festen Stopp', 'suspended-today': 'für heute ausgesetzt',
  'legacy-conflict': 'klassisches Paket hat Vorrang', locked: 'Sperre gemeldet', released: 'Morgenfreigabe gemeldet',
}

/** LAN pairing and preferences extend the existing PC page; they do not replace its classic export. */
export function PcCompanionPanel() {
  const st = useApp()
  const local = st.local.pcBridge ?? defaultPcBridgeLocal()
  const guidance = guidancePreferences(st.settings.guidance)
  const strict = guidance.enabled && guidance.pcLock
  const native = isNative()
  const [view, setView] = useState<BridgeView>()
  const [discovery, setDiscovery] = useState<Discovery>()
  const [preview, setPreview] = useState<Preview>()
  const [pairing, setPairing] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const [wol, setWol] = useState(() => local.wakeOnLan ?? { enabled: false, mac: '', broadcast: '255.255.255.255' })
  const refresh = async () => { if (native) setView(await getPcBridgeView()) }

  useEffect(() => {
    if (!native) return
    let alive = true
    let running = false
    const load = async () => {
      if (running) return
      running = true
      try { const next = await getPcBridgeView(); if (alive) setView(next) }
      catch { if (alive) setError('Der PC-Status konnte gerade nicht gelesen werden. Es wird kein Empfang bestätigt.') }
      finally { running = false }
    }
    const visible = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    const interval = window.setInterval(visible, 3000)
    document.addEventListener('visibilitychange', visible)
    return () => { alive = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', visible) }
  }, [native])

  const run = async (action: () => Promise<unknown>, success?: string) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try { await action(); if (success) setMessage(success) }
    catch { setError('Das hat noch nicht geklappt. Prüfe den Begleiter am PC und versuche es erneut. Deine bisherigen Einstellungen bleiben erhalten.') }
    finally {
      try { await refresh() } catch { /* No status is promoted to a confirmed receipt on failure. */ }
      pending.current = false; setBusy(false)
    }
  }
  const preferences = (patch: Partial<PcLinkPreferences>) => void run(() => updatePcBridgePreferences(patch), 'Auswahl gespeichert. Der Empfang am PC wird getrennt bestätigt.')
  const saveLocal = (patch: Partial<PcBridgeLocal>) => st.saveLocal(current => ({ ...current, pcBridge: { ...(current.pcBridge ?? defaultPcBridgeLocal()), ...patch } }))
  const command = (action: PcCommandPayload['action'], minutes?: number) => void run(async () => {
    const result = await sendPcBridgeCommand(action, minutes)
    setMessage(result.confirmed ? 'Der PC hat diese Anfrage bestätigt.' : 'Angefragt. Vom PC ist noch keine Bestätigung eingegangen.')
  })
  const connect = async (raw: string) => {
    try { await pairPcCompanion(raw) } finally { setPairing('') }
  }
  const ack = isPcAck(view?.ack) ? view.ack : isPcAck(local.ack) ? local.ack : undefined
  const paired = view ? !['unpaired', 'pairing', 'rejected'].includes(view.state) : local.status !== 'unpaired'
  const connected = native && view?.connected === true
  const confirmation = native && view ? view.confirmationText : native
    ? local.ack ? 'Eine gespeicherte PC-Antwort liegt vor. Der aktuelle Empfang wird geprüft.' : 'Für den aktuellen Plan liegt hier noch keine PC-Bestätigung vor.'
    : 'Die Web-Vorschau bestätigt weder eine Verbindung noch den Empfang am PC.'

  return <section className="min-w-0 space-y-3" aria-label="Lokaler PC-Begleiter">
    <h2 className="text-xl font-semibold">Lokaler PC-Begleiter</h2>
    <p className="text-sm text-muted">Direkt im gemeinsamen WLAN, ohne Konto. Kopplung und Übertragung sind freiwillig; das klassische Windows-Paket bleibt unten erreichbar.</p>
    {!native && <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted" role="status">Web-Vorschau: Koppeln, Live-Verbindung und PC-Befehle funktionieren in der Android-App. Du kannst die Optionen hier vorbereiten.</p>}
    <Card className="min-w-0 space-y-3">
      <h3 className="break-words font-semibold">{view?.pcName ?? local.pcName ?? 'Dein Windows-PC'}</h3>
      <p className="text-sm text-muted">{native && view ? pcConnectionText({ ...local, ack, status: view.state === 'connected' ? view.currentConfirmation ? 'confirmed' : 'paired-never-reached' : view.state === 'pairing' ? 'paired-never-reached' : view.state }) : native ? 'Verbindung wird geprüft.' : 'Keine Live-Verbindung in dieser Vorschau.'}</p>
      <dl className="space-y-2 text-sm">
        <div className="space-y-1"><dt className="font-medium">Live-Verbindung</dt><dd className="break-words text-muted">{connected ? 'Jetzt verbunden' : native ? 'Gerade nicht verbunden' : 'Nur auf Android verfügbar'}</dd></div>
        <div className="space-y-1"><dt className="font-medium">Aktueller Plan am PC</dt><dd className="break-words text-muted" data-confirmed={view?.currentConfirmation === true && native}>{confirmation}</dd></div>
      </dl>
      {native && paired && <SettingRow label={<><span>Lokale Verbindung nutzen</span><p className="text-sm text-muted">Ausschalten beendet die Verbindung am Handy. Einen zuvor übernommenen PC-Plan hebt es nicht rückwirkend auf.</p></>}><Toggle label="Lokale PC-Verbindung nutzen" checked={local.enabled} onChange={enabled => void run(enabled ? startPcCompanion : stopPcCompanion, enabled ? 'Verbindung angefragt.' : 'Verbindung am Handy beendet. Den zuletzt übernommenen Plan prüfst du am PC.')} /></SettingRow>}
      {ack && <MoreInfo summary="Letzte PC-Antwort ansehen"><div className="space-y-2 text-sm text-muted">
        <p>Antwort vom {time(ack.receivedAt)} · {MODE_TEXT[ack.effective.mode]}{ack.effective.stopAt ? `: ${time(ack.effective.stopAt)}` : ''}.</p>
        <p>Das ist eine Empfangsbestätigung des Begleiters, kein Nachweis, dass du den PC bereits ausgeschaltet hast.</p>
        {ack.warnings.map(warning => <p key={warning}>{WARNING_TEXT[warning]}</p>)}
      </div></MoreInfo>}
      {native && view?.active && <p className="text-sm text-muted">Der Verbindungsdienst am Handy ist aktiv. Das allein bestätigt keinen Empfang.</p>}
      <Button className="w-full" disabled={!native || !local.enabled || busy} onClick={() => void run(async () => {
        await syncPcBridge()
        const next = await getPcBridgeView()
        setView(next)
        setMessage(next.currentConfirmation ? 'Der PC bestätigt den aktuellen Plan.' : 'Abgleich angefragt. Der aktuelle Plan ist vom PC noch nicht bestätigt.')
      })}>Jetzt abgleichen</Button>
    </Card>

    <MoreInfo summary="Was weiß dein PC?"><div className="space-y-3">
      <p className="text-sm text-muted">Diese lokale Vorschau verwendet genau den vorbereiteten Übertragungsplan. Sie sendet nichts und bestätigt keinen Empfang. Aufgaben- und Routinenschritttitel gehören nicht zu diesem Plan.</p>
      <Button className="w-full" disabled={busy} onClick={() => void run(async () => { setPreview(await getPcBridgePreview()) })}>{preview ? 'Lokale Vorschau aktualisieren' : 'Lokale Vorschau anzeigen'}</Button>
      {preview && <>
        <p className="text-sm text-muted">Vorbereitet am {time(preview.state.generatedAt)} · {PHASE_TEXT[preview.state.state]}{preview.state.routineStep ? ` · Schritt ${preview.state.routineStep.index + 1} von ${preview.state.routineStep.total}` : ''}.</p>
        <p className="text-sm text-muted">PC-Eingriffe {preview.state.prefs.enforceEnabled ? 'freigegeben' : 'aus'} · Abdunklung {preview.state.prefs.dimEnabled ? 'freigegeben' : 'aus'} · Audio {preview.state.prefs.audioDuck ? 'freigegeben' : 'aus'} · Abendnotiz {preview.state.prefs.shareBrainDump ? 'zur Übertragung freigegeben' : 'bleibt auf dem Handy'}.</p>
        <p className="text-sm text-muted">{preview.state.prefs.bedtimeSequence ? 'Die Drei-Phasen-Begleitung folgt deiner Bettzeit: 30 und 10 Minuten vorher, danach deine Speicherfrist. Deine normale PC-Stoppzeit bleibt für den klassischen Weg erhalten.' : 'Der PC-Begleiter folgt deiner PC-Stoppzeit mit Vorhinweisen und anschließender Speicherfrist.'}</p>
        {preview.state.prefs.ifThen && <blockquote className="break-words border-l-2 border-line pl-3 text-sm">Dein freigegebener Wenn-dann-Satz: {preview.state.prefs.ifThen}</blockquote>}
        {preview.state.brainDump && <blockquote className="space-y-1 break-words border-l-2 border-line pl-3 text-sm"><p>Freigegebene Abendnotiz: {preview.state.brainDump.text}</p>{preview.state.brainDump.nextStep && <p>Nächster Schritt: {preview.state.brainDump.nextStep}</p>}</blockquote>}
        <ol className="space-y-3" aria-label="Vorbereitete PC-Tage">{preview.briefing.days.map(day => <li key={day.date} className="min-w-0 rounded-xl border border-line p-3">
          <h3 className="break-words font-medium">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' })}</h3>
          <dl className="mt-2 space-y-2 text-sm">{[
            ['PC-Stopp', day.pc.mode === 'paused' ? 'ohne festen Stopp' : day.pc.stopAt ? time(day.pc.stopAt) : 'noch ohne Zeit'],
            ['Speicherfrist am PC ab', day.pc.mode === 'paused' ? 'ohne festen Stopp' : preview.state.prefs.bedtimeSequence ? day.bedAt ? time(day.bedAt) : 'offen' : day.pc.stopAt ? time(day.pc.stopAt) : 'noch ohne Zeit'],
            ['Bett', day.bedAt ? time(day.bedAt) : 'offen'], ['Aufstehen', day.wakeAt ? time(day.wakeAt) : 'ohne festen Wert'],
            ['Plan gültig bis', time(day.validUntil)],
          ].map(([label, value]) => <div key={label} className="space-y-1"><dt className="font-medium">{label}</dt><dd className="break-words text-muted">{value}</dd></div>)}
            {day.morning && <div className="space-y-1"><dt className="font-medium">Freigegebene Morgenzeiten</dt><dd className="break-words text-muted">{day.morning.homeOffice ? 'Homeoffice' : 'Kein Homeoffice'}{day.morning.leaveAt ? ` · Losgehen ${time(day.morning.leaveAt)}` : ''}{day.morning.workStartAt ? ` · Arbeitsbeginn ${time(day.morning.workStartAt)}` : ''}</dd></div>}
          </dl>
        </li>)}</ol>
      </>}
    </div></MoreInfo>

    <MoreInfo summary={paired ? 'PC-Kopplung verwalten' : 'PC erstmals koppeln'}>
      <div className="min-w-0 space-y-3">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted"><li>Den neuen Windows-Begleiter aus dem Repository einrichten und dort die Kopplung öffnen.</li><li>Handy und PC ins gleiche private WLAN bringen.</li><li>Den kurz gültigen QR-Code am PC mit Anker scannen. Ein gefundener PC allein gilt noch nicht als vertrauenswürdig.</li></ol>
        <Button className="w-full" disabled={!native || busy} onClick={() => void run(async () => {
          const result = await scanQr()
          if (result.ok) { await connect(result.value); setMessage('Kopplung angefragt. Die erste PC-Antwort wird separat geprüft.') }
          else if (result.reason !== 'cancelled') setError('Der QR-Scanner ist noch nicht verfügbar. Versuche es erneut oder füge den Kopplungscode geschützt ein.')
        })}>Kopplungs-QR am PC scannen</Button>
        <MoreInfo summary="Kopplungscode geschützt einfügen"><form className="space-y-3" onSubmit={event => { event.preventDefault(); if (pairing.trim()) void run(() => connect(pairing.trim()), 'Kopplung angefragt. Der Empfang wird separat geprüft.') }}>
          <p className="text-sm text-muted">Nur den kurz gültigen Code vom eigenen PC einfügen. Er wird verdeckt angezeigt und nach dem Versuch aus diesem Feld gelöscht.</p>
          <TextInput type="password" aria-label="Geschützter PC-Kopplungscode" autoComplete="off" spellCheck={false} maxLength={8192} value={pairing} onChange={event => setPairing(event.target.value)} disabled={!native || busy} />
          <Button type="submit" className="w-full" disabled={!native || busy || !pairing.trim()}>Diesen PC koppeln</Button>
        </form></MoreInfo>
        <Button className="w-full" disabled={!native || busy} onClick={() => void run(async () => { setDiscovery(await discoverPcCompanions()) })}>PCs im WLAN suchen</Button>
        {discovery && <div role="status" className="space-y-2 text-sm text-muted">{!discovery.available ? <p>Die automatische Suche ist hier nicht verfügbar. Die QR-Kopplung bleibt möglich.</p> : discovery.services.length ? <><p>Gefunden, noch nicht gekoppelt:</p><ul className="list-disc pl-5">{discovery.services.map((service, index) => <li key={`${service.name}:${index}`} className="break-words">{service.name}</li>)}</ul></> : <p>Gerade kein Begleiter gefunden. Prüfe WLAN, Begleiter und die private Windows-Firewallfreigabe.</p>}</div>}
        {paired && <MoreInfo summary="Kopplung aufheben"><div className="space-y-3"><p className="text-sm text-muted">Die Schlüssel am Handy werden entfernt. Der zuvor bestätigte Plan kann am PC weiter gelten; dort kannst du die Kopplung ebenfalls aufheben.</p><Button className="w-full" disabled={!native || busy} onClick={() => void run(unpairPcCompanion, 'Kopplung am Handy aufgehoben. Prüfe einen zuvor übernommenen Plan am PC.')}>Kopplung am Handy entfernen</Button></div></MoreInfo>}
      </div>
    </MoreInfo>

    <MoreInfo summary="Hilfen und Freigaben für diesen PC">
      <div className="space-y-4">
        <p className="text-sm text-muted">Alle Hilfen beginnen ausgeschaltet. Deine Auswahl muss der PC übernehmen und dort für die Ausführung freigegeben sein.</p>
        <SettingRow label={<><span>PC-Eingriffe erlauben</span><p className="text-sm text-muted">Zusätzlich zur Verbindung: Erst diese Wahl und die lokale Freigabe am PC erlauben Abendaktionen. Die letzte PC-Antwort zeigt offene Freigaben.</p></>}><Toggle label="PC-Eingriffe erlauben" checked={local.preferences.enforceEnabled} onChange={enforceEnabled => preferences({ enforceEnabled })} /></SettingRow>
        <SettingRow label="PC-Lautstärke im Abendübergang senken"><Toggle label="PC-Audio schrittweise senken" checked={local.preferences.audioDuck} onChange={audioDuck => preferences({ audioDuck })} /></SettingRow>
        <SettingRow label="Bildschirm behutsam abdunkeln"><Toggle label="PC-Abdunklung erlauben" checked={local.preferences.dimEnabled} onChange={dimEnabled => preferences({ dimEnabled })} /></SettingRow>
        {local.preferences.dimEnabled && <SettingRow label="Höchste Abdunklung"><Stepper label="Maximale PC-Abdunklung" value={Math.round(local.preferences.dimMax * 100)} min={0} max={40} step={5} unit="%" onChange={dimMax => preferences({ dimMax: dimMax / 100 })} /></SettingRow>}
        <SettingRow label={<><span>Abendnotiz am Morgen auf dem PC zeigen</span><p className="text-sm text-muted">Nur mit dieser Freigabe wird der private Text an den gekoppelten PC übertragen.</p></>}><Toggle label="Brain-Dump mit dem PC teilen" checked={local.preferences.shareBrainDump} onChange={shareBrainDump => preferences({ shareBrainDump })} /></SettingRow>
        <SettingRow label="Morgenzeit am PC sichtbar machen"><Toggle label="Morgen-Countdown auf dem PC" checked={local.preferences.morningCountdown} onChange={morningCountdown => preferences({ morningCountdown })} /></SettingRow>
        <SettingRow label={<><span>Beobachtete PC-Pausen lokal übernehmen</span><p className="text-sm text-muted">Eine PC-Pause ist kein Nachweis für Bettzeit oder Schlaf.</p></>}><Toggle label="Beobachtete PC-Pausen übernehmen" checked={local.automaticRestEvents} onChange={automaticRestEvents => void run(() => saveLocal({ automaticRestEvents }), 'Auswahl gespeichert.')} /></SettingRow>
        <Section title="Abendabschluss">
          <p className="text-sm text-muted">{strict ? 'Strenge Begleitung am Handy ist gewählt. Erst die bestätigte Freigabe am PC macht daraus eine ausgeführte Sperre.' : 'Eine PC-Sperre ist derzeit nicht durch die Abend- und Morgenbegleitung aktiviert.'}</p>
          <Link to="/einstellungen/begleitung" className="flex min-h-11 items-center text-accent">Strengen PC-Abend in der Begleitung einstellen</Link>
          <Choice label="Aktion nach dem Speicherfenster" value={local.preferences.stopAction} options={[{ value: 'lock', label: 'Windows sperren' }, { value: 'hibernate', label: 'Ruhezustand' }, { value: 'shutdown', label: 'Herunterfahren' }]} onChange={stopAction => preferences({ stopAction })} />
          {local.preferences.stopAction === 'shutdown' && <p className="text-sm text-warm">Beim Herunterfahren können Programme das Speichern offener Dateien verlangen. Vorher bleibt das gewählte Speicherfenster; Anker erzwingt kein Schließen deiner Programme.</p>}
          <SettingRow label="Zeit zum Speichern vor der Aktion"><Stepper label="PC-Speicherfenster" value={local.preferences.graceSeconds} min={60} max={600} step={30} unit="s" onChange={graceSeconds => preferences({ graceSeconds })} /></SettingRow>
          <Choice label="Wenn das Handy nicht erreichbar ist" value={local.preferences.offlinePolicy} options={[{ value: 'pause', label: 'Ausführung pausieren' }, { value: 'fixed-time', label: 'Letzten gültigen Plan nutzen' }]} onChange={offlinePolicy => preferences({ offlinePolicy })} />
          <p className="text-sm text-muted">Ein abgelaufener oder nie bestätigter Plan wird dadurch nicht zu einer neuen Stoppzeit. Die Windows-Seite zeigt dir, was sie tatsächlich ausführt.</p>
        </Section>
      </div>
    </MoreInfo>

    <MoreInfo summary="Verbindung ausprobieren und heute anpassen"><div className="space-y-3">
      <p className="text-sm text-muted">Jede Anfrage braucht eine eigene PC-Antwort. Ein Tipp allein bestätigt noch keine Ausführung.</p>
      <Button className="w-full" disabled={!connected || busy} onClick={() => command('ping')}>PC-Verbindung prüfen</Button>
      {!strict ? <>
        <Button className="w-full" disabled={!connected || busy} onClick={() => command('test-evening')}>Abendhinweis am PC ausprobieren</Button>
        <Button className="w-full" disabled={!connected || busy} onClick={() => command('extend', 15)}>PC-Stopp heute 15 Minuten später anfragen</Button>
        <Button className="w-full" disabled={!connected || busy} onClick={() => command('suspend-today')}>PC-Ausführung für heute aussetzen</Button>
        <Button className="w-full" disabled={!connected || busy} onClick={() => command('resume-today')}>PC-Ausführung für heute wieder aufnehmen</Button>
      </> : <><p className="text-sm text-muted">Bei strenger Begleitung bestätigt dein Anker-QR eine Notverlängerung am Handy.</p><Button className="w-full" disabled={!native || busy} onClick={() => void run(async () => { const ok = await requestEmergencyExtensionByQr(15); if (ok) setMessage('Notverlängerung angefragt. Die Übernahme muss der PC noch bestätigen.') })}>15 Minuten per Anker-QR verlängern</Button></>}
    </div></MoreInfo>

    <MoreInfo summary="PC nach dem Morgen per Wake-on-LAN wecken"><form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      const mac = wol.mac.trim()
      const broadcast = wol.broadcast.trim()
      if (wol.enabled && (!/^(?:[\da-f]{2}[:-]){5}[\da-f]{2}$/i.test(mac) || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(broadcast) || !broadcast.split('.').every(part => Number(part) <= 255))) {
        setError('Bitte trage eine MAC-Adresse wie AA:BB:CC:DD:EE:FF und eine gültige IPv4-Broadcast-Adresse ein. Noch nichts wurde geändert.'); return
      }
      void run(() => st.saveLocal(current => ({ ...current, pcBridge: { ...(current.pcBridge ?? defaultPcBridgeLocal()), wakeOnLan: { ...current.pcBridge?.wakeOnLan, enabled: wol.enabled, mac, broadcast } } })), 'Wake-on-LAN-Auswahl gespeichert. Eine Reaktion des PCs ist damit noch nicht bestätigt.')
    }}>
      <p className="text-sm text-muted">Optional einmal nach der tatsächlich abgeschlossenen Morgenroutine. Dein PC muss Wake-on-LAN unterstützen und dafür eingerichtet sein; ein gesendetes Paket bestätigt keinen Start.</p>
      <SettingRow label="PC nach der Morgenroutine wecken"><Toggle label="Wake-on-LAN erlauben" checked={wol.enabled} onChange={enabled => setWol(value => ({ ...value, enabled }))} /></SettingRow>
      <label className="block space-y-1"><span>MAC-Adresse des PCs</span><TextInput aria-label="Wake-on-LAN MAC-Adresse" autoComplete="off" value={wol.mac} maxLength={17} onChange={event => setWol(value => ({ ...value, mac: event.target.value }))} /></label>
      <label className="block space-y-1"><span>Broadcast-Adresse im Heimnetz</span><TextInput aria-label="Wake-on-LAN Broadcast-Adresse" inputMode="decimal" autoComplete="off" value={wol.broadcast} maxLength={15} onChange={event => setWol(value => ({ ...value, broadcast: event.target.value }))} /></label>
      <Button type="submit" className="w-full" disabled={busy}>Wake-on-LAN-Auswahl übernehmen</Button>
    </form></MoreInfo>
    {message && <p role="status" className="break-words text-sm text-muted">{message}</p>}
    {error && <p role="alert" className="break-words text-sm text-warm">{error}</p>}
  </section>
}
