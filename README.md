# Anker E02 – lokales Update

Version1.2.0-rc.2, Build4. Appcode: [f272c51](https://github.com/frnkrm/anker/commit/f272c514772a32c4529b92088467851e7f940668).

Download: https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e02-20261106/Anker-Update-E02.zip

ZIP vollständig entpacken und Update-signieren.cmd starten. Node, Java17+ und dein bisheriger lokaler Debugschlüssel werden verwendet; Android-SDK und lokaler Projektbuild sind nicht nötig. Schlüssel und Passwörter bleiben auf deinem PC. Das Paket lädt nichts hoch und installiert nichts.

Die erzeugte Anker-E02-Update.apk über die vorhandene App installieren. Bei Ablehnung Anker installiert lassen und den genauen Fehlertext melden. Danach Daten prüfen und Mehr → Gemeinsam testen → Erinnerungen & Druck prüfen öffnen.

Automatisch geprüft:376 Vitest-,39 Browser- und73 Kotlin-Tests, SDK36-Build, Byte-/Ausrichtungsprüfung und echte Testsignierung ohne Runtime-SDK. Neue Android-Geräte-, SQLite-, Druck-/PDF- und Papier-QR-Fälle bleiben offen. Kein Store-Release oder Versionstag.

ZIP SHA256: 5e754fa1de871ad8077a2925dd36e46b1cf3623f86e786420069afeec6cf22b5
APK SHA256 (unsigniert): edc4df197487cea724dc227817bf0022b92b0accbb85e5728ea7da47761321ae
Quellkennung: 13c644b5d80c957367194c390b0c1d1faca12f177be049f498a3f6afed6cbbdf

Enthaltene Apache-2.0-apksig-Bibliothek unverändert, Lizenz/Herkunft und eigene Java-Quelle liegen im Paket. Keine privaten Schlüssel oder Nutzerdaten enthalten.
