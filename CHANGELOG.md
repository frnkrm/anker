# Patch Notes

## 1.2.0-rc.2 in Entwicklung (2026-11-06)

- Öffnungslinks aus Widget/Benachrichtigung sperren die Navigation nicht mehr durch erneutes Öffnen nach jedem Seitenwechsel. Neue Links und klingelnde Wecker bleiben erreichbar.
- Eine bewusst gestartete Aktivitäts-Messnacht pausiert ihren Vorwecker. Hinweis vor dem Start sowie im Mess- und Weckerstatus; Hauptwecker und gespeicherte Vorwecker-Einstellung bleiben erhalten. Die Pause gilt auch nach Messungsende bis zu diesem Haupttermin, neue Termine verwenden wieder die Einstellung.
- Geführte Gerätefälle64/65 ergänzen Navigation und Vorweckerpause. Neue Ergebnisse bleiben bis zum eigenen Test offen.

Automatische Nachweise im Testprotokoll; diese Korrekturen sind noch nicht am Handy geprüft. E02 wird anschließend im selben Update ergänzt.

## Unveröffentlicht: E00-Audit und erste E01-Verbesserungen

Versionsnummer unverändert. Automatische Nachweise und Grenzen in [ANKER_TESTNACHWEISE.md](docs/ANKER_TESTNACHWEISE.md); diese Änderungen sind **noch nicht auf dem Galaxy geprüft**, kein Release/APK.

- **Gemeinsam testen:** eigene Seite mit63 geführten Versuchen, direkten Einstellungswegen, Rückkehrbanner, lokalen Notizentwürfen und bewusst gespeicherten Berichten. Browser und Android sowie unterschiedliche Codestände bleiben unterscheidbar. Keine Punkte oder Alltags-Erledigungen für Test-Häkchen. Alte Geräteberichte werden nicht automatisch übernommen.
- **Zeiten direkt eingeben:** Uhrzeiten zwischen +/- antippen, Dauern als Zahl bearbeiten. Leere Zahleneingaben setzen nichts auf0. Nachtzeiten und manuell gewählte Zeiten bleiben auch in der Ersteinrichtung geschützt.
- **Wecker:** Bereits unterwegs befindliche, inzwischen verworfene/verschobene Signale werden abgewehrt. Ein deaktivierter Wecker holt kein fälliges Schlummern nach. Feste Absicherung des experimentellen Weckfensters bleibt erhalten.
- **Diagnose:** ungenaue Planung und gemeldete Fehler sind kein grüner Erfolg. Hinterlegte Planung bestätigt keine Hörbarkeit; für ausgelassene Termine wird keine Ursache erfunden.
- **Audit:** aktuellen Code statt historischer Version ausgewertet,71 Anforderungs-IDs im vorhandenen Plan zugeordnet, vorherige Änderungen gesichert und erhalten.

## Unveröffentlicht: Gleitzeit und Kundenarbeit

Versionsnummer unverändert, **nicht auf einem echten Handy geprüft**.

### Neu
- **Gleitzeit:** spätester Beginn (Vorgabe 09:00, änderbar), Wunsch-Beginn, Netto-Soll und übliche Pause je Wochentag, auch ein eigener Freitag. Anker rät keine Werte.
- **Arbeit starten, Pause, Feierabend:** freiwillig, höchstens zwei Tipps. Der Feierabend rückt mit der echten Pause in beide Richtungen.
- **Nachtragen und korrigieren** ohne Timer, mit Rückgängig. Wochenblick nur auf Wunsch und ohne Wertung.
- **Einsätze:** Wartung planen, Kundenproblem jetzt, Vor-Ort-Termin, Rufbereitschaft. Der freie Tag bleibt frei.
- **Heute anders → Arbeit heute anders:** später anfangen, Pause, früher Schluss, länger, Ziel für heute. Nur dieser Tag.
- **Hinweise** zu Pause, Ruhezeit und Sonntag, sachlich und abschaltbar. Nachricht zum Kopieren, Anker sendet nichts.

### Behoben
- **Wecker bei Always-on-Display:** Es kam nur die Meldung, das Vollbild erst nach einem Tipp. Anker schaltet beim Klingeln jetzt den Bildschirm ein und stößt das Vollbild erneut an. Am Gerät bestätigt.
- **Homeoffice meldete „Losgehen“** und zählte „Pünktlich los“ als Ziel. Beides entfällt dort jetzt.
- **Datenschutz:** Der Terminname stand in der Änderungsliste des Tages und damit im Sync, der Anlass stand im Widget und, beim Merken eines Gedankens, als Kontext im Sync. Alles drei ist nun allgemein gehalten. Bereits synchronisierte Einträge werden nicht rückwirkend geändert.
- **Früher zurück** beendet nun auch den Termin im Plan, statt ihn bis zum geplanten Ende anzuzeigen.

## 1.2.0-rc.1 (2026-11-04), Vorabversion

