# Geräteprüfung

**v7-Arbeitsstand, 09.11.2026:** Unter **Gemeinsam testen → v7 gemeinsam ausprobieren · 7 Stationen** bilden G97–G103 eine gemeinsame Handy-/PC-Runde. Die sechs kurzen bisherigen Updateprüfungen bleiben der Standard. Neue Ergebnisse sind offen; alte Berichte und IDs bleiben unverändert. [Setup und gemeinsamer Prüfweg](PC_BEGLEITER.md).

**Code 14 / 1.4.0-rc.1, 08.11.2026:** Neue Oberfläche heißt wieder Anker. Bestehende Testnummern und frühere Berichte bleiben erhalten; neue Geräteprüfungen sind offen. Für den kurzen gemeinsamen Check reichen weiterhin die vorhandenen sechs Stationen. G95 beschreibt die kompakten Zeilen, G96 den kombinierten Bett-Knopf.

Was nur auf einem echten Handy geprüft werden kann. Ergebnisse vom 04.11.2026, gemeldet vom Nutzer. Leere Zeilen sind offen.
Trage Gerät, Android-Version, Datum und Ergebnis ein. Erst dann gilt ein Punkt als „am Gerät verifiziert“.

Neue Prüfungen kannst du in der App unter **Mehr → Einstellungen → Test- und Entwicklerwerkzeuge anzeigen → Gemeinsam testen** einzeln durchführen und mit deiner Beobachtung speichern. Die Seite öffnet die passenden Einstellungen und übernimmt diese historischen Ergebnisse nicht als neue Häkchen. Browserberichte bleiben als Browserberichte gekennzeichnet. Alle früheren Ergebnisse unten gelten für den damals genannten Build.

Gerät: Samsung Galaxy S26 Ultra (Nutzerangabe vom 05.11.2026) · Android/One UI: „neueste Versionen“ laut Nutzer, genaue Versionsnummern noch offen · Datum: 04.11.2026 · Version: Punkt 3 mit 1.1.0-rc.1, der Rest mit 1.2.0-rc.1 inklusive Gleitzeit

**Updatebericht vom 06.11.2026:** Nutzer bestätigt die Aktualisierung auf seinem Handy und ausdrücklich den Erhalt der bisherigen Routinen, Einstellungen und des Spielstands. Geräteversion/Quellkennung noch nicht ausgelesen. Das bestätigt Installation und sichtbaren Datenerhalt; Weckerplanung nach Update (G12) und die übrigen Fälle unten gelten dadurch nicht als neu geprüft. Nächster Test ist G1 bei entsperrtem Handy.

**Fehlermeldung vom 07.11.2026:** Beim Halten und Ziehen eines Routinegriffs scrollt laut Nutzer die ganze Seite. Installierte Buildkennung noch offen. Die Korrektur benötigt einen neuen Gerätetest; diese Meldung bestätigt keinen Erfolg von G95.

**Neue Rückmeldung zu Erinnerungsaktionen:** Nach „Erledigt“, „5 Min später“ oder „Heute nicht“ verschwindet laut Nutzer die Benachrichtigung, in Anker ist jedoch keine Änderung erkennbar. Installierter Build noch offen. Der frühere Erfolg bei G23 gilt für seinen damaligen Stand. Für die Korrektur G21/G67 erneut beobachten; bisherige Berichte bleiben erhalten. Gewünschtes Verhalten: „Heute nicht“ lässt die Abendroutine für diesen Tag auch auf Jetzt entfallen, ohne Erledigt-Häkchen oder neue Punkte.

## Wecker

