# Anker-Systemleisten-Update

Version1.2.0-rc.3, Build5. Der Appbereich bleibt außerhalb der Android-Systemleisten und der Kameraaussparung. Geführte Geräteprüfung75 ist ergänzt; vorhandene E02-Funktionen und die Druckumbruchkorrektur sind enthalten.

ZIP vollständig entpacken und `Update-signieren.cmd` starten. Die bisherige portable Signierhilfe verwendet den vorhandenen lokalen Debugschlüssel, Node und Java17+. Kein Android-SDK nötig. Nichts wird automatisch installiert oder hochgeladen. Die erzeugte `Anker-Systemleisten-Update.apk` über die vorhandene App installieren, danach **Mehr → Gemeinsam testen → Systemleisten prüfen**.

Automatischer Build und Webprüfungen sind getrennt vom noch offenen echten Android-Test75. Bestehende Nutzerdaten werden nicht zurückgesetzt. Quellstand: `6ea968a`, Quellkennung: `71a7843e4bcac419a21f4db996b92a57d089b2640e4cf1ef9993dfc3ca767526`.

SHA256 der ZIP: `dd9d01a09dae695ee3c13ccaa3aeecce3afe0c8e69a3e297b162bf9be3865cc8`.

Dieser Downloadbranch bleibt getrennt vom App-Quellbaum; kein Store-Release und kein Tag.
