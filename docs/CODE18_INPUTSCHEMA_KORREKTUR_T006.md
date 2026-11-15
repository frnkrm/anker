# T-006 – AAB-Eingabeschema lokal korrigiert

## Fortschreibung: Fix K übertragen und eigene Push-CI nachkontrolliert (15.11.2026)

[Schemafix-Push und neue CI-Nachkontrolle](CODE18_SCHEMAFIX_BRANCH_PUSH_T006.md): Nach gesonderter Freigabe wurde K einmalig auf Entwicklung übertragen; main=W erhalten. Neue CI43664473155/K/push/Entwicklung/Versuch1 erfolgreich mit 1372 Vitest und 379 Browserfällen laut öffentlicher Summary. Die folgende ursprüngliche lokale Fixbeschreibung ist historisch; ihr Rot-/Grünbeleg bleibt unverändert. Kein erneuter lokaler Test/Build, kein prepare/sign oder U2/S. Neuer Abschluss N ausschließlich lokal, kein Nachpush; weiterer Integrationsweg separat.

Stand **15.11.2026**. Ausschließlich gezielte lokale Helperkorrektur und Offlineprüfungen. **Kein Push, Workflowstart, Appbuild oder Signieren.**

## Ausgang und Beleggrenze

Sauberer Ausgang I: `6fa3af1ddca24ce988d3e99d6a6b9ab5030faba2`, Branch `entwicklung/anker-neu`, Arbeitsort `/workspace/anker-main-code18-aab`. Der neue lokale Fix-/Dokumentationsabschluss **K** steht mit vollständiger SHA in RESULT.json der Sicherung; nicht übertragen und nicht neue main-Workflowquelle.

Unveränderte Appquelle **M `10cc894a27302a5a49b6884c843d2a6b509ab354`**, bekannte main-Workflowquelle **W `741fb7b09f0a442d779aaed192bd223724d3523f`**, zuletzt bestätigter Entwicklungshead **L `3f5345dd08032aa6d19328a2c2cee22527150266`**. Heute keine externe Abfrage und keine aktuelle Remoteverfügbarkeit behauptet. W ist weiterhin kein lokales Gitobjekt.

Der [vorherige Fehlerbeleg](CODE18_RESOLVE_SCHEMA_BEFUND_T006.md) bleibt erhalten: Nutzerscreenshot zu **P43637658561/Versuch 1**, Job resolve132577928009, zeigt `AAB-Prüfung abgebrochen: INVALID_SCHEMA`. Im damaligen unveränderten W-Helper liegt die erreichbare Fehlerstelle in invocation/Zeile 111 vor GitHub-/CI-Abfragen. Tatsächlicher JSON-Typ und abweichende Schlüssel des echten Laufs bleiben **unbekannt**. Der lokale Rotbeleg unten beweist keine bestimmte Runtime-Eingabe von P und keine GitHub-Mobile-Ursache.

## Vertragsfehler vor der Korrektur belegt

Die ausschließlich gelesene `.github/workflows/android-aab-pruefstand.yml` definiert mode/source_commit/expected_workflow_commit als Pflichtfelder. Fünf optionale string-Felder haben leere Defaults: prepare_run_id, prepare_run_attempt, unsigned_artifact_id, expected_unsigned_sha256 und expected_proof_sha256. Für prepare besitzen sie keine Signierbindung; nichtleere Angaben sind ausdrücklich verboten. Für sign müssen sämtliche IDs/Hashes ausdrücklich gültig vorliegen.

Der alte Parser verlangte trotzdem immer alle acht Schlüssel. Die bisherigen positiven Fixtures setzten alle optionalen Felder ausdrücklich. Sieben ergänzte Offline-Testmethoden wurden zuerst am unveränderten Helper ausgeführt: **32 INVALID_SCHEMA-Fehler**, nämlich 31 nicht vollständig besetzte Prepare-Kombinationen sowie der Resolve-/Context-Fall mit ausgelassenen optionalen Feldern. Vollständige Prepare-Eingaben wurden akzeptiert, negative Eingaben weiterhin abgelehnt. Der unveränderte Helperhash ist in offline-red.json gebunden. CONTRACT_BEFORE_FIX.md und offline-red.log wurden vor dem Fix gesichert.

Dies belegt den fehlenden Umgang mit ausgelassenen optionalen Prepare-Defaults im lokalen Eingabevertrag. Es ist keine nachträgliche Auslesung des echten P-Payloads und kein neuer Runnernachweis.

## Kleinste Korrektur und erhaltene Gates

Nur drei Zeilen im vorhandenen `scripts/android-aab-proof.py` ergänzt: Ist die geparste Eingabe ein Objekt mit mode=prepare, werden ausschließlich fehlende fünf Signierfelder auf ihre definierten leeren Defaults ergänzt. Vorhandene Schlüssel und Werte überschreiben diese Defaults; sie werden weder entfernt noch konvertiert. Das Eingabe-Environment wird nicht verändert.

