# Anker E03 Update – 1.2.0-rc.4 / Build 6

[Update-ZIP herunterladen](Anker-E03-Update.zip?raw=true)

Auf dem Windows-PC PowerShell öffnen und diesen Block ausführen. Der bisherige Signierschlüssel bleibt auf deinem PC. Node und Java17+ genügen, Android-Buildwerkzeuge werden nicht benötigt.

```powershell
$ankerDir = Join-Path $env:USERPROFILE 'Downloads\Anker-E03'
$ankerZip = "$ankerDir.zip"
Invoke-WebRequest 'https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e03-20261106/Anker-E03-Update.zip' -OutFile $ankerZip
if ((Get-FileHash $ankerZip -Algorithm SHA256).Hash -ne 'd404822aa775c934637cfe11cce788d21ec9b8d614ddc80ea5618bee9311e9fe') { throw 'Download-Prüfsumme stimmt nicht.' }
Expand-Archive $ankerZip -DestinationPath $ankerDir -Force
Set-Location (Join-Path $ankerDir 'Anker-E03-Update')
node .\signieren.mjs
if ($LASTEXITCODE -ne 0) { throw 'Signierung abgebrochen. Bitte die Fehlermeldung melden.' }
explorer.exe .
```

Danach **Anker-E03-Update.apk** aus dem geöffneten Ordner auf dein Handy übertragen und als Update installieren. Anker installiert lassen; dein Datenbestand gehört zur bestehenden App. Die unsignierte APK ist nur die Eingabe für den lokalen Helfer.

Neu: Aufgaben mit kleinen nächsten Schritten, optionalen Details und lokaler Zerlegung; Pause/Weiter beim Fokus; Entwürfe und Unterbrechungsnotizen bleiben erhalten; Wiedereinstieg nach längeren Pausen ohne automatischen Fortschrittsverlust. Fokuszeit ist keine Arbeitszeitbuchung, Zeitablauf ist keine Erledigung. Die bestehende Systemleistenkorrektur ist enthalten.

In der App: **Mehr → Gemeinsam testen → Aufgaben & Wiedereinstieg prüfen**. Beginne bei **Test 76**. Die Seite führt zu den passenden Bereichen und zurück. Du musst nicht alle 85 Fälle auf einmal prüfen. Bestehende Berichte bleiben erhalten; neue Fälle werden nicht automatisch abgehakt.

Automatisch geprüft:499 Logiktests,58 Browserfälle,73 Kotlin-Tests und Android-Release-Build. Neue Android-Geräteprüfungen bleiben offen. Quellen auf `main`, Appcommit `5e46b17`; Quellkennung `e4541ce7f2587af4796541c6da5d81396a5542819106b79ff75759ec8a37bb2e`. Paket umfasst10 Dateien, unveränderte SDK-freie Signierhilfe2, keinen privaten Schlüssel. Kein Store-Release und keine automatische Installation.

ZIP-SHA256: `d404822aa775c934637cfe11cce788d21ec9b8d614ddc80ea5618bee9311e9fe`.
