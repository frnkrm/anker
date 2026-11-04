# Anker 2.0: Implementierungsplan

Fortsetzbarer Stand. Status: `offen` · `implementiert` · `automatisch getestet` · `am Gerät verifiziert` · `blockiert`

**Am Gerät verifiziert ist bisher nur eins:** Der Testalarm lässt den nächsten Hauptwecker unverändert (Punkt 3, Version 1.1.0-rc.1, vom Nutzer bestätigt). Alles andere ist dort offen.
Grüne Tests und ein Build zeigen nur, dass die reine Logik stimmt und der Code kompiliert. Handprüfung: [GERAETETEST.md](GERAETETEST.md).

Branch: `entwicklung/anker-2` (nicht gepusht).

## Ausgangslage (04.11.2026)

| Prüfung | Ergebnis vor Änderungen |
|---|---|
| Git | `main` sauber, lokal = `origin/main` (98f8e2d) |
| `npm test` | 106 Tests in 7 Dateien bestanden |
| `npm run lint`, `typecheck` | bestanden |
| `npm run android:debug` | bestanden |

## Audit-Befunde

| Befund | Ursache in 1.0.1 | Status |
|---|---|---|
| Testalarm verdrängt echten Wecker | Gleicher PendingIntent, Receiver löschte `alarmAt` und Schlummern | behoben, automatisch getestet |
| Test zählte als „wach“ | `stop()` setzte immer `wakeAt` | behoben, implementiert |
| Kein Folgetag ohne App | Nur JS plante nach | behoben, automatisch getestet |
| Doppelte Klingel-Instanz möglich | `onStartCommand` startete jedes Mal neu | behoben, implementiert |
| Zeitlimit nach Prozess-Neustart neu | Handler ab Neustart | behoben, Logik getestet |
| 48-h-Lücke | Plan an JS gebunden | behoben, Logik getestet |
| Meldungen ohne Obergrenze | Eigene ID je Stufe | behoben, Logik getestet |
| Inbox-Sackgasse | `taskDate` wurde nirgends gelesen | behoben, automatisch getestet |
| Handzeiten überschrieben | `applySchedule` ignorierte sie | behoben, automatisch getestet |
| PC-Stopp erzwingt | `shutdown /s /t N` impliziert `/f` | behoben, Skriptinhalt getestet, nicht unter Windows ausgeführt |
| Web-Sheets ohne fertige Animation | Bewegtes `animate-pop` | entfernt |

## Pakete

### A: Wecker

| Schritt | Status |
|---|---|
| Zustandsmaschine `AlarmModel.kt` | automatisch getestet |
| `AlarmController`, eigene Identität je Alarmart | implementiert, Codes getestet |
| Native Folgetagplanung, Konfigurationsspiegel | automatisch getestet |
| Abgleich: Stopp, Timeout, Neustart, Update, Zeit, Zeitzone, Rechte | implementiert, Logik getestet |
| Zeitumstellung, 04:00-Wechsel | automatisch getestet (Kotlin und TS mit gleichen Werten) |
| Verpasste Wecker: 30 min nachholen | automatisch getestet |
| Vorwecker, Wachheits-Check | automatisch getestet |
| Notfall-Stopp, Rechenaufgaben einstellbar | implementiert |
| Einnahmeprotokoll getrennt, lokal | automatisch getestet |
| Ton-Rückfall, Audiofokus, WakeLock, Ersatzmeldung | implementiert |
| Exakt-Recht | implementiert, Manifest gebaut |
| Direct Boot: Daten im Geräteschutz-Speicher, Beenden in der Meldung | implementiert, Grenze dokumentiert |
| Diagnose mit echten Android-Werten | implementiert |
| Temporäre Lautstärkeanhebung | bewusst nicht umgesetzt (Auftrag bevorzugt das) |
| Gerätematrix | **offen, braucht Handy** |

### B: Benachrichtigungen

| Schritt | Status |
|---|---|
| Slots, Rang, Warteschlange | automatisch getestet |
| Zustellung und Knöpfe ohne JS | implementiert |
| 14 Tage voraus, Hinweis am Ende, kein Stau | Logik getestet |
| Abräumen der Altlasten aus dem Plugin | implementiert |
| WorkManager | nicht nötig: je ein geplanter Alarm für den nächsten exakten und den nächsten ungenauen Eintrag |
| Am Gerät | **offen, braucht Handy** |

### C: Druck

