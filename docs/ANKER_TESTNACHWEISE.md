# Anker: Testnachweise

Ein Fortschrittsplan: [ANKER_IMPLEMENTIERUNGSPLAN.md](ANKER_IMPLEMENTIERUNGSPLAN.md). Diese Datei protokolliert Ausführungen und ihre Grenzen, keine zweite Planung.

## E00 – Baseline vor Änderungen am 05.11.2026

- Branch `work`, HEAD `38da41ef78a68f3d5d9ea25e73e1d4cf946b9d36` **einschließlich vorher vorhandener uncommitteter Änderungen**.
- SHA-256 des sortierten Pfad/Inhalt-Manifests: `7062052bccfb03e8222d78f1980eead1e4543b899f03fbf9de4412be02b769d5`.
- Archiv: `/workspace/.cache/anker/e00-baseline-20261105T225426Z/source.tar.gz`, SHA-256 `40dbe91fbdb3cd18b119b8d103d828388bfc1061ed97ecb033ef52710373248c`; 221 Dateien aus Archiv erneut gegen Manifest geprüft. Git-Binärdiff und Status liegen daneben. Ignorierte Geheimnisse, Keystores und Geräte-Datenbanken gehören nicht zum Quellarchiv.
- Vorherige Nutzerberichte bleiben in [GERAETETEST.md](GERAETETEST.md). Sie sind kein Nachweis für diesen neuen Arbeitsstand.

| Ausführung | Tatsächliches Ergebnis | Umfang / Grenze |
|---|---|---|
| `npm run lint` | Exit0 | statische Regeln |
| `npm run typecheck` | Exit0 | TS strict |
| `npm test` | 330 bestanden/22 Dateien,0 fehlgeschlagen | Kern, Store, Speicher, Sync, synthetisches Weckfenster |
| `npm run test:e2e -- --config=/workspace/.cache/anker/playwright.config.ts --workers=2` | 20 bestanden,0 fehlgeschlagen | Produktionsbuild via Playwright-Webserver, System-Chromium; Bedienung im Browser |
| Gradle `--offline --no-daemon --max-workers=2 --console=plain :app:compileDebugKotlin :app:testDebugUnitTest` | Build erfolgreich, passende Quellen kopiert, Tasks cachegültig | isolierte Android-Buildkopie, kein APK |
| Gradle `--offline --no-daemon --max-workers=2 --console=plain :app:testDebugUnitTest --rerun` | 44 Tests neu ausgeführt,0 Fehler/0 übersprungen,22:57UTC | reine Kotlin-Logik inkl.1 Vorlagentest, keine Android-Services/AlarmManager/Sensoren |

Logs und JSON-Ergebnisse liegen im Baseline-Verzeichnis. JDK21.0.8, SDK36, Gradle8.14.3, Node24.22.1. Buildkopie unter `/workspace/.cache/anker/android-build-check`, nur eigene Kotlin-Quellen/Tests/Manifest aus dem Repository übernommen. Native Bibliotheken stammen aus dem bestehenden eingerichteten Build. Browserkonfiguration außerhalb des Repositorys verwendet `/usr/bin/chromium`.

**Nicht ausgeführt:** physische Tests auf Galaxy S26 Ultra, Windows-PC-Stopp, echte Google-/Supabase-/Health-Verbindungen, APK-Installation, Release. Ein erfolgreiches Modell oder ein PendingIntent beweist keine tatsächliche Hörbarkeit. Das Weckfenster ist eine experimentelle Aktivitätsheuristik, keine Schlafphasenmessung.

## E01 – erste sichere Delta-Umsetzung, 05.11.2026

