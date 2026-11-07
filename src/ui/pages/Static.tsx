import { Browser } from '@capacitor/browser'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { routineCoverage } from '../../core/flexible'
import { COMPLETE_BACKUP, makeBackup, parseBackup, previewImport, type BackupSelection, type ImportPreview } from '../../core/export/backup'
import type { Rec } from '../../data/types'
import { printSheets, preparePrintSheets, PRINT_CHOICES, type PaperSize, type PrintChoice } from '../../core/print'
import { pickTextFile, saveFile, shareLocalFile } from '../../platform/files'
import { AnkerNative, isNative, safe } from '../../platform/native'
import { requestNotificationPermission } from '../../platform/notifications'
import { waitForPrintReady } from '../../platform/print'
import { planFor, repository, today, useApp } from '../../state/store'
import { QrCode } from '../components/QrCode'
import { Button, Card, Page, Row, Section, Segmented } from '../components/ui'

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline"
      onClick={(e) => {
        if (isNative()) {
          e.preventDefault()
          void Browser.open({ url: href })
        }
      }}
    >
      {children}
    </a>
  )
}

/** Statische Hilfe-Seite: ADHS-Diagnose, Schuldnerberatung. */
export function Help() {
  return (
    <Page title="Hilfe & Anlaufstellen" back="/mehr">
      <Card className="bg-warm-soft text-warm">
        <p className="font-semibold">Anker ersetzt keine ärztliche oder therapeutische Beratung.</p>
        <p className="mt-1">Wenn es dir schlecht geht: Telefonseelsorge 0800 111 0 111 (kostenlos, rund um die Uhr).</p>
      </Card>
      <Section title="Wenn es trotz Behandlung schwer bleibt">
        <Card className="space-y-3">
          <p>Sprich es bei deiner Fachärztin oder deinem Facharzt an, wenn der Alltag weiter stark leidet. Mögliche Wege sind ADHS-spezifische Psychotherapie (z. B. Verhaltenstherapie), Ergotherapie, Coaching und freiwillige Anpassungen am Arbeitsplatz.</p>
          <p className="text-sm text-muted">Anker hilft im Alltag. Es ersetzt keine Behandlung und kann Folgen im Beruf oder bei der Gesundheit nicht sicher verhindern.</p>
        </Card>
        <AskSomeone />
        {isNative() && (
          <Row label="Ablenkungen am Handy begrenzen" sub="Freiwillige Wege und tatsächliche Android-Einstellungen" to="/einstellungen/hilfen" />
        )}
      </Section>
      <Section title="ADHS: Diagnose und Behandlung">
        <Card className="space-y-3">
          <p>
            <strong>1. Hausarzt:</strong> Eine mögliche erste Anlaufstelle. Besprecht, was dir schwerfällt und welche weitere Unterstützung oder Überweisung passt.
          </p>
          <p>
            <strong>2. Facharzt für Psychiatrie (und Psychotherapie):</strong> Stellt die Diagnose bei Erwachsenen und bespricht die Behandlung (z. B. Medikamente, Therapie, Coaching).
          </p>
          <p>
            <strong>3. Terminservicestelle 116117:</strong> Informationen zur Terminvermittlung und den jeweiligen Voraussetzungen: Telefon 116117 oder <ExtLink href="https://www.116117.de">116117.de</ExtLink>. Verfügbarkeit und Wartezeiten unterscheiden sich.
          </p>
          <p>
            <strong>4. Psychiatrische Institutsambulanz (PIA):</strong> Kliniken informieren über ihre Angebote, Aufnahmevoraussetzungen und Wartezeiten. Eine PIA ist nicht für jede Situation zuständig.
          </p>
          <p>
            <strong>5. ADHS Deutschland e.V.:</strong> Selbsthilfe, Gruppen vor Ort, Infos für Erwachsene: <ExtLink href="https://www.adhs-deutschland.de">adhs-deutschland.de</ExtLink>.
          </p>
        </Card>
      </Section>
      <Section title="Kostenlose Schuldnerberatung">
        <Card className="space-y-3">
          <p>Seriöse Schuldnerberatung ist kostenlos. Finger weg von Angeboten, die vorab Geld wollen.</p>
          <p>
            <strong>Caritas:</strong> <ExtLink href="https://www.caritas.de/hilfeundberatung/onlineberatung/schuldnerberatung">Online- und Vor-Ort-Beratung</ExtLink>
          </p>
          <p>
            <strong>Diakonie:</strong> <ExtLink href="https://www.diakonie.de/schuldnerberatung">Schuldnerberatung finden</ExtLink>
          </p>
          <p>
            <strong>Verbraucherzentrale:</strong> <ExtLink href="https://www.verbraucherzentrale.de">verbraucherzentrale.de</ExtLink> – auch zu Krediten und Baufinanzierung.
          </p>
        </Card>
      </Section>
    </Page>
  )
}

