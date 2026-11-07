# Anker Neu – signierte APK fürs Handy

**1.3.0-rc.4 / Code 11**, Paket `de.frnkrm.anker.mobile`, Name **Anker Neu**. Die APK ist bereits signiert; kein PC und keine lokale Signierung nötig. Sie lässt sich neben dem bisherigen Anker installieren. Die bisherige App installiert lassen.

In der alten App unter **Mehr → Sicherung** eine vollständige JSON-Sicherung exportieren. In Anker Neu beim Start **Vorhandene Sicherung übernehmen** wählen, Datei auswählen, Vorschau prüfen und **Sicherung jetzt wiederherstellen** bestätigen. Daten vergleichen; Android-Freigaben und Widgets sind getrennt. Beide Apps können unabhängig wecken: alte Wecker erst nach dem neuen bewussten Test selbst abstellen.

[Ausführliche Installation und Datenübernahme](https://github.com/frnkrm/anker/blob/main/docs/INSTALLATION_ANKER_NEU.md). [GitHub-CI25 vollständig grün](https://github.com/frnkrm/anker/actions/runs/42393476035) auf exakt `2fad314a8a131218df2fa62dfd545c82972a0b2b`: 211 Browserfälle und alle weiteren Pflichtschritte bestanden. 864 Logik-/116 frische native JUnit-Fälle und 36 Update-Mockfälle grün. Echte Samsung-Installation noch offen.

APK: 38034934 Bytes, SHA-256 `c5b98debc3852283c382a9f73fddf9c22d70f4da6c55309bfe0be70ffbe5b045`. Signaturv2/v3, Paket/Version, unveränderte Nutzdateien und 16-KB-Ausrichtung überprüft. Öffentliches Zertifikat `B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A`. Der Download enthält keinen privaten Schlüssel und kein Passwort. Die dauerhafte externe Schlüsselaufbewahrung ist noch nicht eingerichtet.
