# npm-Updateprüfung, 07.11.2026

Prüfbasis: `main` **424e041309e82ec82804f0e951fa817bcd0ada70**, App **1.3.0-rc.2 / Code 9**. Der frühere Prüfcommit und RC1 sind historische Angaben. `CLAUDE.md`, Implementierungsplan und Testnachweise wurden zuerst gelesen. Die folgende Inventur umfasst **alle 39 direkten Pakete** aus Manifest und Lockdatei; sämtliche Registry-Packuments wurden am 07.11.2026 live abgerufen. Keine Vorabversionen oder `releases/latest`-Downgrades verwendet.

Umgesetzt sind ausschließlich **Health 8.11.14** sowie **Tailwind und @tailwindcss/vite 4.3.5**. Node **24** und CI bleiben erhalten. Die Appversion bleibt in diesem Teilcommit RC2; eine gemeinsame spätere Versionierung erfolgt bei der Integration. Andere neue Releases sind eigenständige Wartungskandidaten.

## Vollständige Versionsmatrix

„Im Bereich“ ist die höchste veröffentlichte stabile Version innerhalb des vorhandenen Manifestbereichs. Für diese Kandidaten wurden die veröffentlichten Node-Engines und direkten Peeranforderungen mit Node 24/Capacitor 8/React 19/Vite 8/TS 5.9 abgeglichen. Diese Metadaten sind notwendige Kompatibilitätsbedingungen; sie ersetzen bei zurückgestellten Paketen keinen API-, OAuth-, nativen SDK- oder Anwendungstest. „Kein neuer Release“ bedeutet Gleichheit mit dem aktuellen Registrybestand, keine allgemeine Sicherheitszusage. Bei unverändertem Paket gibt es keinen Versionswechsel und damit keine neu eingeführten Breaking Changes in diesem Commit.

Die Paketnamen verlinken jeweils direkt die abgerufene npm-Primärquelle. `latest` entspricht bei allen 39 Paketen zugleich der höchsten stabilen veröffentlichten Version.

