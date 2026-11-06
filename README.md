# Anker E03 Update – 1.2.0-rc.5 / Build 7

[Update-ZIP herunterladen](Anker-E03-Update.zip?raw=true)

Auf dem Windows-PC PowerShell öffnen und diesen Block ausführen. Der bisherige Signierschlüssel bleibt auf deinem PC. Node und Java17+ genügen, Android-Buildwerkzeuge werden nicht benötigt.

```powershell
$ankerDir = Join-Path $env:USERPROFILE 'Downloads\Anker-E03'
$ankerZip = "$ankerDir.zip"
Invoke-WebRequest -UseBasicParsing 'https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e03-rc5-20261106/Anker-E03-Update.zip' -OutFile $ankerZip -ErrorAction Stop
if ((Get-FileHash -LiteralPath $ankerZip -Algorithm SHA256 -ErrorAction Stop).Hash -ne '8903450c1bf9a98d4e9d3e71c6ba3b24cb486274db1c2dc49f7564bdfa7ec5de') { throw 'Download-Prüfsumme stimmt nicht.' }
Expand-Archive -LiteralPath $ankerZip -DestinationPath $ankerDir -Force -ErrorAction Stop
Set-Location -LiteralPath (Join-Path $ankerDir 'Anker-E03-Update') -ErrorAction Stop
node .\signieren.mjs
if ($LASTEXITCODE -ne 0) { throw 'Signierung abgebrochen. Bitte die Fehlermeldung melden.' }
explorer.exe .
```

Danach **Anker-E03-Update.apk** aus dem geöffneten Ordner auf dein Handy übertragen und als Update installieren. Anker installiert lassen; dein Datenbestand gehört zur bestehenden App. Die unsignierte APK ist nur die Eingabe für den lokalen Helfer.

Neu: Aufgaben mit kleinen nächsten Schritten, optionalen Details und lokaler Zerlegung; Pause/Weiter beim Fokus; Entwürfe und Unterbrechungsnotizen bleiben erhalten; Wiedereinstieg nach längeren Pausen ohne automatischen Fortschrittsverlust. Fokuszeit ist keine Arbeitszeitbuchung, Zeitablauf ist keine Erledigung. Die bestehende Systemleistenkorrektur ist enthalten. Ein verspäteter Fokus-Puls wird bereits beim Beginn eines Seitenwechsels verworfen.

In der App: **Mehr → Gemeinsam testen → Aufgaben & Wiedereinstieg prüfen**. Beginne bei **Test 76**. Die Seite führt zu den passenden Bereichen und zurück. Du musst nicht alle 85 Fälle auf einmal prüfen. Bestehende Berichte bleiben erhalten; neue Fälle werden nicht automatisch abgehakt.

Automatisch geprüft:499 Logiktests,59 Browserfälle,73 Kotlin-Tests und Android-Release-Build. Neue Android-Geräteprüfungen bleiben offen. Quellen auf `main`, Appcommit `5c898a8`; Quellkennung `3b102c5d15afe9e4950e565697e811edb2d0e0bd9a8f832aacfb927b4d370a5b`. Paket umfasst10 Dateien, unveränderte SDK-freie Signierhilfe2, keinen privaten Schlüssel. Kein Store-Release und keine automatische Installation.

ZIP-SHA256: `8903450c1bf9a98d4e9d3e71c6ba3b24cb486274db1c2dc49f7564bdfa7ec5de`.
