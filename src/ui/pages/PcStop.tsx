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
import { Button, Card, Page, Section, Sheet } from '../components/ui'

export default function PcStop() {
  const { date, plan, m } = useToday()
  const st = useApp()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [editing, setEditing] = useState(false)
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
        <p className="text-sm text-muted">Das ist dein gewünschter Plan. Ein bereitgestellter Auftrag bestätigt keinen Empfang am PC.</p>
        <Button className="w-full" disabled={busy} onClick={() => setEditing(true)}>Abendzeit ändern</Button>
        <Button className="w-full" variant="ghost" disabled={busy} onClick={async () => {
          if (pending.current) return
          pending.current = true; setBusy(true); setError('')
          try { setPublication(await pushPcStop({ manual: true })) }
          catch { setError('Der Plan konnte nicht bereitgestellt werden. Ein alter PC-Auftrag kann weiter gelten.') }
          finally { pending.current = false; setBusy(false) }
        }}>Plan einmalig bereitstellen</Button>
        {publication && <p role="status" className="text-sm text-muted">{publication.message}</p>}
        <p className="text-sm text-muted">Dabei werden nur Datum, Stoppzeit oder Pause an deinen eingerichteten Server übertragen.</p>
      </Card>
      {error && <p role="alert" className="text-warm">{error}</p>}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Dein Abend">
        <LateForm date={date} m={m} onDone={(text) => { setPublication(undefined); setEditing(false); st.showToast(text) }} />
      </Sheet>

      <Section title="Windows einrichten">
        <Card className="space-y-3">
          <p>Lädt ein kleines Paket für deinen PC: Warnung 15 und 5 Minuten vorher, zur Stopp-Zeit noch 5 Minuten zum Speichern, dann fährt er ohne Zwang herunter. Programme mit offener Arbeit können das aufhalten, und ein Skript im Paket setzt den Stopp für heute aus.</p>
          <p className="text-sm text-muted">
            {user
              ? 'Angemeldet: Der aktuelle Plan kann bereitgestellt werden. Dein PC muss ihn selbst abrufen; der Empfang ist nicht bestätigt.'
              : supabaseConfigured
                ? 'Ohne Anmeldung können Änderungen nicht an deinen Server übertragen werden. Ein bestehender PC-Auftrag kann weiter gelten.'
                : 'Ohne eingerichteten Server kennt der PC deine Änderungen in der App nicht. Das neue Paket kann eine ausdrücklich gewählte feste Zeit verwenden.'}
          </p>
          <p className="text-sm text-warm">Für freie Verlängerungen und Pausen benötigst du das neue Windows-Paket (Protokoll 2). Mit Server muss auch die Funktion pc-stop das Protokoll 2 unterstützen. Ältere Installationen können weiterhin nach ihrem alten Plan abschalten. Für heute direkt am PC aussetzen: pc-stop-abbrechen.ps1.</p>
          <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={download}>
            {busy ? 'Erstelle Paket …' : 'Paket für Windows herunterladen'}
          </Button>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>ZIP auf dem PC entpacken.</li>
            <li>Rechtsklick auf install.ps1 → „Mit PowerShell ausführen“.</li>
            <li>Fertig. Entfernen mit uninstall.ps1.</li>
          </ol>
        </Card>
      </Section>
    </Page>
  )
}
