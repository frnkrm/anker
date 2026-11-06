import { useEffect, useRef, useState } from 'react'
import { inQuietHours } from '../../core/support'
import { fmtTime } from '../../core/time'
import { isNative } from '../../platform/native'
import { notificationPermission, requestNotificationPermission } from '../../platform/notifications'
import { useApp } from '../../state/store'
import { Button, Card, Page, Row, TextInput, TimeField, Toggle } from '../components/ui'

export default function WindDown() {
  const st = useApp()
  const [draft, setDraft] = useState(st.settings.support.windDown)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [permission, setPermission] = useState('prompt')
  useEffect(() => { void notificationPermission().then(setPermission) }, [])
  const quiet = inQuietHours(draft.at, st.settings)

  return (
    <Page title="Sanfter Abendübergang" back="/einstellungen">
      <p className="text-muted">Wähle eine ruhige Tätigkeit, zu der du am Abend wechseln möchtest. Ein Hinweis zur gewählten Zeit reicht.</p>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault()
        if (savingRef.current) return
        if (!draft.activity.trim()) { setError('Trage eine ruhige Tätigkeit ein, die zu dir passt.'); return }
        savingRef.current = true
        setSaving(true)
        setError('')
        setMessage('')
        try {
          await st.saveSettings((settings) => ({ ...settings, support: { ...settings.support, windDown: { ...draft, activity: draft.activity.trim() } } }))
          setMessage('Einstellung gespeichert.')
        } catch { setError('Die Einstellung konnte nicht sicher gespeichert werden. Bitte versuche es erneut.') }
        finally { savingRef.current = false; setSaving(false) }
      }}>
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span>Sanften Hinweis anbieten</span>
            <Toggle label="Sanften Abendübergang einschalten" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
          </div>
          <label className="block space-y-1">
            <span className="block">Meine ruhige Tätigkeit</span>
            <TextInput aria-label="Meine ruhige Tätigkeit" maxLength={160} required value={draft.activity} onChange={(event) => setDraft({ ...draft, activity: event.target.value })} placeholder="Zum Beispiel: ruhige Musik hören" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Einmaliger Hinweis um</span>
            <TimeField label="Abendübergang um" value={draft.at} onChange={(at) => setDraft({ ...draft, at })} />
          </div>
          <p className="text-sm text-muted">Eingeschaltet ersetzt dies die PC-Stopp- und Bett-Erinnerungen durch einen sanften Hinweis pro Abend. Der Morgenwecker und deine geplanten Zeiten bleiben bestehen.</p>
          <p className="text-sm text-muted">Deine Tätigkeit siehst du in der App. Der Sperrbildschirm zeigt einen allgemeinen Hinweis.</p>
          {quiet && <p role="status" className="text-sm text-warm">{fmtTime(draft.at)} liegt in deinen Ruhezeiten. Dort bleibt auch dieser Hinweis still. Du kannst die Tätigkeit jederzeit unter Abend & morgen öffnen.</p>}
          {draft.at < 240 && <p className="text-sm text-muted">Diese Uhrzeit gehört zum Abend vor Mitternacht, bis zum Tageswechsel um 04:00.</p>}
        </Card>
        {error && <p role="alert" className="text-warm">{error}</p>}
        {message && <p role="status" className="text-accent">{message}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={saving}>{saving ? 'Wird gespeichert …' : 'Übergang speichern'}</Button>
      </form>
      <Card className="space-y-3">
        {isNative() ? <>
          <p className="text-sm text-muted">{permission === 'granted' ? 'Benachrichtigungen sind erlaubt. Der Hinweis wird sanft zugestellt und kann sich durch Energiesparen verzögern.' : 'Für einen Hinweis bei geschlossener App braucht Anker die Benachrichtigungsfreigabe.'}</p>
          {permission !== 'granted' && <Button onClick={async () => {
            try { await requestNotificationPermission(); setPermission(await notificationPermission()) }
            catch { setError('Die Freigabe konnte nicht geöffnet werden. Prüfe die Benachrichtigungen unter Einrichtungs-Check.') }
          }}>Benachrichtigungen erlauben</Button>}
        </> : <p className="text-sm text-muted">Hinweise bei geschlossener App sind in der Android-App verfügbar. In der Web-Version findest du deine gewählte Tätigkeit unter Abend & morgen.</p>}
      </Card>
      <Row label="Abend & morgen öffnen" to="/abend" />
      <Row label="Ruhezeiten und Erinnerungen" to="/einstellungen/erinnerungen" />
    </Page>
  )
}
