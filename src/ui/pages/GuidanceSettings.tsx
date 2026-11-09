import { useState } from 'react'
import { guidancePreferences, type GuidancePreferences, type IfThenPlan } from '../../core/guidance'
import { useApp } from '../../state/store'
import { Button, Card, MoreInfo, Page, Row, Section, SettingRow, Stepper, TextInput, Toggle, notifySaved } from '../components/ui'

type Flag = { [K in keyof GuidancePreferences]: GuidancePreferences[K] extends boolean ? K : never }[keyof GuidancePreferences]

export default function GuidanceSettings() {
  const st = useApp()
  const preferences = guidancePreferences(st.settings.guidance)
  const [error, setError] = useState('')
  const save = async (patch: Partial<GuidancePreferences>) => {
    setError('')
    try { await st.saveSettings(settings => ({ ...settings, guidance: { ...guidancePreferences(settings.guidance), ...patch } })); notifySaved() }
    catch { setError('Die Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.') }
  }
  const flag = (key: Flag, label: string, detail?: string) => <SettingRow label={<><span className="font-medium">{label}</span>{detail && <p className="mt-1 text-sm text-muted">{detail}</p>}</>}>
    <Toggle label={label} checked={preferences[key]} onChange={value => void save({ [key]: value })} />
  </SettingRow>
  return <Page className="settings-page" title="Abend & Morgen begleiten" back="/einstellungen">
    <Card className="space-y-3">
      {flag('enabled', 'Begleitung einschalten', 'Du wählst die einzelnen Hilfen selbst. Ausschalten erhält deine Routinen und Notizen.')}
      {!preferences.enabled && <p className="text-sm text-muted">Die Auswahl unten ist vorbereitet. Erst mit eingeschalteter Begleitung wird sie aktiv.</p>}
    </Card>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <Section title="Zeit sichtbar machen">
      <Card className="space-y-4">
        {flag('circadianUi', 'Farben an Abend und Morgen anpassen', 'Kühles Cyan am Morgen, warme Farben am Abend und OLED-Schwarz mit gedimmtem Rot im Nacht- und Zombie-Modus.')}
        {flag('depletionColors', 'Fokuszeit mit Farbverlauf zeigen', 'Der bestehende Zeitring wechselt beim Leerlaufen von Grün über Bernstein zu Rot. Eine abgelaufene Zeit erledigt keinen Schritt.')}
        {flag('timeArc', 'Zeitbogen auf Jetzt', 'In der letzten Stunde vor PC-Stopp, Bett oder Losgehen. Die Anzeige lässt sich unabhängig wieder ausblenden.')}
      </Card>
    </Section>
    <Section title="Schritt für Schritt">
      <Card className="space-y-4">
        {flag('paceKeeper', 'Routine mit Vibrationsimpulsen begleiten', 'Nur für eine laufende Routine. Pause, Stopp und Wecker haben Vorrang.')}
        {preferences.paceKeeper && <SettingRow label="Abstand der Impulse"><Stepper label="Pacekeeper Abstand" value={preferences.paceIntervalMin} unit="min" min={1} max={10} step={1} onChange={paceIntervalMin => void save({ paceIntervalMin })} /></SettingRow>}
        {flag('paceThresholds', 'Auch bei 50, 25 und 10 Prozent Restzeit vibrieren')}
        {flag('speakSteps', 'Routinenschritte lokal vorlesen', 'Die lokale Android-Stimme liest den privaten Schritttitel und die Zeit laut. Keine Cloud-Stimme und keine Tonaufnahme.')}
        <MoreInfo><p className="text-sm text-muted">Ein laufender Android-Dienst bleibt als Meldung sichtbar. Lokale Stimme, Hintergrundimpulse und Lautstärke müssen auf deinem Handy geprüft werden. Ohne verfügbare Stimme bleibt der sichtbare Schritt bestehen.</p></MoreInfo>
      </Card>
    </Section>
    <Section title="Morgenstart">
      <Card className="space-y-4">
        {flag('zeroGapMorning', 'Nach dem Wecker direkt mit Countdown beginnen', 'Nach dem bestätigten Hauptwecker startet der erste offene Schritt derselben Morgenroutine.')}
        {flag('preWakeFadeIn', 'Vorwecker sanft einblenden', 'Verwendet deinen vorhandenen Vorwecker. Seine Lautstärke wird innerhalb des Tons angehoben; die Systemlautstärke bleibt deine Wahl.')}
        <Button className="w-full" onClick={async () => {
          setError('')
          try { await st.saveSettings(settings => ({ ...settings, alarm: { ...settings.alarm, preWakeEnabled: true, preWakeLeadMinutes: 10 }, guidance: { ...guidancePreferences(settings.guidance), preWakeFadeIn: true } })); notifySaved() }
          catch { setError('Der sanfte Vorwecker konnte noch nicht gespeichert werden.') }
        }}>10 Minuten sanft vorher wählen</Button>
        {flag('antiRelapse', 'Nach dem Wecker Wachsein bestätigen', 'Nach der gewählten Zeit bestätigst du mit einem Tipp. Ohne Bestätigung kann der Hauptwecker erneut klingeln.')}
        {preferences.antiRelapse && <SettingRow label="Nach dem Wecker"><Stepper label="Wachsein bestätigen nach" value={preferences.antiRelapseMinutes} min={1} max={30} step={1} unit="min" onChange={antiRelapseMinutes => void save({ antiRelapseMinutes })} /></SettingRow>}
        {flag('autoZombie', 'Ohne erste Rückmeldung zur kleinen Routine wechseln', 'Der automatisch gestartete Timer beweist keinen tatsächlichen Beginn. Erst dein Tipp zählt als Rückmeldung.')}
        {preferences.autoZombie && <SettingRow label="Ohne Rückmeldung nach"><Stepper label="Zombie Rückfall nach" value={preferences.autoZombieAfterSeconds} min={10} max={600} step={10} unit="s" onChange={autoZombieAfterSeconds => void save({ autoZombieAfterSeconds })} /></SettingRow>}
        <Row label="Kernschritte für den Zombie-Modus wählen" sub="In den Details deiner Morgenroutine" to="/einstellungen/routinen#morning" />
      </Card>
      <MorningLightSuggestion />
    </Section>
    <Section title="Abend und Bett">
      <Card className="space-y-4">
        {flag('eveningEscalation', 'Abend in drei Phasen begleiten', '30 Minuten vorher ankommen, 10 Minuten vorher Gedanken parken, zur Bettzeit den nächsten Schritt zeigen. Ein offenes Ende pausiert die zeitgesteuerten Phasen.')}
        {flag('eveningLight', 'An warmes Abendlicht erinnern', 'Ein leiser Hinweis vor deiner geplanten Bettzeit, ohne automatische Lichtsteuerung. Ein gewählter Abendübergang oder die Drei-Phasen-Begleitung ersetzt ihn.') }
        {preferences.eveningLight && <SettingRow label="Vor der Bettzeit"><Stepper label="Abendlicht vorher" value={preferences.eveningLightLeadMinutes} min={15} max={240} step={15} unit="min" onChange={eveningLightLeadMinutes => void save({ eveningLightLeadMinutes })} /></SettingRow>}
        {flag('suppressPhonePcWhenConfirmed', 'Bestätigten PC-Stopp am Handy leiser halten', 'Nur die PC-Stopp-Hinweise entfallen, solange der PC den heutigen aktuellen Plan frisch bestätigt und verbunden bleibt. Ohne passenden Beleg erscheinen sie wieder; Bettzeit und Wecker bleiben erhalten.') }
        {flag('bedtimeQr', 'Abend mit meinem Anker-QR bestätigen', 'Der Scan bestätigt deinen Übergang. Er behauptet nicht, dass du schon schläfst oder im Bett liegst.')}
        {flag('sleepNoise', 'Nach der Abendbestätigung Brown Noise abspielen', 'Lokal erzeugtes leises Rauschen, das bis zum Ende linear ausblendet. Jederzeit stoppbar.')}
        {preferences.sleepNoise && <SettingRow label="Rauschen ausblenden über"><Stepper label="Schlafrauschen Dauer" value={preferences.sleepNoiseMinutes} min={1} max={60} step={5} unit="min" onChange={sleepNoiseMinutes => void save({ sleepNoiseMinutes })} /></SettingRow>}
        {flag('pcLock', 'Strengen PC-Abend vorbereiten', 'Die Sperre braucht zusätzlich einen gekoppelten und ausdrücklich dafür freigegebenen PC-Begleiter. Die Notverlängerung bestätigst du am Handy per QR.')}
      </Card>
      <IfThenEditor />
      <Row label="Rhythmus-Woche ansehen" sub="Geplant und tatsächlich, ohne Wertung" to="/rhythmus" />
      <Row label="PC-Begleiter öffnen" to="/pc-stopp" />
    </Section>
  </Page>
}

