# T-006 – PR3 regulär nach main integrieren: noch nicht auszuführende Vorlage

## Fortschreibung: reguläre Integration ausgeführt (14.11.2026)

[PR3-Merge und neue exakte main-CI](PR3_MAIN_CI_NACHKONTROLLE.md): PR3Merged, tatsächlichesW `741fb7b09f0a442d779aaed192bd223724d3523f` mit ElternM/L und EntwicklungsheadL erhalten. Neue ci.yml43622275785 / exaktW / push / main / Versuch1 **erfolgreich**. Öffentliche Summary: 1372 Vitest bestanden / 0 Fehler / 0 Skips; 379 Playwright bestanden (9.4m). Der folgende frühere Plan bleibt als Vorzustand erhalten. TatsächlichesW nicht0874 vorweggenommen; M eigenständige Appquelle/M-CI, G lokalerAbschluss. Noch kein prepare/sign,keinU2/S/Geräte-/Gesamtbeleg. NächsteStufe ausschließlich separat autorisieren.

Stand **14.11.2026**. Dieser Auftrag erlaubt ausschließlich Lesen und lokale Planungsdokumentation. **Keine Mergefreigabe, kein Workflowstart.**

## Frisch bestätigte Ausgangsbindungen

| Rolle | Tatsächlicher Stand |
|---|---|
| Arbeitsort / Branch | `/workspace/anker-main-code18-aab` / `entwicklung/anker-neu` |
| Sauberer lokaler Ausgang E | `1231b3d912aaccb7c6d752573e40c21b91fc49a7` |
| Gepushter Entwicklungs-/PR3-head L | **`3f5345dd08032aa6d19328a2c2cee22527150266`** |
| main-Basis und weiterhin feste Appquelle M | **`10cc894a27302a5a49b6884c843d2a6b509ab354`** |
| PR3 | [Open, Entwicklung→main](https://github.com/frnkrm/anker/pull/3); headL/baseM,3Commits,kein Mergecommit |
| Push-CI | [43614039702](https://github.com/frnkrm/anker/actions/runs/43614039702), ci.yml / push / Entwicklung / CommitlinkL / Versuch1 / Success,11m19s |
| PR-CI | [43616437865](https://github.com/frnkrm/anker/actions/runs/43616437865), ci.yml / pull_request opened#3 / Entwicklung / Versuch1 / Success,9m57s |
| Sichtbare Testzahlen je Lauf | **1372 Vitest bestanden,0Fehler,0Skips;379Playwright bestanden**; heute nur vorhandene Ergebnisse gelesen |
| Beobachteter synthetischer PR-Mergeref | `0874d430eea96a7f7f521e26a03d0d2a30ee05cb` |
| Spätere tatsächliche main-Workflowquelle W | **Unbekannt; erst nach regulärer Integration bestimmen** |
| Neuer lokaler Planungsabschluss F | Exakte SHA im Sicherungsmanifest RESULT.json; nicht übertragen und weder PR-/CI-head noch W |

Gitrefs und öffentliche PR-/CI-/Rulesetsseiten wurden am14.11.2026 erneut gelesen; Rohbelege mit ihren jeweiligen genauen UTC-Zeiten unter `/workspace/anker-t006-pr3-main-plan-20261114/`. Refnachkontrolle zum lokalen Abschluss getrennt gespeichert. Keine heutige API-/Secret-/Playabfrage. Frühere API-Forbidden- und fehlende Agenten-Browsersteuerung bleiben Zugriffslücken, keine Authreparatur.

Vollständiger lokaler M→L-Diff gegen vorhandene Gitobjekte: **3Commits,17Dateien,2308Einfügungen/2Löschungen,187344Bytes**. M ist Mergebase; Zwei- und Dreipunktdiff bytegleich. Neue manuelle AAB-Definition,Prüfhelfer,gezielte CI-Einbindung und Dokumentation. Produktquellen,Version/Paketdateien,SDK/Rechte,ursprünglicher Plan/Gerätekatalog,die vier alten APK-/Release-/Play-/Diagnoseworkflows und Code17-Freigabemanifeste/Publisher unverändert. E und weitere lokale Dokumentationsnachfolger gehören **nicht** zum PR-Diff. Vollständiger Diff/Dateihashes und alle6Workflowdefinitionen in der Sicherung.

## Review-, Schutz- und SHA-Grenzen

- Öffentlich **No reviews**: keine Reviewfreigabe; ob Reviews vorgeschrieben sind, bestimmt der unveränderte Server.
- Öffentliche Rulesetsseite: **You haven't created any rulesets**. Daraus keine Aussage über klassische Branchschutzregeln oder alle angemeldeten Serveranforderungen ableiten.
- Öffentliche PR-Ansicht liefert keinen belastbaren Konflikt-/Mergefähigkeitsstatus und keine bedienbare Mergeoption. Featureflags/defaultMergeMethodMERGE sind keine Erlaubnis oder angebotene Schaltfläche.
- PR-Checks wählenL; die PR-Lauf-Workflowansicht verweist auf ci.yml ausL. Tatsächliches API-`run.head_sha` und tatsächliche Runner-Checkout-/GITHUB_SHA bleiben **unbekannt**. Kein Fetch/Checkout zur Beschaffung. SynthetischerMergeref0874 ist weder ungeprüft der Runnercheckout noch vorweggenommenes W.

Diese Lücken bleiben ausdrücklich im Nachweis. Kein erfundener grüner Schutz-/Reviewstatus, keine Authreparatur oder neue Metadatenrunde beim Nutzer. Vor einem separat freigegebenen Merge muss die **reguläre angemeldete GitHub-Oberfläche** alle tatsächlich vorgeschriebenen Bedingungen erfüllen und den normalen unmittelbaren Merge-Commit-Weg anbieten. Bei Sperre stoppen; nichts administrativ überschreiben.

## Konkreter Ablauf nach einer neuen, separaten Integrationsfreigabe

1. Lokalen Arbeitsbaum sauber und auf dem dann genannten Dokumentationshead prüfen. L/M als Vorfahren erhalten; lokale Dokumentation nicht übertragen. Frische `ls-remote`-Nachweise: Entwicklung=L, PR3-head=L, main=M. PR3 muss Open,QuelleL,Zielmain sein. Beide vorhandenen erfolgreichen CI-Läufe mit ihrem tatsächlichen Ereignis/Branch/Versuch zuordnen; keinen Lauf neu starten.
2. Vollständigen aktuellen PR-Diff, unveränderte Trigger und Server-/Review-/Konfliktlage prüfen. Nur diese Quellenbindung zulassen. Bei neuer Quelle, geändertem Diff/Workflowauslöser, roter/fehlender CI, Konflikt oder unerfüllter Serveranforderung **stoppen und dokumentieren**, nicht angleichen/rebasen/fixen.
3. Genau **eine reguläre Integration als Merge-Commit** von PR3/L nach main/M. Ein schon vorhandener authentifizierter Agentenweg darf nur den normalen Servermerge mit erwarteter headL benutzen. Kein Admin/Force/Squash/Rebase, direkter main-Push, Queue/Automerge, Branchlöschen oder Tag. Wenn wie bisher kein solcher Agentenweg erreichbar ist: Besitzer öffnet PR3 im bereits angemeldeten GitHub-Browser, prüft unveränderte Quelle/Ziel und vorhandene grüne Checks, wählt **Create a merge commit**, dann **Merge pull request → Confirm merge**. Nur verwenden, wenn GitHub dies regulär ohne Umgehung anbietet; keine neuen Zugangsdaten verlangen. Auf den tatsächlichen Handgriff warten, keinen zweiten Merge versuchen.
4. Danach echte main-SHA **W** per `ls-remote` bestimmen und mit dem tatsächlichen PR3-`mergeCommitSha` abgleichen. PR3 muss Merged und Entwicklung weiterhinL sein. W nicht aus0874 oder lokalemF erraten. Bei inzwischen abweichenden Refs oder unerwartetem Ergebnis stoppen; keine Rollback-/Forceaktion. W kann zunächst lokal **kein Gitobjekt** sein; kein Fetch/Checkout unter dieser Vorlage.
5. Die automatisch entstandene **`.github/workflows/ci.yml` für exakt W, event=push, head_branch=main, completed/success** lesend bis zum Endergebnis nachkontrollieren. Volle SHA,Workflow,Ereignis,Branch,Run-ID und tatsächlichen Versuch binden. HTML mit vollständigem Commitlink/Ref-/Summarybelegen verwenden, wenn API gesperrt bleibt. Sind diese Nachweise nicht lesbar, offen dokumentieren; keine anderen Runs/SHA einsetzen. **Keine Docs-Ausnahme**,kein Ersatz durch L-Push-/PR-Grün oder M-CI. Bei Rot/fehlendem Beleg nur dokumentieren,kein Fix/Neustart.
6. Abschluss ausschließlich lokal dokumentieren,committen und sichern,nicht nachpushen. Tatsächliches W und W-main-CI vom lokalen Abschluss und von App-M/M-CI trennen. AAB prepare/sign und alle nachfolgenden Freigaben bleiben unberührt.

## Welche unveränderten Auslöser ein solcher Merge treffen würde

| Definition | Auslöser / erwartete Wirkung bei genau L→M |
|---|---|
| `ci.yml` | push/pull_request ohne Branch- oder Docs-Ausnahme. Der spätere main-Push startet normale Prüfungen,neue43Offlinefälle,JDK-Einrichtung,Webbuilds und bestehende Artefakte. Diese unveränderte CI-Wirkung muss in die neue Integrationsfreigabe eingeschlossen werden |
| `android-aab-pruefstand.yml` | Nur workflow_dispatch; resolve zusätzlich frnkrm/anker/main. Neue Verfügbarkeit aufmain startet **keinen** prepare/sign-Lauf. Beide Modi bleiben separat freizugeben |
| `android-update.yml` | Nur manueller main-Dispatch. Merge startet keinen APK-Bau/Signierer |
| `release.yml` | Nur v*-Tagpush. Regulärer PR-Merge erzeugt keinen solchen Tag und kein APK-/GitHub-Release |
| `google-play-upload.yml` | Manuellmain oder main-Push nur bei Änderung genau dieser Datei; Job zusätzlich bestehende [anker-play-draft]/[anker-play-inspect]-Markerbedingungen. Datei ist im L→M-Diff unverändert: dieser Merge trifft den Pushpfad nicht. Keine Marker ergänzen/keine manuelle Ausführung |
| `play-upload-diagnose.yml` | main-Push nur bei Änderung genau dieser Datei und [anker-play-report]-Marker. Datei unverändert; hier keine Ausführung |

`netlify.toml` enthält `npm run build`,Publishverzeichnis`dist`,Node24 und bestehende SPA-/Serviceworkerregeln. Daraus folgt **keine** bestätigte aktuelle Cloudbindung oder Deploymentkonfiguration. Eine bereits konfigurierte automatische **main-Webveröffentlichung** könnte aber durch den späteren Merge ausgelöst werden. Die kleinste Integrationsfreigabe muss diese mögliche bestehende Automatik **ausdrücklich einschließen**,wenn integriert werden soll. Keine aktive Cloudkonfiguration ändern. Das ist eine mögliche Webwirkung, keine Apppaket-/Signier-/Play-/Geräte-/Gesamtreleasefreigabe. Heute wurde weder integriert noch veröffentlicht.

## Getrennte Freigaben nach dieser Planung

| Stufe | Kleinster nötiger späterer Umfang | Weiter offen |
|---|---|---|
| Reguläre main-Integration | Genau PR3/L→mainM als normaler Merge-Commit; unveränderte automatische main-CI samt Artefakten und gegebenenfalls bestehender main-Webveröffentlichung; lesende Nachkontrolle für tatsächlichesW | Keine AAB-Ausführung,Signierung oder Playaktion |
| Einmal prepare | Erst nach tatsächlich grünem W-main-CI und separat bestätigtem exaktem M-main-CI: autorisierter manueller secretfreier M-Build mit W-Prüfcode,notwendigen öffentlichen Werkzeug-/Dependencydownloads und Actions-Artefaktübertragung; konkretesU2,H2,HP,RunP/Versuch,ArtefaktA vorlegen | Kein Schlüsselgebrauch,kein S/Play/Installieren |
| Einmal sign/verify | Eigene Freigabe für genau M/W/P/Versuch/A/H2/HP und isolierten vorhandenen B4-Schlüsselgebrauch;nachgelagerte secretfreie vollständige JAR-/Signierer-/U2↔S-Nutzlastprüfung,HS/Bytes/öffentliche Nachweise | Kein Secretumbau,kein Upload/Release/Installieren. Verfügbarkeit/Scope/Inhalt der vierSecretnamen weiter unbestätigt |
| Späterer interner Playweg | Erst nach gültigemS: gesonderte Code18-spezifische neue Bindungen/Guards,aktuelle Bestands-/Versionszulässigkeitsprüfung und ausdrückliche Uploadfreigabe | Code18 nicht als aktuell frei/reserviert behaupten;alte Code17-Manifeste/Publisher nicht umdeuten. Kein öffentlicher Rollout |
| Geräte und Gesamt | Getrennte autorisierte Galaxy-/Windows-/Kalender-/NFC-Prüfungen an bestehenden Stationen; Installations-/Geräteeingriffe separat freigeben | E-002–E-005,T-006/V-014 und Gesamt-/Releasefreigabe bleiben offen |

Im bereits implementierten AAB-Resolve bleiben **AppquelleM und WorkflowquelleW** getrennt: M/Run43601398931 und W brauchen je exakte erfolgreiche push/main/ci.yml-Nachweise und main-Historienzugehörigkeit. Der bestehende gespeicherte M-Beleg wurde heute nicht neu gestartet oder durch L-/W-CI ersetzt. Ein API-Fehler im später autorisierten Runner würde dort fail-closed abbrechen; keine lokale API-/Authreparatur vorziehen.

U1 bleibt lokale unsignedReferenz ausM:54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. Kein U2/S/W-Laufnachweis heute. Historisches014870f3-AAB enthält den NFC-Fix nicht. **B4 ist Uploadsignierer,8A gemeldeter Play-Appsignierer**; keine Schlüsselverfügbarkeit,APK-Updatekompatibilität oder Geräteabnahme aus Rollen/Fingerabdrücken ableiten.

## Heutiger Abschluss

Nur diese Vorlage und belegte Status-/Test-/Datengrenzendokumentation lokal committen/sichern. Keine Tests/CI/Builds wiederholt,keine Produkt-/Workflow-/Versions-/Freigabemanifeständerung,keine externe Schreibaktion,kein Merge/Push/Tag/Fetch/Checkout oder Schlüssel-/Cloud-/Play-/Geräteeingriff. AlteArbeitsbäume/Sicherungen/U1/Code17-Nachweise erhalten; ursprüngliche36RoadmapIDs/103historischeGerätezeilen unverändert.

Sicherung `/workspace/anker-t006-pr3-main-plan-20261114/`: Ausgangs-/Nachher-Bundle,frische Ref-/PR-/CI-/Rulesets-/Diff-/Triggerbelege,Dokument-/Bestandsschutz,unabhängiger Bundle-Restore,SHA256SUMS/RESTORE.md und genau ein Folgeauftrag mit tatsächlichem lokalemF. **T-006/V-014 IN_ARBEIT,E-002–E-005 und alle genannten Freigaben offen.** Danach stoppen. Der spätere Integrationsauftrag muss gesondert erteilt werden.
