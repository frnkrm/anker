# T-006 – Prepare-sdkmanager-Auflösung lokal abgesichert

Stand 15.11.2026, Europe/Berlin. Sauberer Ausgang D4 `d565f8473389acae937ac0281950369207355428` auf `entwicklung/anker-neu` bestätigt und vor Änderungen im Bundle gesichert. Der neue lokale Fix-/Übergabehead J steht exakt in RESULT.json unter `/workspace/anker-t006-prepare-sdk-fix-20261115/`. Heute keine externe Abfrage; aktuelle Remoteverfügbarkeit nicht bestätigt.

## Befund, Vertrag und Rotbeleg

Der [P2-Nutzerbeleg](P2_SDK_DETAILFEHLER_T006.md) zeigt zu 43679893044/Versuch1/Prepare132708064401 `sdkmanager: command not found` und Exit127. SDK-Bestand beziehungsweise konkrete PATH-Ursache des Runners unbekannt. P2 scheiterte vor Paketierung; kein U2/H2/HP/A/S. Sein sichtbares Prepare-Inputobjekt hat drei Pflichtfelder, keine optionalen Signierfelder; Rohinput des älteren P43637658561 bleibt unbekannt.

Der bestehende lokale Prepare-Workflow ruft das Werkzeug bisher ausschließlich über PATH auf. Der Projektvertrag verwendet ANDROID_HOME, weitere vorhandene Dokumentation benennt auch ANDROID_SDK_ROOT. Die vorhandenen Node-/Java-/JAR-Schritte richten keinen sdkmanager-Suchpfad ein. Das beweist keine Abwesenheit der Runnerdateien. Keine externen Installationsmetadaten oder tatsächlichen SDK-Bestände neu abgefragt.

Vor Workflowänderung gezielter neuer Offlinefall `PrepareSDKTests.test_configured_sdk_without_path`: künstliches ausführbares Werkzeug unter temporärem SDK/cmdline-tools/latest/bin, ANDROID_HOME gesetzt, isolierter PATH enthält nur den benötigten Pythoninterpreter. Erwartet wird genau ein Werkzeugaufruf mit den beiden bestehenden Paketargumenten. Tatsächlich am unveränderten Workflow: **127 != 0, /bin/bash: line 1: sdkmanager: command not found**. Rotbeleg `red-before-fix.log/json`; keine echte SDK-Ausführung. Dies reproduziert die belegte Auflösungslücke, beweist aber nicht diese konkrete SDK-Anordnung auf P2.

## Kleinste lokale Änderung

Nur `run` des bestehenden Prepare-Schritts „Benötigte bestehende Android-SDK-Versionen bereitstellen“ geändert; kein neuer Helper oder Checkout nötig. Der eingebettete Pythonblock:

- Prüft gesetzte SDK-Wurzeln auf absolute bestehende Verzeichnisse; kanonisch gleiche Wurzeln einschließlich Alias sind erlaubt, unterschiedliche werden vor jeder Werkzeugausführung abgelehnt.
- Nutzt ein ausführbares sdkmanager aus dem vorhandenen PATH. Ist eine SDK-Wurzel konfiguriert, muss das aufgelöste Werkzeug unter dieser liegen; widersprüchliche PATH-/SDK-Bindung wird nicht still ersetzt.
- Ohne PATH-Fund wird ausschließlich der feste Kandidat `cmdline-tools/latest/bin/sdkmanager` unter der konfigurierten SDK-Wurzel geprüft. Keine globale Suche, Versionsordner-Auswahl, Downloads, Installation oder Annahme über dessen tatsächliches Vorhandensein. Fehlt dieser Kandidat, wird klar abgebrochen; andere Versionsordner funktionieren nur, wenn ihr Werkzeug bereits in PATH liegt.
- Prüft reguläre ausführbare Datei und kanonischen Zielpfad. Keine Verzeichnisse als Werkzeuge oder Symlinks aus der SDK-Wurzel heraus. Argumente als Prozessliste ohne Shellauswertung: unverändert `platforms;android-36`, `build-tools;35.0.0`.
- Ruft das Werkzeug genau einmal auf. Exitcode/stderr bleiben erhalten; kein Retry/Erfolgsfallback. Nicht startbares Werkzeug führt zu begrenzter Diagnose. Konfigurationsfehler nennen nur SDK_ROOT_INVALID, SDK_ROOT_CONFLICT, SDK_TOOL_ROOT_CONFLICT, SDKMANAGER_UNAVAILABLE beziehungsweise SDKMANAGER_EXECUTION_FAILED und einen gezielten Einrichtungshinweis, keine Input-/Token-/Umgebungsdumps.

Keine SDK-/PATH-Variable geschrieben, weder im Workflow noch in der Arbeitsumgebung. Der künftig separat gestartete Prepare-Schritt würde wie zuvor die zwei SDK-Pakete bereitstellen; heute liefen nur künstliche Werkzeugprozesse. Kein Quell-/CI-/Inputgate geändert. Keine Änderung an resolve/sign/verify, Triggern, Permissions, Timeout, Sparse-Checkout, App-M, Null-Signierguard, Toollock, CI-Einbindung oder bestehenden APK-/Release-/Playpfaden. Testklasse in der vorhandenen Workflow-Testdatei wird vom unveränderten bestehenden CI-Befehl automatisch mit aufgenommen; ci.yml unverändert.

## Gezielte Offlineprüfung

