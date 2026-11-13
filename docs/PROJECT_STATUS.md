# Aktueller Übergabestand

Stand 13.11.2026, Europe/Berlin. **T-002-Nachbereitung: native Android-Prüfumgebung abgeschlossen.** Ausgangsstand `a820115284cf22938e96dd1e4ea115764158575e`, Branch `entwicklung/anker-neu`, Arbeitsbaum `/workspace/anker`, zu Beginn sauber. JDK21, SDK/API36 und gebundener Wrapper funktionieren;252/252 Android-JUnit in28Suiten erfolgreich. F-001/F-002 und T-004 bleiben abgeschlossen. Nächster möglicher Einzelauftrag F-003 erst nach gesonderter Beauftragung. Keine Produkt-/Test-/Projektversionsänderung, Signierung, Geräteinstallation oder Veröffentlichung.

## Arbeitsbasis und Verfügbarkeit

- T-001 ist nach ausdrücklicher Nutzerentscheidung gesichert pausiert. Originalumgebung und `835235b` bleiben zurückgestellt und sind keine Voraussetzung. Mögliche spätere Wiederherstellung separat sichern/vergleichen; keine automatische Übernahme oder Rekonstruktion.
- Lokale Historie: `6dfa632` (vollständiger Nutzerplan), `f7fa4e3` (Planungsdokumentation), `e421ee5` (Testkorrektur). Einrichtungsabschluss `32b9a15`, F-001 `8149ece`, F-002 `b669856`, T-004 `a820115`, darauf der lokale native T-002-Abschluss. Die finale Commit-ID steht im Abschlussbericht, nicht als selbstreferenzierende Dateischleife hier.
- Letzte erfolgreiche Remote-Abfrage in dieser Unterhaltung: main/HEAD `e48d289`, Arbeitsbranch/PR2-Head `6dfa632`. Lokale Nachfolgecommits wurden nicht gepusht. PR2 laut Nutzerscreenshot/-bericht offen und nicht gemergt; kein aktueller unabhängiger API-Nachweis (`Forbidden`). Beim Wechsel in einen anderen Task zuerst prüfen, ob dieser lokale Abschluss tatsächlich vorhanden ist; ein Prompt überträgt keine Commits.
- Seit F-001/F-002 gezielte TS-/Jetzt-Änderungen und neue Logik-/Store-/Browsertests. F-002 ergänzt optional `DayOverride.shortMorning` samt Sicherungsvalidierung und bestehender atomarer Tagesplanaktion; keine neue DB-Tabelle, Engine oder Schreibqueue. Android, Reminder-Regeln und Paket-/Lockdateien unverändert. e2e-Timerkorrektur aus `e421ee5` erhalten. Keine neue Release-/Gerätezusage. Nutzer-Screenshot zu GitHub-Lauf43331316553: 307/308 Browserfälle, Timerstart erwartete675000/tatsächlichundefined. Dieser Remote-Lauf bleibt historisch rot; kein neuer Runnerlauf ausgelöst.
- Branch `work` bis `02e0a01` und frühere Bundles bleiben erhalten. `/workspace/anker-ci-fix-20261113/after.bundle` erfolgreich verifiziert; Original-/Planungssicherungen unter `/workspace/anker-recovery-20261113/` und `/workspace/anker-preparation-20261113/`. Nur Cloud-lokal, keine bestätigte externe Sicherung. Fehlende Originaldateien werden nicht als verloren ausgegeben.

## Abnahme T-002 / E-001 / T-003

