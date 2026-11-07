# AndroidX-Updateprüfung vom 07.11.2026

Basis ist `main` auf `424e041` (App 1.3.0-rc.2 / Code 9), nicht der historische RC1-Stand des Auftrags. Geändert werden ausschließlich vier Werte in `android/variables.gradle`. `minSdk 26`, `compileSdk/targetSdk 36`, AGP 8.13.0, Kotlin 2.4.21, Gradle 8.14.3, JDK 21 und Capacitor 8.6.0 bleiben erhalten.

## Nachgewiesene Auswahl

Google-Maven-Versionslisten und die veröffentlichten POM-, Gradle- und AAR-Dateien wurden am Prüftag live abgerufen. Bei den Versionslisten wurden Vorabversionen ausdrücklich herausgefiltert: Die Felder `latest`/`release` enthalten bei Activity und WebKit bereits Alpha-Versionen.

| Paket | Gesetzter Ausgangswert | Effektiv vorher, Debug und Release | Neueste stabile Veröffentlichung | Gesetztes und effektiv geprüftes Ziel |
|---|---|---|---|---|
| Activity / Activity-KTX | 1.11.0 | 1.11.0 | 1.13.0 | 1.13.0 |
| AppCompat / Resources | 1.7.1 | **1.8.0** | 1.8.0 | 1.8.0 |
| Core / Core-KTX | 1.17.0 | 1.17.0 | 1.19.1 | **1.18.0**, kompatible stabile Zwischenversion |
| WebKit | 1.14.0 | 1.14.0 | 1.18.0 | 1.18.0 |

AppCompat 1.8.0 wurde schon vorher durch `@capgo/capacitor-health` 8.11.13 angefordert und von Gradle ausgewählt. Der neue Variablenwert macht diese bereits wirksame Auswahl ausdrücklich. Die Health-Androidquellen wurden für diesen Nachweis nicht geändert.

| Veröffentlichtes AAR | minCompileSdk | Mindest-AGP | minSdk im Manifest | Entscheidung |
|---|---:|---|---:|---|
| Activity / Activity-KTX 1.13.0 | 36 | 8.9.1 | 23 | passend |
| AppCompat 1.8.0 | 34 | 8.1.1 | 23 | passend |
| Core / Core-KTX 1.18.0 | 36 | 8.9.1 | 23 | passend |
| WebKit 1.18.0 | 33 | 7.2.0 | 24 | passend |
| Core / Core-KTX 1.19.1 | **37** | **9.1.0** | 23 | separate Plattformmigration |

Alle hier genannten AARs deklarieren SDK-Extension 0. Activity 1.13.0 fordert in seiner POM Core-KTX mindestens 1.18.0 an; ein isoliertes Activity-Update würde damit Core ebenfalls erhöhen. Die expliziten Werte halten diese Kopplung nachvollziehbar. Die Kotlin verwendenden Ziel-POMs fordern Stdlib 2.1.20 an; Gradle wählt mit den vorhandenen Plugins weiterhin **2.4.21**. Eine eigenständige Mindestversion des Kotlin-Gradle-Plugins lässt sich daraus nicht ableiten. Die tatsächliche Java-/Kotlin-Kompilierung von App, Capacitor und Plugins ist deshalb zusätzlich geprüft.

## Gesamter aufgelöster Graph

`dependencyInsight` wurde vor und nach der Änderung für **debugRuntimeClasspath und releaseRuntimeClasspath** ausgeführt. Zusätzlich wurden sämtliche externen aufgelösten Artefakte und Abhängigkeitskanten inventarisiert. Debug und Release wählen dieselben externen Komponenten: vorher 113, danach **115 eindeutige Maven-Komponenten**, darunter **84 eindeutige AAR-Dateien**. Mehrere Gradle-Varianten können dasselbe Artefakt melden; die Rohinventur enthält deshalb 122 Artefaktmeldungen beziehungsweise 91 AAR-Meldungen.

Alle 84 AAR-Manifeste waren lesbar und deklarieren `minSdk <= 26`. Die vorhandenen AAR-Metadaten verlangen maximal **compileSdk 36 und AGP 8.9.1**. **32 ältere AARs enthalten keine `aar-metadata.properties`**; für diese wird keine fehlende Angabe als belegte Mindestanforderung ausgegeben. Ihre Manifeste sowie die Android-Metadaten-, Ressourcen- und Kompilierungsprüfungen sind erfasst. Dazu gehören auch Health Connect `connect-client` 1.1.0 mit `minSdk 26` und dessen Proto-/Protobuf-Komponenten.

Der vollständige Vorher-/Nachhervergleich ergibt neben Activity/KTX, Core/KTX und WebKit genau diese transitiven Änderungen:

- `androidx.annotation:annotation-jvm` 1.8.1 → 1.9.1;
- neu `androidx.navigationevent:navigationevent-android` 1.0.0;
- neu `androidx.compose.runtime:runtime-annotation-android` 1.9.0.

AppCompat und alle anderen externen Komponenten bleiben gleich. Es werden keine neuen Alpha-/Beta-Abhängigkeiten eingeführt. Bereits vorhandene transitive Vorabversionen (`security-crypto` 1.1.0-alpha06, `play-services-identity-credentials` 16.0.0-alpha02 und `odml:image` 1.0.0-beta1) bleiben unverändert; deren Entfernung wäre ein eigener Plugin-/Abhängigkeitsauftrag.

## Ausgeführte Validierung

