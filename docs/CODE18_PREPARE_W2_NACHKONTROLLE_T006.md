# T-006 – neuer W2-prepare-Lauf: Resolve grün, SDK-Schritt abgebrochen

## Fortschreibung: Detailfehler inzwischen per Nutzerscreenshot belegt (15.11.2026)

[P2-SDK-Detailfehler und begrenzter Folgeplan](P2_SDK_DETAILFEHLER_T006.md): Zu genau P2/Versuch1/Job132708064401 liegt jetzt `line 1: sdkmanager: command not found`/Exit127 vor. Paketierung und Unsigned-Prüfung sichtbar übersprungen. SDK-Installation versus PATH bleibt offen; kein Fix/Neulauf. Screenshot zeigt P2-Prepare-Inputobjekt mit drei Pflichtfeldern und binding=null; keine nachträgliche Aussage über alten P. Dieser neue Beleg ersetzt im folgenden historischen D3-Bericht ausschließlich die damalige Unkenntnis des Fehlertexts und der sichtbaren Inputdarstellung. Sämtliche alten Belege bleiben erhalten; aktuelle Zuordnung und genau nächster lokaler Auftrag stehen im verlinkten neuen Bericht.

Stand **15.11.2026**, lesbare Zeiten **Europe/Berlin (MEZ)**. Genau ein neuer autorisierter Besitzer-UI-Dispatch und ausschließlich lesende Nachkontrolle. **Failure dokumentiert; kein Fix, Neustart oder Signieraufruf.**

## Neuer tatsächlicher Lauf und unveränderte Quellen

