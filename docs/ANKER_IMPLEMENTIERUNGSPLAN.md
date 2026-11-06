# Anker 2.0: Implementierungsplan

## Gesamtauftrag v6: Baseline und aktueller Fortschritt

**Nachkorrektur 07.11.2026, implementiert und lokal geprüft:** Update **1.3.0-rc.2 / Code 9**, Quellkennung `b131b9b89e3d27fede35ec7d699950385d1917f2881e4445647fb7d46cb783f2`. Routinen lassen sich am Griff sortieren; stabile Messung, Abbruch, aktuelle Schritt-IDs und Speicherbestätigung bewahren Texte, Dauern und Minimal-Versionen. G95 führt direkt zu beiden Editoren. Der KI-Schalter erklärt fehlende Einrichtung und nächste Schritte, ohne Freigaben zu umgehen. **785 Logiktests und der vollständige Lauf mit 156 Browserfällen** grün, darunter 13 Routinen- und vier neue KI-Fälle; keine Skips oder Retries. Lint, TypeScript, Produktionsbuild und Android-Release-/Paketprüfungen bestanden. GitHub-CI und öffentlicher Download werden anschließend geprüft; echte Samsung-/Windows-/Anbieterprüfungen offen. E04–E09 bleiben implementiert. [Updateanleitung](UPDATE_ROUTINEN_RC2.md) · [Nachweis](KORREKTUREN_RC2_NACHWEIS.json).

