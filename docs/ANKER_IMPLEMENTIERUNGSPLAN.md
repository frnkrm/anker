# Anker 2.0: Implementierungsplan

Fortsetzbarer Stand. Status: `offen` · `implementiert` · `automatisch getestet` · `am Gerät verifiziert` · `blockiert`

**Kein Punkt ist „am Gerät verifiziert“:** In dieser Arbeitsphase war kein Android-Gerät verbunden (`adb devices` leer).
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

## Nächster Schritt

APK aufs Handy, Abschnitt „Wecker“ aus [GERAETETEST.md](GERAETETEST.md) durchgehen. Fehler dort haben Vorrang vor allem Weiteren.