[P2 43679893044](https://github.com/frnkrm/anker/actions/runs/43679893044): **workflow_dispatch / main / W2 / Versuch 1 / Failure nach30s**. Angezeigte Workflow-Laufnummer **#2** bezeichnet einen neuen Lauf, nicht Versuch2 des alten P. Erstbeobachtung des neuen Laufs um **06:10:55 MEZ**; der Nutzer meldete „gestartet“. Kein zweiter Start durch den Agenten.

| Rolle | Stand / Grenze |
|---|---|
| Workflowquelle W2 | `87c83fedf5c1aa52450ee36f650134c442928c28`; vollständiger Summary-Commitlink und Lauf-Workflowansicht stimmen überein |
| Angeforderte feste Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354` |
| Erhaltener Entwicklungshead K | `77316d69d637c0445cf5d2f4dada37c23011a70f` |
| Lokaler sauberer Ausgang D2 | `de4f217aca8d9f151b1f62cdea01cc82397969f9`, Branch entwicklung/anker-neu |
| Neuer ausschließlich lokaler Dokumentationsabschluss D3 | Vollständige SHA in RESULT.json der Sicherung; nicht übertragen und nicht Workflow-/App-/Runquelle |

Refs vor Dispatch und nach Nutzeraktion sowie zuletzt **06:16:09 MEZ**: main=W2, Entwicklung=K. W2 weiter kein lokales Gitobjekt; kein Clone/Fetch/Checkout/Rebase. Alte Umgebung/835235b bleibt zurückgestellt.

Vorab beide unabhängigen exakten CI-Gates erneut ausschließlich gelesen: **M / CI43601398931 und W2 / CI43676620317**, je ci.yml/exakte Quelle/push/main/Versuch1/Success. Keine Docs-Ausnahme, kein Branch-/PR-Ersatz oder Neulauf. Öffentliche Quellobjekte aus exakt W2: AAB-Workflow262Zeilen und Helper717Zeilen entsprechen lokalem geprüften Stand. Erster zusätzlicher Workflow-Quellabruf lieferte503 Service Unavailable, ein einmaliger rein lesender Abruf desselben öffentlichen URLs danach erfolgreich. Dies war kein Workflowretry und kein Beleg einer Ursache des späteren P2-Abbruchs.

API-Workflowlisten-Lesezugriff Forbidden, kein angebotener steuerbarer angemeldeter Browser/GitHub-Connector, keine Authreparatur oder Dispatch-Schreibprobe. Deshalb ausdrücklich vorgesehener normaler UI-Rückweg beim bereits angemeldeten Besitzer. Vorher nur alter P43637658561, nachher genau neuer P2 daneben; kein weiterer Run in Abschlussliste.

## Angeforderte Inputs versus tatsächliche Belege

REQUESTED_INPUTS.json und gesicherter Nutzerauftrag binden ausdrücklich: mode=prepare,source_commit=M,expected_workflow_commit=W2; prepare_run_id,prepare_run_attempt,unsigned_artifact_id,expected_unsigned_sha256 und expected_proof_sha256 jeweils leer. **Tatsächlich empfangene rohe Inputstrings wurden nicht unabhängig ausgelesen.** Kein Umgebungsdump oder Secretwert angefordert.

Die public Summary zeigt prepare als ausgeführten Job. Nach unveränderter Workflowbedingung wird dieser nur bei resolve.outputs.mode=prepare ausgeführt; der tatsächliche Prepare-Zweig ist daher belegt. Daraus keinen neuen Raw-Input-/Keyset-/Quellcheckout-Dump erfinden. API-run.head_sha und tatsächlicher Runner-Appcheckout wurden nicht unabhängig gelesen; vollständige öffentliche Lauf-/Workflowquelle W2 ist getrennt gebunden.

## Tatsächliche Jobs und Abbruch

| Job | ID / Ergebnis / Dauer |
|---|---|
| resolve | **132708027128 / Success /8s** |
| prepare | **132708064401 / Failure /17s** |
| sign | **132708065479 / Skipped** |
| verify | **132708065772 / Skipped** |

Ergebnisse über öffentliche Jobgraph-Symbole und Summary/Jobannotation belegt; p2-public-job-graph.json enthält nur gefilterte Status-/Namensangaben. Neuer Lauf unterscheidet sich vom alten P-Resolve-Abbruch: **Resolve ist in P2 erfolgreich, Fehler liegt später im Prepare-Job.** Das beweist keine konkrete alte P-Rohinputform oder alleinige historische Ursache.

Öffentliche [Prepare-Jobseite](https://github.com/frnkrm/anker/actions/runs/43679893044/job/132708064401) nennt den fehlgeschlagenen Schritt und Fehler exakt:

```text
Benötigte bestehende Android-SDK-Versionen bereitstellen
Process completed with exit code 127.
```

Die aus W2 gelesene Definition ordnet diesem Schritt in `.github/workflows/android-aab-pruefstand.yml`,Zeilen112–113, genau folgenden vorgesehenen Befehl zu:

```text
sdkmanager 'platforms;android-36' 'build-tools;35.0.0'
```

**Dies ist der Workflow-Quellbefehl, kein ausgelesener Runtime-stderr.** Welche konkrete Fehlermeldung dem Exitcode vorausging, bleibt unbekannt. Keine falschen Inputs, fehlenden Werkzeuge, PATH-/Installations-/Netzwerk-/Produkt-/CI-Ursache allein aus Schrittname/Exitcode ableiten. Kleinste notwendige Folgehandlung ist der konkrete vorhandene Fehlertext aus genau diesem Schritt; noch kein Fix oder Einrichtungsversuch.

Die App-Paketierung, Webbuild-/Capacitor-/Gradle-Sequenz und vollständige Unsigned-Prüfung liegen in der Definition erst hinter diesem fehlgeschlagenen SDK-Schritt. Kein erfolgreicher Paketierungs-/Unsigned-Prüfbeleg behauptet. Public Summary **Artifacts: –**. **Kein U2/H2/HP/A/Archivdigest/S-Nachweis**, kein heruntergeladenes Artefakt; keine Installierbarkeit, Play-Annahme oder Geräteabnahme.

## Genaue Zugriffslücke und keine eigenmächtige Korrektur

Jobseite HTTP200, aber **Sign in to view logs**. Ein vorhandener normaler CLI-Leseversuch lieferte exakt:

```text
failed to get job: Get "https://api.github.com/repos/frnkrm/anker/actions/jobs/132708064401": Forbidden
```

In p2-prepare-log-read.log/json gesichert. Keine Authreparatur/Umgehung, keine Schlüssel-/Secret-/Session-/Wertsuche und keine neuen Zugangsdaten. Konkreter stderr/fehlschlagender Detailbefehl oder Umgebung sind mangels lesbarer Logs nicht belegt. Aktuelle Logsperre nicht mit fehlenden SDK-/Secretbeständen verwechseln.

Nach Failure nur Belege gesammelt und dokumentiert. Keine Workflow-/SDK-/PATH-/Versionsänderung, Neuinstallation, lokalen Tests/Builds, App-/APK-/AAB-Erzeugung, Rerun/Retry/zweiter Dispatch, Signierung/Installation, Push/Merge/Tag oder Cloud-/Play-/Geräteeingriff. Ausschließlich der freigegebene bestehende Runner-prepare-Pfad durfte laufen. Sign/verify übersprungen; keine Signierfreigabe oder Keyverfügbarkeit daraus ableiten. B4-Uploadrolle/8A-Playrolle getrennt.

## Erhaltene Grenzen, Sicherung und genau nächster Auftrag

U1 bleibt vorhandene unsigned Referenz aus M,54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`; nicht als U2 etikettiert. Code18/1.5.0-rc.4, Paket/SDK/Rechte, Produkt-/Signierlogik, Gate-/Code17-Freigabemanifeste und bisherige CI-Belege unverändert. Frühere grüne Softwaretests nicht wiederholt und nicht als Gerätebeobachtung ausgegeben.

**T-006/V-014 IN_ARBEIT; E-002–E-005 und Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** Alte Arbeitsbäume,36bisherigeSicherungsmanifeste,U1,Code17 und zurückgestellte Umgebung/835235b erhalten.

Genau nächster separat zu beauftragender Einzelauftrag: **vorhandenen Prepare-Detailfehler aus P2/Versuch1 ausschließlich lesend einholen und zuordnen**. Falls Agenten-Logweg wie bisher nicht erreichbar, bereits angemeldeten Besitzer nur den bestehenden Job132708064401 und genannten Schritt aufklappen lassen und konkrete Fehlermeldung samt unmittelbar relevanten Zeilen bereitstellen lassen. Keine bekannten Besitzer-/Play-/Zertifikats-/Secret-/CI-/Branchangaben erneut fragen, keine Tokens/Passwörter/Schlüssel/Umgebungsdumps. Nicht Run workflow/Re-run/Retry drücken. Danach nur tatsächlichen Fehler gegen unveränderten W2-Code einordnen und kleinste Folgehandlung benennen; noch keine Korrektur/Tests/Neuinstallation.

D3 nur lokal committen und unter `/workspace/anker-t006-code18-prepare-w2-20261115/` sichern, nicht nachpushen. Historischer UI-Wartezustand samt originalem SHA-Verzeichnis als SHA256SUMS_UI_PREPARE_HANDOFF erhalten; UI_PREPARE_HANDOFF_ERLEDIGT.json und RESULT.json bilden Abschluss ab. Vorher-/Nachher-Bundle, Ref-/Quell-/CI-/Run-/Job-/Fehlerbelege, Bestandsaudit, unabhängiger Bare-Restore und finales SHA256SUMS. Exakter D3 und genau ein kopierfertiger Folgeauftrag in RESULT.json beziehungsweise NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
