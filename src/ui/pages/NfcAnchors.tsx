import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { NFC_TARGETS, NFC_WINDOW_MS, type NfcStatus, type NfcTarget } from '../../core/nfc'
import { cancelNfcAnchor, confirmNfcAnchor, nfcStatus, readNfcAnchor } from '../../platform/nfc'
import { AnkerNative, isNative } from '../../platform/native'
import { Button, Card, Page } from '../components/ui'

const HINT: Record<NfcStatus['status'], string> = {
  ready: 'Bereit. Lesen beginnt erst mit deinem Tipp.',
  unsupported: 'NFC ist hier nicht verfügbar. Du kannst ein Ziel manuell öffnen.',
  disabled: 'NFC ist am Gerät ausgeschaltet. Du kannst manuell fortfahren.',
  blocked: 'Lesen ist gerade nicht möglich. Gerät entsperren und einen laufenden Wecker zuerst bedienen.',
  unavailable: 'Der NFC-Status konnte nicht gelesen werden. Manuelle Wege bleiben erreichbar.',
}
const RESULT = {
  cancelled: 'Lesen abgebrochen.', timeout: 'Das Lesefenster ist zu Ende.', invalid: 'Das ist kein vorbereiteter Anker-Tag.',
  busy: 'Es läuft bereits ein Lesevorgang.', unsupported: HINT.unsupported, disabled: HINT.disabled,
  blocked: HINT.blocked, unavailable: 'Der Tag konnte nicht gelesen werden. Du kannst manuell fortfahren.',
}

export default function NfcAnchors() {
  const nav = useNavigate()
  const [status, setStatus] = useState<NfcStatus>({ status: 'unavailable', canOpen: false })
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [target, setTarget] = useState<NfcTarget>()
  const [message, setMessage] = useState('')
  const live = useRef(false), epoch = useRef(0), pending = useRef(false)
  const session = useRef<string | undefined>(undefined)
  const cancelling = useRef<Promise<void>>(Promise.resolve())
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const invalidate = useCallback(() => {
    ++epoch.current; pending.current = false
    if (timeout.current !== undefined) clearTimeout(timeout.current)
    timeout.current = undefined
    const id = session.current; session.current = undefined
    if (id) cancelling.current = cancelNfcAnchor(id)
    if (live.current) { setTarget(undefined); setBusy(false); setReading(false) }
  }, [])
  const refresh = useCallback(async () => {
    const version = epoch.current
    const value = await nfcStatus()
    if (live.current && version === epoch.current) setStatus(value)
  }, [])
  useEffect(() => {
    live.current = true
    void refresh()
    const visibility = () => {
      if (document.visibilityState !== 'visible') { invalidate(); setMessage('Lesen beendet. Du kannst später bewusst neu starten.') }
      else void refresh()
    }
    const alarm = () => { invalidate(); setStatus({ status: 'blocked', canOpen: false }); setMessage(HINT.blocked) }
    document.addEventListener('visibilitychange', visibility)
    const listener = isNative() ? AnkerNative.addListener('alarmRinging', alarm).catch(() => undefined) : undefined
    return () => {
      live.current = false; invalidate()
      document.removeEventListener('visibilitychange', visibility)
      void listener?.then(handle => handle?.remove())
    }
  }, [invalidate, refresh])

  const scan = async () => {
    if (pending.current) return
    invalidate()
    pending.current = true; setBusy(true); setReading(true); setMessage('')
    const version = epoch.current, id = crypto.randomUUID()
    session.current = id
    timeout.current = setTimeout(() => {
      if (!live.current || epoch.current !== version) return
      invalidate(); setMessage('Das Lesefenster ist zu Ende. Du kannst bewusst neu starten.')
    }, NFC_WINDOW_MS)
    await cancelling.current
    if (!live.current || version !== epoch.current) return
    const value = await readNfcAnchor(id)
    if (!live.current || version !== epoch.current || document.visibilityState !== 'visible') return
    pending.current = false; setBusy(false); setReading(false)
    if (value.status === 'read') { setTarget(value.target); setMessage('Ziel erkannt. Es wurde noch nichts geöffnet.') }
    else { invalidate(); setMessage(RESULT[value.status]); void refresh() }
  }
  const open = async (chosen: NfcTarget, fromTag = false) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    const version = epoch.current, id = session.current
    const allowed = fromTag ? !!id && await confirmNfcAnchor(id, chosen) : (await nfcStatus()).canOpen
    if (!live.current || version !== epoch.current) return
    pending.current = false; setBusy(false)
    if (!allowed || document.visibilityState !== 'visible') {
      invalidate(); setMessage('Das Ziel kann gerade nicht geöffnet werden. Prüfe den Status oder lies den Tag erneut.'); void refresh(); return
    }
    invalidate()
    nav(NFC_TARGETS[chosen].route)
  }

  return <Page title="Ankerpunkte" back="/mehr">
    <p className="text-muted">Öffne mit einem vorbereiteten NFC-Tag dein Ziel. Du kannst es auch manuell wählen.</p>
    <Card className="space-y-3">
      <p role="status">{HINT[status.status]}</p>
      <p className="text-sm text-muted">Ein Tag ist nur ein Einstieg. Er bestätigt keine Aufgabe und ersetzt keinen Wecker-QR.</p>
      {target ? <section aria-label="Erkanntes Ankerziel" className="min-w-0 space-y-3 break-words">
        <h2 className="text-xl font-semibold">{NFC_TARGETS[target].label}</h2>
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void open(target, true)}>{NFC_TARGETS[target].label} öffnen</Button>
        <Button className="w-full" disabled={busy} onClick={() => { invalidate(); setMessage('Ziel verworfen.') }}>Nicht öffnen</Button>
      </section> : <>
        <Button variant="primary" className="w-full" disabled={busy || status.status !== 'ready'} onClick={() => void scan()}>Anker-Tag lesen</Button>
        {reading && <p className="text-sm">Halte einen vorbereiteten Anker-Tag ans Gerät. Das Lesefenster dauert höchstens 30 Sekunden.</p>}
      </>}
      {busy && <Button className="w-full" onClick={() => { invalidate(); setMessage('Lesen abgebrochen.') }}>Abbrechen</Button>}
      <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void refresh()}>Status prüfen</Button>
      {message && <p role="status" className="break-words">{message}</p>}
    </Card>
    <section aria-label="Manuelle Ankerziele" className="space-y-2">
      <h2 className="text-lg font-semibold">Manuell öffnen</h2>
      {(Object.keys(NFC_TARGETS) as NfcTarget[]).map(key => <Button key={key} className="w-full" disabled={busy} onClick={() => void open(key)}>{NFC_TARGETS[key].label} manuell öffnen</Button>)}
    </section>
  </Page>
}
