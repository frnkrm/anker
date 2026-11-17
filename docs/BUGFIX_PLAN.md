# Bugfix-Plan aus dem Alltag

Verbindlich für die weitere Bearbeitung: [Effizient und autonom arbeiten](ARBEITSWEISE.md). UI-Anpassungen gesammelt zum Schluss, nach Funktionslogik und Datenmodell.

Stand: 17.11.2026. Hier sammeln wir neu gemeldete Fehler mit stabilen IDs
`BF-001`, `BF-002` usw. Bestehende V-/F-/T-/E-Aufträge bleiben erhalten;
die Integration gehört zu T-006. Weitere Punkte erst nach einer konkreten Meldung
ergänzen, keine vermuteten Fehler als beobachtet eintragen.

## Arbeitsweise: effizient und autonom

- Standard: 6.1 sol, Denkaufwand mittel. Für klar begrenzte Text-/Layoutänderungen
  genügt niedrig; mittel für Zustandslogik, Zeitberechnung und Regressionen.
  Höheren Aufwand oder ein anderes Modell erst bei einem konkreten ungelösten
  Problem empfehlen, keine routinemäßigen Modellwechsel oder Zweitgutachten.
  Diese Empfehlung ändert die Modellauswahl der App nicht automatisch.
- Pro Punkt zuerst Meldung und betroffenen aktuellen Code abgleichen. Ältere
  Screenshots können einen inzwischen geänderten Stand zeigen.
- Nur relevante Dateien und Abschnitte lesen. Vorhandene Belege wiederverwenden,
  bereits erfolgreiche Prüfungen ohne neue Änderung nicht wiederholen.
- Für einen beauftragten Fix selbstständig Ursache eingrenzen, kleinste passende
  Korrektur umsetzen, gezielt prüfen und den Status dokumentieren. Routineentscheidungen
  ohne erneute Erlaubnis treffen; nur bei fehlenden notwendigen Angaben nachfragen.
- Keine breiten Refactorings, zusätzlichen Funktionen oder parallelen Agenten für
  kleine Fehler. Bestehende Planer, Daten, IDs und Store-Aktionen weiterverwenden.
- Bei Logikfehlern ein aussagekräftiger Regressionstest vor dem Fix; bei reinen
  Text-/Layoutkorrekturen vorhandene Prüfungen und gezielte Sichtkontrolle nutzen.
  Gesamtsuiten an einem stabilen Integrationsstand bündeln; erforderliche CI- und
  Releaseprüfungen bleiben bestehen. Kein Android-Build für reine Planung.
- Fortschritt knapp melden: Ursache, Änderung, Prüfung oder konkreter Blocker.
  Keine wiederholten Statusabfragen ohne absehbaren Erkenntnisgewinn.
- Pro Punkt Umsetzung, automatische Prüfung und echte Gerätebeobachtung getrennt
  führen. Ein Build oder eine Aufnahme erledigt keine Nutzerhandlung.
- Dieser Auftrag erstellt den Plan. Produktänderungen sind damit noch nicht
  umgesetzt. Der separat autorisierte Play-Releaseauftrag bleibt bestehen;
  neue Bugfixes werden nicht still in dessen fest gebundene Appquelle aufgenommen.

## Aktueller Integrationsstand (17.11.2026)

Stand 17.11.2026, nach PR16: **BF-001–BF-005 und F-001–F-018 sind im
dokumentierten Softwareumfang implementiert und integriert**, einschließlich der
abschließenden gemeinsamen UI-Phase. F-013/F-014 sind zusätzlich über die echte
angemeldete App und kostenlose Anbieter erfolgreich geprüft. Aktueller main-Code:
`8f452fd5317cabc002f53ebe55ceedfc47559e0b`; eigene CI `44172620113` erfolgreich
(1.436 TypeScript-, 387 Browserfälle; PC-Matrix je 290 Fälle, davon zwei erwartete
Plattform-Skips). Das ist keine vollständige Geräte- oder Nachtabnahme.