export function MorningLightSuggestion() {
  const st = useApp()
  const choice = st.local.guidance?.lightSuggestion
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (choice || st.settings.routines.morning.some(step => step.id === 'light')) return null
  const choose = async (accept: boolean) => {
    setBusy(true); setError('')
    try { await st.chooseMorningLight(accept); notifySaved() }
    catch { setError('Deine Auswahl konnte noch nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return <Card className="space-y-3">
    <h3 className="font-semibold">Ein Licht-Schritt für deinen Morgen?</h3>
    <p className="text-sm text-muted">Vorhang auf, ans Fenster oder kurz nach draußen. Die kleine Version ist „Vorhang auf, Licht an“.</p>
    <MoreInfo><p className="text-sm text-muted">Morgenlicht ist eine plausible Alltagshilfe. Kleine Studien sind kein Wirkungsnachweis für Anker und keine persönliche Therapieempfehlung. Der Schritt wird nur auf deinen Tipp hinzugefügt.</p></MoreInfo>
    <div className="grid grid-cols-2 gap-2"><Button disabled={busy} onClick={() => void choose(true)}>Hinzufügen</Button><Button disabled={busy} variant="ghost" onClick={() => void choose(false)}>Nein danke</Button></div>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </Card>
}

export function IfThenEditor() {
  const st = useApp()
  const saved = st.local.guidance?.ifThen
  const [draft, setDraft] = useState<IfThenPlan>(() => saved ?? { wish: '', outcome: '', obstacle: '', sentence: '', showOnPc: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const templates = ['Wenn der Abendhinweis kommt, setze ich einen Speicherpunkt und beende die Runde.', 'Wenn ich noch etwas anfangen möchte, parke ich den nächsten Schritt für morgen.', 'Wenn ich im Bett weiter scrolle, lege ich das Handy auf seinen Ladeplatz.']
  return <MoreInfo summary="Mein Wenn-dann-Abendplan">
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); setBusy(true); setMessage(''); void st.saveIfThenPlan(draft).then(() => { setMessage('Abendplan gespeichert.'); notifySaved() }).catch(() => setMessage('Der Abendplan konnte noch nicht gespeichert werden.')).finally(() => setBusy(false)) }}>
      <p className="text-sm text-muted">Ein eigener Plan für den Übergang, ohne Bewertung. Diese Notiz bleibt lokal.</p>
      {([['wish', 'Was wünsche ich mir für meinen Abend?'], ['outcome', 'Was wäre daran gut?'], ['obstacle', 'Was hält mich innerlich fest?'], ['sentence', 'Mein Wenn-dann-Satz']] as const).map(([key, label]) => <label key={key} className="block space-y-1"><span>{label}</span><TextInput aria-label={label} maxLength={500} value={draft[key]} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} /></label>)}
      <MoreInfo summary="Vorlage als Ausgangspunkt"><div className="space-y-2">{templates.map(sentence => <Button key={sentence} className="w-full text-left" onClick={() => setDraft(value => ({ ...value, sentence }))}>{sentence}</Button>)}</div></MoreInfo>
      <SettingRow label="Diesen Satz auf dem PC zeigen"><Toggle label="Wenn-dann-Satz auf dem PC zeigen" checked={draft.showOnPc} onChange={showOnPc => setDraft(value => ({ ...value, showOnPc }))} /></SettingRow>
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Wird gespeichert …' : 'Abendplan übernehmen'}</Button>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </form>
  </MoreInfo>
}
