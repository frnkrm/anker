# T-006 – regulärer Prepare-Schemafix-PR4 erstellt und CI nachkontrolliert

## Fortschreibung: eigene main-Integrationsvorlage erstellt, nicht ausgeführt (15.11.2026)

[Konkreter PR4-main-Integrationsplan](PR4_MAIN_INTEGRATION_PLAN.md): Nach neuem rein lesendem Auftrag K/W/PR4Open und bestehendes Push-/PR-Grün erneut bestätigt. Regulärer Merge-Commit-Weg, Server-/Abbruchbedingungen, spätere tatsächliche W2-SHA samt eigenem main-CI-Gate und getrennte Freigaben konkret geplant. Kein Merge/Push/Test/Build/Dispatch, keine Authreparatur. Die folgende ursprüngliche PR-/CI-Nachkontrolle bleibt historisch erhalten; R nur neue lokale Planungsdokumentation.

Stand **15.11.2026**. Vorhandener regulärer Nutzer-UI-Rückweg nach API-Forbidden; PR erstellt und anschließend ausschließlich lesend bis zum CI-Endergebnis geprüft. **Kein Merge, Push, manueller Workflowstart, Appbuild oder Signieren durch diesen Auftrag.**

## Tatsächlicher PR und Quellen

[PR4](https://github.com/frnkrm/anker/pull/4): **Open**, Titel „T-006: optionale Prepare-Eingaben im AAB-Prüfweg absichern“, Quelle `entwicklung/anker-neu`, Ziel `main`. Kein Draft oder Doppel-PR. Der Besitzer meldete „Erstellt“; öffentlicher PR und PR-Liste bestätigen die Durchführung, nicht bloß eine geplante Vorlage. Titel/Beschreibung entsprechen der vorher geprüften Vorlage.

| Rolle | Nachweis |
|---|---|
| Gepushter PR-head K | `77316d69d637c0445cf5d2f4dada37c23011a70f`; Entwicklungs- und refs/pull/4/head-Ref aktuell gleich |
| Unveränderte main-Basis/Workflowquelle W | `741fb7b09f0a442d779aaed192bd223724d3523f`; aktueller main-Ref erhalten |
| Unveränderte Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Lokaler sauberer Ausgang N | `a16ac724f2ba167d51f69889c169a48d533b15b2`; K/M als Vorfahren bestätigt, nicht übertragen |
| Neuer ausschließlich lokaler Dokumentationsnachfolger Q | Vollständige SHA in RESULT.json der Sicherung; nicht PR-/CI-/main-head |
| Beobachteter synthetischer refs/pull/4/merge | `1f97d8d2e50292cc48d0b0782cc6726e74169d84`; weder tatsächliches main-W2 noch bestätigter Runnercheckout |

Arbeitsort `/workspace/anker-main-code18-aab`, Branch `entwicklung/anker-neu`. Refs vor Vorbereitung, nach Nutzeraktion und nach erfolgreicher PR-CI lesend bestätigt. Aktuelle Zeitpunkte stehen in refs-before.json, pr4-refs.json und refs-final.json; keine dauerhafte Zusage künftiger Refverfügbarkeit. W bleibt ohne lokales Gitobjekt; kein Fetch/Checkout oder angenommene W-Baumgleichheit.

## Vollständiger Vergleich, Schutz- und Zugriffslücken

Öffentlicher Vergleich für exakt W...K vor PR-Erstellung gelesen und vollständig gesichert: **7 Commits, 16 Dateien, 713 Ergänzungen, 2 Entfernungen**. Sämtliche Änderungsinhalte und Hunk-Bereiche stimmen mit dem vorhandenen lokalen L→K-Diff überein. Rohdateien sind nicht bytegleich: GitHub verwendet in genau einem Hunk-Kopf den Python-Funktionsnamen statt des Klassennamens (8 Byte Darstellungsunterschied). Nur dieser Hunk-Kontextname wurde für den Vergleich normalisiert; keine geänderten Quellzeilen ausgeblendet. diff-comparison.json bindet Original- und normalisierten Hash. Drei-Punkt-Vergleich/PR-Mergebase bleibt von einer direkten Behauptung W-Baum=L-Baum getrennt.

Nach Erstellung bestätigt die PR-Dateiansicht erneut **16 Dateien, 7 Commits, 14 Markdown- und 2 Python-Dateien**, mit unveränderten Quell-/Zielrefs. Nur Dokumentation und belegter Drei-Zeilen-Helperfix samt sieben neuen Offline-Testmethoden; keine Produkt-, Versions-, Rechte-, Workflow- oder Freigabemanifeständerung. Sämtliche sechs aktuellen Workflowdefinitionen gelesen und unverändert. Kein neuer Quell-/Hook-/Triggerpfad. N und Q fehlen im PR.

Ein zusätzlicher direkter Abruf von `/pull/4.diff` scheiterte nach Weiterleitung mit der genauen Meldung **`urllib.error.URLError: <urlopen error Tunnel connection failed: 403 Forbidden>`**. Keine Reparatur/Umgehung. Dieser separate Download ist kein eigener Rohdiffbeleg; stattdessen vorhandener vollständiger erlaubter GitHub-Vergleich der unveränderlichen W/K-Bindung plus frische PR-Refs und PR-Dateiansicht. Zugriffslücke in pr4-direct-diff-access.json festgehalten.

Vorbereitender CLI-Lesezugriff auf die PR-API: `Get "https://api.github.com/repos/frnkrm/anker/pulls?state=open&head=frnkrm:entwicklung/anker-neu&base=main": Forbidden`. Keine Authreparatur, Secret-/Session-/Schlüsselsuche oder eigene PR-Schreibprobe. Kein angebotener GitHub-Connector/steuerbarer angemeldeter Browser. Daher den ausdrücklich vorgesehenen normalen UI-Handgriff beim bereits angemeldeten Besitzer mit geprüftem Titel/Beschreibung verwendet. Kein Doppel-PR oder erneute Metadatenfragen. Vorher 0 offene/3 geschlossene PRs, danach neuer PR4; PR2/PR3 bleiben historisch gemergt.

Öffentlich **No reviews**; öffentliche Rulesetsseite leer. Das ist keine Review-/Schutzfreigabe und beweist keine Abwesenheit klassischer Branchschutzregeln. Konflikt-/Mergefähigkeit, tatsächliche angemeldete Serveranforderungen und API-PR-base.sha wurden nicht unabhängig ausgelesen. Aktuelle Zielbindung W kommt aus main-Ref plus öffentlichem Zielbranch; keine API-Felder erfinden. Keine Mergefreigabe daraus.

## Eigenständiger neuer PR-CI-Beleg

[CI43666843700](https://github.com/frnkrm/anker/actions/runs/43666843700): **ci.yml / pull_request opened #4 / entwicklung/anker-neu / Versuch 1 / Success**. Gesamt **9m 51s**, check **9m 48s**. Öffentliche Summary bis zum terminalen Ergebnis ausschließlich lesend nachkontrolliert, letzter Endbeleg pr4-poll-08.html/txt/json und ci-final-read.json.

PR4-head K wird durch Gitrefs belegt. Die Laufansicht „Workflow file for this run“ verlinkt `.github/workflows/ci.yml` aus vollständigem **K**; die Checksansicht wählt K. Versuch 1 ist über navigation_partial?attempt=1 im öffentlichen HTML gebunden. **API-run.head_sha und tatsächlicher Runnercheckout bleiben unbekannt.** Die PR-Laufsummary enthält keinen vollständigen Commitlink; Workflowdateiquelle/PR-head und tatsächliche Runtime-SHA nicht gleichsetzen. Der synthetische Mergeref ist separat beobachtet, nicht als API-/Checkout-/main-SHA behauptet.

Öffentliche Abschluss-Notices:

- **Vitest: 1372 passed; 0 failed; 0 skipped**.
- **Playwright: 379 passed (8.7m)**.

PC-Matrix abgeschlossen, Gesamtlauf erfolgreich. Beobachtetes Artefakt **Anker-PC-Begleiter-Quellpaket**, 95 KB, Digest `sha256:3d5b56fee40f6b1474e22543199054894d495a3544bc0bf8c2ea3c1b661d3d80`; nicht heruntergeladen oder installiert. Detaillogs erfordern Anmeldung; einzelne Offline-/Python-/Java-Zahlen nicht zusätzlich erfunden. Runner-/Action-Warnungen kein Anlass zu Änderungen.

Vorhandene Push-CI **43664473155 / K / push / Entwicklung / Versuch1 / Success** erneut nur gelesen; 1372 Vitest/379 Playwright als eigenständiger Pushbeleg. Frühere 35 lokale Protokoll- plus fünf gezielte Workflowtests bleiben eigene historische Nachweise. Keine lokale Suite, Syntaxprüfung, App-/Web-/Android-/APK-/AAB-Erzeugung oder Signierprobe wiederholt. Die unverändert durch PR-Erstellung ausgelöste bestehende CI samt Webbuild/Artefakten war freigegeben. Mögliche bestehende PR-Previewautomatik eingeschlossen, tatsächliche Webveröffentlichung nicht separat belegt; keine Cloudkonfigurationsänderung.

## Erhaltene Grenzen und nächster Auftrag

Manueller android-aab-pruefstand.yml bleibt ausschließlich main/workflow_dispatch mit getrennten prepare/sign-Modi; kein Dispatch/Neustart durch diesen Auftrag. Android-Update manuell, Release nur v*-Tag, Play-/Diagnosepfade mit eigenen main-/Pfad-/Nachrichten-Gates bleiben unverändert und ungestartet. Keine Google-Play-/Console-/Secretabfrage, Datenlöschung oder Geräte-/NFC-/PC-Wirkung. B4-Uploadrolle und 8A-Playrolle getrennt.

P43637658561/Versuch1 bleibt der alte fehlgeschlagene prepare-Resolve-Lauf; tatsächliche Rohinputform weiterhin unbekannt. K-Push-/PR-Grün beweist keinen erfolgreichen Prepare-Runnerlauf oder Schlüsselzugriff. **Kein U2/H2/HP/A/S.** U1 unverändert aus M, 54.264.632 Bytes, SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`, nicht umetikettiert. Alte Arbeitsbäume, 33 bisherige Sicherungsmanifeste, Code17-Nachweise und zurückgestellte Umgebung/835235b erhalten.

**T-006/V-014 IN_ARBEIT; E-002–E-005 und main-Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** K ist noch keine neue main-Workflowquelle W2. K-Branch-/PR-Grün ersetzt keine eigene erfolgreiche ci.yml für exakt das erst nach regulärer Integration zu bestimmende W2/event=push/head_branch=main. M behält seinen eigenen Quell-CI-Gate, keine Docs-Ausnahme.

Genau nächster separat zu beauftragender Auftrag: **PR4-main-Integration ausschließlich lesend konkret vorbereiten**, mit aktuellen Quellen, unveränderten Serverregeln, regulärem Merge-Commit-Weg, Abbruchbedingungen und künftigem W2 samt eigener main-CI. Noch kein Merge/Workflowstart/Signieren. Vollständiger kopierfertiger Auftrag mit tatsächlichem Q in NAECHSTER_EINZELAUFTRAG.txt.

Nur neue Status-/Nachkontrolldokumentation lokal committen und unter `/workspace/anker-t006-schemafix-pr-20261115/` sichern; Q nicht nachpushen. Historische UI-Wartephase samt ursprünglichem SHA256-Verzeichnis als SHA256SUMS_UI_HANDOFF erhalten; UI_HANDOFF_ERLEDIGT.json und RESULT.json bilden den aktuellen Abschluss ab. Nachher-Bundle, unabhängiger Bare-Restore, Bestandsaudit und finales SHA256SUMS sichern das Ergebnis. Danach stoppen.
