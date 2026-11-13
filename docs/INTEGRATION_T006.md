# T-006 – lokale Softwareintegration und offene Gesamtfreigabe

Stand 13.11.2026, Europe/Berlin. Verfügbare saubere Basis `4f3179c36afaa3408a1a57fc26d4a5a458c516bf`, Branch `entwicklung/anker-neu`. **Web-/Logik-/PC-Prüfanteil lokal abgeschlossen; T-006/V-014 insgesamt IN_ARBEIT.** Aktueller Android-Paketstand, E-002–E-005 und Releasefreigabe offen. Finale Commit-ID im lokalen Abschlussbericht, keine selbstreferenzierende Dateischleife. Alte Umgebung/835235b zurückgestellt.

## Prüfgrund und tatsächlicher gemeinsamer Stand

F-001–F-010 waren einzeln geprüft, zuletzt nur gezielte Auswahlen. Ein gemeinsamer vollständiger Logik-/Browsernachweis über alle Funktionen fehlte. Daher einmal vollständig geprüft, anschließend ausschließlich betroffene rote/fehlende Fälle nachgeprüft. Keine Produktfunktion implementiert und keine Produktquelle geändert.

| Prüfung | Tatsächliches Ergebnis | Grenze |
|---|---|---|
| Vollständige TS-/Logiksuite | **1372/1372 in133Dateien**,0Fehler/Skip | Einschließlich Store, Backups, Datenschutz, Reminder, Guidance, Fokus/Recovery und neuer F-Funktionen; keine Hardwareaussage |
| Vollständiger Browserlauf | **375/378 sofort grün**,3belegte veraltete Testannahmen; danach **3/3 gezielt grün**.378verschiedene Fälle zuletzt grün,0automatische Retries/Skip/Flaky | Kein zweiter Vollauf; letzter Stand maschinenlesbar in browser-coverage.json. Kein neuer GitHub-CI-Lauf |
| Python-PC-Suite |284verschiedene Fälle zuletzt grün: zunächst268grün/12QR-Methodenrot/4PowerShell-Skips (14Fehlermeldungen einschließlich Unterfällen); nach Abhängigkeitseinrichtung12QR grün,4Helper zunächst Cachefehler, danach4/4grün | Nur betroffene16 und danach4 Fälle wiederholt; pc-python-coverage.json führt284letzte Ergebnisse. Fake-Windows/Loopback, keine reale Windowswirkung |
| Node↔Python |Lokale gepinnte HTTPS/TLS-Interoperabilität erfolgreich: ACK/Outbox/Replay/Tamper/Pin und simulierte Bestätigung; Systemeffekte0. CLI --help Exit0 | Keine physische Bestätigung, kein PC-/Telefon-/Heimnetzgerät oder Begleiterstart |
| PowerShell-PC-Stopp |19/19isolierte Fälle und4exportierte Parser grün | PowerShell7.5.4 aufLinux, Fake-OS-Grenzen; kein Task/Toast/Shutdown |
| PC-Paketprüfung |5/5grün, einschließlich realer Installerfunktionen mit Fake-Effekten/temporärem Quellpaket | Kein installierter oder veröffentlichter Windows-Begleiter |
| Relay-SQL/RLS |16/16mit PGlite0.5.16, tatsächliche PostgreSQL-Migration/RLS im lokalen WASM-DB-Test | Kein Supabasezugriff, pg_cron nicht ausgeführt |
| Android-Update-Grenzen |33Offlinefälle plus3zunächst werkzeugbedingt fehlende PowerShell-Mockfälle grün, insgesamt36 | Künstliche Schlüssel/APK-/Toolantworten, keine Appsignierung |
| Play-Werkzeuggrenzen |75Upload-/24Auth-/35Workflowfälle =134Offlinefälle grün | Ausschließlich künstliche Antworten, keine Googleanfrage, OAuthfreigabe oder Play-Aktion |
| Lint/Typecheck/Build |0Lintfehler/1bekannte TaskAssistance-Warnung; Typecheck und Produktionsbuild durch beide Playwright-Webserver grün. Nach Testkorrekturen gezieltes ESLint/e2e-Typecheck grün | Keine Pakete/Versionen/Prüfregeln/Timeouts gelockert |
| Native Bestandssuite |274/274in31Suiten aus F-008 erhalten, alle79Dateihashes des Sicherungsordners geprüft. Android-/NFC-/TS-Brückenquellen seit `5668aec` identisch | Nicht erneut ausgeführt, kein aktueller Android-Paket-/Gerätenachweis |

