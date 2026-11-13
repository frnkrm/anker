# T-006 – Voraussetzungen für einen signierten Geräteprüfbuild

## Nutzerantwort und Zuordnung vom 14.11.2026

Auf sauberer verfügbarer Basis `563e3dad9d763b278f1e1e4bbdf20a5389ed0cad`, Branch `entwicklung/anker-neu`, hat der Nutzer auf die zwei nichtgeheimen Rückfragen geantwortet. Seine Angaben werden als **Nutzerbericht** erfasst, nicht als unabhängiger Console-, Geräte- oder Schlüsselbeleg:

> ich bin der besitzer und es läuft auf meiner play console als interner test. es gibt keine wirkliche app version, da die app noch nicht draußen ist. auf github unter frnkrm/anker sollte es einen schlüssel geben

| Thema | Jetzt vorhandene Angabe | Weiterhin unbelegt |
|---|---|---|
| Besitzer | Nutzer bezeichnet sich selbst als Besitzer; nicht erneut nach seiner Besitzeraussage fragen | Erreichbarkeit und kryptografische Eignung konkreten privaten Signiermaterials folgen daraus nicht |
| Verteilung | Laut Nutzer läuft Anker in seiner Play Console als interner Test; öffentliche Veröffentlichung wird nicht behauptet | Tatsächliche aktuelle Console-Einstellungen, Testrelease und Teilnehmerinstallation wurden nicht abgerufen/geprüft |
| Version | Nutzer versteht „Version“ als öffentliche Veröffentlichung | Auch interne Testartefakte haben einen Versionscode. Aktueller Testversionscode/-name ist unbekannt, nicht null oder nicht vorhanden |
| Zielinstallation | Keine zusätzliche Geräteangabe genannt | Tatsächlich auf dem Zielgerät installierte Paketkennung, Version/Code, Herkunft und Codestand unbekannt; interner Test in der Console beweist keine Installation vom Play-Kanal |
| Signierschlüssel bei GitHub | Nutzer vermutet einen Schlüssel unter `frnkrm/anker` | Keine Bestätigung einer existierenden, vollständigen oder nutzbaren Schlüsselsicherung/Actions-Secret-Konfiguration; nichts gesucht, geöffnet oder übertragen |
| Öffentliches Zertifikat | Keine neue Zertifikatsangabe vom Nutzer | Bisherige öffentliche B4-Belege bleiben historisch. Aktueller Play-App-Signierer und Uploadsignierer nicht ausgelesen oder gleichgesetzt |

**Belegte Entscheidung:** Besitzerangabe und interne Play-Verteilung sind jetzt als Nutzerbericht vorhanden. Die vermutete GitHub-Ablage gilt weiter als unbekannte Schlüsselverfügbarkeit. Eine GitHub-Secretbindung wäre von einer öffentlichen Repositorydatei zu unterscheiden; deklarierte Secretnamen beweisen keine Einrichtung, und Secretwerte werden nicht angefordert oder ausgelesen. Aus „sollte es einen Schlüssel geben“ wird keine Freigabe zur Schlüsselsuche oder zum Zugriff abgeleitet. Die ursprüngliche Grenze „keine privaten Schlüssel suchen/lesen/kopieren“ gilt weiter.

Die interne Play-Verteilung erlaubt keine neue Signierung, keinen Upload, Versionswechsel oder lokalen Updateversuch. Das unveränderte unsignierte Code17-APK ist weiterhin kein freigegebenes Geräteupdate; seine Kompatibilität zur tatsächlichen Zielinstallation bleibt offen. Ein späterer Play-Weg benötigt eine eigene Freigabe und eindeutige Artefakt-/Versions-/Signiererzuordnung; ein lokaler APK-Weg ist nicht automatisch mit einem Play-Update austauschbar. Keine neue technische Freigabe und keine neue Software-/CI-/Geräteprüfung aus dieser Antwort.