**Zusatzprüfung für den aktuellen Audio-/Erinnerungsstand:** Vor dem Versuch Gerätebezeichnung, genaue Android-/One-UI-Version und Appversion/Build aus der Testseite notieren. G1/G2 prüfen tatsächlichen Ton getrennt von der Meldung; bei Bedarf laufende Medienwiedergabe/Anruf und Rückkehr vergleichen. G9/G10 prüfen Hintergrund und Neustart, G12 das reguläre Update, G14–16 Tonrechte/-wege. Exaktalarm- oder Benachrichtigungsrechte nur bewusst testweise ändern und danach wiederherstellen; betroffene Teilprüfung und ihre Grenze notieren. Ein grüner globaler Benachrichtigungspunkt bestätigt keine freigegebenen Einzelkanäle. Die neue Diagnose für Alltags-Erinnerungen zeigt Kanäle, nächste Warteschlangenzeit und Ruhe-/Fokuszeiten; auch ein angenommener Post oder eine Android-Karte bestätigt noch keine Wahrnehmung. Die alten Ergebnisse in der Tabelle bleiben Berichte ihrer damaligen Builds.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 1 | Entsperrt, **Wecker testen** | Ton, Vibration, Klingelbildschirm, Frage „gut hörbar?“ | ok |
| 2 | Test, sofort sperren | Ton, Vibration, Vollbild oder Meldung | ok |
| 3 | Nach Test unter *So steht dein Wecker* nachsehen | Nächster Hauptwecker unverändert | Bestätigt vom Nutzer (1.1.0-rc.1), Zeit blieb gleich |
| 4 | Nächsten Wecker auf in 3 Minuten stellen, einmal schlummern | Nach 5 Minuten wieder, kein zweites Schlummern, morgen geplant | Teilweise: 20:45 geklungen, Schlummern, 20:50 wieder. Kein Vollbild, erst nach Tipp auf die Meldung. Ursache: Always-on-Display (siehe unten). „Morgen geplant“ nicht gemeldet |
| 5 | Nicht reagieren, 30 Minuten warten, App nicht öffnen | Wird still, Diagnose zeigt morgen, klingelt morgen | Teilweise: Wird still. Diagnose und Klingeln am Folgetag nicht gemeldet |
| 6 | Vorwecker an, ignorieren | Hauptwecker klingelt trotzdem, ersetzt den Vorwecker | |
| 7 | Vorwecker beenden | Kein Eintrag im Einnahmeprotokoll | |
| 8 | Wachheits-Check an, Wecker beenden | Fragt einmal nach, keine Kette | ok |
| 9 | App wischen und schließen, Weckzeit abwarten | Klingelt | Kein Vollbild, Ursache Always-on-Display. Ob er klingelte, ist nicht ausdrücklich gemeldet |
| 10 | Neustart, noch nicht entsperren, Weckzeit abwarten | Klingelt, Knopf „Beenden“ in der Meldung, oder Grenze notieren | |
| 11 | Handy zur Weckzeit aus, 10 Minuten später einschalten | Klingelt verspätet einmal | |
| 12 | App-Update drüber installieren | Wecker bleibt geplant | |
| 13 | Uhrzeit und Zeitzone von Hand ändern, zurückstellen | Weiter deutsche Zeit, kein doppeltes Klingeln | |
| 14 | „Nicht stören“ an mit und ohne Ausnahme | Hörbar oder klare Anzeige, keine falsche Behauptung | ok |
| 15 | Alarmlautstärke sehr niedrig | Warnung in der Diagnose, Testton hörbar | ok |
| 16 | Lautstärketasten beim Klingeln | Normal bedienbar, Anker stellt nichts zurück | ok |
| 17 | Bluetooth-Kopfhörer, kabelgebunden | Tatsächliche Tonausgabe notieren | Nicht relevant für dich, nicht geprüft |
| 18 | Energiesparen, Akku-Optimierung an, über Nacht | Verhalten notieren | ok |
| 19 | Scanner nicht verfügbar, QR fehlt | Rechenaufgaben und Notfall-Stopp beenden den Wecker | ok |
| 20 | Während des Klingelns App beenden, neu öffnen | Klingelseite erscheint wieder, kein falsches „wach“ | |

## Einmalige Weckzeit und Termine

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 35 | Morgen Homeoffice wählen, „Einmalig um … wecken“ bestätigen | Diagnose zeigt diese Zeit, klingelt dazu, übermorgen wieder Standard | |
| 36 | Einmalige Zeit zurücknehmen | Diagnose zeigt wieder den Standard | ok |
| 37 | Während des Klingelns einen Termin eintragen | Klingeln läuft unverändert weiter, Folgetag stimmt | |
| 38 | Termin mit Ort und Fahrzeit, App schließen | Meldungen „Bald fertig machen“ und „Losgehen“ zur richtigen Zeit, ohne Anlass oder Ort im Text | ok |
| 39 | „Route öffnen“ | Google Maps öffnet mit dem Ziel | ok |
| 40 | Länger wach „Weiß ich noch nicht“ | Keine PC-Stopp- oder Bett-Meldung, Wecker morgen bleibt | ok |

## Gleitzeit

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 41 | Homeoffice wählen, App bis zum Arbeitsbeginn offen und im Hintergrund | Keine Meldung „Losgehen“, ein Hinweis zehn Minuten vor deiner Grenze | |
| 42 | Arbeit starten, App wischen und schließen, neu öffnen | Arbeit läuft weiter, Beginn unverändert | |
| 43 | Pause starten, Handy sperren, 10 Minuten warten, entsperren | Pause läuft, Feierabend ist um 10 Minuten gewachsen | ok |
| 44 | „Arbeit starten“ schnell doppelt tippen | Nur ein Eintrag unter Arbeitszeit | |
| 45 | Einsatz für in 30 Minuten planen, App schließen | Eine Meldung vorab ohne Anlass und Ort, Widget zeigt nur „Termin“ | ok |
| 46 | Arbeit laufen lassen, App-Update drüber installieren | Sitzung und Wecker bleiben | |

## Erinnerungen

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 21 | Alltags-Erinnerungen beobachten: höchstens drei Karten; bei bewusst gewählten Testhinweisen Erledigt, Heute nicht und 5 Min später ausprobieren, Anker erneut öffnen | Passende Änderung bleibt nach Wiederöffnung erhalten; Heute nicht lässt offene Abend-Schritte nur heute entfallen, ohne neue Erledigt-Haken/Punkte. Später erinnert erneut nach etwa fünf Minuten, sofern Ruhe/Fokus das erlauben; höchstens drei Karten | |
| 22 | Wecker klingelt, drei Meldungen stehen | Wecker-Meldung bleibt, höchstens zwei normale daneben | ok, nur eine normale Meldung daneben |
| 23 | Knöpfe Erledigt, 5 Min später, Heute nicht bei geschlossener App | Treffen die richtige Aufgabe, beim Öffnen stimmt die App | ok |
| 24 | Drei Tage App nicht öffnen | Erinnerungen kommen weiter, kein Stau | |
| 25 | Neustart | Erinnerungen laufen weiter | |
| 26 | Update von 1.0.1 auf diese Version | Keine doppelten alten Erinnerungen, Daten da | |

