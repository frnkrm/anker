# T-006 – begrenzter Entwicklungsbranch-Push und Nachkontrolle

Nachtrag14.11.2026: Der unten offene NFC-Fall wurde inzwischen [gezielt lokal reproduziert und korrigiert](NFC_CI_KORREKTUR_T006.md), ohne weiteren Push/Workflowstart. Die hier dokumentierten Remote-Läufe H bleiben unveränderte historische Befunde; lokale18NFC-Browser/31TS grün sind keine neue Remote-CI und kein korrigierter Paketbuild.

Stand 14.11.2026, Europe/Berlin. Neuer ausdrücklicher Auftrag erlaubt genau einen normalen Fast-forward-Push des Übergabecommits **H=`1847c8a041432d41a4598f5ab2e6d99540f8ddac`** ausschließlich nach `refs/heads/entwicklung/anker-neu` in `frnkrm/anker`, samt unverändert dadurch ausgelöster CI/gegebenenfalls vorhandener Previewautomatik. Keine main-/Tag-/Merge-/Signier-/Installations-/Playfreigabe. [Vorbereitete Übergabegrenzen](GITHUB_UEBERGABE_CODE18_PLAN.md). Alte Umgebung/835235b bleiben zurückgestellt.

## Vorprüfung und tatsächlich einmalige Übertragung

Vor jeder Mutation HEAD=H, Branch und sauberen Arbeitsbaum geprüft, Vorher-Git-Bundle verifiziert. Aktuelle externe Refantwort am14.11.2026um02:56:39UTC /03:56:39Berlin: Entwicklung/PR2-head6dfa632c94422d61d6a71c6a4a72c15fefd4a407, main e48d2892846b4a2fec45bf0cefc396e1a4c92f10. Damit Sollrefs erfüllt. Lokaler Nachfahrenbezug6dfa632→H und AAB-Quelle→H nachgewiesen. Keine aktiven/custom Git-Hooks oder aktivierte Git-Pushsignierung; fünf Workflowdateien/SDK-/Capacitor-/Netlifyvorgaben/alte Code17-Freigabemanifeste gegenüber6dfa632 unverändert. Keine Secretwerte oder privaten Schlüssel gesucht/gelesen.

Am02:56:58UTC /03:56:58Berlin **genau ein** Pushversuch, Exitcode0:

```text
git push --porcelain --no-follow-tags https://github.com/frnkrm/anker.git 1847c8a041432d41a4598f5ab2e6d99540f8ddac:refs/heads/entwicklung/anker-neu
6dfa632..1847c8a
Done
```

Kein Force, `--all`, `--mirror`, Tag-/main-Push, zweiter Push, Fetch/Checkout, manueller Workflowstart oder PR-Schreibzugriff. Das vorhandene lokale unsigned AAB wurde nicht als Datei übertragen. Die32lokalen Nachfolger/121Dateien gegenüber der vorherigen Entwicklungsbasis sind jetzt in dieser Entwicklungsbranchhistorie erreichbar; damit auch Versionsquelle014870f3. Keine Verfügbarkeit des zurückgestellten835235b behauptet.

## Frisch bestätigte Zielrefs und PR2

Nachkontrolle um02:57:14UTC /03:57:14Berlin:

| Ref | Tatsächlich angekündigte SHA |
|---|---|
| refs/heads/entwicklung/anker-neu | **`1847c8a041432d41a4598f5ab2e6d99540f8ddac`** |
| refs/heads/main | **`e48d2892846b4a2fec45bf0cefc396e1a4c92f10`**, unverändert |
| refs/pull/2/head | **`1847c8a041432d41a4598f5ab2e6d99540f8ddac`** |
| refs/pull/2/merge | `711e95d91cfdb8ad56ca40acc44f8f56eaf99e13`, synthetische PR-Mergeref, kein main-Merge |

Lokale origin-Trackingrefs wurden beim expliziten URL-Push nicht aktualisiert und mangels erlaubtem Fetch bewusst nicht repariert. Eine weiter angezeigte ahead-Zahl gegenüber origin ist daher kein Widerspruch zum frisch bestätigten Remotehead H. Den späteren lokalen Dokumentationsvorsprung gegen H prüfen, nicht aus dem alten origin-Cache ableiten.