| Lauf | Tatsächliches Ergebnis |
|---|---|
| Rotbeleg vor Workflowfix | Ein gezielter Fall erwartungsgemäß rot/Exit127 |
| `python3 scripts/test-android-aab-workflow.py PrepareSDKTests WorkflowTests` | 30/30 grün: zunächst 16 SDK-Fälle plus alle 14 bestehenden Workflowprüfungen |
| Danach nur neuer zusätzlicher Fall `PrepareSDKTests.test_invalid_tool_interpreter_aborts_with_limited_diagnostic` | 1/1 grün; Workflowcode seit dem ersten grünen Lauf unverändert |
| Sieben ausgewählte ProtocolTests | 7/7 grün; genaue Methoden/Argumente in protocol-gates-offline.json |

Damit **17 SDK-/14 Workflow-/7 Protokollfälle, insgesamt 38 verschiedene Fälle grün**, ohne Skips. Der zusätzliche Fall prüft nicht startbaren Interpreter; keine mechanische Wiederholung der schon grünen 30 Fälle. SDK-Fälle verwenden nur TemporaryDirectory, einen absolut gebundenen Pythoninterpreter, isolierte PATH-/SDK-Umgebung und selbst geschriebene Prozessattrappen. Kein geerbtes SDK, keine Actions-Ausgabedateien oder echten sdkmanager-Prozesse.

Abgedeckt sind PATH-Werkzeug, ANDROID_HOME-/ANDROID_SDK_ROOT-Auflösung ohne PATH, kanonische Wurzelaliase, widersprüchliche Wurzeln/PATH-Ziele, fehlende/nicht ausführbare/Verzeichnis-Werkzeuge, ungültige Wurzeln, leere Variablen, Leerzeichen/Shellsonderzeichen, Symlinks außerhalb der Wurzel, stderr/Exit23 und Startfehler. Bestehende Workflowfälle prüfen Trigger, Quellen, getrennte Modi, Secretisolation, Artefakte und Guardbindung. Protokollauswahl prüft manuelles main, unabhängige M-/W-CI, falsche Repository-/Quellenbindung, keine Docs-Ausnahme, Kontext-/Versuchs-/Artefaktgrenzen und fehlende Secretwerte; künstliche API-/Prozesswerte, kein Schlüsselzugriff.

Keine Produktvollsuite, Web-/Android-/APK-/AAB-Builds, echte Signierung oder Java-Boundary-Neuprüfung. Bereits gültige Softwarebelege bleiben unverändert erhalten. Offlinegrün ist kein neuer Runner-/CI-/Prepare-/Krypto- oder Gerätebeleg.

## Verbleibende Grenzen und nächster Auftrag

M `10cc894a27302a5a49b6884c843d2a6b509ab354` bleibt Appquelle. W2 `87c83fedf5c1aa52450ee36f650134c442928c28` ist bekannte main-Workflowquelle, nicht dieser lokale J-Fix und weiter kein lokales Gitobjekt. K `77316d69d637c0445cf5d2f4dada37c23011a70f` ist zuletzt bestätigter Entwicklungshead, heute nicht neu abgefragt. M-main-CI43601398931 und W2-main-CI43676620317 bleiben getrennte bestehende Nachweise; J benötigt nach gesonderter Übertragung eigene Branch-CI und später eine regulär integrierte neue Workflowquelle mit eigener exakter push/main/ci.yml. Keine Docs-Ausnahme oder Prepare-Freigabe aus Offlinegrün.

Falls der echte Runner weder ein passendes PATH-Werkzeug noch den festen vorhandenen SDK-Kandidaten besitzt, bleibt ein technischer Blocker. Kleinste dann nötige separate Handlung: die fehlenden offiziellen Android-Commandline-Tools beziehungsweise den tatsächlich vorhandenen SDK-Werkzeugpfad anhand konkreter nichtgeheimer Diagnose klären und ausschließlich die nötige Prepare-Einrichtung separat freigeben. Keine Version/Downloadquelle erraten und jetzt nichts installieren. Ein anderer Workflow oder die lokale Toolchain ist kein Runnernachweis.

U1 unverändert, 54.264.632 Bytes, SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`; U2/H2/HP/A/S fehlen. B4-Upload-/8A-Playrollen getrennt. Alte Arbeitsbäume, alle 38 vorherigen Sicherungsmanifeste, Code17-Nachweise und zurückgestellte Umgebung/835235b erhalten. T-006/V-014 IN_ARBEIT, E-002–E-005 sowie Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.

Genau nächster zulässiger, **separat zu beauftragender** Einzelauftrag: diesen lokalen SDK-Fix einmalig ausschließlich nach Entwicklung übertragen und ausgelöste bestehende CI nachkontrollieren, erst nach frischer Ref-/Quell-/Triggerprüfung. Keine main-Integration oder prepare/sign-Freigabe damit verbinden. Heute kein Push, PR, Merge, Workflowstart/-retry oder Cloud-/Play-/Geräteeingriff.

Lokale Sicherung enthält Vorher-/Nachher-Bundle, Rot-/Grünlogs, gezielten Differenz-/Bestandsaudit, Dokumentationskopien, unabhängigen Bare-Restore, SHA256-Verzeichnis und genau einen kopierfertigen nächsten Auftrag. Exakter J-Abschluss in RESULT.json; nicht als W2/P2 oder U2 etikettieren. Danach stoppen.
