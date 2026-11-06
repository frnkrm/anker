# Anker-Update: Routinen und KI-Freigabehinweise

Version **1.3.0-rc.2, Code 9** enthält alle bisherigen E04–E09-Funktionen. Routinen lassen sich am Griff mit dem Finger in beide Richtungen sortieren; außerhalb des Griffs bleibt die Seite scrollbar. Bearbeitete Texte, Dauern und Minimal-Versionen bleiben erhalten. Beim KI-Schalter stehen jetzt der konkrete Sperrgrund und der nächste Einrichtungsschritt direkt daneben.

**KI ist noch nicht eingerichtet:** Im ausgelieferten Build fehlt die Backend-Verbindung. Ein Kostenhäkchen genügt deshalb nicht zum Einschalten. Ein echter Dienst benötigt eine separate Server-/Anbietereinrichtung und deine Freigaben; dieses Update aktiviert ihn nicht. Die vorhandenen lokalen Teilschritte unter Arbeit funktionieren unabhängig davon.

## Auf deinem Windows-PC

Node und Java17+ genügen wie beim letzten Update. Der vorhandene Signierschlüssel bleibt auf deinem PC; Projektordner und Android-SDK werden nicht benötigt. Diesen Block in PowerShell ausführen:

```powershell
$ankerOrdner = Join-Path $env:USERPROFILE 'Downloads\Anker-Routinen-rc2'
New-Item -ItemType Directory -Force -Path $ankerOrdner -ErrorAction Stop | Out-Null
$ankerZip = Join-Path $ankerOrdner 'Anker-Routinen-Update.zip'
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/frnkrm/anker/raw/refs/heads/download-anker-routinen-rc2-20261107/Anker-Routinen-Update.zip' -OutFile $ankerZip -ErrorAction Stop
if ((Get-FileHash -LiteralPath $ankerZip -Algorithm SHA256 -ErrorAction Stop).Hash -ne '827cf2474f99deca37d080777fde164fc8e162e44474ccd4a784321b1203f1b4') { throw 'Die ZIP-Prüfsumme stimmt nicht. Bitte nicht fortfahren.' }
Expand-Archive -LiteralPath $ankerZip -DestinationPath $ankerOrdner -Force -ErrorAction Stop
Set-Location (Join-Path $ankerOrdner 'Anker-Routinen-Update') -ErrorAction Stop
node .\signieren.mjs
if ($LASTEXITCODE -ne 0) { throw 'Signierung nicht abgeschlossen. Die Fehlermeldung oben bitte aufbewahren.' }
Invoke-Item -LiteralPath (Get-Location).Path
```

Danach **Anker-Routinen-Update.apk** auf das Handy übertragen und über die vorhandene Anker-App installieren. Anker installiert lassen, damit deine Daten erhalten bleiben.

## Direkt in der App prüfen

**Mehr → Gemeinsam testen → Gemeinsamer Abschlusslauf → Station95.** Dort öffnen „Morgenroutine sortieren“ und „Abendroutine sortieren“ die passenden Einstellungen. Am Griff **⋮⋮ halten, nach unten ziehen und loslassen**, anschließend wieder nach oben. Außerhalb des Griffs soll Wischen scrollen. Seite erneut öffnen und Reihenfolge, Texte, Dauern und Minimal-Versionen vergleichen. ▲/▼ bleiben als Alternative verfügbar. Für die alleinige Sortierprüfung passt „Teilweise“; die weiteren Teile von G95 müssen dafür nicht als bestanden markiert werden.

**Station93** führt zu den optionalen Vorschlägen. Ohne eingerichteten Dienst kannst du die Erklärung und den lokalen Weg prüfen; das ist kein Nachweis einer echten KI-Anfrage. Frühere Testergebnisse bleiben erhalten, neue Häkchen entstehen nur durch deine eigene Rückmeldung.

## Nachweise

Quellkennung `b131b9b89e3d27fede35ec7d699950385d1917f2881e4445647fb7d46cb783f2`. **785 Logiktests und alle156 Browserfälle bestanden**, darunter13 Touch-/Maus-/Tastaturfälle sowie vier neue und sechs bestehende KI-Browserfälle. Keine Skips oder Retries. GitHub-CI wird nach Push geprüft. Android-Releasebuild, Paketkennung/Version, alle67 Webdateien, 16KB-Ausrichtung und unveränderte Signierhilfe geprüft. Native Kotlin-/Ressourcen-/Manifest-/Testquellen unverändert; die87 früheren nativen JUnit-Ergebnisse sind ein Vorbeleg, kein neuer RC2-Gerätetest. Windows-Signierung, Android-Installation und echte Anbieter wurden in dieser Cloud nicht ausgeführt.

ZIP:22137311Bytes, SHA256 `827cf2474f99deca37d080777fde164fc8e162e44474ccd4a784321b1203f1b4`. Öffentlicher Download wird vor der Auslieferung vollständig geprüft.
