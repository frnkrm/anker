import { Browser } from '@capacitor/browser'
import { useState } from 'react'
import { makeBackup, parseBackup } from '../../core/export/backup'
import { fmtTime } from '../../core/time'
import { pickTextFile, saveFile } from '../../platform/files'
import { isNative } from '../../platform/native'
import { repository, today, useApp } from '../../state/store'
import { QrCode } from '../components/QrCode'
import { Button, Card, Page, Section } from '../components/ui'

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

/** JSON-Export/-Import als Backup. */
export function Backup() {
  const st = useApp()
  const [msg, setMsg] = useState<string>()
  return (
    <Page title="Sicherung" back="/mehr">
      <p className="px-1 text-muted">Alle Daten liegen auf diesem Gerät. Eine Sicherung ist eine Datei, die du aufbewahrst.</p>
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

/** Druckansicht A5: Badspiegel, Haustür, QR-Code. */
export function Print() {
  const s = useApp((x) => x.settings)
  const m = s.routines.morning
  const e = s.routines.evening
  const page = 'print-page mx-auto mb-6 aspect-[148/210] w-full max-w-md rounded-2xl bg-white p-8 text-black shadow'
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 safe-top">
      <div className="no-print mb-4 flex items-center gap-2">
        <Button onClick={() => history.back()}>‹ Zurück</Button>
        <Button variant="primary" className="flex-1" onClick={() => window.print()}>
          Drucken (A5)
        </Button>
      </div>
      <section className={page}>
        <h1 className="mb-1 text-3xl font-bold">Badspiegel</h1>
        <p className="mb-5 text-lg">Morgens ab {fmtTime(s.anchor.wake)}</p>
        <ol className="space-y-2 text-xl">
          {m.map((x) => (
            <li key={x.id}>☐ {x.title}</li>
          ))}
        </ol>
        <h2 className="mt-6 mb-2 text-2xl font-bold">Abends</h2>
        <ol className="space-y-2 text-xl">
          {e.map((x) => (
            <li key={x.id}>☐ {x.title}</li>
          ))}
        </ol>
        <p className="mt-6 text-lg">Erst die Routine, dann zocken. Kleine Version zählt auch.</p>
      </section>
      <section className={page}>
        <h1 className="mb-5 text-3xl font-bold">Haustür</h1>
        <ul className="space-y-3 text-2xl">
          <li>☐ Schlüssel</li>
          <li>☐ Handy</li>
          <li>☐ Geldbeutel</li>
          <li>☐ Tasche / Laptop</li>
          {s.sport.kind === 'gym' && <li>☐ Sporttasche (an Sporttagen)</li>}
        </ul>
        <p className="mt-8 text-xl">Pünktlich los ist der halbe Tag.</p>
      </section>
      <section className={`${page} flex flex-col items-center justify-center text-center`}>
        <h1 className="mb-2 text-3xl font-bold">Guten Morgen ☀️</h1>
        <p className="mb-6 text-lg">Scannen schaltet den Anker-Wecker aus.</p>
        <QrCode value={s.alarm.qrSecret} size={300} label="Wecker-QR-Code" />
        <p className="mt-6 text-lg">Jetzt: Wasser trinken, Zähne putzen.</p>
      </section>
    </div>
  )
}
