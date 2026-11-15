# T-006 – P2-SDK-Detailfehler belegt, noch keine Korrektur

Stand 15.11.2026; lesbare Zeiten Europe/Berlin (MEZ). Ausgang D3 `288d9ec3899080f834561d85930b5986dc4b803b` sauber auf `entwicklung/anker-neu` bestätigt. Der neue Abschluss D4 ist ausschließlich lokale Dokumentation; seine exakte SHA steht in RESULT.json der Sicherung `/workspace/anker-t006-p2-sdk-detail-20261115/`.

## Beleg und Zuordnung

Der Nutzer stellte in diesem Chat den aufgeklappten bestehenden [Prepare-Job 132708064401](https://github.com/frnkrm/anker/actions/runs/43679893044/job/132708064401) bereit. Der Screenshot zeigt dieselbe Run-/Job-URL, den SDK-Schritt, die Shell und die konkrete Fehlermeldung. Er ist ein Nutzerbeleg aus der angemeldeten Oberfläche, kein vom Agenten ausgelesenes API-Log. Kein lokaler Bilddateipfad oder Bildhash liegt vor; gesichert wird eine ausdrücklich gekennzeichnete minimale Textübertragung.

| Bindung | Nachweis / Grenze |
|---|---|
| P2 | 43679893044 / workflow_dispatch / main / Versuch 1; Failure nach 30s aus bestehendem Laufnachweis |
| Workflowquelle W2 | `87c83fedf5c1aa52450ee36f650134c442928c28` aus bestehendem Nachweis; im Screenshot auch expected_workflow_commit/context |
| Appquelle M | `10cc894a27302a5a49b6884c843d2a6b509ab354`; unverändert |
| Entwicklung K | `77316d69d637c0445cf5d2f4dada37c23011a70f`, zuletzt bestätigt; heute keine neue Refabfrage |
| Jobs | Resolve grün; prepare rot/17s; sign und verify übersprungen |

Relevanter Screenshot-Ausschnitt des Schritts „Benötigte bestehende Android-SDK-Versionen bereitstellen“:

```text
sdkmanager 'platforms;android-36' 'build-tools;35.0.0'
shell: /usr/bin/bash -e {0}
line 1: sdkmanager: command not found
Error: Process completed with exit code 127.
```

Die `line 1`-Zeile ist der relevante Teil der angezeigten Fehlermeldung nach dem temporären Runner-Skriptpfad. Dieser Befund stammt jetzt aus dem Screenshot, nicht aus dem bloßen Workflow-Quellbefehl oder Exitcode. Der unveränderte lokale Workflow enthält denselben Befehl in Zeilen 112–113; sein Gleichstand zur öffentlichen W2-Datei ist bereits im vorherigen Prepare-Nachweis gesichert. W2 ist weiterhin kein lokales Gitobjekt; nichts gefetcht oder ausgecheckt.

Vorherige Checkouts, setup-node, setup-java und „Gebundene öffentliche Prüfwerkzeuge vorbereiten“ sind im Screenshot grün. Nachfolgende „Ausschließlich M ohne Signierbindung paketieren“ und „Frisches unsigned U2 vollständig prüfen und binden“ sind übersprungen. Keine Paketierung oder erfolgreiche AAB-Prüfung daraus ableiten.

## Genau belegte Ursache und offene Grenze

Die Bash-Shell konnte `sdkmanager` beim Aufruf nicht als Befehl auflösen; das Werkzeug wurde dort nicht gestartet. Damit ist ein Fehler der Werkzeugverfügbarkeit für diesen Aufruf belegt. Ob Commandline-Tools auf dem Runner fehlen oder ein vorhandenes sdkmanager lediglich nicht über PATH erreichbar ist, bleibt offen. Keine Behauptung über konkrete SDK-Dateipfade, installierte Plattformen/Build-Tools, Netzwerkfehler, Javafehler oder falsche Projektversionen. Ein lokaler SDK-Pfad wäre kein Runnerbeleg.

Statischer Abgleich: Vor dem SDK-Aufruf richtet der Prepare-Job Node/JDK und gebundene Java-Prüfwerkzeuge ein; er stellt keine ausdrückliche sdkmanager-Auflösung bereit. `tooling()` im vorhandenen Pythonhelfer verwaltet JAR-Prüfwerkzeuge und javac, keine Android-Commandline-Tools. Der alte APK-Updateworkflow verwendet ebenfalls einen nackten sdkmanager-Aufruf; daraus entsteht weder ein Funktionsnachweis noch ein Auftrag, diesen anderen Pfad umzubauen. Bestehende Workflow-Offlinefälle prüfen unter anderem Trigger, M/W, Secretisolation und Artefaktgrenzen; ein ausführbarer SDK-Auflösungsfall mit künstlicher Runnerumgebung fehlt. Heute nur gelesen, nicht getestet oder korrigiert.

Zusätzlicher begrenzter Screenshot-Beleg: Das dort angezeigte `AAB_INPUTS`-Objekt enthält mode=prepare, source_commit=M und expected_workflow_commit=W2, ohne die fünf optionalen Signierfelder. `AAB_CONTEXT` zeigt prepare und binding=null; Resolve ist grün. Das belegt diese Darstellung für **P2** und ist mit der bestehenden Prepare-Normalisierung vereinbar. Es ist kein vollständiger Raw-Event-/API-/Runnercheckout-Nachweis und erklärt nicht nachträglich den alten P43637658561: Dessen Rohinputform bleibt unbekannt. Keine vollständige Umgebung abgeschrieben oder angefordert.

## Zugriffslücke und kleinste getrennte Folgehandlung

Vor dem Screenshot blieb die öffentliche Jobseite bei „Sign in to view logs“. Der normale CLI-Leseversuch ergab:

```text
failed to get job: Get "https://api.github.com/repos/frnkrm/anker/actions/jobs/132708064401": Forbidden
```

Keine Authreparatur oder Umgehung. Der Screenshot schließt die Lücke für die konkrete SDK-Fehlermeldung; weitergehende Runnerbestände und API-Felder bleiben unbekannt. Die ursprünglichen UI-Wartebelege und ihr SHA-Verzeichnis bleiben als historischer Stand erhalten.

Kleinster nächster separat zu beauftragender Umfang: **ausschließlich lokal die sdkmanager-Auflösung des Prepare-Jobs absichern und gezielte Offline-Regressionen erstellen**. Vorhandenen SDK-/Commandline-Tools-Vertrag statisch prüfen, fehlende PATH-Auflösung mit künstlichen ausführbaren Werkzeugen reproduzieren und nur den SDK-Vorbereitungsschritt samt nötigem kleinen Helfer/Offlinefällen ändern. Ein vorhanden konfiguriertes, ausführbares Werkzeug eindeutig auflösen; bei fehlenden oder widersprüchlichen Voraussetzungen mit gezieltem Fehler abbrechen. Keine angenommenen Runnerbestände, ungebundene Downloads oder Neuinstallationen. Ein tatsächlich fehlendes SDK bleibt dann ein separat zu entscheidender Blocker. android-36/build-tools35.0.0, M, sign/verify, Inputs, Quellen-/CI-/Artefaktgates und übrige Workflows erhalten. Dieser Plan führt keine Korrektur oder Tests aus und gibt keinen Workflowstart frei.

## Unveränderte Abnahmen und lokale Sicherung

Heute keine Tests/Builds/Paketprüfungen/SDK- oder PATH-Einrichtung, Workflowänderung/-start/-retry, Signierung, Installation, Übertragung, Cloud-/Play-/Geräteaktion. Alte Arbeitsbäume, Sicherungen, Code17-Manifeste und zurückgestellte Umgebung/835235b erhalten. Bestehende unabhängige M-main-CI43601398931 und W2-main-CI43676620317 bleiben historische grüne Belege, kein Neulauf und kein Prepare-Erfolg.

U1 unverändert: 54.264.632 Bytes, SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`. **Kein U2/H2/HP/A/S**, keine neue Signier-/Uploadfreigabe; B4-Uploadrolle und 8A-Playrolle getrennt. T-006/V-014 bleiben IN_ARBEIT, E-002–E-005 sowie Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.

Nur sieben Dokumentationsdateien ändern. Sicherung enthält Vorher-/Nachher-Git-Bundle, minimale Screenshot-Textübertragung, Zuordnung, Dokumentationskopien, Bestands-/Hashprüfung, unabhängigen Bare-Restore, SHA256-Verzeichnis und genau einen kopierfertigen Folgeauftrag. Keinen lokalen Dokumentationsnachfolger als W2/M/P2 ausgeben; keine aktuelle Remoteverfügbarkeit neu behaupten. Nach lokalem Abschluss stoppen.