GitHub-Webseite von [PR2](https://github.com/frnkrm/anker/pull/2) um02:58:33UTC direkt lesbar: **Open**, `entwicklung/anker-neu` → `main`,33Commits. Branch-/PR-head durch Refantwort exakt H. Kein neuer PR erstellt, bestehender PR nicht editiert oder gemergt. Open/33Commits beweist keine Reviewzustimmung oder Gesamtfreigabe. Eine spätere externe Änderung wäre erneut zu prüfen; diese Nachkontrolle ist zeitgebunden.

## API-Sperre und funktionierender lesender Webweg

Vor und nach Push gh-GET für PR2 und ci.yml-Läufe gefiltert auf H: Exitcode1, etwa exakt:

```text
Get "https://api.github.com/repos/frnkrm/anker/pulls/2": Forbidden
```

Transportprüfung um02:57:14UTC:

```text
curl: (56) CONNECT tunnel failed, response 403
HTTP=000
```

403 betrifft den API-CONNECT-Tunnel, keine festgestellte GitHub-Rechteentscheidung. Kein zusätzlicher PR-API-Gate für den ausdrücklich erlaubten Branch-Push eingeführt. Keine Auth-/Proxy-/Cloud-/Secretänderung oder Zugriff auf Secretwerte.

**GitHub-HTML funktioniert mit bestehendem Zugriff, HTTP200:** PR2, Actionsübersicht und konkrete Run-Summaryseiten über github.com ausschließlich per GET gelesen. Keine Anmeldung/Tokenabfrage, Cookies oder private Konfiguration gesucht/geändert; keine API-Sperre durch Konfigurationsänderung umgangen. Nur ausgewählte öffentliche Metadaten/Statuskontexte gespeichert, keine komplette HTML-/Login-/Logdatei. Deshalb PR-/CI-Nachweis nicht pauschal als unlesbar ausgegeben. GitHub-HTML als vorhandenen lesenden Folgeweg verwenden, nicht wieder nach Nutzer-/Secretangaben fragen.

## Tatsächlich ausgelöste neue CI und Beleggrenzen

| Lauf | Tatsächliche Zuordnung |
|---|---|
| [43549032956](https://github.com/frnkrm/anker/actions/runs/43549032956),CI#52 | Trigger **push**, `entwicklung/anker-neu`, vollständiger Commitlink **H**,ci.yml |
| [43549036157](https://github.com/frnkrm/anker/actions/runs/43549036157),CI#53 | Trigger **pull_request/synchronize**,PR2,`entwicklung/anker-neu`,Seitentitel `anker@1847c8a`,ci.yml; vollständige Run-headSHA/API und Checkout-SHA aus dieser anonym lesbaren Summary nicht eigenständig geliefert |

Die PR-Zuordnung verbindet sichtbaren Run-Titel/PR2-Synchronize und bestätigten PR2-head H; die synthetische Mergeref711e95d wird **nicht** ungeprüft als tatsächlich ausgecheckte CI-SHA übernommen. Bei PR-CI kann der Checkout vom sichtbaren Headcommit abweichen. Versuchnummern waren in den gelesenen Links nicht angezeigt und bleiben unbekannt, kein Neustart. Alte6dfa632-Läufe sind keine Nachweise dieser neuen Übertragung.

**Endergebnisse direkt aus den GitHub-Summaryseiten, zuletzt Status gelesen03:09:27UTC /04:09:27Berlin:**

| Lauf | Endstatus / Dauer | Sichtbare Prüfzahlen |
|---|---|---|
| Push43549032956 | **Failure**,10m28s | Vitest1372bestanden/0Fehler/0Skip; Playwright **377bestanden,1fehlgeschlagen** (8,9m) |
| PR43549036157 | **Success**,11m57s | Vitest1372bestanden/0Fehler/0Skip; Playwright **378bestanden** (9,5m) |

Die Push-Summary liefert den konkreten Fehler als Annotation:

```text
e2e/nfc.spec.ts:150:1 › Verlassen während Öffnungsbestätigung verwirft das verspätete Ja
at e2e/nfc.spec.ts:158:22
Error: expect(page).toHaveURL(expected) failed
Expected pattern: /\/mehr$/
Received string: "http://localhost:4173/vorbereitung"
Timeout: 5000ms
```

Nach vorher bereits bestätigtem Verlassen nach `/mehr` und Freigabe der verspäteten Bestätigung erwartet der Test weiterhin `/mehr`, beobachtet aber `/vorbereitung`. Dies ist ein **neuer konkreter CI-NFC-Befund** im Pushlauf. Unterschiedliche Ergebnisse von Push-/PR-Lauf allein beweisen weder eine bestimmte Produktursache noch bloß einen Testfehler. Keine Rootcauseanalyse, Quelländerung, Timeoutlockerung oder Testwiederholung in diesem Auftrag. Alte lokale378grüne Browserfälle bleiben historische Ergebnisse; die aktuelle gemeinsame CI-Abnahme ist wegen dieses roten Pushfalls offen. Historischen begrenzten F-008-Softwareabschluss nicht als aktuelle CI-/Gerätefreigabe ausgeben.

Der erfolgreiche PR-Lauf ist ein eigener Nachweis und ersetzt den roten Pushlauf oder die fehlende exakte main-Push-CI nicht. Weder main-Integration noch Gesamtfreigabe. Die um03:10:06UTC erneut gelesenen Refs bestätigen Entwicklung/PR2-head weiterhin H, main weiterhin e48d289.

**Genau nächster zulässiger Einzelauftrag:** Den belegten NFC-CI-Fall gezielt **lokal** untersuchen und nur bei nachgewiesener Ursache die kleinste notwendige Korrektur samt sinnvoller Regression umsetzen. Vorhandene Scan-/Sitzungs-/Bestätigungs-/Navigationsbesitzer nutzen; überholtes Ja darf nach Verlassen keinen Zielwechsel auslösen. Produktfehler und Testreihenfolge/Timing anhand vorhandener Belege unterscheiden, keinen grünen Test durch Weglassen/Retry/Timeoutlockerung herstellen. Bestehenden Chromiumweg und gezielte NFC-/Brücken-/Datenschutzprüfungen verwenden, nur bei echten nativen Änderungen passende vorhandene JUnit. Keine neue Funktion, Berechtigung/Abhängigkeit, echten NFC-/Geräteaktionen oder erneute Remoteübertragung. Aktuell keine Fixfreigabe ausgeführt; dafür ist der neue Einzelauftrag separat zu erteilen.

CI-Status-/Dauer-/Triggernachweise aus den vorhandenen Summaryseiten, keine eigenen lokalen Tests oder Builds. Joblogs/Detailberichte verlangen in der gelesenen Ansicht Anmeldung; nicht durch Token-/Authänderungen beschafft. Runner-Imagewarnungen sind in der Summary sichtbar und begründen hier keine Paket-/Workflowänderung. Nicht mehr Testzahlen behaupten, als die bisherigen lokalen Nachweise und frisch lesbaren CI-Statusbelege tragen. Kein manuelles Rerun, Fix oder Workflowwechsel.

## Quellen, Freigaben und lokaler Abschluss

| Rolle | Bindung |
|---|---|
| Gepushter Übergabehead | **H=1847c8a041432d41a4598f5ab2e6d99540f8ddac**, neue Branch-Push-CI separat oben |
| Bereits gebauter unsigned Code18-AAB-Quellcommit | **`014870f3ee52c0233118d2852ef0719aa9bc602b`**, [bestehender Paketnachweis](CODE18_AAB_INTEGRATION_T006.md), jetzt als Vorfahr von H im Entwicklungsbranch, nicht auf main bestätigt |
| AAB |54.264.513Bytes/SHA256 `d0d5cfedc21e2201329dccf77177040f85884136e0ee44e5ea6ee600acbe282b`,unverändert Cloud-lokal; kein neues Artefakt aus H gebaut |
| main | e48d289 unverändert, keine neue exakte main-Push-CI oder Integration des neuen Stands |
| Dokumentationsabschluss dieses Auftrags | Nach diesem Push neu lokal zu committen, exakte SHA im Sicherungsmanifest; **nicht erneut pushen** und nicht als Remote-/CI-head ausgeben |

Keine Docs-Ausnahme bei vorhandenen main-/Quell-/CI-Gates. Branch-/PR-CI ist kein main-Push-Beleg und kein CI-Lauf auf AAB-Quelle014870f3. Alte Code17-Manifeste binden weiterhin80f6a692/Code17/alte CI/Artefakte und bleiben unverändert. Vier Signing-Secrets/Scopes und nutzbarer privater Uploadzugriff unbekannt/nicht einsehbar; nicht erneut abgefragt. APK-Signierworkflow schafft keinen signierten AAB-Prozess. App-Signierer8A/UploadB4 weiterhin getrennt, keine Direktupdate-/Installations-/Playannahme zugesagt.

T-006/V-014 **IN_ARBEIT**; E-002–E-005 und main-/Signier-/Upload-/Geräte-/Release-/Gesamtfreigaben offen. Keine reale Galaxy-/Windows-/Kalender-/NFC-Abnahme. Nur getrackte Abschlussdokumentation nachführen; keine Produkt-/Versions-/Abhängigkeits-/Workflow-/Freigabemanifeständerung, lokale Tests/Builds, Signierung/Installation, Cloud-/Secret-/Google-Play-/Consoleaktion. Durch erlaubten Push ausgelöste unveränderte automatische CI getrennt von diesen lokalen Grenzen halten; keine externe Previewkonfiguration geprüft/geändert oder erfolgreiche Preview behauptet.

Sicherung `/workspace/anker-t006-branch-push-20261114/`: Vorher-/Nachher-Bundle, lokaler Preflight, einmaliger Pushlog, zeitgebundene Vorher-/Nachher-Refs, API-/Transportfehler, lesende HTML-Statusmetadaten und CI-Verlauf, finaler Dokumentdiff, Wiederherstellungs-/fsck-/Dateihashes/SHA256SUMS, Abschluss-/nächster Einzelauftrag. Nur Cloud-lokal gesichert; jetzt gepushte Quellen sind zusätzlich auf GitHub bestätigt, Sicherungsordner/unsigned AAB/lokaler Abschluss dadurch nicht extern gesichert. Nach Abschluss stoppen.