## Druck

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 27 | *Nur Morgenroutine* drucken | Systemdialog, nur diese Seite, keine Navigation | ok |
| 28 | Als PDF speichern | PDF ohne abgeschnittene Inhalte | ok |
| 29 | QR-Code auf Papier drucken und scannen | Beendet den Wecker | ok |
| 30 | Kein Druckdienst installiert | Verständliche Meldung, kein falsches „gedruckt“ | ok |

## Alltag

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 31 | Fokus-Puls aus, Fokus-Modus 10 Minuten | Keine Vibration | ok |
| 32 | Fokus-Puls sanft, Handy in der Hand | Doppel-Vibration im Abstand | ok |
| 33 | Datenbank-Update: Daten aus 1.0.1 prüfen | Routinen, Spielstand, Gedanken, QR-Code unverändert | ok |
| 34 | Bildschirm mit Schrift 160 %, TalkBack | Bedienbar, Knöpfe vorgelesen | ok |

## Befund Vollbild (05.11.2026)

Bei eingeschaltetem **Always-on-Display** zeigt das Handy beim Klingeln nur die Meldung, das Vollbild erscheint erst nach einem Tipp darauf. Mit ausgeschaltetem Always-on-Display und gesperrtem Handy erscheint es von selbst. Die Diagnose stand dabei auf grün, die Freigabe für Vollbild war also da. Ton und Meldung kamen in beiden Fällen.

**Versuch:** Ist der Bildschirm beim Klingeln aus oder im Always-on-Display, schaltet Anker ihn jetzt für 15 Sekunden ein und zeigt die Meldung kurz ein zweites Mal, damit Android das Vollbild öffnet. Am Gerät bestätigt (47, 48).

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 47 | Always-on-Display an, **Wecker testen**, sofort sperren, warten | Bildschirm geht an, Vollbild erscheint von selbst, keine doppelte Tonquelle | ok (05.11.2026) |
| 48 | Dasselbe mit entsperrtem Handy in der Hand | Nur die Meldung oben, wie bisher | ok (05.11.2026) |

## Neue Abendhilfen und experimentelles Aktivitäts-Weckfenster

Noch nicht auf dem Galaxy S26 Ultra geprüft. Mikrofon- und Bewegungsverhalten lassen sich nicht aus den automatischen Tests ableiten.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 49 | Gedanke für später, „Einmal erinnern“, App schließen | Ein allgemeiner Hinweis; Tipp öffnet Gedanken, auch nach Kaltstart | |
| 50 | Privaten nächsten Schritt mit Erinnerung speichern, App schließen | Hinweis ohne Inhalt, Tipp öffnet Abend & morgen; Notiz bleibt über Tage erhalten | |
| 51 | Sanften Übergang einschalten, Zeitpunkt abwarten | Ein sanfter Hinweis, keine PC-Stopp-/Bett-Wiederholungen; feste Weckzeit unverändert | |
| 52 | Schlafzeiten eintragen, neu öffnen, korrigieren und löschen | Nur eingegebene Werte, korrekte Nachtzuordnung, keine Spielmeldungen auf den ruhigen Seiten | |
| 53 | Weckfenster aktivieren, Mikrofon ablehnen | Keine Messung, verständlicher Fehler, fester Wecker weiter geplant | |
| 54 | Messung am Abend starten, Handy sperren | Dienst zeigt „Vorbereitet“; Mikrofon und Sensoren werden erst im Fenster ausgewertet | |
| 55 | Im Fenster auf der Matratze ruhig liegen, dann mehrfach bewegen und Geräusche machen | Status und etwaigen frühen Alarm beobachten; daraus keine bestätigte Schlafphase ableiten | |
| 56 | Keine verwertbaren Signale bzw. Mikrofon währenddessen blockieren | Fester Wecker klingelt zur eingestellten Zeit | |
| 57 | Frühen Alarm ignorieren/Timeout abwarten; einmal schlummern | Feste Absicherung bleibt; kein zusätzlicher Schlummerdurchgang | |
| 58 | Frühen Alarm per QR/Rechnen/Notfall beenden | Keine zweite Hauptweckung zur ursprünglichen Zeit; nächster Tag geplant | |
| 59 | Messung beenden, Weckzeit ändern, App-Prozess beenden bzw. Handy neu starten | Messung endet/ist als unterbrochen sichtbar; kein heimlicher Mikrofon-Neustart, fester Wecker bleibt unabhängig | |

## Neue Weckerkorrekturen und Testbedienung