**Genau nächster zulässiger Einzelauftrag:** T-006 – nichtgeheime Angaben des bestehenden internen Play-Testbuilds zuordnen. Den Nutzer gezielt um bereits verfügbare Paketkennung, Versionscode/-name des internen Testbuilds und nur falls vorhanden öffentliche App-Signier-/Uploadzertifikatsfingerabdrücke bitten. Testkanalstand und tatsächlich installierten Gerätestand unterscheiden, unbekannte Felder offen lassen. Besitzerangabe nicht erneut abfragen. Keine eigene Console-/GitHub-/Secretabfrage oder Geräteaktion, keine Schlüsseldateien/-pfade/-werte und keine Signierung/Versionierung/Installation/Veröffentlichung. Das ist eine neue begrenzte Metadatenklärung, kein Auftrag zur Schlüsselwiederherstellung.

T-006/V-014 bleiben IN_ARBEIT; E-002–E-005 und Gesamt-/Geräte-/Releasefreigabe offen. Alte Umgebung/835235b bleiben zurückgestellt. Ausschließlich Dokumentation lokal committen und sichern unter `/workspace/anker-t006-entscheidungsangaben-20261114/`, finale Commit-ID im Abschlussmanifest. Keine grüne Suite wiederholt; ältere Belege/Sicherungen und die historischen Code17-Manifeste unverändert. Nach diesem Auftrag stoppen.

## Vorheriger lesender Bestandsabgleich vom 13.11.2026

Stand 13.11.2026, Europe/Berlin. Geprüfte saubere Ausgangsbasis `b816e1a4145a079fa35241194facb5f3f811cc1c`, Branch `entwicklung/anker-neu`. Ausschließlich vorhandene öffentliche Dateien, Skriptquellen und lokale Prüfmetadaten gelesen; Dokumentation lokal fortgeschrieben. Keine Signierprogramme, Gradle-, Build-, Sync-, Geräte-, GitHub- oder Play-Aktion ausgeführt. Alte Umgebung und `835235b` bleiben zurückgestellt und sind keine Voraussetzung dieser Bestandsaufnahme.

## Ergebnis und belastbare Identität

Die unsignierte lokale Paketintegration ist belegt. Ein signierter Geräteprüfbuild ist **noch nicht zur Ausführung freigegeben**: Besitzer/Erreichbarkeit des passenden bestehenden privaten Schlüssels, aktuelle installierte Paket-/Versions-/Signaturzuordnung und die ausdrückliche lokale Signierfreigabe fehlen. Dies ist eine Nachweis-/Freigabegrenze, kein in diesem Auftrag erzeugter Werkzeugfehler. Es wurde kein Schlüssel gesucht, geöffnet, kopiert oder als verloren erklärt.

| Beleg | Öffentlich feststellbarer Stand | Aussagegrenze |
|---|---|---|
| Lokales Prüf-APK | `/workspace/anker-t006-android-20261113/Anker-T006-UNSIGNIERT.apk`, 38.608.942 Bytes, SHA256 `94f240a18f2047a57dcf5e13075504f02889a3281de00a40e4bcd8836baf7a0f`; Vorhandensein/Größe/Hash jetzt bestätigt | Absichtlich unsigniert; keine Installierbarkeit oder Updatekompatibilität |
| APK-Quelle | Appquellcommit `18f6bb2959f26882c9860a104e8bc3e85512fe04`, Appquellkennung `552f037d8560dcc3fe59b6ae441a0d77484e0ca40b479379a9cbe9be28b043a0` | `b816e1a` ist der anschließende Dokumentationsabschluss, kein anderer Appbuild |
| Paket / Version / SDK | `de.frnkrm.anker.mobile`, Code17 / `1.5.0-rc.3`, min26 / target36 / compile36 | Versionsname allein identifiziert weder Zertifikat noch tatsächlich installierten Code |
| Öffentliche Zertifikatsnachweise | Code15, Code16, `AKTUELLER_UPDATESTAND.json` und `PLAY_UPLOAD_APPROVAL.json` nennen konsistent B4, siehe unten | Dokumentierte historische Signaturbelege; in diesem Auftrag keine historische signierte APK neu kryptografisch geprüft |
| Historische Code16-APK | [Signaturnachweis](ANKER_CODE16_SIGNATUR.json): Quelle `4d8eaa1cd1dc463e3ce9032779d857a215d020fc`, Code16 / `1.5.0-rc.2`, signiert, SHA256 `1627da4bdf00207533a8cff8fbc90f8b9d1770fe343eb37ec214903d70b330be` | Das Feld `realAndroidInstallation` lautet `not run`; kein aktueller Gerätebeleg |
| Historische Code17-Freigabe | [Updateauswahl](AKTUELLER_UPDATESTAND.json) und [Play-Freigabe](PLAY_UPLOAD_APPROVAL.json) binden Quelle `80f6a692b005ab08edacf9e6ad9e9669e4c383f7` und Quellkennung `10c21f4f5bb07215244a1cc53dc21f8423a020f24aa7c1cfb4df38b9c3e441c7` | Nicht auf den neuen lokalen Stand oder das neue APK übertragbar; JSON-Manifeste unverändert |