**Implementiert:** alte/ungültige Wecksignale am Controller-Rand prüfen, kein nachgeholtes Snooze bei deaktiviertem Wecker, gemeinsame ehrliche Planungsdiagnose;63 geführte Gerätefälle mit lokalem bewusstem Nutzerbericht/Entwurf; direkte Uhrzeit- und Dauereingabe mit Nachtzuordnung und Schutz manueller Zeiten. Anforderungen/Tests/Restgrenzen je Punkt im [Etappenergebnis des Plans](ANKER_IMPLEMENTIERUNGSPLAN.md#e01--ergebnis-der-ersten-sicheren-delta-umsetzung-05112026).

**Rotnachweis:** Gegen unveränderte E00-Logik scheiterte `AlarmModelTest.abgeschalteterWeckerHoltAuchFaelligesSchlummernNichtNach` reproduzierbar (1 ausgeführt,1 fehlgeschlagen, Gradle Exit1). Der deaktivierte Wecker lieferte noch `fireLate=SNOOZE`. Log `e01-snooze-reproduced.log`; nach der Bedingungskorrektur besteht derselbe Test.

| Abschließende Ausführung | Tatsächliches Ergebnis | Nachweisdatei / Grenze |
|---|---|---|
| `npm run lint` | Exit0 | `e01-lint.log` |
| `npm run typecheck` | Exit0 | `e01-typecheck.log` |
| `npm test` | 340 bestanden/24 Dateien,0 fehlgeschlagen | `e01-vitest.log`;10 zusätzliche Tests: Diagnosepolitik3, Katalog/Validierung4, Store/Fehler3 |
| `npm run test:e2e -- --config=/workspace/.cache/anker/playwright.config.ts --workers=2` | 29 bestanden,0 fehlgeschlagen | `e01-e2e-complete.log`; enthält aktuellen Produktionsbuild/TS-Prüfung, bisherige20 plus9 neue Browserfälle |
| Gradle `--offline --no-daemon --max-workers=2 --console=plain :app:compileDebugKotlin :app:testDebugUnitTest` | Build erfolgreich,50 JUnit bestanden,0 Fehler/0 übersprungen | `e01-android.log`, XML in isolierter Buildkopie;49 Fachtests und1 Vorlagentest.16 Quell-/Test-/Manifestdateien bytegleich zum Repository geprüft |
| Ergebniszellen nicht im Katalog/Bundle | Katalog hat genau63 eindeutige IDs und nur `id/group/action/expected`; Stichproben historischer Ergebnistexte nicht in Produktions-JS gefunden | Katalogtest + Buildprüfung; keine allgemeine Geheimnis-/Penetrationsprüfung |
| Unabhängiger Review | lesend, keine blockierende Regression festgestellt; Hinweise zu Nachtzeiten, Navigation, Entwurf und Codestand umgesetzt | keine zusätzliche Geräte- oder Testausführung durch den Reviewer |

Alle Logs/JSON-Protokolle liegen neben der E00-Baseline. `e01-final-results.json` hält Befehle, Startzeitpunkte und Exitcodes fest. Ein Zwischenlauf fand den Überlauf bei großer Schrift (behoben); drei alte Tests lasen Uhrzeiten noch aus Textspannen statt den neuen Eingabefeldern (auf Wertprüfung umgestellt). Ein Test lud die Seite vor Abschluss der asynchronen Datenbanktransaktion neu; er wartet jetzt nachweisbar auf den gespeicherten Wert, ohne feste Wartezeit. Alle ursprünglichen Verhaltenserwartungen bleiben geprüft. Fehlversuche stehen getrennt vom erfolgreichen Abschlusslauf in den Logs.

Ein Umgebungsneustart unterbrach einen späteren Browserlauf nach21/29 abgeschlossenen Tests. Dieser Lauf zählt nicht als bestandene Gesamtsuite (`e01-e2e-environment-interrupted.log`, Exitstatus unbekannt). Danach wurde der vollständige Lauf neu gestartet; nur sein vollständiges Ergebnis wird oben als Abschluss geführt. Die abschließende Zahlenfeld-Anordnung hält die Bedienelemente zusammen und lässt Formularzeilen bei Bedarf umbrechen (`e01-e2e-layout-review.log` dokumentiert den vorherigen Überlauf).

### Konkrete E01-Abdeckung der Master-Szenarien

| Szenario | Tatsächlich automatisch geprüft | Am aktuellen Gerät / weitere Grenze |
|---|---|---|
| Q01 Testisolation | `testalarmAendertWederHauptweckerNochSchlummern`, getrennte Identitäten; Testseite nutzt vorhandenes `testAlarm` | G1–3 erneut prüfen; kein tatsächliches Android-Klingeln hier |
| Q02 Snooze | 1×Snooze, kein Reset im Modell, aktives verspätetes Snooze, deaktiviertes fälliges Snooze bleibt still | G4/G61 offen; echte Resume-/Systemzustellung nicht bewiesen |
| Q03 Timeout/Folgetag | `nachTimeoutIstDerNaechsteMorgenGeplant`; native Wiederplanung kompiliert | G5 nur historisches Teilresultat; mehrere Tage ohne App am Gerät offen |
| Q04 Vorwecker | Konfigurations-Unabhängigkeit/Priorität und getrennte Stopps | G6/7 offen |
| Q05 unsichere Einnahme | Protokoll und Wecker getrennt erhalten, kein automatischer Eintrag im Weckerpfad | spezifischer unsicherer Geräteablauf nicht neu ausgeführt |
| Q06 Ersatzweg | Notfall-/QR-/Rechenwege erhalten; Modell wehrt unzulässigen leichten Stopp ab | G19 historisch berichtet, aktuelle Kamera-/Scanner-/Offlinevarianten offen |
| Q07 Duplikate | current-occurrence, abgesagte/ersetzte/fehlende Termine aller fünf Arten; Stop-/Prioritätsregeln | Dienst-Restart/Ressourcenlecks nicht durch Modellprüfung bewiesen |
| Q08 Boot/Update/Zeit | `booted → reconcile → firedScheduled`, Schlummernachholen, Berlin-DST-Parität; Receiver kompiliert | G10–13/G20 offen für aktuellen Stand |
| Q09 Rechte/Status | `alarmPlanningStatus`: exakt abgelehnt/false/unbekannt, gespeicherter Fehler, fehlender Token/Termin, bewusst aus | Entziehen/Wiedererteilen und native requestbezogene Quittierung am System offen |
| Q10 Audio/Fallback | Diagnose und Ton-Rückfall erhalten, Build bestanden | Tonquelle/Bluetooth/Hörbarkeit nicht automatisch bewiesen; G15/17 aktuelle Tests offen |
| Q11 Gerätekontrolle | Hardwaretasten nicht geändert; sicherer Stopp erhalten | früherer G16-Bericht, aktueller physischer Test offen |
| Q12 Weckänderung | Terminersatz/Absage am produktiven Guard, klingelnder Wecker bleibt bei Neuplanung; SmartWake feste Absicherung nach Timeout/Boot und bestätigtes Ende | G35/37/G57–61 offen |
| Q81/Q83 neue Testdaten | Altstand kompatibel, Backup-Roundtrip/Validierung, Persistenz ohne XP/Planabgleich, Fehlerrollback, nur Testberichte im Export | echter Android-SQLite-/Update-Roundtrip offen |
| Q82 neue Zeiteingabe | PC20:00, Bett00:30=1470, Mitternachtswechsel mit+/−, manuelle Flags auch Onboarding, Fahrtzeit-Neuberechnung schützt eigene Zeiten | Android-Tastatur/Uhrzeitdialog G62 offen |

### Prüfstand eindeutig halten

Der erfolgreiche Produktionsbuild enthält die Quellkennung `2bb70a922b749bdd0c176c233d9380504275bb10e4535692b08e958644dcbabf` (`e01-build-source.json`). Sie kennzeichnet erfasste Produktionsquellen, eigene Kotlin-Dateien, ausgewählte Build-/Dependencydateien und den Katalog. Sie ist **keine vollständige APK-Prüfsumme**, enthält keine Signatur und erfasst nicht jede Ressource/Buildumgebung. Nutzerberichte speichern zusätzlich native Appversion und Buildnummer, Plattform, Datum, Gerät/Systemangabe und Testversion. Andere Codestände bleiben erhalten, zählen aber als offen.

Entwürfe werden beim Verlassen des Feldes bzw. vor dem Einstellungswechsel gespeichert. Ein sofortiger Prozessabbruch mitten in der Eingabe ist damit nicht abgesichert. Forced Reload während einer noch laufenden asynchronen Transaktion ist ebenfalls kein Persistenznachweis.

**Am echten Android-Gerät:** für diese Etappe nicht geprüft. Historische Berichte bleiben separat. G60–63 sind ergänzt und offen; G53–59 des experimentellen Weckfensters bleiben offen. Kein Sensor-/Schlafstadien-/medizinischer Wirksamkeitsnachweis. Kein APK erstellt, kein Signierschlüssel erzeugt/geändert, keine Installation, kein Push oder Release. Der lokale Windows-Projektordner und sein bisheriger Signierschlüssel wurden nicht angetastet.

## Vorbereitung des Handy-Updates – 06.11.2026, Europe/Berlin

Der Nutzer hat seine JSON-Sicherung bestätigt. Sein Windows-Signierbericht zeigt eine Debug-Konfiguration mit vorhandenem Schlüssel, lokal keine Release-Konfiguration. Der Bericht enthält ein öffentliches Zertifikat, keinen privaten Schlüssel. Signierung und Installation erfolgen danach auf den Geräten des Nutzers.

| Prüfung | Ergebnis | Umfang / Grenze |
|---|---|---|
| `npm run build` | Exit0 | aktueller Produktionsstand unverändert, Quellkennung2bb70a… |
| Capacitor-Sync | erfolgreich, ausschließlich isolierte Kopie | vorhandene eigene Kotlin-Quellen/Manifest und neue Webassets im APK |
| Gradle `:app:assembleRelease` offline | zunächst fehlende Cache-Artefakte | kein bestandener APK-Build behauptet; keine Checks abgeschaltet |
| Gradle `--no-daemon --max-workers=2 --console=plain :app:assembleRelease` | bestanden,484 Tasks, Release-Lint aktiv | fehlende Bibliotheken über eingerichteten Proxy mit TLS-Verifikation nachgeladen; kein Publish/Tag/Push |
| `aapt dump badging` | `de.frnkrm.anker`, Code3, `1.2.0-rc.1`, min26/target36 | Metadaten des tatsächlichen APK |
| `apksigner verify` vor lokaler Signierung | erwarteter Exit1: APK ist unsigniert | noch nicht installierbar; keine fremde Signatur als Ersatz verwendet |
| ZIP-/ELF-Ausrichtung | `zipalign -c -P16 4` Exit0; alle4 ARM64-Bibliotheken LOAD-Alignment0x4000 | statische16-KB-Prüfung, kein Galaxy-Lauftest |
| Webassets im APK | Testseitenbundle mit passender Quellkennung vorhanden | kein pauschaler Laufzeitnachweis |
| `node --check scripts/sign-local-update.mjs` | bestanden | Syntaxprüfung des lokalen Helfers |
| Signierhelfer –7 kryptografische Fälle |7 bestanden,0 fehlgeschlagen | echte SDK-Werkzeuge, tatsächliches APK, temporäre Testschlüssel; Windows-CMD nicht ausgeführt |
| Update-ZIP | Inhalt/CRC und jeder Dateiinhalt gegen Original geprüft | nur5 vorgesehene Dateien, keine Keystores/privaten Schlüssel/Testschlüssel enthalten |

Die7 Fälle prüfen erfolgreichen Zertifikats-/Versionsabgleich mit vorheriger APK und den Fall ohne alte APK. Falscher Schlüssel, veränderte Eingabe-Prüfsumme, höherer alter Versionscode, fehlender Schlüssel und falsches Paket liefern den erwarteten Fehler und keine neue finale APK. Eingabe-APK bleibt unverändert, temporäre APK/idsig werden entfernt. Keine App-Installation und kein Netzwerkaufruf im Helfer. Verwendet wird das übliche öffentliche Debug-Standardpasswort; ein abweichendes Passwort wird nicht im Chat angefordert.

Artefakt: `/workspace/artifacts/Anker-Update-E01-Windows.zip`,21699399Bytes, SHA256 `364d7d28537b747695e3ad8b73e2aa8539e6d4cad0c6f9d2b7f60ea7ca8446cd`.
Unsig­niertes APK im Paket:37892341Bytes, SHA256 `850e0844cd14613c8cd374d2f3b2f995976b142b3b91030c0af19568d0802e55`.
Logs/Metadaten/Integrationsergebnisse: `/workspace/.cache/anker/update-preparation/`.

**Weiter offen:** tatsächliche Windows-Signierung mit dem Nutzerschlüssel, Zertifikats-/Versionsabgleich zur tatsächlich installierten Handy-App durch Android, Installation/Datenübernahme und Gerätefälle1–3 sowie alle weiteren offenen Hardwarefälle. Appquellen unverändert gegenüber den zuvor bestandenen340 Vitest-/29 Browser-/50 Kotlin-Tests. Die neuen7 Signierprüfungen sind separate Werkzeugtests und werden nicht als zusätzliche Gerätebelege gezählt.

## Freigegebene Veröffentlichung und erneute Integrationsprüfung – 06.11.2026

- Ausdrückliche Nutzerfreigabe für Paket-Upload, Commits, Pushes und Merge des bisherigen Appstands erhalten. Keine Release-/Tag-Aktion.
- Paketbranch `download-anker-e01-20261106` auf GitHub erstellt. Das ZIP wurde über den tatsächlichen öffentlichen HTTPS-Link vollständig wieder eingelesen: HTTP200,21699399Bytes, SHA256 wie oben. Der Nutzerdownload in dieser Chat-Oberfläche hatte vorher zweimal nicht funktioniert; die Dateikopien selbst waren gültig. Keine Endnutzerbestätigung für den GitHub-Download behauptet.
- Vor App-Integration neu ausgeführt: `npm run lint`, `npm run typecheck`, `npm test` (340/24Dateien), vollständiger Playwright-Lauf (29 Tests, Produktionsstand) und Gradle `:app:compileDebugKotlin :app:testDebugUnitTest --rerun` (50 Tests,0 Fehler/0 übersprungen). Logs/Exitcodes unter `/workspace/.cache/anker/merge-validation-20261106/`.
- Private Auftragskopie blieb unverändert, lokal vorhanden und explizit von Git ausgeschlossen. Öffentliche technische Fassung auf alle71 Anforderungs-IDs und die Entfernung der identifizierten persönlichen Angaben geprüft. Lesender Publikationsscan fand keine neuen echten Tokens, Schlüssel oder Zugangsdaten im vorgesehenen Commit.
- Native-/SmartWake-Abschlussreview: keine blockierende neue Regression, keine Schreibarbeiten oder zusätzliche Testausführung durch Reviewer. Grenzen bei realer Android-Ausführung bleiben unverändert offen.

**Git-Nachweis:** Commit `ab686481641eab085ad844cd82ae9d45eaa6cfb7` enthält95 geprüfte App-/Test-/Dokumentänderungen. `git ls-remote` bestätigt nach Fast-forward und Push denselben Commit auf `refs/heads/main` und `refs/heads/entwicklung/anker-e01`; der separate Downloadbranch steht auf `529d37590c14f4d1f26e53228a2a6481ab8a0b1d`. Keine Binär-/Keystore-/Datenbankdatei im Appcommit, private Auftragskopie nicht im Tree. Remote-CI gestartet; ihr Ergebnis ist vom lokalen vollständigen Prüfstand getrennt.

## SDK-unabhängige Signierhilfe2 – 06.11.2026

Der tatsächliche Windows-Fehler „Android-Buildwerkzeuge nicht gefunden“ ist ein Bericht zum ersten Helfer, kein bestandener Windows-Signiernachweis. Die neue Hilfe entfernt diese Voraussetzung vollständig.

| Nachweis | Ergebnis | Grenze |
|---|---|---|
| Alte Hilfe, SDK-Variablen entfernt/kein SDK-Pfad | erwarteter Fehler reproduziert | entspricht der gemeldeten Fehlerklasse |
| Neue Hilfe, gleiche fehlende SDK-Umgebung | echte Signierung erfolgreich, mit und ohne vorherige lokale APK | Linux mit Java21; Windows noch offen |
| Falscher Schlüssel, APK-Prüfsumme oder Paket | erwarteter Fehler, keine finale APK | Zertifikatsabgleich vor Zugriff auf den privaten Schlüssel |
| Höherer alter Versionscode, auch oberhalb JS-Number-Präzision | erwarteter Abbruch | vollständiger Long-Code als Dezimalstring/BigInt |
| Fehlender Schlüssel, beschädigte JAR oder Klasse | erwarteter Abbruch | keine Werkzeug-/Schlüsselerzeugung als Ersatz |
| Unabhängige Nachprüfung erfolgreicher Ausgaben | SDK-apksigner und `zipalign -c -P16 4` erfolgreich | SDK wird ausschließlich im Entwicklertest verwendet |
| Eingabe und Testkeystores nach jedem Fall | bytegleich; temporäre APK/idsig entfernt | kurzlebige Testschlüssel anschließend gelöscht; Nutzerschlüssel nie verwendet |
| `javac --release 17`, `node --check` | bestanden | Java-API-/Syntaxprüfung, kein Windows-Lauf |

Insgesamt11 überprüfte Fälle (1 Repro,10 neue Integrationsfälle),0 unerwartete Fehler. Quelle/Logs: `/workspace/.cache/anker/portable-signing/`. Lizenz des unveränderten Maven-JAR liegt zusätzlich lesbar im Paket; keine SDK-JAR mit unklarer Zuordnung weiterer Komponenten weitergegeben. Bibliothek-SHA256 `c070ed1394629d74641aa0906f60b2ffa1ee77e6366a1f93437f59717b1aeb89`, eigene Klasse-SHA256 `d17ffa00371bfec8bcb1df7269b8a7718610f2156c2eb3edd51fd53ed8f124f7`.

Neues Paket: `/workspace/artifacts/Anker-Update-E01-Portable.zip`,22172417Bytes, SHA256 `1b46d36d431ecd4c5275ca0eacf1cd30a2202a19c6c81b36a2172abc914bb307`.10 vorgesehene Dateien einschließlich Werkzeuglizenz und eigener Java-Quelle; ZIP und alle Inhalte nachgelesen, keine privaten Schlüssel enthalten. Die eigentliche App-APK bleibt unverändert, deshalb weiterhin derselbe Appprüfstand340/29/50; keine erneute App-/Gerätefreigabe behauptet.

**Bereitstellung geprüft:** Remote-Branch `download-anker-e01-20261106` steht auf `8f1457daffc72742ff1d15560fb4a080133a119e`. Öffentliche neue ZIP über GitHub-HTTPS vollständig gelesen: HTTP200,22172417Bytes, obige SHA256 stimmt. Nachweis: `/workspace/.cache/anker/portable-signing/https-verification.json`. Dies bestätigt den Serverdownload; die Ausführung im Windows-Client bleibt offen.

## Nutzerbericht nach dem Handy-Update – 06.11.2026

- Nutzer meldet die erfolgreiche Aktualisierung auf seinem Handy nach Bereitstellung der SDK-freien Signierhilfe.
- Auf ausdrückliche Nachfrage zu Routinen, Einstellungen und Spielstand bestätigt: alles vorhanden.
- Damit sind Installation und sichtbarer Erhalt dieser Daten vom Nutzer bestätigt. Keine eigenständige Prüfung des Windows-Signierlaufs, keine ausgelesene Geräteversion/Quellkennung und kein vollständiger Datenbankvergleich.
- Weckerplanung nach Update, tatsächliches Klingeln und die übrigen aktuellen Gerätefälle bleiben offen. Insbesondere G12 nicht allein wegen erfolgreicher Installation als bestanden führen. Historische Testergebnisse und lokale Testseiten-Häkchen wurden nicht verändert.

Nächster Geräteablauf: separater Testalarm in10 Sekunden bei entsperrtem Handy (G1), Ergebnis bewusst auf der Testseite speichern. Dieser Dokumentationsschritt ändert keine Appdateien und erfordert keine erneuten App-Tests oder APK.

## Navigation und Vorweckerpause vor E02 – 06.11.2026

Nutzer bestätigt: Rücksprungschleife nur nach Einstieg per Benachrichtigung/Widget; normaler Start erlaubt Seitenwechsel. Roter Browsernachweis gegen unverändertes `src/App.tsx`: Klick auf Mehr führt zurück zu Gute Nacht, Test scheitert. Nach einmaliger Bridge-Initialisierung sind alte now-/alarm-Startlinks, neue Deep Links und klingelnde Ereignisse geprüft. Browser simuliert Capacitor und Speicher; keine echte Android-Ausführung.

- Lint,340 Vitest und Produktionsbuild/Typecheck bestanden.
- Vollständiger Browserlauf:33 bestanden;29 bestehende Fälle plus4 native Simulationen einschließlich Vorwecker-Info vor Start und nach Messungsende.
- Gradle `:app:testDebugUnitTest --rerun :app:assembleRelease`: erfolgreich,54 Tests/0 Fehler/0 übersprungen, Release-Lint aktiv. Vier zusätzliche Modelltests sichern Vorweckerpause, alte Intents, Neustart, spätere Vorwecker-Aktivierung, neuen Haupttermin und abgelehnten Messstart.
- Aktueller Katalog:65 Fälle, G64/65 am Handy offen. Die vom Nutzer zuvor bestätigte Installation/Datenübernahme gilt für den vorherigen Build, nicht als Freigabe dieser Korrekturen.

Logs unter `/workspace/.cache/anker/navigation-fix/`. Ein erster Browserversuch nach dem Edit nutzte wegen `reuseExistingServer` den alten Build; separat als `stale-build-attempt.log`, nicht als Prüfung des korrigierten Standes gezählt. Nach explizitem Neubau vollständiger Erfolg. Der erste native Aufruf fand den optionalen Node-Starter in der isolierten Kopie nicht; anschließend direkt über deren Gradle-Wrapper vollständig erfolgreich. Neues Updatepaket wird nach E02 gebaut und ausgeliefert.

## E02 – integrierter Abschlussstand, 06.11.2026

Anforderungen NO-01–05/PR-01–03 und Q13–22 sind im [E02-Etappenergebnis](ANKER_IMPLEMENTIERUNGSPLAN.md#e02--integriertes-ergebnis-06112026) mit Implementierung und offenen Gerätefällen verknüpft. Isolierte Teil-Worktrees wurden integriert; keine konkurrierenden Schreibzugriffe auf denselben Baum. Keine neuen Abhängigkeiten oder produktiven Datenbanken im Test.

| Ausführung | Tatsächliches Ergebnis | Grenze / Nachweis |
|---|---|---|
| Lint/Typecheck/Produktionsbuild | bestanden | `e02-final/lint.log`, `build.log`, finaler Copy-Abgleich `build-copy-final.log` |
| Vollständiges Vitest |376 Tests/28 Dateien,0 Fehler | `vitest.log` und erneut `vitest-copy-final.log`; vorher340,36 zusätzliche Fälle |
| Vollständiges Playwright |39 Tests,0 Fehler | `e2e.log`, `e2e-results.json`; gegenüber E01 zusätzlich native Einstiege, Fokus, E02-Testführung und4 Druckfälle |
| Gradle `:app:testDebugUnitTest --rerun :app:assembleRelease` |73 Tests/0 Fehler/0 übersprungen, APK-Build erfolgreich, Release-Lint aktiv |72 Fachtests+1 Vorlagentest; `android.log`, XML. Kein Framework-/Gerätelauf |
| Native Quelldateien und Webassets im APK |20 eigene Kotlin-Quell-/Testdateien bytegleich zur Buildkopie; alle aktuellen Webassets bytegleich im APK | `apk-verification.json`; abschließende Änderungen betreffen Webinhalt, native DEX und ARM64-Bibliotheken bytegleich zum zuvor geprüften Build |
| Lange Browser-PDFs |90 Schritte vollständig,160% Schrift, A5 21/A4 9Seiten, keine Overlaytexte | Nachweise/PDFs unter `e02-print/`; QR-Scan auf Papier und Android-PDF-Renderer damit nicht bewiesen |
| Neuer Signierpaket-Smoketest |2 echte kryptografische Fälle: Signatur ohne Runtime-SDK erfolgreich, beschädigte APK abgelehnt | kurzlebiger eigener Testschlüssel, bytegleich und entfernt; unabhängiges SDK-apksigner/zipalign als Testorakel; `signing-smoke-results.json` |

Alle Pfade sind unter `/workspace/.cache/anker/`. Die neuen Tests schützen insbesondere aktuelle Slot-/Token-/Revisionsprüfung, ACK nach Transaktion, fehlgeschlagene Speicherung/Retry und gleichzeitige UI-Eingabe, alte Erledigungszeiten, Doppeltap, native Highwater/DST/Nachtzuordnung, zukünftige datierte Ausnahmen, neueste Planung nach schnellen Änderungen, Ressourcenbereitschaft und Druck-/Share-Abbruch. Memory/Dexie-Transaktionen sind automatisch ausgeführt; Android-SQLite bleibt Geräteprüfung.

**Zwischenfehler getrennt:** Native Gesamtkopplung fand einen Nullable-Typfehler bei der Revisionsmap; mit expliziter Nullprüfung korrigiert und anschließend vollständig kompiliert/getestet. Log `android-nullable-revision-failed.log`. Ein Signierlauf im eingeschränkten Prozesssandbox meldete bei Node-Kindprozessen EPERM; der freigegebene normale Testlauf besteht. Keine Schutzprüfung dafür entfernt. Der letzte Hinweistext stellt klar, dass Basiszeiten nach dem Tagesvorrat weiterlaufen; danach Vitest/Build/APK erneut erfolgreich, keine Web-Verhaltensregel geändert.

**Updateartefakt:** `Anker-Update-E02.zip`,21972987Bytes, SHA256 `5e754fa1de871ad8077a2925dd36e46b1cf3623f86e786420069afeec6cf22b5`.10 Dateien einschließlich Bibliothekslizenz und eigener Java-Quelle, jeder Inhalt und ZIP-CRC erneut geprüft, keine privaten Schlüssel. Unsig­niertes APK SHA256 `edc4df197487cea724dc227817bf0022b92b0accbb85e5728ea7da47761321ae`, Paket `de.frnkrm.anker`, Version1.2.0-rc.2, Code4, Quellkennung `13c644b5d80c957367194c390b0c1d1faca12f177be049f498a3f6afed6cbbdf`. APK erwartungsgemäß unsigniert; ZIP-/ELF16-KB-Ausrichtung geprüft. Signierhilfe2 samt Werkzeughashes unverändert.

**Am aktuellen Handy offen:** G64–74 sowie die übrigen neuen Zustell-, Mikrofon-, SQLite-, Boot-, Druck-/PDF-/Papierfälle. Frühere Nutzerberichte gelten unverändert für ihre früheren Builds. SDK-/Modell-/Browsererfolg bestätigt keine zukünftige Hörbarkeit oder Schlafphase. Offizielle Android-Webdokumentation blieb netzseitig gesperrt; SDK36-API-/Kompiliernachweise sind davon getrennt. Neue Windows-Ausführung und echte Installation dieses E02-Pakets werden erst nach Nutzerbericht bestätigt.

**Bereitstellung:** App-Quellcommit `f272c514772a32c4529b92088467851e7f940668`; Downloadbranch `download-anker-e02-20261106` auf `bbbd844737c71f827095c8ba9cd1058d93d647d8`. Den tatsächlichen öffentlichen GitHub-HTTPS-Download vollständig gelesen: HTTP200,21972987Bytes, obige ZIP-SHA256 stimmt. Dateien `delivery.json` und `https-verification.json` unter `e02-final/`. Keine private Auftragskopie, Schlüssel oder Nutzerdatenbank veröffentlicht. Lokale Prüfungen sind vom noch nicht beobachteten Remote-CI-Ergebnis getrennt.