Implementiert und automatisch geprüft heißt nicht am Galaxy geprüft. Für Test60/61 eine zusätzliche unabhängige Weckung beibehalten und anschließend eigene Einstellungen zurücksetzen. Die Testseite verändert diese Einstellungen nicht automatisch.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 60 | Hauptwecker auf in 3 Minuten stellen, dann vor dem Klingeln auf später ändern oder ausschalten, alten Zeitpunkt abwarten | Kein Klingeln zur verworfenen Zeit; aktueller Termin bzw. ausgeschalteter Zustand bleibt bestehen | |
| 61 | Hauptwecker einmal schlummern, währenddessen Wecker ausschalten; Schlummerzeit und erneutes Öffnen abwarten | Kein nachgeholtes Schlummern; nächster Hauptwecker erst wieder nach bewusstem Einschalten | |
| 62 | Unter Schlaf & Anker PC-Stopp direkt auf 20:00 und Bett auf 00:30 setzen; Fahrzeit direkt eingeben; App neu öffnen | Eingaben bleiben, Nacht 00:30 gehört zum Folgekalendertag; keine vielen Plus-/Minus-Tipps nötig; danach eigene Werte zurückstellen | |
| 63 | Einen Test bewusst als teilweise speichern, App neu öffnen, Einstellungen über Testlink öffnen und zurückkehren | Ergebnis mit Datum/Version bleibt; kein Test wird automatisch bestanden, kein Routine-Haken und keine XP entstehen | |
| 64 | Anker über Widget oder Benachrichtigung öffnen, danach Mehr, Tag und Gemeinsam testen aufrufen; auch bei Gute Nacht | Gewählte Seite bleibt offen; kein Rücksprung auf Jetzt, neue Benachrichtigungslinks und klingelnder Wecker bleiben erreichbar | |
| 65 | Vorwecker aktiv lassen, Messung für diese Nacht starten; Weckerstatus vor und nach Messungsende prüfen, Vorweckzeit abwarten | Vor Start klarer Pausenhinweis; Vorwecker für diesen Haupttermin pausiert und bleibt still, auch nach Messungsende oder Neustart; fester Hauptwecker bleibt. Neue Weckzeit oder nächste Nacht ohne Messung nutzt wieder die Vorwecker-Einstellung | |

## E02: Erinnerungen und Papier

Auch diese Fälle bleiben bis zum eigenen Versuch offen. Für Nacht-, Neustart- und Langzeittests einen unabhängigen Wecker beibehalten. Die Testseite stellt deine persönlichen Zeiten nicht selbst um und markiert keine Alltagsaufgabe als erledigt.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 66 | Erinnerung sichtbar lassen, dazugehörigen Termin oder Tagesplan verschieben/absagen; alten Button danach betätigen | Alte Meldung verschwindet bzw. ihre Aktion bleibt ohne neue Wirkung; neue Aufgabe, Zeit und Spielstand unverändert | |
| 67 | Bei bewusst gewählter Abendroutine Erledigt oder Heute nicht aus einer Benachrichtigung wählen; Anker öffnen, Jetzt und Routine prüfen, erneut öffnen. Vorwarnungen Losgehen/PC-Stopp sowie zweimal 5 Min später bei Bedarf getrennt beobachten | Erledigt bestätigt nur noch offene geplante Abend-Schritte; vorhandene Ergebnisse bleiben. Heute nicht lässt offene Schritte nur heute entfallen, ohne neue Erledigt-Haken/Punkte. Vorwarnungs-Erledigt bestätigt echte Abfahrt bzw. PC aus. Keine doppelte Wirkung/XP; nach zweitem Später bleiben Erledigt/Heute nicht verfügbar | |
| 68 | Normale Erinnerung mit Wiederholung vor Ruhezeit oder Film planen, Grenze und Wiederholungszeit abwarten; auch 5 Min später über die Grenze prüfen | Normale Stufe bleibt in Ruhe/Freizeit still; ausdrücklich kritischer Anker bleibt nach gewählter Regel erhalten | |
| 69 | Eine Routine im Fokus starten und eine normale Erinnerung im laufenden Zeitfenster abwarten; danach Fokus verlassen | Normaler Hinweis stört den laufenden Fokus nicht; kritischer Anker bleibt; kein alter Meldungsstau beim Verlassen | |
| 70 | Aktivitätsmessung außerhalb ihres Fensters vorbereiten, mehrere normale Meldungen und separaten Testalarm zusammen beobachten | Erforderliche Alarm- und Messanzeige bleiben sichtbar; gewöhnliche Anker-Meldungen werden nach Wichtigkeit reduziert, keine fremden Meldungen entfernt | |
| 71 | Vorrat und Basisregeln im Weckerstatus lesen; danach Langzeittest über das Ende des 14-Tage-Vorrats ohne Appöffnung | Wichtige gespeicherte Wochenregeln laufen weiter, bekannte Sondertage werden berücksichtigt; nach Rückkehr kein Nachholsturm. Regelanzeige allein nur als Teilprüfung werten | |
| 72 | Lange Routine mit langem Einzeltext, gleichen Titeln und Umlauten in A5 und A4 drucken bzw. PDF öffnen | Alle Schritte lesbar und vollständig, mehrere Seiten erlaubt, keine abgeschnittenen Zeilen, keine Navigation oder Feierdialoge | |
| 73 | Auf Android PDF-Datei ohne eingerichteten Druckdienst erstellen; Teilen oder Druckdialog auch abbrechen | Nutzbare PDF-Datei als Alternative, verständliche Meldung; Abbruch wird nicht als Druck- oder Versandbestätigung angezeigt | |
| 74 | Aus Morgen-/Abendroutine direkt drucken; QR-Auswahl öffnen und echten Ausdruck scannen | Richtige Vorauswahl, bestehender QR bleibt unverändert; ausreichender weißer Rand und echter Scan möglich. PDF-Vorschau allein bestätigt den Scan nicht | |

## Android-Systemleisten

