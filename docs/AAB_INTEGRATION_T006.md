# T-006 – lokaler unsignierter AAB-Integrationsnachweis

Stand 14.11.2026, Europe/Berlin. Saubere verfügbare Ausgangsbasis `f657d2e2dedab71bf0d70c9d88263bab258e9055`, Branch `entwicklung/anker-neu`. Nutzerauftrag erlaubt ausschließlich lokalen UNSIGNIERTEN AAB-Prüfbuild und nötige generierte Websynchronisation. Kein Versions-/Signier-/Installations-/Upload-/Workflow-/Cloudauftrag. Alte Umgebung/835235b zurückgestellt.

## Artefakt und Quelle

| Feld | Tatsächlich geprüft |
|---|---|
| Prüfartefakt | `/workspace/anker-t006-aab-20261114/Anker-T006-UNSIGNIERT.aab` |
| Bytes | 54.264.513 |
| SHA256 | `c928963f83651306b9a65d21a8fbdb0064e1387eb2f36b5c80901db88410fe1c` |
| Appquellcommit für diesen Bau | `f657d2e2dedab71bf0d70c9d88263bab258e9055` |
| Appquellkennung | `552f037d8560dcc3fe59b6ae441a0d77484e0ca40b479379a9cbe9be28b043a0` |
| Paket | `de.frnkrm.anker.mobile` |
| Version unverändert | Code17 / `1.5.0-rc.3`, ausschließlich lokales Prüfartefakt |
| SDK | min26 / target36 / compile36 im von Bundletool ausgelesenen Bundlemanifest |
| Bauweg | `:app:packageReleaseBundle`, AGP8.13.0; validiertes Bundle vor dem Finalisierungstask, kein vollständiger `bundleRelease`-Lauf behauptet |
| Signatur | Keine JAR-Signatur; alle672Dateieinträge gelesen,0Signierer/Zertifikate, keine JAR-Signaturmetadateien |

Die Quellkennung entspricht dem früher geprüften APK-Appstand auf18f6bb2. Seitdem nur Test-/Dokumentationsänderungen außerhalb der Produktinputs; aktueller Quellabgleich und gehashte Assetinventare belegen Wiederverwendbarkeit. Der abschließende Dokumentationscommit verändert Appcode und ausgelieferten Gerätekatalog nicht; seine finale ID steht im lokalen Abschlussmanifest, nicht selbstreferenzierend hier.

## Vorab gesicherter Zustand und Signaturfreiheit

Vor Gradleausführung sauberen Branch/HEAD und Abwesenheit lokaler `keystore.properties` einschließlich Symlink sowie vier Signierumgebungsbindungen ausschließlich auf Vorhandensein geprüft. Versionsumgebung entspricht17/1.5.0-rc.3. Keine Werte privater Signierdateien/Umgebungsbindungen gelesen oder protokolliert. Vollständiges Vorher-Git-Bundle und153generierte Dateien inklusive dist/Android-Webassets/Capacitor-Skripten vorab gesichert. Keine bestehenden AAB-Ausgaben vorgefunden, keine alten Artefakte überschrieben.

Vorhandene Toolchain aktiviert, keine Installation/Versionsänderung: vollständiges JDK21, SDK36, Build-Tools35, Gradle-Wrapper8.14.3/AGP8.13.0. Bundletool1.18.1 liegt bereits als AGP-Abhängigkeit im Cache; über die143bestehenden JARs des aufgelösten Gradle-Buildscript-Classpaths ausgeführt. Keine eigene Console-/GitHub-/Secret-/API-Abfrage und kein Dependencydownload: Dryrun und Bau vollständig offline.

