# Patch Notes

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