**Aktuell 06.11.2026:** Die Softwareentwicklung E04–E09 ist abgeschlossen und gemeinsam geprüft. Update **1.3.0-rc.1 / Code 8**, Quellkennung `e8625c6f0443c315be57936c8b496037e4c5d72a8f917e8a6b23ae30925d843b`. [GitHub-CI21](https://github.com/frnkrm/anker/actions/runs/42289520357) ist für `240033c` vollständig grün: **139 Browserfälle**, Logik, Lint, TypeScript, PowerShell und Build. Lokal 780 Vitest-/87 native JUnit-/19 PowerShell-Fälle und Release-APK-Build grün. Zusätzliche gezielte Integration nach CI20:24/24 Fälle, keine Timeoutlockerung oder Skips. E09-Geräteanteil wie vom Nutzer gewünscht offen: zehn StationenG86–95, frühere Berichte erhalten. KI-/Verkehrsadapter implementiert, echte Anbieter nicht aktiviert; echte Android-/Windows-/Providerprüfungen offen. [Gemeinsames Update und PowerShell-Anleitung](UPDATE_E04_E09.md) · [Maschinenlesbarer Beleg](E04_E09_SOFTWARENACHWEIS.json). Historische Zwischenstände darunter bleiben als solche erhalten.

**E00 abgeschlossen:** tatsächlicher Branch `work`, HEAD `38da41ef78a68f3d5d9ea25e73e1d4cf946b9d36`, Ursprung `github.com/frnkrm/anker`, App `1.2.0-rc.1`. Vorhandene Änderungen und unversionierte Dateien sind Teil der Baseline, nicht zurückgesetzt. Kein Claude-Prozess festgestellt; nur der Hauptagent schreibt, Unteragent prüft lesend. Keine geltenden `AGENTS.md`/`AGENTS.override.md` an den übergeordneten oder relevanten Projektpfaden gefunden. `CLAUDE.md`, Projektanleitung, Struktur, Changelog, Plan und Fach­dokumentation gelesen.

**Sicherung vor Edits:** 221 Quelldateien samt vorhandenen Änderungen archiviert und jeden Inhalt anhand SHA-256 nachgelesen. Quellfingerabdruck `7062052bccfb03e8222d78f1980eead1e4543b899f03fbf9de4412be02b769d5`. Lokales Archiv/Logs: `/workspace/.cache/anker/e00-baseline-20261105T225426Z/`. Das ist eine Sicherung dieser Cloud-Arbeitskopie, kein Export der Daten vom Handy und keine dauerhafte externe Sicherung. Signierschlüssel und Windows-Ordner `D:\Projekt\Anker` liegen hier nicht vor. Keine Migration, Löschung oder Änderung bestehender Nutzerdaten für E00.

**Frische Baseline:** Lint, Typecheck, Produktionsbuild bestanden; 330 Vitest-Tests/22 Dateien, 20 Playwright-Tests, Android-Kotlin-Kompilierung und 44 ausdrücklich neu ausgeführte JUnit-Tests ohne Fehler/Skip. Befehle und Grenzen: [Testnachweise](ANKER_TESTNACHWEISE.md). Kein APK gebaut, kein Push/Release. Automatisierte Tests bestätigen weder zukünftige Hörbarkeit noch Sensorqualität auf der Matratze.

**Geräteberichte erhalten:** G1–59 bezeichnen die bestehenden Fälle in [GERAETETEST.md](GERAETETEST.md). Darunter sind echte Nutzerberichte aus früheren Builds, Teilresultate und offene Fälle. G47/48 bestätigen den AOD-Fix am 05.11.; die frühere pauschale Aussage „kein Handy-Test“ ist deshalb historisch. Keine neue Änderung gilt dadurch als am Gerät geprüft. Galaxy S26 Ultra laut Nutzer; genaue Android-/One-UI-Version offen.

### Delta-Matrix der E00-Baseline, vor E01

Status: **V** vorhanden und im genannten automatischen Umfang geprüft · **U** vorhanden, dafür kein spezifischer automatischer Nachweis · **T** teilweise · **F** fehlt · **K** Konflikt · **X** externe Voraussetzung. Ein V bedeutet nie automatisch „am Android-Gerät geprüft“. Prüfungen beziehen sich auf die E00-Baseline; Testdateien unter `src/`, Kotlin unter `android/app/src/`.

| IDs | Ist-Stand / konkrete Integration | Automatischer Nachweis / Gerät / nächstes Delta |
|---|---|---|
| AL-01 | T `AlarmModel`, `AlarmController`, `Receivers`: ein Besitzer, getrennte Arten | `AlarmModelTest` Identität/Duplikate; alte bereits unterwegs befindliche Intents nicht gegen aktuelle Occurrence geprüft → E01 |
| AL-02 | T `reconcile`, `AnkerPrefs`: native Folgetage/Direct Boot | JUnit Timeout/Boot/DST; G5 nur teilweise, G10–13 offen; keine Produktiv-Weckfreigabe |
| AL-03 | T Test und Snooze getrennt | JUnit Testisolation/1×Snooze; G3 bestätigt, G4 teilweise; fälliges Snooze trotz deaktiviertem Wecker → E01 |
| AL-04 | T `AlarmService`, Manifest, Diagnose | Build/Modelltests; G14–16/18 historisch bestätigt, G17 nicht geprüft; aktuelle offizielle API-Quellen vor Strategieänderung erforderlich |
| AL-05 | V `Alarm.tsx`, `buildAlarmConfig`, Einnahme separat | `alarm.test.ts`, `AlarmModelTest`; G6/7 offen |
| AL-06 | V `Alarm.tsx`, `qr.ts`, `stopped` mit Notfallweg | JUnit Wachheits-Check; G8/19 historisch bestätigt, Scanner-Ausfallvarianten offen |
| AL-07 | T `AlarmDiagnosis`, `Check`, Plugin | PendingIntent ist keine Zustellbestätigung; aktuell falsches Grün bei Exakt-Fallback möglich → E01 |
| AL-08 | T `wakeOverride`, `sleep.ts`, native Tagesausnahme | `flexible.test.ts`, JUnit einmalige Zeit; G36 bestätigt, G35 offen; alte Signale nach Verschieben → E01 |
| NO-01 | V `reminders/build`, `ReminderModel/Scheduler` | Slot/Rang/Relevanztests; G22/23 historisch, Gesamtbudget G21 offen |
| NO-02 | T Queue und sichtbare Slots getrennt | JUnit Vorrat/Snooze; alte Action-Buttons ohne Planrevision, Q16 offen → E02 |
| NO-03 | T Alarm reserviert Slot | JUnit höchstens3/Alarmplatz; G22 bestätigt, Kombination Mikrofon-Dienst geräteoffen |
| NO-04 | T `notifications.ts`: 14 Tage und Öffnen-Hinweis | `support.test.ts` Mehrtag/Horizont; G24/25 offen, keine autonome Regel nach Vorratsende |
| NO-05 | T Ruhezeiten, Priorität, Freizeit | `support.test.ts`, `flexible.test.ts`; G40 historisch, Fokus-/Freizeitmatrix teilweise |
| PR-01 | V `Static.Print`, `core/print` | `print.test.ts`, E2E Druckansicht; G27–30 historisch bestätigt |
| PR-02 | T Browser-/Android-Systemdialog | E2E + Build; G27/28/30 bestätigt; unabhängiger PDF-Fallback ohne Druckdienst fehlt |
| PR-03 | T Druck-CSS, A4/A5, QR nur gelesen | Printtests/E2E; G28/29 bestätigt; lange Routine/große Schrift als vollständige Matrix offen |
| TA-01 | T bestehende `InboxItem`, `WorkTask`, kein neues Taskmodell | Support/E2E; generische Unteraufgaben/Wiederholungsinstanzen/Statusdetails fehlen → E03 |
| TA-02 | T `Shell.InboxSheet`, Store `addInbox` | E2E Gedanke und zurück; ungespeicherter Draft bei Prozessende/Schnellzugriffe offen |
| TA-03 | V `taskDate`, `DayTasks`, `tasksFor`, gemeinsamer Abschluss | Supporttests Morgen/einmaliger Abschluss; G49 neue Wiedervorlage offen |
| TA-04 | T zentrale `support.nextAction` | Prioritäten/echte Begründungen getestet; Dauer-/Ort-/Energie-Fitting und aktiver Taskstatus fehlen |
| TA-05 | F persistente Aufgabenzerlegung | Kein Test; Stuck-Mikroschritte sind kein Unteraufgabenmodell, lokale Vorlagen zuerst |
| TA-06 | T `Work`, `ResumePoint`, Handover/Vorlagen | Support/E2E Arbeit; frei wählbare Task-Fokusblöcke fehlen |
| TA-07 | T `Stuck`, Wiedereinstieg | Stuck/Resume getestet; Resume verfällt nach8h/Plantag → längeren Wiederanlauf ermöglichen |
| TA-08 | T `Focus`-Zeitstempel, persistierter Aufräumtimer | Supporttimer/E2E Aufräumen; G31/32 historischer Puls, persistente Fokus-Pause/Tasktimer offen |
| TA-09 | T `routineLinks` und einzelne Vorlagen | Flexible T5; persönliche Dauerschätzung/allgemeine Wenn-dann-Regeln fehlen |
| FL-01 | T `DayOverride`, `Commitment`, ehrliche Routinezustände | Flexible T14; generische Taskzustände nur teilweise |
| FL-02 | V `TodayDifferent`, `adjustDay`, Vorschau | E2E Heute anders, klare Zeiteingabe; systematische Bedienmatrix offen |
| FL-03 | T Undo/echt Erledigtes erhalten | Flexible T8/T9/T14, E2E; keine formale Planrevision, Widget/Druck teilweise abweichend |
| FL-04 | V `planLegs`, Planer, `legAction` | Flexible Filmabend T2; vollständiger Handyablauf offen |
| FL-05 | T/K `Longer`, `openEnd`, `PcStop` | Flexible T3/E2E; G40 bestätigt; PC noch1×15/behaupteter Empfang → E04/IN-02 |
| FL-06 | V `backAt`, Rückkehr/Absage | Flexible T8/T9; neue Änderungen geräteoffen |
| FL-07 | T `coveredSteps`, `routineLinks`, `routineCompleted` | Flexible T5 ohne doppelte XP; allgemeine Bedarfsvorlagen teilweise |
| FL-08 | K `chapter.ts`: Nichtnutzung kann Kapitel neu starten | `game.test.ts` belegt den alten Strafpfad; angepasst ist neutral, aber Nichtnutzung noch nicht → E04, erworbenen Fortschritt bewahren |
| WO-01 | V `worktime`, `WorkControls`, Einstellungen | Worktime A/J/L, keine erfundene Ist-Zeit; nur G43/45 historisch berichtet |
| WO-02 | T eigenes Wochenprofil/Freitag, Tagesoverride | Worktime C/E2E Freitag; Startgrenze/Ortsregel nicht je Wochentag |
| WO-03 | V Start/Pause/Ende/Nachtrag/Undo | Store-Doppeltap/E2E; G42/44/46 offen |
| WO-04 | T `dayActual`: Vereinigungsintervalle | Worktime B/I; widersprüchliche Nachträge still vereinigt, Restpause nicht als untere Prognose markiert |
| WO-05 | V `latestInfo`, Morgenplan, `sleep` | Worktime A/D/E, Sleep-Puffer; G35/41 offen |
| WO-06 | T `forecastEnd`, `workStop`, Tagesoverride | Worktime B/F/K; G43 Pause bestätigt, Konfliktplatzierung teilweise |
| WO-07 | V `workKind`, Sessions, Einsatz-UI | Worktime G/H, E2E Sonntag; G45 Hinweis bestätigt, Nachtablauf offen |
| WO-08 | T/X abschaltbare `workHints`, `restConflict` | Worktime H/K; aktuelle Rechtsquellenprüfung extern, keine betriebliche Freigabe |
| WO-09 | T `weekSummary`, `WorkTime`, Planintegration | Worktime/E2E; Widget verwendet `nowView`, nicht vollständige nächste Aktion |
| TR-01 | T `Place`, `Commitment`, reale Ortskette | Flexible T7; Orteverwaltung fehlt, unbekannter Ort wird zu remote |
| TR-02 | T Kundenformular/`PlanWorkForm`, Puffer | Flexible T3, Worktime E; Quellen-Dubletten und unklarer Ort offen |
| TR-03 | V `travelMin`, `mapsUrl`, manuelle Ankunft | Flexible T6; G38/39 historisch bestätigt, keine Live-ETA behaupten |
| TR-04 | F/X kein Routenprovider | Anbieter/Kosten/Datenschutzentscheidung in E07, manueller Pfad vorhanden |
| TR-05 | F/X keine Verkehrsrequests/Revisionen | Erst nach Providerentscheidung; kein fingierter Integrationstest |
| TR-06 | T manuelle Fallbackbasis | Flexible T6 keine erfundene Abfahrt; echter Provider-Ausfallpfad fehlt |
| SL-01 | T `sleepInfo`, freiwilliges Schlafprotokoll | `sleepDiary.test.ts`, Flexible T3; G52 offen, Zeitabstand keine Schlafmessung |
| SL-02 | T `latestWake`, `morningNeed` inkl. Rechnerstart/Gym | `sleep.test.ts`, Worktime D/E; G35 tatsächliches Wecken offen |
| SL-03 | V neutrale Schlaf-/Terminkonflikte | Flexible T3, Worktime K; G40 historisch berichtet |
| SL-04 | T bestätigter Override → Kotlin | Flexible T4/T16/JUnit; G36 Rücknahme, G35 Klingeln offen; AL-08 gilt |
| SL-05 | V spätes Arbeitsende und feste Folgeankunft | Worktime K; realer Ablauf offen, keine Gesundheits-/Rechtsfreigabe |
| WX-01 | T `weather`, `WeatherCard`, Providerparser | Flexible T11; fehlende Werte fälschlich0, Ortswechsel lädt nicht neu, Zielortbezug fehlt |
| WX-02 | T Jacke/Regenregel, `items`, Vorbereitung | Flexible T11/Gymbag; Packvorlagenverwaltung fehlt |
| WX-03 | V `legAction`, manuelle Ankunft | Flexible T2; keine automatische Arbeitsbuchung |
| WX-04 | F/X keine Geofences | E08 erst nach gesonderter Entscheidung und Geräteprüfung |
| UX-01 | T ruhige Tokens/Karten/Einzelschritt | E2E Handlungsbudget; G34 historischer TalkBack/160%, Fokusfalle/Focus-Return in Sheets offen |
| UX-02 | T kurze Gründe, Capture, Stuck | E2E/Support; Fokus-Abschlusssprache bei nur übersprungenen Schritten teilweise falsch |
| UX-03 | T Onboarding, Modi, spätere Einstellungen | E2E/Migration; Kapazitätsfragen/fehlende Werte nicht systematisch geprüft |
| UX-04 | T `MainGoal`, Vorbereitung, kleine Hilfen | Planer/Support teilweise; eigener Zielkompass/flexible Haushaltstasks fehlen |
| UX-05 | T Homeoffice-Text zum Kopieren | Planertests; Clipboard-Erfolg trotz Fehler möglich, Share-Abbruchtest fehlt |
| UX-06 | T lokale7-/14-Tage-Probe | Kein spezifischer Aus/Löschen/Update-Test; max3 Lernpunkte fehlen |
| UX-07 | T `Static.Help`, `AskSomeone` | Kein aktueller Quellen-/Clipboardnachweis; keine externen Nachrichten gesendet |
| IN-01 | T alle bisherigen Bereiche erhalten | Bestehende330/20/44 Tests; kein pauschaler Vollständigkeitsnachweis |
| IN-02 | T/K `PcStop`, `export/pcstop`, `pushPcStop` | Exportinhalt getestet; kein Windowslauf/Empfangskanal, falscher Erfolg und15-Minuten-Limit |
| IN-03 | T `widgetEntries`, `AnkerWidget` | Datenschutztest kein Kunde/Anlass; Recovery/Aktualität/Neustart/Doppeltap offen |
| IN-04 | U begrenzter System-Fokusweg | Kein besonderer Integrationstest, kein eigener Blocker/ungefragte Zusatzrechte |
| IN-05 | T Sync/Kalender/Health optional | Pagination-/Sync-/Sporttests; echte Dienste nicht E2E geprüft, Google-Aktualität teilweise |
| IN-06 | T Settingsmigration, Store-Queue, Repositories, Backup | Store-Rennen/Repository-/Backup-Roundtrip; G26/33 historisch; aktuelle SQLite-/Updatefälle offen |
| IN-07 | T/X Wetter-/Maps-Herkunft dokumentiert | Core-Fallbacktests; aktuelle Bedingungen extern, Wetterparser0 ist kein echter Messwert |
| 03.4 | T kanonischer Store, sequenzielle Persistenz | Storetests; `effects.run()` noch parallel möglich → E03 mit Regression sequenzieren |
| 03.5 / Q82 | V Berlin-Planminuten, UTC-Istintervalle | `time.test.ts`, Worktime H, Kotlin DST; tatsächlicher Uhrwechsel am Gerät offen |
| Aktivitäts-Weckfenster / G53–59 | T optional, standardmäßig aus, Bewegung+Geräusch, keine Aufnahme | `smartWake.test.ts`, `SmartWakeModelTest` synthetisch; komplett geräteoffen, kein Schlafstadiennachweis |

### Etappen und nächster sicherer Schritt

| Etappe | Status / Gate |
|---|---|
| E00 Audit/Baseline/Delta | abgeschlossen; Nachweise oben und im Testprotokoll |
| E01 Wecker | sichere Delta-Umsetzung implementiert;340 Vitest-/29 Browser-/50 JUnit-Tests bestanden, Lint/Typecheck/Build bestanden. Details im Etappenergebnis und Testprotokoll. Geräte-Gate offen; keine neue Android-API-/Berechtigungsstrategie |
| E02 Erinnerungen/Druck | implementiert; aktuelle Nachweise und Hardwaregrenzen im E02-Ergebnis unten. NO-01–05/PR-01–03 im vorhandenen Modell integriert,74 geführte Gerätefälle insgesamt |
| E03 Zustände/Tasks/Recovery | implementiert und automatisch geprüft:499 Logik-/59 Browser-/73 Kotlinfälle, Release-APK rc.5/Code7; Remote-CI18 grün auf main5c898a8. Geführte G76–G85 ergänzt; echte Android-Prüfungen offen. Keine Freigabe aus einem Browsermock abgeleitet; Details unten |
| E04 Flexible Planung/Spiel | integriert und automatisch geprüft: atomare private Undo-Basis, echte Ist-Handlungen erhalten, freie Verlängerung/PC-Pause, Fokus→Heute anders, Tages-Coverage und Tagesdruck. Integrierter Stand550 Unit/29 gezielte Browserfälle; Windows/Server/Handy offen |
| E05 Arbeit | danach: Intervallkonflikte/Restprognose, Wochenprofil |
| E06 lokale Wege/Schlaf | danach: unklare Orte/Bedarf/Material, keine erfundenen Daten |
| E07 Wetter/Provider | externe Quellen und ggf. notwendige Entscheidung, offline Teilaufgaben möglich |
| E08 sensible Integrationen | nur nach gesonderter Freigabe, standardmäßig aus |
| E09 Gesamtregression | laufend Nachweise, am Ende vollständige Regression/Accessibility/Geräteprüfung |

Fehlende Hardware blockiert unabhängige sichere Offline-Arbeit nicht. E01 bleibt bis zu den echten Gerätetests **automatisch geprüft, Geräte-Gate offen**. Keine produktive Weckzuverlässigkeit behaupten. Aktuelle offizielle Android-/Leitlinien-/Providerseiten waren wegen Netzrichtlinie nicht abrufbar; Quellenprüfung als externe Voraussetzung führen, keine Umgehung/erfundene Recherche.

### E01 – Ergebnis der ersten sicheren Delta-Umsetzung (05.11.2026)

Bestehende Wecker-, Planer-, Zeit- und Datenmodelle wiederverwendet. Kein Schreiben durch andere Agenten, kein Push, Release oder APK. Alle ursprünglichen Quelldateien vorhanden; vorherige Abend-/Weckfenster- und Claude-Änderungen erhalten. Frühere Handyberichte bleiben historisch.

| Anforderung / Delta | Implementiert | Konkreter automatischer Nachweis | Android-Gerät |
|---|---|---|---|
| AL-01/AL-08, Q07/Q12: veraltete Signale | `AlarmMachine.firedScheduled` akzeptiert je Alarmart nur den aktuell gespeicherten positiven Termin; unbekannte Actions werden verworfen. Legacy ohne Action läuft durch Migration/Abgleich gespeicherter Termine | JUnit `alteOderFehlendeSignaleAendernKeineAktuelleAlarmart`, `aktuellerTerminKlingeltEinmalUndVerzoegertesDuplikatBleibtStill`, `nurExpliziteBekannteFireActionsSindWecksignale`; Controller/Receiver kompiliert | neue G60 offen; Android-Receiverzustellung selbst nicht per JUnit bewiesen |
| AL-02/AL-03, Q02/Q08: deaktiviertes fälliges Snooze | `reconcile` holt Snooze bei ausgeschaltetem Hauptwecker nicht nach; aktiviertes fälliges Snooze weiterhin genau einmal | reproduzierbarer Rotnachweis vor Fix; JUnit `abgeschalteterWeckerHoltAuchFaelligesSchlummernNichtNach`, `abgleichHoltFaelligesSchlummernEinmalNach` | G4/G10/G11/G61 offen für diesen Stand |
| AL-02, Q03/Q08: Boot und feste Absicherung | bestehende Planung erhalten; Boot-Nachholen und SmartWake-Fallback am produktiven Guard geprüft | JUnit `entsperrenNachGesperrtemStartBeendetNachgeholtenWeckerNicht`, `fixedScheduledBoundarySurvivesEarlyTimeoutAndBoot` | Folgetag, Direct Boot und G53–59 weiter offen |
| AL-07, Q09: ehrliche Diagnose | `alarmPlanningStatus` wird von Plattform und Diagnose geteilt, auch für Vorwecker. Ungenaues Scheduling, fehlender Exaktstatus und gemeldete Fehler sind kein Grün; keine Hörbarkeitszusage aus Token. Ursache eines ausgelassenen Termins bleibt unbekannt | `core/alarm.test.ts` „Ehrliche Weckerplanung“; native Brücke unverändert wiederverwendet | Rechtewechsel/Audio/Vollbild Q09–11 müssen am Gerät geprüft werden; requestbezogene native Quittierung bleibt eigenes Delta |
| Nutzerwunsch geführte Testseite / UX-03 | `/geraetetest`,63 bestehende/ergänzte G-Fälle, Anleitung, gezielte App-/Systemwege, bestehender separater Testalarm, Planvergleich, Rückkehrbanner. Nur bewusster Bericht, kein XP und keine Alarmregeländerung | `deviceTests.test.ts`, Store-Test ohne Planabgleich/XP,9 neue Browserfälle in `e2e/device-tests.spec.ts` | Teststart/Hauptzeitvergleich G1–3, AOD G47/48 neu prüfen; Seite G63 offen |
| IN-06, Q81/Q83: Berichte und Entwürfe erhalten | bestehendes `meta/local`, lokale Entwürfe beim Feldverlassen, JSON-Backup-Validierung, Export nur der Testberichte. Plattform, Datum, Appversion/Build, Teststand und Quellkennung; ältere Ergebnisse bleiben erhalten und zählen nicht als aktuell | alte Backups/fehlerhafte neue Felder/Roundtrip, Store-Schreibfehler, E2E Entwurf/Rückkehr/Export. Produktionskatalog enthält keine historischen Ergebniszellen | echte SQLite-/App-Update-Übernahme offen; Prozessabbruch mitten in unbestätigter Eingabe nicht abgesichert |
| Nutzerwunsch direkte Zeit-/Dauereingabe, UX-03/Q82 | `TimeStepper` verwendet vorhandenes `TimeField`; numerische `Stepper` direkt bearbeitbar. Nacht00:30 bleibt1470; manuelle Onboarding-/Settingszeiten geschützt. +/- bleiben | E2E direkte Eingabe/persistierte Nachtzuordnung/Neuberechnung/Onboarding/Leerwert/Grenzen/Dezimaldauer,320px bei160% Schrift | Android-Uhrzeit-/Tastaturbedienung G62 offen |

**Geräteführung:** aktueller Katalog G1–63 ist nicht die vollständige Umsetzung der84 Q-Szenarien. Weitere Q-Szenarien bleiben gemäß Delta-Matrix an ihren Etappen. Neue Prüfungen werden erst nach Nutzerbericht für konkreten Stand als Gerätebeobachtung geführt. Quellkennung ist keine APK-Prüfsumme und erfasst nicht jede native Ressource oder Buildumgebung.

**Bewusste Restgrenzen von E01:** offizielle aktuelle Android-Quellen und Geräteprüfung der bestehenden API-/Berechtigungsstrategie, native requestbezogene Planungsquittierung, alle neuen Hardwarefälle. Die Modellkorrekturen erlauben die nächste unabhängige E02-Arbeit, ersetzen aber keine Gerätefreigabe für produktives Wecken. Nächster Code-Schritt: veraltete Reminder-Actions reproduzieren und mit dem vorhandenen Relevanz-/Zustandsmodell absichern; keine zweite Task- oder Plan-Engine.

### Handy-Update vorbereiten (06.11.2026, Europe/Berlin)

Nutzer hat die App-JSON-Sicherung bestätigt und den öffentlichen Windows-Signierbericht geliefert: lokale Debugsignierung mit bestehendem `debug.keystore`, Alias `AndroidDebugKey`; Release-Konfiguration lokal leer. Der private Schlüssel wurde nicht angefordert oder übertragen. Das installierte Handy-Zertifikat ist damit noch nicht unabhängig ermittelt.

- Aktuellen Web-Build in die isolierte Android-Kopie synchronisiert; vollständiges `:app:assembleRelease` inklusive Release-Lint bestanden. Diese Buildvariante erzeugt hier ein **unsigniertes APK**, keine Veröffentlichung.
- Paket `de.frnkrm.anker`, Version `1.2.0-rc.1`, Code3; Quellkennung unverändert `2bb70a922b749bdd0c176c233d9380504275bb10e4535692b08e958644dcbabf`. ZIP-/ARM64-ELF-Ausrichtung für16-KB-Seiten geprüft.
- `scripts/sign-local-update.mjs` für lokale Signierung mit dem vorhandenen Schlüssel. Prüft Eingabe-SHA256, Paket/Version und den gemeldeten öffentlichen Zertifikatsfingerabdruck. Falls die alte lokale APK vorliegt, zusätzlicher Zertifikats-/Versionsvergleich; ein höherer alter Code stoppt den Vorgang. Kein Schlüssel wird angelegt, verändert oder hochgeladen; keine Installation.
- 7 echte kryptografische Integrationstests unter Linux bestanden: Erfolg mit/ohne alte APK, falscher Schlüssel, falsche Prüfsumme, höherer alter Versionscode, fehlender Schlüssel, falsches Paket. Dafür nur kurzlebige Testschlüssel verwendet und wieder entfernt. Windows-Ausführung und echte Installation weiterhin offen.
- Updatepaket `/workspace/artifacts/Anker-Update-E01-Windows.zip` enthält unsigniertes APK, einfachen CMD-Starter, Node-Helfer, Metadaten und kurze Anleitung. ZIP nach Erstellung entpackt/inhaltsgeprüft; keine privaten Schlüssel enthalten. Noch kein mit dem Nutzerschlüssel signiertes APK vorhanden.

**Nächster Nutzerschritt:** ZIP auf dem Windows-PC entpacken und `Update-signieren.cmd` starten. Danach nur die erzeugte `Anker-E01-Update.apk` über die vorhandene App installieren. Android prüft dabei zusätzlich die tatsächliche Updatekompatibilität. Bei Ablehnung App installiert lassen und Fehler auswerten. Anschließend zuerst Gerätefälle1–3. Nächste Code-Etappe bleibt E02; aktuelle Gerätefreigabe ist offen.

### Freigegebener Upload und Integration (06.11.2026)

Der Nutzer hat den öffentlichen Paket-Upload sowie Commit, Push und Merge aller bislang unpublizierten Appänderungen ausdrücklich freigegeben. Es wird kein Versionstag/GitHub-Release erzeugt. Der Paketbranch bleibt vom App-Hauptbranch getrennt.

- Paketbranch `download-anker-e01-20261106`, Commit `529d37590c14f4d1f26e53228a2a6481ab8a0b1d`, erfolgreich hochgeladen. Tatsächlicher öffentlicher HTTPS-Download: HTTP200,21699399Bytes, SHA256 `364d7d28537b747695e3ad8b73e2aa8539e6d4cad0c6f9d2b7f60ea7ca8446cd` vollständig nachgelesen.
- Download: `https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e01-20261106/Anker-Update-E01-Windows.zip`. Die früheren Cloud-Dateilinks sind kein bestätigter Übertragungsweg und werden für dieses Paket nicht weiter verwendet.
- Öffentliche technische v6-Fassung enthält weiterhin alle71 Anforderungs-IDs. Persönliche Gesundheits-/Lebensangaben wurden generalisiert; das unveränderte private Original ist exakt per `.gitignore` ausgenommen und lokal erhalten.
- Frisch vor Integration: Lint/Typecheck bestanden,340 Vitest-/29 Browser-/50 Kotlin-Tests bestanden,0 Fehler/0 übersprungene Kotlin-Tests. Bytegleichheit der16 eigenen nativen Quell-/Test-/Manifestdateien zur Buildkopie bestätigt. Logs: `/workspace/.cache/anker/merge-validation-20261106/`.
- Zwei lesende Abschlussreviews fanden keine blockierende neue Regression. Ein nicht blockierender Textfall bleibt dokumentiert: Beim bewusst ausgeschalteten Hauptwecker kann eine beendete SmartWake-Messung noch den allgemeinen Hinweis auf den festen Wecker anzeigen; die eigentliche Planung und Diagnose sind korrekt ausgeschaltet. Späteren Text verbessern, keine Hardwarefreigabe daraus ableiten.

Gerätetests, lokale Windows-Signierung und echte Installation sind weiterhin offen. Die öffentliche Integration des geprüften Codes ist keine Bestätigung produktiver Weckzuverlässigkeit.

**Git-Integration abgeschlossen:** Appstand in Commit `ab686481641eab085ad844cd82ae9d45eaa6cfb7` auf `entwicklung/anker-e01` gesichert, gepusht und per Fast-forward in `main` übernommen. Der Remote-Abgleich bestätigt denselben Commit auf beiden Branches. Der Paketbranch bleibt separat auf `529d37590c14f4d1f26e53228a2a6481ab8a0b1d`. Arbeitsbaum nach der Integration sauber, privates Original weiterhin lokal und ignoriert. GitHub-CI für den veröffentlichten Stand ist gestartet; lokale Abschlussnachweise stehen oben, ein Remote-Erfolg wird nur nach tatsächlich abgeschlossenem Lauf behauptet.

### Signierhilfe2 – SDK-Abhängigkeit entfernen (06.11.2026)

Nutzer meldete unter Windows „Android-Buildwerkzeuge nicht gefunden“. Der erste Helfer verlangte ein lokal auffindbares SDK, obwohl für die fertige APK nur Signatur und Metadatenprüfung benötigt werden. Der Fehler wurde mit der alten Hilfe bei absichtlich entfernten SDK-Variablen und ohne lokale SDK-Konfiguration reproduziert.

- Die neue Hilfe benötigt Node, Java17+ und den vorhandenen Debugschlüssel. SDK-Suche und natives `aapt` entfallen. Java wird in `JAVA_HOME`, PATH und üblichen Installationsorten gesucht; nicht lesbare optionale Herstellerordner blockieren die Suche nicht.
- Portable Bibliothek `com.android.tools.build:apksig:8.13.0` unverändert, mit enthaltener Apache-2.0-Lizenz und Herkunftsnachweis. Eigener dünner Java-Helfer aus `scripts/AnkerApkTool.java`, kompiliert mit `--release 17`; kein eigener AXML-Parser. JAR/Klasse werden zusätzlich per SHA256 geprüft.
- APK-Prüfsumme, Paket, Zertifikat vor privatem Schlüsselzugriff und signiertes Ergebnis bleiben geprüft. Versionscodes werden vollständig als BigInt verglichen. Normale APK-Signaturen v1/v2/v3 und16-KB-Ausrichtung geprüft; keine inkrementelle Installation/v4-Sidecardatei nötig.
- Repro plus10 neue echte kryptografische Integrationsfälle bestanden. Darunter Erfolg mit/ohne vorherige APK bei fehlendem SDK, falscher Schlüssel/Prüfsumme/Paket, höherer und sehr großer alter Versionscode, fehlender Schlüssel sowie beschädigte JAR/Klasse. Nur kurzlebige Testschlüssel, unverändert und anschließend entfernt; unabhängiges SDK-Werkzeug nur als Testorakel.
- `Anker-Update-E01-Portable.zip`:22172417Bytes, SHA256 `1b46d36d431ecd4c5275ca0eacf1cd30a2202a19c6c81b36a2172abc914bb307`. Die App-APK im Paket bleibt bytegleich (`850e0844…`), Quellkennung2bb70a… unverändert. Keine App-/Planer-/Datenmodelländerung.

Der separate Downloadbranch wurde auf `8f1457daffc72742ff1d15560fb4a080133a119e` aktualisiert. Die neue portable ZIP ist öffentlich abrufbar; auch der bisherige Windows-Dateiname verweist im aktuellen Branch auf dasselbe korrigierte Paket. Der neue Download wurde vollständig über HTTPS gelesen und gegen Größe und SHA256 geprüft (HTTP200, bytegleich).

Windows-Ausführung und echte Installation sind weiterhin offen. Nächster Nutzerschritt: neues Paket vollständig in einen eigenen Ordner entpacken und dort den CMD-Starter ausführen; alte Signierhilfe nicht weiter verwenden. Keine Schlüsselübertragung oder Deinstallation.

### Update und Datenerhalt vom Nutzer bestätigt (06.11.2026)

Nach Bereitstellung der SDK-freien Signierhilfe hat der Nutzer die erfolgreiche Aktualisierung auf seinem Handy gemeldet. Auf Nachfrage bestätigte er ausdrücklich, dass die bisherigen Routinen, Einstellungen und der Spielstand vorhanden sind. Dies ist ein echter Nutzerbericht zur Installation und sichtbaren Datenübernahme, kein hier ausgeführter Windows-/Android-Test. Versions-/Quellkennung am Gerät und Signierprotokoll wurden nicht ausgelesen.

Die Installation allein bestätigt weder die weitere Weckerplanung (G12) noch einen der Klingel-, Sensor- oder Testseitenfälle. Diese bleiben für den aktuellen Stand offen. Nächster gemeinsamer Schritt: **Mehr → Gemeinsam testen → Erster Weckertest → Separaten Test in 10 Sekunden starten**, zunächst bei entsperrtem Handy. Den beobachteten Ausgang bewusst auf der Testseite speichern. Die unabhängige Code-Etappe E02 bleibt der nächste Entwicklungsschritt.

---

## E01-Nachbesserung und Übergang zu E02 (06.11.2026)

Nutzerbericht: Nach Start über Benachrichtigung/Widget führt jeder Seitenwechsel zurück zu Jetzt; normaler Appstart erlaubt Navigation. Ursache am produktiven Router reproduziert: `useNavigate` wechselt seine Identität und der Bridge-Effekt liest dadurch den von Android beibehaltenen Startlink erneut. `useEffectEvent` hält die Navigation aktuell, während Startlink/Listener nur einmal je Mount eingerichtet werden. Neue native Einstiege und Klingelereignisse bleiben aktiv.

Zusätzliche Nutzerentscheidung: Während einer bewusst gestarteten Messnacht den Vorwecker ausschalten und informieren. Umsetzung als `preWakePausedForTargetAt` im bestehenden nativen Alarmzustand, ohne Änderung der gespeicherten Vorwecker-Einstellung. Erfolgreicher Vordergrund-/Timerstart bzw. erfolgreiche Sensor-/Mikrofoninitialisierung gehen der Pause voraus. Gleicher Haupttermin bleibt auch nach Stop/Boot pausiert; neuer Termin löscht die Ausnahme. Fester Hauptwecker und Bestätigungsregeln bleiben erhalten. Brücke, Diagnose und sichtbare Info vor/nach Start sind angepasst.

**Nachweise:** alter Code scheitert am echten Browser-Navigationsablauf; neuer Stand besteht340 Vitest-,33 Browser- und54 Kotlin-Tests, Lint/Typecheck/Produktionsbuild sowie vollständigen unsignierten Release-APK-Build. Browser simuliert native API-Werte, kein Android-Sensor-/Dienstnachweis. Neue G64/65 offen. Appversion für das nächste Update:1.2.0-rc.2, Code4; noch kein neues Paket ausgeliefert. Logs: `/workspace/.cache/anker/navigation-fix/`.

**E02 jetzt ausdrücklich vollständig beauftragt:** NO-01–05 und PR-01–03 im vorhandenen Modell vervollständigen; Testseite ergänzen, geprüften Stand in main pushen und automatischen PowerShell-Updateweg liefern. Erneuter Appstart über das Symbol ist nur der vom Nutzer bestätigte Zwischenweg, kein Ersatz für den Navigationsfix. E02-Prüfung erfolgt parallel ausschließlich lesend bzw. in getrennten Arbeitsbäumen; keine konkurrierenden Schreibzugriffe auf denselben Baum.

## E02 – integriertes Ergebnis (06.11.2026)

Ausdrücklicher Auftrag für die gesamte Etappe, main-Push und neues lokales Updatepaket. Basis nach E01-Nachbesserung: `8b08fd7`. Teilaufgaben wurden in getrennten Worktrees umgesetzt und im Hauptbaum integriert; keine zwei schreibenden Agenten im selben Baum. Bestehende Planer, Tasks, Routinen, QR-Werte und Daten bleiben maßgeblich. Keine neuen Abhängigkeiten, Provider oder Gebühren.

| Anforderungen | Umsetzung im vorhandenen Weg | Automatischer Nachweis / Gerätefall |
|---|---|---|
| NO-01, Q13/14: Relevanz/Lebensdauer/Priorität | `reminders/build` und `ReminderLogic`: generische Texte, aktuelle logische Revision, getrennte Queue/Slots, Ablauf-/Stale-Pruning; höhere Wichtigkeit bleibt | Policy-/Modelltests; G21/66/68 offen |
| NO-02, Q16/17: alte und doppelte Aktionen | getrennter Zustellungstoken, Tokenhash in PendingIntent-Identität; Slot/Revision/Quelle vor Wirkung prüfen; native Slots/Queue/Aktion gemeinsam committen. Ausgang lesen, nach atomarem Store-`putMany` per ID ACK. Receipts bewahren echte Zeiten/XP, fehlgeschlagene Transaktion bleibt ohne RAM-Erfolg erneut versuchbar | Schreibfehler/Retry, paralleler Drain/UI-Eingabe, alte Revision, Doppeltap, ACK-Reihenfolge, Dexie-Rollback; G66/67 offen |
| NO-03, Q15: gemeinsames Budget | Alarm und Mikrofon-Dienst reservieren Platz; normale Karten nach Rang auf3 minus geschützte Anzeigen reduzieren. Reservierung vor Foreground-Post; Pflichtanzeigen nie löschen, fremde Apps unberührt | Modelltest0–3 Reservierungen, Lifecycle-Review und SDK-Kompilierung; physisches Budget G70 offen |
| NO-04, Q18: Mehrtag ohne Nachholsturm | mindestens14 vollständige Plantage bis04:00, weitere bekannte Sondertage datiert; neutrale Wochenregeln aus kanonischem `buildDayPlan` als Snapshot. Kotlin rechnet nur nächste Berliner Vorkommnisse, genau ein zukünftiger Eintrag je Regel. Highwater/Tokenledger gegen Rückstau/Zeitrückstellung. Regelzahl/Gültigkeit ehrlich in Diagnose |7 TS-Regeltests,9 Kotlin-Regeltests, zukünftige Ausnahmen/Nacht/DST; G24/25/71 offen |
| NO-05, Q19: Ruhe/Freizeit/Fokus | zentrale Policy pro tatsächlicher Stufe, Snooze erneut geprüft. Wichtige Anker behalten ihre Ausnahme, gewöhnliche Hinweise respektieren Fokus-Timerende, Freizeit/Fahrt und Modus. Fokusspiegel endet beim Seitenaustritt, keine fingierte Erledigung | Policytests, Native-`allowed`, Browser-Fokusspiegel; G68/69 offen |
| PR-01, Q20: tatsächlich erreichbare Auswahl | bestehende `PrintSheet` für Morgen/Abend/beide/QR/Haustür, direkte Fokus-/Weckerlinks; Test-Rückweg außerhalb des Druckinhalts | Auswahl-/Persistenz-/Navigationsfälle; G74 offen |
| PR-02, Q22: Dialog und unabhängige PDF | Fonts/Bilder/QR-Bereitschaft statt150ms; dedizierter lokaler Android-Druck-WebView, eigener `PdfDocument` ohne Druckdienst, bestehender Share-Weg. Haupt-WebView erhalten. Fehler/Abbruch melden keinen Ausdruck/Versand | Native-API-/SDK-Build, Browser-Brückensimulation/Fallback; G73 offen |
| PR-03, Q21: Papierqualität | A5/A4, skalierte Schrift, Checkboxen, einzelne Schritte paginiert, lange Einzeltexte und gleiche Titel erhalten; QR unverändert mit4 Modulen Ruhezone | reine Kotlin-Paginierung, Browser-PDF90 Schritte bei160%: A5 21/A4 9Seiten, alle Texte und kein Overlay; Papier-Scan G72/74 offen |

Der native Snapshot-Abgleich wird serialisiert und fasst schnelle Änderungen zusammen, damit ein älterer Plan keinen neueren überschreibt. Zusätzliche transaktionale Repository-Methode ist die kleinste Integration für Wirkung/Receipt/XP, kein zweites Datenmodell. Die übrige globale Effekt-Sequenzierung bleibt E03.

**Statusgrenzen:** implementiert und im dokumentierten automatischen Umfang geprüft. Android-SQLite-Transaktion, Receiver/PendingIntent-Zustellung, sichtbare Anzahl, Mikrofonstart, nativer Druck/PDF und Papier-QR bleiben auf dem Galaxy offen. Offizielle Android-Dokumentationsseiten waren durch die Netzrichtlinie gesperrt; keine aktuelle Webprüfung behauptet, vorhandene SDK36-APIs und tatsächliche Kompilierung genutzt. Neue Regeln kennen Änderungen erst nach erneutem App-Abgleich; keine unbekannten Termine, Live-Anpassungen oder Schlafphasen erfinden. Nächste Entwicklungsetappe E03.

**Übergabe:** Appänderungen in Quellcommit `f272c514772a32c4529b92088467851e7f940668` auf main integriert. E02-Paket separat auf `download-anker-e02-20261106`, Commit `bbbd844737c71f827095c8ba9cd1058d93d647d8`; kein Merge der Binärdatei in den Appbaum, kein Tag/Store-Release. Öffentlicher Download vollständig nachgelesen: HTTP200,21972987Bytes, SHA256 `5e754fa1de871ad8077a2925dd36e46b1cf3623f86e786420069afeec6cf22b5` stimmt. URL: `https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e02-20261106/Anker-Update-E02.zip`.

Nächster Nutzerschritt: Download prüfen, entpacken und lokal mit dem vorhandenen Schlüssel signieren; die erzeugte `Anker-E02-Update.apk` über die bestehende App installieren. Danach zuerst Daten und G64 prüfen, dann **Gemeinsam testen → Erinnerungen & Druck prüfen**. Neue Gerätebeobachtungen erst nach tatsächlichem Bericht eintragen. Die private Auftragskopie ist weiterhin bytegleich und ignoriert.

**CI-Nachprüfung,06.11.2026, abgeschlossen:** Remote-Lauf13 scheiterte im kombinierten Playwright-Schritt; bereits Läufe7–12 zeigten dieselbe Grenze vor E02. Diagnose getrennt und öffentliche Fehlerannotation/-berichte ergänzt. Nachlauf14 liefert den konkreten Rotnachweis:33/39 bestanden, fünf voreilige Hard-Navigationen vor abgeschlossener Speicherung und ein Drucküberschriften-Überlauf. Speicherbedingungen in den Tests ergänzt (lokal5/5), Überschriften in der Druckansicht umbrechbar gemacht (Altcode bei320px rot, danach4/4 Druckfälle inklusive PDFs grün). Keine Erwartungen abgeschwächt oder Timeouts erhöht. **[Remote-Lauf15](https://github.com/frnkrm/anker/actions/runs/42152225401) auf main `e6e254b` vollständig erfolgreich,39/39 Browsertests und sämtliche übrigen Checks grün.** Details im Abschnitt „CI-Untersuchung nach E02“ der [Testnachweise](ANKER_TESTNACHWEISE.md). Ausgelieferte APK/Nutzerdaten unverändert; Web-Druckumbruch folgt im nächsten Appbuild, echte Android-Tests bleiben offen. Nächste Produktetappe bleibt E03.

## Aktuelle Nachbesserung: Android-Systemleisten (06.11.2026)

Nutzer bestätigt Überlagerung durch Uhr-/Akku-Leiste. `viewport-fit=contain` und synchroner SystemBars-Hinweis nutzen den bereits vorhandenen nativen Capacitor-Abstand für die gesamte App, einschließlich Testbegleitung und Fokus. Kein eigenes Insets-Modell, keine festen Pixelwerte, bestehende Tastaturbehandlung bleibt erhalten. Appversion1.2.0-rc.3/Code5; G75 ergänzt,75 geführte Fälle insgesamt. Implementiert;376 Logiktests, Lint/Typecheck/Build und **[CI16](https://github.com/frnkrm/anker/actions/runs/42191095861) mit40 Browserfällen vollständig grün**. Unsig­niertes APK erfolgreich gebaut; Paketversion, eingebettete Konfiguration und Webassets geprüft. Neues portables `Anker-Systemleisten-Update.zip` auf getrenntem Downloadbranch bereitgestellt und HTTPS-Download vollständig gegen SHA256 geprüft. Details im Abschnitt „Android-Systemleisten“ der [Testnachweise](ANKER_TESTNACHWEISE.md).

**Geräterückmeldung06.11.2026:** Nutzer bestätigt **„oben frei“** nach der Bitte zum ersten Sichttest auf Jetzt. Der gemeldete obere Überlagerungsfehler ist damit am Galaxy nicht mehr sichtbar; G75 bleibt als Teilprüfung geführt. Fokus, Tastatur, Rotation, Kameraaussparung und untere Systemnavigation sind nicht bestätigt. Installierte Buildkennung und Windows-Ausführung wurden nicht unabhängig ausgelesen. Der Bericht erfordert kein weiteres Update und ändert keine lokalen App-Häkchen oder Nutzerdaten. Nächste Produktetappe bleibt E03.

## E03 – initial umgesetzt und lokal automatisch geprüft (06.11.2026)

Ausdrückliche Freigabe „du kannst gerne schon mal mit E03 beginnen“. Startstand `34f8a87`, sauberer Hauptbaum; Entwicklungsbranch `entwicklung/anker-e03`. Quellsnapshot `/workspace/.cache/anker/e03/baseline-source.tar.gz`, SHA256 `8543d35dfe82701a5d493aad4676f0b6fb335d35092da8fdd4854c3e626f75a8`. Baseline376 Logik-/40 Browserfälle, App rc.3/Code5. Hauptagent schrieb allein im Integrationsbaum; Teilagenten ausschließlich in getrennten Worktrees. Bestehende Datenmodelle und Claude-Änderungen wiederverwendet, privates Original unverändert und ausgeschlossen.

| IDs | Implementiertes Delta im vorhandenen Modell | Konkrete automatische Nachweise / Grenze |
|---|---|---|
| TA-01/03,03.3 | Optionale gemeinsame TaskFields an InboxItem/WorkTask; ehrliche Zustände, stabile Unteraufgaben-/Wiederholungs-IDs. Gemeinsamer Abschluss/Undo. Inbox→Arbeit inklusive neutralem Tombstone atomar; Importkonflikt bewahrt beide Fassungen | `tasks.test.ts` (Core/Store), `tasks-ui.spec.ts`, `tasks.spec.ts`: Morgen→Tagesplan/Jetzt→gemeinsamer Abschluss/Undo, Transfer/Transaktionsfehler/Importkonflikt |
| TA-02 | Lokaler Capture-Entwurf mit tatsächlichem Fokuskontext, Pending-Guard und explizitem Notizspeichern. Berufliche Metadaten nur allgemein im synchronisierbaren Inboxrecord | `tasks.spec.ts`: Entwurf→Reload→Speichern→derselbe Schritt/Timer, Workkontext-Privacy. Vorhandener Widget-Capture bleibt; weitere Android-Launcher-Shortcuts bewusst später bei E08, keine zweite Startebene |
| TA-04 | Eine gemeinsame nextAction für aktive Priorität, passende Dauer, verfügbares Fenster, Fristen, frühesten Start, Kontext/Energie und Erholung. Widget verwendet dieselbe Auswahl mit neutraler Projektion | `taskSelection.test.ts`, `support.test.ts`, `widgetPrivacy.test.ts`, `tasks.spec.ts`; künftige Umschaltpunkte mitgeplant. Keine Standortmessung |
| TA-05/06 | Lokale Zerlegung mit Vorschau/Detailtiefe und erhaltenen echten Teilen; Fokus15/25/40/50, nächste Schritte und Notizen je Aufgabe. Fokus und Arbeitszeit getrennt | `tasks-ui.spec.ts`, `tasks.spec.ts`, Storefälle A→B→A, Undo, doppelte Wiederholung. Bestehende Arbeitsübergabe/Vorlagen bleiben; keine externen Nachrichten |
| TA-07/08 | Kein8h-Verfall, referenztreuer Wiedereinstieg, unabhängige persistente Fokus-/Hilfetimer. Starthilfe erst auf Start, Deadline/Pause, neutrale Zeitüberschreitung, geschützte deduplizierte Pulse | `focus.test.ts`, `recovery.test.ts`, sieben `recovery.spec.ts`-Fälle einschließlich alter Timerübernahme und verspäteter Brückenantwort. Prozessbeendigung/Sperren/Pulse am echten Handy offen |
| TA-09 | Freiwillige lokale, bestätigte Dauerproben; robuster Median als ausdrücklich anzuwendender Vorschlag, Aus/Reset und Undo ohne doppelte Proben | Core-/Store-/Lern-UI-Tests. Bestehende Ankommen-/Routinenverknüpfungen und kleine Tagesmodi wiederverwendet; keine zusätzliche allgemeine Regelengine, KI oder Sprachübertragung |
|03.4/IN-06 | Atomare Task-/Fokus-/Receiptaktionen vor RAM-Erfolg; serialisierter gemeinsamer lokaler/native Abgleich, langsame Extras getrennt, direkte Alarm-/Widgetaufrufe abgesichert. Import/Sync-Merge aktualisiert RAM vor nächster Bearbeitung; SQLite-Batches transaktional | Coalesced-/Effects-/Alarm-/Health-Tests, SQLite-/Repositorytests, zusätzliche Store-Regressionen: verspätete Antwort, Rollback, Import+Bearbeitung, Doppelbelohnung, native Wiederholung und alte Deadline-Aktion nach Undo |
| UX-01/02/03 | Bestehende Gedanken/Arbeit/Tag statt zusätzlicher Hauptnavigation. Aufgaben Start/Erledigt/Details; seltene Angaben darunter. Private Später-Aktion unter Plan & Optionen, „Ich bin abgedriftet“ als kurzer Rettungsweg | Browserprüfung Interaktionsbudget und320px/160%-Schrift; Capture/Recovery ohne Pflichtreflexion. Weitere Onboarding-/Personalisierungswünsche gehören zu späteren Etappen |
| Q34 / nötige FL-08-Voraussetzung | Automatischer Kapitelverlust bei Nichtnutzung entfernt; nur echte Erfolgstage zählen. Bestehende Versuche/Joker/XP/Abzeichen erhalten, keine erfundene Rückgewinnung |2 reale Nichtnutzungsfälle vorher rot;30 Spieleinheiten grün, Altbackup-Offlinefluss nach3 Tagen ohne Verlust. Weitere E04-Planungs-/Freizeitfunktionen nicht vorgezogen |

**Automatisches Gate:** Lint/Typecheck/Produktionsbuild erfolgreich;499 Vitest-Tests/40 Dateien und58 Playwright-Fälle vollständig grün, keine Skips. Frischer Produktionsbuild, eigener Port4195, System-Chromium155. Android-Release mit aktivem Lint gebaut und73 Kotlin-Tests in6 Suiten tatsächlich neu ausgeführt, keine Fehler/Skips. Testseite85 Fälle, darunter zehn neue geführte E03-Prüfwege G76–G85. Links ändern keine Einstellungen oder Tasks und starten keine Timer; Berichte nur nach bewusster Rückmeldung.

**Update:** App1.2.0-rc.4/Code6; Quellkennung `e4541ce7f2587af4796541c6da5d81396a5542819106b79ff75759ec8a37bb2e`. SDK-freie Signierhilfe unverändert, kein Nutzerschlüssel verwendet. Paket- und Prüfdetails im E03-Abschnitt der [Testnachweise](ANKER_TESTNACHWEISE.md).

**Statusgrenzen:** E03 implementiert und automatisch getestet; noch keine neue echte Android-Prüfung. G75 hat weiterhin ausschließlich die frühere obere Anzeige bestätigt. Fokus-Resume nach echter Prozessbeendigung, Hardwarepulse, native SQLite-Laufzeit, Widgets und sämtliche G76–G85 bleiben am Galaxy offen. Keine KI oder produktiven externen Dienste aktiviert; kein Release/Tag. Main-Übernahme und GitHub-CI werden nach Durchführung unten mit tatsächlichen IDs ergänzt. Nächste Produktetappe ist E04, hier nicht begonnen.

### E03-Nachbesserung nach Remote-CI17

Main `5e46b17` und initiales Update rc.4/Code6: lokal499/58/73 grün, aber [GitHub-CI17](https://github.com/frnkrm/anker/actions/runs/42254106105)57/58 rot. Ausschließlich der verspätete native Puls schlug fehl: URL bereits verlassen, React-Komponente vor dem Unmount noch aktiv. Keine Erwartungen abgeschwächt. Neuer deterministischer Plattformtest hält diesen Übergang fest und liefert am Altcode reproduzierbar1 statt0 Pulse. `useFocusPulse` bindet jetzt den gerenderten Routerpfad und vergleicht die Browseradresse vor und nach asynchronen Aufrufen. Session-/Off-/Alarm-/Sichtbarkeits-/Restzeitprüfungen bleiben.

**Abschluss rc.5/Code7:** Lint/Typecheck/499 Logikfälle, alle8 Recovery-Browserfälle und der vollständige frische59-Fälle-Lauf grün (2,6min,0 Skips/Flaky). Android-Release mit aktivem Lint und73 erneut ausgeführten Kotlinfällen grün. [Remote-CI18](https://github.com/frnkrm/anker/actions/runs/42255441031) für exakt `5c898a8448cca1bbfb030eff74ed3dd3a4fcf667` vollständig erfolgreich,59 Browserfälle/1,7min. Beide Codeetappen nach main übernommen und Remote-Refs geprüft; Abschlussdokumentation separat mit `[skip ci]`, unveränderte Appquellen.

Aktuelles [Update-ZIP](https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e03-rc5-20261106/Anker-E03-Update.zip) auf getrenntem Downloadbranch `download-anker-e03-rc5-20261106`, Commit `736f2a7`. HTTPS200 vollständig erneut gelesen,21996214Bytes, SHA256 `8903450c1bf9a98d4e9d3e71c6ba3b24cb486274db1c2dc49f7564bdfa7ec5de`. Quellkennung `3b102c5d15afe9e4950e565697e811edb2d0e0bd9a8f832aacfb927b4d370a5b`. SDK-freie lokale Signierhilfe unverändert; keine Nutzerkeys/Windows-Signierung/Installation/Hardwaretests. Die initiale rc.4-Datei und ihre Nachweise bleiben als Verlauf erhalten, aktuelles Paket ist rc.5. Nächster kleiner Nutzerweg: signiertes Update installieren, Mehr→Gemeinsam testen→Aufgaben & Wiedereinstieg prüfen→G76. Keine Pflicht, alle85 Tests abzuarbeiten. E04 nicht begonnen.

## E04–E09 – Softwareentwicklung abgeschlossen, Geräteprüfung offen (06.11.2026)

Nutzerauftrag: alle verbleibenden Etappen entwickeln; echte Handytests ausdrücklich erst gemeinsam am Schluss. Vorhandene Commit-/Main-/Downloadfreigabe bleibt, keine Releases/Tags, kostenpflichtigen Aktivierungen oder externen Nachrichten. Neue sensible Funktionen werden entwickelt, aber erst auf ausdrückliche Einwilligung des jeweiligen App-Nutzers aktiv. Kein vorweggenommenes Geräte-Gate.

Baseline `59c530f8f012587d6d1533ad26227342dc60d875`, sauberer Hauptbaum, App rc.5/Code7. Archiv `/workspace/.cache/anker/e04-e09/baseline-source.tar.gz`, SHA256 `d7128621da7409121db12f1a201ace244b661e549499432008da29e8553e2b9a`,339 Einträge nach Entpackung gelesen. Frisch499 Logiktests/40 Dateien sowie Lint/Typecheck grün; letzte vollständige Browser-/Kotlin-/Remote-CI-Nachweise bleiben59/73/CI18. Privates Original vollständig gelesen und ausgeschlossen; bestehende Modelle/Claude-Änderungen erhalten. Hauptagent allein im Integrationsbaum `entwicklung/anker-e04-e09`; Teilagenten schreiben ausschließlich in sechs getrennten Worktrees. Integration/Gates in E04→E09-Reihenfolge, spätere unabhängige Vorarbeit parallel.

| Etappe | Tatsächliches noch offenes Delta | Integration / Nachweisziel |
|---|---|---|
| E04 FL/IN-02 | Undo sagt bislang auch alte Termine ab; zwei Transaktionen. Einmaliges15min-Limit, offenes Ende als falscher PC-Termin, unbestätigte Empfangsbehauptung. Fokus ohne Heute anders; Coverage-Override und Tagesdruck fehlen | atomare private Undo-Baseline, freie Verlängerung/PC-Pause, drei Hauptwege+Details, Vorabendquelle/Tagesoverride, gemeinsame Tagesinstanz-Druckdaten, passive Feieranzeige. Kapitelverlust seitE03 bereits beseitigt |
| E05 WO | Prognose kann Restarbeit ab vergangenem Wunschbeginn rechnen; widersprüchliche Nachträge still normalisiert, Undo kann spätere echte Arbeit löschen. Offene Pause/unbestätigte Langzeittimer, Tagesgrenze/Endwunsch und alte Korrekturen unvollständig | vorhandenes Intervallmodell validieren, atomare Korrektur/CAS-Undo, verlässliche Restprognose/Konflikte, optionales Wochenprofil erweitern, Datumsauswahl |
| E06 TR/SL | unklarer Ort wird als remote behandelt; früher Remote-/Kalendertermin und Kundenprep fehlen im Morgenbedarf, Ursprung/Rückweg falsch, Wecktoast vor nativer Bestätigung | offene Ortszustände, lokale Orte/Termindetails, richtige Kette, gemeinsamer rückwärts gerechneter Bedarf, explizit bestätigte native Übernahme |
| E07 WX/TR-Provider | fehlende Werte als0; alter Forecast unter neuer Stadt, späte Antworten, fehlendes Cachealter. Packvorlagen/Vorbereitetzustand fehlen. Wetterort in Syncsettings | validierte lokale Standortprofile/Ortswechselguards, echte Stundenfenster, lokale wiederverwendete Packitems. Vollständiger optionaler Verkehrsadapter mit geschütztem Backend und manueller Alternative; keine Provideraktivierung/Schlüssel im Client |
| E08 IN/optionale Extras | lokale Sprache, Geofencevorschläge und Launcherwege fehlen; Widgetsnapshot läuft nicht ab. Google fordert Schreibscope zu früh, unvollständige Seiten/HTTPfehler/Aktualität | bewusste lokale ASR/TTS, besuchsgebundene Ortvorschläge ohne Arbeitsbuchung, Widget-TTL/Schnellzugriffe, ehrliche Systemwege, Google-Lese-/Schreibwahl und Fehlerzustand. Vollständiger optionaler KI-Adapter mit editierbarer Vorschau; echte Verbindung ohne Konfiguration separat offen |
| E09 Qualität/UX/IN-06 | beschädigte Sicherung kann teilweise importieren, Speicherinitfehler wird still RAM. Export sensible Gruppen, Tastatur/Touch/Kontrast/ReducedMotion, Zielgrund/Erprobung unvollständig | kompatible Vorabvalidierung/Importvorschau, sichtbarer Speicherfehler+Retry, Datenschutzprojektion, A11y, höchstens drei lokale Lernpunkte, gemeinsame Regression und maximal zehn geführte Gerätestationen |

Vor UI-Arbeit mitgeteilt: Heute anders auch im Routinefokus; seltene Wege unter Weitere Möglichkeiten. Arbeitsdetails bleiben Arbeit & Gleitzeit, Wetter-/Packdetails Vorbereitung, keine neue Hauptnavigation pro Feature. Alle Geräteberichte bleiben erhalten; keine automatische Erledigung oder Testhäkchen. Alle Etappen sind jetzt integriert; neue Abschlusskorrekturen erhalten eigene Regressionen vor dem gemeinsamen finalen Gate.

### E04 – integriertes Ergebnis

Integrierte Codecommits `7603162` (PC-Protokoll), `5710282`/`96837ad` (atomare Tagesrücknahme und Ist-Erhalt), `7213062` (Bedienung/Tagesdruck); kleiner gemeinsamer Weckbestätigungsvertrag `311783c` als notwendige sichere Voraussetzung aus E06. Unabhängige Vorarbeit `af29472` (Zielgrund) und `6edb46d` (geschlossene Providerbasis) ebenfalls enthalten, keine reale Anbieteraktivierung.

**Implementiert:** nur zum Tages-Undo gehörende private Baseline in meta/local, gemeinsam mit Tageslog transaktional; vorhandene Termine und echte Fahrt/Ankunft/Arbeit/Stepabschlüsse erhalten. Wiederholte freie +30/+60/Uhrzeit/offene Abende, neue PC-Aufträge scheduled/paused mit stabiler Revision und Berliner Plantag. Kein03:59-Scheinauftrag/kein behaupteter PC-Empfang; Windows-Paket2 bewahrt heutige Pause offline, setzt alte Cache-Uhrzeit nicht auf neue Tage und bietet datumsgebundenen Abbruch ohneZwang. Neue Windows-/Serverversion für den Protokollweg nötig; kein Deployment ausgeführt. Heute anders auch im Fokus, drei Hauptwege und übrige Details; Öffnen erledigt nichts, Anwenden pausiert passend. Quellen der Vorabendabdeckung sichtbar und nur für heute übersteuerbar. Tagesinstanzdruck verwendet denselben Plan/Log, Vorlage bleibt wählbar. Rückfrage später erfindet keine Rückkehr. Spielrückmeldungen passiv statt blockierend; Nichtnutzungsverlust seitE03 bereits entfernt.

**Automatisch geprüft:**550 Vitest/47 Dateien, Lint/Typecheck grün im Integrationsbaum. Frischer Produktionsbrowser auf4213/System-Chromium155:29/29,0 Skips/Flaky (1,3min), darunter alle8 neuen E04-Fälle, neue Zielnotiz und bestehende Abend-/Druck-/Native-Navigations-/Recoveryregressionen. Rotnachweise:4 ursprüngliche Undo-Risiken,1 später bestätigter Schritt,3 PC-Publishfehler. Logs `e04-e09/e04-integrated-*` und `e04-browser*`; unabhängige E04-Belege unter `e04/`.

**Offen:** tatsächlicher Windows2-Scriptlauf/Systemaufgabe, Serverfunktionsversion2, PC-Empfang und alle neuen Android-Gerätetests. Keine Tests vom Nutzer verlangt. Nächster Integrationsschritt E05; Codes in getrennten Worktrees bleiben Vorarbeit bis Übernahme/Prüfung.

### E05 – integrierte Arbeitszeit und sichere Korrekturen

Code `82450dc`/`b41f6c6`/`f877be2`: bestehendes Intervallmodell und Wochenprofil erweitert, kein zweites Zeiterfassungsmodell. Laufende Pause zeigt eine untere Grenze oder ausdrücklich gewählte Endschätzung; Restarbeit beginnt nicht in der Vergangenheit. Widersprüchliche Nachträge werden sichtbar abgelehnt. Korrektur und Rücknahme sind atomar; eine spätere echte Buchung macht eine alte Rücknahme ungültig. Tagesabhängige Startgrenze und Feierabendwunsch bleiben optional, vorhandene Sollzeiten/Freitagwerte unverändert. Historische Tage und Nachtschichten sind ausdrücklich auswählbar, Endkorrekturen behalten den tatsächlichen Folgetag. Lange offene Abschnitte verlangen ein bestätigtes tatsächliches Ende. Einsatzänderung und Tagesplan verwenden dieselbe Rücknahme.

Frischer integrierter Stand:572 Vitest/49 Dateien, Lint/Typecheck grün (`e04-e09/e05-integrated-*`). Frischer Produktionsbrowser:19/19 E05-/bestehende Smoke-Fälle grün (`e05-browser.log`); der zusätzliche gefundene Nachtschicht-Kontextfehler nach04:00 wird vor dem Gesamtabschluss ebenfalls integriert und gezielt geprüft. Echte Arbeitszeitbedienung auf dem Galaxy bleibt wie beauftragt offen. Nächste Integration E06.

### E06 – integrierte lokale Orte, Wege und Morgenbedarf

Code `3313fe5` bis `5bdd3cf` plus bestätigter Weckvertrag ausE04. Lokale Orte besitzen getrennte Zweckfreigaben, unbekannt/Remote/Zuhause/vorOrt sind ausdrücklich verschieden. Tatsächliche Ortsfolgen berücksichtigen bestätigte Rückkehr und direkte Weiterfahrt; unbekannte Dauer bleibt offen. Harte Kalender-/Kundentermine einschließlich Remote und früher Termine gehen in denselben rückwärts gerechneten Morgenbedarf ein; Zusatzvorbereitung wird nur auf ausdrückliche Wahl als bereits enthalten behandelt. Kein zweiter Planer. Gemeinsame Termin-/Einsatzfelder, explizite Kalenderquellverknüpfung gegen Dubletten, Maps bleibt manuell. Jetzt-Aktionen markieren Ist-Zeiten atomar anhand der aktuellen Instanz. Weckvorschläge werden nur bewusst übernommen; Android-Erfolg erst nach nativer Bestätigung und mit geschützter Rücknahme bei Fehlern.

**Automatisch geprüft:**603 Vitest/52 Dateien, Lint/Typecheck,6/6 frische Produktionsbrowserfälle (4 Orte/Termine/Morgen/Maps plus2 Nachtschichten;35,3s,0Skip). `e04-e09/e06-*`. Zusätzlich PC-Nachbesserung `9683370`: echte fünf Minuten Schonfrist nach tatsächlicher Warnung, strikte ISO-Stempel, Pause/Legacy/Uhrrücksprung geprüft.19/19 isolierte PowerShell7.5.4-Fälle und4 Exportparser grün (`pc-proof-approved.log`); CI erhält eigenen verpflichtenden `test:pc`-Schritt. Das ist Linux-Scriptlogik mit simulierten Systemaktionen, keine Windows-/Abschaltbestätigung. Alle neuen Android-Geräteabläufe bleiben offen. Nächste Integration E07.

### E07 – Wetter, Packlisten und optionaler Verkehr integriert

`6c7e5df`/`fc5d02b`/`54b3063`: Wetterwerte vollständig prüfen, fehlend bleibt unbekannt, alter Ort und spät eintreffende Antwort werden nicht unter neuem Ort angezeigt. Stundenfenster richten sich nach konkretem Außenweg; Anbieter/Alter/Offlinecache bleiben sichtbar. Wetteraktivierung/Koordinaten liegen im lokalen Profil, Syncprojektion bereinigt den alten Settings-Ort in beide Richtungen. Abschließender zentraler Altbackup-/Load-Migrationsanschluss wird zusätzlich geprüft. Kundenorte verlassen das Gerät erst nach eigener Zweckfreigabe. Vorlagen für Kundenbesuch/Sport/Ausgehen und eigene Dinge nutzen dieselbe lokale Termininstanz; vorbereitet ist kein Routine-/Arbeitsabschluss. Offizielle Forecast-/Geocodingherkunft und unterschiedliche Lizenzen werden getrennt ausgewiesen.

Frisch6/6 Produktionsbrowserfälle inklusive320px/160%Schrift, Stadtwechsel/fehlendeWerte/Offline/Pack-Roundtrip (`e07-browser.log`,36,2s); Logiklauf629 Tests/55Dateien grün (`e07-unit.log`). Während dieses Zwischenlaufs wurden zwei unabhängige Assistance-Commits früh übernommen; deshalb zählt dies als Zwischenbeleg, der gesamte endgültige Stand wird erneut frisch geprüft. Providerbasis ist geschlossen/default-off, vollständiger Trafficadapter samt Vorschau und Revisionsschutz folgt vor E08-Abschluss. Tatsächliche Kosten-/Kontoeinrichtung bleibt bewusst offen. Keine neuen Handytests.

### E08 – optionale Funktionen integriert

Gemeinsame Anbieterbasis und KI-Eingabe `3617c1e`/`d304af1`, Verkehrsadapter `f5a3b80`/`c2d8afe`, Extras-/Google-/Native-/Geofencecode `74f3508` bis `eba0d7f`. Neue Vorschläge befinden sich in vorhandenen Aufgaben-/Termindetails, getrennte Freigaben unter Einstellungen → Optionale Vorschläge, keine neue Hauptnavigation. Lokales Diktieren startet nur bewusst und bleibt Entwurf; Vorlesen ist unabhängig optional. Android-On-Device-Erkennung ohne Cloudfallback, Mikrofon-/Sprachausgabe stoppt vor Aktivitäts-Weckmessung. Standorthinweise sind an konkreten Besuch/Ort/Koordinaten gebunden, verlangen separate Rechte, speichern niemals selbst Ankunft/Arbeit/Medikation. Jetzt zeigt optionalen Vorschlag; Tag bietet dieselbe bewusste Bestätigung. Widgetsnapshot läuft ab, Schnellzugriffe nutzen bestehende Capture-/Fokus-/Recoverywege. Google zunächst lesen, Schreibfreigabe separat; Pagination/Abbruch/Fehler/Aktualität ehrlich. Private automatische OS-Sicherungen/Transfers ausgeschlossen; manuelle Sicherung bleibt verfügbar, bestehende Cloudkopien werden dadurch nicht entfernt.

**Zwischengate:**689 Vitest/65Dateien, Lint/Typecheck grün;18/18 frische Produktionsbrowserflows für Sprache/Schnellzugriffe/Geofences/KI/Verkehr,0Skip (`e08-*`,1,1min). Nativeowner bestätigt87/87JUnit und echten Kotlincompile, der finale Root-APK-Build folgt nach E09. Browserbrücken und Anbieter sind kontrolliert simuliert; kein Gerät/echter Anbieter. Ein zusätzlicher Review hat Abbruch-/Payload- und Widerrufs-/Sync-Ränder reproduziert; diese werden vor dem endgültigen Gate behoben. Externe Schlüssel/Konten/Kosten-/Bedingungsfreigabe und alle Hardwaretests bleiben offen, sensible Dienste standardmäßig aus. Nächster Integrationsschritt E09.

### E09 – integrierte Datensicherheit, Bedienung und gemeinsame Tests

`167f2c6`/`d083e64`/`38ff7e5`/`78e6a1d`/`cbcb1fb`: Backupbatch vollständig vor Persistenz prüfen, Import mit Vorschau und bewusster Bestätigung. Fehlende Objektfelder aus Teilsicherungen bleiben erhalten; Import wird innerhalb der Storequeue gegen frische Daten vorbereitet. Sensible Exportgruppen wählbar, JSON ist eine unverschlüsselte manuelle Sicherung. Speicherinitialisierung meldet Fehler sichtbar und bietet Retry, kein stiller flüchtiger RAM-Ersatz. Ein echter Wecker bleibt bei Speicherfehler über eigenen Notfallweg erreichbar, keine fingierte Einnahme. Tastatur/Touch/Vorlesehilfe/Kontrast/reduzierte Bewegung verbessert. Eigener Aufgabengrund bleibt freiwillig.7-/14Tage-Probe zeigt höchstens drei lokale Lernpunkte, keine Nutzungsstrafe.

**Zwischengate:**725 Vitest/71Dateien, Lint/Typecheck;27/27 frische Produktionsbrowserfälle für Sicherung/Storage/A11y/Testbegleitung,0Skip (`e09-*`,1,4min). Testseite beginnt mit zehn Stationen G86–95 statt95 Pflichtfällen; bestehende Detailfälle und frühere Berichte bleiben erhalten. Jede Station hat direkte sichere Zielwege, Öffnen erzeugt weder Alltagshandlung noch Erfolgshäkchen. Weitere Abschlussreviewkorrekturen und Q84 laufen noch; finale Zahlen/CI/APK werden erst nach tatsächlichem Abschluss eingetragen. Sämtliche neuen Android-Gerätefälle sind offen.

### Gemeinsamer Abschlussreview – umgesetzte Regressionen

Nach der Etappenintegration wurden konkrete Fehler mit roten Regressionen belegt und behoben: tatsächliche PC-Schonfrist/strikte Zeitstempel; laufende Nachtschicht über04:00; Großschrift-Tageslinie; verspätete Anbieterantwort und unnötige Payloadfelder; synchroner KI-/Verkehrswiderruf; Syncfreigabe einschließlich wartender Storequeue und privater Settings/Arbeitsgedanken; Teilsicherung ohne Arbeitskopien; atomare Alt-Wettermigration und Importprojektion vor Commit; feste Termine im Krankmodus; knappe Büro-/Heim-/Anschlusswege; korrekter nächster Kalender-Morgen und Sommer-/Winterzeit-Schlafgelegenheit; wahrer Kopiererfolg; allgemeine Remote-Widgetbezeichnung. UX-05 ergänzt die ausdrücklich gewünschte lokale Kontaktwahl mit einmaliger freiwilliger Rückfrage, ohne Versandbehauptung. Alle Änderungen nutzen bestehende Plan-/Store-/Backupwege.

Frischer integrierter Crossflow:15/15 Browserfälle,0Skip,59,1s (`cross-review-browser.log`):3Homeoffice,3Q84,6Plan-/Copy-/DST,3Sync. Zusätzlich30 relevante Unit-/Import-/Consenttests und Typecheck grün. Alle beschriebenen Sync-/Persistenz-/PC-Ränder sind mit zusätzlichen Regressionen integriert; der Quellstand wird jetzt eingefroren und vollständig geprüft. Die71 Anforderungen sind in den Testnachweisen den tatsächlichen Softwarewegen, konkreten Tests und offenen Gerätestationen zugeordnet. Native Root-Quellen88/89bytegleich (nur generierte Modulpfade abweichend),87/87JUnit ohneSkip,196GradleTasks erneut ausgeführt (`android-native-check/BUILD_REPORT.md`). Kein Gerätetest daraus abgeleitet.

### Abschließender gemeinsamer Softwarelauf und Updatekandidat

Appcode eingefroren in `cd2c63c`, danach ausschließlich zwei bestehende E2E-Abläufe in `baad9f7` auf den neuen Ausklapper/Homeoffice-/Terminpfad nachgeführt und vor Save zusätzlich auf unveränderte Daten geprüft. Der erste vollständige Lauf fand genau diese3 veralteten Testannahmen (134/137grün); Appcode unverändert. Gezielter16/16-Lauf und danach der gesamte frische137/137-Lauf in4,2min grün,0Skip/Flaky/Retry. Die gebaute Quellkennung blieb bytegleich. Lint/Typecheck,780Vitest/80Dateien und19 echte Linux-PowerShell7.5.4-Fälle mit4Parsern grün. Nativer Sourceabgleich88Dateien (nur generierte Modulpfade ausgenommen),87JUnit ohneSkip, Releasebuild mit484tatsächlich ausgeführten Tasks/2m59s. Kein Signierschlüssel verwendet.

APK `de.frnkrm.anker`,1.3.0-rc.1/Code8, SHA256 `9fb488411de0c389a7ffa06a544a27065f1e9c85e1e440ed770774be8d0b9599`.67Webassets bytegleich, CSS/contain-Systemleistenfix erhalten; ZIP16KB-ausgerichtet, alle4ARM64ELFs16KB-ausgerichtet,16JNIBibliotheken bytegleich. Portable ZIP22137167Bytes, SHA256 `bff0a29aeaa9decd390001f1ff2de4306bb076f349c4cb5307ed844eff29b81e`,10Dateien, unveränderteSignierhilfe2. Noch keine Windows-Ausführung oder Installation dieses Updates, keine echte neue Geräteprüfung. Privates Original unverändert/ungetrackt; keineSchlüssel/Umgebungsdateien/APKs/ZIPs im Appbranch. Keine Tags/Releases/Deployments/Anbieteraktivierungen.

Main-Integration, öffentlicher Download und Remote-CI werden erst nach tatsächlichem Abschluss ergänzt. Nächster Nutzerschritt danach: Paket lokal signieren, über bestehende App installieren und mitStationG86 Datenvergleich beginnen; weitere Handytests erst dann gemeinsam.

### GitHub-CI19 – getrennte Testablaufkorrektur

Main `e59cc42` erfolgreich gepusht; [CI19](https://github.com/frnkrm/anker/actions/runs/42283981487) bestand Install/Lint/Typecheck/780Logik/PowerShell/Build, Browser132/137. Drei konkret nicht deterministische Testannahmen nachgewiesen: Bericht95 nach unverändertem0-Zähler vor tatsächlichem Commit neu geladen; zwei gehaltene Sync-Schreibvorgänge freigegeben, bevor lazy Tag-Navigation tatsächlich den alten Bereich unmountete. Neue Barrieren warten auf bestätigte Persistenz, kaltes Tag-DOM und echte Transaktionsabschlüsse; SW nur in dieser HTTP-Mockfixture blockiert. Neue positive IDB-Regressionsprüfung ergänzt. Appcode/Quellkennung unverändert, keine Timeoutlockerung/Skips.

Zwei Nachtfälle waren lokal wiederholt grün, die Browser156-Abweichung noch nicht erklärt. Verschärfte Prüfung enthält exakte Start-/Pause-/Uhrwerte, reine Projektion und datensparsame H1-Diagnose; gleiche5sFrist. Der nächste vollständige CI-Lauf entscheidet, kein Produktfix oder Erfolg vorweggenommen. Offizieller Browser156-Container konnte wegen gesperrtem Auslieferungshost nicht vollständig geladen werden, keine Netzrichtlinie umgangen. LokalerBrowser bleibt155, GitHub nutzt156. Downloadbranch `download-anker-e04-e09-rc1-20261106`/`699df5e` enthält bytegleiches Paket; HTTPS200/22137167Bytes/SHA256bff0a29a… vollständig bestätigt, Appcode weiterhin e862… . Kein neues Gerätetestresultat.

### CI20 – Ursache der verbleibenden Testabläufe belegt

[CI20](https://github.com/frnkrm/anker/actions/runs/42286857557),8506325:135/138Browserfälle grün; die zuvor reparierten Gerätebericht-/Sync-Schreibbarrieren bestanden. Die Nacht-Diagnose zeigte korrekte Uhr, gespeicherte Sitzung und aktive Coreprojektion, aber `/start` stattJetzt. Nacht- und Sync-Setup navigierten nach dem Klick hart weiter, bevor die asynchrone Ersteinrichtung gespeichert war. Echte gehaltene Settings-Schreibvorgänge reproduzieren das; die Tests warten nun vor Navigation auf Home-URL und persistiertes onboarded=true. Vier weitere direkte Testnavigationen derselben Klasse ebenfalls abgesichert.

Die Homeoffice-Rückfrage wurde mit echtem verzögertem IDB-Load reproduziert: Negativcheck schon im Loader bestanden, dann Uhrwechsel und alter Now-Mount, der die Rückfrage korrekt einmal verbrauchte; sofortiger zweiter Reload konnte sie folgerichtig nicht erneut anzeigen. Test wartet jetzt auf vollständiges Jetzt/persistierten Eintrag, verlässt Now vor dem Uhrwechsel und prüft danach genau eine Rückfrage sowie keine Wiederholung. Kein Produktcode/Fingerprint/APK geändert, keine Timeouts verlängert und keine Fälle übersprungen.

Integrierter Root-Ziellauf24/24 in45s grün,0Skip/Retry. Zusätzlich15wiederholte Nachtläufe,4Syncfälle und3Homeoffice-Fälle getrennt grün; neue physische IDB-Setupregression ergänzt. Nächster vollständiger CI-Lauf mit139Fällen ist das ausstehende Remote-Gate. LokalerLint0Fehler/1bestehendeRef-Cleanup-Warnung; Warnung nicht mit dem eigentlichen CI-Fehler verwechselt. Quellen unverändert e862… , vorhandene ZIP unverändert bff0a29a… .

### Endgültiger Remote-Abschluss und Übergabe

CI21 auf `240033c246892113ecd0650ffe2d673d34740b38` ist vollständig erfolgreich:139/139 Browserfälle in3,8min, gesamter Job5m55s, einschließlich npm-ci/Lint/Typecheck/Logik/PowerShell/Build. Die früheren CI19/20-Abweichungen wurden mit realen IDB-Schreib-/Ladebarrieren reproduziert und ausschließlich in den Testabläufen korrigiert. Appcode und APK blieben unverändert; ein neuer Versionscode oder erneutes Signierpaket war deshalb nicht nötig. Zwei Hinweise zu Actions-Node20-Migration und einer bestehenden Ref-Cleanup-Linterwarnung sind keine Testfehler;0Lintfehler.

Main ist integriert und gepusht. Downloadbranch `download-anker-e04-e09-rc1-20261106` stellt die unveränderte ZIP bereit:HTTPS200,22137167Bytes,SHA256bff0a29a… vollständig überprüft; Signierhilfe2 bytegleich. APK/Sourcekennung entsprechen den bestandenen Softwareprüfungen. Finale Dokumentationskorrekturen werden separat mit `[skip ci]` gesichert; sie verändern weder Appcode noch die geprüfte Quellkennung. Keine Tags, Store-Releases, Deployments, Anbieteraktivierung oder externe Nachrichten.

Nächster Nutzerschritt: den geprüften PowerShell-Block aus UPDATE_E04_E09.md ausführen, APK lokal mit bestehendem Schlüssel signieren und über die vorhandene App installieren. Danach StationG86 beginnen. Neue Gerätehäkchen werden erst nach tatsächlichem Bericht gespeichert. Sämtliche Softwareetappen sind entwickelt; offene Geräte-/Windows-/Anbieterwirkung bleibt ausdrücklich getrennt.

## Historischer Verlauf (Angaben gelten für den damaligen Stand)

Fortsetzbarer Stand. Status: `offen` · `implementiert` · `automatisch getestet` · `am Gerät verifiziert` · `blockiert`

**Am Gerät geprüft (04.11.2026, vom Nutzer gemeldet):** Wecker 1–3, 8, 14–16, 18, 19, einmalige Weckzeit und Termine 36, 38–40, Erinnerungen 22, 23, Druck 27–30, Alltag 31–34, Gleitzeit 43, 45. **Offen oder auffällig:** Vollbild erscheint bei 4 und 9 nicht von selbst, 4 und 5 nur teilweise gemeldet, die übrigen Punkte noch nicht getestet. Einzelheiten in [GERAETETEST.md](GERAETETEST.md).
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
