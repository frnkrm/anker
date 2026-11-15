# T-006 – Prepare-Schemafix übertragen, Push-CI nachkontrolliert

Stand **15.11.2026**. Genau ein freigegebener normaler Fast-forward-Push auf den Entwicklungsbranch; anschließend ausschließlich lesende CI-/Refnachkontrolle und lokale Abschlussdokumentation. **Kein PR erstellt, main unverändert, kein prepare/sign-Aufruf.**

## Quellen und aktueller Refbeleg

| Rolle | Vollständiger Stand |
|---|---|
| Fix-/Übergabehead und gepushte CI-Quelle K | `77316d69d637c0445cf5d2f4dada37c23011a70f` |
| Vorheriger Entwicklungshead L | `3f5345dd08032aa6d19328a2c2cee22527150266` |
| Erhaltene main-Workflowquelle W | `741fb7b09f0a442d779aaed192bd223724d3523f` |
| Unveränderte Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Neuer ausschließlich lokaler Dokumentationsnachfolger N | Vollständige SHA in RESULT.json der lokalen Sicherung; nicht nachgepusht |

Arbeitsort `/workspace/anker-main-code18-aab`, Branch `entwicklung/anker-neu`. Sauberer HEAD=K vor Übertragung bestätigt und Vorher-Bundle geprüft. `ls-remote --heads` um **01:43:17 UTC** bestätigte Entwicklung=L und main=W. Nach dem Push Entwicklung=K/main=W und zuletzt nochmals um **01:55:13 UTC** bestätigt; refs-before/after/final.json enthalten die jeweiligen Belege. Das sind aktuelle Beobachtungen vom 15.11.2026, keine dauerhafte Zusage künftiger Refverfügbarkeit. W bleibt ohne lokales Gitobjekt; kein Fetch/Checkout.

## Vorprüfung und genau eine Übertragung

L ist Vorfahr von K. Vollständiger L→K-Diff gesichert: **16 Dateien, 713 Ergänzungen, 2 Entfernungen**. Vierzehn Dokumentationsdateien plus der belegte Drei-Zeilen-Helperfix und sieben neue Testmethoden. Keine Produkt-/Paket-/Versions-/Freigabemanifeständerung. Sämtliche sechs Workflowdefinitionen bytegleich zu L; außerhalb invocation() sämtliche Helperfunktionen/Konstanten AST-gleich. Kein eigener hooksPath und keine aktiven lokalen Hooks. Keine lokalen Tests oder Builds wiederholt.

Einmaliger expliziter Push um **01:44:07 UTC** erfolgreich, Exitcode 0:

```text
git -c push.followTags=false push --porcelain --recurse-submodules=no https://github.com/frnkrm/anker.git 77316d69d637c0445cf5d2f4dada37c23011a70f:refs/heads/entwicklung/anker-neu
```

Nur dieser Branchref, kein Force/main-/Tag-/Submodule-Push, kein zweiter Push. Kein neuer lokaler Dokumentationsnachfolger übertragen. push-attempt.json, push.log und push-result.json binden den tatsächlichen Vorgang.

## Trigger und zugelassene Wirkungen

Alle bestehenden Definitionen gelesen und gesichert:

- ci.yml: push/pull_request, daher automatische Push-CI mit vorhandenen Prüfungen, JDK-Einrichtung, Offlinefällen, Webbuild und PC-Quellpaketartefakt erlaubt.
- android-aab-pruefstand.yml: ausschließlich workflow_dispatch; resolve verlangt Repository/main/manuelles Ereignis. Kein Aufruf von prepare oder sign.
- android-update.yml: manuell/main, hier nicht ausgelöst.
- release.yml: ausschließlich v*-Tagpush, hier nicht ausgelöst.
- google-play-upload.yml: manuell oder main-Push am eigenen Workflowpfad, mit zusätzlichen main-/Nachrichten-Gates; hier nicht ausgelöst.
- play-upload-diagnose.yml: main-/Pfad-/Nachrichten-Gates, hier nicht ausgelöst.

Eine gegebenenfalls bestehende Branch-Previewautomatik war im Auftrag eingeschlossen; ihre tatsächliche Ausführung oder Veröffentlichung ist nicht separat belegt. Keine Cloudkonfiguration geändert. Die öffentliche Actionsliste zeigt zum Abschluss den neuen CI-Lauf und weiterhin den alten fehlgeschlagenen manuellen AAB-Lauf P; kein neuer manueller AAB-Lauf beobachtet. Kein Google-Play-/Consolezugriff und keine Secretabfrage.