| Schritt | Status |
|---|---|
| Auswahl, A5/A4, Druck-CSS | automatisch getestet (Vitest, Playwright, PDF im Browser) |
| Native Brücke `printPage` | implementiert, Dialog **am Gerät offen** |
| PDF-Export als Alternative ohne Druckdienst | offen: Anker verweist auf die Web-Version |
| QR auf Papier scannen | **offen, braucht Drucker und Handy** |

### D: ADHS-Kern

| Schritt | Status |
|---|---|
| D1 Modi, Abendvorschlag | automatisch getestet |
| D2 `nextAction()` mit Begründung | automatisch getestet |
| D3 Fokus-Puls, Timer per Zeitstempel | automatisch getestet, Vibration am Gerät offen |
| D4 Blitzableiter | automatisch getestet (E2E) |
| D5 Inbox im Tagesplan, eine Wahrheit | automatisch getestet |
| D6 „Ich hänge fest“ | Logik getestet, im Browser angesehen |
| D7 Arbeitsmodus, Übergabe, Vorlagen | automatisch getestet (Vitest, E2E) |
| D8 Handzeiten, „Tag neu sortieren“ | automatisch getestet |
| D9 Ankommen, Gericht aus eigener Liste | automatisch getestet |

### E: Oberfläche

| Schritt | Status |
|---|---|
| „Jetzt“: eine Hauptaktion, Rest unter „Mehr“ | automatisch getestet (E2E), im Browser angesehen |
| Fokus mit Gedanken-Knopf und Puls-Schalter | implementiert |
| Ruhigere Karten mit 1-px-Rahmen | implementiert |
| Kontrast, große Schrift, Screenreader | **nicht systematisch geprüft** |

### F: Reifegrad

| Schritt | Status |
|---|---|
| F1 PC-Stopp ohne Zwang, Android-Fokus verlinkt | Skriptinhalt getestet, nicht unter Windows ausgeführt |
| F1 Spracheingabe, eigene Ablenkungsblocker | bewusst nicht umgesetzt (keine neue Berechtigung) |
| F1 Widget | unverändert, zeigt bewusst keine Arbeitsinhalte |
| F2 Migration, Sicherung, lokale Daten vom Sync ausgenommen | automatisch getestet |
| F3 Freiwillige Probe | implementiert |
| F4 Hilfe-Hinweise, vertraute Person | implementiert |
| Doku | aktualisiert |

## v4: Flexibler Alltag

Vorrang hatte P0. Dessen Geräteprüfung steht noch aus, daher ist auch hier nichts am Gerät verifiziert. Semantik: [FLEXIBLE_PLANUNG.md](FLEXIBLE_PLANUNG.md).

### Delta gegen den Stand von v3

| Anforderung | Einordnung | Umsetzung |
|---|---|---|
| Eine nächste Aktion, Modi, Wiedereinstieg | schon durch v3 vorhanden | `nextAction()` erweitert, kein zweiter Planer |
| `DayOverride`, Homeoffice, Tagesarten | für v4 erweitern | gleiche Struktur, neue optionale Felder |
| Neutrale Zustände | für v4 erweitern | `StepResult` um `not-needed`, statt paralleler `Resolution` |
| Falsches „Abendroutine erledigt“ beim Überspringen | Konflikt, behoben | `routineCompleted` |
| Termine, Orte, Wege | neu nötig | `Commitment`, `Place`, `Leg` in `LocalData`, Kalender-Events bleiben getrennt |
| Einmalige Weckzeit | für v4 erweitern | `wakeOverrides` im bestehenden Wecker-Spiegel |
| Live-Verkehr, Geofencing | technisch begrenzt, optional | nicht umgesetzt, siehe unten |

### Stand