Der gemeldete Fehler betrifft die Android-Leiste mit Uhr und Akku oben. Der Nutzer bestätigt am06.11.2026 nach Bereitstellung des Updates „oben frei“; damit ist die obere Anzeige als Teilprüfung bestätigt. Die übrigen Teile bleiben offen. Alle Schritte sind freiwillig; die Testseite ändert keine Android-Systemeinstellung.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 75 | Jetzt mit Testbegleitung, Fokus und Darstellung öffnen; Hoch- und Querformat prüfen. Falls genutzt, Android-Gesten und Drei-Tasten-Navigation vergleichen. Ein Eingabefeld mit Tastatur öffnen und diese wieder schließen | Uhr/Akku, Kameraaussparung und untere Systemnavigation verdecken keine App-Inhalte oder Knöpfe; Testbegleitung und erste Überschrift bleiben getrennt sichtbar, keine doppelten großen Ränder. Eingabe bleibt mit Tastatur erreichbar; nach Schließen stimmen Abstände weiter. Teilprüfungen getrennt notieren | Teilweise: Nutzer meldet „oben frei“ (06.11.2026). Obere Anzeige am Galaxy bestätigt; Drehung, Fokus, Tastatur und untere Systemnavigation nicht gemeldet. Installierte Buildkennung nicht unabhängig ausgelesen |

## E03: Aufgaben und Wiedereinstieg

Freiwillige Stichproben, kein neuer Pflichtkatalog für den Alltag. Nutze eine eigene kleine Testaufgabe; die Links öffnen nur einen Bereich. Timer, Änderungen und Häkchen starten erst durch deine bewusste Aktion. Mehrtägige Abläufe nur nach tatsächlich vergangener Zeit bestätigen. Bestehende Routinen, Daten und frühere Berichte bleiben erhalten.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 76 | Eine Testaufgabe bewusst im Fokus starten, dort einen Gedanken als Entwurf eingeben; App verlassen und neu öffnen, danach bewusst speichern | Entwurf und tatsächlicher Aufgaben-/Timerkontext bleiben erhalten. Nach Speichern zurück zur vorherigen Aufgabe; keine ungefragte Aufgabe für morgen, kein falscher Abschluss | |
| 77 | Eine Notiz behalten oder mit einer bestehenden Aufgabe verknüpfen; eine andere ausdrücklich für morgen oder einen gewählten Tag einplanen, später abschließen und zurücknehmen | Notiz bleibt ohne Umwandlung eine Notiz. Geplante Aufgabe erscheint zum passenden Tag unter derselben ID; Abschluss und Rücknahme gelten überall, kein doppelter Eintrag | |
| 78 | Eine Testaufgabe lokal in kleine Schritte zerlegen, einen Teil erledigen, Detailtiefe ändern und neu öffnen; freiwillige Wiederholung prüfen | Vorschlag ist vor Übernahme editierbar. Echte Teilabschlüsse und ihre Reihenfolge bleiben erhalten. Wiederholung hat eigene künftige Instanz; ein Abschluss erledigt keine mehreren Tage | |
| 79 | Bei einer Testaufgabe bewusst einen Fokusblock wählen und starten; Pause, App-Unterbrechung, Neuöffnen und Weiter prüfen | Verstrichene Zeit und Restzeit stimmen weiter, Pause ist ausdrücklich gespeichert. Richtige Aufgabe und nächster Schritt bleiben, keine automatische Arbeitszeitbuchung oder Erledigung | |
| 80 | Auf Jetzt „Ich hänge fest“ öffnen und zunächst nur lesen; erst danach Starten, Pause, Weiter und Ablauf des kleinen Zeitfensters beobachten | Öffnen allein startet keine Hilfezeit. Ablauf bleibt neutral, erledigt weder Aufgabe noch Routine. Die ursprüngliche Aufgabe und ihr Timerkontext werden nicht überschrieben | |
| 81 | Einen nächsten Schritt merken; nach einer tatsächlichen mehrtägigen Nichtnutzung über „Ich bin abgedriftet“ wieder einsteigen | Konkreter nächster Schritt bleibt erreichbar. Einstieg ab jetzt ohne Rückstandswand, erzwungenes Nachholen, Kapitelneustart oder Verlust erworbenen Fortschritts. Drei Tage erst nach echtem Ablauf als geprüft melden | |
| 82 | Bei einer Testaufgabe Dauer, frühesten Start und passenden Ort wählen; auf Jetzt den freiwilligen Aufgabenkontext und ein knappes Zeitfenster vergleichen | Empfehlung berücksichtigt echte Frist, verbleibende Zeit, Kontext und selbst gewählte Energie. Zu große Aufgabe erhält einen kleinen Einstieg oder sachlichen Konflikthinweis; aktive passende Aufgabe bleibt stabil | |
| 83 | Freiwilliges lokales Dauerlernen ansehen, bewusst ein-/ausschalten; echte bestätigte Zeiten und Vorschlag prüfen, anschließend bei Bedarf zurücksetzen | Standard aus; nur bestätigte lokale Werte. Schätzung ändert sich erst nach Übernahme, Ausreißer verschieben sie nicht unkontrolliert. Reset entfernt Lernwerte, erhält Aufgaben und bestätigte Erledigungen | |
| 84 | Neue Sicherung exportieren; vorhandene Aufgaben, Teilabschlüsse und Wiederaufnahme nach regulärem Update prüfen; Altbestand nur mit passender eigener Testkopie vergleichen | IDs, Inhalte und ehrliche Zustände bleiben erhalten. Alte fehlende Zusatzfelder werden verträglich ergänzt, ungültige neue Daten nicht teilweise importiert. Eine neue Sicherung allein ist noch kein Altversions-Importtest | |
| 85 | An einer Testaufgabe wenige schnelle Mehrfachtipps und einen bewussten Planwechsel prüfen; danach echtes Anker-Widget separat vom Homescreen öffnen | Eine passende Wirkung pro Aktion, keine doppelten Instanzen oder Abschlüsse. Letzter Stand gewinnt, Widget verweist auf aktuellen neutralen Kontext. Ein Browserlink bestätigt keine Android-Widgetzustellung | |

