# T-006 – konkrete lokale GitHub-Übergabevorlage für Code18

Nachtrag14.11.2026: Der gesondert beauftragte einmalige Branch-Push H1847c8a ist inzwischen [ausgeführt und nachkontrolliert](GITHUB_BRANCH_PUSH_CODE18.md), main erhalten. GitHub-HTML liefert neue PR-/CI-Metadaten trotz API-Sperre. Folgende Plan-/Lesebelege bleiben historisch, keine Wiederholungsfreigabe; keine erneuten Metadaten-/Secretfragen.

Stand 14.11.2026, Europe/Berlin. **Nur vorbereitet, keine Übertragungsfreigabe und keine externe Abfrage in diesem Auftrag.** Ausgangshead `08813c644373302975bdf3bd250972464b00ef11`, sauberer Branch `entwicklung/anker-neu`. Alte Umgebung/835235b bleiben zurückgestellt. Der Abschlusscommit dieses Planungsauftrags wird nach dem Commit außerhalb des Repositorys in `HANDOFF_COMMIT.txt` und `RESULT.json` exakt gebunden; keine selbstreferenzierende Commit-SHA im Gitinhalt.

## 1. Quellen und tatsächlich lokaler Unterschied

| Rolle | Quelle und Beleggrenze |
|---|---|
| Vergleichsbasis Entwicklung | `6dfa632c94422d61d6a71c6a4a72c15fefd4a407`, zuletzt extern bestätigt **14.11.2026,01:59–02:00UTC /02:59–03:00Berlin**, heute nur vorhandenes lokales Commitobjekt verwendet |
| Vergleichsbasis main | `e48d2892846b4a2fec45bf0cefc396e1a4c92f10`, gleicher historischer Abfragezeitraum; keine aktuelle Remoteverfügbarkeit behauptet |
| Lokaler Auftragsbeginn | `08813c644373302975bdf3bd250972464b00ef11`,31Commits nach6dfa632 und dessen Nachfahre, ohne lokale Divergenz zu dieser bekannten Basis |
| Vorgesehener Übergabehead H | Neuer Dokumentationsabschluss dieses Auftrags, exakte SHA in der lokalen Sicherung; vor späterem Push sauber und unverändert prüfen |
| Bereits gebauter AAB-Quellcommit S | **`014870f3ee52c0233118d2852ef0719aa9bc602b`**, bleibt unverändert und ist Vorfahr des lokalen Übergabestands |
| Spätere Branch-CI | Muss ihre tatsächliche headSHA H und ihr Ereignis/Branch selbst belegen; ein PR-Test kann eine synthetische Merge-SHA verwenden, nicht einfach H unterstellen |
| Späterer main-Stand M | Noch nicht vorhanden/geprüft; abhängig von separat erlaubter Integration. Benötigt eigenen exakten erfolgreichen main-Push-CI-Beleg |

Zum Auftragsbeginn gegenüber6dfa632: **120Dateien,6520Einfügungen/178Löschungen**;67src-,19e2e-,10Android-,20Dokumentations- und4Rootdateien. Die jetzige Planungsdokumentation kommt hinzu; finale Zahlen/Dateiliste/Commitliste in der Sicherung. Kein neuer Produktdiff in diesem Auftrag. Seit AAB-Quelle S zum Auftragsbeginn ausschließlich Dokumentationsänderungen; daraus keinen neuen Build-/CI-Quellcommit für das vorhandene AAB machen.

