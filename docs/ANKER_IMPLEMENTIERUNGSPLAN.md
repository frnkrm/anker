# Anker 2.0: Implementierungsplan

Fortsetzbarer Stand. Status: `offen` · `in Arbeit` · `implementiert` · `automatisch getestet` · `am Gerät verifiziert` · `blockiert`

**Kein Punkt ist „am Gerät verifiziert“:** In dieser Arbeitsphase war kein Android-Gerät verbunden (`adb devices` leer).
Ein grüner Build oder grüne Unit-Tests zeigen nur, dass Code kompiliert und die reine Logik stimmt.

## Ausgangslage (04.11.2026)

| Prüfung | Ergebnis vor Änderungen |
|---|---|
| Git | `main` sauber, lokal = `origin/main` (98f8e2d), neuer Branch `entwicklung/anker-2` |
| `npm test` | 106 Tests in 7 Dateien bestanden |
| `npm run lint`, `typecheck` | bestanden |
| `npm run android:debug` | bestanden (JDK 21, SDK vorhanden) |

## Bestätigte Befunde aus dem Audit

| Befund | Ursache im Code (v1.0.1) | Status |
|---|---|---|
| Testalarm verdrängt den echten Wecker | Gleicher PendingIntent (`REQUEST`), `AlarmReceiver` löschte zudem `alarmAt` und setzte das Schlummern zurück | behoben, automatisch getestet |
| Test zählte als „wach“ | `stop()` setzte `wakeAt` immer | behoben (Klingelseite), Logik getestet |
| Kein Folgetag ohne App | Nur JS plante, Receiver plante nichts nach | behoben, automatisch getestet |
| Doppelte Klingel-Instanz möglich | `onStartCommand` startete Ton und Timeout bei jedem Aufruf neu | behoben, nur durch Lesen geprüft |
| 30-min-Limit galt nach Prozess-Neustart neu | Handler ab Neustart gezählt | behoben, Logik getestet |
| 48-h-Lücke bei Erinnerungen | Plan nur 48 h, an JS gebunden | behoben, Logik getestet |
| Benachrichtigungen ohne Obergrenze | Jede Stufe eigene ID | behoben, Logik getestet |
| PC-Stopp kann Arbeit vernichten | `shutdown /t N` setzt laut Windows-Doku `/f` | siehe Paket F |

## Paket A: Wecker

| Schritt | Status |
|---|---|
| Zustandsmaschine `AlarmModel.kt` (rein, JUnit) | automatisch getestet |
| `AlarmController` als einziger Zustandsbesitzer | implementiert |
| Eigene PendingIntent-Identität je Alarmart | automatisch getestet (Codes), Verhalten am Gerät offen |
| Native Folgetagplanung, Spiegel `AlarmConfig` | automatisch getestet |
| Reconcile: Stopp, Timeout, Schlummern, Neustart, Update, Uhrzeit, Zeitzone, Rechte | implementiert, Logik getestet |
| Verpasste Wecker: 30 min nachholen, ältere nur vermerken | automatisch getestet |
| Vorwecker, Wachheits-Check (optional, aus) | automatisch getestet |
| Notfall-Stopp ohne Lesen/Rechnen/Kamera | implementiert |
| Einnahmeprotokoll getrennt, lokal, nie automatisch | automatisch getestet |
| Ton-Rückfallkette, Audiofokus, WakeLock | implementiert |
| Exakt-Recht: `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` nur bis API 32 | implementiert, Manifest gebaut |
| Diagnose mit echten Android-Werten | implementiert |
| Reale Gerätematrix (Abschnitt 6.3 des Auftrags) | **offen, braucht Handy** |

## Paket B: Benachrichtigungen

| Schritt | Status |
|---|---|
| Drei Slots mit Rang, Warteschlange getrennt (`ReminderModel.kt`) | automatisch getestet |
| Native Zustellung ohne JS (`ReminderScheduler`) | implementiert |
| 14 Tage Vorausplanung, ein einziger geplanter Alarm, Hinweis am Ende | Logik getestet |
| Knöpfe wirken bei geschlossener App, Nachtrag im Store | implementiert |
| Alte Plugin-Erinnerungen abräumen | implementiert |
| Am Gerät: 5 Ereignisse, Neustart, Schlummern | **offen, braucht Handy** |

## Paket C: Druck

| Schritt | Status |
|---|---|
| Auswahl Morgen/Abend/Beide/QR/Haustür, A5/A4 | automatisch getestet (Vitest, Playwright inkl. PDF im Browser) |
| Native Druckbrücke `printPage` | implementiert, Dialog am Gerät **offen** |
| QR-Ausdruck tatsächlich scannen | **offen, braucht Drucker und Handy** |

## Paket D, E, F

Siehe Abschnitte unten, werden nach Abschluss von P0 ergänzt.
