# Aktueller Übergabestand

Stand 13.11.2026, Europe/Berlin. **F-002/V-009 lokal umgesetzt und automatisch geprüft.** Ausgangsstand `8149ecea34bf3a5f72a4b9fe1913ccccd602ba7c`, Branch `entwicklung/anker-neu`, Arbeitsbaum `/workspace/anker`, zu Beginn sauber. F-001 sowie T-002/E-001/T-003 bleiben abgeschlossen. Nächster möglicher Einzelauftrag: T-004 zur Vorbereitung der Plattform-/Geräteprüfungen vor F-003. Keine parallele Folgeaufgabe, kein Push/Merge/Release oder Play-Aufruf.

## Arbeitsbasis und Verfügbarkeit

- T-001 ist nach ausdrücklicher Nutzerentscheidung gesichert pausiert. Originalumgebung und `835235b` bleiben zurückgestellt und sind keine Voraussetzung. Mögliche spätere Wiederherstellung separat sichern/vergleichen; keine automatische Übernahme oder Rekonstruktion.
- Lokale Historie: `6dfa632` (vollständiger Nutzerplan), `f7fa4e3` (Planungsdokumentation), `e421ee5` (Testkorrektur). Einrichtungsabschluss `32b9a15`, F-001 `8149ece`, darauf der lokale F-002-Abschluss. Die finale Commit-ID steht im Abschlussbericht, nicht als selbstreferenzierende Dateischleife hier.
- Letzte erfolgreiche Remote-Abfrage in dieser Unterhaltung: main/HEAD `e48d289`, Arbeitsbranch/PR2-Head `6dfa632`. Lokale Nachfolgecommits wurden nicht gepusht. PR2 laut Nutzerscreenshot/-bericht offen und nicht gemergt; kein aktueller unabhängiger API-Nachweis (`Forbidden`). Beim Wechsel in einen anderen Task zuerst prüfen, ob dieser lokale Abschluss tatsächlich vorhanden ist; ein Prompt überträgt keine Commits.
- Seit F-001/F-002 gezielte TS-/Jetzt-Änderungen und neue Logik-/Store-/Browsertests. F-002 ergänzt optional `DayOverride.shortMorning` samt Sicherungsvalidierung und bestehender atomarer Tagesplanaktion; keine neue DB-Tabelle, Engine oder Schreibqueue. Android, Reminder-Regeln und Paket-/Lockdateien unverändert. e2e-Timerkorrektur aus `e421ee5` erhalten. Keine neue Release-/Gerätezusage. Nutzer-Screenshot zu GitHub-Lauf43331316553: 307/308 Browserfälle, Timerstart erwartete675000/tatsächlichundefined. Dieser Remote-Lauf bleibt historisch rot; kein neuer Runnerlauf ausgelöst.
- Branch `work` bis `02e0a01` und frühere Bundles bleiben erhalten. `/workspace/anker-ci-fix-20261113/after.bundle` erfolgreich verifiziert; Original-/Planungssicherungen unter `/workspace/anker-recovery-20261113/` und `/workspace/anker-preparation-20261113/`. Nur Cloud-lokal, keine bestätigte externe Sicherung. Fehlende Originaldateien werden nicht als verloren ausgegeben.

## Abnahme T-002 / E-001 / T-003

| ID | Abschlussnachweis | Verbleibende Grenze |
|---|---|---|
| T-002 | Umgebung identifiziert; Versionen/Befehle geprüft; Lockinstallation, Build und gezielte Browserprüfung aus CI-Fix erhalten; `npm ls --depth=0` erfolgreich; Setupvorschlag unten | Native-/Windows-Prüfungen erst für betroffene Aufgaben, keine Cloud-Setupänderung |
| E-001 | Cloudstatus aktuell running/enforced; Git-Lesen und API-Grenzen geklärt; keine Secretbindungen/Identitäten; Nutzerwahl GPT-6.1 Sol/Hoch bestätigt | Keine Konto-/OAuth-/Play-Freigaben erteilt; fehlender Zugriff ist dokumentiert, nicht repariert |
| T-003 | Alle36 IDs samt V-Zuordnungen, Abhängigkeiten und Originalabnahmen erfasst; eine Roadmap, ein Status, genau drei Fallvorlagen; Links und Widersprüche geprüft | F-001 inzwischen lokal umgesetzt; spätere Aufgaben einzeln beauftragen |

