# T-006 – PR4-main-Integration konkret vorbereitet

Stand **15.11.2026**. **Noch nicht ausführen: Dieser Auftrag erteilt keine Mergefreigabe.** Heute ausschließlich aktuelle GitHub-Metadaten/Quellen lesen und neue Planungs-/Statusdokumentation lokal sichern. Keine Tests, Builds, CI-Neustarts oder externen Schreibaktionen.

## 1. Eindeutige Quellen und heutige Belege

| Rolle | Stand / Beleg |
|---|---|
| PR4 | [https://github.com/frnkrm/anker/pull/4](https://github.com/frnkrm/anker/pull/4), aktuell Open, Entwicklung→main |
| Quell-/PR-head K | `77316d69d637c0445cf5d2f4dada37c23011a70f` |
| Vorgesehene main-Basis W | `741fb7b09f0a442d779aaed192bd223724d3523f` |
| Feste unveränderte Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Lokaler sauberer Ausgang Q | `1d014c2e9e8aa46e40f32fb0f1c940638a996e16`, Branch entwicklung/anker-neu |
| Neuer lokaler Planungsabschluss R | Exakte SHA in RESULT.json der Sicherung; nicht übertragen, kein PR-/CI-/main-head |
| Spätere tatsächliche main-Workflowquelle W2 | **Unbekannt, erst nach regulärer Integration bestimmen** |
| Beobachteter synthetischer PR-Mergeref | `1f97d8d2e50292cc48d0b0782cc6726e74169d84`; nicht als W2 oder tatsächlichen Checkout vorwegnehmen |

Frische `ls-remote`-Beobachtung am **15.11.2026 um 02:43:59 UTC**: Entwicklung=K, refs/pull/4/head=K, main=W. PR4 ist weiterhin Open/Zielmain. K und M lokal als Vorfahren von Q bestätigt; Q und R nicht im PR. W ist kein lokales Gitobjekt; kein Fetch/Checkout, kein angenommener W-Baum=L-Baum. Zeitpunkte und Antworten in refs-before.json und den aktuellen HTML-Snapshots. Für jede spätere Aktion erneut prüfen; heutige Beobachtung reserviert keine Refs.

Heute erneut nur gelesen:

- [Push-CI43664473155](https://github.com/frnkrm/anker/actions/runs/43664473155): ci.yml, K/push/entwicklung/anker-neu, Versuch1, Success, 10m3s. Öffentliche Summary1372 Vitest ohne Fehler/Skips und379 Playwright (8.8m).
- [PR-CI43666843700](https://github.com/frnkrm/anker/actions/runs/43666843700): ci.yml, pull_request opened#4/Entwicklung, Versuch1, Success, 9m51s. Öffentliche Summary1372 Vitest ohne Fehler/Skips und379 Playwright (8.7m).
- PR-Laufansicht bindet die Workflowdatei aus vollständigem K. PR-head/Checksansicht K bleibt von **unbekanntem API-run.head_sha und unbekanntem tatsächlichen Runnercheckout** getrennt. Keine synthetische SHA als Runtimebeleg ausgeben.

Keine CI oder lokalen Prüfungen wiederholt. Frühere 35+5 lokale Offlinefälle bleiben historische eigene Nachweise.

## 2. Vollständiger Diff und bekannte Zugriffslücken

Aktuelle öffentliche Vergleichsansicht für exakt W...K bestätigt **7 Commits/16 Dateien**. Der bereits vollständig gespeicherte öffentliche Vergleich wurde mit dem vorhandenen lokalen L→K-Diff erneut inhaltlich abgeglichen: **14 Dokumentationsdateien,2 Pythondateien,713 Ergänzungen/2 Entfernungen**, ausschließlich minimaler Prepare-Defaultfix samt Offline-Regressionsfällen und Dokumentation. Keine Produkt-, Versions-, Rechte-, Workflow- oder Freigabemanifeständerung. Nur bei prepare fehlende optionale Felder ergänzen; Pflichtfelder, vorhandene Typen/Werte, unbekannte Schlüssel und sign-/M-/W-/CI-/Artefaktgates bleiben strikt.

Alle geänderten Quellzeilen und Hunk-Bereiche sind gleich. Genau ein Hunk-Kopf zeigt bei GitHub einen Funktionsnamen statt des Klassennamens (8 Byte Darstellung); nur diesen Kontextnamen für den Vergleich normalisiert. Rohdiffs nicht als bytegleich behauptet. Drei-Punkt-/Mergebase-Vergleich nicht mit einer ungeprüften direkten W/L-Baumgleichheit verwechseln. Vollständigen früheren Vergleich mit ursprünglichem Hash/Bezugszeitpunkt in inherited-github-compare.diff und inherited-diff-comparison.json erhalten, nicht als heute neu heruntergeladen ausgeben.

Der bekannte direkte `/pull/4.diff`-Abruf scheiterte nach Weiterleitung mit `urllib.error.URLError: <urlopen error Tunnel connection failed: 403 Forbidden>`. Frühere PR-API-Leseabfrage endete mit `Get "https://api.github.com/repos/frnkrm/anker/pulls?state=open&head=frnkrm:entwicklung/anker-neu&base=main": Forbidden`. Heute keine Wiederholung/Reparatur/Umgehung dieser Zugriffswege und keine neue Rohdiffverfügbarkeit behauptet. Erlaubte öffentliche GitHub-HTML-Ansichten und bereits gesicherter vollständiger unveränderlicher Vergleich bleiben nutzbar. Keine Zugangsdaten oder erneuten bekannten Metadatenfragen.

Öffentlich weiterhin **No reviews**, Rulesetsseite leer. Beides schafft keine Review-/Mergefreigabe und beweist keine Abwesenheit klassischer Branchschutzregeln. **Konflikt-/Mergefähigkeit, klassische Schutzregeln und tatsächliche angemeldete Serveranforderungen bleiben nicht unabhängig lesbar.** Fehlende Anzeige weder als konfliktfrei noch als konfliktbehaftet ausgeben. Diese Lücken erlauben keine Umgehung; ein späterer Merge setzt den unveränderten regulär angebotenen unmittelbaren Serverweg voraus.

## 3. Ausführungsvorlage – nur nach eigenem späterem Integrationsauftrag

### Vorbedingungen unmittelbar vor einer Aktion

1. Separater Auftrag erlaubt ausdrücklich genau eine reguläre PR4-Integration als Merge-Commit K→main/W und die dadurch unverändert ausgelöste vorhandene main-CI samt Prüfungen/Webbuilds/Artefakten. Eine gegebenenfalls bereits konfigurierte automatische main-Webveröffentlichung muss ausdrücklich eingeschlossen sein. Keine Cloudkonfiguration oder Play-/Apppaket-/Geräte-/Gesamtreleasefreigabe daraus ableiten.
2. Frisch per ls-remote Entwicklung/PR4-head=K und main=W bestätigen; PR4 Open, Quelle Entwicklung bei K und Zielmain, gleicher vollständiger Diff. Beide vorhandenen grünen CI zuordnen, nichts neu starten. Lokaler Ausführungsarbeitsbaum sauber auf dem dann autorisierten R; lokale Q/R-Dokumentationsnachfolger nicht übertragen.
3. Geänderte Quelle/Zielbasis, neuer Diff/Trigger/Hook, neue rote Checks, unlesbare erforderliche Belege oder unerfüllte Serverbedingungen: **stoppen und nur dokumentieren**, nichts angleichen, keine Authreparatur. Keine zusätzliche API-Anmeldepflicht erfinden, wenn der reguläre angebotene Besitzer-UI-Weg die unveränderten Serverbedingungen erfüllt.
4. Tatsächlich geforderte Reviews/Checks/Schutzregeln müssen erfüllt sein. Nur wenn ein **unmittelbarer normaler Merge-Commit** regulär angeboten wird, weiter. Bei nur Queue/Automerge, blockiertem Merge, notwendiger Ausnahme oder unklarem Quellstand stoppen. No reviews/leere Rulesets sind hierfür kein Ersatz.

### Genau eine reguläre Integration

Nur den serverseitig angebotenen **Create a merge commit** verwenden. Kein Admin/Force/Squash/Rebase, kein direkter main-Push, keine Queue-/Automergeaktivierung, kein Branchlöschen/Tag oder Übertragen lokaler Dokumentationsnachfolger.

Vorhandenen authentifizierten regulären Agentenweg nur nutzen, wenn ohne Authänderung erreichbar und die Serverbedingungen erfüllbar sind; keine Schreibprobe zur Umgehung eines bekannten Forbidden. Fehlt dieser Weg, normaler Handgriff beim bereits angemeldeten Besitzer:

1. PR4 öffnen; unveränderte Quelle Entwicklung/K, Zielmain/W und grüne Checks prüfen.
2. Ausschließlich regulär angebotenen **Create a merge commit** wählen.
3. **Merge pull request** und **Confirm merge** ausführen; anschließend auf tatsächliche Durchführung warten.
4. Wenn dies nur mit Admin/Regelumgehung, Queue/Automerge oder einer anderen Mergeart möglich ist: nicht ausführen, konkret dokumentieren. Keine neuen Zugangsdaten oder wiederholten Metadatenfragen.

Heute ist keiner dieser Schritte freigegeben oder ausgeführt. Titel/Text dürfen keine neuen Play-Auslöser einschleusen; unerwartete Triggeränderung bedeutet Abbruch, keine Workflow-/Commitreparatur in diesem Integrationsauftrag.

### Tatsächliche Integration anschließend belegen

- PR4 muss **Merged** sein. Tatsächliche main-SHA **W2** frisch aus main-Ref bestimmen und mit dem tatsächlichen PR4-Mergecommit-Link/mergeCommitSha soweit lesbar abgleichen. Erwartete Eltern bei genau dieser regulären Integration: W und K. Öffentliche Commit-/Elternbelege verwenden, unbekannte API-Felder nicht erfinden. Bei Abweichung nur dokumentieren und keine Folgeaktionen.
- Entwicklungsref muss K bleiben. Lokaler Dokumentationshead R bleibt davon getrennt und wird nicht nachgepusht. Kein Fetch/Checkout: W2 kann lokal weiterhin fehlen.
- Synthetischer PR-Mergeref1f97d8d2… ist kein vorab festgelegtes W2. Auch wenn eine SHA später zufällig übereinstimmen sollte, ist erst der tatsächliche main-/PR-Mergebeleg maßgeblich.

## 4. Zwingender eigener W2-main-CI-Gate und unabhängiges M-Gate

Nach erlaubter Integration neue bestehende `.github/workflows/ci.yml` für **exakt W2** lesend bis zum Endergebnis nachkontrollieren. Vollständige SHA, Repository frnkrm/anker, Workflowpfad, Run-ID, Versuch, **event=push/head_branch=main/status=completed/conclusion=success** müssen eindeutig gebunden sein. Öffentliche vollständige Commitlinks/Run-/Workflowansicht nutzen, soweit API gesperrt; nicht aus Kurz-SHA, zeitlicher Nähe oder PR-Mergeref ableiten und keine API-Felder als gelesen ausgeben. Fehlt der exakte Beleg: nicht als grünes W2 abhaken.

**Keine Docs-Ausnahme.** K-Push-/PR-Grün, frühere W-main-CI, ein grüner Vergleichscommit oder App-M-CI ersetzen den W2-main-Push-Beleg nicht. Bei roter oder nicht eindeutig zuordenbarer CI nur Ergebnis/fehlenden Beleg dokumentieren; kein Fix, Rerun, Workflowwechsel oder Ausweichcommit ohne eigenen neuen Auftrag.

**M bleibt feste Appquelle.** Vor späterem prepare/sign verlangt der unveränderte Helper zusätzlich eigenständige erfolgreiche push/main/ci.yml für exakt M; bestehende Bindung an Run43601398931 bleibt erhalten. Auch M muss in der tatsächlichen main-Historie liegen. W2-CI ersetzt M-CI nicht und umgekehrt. Keine Quellkonstante, Gate-/Freigabemanifest- oder Versionsänderung planen. Beide CI-Gates vor späterem eigenem Dispatch erneut belegen; heute keinen neuen M-Run behauptet.

## 5. Gelesene Trigger und getrennte Integrationswirkungen

| Definition | Tatsächlicher Trigger / Wirkung | Grenze der späteren Integration |
|---|---|---|
| ci.yml | push/pull_request ohne Branchfilter; Tests, bestehende JDK-/Offlineprüfungen, Webbuild und PC-Quellpaketartefakt | Erforderlicher automatischer main-Push-Lauf nach Merge; kein manueller Start/Rerun |
| android-aab-pruefstand.yml | ausschließlich workflow_dispatch; resolve verlangt frnkrm/anker/main/manuell; Modi prepare/sign getrennt | Main-Integration startet weder prepare noch sign. Kein Dispatch erlaubt |
| android-update.yml | workflow_dispatch und resolve nur main; getrennte APK-Build-/Signierjobs | Kein automatischer Start, kein Ersatz für Code18-AAB |
| release.yml | push v*-Tag; signierte APK/GitHub-Release | Kein Tag/Release, wird durch regulären main-Merge allein nicht ausgelöst |
| google-play-upload.yml | workflow_dispatch oder main-Push nur am eigenen Workflowpfad; zusätzliche main-/Nachrichten-Gates [anker-play-draft]/[anker-play-inspect] | Unveränderter Workflowpfad nicht im PR; kein manueller Start/Upload/Play-Inventar, alte Code17-Bindungen erhalten |
| play-upload-diagnose.yml | main-Push nur am eigenen Workflowpfad plus [anker-play-report] | Pfad nicht im PR; kein Start/Playzugriff/Umdeutung alter Uploadberichte |
| netlify.toml / mögliche externe Git-Anbindung | Im Repository npm run build, publish=dist, Node24 und SPA-/sw.js-Regeln | Tatsächliche Aktivierung/Branchbindung/Veröffentlichung nicht per Cloudzugriff geprüft. Mögliche schon bestehende main-Webautomatik ausdrücklich in spätere Integrationsfreigabe aufnehmen; keine neue Einrichtung oder Konfigurationsänderung |

Alle sechs Workflowdefinitionen heute lokal gelesen und bytegleich zum gepushten K. Keine Workflow-/Cloud-/Versionsänderung. Vor späterer Integration bei neuem Trigger-/Quellrisiko stoppen. Heute keine automatische Veröffentlichung ausgelöst oder als erfolgt behauptet.

## 6. Kleinste getrennte Freigaben nach diesem Plan

| Eigenständiger Auftrag | Kleinster notwendiger Umfang | Weiterhin ausgeschlossen |
|---|---|---|
| Reguläre main-Integration | Genau ein angebotener Merge-Commit K→W unter Serverregeln, automatische main-CI/Webbuild/Artefakte und gegebenenfalls vorhandene main-Webveröffentlichung; tatsächliches W2 und dessen eigenes main-CI-Endergebnis belegen | Kein prepare/sign, Apppaketbau, Upload, Geräte- oder Gesamtrelease |
| Einmal prepare | Erst nach belegtem W2/main-CI und M-Quell-Gate: separater expliziter secretfreier M-AAB-Prüflauf mit Workflowquelle W2, erforderlichen öffentlichen Dependencies/Actions-Artefakten; echte U2/H2/HP/P/Versuch/A/Archivdigest belegen | Noch kein Schlüsselgebrauch/sign/Play/Geräteinstallation; keine alte U1 als U2 ausgeben |
| Einmal sign/verify | Erst separat für konkret freigegebene M/W2/U2/H2/HP/P/Versuch/A vorhandenen B4-Keygebrauch im isolierten Runner und vollständige secretfreie JAR-/Nutzlastprüfung erlauben | Kein Schlüsselbestand aus Namen/Fingerabdrücken ableiten, keine Secretänderung/Schlüsselrotation/Upload-/Installationsfreigabe |
| Späterer Upload | Erst gültiges S und eigene Code18-spezifische Bindung/Guard-/Versionsbestandsprüfung sowie gesonderte Uploadfreigabe; heute nur den Bedarf benennen | Alte Code17-Manifeste/Guards nicht umschreiben, kein öffentlicher Rollout oder Produktionsrelease |
| Gerätebeobachtungen | E-002 Galaxy/Wecker, E-003 Windows, E-004 Kalender, E-005 NFC mit zugeordnetem Paket und eigener notwendiger Geräte-/Installationsfreigabe | Keine Abnahme aus CI/Bundle/Signatur ableiten, keine Deinstallation/Datenlöschung als Umweg |
| Gesamtfreigabe | Erst nach getrennten tatsächlich belegten Software-/Paket-/Geräte- und Releaseabnahmen | T-006/V-014 nicht aus main-Integration/CI abhaken |

U1 bleibt vorhandene unsigned Referenz aus M:54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. **Kein U2/H2/HP/A/S**, auch kein heutiges W2. Alter P43637658561-Resolvefehler INVALID_SCHEMA bleibt historisch; tatsächliche Rohinputform unbekannt. Lokaler Vertragsfix plus Branch-/PR-Grün beweisen keine erfolgreiche reale Prepare-Eingabe oder Signierbarkeit. B4-Uploadrolle und8A-Playrolle getrennt; keine bekannten Besitzer-/Version-/Zertifikats-/Secretfragen wiederholen. Alte Umgebung/835235b weiter zurückgestellt.

## 7. Heutiger lokaler Abschluss und genau nächster Auftrag

Planungs-/Statusdokumentation ausschließlich lokal committen und unter `/workspace/anker-t006-pr4-main-plan-20261115/` sichern. R nicht nachpushen. Sicherung enthält Vorher-/Nachher-Bundle, aktuelle Ref-/PR-/CI-/Rulesets-/Vergleichsbelege, ausdrücklich als übernommen markierten vollständigen alten Vergleich, Bestandsschutz, unabhängigen Bare-Restore und finales SHA256SUMS. Alte Arbeitsbäume,34bisherigeSicherungsmanifeste,U1,Code17-Nachweise,36RoadmapIDs/103Gerätezeilen erhalten.

**Planung abgeschlossen; Integration nicht freigegeben oder durchgeführt. T-006/V-014 IN_ARBEIT; E-002–E-005 und main-Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** Genau nächster eigener Auftrag: PR4 regulär integrieren und die eigene neue W2-main-CI bis zum Ergebnis nachkontrollieren, ausschließlich nach erneuter expliziter Freigabe samt vorhandener main-Automatik. Kopierfertiger Einzelauftrag mit tatsächlichem R in NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
