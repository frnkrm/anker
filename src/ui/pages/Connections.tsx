import { useEffect, useRef, useState } from 'react'
import { buildIcs } from '../../core/export/ics'
import { saveFile } from '../../platform/files'
import { connectGoogle, disconnectGoogle, googleConfigured, googleConnected, googleWriteAuthorized, invalidateCalendarRequests, refreshCalendar, writeAnkerBlocks } from '../../platform/google'
import { cancelSyncRequests, currentUser, sendMagicLink, signOut, supabaseConfigured, syncNow, syncStatus } from '../../platform/supabase'
import { today, useApp } from '../../state/store'
import { Button, Card, Page, Section, TextInput, Toggle } from '../components/ui'

export default function Connections() {
  const st = useApp()
  const integ = st.settings.integrations
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string>()
  const [lastSync, setLastSync] = useState<number>()
  const gConnected = googleConnected()
  const calendar = st.local.extras?.calendar
  const mounted = useRef(true)
  const googleIntent = useRef(0)
  const [syncBusy, setSyncBusy] = useState(false)
  const syncPending = useRef(false)

  useEffect(() => {
    mounted.current = true
    void currentUser().then(setUser)
    void syncStatus().then((s) => setLastSync(s.lastSync))
    return () => { mounted.current = false }
  }, [])

  const setInteg = (patch: Partial<typeof integ>, accept = () => true) => st.saveSettings((s) => accept() ? ({ ...s, integrations: { ...s.integrations, ...patch } }) : s)
  const beginGoogleIntent = () => {
    const version = ++googleIntent.current
    return () => mounted.current && googleIntent.current === version
  }
  const syncAction = async (action: () => Promise<void>) => {
    if (syncPending.current) return
    syncPending.current = true; setSyncBusy(true)
    try { await action() } catch { setMsg('Die Änderung konnte nicht gespeichert werden. Deine lokalen Daten bleiben erhalten.') }
    finally { syncPending.current = false; setSyncBusy(false) }
  }

  return (
    <Page title="Kalender & Sync" back="/mehr">
      <p className="px-1 text-muted">Alles hier ist optional. Anker läuft auch komplett offline.</p>

      <Section title="Sync zwischen Handy und PC">
        <Card className="space-y-3">
          <p className="text-sm text-muted">Nur nach deiner Wahl: Einstellungen, persönliche Tagesdaten, Gedanken und Spielstand gehen an deinen Supabase-Server. Arbeitsaufgaben, Arbeitszeiten, Einnahme- und Schlafprotokoll, Orte, Kalendercache, QR-Geheimnis und Gerätefreigaben bleiben lokal. Als Arbeit erfasste oder mit Arbeit verknüpfte Gedanken bleiben ebenfalls lokal; freie Texte werden nicht automatisch nach Inhalten sortiert.</p>
          {!supabaseConfigured && <p className="text-muted">Nicht konfiguriert. Anleitung im README (Supabase).</p>}
          {supabaseConfigured && user && (
            <>
              <p>Angemeldet als {user.email}</p>
              <p className="text-sm text-muted">{lastSync ? `Zuletzt synchronisiert: ${new Date(lastSync).toLocaleString('de-DE')}` : 'Noch nicht synchronisiert.'}</p>
              <div className="flex flex-wrap items-center justify-between gap-3"><span>Automatisch synchronisieren</span><fieldset disabled={syncBusy && !integ.sync}><Toggle label="Automatischer Sync" checked={integ.sync} onChange={(enabled) => {
                if (!enabled) {
                  cancelSyncRequests()
                  void setInteg({ sync: false }).then(() => setMsg('Automatischer Sync ist ausgeschaltet. Deine lokalen Daten bleiben erhalten.')).catch(() => setMsg('Der Sync wurde angehalten. Der Schalter konnte noch nicht gespeichert werden; versuche es erneut.'))
                  return
                }
                void syncAction(async () => {
                  await setInteg({ sync: enabled })
                  const result = await syncNow({ manual: true }); setLastSync(result.lastSync); setMsg(result.error ?? 'Automatischer Sync ist eingeschaltet.')
                })
              }} /></fieldset></div>
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
          <p className="text-sm text-muted">Freiwillig: Google erhält deine Anmeldung und den Kalenderzugriff. Gelesene Termine werden lokal für deinen Tagesplan gespeichert. Du kannst den Zugriff hier trennen; ohne Verbindung bleibt Anker nutzbar.</p>
          {calendar && <p role="status" className="text-sm text-muted">{calendar.state === 'ready' ? 'Termine aktuell eingelesen.' : calendar.state === 'stale' ? 'Letzter Kalenderstand: gerade nicht aktualisierbar. Die gespeicherten Termine bleiben sichtbar.' : calendar.issue === 'auth' ? 'Google-Anmeldung fehlt oder ist abgelaufen. Bitte bewusst neu verbinden.' : calendar.state === 'error' ? 'Kalender gerade nicht erreichbar. Lokale Planung bleibt nutzbar.' : 'Google-Kalender derzeit getrennt.'}{calendar.fetchedAt ? ` Letzter erfolgreicher Abruf: ${new Date(calendar.fetchedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}.` : ''}</p>}

          {!googleConfigured ? (
            <p className="text-muted">Nicht konfiguriert. Anleitung im README (Google Cloud).</p>
          ) : gConnected ? (
            <>
              <div className="flex items-center justify-between">
                <span>Termine im Tagesplan</span>
                <Toggle
                  label="Termine lesen"
                  checked={integ.googleCalendar}
                  onChange={async (v) => {
                    googleIntent.current++
                    invalidateCalendarRequests()
                    await setInteg({ googleCalendar: v })
                    if (v) await refreshCalendar()
                    else await st.setEvents([])
                  }}
                />
              </div>
              <p className="text-sm text-muted">Schreiben ist eine eigene Wahl: Beim Einschalten wird ein zusätzlicher Zugriff auf von Anker erstellte Kalender angefragt. Google erhält dafür deine Routinentitel und Zeiten. Fremde Termine werden nicht geändert.</p>
              <div className="flex items-center justify-between">
                <span>Routinen in einen eigenen Kalender „Anker“ schreiben</span>
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
              </div>
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
                  await disconnectGoogle()
                  await setInteg({ googleCalendar: false, writeCalendar: false })
                  await st.setEvents([])
                  await st.saveLocal((local) => ({ ...local, extras: { ...local.extras, calendar: { ...local.extras?.calendar, state: 'disconnected', checkedAt: Date.now() } } }))
                }}
              >
                Google trennen
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="w-full"
              onClick={async () => {
                const accept = beginGoogleIntent()
                const ok = await connectGoogle(false, accept)
                if (!accept()) return
                if (ok) {
                  await setInteg({ googleCalendar: true }, accept)
                  if (!accept()) return
                  await refreshCalendar()
                } else setMsg('Google-Anmeldung hat nicht geklappt.')
              }}
            >
              Mit Google verbinden
            </Button>
          )}
        </Card>
      </Section>

      <Section title="Ohne Google: Kalender-Datei" hint="Wiederkehrende Termine mit Erinnerungen, Zeitzone Europe/Berlin. In jeden Kalender importierbar.">
        <Button className="w-full" size="lg" onClick={() => saveFile('anker.ics', buildIcs(st.settings, today(), new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')), 'text/calendar')}>
          .ics-Datei exportieren
        </Button>
      </Section>
    </Page>
  )
}
