import { strToU8, zipSync } from 'fflate'
import { useEffect, useState } from 'react'
import { pcStopFiles } from '../../core/export/pcstop'
import { fmtTime } from '../../core/time'
import { saveFile } from '../../platform/files'
import { createPcStopToken, currentUser, pcStopEndpoint, pushPcStop, supabaseConfigured } from '../../platform/supabase'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Card, Page, Section } from '../components/ui'

export default function PcStop() {
  const { date, plan, log } = useToday()
  const st = useApp()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void currentUser().then(setUser)
  }, [])
  const extended = (log.override.pcStopExtendMin ?? 0) > 0

  const download = async () => {
    setBusy(true)
    try {
      let token = ''
      if (user) token = (await createPcStopToken()) ?? ''
      const files = pcStopFiles({ endpoint: token ? pcStopEndpoint() : '', token, fallbackTime: fmtTime(st.settings.pcStop) })
      const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(k.endsWith('.ps1') ? '﻿' + v : v)])))
      await saveFile('anker-pc-stopp.zip', zip, 'application/zip')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="PC-Stopp" back="/mehr">
      <Card className="text-center">
        <p className="text-muted">Heute</p>
        <p className="text-5xl font-semibold tabular-nums">{fmtTime(plan.pcStop)}</p>
        {extended && <p className="mt-1 text-sm text-muted">inkl. 15 Minuten Verlängerung</p>}
        <Button
          className="mt-4 w-full"
          disabled={extended}
          onClick={async () => {
            await st.setOverride(date, { pcStopExtendMin: 15 })
            await pushPcStop()
            st.showToast('Verlängert um 15 Minuten. Der PC weiß Bescheid.')
          }}
        >
          {extended ? 'Heute schon verlängert' : 'Verlängern (+15 min, 1× pro Abend)'}
        </Button>
      </Card>

      <Section title="Windows einrichten">
        <Card className="space-y-3">
          <p>Lädt ein kleines Paket für deinen PC: Warnung 15 und 5 Minuten vorher, zur Stopp-Zeit noch 5 Minuten zum Speichern, dann fährt er ohne Zwang herunter. Programme mit offener Arbeit können das aufhalten, und ein Skript im Paket setzt den Stopp für heute aus.</p>
          <p className="text-sm text-muted">
            {user
              ? 'Mit der App verbunden: Verlängerungen kommen automatisch an.'
              : supabaseConfigured
                ? 'Ohne Anmeldung nutzt der PC die feste Zeit. Für Verlängerungen: unter „Kalender & Sync“ anmelden.'
                : 'Ohne Sync nutzt der PC die feste Zeit aus den Einstellungen.'}
          </p>
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