Danach läuft dieselbe strenge exact()-Prüfung. Pflichtfelder bleiben erforderlich, unbekannte Schlüssel bleiben verboten; null, Listen/Objekte, Zahlen, boolesche Werte und nichtleere Signierbindungen werden weiterhin abgelehnt. sign erhält keine Defaults. Globale exact()-Funktion, sämtliche Konstanten und Funktionen außerhalb invocation() sind AST-gleich zum Ausgang I. Quell-/Workflowwerte, manuelles main-Ereignis, zwei unabhängige exakte main-Push-CI-Gates, Versuchs-/Kontext-/Artefakt-/Hash-/B4-Verifikation bleiben unverändert. Keine Docs-Ausnahme oder unsigned Erfolgsalternative.

Workflowdefinitionen, CI-Einbindung, Tool-Lock, Java-Verifikator, Build-/Signierlogik, Appcode, Version Code18/1.5.0-rc.4 und Code17-Freigabemanifeste unverändert. Bestehende ci.yml ruft die erweiterte Testdatei bereits auf; keine neue Einbindung nötig.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis und Umfang |
|---|---|
| Neue Fälle vor Fix | 7 Methoden ausgeführt; 32 erwartete INVALID_SCHEMA-Fehler, siehe offline-red.log/json |
| `python3 -B scripts/test-android-aab-proof.py ProtocolTests` nach Fix | **35/35 Methoden grün**, einschließlich 7 neuer Methoden, keine Skips |
| Fünf gezielt ausgewählte vorhandene Workflow-Grenztests | **5/5 grün**, keine Skips; exakte Auswahl/Befehl in offline-green-workflow.json |
| Statischer Scope-/Bestandsabgleich | Nur invocation() geändert; exact()/andere Gates unverändert; git diff --check grün; Workflow-/App-/Versionsdateien erhalten |

Neue Fälle prüfen alle **32** Prepare-Präsenzkombinationen, alle **31** unvollständigen sign-Kombinationen, fehlende Pflichtfelder, Nichtobjekte, unbekannte Schlüssel, falsche Typen/null und nichtleere Bindungen. Weiterhin geprüft: manuelles Repository-/main-/Quell-/Workflowgate, Runversuch, unabhängige M-/W-CI mit Fehlerfällen und Kontextmanipulation auch nach Default-Ergänzung; ungültige Schemaformen scheitern vor Konstruktion des GitHub-Clients.

Die bestehenden ProtocolTests sind relevant, weil invocation() auch von Resolve-/Context-/Übergabe-/Signierprüfungen verwendet wird. Prozess-/API-/Signierfälle verwenden ausschließlich vorhandene künstliche Werte und Attrappen; kein echter Schlüssel und keine Signierprobe. Netzwerkzugriff wird in diesen Tests blockiert. Die fünf Workflowtests lesen den bestehenden YAML-Vertrag, main-/Dispatch-/Secretgrenzen und Python-Syntax mit vorhandenem js-yaml/Node. Keine Installation.

Die unveränderte JavaBoundaryTests-Klasse wurde bewusst nicht erneut ausgeführt; weder Java-Verifikator noch reale JAR-Kryptografie sind betroffen. Keine vollständigen Web-/Browser-/PC-/Android-/App-/Paketprüfungen wiederholt. Frühere 43 Offlinefälle und M-/W-/Branch-CI bleiben historische, getrennte Belege; **40 gezielte Methoden heute sind kein neuer Remote-CI- oder kompletter 50-Fälle-Nachweis**. Echte Gerätebeobachtungen E-002–E-005 bleiben offen.

## Sicherung und nächster zulässiger Schritt

Sicherung unter `/workspace/anker-t006-aab-inputschema-fix-20261115/`: Vorher-/Nachher-Bundle, Skriptvorzustand, Rot-/Grünlogs mit exakten Befehlen, Vertragsbeleg, Code-/Bestandsschutz, SHA256SUMS und unabhängiger Bare-Restore. K nicht nachpushen. Dokumentationsänderungen aktualisieren Status/Roadmap/Testnachweise/Datengrenzen und markieren die vorangegangene Ursachenplanung als historischen Stand.

U1 bleibt unsigned Referenz aus M: 54.264.632 Bytes, SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`; nicht als U2 umetikettiert. Beide alten Arbeitsbäume, alle 31 bisherigen Sicherungsmanifeste, 36 Roadmap-IDs samt Status und 103 Geräteprüfzeilen bleiben erhalten. Alte Umgebung/835235b bleibt zurückgestellt.

**P bleibt fehlgeschlagen; prepare/sign/verify wurden übersprungen. Kein U2/H2/HP/A/S. T-006/V-014 bleiben IN_ARBEIT, E-002–E-005 und Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** B4-Uploadrolle und 8A-Play-Approlle bleiben getrennt. Heute keine externe Abfrage, Secret-/Schlüssel-/Session-/Auth-/Cloud-/Play-/Geräteaktion, Tests mit realen Secrets oder Paket-/Versions-/Freigabemanifeständerung.

Genau nächster separat zu beauftragender Auftrag: K nach frischer Ref-/Quell-/Triggerprüfung einmalig ausschließlich auf den Entwicklungsbranch übertragen und die vorhandene automatische Push-CI nachkontrollieren. Hauptzweig und manueller AAB-Workflow bleiben dabei unangetastet; kein erneuter prepare-/sign-Aufruf. Der vollständige kopierfertige Auftrag mit tatsächlichem K steht in NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
