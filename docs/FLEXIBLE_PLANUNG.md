# Flexible Planung

Ein Plan ist ein Angebot, keine Verpflichtung. Diese Datei beschreibt, wie Anker damit rechnet.

**E04–E09 in Entwicklung.** Der tatsächliche Integrations- und Prüfstand steht im [Plan](ANKER_IMPLEMENTIERUNGSPLAN.md) und in den [Testnachweisen](ANKER_TESTNACHWEISE.md). Neue Handyfunktionen gelten dadurch noch nicht als am Gerät geprüft.

## Zustände

| Zustand | Bedeutung | Zählt als erledigt | XP |
|---|---|---|---|
| `done`, `minimal` | Wirklich gemacht | ja | ja |
| `skipped` | Übersprungen | nein | nein |
| `not-needed` | „Heute nicht nötig“ | nein | nein |
| Routine später (`routineAt`) | Bleibt offen, neue Zeit | nein | erst beim Tun |
| Versorgt (`coveredSteps`, `routineLinks`) | Entfällt an diesem Tag, gilt dort nicht als gemacht | nein | nein |

`routineDone` heißt „nichts mehr offen“, `routineCompleted` heißt „wirklich gemacht“. Nur Letzteres setzt `eveningRoutineDoneAt`.

Ein Tag mit `override.adjusted` zählt nie als verfehlt: Sind die Ziele erfüllt, ist er geschafft, sonst neutral. Verdiente XP bleiben, alte Tage ohne dieses Feld bewerten sich wie bisher.

Kapitel sammeln nur echte Erfolgstage; Nichtnutzung, Pausen und offene Tage nehmen keine Kapitel, XP oder Abzeichen weg. Eine Rücknahme unter **Heute anders** stellt die gespeicherte Planbasis wieder her, erhält aber danach wirklich erfolgte Starts, Ankünfte, Rückkehr und Erledigungen. Nachträgliche Ist-Handlungen sind kein Planungsfehler und werden nicht aus der Vergangenheit gelöscht.

## Reihenfolge

Einmalige Tagesänderung > bestätigter Termin > wiederkehrende Regel > allgemeiner Standard. Tagesänderungen schreiben den Wochenstandard nie um.

**Hart oder flexibel:** Harte Termine verschiebt Anker nie. Überschneiden sie sich, wird das benannt, ändern kann es nur der Nutzer. Flexible Dinge rücken nach: Evening-Plan entfällt bei einem Abendtermin, die Abendroutine kommt danach, kurz wenn es spät wird, oder wartet auf „Bin wieder da“.

## Wege

Der Start einer Strecke berücksichtigt die bestätigte Ortsfolge (`planLegs` in `src/core/planner/adaptive.ts`): Wohnung, Büro bei Arbeit vor Ort oder der vorherige Besuch. Ein Zwischenstopp wird nicht still zur Heimfahrt. Bei unbekanntem Aufenthaltsort bleibt auch der folgende Weg unklar. „Ort offen“, „vor Ort“ und „remote“ sind verschiedene Angaben; ein fehlender Ort bedeutet nicht Homeoffice.

- **Orte:** Unter **Mehr → Orte & manuelle Wege** werden lokale Namen, freiwillige Adressen, Koordinaten, Wegzeiten und Dinge zum Mitnehmen wiederverwendet. Adresse speichern startet weder Geocoding noch Ortung oder Routenabfrage.
- **Fahrzeit:** zunächst deine Schätzung am Termin oder am gespeicherten Ort, auch für direkte Wege zwischen zwei Orten. Fehlt sie, gibt es keine erfundene Abfahrt. Ein fehlender Wert wird nicht still als Null behandelt.
- **Rückkehr:** Ohne Endzeit wird keine angenommen.
- **Karte:** Der Link zu Google Maps braucht keinen Key und überträgt die Adresse erst beim Antippen. Maps gibt Anker keine Fahrzeit zurück, deshalb steht überall „deine Schätzung“.
- **Verkehr:** Der optionale Routes-Adapter liefert nach getrennter Dienste-/Orts-/Auftragsfreigabe eine kenntlich gemachte Schätzung mit Abrufstand. Erst eine bestätigte Übernahme ändert die manuelle Planung. Automatische begrenzte Prüfungen brauchen eine weitere Wahl und laufen nur bei aktiver App. Bei Fehlern oder überholter Antwort bleibt deine bisherige Fahrzeit bestehen. Die externe Anbietereinrichtung ist offen.
- **Standorthinweis:** ausschließlich für bewusst gewählte Besuche mit Koordinaten, eigener Android-Freigabe und begrenzter Gültigkeit. Ein mögliches Ankommen ist erst ein Vorschlag in der App. Nur dein Ja speichert die Ankunft, niemals Arbeitszeit oder Medikamenteneinnahme. Gerätefunktion, Hintergrundbetrieb und Rechteentzug sind noch separat zu prüfen.

## Morgen und Schlaf

```text
Abfahrt       = Ankunft - Ankunftspuffer - Fahrt
Weckzeit      = Abfahrt - Morgenroutine - Wach werden
Homeoffice    = Arbeitsbeginn - Rechnerstart - Morgenroutine - Wach werden
```

Anker berücksichtigt auch frühere harte Termine, offene Wege und bekannten Vorbereitungsbedarf. Für Remote-Termine entfällt der Weg, nicht automatisch die Vorbereitung. Ist eine benötigte Angabe offen oder passen harte Pflichten nicht zusammen, wird keine sichere Weckzeit erfunden.

