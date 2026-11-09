import { useRef, useState } from 'react'
import { chooseHealthSleep } from '../../platform/healthSleep'
import { useApp } from '../../state/store'
import { Card, Row, SettingRow, Toggle } from './ui'

/** Eigene lokale Wahl, unabhängig von der Trainingsverbindung. */
export function HealthSleepSettings() {
  const enabled = useApp(state => state.local.healthSleepEnabled === true)
  const [message, setMessage] = useState('')
  const [requested, setRequested] = useState<boolean | null>(null)
  const choice = useRef(0)
  return <Card className="space-y-3">
    <SettingRow label="Schlafvorschläge aus Health Connect"><Toggle label="Schlafvorschläge aus Health Connect" checked={requested ?? enabled} onChange={value => {
      const current = ++choice.current
      setRequested(value)
      setMessage(value ? 'Health Connect wird geprüft. Du kannst die Anfrage durch Ausschalten beenden.' : '')
      void chooseHealthSleep(value).then(result => {
        if (choice.current !== current) return
        setRequested(null)
        setMessage(result === 'enabled' ? 'Leserecht erlaubt. Vorschläge findest du im Schlafüberblick.'
          : result === 'unavailable' ? 'Schlafvorschläge sind in der Android-App mit verfügbarem Health Connect möglich.'
            : result === 'permission-needed' ? 'Das Leserecht für Schlaf fehlt. Du kannst es später erneut erlauben.'
              : result === 'error' ? 'Die Auswahl konnte nicht abgeschlossen werden. Bitte versuche es erneut.' : '')
      }).catch(() => { if (choice.current === current) { setRequested(null); setMessage('Die Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.') } })
    }} /></SettingRow>
    <p className="text-sm text-muted">Freiwillig und nur lesend: Sitzungsbeginn und -ende der letzten 14 Nächte werden im Schlafüberblick vorgeschlagen. Du übernimmst jede Nacht selbst; eigene Angaben bleiben erhalten. Keine Schlafphasen-Auswertung, kein Einfluss auf Wecker oder Tagesplan.</p>
    <p className="text-sm text-muted">Schlafvorschläge bleiben auf diesem Gerät. Ausschalten verwirft laufende Antworten; bereits übernommene Angaben bleiben bearbeitbar und löschbar.</p>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    <Row label="Schlafüberblick öffnen" to="/schlaf" sub="Vorschläge prüfen und bewusst übernehmen" />
  </Card>
}
