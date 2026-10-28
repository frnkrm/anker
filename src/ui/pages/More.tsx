import { Page, Row, Section } from '../components/ui'

export default function More() {
  return (
    <Page title="Mehr">
      <Section title="Alltag">
        <Row label="🍳 Essen & Vorkochen" to="/essen" />
        <Row label="🧹 Aufräumen (10 Minuten)" to="/aufraeumen" />
        <Row label="🎒 Abend-Vorbereitung" to="/vorbereitung" />
        <Row label="💭 Gedanken" to="/inbox" />
        <Row label="🗓️ Wochenrückblick" to="/rueckblick" />
      </Section>
      <Section title="Einrichtung">
        <Row label="⚙️ Einstellungen" to="/einstellungen" />
        <Row label="🚦 Einrichtungs-Check" to="/check" />
        <Row label="⏰ Wecker & QR-Code" to="/wecker" />
        <Row label="🔌 PC-Stopp" to="/pc-stopp" />
        <Row label="🔗 Kalender & Sync" to="/verbindungen" />
      </Section>
      <Section title="Sonstiges">
        <Row label="🖨️ Druckansicht" to="/druck" />
        <Row label="💾 Sicherung" to="/backup" />
        <Row label="🤝 Hilfe & Anlaufstellen" to="/hilfe" />
      </Section>
    </Page>
  )
}