Dokumentierter öffentlicher SHA256-Zertifikatsfingerabdruck:

```text
B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A
```

Der neuere Releaseweg dokumentiert den Alias `anker-mobile-release`. Ein Alias ist keine kryptografische Identität; entscheidend wäre das tatsächlich überprüfte Zertifikat des bereitgestellten bestehenden Schlüssels. Ein öffentlicher Fingerabdruck, eine APK oder ein AAB enthält keinen ersetzenden privaten Schlüssel. Frühere Aussagen über Schlüsselablage in der damaligen Cloudumgebung sind historisch; heutige Erreichbarkeit und externe Sicherung wurden nicht nachgewiesen. Die alten Downloadrefs und eine signierte APK waren in den gezielt geprüften lokalen Git-Pfaden `docs`, `scripts` und `public` nicht vorhanden; kein Download oder Remoteabruf erfolgt.

## Vorhandene Wege und ihre tatsächlichen Grenzen

| Weg / Codebeleg | Tatsächliches Verhalten laut Quelle | Eignung für den nächsten begrenzten lokalen Schritt |
|---|---|---|
| [Alter lokaler Helfer](../scripts/sign-local-update.mjs), Zeilen67–104, und [Java-Helfer](../scripts/AnkerApkTool.java), Zeilen19/44–65 | Erwartet benachbarte `update-info.json` und gehashte Tools, verwendet standardmäßig den Windows-Debugpfad; Java fixiert `AndroidDebugKey` und das historische Debugpasswort. Optional geprüfte vorherige APK ist eine lokale Debugdatei, kein Geräteauslesen. Der Versionsvergleich verwirft nur eine höhere Vorgängerversion | Kein belegter passender Weg für den dokumentierten Releasealias. Ein expliziter Dateipfad allein behebt die festgelegten Alias-/Passwortannahmen nicht. Nicht ausführen, keinen Debugschlüssel neu erzeugen oder den Release-Schlüssel umkonfigurieren; keine Codeänderung in diesem Auftrag |
| [Gradle-Releasekonfiguration](../android/app/build.gradle), Zeilen5–41 | Liest bei Vorhandensein `keystore.properties` bzw. vier `ANDROID_*`-Signierbindungen und setzt dann Release-Signierung. Ohne Bindung wurde der vorhandene unsignierte Prüfbuild erstellt | Direktes `assembleRelease` wäre bei später gebundener Konfiguration eine Signieraktion und ein neuer Build. In diesem Auftrag nicht gestartet; keine Konfigurations-/Secretwerte gelesen oder geändert |
| Vorhandene offizielle Build-Tools35 / `apksigner` | Im vorigen Paketauftrag vorhanden und zur Unsigned-Prüfung benutzt. Können einen vorhandenen APK-Eingang nach separater Freigabe mit explizitem bestehendem Release-Schlüssel signieren/prüfen | Kleinster späterer rein lokaler Pfad kann das bereits geprüfte APK ohne erneuten Appbuild verwenden, sofern Version/Zertifikat zur Zielinstallation passen. Schlüssel bleibt beim bestätigten Besitzer; keine GitHub-Secrets oder Cloudübertragung nötig. Noch keine Ausführungsfreigabe, keine Behauptung heute verfügbarer privater Schlüssel |
| [Secret-Einrichtung](../scripts/setup-android-signing.ps1), Zeilen74–108 | Prüft öffentliches B4-Zertifikat aus ausdrücklich genanntem Keystore, liest danach die private Datei und überträgt sie mit drei Signierwerten als GitHub-Secrets | Keine reine lokale Prüfung; Schlüsselzugriff und externe private Übertragung wären separate Aktionen. Nicht ausgeführt und für lokale Signierung nicht erforderlich |
| [Android-Update-Workflow](../.github/workflows/android-update.yml), Auflösung/Signierjob | Exakter freigegebener main-Vorfahr und erfolgreiche main/push-CI, neue native Prüfungen, getrennte Artefakt-/Signierübergabe, vier `ANKER_ANDROID_*`-Secrets, B4-Prüfung. Leere SHA wählt historisches Code17-Manifest | Kein Weg für den bisher ungepushten lokalen Stand. Weder Gates umgehen noch alte Manifeste umschreiben oder Workflow starten. Remote-CI ist eine Voraussetzung dieses Remotewegs, nicht technisch jeder lokalen APK-Signierung |
| [Tag-Release-Workflow](../.github/workflows/release.yml) | `v*`-Push, Signierung aus anderem `ANDROID_*`-Secret-Namensraum und GitHub-Release/Upload | Veröffentlichung mit eigenem Secretpfad; nicht für diesen Auftrag verwenden. Keine Aussage über heute eingerichtete GitHub-Secrets |

