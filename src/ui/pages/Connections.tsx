import { useEffect, useState } from 'react'
import { buildIcs } from '../../core/export/ics'
import { saveFile } from '../../platform/files'
import { connectGoogle, disconnectGoogle, googleConfigured, googleConnected, refreshCalendar, writeAnkerBlocks } from '../../platform/google'
import { currentUser, sendMagicLink, signOut, supabaseConfigured, syncNow, syncStatus } from '../../platform/supabase'
import { today, useApp } from '../../state/store'
import { Button, Card, Page, Section, TextInput, Toggle } from '../components/ui'

export default function Connections() {
  const st = useApp()
  const integ = st.settings.integrations
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string>()
  const [lastSync, setLastSync] = useState<number>()
  const [gConnected, setGConnected] = useState(googleConnected())

  useEffect(() => {
    void currentUser().then(setUser)
    void syncStatus().then((s) => setLastSync(s.lastSync))
  }, [])

  const setInteg = (patch: Partial<typeof integ>) => st.saveSettings((s) => ({ ...s, integrations: { ...s.integrations, ...patch } }))

  return (
    <Page title="Kalender & Sync" back="/mehr">
      <p className="px-1 text-muted">Alles hier ist optional. Anker läuft auch komplett offline.</p>

      <Section title="Sync zwischen Handy und PC">
        <Card className="space-y-3">
          {!supabaseConfigured && <p className="text-muted">Nicht konfiguriert. Anleitung im README (Supabase).</p>}
          {supabaseConfigured && user && (
            <>
              <p>Angemeldet als {user.email}</p>
              <p className="text-sm text-muted">{lastSync ? `Zuletzt synchronisiert: ${new Date(lastSync).toLocaleString('de-DE')}` : 'Noch nicht synchronisiert.'}</p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={async () => {
                    const r = await syncNow()
                    setLastSync(r.lastSync)
                    setMsg(r.error ? `Sync gerade nicht möglich: ${r.error}` : 'Synchronisiert.')
                    if (!r.error) await setInteg({ sync: true })
                  }}
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
                    await setInteg({ googleCalendar: v })
                    if (v) await refreshCalendar()
                    else await st.setEvents([])
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Routinen in Kalender „Anker“ schreiben</span>
                <Toggle
                  label="Routinen schreiben"
                  checked={integ.writeCalendar}
                  onChange={async (v) => {
                    await setInteg({ writeCalendar: v })
                    if (v) setMsg((await writeAnkerBlocks()) ? 'Kalender „Anker“ aktualisiert.' : 'Schreiben hat nicht geklappt.')
                  }}
                />
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  await disconnectGoogle()
                  setGConnected(false)
                  await setInteg({ googleCalendar: false, writeCalendar: false })
                  await st.setEvents([])
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
                const ok = await connectGoogle()
                setGConnected(ok)
                if (ok) {
                  await setInteg({ googleCalendar: true })
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