## Gemeinsamer Abschlusslauf: E04–E09

Zehn freiwillige Stationen verbinden die neuen Bereiche. Sie sind ein gemeinsamer Einstieg und keine Aufforderung, alle 95 Einzelfälle nacheinander abzuarbeiten. Die bisherigen Detailprüfungen und Berichte bleiben erreichbar. Alle neuen Android-Ergebnisse sind offen. Eine Station darf „Teilweise“ bleiben, wenn ein Teil noch nicht beobachtet wurde; ein übersprungener optionaler Dienst gilt nicht als nachgewiesene Integration.

Die Links öffnen nur Seiten. Sie starten weder Fokus noch Arbeitszeit, Wecker, Standortmessung oder kostenpflichtigen Dienst und ändern keine Einstellung. Nutze für Änderungen eine eigene Testaufgabe oder einen Testtermin. Importiere fremde oder alte Dateien nur in eine passende eigene Testkopie; deine aktuellen Alltagsdaten müssen für diesen Lauf nicht gelöscht werden.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 86 | Nach dem regulären Update vorhandene Routinen, Aufgaben, QR-Wert und Spielstand vergleichen; vollständige Sicherung exportieren und Importvorschau ohne Übernahme öffnen | Eigene Daten bleiben vorhanden. Dateiauswahl und Vorschau ändern nichts; Abbruch bleibt möglich. Bewusst weggelassene Backup-Bereiche werden nicht als Löschauftrag behandelt | |
| 87 | Einen Testabend mit Termin oder offenem Ende planen, ändern und zurücknehmen; Jetzt, Tag und Abendroutine vergleichen | Spontane Freizeit bleibt möglich. Echte Erledigungen bleiben erhalten, Rücknahme betrifft den Plan; verstrichene Zeit und offene Routinepunkte erhalten keine falschen Häkchen | |
| 88 | Einen kurzen eigenen Testeinsatz bewusst starten, pausieren, fortsetzen und beenden; Arbeitszeit, nächsten Schritt und Tagesplan vergleichen. Optional auf Jetzt den Tagesmodus Homeoffice wählen und die Kontaktwahl schon erledigt/nicht nötig/später ausprobieren | Nur gestartete echte Intervalle zählen. Pause bleibt Pause; kein doppelter Timer, kein automatischer Aufgabenabschluss. Kopieren/Teilen bestätigt keinen Versand; Später bietet frühestens30min später höchstens eine ruhige In-App-Rückfrage. Grenzen und Konflikte sind nachvollziehbar | |
| 89 | Einen Testtermin zu Hause, bei einem gespeicherten Kundenort und mit unbekanntem Weg vergleichen; Ort oder Zeit anschließend ändern | Richtiger Ausgangs- und Zielort sowie erforderliche Vorbereitung sind sichtbar. Ein unbekannter Weg erscheint nicht als Null Minuten; Planänderung macht alte Wegannahmen ungültig | |
| 90 | In der Morgenvorschau Termin, Fahrt, Vorbereitung und Aufstehzeit vergleichen; eine mögliche Weckeränderung nur bewusst bestätigen | Vorschau benennt ihre Annahmen. Öffnen allein verschiebt keinen echten Android-Wecker; bewusste Änderung und native Planung stimmen überein. Messung pausiert den Vorwecker mit Hinweis, Hauptwecker bleibt abgesichert | |
| 91 | Für denselben Testtermin Vorbereitung und Packliste öffnen, einen Gegenstand bestätigen; Wetterort und veralteten oder fehlenden Wetterstand vergleichen | Packhaken bleiben beim passenden Termin, keine Routine wird dadurch pauschal erledigt. Wetter nennt Ort und Aktualität, offline bleibt der Plan bedienbar; manuelle Wahl bleibt möglich | |
| 92 | Eigene Testaufgabe mit kleinem Schritt und persönlichem Grund wählen; Fokus bewusst starten, Gedankenentwurf speichern und später zur Aufgabe zurückkehren | Aufgabe, Teilfortschritt, Entwurf und Restzeit bleiben erhalten. Rückkehr zeigt den konkreten nächsten Schritt; Hilfeöffnung oder Pause erledigt nichts und zieht keinen Fortschritt ab | |
| 93 | Optionale KI- und Verkehrsvorschläge zunächst ausgeschaltet ansehen; nur bei gewünschter Einrichtung einen Vorschlag anfordern, prüfen, ablehnen oder bewusst übernehmen | Ohne Freigabe keine externe Anfrage. Vorschlag nennt Grenzen und ändert vor Übernahme nichts; ohne Anmeldung, Konfiguration oder Netz bleibt die lokale Planung nutzbar. Nicht eingerichtete Dienste bleiben ungeprüft | |
| 94 | Gewünschte optionale Spracheingabe, Google-Kalender-Übernahme und Besuchserinnerung einzeln öffnen; Ablehnung oder Abbruch und nur freiwillig einen echten Ablauf prüfen | Nur ausdrückliche Freigabe aktiviert die jeweilige Hilfe. Sprache wird vor Übernahme geprüft, importierter Termin bleibt bewusst gewählt; Besuchshinweis erledigt nichts und bestätigt keine automatische Zeiterfassung | |
| 95 | In Einstellungen → Routinen die kompakte Morgen- und Abendroutine öffnen. Dauer neben dem Namen ändern; per Tipp auf den Namen Details mit Minimal-Version, Pfeilen und Entfernen öffnen. Am Griff links einen Schritt hin und zurück ziehen; außerhalb des Griffs scrollen, danach neu öffnen. Nach Wunsch große Schrift/Tastatur und Ausdruck/PDF vergleichen | Keine überlappenden Felder oder abgeschnittenen Werte. Griff sortiert, sonst scrollt die Liste. Reihenfolge, Titel, Dauer und Minimal-Version bleiben gespeichert; Pfeile funktionieren bei offenen Details. Entfernen ist rückgängig zu machen, ohne zwischenzeitliche neue Schritte zu verlieren. Systemleisten und Navigation verdecken nichts; Ausdruck vollständig | |

