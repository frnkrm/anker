import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { inQuietHours } from '../../core/support'
import { fmtTime } from '../../core/time'
import { isNative } from '../../platform/native'
import { notificationPermission, requestNotificationPermission } from '../../platform/notifications'
import { useApp } from '../../state/store'
import { Button, Card, MoreInfo, notifySaved, Row, SettingRow, TextInput, TimeField, Toggle } from '../components/ui'

/** Existing notification deep links retain the same configuration under the shared evening page. */
export default function WindDown() {
  return <Navigate to="/einstellungen/abend#uebergang" replace />
}

export function WindDownFields() {
  const st = useApp()
  const config = st.settings.support.windDown
  const [activity, setActivity] = useState(config.activity)
  const [error, setError] = useState('')
  const [permission, setPermission] = useState('prompt')
  useEffect(() => { void notificationPermission().then(setPermission) }, [])
  useEffect(() => setActivity(config.activity), [config.activity])
  const save = async (patch: Partial<typeof config>) => {
    setError('')
    try {
      await st.saveSettings((settings) => ({ ...settings, support: { ...settings.support, windDown: { ...settings.support.windDown, ...patch } } }))
      notifySaved()
    } catch { setError('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.') }
  }
  const quiet = inQuietHours(config.at, st.settings)
  return <div className="space-y-3">
    <p className="text-sm text-muted">Ein ruhiger Wechsel am Abend – mit deiner eigenen Tätigkeit.</p>
    <Card className="space-y-3">
      <SettingRow label="Sanften Hinweis anbieten"><Toggle label="Sanften Abendübergang einschalten" checked={config.enabled} onChange={(enabled) => void save({ enabled })} /></SettingRow>
      {config.enabled && <>
        <label className="block space-y-1"><span>Meine ruhige Tätigkeit</span><TextInput aria-label="Meine ruhige Tätigkeit" maxLength={160} value={activity} onChange={(event) => setActivity(event.target.value)} onBlur={() => {
          if (!activity.trim()) { setError('Welche ruhige Tätigkeit passt zu dir? Deine bisherige Auswahl bleibt erhalten.'); return }
          if (activity.trim() !== config.activity) void save({ activity: activity.trim() })
        }} placeholder="Zum Beispiel: ruhige Musik hören" /></label>
        <SettingRow label="Hinweis um"><TimeField label="Abendübergang um" value={config.at} onChange={(at) => void save({ at })} /></SettingRow>
      </>}
      <MoreInfo>
        <p className="text-sm text-muted">Eingeschaltet ersetzt dies die PC-Stopp- und Bett-Erinnerungen durch einen sanften Hinweis pro Abend. Morgenwecker und geplante Zeiten bleiben bestehen.</p>
        <p className="text-sm text-muted">Deine Tätigkeit siehst du in der App. Der Sperrbildschirm zeigt einen allgemeinen Hinweis.</p>
        {config.at < 240 && <p className="text-sm text-muted">Bis 04:00 gehört die gewählte Uhrzeit noch zum vorherigen Abend.</p>}
        {isNative() ? <>
          <p className="text-sm text-muted">{permission === 'granted' ? 'Benachrichtigungen sind erlaubt. Energiesparen kann die Zustellung verzögern.' : 'Für einen Hinweis bei geschlossener App braucht Anker die Benachrichtigungsfreigabe.'}</p>
          {permission !== 'granted' && <Button onClick={async () => {
            try { await requestNotificationPermission(); setPermission(await notificationPermission()) }
            catch { setError('Die Freigabe konnte nicht geöffnet werden. Prüfe den Einrichtungs-Check.') }
          }}>Benachrichtigungen erlauben</Button>}
        </> : <p className="text-sm text-muted">Hinweise bei geschlossener App gibt es in der Android-App. Im Browser findest du deine Tätigkeit unter Abend & morgen.</p>}
        <Row label="Abend & morgen öffnen" to="/abend" />
        <Row label="Ruhezeiten einstellen" to="/einstellungen/erinnerungen" />
      </MoreInfo>
      {config.enabled && quiet && <p role="status" className="text-sm text-muted">{fmtTime(config.at)} liegt in deinen Ruhezeiten. Der Hinweis bleibt dort still; deine Tätigkeit bleibt in der App sichtbar.</p>}
    </Card>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </div>
}