Verbindliche [Restliste mit Voraussetzungen](OFFENE_ENTWICKLUNGEN.md#tatsächlich-offene-prüfungen).
[Anbieterbelege](GRATIS_SCHNITTSTELLEN_ABNAHME_20261117.md),
[gebundenes signiertes Code18-Artefakt](CODE18_AUSLIEFERUNGSBELEG_20261117.json).
Auf dem Handy ist weiterhin Code17/1.5.0-rc.3 installiert. Code18 ist fertig
signiert; Play-Ausführung bleibt für den 18.11.2026 um 22:50 Berlin geplant,
nach der Schlüsselaktivierung um 22:41. Kein neuer App-Build, keine neue Version
oder Änderung am gebundenen Artefakt durch diese reine Status-/Abnahmepflege.

## Übersicht

Die Prioritäten bedeuten Dringlichkeit, nicht eine vorgezogene Designrunde:
Zustands-/Erinnerungslogik zuerst, sämtliche UI-Anpassungen gesammelt zum Schluss
gemäß [Arbeitsweise](ARBEITSWEISE.md) und Ausführungsreihenfolge der Roadmap.

| ID | Thema | Priorität | Status |
| --- | --- | --- | --- |
| BF-001 | Jetzt-Ansicht: Countdown, nächste Handlung und Punkte sind unklar | Hoch: Kernansicht | Logik und UI implementiert; automatische Integration und Geräteabnahme getrennt |
| BF-002 | Offener Unterwegs-Zustand: Rückkehrbestätigung gerät ohne Erinnerung in Vergessenheit | Hoch: Alltagsbegleitung | Implementiert; befristete native Zustellung/Entfernung ohne automatische Rückkehr im isolierten Code18-Gerätetest bestätigt; vollständiger Alltagsablauf getrennt |
| BF-003 | Aufklappbare Bereiche haben keine eindeutig erkennbare Inhaltsgrenze | Mittel: Orientierung | UI integriert, automatische Integration bestanden; echte Geräteabnahme getrennt |
| BF-004 | KI-/Verkehrseinrichtung erklärt Sperren und nächste Schritte nicht verständlich | Mittel: Einrichtung | UI integriert, automatische Integration bestanden; echte Geräteabnahme getrennt |
| BF-005 | „Heute anpassen“ ist unübersichtlich; Aktionen und Einstellungen schwer auffindbar | Hoch: tägliche Bedienung | UI integriert, automatische Integration bestanden; echte Geräteabnahme getrennt |

## BF-001 – Die Jetzt-Ansicht erklärt nicht eindeutig, was jetzt dran ist

**Nutzerbeleg:** Screenshot `Screenshot_20261115_063055_Anker.jpg`, gemeldet am
17.11.2026. Sichtbar: „Aufstehen 06:40“, „noch 10 min“, „Frei · Normal“,
„+10 Kopfgeld“, „Aufstehen um 06:40“, „Kurz durchatmen“, „Ich hänge fest“ und
„Danach: Aufstehen“. Der Nutzer versteht den Bezug der zehn Minuten nicht.

**Gesichert und noch offen:** Die Darstellung ist mehrdeutig und wiederholt die
Aufstehzeit. Der Dateiname legt 06:30 als Aufnahmezeit nahe; das ist noch kein
Beleg für die damalige Geräteuhr oder Konfiguration. Im aktuellen Code steht der
Countdown in `src/ui/pages/Now.tsx` beim nächsten Zeitanker `v.hard`, während
`src/core/now.ts` „Kurz durchatmen“ als allgemeine Infoanzeige verwendet.
Das erklärt eine mögliche Kombination, ersetzt aber noch keine Reproduktion.
Ob „+10 Kopfgeld“ eine frühere echte Handlung quittiert oder fälschlich vergeben
wurde, ist offen. Auch 06:40 an einem freien Tag ist ohne Einstellungen kein
nachgewiesener Planungsfehler.

**Ziel:** Auf einen Blick erkennen: Welche Zeit läuft wofür? Was ist jetzt zu tun?
Wann folgt der nächste Schritt? Ohne künstliche Aufgabe oder unbelegte Belohnung.

**Umsetzungsschritte für den späteren Fix:**

1. Vor-Aufsteh-Situation mit vorhandenen Plan-/Log-Daten reproduzieren und prüfen,
   ob sie im aktuellen Appstand weiterhin auftritt. Keine privaten Daten anfordern,
   wenn ein synthetischer Fall ausreicht.
2. Countdown immer mit Bezug formulieren, beispielsweise „Aufstehen in 10 Minuten
   · 06:40“. Laufender Handlungstimer und Zeit bis zum nächsten Planpunkt müssen
   sprachlich unterscheidbar sein; keinen zweiten Countdown oder Planer bauen.
3. Für tatsächliche Warte-/Infozustände eine passende Erklärung statt einer
   scheinbaren Aufgabe anzeigen. „Bis dahin ist nichts zu tun“ nur verwenden,
   wenn der aktuelle Plan keine Handlung vorsieht. Wiederholte Aufstehhinweise
   zusammenfassen und „Ich hänge fest“ auf seinen Nutzen in diesem Zustand prüfen.
4. Herkunft und Dauer der Punkteanzeige prüfen. Punkte dürfen die Hauptorientierung
   nicht verdrängen; keine Vergabe aus Zeitablauf, Anzeigenwechsel oder bloßem Warten.
   Einen XP-Fehler nur bei tatsächlichem Nachweis als zusätzlichen Defekt behandeln.
5. Eine Aktion wie „Ich bin schon wach“ nur anbieten, wenn sie fachlich in eine
   bestehende, bewusst bestätigte Store-Aktion passt. Kein automatischer Morgenabschluss,
   keine Weckeränderung und keine neue Erledigungssemantik durch einen Textfix.

**Abnahme:**

- Zehn Minuten vor dem Aufstehen ist eindeutig, dass die Zeit bis zum Aufstehen
  gemeint ist. Kein Eindruck einer zehnminütigen Atemübung.
- Vor, am und nach dem Zeitanker bleiben Text und nächste Handlung stimmig;
  keine negativen Restzeiten oder unbelegten Erledigungen.
- Freier und Arbeitstag, geänderte Tages-Weckzeit sowie bereits begonnene oder
  abgeschlossene Morgenroutine beziehen sich auf den vorhandenen effektiven Plan.
- Laufende und pausierte Handlungstimer bleiben klar von Planzeiten unterscheidbar.
- Punkteanzeige an/aus, 320px Breite und große Schrift erhalten eine klare Hierarchie.
- Nachweis umfasst gezielte Logik-/UI-Prüfung entsprechend der tatsächlichen Änderung;
  echte Android-Sichtprüfung erst nach Durchführung als solche kennzeichnen.

**Umsetzungsstand 17.11.2026:** Reproduktion mit synthetischem Arbeits- und freiem
Tag: Trotz bewusst bestätigtem frühem Aufstehen bleibt `wake` vorher der nächste
Zeitanker (zwei Regressionen vor Fix rot). `nowView` nimmt diesen bestätigten Anker
jetzt ausschließlich aus seiner Anzeigeprojektion heraus. Kein Wecker-/Planumbau,
keine Daten-/XP-Buchung. Das erklärt eine mögliche Screenshotkombination, beweist
aber nicht die damaligen privaten Tagesfakten. Countdownbeschriftung, Infozustände,
Punkteherkunft und visuelle Abnahme bleiben offen für die gemeinsame Schlussphase.

## BF-002 – An den offenen Unterwegs-Zustand und die Rückmeldung erinnern

**Nutzerbeleg:** Screenshot `Screenshot_20261111_183718_Anker.jpg`, gemeldet am
17.11.2026. Über „Heute anders“ wurde ein Termin direkt nach der Arbeit eingetragen.
Die Jetzt-Ansicht zeigt den Termin und „Melde dich einfach, wenn du wieder da bist“
mit „Bin wieder da“. Laut Nutzer blieb die Bestätigung bis spät in die Nacht
vergessen. Gewünscht ist eine Erinnerung/Benachrichtigung, die den offenen Zustand
auch außerhalb der App wahrnehmbar hält. Private Terminbezeichnungen werden hier
nicht übernommen. Version und damalige Erinnerungseinstellungen sind nicht belegt.

**Ziel:** Die App nimmt dem Nutzer das Erinnern an ihre eigene Zustandsverwaltung
ab. Eine Rückfrage bietet den passenden Wiedereinstieg, bestätigt aber nie selbst
eine tatsächliche Rückkehr.

**Ansatz für den späteren Fix:**

1. Den Ablauf nach Arbeitsende mit einem über „Heute anders“ erfassten Termin
   reproduzieren. Bestehenden `away`-/`return-check`-Pfad in `src/core/support.ts`,
   Rückkehraktion und Erinnerungsplanung abgleichen. Prüfen, ob Rückkehrhinweise
   fehlen, nicht geplant werden oder lediglich zu wenig sichtbar sind.
2. Den aktiven Unterwegs-Zustand durch einen sichtbaren Statushinweis auf Android
   begleiten. Bevorzugt eine bestehende Benachrichtigung aktualisieren statt neue
   Karten zu stapeln. Antippen führt direkt zur aktuellen Rückkehrfrage in Anker.
3. Eine freundliche Rückfrage vorsehen, etwa „Noch unterwegs? Schau kurz in Anker.“
   Bei bekanntem geplantem Ende daran anknüpfen; ohne End-/Rückkehrzeit keine Uhrzeit
   erfinden. Eine einfache Wahl „Später erinnern“ beziehungsweise eine bewusst
   gewählte Erinnerungszeit ermöglichen. Konkretes Intervall und Wiederholung erst
   anhand vorhandener Einstellungen festlegen: begrenzt, abschaltbar, ohne Dauerpiepen.
4. „Bin wieder da“ verwendet weiterhin die vorhandene bewusst ausgelöste Store-Aktion.
   „Noch unterwegs“/„Später erinnern“, Wegwischen einer Meldung, Terminende und
   Zeitablauf sind keine Rückkehr. Keine automatische Erledigung, XP oder erfundene
   Rückkehrzeit. Standortautomatik ist für diesen Fix nicht erforderlich.
5. Vorhandenen ReminderScheduler, Zustellslots, Revisions-/Aktionsprüfung und
   Neuplanung nach Zustandsänderungen wiederverwenden. Höchstens drei sichtbare
   Erinnerungsslots; laufenden Alarm nie entfernen oder überlagern. Keine neue
   dauerhafte Hintergrunddienst-Architektur allein für einen Statushinweis.
6. Auf dem Sperrbildschirm nur allgemeine Texte, keine Namen, Orte oder Terminanlässe.
   Ruhezeiten und Nutzerwahl respektieren. Bei fehlenden Benachrichtigungsrechten
   den offenen Status in der App sichtbar lassen und die Einschränkung ehrlich
   erklären; keine erfolgte Zustellung behaupten.

**Abnahme:**

- Der gemeldete Ablauf „Arbeit → Termin → offene Rückkehr“ bleibt außerhalb der
  App erkennbar und bietet einen gezielten Weg zu „Bin wieder da“.
- Ein Termin mit geplanter Endzeit und einer ohne bekannte Rückkehrzeit sind
  abgedeckt; das geplante Ende wird nie als tatsächliche Ankunft interpretiert.
- „Später erinnern“ hält den Unterwegs-Zustand offen. Nach bestätigter Rückkehr
  verschwinden zugehörige Status-/Rückfragehinweise; neue Termine erhalten eigene
  gültige Identitäten, keine alten Benachrichtigungsaktionen.
- Offlinebetrieb, App-Neustart, Geräte-Neustart, bearbeiteter/entfernter Termin und
  Rücknahme von „Heute anders“ hinterlassen keine veralteten oder doppelten Hinweise.
- Eine bis nach Mitternacht offene Abwesenheit und der Planwechsel um 04:00 werden
  gezielt geprüft: keine stille Rückkehrbuchung, keine Zuordnung alter Aktionen zum
  neuen Tag und keine nachgeholte nächtliche Erinnerungsserie.
- Ruhezeiten, deaktivierte Hinweise, verweigerte Rechte und gleichzeitig laufender
  Alarm werden respektiert. Die übrige Tagesplanung wird nicht vorschnell als
  erledigt oder ausgefallen bewertet.
- Reine Planung/Zustandslogik gezielt automatisch prüfen; echte Android-Zustellung,
  Antippen und Entfernen der Meldung separat am Gerät nachweisen.

**Umsetzungsstand 17.11.2026:** Im vorhandenen ReminderBuilder fehlte ein
Rückkehrstatus-Check vollständig. Neue, zunächst ausgeschaltete Wahl
`reminders.returnCheckAfterMin` (15–240 Minuten nach Terminbeginn) erzeugt höchstens
eine sanfte Rückfrage pro Termin/Plantag; bei bekanntem Ende frühestens dann.
Die gewählte Verzögerung ist eine Erinnerungszeit, niemals eine errechnete Rückkehr.
Gültigkeit höchstens eine Stunde und bis zur Bettzeit; kein nächtliches Nachholen.
Termine zuhause/remote, Arbeitseinsätze, Absagen und bestätigte Rückkehr sind
ausgeschlossen. Die ausdrücklich gewählte Rückfrage darf die aus einem offenen
Termin abgeleitete Planruhe durchbrechen; globale Nachtruhe/Fokus gelten weiter.
Android und TypeScript verwenden dieselben Regeln. Bestehender Slot 2, neutrale
Texte, fester Sprung nach „Jetzt“, keine Erledigt-Aktion; gefälschte Aktionen werden
abgewiesen. Stabiler Zustellungstoken verhindert Wiederholung nach Planänderung.

Noch offen: Auswahl/Abschalten/Später-Erinnern und Statusanzeige in der gemeinsamen
UI-Phase; gezielte Positionierung bei mehreren Terminen; echte Android-Zustellung,
Antippen, Neustart und Entfernen nach Rückkehr. Bis dahin kein vollständiger
BF-002-Abschluss und keine Auslieferung dieser neuen Funktion. Automatische
Nachweise im Testnachweis dokumentiert; keine Gerätebeobachtung daraus ableiten.

## BF-003 – Aufklappbare Bereiche optisch eindeutig abgrenzen

**Nutzerbeleg:** Screenshot `Screenshot_20261117_012619_Anker.jpg` zur PC-Seite
der Handy-App. Der Nutzer kann nach dem Aufklappen nicht sicher erkennen,
wo ein Bereich anfängt und endet. Der Screenshot zeigt mehrere geschlossene
Punkte; die Schwierigkeit im geöffneten Zustand ist als Nutzerbericht belegt,
noch nicht als reproduzierte aktuelle Ansicht. Einordnung: Bedienbarkeitsfehler
einer bestehenden Komponente, keine neue Produktfunktion.

**Ziel und Ansatz:** Überschrift, offener Inhalt und Bereichsende bilden eine
erkennbare Einheit. Bestehendes `MoreInfo` in `src/ui/components/ui.tsx`
gezielt prüfen; eine gemeinsame Verbesserung bevorzugen, sofern andere
Verwendungen dadurch nicht schlechter werden. Dezente Fläche oder Umrandung,
Einrückung und konsistente Innen-/Außenabstände kombinieren; nicht allein Farbe
als Trennung verwenden. Geöffneten Zustand am Pfeil und an der Überschrift
erkennbar machen. Kein pauschales Akkordeon-Verhalten, das andere Bereiche
ungefragt zuklappt. Lange Inhalte sollen ihre zugehörigen Aktionen klar enthalten.

**Abnahme:**

- Ein offener Bereich und mehrere benachbarte offene Bereiche sind eindeutig
  voneinander und von unabhängigen Buttons/Texten getrennt.
- Anfang und Ende bleiben auch nach Scrollen, bei langen Texten, 320px Breite und
  großer Schrift verständlich; nötige Überschriften wiederholen statt Inhalte zu kürzen.
- Helles/dunkles Thema und optionale Nachtfarben behalten erkennbare Grenzen,
  lesbare Kontraste, sichtbaren Tastaturfokus und ausreichend große Tippflächen.
- Tastatur und Screenreader melden Überschrift und Offen-/Geschlossenzustand;
  bestehende native Details-/Summary-Semantik und Formularzustände bleiben erhalten.
- PC-Seite und mindestens eine weitere `MoreInfo`-Verwendung visuell prüfen;
  nur bei neuer Zustandslogik zusätzliche Logiktests ergänzen.

**Status:** Gemeinsame Karten-/Bereichsgrenzen implementiert und automatisch geprüft; echte visuelle Android-Abnahme bleibt offen.

## BF-004 – Gesperrte KI-/Verkehrsschalter verständlich erklären

**Nutzerbelege:** Screenshots `Screenshot_20261117_013509_Anker.jpg` und
`Screenshot_20261117_013525_Anker.jpg`. Nutzer versteht Nutzen/Einrichtung nicht,
KI-Schalter ausgegraut; dieselbe Frage zu Fahrzeit-/Verkehrsvorschlägen. Beide
Schnittstellen sollen kostenlos sein. Keine Zustimmung zu möglichen Gebühren ableiten.

**Codebefund:** `AssistanceSettings.tsx` verlangt bei erstmaliger Aktivierung eine
bestätigte Daten-/Kostenfreigabe und positive Anbieter-Capabilities. Ohne die beim
Appbuild eingebundene Supabase-Verbindung ist auch der Verbindungscheck gesperrt.
Der Screenshot nennt genau diesen fehlenden Backend-Anschluss. Nur Anmeldung oder
ein Häkchen ergänzt keine Build-Konfiguration. Der Serverhandler verwendet derzeit
fest OpenAI und Google Routes; ein anderer Schlüssel allein wechselt den Anbieter nicht.

**Ziel:** Kurz erklären, was die Funktion bewirkt, warum sie fehlt und wer was tun
muss. Fehlender App-Anschluss, fehlende Anmeldung, fehlender Anbieter und fehlende
Datenfreigabe erhalten unterscheidbare Zustände mit passender nächster Aktion.
Kein irreführender aktivierbarer Schalter und kein Einrichtungslink, der einen
fehlenden Build-Anschluss vorgeblich selbst repariert. Kostenloses lokales Angebot
sichtbar lassen. Kostenloser Modus darf keine Akzeptanz potenzieller Kosten verlangen;
notwendige Datenfreigaben bleiben ausdrücklich. Anbieterwechsel und Kostenfreiheit
werden separat in F-013/F-014 umgesetzt, keine bloße Entfernung des Hinweises.

**Abnahme:** Alle vier Sperrgründe gezielt prüfen; erfolgreiche Einrichtung erst
nach echtem Check anzeigen; Ausschalten bleibt offline möglich. Kein Anbieterruf
beim bloßen Check, kein stiller Versand von Aufgaben/Adressen und keine automatische
Kostenfreigabe. 320px/große Schrift sowie fehlender Server bleiben verständlich.
Nur geplant; keine Serverbereitstellung, Aktivierung oder Produktänderung.

## BF-005 – „Heute anpassen“ nach verständlichen Bereichen strukturieren

**Meldung vom 17.11.2026:** Nutzer muss im unteren „Heute anpassen“-Fenster
jedes Mal suchen. Buttons, Tagesänderungen und Einstellungen sind schwer zuzuordnen.
Codeeinstieg: das bestehende Anpassungs-Sheet in `src/ui/pages/Now.tsx`.

**Ansatz:** Häufige Änderungen zuerst, klar betitelte Gruppen wie „Heute anders“,
„Arbeit & Termine“, „Abend & Nacht“ und „Weitere Möglichkeiten“. Nur zum aktuellen
Zustand passende Aktionen anbieten; dauerhafte Einstellungen von Änderungen nur
für heute unterscheiden. Aktive Tagesänderungen und Rücknahme auffindbar halten.
Keine zweite Implementierung derselben Store-Aktionen oder neue Tagesplanung.
Mit BF-003 (Bereichsgrenzen), F-016 (Suche) und F-017 (Hilfetexte) abstimmen.
Bei der Umsetzung gezielt aktuelle Navigations-/Gruppierungsmuster recherchieren;
keine große neue Designstudie ohne konkrete offene Frage.

**Abnahme:** Weckzeit nur für heute, Termin ergänzen, länger arbeiten, Abend ändern
und Tagesänderung rückgängig machen sind ohne Durchsuchen einer Buttonwand erreichbar.
320px/große Schrift, Tastatur/Screenreader und schnelle Wechsel zwischen Sheets
prüfen. Code14-Portal-/History-/Zurück-Schutz und ungespeicherte Formularwerte
erhalten. Produktcode bisher unverändert, keine neue Prüfung.

## Weitere Meldungen ergänzen

Je neuer ID genügen zunächst: Beobachtung/Screenshot, erwartetes Verhalten,
betroffene Version soweit bekannt, Priorität und Status. Ursache und Lösung erst
nach dem Codeabgleich ergänzen. Zusammenhängende Symptome in einem Punkt bündeln;
behobene Punkte mit kurzem Nachweis schließen statt immer neue Planberichte anzulegen.
