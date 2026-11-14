# Anker Neu direkt auf dem Handy installieren

**Historischer Direktdownload, Abgrenzung 14.11.2026:** Diese Anleitung betrifft die unten bezeichnete B4-signierte Code13-APK. Laut aktuellen Nutzerangaben ist B4 das Play-Uploadzertifikat, der Play-App-Signierer lautet8A. Die alte B4-Datei ist kein belegtes reguläres Update einer8A-signierten Play-Installation; tatsächliche Zielinstallation unbekannt. [Rollen, vollständige Fingerabdrücke und Grenzen](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Nicht als neue Installationsfreigabe verstehen, bestehende App/Daten erhalten und keinen Schlüssel-/Versions-/Deinstallationsumweg verwenden.

**1.3.0-rc.6 / Code 13**, neue App **Anker Neu**. [ZIP mit signierter APK herunterladen, ca. 22 MB](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-neu-rc6-20261107). Für diesen fertigen Download sind weder PC noch PowerShell nötig.

**Wenn Anker Neu bereits installiert ist:** Die ZIP entpacken, darin `Anker-Neu-Code13.apk` öffnen, darüber installieren und anschließend Anker Neu öffnen. Derselbe Release-Schlüssel und der höhere Versionscode ermöglichen ein Update ohne Deinstallation; Einstellungen, Aufgaben und Testberichte bleiben im bestehenden App-Speicher. Für einen ersten Umzug aus der bisherigen App gelten die Schritte unten.

Die eigene Paketkennung `de.frnkrm.anker.mobile` und neue Release-Signatur erlauben eine separate Installation neben deiner bisherigen App. Android behandelt diese Datei nicht als Update des alten Pakets. Die bisherige App und ihre Daten bleiben installiert. Beide Apps verwenden denselben vorhandenen Planer und dasselbe Sicherungsformat; es wurde kein zweites Datenmodell eingeführt.

## So übernimmst du deine Daten

1. In der bisherigen App **Mehr → Sicherung → Sicherung exportieren**. Für alle Daten die vier Bereiche ausgewählt lassen. Die JSON-Datei auf dem Handy speichern; sie muss hier nicht hochgeladen werden. Eine reine Testberichtsdatei ersetzt diese Datensicherung nicht.
2. Den ZIP-Link oben in Chrome oder Samsung Internet öffnen. Falls eine eingebettete Ansicht hängen bleibt: Link lange drücken, kopieren und in die Adresszeile des Browsers einfügen. Nach dem Download **Eigene Dateien → Downloads** öffnen, die ZIP entpacken und darin `Anker-Neu-Code13.apk` öffnen. Wenn Android nachfragt, die Installation aus dem bewusst verwendeten Browser/Dateimanager erlauben. Danach **Anker Neu** öffnen. Die bisherige App zunächst behalten.
3. Auf der Startseite **Vorhandene Sicherung übernehmen** wählen, **Sicherung importieren**, deine JSON-Datei auswählen und die Vorschau prüfen. Die Wahl **Werte aus dieser Sicherung wiederherstellen** übernimmt auch ältere Einstellungen und deinen Spielstand gegenüber frischen Startwerten. Erst **Sicherung jetzt wiederherstellen** schreibt.
4. Routinen, Spielstand, QR-Wert, Aufgaben und Arbeitszeiten vergleichen. Frühere Testberichte bleiben mit ihren Originalangaben in der Historie; sie werden nicht als frisch bestandene Tests ausgegeben.
5. Über **Wecker & Benachrichtigungen prüfen** die neuen Android-Freigaben einrichten und den Wecker bewusst testen. Android-Berechtigungen, Anmeldungen und Widgets werden nicht durch die Sicherung übertragen. Beide Installationen können unabhängig wecken und erinnern: Die alten Wecker erst nach dem neuen Test selbst abstellen.

Ohne Datenübernahme kannst du die neue App auch bewusst neu einrichten; die alte App bleibt davon unberührt. Ausführliche Hinweise: [Wiederherstellung](SICHERUNG_WIEDERHERSTELLEN.md).

## Downloadprüfung

Der bevorzugte ZIP-Link wurde in Chromium mit eingeschalteter TLS-Prüfung vollständig als Datei gespeichert: 21834438 Bytes, SHA256 `c65cec1b37a3285301210f2ff38469b36d459467adccdb84311bd0b5792e7a93`. ZIP-CRC und die drei öffentlichen Dateien sind geprüft; die enthaltene APK ist exakt bytegleich mit der signierten Code13-Datei. Nach dem früher gemeldeten hängenden Raw-APK-Download bleibt die ZIP mit ausdrücklichem Attachment-Header der bevorzugte Weg. Die tatsächliche Speicherung und Installation auf dem Samsung bleibt bis zum Nutzerbericht offen.

## Signatur und Schlüssel

Öffentliches SHA-256-Zertifikat: `B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A`. Die APK wurde in der Cloud mit dem auf deinen ausdrücklichen Wunsch neu erzeugten Release-Schlüssel signiert und mit den offiziellen Android-Werkzeugen überprüft. Der private Schlüssel und sein Passwort befinden sich außerhalb des Repositorys und sind nicht im öffentlichen Download enthalten.

**Die beauftragte GitHub-Schlüsselablage steht noch aus.** Der Release-Schlüssel liegt geschützt in dieser Cloud-Arbeitsumgebung; die Cloud-Netzfreigabe für `api.github.com` ist noch nicht aktiviert. Eine dauerhafte externe Sicherung wurde noch nicht bestätigt. Für zukünftige Updates muss genau dieser Schlüssel erhalten bleiben. Ein APK oder öffentlicher Fingerabdruck ersetzt ihn nicht. Schlüssel und Passwörter nicht im Chat teilen oder ins öffentliche Git hochladen.

## Tatsächlich geprüft

875 Logikfälle in 88 Dateien, [vollständige GitHub-CI mit 220 Browserfällen](https://github.com/frnkrm/anker/actions/runs/42405382711), 36 Update-/Secret-Mockfälle und 19 PowerShell-Logikfälle bestanden. Keine Skips, Browser-Flakies oder Retries. Die 122 nativen JUnit-Fälle dieses RC6-Auftrags werden nach vollständiger Bytegleichheit der nativen/Test-/Abhängigkeitsinputs wiederverwendet; kein neuer Testlauf nach dem CSS-Fix behauptet. Alle drei DEX-Dateien und das binäre Manifest sind mit dem ursprünglichen RC6-APK bytegleich. Beide AAR-/Kotlinvarianten, neuer Releasebuild, echte Signierung, 66 Webassets und 16-KB-Ausrichtung geprüft. Die 23 Manifestberechtigungen einschließlich Flags bleiben gleich. [Kompakte Routinekarten](UI_ROUTINEN_RC6.md); die vorherigen Benachrichtigungsantwort-Korrekturen bleiben enthalten.

Die Datenwiederherstellung ist mit Vorschau, Abbruch, älterem Spielstand gegen frischere Startwerte und echten Datenbank-Schreib-/Lesebarrieren automatisch geprüft. Vor der Ersteinrichtung werden keine Standardalarme oder Fortschrittsauswertungen gestartet. Die echte Installation, Android-Dateiauswahl, Datenübernahme, Hörbarkeit und Zustellung auf deinem Samsung sind noch offen.

Quellcommit `855b0bef8c276f358ce4f7db5fa3ac1299ead2ae`, Fingerabdruck `4f90a1d9e60e53d1860cdbffdad95ee3b121ad5242ed629f32fbc7164c17399b`. APK: 38039030 Bytes, SHA-256 `d4069d4a40e7ef7d84d8bfbd06b0c1b40d57e81fe3d1d653be338f5e623ca7fa`. Im Browser vollständig heruntergeladene ZIP und enthaltenes APK geprüft. [Maschinenlesbarer Nachweis](ANKER_NEU_RC6_NACHWEIS.json).

Eine APK im lokalen Ordner `debug` kann die öffentliche Signatur zeigen, liefert normalerweise aber keinen privaten Signierschlüssel. Im aktuell geprüften Git-main wurde keine solche APK gefunden; für diesen Neubau wird sie nicht benötigt. Historischer RC3-Weg: [lokal signiertes Update mit dem alten Schlüssel](UPDATE_RC3.md).

Historischer RC4-Stand mit Code 11: [damalige Installationsanleitung](https://github.com/frnkrm/anker/blob/6eefc80dffa7bea064e2cb81f78bff32f71eb4ac/docs/INSTALLATION_ANKER_NEU.md), [unveränderter RC4-Nachweis](ANKER_NEU_RC4_NACHWEIS.json).

Historischer RC5-Stand mit Code 12: [damalige Installationsanleitung](https://github.com/frnkrm/anker/blob/de5286a442d0e9aa304cd5b7904ef40063e7a7fd/docs/INSTALLATION_ANKER_NEU.md), [unveränderter RC5-Nachweis](ANKER_NEU_RC5_NACHWEIS.json).
