# Anker Neu direkt auf dem Handy installieren

**1.3.0-rc.4 / Code 11**, neue App **Anker Neu**. [Signierte APK direkt herunterladen](https://github.com/frnkrm/anker/raw/refs/heads/download-anker-neu-rc4-20261107/Anker-Neu-Code11.apk). Für diesen fertigen Download sind weder PC noch PowerShell nötig.

Die eigene Paketkennung `de.frnkrm.anker.mobile` und neue Release-Signatur erlauben eine separate Installation neben deiner bisherigen App. Android behandelt diese Datei nicht als Update des alten Pakets. Die bisherige App und ihre Daten bleiben installiert. Beide Apps verwenden denselben vorhandenen Planer und dasselbe Sicherungsformat; es wurde kein zweites Datenmodell eingeführt.

## So übernimmst du deine Daten

1. In der bisherigen App **Mehr → Sicherung → Sicherung exportieren**. Für alle Daten die vier Bereiche ausgewählt lassen. Die JSON-Datei auf dem Handy speichern; sie muss hier nicht hochgeladen werden. Eine reine Testberichtsdatei ersetzt diese Datensicherung nicht.
2. Die APK oben herunterladen und öffnen. Wenn Android nachfragt, die Installation aus dem bewusst verwendeten Browser erlauben. Danach **Anker Neu** öffnen. Die bisherige App zunächst behalten.
3. Auf der Startseite **Vorhandene Sicherung übernehmen** wählen, **Sicherung importieren**, deine JSON-Datei auswählen und die Vorschau prüfen. Die Wahl **Werte aus dieser Sicherung wiederherstellen** übernimmt auch ältere Einstellungen und deinen Spielstand gegenüber frischen Startwerten. Erst **Sicherung jetzt wiederherstellen** schreibt.
4. Routinen, Spielstand, QR-Wert, Aufgaben und Arbeitszeiten vergleichen. Frühere Testberichte bleiben mit ihren Originalangaben in der Historie; sie werden nicht als frisch bestandene Tests ausgegeben.
5. Über **Wecker & Benachrichtigungen prüfen** die neuen Android-Freigaben einrichten und den Wecker bewusst testen. Android-Berechtigungen, Anmeldungen und Widgets werden nicht durch die Sicherung übertragen. Beide Installationen können unabhängig wecken und erinnern: Die alten Wecker erst nach dem neuen Test selbst abstellen.

Ohne Datenübernahme kannst du die neue App auch bewusst neu einrichten; die alte App bleibt davon unberührt. Ausführliche Hinweise: [Wiederherstellung](SICHERUNG_WIEDERHERSTELLEN.md).

## Signatur und Schlüssel

Öffentliches SHA-256-Zertifikat: `B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A`. Die APK wurde in der Cloud mit dem auf deinen ausdrücklichen Wunsch neu erzeugten Release-Schlüssel signiert und mit den offiziellen Android-Werkzeugen überprüft. Der private Schlüssel und sein Passwort befinden sich außerhalb des Repositorys und sind nicht im öffentlichen Download enthalten.

**Dauerhafte externe Schlüsselsicherung und GitHub-Signiersecrets sind noch nicht eingerichtet.** Der Schlüssel liegt derzeit geschützt in dieser Cloud-Arbeitsumgebung. Für zukünftige Updates dieser neuen App muss genau dieser Schlüssel erhalten bleiben. Ein APK oder öffentlicher Fingerabdruck ersetzt ihn nicht. Eine sichere zusätzliche Aufbewahrung muss gesondert eingerichtet werden; Schlüssel und Passwörter nicht im Chat teilen oder ins öffentliche Git hochladen.

## Tatsächlich geprüft

864 Logikfälle in 88 Dateien, [vollständige GitHub-CI mit 211 Browserfällen](https://github.com/frnkrm/anker/actions/runs/42393476035), 36 Update-/Secret-Mockfälle sowie 116 frisch ausgeführte native JUnit-Fälle bestanden. Keine Skips, Browser-Flakies oder Retries. Beide AAR-/Kotlinvarianten, Releasebuild, echte Cloud-Signierung, neues Paket/Launcher/Klassen/Authorities/Shortcuts, 66 Webassets und 16-KB-Ausrichtung geprüft. 22 Plattformrechte bleiben gleich; die eigene AndroidX-Signaturberechtigung trägt jetzt den neuen Paketpräfix, damit beide Installationen sich nicht gegenseitig blockieren.

Die Datenwiederherstellung ist mit Vorschau, Abbruch, älterem Spielstand gegen frischere Startwerte und echten Datenbank-Schreib-/Lesebarrieren automatisch geprüft. Vor der Ersteinrichtung werden keine Standardalarme oder Fortschrittsauswertungen gestartet. Die echte Installation, Android-Dateiauswahl, Datenübernahme, Hörbarkeit und Zustellung auf deinem Samsung sind noch offen.

Quellcommit `2fad314a8a131218df2fa62dfd545c82972a0b2b`, Fingerabdruck `46e13c2813340e5579d4351ebd35ec38d9d5de7976fe8fa625aa7c4f0bd04673`. APK: 38034934 Bytes, SHA-256 `c5b98debc3852283c382a9f73fddf9c22d70f4da6c55309bfe0be70ffbe5b045`. Der öffentliche Download wurde vollständig erneut gelesen und mit der geprüften signierten Datei verglichen. [Maschinenlesbarer Nachweis](ANKER_NEU_RC4_NACHWEIS.json).

Eine APK im lokalen Ordner `debug` kann die öffentliche Signatur zeigen, liefert normalerweise aber keinen privaten Signierschlüssel. Im aktuell geprüften Git-main wurde keine solche APK gefunden; für diesen Neubau wird sie nicht benötigt. Historischer RC3-Weg: [lokal signiertes Update mit dem alten Schlüssel](UPDATE_RC3.md).