| ID | Abschlussnachweis | Verbleibende Grenze |
|---|---|---|
| T-002 | Web-Abnahme erhalten; vollständiges JDK21/SDK36/Build-Tools35.0.0 eingerichtet, Wrapper8.14.3 und252/252 Android-JUnit bestätigt | Reale Android-/Windows-/Kalenderbeobachtungen offen; keine Cloud-Konfiguration geändert |
| E-001 | Cloudstatus aktuell running/enforced; Git-Lesen und API-Grenzen geklärt; keine Secretbindungen/Identitäten; Nutzerwahl GPT-6.1 Sol/Hoch bestätigt | Keine Konto-/OAuth-/Play-Freigaben erteilt; fehlender Zugriff ist dokumentiert, nicht repariert |
| T-003 | Alle36 IDs samt V-Zuordnungen, Abhängigkeiten und Originalabnahmen erfasst; eine Roadmap, ein Status, genau drei Fallvorlagen; Links und Widersprüche geprüft | F-001 inzwischen lokal umgesetzt; spätere Aufgaben einzeln beauftragen |

Integriert: ja im lokalen Arbeitsbranch; nein auf main und nicht als neue GitHub-Verfügbarkeit bestätigt. Gerätetest für diesen Dokumentationsabschluss nicht nötig; veröffentlicht nein. Vollständige App-/Android-/Windows-Prüfung oder Releasefreigabe ist kein Teil dieser Abnahme.

## Umgebung und reproduzierbare Befehle

Aktive Umgebung `ccarenv_b64_Y2NhcmVudl83ZjQ4ZDgwMDU0ZTA4MTkxYjYzNTY1ODdjOWI2NjRhZA`, Status am Abschluss erneut running, Beobachtungen aktuell, Netzwerkpolitik enforced. Keine Secretbindungen/Laufzeitvariablen. Keine Cloud-Einstellungen verändert. Der zuletzt lesbare Konfigurationsentwurf hatte kein Installationsskript und Repository-ref `main`; tatsächlicher Arbeitsbranch bleibt `entwicklung/anker-neu` und muss beim nächsten Task geprüft werden.

Node24.22.1, npm11.9.0, Python3.12.14, nun vollständiges lokales JDK21.0.13 (vorher nur Java-Runtime); installiertes System-Chromium156.0.8078.79. Web-Abhängigkeiten vorhanden, `npm ls --depth=0` erfolgreich. Kein erneutes `npm ci` ohne Anlass. Falls die Abhängigkeiten nach Umgebungswechsel fehlen: `npm ci --cache /tmp/anker-npm-cache --no-audit --no-fund`. Dieser Cachepfad vermeidet den zuvor nicht beschreibbaren Standardcache. Lockdateien und Paketversionen bleiben erhalten.

Geprüfte Repositorybefehle: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Passende Tests gezielt auswählen; keine automatischen Systemwirkungen starten. `npm run test:pc` benötigt PowerShell; Native-Unit-Tests `node scripts/gradle.mjs :app:testDebugUnitTest` benötigen die Android-Einrichtung. PC-Python-Tests aus `pc-companion` mit `python -m unittest discover -s tests -v`, Abhängigkeiten später bei Bedarf isoliert installieren.

Standard-Playwright-Browserdownload ist mit `403 Domain forbidden` blockiert. Für lokale Webtests existiert eine getestete Konfiguration mit installiertem Chromium; sie ändert nur Browserpfad, absolute Verzeichnisse und Reporter, nicht Prüfregeln/Timeouts/Retries:

```bash
cd /workspace/anker
CI=true npx playwright test --config=/workspace/anker-ci-fix-20261113/local-playwright.config.ts e2e/subtask-timer.spec.ts e2e/redesign-controls-extra.spec.ts --workers=2
```

Konfiguration und Systembrowser vor neuem Task auf Existenz prüfen; Testausgaben gehen nach `anker-ci-fix-20261113/test-results`. Vor späterem Wiederverwenden relevante alte Fehlerartefakte separat erhalten. Falls die lokale Hilfsdatei fehlt, aus `playwright.config.ts` außerhalb des Repositorys eine Konfiguration mit `use.launchOptions.executablePath: '/usr/bin/chromium'`, absoluten Test-/Ausgabepfaden und Webserver-cwd erstellen; keine CI-Datei ändern. F-001 benötigt keinen nativen Transport und keine neuen Berechtigungen. JDK/SDK werden im jeweiligen Shellaufruf durch `/workspace/anker-toolchains/env.sh` aktiviert; globales Gradle, adb und PowerShell wurden nicht installiert. T-004s Planung ist abgeschlossen; echte Galaxy-/Windows-/Kalenderbeobachtungen bleiben E-002–E-004 offen.

