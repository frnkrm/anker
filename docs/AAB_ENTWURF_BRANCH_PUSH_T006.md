# T-006 – einmaliger Entwicklungsbranch-Push des AAB-Workflowentwurfs

Stand **14.11.2026**. Tatsächlich ausgeführte, begrenzt freigegebene Übertragung und lesende GitHub-Nachkontrolle. **Kein main-Eingriff und kein Start des manuellen AAB-Workflows.**

## Quellen und Ergebnis

| Identität | Nachweis |
|---|---|
| Arbeitsort / Branch | `/workspace/anker-main-code18-aab` / `entwicklung/anker-neu` |
| Sauberer Ausgang / gepushter Übergabehead L | `3f5345dd08032aa6d19328a2c2cee22527150266` |
| Vorheriger Entwicklungsref C | `2c3a2905ec9068914b3967627ea0f62516603bb6` |
| Appquelle und unveränderter main M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Neuer CI-Lauf | [43614039702](https://github.com/frnkrm/anker/actions/runs/43614039702), `.github/workflows/ci.yml`, **push / entwicklung/anker-neu / exakt L** |
| Tatsächlicher Versuch / Ergebnis | **1 / erfolgreich**, Summary-Dauer `11m 19s`; letzter Endbeleg `2026-11-14T16:20:51.675122+00:00` |
| Späterer lokaler Dokumentationshead D | Steht exakt im Sicherungsmanifest RESULT.json; **nicht gepusht und keine CI-Quelle** |
| Spätere main-Workflowquelle W / Runner-U2 / signed S | Weiterhin **nicht belegt / nicht erzeugt** |

Vor Push Branch, sauberer Arbeitsbaum und HEAD=L bestätigt; C und M sind lokale Vorfahren von L. Exakter Vergleich C→L: **17 Dateien, 2308 Einfügungen / 2 Löschungen**, neue AAB-Prüfvorlage/Prüfhelfer, gezielte ci.yml-Erweiterung und Dokumentation. Produktquellen, Version/Paketdateien, SDK/Android-Rechte, ursprüngliche Roadmap/Gerätekataloge, die vier alten APK-/Release-/Play-/Diagnoseworkflows und Code17-Nachweise bytegleich. Kein neuer Hook oder abweichender Push-URL/Receivepack; vorab Git-Bundle geprüft.

Direkt vor Übertragung per `ls-remote` Entwicklung=C und main=M frisch bestätigt. Genau ein normaler Fast-forward-Push ausschließlich `L:refs/heads/entwicklung/anker-neu`, ohne Force/Tags/Submodule-Push/Commit-Pushsignatur, erfolgreich am 14.11.2026 um 16:09 UTC. Danach und zum Abschluss Entwicklung=L, main=M nachgewiesen. Kein lokaler Dokumentationsnachfolger übertragen; kein zweiter Push, Fetch, Checkout, Tag, PR-Erstellen oder Merge.

## Tatsächliche GitHub-Nachkontrolle und Zugriffslücken

API-Leseversuch für PR2: **`Tunnel connection failed: 403 Forbidden` (CONNECT403)**. Keine Authreparatur oder Secretabfrage; die Lücke bedeutet keine fehlenden Secrets. GitHub-HTML lieferte HTTP200. PR2 öffentlich **Merged**, historischer PR-head C, Ziel main. Kein neuer offener PR2-head L behauptet.

Actions-Liste verknüpft den neuen Lauf ausdrücklich mit dem vollständigen Commitlink L, Quelle `.github/workflows/ci.yml`, Entwicklungsbranch und Push. Summary bestätigt Ereignis/Branch/Commit, aktuelle Versuchnummer aus `jobGroupsFetchUrl?attempt=1` bei `viewingCurrent=true` sowie das Endergebnis **erfolgreich**. Keine synthetische PR-Mergeref oder Run-Nummer als Commit-SHA verwendet.

Die erfolgreiche Entwicklungsbranch-CI ist belegt; ein neuer PR wurde heute nicht angelegt.

Die öffentliche Summary nennt **1.372 Vitest-Fälle bestanden, 0 Fehler, 0 Skips** und **379 Playwright-Fälle bestanden (9,5 Minuten)**. Das sind neue sichtbare Runnernachweise für L. Die Detailzahlen der neuen Python-/AAB-Offlinefälle sind ohne angemeldete Joblogs nicht separat ausgelesen; deren zuvor lokal belegte43Fälle bleiben als solche gekennzeichnet. Die erfolgreiche Gesamtlaufprüfung enthält die unveränderten neuen Testaufrufe aus L.

Sichtbare Hinweise: bestehende Node20-Actionversionen werden vom Runner auf Node24 ausgeführt; eine bestehende React-Hook-Lintwarnung betrifft `TaskAssistance.tsx:41`; der Runner kündigt die Ubuntu26-Umstellung an. Keine neue Versions-/Workflow-/Produktkorrektur aus diesen Warnungen abgeleitet. Ein PC-Quellpaketartefakt ist in der Summary sichtbar; kein AAB-/APK-Prüfartefakt erzeugt oder heruntergeladen.

Öffentliche einzelne Jobseiten melden **„Sign in to view logs“**; daher keine angemeldeten Detail-/Rohlogs voraussetzen. Der öffentlich angebotene Jobgruppen-Leseendpunkt antwortete **HTTP400 Bad Request**, nicht weiter umgangen. Gesicherte Summary/Actions-HTML-/JSON-Belege, sichtbare Annotationen und Ergebnisfelder bestimmen die belegte Tiefe; keine unbekannten Einzeltestzahlen erfinden. Die alten lokalen **43/43 Offlinefälle** bleiben getrennte vorhandene Belege. Kein lokaler Test-/Buildneulauf und keine neue Actionlint-Installation. Echte Schlüssel-/Signier-/Runner-AAB-Nachweise entstehen daraus nicht.

Die erfolgreiche Branch-CI ersetzt **keinen exakten push/main/ci.yml-Beleg für zukünftiges W**. Appquelle M behält ihren getrennten vorhandenen main-CI-Nachweis43601398931. D ist nur lokaler Dokumentationsabschluss. App-M, L, D, zukünftiges W und unterschiedliche CI-SHAs bleiben getrennt.

## Auslöser und unveränderte Grenzen

Alle sechs lokalen Workflowdefinitionen geprüft und gehasht:

- `ci.yml`: vorhandene push-/pull_request-Automatik; nur deren tatsächlicher Push-Lauf43614039702 heute gestartet. Neue Offlineprüfschritte/JDK-Einrichtung und vorhandene Prüfungen/Webbuild/Artefakte gehören zur Freigabe. Keine manuelle CI-Aktion.
- `android-aab-pruefstand.yml`: ausschließlich workflow_dispatch, Resolve zusätzlich nur main/frnkrm/anker. Prepare und sign bleiben getrennte manuelle Aufrufe; **keiner gestartet**. Das Übertragen nach Entwicklung legt noch kein W fest.
- `android-update.yml`: ausschließlich manueller main-Weg; nicht gestartet.
- `release.yml`: nur v*-Tagpush; kein Tag übertragen und kein APK-/GitHub-Release erzeugt.
- `google-play-upload.yml`: manueller main-Weg oder main-Push nur bei Änderung genau dieser Datei und bestehendem Marker-Gate. Dieser Entwicklungsbranch-Push trifft nicht zu; Datei unverändert.
- `play-upload-diagnose.yml`: main-Push bei Änderung genau dieser Datei plus bestehendem Reportmarker; hier nicht getroffen und unverändert.

Eine gegebenenfalls bereits konfigurierte Branch-Previewautomatik war freigegeben; daraus keine eigene bestätigte Webveröffentlichung ableiten. Keine aktive Cloudkonfiguration geändert oder Cloud-/Google-/Secret-/Zertifikatsquelle abgefragt. Keine Schlüssel-/Wertsuche, Signierung, Installation, App-/APK-/AAB-Erzeugung, Versions-/Freigabemanifeständerung oder echte Geräte-/NFC-/PC-Wirkung.

U1 bleibt unter `/workspace/anker-main-code18-aab-pruefung-20261114/Anker-Code18-main-10cc894-UNSIGNIERT.aab`,54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. Kein U2/S oder echter B4-Signiernachweis; Uploadrolle B4 und Play-Approlle8A bleiben getrennt. Historisches AAB014870f3 enthält den NFC-Fix nicht und wurde nicht umetikettiert. Alte Arbeitsbäume, Sicherungen und zurückgestellte Umgebung/835235b erhalten.

## Abschluss und genau nächste Grenze

Nur diese Nachkontroll-/Statusdokumentation lokal committen und sichern unter `/workspace/anker-t006-aab-entwurf-push-20261114/`: Vorher-/Nachher-Bundle, Ref-/Push-/Trigger-/HTML-/CI-Belege, Schutzprüfung, unabhängige Bundlewiederherstellung und SHA256SUMS. Kein Nachpush von D.

**T-006/V-014 bleiben IN_ARBEIT; E-002–E-005 und main-Integration-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.**

Genau nächster separat zu beauftragender Einzelauftrag: **neuen regulären PR für den AAB-Workflowentwurf vorbereiten und erstellen, ohne Merge**. Vollständig kopierfertige Vorlage mit exakten L/M/D-Bindungen im Sicherungsordner `NAECHSTER_EINZELAUFTRAG.txt`. Heute nicht ausführen; danach stoppen.
