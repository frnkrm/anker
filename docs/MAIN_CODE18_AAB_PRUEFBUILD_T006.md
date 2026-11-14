# T-006 – korrigierter unsignierter Code18-AAB-Prüfbuild aus main M

Stand **14.11.2026, Europe/Berlin**. Ausschließlich lokaler unsignierter Prüfbuild nach eigener begrenzter Nutzerfreigabe. **Keine Signier-, Upload-, Installations- oder Gesamtreleasefreigabe.** Alte ursprüngliche Umgebung/835235b zurückgestellt.

## Quelle, isolierter Arbeitsort und Artefakt

| Feld | Tatsächlich belegt |
|---|---|
| Exakter Buildquellcommit M | **`10cc894a27302a5a49b6884c843d2a6b509ab354`** |
| Geprüfte main-CI | [43601398931](https://github.com/frnkrm/anker/actions/runs/43601398931),ci.yml,push/main,Success,379Browser/1372Vitest,vor Clone frisch bestätigt |
| Arbeitsort | **`/workspace/anker-main-code18-aab`** |
| Lokaler Branch | `entwicklung/anker-neu`, vor Bau HEAD=M und sauber |
| Generierter Webfingerabdruck | **`e9c1249900f449001be6dfb80674a5fe9b2b27af8d2cabf195dba9b2ab654b99`** |
| Neues Prüfartefakt | `/workspace/anker-main-code18-aab-pruefung-20261114/Anker-Code18-main-10cc894-UNSIGNIERT.aab` |
| Größe / SHA256 | **54264632Bytes / `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`** |
| Paket / Version / SDK | `de.frnkrm.anker.mobile`,Code18/1.5.0-rc.4,min26/target36/compile36 |
| Bauweg | `:app:packageReleaseBundle`, keine signierende Finalisierung oder APK-Erzeugung |
| Ergebnis | **unsigned**,672Dateieinträge vollständig gelesen,0CodeSigners/Certificates/Signaturdateien |

Der spätere lokale Dokumentationsabschluss ist eine eigene SHA im Sicherungsmanifest RESULT.json und **nicht** die Buildquelle. Kein neuer Versionscommit nötig: M enthält bereits die unveränderte Version18/rc.4. Neues AAB enthält den NFC-Routereintragsfix; historisches AAB014870f3/7608…enthält ihn nicht und bleibt hier **nicht wiederhergestellt**. Keine alten Artefakte/Guards/Code17-Manifeste umetikettiert oder ersetzt.

Vorheriger Dokumentationsarbeitsbaum `/workspace/anker-main-integration-code18` bleibt unverändert auf717559abeaae813cd166c1e2fe69b7c308d48e5f, altes `/workspace/anker` auf4f3179c unverändert. Ungepushte7d-/f1-Unterlagen nicht rekonstruiert.

## Tatsächliche Bereitstellung und Werkzeuge

Frische Refs14.11.2026um14:03:23UTC /15:03:23Berlin: main=M,Entwicklung=C2c3a290. Vorhandene grüne M-CI über öffentliche HTMLsummary/fullCommitlink erneut lesend bestätigt, keine CI gestartet. Genau **ein** Clone mit `--single-branch --no-tags --branch main` in das vorher freie neue Verzeichnis; HEAD=M geprüft. Nur dort lokalen Entwicklungsbranch von M angelegt. M-tree entspricht C-tree `4d4b206d882ed6348ed480861b67f1f5a97a5eb7`. Quellbundle source-M.bundle erstellt/geprüft. Keine bestehenden Arbeitsbäume gefetcht/umgestellt, kein Push/Merge/Tag.

Bestehende Toolchain aus `/workspace/anker-toolchains/env.sh`: JDK/javac21.0.13,SDKandroid-36,Build-Tools35.0.0,Wrapper8.14.3,AGP8.13.0,Kotlinplugin2.4.21,Node24.22.1,Bundletool1.18.1. **Keine Werkzeuge neu installiert oder aktualisiert.** Lock-Abhängigkeitsgraph zum vorhandenen Nodebestand bis auf Rootversionen gleich; vorhandene398MBNodeabhängigkeiten unabhängig in den neuen Arbeitsbaum kopiert, keine npm-Installation. Keine Symlink-Buildausgaben in alten Arbeitsbäumen.

## Frische Webassets und Signaturfreiheit

Vor Änderungen generierten Vorzustand archiviert: im frischen Clone2vorhandene Generator-Konfigurationsdateien, noch keine Webassets/AAB-Ausgabe. Erster Webbuild/Capacitor-Sync erfolgreich; Sync erzeugt erstmals die ignorierte `res/xml/config.xml`, die selbst in den bestehenden Fingerabdruck eingeht. Nachgewiesene Zwischenkennung2f6e07…ohne diese Datei war deshalb noch nicht der endgültige Inputstand. Ersten Output/Logs erhalten, **notwendigen zweiten Webbuild/Sync** ausgeführt. Danach stabile e9c124…Kennung,71dist-/75generierte Android-Assets bytegleich. Keine getrackte Produkt-/Test-/Versions-/Konfigurationsänderung.153generierte Nachzustandsdateien separat archiviert.

Signierdatei `android/keystore.properties` einschließlich Symlink sowie vier tatsächliche Signierumgebungsbindungen ausschließlich auf Vorhandensein geprüft: fehlen; Versionsumgebung passt18/rc.4. Kein privater Schlüssel/Secretwert gelesen, gesucht oder protokolliert. Externer beobachtender Guard verändert **keine** Signierkonfiguration: prüft vor Projektkonfiguration Präsenz, vor Ausführung `release.signingConfig==null`, exakte Quelle/Paketversion und angeforderte Aufgabe, verwirft Signier-/Finalisierungs-/Installations-/Upload-/Debug-/APK-Aufgaben.

Zwei anfängliche Dryruns wurden ausschließlich durch zu breite Namensklassifikation dieses neuen Guards gestoppt: regulärer `stripReleaseDebugSymbols` und lokale `prepareLintJarForPublish`. Beides sind keine Debug-APK-/Publikationsaufgaben; gezielt korrigiert, ursprüngliche Logs erhalten. Endgültiger Dryrun grün, **577Graphaufgaben**, tatsächlicher Graph identisch. PackageBundleTask/BundleToolWorkAction anhand vorhandenen AGP-Bytecodes mit BuildBundleCommand geprüft; keine Signier-API im Paketworker.143Buildscript-Classpath-JARs vor/nach Bau hashgleich. Kein `signReleaseBundle`, kein `assembleDebug`/automatisch signiertes Debug-APK.

## Cachelücken und tatsächlicher erfolgreicher Bau

Die vorhandenen Werkzeuge waren vollständig, der Cache für unverändert gebundene Bibliotheken war teilweise unvollständig. Drei Offlineversuche scheiterten vor Paketerzeugung:

1. `:capacitor-android:generateReleaseLintModel`: `core-splashscreen-1.0.1.aar` und `concurrent-futures-1.1.0.jar`, jeweils „No cached version available for offline mode“.
2. Dieselben zwei Meldungen nach direkter Artefaktauflösung: Dateien vorhanden und offizielle Google-Maven-SHA1 gleich, aber Variantencachezuordnung noch fehlend. Gezielte Auflösung über den bestehenden releaseRuntimeClasspath anschließend erfolgreich.
3. Cordova-releaseCompileClasspath meldet weitere fehlende bestehende Transitivabhängigkeiten, darunter annotation-experimental1.4.0 und kotlinx-coroutines-core1.6.4. Exakte Fehlermeldungen/Rohlogs erhalten.

Danach **normalen Gradle-Bau mit Auflösung der bereits deklarierten Projektabhängigkeiten** ausgeführt. Keine neuen Abhängigkeiten/Versionen ins Projekt aufgenommen, kein Paket-/Plugin-/Wrapper-/SDK-/JDKupdate, keine neue Berechtigung. Finaler erfolgreicher Build war **nicht offline**; öffentliche Google-Maven-/Maven-Central-Bibliotheksauflösung ist vom fehlgeschlagenen Offlineweg getrennt dokumentiert. Die zwei gezielt nachgeladenen Dateien haben offizielle SHA1 und lokale SHA256/URLs im Nachweis. Keine Appnutzdaten/Secrets/Google-Play-Anfrage übertragen.

Finaler Paketbuild **BUILD SUCCESSFUL in51s**,484actionableTasks:180ausgeführt/304up-to-date. Vorhandene Warnungen zu flatDir/Kotlin-Gradle-Kompatibilität/SDK-XML-Metadaten, unveränderter Kotlinquelle und ungestrippten Drittbibliotheken nicht durch Updates oder Unterdrückung beseitigt. Alle Versuche/Cachebelege/Taskgraphen erhalten; keine Logik-/Browser-/PC-/JUnit-Vollsuite mechanisch wiederholt.

## Prüfung des neuen AAB

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Bundletool1.18.1 | validate erfolgreich; Manifest und BundleConfig aus genau neuem AAB ausgelesen |
| Quellenbindung | HEAD vor/nach Bau sauber=M; NFC-Fix Teil des Quellbaums; Paketversion per bestehendem source_version-Helfer bestätigt; vorhandener ci_proof-Helfer für dokumentierten M/push/main-Beleg genutzt, kein erfundenes API-JSON |
| Web-/Androidassets |71aktuelle Webdateien und75generierte Assets bytegleich in base/assets,keine alten zusätzlichen öffentlichen Webreste,e9c124…Kennung und viewport-fit=contain vorhanden |
| ZIP/JAR | CRC/Struktur/Moduldateien gültig,keine doppelten/unsicheren Pfade;672Dateieinträge vollständig gelesen,0Signierer/Zertifikate/Signaturmetadaten. Auditor öffnet ausschließlich AAB,keinen Keystore/Truststore |
| Manifest | Paket/Code18/rc.4/SDK26/36/36,31Berechtigungen,NFC optional,allowBackup=false,nicht debuggable. Vollständiger semantischer Vergleich mit tatsächlich erzeugtem nativen Paketmanifest grün |
| Manifestnormalisierung | Bundletool rendert SDK-Enums/Flags numerisch und ergänzt vier Compiler-/Plattformattribute. Nur diese Darstellungsunterschiede anhand installierter offizieller SDK36-attrs_manifest.xml normalisiert, Compiler-SDK separat geprüft. Keine Berechtigung/Komponente ignoriert; ursprünglicher rein textueller Vergleichsfehler erhalten |
| Native Nutzlast |16Bibliotheken/3DEX gehasht;8ELF64-Dateien haben16KB-konforme PT_LOAD-Segmente. Kein APK-zipalign als AAB-Nachweis verwendet; keine ungeprüfte Bytegleichheit zu hier fehlendem altem APK/AAB behauptet |
| Artefaktgrenze | Kein APK erzeugt,keine Signierung,Installation,Split-APK-/Play-Annahme-/Geräteprüfung |

Historische274JUnit ausF-008 bei unveränderten relevanten Native-/Brücken-/Testinputs erhalten: Vergleich zu5668aec auf main/test,TS-Brücke,SDK-/Wrapper-/Plugin-/Capacitorvorgaben belegt; Versionsdefaults bereits separat18/rc.4. Main-CI1372Vitest/379Browser bleibt eigener Remote-Nachweis; heute nur erforderlicher Build/Metadaten-/Paketnachweis, keine neue Hardwarebeobachtung.

## Grenzen, Sicherung und nächster Einzelauftrag

**Lokaler korrigierter UNSIGNIERTER M-Paketnachweis abgeschlossen. T-006/V-014 IN_ARBEIT.** E-002Galaxy-Wecker,E-003Windowswirkungen,E-004Kalender,E-005NFC bleiben **OFFEN**. Geräte-/Signier-/Upload-/Gesamtfreigaben getrennt offen. Kein Playcode18 reserviert/Uploadzulässigkeit bestätigt. Nutzerberichte zu Play-App-Signierer8A und UploadB4 erhalten; keine private Schlüsselverfügbarkeit/Signierbarkeit daraus. Kein B4-Direktupdate einer8A-Installation oder Datenlöschung als Umweg.

Aktueller Nutzerauftrag hat Vorrang vor historischem automatischem Playauftrag in AGENTS. Kein Push/Merge/Tag/Workflowstart/-änderung,Cloud-/Auth-/Secret-/Versions-/Freigabemanifestwechsel,Signieren/Installieren,echte Geräte-/NFC-/PC-Aktion oder Play-/Consoleabfrage. Nur zulässige Dokumentation lokal im neuen Repository committen; Generatoren erzeugten keinen getrackten Diff.

Sicherung `/workspace/anker-main-code18-aab-pruefung-20261114/`: frisches AAB/build-proof-local.json,Quell-M-/Nachher-Gitbundles,Vorher-/Zwischen-/Nachher-Generatorarchive,Logs aller Versuche,Guard/Taskgraph-/Classpath-/Checksum-/Manifest-/ZIP-/JAR-/ELF-/Assetbelege,Altbestandsintegrität,unabhängige Bundlewiederherstellung,RESTORE.md/SHA256SUMS. Anders als das vorherige Dokumentationsbundle enthält dieses Quellbundle M tatsächlich. Toolbinaries/398MBNodebestand/SDK-/Gradlecaches sind nicht Teil des Bundles; keine privaten Nutzdaten/Schlüssel/Secrets enthalten. Nur Cloud-lokal,keine neue externe Kopie bestätigt.

**Genau nächster separat zu beauftragender Einzelauftrag:** Einen konkreten signierten Code18-AAB-Prüfweg für diese Quelle/dieses Artefakt ausschließlich lesend planen. Bestehender android-update-Workflow signiert APKs,Playworkflow/alte Freigabemanifeste binden weiterCode17; nichts umdeuten. AAB-/B4-/main-CI-/Metadaten-/Signier-/Uploadgrenzen und minimal nötige getrennte Freigaben prüfen,neue prüfbare Vorlage erstellen. Keine Schlüssel-/Secretnachfrage/-suche,keine bekannte Besitzer-/Play-/Zertifikatsfrage wiederholen,keine externe Abfrage oder eigentliche Signierung/Workflowänderung. Danach stoppen.
