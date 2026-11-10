import { useCallback, useEffect, useRef, useState } from 'react'
import { isNative } from '../../platform/native'
import { clearPcRelay, disablePcRelay, readPcRelayStatus, renewPcRelay, revokePcRelay, setupPcRelay, type PcRelayState } from '../../platform/pcRelay'
import { supabaseConfigured } from '../../platform/supabase'
import { Button, MoreInfo, TextInput, Toggle } from './ui'

const labels: Record<PcRelayState['status'], string> = {
  off: 'Relay ausgeschaltet', lan: 'Heimnetz hat Vorrang', waiting: 'Warte auf verschlüsselten Austausch',
  received: 'Verschlüsselten Transportkontakt empfangen', expired: 'Handyfreigabe abgelaufen – Anker öffnen und erneuern',
  unavailable: 'Relay gerade nicht erreichbar', unauthorized: 'Relayberechtigung nicht bestätigt', rejected: 'Relaynachricht nicht übernommen',
}

/** Separate opt-in setup; credentials never enter the generic application Store. */
export function PcRelaySetup() {
  const native = isNative()
  const [current, setCurrent] = useState<PcRelayState>()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const alive = useRef(false)
  const pending = useRef(false)
  const statusGeneration = useRef(0)
  const privateGeneration = useRef(0)
  const hideCode = useCallback(() => { privateGeneration.current++; setSetup('') }, [])
  const invalidateGenerations = useCallback(() => { privateGeneration.current++; statusGeneration.current++ }, [])
  useEffect(() => {
    alive.current = true
    const generation = statusGeneration.current
    void readPcRelayStatus().then(value => { if (alive.current && generation === statusGeneration.current) setCurrent(value) }).catch(() => { if (alive.current && generation === statusGeneration.current) setError('Der lokale Relaystatus konnte noch nicht gelesen werden.') })
    const hide = () => { if (document.visibilityState !== 'visible') hideCode() }
    document.addEventListener('visibilitychange', hide)
    return () => { alive.current = false; invalidateGenerations(); document.removeEventListener('visibilitychange', hide) }
  }, [hideCode, invalidateGenerations])
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; statusGeneration.current++
    setBusy(true); setError(''); setMessage('')
    try { await action() }
    catch { if (alive.current) setError('Das hat noch nicht geklappt. Prüfe Anmeldung und die ausdrücklich eingerichtete Relayfunktion. Deine Heimnetzverbindung bleibt verfügbar.') }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  }
  return <MoreInfo summary="Optional außerhalb des Heimnetzes verbinden">
    <div className="min-w-0 space-y-3" aria-label="Optionales PC-Relay">
      <p className="text-sm text-muted">Der direkte Heimnetzweg bleibt zuerst dran. Dieses freiwillige Relay benötigt ein von dir eingerichtetes Supabase-Projekt und eine Anmeldung. Es überträgt dieselben verschlüsselten Nachrichten. Der Betreiber sieht Paar-, Richtungs- und Zeitmetadaten; Inhalte und Schlüssel bleiben bei deinen Geräten. Nachrichten laufen spätestens nach 14 Tagen ab. Für die regelmäßige Löschung muss die Bereinigung im eigenen Projekt eingerichtet sein.</p>
      <p className="text-sm" role="status">{current ? labels[current.status] : 'Lokaler Status wird gelesen.'}</p>
      {!native && <p className="text-sm text-muted">Die Einrichtung und der sichere Gerätespeicher sind in der Android-App verfügbar.</p>}
      {!supabaseConfigured && <p className="text-sm text-muted">In diesem App-Build ist kein Supabase-Zugang eingerichtet. Die lokale PC-Kopplung funktioniert unabhängig davon. Eine bereitgestellte Anleitung oder ein grüner Softwaretest aktiviert keinen Dienst.</p>}
      {native && supabaseConfigured && <>
        {!current?.paired && <p className="text-sm text-muted">Kopple zuerst deinen PC im Heimnetz und bestätige den Prüfcode. Für das Relay werden dieselben Schlüssel und Empfangszähler verwendet.</p>}
        <Toggle label="Ich möchte das verschlüsselte Relay über mein eigenes Supabase-Projekt einrichten" checked={consent} onChange={setConsent} />
        <Button className="w-full" disabled={busy || !consent || !current?.paired} onClick={() => void run(async () => {
          hideCode(); const generation = privateGeneration.current
          const result = await setupPcRelay()
          if (!alive.current) return
          setCurrent(result.state)
          if (generation === privateGeneration.current && document.visibilityState === 'visible') setSetup(result.desktopSetup)
          setMessage('Handyfreigabe gespeichert. Übertrage den einmalig angezeigten Einrichtungscode selbst an deinen eigenen PC. Ein PC-Empfang ist damit noch nicht bestätigt.')
        })}>Relay bewusst einrichten</Button>
        {current?.enabled && <Button className="w-full" disabled={busy} onClick={() => void run(async () => { setCurrent(await renewPcRelay()); setMessage('Die endliche Handyfreigabe wurde erneuert. Der PC-Einrichtungscode bleibt erhalten.') })}>Handyfreigabe für 14 Tage erneuern</Button>}
      </>}
      {setup && <div className="space-y-2 rounded-xl border border-line p-3">
        <p className="text-sm text-muted">Privater Einrichtungscode für deinen PC: nicht als Screenshot, Testbericht oder öffentliche Nachricht teilen. Am PC unter Einstellungen → Relay einfügen. Beim Verlassen der App wird dieses Feld geleert.</p>
        <TextInput aria-label="Privater PC-Relay-Einrichtungscode" type="password" value={setup} readOnly autoComplete="off" spellCheck={false} />
        <Button className="w-full" disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(setup); setMessage('Privater Code kopiert. Füge ihn selbst nur am eigenen PC ein.') })}>Privaten Einrichtungscode kopieren</Button>
        <Button className="w-full" onClick={hideCode}>Code hier verbergen</Button>
      </div>}
      {native && current?.enabled && <Button className="w-full" disabled={busy} onClick={() => void run(async () => { hideCode(); setCurrent(await disablePcRelay()); setMessage('Relay auf diesem Handy ausgeschaltet. Der Dienstwiderruf für beide Geräte ist eine eigene Aktion.') })}>Relay auf diesem Handy ausschalten</Button>}
      {native && current?.phoneExpiresAt !== undefined && <>
        <Button className="w-full" disabled={busy || !supabaseConfigured} onClick={() => void run(async () => {
          hideCode(); const result = await revokePcRelay(); setCurrent(result.state)
          setMessage(result.cloudRevoked ? 'Relay für beide Geräte beim Dienst widerrufen. Die Mailbox wurde gelöscht.' : 'Lokal ausgeschaltet. Der Widerruf beim Dienst ist noch nicht bestätigt; bitte erneut anmelden und widerrufen.')
        })}>Relay für beide Geräte widerrufen</Button>
        <Button className="w-full" disabled={busy} onClick={() => void run(async () => { hideCode(); setCurrent(await clearPcRelay()); setMessage('Private Relaydaten nur auf diesem Handy entfernt. Das bestätigt keinen Widerruf beim Dienst.') })}>Private Relaydaten auf diesem Handy entfernen</Button>
      </>}
      {message && <p role="status" className="break-words text-sm text-muted">{message}</p>}
      {error && <p role="alert" className="break-words text-sm text-warm">{error}</p>}
    </div>
  </MoreInfo>
}
