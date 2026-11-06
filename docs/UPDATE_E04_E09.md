# Gemeinsames Anker-Update E04–E09

**Aktueller Nachfolger:** [Korrekturupdate 1.3.0-rc.2](UPDATE_ROUTINEN_RC2.md) enthält alle E04–E09-Funktionen sowie die Routinen-Touchkorrektur und klare KI-Freigabehinweise. Die Anleitung darunter bleibt der historische RC1-Stand.

Version **1.3.0-rc.1, Code 8**. Alle Softwareetappen sind integriert. [CI21](https://github.com/frnkrm/anker/actions/runs/42289520357) bestätigt den vollständigen Lauf mit **139 Browserfällen**, Logiktests, TypeScript, Lint, PowerShell und Produktionsbuild. Lokal zusätzlich 87 native JUnit-Tests und der unsignierte Android-Releasebuild. Neue Handytests sind wie vereinbart noch offen.

## Auf deinem Windows-PC

Node und Java17+ genügen wie beim letzten Update; der Projektordner D:\Projekt\Anker und ein Android-SDK werden nicht benötigt. Der vorhandene Schlüssel bleibt auf deinem PC. Diesen Block in PowerShell ausführen – er lädt die ZIP, prüft sie, entpackt und signiert lokal und öffnet den Ausgabeordner:

```powershell
$ankerOrdner = Join-Path $env:USERPROFILE 'Downloads\Anker-E04-E09-rc1'
New-Item -ItemType Directory -Force -Path $ankerOrdner -ErrorAction Stop | Out-Null
$ankerZip = Join-Path $ankerOrdner 'Anker-E04-E09-Update.zip'
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e04-e09-rc1-20261106/Anker-E04-E09-Update.zip' -OutFile $ankerZip -ErrorAction Stop
if ((Get-FileHash -LiteralPath $ankerZip -Algorithm SHA256 -ErrorAction Stop).Hash -ne 'bff0a29aeaa9decd390001f1ff2de4306bb076f349c4cb5307ed844eff29b81e') { throw 'Die ZIP-Prüfsumme stimmt nicht. Bitte nicht fortfahren.' }
Expand-Archive -LiteralPath $ankerZip -DestinationPath $ankerOrdner -Force -ErrorAction Stop
Set-Location (Join-Path $ankerOrdner 'Anker-E04-E09-Update') -ErrorAction Stop
node .\signieren.mjs
if ($LASTEXITCODE -ne 0) { throw 'Signierung nicht abgeschlossen. Die Fehlermeldung oben bitte aufbewahren.' }
Invoke-Item -LiteralPath (Get-Location).Path
```

Danach **Anker-E04-E09-Update.apk** auf das Handy übertragen und über die bestehende Anker-App installieren. Anker installiert lassen, damit die Daten erhalten bleiben. Bei einer Signierfehlermeldung den Fehlertext aufbewahren und keine Schlüsseldateien weitergeben.

## Gemeinsam testen

**Mehr → Gemeinsam testen → Gemeinsamer Abschlusslauf → Station86**. Zuerst bekannte Routinen, Einstellungen und Spielstand vergleichen und eine neue Sicherung erstellen. Die zehn Stationen führen direkt zu den passenden Bereichen. Frühere Berichte bleiben erhalten; neue Ergebnisse werden nur durch deine bewusste Rückmeldung eingetragen.

KI und Google-Routes-Vorschläge sind implementiert, aber ohne bewusste Server-/Modell-/Kostenfreigabe nicht aktiviert. [Einrichtung und Grenzen](OPTIONALE_DIENSTE.md). Die lokalen Kernfunktionen bleiben nutzbar. PC-Stopp-Pausen benötigen das neue Windows-Paket aus der App und bei Servernutzung die pc-stop-Funktion mit Protokoll2; vorhandene alte PC-Installationen können ihren bisherigen Auftrag weiter ausführen. Der Handy-Updater installiert dieses PC-Paket nicht.

ZIP:22137167Bytes, SHA256 `bff0a29aeaa9decd390001f1ff2de4306bb076f349c4cb5307ed844eff29b81e`. Öffentlicher HTTPS-Download vollständig geprüft. Echte neue Android-/Windows-/Anbieterprüfungen sind durch die Softwaretests nicht ersetzt.