## Versions- und Updateentscheidung vor einer Signierung

Zuerst aktuelle installierte Paketkennung, Versionscode/-name und Herkunft anhand vorhandener öffentlicher Geräte-/Installationsangaben zuordnen. Falls ein öffentliches Zertifikat bereits vorliegt, dessen Herkunft und Fingerabdruck notieren. Appname und ein alter Testbericht reichen nicht als Beleg der aktuellen Installation. Ohne diese Zuordnung keine Updatezusage.

| Tatsächlich bestätigte Zielinstallation | Folgerung für das unveränderte Prüf-APK Code17 |
|---|---|
| Altes Paket `de.frnkrm.anker` | Anderes Paket, kein reguläres Update zu `.mobile`; keine Datenmigration oder Parallelinstallation ohne eigenen Auftrag |
| `.mobile`, passendes B4-Zertifikat, Code kleiner17 | Versionsfolge grundsätzlich aufwärts; erst fertige Signatur-/Paketprüfung und getrennt autorisierte Gerätebeobachtung können einen Updateversuch belegen. Kein automatischer Datenerhalt-/Installationsnachweis |
| `.mobile`, Code17 | Gleichheit allein ist nicht automatisch ein Android-Downgradefehler. Anderer Quellstand bei gleicher Version bleibt aber mehrdeutig; Geräte-/Zertifikats-/Quellzuordnung und bewusste Entscheidung erforderlich. Keine automatische Versionsänderung |
| `.mobile`, Code größer17 | Regulären Downgrade ausschließen; keine Installationsflags, Deinstallation oder Datenlöschung als Umweg. Eine neue autorisierte Versionsentscheidung würde einen neuen Build und betroffene Nachprüfungen benötigen |
| Anderer oder unbekannter tatsächlicher Signierer | Kein kompatibles Update belegt. Zertifikatswechsel/-rotation oder gültige Signierhistorie sind nicht nachgewiesen; weder einen neuen Schlüssel als Ersatz erfinden noch Deinstallation verlangen |
| Herkunft Google Play | AAB-Uploadzertifikat und ausgeliefertes App-Signierzertifikat haben verschiedene Rollen. B4 in der historischen AAB-Freigabe beweist nicht den tatsächlichen Signierer eines installierten Play-APKs |

