import { strToU8, zipSync } from 'fflate'
import { useEffect, useRef, useState } from 'react'
import { pcStopFiles } from '../../core/export/pcstop'
import { fmtTime } from '../../core/time'
import { buildPcStopCommands, type PcStopPublication } from '../../core/pcStop'
import { saveFile } from '../../platform/files'
import { createPcStopToken, currentUser, pcStopEndpoint, pushPcStop, supabaseConfigured } from '../../platform/supabase'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { LateForm } from '../components/TodayDifferent'
import { BackButton, Button, Card, MoreInfo, Page, Sheet } from '../components/ui'
import { PcCompanionPanel } from './PcCompanionPanel'

export default function PcStop() {
  const { date, plan, m } = useToday()
  const st = useApp()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [editing, setEditing] = useState(false)
  const [setup, setSetup] = useState<number>()
  const [publication, setPublication] = useState<PcStopPublication>()
  const [error, setError] = useState('')
  const command = buildPcStopCommands([plan])[0]!
  useEffect(() => {
    void currentUser().then(setUser)
  }, [])

  const download = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      let token = ''
      if (user) token = (await createPcStopToken()) ?? ''
      const files = pcStopFiles({ endpoint: token ? pcStopEndpoint() : '', token, fallbackTime: fmtTime(st.settings.pcStop) })
      const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(k.endsWith('.ps1') ? '﻿' + v : v)])))
      await saveFile('anker-pc-stopp.zip', zip, 'application/zip')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Das Paket konnte nicht erstellt werden.')
    } finally {
      pending.current = false; setBusy(false)
    }
  }

  return (
    <Page title="PC-Stopp" back="/mehr">
      <Card className="space-y-3 text-center">
        <p className="text-muted">Heute</p>
        <p className={command.mode === 'paused' ? 'text-2xl font-semibold' : 'text-5xl font-semibold tabular-nums'}>{command.mode === 'paused' ? 'Ohne festen PC-Stopp' : fmtTime(plan.pcStop)}</p>
        <p className="text-sm text-muted">{user ? 'Klassisches Paket: Serververbindung bereit · Empfang am PC noch nicht bestätigt' : 'Klassisches Paket: keine Serverübertragung eingerichtet.'}</p>
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => setEditing(true)}>Zeit ändern</Button>
      </Card>
      <PcCompanionPanel />
      <MoreInfo summary="Verbindung und bereitgestellten Plan ansehen">
        <p className="text-sm text-muted">Das ist dein gewünschter Plan. Ein bereitgestellter Auftrag bestätigt keinen Empfang am PC.</p>
        <Button className="w-full" variant="ghost" disabled={busy} onClick={async () => {
          if (pending.current) return
          pending.current = true; setBusy(true); setError('')
          try { setPublication(await pushPcStop({ manual: true })) }
          catch { setError('Der Plan konnte nicht bereitgestellt werden. Ein alter PC-Auftrag kann weiter gelten.') }
          finally { pending.current = false; setBusy(false) }
        }}>Plan einmalig bereitstellen</Button>
        {publication && <p role="status" className="text-sm text-muted">{publication.message}</p>}
        <p className="text-sm text-muted">Dabei werden nur Datum, Stoppzeit oder Pause an deinen eingerichteten Server übertragen.</p>
      </MoreInfo>
      {error && <p role="alert" className="text-warm">{error}</p>}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Dein Abend">
        <LateForm date={date} m={m} onDone={(text) => { setPublication(undefined); setEditing(false); st.showToast(text) }} />
      </Sheet>

      <Button variant="ghost" onClick={() => setSetup(0)}>{st.local.extras?.pcStopSetupDone ? 'Windows-Einrichtung erneut ansehen' : 'PC einrichten'}</Button>
      {st.local.extras?.pcStopSetupDone && <p className="text-sm text-muted">Du hast die Einrichtung hier als angesehen gemerkt. Die tatsächliche Ausführung am PC wird dadurch nicht bestätigt.</p>}
      <Sheet open={setup !== undefined} onClose={() => setSetup(undefined)} title="PC einrichten">
        <p className="mb-3 text-sm text-muted">Schritt {(setup ?? 0) + 1} von 3</p>
        {setup === 0 && <div className="space-y-4">
          <h3 className="text-xl font-semibold">Ein ruhiger Abschluss am PC</h3>
          <p>Der PC erinnert dich 15 und 5 Minuten vorher. Zur Stoppzeit bleiben 5 Minuten zum Speichern; danach fährt er ohne Zwang herunter. Offene Programme können das aufhalten.</p>
          <p>Du kannst den Stopp für heute direkt am PC aussetzen. Änderungen in Anker erreichen den PC nur mit eingerichteter Verbindung.</p>
          <Button variant="primary" className="w-full" onClick={() => setSetup(1)}>Weiter zum Paket</Button>
        </div>}
        {setup === 1 && <div className="space-y-4">
          <h3 className="text-xl font-semibold">Paket auf deinen PC übertragen</h3>
          <p className="text-sm text-muted">
            {user
              ? 'Angemeldet: Der aktuelle Plan kann bereitgestellt werden. Dein PC muss ihn selbst abrufen; der Empfang ist nicht bestätigt.'
              : supabaseConfigured
                ? 'Ohne Anmeldung können Änderungen nicht an deinen Server übertragen werden. Ein bestehender PC-Auftrag kann weiter gelten.'
                : 'Ohne eingerichteten Server kennt der PC deine Änderungen in der App nicht. Das neue Paket kann eine ausdrücklich gewählte feste Zeit verwenden.'}
          </p>
          <MoreInfo summary="Bestehende Installation und technische Details">
            <p>Für freie Verlängerungen und Pausen benötigst du das neue Windows-Paket (Protokoll 2). Mit Server muss auch die Funktion pc-stop das Protokoll 2 unterstützen. Ältere Installationen können weiterhin nach ihrem alten Plan abschalten. Für heute direkt am PC aussetzen: pc-stop-abbrechen.ps1.</p>
          </MoreInfo>
          <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={download}>
            {busy ? 'Erstelle Paket …' : 'Paket für Windows herunterladen'}
          </Button>
          <Button className="w-full" onClick={() => setSetup(2)}>Paket liegt auf dem PC · weiter</Button>
          <BackButton onClick={() => setSetup(0)} />
        </div>}
        {setup === 2 && <div className="space-y-4">
          <h3 className="text-xl font-semibold">Am PC installieren und ausprobieren</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>ZIP auf dem PC entpacken.</li>
            <li>Rechtsklick auf install.ps1 → „Mit PowerShell ausführen“.</li>
            <li>Den Ablauf am PC bewusst prüfen. Entfernen mit uninstall.ps1.</li>
          </ol>
          <p className="text-sm text-muted">Ein Download allein bestätigt keine Installation. „Einrichtung merken“ merkt nur, dass du diese Hilfe angesehen hast. Du kannst sie jederzeit erneut öffnen.</p>
          <Button variant="primary" className="w-full" disabled={busy} onClick={async () => {
            setBusy(true); setError('')
            try { await st.saveLocal((local) => ({ ...local, extras: { ...local.extras, pcStopSetupDone: true } })); setSetup(undefined); st.showToast('Einrichtung gemerkt. Du kannst die Anleitung jederzeit erneut öffnen.') }
            catch { setError('Die Auswahl konnte noch nicht gespeichert werden.') }
            finally { setBusy(false) }
          }}>Einrichtung merken</Button>
          <BackButton onClick={() => setSetup(1)} />
        </div>}
      </Sheet>
    </Page>
  )
}
