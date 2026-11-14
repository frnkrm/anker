# T-006 – erster Code18-prepare-Aufruf: Abbruch in resolve

Stand **14.11.2026**. Freigegebener einmaliger manueller prepare-Aufruf durch den Besitzer und lesende Nachkontrolle. **Kein Neustart, Fix oder Signieraufruf. Kein U2 erzeugt.**

## Bindungen und tatsächliches Ergebnis

| Rolle | Nachweis |
|---|---|
| Arbeitsort / Branch | `/workspace/anker-main-code18-aab` / `entwicklung/anker-neu` |
| Sauberer lokaler Ausgang G | `007cf598185614bab093cb1dc5a6f1f69b1154fa`, nicht übertragen |
| Tatsächliche main-Workflowquelle W | `741fb7b09f0a442d779aaed192bd223724d3523f` |
| Weiter feste angeforderte Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Unveränderter Entwicklungs-/PR3-head L | `3f5345dd08032aa6d19328a2c2cee22527150266`; PR3Merged |
| Tatsächlicher Lauf P | [43637658561](https://github.com/frnkrm/anker/actions/runs/43637658561), android-aab-pruefstand.yml, **workflow_dispatch / main / W / Versuch1**, gestartetam14.11.2026um20:28:19UTC |
| Endergebnis | **Failure,9Sekunden**,resolve5Sekunden;kein Retry/Re-run |
| Fehlgeschlagener Schritt | **Exakte getrennte main-CI für M und W prüfen**, Jobresolve132577928009 |
| Einzige öffentlich lesbare Fehlermeldung | **`Process completed with exit code 1.`** |
| Folgejobs | **prepare,sign,verify jeweils skipped** |
| Artefakte / U2 / H2 / HP / A / Archivdigest | Summary zeigt **keine Artefakte**;nicht vorhanden,kein Build-/Unsigned-Prüferfolg |
| Neuer lokaler Abschluss H | ExakteSHA im Sicherungsmanifest RESULT.json;nicht gepusht,kein Workflow-/Appquellcommit |

## Vorprüfung und autorisierter UI-Rückweg

G/Branch/saubererArbeitsbaum,L/M-Vorfahren und unveränderte lokale Produkt-/Workflowquellen bestätigt. Frische Refs mainW/EntwicklungL,PR3Merged geprüft. Getrennte ci.yml-Gates43622275785 für exaktW und43601398931 für exaktM jeweils push/main/Versuch1Success öffentlich gelesen;kein Neulauf/Docs-Ersatz. W-Workflowquellzeilen stimmen vollständig mit dem geprüften lokalenL überein. Definition bestätigt ausschließlich manuellen main-Weg,prepare ohne Signiersecretreferenzen und getrennte sign/verify-Modi.

Vor Start zeigte die öffentliche Workflowhistorie **0Läufe/This workflow has no runs yet**. Die leere Historyseite liefert kein workflowRuns-Array; das wurde als Metadatenformat berücksichtigt,kein Lauf oder Erfolgsbeleg daraus erfunden. Nach Besitzerstart enthält sie genau den ersten LaufP. Kein zusätzlicher Agenten-Dispatch und keine latest-/Altartefaktauswahl.

Vorhandener Agenten-Leseweg scheiterte mit **`Get "https://api.github.com/repos/frnkrm/anker/actions/workflows/android-aab-pruefstand.yml": Forbidden`**;keine Authreparatur und kein GitHub-/Browsersteuerungstool verfügbar. Deshalb der ausdrücklich freigegebene normale UI-Handgriff durch den Besitzer. Nutzer meldete „Gestartet“. AngeforderteInputs in DISPATCH_INPUTS.json: modeprepare,source_commitM,expected_workflow_commitW;alle5Signierbindungsfelder leer. Die tatsächlichen vom Lauf empfangenen Inputstrings sind **nicht eigenständig öffentlich ausgelesen**. Kein bestätigtes AppcheckoutM behaupten: der dafür zuständige prepare-Job wurde nicht ausgeführt.

## Fehlerbeleg und kleinste fehlende Information

Summary,Actions-Liste,vollständigerCommitlinkW und Run-Workflowansicht binden P/W/main/workflow_dispatch. Aktueller Versuch1 aus jobGroupsFetchUrl bei viewingCurrenttrue. Jobgraph zeigt resolvefailed,prepare/sign/verifyskipped. Damit kein App-/Web-/SDK-/AAB-Build,keine PackageBundle-/Nullsignierprüfung und kein U2 in diesem Lauf. Insbesondere kein Schlüsselgebrauch oder signierter OutputS.

[Resolvejob](https://github.com/frnkrm/anker/actions/runs/43637658561/job/132577928009) liefert öffentlich **HTTP200,aber `Sign in to view logs`**. Seine Annotation nennt den Schritt und nur Exitcode1. Der eigentliche Helper-Fehlercode bzw. die detaillierte Ursache bleibt **unbekannt**. Der Schrittname allein beweist weder ein rotes M-/W-CI-Gate noch falsche Inputs,Netzwerkfehler oder einen Produktfehler. Keine dieser Ursachen geraten und keine Prüfung als bestanden ausgegeben.

**Kleinste nächste Handlung:** vorhandenen fehlgeschlagenen Resolve-Schritt im bereits angemeldeten Besitzerbrowser rein lesend öffnen;die konkrete Fehlermeldung,insbesondere gegebenenfalls `AAB-Prüfung abgebrochen: …`,mit unmittelbar relevanten Zeilen bereitstellen. Keine neuen Zugangsdaten,Secretwerte,Signierschlüssel oder Umgebungsdumps anfordern. Keinen Re-run/Retry/Fix oder Workflowneustart dafür auslösen. Erst dieser konkrete neue Fehlerbeleg ermöglicht eine belegte Ursachen-/Folgeplanung; bekannte Branch-/CI-/Play-/Besitzerangaben nicht erneut erfragen.

## Erhaltene Belege und Grenzen

M- und W-main-CI bleiben getrennte vorhandene erfolgreiche Softwarebelege;dieser manuelle prepare-Lauf ist dennoch rot. Keine unveränderten Vollsuiten,Java-/Android-/Browser-/Paketprüfungen oder lokalenAppbuilds wiederholt. Keine Produkt-/Workflow-/Versions-/Freigabemanifeständerung,kein Push/Merge/Tag/Clone/Fetch/Checkout,Auth-/Cloud-/Secret-/Playeingriff,Signieren/Installieren oder echte Geräte-/NFC-/PC-Aktion. Bei Rot ausschließlich dieser Nachweis,kein Fix/Neustart.

U1 bleibt unveränderte vorhandene unsignedReferenz ausM:54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. Nicht als U2 umetikettieren. **Keine AAB-/Metadaten-/Archivhashes oder Artefakt-ID für P erfinden**,keine Signierfreigabe mangels konkreter H2/HP/P/Versuch/A. B4Upload-/8APlayrolle und unbekannter privater Zugriff getrennt. Code18 weder Play-frei noch reserviert behauptet. Historisches014870f3-AAB/Code17-Guards und zurückgestellteUmgebung835235b erhalten.

## Nur lokaler Abschluss

Nur diese Nachkontroll-/Statusdokumentation lokal committen/sichern unter `/workspace/anker-t006-code18-prepare-20261114/`,nicht nachpushen. Vorher-/Nachher-Bundle,angeforderteInputs,UI-/HTML-/Run-/Job-/Zugriffslückenbelege,Dokument-/Bestandsschutz,unabhängigerRestore und SHA256SUMS. Kein U2-/S-Dateiarchiv,weil kein solches Ergebnis erzeugt wurde. W bleibt extern gebundener,nicht lokal nachgeladenerCommit;Bundle enthält vorhandene lokale H/G/L/M. Frühere UI_HANDOFF/pending-Angaben sind gesicherter Vorzustand,RESULT.json ist aktueller Abschluss.

**T-006/V-014 IN_ARBEIT,E-002–E-005 und weitere Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** Konkreter Blocker: Detailfehler des gescheiterten resolve-Schritts nicht lesbar,kein U2. Genau nächster separat zu beauftragender Einzelauftrag: **vorhandenen Resolve-Detailfehler aus P ausschließlich lesend einholen und zuordnen**. Kopierfertige Vorlage mit tatsächlichem H in NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
