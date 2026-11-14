# T-006 – Code18/1.5.0-rc.4 lokal und unsigniert geprüft

Stand 14.11.2026, Europe/Berlin. Saubere verfügbare Ausgangsbasis `0c78c9e814e158e73125556aae2c06fc471feb0d`, Branch `entwicklung/anker-neu`. Der neue ausdrückliche Nutzerauftrag erlaubt ausschließlich die drei benannten Versionsdateien, lokale Quellbindung, frischen Web-/Capacitor-/UNSIGNIERTEN AAB-Prüfbuild und Dokumentationsabschluss. Keine Produktfunktion, Signier-/Upload-/Remote-/Gerätefreigabe. Alte Umgebung/835235b zurückgestellt.

## Exakte Quellen und Artefakt

| Feld | Belegter Stand |
|---|---|
| Versionsquellcommit vor jedem Bau | **`014870f3ee52c0233118d2852ef0719aa9bc602b`** |
| Autorisierte Änderungen | Ausschließlich package.json-Version, beide Root-Versionsfelder im Lockfile und Android-VersionCode/-Name-Defaults |
| Neue Appquellkennung | **`760868d78627f3450f60361e32bd57e1bdc677777784cc84b87834f375e0ef75`** |
| Paket / Version | `de.frnkrm.anker.mobile`, **Code18 / `1.5.0-rc.4`** |
| SDK | min26 / target36 / compile36 unverändert |
| Prüf-AAB | `/workspace/anker-code18-aab-20261114/Anker-Code18-UNSIGNIERT.aab` |
| Bytes | **54.264.513** |
| SHA256 | **`d0d5cfedc21e2201329dccf77177040f85884136e0ee44e5ea6ee600acbe282b`** |
| Signierung | **unsigned**,672Dateieinträge vollständig gelesen,0CodeSigners/Certificates, keine JAR-Signaturdateien |
| Buildtask | `:app:packageReleaseBundle`, keine signierende `signReleaseBundle`-Finalisierung oder APK-Erzeugung |

Versionsquellcommit und späterer Dokumentationsabschluss sind verschieden. Die finale Abschluss-ID steht im lokalen Sicherungsmanifest; Dokumentationsänderungen lassen Produktinputs und ausgelieferten Gerätekatalog unverändert. Keine alte Code17-SHA/Quellkennung als Code18-Quelle ausgegeben und kein altes AAB umbenannt/umetikettiert.

## Sicherung und exakt begrenzte Versionsänderung

Vor jeder Änderung sauberen Branch/HEAD geprüft. Vorher-Git-Bundle,153generierte Bestandsdateien und das bisherige Code17-Rohbundle im wiederverwendeten Gradle-Ausgabepfad gesichert. Der bisherige Ordner `/workspace/anker-t006-aab-20261114/` samt allen48SHA256-Einträgen vorab geprüft; bestehendes Code17-AAB weiterhin SHA256 `c928963f83651306b9a65d21a8fbdb0064e1387eb2f36b5c80901db88410fe1c`. Der generische Gradle-Ausgabepfad darf für den frischen Bau wiederverwendet werden, nachdem sein Code17-Vorzustand separat archiviert ist; die ursprüngliche Code17-Prüfkopie/Guards/Logs bleiben unverändert.

Der erste lokale Commit änderte genau fünf Werte in drei Dateien: package.json-Version, zwei Root-Versionen im Lockfile, Android-Code17→18 und Android-Name1.5.0-rc.3→rc.4. Gesamte Lockfile-Daten nach Ausklammern der beiden Root-Versionen gleich, keine Abhängigkeit/Integritätsangabe/aufgelöste Paketversion geändert. Bestehender source_version-Helfer prüft die tatsächlichen neuen Dateien konsistent als18/rc.4. Signierlogik, Paketkennung, SDK, Rechte, App-/Native-/Test-/Workflowquellen und historische Code17-Freigabemanifeste unverändert. Keine Paketinstallation/-aktualisierung oder Tag-Erzeugung. Diese Versionsquelle war vor Web-/Capacitor-/Gradleausführung lokal committet und sauber.

## Frische Prüfungen und Signaturfreiheit

