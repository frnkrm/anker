# T-006 – regulärer PR3 für den AAB-Workflowentwurf

Stand **14.11.2026**. Vorprüfung, normaler GitHub-UI-Handgriff durch den Besitzer und lesende Nachkontrolle abgeschlossen. **Keine main-Integration und kein AAB-Workflowstart.**

## Quellen und tatsächlich ausgeführter Umfang

| Identität | Nachweis |
|---|---|
| Arbeitsort / Branch | `/workspace/anker-main-code18-aab` / `entwicklung/anker-neu` |
| Sauberer lokaler Ausgang D | `a72741d5985ae67d3c790017a9099e8e38d20856`; nicht übertragen |
| Gepushter Quell-/PR3-head L | `3f5345dd08032aa6d19328a2c2cee22527150266` |
| Unveränderte main-Basis / Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Neuer regulärer PR | [#3](https://github.com/frnkrm/anker/pull/3), **Open**, Entwicklung→main, erstellt durch frnkrm am 14.11.2026 um16:35:22UTC |
| Neuer PR-CI-Lauf | [43616437865](https://github.com/frnkrm/anker/actions/runs/43616437865), ci.yml / **pull_request opened #3 / entwicklung/anker-neu** |
| Versuch / Endergebnis | **1 / erfolgreich**, Dauer `9m 57s`, Endbeleg `2026-11-14T16:45:38.891806+00:00` |
| Beobachteter synthetischer PR-Mergeref | `0874d430eea96a7f7f521e26a03d0d2a30ee05cb`; keine tatsächliche main-SHA und kein zukünftiges W |
| Neuer lokaler Abschluss E | Exakt im Sicherungsmanifest RESULT.json; nicht gepusht, kein PR-/CI-head |

Branch/Arbeitsbaum/HEAD=D vorab bestätigt, L und M als Vorfahren nachgewiesen. Aktuelle Gitrefs vor UI und danach: Entwicklung=L, main=M. Vollständiger lokaler M→L-Diff und Dreipunktvergleich stimmen überein: **3 Commits /17Dateien /2308Einfügungen /2Löschungen**. Die öffentliche Compare-Seite bestätigt3Commits/17Dateien, lädt aber Detaildiff/Konfliktstatus nicht vollständig. Der vollständige187344Byte-Diff liegt in der Sicherung. Nur neuer manueller AAB-Prüfworkflow/Prüfhelfer/gezielteCI-Einbindung/Dokumentation; keine Produkt-/Versions-/Paket-/SDK-/Android-Rechte-/Code17-Freigabemanifeständerung. D-only-Dokumentation nicht in den PR übernommen.

Vorab waren0offenePRs öffentlich sichtbar. `gh pr list` scheiterte mit **`Post "https://api.github.com/graphql": Forbidden`**. Keine Authreparatur, Token-/Secret-/Session-/Schlüsselsuche. Kein GitHub-Connector oder Desktop-/Browser-Steuerungstool war hier aufrufbar; daher exakt der ausdrücklich erlaubte normale UI-Rückweg: vorausgefüllter Titel/Beschreibung, Besitzer klickt Create pull request und meldet „erstellt“. Danach PR3 öffentlich mit exaktem L/M bestätigt. **Kein Agenten-POST zur PR-Erstellung und kein Doppel-PR**, kein weiterer Push, PR-Kommentar oder sonstiger Schreibzugriff. PR2 bleibt historisch gemergt und wurde nicht wiederverwendet.

## CI-SHA, Workflowquelle und Checkout unterscheiden

PR3-Checksansicht wählt ausdrücklich CommitL und verknüpft den neuen pull_request-Lauf43616437865. Die zugehörige Workflowansicht verweist auf `.github/workflows/ci.yml` **aus L**. Summary bestätigt PR3, Ereignis pull_request, Entwicklungsbranch, aktuellen Versuch aus `jobGroupsFetchUrl?attempt=1` bei `viewingCurrent=true` und Endstatus **erfolgreich**. Die Actions-Liste liefert dieselbe Zuordnung. Öffentliche Summary: 1372 Vitest bestanden / 0 Fehler / 0 Skips; 379 Playwright bestanden (8.8m).

Das API-Feld **run.head_sha** ist wegen des gesperrten API-Wegs nicht eigenständig ausgelesen. Die tatsächlich ausgecheckte Runner-/GITHUB_SHA ist ohne lesbare Joblogs ebenfalls **unbekannt**. `refs/pull/3/head=L` und `refs/pull/3/merge=0874d430eea96a7f7f521e26a03d0d2a30ee05cb` sind per ls-remote belegt; daraus keinen ungeprüften tatsächlichen Checkout ableiten. Workflow-Dateiquelle L, PR-/Checks-Zuordnung L, synthetischer Mergeref und unbekannte Runtime-SHA sind getrennte Belege. Kein Fetch/Checkout dieses synthetischen Objekts.

Der getrennte frühere **Push-Lauf43614039702 / push / Entwicklung / exakt L / Versuch1 erfolgreich** bleibt erhalten. Die vorherigen43lokalenOfflinefälle sind ein eigener Softwarebeleg; positive Signierfälle nur Attrappen, Actionlint lokal fehlend. Keine lokalen Tests/Builds wiederholt und keine Paket-/Werkzeugupdates. Die neue PR-CI ist kein echter B4-Signier-/AAB-/Hardwarebeleg und ersetzt **keine spätere exakte push/main/ci.yml-CI des tatsächlichen W**. M behält seinen eigenständigen vorhandenen main-CI-Beleg43601398931.

## Review, Schutz und erlaubte Auslöser

Öffentliche PR-Seite zeigt **No reviews**; das ist keine Reviewfreigabe. Die Rulesets-Seite meldet **You haven't created any rulesets**. Klassische Branchschutzregeln, angemeldete Review-/Serverbedingungen und belastbarer Konflikt-/Mergefähigkeitsstatus bleiben **unbekannt**. Featureflags oder defaultMergeMethodMERGE sind keine angebotene Mergefreigabe. Keine Regel geändert/umgangen, keine Queue/Automerge/Adminoption benutzt; PR3 bleibt offen und ohne Mergecommit.

Alle6Workflowdefinitionen unverändert gelesen/gehasht: ci.yml enthält vorhandene push/pull_request-Prüfungen und die bereits gepushte gezielte Offline-/JDK-Erweiterung. Der eröffnete PR durfte die bestehende pull_request-CI samt Prüfungen/Webbuild/Artefakten und gegebenenfalls vorhandener PR-Previewautomatik auslösen. Eine tatsächliche Previewveröffentlichung ist nicht separat belegt; keine aktive Cloudkonfiguration geändert.

Der AAB-Workflow ist ausschließlich manuell aufmain, mit getrenntem prepare/sign und exakten M-/W-main-CI-Gates. **Kein prepare/sign-Aufruf.** Android-APK-Update bleibt manuell/main; Release-APK verlangt v*-Tag; Play-/Diagnosewege verlangen ihre unveränderten main-/Pfad-/Markergates. PR-Erstellung trifft diese Auslöser nicht. Keine Workflowänderung/-neustart, main-/Tagübertragung, Signierung, Installation, App-/APK-/AAB-Erzeugung, Secret-/Cloud-/Play-/Geräteaktion. Bei nicht erfolgreicher CI nur dokumentieren; kein Fix oder Neulauf.

U1 unverändert als unsignedReferenz im bisherigen Prüfordner:54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. **W/U2/S fehlen weiterhin als reale main-/Runner-/Signiernachweise.** B4Upload-/8APlayrolle und unbekannter privater Schlüsselzugriff unverändert getrennt. Alte Code17-Nachweise/Arbeitsbäume/Sicherungen und zurückgestellteUmgebung/835235b erhalten.

## Nur lokaler Abschluss

Diese Status-/Nachkontrolldokumentation lokal committen und unter `/workspace/anker-t006-aab-pr-vorbereitung-20261114/` mit Vorher-/Nachher-Bundle, PR-/Ref-/CI-/HTML-/Diff-/Schutzbelegen, unabhängigem Bundle-Restore und SHA256SUMS sichern. Frühere UI_HANDOFF/preflight-Angaben „kein PR/ausstehend“ sind der gesicherte Vorzustand; aktuelles Ergebnis steht in RESULT.json. Kein Nachpush von E.

**T-006/V-014 IN_ARBEIT; E-002–E-005 und main-Integration-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben bleiben offen.** Genau nächster separat zu beauftragender Einzelauftrag: **PR3-main-Integration ausschließlich lesend konkret vorbereiten**. Kopierfertiger Auftrag mit tatsächlichem E im Sicherungsordner NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen, heute kein Merge.