| Übergabeanteil | Enthaltener lokaler Bestand |
|---|---|
| F-001/F-002/F-003 | Abfahrtsprojektion, bewusster Kurzmodus, dynamischer Vorbereitungsimpuls aus bestehenden Plan-/Reminderbesitzern; native Revisionen/Token-/Budgetgrenzen |
| T-005/F-004 | Datenschutz-/Backupimportgrenzen, Zeitdarstellung/Bestätigung tatsächlicher Dauer und freiwillige vorsichtige Lernvorschläge |
| F-005/F-006/F-007 | Wiedereinstieg, nächste Handlung bei Übergängen, freiwilliges nachvollziehbares Vereinfachungsangebot |
| F-008 | Ausschließlich freiwilliger lesender NFC-Softwarepfad; bereits einzeln freigegebene NFC-Permission und optionale Hardware. Keine Tag-Schreibfunktion oder Geräteabnahme |
| F-009/F-010 | Nur lokale stille Begleitung ohne Begleitstatistik und freiwilliger lokaler Wochenrückblick aus vorhandenen Daten |
| Tests/Integration | Regressionsfälle und belegt notwendige Anpassungen bestehender Tests; keine neuen Funktionen aus der Integrationsnachbereitung |
| Versionierung | Code18/1.5.0-rc.4 in genau den zuvor erlaubten drei Versionsdateien. Lockfile nach Ausklammern beider Rootversionen vollständig gleich6dfa632, keine Abhängigkeitsänderung |
| Dokumentation | Roadmap/Status/Datengrenzen/Gerätepfade/Paketnachweise/CI-Nutzerzuordnung; Originalplan und historische Gerätezeilen erhalten |

Der alte Tastatur-CI-Fall ist lokal bereits mit Commit `e421ee560cea709cba841843d35521b3f7755519` nachbereitet: auf geschlossenes Sheet, zurückgesetzten Historyzustand und aufgehobenes inert warten, Tastaturfokus prüfen; Regression mit bewusst gehaltenem Browser-Zurücklauf. Dieser Commit ist Teil der31lokalen Nachfolger. Kein neuer CI-Fix, kein Wiederholungslauf und keine Garantie über künftige GitHub-CI aus diesem Quellbeleg. Die [CI-Nutzerzuordnung](GITHUB_VORAUSSETZUNGEN_CODE18.md) ist erledigt: alter6dfa632-Pushcheck rot, fünf andere Checks grün, Versuch unbekannt. Keine erneute Rückfrage nötig.

## 2. Vorhandene Prüf- und Paketnachweise

| Beleg | Tatsächliches Ergebnis / Grenze |
|---|---|
| Gemeinsame lokale Softwareintegration | [T-006-Bericht](INTEGRATION_T006.md):1372TS/133Dateien vollständig grün.378verschiedene Browserfälle zuletzt grün:375im Vollauf,3nach belegter Testkorrektur gezielt; kein zweiter Vollauf behauptet.284Pythonfälle zuletzt grün nach gezielter Nachbereitung, keine reale Windowswirkung |
| Ergänzende Plattformgrenzen | Bestehende PowerShell19+4Parser,5PC-Paketfälle,16SQL/RLS, lokale Node/PythonTLS-Interoperabilität mit0OS-Effekten sowie Offline-Update-/Playwerkzeugtests; keine neuen Dienstaufrufe daraus |
| Lint/Typecheck/Build | Frühere erfolgreiche Integrationsbelege und frischer Code18-Webbuild/Typecheck/Capsync erhalten; keine unveränderte Suite wiederholt |
| Native JUnit |274Fälle/31Suiten aus F-008 quellenbezogen erhalten. Seitdem native Modell-/Test-/Brückeninputs unverändert, spätere Versionsdefaults getrennt geprüft. Kein neuer JUnit- oder Gerätebeleg in diesem Auftrag |
| Code18-AAB | [Paketnachweis](CODE18_AAB_INTEGRATION_T006.md), Quelle S, Quellkennung `760868d78627f3450f60361e32bd57e1bdc677777784cc84b87834f375e0ef75`,54.264.513Bytes, SHA256 `d0d5cfedc21e2201329dccf77177040f85884136e0ee44e5ea6ee600acbe282b` |
| AAB-Prüfumfang | Bestehender unsigned PackageBundleTask/Bundletool1.18.1/JAR-/ZIP-/Manifest-/Assets-/SDK-/16KB-Nachweis;672Einträge ohne Signierer,71Web-/75generierte Assets bytegleich. Heute nur vorhandene Datei/Größe/SHA als Übergabereferenz bestätigt, kein Neubau oder Pakettest |

