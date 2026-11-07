# Künftige Updates von Anker Neu signieren

Stand: 7. November 2026, **Anker Neu 1.3.0-rc.6 / Code 13**, Paket `de.frnkrm.anker.mobile`. Die [fertige signierte APK](INSTALLATION_ANKER_NEU.md) kann direkt am Handy installiert werden. Der private Release-Schlüssel wurde auf ausdrücklichen Nutzerwunsch geschützt in der aktuellen Cloud-Arbeitsumgebung erzeugt. Er liegt weder im Repository noch im öffentlichen APK-Download. Eine dauerhafte externe Sicherung und die GitHub-Signiersecrets wurden noch nicht eingerichtet.

## Welche Signatur erhalten bleiben muss

Öffentliches SHA-256-Zertifikat: `B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A`. Alias: `anker-mobile-release`. Für spätere Updates dieser neuen App muss der zugehörige private Schlüssel erhalten bleiben. Die alte Debug-Signatur und das alte Paket `de.frnkrm.anker` sind ein historischer, anderer Installationsweg. Ein umbenannter Keystore oder die öffentliche Signatur aus einem APK ersetzen keinen privaten Schlüssel.

Der bisherige Anker bleibt beim Umzug installiert. Die neue App übernimmt Daten erst aus einer bewusst gewählten Sicherung; Android-Freigaben, Widgets und Anmeldungen sind unabhängig. [Datenübernahme](SICHERUNG_WIEDERHERSTELLEN.md).

## Vorbereiteter GitHub-Workflow

`.github/workflows/android-update.yml` startet ausschließlich manuell per `workflow_dispatch` auf main. Ein leeres `source_commit` liest `docs/AKTUELLER_UPDATESTAND.json`: genaue volle SHA, Quellfingerabdruck, Version/Code, CI-Link und das neue öffentliche Zertifikat müssen passen. Der exakt benannte Codecommit muss einen erfolgreichen main-/Push-CI-Lauf besitzen und Vorfahr von main sein. Kein Ersatzcommit und keine pauschale Ausnahme für Dokumente werden gewählt; der Gerätekatalog ist ein Buildinput.

Der Buildjob verwendet Node 24/JDK 21, prüft beide AAR- und Kotlinvarianten, führt die vollständigen nativen JUnit-Klassen frisch aus und baut das unsignierte Release. Paket `de.frnkrm.anker.mobile`, Version, API 26/36/36, Assets, Quellfingerabdruck sowie ZIP-/ELF-16-KB-Ausrichtung werden geprüft. Die Signierung läuft auf einem getrennten Runner ohne Checkout/npm/Gradle oder Programme aus dem Buildartefakt. Digests, genaues grünes CI und Freigabedaten werden vor Nutzung von Secrets erneut verglichen. Das neue Paket und das neue Zertifikat werden strikt geprüft; ein altes Anker-Paket wird vor einem Signierversuch verworfen.

| Signierkonfiguration | Ergebnis |
| --- | --- |
| Alle vier Secrets fehlen | Klar bezeichnete UNSIGNIERT-Datei; kein installierbares Update. |
| Unvollständig, falscher Schlüssel oder ungültiger Nachweis | Abbruch, kein fertiges signiertes Update. |
| Vollständig, richtige Identität und erfolgreiche Prüfung | SIGNIERT-APK plus öffentlicher Prüfbericht. Echte Installation bleibt separat. |

Die nötigen Secret-Namen sind `ANKER_ANDROID_KEYSTORE_BASE64`, `ANKER_ANDROID_STORE_PASSWORD`, `ANKER_ANDROID_KEY_ALIAS` und `ANKER_ANDROID_KEY_PASSWORD`. Secretwerte und private Dateien gehören nicht in Chat, Git oder Logs. Base64 ist keine Verschlüsselung. Eine bewusste Einrichtung würde eine zusätzlich geschützte private Schlüsselkopie bei GitHub hinterlegen; diese Übertragung wurde noch nicht ausgeführt.

Für eine eigene vorhandene P12-Sicherung stellt `scripts/setup-android-signing.ps1` einen geprüften Weg mit PowerShell 7.2+, Java/keytool und authentifizierter GitHub CLI bereit. Der Keystorepfad ist ausdrücklich anzugeben, Alias `anker-mobile-release`; es wird kein alter Windows-Debugpfad angenommen und kein Schlüssel erzeugt. Das Skript fragt Passwörter geschützt ab, prüft das öffentliche Zertifikat zuerst und überträgt Werte ausschließlich per stdin. Ein abweichendes Zertifikat bricht vor der Übertragung ab. Der aktuelle neue Schlüssel liegt zunächst in der Cloud; seine sichere zusätzliche Aufbewahrung muss vorher geklärt werden.

## Nach erfolgreicher Einrichtung am Handy

1. [Android-Update manuell bauen](https://github.com/frnkrm/anker/actions/workflows/android-update.yml) öffnen, **Run workflow**, Branch main, SHA-Feld für den freigegebenen Stand leer lassen.
2. Nach Erfolg das endgültige Artefakt **Anker-Android-Update-…** herunterladen; die interne UNSIGNIERT-Übergabe ist nicht das Handy-Update.
3. ZIP am Handy entpacken, `INSTALLATION.txt` lesen und nur die als SIGNIERT ausgewiesene APK öffnen. Android fragt nach Installation und gegebenenfalls Freigabe des Browsers/Dateimanagers.

Ohne die einmalige Schlüsselaufbewahrung und Secret-Einrichtung erzeugt dieser Workflow weiterhin nur eine unsignierte Datei. Die bereits fertig signierte RC6-APK im Installationsleitfaden benötigt diesen Workflow nicht.

## Tatsächliche Nachweise und offene Grenzen

36 Offline-/Mocktests prüfen Manifest-/Commit-/CI-Gates, die neue App-Kennung, falsche Zertifikate, fehlende/partielle Secrets, Hashmanipulation und geschützte Secretübergabe. Sie starteten keinen echten signierten Actions-Lauf. Das ausgelieferte RC6-APK wurde dagegen tatsächlich separat in der Cloud signiert und kryptografisch geprüft; [Nachweis](ANKER_NEU_RC6_NACHWEIS.json). Private Schlüssel wurden dabei nicht an GitHub übertragen.

[Historische RC3-Anleitung mit altem Zertifikat](https://github.com/frnkrm/anker/blob/f9b33ea69101d13fce3ef12f8846fed07637aaab/docs/ANDROID_UPDATE_AUTOMATION.md). Keine Tags, Releases, Google-Play-Veröffentlichung, kostenpflichtigen Dienste oder externen Nachrichten wurden durch die Neusignierung ausgelöst. Play benötigt weiterhin eigene Konto-, Signierungs-, Datenschutz- und Testentscheidungen; [Roadmap](ANDROID_PLAY_ROADMAP.md).
