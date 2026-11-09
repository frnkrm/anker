import { useCallback, useEffect, useRef, useState } from 'react'
import { TZ } from '../../core/time'
import { importHealthSleep, readHealthSleep, type HealthSleepResult } from '../../platform/healthSleep'
import { useApp } from '../../state/store'
import { Button, Card } from './ui'

const format = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
export function HealthSleepSuggestions() {
  const enabled = useApp(state => state.local.healthSleepEnabled === true)
  const diary = useApp(state => state.local.sleepDiary)
  const [result, setResult] = useState<HealthSleepResult>({ status: 'off', suggestions: [] })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++request.current
    setBusy(true)
    const response = await readHealthSleep()
    if (request.current !== current) return
    setResult(response); setBusy(false)
  }, [])
  useEffect(() => {
    const current = ++request.current
    let cancelled = false
    if (enabled) {
      setBusy(true)
      void readHealthSleep().then(response => {
        if (!cancelled && current === request.current) { setResult(response); setBusy(false) }
      })
    } else { setResult({ status: 'off', suggestions: [] }); setBusy(false) }
    return () => { cancelled = true }
  }, [enabled])
  if (!enabled) return null
  const suggestions = result.suggestions.filter(row => !diary[row.date] || !['sleepyAt', 'bedAt', 'wakeAt'].some(key => diary[row.date]?.[key as 'bedAt' | 'wakeAt' | 'sleepyAt'] !== undefined))
  return <Card className="space-y-3">
    <h2 className="text-lg font-semibold">Vorschläge aus Health Connect</h2>
    <p className="text-sm text-muted">Beginn und Ende einer gespeicherten Sitzung sind Vorschläge für Bett und Aufstehen, keine gemessene Bettzeit. Mehrere Sitzungen derselben Nacht bleiben zur Auswahl. Eigene Einträge werden nicht ersetzt.</p>
    {busy ? <p role="status">Vorschläge werden geladen.</p> : result.status === 'ready' && !suggestions.length ? <p>Keine neuen Vorschläge für leere Nächte.</p> : result.status !== 'ready' && <p role="status">{result.status === 'permission-needed' ? 'Das Leserecht für Schlaf fehlt. Erlaube es bei Bedarf unter Schlaf & Anker erneut.' : result.status === 'unavailable' ? 'Health Connect ist gerade nicht verfügbar.' : result.status === 'off' ? 'Schlafvorschläge sind ausgeschaltet.' : 'Schlafvorschläge konnten gerade nicht gelesen werden. Deine Angaben bleiben erhalten.'}</p>}
    {!busy && suggestions.map(row => <div key={row.id} className="rounded-xl border border-line p-3 space-y-2">
      <p className="text-sm">Nacht vom {row.date} · aus Health Connect</p>
      <p className="text-sm">Beginn {format.format(row.bedAt)} · Ende {format.format(row.wakeAt)}</p>
      <Button size="sm" aria-label={`Zeiten für ${row.date} übernehmen`} onClick={() => {
        void importHealthSleep(row).then(accepted => setMessage(accepted ? 'Zeiten aus Health Connect übernommen.' : 'Nicht übernommen: Die Nacht enthält inzwischen eigene Angaben oder die Freigabe ist aus.')).catch(() => setMessage('Die Zeiten konnten nicht gespeichert werden. Bitte versuche es erneut.'))
      }}>Zeiten übernehmen</Button>
    </div>)}
    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void refresh()}>Vorschläge aktualisieren</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </Card>
}