## Tatsächlicher neuer CI-Nachweis

[CI43664473155](https://github.com/frnkrm/anker/actions/runs/43664473155), **ci.yml / push / entwicklung/anker-neu / exakt K / Versuch 1 / Success**. Gesamt **10m 3s**, check **10m 0s**. Bis zum terminalen Ergebnis ausschließlich lesend nachkontrolliert; öffentliche Summary zuletzt als poll-10.html/txt/json und ci-final-read.json gesichert.

Die Summary verlinkt den vollständigen Commit K; die Laufansicht „Workflow file for this run“ bindet `.github/workflows/ci.yml` ebenfalls an K. Versuch 1 ist im öffentlichen HTML über navigation_partial?attempt=1 belegt. **API-run.head_sha und tatsächlicher Runnercheckout wurden nicht eigenständig ausgelesen**; kein Gleichsetzen mit einer synthetischen PR-Merge-SHA. Hier liegt ein Pushlauf vor, kein neuer PR-Lauf.

Öffentliche Abschluss-Notices:

- **Vitest: 1372 passed; 0 failed; 0 skipped**.
- **Playwright: 379 passed (8.8m)**.

Die PC-Matrix ist abgeschlossen, Gesamtlauf erfolgreich. Ein beobachtetes Artefakt: **Anker-PC-Begleiter-Quellpaket**, 95 KB, Digest `sha256:27883478862b57220ba28049f1aa5d34b21a958ef6bd06f15a17fbecffd0e17a`; nicht heruntergeladen oder installiert. Runner-/Action-Hinweise zu Node20 und Ubuntu-Labelwechsel sind Warnungen, kein Anlass zu Paket-/Workflowänderungen in diesem Auftrag.

Bestehende CI enthält die erweiterten AAB-Offlineprüfungen. Deren einzelne Runner-Testzahlen sind aus der öffentlich gelesenen Summary nicht ersichtlich und werden nicht erfunden. Frühere **35 lokale Protokoll- plus 5 gezielte Workflowtests** bleiben eigene lokale Nachweise; keine lokale Wiederholung. Jobseiten verlangen für Detailprotokolle Anmeldung, keine Authreparatur/Umgehung und keine erneuten Metadatenfragen.

## Grenzen und verbleibender Schritt

Öffentliche PR-Liste vor und nach Push: **0 offene / 3 geschlossene PRs**; PR2/PR3 bleiben historisch gemergt. Heute kein PR erstellt oder geändert. Genau nächster separat zu beauftragender Auftrag: neuen regulären PR K→main/W vorbereiten und erstellen beziehungsweise exakt passenden offenen PR abgleichen, **ohne Merge**. Eine neue main-Workflowquelle erst nach späterer separat erlaubter Integration bestimmen; dafür eigene erfolgreiche push/main/ci.yml verlangen. K-Branchgrün ersetzt diesen Gate nicht. M behält seinen eigenständigen Quell-CI-Beleg; keine Docs-Ausnahme.

P43637658561/Versuch 1 bleibt der alte fehlgeschlagene prepare-Resolve-Lauf. Tatsächliche P-Eingabeform weiterhin unbekannt. Der lokale Vertragsfix und das neue Branchgrün beweisen weder dessen konkrete Rohkeys noch einen erfolgreichen Prepare-Runnerlauf. **U2/H2/HP/A/S fehlen weiterhin.** U1 bleibt unveränderte unsigned Referenz aus M, 54.264.632 Bytes, SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. Keine Umbenennung, neue APK/AAB, Signierung, Installation, Geräte-/NFC-/PC-Wirkung oder neue Berechtigung. B4-Uploadrolle und 8A-Playrolle getrennt.

**T-006/V-014 IN_ARBEIT; E-002–E-005 und main-Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** Alte Arbeitsbäume, alle 32 bisherigen Sicherungsmanifeste, Code17-Nachweise und zurückgestellte Umgebung/835235b erhalten.

Nur Abschlussdokumentation im aktuellen Repository lokal committen. N nicht nachpushen. Sicherung `/workspace/anker-t006-inputschema-branch-push-20261115/` enthält Vorher-/Nachher-Bundle, Ref-/Push-/HTML-/CI-Belege, Bestandsschutz, unabhängigen Bare-Restore und SHA256SUMS. Exakter N-Abschluss und genau ein kopierfertiger Folgeauftrag in RESULT.json beziehungsweise NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
