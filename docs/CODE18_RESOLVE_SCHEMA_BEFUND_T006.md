# T-006 – Resolve-Detailfehler INVALID_SCHEMA zugeordnet

## Fortschreibung: lokaler Vertragsfehler inzwischen geprüft und korrigiert (15.11.2026)

[Lokale Eingabeschema-Korrektur und Offlinebelege](CODE18_INPUTSCHEMA_KORREKTUR_T006.md): Nach gesondertem Auftrag wurde die optionale Prepare-Repräsentation durch synthetische Offlinefälle rot belegt und mit drei Helperzeilen korrigiert. 35 Protokoll- und fünf gezielte Workflowtests grün; ausschließlich lokal. Die folgende ursprüngliche Ursachenplanung ist historisch. Ihre W-Zeilennummern beziehen sich auf den unveränderten damaligen W-Code. Der tatsächliche P-Payload bleibt unbekannt, kein erneuter Workflowlauf oder U2/S.

Stand **15.11.2026**. Nur Fehlerbeleg, statischer Codeabgleich und Folgemaßnahmenplanung. **Kein Fix, Testlauf oder Workflowneustart.**

## Beleg und Zuordnung

Lokaler sauberer Ausgang H: `f954339e6a11f4387d9ad9a110b108d0530cf1c5`, Branch `entwicklung/anker-neu`, Arbeitsort `/workspace/anker-main-code18-aab`. Neuer lokaler Dokumentationsabschluss I steht exakt im Sicherungsmanifest RESULT.json; nicht übertragen und weder Workflow-/Appquelle noch Run-SHA.

Betroffener vorhandener Lauf **P43637658561/Versuch1**, Job **resolve132577928009**, Workflowquelle **W `741fb7b09f0a442d779aaed192bd223724d3523f`**, angeforderte Appquelle **M `10cc894a27302a5a49b6884c843d2a6b509ab354`**. Entwicklungshead L bleibt der bisher belegte `3f5345dd08032aa6d19328a2c2cee22527150266`; aktuelle Remote-Refs wurden heute nicht neu abgefragt. Keine lokale Beschaffung des fehlenden W-Gitobjekts.

Der Nutzer hat auf die gezielte Bitte zum vorhandenen Job einen Screenshot bereitgestellt. Sichtbar sind Workflow **Code18 AAB – manueller Prüfstand #1**, Job **resolve**, Schritt **Exakte getrennte main-CI für M und W prüfen** und:

```text
Run python3 policy/scripts/android-aab-proof.py resolve
11  AAB-Prüfung abgebrochen: INVALID_SCHEMA
12  Error: Process completed with exit code 1.
```

Der Screenshot zeigt selbst keine vollständige Run-ID/Job-URL/SHA; Zuordnung zu P/Versuch1 über den eindeutigen Gesprächsauftrag und den vorhandenen öffentlichen Jobbeleg. Dies ist ein **Nutzerscreenshot**, kein neu gelesener API-Rohlog. Die Transkription ist in SCREENSHOT_ERROR_EVIDENCE.json gesichert; kein lokales Bildarchiv oder Bildhash behauptet. Empfangener Rohwert von AAB_INPUTS ist nicht sichtbar.