## Belegte Korrekturen und Werkzeuge

- Sechs Screenshots in vier Specs lagen auf festen alten /workspace- oder /tmp-Pfaden. Jetzt ausschließlich info.outputPath im jeweiligen Testordner; alte Sicherungen werden nicht überschrieben. Vorhandene F-008/F-009/F-010-Sicherungsmanifeste vollständig unverändert geprüft.
- Zwei Abendfälle erwarteten alte Literaltexte vor F-006. Nun aktuelle gemeinsame Übergangsregion prüfen: Freizeit vor PC-Stopp, PC-aus-Handgriff zur Grenze, Bett danach; keine automatische PC-/Bettbestätigung aus Uhrzeit. Offenes Ende bleibt ohne erfundene Uhrgrenze. Erwartungen semantisch erhalten und präzisiert.
- Ein Q84-Backupfall erwartete trotz T-005 eine fremde Routenfreigabe. Erwartung auf JSON-Datengrenze und ausdrücklich fehlende importierte Freigabe korrigiert; komplette übrige Daten, Weckwahl, Pause und Reload weiter geprüft. Keine Produktänderung oder Sicherheitslockerung.
- Erforderliche fehlende Testwerkzeuge außerhalb des Repositorys unter `/workspace/anker-t006-tools-20261113/`: qrcode8.2/zeroconf0.154.0 gemäß bestehenden requirements (ifaddr0.2.0 transitiv), vorhandene übrige Pythonversionen unverändert. PGlite0.5.16 exakt gemäß CI. PowerShell7.5.4 aus offizieller Quelle, offizieller SHA256-Abgleich (UTF-16-Prüfsummenliste), keine globale Installation. Beschreibbare XDG-Pfade beheben den anfänglichen schreibgeschützten PowerShell-Cache. `env.sh` aktiviert nur diese Prüfwerkzeuge, keine Cloudkonfiguration. Ein erster Relay-Aufruf hatte noch keinen eingerichteten Modulpfad; danach echte Paketverfügbarkeit geprüft, installiert und alle16SQL-Fälle grün.

## Workflows ausschließlich lesend geprüft

| Datei | Auslöser und Wirkung |
|---|---|
| [ci.yml](../.github/workflows/ci.yml) |Jeder Push und PR: Web-/Offlinewerkzeugtests, PostgreSQL-Test, PowerShell und Pythonmatrix Ubuntu/Windows. Kein Produktrollout aus dem Checkjob, aber Windows-Quellpaket als Actions-Artefakt |
| [release.yml](../.github/workflows/release.yml) |Push eines v*-Tags: Release-APK mit Secret-Schlüssel signieren, GitHub-Release erstellen und APK hochladen/ersetzen |
| [android-update.yml](../.github/workflows/android-update.yml) |Manueller Dispatch auf main: exakten grünen main-Stand prüfen, native/unsignierte Artefakte bauen; separater Job kann mit bestehenden Secrets signieren und Actions-Artefakte ausgeben |
| [google-play-upload.yml](../.github/workflows/google-play-upload.yml) |Dispatch aufmain oder main-Push mit Änderung genau dieser Datei und [anker-play-draft]/[anker-play-inspect]. Dispatch wählt Upload; nur Inspect-Pushmarker wählt Inspect, dieser gewinnt bei beiden Markern. Exakt freigegebenes Bundle/CI/Hashes binden, reale Google-API/OAuth und internen Entwurf/Readback ausführen. Kein pauschal harmloser Dispatch |
| [play-upload-diagnose.yml](../.github/workflows/play-upload-diagnose.yml) |main-Push mit Dateiänderung und [anker-play-report]: vorhandenen fest gebundenen fehlgeschlagenen Actions-Bericht lesen; kein Googlezugriff |
| [netlify.toml](../netlify.toml) |Deklariert npm-Build/Node24/dist/SPA/Serviceworkerheader; tatsächliche externe Konto-/Deploybindung hier nicht verifiziert |

Keinen Workflow gestartet oder geändert, keinen Push/Tag/Merge, keine Play-/Cloud-/Signieraktion. Aktuelle Nutzergrenzen überstimmen historische Uploadaufträge. Offline-Prüfskripte sind keine Ausführung der beschriebenen Dienste.