Historisch wurde Code17 als interner Entwurf und Code16 als aktiv gemeldet. Kein aktueller Play-Readback, keine Wiederverwendung eines bereits vergebenen Codes für einen neuen Playupload und kein angeblich freier nächster Code daraus ableiten. Für den lokalen Pfad wird Play nicht abgefragt oder verändert. Bestehende Daten, Wecker, Freigaben und Geräteberichte bleiben unangetastet.

## Fehlende Nachweise und kleinste notwendige nächste Handlung

1. **Zielinstallation fehlt:** Nutzer nennt vorhandene öffentliche Versions-/Paket-/Herkunftsangaben; vorhandenen Codestand oder öffentlichen Zertifikatsbeleg nur falls bereits verfügbar. Keine ADB-/Geräteeinrichtung, Testalarme, Freigabeänderung, Installation oder Datenexport dafür starten. Unbekannt bleibt unbekannt.
2. **Passender Signierbesitzer fehlt:** Nutzer bestätigt lediglich, ob eine ihm zugängliche bestehende Release-Schlüsselsicherung bzw. ein erreichbarer Signierbesitzer bekannt ist: ja/nein/unbekannt. Keine Pfade, Passwörter, Schlüsseldateien, Base64 oder Uploads in den Chat verlangen. Das ist noch kein kryptografischer Besitznachweis und keine Schlüsselzugriffsfreigabe.
3. **Lokale Signierfreigabe fehlt:** Erst nach Zuordnung und bestätigtem Besitzer wäre der kleinste separat zu autorisierende technische Schritt: ausschließlich die oben exakt per Hash gebundene bestehende APK lokal beim Besitzer mit dem bestehenden passenden Schlüssel signieren und Ergebnis auf einen erwarteten Signierer, unveränderte Paket-/Version-/SDK-/Nutzlastdaten, CRC/Ausrichtung und neue SHA256 prüfen. Keine neue Version oder Appbuild, sofern die bestätigte Versionslage dies zulässt; keine Installation oder Veröffentlichung. Schlüsselzugriff und -prüfung müssten dabei ausdrücklich autorisiert werden. Aktuell nicht ausführen.
4. **Geräte-/Gesamtfreigabe fehlt:** Selbst ein später erfolgreich signiertes Artefakt schließt E-002–E-005 nicht. Getrennte reale Galaxy-/Windows-/Kalender-/NFC-Beobachtungen und jeweilige Freigabe bleiben nötig; [bestehende Stationen](GERAETETEST.md) erhalten. T-006/V-014 bleiben insgesamt IN_ARBEIT.

**Damals nächster, durch die obige Nutzerantwort inzwischen fortgeschriebener Einzelauftrag:** T-006 – fehlende nichtgeheime Entscheidungsangaben bei dem Nutzer einholen und zuordnen. Zielinstallation/Herkunft sowie allein die bestätigte Erreichbarkeit eines bestehenden Signierbesitzers abfragen; bekannte Angaben nicht erneut verlangen. Noch kein Signieren, Schlüsselzugriff, Versionswechsel oder Geräteeingriff. Ein weiterer bloßer Wiederholungslauf derselben Quellenprüfung beseitigt diese externen Nachweislücken nicht.

## Nachweise und Sicherung dieses Auftrags

`/workspace/anker-t006-signiervoraussetzungen-20261113/`: öffentliche Metadaten-/Quellhashinventare, gezielter APK-Verfügbarkeits-/Hashabgleich, Dokumentintegrität, Vorher-/Nachher-Git-Bundle, unabhängige Wiederherstellung/fsck/Dokumenthashes, RESTORE.md und SHA256SUMS. APK und frühere Paketnachweise bleiben unverändert im bisherigen Sicherungsordner; keine erneute Paket-/Logik-/Browser-/JUnit-Suite. Kein neuer CI- oder Geräteerfolg behauptet. Nur Cloud-lokale Sicherung, keine bestätigte externe Kopie. Finale Dokumentationscommit-ID im Abschlussmanifest, keine selbstreferenzierende Dateischleife. Nach lokalem Abschluss stoppen.