| Schritt | Status |
|---|---|
| A1 Heute anders, Undo, Änderungsliste | automatisch getestet (Vitest, E2E) |
| A2 Grund nie Pflicht, abschaltbar, Text erst nach Vorschau | implementiert, Vorschau per E2E getestet |
| A3 Neutrale Zustände, faires Spiel | automatisch getestet |
| A4 Soziale Termine, offene Rückkehr, stille Freizeit | automatisch getestet |
| A5 Tageszustände, Reihenfolge, Zurück zum Plan | automatisch getestet |
| B1 Wege ohne Umweg, B2 Kundentermin, „Nur morgen“ | automatisch getestet |
| B2 Gespeicherte Orte verwalten, Packlisten-Vorlagen | teilweise: Datenmodell und Planer fertig, **noch keine Eingabemaske** |
| B3 Stufe 1: Schätzung und Maps-Link | automatisch getestet |
| B3 Stufe 2: Live-Verkehr | **offen, braucht deine Entscheidung** (Google Routes ist kostenpflichtig, Key darf nicht ins APK) |
| C1–C3 Rückwärtsplanung, Schlafhinweis, einmaliger Wecker | automatisch getestet, Wecker am Gerät **offen** |
| C4 Länger wach, Freizeit ohne Pings | automatisch getestet |
| C4 Eine einzelne selbst gesetzte Erinnerung am Abend | offen |
| C5 Dusch-Regel und „für morgen schon erledigt“ | automatisch getestet |
| D1 Wetter, D2 Packliste im Termin | Logik getestet, Abfrageformat einmal live geprüft, Datenanzeige nicht E2E-getestet |
| E1 Bin los, Angekommen, Bin wieder da | implementiert |
| E2 Geofencing | **offen**, bewusst nicht ohne Gerätetest und Berechtigungsentscheidung |
| F2 Rückkehr-Abfrage, F3 Homeoffice-Vorlage, F4 eigene Puffer | implementiert |
| F1 Zielkompass aus eigenen Zielen, F3 einmalige Erinnerung, F6 „Nicht vergessen“ | offen |
| Durchgängig nur Gerät | **offen** |

## v5: Gleitzeit und Kundenarbeit

Eigenständiges Zusatzpaket. Regeln und Rechenwege: [GLEITZEIT.md](GLEITZEIT.md). Annahmen werden nicht geraten: Freitags-Soll, Wochenstunden, Vergütung und Betriebsregeln trägst du selbst ein oder sie bleiben offen.

### Delta gegen den Stand von v4

| Anforderung | Einordnung | Umsetzung |
|---|---|---|
| Wunsch-Beginn, Netto-Soll und Pause je Wochentag | schon vorhanden | `WorkDay.start`, `durationMin` (war schon netto), `pauseMin`. Keine zweite Tabelle |
| Spätester Beginn | neu | `settings.flex.latestStart`, Vorgabe 09:00 aus deinem Auftrag |
| Tagesabweichung | erweitern | `DayOverride` um `workStart`, `targetNetMin`, `pauseMin`, läuft über `adjustDay` |
| Geplante Einsätze | erweitern | `Commitment` um `workKind`, kein zweites Terminmodell |
| Ist-Zeiten | neu | `LocalData.workSessions`, lokal und ohne Sync, getrennt vom Plan |
| Prognose Feierabend | neu | `src/core/worktime.ts`, vom Planer genutzt |
| Hinweise zu Pause, Ruhezeit, Sonntag | neu | reine Informationen, abschaltbar, keine Rechtsauskunft |
| Losgehen-Meldung im Homeoffice, Ziel „Pünktlich los“ im Homeoffice | Fehler aus 1.0, behoben | `plan.leave` bleibt im Homeoffice leer |
| Heute anders, Termine, Wecker-Vorschlag, Nachrichtenentwurf | wiederverwendet | gleiche Abläufe, keine zweite Override-Engine |
| Neue Berechtigungen, APIs, nativer Code | nicht nötig | keine |

### Stand

| Schritt | Status |
|---|---|
| Rechenkern, Szenarien A bis L | automatisch getestet (Vitest) |
| Planer, nächste Aktion, Erinnerungen, Hinweise | automatisch getestet (Vitest) |
| Start, Pause, Feierabend, Nachtragen, Sonntagseinsatz, Später anfangen | automatisch getestet (E2E), im Browser angesehen |
| Einstellungen, Arbeitszeit-Seite | E2E und im Browser angesehen, nicht jeder Korrekturweg einzeln |
| Abgleich mit deinem Arbeitgeber-Stempel, Feiertage, Bezahlregeln | bewusst nicht umgesetzt |
| Packlisten und feste Orte für Einsätze | offen, gleiche Lücke wie in v4 |
| Am Gerät | **offen**, Punkte 41 bis 46 in [GERAETETEST.md](GERAETETEST.md) |

## Nächster Schritt

APK aufs Handy, Abschnitt „Wecker“ aus [GERAETETEST.md](GERAETETEST.md) durchgehen. Fehler dort haben Vorrang vor allem Weiteren.
