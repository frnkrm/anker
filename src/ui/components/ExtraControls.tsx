import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { useLocation } from 'react-router'
import { extraSettings, type ExtraSettings } from '../../core/extras'
import { AnkerNative, isNative, safe, type VoiceCapabilities } from '../../platform/native'
import { useApp } from '../../state/store'
import { Button, Card, MoreInfo, Section, Sheet, Toggle } from './ui'

function VoiceConsent({ feature, onClose, onAccept }: { feature?: keyof ExtraSettings; onClose: () => void; onAccept: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Sheet open={feature !== undefined} onClose={onClose} title={feature === 'dictation' ? 'Lokales Diktieren' : 'Kurze Zeitinfos vorlesen'}>
    <p className="mb-3 text-muted">{feature === 'dictation' ? 'Nur nach deinem Start hört die lokale Spracheingabe zu. Du kannst den Text vor dem Speichern bearbeiten.' : 'Die lokale Stimme liest kurze Zeitinfos im geöffneten Fokus vor.'}</p>
    <MoreInfo>    <p className="mb-3 text-muted">{feature === 'dictation'
      ? 'Nur nach deinem Start hört die lokale Android-Spracherkennung zu. Anker speichert keine Audiodatei und verwendet keinen Cloud-Fallback. Der erkannte Text wird zunächst ein bearbeitbarer Gedankenentwurf. Ohne verfügbare lokale Spracheingabe kannst du weiter tippen.'
      : 'Die lokale Android-Stimme darf kurze Zeitinfos im geöffneten Fokus laut vorlesen. Aufgabeninhalte werden dabei nicht vorgelesen. Keine Cloud-Stimme und keine Audioablage; Wecker, Pause und Verlassen des Fokus stoppen weitere Aufträge. Hörbarkeit und Lautstärke prüfst du selbst.'}</p></MoreInfo>
    <Button disabled={busy} variant="primary" className="w-full" onClick={async () => { setBusy(true); try { await onAccept(); onClose() } catch { setError('Die Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.') } finally { setBusy(false) } }}>Einschalten</Button>
    {error && <p role="alert" className="mt-2 text-sm text-warm">{error}</p>}
    <Button disabled={busy} variant="ghost" className="mt-2 w-full" onClick={onClose}>Später</Button>
  </Sheet>
}

export function ExtraControls() {
  const st = useApp()
  const config = extraSettings(st.settings.extras)
  const [consent, setConsent] = useState<keyof ExtraSettings>()
  const [message, setMessage] = useState('')
  const [systemMessage, setSystemMessage] = useState('')
  const change = async (key: keyof ExtraSettings, value: boolean) => {
    if (value) { setConsent(key); return }
    await st.saveSettings((settings) => ({ ...settings, extras: { ...extraSettings(settings.extras), [key]: false } }))
    if (key === 'dictation') await safe(() => AnkerNative.stopDictation(), undefined)
    else await safe(() => AnkerNative.stopSpeaking(), undefined)
  }
  return <>
    <Section title="Lokale Sprache" hint="Standard aus. Text funktioniert immer; lokale Android-Modelle und Stimmen sind geräteabhängig.">
      <Card className="space-y-3">
        {!isNative() && <p className="text-sm text-muted">Die lokale Anker-Spracheingabe ist in der Android-App verfügbar. Im Browser kannst du tippen oder die Spracheingabe deiner Tastatur selbst wählen.</p>}
        <div className="flex items-center justify-between gap-3"><span>Gedanken bewusst diktieren</span><Toggle label="Lokales Diktieren" checked={config.dictation} onChange={(value) => change('dictation', value)} /></div>
        <div className="flex items-center justify-between gap-3"><span>Kurze Zeitinfos im Fokus vorlesen</span><Toggle label="Lokale Zeitinfos vorlesen" checked={config.spokenCues} onChange={(value) => change('spokenCues', value)} /></div>
        {config.spokenCues && <Button size="sm" onClick={async () => {
          const result = await safe(() => AnkerNative.speakCue({ text: 'Anker liest kurze Zeitinfos vor.' }), { status: 'unavailable' as const })
          setMessage(result.status === 'spoken' ? 'Vorlesen bei der lokalen Stimme angefragt. Ob du es hörst, prüfst du am Gerät.' : 'Gerade keine geeignete lokale deutsche Stimme verfügbar. Text und Fokus bleiben nutzbar.')
        }}>Lokale Stimme testen</Button>}
        {message && <p role="status" className="text-sm text-muted">{message}</p>}
      </Card>
    </Section>
    <Section title="Ablenkungen begrenzen" hint="Anker-Fokus bleibt freiwillig. Android-App-Sperren werden nicht von Anker ferngesteuert.">
      <Card className="space-y-3"><p className="text-sm text-muted">Du kannst Androids Nicht-stören-Funktion selbst einstellen. Digital Wellbeing oder Fokus findest du je nach Hersteller zusätzlich in den Systemeinstellungen. Anker fordert dafür keine Überwachungs- oder Administrationsrechte an.</p>
        <Button onClick={async () => {
          const result = await safe(() => AnkerNative.openFocusSettings(), { opened: false, destination: 'unavailable' as const })
          setSystemMessage(!result.opened ? 'Der Systemweg konnte hier nicht geöffnet werden. Öffne die Android-Einstellungen bei Bedarf selbst.' : result.destination === 'dnd' ? 'Nicht-stören-Einstellungen geöffnet. Du wählst dort selbst.' : 'Allgemeine Android-Einstellungen geöffnet. Suche dort nach Nicht stören oder Digital Wellbeing.')
        }}>Android-Einstellungen öffnen</Button>
        {systemMessage && <p role="status" className="text-sm text-muted">{systemMessage}</p>}
      </Card>
    </Section>
    <VoiceConsent feature={consent} onClose={() => setConsent(undefined)} onAccept={() => st.saveSettings((settings) => ({ ...settings, extras: { ...extraSettings(settings.extras), [consent!]: true } }))} />
  </>
}

export function CaptureDictation({ open, disabled, onText }: { open: boolean; disabled: boolean; onText: (text: string) => void }) {
  const st = useApp()
  const enabled = extraSettings(st.settings.extras).dictation
  const path = useLocation().pathname
  const [consent, setConsent] = useState(false)
  const [capabilities, setCapabilities] = useState<VoiceCapabilities>()
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const generation = useRef({ version: 0 })
  const pending = useRef(false)
  const addText = useRef(onText)
  useLayoutEffect(() => { addText.current = onText }, [onText])
  useEffect(() => {
    let active = true
    const cancellation = generation.current
    setListening(false)
    if (open && enabled && isNative()) void safe(() => AnkerNative.getVoiceCapabilities(), { dictationSupported: false, speechSupported: false, localOnly: true }).then((value) => { if (active) setCapabilities(value) })
    return () => {
      active = false; cancellation.version++
      if (pending.current) { pending.current = false; void safe(() => AnkerNative.stopDictation(), undefined) }
    }
  }, [open, enabled, disabled, path])
  if (!isNative()) return null
  const start = async () => {
    if (!enabled) { setConsent(true); return }
    if (pending.current) { generation.current.version++; pending.current = false; setListening(false); await safe(() => AnkerNative.stopDictation(), undefined); return }
    if (!capabilities?.dictationSupported) { setMessage('Keine lokale Spracherkennung verfügbar. Du kannst deinen Gedanken weiter eintippen.'); return }
    const request = ++generation.current.version
    pending.current = true; setListening(true); setMessage('')
    const result = await safe(() => AnkerNative.startDictation(), { status: 'unavailable' as const })
    if (request !== generation.current.version || window.location.pathname !== path || !useApp.getState().settings.extras?.dictation) return
    pending.current = false; setListening(false)
    if (result.status === 'text' && 'text' in result && typeof result.text === 'string') addText.current(result.text)
    else setMessage(result.status === 'cancelled' ? 'Aufnahme gestoppt. Du kannst weiter tippen.' : result.status === 'permission-denied' ? 'Ohne Mikrofonfreigabe wird nichts aufgenommen. Du kannst weiter tippen.' : 'Die lokale Spracheingabe ist gerade nicht verfügbar. Dein bisheriger Text bleibt erhalten.')
  }
  return <div className="space-y-2">
    <Button type="button" size="sm" disabled={disabled} onClick={() => void start()}>{listening ? 'Aufnahme abbrechen' : 'Diktieren'}</Button>
    {listening && <p role="status" className="text-sm text-muted">Anfrage zur lokalen Spracheingabe läuft. Speichern erfolgt erst mit „Merken“.</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    <VoiceConsent feature={consent ? 'dictation' : undefined} onClose={() => setConsent(false)} onAccept={() => st.saveSettings((settings) => ({ ...settings, extras: { ...extraSettings(settings.extras), dictation: true } }))} />
  </div>
}