Das AAB liegt weiterhin nur unter `/workspace/anker-code18-aab-20261114/Anker-Code18-UNSIGNIERT.aab`. Es wird durch den vorgeschlagenen Quellbranch-Push **nicht als Datei hochgeladen**; ebenso keine Toolchain, node_modules, Caches oder Sicherungsordner außerhalb des Repositorys. Neue CI läuft gegebenenfalls auf GitHub mit deren bestehenden Werkzeugen; lokale Chromium-/JDK-/SDK-Einrichtung wird dadurch nicht übertragen. Eine dortige Abweichung wäre konkret nachzuweisen, kein Grund für vorsorgliche Paket-/Workflowänderungen.

## 3. Lokal geprüfte Auslöser und Grenzen

Alle fünf Workflowdateien sind gegenüber dem lokal vorhandenen6dfa632 bytegleich; die vorherige externe Refprüfung band dieselben Workflowblobs auch an main e48d289. `netlify.toml`, SDK-/Capacitorvorgaben sowie beide alten Code17-Freigabemanifeste gleich6dfa632. Aktueller externer Aktivierungs-/Ruleset-/Deploymentstatus wurde nicht abgefragt.

| Definition | Späterer reiner Push auf entwicklung/anker-neu | Getrennte spätere Wirkung |
|---|---|---|
| ci.yml | Push-CI; bei weiterhin offenem PR zusätzlich PR-synchronize-CI zu erwarten. Automatische CI gehört ausdrücklich in eine spätere Pushfreigabe | Web/Logik/PC-/Offline-Grenztests, Artefakte; keine Signierung oder Google-Play-Abfrage in dieser Definition |
| android-update.yml | Kein Start: nur workflow_dispatch auf main | Exakte fullSHA in main-Historie, erfolgreicher ci.yml-Push auf main für genau diese SHA, keine Docs-Ausnahme. Leere Quelle benutzt weiterhin den alten freigegebenen Code17-Stand. Getrennter APK-Build-/Signierjob, kein signierter AAB-Weg |
| release.yml | Kein Start ohne v*-Tag | Tag-Push baut/signiert APK und erstellt/aktualisiert GitHub-Release. Deshalb keine Tags übertragen |
| google-play-upload.yml | Kein Start: main-Branchfilter; Datei unverändert | main-Push braucht passende Dateiänderung und Marker; Dispatch auf main wählt standardmäßig Upload. Inspectmarker hat bei beiden Vorrang, auch Inspect kann Google kontaktieren. Keine dieser Aktionen autorisiert |
| play-upload-diagnose.yml | Kein Start: main-Branchfilter; Datei unverändert | Dateiänderung+Berichtmarker auf main liest fest gebundenen alten Actions-Bericht, keine Googleabfrage |
| netlify.toml / externe Apps | Konfiguration unverändert, tatsächliche Kontobindung unbekannt | Ein eventuell verbundener Dienst kann Deploy-Previews/Checks auslösen. Keine allgemeine Zusage, dass der Push außerhalb der geprüften Workflows wirkungslos bleibt; keine aktive Cloudänderung oder Previewfreigabe daraus ableiten |

Die Vorlage für den nächsten begrenzten Pushauftrag muss die durch diesen Push unverändert ausgelöste Push-/PR-CI und gegebenenfalls bereits eingerichtete Preview-Automatik ausdrücklich einschließen. Preview-Automatik ist hier nicht als eingerichtet oder getestet bestätigt. Keine aktive Cloud-/Deploymentaktion oder Konfigurationsänderung daraus ableiten. Das ist die konkrete Wirkungsgrenze der späteren Freigabe; keine zusätzliche Secret-/Consolefrage erforderlich.

## 4. Noch nicht auszuführende Übertragungsvorlage

**Diese Schritte benötigen einen neuen ausdrücklichen Auftrag. Kein Befehl dieses Abschnitts wurde jetzt ausgeführt.** Ziel ausschließlich `refs/heads/entwicklung/anker-neu` im Repository `frnkrm/anker`, einmaliger normaler Fast-forward-Push; kein Force, kein main-/Tagpush und keine Änderung von PR/Workflow/Secrets.

