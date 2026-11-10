import { useEffect, useRef, useState } from 'react'
import { buildIcs } from '../../core/export/ics'
import { saveFile } from '../../platform/files'
import { connectGoogle, disconnectGoogle, googleConfigured, googleConnected, googleWriteAuthorized, invalidateCalendarRequests, refreshCalendar, writeAnkerBlocks } from '../../platform/google'
import { automaticSyncEnableConfirmation, cancelSyncRequests, currentUser, sendMagicLink, signOut, supabaseConfigured, syncNow, syncStatus } from '../../platform/supabase'
import { today, useApp } from '../../state/store'
import { Button, Card, MoreInfo, notifySaved, Page, Section, SettingRow, TextInput, Toggle } from '../components/ui'
import { DeviceCalendarConnection } from '../components/DeviceCalendarConnection'
import { calendarSourceRevision } from '../../platform/calendarSource'

export default function Connections() {
  const st = useApp()
  const integ = st.settings.integrations
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string>()
  const [lastSync, setLastSync] = useState<number>()
  const gConnected = googleConnected()
  const calendar = st.local.extras?.calendar
  const deviceReading = st.local.extras?.deviceCalendar?.enabled === true
  const mounted = useRef(true)
  const googleIntent = useRef(0)
  const [syncBusy, setSyncBusy] = useState(false)
  const syncPending = useRef(false)
  const syncMounted = useRef(false)
  const syncIntent = useRef(0)
  const syncEnabling = useRef<number | undefined>(undefined)

  useEffect(() => {
    const intent = syncIntent
    const enabling = syncEnabling
    mounted.current = true
    syncMounted.current = true
    void currentUser().then((value) => { if (syncMounted.current) setUser(value) })
    void syncStatus().then((s) => { if (syncMounted.current) setLastSync(s.lastSync) })
    return () => {
      mounted.current = false; syncMounted.current = false; intent.current++
      if (enabling.current !== undefined) {
        cancelSyncRequests()
        // Ein bereits laufender DB-Write lässt sich nicht zurücknehmen; das gewünschte Aus folgt in derselben Queue.
        void useApp.getState().saveSettings((settings) => ({ ...settings, integrations: { ...settings.integrations, sync: false } }))
          .catch(() => useApp.getState().showToast('Sync ist angehalten. Der ausgeschaltete Schalter konnte noch nicht gespeichert werden; bitte prüfe ihn beim nächsten Öffnen.'))
      }
    }
  }, [])

  const setInteg = (patch: Partial<typeof integ>, accept = () => true) => st.saveSettings((s) => accept() ? ({ ...s, integrations: { ...s.integrations, ...patch } }) : s).then(notifySaved)
  const beginGoogleIntent = () => {
    const version = ++googleIntent.current
    return () => mounted.current && googleIntent.current === version
  }
  const enableGoogleReading = async (accept: () => boolean) => {
    const source = calendarSourceRevision()
    const current = () => accept() && source === calendarSourceRevision() && !useApp.getState().local.extras?.deviceCalendar?.enabled
    await setInteg({ googleCalendar: true }, current)
    if (current()) await refreshCalendar()
  }
  const syncCurrent = (intent: number) => syncMounted.current && syncIntent.current === intent
  const syncAction = async (action: () => Promise<void>) => {
    if (syncPending.current) return
    syncPending.current = true; setSyncBusy(true)
    try { await action() } catch { setMsg('Die Änderung konnte nicht gespeichert werden. Deine lokalen Daten bleiben erhalten.') }
    finally { syncPending.current = false; setSyncBusy(false) }
  }

  return (
    <Page className="settings-page" title="Kalender & Sync" back="/mehr">
      <p className="px-1 text-muted">Alles hier ist optional. Anker läuft auch komplett offline.</p>

      <Section title="Sync zwischen Handy und PC">
        <Card className="space-y-3">
          <p className="text-sm text-muted">Gleiche deine persönlichen Daten nur nach deiner Wahl ab.</p>
          <MoreInfo summary="Welche Daten werden übertragen?">
            <p>Nur nach deiner Wahl: Einstellungen, persönliche Tagesdaten, Gedanken und Spielstand gehen an deinen Supabase-Server. Arbeitsaufgaben, Arbeitszeiten, Einnahme- und Schlafprotokoll, Orte, Kalendercache, QR-Geheimnis und Gerätefreigaben bleiben lokal. Als Arbeit erfasste oder mit Arbeit verknüpfte Gedanken bleiben ebenfalls lokal; freie Texte werden nicht automatisch nach Inhalten sortiert.</p>
          </MoreInfo>
          {!supabaseConfigured && <p className="text-muted">Die Verbindung ist hier noch nicht eingerichtet. Anker funktioniert auch ohne Anmeldung.</p>}
          {!supabaseConfigured && st.settings.appearance.developerTools && <MoreInfo summary="Technische Einrichtung"><p>Für diese Installation ist kein Supabase-Server konfiguriert. Die Einrichtung steht im Projekt-README; Zugangsdaten gehören nicht in einen Gedanken oder einen Testbericht.</p></MoreInfo>}
          {supabaseConfigured && user && (
            <>
              <p>Angemeldet als {user.email}</p>
              <p className="text-sm text-muted">{lastSync ? `Zuletzt synchronisiert: ${new Date(lastSync).toLocaleString('de-DE')}` : 'Noch nicht synchronisiert.'}</p>
              <SettingRow label="Automatisch synchronisieren"><fieldset disabled={syncBusy && !integ.sync}><Toggle label="Automatischer Sync" checked={integ.sync} onChange={(enabled) => {
                const intent = ++syncIntent.current
                if (!enabled) {
                  syncEnabling.current = undefined
                  cancelSyncRequests()
                  void setInteg({ sync: false }).then(() => setMsg('Automatischer Sync ist ausgeschaltet. Deine lokalen Daten bleiben erhalten.')).catch(() => setMsg('Der Sync wurde angehalten. Der Schalter konnte noch nicht gespeichert werden; versuche es erneut.'))
                  return
                }
                const confirm = automaticSyncEnableConfirmation()
                syncEnabling.current = intent
                void syncAction(async () => {
                  // Dieser Callback läuft erst innerhalb der zentralen Schreibbarriere.
                  try { await st.saveSettings((settings) => syncCurrent(intent) ? { ...settings, integrations: { ...settings.integrations, sync: true } } : settings) }
                  finally { if (syncEnabling.current === intent) syncEnabling.current = undefined }
                  if (!syncCurrent(intent)) return
                  confirm()
                  const result = await syncNow({ manual: true }); setLastSync(result.lastSync); setMsg(result.error ?? 'Automatischer Sync ist eingeschaltet.')
                })
              }} /></fieldset></SettingRow>
              <div className="flex gap-2">
                <Button
                  disabled={syncBusy}
                  variant="primary"
                  className="flex-1"
                  onClick={() => void syncAction(async () => {
                    const r = await syncNow({ manual: true })
                    setLastSync(r.lastSync)
                    setMsg(r.error ? `Sync gerade nicht möglich: ${r.error}` : 'Synchronisiert.')
                  })}
                >
                  Jetzt synchronisieren
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    syncIntent.current++
                    syncEnabling.current = undefined
                    await signOut()
                    await setInteg({ sync: false })
                    setUser(null)
                  }}
                >
                  Abmelden
                </Button>
              </div>
            </>
          )}
          {supabaseConfigured && !user && (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const err = await sendMagicLink(email.trim())
                setMsg(err ? `Hat nicht geklappt: ${err}` : 'Link verschickt. Öffne ihn auf diesem Gerät.')
              }}
            >
              <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="deine@email.de" autoComplete="email" />
              <Button type="submit" variant="primary" className="w-full">
                Anmelde-Link schicken
              </Button>
            </form>
          )}
          {msg && <p className="text-sm text-muted">{msg}</p>}
        </Card>
      </Section>

      <Section title="Google Kalender">
        <Card className="space-y-3">
          <p className="text-sm text-muted">Übernimm auf Wunsch Termine in deinen Tagesplan.</p>
          <DeviceCalendarConnection />
          <MoreInfo summary="Kalenderzugriff und Datenschutz"><p>Die Handy-Auswahl liest nur deine bereits von Android synchronisierten Google-Kalender und speichert die Termine lokal. Erst die zusätzliche Google-Anmeldung fordert direkt bei Google Lese- oder Schreibrechte an. Du kannst jede Verbindung hier trennen; ohne Verbindung bleibt Anker nutzbar.</p></MoreInfo>
          {calendar && <p role="status" className="text-sm text-muted">{calendar.state === 'ready' ? 'Termine aktuell eingelesen.' : calendar.state === 'stale' ? 'Letzter Kalenderstand: gerade nicht aktualisierbar. Die gespeicherten Termine bleiben sichtbar.' : calendar.state === 'loading' ? 'Kalender wird eingelesen.' : deviceReading && calendar.issue === 'permission' ? 'Kalenderzugriff auf diesem Handy oder Auswahl prüfen. Eigene Planung bleibt nutzbar.' : calendar.issue === 'auth' ? 'Google-Anmeldung fehlt oder ist abgelaufen. Bitte bewusst neu verbinden.' : calendar.state === 'error' ? 'Kalender gerade nicht erreichbar. Lokale Planung bleibt nutzbar.' : 'Google-Kalender derzeit getrennt.'}{calendar.fetchedAt ? ` Letzter erfolgreicher Abruf: ${new Date(calendar.fetchedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}.` : ''}</p>}

          <MoreInfo summary="Zusätzliche Google-Anmeldung">
          {!googleConfigured ? (
            <p className="text-muted">Die zusätzliche Online-Anmeldung ist derzeit nicht verfügbar. Auf Android kannst du die bereits synchronisierten Google-Kalender oben auswählen. Eigene Termine kannst du weiterhin selbst eintragen.</p>
          ) : gConnected ? (
            <>
              {deviceReading ? <Button className="w-full" onClick={async () => {
                const accept = beginGoogleIntent()
                if (!await connectGoogle(false, accept)) { if (accept()) setMsg('Google-Anmeldung hat nicht geklappt. Deine bisherige Lesequelle bleibt erhalten.'); return }
                await enableGoogleReading(accept)
              }}>Google-Anmeldung als Lesequelle verwenden</Button> : <SettingRow label={<span>Termine im Tagesplan</span>}>
                <Toggle
                  label="Termine lesen"
                  checked={integ.googleCalendar}
                  onChange={async (v) => {
                    const accept = beginGoogleIntent()
                    invalidateCalendarRequests()
                    const source = calendarSourceRevision()
                    const current = () => accept() && source === calendarSourceRevision() && !useApp.getState().local.extras?.deviceCalendar?.enabled
                    await setInteg({ googleCalendar: v }, current)
                    if (current() && v) await refreshCalendar()
                    else if (current()) await st.applyCalendarSnapshot([], { state: 'disconnected', checkedAt: Date.now(), writtenAt: useApp.getState().local.extras?.calendar?.writtenAt }, current)
                  }}
                />
              </SettingRow>}
              <p className="text-sm text-muted">Schreiben ist eine eigene Wahl: Beim Einschalten wird ein zusätzlicher Zugriff auf von Anker erstellte Kalender angefragt. Google erhält dafür deine Routinentitel und Zeiten. Fremde Termine werden nicht geändert.</p>
              <SettingRow label={<span>Routinen in einen eigenen Kalender „Anker“ schreiben</span>}>
                <Toggle
                  label="Routinen schreiben"
                  checked={integ.writeCalendar}
                  onChange={async (v) => {
                    const accept = beginGoogleIntent()
                    invalidateCalendarRequests()
                    if (v && !googleWriteAuthorized() && !await connectGoogle(true, accept)) { if (accept()) setMsg('Zusätzliche Schreibfreigabe wurde nicht erteilt. Es wurde nichts eingeschaltet.'); return }
                    if (v && !accept()) return
                    await setInteg({ writeCalendar: v }, v ? accept : () => true)
                    if (!accept()) return
                    if (v) setMsg((await writeAnkerBlocks()) ? 'Kalender „Anker“ aktualisiert.' : 'Schreiben hat nicht geklappt.')
                  }}
                />
              </SettingRow>
              {integ.writeCalendar && !googleWriteAuthorized() && <Button onClick={async () => {
                const accept = beginGoogleIntent()
                if (!await connectGoogle(true, accept)) { if (accept()) setMsg('Zusätzliche Schreibfreigabe wurde nicht erteilt.'); return }
                if (!accept()) return
                setMsg(await writeAnkerBlocks() ? 'Eigener Anker-Kalender aktualisiert.' : 'Schreiben hat nicht geklappt. Lokale Planung bleibt erhalten.')
              }}>Schreibfreigabe bewusst erneuern</Button>}
              <Button
                variant="ghost"
                onClick={async () => {
                  googleIntent.current++
                  const disconnect = disconnectGoogle(), source = calendarSourceRevision()
                  const current = () => source === calendarSourceRevision()
                  await disconnect
                  await st.saveSettings(settings => !current() ? settings : { ...settings, integrations: { ...settings.integrations,
                    ...(useApp.getState().local.extras?.deviceCalendar?.enabled ? {} : { googleCalendar: false }), writeCalendar: false } })
                  const clear = () => current() && !useApp.getState().local.extras?.deviceCalendar?.enabled
                  if (clear()) await st.applyCalendarSnapshot([], { state: 'disconnected', checkedAt: Date.now(), writtenAt: useApp.getState().local.extras?.calendar?.writtenAt }, clear)
                }}
              >
                Google trennen
              </Button>
            </>
          ) : (
            <><Button
              variant={supabaseConfigured ? 'secondary' : 'primary'}
              className="w-full"
              onClick={async () => {
                const accept = beginGoogleIntent()
                const ok = await connectGoogle(false, accept)
                if (!accept()) return
                if (ok) {
                  await enableGoogleReading(accept)
                } else setMsg('Google-Anmeldung hat nicht geklappt.')
              }}
            >
              {deviceReading ? 'Statt Handykalender die Google-Anmeldung nutzen' : 'Mit Google verbinden'}
            </Button>
            {deviceReading && <Button className="w-full" onClick={async () => {
              const accept = beginGoogleIntent()
              if (!await connectGoogle(true, accept)) { if (accept()) setMsg('Die zusätzliche Schreibfreigabe wurde nicht erteilt. Deine Handykalender bleiben verbunden.'); return }
              await setInteg({ writeCalendar: true }, accept)
              if (accept()) setMsg(await writeAnkerBlocks() ? 'Eigener Anker-Kalender aktualisiert.' : 'Schreiben hat noch nicht geklappt. Deine Handykalender bleiben verbunden.')
            }}>Eigenen Anker-Kalender zum Schreiben verbinden</Button>}</>
          )}
          </MoreInfo>
        </Card>
      </Section>

      <Section title="Ohne Verbindung: Kalender-Datei" hint="Deine wiederkehrenden Termine als Datei für einen Kalender deiner Wahl.">
        <Button className="w-full" size="lg" onClick={() => saveFile('anker.ics', buildIcs(st.settings, today(), new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')), 'text/calendar')}>
          .ics-Datei exportieren
        </Button>
      </Section>
    </Page>
  )
}