Anker zeigt daraus einen Vorschlag und ändert den Wecker **nur nach Bestätigung**, einmalig für diesen Tag (`wakeOverride`). Kotlin übernimmt das über `wakeOverrides` und plant den Folgetag wieder normal. Ein klingelnder Wecker bleibt davon unberührt. Eine gespeicherte Änderung ist keine Garantie für späteres hörbares Klingeln; native Planung und Geräteprüfung bleiben eigene Nachweise.

Schlaf ist eine Schätzung aus Bettzeit, Einschlafzeit und Weckzeit, keine Messung und keine Therapie. Anker nennt eine kurze Nacht sachlich und empfiehlt nie, weniger zu schlafen. Medikation spielt in dieser Rechnung keine Rolle.

Ein offenes Abendende ist eine bewusste Wahl. Es erzeugt keine erfundene Freizeitgrenze und im neuen PC-Protokoll einen pausierten datierten Stoppauftrag. Verlängern ist nicht auf einmal 15 Minuten beschränkt. Der App-Status unterscheidet gespeicherten Wunsch, Bereitstellung am Server und unbekannten PC-Empfang. Alte Windows-/Serverinstallationen müssen dafür aktualisiert und separat geprüft werden.

## Packen und Wetter

Packlisten verwenden Gegenstände aus demselben Termin, seinem Ort und lokalen Vorlagen. **Vorbereitet** ist ein eigener Zustand; dadurch wird kein Termin erledigt. Unter **Vorbereitung** bleibt alles auch ohne Wetter oder Internet editierbar.

Wetterhinweise verwenden Stundenwerte für die relevante Zeit draußen, deinen bewusst gewählten lokalen Wetterort und Kleidungsvorlieben. Fehlende Temperatur-/Regen-/Windwerte bleiben unbekannt. Ein Cache gehört zum abgefragten Ort; nach einem Ortswechsel darf eine späte Antwort ihn nicht ersetzen. Abrufalter und fehlende Verbindung sind sichtbar. Wetter verschiebt keinen harten Termin und keinen Wecker.

## Zeit

Alles in Plan-Minuten für `Europe/Berlin`, Werte über 1440 liegen nach Mitternacht. Der Plantag wechselt um 04:00. UTC nur an den Rändern.

## Datenschutz und Dienste

Termine, Orte, Adressen, Wetterort, Packlisten, Vorschlags-/Besuchsfreigaben, Arbeit und Einnahmeprotokoll liegen in `LocalData` (`meta/local`): kein Datensync und keine automatische Kalenderübertragung dieser Inhalte. Eine gesonderte gewählte Abfrage kann die dafür genannten Angaben an den jeweiligen Dienst schicken. In einer vollständigen unverschlüsselten JSON-Sicherung sind die lokalen Daten enthalten; sensible Gruppen lassen sich bewusst weglassen. Erinnerungen und Widgetinhalte bleiben allgemein.

Der Settings-Sync entfernt Wetterort, Koordinaten und Wetteraktivierung auf beiden Übertragungswegen. Persönliche Kleidungsschwellen können als Einstellungen übertragen werden. Früher bereits auf einen Server geschriebene Orte werden durch die neue Projektion nicht rückwirkend gelöscht.

| Dienst | Wofür | Kosten | Was wird übertragen | Cache | Abschalten |
|---|---|---|---|---|---|
| Open-Meteo | Wetter, Standard aus | Bedingungen für private nichtkommerzielle Nutzung und Lizenz beim Anbieter prüfen | Bewusst eingegebener Suchort beziehungsweise freigegebene Koordinaten, technisch IP-Adresse; keine Termintexte und kein automatisches GPS | Ortsgebunden, Abrufalter sichtbar, regulär 3 Stunden | *Alltagshilfen → Wetter* |
| Google Maps (Link) | Route öffnen | Kein API-Key im Link; eigene Maps-Bedingungen | Adresse erst beim Antippen | keiner in Anker | Knopf nicht nutzen |
| Google Routes über eigenen Server | Optionale Fahrtschätzung, Standard aus | Anbieter-/Serverkosten möglich, aktuelle Bedingungen prüfen | Freigegebener Start/Ziel, Modus, Zeitbezug; keine laufende GPS-Spur | Vorschlag mit Abrufzeit; veraltete Daten nicht übernehmen | *Optionale Vorschläge*, gesonderte automatische Checks aus |
| OpenAI über eigenen Server | Editierbare kleine Schritte, Standard aus | Modell-/Serverkosten möglich | Sichtbarer bearbeitbarer Text, Detailtiefe und ausdrücklich gewählte Zusatzfelder | Keine automatische Taskänderung, kein Promptarchiv in der App | *Optionale Vorschläge* |
| Android / Google Play Dienste | Optionaler besuchsgebundener Standorthinweis | Systemdienst, eigene Voraussetzungen | Bewusst ausgewählte Koordinaten und Besuchsfenster; keine fortlaufende Standortbiografie in Anker | Nur gültige lokale Auswahl/Vorschläge | Auswahl am Termin entfernen, Androidrechte selbst verwalten |

Ohne Netz: „Wetter gerade nicht verfügbar“, der Rest läuft weiter.

Konfiguration, technische Budgetzähler, aktuelle Preise/Bedingungen und Routenmodi: [OPTIONALE_DIENSTE.md](OPTIONALE_DIENSTE.md). Die externen Anbieter sind durch den Code noch nicht bereitgestellt oder aktiviert. Kontrollierte Testantworten bestätigen keinen realen Anbieterbetrieb. Lokale Android-Sprache ist davon getrennt: passende On-Device-Modelle/Stimmen, bewusster Start, keine Audioablage und kein Cloud-Fallback; tatsächliche Erkennung/Hörbarkeit bleibt eine Geräteprüfung.