## Stummer Schlafhinweis

Diese zusätzliche Prüfung ist freiwillig. Der Hinweis ist ein bestmöglich zugestellter Einmalhinweis, kein Ersatz für einen Wecker. Er braucht die selbst gewährte Android-Spezialfreigabe „Über anderen Apps anzeigen“. Die App zeigt sich ohne diese Freigabe nicht über anderen Apps. Hauptwecker und bisherige Berichte bleiben erhalten.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 96 | Unter Schlaf & Anker den stummen Einschlafhinweis bewusst einschalten und für einen kurzen Versuch eine Minute Einschlafdauer wählen. Zur Bettzeit auf Jetzt über Heute anpassen die Fensterfreigabe einrichten. Danach Ich liege im Bett wählen und bei eingeschaltetem, entsperrtem Bildschirm eine andere App nutzen. Optional mit ausgeschaltetem Bildschirm wiederholen; anschließend eigene Werte zurückstellen | Die bewusste Bettbestätigung speichert die tatsächliche Bettzeit. Der erlaubte, pünktliche Hinweis bleibt stumm, ohne Vibration oder Einschalten des Displays; sichtbarer Jetzt-Knopf als manueller Rückweg. Ausgeschaltet, gesperrt oder veraltet erzeugt keinen späteren Überraschungshinweis. Schließen/Abbrechen des Hinweises ändert weder Aufgaben, Arbeitszeit noch Wecker und vergibt keine zusätzlichen Punkte. Nur tatsächlich beobachtete Teile bestätigen | |

## Kurzer Update-Test und Berichtsdatei (RC3)

Unter **Mehr → Gemeinsam testen** werden zunächst sechs empfohlene Stationen gezeigt: G1, G21, G62, G92, G95 und G96. Die vollständige Liste und die zehn E04–E09-Stationen bleiben bei Bedarf erreichbar. Es ist nicht nötig, sämtliche alten Fälle vor jedem Update zu wiederholen.

Vor einem Update **„Testberichte als Datei exportieren“** wählen und diese JSON-Datei aufbewahren. Sie kann hier für die nächste Auswertung angehängt und in Anker über **„Testberichte aus Datei prüfen“** zunächst als Vorschau geöffnet werden. Ein Import erhält frühere Beobachtungen mit ihren ursprünglichen Build-/Plattformangaben in der Historie; er behauptet keine neue Geräteprüfung und überschreibt keine aktuellen Ergebnisse. Der Export ist ein Bericht und ersetzt keine vollständige Datensicherung.

Bei G92 lassen sich zusätzlich die freiwilligen Teilschritt-Timer an einer eigenen Testaufgabe prüfen: Dauer bewusst wählen, starten, pausieren und nach Wiederöffnung vergleichen. Timerablauf allein darf weder Teilaufgabe noch Gesamtaufgabe erledigen und keine Arbeitszeit oder XP buchen. Den neuen Teil nur dann als beobachtet notieren, wenn er tatsächlich ausprobiert wurde. Alte Berichte werden dadurch nicht nachträglich erweitert.

## v7: Abend, Morgen und PC gemeinsam

Sieben Sammelstationen statt vieler neuer Einzeltests. In der App startet **v7 gemeinsam ausprobieren · 7 Stationen** bei G97. Nur tatsächlich beobachtete Teile bestätigen; eine Teilprüfung bleibt **Teilweise**, ein nicht gewähltes Extra bleibt ungeprüft. Browser-/Mocknachweise sind keine echten Windows-/Galaxy-Beobachtungen. Gerät, genaue Systemversion, App-/PC-Version und Codestand notieren. Vor der nächsten Aktualisierung die vorhandenen Testberichte als Datei exportieren; das erhält ihre ursprünglichen Buildbezüge.

Zuerst den wirkungsfreien PC-Testabend verwenden. Echte PC-Sperre, Ruhezustand, Herunterfahren, Audio und WoL nur bewusst einzeln wählen; eigene Dateien vorher speichern. Für Hauptweckertests einen unabhängigen Wecker stellen. Neue Optionen nach dem Versuch wieder auf die gewünschten eigenen Werte setzen. Die Begleitung bleibt beendbar, und kein Testbericht erledigt eine Routine oder vergibt XP.