/** Freiwillig: Der Text wird nur kopiert oder geteilt, wenn du es antippst. Anker sendet nichts selbst. */
function AskSomeone() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const text = 'Hast du kurz Zeit für mich? Ich hänge gerade fest und könnte etwas Unterstützung gebrauchen.'
  return (
    <Card className="space-y-3">
      <p className="font-medium">Eine vertraute Person um Hilfe bitten</p>
      <p className="text-muted">„{text}“</p>
      <Button
        size="sm"
        onClick={async () => {
          setCopied(false); setCopyError(false)
          try { await navigator.clipboard.writeText(text); setCopied(true) }
          catch { setCopyError(true) }
        }}
      >
        {copied ? 'Kopiert' : 'Text kopieren'}
      </Button>
      {copyError && <p role="status" className="text-sm text-muted">Kopieren ist gerade nicht möglich. Du kannst den Text oben selbst auswählen.</p>}
    </Card>
  )
}

/** JSON-Export/-Import als Backup. */
export function Backup() {
  const st = useApp()
  const [msg, setMsg] = useState<string>()
  const [error, setError] = useState<string>()
  const [selection, setSelection] = useState<BackupSelection>({ ...COMPLETE_BACKUP })
  const [params] = useSearchParams()
  const [restore, setRestore] = useState(() => params.get('wiederherstellen') === '1')
  const [restored, setRestored] = useState(false)
  const [candidate, setCandidate] = useState<{ records: Rec[]; preview: ImportPreview }>()
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setMsg(undefined); setError(undefined)
    try { await action() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Datei konnte noch nicht verarbeitet werden.') }
    finally { pending.current = false; setBusy(false) }
  }
  const groups: { key: keyof BackupSelection; label: string }[] = [
    { key: 'work', label: 'Arbeitsaufgaben, Arbeitszeiten, Übergaben und zugeordnete Gedanken' },
    { key: 'health', label: 'Einnahme- und freiwilliges Schlafprotokoll' },
    { key: 'places', label: 'Orte, Termine, Wetterort und Packlisten' },
    { key: 'deviceTests', label: 'Testberichte und Testnotizen' },
  ]
  return (
    <Page className="settings-page" title="Sicherung" back="/mehr">
      <p className="px-1 text-muted">Alle Daten liegen auf diesem Gerät. Eine Sicherung ist eine Datei, die du aufbewahrst.</p>
      <p className="px-1 text-sm text-muted">Sicherungen sind nicht verschlüsselt. Eine vollständige Sicherung enthält auch Arbeitsaufgaben und private Protokolle. Du kannst unten bewusst Bereiche weglassen.</p>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="min-h-11 py-2">Was soll die Sicherung enthalten?</summary>
        <fieldset disabled={busy} className="space-y-2">
          <legend className="sr-only">Sensible Bereiche auswählen</legend>
          <p className="text-sm text-muted">Standardmäßig alles. Du kannst diese Bereiche bewusst weglassen. Freitexte können weiterhin persönliche Angaben enthalten.</p>
          {groups.map((group) => <label key={group.key} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={selection[group.key]} onChange={(event) => setSelection((before) => ({ ...before, [group.key]: event.target.checked }))} />
            <span>{group.label}</span>
          </label>)}
        </fieldset>
      </details>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => void run(async () => {
          const b = makeBackup(await repository().all(), new Date(), selection)
          await saveFile(`anker-sicherung-${today()}.json`, JSON.stringify(b, null, 1), 'application/json')
          setMsg(isNative() ? 'Sicherungsdatei erstellt. Prüfe im gewählten Speicherort, ob du sie aufbewahrt hast.' : 'Download angefordert. Bewahre die Sicherungsdatei an einem eigenen Speicherort auf.')
        })}
      >
        Sicherung exportieren
      </Button>
      <Card className="space-y-3">
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" checked={restore} disabled={busy} className="mt-1 h-5 w-5 shrink-0" onChange={(event) => {
            if (pending.current) return
            const previous = restore
            const next = event.target.checked
            setRestore(next)
            void run(async () => {
              try {
                const preview = candidate && previewImport(candidate.records, await repository().all(), next ? 'restore' : 'merge')
                if (candidate && preview) setCandidate({ records: candidate.records, preview })
              } catch (reason) {
                setRestore(previous)
                throw reason
              }
            })
          }} />
          <span className="min-w-0 break-words">Werte aus dieser Sicherung wiederherstellen</span>
        </label>
        <p className="text-sm text-muted">{restore ? 'Die gewählten Werte werden auch aus einer älteren Sicherung übernommen. Andere Datensätze und ausgelassene Bereiche bleiben erhalten. Testberichte ergänzen frühere Belege; aktuelle Rückmeldungen bleiben bestehen.' : 'Normaler Import: Neuere Daten auf diesem Gerät bleiben erhalten. Für einen Umzug oder eine bewusste Wiederherstellung kannst du den Schalter wählen.'}</p>
      </Card>
      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => void run(async () => {
          setCandidate(undefined)
          const text = await pickTextFile()
          if (!text) return
          const records = parseBackup(text)
          setCandidate({ records, preview: previewImport(records, await repository().all(), restore ? 'restore' : 'merge') })
        })}
      >
        Sicherung importieren
      </Button>
      {candidate && <Card className="space-y-3">
        <h2 className="font-semibold">Vor dem Import prüfen</h2>
        <p>{candidate.preview.incoming} Einträge gelesen · {candidate.preview.changed} {restore ? 'zur Wiederherstellung' : 'neuere Änderungen'} · {candidate.preview.skipped} {restore ? 'nicht zusätzlich übernommen' : 'ältere oder gleiche Versionen bleiben unangetastet'}.</p>
        {candidate.preview.deletions > 0 && <p className="text-sm text-muted">Enthält {candidate.preview.deletions} ausdrücklich gelöschte Datensätze.</p>}
        {candidate.preview.sensitive.length > 0 && <p className="text-sm text-muted">Private Bereiche in der Datei: {candidate.preview.sensitive.join(', ')}.</p>}
        <p className="text-sm text-muted">Ausgelassene Bereiche einer Teilsicherung bleiben auf diesem Gerät erhalten. {restore ? 'Die Sicherungswerte ersetzen bewusst die entsprechenden Werte auf diesem Gerät; Originalzeiten in Aufgaben und Berichten bleiben erhalten.' : 'Beim Import werden neuere Änderungen nochmals geprüft.'}</p>
        <Button variant="primary" disabled={busy || candidate.preview.changed === 0} onClick={() => void run(async () => {
          const n = await st.importRecords(candidate.records, restore ? 'restore' : 'merge')
          setCandidate(undefined)
          if (n && restore) setRestored(true)
          setMsg(n ? restore ? `${n} Einträge aus der Sicherung wiederhergestellt. Andere Daten bleiben erhalten.` : `${n} Einträge übernommen. Neuere Daten auf dem Gerät bleiben erhalten.` : 'Nichts Neues in der Sicherung.')
        })}>{restore ? 'Sicherung jetzt wiederherstellen' : 'Jetzt importieren'}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setCandidate(undefined)}>Abbrechen</Button>
      </Card>}
      {restored && <Card className="space-y-3">
        <h2 className="font-semibold">Übernommene Daten prüfen</h2>
        <p className="text-sm text-muted">Vergleiche Routinen, Spielstand und nächste Weckzeit. Eine Sicherung überträgt keine Android-Freigaben. Nach einer Neuinstallation prüfst du Wecker und Benachrichtigungen in dieser App selbst.</p>
        <Row label="Wecker & Benachrichtigungen prüfen" to="/wecker" />
        {isNative() && <Button disabled={busy} className="w-full" onClick={() => void run(async () => {
          const granted = await requestNotificationPermission()
          setMsg(granted ? 'Android hat die Benachrichtigungsfreigabe bestätigt. Prüfe den weiteren Weckerstand in der Diagnose.' : 'Die Benachrichtigungsfreigabe ist noch nicht bestätigt. Du kannst sie später im Weckerstand prüfen.')
        })}>Benachrichtigungen erlauben</Button>}
        <p className="text-sm text-muted">Falls du aus einer anderen Installation umziehst: Lass sie bis zum Datenvergleich erhalten. Ihre Wecker laufen unabhängig; stelle sie erst nach deinem bewussten neuen Test selbst ab.</p>
      </Card>}
      {msg && <p role="status" className="px-1 text-muted">{msg}</p>}
      {error && <p role="alert" className="px-1 text-warm">{error}</p>}
    </Page>
  )
}