**Noch nicht auf einem echten Handy geprüft,** auch die Prüfung von 1.1.0-rc.1 steht noch aus.

### Neu
- **Heute anders:** etwas anderes vor, Routine später, heute nicht nötig, länger wach, Plan ab jetzt neu. Mit Änderungsliste und „Zurück zum ursprünglichen Plan“.
- **Termine und Wege:** Freunde, Kunden und eigene Termine mit Uhrzeit, optional Ort, Fahrzeit und Ende. Der Weg startet am letzten bekannten Ort, ohne Umweg über die Wohnung. Die Rückkehr wird nicht erfunden.
- **Unterwegs:** Fertigmachen, Bin los, Ich bin angekommen, Bin wieder da, Route in Google Maps.
- **Morgen rückwärts geplant:** Vorschlag für eine einmalige Weckzeit, nur nach Bestätigung. Der Standard bleibt.
- **Schlaf:** sachlicher Hinweis zur erwarteten Schlafzeit, keine Bewertung.
- **Abends schon erledigt:** Morgenschritt entfällt, gilt dort aber nicht als erledigt.
- **Wetter für morgen** (aus, bis du es einschaltest), **Homeoffice-Text zum Kopieren**, eigene Puffer für Wege.

### Behoben
- **Überspringen galt als „Abendroutine erledigt“.** Das Kernziel ließ sich so ohne echte Handlung erreichen. Jetzt zählt nur, was du wirklich gemacht hast.
- **Haken in der Tageslinie** erscheinen nur noch bei wirklich Gemachtem.

### Geändert
- **Ein bewusst geänderter Tag zählt nie als verfehlt** und kostet im Kapitel nichts. Alte Tage bleiben, wie sie sind.

### Noch offen
- Live-Verkehrsdaten und Ankunftserkennung per Standort sind nicht umgesetzt.
- Orte lassen sich noch nicht als feste Liste speichern. Zielkompass, „Nicht vergessen“-Liste und eine selbst gesetzte einzelne Abend-Erinnerung fehlen noch.

## 1.1.0-rc.1 (2026-11-04), Vorabversion

**Noch nicht auf einem echten Handy geprüft.** Logik per Unit-Tests geprüft, die APK ist gebaut. Lass den Android-Wecker zusätzlich gestellt, bis du [die Geräteprüfung](docs/GERAETETEST.md) durchlaufen hast.

### Behoben
- **„Wecker testen“ löscht den echten Wecker nicht mehr.** Der Test war derselbe Alarm wie der Hauptwecker, ersetzte ihn und setzte das Schlummern zurück.
- **Der Test zählt nicht mehr als „aufgestanden“.**
- **Der nächste Morgen plant sich selbst,** auch nach dem 30-Minuten-Ende und bei geschlossener App.
- **Doppelte Signale erzeugen keine zweite Klingel,** das Zeitlimit übersteht einen Neustart der App.
- **Erinnerungen laufen zwei Wochen weiter,** auch ohne die App zu öffnen, und bauen keinen Stau auf.
- **Höchstens drei Anker-Meldungen in der Leiste,** feste Termine werden nicht von Kleinigkeiten verdrängt.
- **Knöpfe in Meldungen wirken bei geschlossener App.**
- **„Morgen erledigen“ erscheint jetzt wirklich** am richtigen Tag unter **Tag** und auf der Startseite.
- **Von Hand gesetzte Zeiten bleiben stehen,** wenn Anker neu rechnet.
- **PC-Stopp erzwingt nichts mehr:** Das frühere Herunterfahren mit Wartezeit schloss Programme laut Windows-Doku erzwungen. Jetzt gibt es 5 Minuten Schonfrist, ein Herunterfahren ohne Zwang und ein Skript zum Aussetzen. Dafür das Paket neu installieren.
- **Drucken auf Android:** eigener Weg zum Systemdialog, der `window.print()` in der App nicht zuverlässig war.

### Neu
- **Startseite:** eine Hauptaktion, höchstens zwei weitere, Rest unter „Mehr“. Warum etwas dran ist, steht in einem Satz.
- **Arbeit:** wichtigste Aufgabe statt „nichts zu tun“, „Ich wurde unterbrochen“, Fristen, Feierabend-Übergabe. Bleibt auf dem Gerät.
- **Unterstützung wählen:** Einfach anfangen, Wenig Energie, Überlastet, Auf Kurs.
- **Gedanken:** nach dem Speichern „Du warst bei …“ und zurück.
- **„Ich hänge fest“:** ein Bildschirm, ein Schritt, 2-Minuten-Ring, „Etwas kleiner“.
- **„Tag neu sortieren“:** höchstens drei Dinge ab jetzt, kleine Versionen für den Rest.
- **Wecker:** optionaler Vorwecker und Wachheits-Check, Notfall-Stopp ohne Lesen und Rechnen, Diagnose mit echten Android-Werten.
- **Privates Einnahmeprotokoll:** aus, bis du es einschaltest. Bleibt auf dem Gerät, nie automatisch, keine Wirkungsanzeige.
- **Fokus-Puls** (aus), **Abendmodus-Vorschlag** (aus), **Ankommen nach der Arbeit** (aus), **Spiel ausblendbar**, **freiwillige 7- oder 14-Tage-Probe**.
- **Druckauswahl:** Morgen, Abend, beide, QR-Code, Haustür, A5 oder A4.