| # | Vorgehen | Erwartet | Ergebnis |
|---|---|---|---|
| 97 | Vorhandene Routinen, Aufgaben, QR und Spielstand vergleichen; neue Begleitung und PC-Freigaben zunächst ausgeschaltet prüfen. PC-Begleiter im eigenen Windows-Profil starten, Kopplungs-QR am Handy scannen, Prüfcode auf beiden Geräten vergleichen und am PC bestätigen; passenden Planempfang und bei Bedarf Entkoppeln prüfen | Daten und frühere Berichte bleiben erhalten. Kopplung allein löst keinen Eingriff aus. Live-Verbindung und bestätigte aktuelle Planrevision sind getrennt; kein Erfolg allein aus Senden oder Entdecken. Schlüssel erscheinen nicht im Testexport. Entkoppeln zeigt ehrlich einen möglichen schon übernommenen PC-Plan | |
| 98 | Gewünschte Zustandsfarben und Zeitbogen einschalten; Morgen-, Abend-, Nacht- und Zombie-Ansicht sowie laufenden Fokus ansehen. Große Schrift, kleine Breite, Tastatur und reduzierte Bewegung vergleichen | Eine primäre Aktion bleibt klar erreichbar. Keine verdeckten oder abgeschnittenen Felder, Systemleisten oder überlappenden Knöpfe. Restzeit ist sichtbar; Farbwechsel, Uhrzeit und Timerende erledigen keinen Schritt. Reduzierte Bewegung bleibt respektiert | |
| 99 | Zero-Gap bewusst einschalten, regulären Hauptwecker für den Versuch wählen und per vorhandenem Anker-QR beenden. Ersten offenen Morgenschritt mit Countdown, kurze App-Unterbrechung und Wiederöffnung vergleichen; Routine nur durch echte Schrittbestätigungen abschließen | Derselbe Morgenfokus beginnt ohne neutralen Umweg. Kein doppelter Start nach Wiederöffnung, kein Erledigt-Haken aus dem Countdown. Alternative Weckerwege und Notfall-Stopp bleiben verfügbar. Nur wirklich erledigte Kernschritte erlauben den gemeldeten Morgenabschluss | |
| 100 | Gewünschte Vibration und lokale Schrittstimme einzeln aktivieren; Schrittwechsel, Pause, Stoppen, Hintergrund und Weckervorrang vergleichen. Zombie-Kernschritte wählen, bewusst wechseln bzw. ausbleibende erste Rückmeldung testen. Wachrückfrage einmal bestätigen und in einem getrennten Hauptweckerversuch ausbleiben lassen | Nur aktive Schritte erzeugen begrenzte Hinweise; keine Cloud-Stimme und keine wiederholte alte Ansage. Zombie-Auswahl lässt übrige Schritte ohne Haken/Punkte entfallen. Wachrückfrage löst keine Kette oder zweite Alarmplanung aus; tatsächlichen erneuten Weckerton getrennt notieren. Fehlende Stimme ist kein behaupteter Erfolg | |
| 101 | Einen eigenen kurzen Testabend vorbereiten; T30-/T10-Hinweise, Gedankenparkplatz und Bett-QR durchgehen. Optional Brown Noise starten, stoppen und Ausblendung beobachten; offenes Ende vergleichen. Im bewusst eingerichteten strengen PC-Modus eine QR-Notverlängerung anfragen | Vorhinweise sind allgemein und nicht doppelt; offenes Ende setzt keine erfundene Grenze. QR bestätigt den Übergang, keinen Schlaf. Rauschen endet/beendet sich sichtbar und macht Hauptwecker nicht stumm. Notverlängerung gilt erst nach passendem PC-ACK mit Zielzeit, kein Erfolg aus dem Tipp allein | |
| 102 | PC-Testabend ohne Systemwirkung starten; aktuellen Planempfang, freie Verlängerung und Aussetzen prüfen. LAN kurz trennen, Windows neu starten/aufwecken und gegebenenfalls alte Aufgabe Anker PC-Stopp vergleichen. Erst nach eigener Wahl echte Schonfrist/Sperre oder andere Aktion, mehrere Monitore/Vollbild und optional WoL prüfen | Mindestens 60 Sekunden zum Speichern, sichtbares Beenden, kein erzwungenes Schließen ungespeicherter Programme. Alte Aufgabe blockiert Doppelwirkung. Nur gültiger bestätigter Plan wirkt offline; kein erfundener Folgetag. Strenger Wächter endet am echten Morgenabschluss oder seiner Grenze, entsperrt Windows nicht. WoL-Versand allein bestätigt keinen PC-Start | |
| 103 | Abendgedanken und PC-Speicherpunkt mit nächstem Schritt merken; am nächsten tatsächlich abgeschlossenen Morgen wiederfinden. Eigenen Wenn-dann-Satz mit und ohne PC-Freigabe vergleichen. Licht-Schritt nur bewusst hinzufügen, Rhythmus-Woche mit eigenen vorhandenen/fehlenden Zeiten ansehen | Notizen bleiben lokal bzw. verlassen das Handy nur mit eigener Freigabe. Speicherung und Empfang werden getrennt angezeigt; keine Doppelnotiz nach erneutem Abgleich. Kein automatischer neuer Routinenplan oder Pflicht-Lichtschritt. Rhythmus trennt Plan und tatsächliche Einträge, erfindet keinen Schlaf und wertet fehlende Tage nicht ab | |
