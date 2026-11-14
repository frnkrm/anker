# T-006 – PR3 gemergt und tatsächliche main-CI nachkontrolliert

Stand **14.11.2026**. Besitzer hat den ausdrücklich erlaubten regulären UI-Merge durchgeführt; Agent hat anschließend ausschließlich gelesen. **Keine manuelle AAB-Ausführung, Signierung oder Playaktion.**

## Exakte Quellen und Ergebnisse

| Rolle | Tatsächlicher Nachweis |
|---|---|
| Arbeitsort / Branch | `/workspace/anker-main-code18-aab` / `entwicklung/anker-neu` |
| Sauberer lokaler Ausgang F | `3617083ea9205b59301330ed98252bce66c99f47`; nicht übertragen |
| Unveränderter Entwicklungs-/PR3-head L | `3f5345dd08032aa6d19328a2c2cee22527150266` |
| Bisherige main-Basis und weiter feste Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Tatsächliche neue main-Workflowquelle W | **`741fb7b09f0a442d779aaed192bd223724d3523f`** |
| PR3 | [Merged](https://github.com/frnkrm/anker/pull/3), durch frnkrm am14.11.2026 um17:39:15UTC; mergeCommitSha=W |
| Öffentliche Mergecommit-Eltern | **M und L**, in dieser Reihenfolge; regulärer Mergecommit statt Squash/Rebase |
| Neue eigene W-main-CI | [43622275785](https://github.com/frnkrm/anker/actions/runs/43622275785), `.github/workflows/ci.yml`, **exaktW / push / main / Versuch1** |
| Endergebnis / Dauer | **erfolgreich / `11m 23s`**, letzter Endbeleg `2026-11-14T17:50:50.821631+00:00` |
| Getrennte M-Quell-CI | [43601398931](https://github.com/frnkrm/anker/actions/runs/43601398931), exaktM / push / main / Versuch1 / Success, heute lesend erneut bestätigt |
| Neuer lokaler Abschluss G | Exakte SHA im Sicherungsmanifest RESULT.json, nicht gepusht und kein CI-/Workflowhead |

Öffentliche Summary: 1372 Vitest bestanden / 0 Fehler / 0 Skips; 379 Playwright bestanden (9.4m).

## Durchführung und Zugriff

Vorher Branch/sauberesHEAD=F,L/M-Vorfahren,frische Refs Entwicklung/PR3-head=L/main=M,PR3Open und beide grünen früheren CI-Läufe geprüft. Vollständiger PR-Diff17Dateien/3Commits sowie6unveränderteWorkflowdefinitionen und Hookgrenzen bestätigt. Neue Freigabe umfasste genau den regulären Merge-Commit sowie dadurch bestehende automatische main-CI/Webbuilds/Artefakte und gegebenenfalls bestehende main-Webautomatik.

Der vorhandene Agentenweg scheiterte bereits bei lesendem `gh pr view` mit **`Post "https://api.github.com/graphql": Forbidden`**. Keine Authreparatur,neuen Zugangsdaten,Secret-/Session-/Schlüsselsuche oder Ersatzweg. Wie ausdrücklich vorgesehen normaler Handgriff beim bereits angemeldeten Besitzer; Nutzer meldete „gemergt“. Danach öffentliche PR-Metadaten Mergezeit/mergedBy/mergeCommitSha und Gitrefs abgeglichen. Kein Agenten-Mergeversuch,kein zweiter Merge/Push,kein Admin-/Force-/Queue-/Automergeweg oder Branchlöschen durch den Agenten. Vorherige No-reviews-/Rulesetsangaben wurden nicht als Schutz-/Reviewfreigabe umgedeutet; klassische/angemeldete Serverregeln sind hier nicht eigenständig vollständig ausgelesen.

Tatsächliches W stimmt mit PR3-mergeCommitSha und neuer main-Ref überein. Die öffentliche Commitansicht liefert ElternM/L. Der frühere synthetische PR-Mergeref0874d430eea96a7f7f521e26a03d0d2a30ee05cb wurde **nicht** als W vorweggenommen. Entwicklung und PR3-head bleibenL; alle lokalen Dokumentationsnachfolger blieben unübertragen.

## Exaktes W-main-CI-Gate und erhaltenes M-Gate

Actions-Liste und Summary verknüpfen den neuen Lauf mit **vollständigem CommitlinkW**,Ereignispush,Branchmain und Workflowci.yml. Der aktuelle Versuch folgt aus `jobGroupsFetchUrl?attempt=1` bei `viewingCurrent=true`; Endergebniserfolgreich. Dies ist ein **neuer tatsächlicher main-Push-Nachweis**,kein Ersatz durch L-Branch-/PR-Grün,keine Docs-Ausnahme und keine Gleichsetzung mit M-CI. Öffentliche Rohbelege/Actions-JSON und Refzeiten liegen in der Sicherung.

Die öffentlichen Dateien ci.yml und android-aab-pruefstand.yml **aus exaktW** wurden vollständig zeilenweise mit den zuvor geprüften lokalen L-Dateien verglichen und stimmen überein. Die separate M-CI wurde lesend als Success/push/main/M/Versuch1 erneut bestätigt; M ist tatsächlicher Elterncommit vonW. Der bestehende AAB-Resolve verlangt weiterhin je eigene exakte main-Push-CI für M und W. Keine Gate-/Quell-/Freigabemanifeständerung.

Einzelne Job-Rohlogs verlangen weiter Anmeldung; keine unbekannten Detailzahlen ausgeben oder vorhandene43lokaleOfflinefälle als neuen B4-Signiernachweis ausgeben. Die frühere PR-API-head_sha/Runnercheckout-SHA bleibt in ihrem historischen Nachweis unbekannt; das begrenzt nicht den eigenständig belegten neuen push/main/W-Summarynachweis. Kein CI-/Test-/Buildneulauf lokal oder manueller Workflowneustart; keine nativeJUnit-/Hardwarebeobachtung hinzugefügt. Bei nicht erfolgreicher CI nur dokumentieren,kein Fix oder Neulauf.

**W ist hier weiterhin kein lokales Gitobjekt** (`git cat-file -e` negativ),kein Fetch/Checkout/Clone/Rebase ausgeführt. Der lokale Dokumentationsarbeitsbaum bleibt auf der F-Nachfolge mit vorhandenem L/M; W ist durch externe öffentliche Ref-/PR-/Commit-/CI-Belege gebunden. Ein vorhandenes Quellobjekt oder diese Metadaten stellen keine neuen Paketartefakte wieder her.

## Automatik und weiter offene Grenzen

Nur der erwartete neue ci.yml/main-Push-Lauf wird W in der beobachteten Actions-Liste zugeordnet. Bestehende automatische main-Webwirkung war ausdrücklich freigegeben; eine tatsächliche Webveröffentlichung wurde **nicht separat bestätigt** und keine Cloudkonfiguration abgefragt/geändert. Kein manueller AAB-/APK-/Release-/Playworkflow gestartet. AAB bleibt workflow_dispatch/main mit getrennten prepare/sign; alte APK-/Release-/Play-/Diagnoseauslöser und Code17-Guards unverändert. Kein App-/APK-/AAB-Bau durch den Agenten,Signieren,Installieren,Upload oder echte Geräte-/NFC-/PC-Aktion.

U1 bleibt vorhandene **unsignedReferenz ausM**,54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. **U2/Prepare-P/H2/HP/ArtefaktA und signedS/HS fehlen weiterhin.** W ist jetzt eine konkrete main-Workflowquelle,aber kein signierter Paketstand. Historisches014870f3-AAB enthält den NFC-Fix nicht und bleibt historisch. B4Upload-/8APlayrolle getrennt; Secretbestand/-Scope/-Inhalt und privater Zugriff unverändert unbestätigt.

Nächste Stufe nur separat: einmal modeprepare mit source_commit=M/expected_workflow_commit=W und leeren Signierbindungen; frische Quellen-/M-/W-CI-/Triggerprüfung,secretfreierBuild/unsignedU2-Nachweis. W muss dafür nicht lokal gefetcht werden. **Kein sign-Aufruf**,kein Schlüsselgebrauch oder Playweg. Bei Rot/fehlendem W-CI-Beleg zuerst nur dessen Klärung. Auch ein erfolgreicher prepare-Lauf gäbe keine Signierfreigabe; konkrete H2/HP/P/Versuch/A erst danach separat freigeben.

## Ausschließlich lokaler Abschluss

Nur belegte Status-/Nachkontrolldokumentation lokal committen und unter `/workspace/anker-t006-pr3-main-integration-20261114/` sichern,nicht nachpushen. Vorher-/Nachher-Bundle enthalten vorhandene lokale F-/G-/L-/M-Objekte,**kein nachgeladenes W-Objekt**. W-Belege separat als HTML/JSON/Refs. Bundle-Restore,alleAbschlussdokumente/SHA256,U1/alteArbeitsbäume/28vorherigeSicherungsmanifeste,36RoadmapIDs/103historischeGerätezeilen gezielt prüfen. Frühere UI_HANDOFF/pending-Dateien bleiben historischer Vorzustand,aktuelles Ergebnis steht in RESULT.json.

Main-Integration ist jetzt im belegten Umfang erledigt; **T-006/V-014 IN_ARBEIT,E-002–E-005 sowie Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben bleiben offen.** Genau nächster separat zu beauftragender Einzelauftrag: **einmaligen secretfreien prepare-Prüflauf aus M mit Workflow W starten und U2-Nachweise nachkontrollieren**. Kopierfertige Vorlage mit tatsächlichemG in NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