Die vorbereitete isolierte Buildkopie wurde exklusiv verwendet. Alle eigenen nativen Quellen, Tests und XML-Dateien waren vor der Prüfung bytegleich zu `main`. Ausschließlich `android/variables.gradle` wurde temporär aus dem Arbeitsbranch übernommen; die Originaldatei und die übernommenen Zielwerte sind getrennt gesichert. Die bestehende Init-Datei `isolate-dependency-builds.gradle` lenkte sämtliche Plugin-Buildausgaben aus dem gemeinsamen `node_modules` in den Cache. Es erfolgte kein `cap sync` und kein APK-Build; vorhandene RC1-/RC2-APKs und Updatepakete wurden nicht überschrieben.

```sh
./gradlew --no-daemon --max-workers=2 --console=plain \
  --init-script ../isolate-dependency-builds.gradle \
  :app:dependencyInsight --configuration releaseRuntimeClasspath \
  --dependency androidx --single-path
# Entsprechend separat für debugRuntimeClasspath, vor und nach dem Update.

./gradlew --no-daemon --max-workers=2 --console=plain \
  --init-script ../isolate-dependency-builds.gradle \
  :app:checkDebugAarMetadata :app:checkReleaseAarMetadata \
  :app:compileDebugKotlin :app:compileReleaseKotlin \
  :app:testDebugUnitTest --rerun-tasks
```

Der letzte Befehl lief zusammen mit zwei rein lesenden externen Inventur-Tasks erfolgreich: **369 Tasks tatsächlich ausgeführt, 1 min 7 s**. **87 JUnit-Tests in neun Suiten**, null Fehler, null übersprungen. Beide AAR-Metadatenchecks, beide App-Kotlinvarianten sowie die benötigten Capacitor-/Plugin-Kompilierungen bestanden. Bestehende Deprecation-Warnungen und der Hinweis auf eine erst für Kotlin 2.5 nötige Gradle-Anhebung bleiben sichtbar; diese Änderung hebt Kotlin nicht an.

Lokale Rohbelege liegen unter `/workspace/.cache/anker/updatepruefung/androidx/`: `baseline-{debug,release}-androidx.log`, `updated-{debug,release}-androidx.log`, `*-artifacts.json`, `updated-*-aar-metadata.json`, `resolved-artifact-diff.json`, `updated-android-validation.log`, kopierte JUnit-XMLs unter `junit/` und die Maven-Downloads unter `maven/`. Ein anfänglich fehlgeschlagener Inventur-Helfer ist separat dokumentiert (`artifact-inventory-harness-variant-failure.log`); die externe Artefaktauswahl wurde korrigiert, danach liefen Inventur und sämtliche Prüfungen vollständig durch.

## Separat zurückgestellt und offen

Core 1.19.1 ist veröffentlicht, passt aber nicht zur bestehenden Plattform: Seine tatsächlichen AAR-Metadaten verlangen compileSdk 37 und AGP mindestens 9.1.0. Ein eigener Migrationsauftrag muss SDK 37, AGP 9.1 samt passendem Gradle/JDK-/Kotlin-/Capacitor- und Plugin-Buildvertrag prüfen, anschließend vollständig bauen und am Gerät testen. Aus der Compile-Anforderung folgt kein automatischer Auftrag, targetSdk ebenfalls anzuheben. Diese Migration wird hier nicht durchgeführt.

| Einordnung | Ergebnis |
|---|---|
| vorhanden | SDK-/Buildplattform und Capacitor 8.6.0, AppCompat effektiv 1.8.0 |
| ergänzt | explizite kompatible stabile AndroidX-Auswahl, tatsächliche Debug-/Release-Auflösung und vollständige externe AAR-Inventur |
| bewusst zurückgestellt | Core 1.19.1 mit compileSdk-37-/AGP-9.1-Migration |
| nicht verifiziert | echte Android-Zurück-Navigation, Systemleisten/Edge-to-edge, WebView-/Druckverhalten und Health-Provider auf dem Galaxy; kein neuer APK-/Installations-/Hörbarkeitsnachweis |

Vor dem Ausliefern eines späteren Gesamtbuilds insbesondere Zurück-Navigation, Tastatur/Systemleisten und nativen Druck/PDF prüfen. Bestehende Geräteberichte bleiben an ihren bisherigen Build gebunden; diese Bibliotheksprüfung setzt keine Gerätehäkchen.

## Primärquellen

- Google Maven: [Activity-Versionen](https://dl.google.com/dl/android/maven2/androidx/activity/activity/maven-metadata.xml), [AppCompat-Versionen](https://dl.google.com/dl/android/maven2/androidx/appcompat/appcompat/maven-metadata.xml), [Core-Versionen](https://dl.google.com/dl/android/maven2/androidx/core/core/maven-metadata.xml), [WebKit-Versionen](https://dl.google.com/dl/android/maven2/androidx/webkit/webkit/maven-metadata.xml).
- Tatsächlich heruntergeladene AARs: [Activity 1.13.0](https://dl.google.com/dl/android/maven2/androidx/activity/activity/1.13.0/activity-1.13.0.aar), [AppCompat 1.8.0](https://dl.google.com/dl/android/maven2/androidx/appcompat/appcompat/1.8.0/appcompat-1.8.0.aar), [Core 1.18.0](https://dl.google.com/dl/android/maven2/androidx/core/core/1.18.0/core-1.18.0.aar), [Core 1.19.1](https://dl.google.com/dl/android/maven2/androidx/core/core/1.19.1/core-1.19.1.aar), [WebKit 1.18.0](https://dl.google.com/dl/android/maven2/androidx/webkit/webkit/1.18.0/webkit-1.18.0.aar). Die gleichnamigen `.pom`-/`.module`-Dateien und Core-KTX/Activity-KTX sind ebenfalls gesichert.
- Veröffentlichte Capacitor-8.6.0- und Health-8.11.13-Builddateien aus den im bestehenden Lockfile gesperrten installierten Paketen; tatsächliche Verbraucherauswahl aus Gradle, keine Ableitung aus Versionsvariablen allein.