### Geändert
- Fortschritt beim Fokus-Timer übersteht Pausieren und Neuöffnen.
- Exakte Wecker: `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` nur noch bis Android 12.

### Daten
Einstellungen, Routinen, Spielstand, Gedanken, QR-Code und Sicherungen aus 1.0.x bleiben erhalten. Neues ist standardmäßig aus.

### Noch offen
- Alle Punkte aus [GERAETETEST.md](docs/GERAETETEST.md), besonders Samsung, Sperrbildschirm, „Nicht stören“, Neustart und der gedruckte QR-Code.
- Spracheingabe für Gedanken ist nicht umgesetzt. Das Widget zeigt keine Arbeitsaufgaben.

## 1.0.1 (2026-11-04)

### Behoben
- **Schlummern löscht den Wecker nicht mehr:** Der Schlummer-Wecker läuft jetzt getrennt vom Wecker für den nächsten Morgen. Er bleibt auch nach einem Neustart des Handys bestehen.
- **Schlummern bleibt auf 1× begrenzt:** Wenn du in die App zurückkehrst oder sich der Plan ändert, erscheint der Schlummer-Knopf nicht mehr erneut.
- **Sport lässt sich jetzt abhaken:** Unter **Tag** gibt es einen „Erledigt“-Knopf, den du auch zurücknehmen kannst. Bei Fitnessstudio oder Sport nach der Arbeit steht er auch auf der Startseite. So sind Sporttage in Stufe 3 auch ohne Health Connect schaffbar.

### Geändert
- **Training in der Morgenroutine zählt als Sport:** Das gilt für Training zu Hause und Laufen, auch als kleine Version. Beim Fitnessstudio zählt nur der Knopf oder Health Connect.

### Dokumentation
- Neu: [Anleitung](docs/ANLEITUNG.md) und [Struktur des Repositorys](docs/STRUKTUR.md)

### Noch offen
- Die Schlummer-Korrektur ist kompiliert, aber noch nicht auf einem echten Handy getestet.

## 1.0.0 (2026-10-28)

Erste Version als Android-App und Web-Version.

### Kern
- **Tagesplan:** rückwärts vom Arbeitsbeginn berechnet, mit Kalenderterminen, Minimal-Versionen und „Ich mache heute länger“
- **Startseite „Jetzt“:** eine nächste Aktion, Countdown zur nächsten festen Zeit, „Ich hänge fest“ mit 2-Minuten-Timer
- **Routinen:** Fokus-Modus Schritt für Schritt, frei editierbar, Reihenfolge per Ziehen
- **Tagesarten:** Arbeit, frei, Urlaub, krank, spontan Homeoffice

### Android
- **Erinnerungen:** mit drei Stärken, Ruhezeiten und den Knöpfen „Erledigt“, „5 Min später“ und „Heute nicht“
- **Wecker:** Vollbild-Alarm, Ausschalten per QR-Code oder 3 Rechenaufgaben
- **Widget:** nächste Aktion, nächste feste Zeit, Knopf für Gedanken
- **Einrichtungs-Check:** Ampeln für Berechtigungen und Extras
- **Health Connect:** nur Lesen von Training und Schritten

### Spiel
- **Fünf Themen:** Seefahrt, Piraten-Abenteuer, Weltraum-Saga, Kampfkunst-Saga, Schlicht
- **Fortschritt:** XP, Level, Abzeichen und Erfolge
- **Kapitel:** 7, 14, 30 und 66 Tage mit der Regel „Nie zweimal“ und einem Joker
- **Stufen und Belohnungen:** drei Stufen, die neue Ziele freischalten, und ein Shop für eigene Belohnungen

### Alltag
- **Gedanken-Inbox** mit 2-Minuten-Durchsicht
- **Essen:** eigene Gerichte, Zufallsvorschlag, Vorkoch-Tag
- **Aufräumen:** 10-Minuten-Timer mit wechselnden Zonen
- **Weiteres:** Abend-Checkliste, Wochenrückblick, Druckansicht (A5), Hilfe-Seite

### Optionale Extras
- **Sync und Login:** Supabase mit Magic Link, jeder Nutzer sieht nur seine Daten
- **Kalender:** Google Kalender und `.ics`-Export
- **PC-Stopp für Windows:** Warnungen, Herunterfahren, einmal pro Abend 15 Minuten Verlängerung
- **Sicherung:** JSON-Export und -Import

### Datenschutz
- Der Kern läuft offline und ohne Konto.
- Keine Werbung, kein Tracking, keine Analytics.
