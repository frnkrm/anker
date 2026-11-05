# Geräteprüfung

Was nur auf einem echten Handy geprüft werden kann. Ergebnisse vom 04.11.2026, gemeldet vom Nutzer. Leere Zeilen sind offen.
Trage Gerät, Android-Version, Datum und Ergebnis ein. Erst dann gilt ein Punkt als „am Gerät verifiziert“.

Gerät: ______ · Android/One UI: ______ · Datum: 04.11.2026 · Version: Punkt 3 mit 1.1.0-rc.1, der Rest mit 1.2.0-rc.1 inklusive Gleitzeit

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
