# Aktueller Übergabestand

Stand 13.11.2026, Europe/Berlin. **T-002, E-001 und T-003 abgeschlossen** für die lokale Web-/Logikentwicklung. Ausgangsstand dieses Abschlusses: `e421ee560cea709cba841843d35521b3f7755519`, Branch `entwicklung/anker-neu`, Arbeitsbaum `/workspace/anker`, zu Beginn sauber. Keine neue Produktfunktion. Nächster zulässiger Einzelauftrag: F-001, erst nach gesonderter Beauftragung. Keine parallele Folgeaufgabe starten.

## Arbeitsbasis und Verfügbarkeit

- T-001 ist nach ausdrücklicher Nutzerentscheidung gesichert pausiert. Originalumgebung und `835235b` bleiben zurückgestellt und sind keine Voraussetzung. Mögliche spätere Wiederherstellung separat sichern/vergleichen; keine automatische Übernahme oder Rekonstruktion.
- Lokale Historie: `6dfa632` (vollständiger Nutzerplan), `f7fa4e3` (Planungsdokumentation), `e421ee5` (Testkorrektur). Dieser Dokumentationsabschluss folgt darauf. Die finale Commit-ID steht im Abschlussbericht, nicht als selbstreferenzierende Dateischleife hier.
- Letzte erfolgreiche Remote-Abfrage in dieser Unterhaltung: main/HEAD `e48d289`, Arbeitsbranch/PR2-Head `6dfa632`. Lokale Nachfolgecommits wurden nicht gepusht. PR2 laut Nutzerscreenshot/-bericht offen und nicht gemergt; kein aktueller unabhängiger API-Nachweis (`Forbidden`). Beim Wechsel in einen anderen Task zuerst prüfen, ob dieser lokale Abschluss tatsächlich vorhanden ist; ein Prompt überträgt keine Commits.
- Produktquellen (`src`, Android) unverändert gegenüber `80f6a69`; e2e-Testquellen seit `e421ee5` gezielt korrigiert. Keine neue Release-/Gerätezusage. Nutzer-Screenshot zu GitHub-Lauf43331316553: 307/308 Browserfälle, Timerstart erwartete675000/tatsächlichundefined. Dieser Remote-Lauf bleibt historisch rot; kein neuer Runnerlauf ausgelöst.
- Branch `work` bis `02e0a01` und frühere Bundles bleiben erhalten. `/workspace/anker-ci-fix-20261113/after.bundle` erfolgreich verifiziert; Original-/Planungssicherungen unter `/workspace/anker-recovery-20261113/` und `/workspace/anker-preparation-20261113/`. Nur Cloud-lokal, keine bestätigte externe Sicherung. Fehlende Originaldateien werden nicht als verloren ausgegeben.

## Abnahme T-002 / E-001 / T-003

| ID | Abschlussnachweis | Verbleibende Grenze |
|---|---|---|
| T-002 | Umgebung identifiziert; Versionen/Befehle geprüft; Lockinstallation, Build und gezielte Browserprüfung aus CI-Fix erhalten; `npm ls --depth=0` erfolgreich; Setupvorschlag unten | Native-/Windows-Prüfungen erst für betroffene Aufgaben, keine Cloud-Setupänderung |
| E-001 | Cloudstatus aktuell running/enforced; Git-Lesen und API-Grenzen geklärt; keine Secretbindungen/Identitäten; Nutzerwahl GPT-6.1 Sol/Hoch bestätigt | Keine Konto-/OAuth-/Play-Freigaben erteilt; fehlender Zugriff ist dokumentiert, nicht repariert |
| T-003 | Alle36 IDs samt V-Zuordnungen, Abhängigkeiten und Originalabnahmen erfasst; eine Roadmap, ein Status, genau drei Fallvorlagen; Links und Widersprüche geprüft | F-001 bleibt OFFEN; spätere Aufgaben einzeln beauftragen |

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

Genau nächster Schritt: F-001 in derselben Unterhaltung ausdrücklich beauftragen. Nur vorhandene Plan-/Logdaten auswerten und Jetzt-Anzeige erweitern; keine F-002-/F-003-Implementierung, neue Messdaten oder zweite Engine. Bei Taskwechsel muss der lokale Abschluss erst tatsächlich zugänglich gemacht werden, ohne eigenmächtigen Push.