/**
 * Druckauswahl: Vor dem Dialog ist sichtbar, was genau auf dem Papier landet.
 * Android nutzt den System-Druckdialog (dort auch „Als PDF speichern“), das Web window.print().
 */
export function Print() {
  const st = useApp()
  const s = st.settings
  const activeTest = useApp((x) => x.local.deviceTests?.activeId)
  const [params] = useSearchParams()
  const initial = params.get('typ') as PrintChoice | null
  const [choice, setChoice] = useState<PrintChoice>(initial && PRINT_CHOICES.some((c) => c.value === initial) ? initial : 'both')
  const [size, setSize] = useState<PaperSize>('A5')
  const [scope, setScope] = useState<'template' | 'day'>(params.get('tag') ? 'day' : 'template')
  const [date, setDate] = useState(() => { const value = params.get('tag'); return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value ? value : today() })
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const content = useRef<HTMLDivElement>(null)
  const sheets = printSheets(choice, s, scope === 'day' ? { plan: planFor(date), log: st.days[date], coverage: routineCoverage(date, s, st.days) } : undefined)

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setMsg(undefined)
    try {
      if (!content.current) return
      await waitForPrintReady(content.current)
      await action()
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Das Dokument konnte nicht vorbereitet werden. Bitte versuche es erneut.')
    } finally { busyRef.current = false; setBusy(false) }
  }
  const nativeDocument = () => ({ size, fontScale: s.appearance.fontScale, sheets: preparePrintSheets(sheets) })
  const print = () => run(async () => {
    if (isNative()) {
      const result = await safe(() => AnkerNative.printPage({ jobName: `Anker ${PRINT_CHOICES.find((c) => c.value === choice)?.label ?? ''}`.trim(), ...nativeDocument() }), { opened: false })
      setMsg(result.opened ? 'Druckdialog geöffnet.' : 'Android konnte den Druckdialog nicht öffnen. Du kannst stattdessen unten eine PDF-Datei erstellen und teilen.')
    } else {
      window.print(); setMsg('Druckdialog geöffnet. Ob du druckst oder abbrichst, entscheidest du dort.')
    }
  })
  const pdf = () => run(async () => {
    const result = await AnkerNative.exportPrintPdf(nativeDocument())
    setMsg('PDF-Datei erstellt. Wähle im Teilen-Menü, wo du sie speichern oder öffnen möchtest.')
    try {
      await shareLocalFile(`Anker ${size}.pdf`, result.uri)
      setMsg('PDF-Datei erstellt und Teilen-Menü geöffnet. Anker bestätigt keinen Versand oder Ausdruck.')
    } catch {
      setMsg('Die PDF-Datei wurde erstellt. Das Teilen wurde beendet oder konnte nicht geöffnet werden. Du kannst es erneut versuchen.')
    }
  })

  return (
    <div ref={content} className="mx-auto max-w-xl px-4 pb-16 safe-top" data-paper={size} data-print-root>
      <style>{`@media print { @page { size: ${size}; margin: 10mm; } }`}</style>
      <fieldset disabled={busy} className="no-print mb-4 min-w-0 space-y-3 border-0 p-0">
        {activeTest !== undefined && <Link to={`/geraetetest?fall=${activeTest}`} className="flex min-h-11 items-center rounded-xl bg-surface-2 px-3 text-accent">Zurück zu Test {activeTest}</Link>}
        <div className="flex items-center gap-2">
          <Button onClick={() => history.back()}>‹ Zurück</Button>
          <h1 className="min-w-0 break-words text-xl font-semibold">Druckansicht</h1>
        </div>
        <Segmented<PrintChoice> label="Was drucken?" value={choice} options={PRINT_CHOICES} onChange={setChoice} />
        {(choice === 'morning' || choice === 'evening' || choice === 'both') && <>
          <Segmented<'template' | 'day'> label="Vorlage oder Tagesplan" value={scope} options={[{ value: 'template', label: 'Standardvorlage' }, { value: 'day', label: 'Für einen Tag' }]} onChange={setScope} />
          {scope === 'day' && <label className="block space-y-1"><span className="text-sm text-muted">Tag für die Routine</span><input type="date" aria-label="Tag für die Routine" className="min-h-12 w-full rounded-xl bg-surface-2 px-3" value={date} onChange={(event) => { const value = event.target.value; if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))) setDate(value) }} /></label>}
        </>}
        <Segmented<PaperSize>
          label="Papier"
          value={size}
          options={[
            { value: 'A5', label: 'A5' },
            { value: 'A4', label: 'A4' },
          ]}
          onChange={setSize}
        />
        <Button variant="primary" size="lg" className="w-full" onClick={print}>
          Drucken oder als PDF speichern
        </Button>
        {isNative() && <Button size="lg" className="w-full" onClick={pdf}>PDF-Datei erstellen und teilen</Button>}
        {busy && <p role="status" className="text-sm text-muted">Dokument wird vorbereitet …</p>}
        {msg && (
          <p className="text-warm" role="status">
            {msg}
          </p>
        )}
      </fieldset>
      {sheets.map((sheet) =>
        sheet.kind === 'qr' ? (
          <section key={sheet.id} data-sheet={sheet.id} className="print-page mx-auto mb-6 flex w-full max-w-md flex-col items-center justify-center rounded-2xl bg-white p-8 text-center text-black">
            <h2 className="mb-2 text-3xl font-bold">{sheet.title}</h2>
            <p className="mb-6 text-lg">{sheet.subtitle}</p>
            <QrCode value={sheet.value} size={300} label="Wecker-QR-Code" />
            <p className="mt-6 text-lg">{sheet.footer}</p>
          </section>
        ) : (
          <section key={sheet.id} data-sheet={sheet.id} className="print-page mx-auto mb-6 w-full max-w-md rounded-2xl bg-white p-8 text-black">
            <h2 className="mb-1 text-3xl font-bold">{sheet.title}</h2>
            {sheet.subtitle && <p className="mb-4 text-lg">{sheet.subtitle}</p>}
            <ul className="mt-4 space-y-3 text-xl">
              {sheet.items.map((item, index) => (
                <li key={`${sheet.id}:${index}`} className="relative whitespace-pre-wrap break-words pl-10">
                  <span className="print-box absolute left-0 top-1 inline-block h-6 w-6 rounded border-2 border-black" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {sheet.footer && <p className="mt-6 text-lg">{sheet.footer}</p>}
          </section>
        ),
      )}
    </div>
  )
}
