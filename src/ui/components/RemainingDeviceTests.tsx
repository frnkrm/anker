import { Button, Card, Row, Section } from './ui'

const trials: { id?: number; to?: string; title: string; steps: string[] }[] = [
  { id: 54, title: 'Eine Nacht messen', steps: [
    'Nach dem Code18-Update: Unter Mehr → Schlaf & Wecker die nächste wirksame Hauptweckzeit prüfen. Für die ersten Versuche einen unabhängigen Ersatzwecker behalten.',
    '„Früheres Wecken bei Aktivität anbieten“ einschalten und das gewünschte Zeitfenster wählen. Abends auf Jetzt „Messung für diese Nacht starten“ oder „Ich liege im Bett“ wählen. Mikrofon erlauben und den tatsächlichen Laufstatus prüfen.',
    'Andere Medien stoppen und das Handy frei neben dich auf die Matratze legen. Die optionale Bildschirmsperre beendet fremde Medien nicht zuverlässig. Die App nicht zwangsweise beenden.',
    'Morgens Schlafüberblick und Weckerverlauf & Diagnose ansehen: Gab es gültige Eingänge oder Lücken? Tatsächliche Weckzeit, Abbruch und dein Empfinden notieren; vorgeschlagenen Schlafbeginn bestätigen, korrigieren oder verwerfen.',
    'Tägliche Vormerkung erst separat ausprobieren: Bei geöffneter App und vorhandener Mikrofonfreigabe kann die Messung zur Bettzeit starten. Im Hintergrund soll ein Hinweis zum Öffnen helfen; dort ist ein automatischer Mikrofonstart nicht verlässlich.',
  ] },
  { id: 96, title: 'Einschlaf-Rückfrage ausprobieren', steps: [
    '„Einschlafzeit schätzen“ bewusst aktivieren und bei Bedarf die Android-Einblendfreigabe erteilen. Messung starten; zum Prüfen dieser Frage den Bildschirm eingeschaltet und entsperrt lassen und eine andere App öffnen.',
    'Die erste zusätzliche Frage kommt frühestens nach fünf Minuten, weitere höchstens alle zehn Minuten in den ersten zwei Stunden. Einmal wegdrücken. Bei einem weiteren Versuch eine sichtbar angezeigte Frage eine Minute unbeantwortet lassen.',
    'Morgens die unsichere Schätzung prüfen. Aus gesperrtem Display oder Beobachtungslücken darf keine Einschlafzeit entstehen. „Heute Ruhe“ soll weitere Fragen beenden. Das ist keine zuverlässige Schlaferkennung.',
  ] },
  { id: 1, title: 'Wecker hören und morgens beenden', steps: [
    'Tagsüber unter Schlaf & Wecker „Wecker testen“ wählen und das Handy sperren. Prüfen: Ton hörbar, gewünschte Vibration und bedienbare Klingelansicht? Beenden und die Hörbarkeitsfrage selbst beantworten.',
    'Bei einem bewusst geplanten echten Hauptwecker zusätzlich den ausgedruckten Anker-QR scannen. Ein Testwecker ersetzt diesen Versuch nicht. Unabhängigen Ersatzwecker behalten.',
    'Den alternativen Weg und Notfall-Stopp bei einem eigenen Versuch prüfen. Tatsächliche Weckzeit und Befinden notieren; nur wirklich gemachte Morgenschritte bestätigen.',
  ] },
  { id: 94, title: 'Deinen Kalender vergleichen', steps: [
    'Nur wenn du den Handykalender nutzen möchtest: bewusst Leserecht erteilen und eine eigene Kalenderquelle auswählen. Einen bekannten Termin vergleichen; danach Quelle abwählen beziehungsweise Leserecht widerrufen und prüfen, dass keine weiteren Inhalte gelesen werden.',
  ] },
  { to: '/anker', title: 'Optional einen NFC-Tag ausprobieren', steps: [
    'Mit einem geeigneten physischen Test-Tag die gewünschte Zuordnung und Bestätigung ausprobieren. Ohne Tag den manuellen Weg nutzen. Reader-Abbruch und Schutz im Hintergrund brauchst du für diesen Prüfstand nicht erneut zu testen.',
  ] },
  { id: 102, title: 'PC im echten Alltag prüfen', steps: [
    'Bei Gelegenheit Tray, Wechsel zwischen deinen Monitoren und unterschiedliche Skalierung prüfen. Dialoge sollen über dem Hauptfenster bleiben und alle Knöpfe erreichbar sein.',
    'Netztrennung und Wiederverbindung bewusst ausprobieren. Live-Verbindung und bestätigten Plan getrennt beobachten. Sperre, Audio, Abschaltung oder Wake-on-LAN nur testen, wenn du die jeweilige Wirkung selbst gewählt hast und sie gerade auslösen möchtest.',
  ] },
]

export function RemainingDeviceTests({ onSelect }: { onSelect: (id: number) => void }) {
  return <div className="min-w-0 [overflow-wrap:anywhere]"><Section title="Für dich noch zu prüfen">
    <p className="px-1 text-sm text-muted">Vor allem echte Nächte, deine Hörbeobachtung und deine Hardware fehlen noch. Ein Versuch nach dem anderen; die ausführlichen Sammelfälle sind keine zusätzliche Pflichtliste.</p>
    {trials.map((trial, index) => <details key={trial.title} open={index === 0} className="rounded-2xl border border-line bg-surface p-4">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">{trial.title}</summary>
      <ol className="list-decimal space-y-3 py-3 pl-6">{trial.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {trial.id !== undefined && <Button size="sm" onClick={() => onSelect(trial.id!)}>Notiz im bisherigen Testfall erfassen · {trial.id}</Button>}
      {trial.to && <Row label="Ankerpunkte öffnen" to={trial.to} />}
    </details>)}
    <details className="rounded-2xl border border-line p-4">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">Technische Teilprüfungen bereits belegt</summary>
      <Card className="space-y-3">
        <p className="text-sm text-muted">USB-Prüfstand vom 17.11.2026: Samsung SM-S948B, SDK37, isolierter Code18/1.5.0-rc.4-Debugbuild. Diese früheren Gerätebelege sind keine neuen Häkchen für deinen aktuellen Appstand.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Geprüft: Hintergrund-Testwecker ausgelöst, Player gestartet und sauber gestoppt. Lautstärke, Nicht-stören und produktiver Wecker unverändert. Deine Hörbarkeit bleibt offen.</li>
          <li>Geprüft: befristeten Unterwegs-Hinweis zugestellt und entfernt, ohne eine Rückkehr zu bestätigen; stillen Schlafhinweis angezeigt und beendet.</li>
          <li>Geprüft: NFC-Abbruch einschließlich App-Wechsel; Bestätigung ohne Tag sowie Kalenderzugriff und Einblendung ohne Freigabe abgewiesen.</li>
          <li>Geprüft: Suche mit Einstellungs-Sprung, Info-Fenster, gegliedertes Heute-anpassen und zentrierter PC-Dialog in den dokumentierten Ansichten.</li>
        </ul>
        <p className="text-sm text-muted">Prüfstand danach entfernt. Keine vollständige Nacht, echte QR-/Tagprüfung oder menschliche Hörbeobachtung daraus abgeleitet. Im ausführlichen Sammelfall „Teilweise“ wählen, solange weitere Abschnitte fehlen. Vorhandene Berichte und IDs bleiben erhalten.</p>
      </Card>
    </details>
  </Section></div>
}
