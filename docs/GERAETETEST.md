# Geräteprüfung

Was nur auf einem echten Handy geprüft werden kann. Ergebnisse vom 04.11.2026, gemeldet vom Nutzer. Leere Zeilen sind offen.
Trage Gerät, Android-Version, Datum und Ergebnis ein. Erst dann gilt ein Punkt als „am Gerät verifiziert“.

Neue Prüfungen kannst du in der App unter **Mehr → Gemeinsam testen** einzeln durchführen und mit deiner Beobachtung speichern. Die Seite öffnet die passenden Einstellungen und übernimmt diese historischen Ergebnisse nicht als neue Häkchen. Browserberichte bleiben als Browserberichte gekennzeichnet. Alle früheren Ergebnisse unten gelten für den damals genannten Build.

Gerät: Samsung Galaxy S26 Ultra (Nutzerangabe vom 05.11.2026) · Android/One UI: „neueste Versionen“ laut Nutzer, genaue Versionsnummern noch offen · Datum: 04.11.2026 · Version: Punkt 3 mit 1.1.0-rc.1, der Rest mit 1.2.0-rc.1 inklusive Gleitzeit

**Updatebericht vom 06.11.2026:** Nutzer bestätigt die Aktualisierung auf seinem Handy und ausdrücklich den Erhalt der bisherigen Routinen, Einstellungen und des Spielstands. Geräteversion/Quellkennung noch nicht ausgelesen. Das bestätigt Installation und sichtbaren Datenerhalt; Weckerplanung nach Update (G12) und die übrigen Fälle unten gelten dadurch nicht als neu geprüft. Nächster Test ist G1 bei entsperrtem Handy.

## Wecker

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
| 21 | Tag mit vielen Erinnerungen ohne Reaktion | Höchstens drei Anker-Meldungen sichtbar | |
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
