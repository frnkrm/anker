# Anker 2.0: Implementierungsplan

## Aktueller Gesamtauftrag v6: E00 (05.11.2026)

Dieser Abschnitt hat Vorrang vor den historischen Fortschrittsangaben weiter unten. Quelle: [öffentliche technische Fassung des vollständig gelesenen Gesamtauftrags](auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v6.md). Neue direkte Nutzerwünsche: geführte Testseite, direkt bearbeitbare Uhrzeiten und Dauern. Bestehende Abendhilfen und das experimentelle Weckfenster bleiben erhalten.

**E00 abgeschlossen:** tatsächlicher Branch `work`, HEAD `38da41ef78a68f3d5d9ea25e73e1d4cf946b9d36`, Ursprung `github.com/frnkrm/anker`, App `1.2.0-rc.1`. Vorhandene Änderungen und unversionierte Dateien sind Teil der Baseline, nicht zurückgesetzt. Kein Claude-Prozess festgestellt; nur der Hauptagent schreibt, Unteragent prüft lesend. Keine geltenden `AGENTS.md`/`AGENTS.override.md` an den übergeordneten oder relevanten Projektpfaden gefunden. `CLAUDE.md`, Projektanleitung, Struktur, Changelog, Plan und Fach­dokumentation gelesen.

**Sicherung vor Edits:** 221 Quelldateien samt vorhandenen Änderungen archiviert und jeden Inhalt anhand SHA-256 nachgelesen. Quellfingerabdruck `7062052bccfb03e8222d78f1980eead1e4543b899f03fbf9de4412be02b769d5`. Lokales Archiv/Logs: `/workspace/.cache/anker/e00-baseline-20261105T225426Z/`. Das ist eine Sicherung dieser Cloud-Arbeitskopie, kein Export der Daten vom Handy und keine dauerhafte externe Sicherung. Signierschlüssel und Windows-Ordner `D:\Projekt\Anker` liegen hier nicht vor. Keine Migration, Löschung oder Änderung bestehender Nutzerdaten für E00.

**Frische Baseline:** Lint, Typecheck, Produktionsbuild bestanden; 330 Vitest-Tests/22 Dateien, 20 Playwright-Tests, Android-Kotlin-Kompilierung und 44 ausdrücklich neu ausgeführte JUnit-Tests ohne Fehler/Skip. Befehle und Grenzen: [Testnachweise](ANKER_TESTNACHWEISE.md). Kein APK gebaut, kein Push/Release. Automatisierte Tests bestätigen weder zukünftige Hörbarkeit noch Sensorqualität auf der Matratze.

**Geräteberichte erhalten:** G1–59 bezeichnen die bestehenden Fälle in [GERAETETEST.md](GERAETETEST.md). Darunter sind echte Nutzerberichte aus früheren Builds, Teilresultate und offene Fälle. G47/48 bestätigen den AOD-Fix am 05.11.; die frühere pauschale Aussage „kein Handy-Test“ ist deshalb historisch. Keine neue Änderung gilt dadurch als am Gerät geprüft. Galaxy S26 Ultra laut Nutzer; genaue Android-/One-UI-Version offen.

### Delta-Matrix nach aktuellem Code, vor E01

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
| E02 Erinnerungen/Druck | nächste unabhängige sichere Etappe: alte Actions/Relevanz, Mehrtag und Druckgrenzen; Geräteprüfung weiter offen |
| E03 Zustände/Tasks/Recovery | danach: vorhandene Modelle erweitern, Effekte sequenzieren, langer Wiedereinstieg |
| E04 Flexible Planung/Spiel | danach: Nichtnutzung ohne Kapitelverlust, freie Verlängerung/PC-Zustand; Fortschritt bewahren |
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