Gewählter Task `packageReleaseBundle` verwendet laut vorhandenem AGP-Bytecode `BuildBundleCommand`, keine Signier-APIs im Paketworker. Separater Task `signReleaseBundle` vom Typ FinalizeBundleTask wurde nicht ausgeführt. Ein externer ausschließlich beobachtender Guard verlangt vor Konfiguration und tatsächlichem Taskgraph fehlende Signierbindungen, unveränderte Versionsumgebung und `release.signingConfig == null`; Signier-/Installations-/Upload-/Debugpakettasks werden verworfen. Trockener Taskplan erfolgreich, tatsächlicher Graph ohne Signier-/APK-Erzeugungstasks. Keine Projekt-/Signierkonfiguration verändert oder Signierung deaktiviert, keine privaten Schlüssel gesucht/gelesen/kopiert.

```text
source /workspace/anker-toolchains/env.sh
node scripts/gradle.mjs :app:packageReleaseBundle --dry-run --offline --no-daemon --console=plain --max-workers=2 --init-script /workspace/anker-t006-aab-20261114/unsigned-guard.gradle
node scripts/gradle.mjs :app:packageReleaseBundle --offline --no-daemon --console=plain --max-workers=2 --init-script /workspace/anker-t006-aab-20261114/unsigned-guard.gradle
```

Diese Befehle dokumentieren den ausgeführten begrenzten Prüfauftrag, keine automatische spätere Ausführungs-/Releasefreigabe. Signierpräsenz und Pfade vor einem neuen Auftrag erneut prüfen; Guard nicht umgehen. Output `android/app/build/intermediates/intermediary_bundle/release/packageReleaseBundle/intermediary-bundle.aab` wurde erst nach erfolgreicher Prüfung bytegleich ins Prüfverzeichnis kopiert. Es ist ein von Bundletool validiertes AAB aus dem Paketierungsschritt, nicht das Ergebnis einer signierenden Finalisierung.

## Neue Prüfungen und erhaltene Nachweise

| Prüfung | Ergebnis und Grenze |
|---|---|
| Gradle | Erfolgreich in1m9s,484Tasks:21ausgeführt/463up-to-date; Release-Bündelressourcen/-Manifest/-Module, Paketierung und Vital-Lint. Keine roten Bau-/Prüfläufe in diesem Auftrag |
| Bundletool | Vorhandene Version1.18.1: `validate` Exit0, Manifest und BundleConfig aus genau diesem AAB ausgelesen. Formatprüfung, keine Google-Play-Annahme |
| ZIP/Modulstruktur | CRC aller Einträge grün, keine doppelten oder unsicheren ZIP-Pfade, BundleConfig.pb/base-Manifest/Ressourcen vorhanden |
| Web-/generierte Assets |71dist-Webdateien und75generierte Android-Assets in base/assets bytegleich; Produktionsquellkennung/viewport-fit=contain vorhanden, keine alten zusätzlichen Webdateien. Nur bekannte zusätzliche Bibliotheksassets, Inventar gespeichert |
| Native Nutzlast |16Bibliotheken und3DEX-Dateien bytegleich mit dem früheren quellenidentischen APK;8ELF64-Bibliotheken PT_LOAD16KB-konform. Keine APK-zipalign-Prüfung als AAB-Nachweis ausgegeben |
| Manifest | Paket/Version/SDK aus Bundlemanifest bestätigt;31Berechtigungen samt maxSdk-Grenzen gleich früherem nativen Release-Manifest. NFC optional, allowBackup=false, Backup-/Datenextraktionsregeln erhalten, nicht debuggable |
| JAR-Signaturfreiheit | Keine META-INF/MANIFEST.MF-/SF-/RSA-/DSA-/EC-Signatureinträge. JDK-JarFile-Verifizierer hat alle672Dateieinträge vollständig gestreamt:0CodeSigners/Certificates. Auditor öffnet ausschließlich das angegebene Bundle, keinen Keystore/Truststore. Kein apksigner-/APK-Nachweis als AAB-JAR-Signaturprüfung verwendet |
| Kein unnötiger Web-Neubau | Aktuelle Quellkennung und alle71Web-/75generierten Assethashes bereits vor Gradle gleich geprüftem APK-Nachweis; deshalb kein npm-Build oder Capsync wiederholt. Getrackte Quellen unverändert |
| Erhaltene Softwareprüfungen |1372TS/378Browser/284Python und ergänzende bisherige Integrationsbelege unverändert.274JUnit/31Suiten aus F-008 bei unveränderten nativen/Test-/Brückenquellen historisch erhalten, keine neue JUnit- oder komplette Web-/Browser-/PC-Suite |