## Aktuell belegte offene Grenzen

1. Frische lesende Git-Referenzabfrage bestätigt main `e48d2892846b4a2fec45bf0cefc396e1a4c92f10` und Entwicklung `6dfa632c94422d61d6a71c6a4a72c15fefd4a407`. Arbeitsbasis ist17lokale Commits voraus. PR2-Status und exakte neue Remote-CI nicht abgefragt/belegt. Kein Fetch/Push oder Workflowstart; lokales Grün ist kein Remote-CI-Erfolg.
2. `android/app/src/main/assets/public/index.html` ist vorhanden, aber nicht bytegleich mit aktuellem dist/index.html; Hashes in android-package-gap.json. Kein frischer nativer Paketbuild für F-001–F-010, kein Capsync/Release-/Debug-APK-Bau oder Signieren in diesem Task. Gültige historische JUnit ersetzen dies nicht.
3. Anwendung bleibt standardmäßig Code17/1.5.0-rc.3. PLAY_UPLOAD_APPROVAL/AKTUELLER_UPDATESTAND sind unverändert auf `80f6a692b005ab08edacf9e6ad9e9669e4c383f7` gebunden, nicht auf diesen Integrationsstand. Keine aktuelle Bundle-/Versions-/CI-/Uploadfreigabe daraus ableiten. Play-Bestand nicht erneut abgefragt.
4. Lokale keystore.properties und vier Android-Signierumgebungsbindungen sind aktuell nicht vorhanden. Nur Konfigurationsvorhandensein geprüft, keine privaten Schlüssel gesucht/gelesen oder verloren behauptet. Historische externe Schlüsselsicherung ist weiterhin nicht aktuell bestätigt; öffentlicher B4-Fingerabdruck beweist keinen verfügbaren privaten Schlüssel.
5. E-002 Galaxy-/Wecker-/Sperr-/Zustellungsbeobachtung, E-003 Windows-Scheduler/Toast/Audio/Shutdown, E-004 echtes Kalenderkonto/Rechte und E-005 NFC-Hardware/Tags/Lifecycle bleiben offen. Kein Gerät installiert oder eine Beobachtung angehakt. Alle103historischen Gerätezeilen erhalten; separate geeignete Buildzuordnung und Freigabe erforderlich.

**Nächster eigener Einzelauftrag:** T-006 fortsetzen mit einem ausdrücklich begrenzten lokalen **unsignierten Android-Integrationsbuild** samt Abgleich aktueller Webassets/Manifest/Quellkennung. Vorher Signierkonfiguration und Gradletasks erneut prüfen; wenn Signaturfreiheit nicht eindeutig gewährleistet ist, mit genauem Blocker stoppen. Keine Geräteinstallation, Versionsänderung, Signierung, Veröffentlichung oder Play-Aktion daraus ableiten. Gesamtfreigabe bleibt auch danach von echten Geräte-/Remote-/Releasebelegen abhängig.

## Sicherung und Wiederanlauf

Rohbelege `/workspace/anker-t006-20261113/`: JSON-/Textberichte beider Browserläufe, 1.372er-Logiksuite, Pythonphasen, PowerShell/SQL/Interoperabilität/Paket-/Offlinewerkzeugtests, öffentliche Toolquellen-/Hashmetadaten, Workflow-/Build-/Quellintegrität und Remote-Readback. Nach einem Umgebungsneustart exakt dieselbe Basis, sechs Testkorrekturen und abgeschlossene Berichte erneut auf Vorhandensein geprüft; keine erfolgreichen Suiten neu gestartet. Umgebung wieder running/current, keine Cloudänderung.

Vorher-/Nachher-Bundles, unabhängiger Wiederherstellungsklon/fsck/Quellhashes, RESTORE.md und SHA256SUMS sichern den lokalen Abschluss. Toolbinaries/SDK/JDK, persönliche Appdaten und alte Cloud-Arbeitsbäume gehören nicht ins Git-Bundle. Neue Testwerkzeuge und Einrichtung separat im Prüfverzeichnis dokumentiert. Nur Cloud-lokale Sicherung, keine bestätigte externe Kopie. Nach diesem Auftrag stoppen; keine automatische Fortsetzung.
