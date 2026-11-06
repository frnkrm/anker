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

## CI-Untersuchung nach E02 – 06.11.2026

Öffentlich nachgelesener [Lauf13](https://github.com/frnkrm/anker/actions/runs/42147726040), main `cfc7b86`: Installation, Lint, Typecheck, Vitest und Produktionsbuild erfolgreich; ausschließlich der kombinierte Schritt „Playwright-Smoke-Test“ fehlgeschlagen (Exit1). Auch Läufe7–12 scheiterten in diesem Schritt, bereits vor E02; Lauf6 war erfolgreich. Der kombinierte Schritt umfasst Browserinstallation und Tests. Die alten Detail-Logs verlangen GitHub-Anmeldung und waren hier nicht zugänglich. Deshalb zunächst keine genaue Ursache behauptet; Node20-/Ubuntu-Migrationshinweise sind kein Fehlernachweis.

- Lokaler Wiederholungslauf:39/39 Browserfälle bestanden,0 übersprungen/fehlgeschlagen/flaky,81,4Sekunden. Bestehende externe Konfiguration mit System-Chromium und2 Workern; damit keine identische Reproduktion des GitHub-Browsers. Log: `/workspace/.cache/anker/ci-investigation/local-e2e.log`.
- Diagnose ergänzt: getrennte Installations-/Testschritte, GitHub-Fehlerannotation, HTML-Bericht und Fehler-Screenshots/-Traces (CI-Aufbewahrung7Tage). In CI wird ein frischer Produktionsserver verlangt und versehentliches `test.only` abgelehnt. Keine Erwartung abgeschwächt, keine Wiederholung zum Verdecken von Fehlern ergänzt.
- Lint und Typecheck nach der Konfigurationsänderung bestanden. Diese erste Diagnoseänderung ließ Appquellen, Nutzerdaten und ausgelieferte APK unverändert.

### Sichtbarer Rotnachweis und Korrektur

[Lauf14](https://github.com/frnkrm/anker/actions/runs/42151067255), Diagnosecommit `b5fa8c7`: Browserinstallation und sämtliche vorangehenden Checks erfolgreich;39 Browserfälle ausgeführt,33 bestanden/6 fehlgeschlagen. Die GitHub-Annotationen sind öffentlich sichtbar; Berichtupload erfolgreich. Gespeicherte Belege unter `ci-investigation/run14/`, insbesondere `annotations.json` und `steps.json`.

| Ursache | Korrektur / tatsächlicher Nachweis |
|---|---|
| Fünf Tests beendeten das Dokument durch `reload`/`goto`, während ihre Änderung noch in der bestehenden asynchronen Persistenzkette lag. Die Oberfläche ist bewusst sofort sichtbar; Playwright-`click` wartet nicht auf ein React-Handler-Promise. | Vor Navigation vorhandenen, erst nach Speicherung gesetzten Status/Toast abwarten oder den abgeschlossenen IndexedDB-Wert prüfen. Betrifft Testpause, nächsten Schritt, Weckfenster, offenes Abendende und Abendmodus; auch anschließendes Erledigen und Arbeit-Ruhigstellen abgesichert. Ursprüngliche Nach-Reload-Erwartungen bleiben erhalten, kein neuer Timeout/Retry. |
| Drucküberschrift hatte keinen erlaubten Umbruch. Mit breiterer Schrift reproduzierbar: „Morgenroutine“ misst bei48px und Schriftgewicht600 in DejaVu Sans402,445px, gegenüber lokalem Noto Sans364,03px. Bei390px ergibt das passend zur CI-Meldung12px Überlauf; die tatsächlich am Runner gewählte Schrift wurde nicht ausgelesen. | Lokalen Rotnachweis bei320px ohne bestimmte Schrift erzwingen; Überschrift innerhalb ihrer Breite umbrechen. A5/A4,90 Schritte und160% sowie≤1px-Toleranz bleiben erhalten. Auch die Druckansicht-Überschrift darf auf schmalem Bildschirm umbrechen. |

Die fünf korrigierten Persistenzfälle bestehen auf frischem Produktionsbuild mit `CI=true`, System-Chromium155 und2 Workern (5/5,23,6Sekunden; `persistence-fixed.log`). Der neue CI-Konfigurationspfad einschließlich neuem Server/Reportern war zuvor separat mit einem bestehenden Druckadapterfall erfolgreich (1/1,16Sekunden; `ci-config-smoke.log`). Reine Browser-/Konfigurationsnachweise; keine native Android-Speicher-/Druckprüfung. Die ausgelieferte E02-APK bleibt unverändert; ein späterer Appbuild übernimmt den kleinen Web-Druckumbruch.

Druck-Rotnachweis am Altcode mit320px:44px Überlauf (`print-320-red.log`); die zusätzliche Bildschirmprüfung fand auch den nicht umbrechenden Flex-Titel. Nach beiden Umbruchkorrekturen und frischem Produktionsbuild alle4 Druckfälle bestanden (21,3Sekunden; `print-all-green.log`). PDFs erneut mit unabhängigem Parser geprüft: A5=21/A4=9Seiten, letzter Schritt vollständig vorhanden, Overlay fehlt (`print-pdf-checks.json`). Schriftgröße und sämtliche ursprünglichen PDF-Erwartungen bleiben erhalten. Fixcommits `f005329` (Speicherbedingungen) und `32ba036` (Druckumbruch).

**Remote-Abschluss bestätigt:** [CI-Lauf15](https://github.com/frnkrm/anker/actions/runs/42152225401), main `e6e254b`, vollständig erfolgreich. `npm ci`, Lint, Typecheck, Vitest, Produktionsbuild, Playwright-Browserinstallation und Browsertests jeweils grün. Öffentliche Reporter-Notice: **39 passed (1.2m)**, Laufdauer2m56s/Job2m52s; Fehlerartefakt-Schritt korrekt übersprungen. Belege unter `ci-investigation/run15/`, strukturiert in `result.json`. Damit sind die korrigierten Tests auch mit dem GitHub-Browser bestätigt. Dieser abschließende Dokumentationsnachtrag ändert keine geprüften Quellen oder Testbedingungen; keine zusätzliche Android-Geräteprüfung behauptet.

## Android-Systemleisten – E02-Nachbesserung, 06.11.2026

Der Nutzer meldet per Screenshot überdeckten Inhalt und bestätigt ausdrücklich die obere Android-Leiste mit Uhr/Akku. Zu Beginn der Korrektur lag kein Geräteversuch des neuen Fixes vor. Im bisherigen Stand aktiviert `viewport-fit=cover` die randfüllende WebView; die Testbegleitung steht zudem vor dem durch `safe-top` geschützten Seiteninhalt.

**Implementiert:** `viewport-fit=contain`, dazu derselbe initiale Hinweis in Capacitors vorhandenem SystemBars-Plugin. Nachgelesene tatsächliche Abhängigkeit: `@capacitor/android`8.6, `Bridge.java` registriert SystemBars; `SystemBars.java` verwendet ohne Cover den nativen Paddingpfad mit Systemleisten/Kameraausschnitt, bei Tastatur den IME-Abstand. CSS-/weitergereichte Insets werden dort auf0 gesetzt. Keine eigene konkurrierende Insets-Behandlung oder festen gerätespezifischen Pixelabstände. `index.html` gehört nun zusätzlich zur bestehenden Quellkennung. Updateversion1.2.0-rc.3/Code5.

- Geführter G75 mit Wegen zu Jetzt, Fokus und Schrift/Tastatur;75 Fälle insgesamt. Android-Hinweis und getrennte Teilbeobachtungen bleiben erhalten, kein automatischer Gerätehaken. Vorhandene Berichte bleiben gespeichert; die neue Suite/Quellkennung trennt ihren alten Prüfstand.
- Agentprüfung im isolierten Worktree:11/11 Testseiten-Browserfälle erfolgreich (48,4Sekunden, System-Chromium155, frischer Produktionsbuild), vier Katalogtests, Lint und Typecheck erfolgreich. Der erste neue Vergleich fand ausschließlich die vorhandene Normalisierung fehlender manueller Zeitflags; anschließend Vergleich mit dem bestehenden Migrationsstand, keine Produkterwartung entfernt. Log `/workspace/.cache/anker/system-bars-tests-e2e.log`.
- Hauptbaum nach Integration: Lint,376 Vitest/28 Dateien und Produktionsbuild/Typecheck erfolgreich. Logs unter `/workspace/.cache/anker/system-bars-fix/`. Buildkopie:20 eigene Kotlin-Dateien bytegleich, aktuelle Webassets vollständig bytegleich, erzeugte `capacitor.config.json` enthält `SystemBars` mit `css`/`contain`, Index enthält `viewport-fit=contain`.
- **Remote bestätigt:** [CI16](https://github.com/frnkrm/anker/actions/runs/42191095861), main `6ea968a`, vollständig grün. Öffentliche Reporter-Notice **40 passed (1.2m)**; Lint, Typecheck, Unit-Tests, Build und Browserinstallation ebenfalls erfolgreich. Gesamtlauf2m55s, Job2m52s. Abschlussbeleg `ci/result.json`.
- **APK gebaut:** Gradle `:app:assembleRelease` offline erfolgreich,48Sekunden/484 Tasks, Release-Lint aktiv. Kein neuer Kotlin-Fachtest behauptet; eigene Kotlin-Quellen unverändert. Paket/Version/Code mit SDK-aapt und unveränderter portabler Java-Hilfe unabhängig gelesen: `de.frnkrm.anker`,1.2.0-rc.3,5. Alle58 aktuellen Webassetdateien bytegleich im APK, eingebettetes contain/SystemBars geprüft. ZIP16-KB-Ausrichtung erfolgreich; native Bibliotheken bytegleich zum zuvor verifizierten E02-APK. SDK-apksigner bestätigt den erwarteten fehlenden Signaturinhalt. Keine Nutzerschlüssel verwendet.
- **Bereitgestellt:** `Anker-Systemleisten-Update.zip`,21973459Bytes/10 Dateien, SHA256 `dd9d01a09dae695ee3c13ccaa3aeecce3afe0c8e69a3e297b162bf9be3865cc8`. APK-SHA256 `0d7a638a52fa2b443f346f695052a4bff0a1e59a8c7d8ea8d256a16bc0605521`, Quellkennung `71a7843e4bcac419a21f4db996b92a57d089b2640e4cf1ef9993dfc3ca767526`. Signierhilfe2 und Werkzeugdateien bytegleich zur vorherigen geprüften Hilfe; keine neue Windows-Ausführung oder Signierung behauptet.
- Getrennter Downloadbranch `download-anker-systemleisten-20261106`, Commit `0b9fcf6`; Download über [öffentliches GitHub-HTTPS](https://github.com/frnkrm/anker/raw/refs/heads/download-anker-systemleisten-20261106/Anker-Systemleisten-Update.zip) vollständig erneut gelesen, Größe und obige SHA256 stimmen. ZIP-CRC und jeder enthaltene Dateiwert geprüft. Belege `package-verification.json`, `portable-metadata-verification.json`, `https-verification.json`. Bestehende E02-Pakete bleiben unverändert; kein Tag/Store-Release.
- **Nutzerbericht06.11.2026:** Auf die konkrete Bitte, nach dem Update Jetzt zu öffnen und die obere Anzeige zu prüfen, meldet der Nutzer **„oben frei“**. Damit ist die zuvor gemeldete obere Überlagerung am Galaxy nicht mehr sichtbar; G75 ist **teilweise am Gerät geprüft**, kein vollständiger Erfolg für alle Unterfälle. Die tatsächlich installierte Buildkennung und der Windows-Signierlauf wurden nicht unabhängig ausgelesen.
- **Weiter offen:** Fokus, Tastatur, Rotation, Kameraaussparung und untere Systemnavigation am Galaxy (übrige Teile von G75). Keine automatische Änderung lokaler App-Testberichte, Alltagsdaten oder XP; nur der ausdrücklich berichtete Teil wird dokumentiert. Der Dokumentationsnachtrag braucht keinen neuen Appbuild.

## E03 – Aufgaben, Fokus und Wiedereinstieg, 06.11.2026

**Implementiert:** additive optionale Aufgabenangaben im vorhandenen Inbox-/Work-Modell, Unteraufgaben und eindeutige Wiederholungsinstanzen; bewusste Notizverarbeitung; lokaler Capture-Entwurf mit realem Fokuskontext; gemeinsam persistierte Task-/Fokusaktionen, Start/Erledigt/Details, lokale Zerlegung, Dauerlernen mit expliziter Bestätigung. Ein gemeinsamer Countdownzustand trägt unabhängigen Fokus und Starthilfe mit Pause/Resume. Unterbrechungsnotizen bleiben je Aufgabe bei A→B→A erhalten. NextAction und Widget nutzen dieselbe Auswahl; Hintergrundeffects und kurze Storeänderungen werden sequenziert. Automatischer Kapitelverlust nach Nichtnutzung entfernt, übrige E04-Arbeit nicht begonnen.

Baseline `34f8a87`,376 Logik-/40 Browserfälle, App rc.3/Code5. Quellarchiv vor E03: `/workspace/.cache/anker/e03/baseline-source.tar.gz`, SHA256 `8543d35dfe82701a5d493aad4676f0b6fb335d35092da8fdd4854c3e626f75a8`. Keine produktiven Nutzerrecords eingespielt, private Originaldatei nicht verändert/veröffentlicht. Hauptagent alleiniger Writer im Appbaum, parallele Arbeit nur in getrennten Worktrees.

| Ausführung | Ergebnis | Konkreter Umfang / Grenze |
|---|---|---|
| `npm run lint`, `npm run typecheck` | Exit0 | alle TS-Projekte und statische Regeln; Logs `e03/gate-{lint,types}.log` |
| `npm test` |499 bestanden/40 Dateien,0 Fehler | Core/Store/Repository/Effects einschließlich neuer20 Aufgaben-Storefälle und acht Recovery-Validierungsfälle; `e03/gate-unit.log` |
| Vollständiges Playwright mit frischem Produktionsbuild, eigener Port4195,2 Worker/System-Chromium155 |58 bestanden,0 Fehler/Skip,2,0min | sämtliche bisherigen Fälle plus6 Task-UI-,7 Recovery-,4 Offline-/Migrations- und1 Testseitenfall; `e03/browser-full.log`, `browser-results.json` |
| Produktionsbuild `npm run build` | Exit0 im vollständigen Browserlauf | aktuelle Rootquellen, Serviceworker/Offlineassets gebaut; keine Vorschau eines alten Servers |
| Gradle offline `:app:assembleRelease :app:testDebugUnitTest --rerun` | Build erfolgreich,680 Tasks,1min03s;73 Tests/6 Suiten,0 Fehler/Skips | isolierte Android-Buildkopie mit aktuellen Quellen; Testtask tatsächlich neu, Release-Lint aktiv. Reine Kotlinlogik, kein Hardwarebeleg |
| Tatsächliche APK-Metadaten und Inhalte | `de.frnkrm.anker`, rc.4/Code6, min26/target36;62 Webassets bytegleich zu endgültigem `dist` | SystemBars `css/contain` und `viewport-fit=contain` erhalten, Codekennung im Bundle; `e03/android/package-verification.json` |
| Paket/Signierhilfe | ZIP10 Dateien/CRC/alle Inhalte geprüft; Tools bytegleich zur bisherigen Signierhilfe2; Java-Metadatenleser und Syntaxprüfung erfolgreich |16 native Bibliotheken unverändert,4 ARM64-ELFs16KB-ausgerichtet, `zipalign -P16` grün. SDK-apksigner erwartungsgemäß ohne Signatur fehlgeschlagen. Kein Nutzerkey verwendet, keine Windows-Ausführung |

**Anforderungen an konkrete Fälle gebunden:**

| IDs | Tatsächlicher Nachweis |
|---|---|
| Q23 / TA-02 | `e2e/tasks.spec.ts`: globaler Tagesplan bei Arbeit, manuell geöffneter Abendschritt als tatsächlicher Capturekontext; ungespeicherter Entwurf→Reload→Speichern→identische Fokus-ID/Deadline. Notiz bleibt offen ohne Aufgabendatum. Arbeitskontext im synchronisierbaren Notizrecord nur „Arbeit“ |
| Q24 / TA-03 | derselbe Browserfluss: bewusst morgen→passendes Folgetagsfenster→Tag und Jetzt→ein gemeinsamer Abschlusszeitpunkt→Undo mit derselben ID |
| Q25 / TA-01 | `tasks-ui.spec.ts` und `state/tasks.test.ts`: vorhandene Aufgabe verknüpfen, keine Kopie; Löschung bereinigt Referenz und bewahrt Notiztext. Inbox→Work mit Tombstone/Rollback/Doppeltap/Importkonflikt |
| Q26/27 / TA-05 | lokale, editierbare Vorschau, bestätigter Teil bleibt bei anderer Detailtiefe/Reload erhalten; keine KI erforderlich. Echter SW-Offlinefluss unten benutzt vorhandene UI weiter |
| Q28 / TA-04 | `taskSelection.test.ts`, `support.test.ts`: aktive Arbeit stabil, echte gefährdete Frist begründet vorrangig, frühester Start/Kontext/Energie/kurzes Zeitfenster ehrlich, keine alte Freizeitgrenze über Abendroutine |
| Q29 / TA-06/07 | `tasks.spec.ts`: Arbeitsstart→Unterbrechung mit „Tabelle öffnen“ und Notiz→3 Tage→Jetzt→gleiche Aufgabe/Timer-ID/Restzeit; keine Arbeitszeitbuchung. Storetest erhält zwei verschiedene Notizen/Uhren bei Aufgabenwechsel |
| Q30 / TA-07 | `recovery.spec.ts`: Hilfetimer bleibt ohne Start2:00, nach bewusstem Start Pause/Reload/Weiter, unabhängig vom Routinefokus |
| Q31 / TA-08 | Routine-/Aufgabentimer aus Deadline und expliziter Restzeit; Pause/Reload, Ablauf ohne XP/Erledigung, bewusstes neues Fenster, Legacy-Start erst nach Commit entfernt. Browser-/Storebeleg, echter Android-Prozessabbruch bleibt offen |
| Q32 / TA-08 | zusammenfallende Marken nur ein Brückenaufruf, ausgeschaltet still; verspätete native Antwort nach Unmount löst keine Vibration aus. Keine echte Vibrations-/Hörprüfung |
| Q33 / TA-09 | bestätigte lokale Medianproben, Ausreißerfilter, Vorschlag nur auf ausdrückliche Übernahme, Reset; Undo entfernt verworfene Probe und erzeugt keine doppelte Ausführung |
| Q34 / FL-08-Voraussetzung | `game.test.ts`:3/30 Tage Nichtnutzung behalten Kapitelstart/Versuch/Joker/XP/Abzeichen, nur echte Erfolge zählen. `tasks.spec.ts`: synthetisches Altbackup über tatsächlichen Filechooser importiert, Serviceworker kontrolliert Seite, Kontext wirklich offline, Reload/Edit/Done/Undo/3Tage ohne Verlust alter Work-/Inbox-/Spiel-/Testdaten |
|03.3/03.4/IN-06 | Repositorytests mit SQLite-Transaktionsvertragsmock; Storetests für Commit vor Erfolg, UI-Edit nach wartendem Taskcommit, Merge→Bearbeitung auf aktuellem RAM, native Completion+Receipt+Wiederholung atomar. Effects-/Alarm-/Health-/Widgettests für späte Antworten, neueste Auswahl und Privacy |
| UX-01/02/03 | `tasks-ui.spec.ts`:320px/160%-Schrift ohne horizontalen Überlauf; Smoke-Interaktionsbudget. `device-tests.spec.ts`: alle10 E03-Links ändern keine Einstellungen, Aufgaben, Entwürfe, Fokus/Resume/Lerndaten und tragen keine automatischen Berichte ein |

**Reproduzierbare Rot-/Grünnachweise:** Nichtnutzungs-Strafpfad zuvor2 Tests rot (`e03/nonusage/`); alte Effects6/9 rot (`e03-effects-old-code-red.log`); Doppelbelohnung und Merge→Detailverlust vor Fix2/16 rot (`e03/atomic-integration-red.log`); alte Deadline-Revision nach Undo/Neuöffnung2/5 rot (`e03-deadline-revision-red.log`), danach inklusive nativer Storeaktion grün; SQLite-Import schrieb bei späterem Fehler zuvor einen halben Bestand (`e03/sqlite-import-red.log`), jetzt gemeinsames `executeSet(...,true)` mit LWW-Overlay. Zusätzlicher unabhängiger Review reproduzierte Transferkonflikt/Dauer-Undo/Unterbrechungsnotizverlust, danach3/3 grün (`e03-review-reproductions-{red,green}.log`).

Der erste integrierte Browserlauf lieferte56/58: alter Arbeitstest suchte den seltenen Unterbrechungsknopf vor „Details“, neuer No-Mutation-Test verglich persistierte Rohdaten mit nur im RAM normalisierten Migrationsdefaults. Bedienweg aktualisiert, Folgeroute nun ausdrücklich geprüft, No-Mutation-Erwartung auf exakte persistierte Vorher-/Nachherdaten korrigiert. Kein Produktfix für diese zwei Testabweichungen, keine abgeschwächten Daten-/Timererwartungen oder erhöhten Timeouts. Vollständiger frischer Nachlauf58/58. Erstlauf samt Trace/Screenshot unter `e03/browser-first-red*` aufbewahrt.

**Update:** `/workspace/artifacts/Anker-E03-Update.zip`,21996104Bytes, SHA256 `d404822aa775c934637cfe11cce788d21ec9b8d614ddc80ea5618bee9311e9fe`. Unsigniertes APK37753173Bytes, SHA256 `fbf66ad2c5df329c4ab700215877b19ba4264bd7ce1d8e1ae847973500133efb`. Quellkennung `e4541ce7f2587af4796541c6da5d81396a5542819106b79ff75759ec8a37bb2e`. Lokal signierbare Datei `Anker-E03-Update.apk`; bestehender Nutzerschlüssel bleibt auf Windows. Signierhilfe2 unverändert. SHA-/Inhalts-/Buildbelege unter `/workspace/.cache/anker/e03/android/`.

**Gerätestatus:** G76–G85 sind implementierte, offene geführte Prüfwege, keine bestandenen Hardwaretests. Bestehende Berichte werden erhalten und nach Suite/Quellkennung getrennt. Frühere G75-Rückmeldung bestätigt nur obere Anzeige; Fokus/Tastatur/Drehung/untere Navigation nicht zusätzlich bestätigt. Neue APK noch nicht vom Nutzer installiert; kein echter Prozessabbruch-/Sperrbildschirm-/Puls-/SQLite-/Widgetbeleg. Auch experimentelles Aktivitätswecken nicht als Schlafphasenmessung oder klinisch wirksam freigegeben. Keine KI-/Cloudaktivierung, Nachrichten, Releases oder Tags. Weitere optionale Launcher-Shortcuts/Sprachwege gehören zu E08; bestehende Ankommen-/Routinenregeln werden wiederverwendet, keine zweite Regelengine.

### E03: CI17 findet Puls-Navigationsrace

[Remote-CI17](https://github.com/frnkrm/anker/actions/runs/42254106105), Commit `5e46b17f171defe20040158a560f0f7f1a7745ab`, Job128016561701: Installation/Lint/Typecheck/499 Logiktests/Build/Browserinstallation grün,57 Browserfälle grün und genau1 rot (`recovery.spec.ts`, verspätete native Pulsantwort, erwartet0/erhalten1). Öffentliche GitHub-Annotationen und strukturierte Belege unter `e03/remote-ci/{result,status}.json`, `job-text.txt`.

Kein Testproblem wegerklärt: Während einer React-Router-Transition kann die URL bereits wechseln, obwohl die alte Fokusinstanz noch vor dem Unmount steht. Der bisherige Live-Ref ist dann noch gültig. Ein neuer deterministischer Plattformtest hält genau dieses Stadium mit Browser-History und weiterhin sichtbarer Fokusinstanz fest. Altcode rot mit1 statt0 Puls (`e03/pulse-navigation-red.log` samt Trace/Screenshot). Neuer Guard bindet `useLocation().pathname` beim Render und prüft die tatsächliche Browseradresse vor und nach den Awaits. Bestehende Alarm-/Off-/Sichtbarkeits-/Restzeit-/Session-Schranken erhalten.

Korrektur rc.5/Code7: frischer Build und8/8 Recoveryfälle grün (`e03/pulse-navigation-green.log`); Lint/Typecheck/499 Logiktests grün (`e03/pulse-fix-{lint,types,unit}.log`). Vollständiger59er-Nachlauf, neues APK und neuer Remote-CI folgen als eigene Nachweise. Kein Gerätetest aus der Race-Simulation abgeleitet.

### E03: korrigierter Abschlussstand rc.5/Code7

- **Implementiert und automatisch geprüft:** Appcommit `5c898a8448cca1bbfb030eff74ed3dd3a4fcf667` auf main, inklusive Pfadschutz für verzögerte Pulse. Vollständiger frischer Produktions-/Playwright-Lauf59/59,0 Fehler/Skips/Flaky,2,6min; Ergebnisse `e03/pulse-fix-full.log` und `pulse-fix-full-results.json`.499 Logikfälle/40 Dateien, Lint und Typecheck grün. Die neue deterministische Plattformregression ergänzt die bisherigen58 Fälle, kein Ergebnis weggelassen.
- **Remote-CI18 vollständig erfolgreich:** [Run42255441031](https://github.com/frnkrm/anker/actions/runs/42255441031), Job128021272705, exakt obiger Appcommit. Installation, Lint, Typecheck, Unit-Tests, Build und Browserinstallation erfolgreich; öffentlicher Reporter „59 passed (1.7m)“, keine Fehlerannotation. Gesamtdauer3min31s, Job3min28s. Strukturierter Schlussbeleg `e03/remote-ci/5c898a8/result.json`; CI17-Rotbeleg bleibt erhalten.
- **Native Verpackung erneut geprüft:** Release mit Lint erfolgreich (1min26s),73 Kotlinfälle erneut ausgeführt,0 Fehler/Skips. Tatsächliches APK `de.frnkrm.anker`,1.2.0-rc.5/Code7,min26/target36;62 Webassets bytegleich zum endgültigen dist. Quellkennung `3b102c5d15afe9e4950e565697e811edb2d0e0bd9a8f832aacfb927b4d370a5b`. SystemBars-/Viewport-contain unverändert,16 native Bibliotheken bytegleich und4 ARM64-ELFs16KB-ausgerichtet. Belege unter `e03/android-ci17-fix/`.
- **Aktuelles Updatepaket:** `/workspace/artifacts/Anker-E03-Update.zip`,21996214Bytes/10 Dateien, SHA256 `8903450c1bf9a98d4e9d3e71c6ba3b24cb486274db1c2dc49f7564bdfa7ec5de`. Unsigniertes APK37753189Bytes, SHA256 `01ca3808440e642acc9fd7b66e7df80eae217d42652c32d0b3d41dff947308cb`. SDK-freier Helfer2, Metadatenlesen, Syntax, ZIP-CRC und jeder Dateiinhalt geprüft; kein Nutzerschlüssel verwendet. Alte rc.4-ZIP/Ordner/Evidenz bleiben erhalten; sie sind nicht der aktuelle Download.
- **Git/Download:** main per Fast-forward auf5c898a8 gepusht; Remote bestätigt. Getrennter Paketbranch `download-anker-e03-rc5-20261106`, Commit `736f2a7195be8b2406cd053858b6f7e443f63a63`; keine Binärdatei im Appmain. [Tatsächlichen HTTPS-Download](https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e03-rc5-20261106/Anker-E03-Update.zip) vollständig wieder eingelesen:200,21996214Bytes, identische SHA256 (`e03/https-rc5-verification.json`). Privates Original unverändert/ignoriert. Anschließender Dokumentationscommit trägt `[skip ci]`; Appquellen und geprüfte APKkennung bleiben identisch.
- **Echte Android-Prüfung weiterhin offen:** neue Installation/Datenübernahme durch Nutzer noch nicht bestätigt. G76–G85 bleiben offen; Browser-/History-/Nativebrücken-Simulation ersetzt weder Prozessbeendigung noch tatsächliche Vibration/SQLite/Widgetzustellung. Frühere G75-Teilbestätigung nur obere Anzeige bleibt erhalten. Nächster Nutzerweg ist zunächst G76 mit Direktlinks; keine vollständige85er-Prüfung verlangt. Kein Tag/Store-Release und keine externen Nachrichten.

## E04 – integrierte flexible Planung, 06.11.2026

Ausgang `59c530f`, sauber, archiviert mit339 Einträgen und geprüftem gzip/tar-Roundtrip; SHA256 `d7128621da7409121db12f1a201ace244b661e549499432008da29e8553e2b9a`. Auftrag E04–E09 und gemeinsame spätere Handytests freigegeben, parallele Sourcearbeit ausschließlich getrennte Worktrees.

Rootstand `7213062`: Lint/Typecheck,550 Vitest/47 Dateien bestanden, frischer Produktionsbrowser29/29 (System-Chromium155, eigener Port4213,1,3min,0 Skips/Flaky). Dateien `e04-e09/e04-integrated-{lint,types,unit}.log`, `e04-browser.log`, `e04-browser-results.json`. Testauswahl E04 neu8, Zielgrund1, bestehende Abend-, Papier-, Native-Navigations-/Weckfenster- und Recoverywege. Getrennte Vorarbeit für spätere Anbieterbasis wurde nicht als mit echtem Provider geprüft ausgewiesen.

FL02/03/Q39:4 reale Undo-Altfälle rot (`e04/undo-red.log`), danach private Snapshotbasis+Log gemeinsam putMany, begonnene Fahrt/Arbeitsreferenz und alte Termine erhalten. Zusätzlicher Racefall: später echter done/minimal darf nicht von altem Heute-anders-Dialog ersetzt werden (`latest-confirmation-red.log`), nach Fix9/9 Storefälle grün. FL05/Q38/79: alte Publikation3/3 rot (`e04-e09/pc-publish-red.log`), danach neue zeitgebundene PC-Pause/Revision und ehrlicher Fehler-/Publikationsstatus;20 gezielte PC-/Export-/Syncfälle grün. Die Windows-Skripte wurden bis hier nicht unter Windows ausgeführt; kein Empfang/Abbruch auf Nutzer-PC behauptet.

FL07/Q40: Regelquelle, echte Vorabendhandlung und heutiges uncoveredSteps im Browser; Tagesdruck zeigt denselben Bedarf ohne neuen Abschluss/XP. FL06: Später-Rückfrage bleibt ohne erfundene Heimkehr. UX: Fokus→Heute anders bewahrt Uhr/erledigt nichts, passive Spielrückmeldung lässt Fokus bedienbar. Echter optionaler Weckwunsch verwendet gemeinsamen aktuellen Native-ACK-Vertrag; im Web ausschließlich Planbestätigung. Nutzer-Geräteberichte bleiben unberührt/offen.

## E05 – Arbeitszeit,06.11.2026

Integriert `82450dc`/`b41f6c6`/`f877be2`: Lint/Typecheck,572 Vitest/49 Dateien,19/19 Playwright gegen frischen Produktionsbuild (System-Chromium155,4213,1,1min,0Skip/Flaky). Neue8 Arbeitszeitfälle plus11 bestehende Smoke-Fälle. Nachtragkonflikt, atomare Rücknahme, offene Pause/Endschätzung, individuelle Wochenwerte, Nachtdatum und manuelle Altzeit geprüft. Logs `/workspace/.cache/anker/e04-e09/e05-integrated-*`, `e05-browser*`. Weitere echte reguläre Nachtschicht-Kontextregression ist getrennt behoben und folgt vor Abschluss. Keine neuen Geräteergebnisse.

## E06 – gemeinsame lokale Wege/Morgenplanung

603 Vitest/52Dateien, Lint/Typecheck grün; frischer Produktionsbuild4213/System-Chromium155:6/6PW,0Skip,35,3s (`e04-e09/e06-*`). Vier neue lokale Reise-/Morgenfälle und zwei echte über04:00 fortgesetzte Nachtkontexte; keine Hardwareausführung. PC-Script2 zusätzlich mit echter PowerShell7.5.4 unter Linux,19/19 Fälle plus4 Parser grün (`pc-proof-approved.log` und `pc-proof/anker-pc-stop-yyZ2u0`). Vorher13/15 beim alten Script, danach19/19 einschließlich neuer Randfälle; native Windows-Scheduler/Toast/Shutdown ausdrücklich offen.

## E07/E08 – gemeinsame optionale Bedienwege

Wetter/Packen6/6PW inkl Großschrift, Stadtwechsel/fehlendeDaten/Offline. Danach integrierter E08-Stand689Vitest/65Dateien+Lint/Typecheck;18/18frischeProduktions-PW,0Skip,1,1min (4Extras,2Geofences,6KI,6Traffic). KontrollierteAnbieter-HTTP/Androidbrücken, keinEchtanbieter/Hardware. Logs `e04-e09/e07-*`, `e08-*`. Native isoliert87JUnit+Compile `e08/android-final.log`; finalerRootstandwirdnochgebaut. OffeneRepro-ReviewfixeswerdenalszusätzlicheAbschlussänderungengeführt.

## E09 – integriertes Zwischengate

725Vitest/71Dateien, Typecheck/Lint grün.27/27frischeProduktions-PW auf4213/System-Chromium155,0Skip,1,4min:Backupvorschau/PartialImport,Storagefehler/Retry/Weckernotfall,A11yundTestseite. Logs `/workspace/.cache/anker/e04-e09/e09-*`. WeitereReviewfixesundQ84sindnochinArbeit, finaleGesamtprüfungfolgt. NeueGeräteberichtebleibenoffen.