| Prüfung | Tatsächliches Ergebnis / Grenze |
|---|---|
| Webbuild | Frisch `npm run build`: TypeScript-Build und Vite-Produktionsbau erfolgreich. Neue7608…Quellkennung durch geänderte Versionsinputs, nicht wiederverwendete552f…Code17-Kennung |
| Capacitor | Frische Synchronisation aktueller Webassets,10bestehende Pluginversionen unverändert. Kein getrackter Diff nach Sync; neue generierte Assets separat inventarisiert/gesichert |
| Signierpräsenz | Lokale keystore.properties einschließlich Symlink und vier Signierumgebungsbindungen nur auf Vorhandensein geprüft: nicht vorhanden; Versionsumgebung passt18/rc.4. Keine privaten Schlüssel/Secretwerte gesucht/gelesen/kopiert oder protokolliert |
| Task-/Implementierungsnachweis | Neuer externer beobachtender Guard für18/rc.4 erzwingt null-Release-Signierbindung, wirft Signier-/Upload-/Installations-/APK-Erzeugungsaufgaben. Offline-Dryrun erfolgreich;143AGP-Classpath-JARs hashgleich Code17-Prüfweg, vorhandener PackageBundleWorker-/Bytecodebeleg erhalten. Alte Guarddatei nicht verändert |
| AAB-Bau | Offline1m1s erfolgreich,484Tasks:44ausgeführt/440up-to-date. Nur PackageBundleTask vor signReleaseBundle; keine Signierkonfiguration geändert oder temporär deaktiviert |
| Bundletool | Vorhandene Version1.18.1: validate Exit0, Manifest und lesbare BundleConfig aus dem neuen AAB ausgelesen. Keine Neuinstallation/Tool- oder Dependencydownloads; keine Google-Play-Annahme |
| Manifest | Code18/1.5.0-rc.4 und Paket/SDK bestätigt. Vollständiges normalisiertes Manifest gegenüber Code17 nur in versionCode/versionName verschieden;31Rechte mit maxSdk-Grenzen, Komponenten/Exporte/Wecker-/Reminderwege/Backupregeln/allowBackup=false/NFCoptional/nicht debuggable erhalten |
| Assets |71aktuelle dist-Dateien und75generierte Android-Assets bytegleich im Bundle; neuer Quellfingerabdruck/viewport-fit=contain vorhanden, keine alten Webreste. Neue Hashinventare und Unterschiede zu17 dokumentiert |
| Native Nutzlast |16Bibliotheken und3DEX-Dateien tatsächlich bytegleich Code17-AAB;8ELF64-Bibliotheken PT_LOAD16KBkonform. Unverändertheit nachgeprüft, nicht ungeprüft vorausgesetzt; kein APK-zipalign als AAB-Prüfung ausgegeben |
| ZIP/JAR | ZIP-CRC/Struktur ohne doppelte/unsichere Pfade; BundleConfig.pb/base-Manifest/resources.pb vorhanden. JDK-JarFile-Auditor streamt alle672Dateieinträge, keine Signierer/Zertifikate oder Signaturmetadaten; öffnet nur das neue AAB, keinen Keystore/Truststore. Kein apksigner-/APK-Nachweis als JAR-Signaturprüfung |

Keine roten Bau-/Paketprüfläufe in diesem Auftrag. Vorhandene flatDir-/Gradle-Kotlin-/Vite-Konfigurationswarnungen erhalten. Zusätzlich meldet Vital-Lint nicht initialisierbare SDK-Metriken wegen nicht vorhandenem/nicht beschreibbarem `/home/agent/.android`; Build erfolgreich, keine HOME-/Cloud-/Metrikkonfiguration deswegen geändert. Keine neuen Tools/Abhängigkeiten installiert, keine Signierwerkzeuge ausgeführt.