Optionaler, nicht angewendeter Vorschlag für das Cloud-Installationsskript:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /workspace/anker
npm ci --cache /tmp/anker-npm-cache --no-audit --no-fund
```

Nur falls später gewünscht: in „Umgebung bearbeiten“ das Setup-/Installationsskript eintragen und speichern. Keine manuelle Browserhandlung ist für die jetzige lokale Weiterarbeit erforderlich. Keine Veröffentlichung der Umgebung beauftragt.

## Grenzen und Nachweise

[OFFENE_ENTWICKLUNGEN.md](OFFENE_ENTWICKLUNGEN.md) ist die einzige ID-Roadmap, [ANKER_PLAN.txt](ANKER_PLAN.txt) das unveränderte Anforderungsinventar einschließlich Abnahmen/Prüfstrategie. Architektur in [STRUKTUR.md](STRUKTUR.md), Nachweise in [ANKER_TESTNACHWEISE.md](ANKER_TESTNACHWEISE.md), drei Vorlagen in [PROMPT_TEMPLATES.md](PROMPT_TEMPLATES.md).

Erhaltene Prüfung aus dem unmittelbar vorherigen Task: 15/15 gezielte Browsertests und Produktionsbuild grün; Lint0Fehler/1bestehende Warnung. Kontrollierter roter Versuch belegt das Timer-Eingabe-Rennen. Rohberichte und `RESULT.json` unter `/workspace/anker-ci-fix-20261113/`. Unveränderte erfolgreichen Prüfungen nicht wiederholt; keine neue vollständige App-/Gerätesuite behauptet.

Keine Pushes, Merges, Workflow-/Cloudänderungen oder Google-Play-Aktionen. CI läuft bei Push/PR; Play-Dispatch wählt Upload; Play-Pushpfad verlangt main/Workflowänderung/Marker; `v*`-Tags veröffentlichen APK-Releases. Externe Netlify-Kontoverknüpfung nicht unabhängig sichtbar. Historische Uploadaufträge sind für diese Einrichtung und F-001 keine Veröffentlichungsfreigabe. Aktueller Play-Bestand bleibt separat unbestätigt.

## F-001-Abschluss

`src/core/departure.ts` ist eine reine Projektion vorhandener Büro-/Terminwege, Morgenroutine und vom Planer bereits überlappungsbereinigter Vorbereitungsblöcke. Anzeige unter der Hauptaktion: Restzeit, geschätzte offene Vorbereitung, rechnerischer Puffer oder ehrlicher Hinweis auf offene Zeiten. Erledigte/entfallene Routine-Schritte nicht erneut zählen; explizite Wegbestätigung entfernt die jeweilige Karte. Homeoffice erzeugt keinen Büro-Weg; gesonderte Termine bleiben möglich. Vergangene Abfahrt bleibt negativ, beendet keine Routine und vergibt keine XP. Physische Restzeit aus bestehenden Berliner UTC-Konvertierungen, auch nach Mitternacht und bei Zeitwechseln. Nach 04:00 kein alter Plantag. Kein zweiter Planer, keine neue Persistenz oder Reminder.

Prüfung auf gemeinsamem F-001-Code: **1.206/1.206 Logiktests** (23 neu), **15/15 ausgewählte Browserfälle** (5 neu, 6 bestehende Jetzt-/Layoutfälle und 4 Termin-/Wegefälle), Typecheck/Produktionsbuild grün; Lint0Fehler/1bestehende Warnung. System-Chromium156, 320px/160Prozent Schrift geprüft. Erster Buildversuch erkannte einen fehlenden Datumsparameter in neuer Browserfixture; korrigiert, danach Typecheck/Build/Browser grün. Historische Erstfehlerlogs bleiben erhalten. Keine neue vollständige Browser-/Android-/Windows-Suite oder erfolgreiche GitHub-CI behauptet. Echte Galaxy-/Windows-Beobachtungen weiterhin offen.

Nachweise `/workspace/anker-f001-20261113/` einschließlich Logs, `RESULT.json`, Vorher-/Nachher-Bundles und SHA256-Verzeichnis. Integriert lokal ja, auf main nein; veröffentlicht nein. Sicherung nur Cloud-lokal. Zum damaligen F-001-Abschluss waren F-002/F-003 nicht implementiert; F-002 ist im folgenden Abschnitt abgeschlossen, F-003 bleibt offen.

## F-002-Abschluss

`core/morningShort.ts` verwendet die F-001-Projektion: nur bei bekannter Abfahrt, bekannten Dauern, negativem Vorbereitungspuffer und noch positiver Restzeit. Die Vorschau zeigt ausschließlich offene Schritte mit echten kürzeren benannten Varianten. Bereits kleine Varianten, fehlende Zeiten, Erledigungen/Entfall und abgelaufene Abfahrt erzeugen kein neues Angebot. Auch wenn die kurze Schätzung nicht reicht, bleibt eine freiwillige Wahl mit ausdrücklichem Hinweis möglich.

`MorningShortOffer` erscheint unter der Abfahrtskarte. **Kurzmodus übernehmen** ist die ausdrückliche Bestätigung. Der Store revalidiert Plan und Fakten innerhalb derselben vorhandenen Schreibqueue. Alter Plan, neue Erledigung, wartender konkurrierender Auftrag, Tages-/Zeitablauf und Wiederholung werden vor dem Schreiben verworfen. Ein optionaler Tages-Override `shortMorning` wählt im vorhandenen Planer nur kürzere Morgenvarianten; alle IDs, Erledigungen und Kernschritte bleiben. Abend und globale Unterstützung unverändert. Bestehende Tagesplan-Rücknahme bleibt verfügbar, kein gesonderter Undo-Writer. Alte Sicherungen ohne Flag bleiben gültig; neuer optionaler Wert ist streng boolean-validiert.

**So lassen** ändert keine gespeicherten Daten und blendet dasselbe Angebot in dieser Ansicht auch über Uhrticks aus. Nach neuem Plan oder erneutem Öffnen der Ansicht kann wieder ein Angebot erscheinen; kein dauerhafter Tages-Stummschalter behauptet. Speicherfehler bleiben sichtbar und erlauben erneute Annahme. Die Wahl löst keine Erledigung oder Punkte aus, auch nicht für vorher unquittierte Handlungen; dafür überspringt allein dieser neue Transaktionspfad die sonst übliche Awardauswertung. Andere Tagesplanaktionen behalten ihr Verhalten.

Prüfung final: **1.224/1.224 Logiktests** in119Dateien (18 neu), **17/17 ausgewählte Browsertests** (6 neu, 5F-001 und6Jetzt-/Layoutregressionen), Typecheck und Produktionsbuild grün, Lint0Fehler/1bestehende Warnung. System-Chromium156; 320px/160Prozent Schrift, Persistenz/Reload, explizite Annahme und tatsächlicher Minimalabschluss geprüft. Storetests belegen Doppeltippen, Stale-/Queueprüfung, Fehler/Rücknahme und Sicherungsgrenzen. Keine neue komplette Browser-/Native-/Windows-Suite, keine echten Geräte oder grüne GitHub-CI behauptet.

Rohbelege unter `/workspace/anker-f002-20261113/`: frühe Tests/Fehlerlogs, `first-browser-results/` (XP-Nebenwirkung vor Korrektur), finale Logs/Bildbelege, `RESULT.json`, Vorher-/Nachher-Bundles und SHA256-Verzeichnis. Nur Cloud-lokal gesichert, auf main/GitHub nicht übernommen, veröffentlicht nein. Keine F-003-Implementierung, neuen Reminder, Dienste, Berechtigungen oder Paketupdates.

## T-004-Abschluss und damaliger Toolchainblocker

Maßgeblicher Prüfplan: [GERAETETEST.md, T-004-Abschnitt](GERAETETEST.md). Bestehende103 Geräte-IDs und sämtliche Ergebniszellen unverändert. F-003 ist nicht implementiert. Gezielte TS-/Store-/Bridge-/Kotlin-/Browserpfade und G21/G38/G66–G71 für dynamischen Impuls, Abfahrt, Revision, Doppelschutz, Ruhe/Fokus und Budget dokumentiert; Wecker separat G1/G22/G35–G37. Kalender G94/G35–G39, Windows G97/G98/G102/G103. Historische `ok` gelten nur für damalige Builds, keine neuen Geräteerfolge. Lokales `b669856` ist nicht der installierte Code17-Stand; Buildzuordnung bleibt Voraussetzung echter Beobachtung.

Beim T-004-Abschluss vor der folgenden Nachbereitung: Wrapper8.14.3 ausführbar/JAR lesbar, AGP8.13.0, Kotlin2.4.21, SDK compile/target36/min26. Aber kein javac in PATH/vorgefundenen JVMs und kein konfiguriertes SDK/sdkmanager/adb; Java-Runtime allein reicht nicht. `ci.yml` enthält keinen Android-JUnit-/App-Buildjob. Kein Wrapperstart, Download, SDK-Lizenzannahme, JUnit-, Browser- oder Hardwarelauf in dieser Vorbereitung.

Damals kleinste Folgearbeit, inzwischen unten erledigt: **T-002 gezielte Nachbereitung für native Android-Prüfungen**; die bisherige Web-Abnahme bleibt erhalten. Vollständiges JDK21, Android-Commandline-Tools und API36-Plattform plus tatsächlich von AGP verlangte Build-Tools einrichten; genaue Defaultversion erst aus offizieller AGP-Auflösung bestimmen (Repo pinnt keine Build-Tools). Kein globales Gradle, Emulator oder Android-Studio-Komplettpaket nötig. Native `:app:testDebugUnitTest` danach prüfen; keine Signierung, Veröffentlichung, Geräteinstallation oder F-003-Implementierung. Dieser damalige Blocker wurde durch die folgende ausdrücklich beauftragte T-002-Nachbereitung behoben.

Windows ist in dieser Linuxumgebung nicht verfügbar; PowerShell und PC-Basispakete zeroconf/qrcode fehlen. Kein Bedarf, diese für F-003 jetzt zu installieren. Kalender-Softwarepfade sind vorhanden, READ_CALENDAR im Manifest ist keine erteilte Kontofreigabe. Beide Bereiche bleiben echte spätere Geräteaufgaben; keine Gegenprüfung aus Offline-Mocks erfinden.

Neue Nachweise nur lesende Einrichtungskontrolle: `/workspace/anker-t004-20261113/TOOLS.json`, `java-version.log`, Abschlussprüfung und Vorher-/Nachher-Git-Bundles. Frühere1224 Logik-/17 Browserfälle aus F-002 nicht wiederholt. Integriert lokal ja, main nein, Geräteergebnisse offen, veröffentlicht nein. Keine Cloud-/Workflow-/Play-Aktionen. Dieser damalige nächste Schritt ist inzwischen erledigt; aktueller Folgeauftrag im Abschnitt darunter.

## Native T-002-Nachbereitung: betriebsbereiter Prüfweg

Werkzeuge außerhalb des Repositorys unter `/workspace/anker-toolchains`: vorhandene JRE21.0.13 und exakt passendes offizielles Debian-Sicherheits-JDK-Paket21.0.13+9-1~deb13u2 in einem lokalen vollständigen JDK kombiniert. Paket-SHA256 stimmt mit offiziellem Index überein. Android-Commandline-Tools23.0 und Plattform android-36 Revision2 aus offiziellen Google-Metadaten; Build-Tools35.0.0 ist per `javap` aus AGP8.13s ToolsRevisionUtils als tatsächlicher Default belegt. Wrapper8.14.3 und Projektpluginversionen unverändert, keine globale Installation oder Cloud-Einstellungsänderung.

```bash
cd /workspace/anker
source /workspace/anker-toolchains/env.sh
javac -version
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
node scripts/gradle.mjs :app:testDebugUnitTest --no-daemon --console=plain --max-workers=2
```

Das Aktivierungsskript setzt nur lokale Tool-/Cache-/Proxyselektoren für diese angebundene Umgebung; es verändert weder HOME noch Kontoberechtigungen oder Cloud-Konfiguration. Android-Userverzeichnis und XDG-Pfade liegen im Workspace. Die offiziellen Tools23 leiten sdkmanager an Android CLI weiter; ein zusätzlicher lokaler Wrapper deaktiviert bei weiteren Aufrufen Metriken. `sdkmanager --version` meldet dabei nur `unknown (Android CLI)`; tatsächliche Paketrevision23.0 ist über source.properties und installierte Pakete belegt. Nicht durch CLI-Namensänderung eine nicht existierende ältere SDK-Version behaupten.

Erster SDK-Inventarversuch scheiterte am nicht beschreibbaren Benutzerverzeichnis; mit ANDROID_USER_HOME/XDG behoben. Erster JUnit-Aufruf scheiterte vor Tests an fehlender generierter `cordova.variables.gradle`. Erst darauf `npx cap sync android` ausgeführt: Datei erzeugt, **kein getrackter Diff**. Zweiter JUnit-Lauf **Exit0,252Tests/28Suiten,0Fehler/Skips,196Tasks ausgeführt,2m2s** einschließlich App-/Test-Kotlin-/Java-Kompilierung. Bestehende Deprecated-/Unchecked-Warnungen und Kotlin-Hinweis zu künftigem Gradleminimum erhalten, nichts aktualisiert oder unterdrückt. Keine APK-/Releaseerzeugung, Signierung oder Geräteinstallation.

Belege unter `/workspace/anker-native-setup-20261113/`: `RESULT.json`, `TOOLCHAIN.json` mit offiziellen URLs/Hashes, env.sh/Konfigurationskopien, Wrapper-/Compiler-/SDK-Ausgaben, AGP-Bytecodebeleg, erste Fehlerversuche, cap-sync.log, finaler Gradlelog und rohe JUnit-XML/HTML-Berichte sowie Git-Bundles/SHA256-Verzeichnis. Installierte Tools und Downloads verbleiben zusätzlich unter `anker-toolchains`; das Git-Bundle enthält die Repositoryhistorie, **nicht** alle SDK-/JDK-Binärdateien oder Gradlecaches. Alles nur Cloud-lokal; keine unabhängige externe Sicherung oder Übertragbarkeit in eine neue Umgebung bestätigt. Bei Umgebungswechsel Selektoren/Proxy und Pfade erneut prüfen.

Genau nächster Schritt: F-003 in derselben Unterhaltung einzeln beauftragen; vorhandene TS-/Native-Reminderbesitzer und die T-004-Prüfkette verwenden. Native Softwareprüfung nun möglich, echte Galaxy-/Windows-/Kalenderbeobachtungen weiterhin offen. Keine pauschale Produkt-/Push-/Merge-/Release-/Playfreigabe aus dieser Werkzeugabnahme ableiten.
