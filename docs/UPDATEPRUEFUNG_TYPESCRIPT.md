# Updateprüfung: TypeScript 5.9.3 → 7.0.2

Stand: **07.11.2026**. Anker-Baseline `424e041309e82ec82804f0e951fa817bcd0ada70`; keine Compiler-, Paket-, Lockdatei- oder Konfigurationsänderung in dieser Analyse.

## Entscheidung

**TypeScript 5.9.3 bleibt.** 7.0.2 ist im live gelesenen npm-`latest`-Endpunkt veröffentlicht, liegt aber außerhalb von Ankers `~5.9` und ist keine kompatible Patchaktualisierung. Das vorhandene `typescript-eslint` 8.72.1 unterstützt laut seinen veröffentlichten Metadaten nur `>=4.8.4 <6.1.0`. Zusätzlich ist die von dessen Parser verwendete klassische JavaScript-Compiler-API im Wurzelexport von TypeScript 7.0.2 nicht mehr vorhanden. Eine Versionsnummer oder ein erfolgreicher Vite-Transform würde diesen Blocker nicht aufheben.

Kein Sicherheitsproblem von 5.9.3 wird allein aus dieser neueren Versionsnummer abgeleitet. Advisories gehören zur gesonderten Abhängigkeitsprüfung des Gesamtauftrags.

## Tatsächlich gelesene Primärquellen

Abruf am 07.11.2026 um etwa 13:20 UTC, jeweils HTTP 200. Die versionsgebundenen npm-Metadaten und Paketinhalte haben Vorrang vor allgemeinem oder historischem README-Text.