Integriert: ja im lokalen Arbeitsbranch; nein auf main und nicht als neue GitHub-Verfügbarkeit bestätigt. Gerätetest für diesen Dokumentationsabschluss nicht nötig; veröffentlicht nein. Vollständige App-/Android-/Windows-Prüfung oder Releasefreigabe ist kein Teil dieser Abnahme.

## Umgebung und reproduzierbare Befehle

Aktive Umgebung `ccarenv_b64_Y2NhcmVudl83ZjQ4ZDgwMDU0ZTA4MTkxYjYzNTY1ODdjOWI2NjRhZA`, Status am Abschluss erneut running, Beobachtungen aktuell, Netzwerkpolitik enforced. Keine Secretbindungen/Laufzeitvariablen. Keine Cloud-Einstellungen verändert. Der zuletzt lesbare Konfigurationsentwurf hatte kein Installationsskript und Repository-ref `main`; tatsächlicher Arbeitsbranch bleibt `entwicklung/anker-neu` und muss beim nächsten Task geprüft werden.

Node24.22.1, npm11.9.0, Python3.12.14, OpenJDK21.0.13; installiertes System-Chromium156.0.8078.79. Web-Abhängigkeiten vorhanden, `npm ls --depth=0` erfolgreich. Kein erneutes `npm ci` ohne Anlass. Falls die Abhängigkeiten nach Umgebungswechsel fehlen: `npm ci --cache /tmp/anker-npm-cache --no-audit --no-fund`. Dieser Cachepfad vermeidet den zuvor nicht beschreibbaren Standardcache. Lockdateien und Paketversionen bleiben erhalten.

Geprüfte Repositorybefehle: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Passende Tests gezielt auswählen; keine automatischen Systemwirkungen starten. `npm run test:pc` benötigt PowerShell; Native-Unit-Tests `node scripts/gradle.mjs :app:testDebugUnitTest` benötigen die Android-Einrichtung. PC-Python-Tests aus `pc-companion` mit `python -m unittest discover -s tests -v`, Abhängigkeiten später bei Bedarf isoliert installieren.

Standard-Playwright-Browserdownload ist mit `403 Domain forbidden` blockiert. Für lokale Webtests existiert eine getestete Konfiguration mit installiertem Chromium; sie ändert nur Browserpfad, absolute Verzeichnisse und Reporter, nicht Prüfregeln/Timeouts/Retries:

```bash
cd /workspace/anker
CI=true npx playwright test --config=/workspace/anker-ci-fix-20261113/local-playwright.config.ts e2e/subtask-timer.spec.ts e2e/redesign-controls-extra.spec.ts --workers=2
```

Konfiguration und Systembrowser vor neuem Task auf Existenz prüfen; Testausgaben gehen nach `anker-ci-fix-20261113/test-results`. Vor späterem Wiederverwenden relevante alte Fehlerartefakte separat erhalten. Falls die lokale Hilfsdatei fehlt, aus `playwright.config.ts` außerhalb des Repositorys eine Konfiguration mit `use.launchOptions.executablePath: '/usr/bin/chromium'`, absoluten Test-/Ausgabepfaden und Webserver-cwd erstellen; keine CI-Datei ändern. F-001 benötigt keinen nativen Transport und keine neuen Berechtigungen. adb/gradle/pwsh sind derzeit nicht im PATH, an üblichen Pfaden wurde kein SDK gefunden. Reale Galaxy-/Windows-/Kalenderbeobachtungen bleiben Aufgaben T-004/E-002–E-004.

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

Genau nächster Schritt: T-004 in derselben Unterhaltung beauftragen: vorhandene Android-/Windows-/Kalenderprüfstationen und den Prüfpfad für F-003 abgleichen. Android-SDK/adb und reale Geräte bisher nicht verfügbar; keine automatische Installation oder neue Gerätestationen/Ergebnis-Haken. F-003 bleibt fachlich nach F-001/T-003 möglich, seine nativen Prüfbedingungen müssen vorher geklärt sein. Bei Taskwechsel lokale Commits erst tatsächlich verfügbar machen; kein eigenmächtiger Push.
