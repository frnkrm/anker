# Historischer RC3-Zwischenstand – nicht der freigegebene Update-Download

Die spätere GitHub-Prüfung dieses Stands fand einen 4-Pixel-Überlauf im Teilschritt-Fokus (208 von 209 Browserfällen bestanden). Die ZIP bleibt als historischer Beleg unverändert. Für das freigegebene Update ausschließlich die [aktuelle Anleitung auf main](https://github.com/frnkrm/anker/blob/main/docs/UPDATE_RC3.md) verwenden; der korrigierte Stand erhält einen eigenen Download.

Vorbereitetes Update **1.3.0-rc.3 / Code 10**, Paket `de.frnkrm.anker`. Die ZIP enthält die unsignierte APK und die unveränderte lokale Signierhilfe 2. Zum Installieren zuerst lokal signieren; ausschließlich die erzeugte **Anker-RC3-Update.apk** verwenden und die vorhandene App installiert lassen. Kein Schlüssel oder Passwort gehört ins Repository oder in den Chat.

Quelle `37a986066a928fc6f602e60b810d94e8bc870850`, Fingerabdruck `9c3e1feb78a5c422e27fe71f68eeefc89194cb2f6c4437ccc1edbaa7ac6ede32`. 853 Logiktests, 209 Browserfälle, 116 frische native Modelltests, 19 PowerShell- und 34 Update-Mockfälle lokal bestanden. Hörbarkeit, Fensterverhalten, Windows-Signierung und neue Samsung-Prüfungen bleiben offen.

ZIP: 22207384 Bytes, SHA-256 `f3bee16acbd5b23d1e69deff7525bef72254e0d94b6a47e9f2da7e9d0a7a4602`. [Anleitung und aktueller Nachweis](https://github.com/frnkrm/anker/blob/main/docs/UPDATE_RC3.md). Die Freigabedatei auf main wird erst nach dem exakten grünen CI-Lauf ergänzt.