| Paket / npm-Primärquelle | Gesperrt vorher | Manifestbereich vorher | Neueste stabile | Im Bereich | Breaking Changes / Kompatibilitätsgrenze | Ergebnis |
|---|---:|---|---:|---:|---|---|
| [@capacitor-community/sqlite](https://registry.npmjs.org/@capacitor-community%2Fsqlite) | 8.1.1 | `^8.1.1` | 8.1.1 | 8.1.1 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor-mlkit/barcode-scanning](https://registry.npmjs.org/@capacitor-mlkit%2Fbarcode-scanning) | 8.2.1 | `^8.2.1` | 8.2.2 | 8.2.2 | Patch; nativer Detailreview offen | 8.2.1 behalten; separater nativer Patchkandidat |
| [@capacitor/android](https://registry.npmjs.org/@capacitor%2Fandroid) | 8.6.0 | `^8.6.0` | 8.6.0 | 8.6.0 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/app](https://registry.npmjs.org/@capacitor%2Fapp) | 8.1.2 | `^8.1.2` | 8.1.2 | 8.1.2 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/browser](https://registry.npmjs.org/@capacitor%2Fbrowser) | 8.0.5 | `^8.0.5` | 8.0.5 | 8.0.5 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/core](https://registry.npmjs.org/@capacitor%2Fcore) | 8.6.0 | `^8.6.0` | 8.6.0 | 8.6.0 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/filesystem](https://registry.npmjs.org/@capacitor%2Ffilesystem) | 8.1.5 | `^8.1.5` | 8.1.5 | 8.1.5 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/local-notifications](https://registry.npmjs.org/@capacitor%2Flocal-notifications) | 8.3.1 | `^8.3.1` | 8.3.1 | 8.3.1 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/preferences](https://registry.npmjs.org/@capacitor%2Fpreferences) | 8.0.1 | `^8.0.1` | 8.0.1 | 8.0.1 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capacitor/share](https://registry.npmjs.org/@capacitor%2Fshare) | 8.0.3 | `^8.0.3` | 8.0.3 | 8.0.3 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@capgo/capacitor-health](https://registry.npmjs.org/@capgo%2Fcapacitor-health) | 8.11.13 | `^8.11.13` | 8.12.0 | 8.12.0 | 8.11.14: nur Versionsstrings; 8.12.0 neuer iOS-Funktionsminor | gezielt 8.11.14; 8.12.0 zurückgestellt |
| [@capgo/capacitor-social-login](https://registry.npmjs.org/@capgo%2Fcapacitor-social-login) | 8.7.5 | `^8.7.5` | 8.7.7 | 8.7.7 | Patch; OAuth-/Native-Detailreview offen | 8.7.5 behalten; eigene Authregression nötig |
| [@supabase/supabase-js](https://registry.npmjs.org/@supabase%2Fsupabase-js) | 2.118.0 | `^2.118.0` | 2.119.0 | 2.119.0 | Minor; Node ≥22 erfüllt; API-Detailreview offen | 2.118.0 behalten; Sync/Auth separat prüfen |
| [dexie](https://registry.npmjs.org/dexie) | 4.4.7 | `^4.4.7` | 4.4.7 | 4.4.7 | kein neuer Release; kein Versionswechsel | beibehalten |
| [fflate](https://registry.npmjs.org/fflate) | 0.8.3 | `^0.8.3` | 0.8.3 | 0.8.3 | kein neuer Release; kein Versionswechsel | beibehalten |
| [qrcode](https://registry.npmjs.org/qrcode) | 1.5.4 | `^1.5.4` | 1.5.4 | 1.5.4 | kein neuer Release; kein Versionswechsel | beibehalten |
| [react](https://registry.npmjs.org/react) | 19.3.1 | `^19.3.1` | 19.3.1 | 19.3.1 | kein neuer Release; kein Versionswechsel | beibehalten |
| [react-dom](https://registry.npmjs.org/react-dom) | 19.3.1 | `^19.3.1` | 19.3.1 | 19.3.1 | kein neuer Release; kein Versionswechsel | beibehalten |
| [react-router](https://registry.npmjs.org/react-router) | 7.18.5 | `^7.18.5` | 8.5.1 | 7.18.5 | 8.x Major außerhalb Bereich; siehe unten | 7.18.5 behalten; eigene Migration |
| [zustand](https://registry.npmjs.org/zustand) | 5.0.16 | `^5.0.16` | 5.1.0 | 5.1.0 | Minor; React ≥18 erfüllt; API-Detailreview offen | 5.0.16 behalten; Storemigration separat prüfen |
| [@capacitor/cli](https://registry.npmjs.org/@capacitor%2Fcli) | 8.6.0 | `^8.6.0` | 8.6.0 | 8.6.0 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@eslint/js](https://registry.npmjs.org/@eslint%2Fjs) | 9.39.5 | `^9.39.5` | 10.0.1 | 9.39.5 | 10.x Major außerhalb Bereich; neue empfohlene Regeln | 9.39.5 behalten; zusammen mit ESLint migrieren |
| [@playwright/test](https://registry.npmjs.org/@playwright%2Ftest) | 1.64.1 | `^1.64.1` | 1.65.0 | 1.65.0 | Minor; Node ≥20 erfüllt; neue Browserrevision | 1.64.1 behalten; CI-Browserwechsel separat |
| [@tailwindcss/vite](https://registry.npmjs.org/@tailwindcss%2Fvite) | 4.3.3 | `^4.3.3` | 4.3.5 | 4.3.5 | Patch; Vite ^8 weiter unterstützt | 4.3.5 gemeinsam mit Tailwind übernommen |
| [@types/node](https://registry.npmjs.org/@types%2Fnode) | 26.6.5 | `^26.6.5` | 26.6.6 | 26.6.6 | Deklarationspatch; kein Node-Laufzeitwechsel | 26.6.5 behalten; vorhandene Typ-/Runtimeabweichung beachten |
| [@types/qrcode](https://registry.npmjs.org/@types%2Fqrcode) | 1.5.6 | `^1.5.6` | 1.5.6 | 1.5.6 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@types/react](https://registry.npmjs.org/@types%2Freact) | 19.3.0 | `^19.3.0` | 19.3.0 | 19.3.0 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@types/react-dom](https://registry.npmjs.org/@types%2Freact-dom) | 19.3.0 | `^19.3.0` | 19.3.0 | 19.3.0 | kein neuer Release; kein Versionswechsel | beibehalten |
| [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs%2Fplugin-react) | 6.1.2 | `^6.1.2` | 6.2.1 | 6.2.1 | Minor; Vite ^8 erfüllt; neue optionale Peers | 6.1.2 behalten; Transform-/Peerreview separat |
| [eslint](https://registry.npmjs.org/eslint) | 9.39.5 | `^9.39.5` | 10.14.0 | 9.39.5 | 10.x Major; Configsuche/Regeln/API ändern sich | 9.39.5 behalten; als unsupported markiert, Migration offen |
| [eslint-plugin-react-hooks](https://registry.npmjs.org/eslint-plugin-react-hooks) | 7.1.1 | `^7.1.1` | 7.1.1 | 7.1.1 | kein neuer Release; kein Versionswechsel | beibehalten |
| [fake-indexeddb](https://registry.npmjs.org/fake-indexeddb) | 6.2.6 | `^6.2.6` | 6.2.7 | 6.2.7 | Patch; Node ≥18 erfüllt; Detailreview offen | 6.2.6 behalten; Speicherfixtures separat prüfen |
| [globals](https://registry.npmjs.org/globals) | 17.13.0 | `^17.13.0` | 17.14.0 | 17.14.0 | Minor; Node ≥18 erfüllt; globale Namen ändern sich | 17.13.0 behalten; Lintwirkung separat prüfen |
| [tailwindcss](https://registry.npmjs.org/tailwindcss) | 4.3.3 | `^4.3.3` | 4.3.5 | 4.3.5 | Patch; CSS-Parser/Scope/Scannerkorrekturen | 4.3.5 gemeinsam mit Vite-Plugin übernommen |
| [typescript](https://registry.npmjs.org/typescript) | 5.9.3 | `~5.9` | 7.0.2 | 5.9.3 | 7.x Major außerhalb ~5.9; ESLint-Peer inkompatibel | 5.9.3 behalten; eigene Migrationsanalyse |
| [typescript-eslint](https://registry.npmjs.org/typescript-eslint) | 8.72.1 | `^8.72.1` | 8.72.1 | 8.72.1 | kein neuer Release; TS-Peer >=4.8.4 <6.1.0 | 8.72.1 behalten; transitive Advisorys unten |
| [vite](https://registry.npmjs.org/vite) | 8.3.5 | `^8.3.5` | 8.3.6 | 8.3.6 | Patch; Engines unverändert; Build/Devserverfixes | 8.3.5 behalten; separater Buildtool-Patchkandidat |
| [vite-plugin-pwa](https://registry.npmjs.org/vite-plugin-pwa) | 2.0.0 | `^2.0.0` | 2.0.0 | 2.0.0 | kein neuer Release; transitive Majors wären nötig | 2.0.0 behalten; Buildtool-Advisorys unten |
| [vitest](https://registry.npmjs.org/vitest) | 5.0.5 | `^5.0.5` | 5.1.0 | 5.1.0 | Minor; Node 24/Vite 8 passen; Runneränderungen separat | 5.0.5 behalten; eigene Testtool-Aktualisierung |

## Health: Verbraucheranforderung und Upstreambuild

[npm 8.11.14](https://registry.npmjs.org/@capgo%2Fcapacitor-health/8.11.14), [GitHub-Release](https://github.com/Cap-go/capacitor-health/releases/tag/8.11.14), [vollständiger Upstreamdiff](https://github.com/Cap-go/capacitor-health/compare/8.11.13...8.11.14.diff) und [Upstreampackage.json](https://raw.githubusercontent.com/Cap-go/capacitor-health/8.11.14/package.json) wurden getrennt geprüft. npm veröffentlichte 8.11.14 am 02.11.2026 um 13:31:11.200Z. Der Releasehinweis nennt Node 26; die tatsächlichen veröffentlichten Pakete 8.11.13 und 8.11.14 deklarieren **kein `engines`**, keine Laufzeitabhängigkeiten und nur den Peer `@capacitor/core >=8.0.0`. Es gibt keine `preinstall`-/`install`-/`postinstall`-/`prepare`-Hooks. `prepublishOnly` betrifft den Paketveröffentlicher.

Die beiden npm-Tarballs wurden vollständig gelesen und gegen ihre Registry-SHA512-integrity geprüft. Von allen 30 enthaltenen Dateien unterscheiden sich nur `package.json` und der interne iOS-Pluginversionsstring. Android/Kotlin/Gradle, ausgeliefertes JavaScript und Typdeklarationen sind bytegleich. Der Upstreamdiff hebt Node 24.x auf 26.x ausschließlich in sechs Entwicklungs-/Test-/Veröffentlichungsworkflows an und erneuert Bun-Lockdateien. Für Ankers Verbraucherbuild entsteht aus diesem Patch keine belegte neue Node 26-Anforderung. `npm ci`, Typprüfung, Logiktests und Produktionsbuild bestehen tatsächlich mit Node 24.22.1; sämtliche 692 Lockdateieinträge weisen dabei keinen widersprechenden Node-Enginebereich auf. Ein fehlendes `engines`-Feld allein wäre kein Kompatibilitätsbeweis; hier kommen vollständiger Tarballvergleich und ausgeführter Verbraucherbuild hinzu.

Aktuelles Registrylatest ist bereits [8.12.0](https://github.com/Cap-go/capacitor-health/releases/tag/8.12.0), veröffentlicht 07.11.2026 um 10:19:30.102Z, mit neuer iOS 18-`stateOfMind`-Funktion. Dieser Minor wurde bewusst nicht übernommen. Die App verwendet weiterhin ausschließlich den vorhandenen freiwilligen lesenden Health-Weg. Keine neue Berechtigung, Datentypanfrage oder Stimmungsauswertung.

## Tailwind: gekoppelter Patch und Layoutgrenzen

[Offizielles Changelog v4.3.5](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v4.3.5/CHANGELOG.md) und [Release](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.5) bestätigen 4.3.5 vom 06.11.2026. Der gemeinsame Sprung enthält auch 4.3.4 vom 02.11.2026. Relevante Korrekturen betreffen CSS-Parserfälle und `color-mix`, `@scope`, Varianten/Modifier, Quellen-/Watch-Erkennung, Vite `bundledDev`, WASM-Laden und fehlende ausgelieferte Typimporte. Das ist kein neues Ankerfeature; korrigierte CSS-Erzeugung verlangt Layoutregression.

`@tailwindcss/vite` 4.3.5 unterstützt unverändert `vite ^5.2.0 || ^6 || ^7 || ^8` und verlangt intern exakt `tailwindcss`, `@tailwindcss/node` und `@tailwindcss/oxide` 4.3.5. Oxide verlangt Node >=20; der optionale WASM-Pfad unterstützt ebenfalls 24. Die Lockdatei enthält passende Plattformpakete 4.3.5. Der neue Node-Unterbau verlangt Lightning CSS 1.33.0 und MagicString ^1.1.0; npm löst MagicString 1.4.5, EnhancedResolve 5.26.1 und die zum veröffentlichten WASM-Paket gehörenden Hilfspakete auf. Lightning CSS 1.33.0 war bereits für Vite verschachtelt gesperrt und wird nun gemeinsam dedupliziert; die bisherige Rootversion 1.32.0 entfällt. Weitere unveränderte native Pakete erhalten vom npm-Lockgenerator nur `libc`-Metadaten. Keine anderen direkten Versionen wurden verändert, keine Overrides eingeführt.

## Weitere bewusst getrennte Migrationen

- **TypeScript 7:** außerhalb `~5.9`. Die aktuellen `typescript-eslint`-/Parser-/Estree 8.72.1-Peers erlauben nur `>=4.8.4 <6.1.0`; damit ist 7.0.2 bereits auf der bestehenden Toolchain inkompatibel. Compiler-API und weitere Werkzeugverträge werden in der separaten TypeScript-Migrationsanalyse behandelt. Hier bleibt 5.9.3.
- **ESLint 10 und @eslint/js 10:** außerhalb der vorhandenen 9er-Bereiche. Die [offizielle Migration](https://raw.githubusercontent.com/eslint/eslint/main/docs/src/use/migrate-to-10.0.0.md) nennt neue Configsuche, geänderte empfohlene Regeln, Entfernung alter Konfiguration und APIs sowie neue Nodeuntergrenzen. Node 24 reicht, behebt aber die Regel-/Pluginmigration nicht. Die Registry kennzeichnet 9.39.5 ausdrücklich als nicht mehr unterstützt; das bleibt eine offene Wartungsaufgabe.
- **React Router 8:** außerhalb `^7.18.5`; aktuell 8.5.1 mit Node >=22.22 und eigenem Majorvertrag. Der [offizielle Changelog](https://raw.githubusercontent.com/remix-run/react-router/react-router%408.5.1/packages/react-router/CHANGELOG.md) wurde gelesen. Kein Versionssprung und keine behauptete abgeschlossene Routermigration.
- **Vite 8.3.6:** metadatenseitig kompatibler Patch mit unveränderten Engines. [Offizielle Patchnotes](https://raw.githubusercontent.com/vitejs/vite/v8.3.6/packages/vite/CHANGELOG.md) nennen Build-/CSS-/Devserver-/Workerfixes. Bleibt als eigener gezielter Buildtoolkandidat dokumentiert; das beauftragte Tailwindpaar läuft auf dem vorhandenen 8.3.5. Weitere Minor-/Patchkandidaten der Tabelle wurden nicht ohne eigenen fachlichen Anlass in dieses Paket aufgenommen.

## Separater Advisoryabgleich

`npm outdated` ist eine Versionsinventur und wurde nicht als Sicherheitsbeleg verwendet. Stattdessen liefen `npm audit --package-lock-only --json` vor und nach dem Patch sowie ein eigener Produktionsabgleich mit `--omit=dev`. Die drei zugrundeliegenden Advisorys wurden direkt in der GitHub Advisory Database nachgelesen. Vorher und nachher meldet npm **13 betroffene Paketknoten: 2 low, 11 moderate, 0 high, 0 critical**. Dies sind weitergereichte Abhängigkeitsbefunde aus **drei** Advisorys, keine 13 unabhängigen Schwachstellen. Der separate Produktionsabgleich meldet **0 bekannte Befunde**; das ist eine Aussage über diesen Registryabgleich, keine allgemeine Sicherheitsfreigabe der App.

| Advisory / tatsächlicher gesperrter Pfad | Bedingung und Kontext | Geprüfter Fix / Entscheidung |
|---|---|---|
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), `vite-plugin-pwa → workbox-build → @rollup/plugin-node-resolve → deepmerge 4.3.1` | Prototype poisoning beim Mergen angreiferkontrollierter Quellobjekte; Entwicklungs-/Buildwerkzeug. GitHub bewertet low. Kein direkter App-Laufzeitpfad aus diesem Befund belegt. | Registrylatest 4.3.1; GitHub „Patched versions: None“. Der Parentbereich ^4.2.2 bietet keinen gefixten Release. Offen lassen und Upstreamfix verfolgen. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), `@capacitor/cli → rimraf 6.1.3 → glob 13.0.6` sowie `vite-plugin-pwa → workbox-build → glob 11.1.0` | Abgebrochener Globwalk kann trotz AbortSignal weiter Dateisystem-I/O/CPU verbrauchen; Entwicklungs-/Buildwerkzeug, kein eingebauter mobiler Dateisystemscanner. | Fix erst 14.0.2; Parentbereiche ^13.0.3 bzw. ^11.0.1 schließen ihn aus. Auch der erreichbare 13.0.7 bleibt laut Advisory betroffen. Major-/Parentmigration erforderlich; keine Overrides. |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), `typescript-eslint → @typescript-eslint/typescript-estree → minimatch 10.2.6` und über beide `glob`-Bäume | Angreiferkontrolliertes Globpattern mit `optimizationLevel >=2` kann starke Patternvermehrung verursachen; Lint-/Buildtool. Kein Nachweis, dass Ankers UI fremde Globpatterns an diese Werkzeuge übergibt. | Fix erst 11.0.1; Parentbereiche ^10.2.2 bzw. ^10.1.1 schließen ihn aus. Major-/Parentmigration nötig; betroffene 10er durch keine kompatible Patchauflösung vollständig sanierbar. |

Alle betroffenen Lockeinträge sind Dev-Abhängigkeiten. Angreiferkontrollierte Konfigurationen oder Quelldateien bleiben für Buildsysteme relevant; der Dev-Kontext entfernt die Befunde nicht. Die tatsächliche Ausnutzbarkeit in Ankers vertrauenswürdigem lokalen/CI-Build wurde nicht durch einen Exploit geprüft. Der automatische Fixvorschlag nennt unter anderem **Downgrades** auf `vite-plugin-pwa` 1.1.0 und `typescript-eslint` 8.36.0; diese wurden nicht ausgeführt. Kein `npm audit fix --force`, kein pauschales latest-Update und kein versteckter Wechsel der Transitiven über ihre Parentbereiche hinaus.

## Ausgeführte Prüfung und offene Grenzen

Isolierter Worktree, eigenes `node_modules` ohne Rootsymlink, Node 24.22.1/npm 11.9.0:

| Prüfung | Ergebnis |
|---|---|
| `npm ci --no-audit --no-fund` | bestanden, 624 Pakete installiert; bestehende ESLint-/Glob-Abkündigungshinweise dokumentiert |
| `npm run lint` | Exit 0, 0 Fehler; eine bereits vorhandene Ref-Cleanup-Warnung in TaskAssistance |
| `npm run typecheck` | Exit 0 |
| `npm test` | **785/785**, 81 Dateien, Exit 0 |
| `npm run build` | Exit 0, Produktionsbuild und PWA-Serviceworker erzeugt |
| Node-Engines aller Lockeinträge | 692 Einträge, kein Konflikt mit 24.22.1 |
| Vollständiger Advisoryabgleich | Exit 1 wegen der oben dokumentierten 13 Devknoten; kein Abruffehler |
| Advisoryabgleich `--omit=dev` | Exit 0, 0 bekannte Befunde |
| Layoutbrowser: bestehende A11y-/Druck-/Routinensortierfälle | **22/22** bestanden, 1,4 min; keine Skips/Flakies/Retries, Chromium 155 |

Die Layoutprüfung nutzt einen frischen Produktionsbuild auf eigenem Port 4271, System-Chromium und zwei Worker ohne Retries. Der erste Start innerhalb der eingeschränkten Sandbox scheiterte bereits am Webserverstart; dieser Versuch zählt nicht als bestandener Testlauf. Der identische Lauf wurde mit unverändertem Proxy/CA im freigegebenen äußeren Executor wiederholt. Gemeinsame Gesamt-/Androidintegration folgt getrennt; keine reale Healthprovider-, Android-, Windows-, Installations- oder Hörbarkeitsprüfung aus diesem Teilauftrag abgeleitet. Es wurden keine Geräteergebnisse verändert, keine App/Anbieter deployt und nichts veröffentlicht.

Lokale Rohbelege und vollständige Logs: `/workspace/.cache/anker/updatepruefung/npm/` (39 Packuments mit SHA256, Versions-/Engineinventur, Audit-JSONs, Primärquellen, Install-/Testlogs) und `/workspace/.cache/anker/updatepruefung/npm-health-evidence/` (beide SHA512-geprüften Tarballs, vollständiger Vergleich aller 30Dateien, Upstreamdiff, SHA256-Manifest). Diese Caches gehören nicht zum öffentlichen Commit; das private Auftragsoriginal wurde ebenfalls nicht übernommen.
