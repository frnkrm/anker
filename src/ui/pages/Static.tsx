import { Browser } from '@capacitor/browser'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { makeBackup, parseBackup } from '../../core/export/backup'
import { printSheets, preparePrintSheets, PRINT_CHOICES, type PaperSize, type PrintChoice } from '../../core/print'
import { pickTextFile, saveFile, shareLocalFile } from '../../platform/files'
import { AnkerNative, isNative, safe } from '../../platform/native'
import { waitForPrintReady } from '../../platform/print'
import { repository, today, useApp } from '../../state/store'
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
          <Row label="Ablenkungen am Handy begrenzen" sub="Android hat dafür eigene Fokus- und Wohlbefinden-Einstellungen" onClick={() => void AnkerNative.openFocusSettings()} />
        )}
      </Section>
      <Section title="ADHS: Diagnose und Behandlung">
        <Card className="space-y-3">
          <p>
            <strong>1. Hausarzt:</strong> Erste Anlaufstelle. Erzähl offen, was dir schwerfällt. Du bekommst eine Überweisung.
          </p>
          <p>
            <strong>2. Facharzt für Psychiatrie (und Psychotherapie):</strong> Stellt die Diagnose bei Erwachsenen und bespricht die Behandlung (z. B. Medikamente, Therapie, Coaching).
          </p>
          <p>
            <strong>3. Terminservicestelle 116117:</strong> Hilft, mit Überweisung zeitnah einen Facharzttermin zu bekommen. Telefon 116117 oder <ExtLink href="https://www.116117.de">116117.de</ExtLink>.
          </p>
          <p>
            <strong>4. Psychiatrische Institutsambulanz (PIA):</strong> An vielen Kliniken, oft kürzere Wartezeiten. Einfach in der nächsten psychiatrischen Klinik nachfragen.
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
  const text = 'Hast du kurz Zeit für mich? Ich hänge gerade fest und könnte etwas Unterstützung gebrauchen.'
  return (
    <Card className="space-y-3">
      <p className="font-medium">Eine vertraute Person um Hilfe bitten</p>
      <p className="text-muted">„{text}“</p>
      <Button
        size="sm"
        onClick={async () => {
          await safe(() => navigator.clipboard.writeText(text), undefined)
          setCopied(true)
        }}
      >
        {copied ? 'Kopiert' : 'Text kopieren'}
      </Button>
    </Card>
  )
}

/** JSON-Export/-Import als Backup. */
export function Backup() {
  const st = useApp()
  const [msg, setMsg] = useState<string>()
  return (
    <Page title="Sicherung" back="/mehr">
      <p className="px-1 text-muted">Alle Daten liegen auf diesem Gerät. Eine Sicherung ist eine Datei, die du aufbewahrst.</p>
      <p className="px-1 text-sm text-muted">Die Datei ist nicht verschlüsselt und enthält auch Arbeitsaufgaben und, falls genutzt, dein Einnahmeprotokoll. Teile sie nicht unbedacht.</p>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={async () => {
          const b = makeBackup(await repository().all())
          await saveFile(`anker-sicherung-${today()}.json`, JSON.stringify(b, null, 1), 'application/json')
          setMsg('Sicherung erstellt.')
        }}
      >
        Sicherung exportieren
      </Button>
      <Button
        size="lg"
        className="w-full"
        onClick={async () => {
          const text = await pickTextFile()
          if (!text) return
          try {
            const n = await st.importRecords(parseBackup(text))
            setMsg(n ? `${n} Einträge übernommen. Neuere Daten auf dem Gerät bleiben erhalten.` : 'Nichts Neues in der Sicherung.')
          } catch (e) {
            setMsg((e as Error).message)
          }
        }}
      >
        Sicherung importieren
      </Button>
      {msg && <p className="px-1 text-muted">{msg}</p>}
    </Page>
  )
}

/**
 * Druckauswahl: Vor dem Dialog ist sichtbar, was genau auf dem Papier landet.
 * Android nutzt den System-Druckdialog (dort auch „Als PDF speichern“), das Web window.print().
 */
export function Print() {
  const s = useApp((x) => x.settings)
  const activeTest = useApp((x) => x.local.deviceTests?.activeId)
  const [params] = useSearchParams()
  const initial = params.get('typ') as PrintChoice | null
  const [choice, setChoice] = useState<PrintChoice>(initial && PRINT_CHOICES.some((c) => c.value === initial) ? initial : 'both')
  const [size, setSize] = useState<PaperSize>('A5')
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const content = useRef<HTMLDivElement>(null)
  const sheets = printSheets(choice, s)

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
          <h1 className="text-xl font-semibold">Druckansicht</h1>
        </div>
        <Segmented<PrintChoice> label="Was drucken?" value={choice} options={PRINT_CHOICES} onChange={setChoice} />
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
