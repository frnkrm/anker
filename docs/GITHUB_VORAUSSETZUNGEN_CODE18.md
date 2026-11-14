# T-006 – GitHub-Voraussetzungen für Code18

## CI-SHA und angezeigter Checkstatus ergänzt (14.11.2026)

Sauberer Ausgangshead `208691836849aed7bb0758175d3e1976f7110842` auf `entwicklung/anker-neu`. Neue Nutzerantwort nennt die vollständige SHA **`6dfa632c94422d61d6a71c6a4a72c15fefd4a407`** zum zuvor genannten [Lauf43331316553](https://github.com/frnkrm/anker/actions/runs/43331316553). Als40Hexzeichen formal gültig; nicht aus einer PR-Ref erraten. Der mitgelieferte Screenshot zeigt dieselbe SHA in der GitHub-Commit-URL und die Checkübersicht dieses Commits. Keine eigene externe Abfrage.

| Fehlende Angabe | Jetzt belegte Zuordnung |
|---|---|
| CI-headSHA | `6dfa632c94422d61d6a71c6a4a72c15fefd4a407` laut Nutzer; Commitseite im Screenshot passt dazu |
| Ausgefülltes Ergebnisfeld | Leer geblieben; keine Textangabe erfunden |
| Tatsächlich sichtbarer Status | **CI / check (push): Failing after9m**, rotes Kreuz |
| Übrige sichtbare Checks | CI/check(pull_request) und vier PC-Begleiter-Matrixchecks erfolgreich; insgesamt **1 failing and5successful checks** |
| Versuchnummer | **Unbekannt**, keine Nummer im Screenshot |
| Ereignis / Branch / PR | Aus vorherigem Nutzerbericht: push/entwicklung/anker-neu; PR2 Open von Entwicklung nach main, nicht erneut abgefragt |

Das Bild ist eine Commit-Checkübersicht, keine Run-Summary. Die Zuordnung zum gemeldeten Lauf beruht auf der Nutzerantwort im laufenden Auftrag; Run-ID/Versuch/Run-Metadaten wurden nicht unabhängig aus dem Bild oder per API verifiziert. Der rote Push-Check ist ein verwertbarer Oberflächenbeleg für dessen angezeigten Fehlschlag; **der gemeldete Stand ist nicht insgesamt grün**. Der grüne PR-Check ersetzt keinen erfolgreichen Push-Check. Die Abweichung allein beweist weder einen neuen Produktfehler noch eine bestimmte Fehlerursache. Historische Playwright-Fehlerlogs bleiben historische Belege; keine Tests wiederholt oder Codefixes aus der Statusanzeige abgeleitet. Das sichtbare Commit-Label Verified ist kein App-/Uploadzertifikats- oder privater Schlüsselbeleg.

Die vormals unvollständige CI-Nutzerzuordnung ist damit im lieferbaren Umfang abgeschlossen. Die unbekannte Versuchnummer bleibt offen und rechtfertigt keine erneute Metadatenfrageschleife. Keine weitere Nachfrage nach diesem bereits gelieferten SHA-/Ergebnisbeleg oder den nicht einsehbaren Secrets erforderlich.

**Quellen und Grenzen:** CI-/Commitbeleg6dfa632 ist weder die Code18-AAB-Versionsquelle `014870f3ee52c0233118d2852ef0719aa9bc602b` noch der lokale Dokumentationshead2086918 oder dessen Nachfolger. Die früher bestätigten Remote-Refs/Workflowblobs wurden heute nicht erneut extern geprüft. Entwicklungsbranch-Push und grüner PR-Check erfüllen keinen exakten erfolgreichen **main-Push-ci.yml-Gate**. Vier Signing-Secrets/Scopes weiterhin unbekannt/nicht einsehbar, keine Signierbarkeit bewiesen. Alte Code17-Manifeste und Code18-Artefaktbindung bleiben unverändert; keine Signier-/Upload-/Geräte-/Gesamtfreigabe.

Nur belegte Dokumentation lokal committen und unter `/workspace/anker-t006-ci-zuordnung-20261114/` sichern: Nutzer-/Screenshottranskription ohne neue Bilddateikopie, Vorher-/Nachher-Bundle/Integritäts-/Wiederherstellungsnachweis/SHA256. Keine eigene externe Abfrage, Tests/Builds/Signierung/Installation, GitHub-/Workflow-/Cloud-/Secret-/Versions-/Playaktion. T-006/V-014 IN_ARBEIT, E-002–E-005 und Gesamtfreigaben offen. Alte Umgebung/835235b zurückgestellt.

**Genau nächster zulässiger Einzelauftrag:** Die lokale GitHub-Übergabe konkret vorbereiten, ohne Übertragung: vorhandenen lokalen Unterschied zur zuletzt bestätigten Entwicklungs-SHA6dfa632 zusammenstellen, vorgesehene Übergabe-/Artefaktquellen unterscheiden und aus vorhandenen Workflowdefinitionen die Wirkungen eines späteren Branch-Pushs/PR-Updates sowie nötige separate main-/CI-/Signier-/Uploadentscheidungen benennen. Nur Dokumentation/Planung anhand lokaler Belege, keine erneute CI-/Secret-Nutzerfrage, keine externe Abfrage oder Aktion. Noch keine Pushfreigabe und kein Workflowstart; danach stoppen.

## Historischer Nutzerbericht vor Ergänzung der CI-Angaben

## Nutzerbericht zu PR2 und CI, Secretbestand weiterhin unbekannt (14.11.2026)

Auf sauberem Branch `entwicklung/anker-neu`, Ausgangshead **`def0c5fab72d1a935c5cedc798d2689544442484`**, die Antwort des Nutzers zu vorhandenen GitHub-Oberflächenangaben dokumentiert. Keine eigene externe Abfrage oder erneute Ref-/APIprüfung. Die folgenden Angaben sind ein **Nutzerbericht**, kein unabhängig ausgelesener GitHub- oder CI-Nachweis.

| Angabe | Zuordnung aus der Antwort |
|---|---|
| PR2 | **Open**, Quellbranch `entwicklung/anker-neu`, Zielbranch `main` |
| Genannter CI-Lauf | [43331316553](https://github.com/frnkrm/anker/actions/runs/43331316553) |
| Ereignis / Branch | `push` / `entwicklung/anker-neu` laut Nutzer |
| CI-headSHA | Nutzer schreibt `?`: **unbekannt** |
| CI-Ergebnis | Nutzer schreibt `?`: **unbekannt** |
| Aktualität / Wiederholungsversuch | Nicht unabhängig geprüft; keine Bestätigung, dass dies weiterhin der letzte Lauf ist |

Bei jedem der vier angefragten Namen blieb die Auswahl `vorhanden/nicht aufgeführt/nicht einsehbar` unverändert stehen; ausschließlich der Scope wurde mit **nicht einsehbar** beantwortet. Daraus keine Auswahl „vorhanden“ oder „nicht aufgeführt“ ableiten:

| Name | Vorhandensein | Scope |
|---|---|---|
| `ANKER_ANDROID_KEYSTORE_BASE64` | Unbekannt | Nicht einsehbar laut Nutzer |
| `ANKER_ANDROID_STORE_PASSWORD` | Unbekannt | Nicht einsehbar laut Nutzer |
| `ANKER_ANDROID_KEY_ALIAS` | Unbekannt | Nicht einsehbar laut Nutzer |
| `ANKER_ANDROID_KEY_PASSWORD` | Unbekannt | Nicht einsehbar laut Nutzer |

Keine Feststellung über fehlende Secrets, tatsächliche Repositoryrechte, Secretinhalte, B4-Schlüsselzugriff oder Signierbarkeit. Nicht einsehbare Scopes werden nicht durch neue Rechte-/Secretkonfiguration ersetzt. Keine Werte, privaten Dateien, Passwörter oder Tokens angefordert. Rohzuordnung ausschließlich nichtgeheimer Angaben in `nutzerbericht.json` der neuen lokalen Sicherung.

Die Antwort passt zu den im vorherigen Auftrag angekündigten PR2-/Entwicklungsrefs; deren SHA `6dfa632…` wird **nicht** als headSHA dieses CI-Laufs übernommen. Bereits früher im Chat gezeigte Screenshots desselben Laufs dokumentierten einen damaligen Playwright-Fehlschlag; sie belegen kein aktuelles Ergebnis oder einen möglichen späteren Wiederholungsversuch. Nutzerbericht und historische Screenshots bleiben getrennt.

**Quell- und Gateentscheidung:** Die Code18-AAB-Versionsquelle bleibt `014870f3ee52c0233118d2852ef0719aa9bc602b`; der lokale Dokumentationshead ist eine andere Rolle. Die Antwort ordnet keine dieser SHAs dem CI-Lauf zu. Schon der gemeldete Entwicklungsbranch erfüllt nicht den vorhandenen main-Push-CI-Gate, selbst bei einem künftig belegten grünen Ergebnis. Open-Status ist keine Review-/Mergefreigabe. Die Ref-/Workflowbelege und CONNECT403-Sperre im folgenden Abschnitt bleiben Belege des vorherigen Auftrags, heute nicht erneut überprüft. Keine Docs-Ausnahme, keine Umgehung durch Gleichsetzen der Quellen.

**Ergebnis und nächster Schritt:** Die gelieferten Angaben sind zugeordnet; CI-headSHA/Ergebnis und Secretnamen/Scopes bleiben unvollständig. Genau nächster separater Einzelauftrag: ausschließlich die noch fehlende vollständige headSHA, den angezeigten Wiederholungsversuch und das Ergebnis des bereits genannten Laufs43331316553 anhand der Nutzeroberfläche einholen und zuordnen. Den Lauf nicht neu starten, keine Secret-/Scope-/bekannten PR-/Play-/Besitzerfragen wiederholen. Fehlende Angaben dürfen unbekannt bleiben; daraus keinen Signier- oder Remoteauftrag ableiten.

Nur Dokumentation lokal committen und sichern unter `/workspace/anker-t006-github-nutzerbelege-20261114/`; Ausgangs-/Abschlusscommit im Sicherungsmanifest, Artefaktquelle unverändert. Keine Tests/Builds, externen Abfragen oder GitHub-/Cloud-/Secret-/Signier-/Geräte-/Playaktionen. T-006/V-014 IN_ARBEIT; E-002–E-005 und Gesamt-/Signier-/Upload-/Geräte-/Releasefreigaben offen. Alte Umgebung/835235b zurückgestellt, Code17-Manifeste unverändert. Danach stoppen.

## Historische technische Bestandsaufnahme des vorherigen Auftrags

Stand 14.11.2026, Europe/Berlin. Ausschließlich lesender Auftrag auf sauberem Branch `entwicklung/anker-neu`, Ausgangs-Dokumentationshead `a29ba67ac0fcfac0abe439194075069e62bb45e4`. Versionsquelle des bereits geprüften unsignierten AAB bleibt **`014870f3ee52c0233118d2852ef0719aa9bc602b`**; [Paketnachweis](CODE18_AAB_INTEGRATION_T006.md). Alte Umgebung/835235b zurückgestellt. Keine Produkt-, Versions-, Signier-, Workflow- oder Freigabemanifeständerung.

## Frisch bestätigte Refs und Quellen

Bestehenden HTTPS-Gitzugriff nur mit `git ls-remote` verwendet, ohne Fetch/Checkout oder lokale Refaktualisierung. Abfragen 01:59–02:00 UTC, entsprechend 02:59–03:00 Berliner Zeit. Alle 27 angekündigten Branchrefs und die Tags-Abfrage im Rohbeleg gesichert; keine Tagref geliefert. Das ist keine Garantie über verborgene Refs oder späteren Remotezustand.

| Rolle | Exakte SHA / Befund |
|---|---|
| Aktuelles Remote-main | `e48d2892846b4a2fec45bf0cefc396e1a4c92f10` |
| Aktuelles Remote-entwicklung/anker-neu | `6dfa632c94422d61d6a71c6a4a72c15fefd4a407` |
| Angekündigte PR2-head-Ref | `6dfa632c94422d61d6a71c6a4a72c15fefd4a407` |
| Angekündigte PR2-merge-Ref | `5d676b93490c3ecab9606eaf6733f5b370c11426` |
| Lokale Versionsquelle | `014870f3ee52c0233118d2852ef0719aa9bc602b`, 27 Commits vor dem Remote-Entwicklungsbranch |
| Lokaler Dokumentationshead zu Auftragsbeginn | `a29ba67ac0fcfac0abe439194075069e62bb45e4`, 28 Commits vor dem Remote-Entwicklungsbranch |
| Tatsächliche aktuelle CI-headSHA | **Nicht lesbar**, keine neue erfolgreiche Remote-CI bestätigt |

Vorhandene lokale Commitobjekte für die frisch angekündigten main-/Entwicklungs-SHAs genutzt. Beide lokalen neuen Quellen sind nach der lokalen Commitgraphprüfung weder Vorfahren des bestätigten main noch des bestätigten Entwicklungsbranchs. Für diese beiden Branchhistorien fehlt damit die neue lokale Arbeit auf GitHub. Kein pauschaler Nachweis über sämtliche sonstigen GitHub-Objekte behauptet. Der spätere Abschlusscommit dieses Auftrags steht im Sicherungsmanifest; er ersetzt keine Artefaktquelle.

PR-Refs beweisen weder aktuellen offenen/geschlossenen PR-Status noch Reviewzustimmung, erfolgreiche CI oder Mergefreigabe. Insbesondere die synthetische merge-Ref ist kein Beleg für einen Merge in main. Historische PR2-Screenshots bleiben historisch.

## API-Zugriff gesperrt: kein Fehlbestand abgeleitet

Vorhandenes `gh` ohne Anmeldung, Credential- oder Cloudänderung verwendet. Alle angefragten Metadatenendpunkte liefern Exitcode1 und leeren stdout, etwa exakt:

```text
Get "https://api.github.com/repos/frnkrm/anker/pulls/2": Forbidden
Get "https://api.github.com/repos/frnkrm/anker/actions/secrets?per_page=100": Forbidden
```

Betroffen sind PR2, Actions-Workflowinventar, letzte Workflowläufe, ci.yml-Pushläufe jeweils gefiltert nach Versionsquelle014870f3 und Ausgangs-Dokumentationshead a29ba67, Repository-Secretnamen, Environments sowie die vorsorgliche Organisations-Scope-Abfrage. Deren Scheitern beweist weder eine Organisation `frnkrm` noch deren Secretbestand. Keine Environmentnamen geliefert, deshalb keine einzelnen Environment-Secretlisten abgefragt.

Transportprüfung desselben API-Hosts mit unveränderten Proxy-/TLS-Vorgaben:

```text
curl: (56) CONNECT tunnel failed, response 403
HTTP=000
```

Die beobachtete403 betrifft den CONNECT-Tunnel; **keine GitHub-API-Antwort mit festgestellten Repositoryrechten**. Netzwerkzugang und GitHub-Autorisierung bleiben getrennt. Keine Authentifizierung repariert, kein Token angefordert/gelesen oder Proxy umgangen. Rohfehler und vollständige GET-Kommandos liegen in den einzelnen JSON-Nachweisen der lokalen Sicherung.

| Ausschließlich angefragter Secretname | Repository-Scope | Organisations-Scope/Repositoryfreigabe | Environment-Scope |
|---|---|---|---|
| `ANKER_ANDROID_KEYSTORE_BASE64` | Unbekannt: API gesperrt | Unbekannt | Unbekannt |
| `ANKER_ANDROID_STORE_PASSWORD` | Unbekannt: API gesperrt | Unbekannt | Unbekannt |
| `ANKER_ANDROID_KEY_ALIAS` | Unbekannt: API gesperrt | Unbekannt | Unbekannt |
| `ANKER_ANDROID_KEY_PASSWORD` | Unbekannt: API gesperrt | Unbekannt | Unbekannt |

Die Workflowreferenzen belegen nur benötigte Namen. Kein Secret als fehlend oder vorhanden ausgegeben; keine Werte, private Dateien oder Signierprobe. Selbst nachgewiesene Namen würden weder richtigen Inhalt, B4-Zertifikatszuordnung noch privaten Schlüsselzugriff/Signierbarkeit belegen. Der Signierjob in android-update.yml bindet **kein Environment**; ausschließlich dort gespeicherte Secrets wären deshalb für diesen Job nicht automatisch verfügbar. Organisations-Secrets benötigen außerdem eine passende Repositoryfreigabe. Die Zugänglichkeit ist hier nicht geprüft.

## Tatsächliche Workflowdefinitionen und Gates

Alle fünf Dateien unter `.github/workflows/` haben an Remote-main, Remote-Entwicklungshead, lokaler Versionsquelle und Ausgangs-Dokumentationshead **dieselben Git-Blob-IDs**. Beleg `local-remote-comparison.json`, vollständige main-Definitionen daneben. Damit ist der Inhaltsabgleich an bestätigte Remote-SHAs gebunden, obwohl die Actions-API gesperrt ist. Aktivierungsstatus, letzte Ausführung, PR-/CI-/Jobresultate und externe Branchschutz-/Ruleset-/Deploymentkonfiguration sind damit nicht verifiziert.

| Definition | Auslöser und Wirkung |
|---|---|
| `ci.yml` | Push und Pull Request; Prüfungen samt Browser-/PC-/Offline-Uploadwerkzeugtests und Actions-Artefakten. Kein Play-Upload oder Signierjob in dieser Definition. Tests mit künstlichen Antworten sind keine Consoleabfrage. |
| `android-update.yml` | Nur workflow_dispatch auf main. Vollständige Quell-SHA muss zur main-Historie gehören und exakt erfolgreiche abgeschlossene ci.yml-Push-CI mit head_branch=main besitzen. **Keine Docs-Ausnahme.** Leere Quelle bindet den alten freigegebenen Stand aus AKTUELLER_UPDATESTAND.json. Separater Build-/Signierjob, vier ANKER_ANDROID-Namen, vollständige Signierbindung und B4-Prüfung nötig; bei allen leeren Bindungen nur unsigned, bei Teilbindung Abbruch. Ausgabe APK/Actions-Artefakt, **kein signierter AAB-Bauweg und kein Play-Upload**. |
| `release.yml` | Push von v*-Tag baut/signiert APK mit anderem ANDROID_Secretnamensatz und erstellt/aktualisiert GitHub-Release. Kein freigegebener Code18-AAB-Prüfweg. |
| `google-play-upload.yml` | workflow_dispatch auf main bedeutet Uploadmodus. Alternativ main-Push mit Änderung genau dieser Workflowdatei und passendem Commitmarker. Draftmarker ermöglicht Upload, Inspectmarker wählt lesenden Modus und hat bei beiden Vorrang. Beide Modi können Google authentifizieren/ansprechen. Feste alte Manifest-/Bundle-/Hash-/Quell-/exakte main-CI-Gates bleiben. Nicht starten. |
| `play-upload-diagnose.yml` | main-Push mit Änderung dieser Datei und Berichtmarker liest einen fest gebundenen historischen Actions-Fehlerbericht, keine Googleabfrage. |

Die genauen Marker stehen unverändert in den gesicherten Workflowdefinitionen. Keinen solchen Workflow gestartet oder geändert. Aus diesem Inhaltsabgleich keine Aussage ableiten, dass beliebige Pushes ohne externe Deploymentwirkung wären; weitere Dienste-/Kontobindungen wurden nicht abgefragt.

Historische JSON-Freigabemanifeste binden weiterhin **Code17/80f6a692**, dessen alte Quellkennung/CI und das alte signierte AAB. Sie gelten nicht für Code18 und bleiben bytegleich. Ein künftiger CI-Lauf auf einem Dokumentationshead ist kein Lauf auf014870f3. Ein künftiger anderer Buildquellcommit benötigt eigenen exakten Quell-/Artefaktbezug, auch bei unverändertem Produktfingerabdruck. APK-Signiermetadaten etablieren keinen AAB-Signierprozess. Die gemeldeten Rollen App-Signierer8A/UploadB4 bleiben getrennt; kein B4-Direktupdate einer8A-Installation zugesagt.

## Verbleibende Hindernisse und kleinster zulässiger Schritt

1. **API-Metadaten nicht erreichbar.** Kleinste Handlung ohne Konfigurationsänderung: Nutzer liest vorhandene PR2-/Actions-Seiten und Secret-Namen/Scopes in seiner GitHub-Oberfläche und meldet ausschließlich nichtgeheime Metadaten. Keine Werte, Schlüssel, Passwörter oder Token anfordern. Alternativ wäre eine separat autorisierte Behebung des api.github.com-CONNECT-Zugangs erforderlich; nicht durchgeführt. Ob anschließend GitHub-Leserechte genügen, wäre erst dann prüfbar.
2. **Versionsquelle/Dokumentationsstand fehlen in bestätigten Zielbranchhistorien; exakter main-Push-CI-Beleg fehlt.** Eine spätere Übertragung/PR-/Mergeentscheidung benötigt eigene begrenzte Freigabe und erneute Triggerprüfung. Aktuell weder Push/Merge noch Workflowstart erlaubt. Lokale Tests erfüllen diese Gates nicht.
3. **Nutzbares Uploadsigniermaterial und geeigneter signierter Code18-AAB-Prozess unbelegt.** Nach bloßen Namensbelegen wäre weiterhin eine gesonderte Entscheidung über tatsächliche Schlüsselverwendung und AAB-Quelle/-Prüfweg nötig. Keine neue Signierlogik oder Probe in diesem Auftrag.
4. **Neue Uploadfreigabe/Versionsinventar, Gerätestand und reale Beobachtungen offen.** Keine aktuelle Play-Abfrage, Code18-Reservierung oder Upload-/Installationszusage. E-002–E-005, Signier-/Upload-/Geräte-/Release-/Gesamtfreigaben bleiben offen; T-006/V-014 insgesamt IN_ARBEIT.

Lesende Bestandsaufnahme dokumentiert; API-Teil blockiert. Genau nächster separater Einzelauftrag: nichtgeheime GitHub-Oberflächenbelege zu PR2/CI und den vier Signing-Secretnamen samt Scope einholen und zuordnen. Keine Wiederholung bekannter Besitzer-/Play-/Zertifikatsfragen und keine Aktion zur Herstellung neuer CI/Secrets.

## Nachweise und lokale Sicherung

`/workspace/anker-t006-github-voraussetzungen-20261114/`: Vorher-/Nachher-Git-Bundle mit Prüflogs, frische Refantworten, API-/CONNECT-Fehler, Workflowdefinitionen/Blobvergleich, Quellen-/Dokumentintegrität, unabhängige lokale Bundleprüfung/fsck/Dateihashes, Ergebnis-/Wiederherstellungsplan und SHA256SUMS. Nur Cloud-lokal, keine externe Sicherung bestätigt. Keine Secretwerte/Schlüsseldateien oder zusätzliche AAB-Kopie. Produktquellen, Versionen, Tests, generierte Assets, alter Gerätekatalog und Code17-Freigaben unverändert; keine Softwareprüfung/Build-/Geräteaktion wiederholt. Zulässige Dokumentation lokal committen und danach stoppen.