| Primärquelle | Gelesener Inhalt / Ergebnis |
|---|---|
| [typescript/latest](https://registry.npmjs.org/typescript/latest), [typescript/7.0.2](https://registry.npmjs.org/typescript/7.0.2), [typescript/5.9.3](https://registry.npmjs.org/typescript/5.9.3) | Tatsächliche Versionen, `engines`, CLI-, API- und Plattformpaketmetadaten verglichen. |
| [typescript-7.0.2.tgz](https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz) | Vollständig geladen, SHA-512 gegen npm-`dist.integrity` bestätigt; `package.json`, `lib/version.cjs`, `bin/tsc` und README statisch gelesen. Kein Compiler installiert oder ausgeführt. |
| [typescript-eslint/8.72.1](https://registry.npmjs.org/typescript-eslint/8.72.1), [parser/8.72.1](https://registry.npmjs.org/@typescript-eslint%2Fparser/8.72.1), [typescript-estree/8.72.1](https://registry.npmjs.org/@typescript-eslint%2Ftypescript-estree/8.72.1) | Alle drei deklarieren den TypeScript-Peerbereich `>=4.8.4 <6.1.0`. |
| [typescript-estree-8.72.1.tgz](https://registry.npmjs.org/@typescript-eslint/typescript-estree/-/typescript-estree-8.72.1.tgz) | Vollständig geladen, npm-SHA-512 bestätigt. `dist/parseSettings/warnAboutTSVersion.js`, `dist/create-program/createSourceFile.js`, `createIsolatedProgram.js` und `useProvidedPrograms.js` gelesen. |
| [vite/8.3.5](https://registry.npmjs.org/vite/8.3.5), [vite-8.3.5.tgz](https://registry.npmjs.org/vite/-/vite-8.3.5.tgz) | Metadaten und Transform-/Konfigurationscode gelesen; Tarballintegrität gegen npm bestätigt. Kein TypeScript-Peerbereich, aber daraus folgt keine Compilerfreigabe. |
| [vitest/5.0.5](https://registry.npmjs.org/vitest/5.0.5), [vitest-5.0.5.tgz](https://registry.npmjs.org/vitest/-/vitest-5.0.5.tgz), [versionsgebundener Typechecker-Quelltext](https://raw.githubusercontent.com/vitest-dev/vitest/v5.0.5/packages/vitest/src/typecheck/typechecker.ts) | Paketmetadaten, Standard-Typechecker `tsc` und dessen CLI-Aufruf gelesen; Tarballintegrität gegen npm bestätigt. |

Reproduzierbare SHA-256 der zwei entscheidenden gelesenen Tarballs: TypeScript 7 `da2513f4b95176d6dde8b51aab7afe8a927656c9d277369793f77f7e59371c08`; typescript-estree `57031cc5c021a99748c88978197f86917f9ea35b67d7719dd4b900237e3f8f25`. Der Integritätsvergleich bestätigt die Übereinstimmung mit den gelesenen Registry-Metadaten, nicht pauschal die Fehlerfreiheit oder Sicherheit des Pakets.

Das zusätzlich gelesene [typescript-go/main-README](https://raw.githubusercontent.com/microsoft/typescript-go/main/README.md) enthält zugleich Archivierungshinweise und ältere „API not ready“-Tabellen. Der gelesene [TypeScript-v7.0.2-README](https://raw.githubusercontent.com/microsoft/TypeScript/v7.0.2/README.md) enthält ebenfalls historische Übergangshinweise. Diese Texte ersetzen nicht die oben gelesenen 7.0.2-Paketexports. Ein vermuteter `CHANGES.md`-Pfad am Tag lieferte 404; daraus wird keine gelesene Migrationsanleitung behauptet.

## Compiler-API und Installation

| Bereich | 5.9.3 / heutiger Anker-Gebrauch | 7.0.2 / Bewertung |
|---|---|---|
| Paketwurzel | `main: ./lib/typescript.js`, `typings: ./lib/typescript.d.ts`; klassische Compiler-API | Export `.` zeigt auf `./lib/version.cjs`. Diese Datei exportiert nur `version` und `versionMajorMinor`; kein `createSourceFile` oder `createProgram`. Ein Austausch unter demselben Paketnamen ist für alte API-Nutzer kein Ersatz. |
| Neue APIs | Keine eigene Compiler-API in den geprüften App-/Scriptquellen gefunden | Neue Exporte liegen unter `./unstable/sync`, `./unstable/async`, `./unstable/ast` usw. „API völlig nicht vorhanden“ wäre falsch; es handelt sich aber nicht um die alte kompatible API. Keine Adapterannahme oder selbst gebauter Parser-Shim. |
| ESLint-Parser | Ankers `eslint.config.js` benutzt `typescript-eslint.configs.recommended`, auch ohne typbasierte Regeln | `typescript-estree` importiert `require("typescript")` und ruft selbst im normalen Parsepfad `ts.createSourceFile` auf; weitere Pfade verwenden `ts.createProgram`. Daher betrifft der APIwechsel auch den gegenwärtigen Lintpfad, nicht erst ein künftiges Typed-Linting. |
| CLI / Editoren | Skripte `typecheck: tsc -b`, `build: tsc -b && vite build`; 5.9.3 veröffentlicht `tsc` und `tsserver` | 7.0.2 veröffentlicht als npm-Befehl `tsc`; plattformspezifische optionale Pakete enthalten den nativen Compiler. Kein `tsserver`-Eintrag im gelesenen `bin`. Editor-/LSP-Konfiguration nicht ungeprüft weiterverwenden. |
| Laufzeitumgebung | CI nutzt Node 24; lokale Plattformen/Architekturen können abweichen | 7.0.2 nennt `node >=16.20.0`; Node 24 erfüllt dies. Das ist keine Zusage, dass alle Anker-Werkzeuge unter Node 16 laufen. Native Compilerinstallation auf Cloud-Linux und Nutzer-Windows einschließlich optionaler Pakete muss separat geprüft werden. |

Ein npm-Alias für einen reinen CLI-Versuch bei zugleich altem TypeScript für ESLint wäre höchstens ein separater Forschungsbranch. Er würde einen Doppelcompiler einführen und neue Auflösungsfragen schaffen; in diesem Auftrag wird er nicht eingerichtet. `--force`, `--legacy-peer-deps` oder eine ignorierte Parserwarnung lösen die API-Inkompatibilität nicht.

## Vite, Vitest und Ankers Konfiguration

**Vite 8.3.5:** Die gelesenen Metadaten verlangen Node `^20.19.0 || >=22.12.0`, nennen aber keinen TypeScript-Peerbereich. Vite transformiert TypeScript/TSX im eigenen Transformpfad; das ist von der vollständigen Typprüfung getrennt. Anker führt ausdrücklich vorher `tsc -b` aus. Ein erfolgreicher `vite build` allein würde daher weder die neue Compiler-API noch unveränderte Typdiagnostik beweisen. Die vorhandenen React-, Tailwind- und PWA-Plugins sowie virtuelle Module benötigen beim späteren Compilerwechsel den normalen Integrationslauf.

**Vitest 5.0.5:** Die gelesenen Metadaten akzeptieren Vite `^6.4.0 || ^7.0.0 || ^8.0.0` und Node `^22.12.0 || ^24.0.0 || >=26.0.0`; sie enthalten keinen TypeScript-Peerbereich. Ankers `vite.config.ts` aktiviert keinen eigenen Vitest-Typecheck, sondern reguläre Logiktests. Deshalb kann ein grüner `npm test` allein nichts über TypeScript-7-Typprüfung aussagen. Der gelesene optionale Vitest-Typechecker startet `tsc` mit CLI-Flags, etwa `--noEmit`, `--incremental` und `--tsBuildInfoFile`, bzw. im Buildmodus `--build`. CLI-Kompatibilität, Fehlerauswertung und Watchverhalten wären gezielt zu prüfen, falls dieser Weg künftig genutzt wird.

**Konkrete Konfigurationsfläche:** `tsconfig.json` referenziert App- und Node-Projekt. Geprüft wurden `moduleResolution: bundler`, `module: ESNext`, `target: ES2022`, `jsx: react-jsx`, `noEmit`, `allowImportingTsExtensions`, `isolatedModules`, `strict`, `noUncheckedIndexedAccess` und getrennte `.tsbuildinfo`-Pfade. App-Typen umfassen `vite/client` und `vite-plugin-pwa/client`; der Node-Teil umfasst Vite-/Playwright-/Capacitor-/Appkonfiguration und E2E-Dateien. Defaults, neue Deprecations und Buildreferenzsemantik von 7.0.2 wurden nicht durch einen Compilerlauf bestätigt. Optionen oder bestehende Typfehler werden hier nicht still gelockert.

## Gate für einen späteren separaten Migrationsversuch

1. Eine unterstützte stabile Parser-/typescript-eslint-Kombination muss den gewählten Compiler und seine API ausdrücklich unterstützen. Exakte Peerbereiche und veröffentlichte Paketinhalte erneut prüfen. Der jetzige Stand erfüllt das nicht.
2. Eigener Branch/Worktree und Ausgangsdiagnostik; keine Android-, Produkt-, Daten- oder Versionsänderung beimischen. Plattformpakete auf Linux und Windows samt reproduzierbarer `npm ci`-Installation prüfen.
3. Compiler, API-Abnehmer, Editorintegration und Konfiguration gemeinsam betrachten. Erst danach einen begrenzten Versuch ausführen; keine automatische Umstellung aufgrund von `latest`.
4. Vorhandene Prüfungen ausführen: Lint, `tsc -b` ohne alte Buildinfos, Produktionsbuild, Vitest und Browserfälle. Diagnostik/Importauflösung, TSX, virtuelle Module, PWA und Konfigurationsdateien prüfen; bei Nutzung zusätzlich Vitest-Typechecker und Watchmodus. Keine Skips oder gelockerte Strict-Optionen als Migrationslösung.
5. Ergebnis samt konkretem Nutzen bewerten. Bei Inkompatibilität zu 5.9.3 und der ursprünglichen Lockdatei zurückkehren; keine Nutzerdatenmigration erforderlich.

## Status

| Vorhanden | Ergänzt | Bewusst zurückgestellt | Nicht verifiziert |
|---|---|---|---|
| TypeScript 5.9.3, vorhandene Lint-/Build-/Testkette | Versionsgebundene Paket-/API- und Werkzeuganalyse | TypeScript-7-Installation, API-Adapter, Doppelcompiler und Migration | Compilerlauf unter 7.0.2, neue Typdiagnostik, Editor-/Windowsverhalten und gesamte transitive API-Kompatibilität |

Prüfung dieses Dokumentauftrags: Paketmetadaten und Quelltexte gelesen, vier Tarballs gegen npm-Integrität geprüft, lokale Konfiguration gelesen, Dokumentdiff geprüft. Keine neue Appprüfung unter 7.0.2 behauptet; kein heruntergeladener Compiler ausgeführt.