1. H aus `HANDOFF_COMMIT.txt` der Sicherung binden; Branch/sauberen Arbeitsbaum und HEAD=H prüfen. Lokale Sicherung/Commitquelle erhalten, Hook-/Zieländerungen nicht umgehen. Der derzeit konfigurierte origin-Pushpfad wurde nur lokal und ohne Zugangsdaten protokolliert: HTTPS/github.com/frnkrm/anker.git, keine zweite Pushadresse.
2. Nach neuer Lesefreigabe aktuelle main-/Entwicklungs-/PR2-Refs nur per ls-remote und PR-/CI-Metadaten nur per vorhandenem GitHubzugriff prüfen. **Nicht** fetch/checkout/rebase/auth reparieren. Sollbasis Entwicklung6dfa632, main e48d289 und PR2 offen Entwicklung→main. Bei abweichenden Zielrefs oder neuem Workflow-/Hookrisiko stoppen und den kleinsten nötigen Abgleich benennen. Ein API-CONNECT403 bedeutet unbekannte Metadaten, keine fehlenden Secrets oder Rechte; nicht umgehen. Ein nicht erneut lesbarer PRstatus allein verhindert den ausdrücklich erlaubten Fast-forward-Push auf den unverändert bestätigten Entwicklungsbranch nicht; dadurch keine PR-/Mergefreigabe oder neue CI bestätigt. Keine Secret-/Playabfrage nötig.
3. Lokalen Vorfahrenbezug6dfa632→H sowie unveränderte Workflow-/Manifestbindungen nachweisen. Kein Push allein aus alten Refs oder dem Nutzerbericht. Aktuelle lesbare Gitrefs, unveränderte lokale Quellen/Grenzen und eine ausdrückliche begrenzte Pushfreigabe sind nötig; ein API-Transportfehler ersetzt diese Refprüfung nicht, macht aber auch kein zusätzliches PR-API-Gate für den einzelnen Branch-Push.
4. Erst bei erfüllten Voraussetzungen und neuer ausdrücklicher Push-/automatischer-CI-Freigabe genau eine Ref übertragen. Vorlage, **heute nicht ausführen**:

   ```bash
   ANKER_HANDOFF_SHA=$(cat /workspace/anker-t006-github-uebergabe-20261114/HANDOFF_COMMIT.txt)
   git push --porcelain --no-follow-tags https://github.com/frnkrm/anker.git "${ANKER_HANDOFF_SHA}:refs/heads/entwicklung/anker-neu"
   ```

   Kein `--all`, `--mirror`, `--tags`, Force oder paralleler Zielpush. Bei Ablehnung/Zugriffssperre/Remoteabweichung stoppen, keine Anmelde-/Secret-/Cloudänderung. Kein automatischer weiterer Push von nachträglichen Dokumentationscommits.
5. Nach neuer Lesefreigabe Ergebnis-Ref=H und unverändertes main bestätigen; PR2 muss H enthalten und weiterhin auf main zielen. Keinen neuen PR erstellen oder mergen. Ausgelöste ci.yml-Push-/PR-Läufe mit Run-ID, tatsächlicher headSHA, Branch, Ereignis, Versuch und Ergebnis getrennt erfassen. Alte6dfa632-CI nicht als neue CI führen. Bei fehlender APIlesbarkeit konkret blockiert dokumentieren; keine Tokens oder wiederholte Secretfragen.
6. Roten/neuen CI-Fall nur dokumentieren. Ohne separaten Auftrag keine Code-/Workflow-/Timeout-/Paketänderung oder Neulauf. Bei Grün nur Branch-/PR-CI bestätigen; keine main-/Signier-/Upload-/Gerätefreigabe. Abschlussdokumentation danach lokal sichern/committen, nicht automatisch erneut übertragen.

## 5. Separate Entscheidungen und offene Abnahmen