Gezielte Versions-/Lock-/Metadatenprüfungen und tatsächlicher neuer Paketnachweis statt mechanischem Vollsuite-Neulauf.1372TS-/378Browser-/284Pythonfälle und ergänzende frühere Integrationsbelege behalten ihren bisherigen geprüften Produktbezug; keine neuen solchen Vollergebnisse behauptet.274JUnit/31Suiten aus F-008 historisch erhalten: native Modell-/Test-/Brückenquellen und übrige native Build-/Dependencyinputs gegenüber geprüftem Stand gleich, ausschließlich VersionCode/-Name-Defaults normiert verschieden. Kein frischer JUnit-Lauf oder Gerätesicherheitsbeleg daraus. Produktcode blieb unverändert; neue Versions-/Quell-/Paketdaten sind separat tatsächlich geprüft.

## Freigabegrenzen und nächster eigener Auftrag

**Lokale Version18/rc.4 und unsignierter AAB-Prüfbuild abgeschlossen. T-006/V-014 insgesamt IN_ARBEIT; E-002–E-005/Gesamt-/Signier-/Upload-/Geräte-/Releasefreigaben offen.** Die lokale Versionsbeauftragung ist keine Reservierung oder aktuelle Uploadzulässigkeitsbestätigung von18 bei Google. Kein Upload, Entwurfsaktivieren, Installieren, Signieren, Push/Merge/Tag, Workflowstart/-änderung, Cloud-/Secretänderung oder eigene externe Console-/GitHub-/Secret-/API-Abfrage. Alte Code17-JSON-Manifeste bleiben bytegleich auf80f6a692/ihrem alten Artefakt, nicht auf18 umschreiben.

Play-Herkunft sowie öffentliche App-Signierung8A/UploadB4 sind Nutzerberichte. Privater Uploadzugriff und tatsächlicher Gerätestand nicht verifiziert. Kein B4-Direktupdate einer8A-Installation zusagen, keine Deinstallation/Datenlöschung/Schlüssel-/Versionsumgehung; keine direkte Installierbarkeit oder Play-Annahme aus dem AAB ableiten. Neue exakte Quelle/Artefakthashes ersetzen keine fehlende echte Remote-CI oder nötige Freigabe.

**Genau nächster Einzelauftrag zur separaten ausdrücklichen Beauftragung:** T-006 – GitHub-Voraussetzungen für den lokalen Code18-Stand ausschließlich lesend prüfen. Neue begrenzte Erlaubnis nur für aktuelle Remote-Refs, PR-/CI-/Workflowmetadaten und Namen/Scope vorhandener benötigter Actions-Signiersecrets; niemals Werte, Schlüsseldateien oder Signierprobe. Aktuelle Quell-/Remote-/CI-Gates und mögliche Push-/Play-Workflowauslöser abgleichen, keine historische Remoteverfügbarkeit als aktuell behaupten. Falls Zugriff fehlt/Forbidden: exakten Fehler und kleinste nötige Handlung berichten, keine Cloud-/Auth-/Secretänderung oder Umgehung. Aus vorhandenen Secretnamen weder korrekten Inhalt noch B4-Keybesitz/Signierbarkeit ableiten. Keine Google-Play-Abfrage oder Schreib-/Build-/Signier-/Versions-/Upload-/Geräteaktion. Diese externe Metadatenprüfung ist vom aktuellen Auftrag noch nicht erlaubt und wird jetzt nicht ausgeführt.

## Lokale Sicherung

`/workspace/anker-code18-aab-20261114/`: neues Prüf-AAB/build-proof-local.json, SOURCE_COMMIT.txt, Versionsfeld-/Lock-/Quellbelege, frischer Web-/Cap-/Gradlelog, neuer Guard/Dryrun/Taskgraph, Bundletool-Manifest/-Config/-Validierung, JAR-/ZIP-/Asset-/Native-/DEX-Nachweise, Vorher-/Nachher-Generatarchive, separat archivierter alter Code17-Rohoutput, Altbestand-Integritätsbeleg, Vorher-/Versionsquell-/Nachher-Bundle, unabhängige Wiederherstellung/fsck/Dokumenthashes, RESTORE.md/SHA256SUMS. Keine neue private Datei/Nutzerdatenkopie; Toolbinaries/SDK/JDK/Caches und frühere Code17-Vergleichsordner nicht im Git-Bundle. Frühere Ordner zusätzlich erhalten. Nur Cloud-lokal, keine externe Kopie bestätigt; nach lokalem Dokumentationsabschluss stoppen.