Vorhandene flatDir-/Gradle-Kotlin-Warnungen bleiben im Rohlog erhalten; keine Updates oder Unterdrückung. Keine fehlenden Prüfmittel oder verbleibenden technischen Blocker für den hier belegten lokalen AAB-Paketnachweis. Nicht geprüft sind Googleannahme, erzeugte/ausgelieferte Split-APKs, tatsächliche Geräte-/Updatekompatibilität und ein neuer Remote-CI-/Releaseabschluss.

## Grenzen und nächster eigener Auftrag

**Nur lokale unsignierte AAB-Paketintegration abgeschlossen; T-006/V-014 insgesamt IN_ARBEIT.** Code17 ist bereits als Play-Entwurf gemeldet und bleibt hier unveränderte Prüfversion, nicht erneut freigegebener Uploadcode. Das neue Artefakt ist nicht das historisch auf80f6a692freigegebene AAB; beide Code17-JSON-Freigabemanifeste bytegleich erhalten. Keine neue Upload-/Signier-/Versionsfreigabe, kein Push/Merge/Tag, Workflowstart/-änderung, Signieren/Installieren, Cloud-/Playeingriff oder echte Geräte-/Tag-/PC-Aktion.

Galaxy-Herkunft Google Play und öffentliche Rollen8A-App/B4-Upload sind Nutzerberichte. Private Uploadschlüsselverfügbarkeit, installierte Version/Signatur, exakte Remote-/CI-/Releasebedingungen und reale E-002–E-005-Beobachtungen bleiben offen. Keine direkte Installierbarkeit oder Play-Annahme aus dem AAB behaupten, kein B4-Sideload-Update einer8A-Installation empfehlen, keine Deinstallation/Datenlöschung/Signaturumgehung.

**Genau nächster zulässiger Einzelauftrag:** T-006 – Versionsentscheidung für einen neuen internen Play-Prüfstand vorbereiten, ohne etwas zu ändern. Nur noch fehlenden höchsten bereits belegten Versionscode über alle vorhandenen Artefakte/Tracks anhand Nutzerangaben klären; bekannter einzelner Code17-Entwurf ist kein vollständiges Inventar. Danach konkreten Versions-/Quellvorschlag mit erforderlichen getrennten Freigaben formulieren. Keine eigene Console-/GitHub-/Secretabfrage, keine freie nächste Nummer erraten, keine Projekt-/Versions-/Freigabedatei ändern, keine Schlüssel-/Build-/Signier-/Upload-/Geräteaktion. Bereits bekannte Besitzer-, Herkunfts-, Entwurfs- und Zertifikatsangaben nicht erneut abfragen. Erst ein weiterer ausdrücklicher Auftrag könnte eine echte Versionsänderung und neuen entsprechend geprüften Build erlauben.

## Lokale Sicherung

`/workspace/anker-t006-aab-20261114/`: Prüf-AAB, build-proof-local.json, Bundletool-Manifest/-Config/-Validierung, JAR-/ZIP-/Asset-/DEX-/ELF-/Manifestbelege, Taskgraph/Guard/Bytecodebeleg, öffentliche Tool-/Cachemetadaten, generierte Vorher-/Nachhersnapshots, Vorher-/Nachher-Git-Bundles, unabhängige Wiederherstellung/fsck/Dokumenthashes, RESTORE.md und SHA256SUMS. Toolbinaries/SDK/JDK/Gradlecaches, persönliche Appdaten und private Schlüssel gehören nicht ins Git-Bundle. Nur Cloud-lokal, keine externe Kopie bestätigt. Ältere Sicherungen unverändert erhalten. Nach lokalem Dokumentationsabschluss stoppen.