Die öffentliche Datei [scripts/android-aab-proof.py aus exakt W](https://github.com/frnkrm/anker/blob/741fb7b09f0a442d779aaed192bd223724d3523f/scripts/android-aab-proof.py) wurde heute gelesen: alle714angezeigtenQuellzeilen entsprechen dem unveränderten lokalen H/L-Code. Workflowdefinition und Tests ausschließlich gelesen, nicht ausgeführt.

## Eindeutig erreichbare Fehlerstelle

| Stelle im unveränderten W-Code | Befund |
|---|---|
| `main()`, Zeile666 | CLI-Modus resolve ruft zuerst invocation(os.environ) auf, noch vor GitHub(...)-Konstruktion |
| `invocation()`, Zeile110 | AAB_INPUTS wird mit json_load gelesen; JSON-Größe/Syntax/Duplicate-Keys haben eigene andere Fehlercodes |
| `invocation()`, **Zeile111** | `exact(inputs, ('mode', 'source_commit', 'expected_workflow_commit', *SIGN_FIELDS))` |
| `exact()`, Zeilen72–73 | Verlangt **dict und exakt gleiche Schlüsselmenge**, sonst INVALID_SCHEMA |
| Danach, Zeilen112ff./resolve219ff. | Erst danach Quell-/Workflowwerte/Modus/Bindungen und anschließend tatsächliche GitHub-/CI-Abfragen |

Im aufgerufenen resolve-Pfad ist diese invocation-Eingabeschemaprüfung der erreichbare Aufruf von exact, der den gezeigten Fehler erzeugt. Andere exact-Aufrufe gehören zu späteren context-/Paket-/Signierpfaden und werden in diesem CLI-Zweig nicht aufgerufen. **Der Abbruch liegt deshalb vor den GitHub-CI-Abfragen und vor dem Appbuild.** Die anfängliche manuelle Repository-/Ereignis-/Ref-Vorprüfung liegt davor; Quell-/Workflowwerte wurden beim Abbruch noch nicht validiert.

Belastbare Fehlerklasse: Das geparste Eingabe-JSON ist **kein Objekt oder hat eine andere Schlüsselmenge als die verlangten acht Felder**. Der Screenshot belegt nicht, welcher Fall eintrat und welche konkreten Felder fehlten/zusätzlich vorkamen. Keine falsche SHA, rote M-/W-CI, Netzwerkursache oder fehlende Signierschlüssel daraus ableiten. Vorhandene grüne M-/W-main-CI bleiben getrennte ältere Nachweise; der rote P-Lauf hat ihre Abfrage nicht erreicht.

## Eingabevertrag und statisch sichtbare Prüflücke

Die Workflowdefinition setzt AAB_INPUTS aus `toJSON(inputs)`. Drei Felder sind Pflicht: mode,source_commit,expected_workflow_commit. Fünf Signierbindungsfelder sind optional und haben leere Defaults:

- prepare_run_id
- prepare_run_attempt
- unsigned_artifact_id
- expected_unsigned_sha256
- expected_proof_sha256

Der Parser verlangt trotzdem alle acht Schlüssel auch für prepare. Die bestehende Test-Fixture env(mode) fügt alle fünf Signierfelder immer ein und setzt sie für prepare ausdrücklich auf leere Strings. Die gelesenen positiven prepare-Fälle decken damit eine fehlende optionale Schlüsselrepräsentation nicht ab. **Das ist eine konkrete Vertrags-/Abdeckungslücke.** Ob genau diese Auslassung im realen P-Input vorlag, bleibt ohne Rohschlüsselmenge unbestätigt; keine pauschale Behauptung über GitHub-Mobile-/Dispatch-Serialisierung oder Nutzerfehleingaben.

## Kleinste notwendige Folgemaßnahme – noch nicht ausgeführt

Genau nächster separat zu beauftragender Auftrag: **Eingabeschema lokal gezielt untersuchen und nur den kleinsten durch Vertragsabgleich/Offlinefälle belegten Fehler korrigieren.** Die Untersuchung bleibt auf vorhandene Workflow-/Helperbesitzer und synthetische Daten begrenzt; kein neuer Runnerlauf zur Diagnose.

1. Gezielt positive prepare-Formen mit ausgelassenen optionalen Signierfeldern sowie negative Nichtobjekte,fehlende Pflichtfelder,zusätzliche Schlüssel und falsche Typen gegen den unveränderten Parser offline belegen. Reale Laufinputs nicht erfinden. Vor einem Fix den konkret verletzten Vertrag und Rotbeleg benennen; ein hypothetischer Input ist kein aus P ausgelesener Payload.
2. Falls die optionale prepare-Repräsentation die belegte Lücke ist: **nur** die fünf fehlenden optionalen Signierfelder im prepare-Modus auf ihre definierten leeren Defaults normalisieren. Drei Pflichtfelder/Objekttyp/Schlüssel-Allowlist bleiben strikt. Explizites null,falsche Typen,unbekannte Schlüssel oder nichtleere Signierbindungen nicht stillschweigend akzeptieren.
3. sign behält sämtliche ausdrücklich benötigten IDs/Hashes und strenge Werte-/Quell-/Workflow-/Versuchs-/Artefaktbindung. Keine Defaults für fehlende sign-Freigaben,kein unsigned Fallback. Main-/M-/W-/CI-Gates unverändert; kein globales Aufweichen von exact, weil diese Hilfe auch Paket-/Signiermetadaten schützt.
4. Fehlende Diagnostik nötigenfalls nur mit nichtgeheimen Typ-/Feldnamen konkretisieren,keine Inputwerte/Tokens/Umgebungsdumps protokollieren. Falls für einen belegten Fix noch eine konkrete Information fehlt, diese präzise dokumentieren,keinen Fix auf Verdacht.
5. Nur passende neue/erforderliche Offlinefälle mit vorhandenen Werkzeugen; keine Produktvollsuite/Appbuild/Signierprobe. Lokal committen/sichern; Push/Integration/Workflowneustart bleiben spätere eigene Aufträge. Lokaler Fixcommit wäre **nicht** das weiterhin bekannte W und kein korrigierter Runnernachweis.

Heute wurde keiner dieser Tests/Fixes ausgeführt. Der Nutzerauftrag endet ausdrücklich bei Ursachenbeleg und Plan.

## Erhaltene Grenzen und lokaler Abschluss

P bleibt Failure/Versuch1; prepare/sign/verify skipped. **Kein Appcheckout/Build/U2/H2/HP/ArtefaktA/Archivdigest/S.** U1 bleibt vorhandene unsignedReferenz ausM,54.264.632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`;nicht alsU2 umetikettieren. B4Upload-/8APlayrolle und fehlende Signierfreigabe unverändert. AlteCode17-Nachweise und zurückgestellteUmgebung835235b erhalten.

Der frühere direkte Agenten-Logzugriff scheiterte an `Sign in to view logs` beziehungsweise `failed to get job: Get "https://api.github.com/repos/frnkrm/anker/actions/jobs/132577928009": Forbidden`. Die Lücke wurde nicht repariert oder umgangen; der Screenshot liefert jetzt genau den benötigten Fehlercode. Keine erneuten Besitzer-/Play-/CI-/Branch-/Secretfragen,keine Session-/Schlüsselsuche. Keine Tests/Builds,GitHub-/Workflow-/Cloud-/Play-/Geräteaktionen oder Produkt-/Versions-/Freigabemanifeständerung.

Nur neue belegte Dokumentation lokal committen und unter `/workspace/anker-t006-prepare-resolve-detail-20261114/` mit Transkription,Code-/Quellbeleg,Vorher-/Nachher-Bundle,Bestandsschutz,unabhängigem Restore und SHA256SUMS sichern. Bestehende30Sicherungsmanifeste/beidealtenArbeitsbäume/U1/36RoadmapIDs/103historischeGerätezeilen erhalten. I nicht nachpushen.

**T-006/V-014 IN_ARBEIT,E-002–E-005 und weitere Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.** Fehlender Detailfehlercode ist jetzt geklärt; genaue Runtime-Inputform bleibt unbekannt. Genau ein kopierfertiger lokaler Folgeauftrag mit tatsächlichemI in NAECHSTER_EINZELAUFTRAG.txt. Danach stoppen.