| Entscheidung / Hindernis | Erforderliche Grenze |
|---|---|
| Nächster möglicher Auftrag | Begrenzter aktueller Ref-/PR-Abgleich mit eventuell anschließendem einmaligem Branch-Push und dadurch automatischer Push-/PR-CI. Noch keine Freigabe hier. Bei weiterem CONNECT403 PR-/CI-Nachweis offen halten, aber keinen zusätzlichen API-Gate für den ausdrücklich erlaubten Branch-Push erfinden. Ohne aktuelle bestätigte Zielrefs oder bei Abweichung vor Push stoppen |
| main-Integration | Eigene Freigabe nach Prüfung des tatsächlichen PR-Diffs/aktueller CI/Schutzregeln. Mergeart bestimmt M; keine jetzige Festlegung oder Historyumschreibung. Eine synthetische PR-Merge-SHA ist kein tatsächlicher main-Merge |
| Exakte main-CI | Muss für den tatsächlichen künftigen Buildquellcommit erfolgreich und als push/main/ci.yml belegt sein. Ein Lauf auf H oder M ist kein Lauf auf S. Kein alter AAB-Quellbeleg auf neue SHA umetikettieren |
| Neues signiertes AAB | Privater Uploadzugriff und geeigneter AAB-Signierprozess bleiben unbelegt. Bestehender APK-Updateweg/vierSecretnamen ersetzen das nicht. Nach separater Quell-/Build-/Schlüsselverwendungsfreigabe neuer exakt gebundener Paketnachweis; jetzt keine Umsetzung oder Probe |
| Freigabemanifeste | Alte Code17-Manifeste bleiben80f6a692/Code17/ihrem alten Artefakt gebunden. Code18-Freigaben erst gesondert entscheiden, alte Nachweise nicht überschreiben. Leerer Workflow-Quellparameter ist keine Code18-Auswahl |
| Version / Play | Code18 ist lokal gesetzt, nicht reserviert. Neuer aktueller Bundle-/Trackbestand und eigene Upload-/Entwurfsentscheidung erforderlich, heute keine Console-/Playabfrage. Kein Rollout aus Branch-Push ableiten |
| Signierrollen | Nutzerangaben App-Signierer8A/UploadB4 getrennt; vier Signing-Secrets samt Scope unbekannt/nicht einsehbar. Kein B4-Direktupdate einer8A-Installation zusagen, keine Deinstallation/Datenlöschung als Umweg |
| E-002 | Reale Galaxy-Wecker-/Sperr-/Zustellungs-/Updatebeobachtungen offen; geeigneter freigegebener Gerätebuild nötig |
| E-003 | Reale Windows-Scheduler-/Toast-/Audio-/Stoppbeobachtungen offen; Mock-/Loopbacktests ersetzen sie nicht |
| E-004 | Echtes Kalenderkonto/Rechtebeobachtung offen |
| E-005 | Reales NFC/Galaxy/Tag-/Lifecycleverhalten offen; keine echten Tags/Geräteaktionen |
| Gesamtstatus | T-006/V-014 **IN_ARBEIT**, Geräte-/Signier-/Upload-/Release-/Gesamtfreigaben offen |

## 6. Lokaler Planungsabschluss

Nur neue Übergabedokumentation und belegte Status-/Roadmap-/Testnachweisverweise ändern. Keine Produkt-/Versions-/Abhängigkeits-/Workflow-/Freigabemanifeständerung, kein Testlauf/Build oder externe Aktion. Originalplan/36IDs/103historische Gerätezeilen erhalten. Sicherung `/workspace/anker-t006-github-uebergabe-20261114/`: Ausgangs-/Nachher-Bundle, Ausgangs-/finale Diffs/Commitlisten, Quell-/Workflow-/Versions-/Artefaktreferenzen, Integritäts-/Wiederherstellungs-/SHA256-Nachweise, exakter H und genau ein nächster Einzelauftrag. Nur Cloud-lokal, keine externe Sicherung bestätigt. Nach diesem Auftrag stoppen.
