# T-006 – PR4 regulär integriert und eigene W2-main-CI nachkontrolliert

Stand **15.11.2026**, lesbare Zeiten **Europe/Berlin (MEZ)**. Autorisierte reguläre PR4-Integration durch den Besitzer nach vorgesehenem UI-Handgriff; anschließend ausschließlich lesende Quellen-/CI-Nachkontrolle. **Kein Agenten-Push, manueller Workflowstart, lokaler Test/Build, Signieren oder Playzugriff.**

## Tatsächlicher Merge statt vorweggenommener Mergeref

[PR4](https://github.com/frnkrm/anker/pull/4) ist **Merged**, nicht nur zum Merge vorbereitet. Der Besitzer meldete „gemergt“. Aktueller main-Ref, öffentlicher PR-Mergecommit-Link und im öffentlichen PR-HTML enthaltenes mergeCommitSha stimmen überein:

| Rolle | Vollständiger Stand / Beleg |
|---|---|
| Tatsächliche neue main-Workflowquelle W2 | **`87c83fedf5c1aa52450ee36f650134c442928c28`** |
| Vorherige main-Basis W | `741fb7b09f0a442d779aaed192bd223724d3523f` |
| Erhaltener Entwicklungs-/PR4-head K | `77316d69d637c0445cf5d2f4dada37c23011a70f` |
| Unveränderte feste Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Lokaler sauberer Ausgang R | `5d4e749f25df274b65cb0234d711c2f9974e62f4`, Branch entwicklung/anker-neu |
| Neuer ausschließlich lokaler Dokumentationsabschluss D2 | Exakte SHA in RESULT.json der Sicherung; nicht übertragen, nicht main-/CI-head |

Öffentliche [Commitansicht von W2](https://github.com/frnkrm/anker/commit/87c83fedf5c1aa52450ee36f650134c442928c28) belegt **genau zwei Eltern in dieser Reihenfolge: W und K**. Sie zeigt den erwarteten Merge von PR4 mit 16 Dateien/713 Ergänzungen/2 Entfernungen. Vollständiges Elternarray aus öffentlichem HTML gesichert, keine Gitobjekte geholt. Zuvor beobachteter synthetischer PR-Mergeref `1f97d8d2e50292cc48d0b0782cc6726e74169d84` ist ausdrücklich nicht W2 oder nachträglich bestätigter Runnercheckout.

Vorprüfung um **04:41:31 MEZ**: Entwicklung/PR4-head=K und main=W, PR4Open, beide vorhandenen CI grün, unveränderter vollständiger Diff/Hooks/Trigger. Nach Nutzeraktion main=W2 erstmals um **05:24:54 MEZ** bestätigt; Abschlusskontrolle um **05:35:46 MEZ** erneut main=W2 und Entwicklung/PR4-head=K. Branch blieb erhalten. Zeitgestempelte Antworten in refs-before/after-user/final.json; technische Originalzeiten dort zusätzlich UTC.

Arbeitsort `/workspace/anker-main-code18-aab` lokal weiterhin auf R beziehungsweise danach nur neuem D2, nicht W2 ausgecheckt. **W2 ist kein lokales Gitobjekt.** Kein Fetch/Checkout/Clone/Rebase und keine Übertragung lokaler Q/R/D2-Dokumentationsnachfolger. W2 nicht als lokal wiederhergestellten Paketstand ausgeben.

## Regulärer UI-Rückweg und unveränderte Auslöser

Vorhandene API-Leseabfrage: `Get "https://api.github.com/repos/frnkrm/anker/pulls/4": Forbidden`. Kein steuerbarer angemeldeter Browser/GitHub-Connector erreichbar. Keine Auth-/Session-/Schlüsselsuche, Reparatur/Umgehung oder eigene Merge-Schreibprobe. Deshalb ausdrücklich vorgesehener normaler Besitzer-UI-Handgriff: Create a merge commit → Merge pull request → Confirm merge, ausschließlich regulär ohne Ausnahme angeboten. Aktueller Merge-/Elternbeleg und Nutzerbericht sind die Durchführungsevidenz; geschützte Serverkonfigurationen wurden nicht als gelesen ausgegeben.

Öffentliche No reviews/leere Rulesets vorab waren keine Schutzfreigabe. Tatsächliche klassische Schutz-/Review-/Konfliktkonfiguration war nicht unabhängig lesbar; keine Umgehung oder Admin-/Force-/Queue-/Automergeaktivierung vorgenommen. Keine Branchlöschung oder Tags. Quellenabweichung war vorab ausgeschlossen; nach Merge erwartete Eltern W/K und EntwicklungsrefK belegt.

Vollständiger gespeicherter exakter W...K-Vergleich mit lokalem L→K-Diff inhaltlich gleich: 7 Commits,14 Dokumentationsdateien,2 Pythondateien. Nur minimaler Prepare-Defaultfix samt Offlinefällen und Dokumentation; ein Hunk-Kontextname war anders dargestellt, keine geänderte Quellzeile ignoriert. Kein neuer direkter PR-.diff-Download nach bekanntem Tunnel403, keine W/L-Baumgleichheit unterstellt. Alter Vergleich ausdrücklich als übernommener Beleg erhalten.

Alle sechs bestehenden Workflowdefinitionen unverändert. Regulärer main-Push löst ci.yml samt bestehenden Prüfungen/JDK-/Offlinefällen/Webbuild/Artefakten aus; diese Wirkung war autorisiert. Eine gegebenenfalls bereits konfigurierte automatische main-Webveröffentlichung war ausdrücklich eingeschlossen, tatsächliche Veröffentlichung/Cloudaktivierung aber nicht separat geprüft oder behauptet. Keine aktive Cloudkonfiguration geändert.

Manueller AAB-Workflow bleibt workflow_dispatch/main mit getrenntem prepare/sign; Android-Update manuell, Release nur v*-Tag, Play-/Diagnosepfade mit eigenen main-/Pfad-/Nachrichten-Gates. Keine dieser manuellen Aktionen gestartet, keine Play-/Console-/Secretabfrage. Öffentliche Actionsliste zeigt nur die neue automatische main-CI neben bisherigen Läufen; alter fehlgeschlagener manueller P bleibt erhalten. Alte Code17-Manifeste/Guards unverändert.

## Eigener exakter W2-main-CI-Beleg

[CI43676620317](https://github.com/frnkrm/anker/actions/runs/43676620317) wurde bis zum terminalen Ergebnis ausschließlich lesend nachkontrolliert; **Success um 05:35:12 MEZ gelesen**, keine Neustarts.

| Feld | Tatsächlicher öffentlicher Nachweis |
|---|---|
| Repository | frnkrm/anker |
| Workflow | `.github/workflows/ci.yml` |
| Vollständige Laufquelle / Workflowdateiquelle | **W2 `87c83fedf5c1aa52450ee36f650134c442928c28`**, vollständige Commitlinks der Summary und Workflowansicht |
| Ereignis / Branch | **push / main** |
| Run-ID / Versuch | **43676620317 / 1**, Versuch über navigation_partial?attempt=1 im öffentlichen HTML |
| Endstatus / Ergebnis | **abgeschlossen / Success** laut öffentlicher Summary, kein API-Feld als ausgelesen behauptet |
| Gesamtdauer / check | **10m31s / 10m28s** |
| Öffentliche Vitest-Notice | **1372 passed; 0 failed; 0 skipped** |
| Öffentliche Playwright-Notice | **379 passed (9.0m)** |

Vollständiges main-Ref-W2, PR-Mergecommit, Elternarray, Summary-Commitlink und CI-Workflowdateiquelle binden dieselbe tatsächliche SHA. API-run.head_sha und tatsächlicher Runnercheckout wurden **nicht eigenständig ausgelesen**; dies sind öffentliche eindeutige Quellen-/Runbelege, keine erfundenen API-Rohdaten. Kein Ersatz durch K-Branch-/PR-Grün, frühere W-main-CI oder Docs-Ausnahme.

Öffentliches Helper-Quellobjekt aus exakt W2 zusätzlich gelesen: **alle717Zeilen entsprechen dem unveränderten lokalen K/R-Helper**. Drei-Zeilen-Preparefix jetzt in main belegt; Signier-/Quell-/CI-Gates bleiben unverändert. Kein tatsächlicher alter P-Input daraus rekonstruiert.

Unabhängiges M-Quell-Gate erhalten: [CI43601398931](https://github.com/frnkrm/anker/actions/runs/43601398931), exakt M/push/main/Versuch1/Success erneut nur gelesen. M bleibt feste Appquelle; W2 bleibt separate Workflowquelle. M ist lokal Vorfahr K, K öffentlicher Elterncommit von W2. W2-CI ersetzt M-CI nicht und umgekehrt. Vor späterem eigenen Dispatch beide Belege/Quellen erneut prüfen.

PC-Matrix abgeschlossen, Gesamtlauf erfolgreich. Ein beobachtetes Artefakt **Anker-PC-Begleiter-Quellpaket**,95KB,Digest `sha256:f00bb8ef16ef865ce0bdd92a91c04b6a81dd3ac74883f25f930f5732f2b17e2a`; nicht heruntergeladen oder installiert. Einzelne zusätzliche Offline-/Python-/Java-Testzahlen aus anmeldungspflichtigen Logs nicht erfunden. Runner-/Action-Hinweise kein Anlass zu Änderungen. Keine lokalen Produkt-/Browser-/PC-/Androidtests, Builds oder Paket-/Signierprüfungen wiederholt; Software-/CI-Belege sind keine echten Gerätebeobachtungen.

## Erhaltene Freigabegrenzen und nächster zulässiger Auftrag

**Main-Integration und eigene W2-main-CI im belegten Umfang abgeschlossen. T-006/V-014 bleiben IN_ARBEIT; E-002–E-005 sowie Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** Kein App-/APK-/AAB-Bau außerhalb autorisierter automatischer Web-CI, kein privater Schlüsselgebrauch, Installieren, Datenlöschen oder echte Geräte-/NFC-/PC-Wirkung. Produkt-/Version-/Rechte-/Signierkonfiguration unverändert.

U1 bleibt unsigned Referenz aus M:54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`, kein neues Paket oder U2. **U2/H2/HP/A/S fehlen weiterhin.** P43637658561/Versuch1 bleibt der alte fehlgeschlagene prepare-Resolve-Lauf; Rohinputform unbekannt. K-/PR-/W2-Grün beweist keinen neuen tatsächlichen Prepare-/Signiererfolg. B4-Uploadrolle und8A-Playrolle getrennt; Secretverfügbarkeit/Signierbarkeit weiter unbestätigt. Alte Arbeitsbäume/Sicherungen/Code17-Nachweise und zurückgestellte Umgebung/835235b erhalten.

Genau nächster separat zu beauftragender Auftrag: **einmaligen neuen secretfreien Code18-AAB-prepare-Prüflauf mit Appquelle M und Workflowquelle W2 starten und nachkontrollieren**. Erst nach eigener neuer Freigabe, aktuellen Refs und erneutem M-/W2-main-CI-Gate. Modus prepare, source_commit=M, expected_workflow_commit=W2 und alle fünf Signierbindungen leer; keine automatische Signierung, kein Rerun des alten P und kein Play. Erst tatsächliches U2 mit H2/HP/Run/Versuch/Artefakt-ID/Archivdigest schafft eine reviewbare spätere Signierübergabe.

Lokaler Abschluss D2 nur Status-/Nachkontrolldokumentation, nicht nachpushen. Sicherung `/workspace/anker-t006-pr4-main-integration-20261115/` mit Vorher-/Nachher-Bundle, aktuellen Ref-/PR-/Commit-/Eltern-/Quell-/CI-HTML-Belegen, Bestandsschutz, unabhängigem Bare-Restore und SHA256SUMS. Alter UI-Wartezustand samt SHA256SUMS_UI_MERGE_HANDOFF bleibt historisch, UI_MERGE_HANDOFF_ERLEDIGT.json und RESULT.json bilden den Abschluss ab. Beide alten Arbeitsbäume,35frühereSicherungsmanifeste,U1,36RoadmapIDs/103Gerätezeilen erhalten. Exakter D2 und genau ein kopierfertiger Folgeauftrag in RESULT.json beziehungsweise NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
