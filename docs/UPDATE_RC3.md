# Anker-Update RC3

Version **1.3.0-rc.3 / Code 10** enthält die bisherigen E04–E09-Funktionen und die [gemeinsam geprüften Erweiterungen](UPDATEPRUEFUNG_RC3.md).

- Einstellungen: gleich breite Wertefelder, ausgerichtete Plus-/Minustasten, direkte Zeit-/Zahleingabe und sichtbare Einheiten. Schmale Ansichten und große Schrift wurden im Browser geprüft.
- Bildschirmabstand: erklärt Berechnung, manuelle PC-Zeit und ruhige Beschäftigung. Der sanfte Abendübergang ersetzt bereits die gewöhnlichen Abendhinweise.
- **Mehr → Zeitübersicht:** chronologische, kategorisierte Quellen und freiwillige Prüfvorschläge. Nichts wird selbst deaktiviert oder als erledigt markiert.
- **Jetzt:** nahe Arbeitszeiten und optionaler stummer Schlafhinweis nach bewusstem Start. Das Fenster braucht die Android-Freigabe „Über anderen Apps anzeigen“ und erscheint nur bei eingeschaltetem, entsperrtem Bildschirm. Android kann den automatischen Wechsel nach Jetzt begrenzen.
- **Mehr → Gemeinsam testen:** sechs empfohlene Stationen, frühere Berichte und Dateiaustausch mit Vorschau. Die vollständige Liste bleibt optional.
- Teilschritt-Timer, Audiofokus und Zustellung/Diagnose normaler Erinnerungen sind integriert. Timerablauf bucht keine Arbeit und erledigt keine Aufgabe.

## Dieses Update auf Windows vorbereiten

Node und Java 17+ genügen; kein Android-SDK und kein Projektordner nötig. Dein bisheriger Schlüssel bleibt bei diesem lokalen Weg auf deinem PC. Vor dem Update eine aktuelle Datensicherung und die Testberichte exportieren. Diesen gesamten Block in PowerShell einfügen:

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $ankerOrdner = Join-Path $env:USERPROFILE 'Downloads\Anker-RC3-Final'
  New-Item -ItemType Directory -Force -Path $ankerOrdner | Out-Null
  $ankerZip = Join-Path $ankerOrdner 'Anker-Update-RC3-Final.zip'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/frnkrm/anker/raw/refs/heads/download-anker-rc3-final-20261107/Anker-Update-RC3-Final.zip' -OutFile $ankerZip
  if ((Get-FileHash -LiteralPath $ankerZip -Algorithm SHA256).Hash -ne '81aaea7818d58e254aacb215ec681132267003119a92c61c649c8f3e27833142') { throw 'Die ZIP-Prüfsumme stimmt nicht. Bitte nicht fortfahren.' }
  Expand-Archive -LiteralPath $ankerZip -DestinationPath $ankerOrdner -Force
  Set-Location (Join-Path $ankerOrdner 'Anker-Update-RC3-Final')
  node .\signieren.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Signierung nicht abgeschlossen. Bitte die Fehlermeldung aufbewahren.' }
  $ankerApk = (Get-Item -LiteralPath '.\Anker-RC3-Update.apk').FullName
  Write-Host "Diese signierte Datei auf das Handy übertragen: $ankerApk"
  $ankerAuswahl = '/select,"' + $ankerApk + '"'
  Start-Process -FilePath 'explorer.exe' -ArgumentList $ankerAuswahl
}
```

Ausschließlich **Anker-RC3-Update.apk** auf das Handy übertragen und öffnen. **Anker-RC3-unsigniert.apk** ist die Eingabe für die Signierhilfe. Die bestehende App installiert lassen; bei „App nicht installiert“ den genauen Fehler aufbewahren und keine Daten löschen. Ein höherer Versionscode behebt kein abweichendes Zertifikat. Die alte Systemleisten-Datei ist kein aktuelles Update.

## Danach kurz prüfen und berichten

Unter **Mehr → Gemeinsam testen** die sechs empfohlenen Stationen auswählen. Ein Teilversuch darf „Teilweise“ bleiben. G96 begleitet den freiwilligen stummen Schlafhinweis; eigene Einschlafdauer nach dem Versuch wiederherstellen. „Wecker → So steht dein Wecker → Alltags-Erinnerungen“ zeigt einzelne Android-Kanäle auch dann, wenn die allgemeine Freigabe grün ist.

**„Testberichte als Datei exportieren“** erzeugt die JSON-Datei, die du vor dem nächsten Update hier senden kannst. **„Testberichte aus Datei prüfen“** öffnet erst die Importvorschau. Alte Berichte bleiben mit Originalversion, Gerät und Ergebnis erhalten; sie sind keine neu bestandenen Prüfungen. Eine Berichtsdatei ersetzt keine vollständige Datensicherung.

## Künftig ohne wiederkehrenden PC-Schritt

Der [manuelle GitHub-Updateweg](ANDROID_UPDATE_AUTOMATION.md) ist vorbereitet. Einmalig sind die lokale Einrichtung der vier geschützten GitHub-Secrets und die passende Anmeldung nötig. **Keystore und Passwörter nicht in den Chat senden.** Danach lässt sich der geprüfte Stand per Actions auch am Handy bauen, herunterladen und bewusst installieren. Ein leeres SHA-Feld wählt ausschließlich den freigegebenen Stand. Ein echter Signierlauf mit deinem Schlüssel wurde hier nicht ausgeführt.

[Google Play ist als nächster Verteilweg beschrieben](ANDROID_PLAY_ROADMAP.md), aber nicht eingerichtet oder veröffentlicht. Die bisherige Debug-Signatur ist kein fertiger Play-Releaseweg. Konto, Signierungsübergang, Storeangaben und reale Tester brauchen eine eigene Einrichtung; ein verlustfreier Übergang wird noch nicht versprochen.

## Nachweise und Grenzen

**853 Logiktests in 86 Dateien, 209 Browserfälle, 116 im selben Updateauftrag frisch ausgeführte native Modelltests, 19 PowerShell-Fälle und 34 Update-Mocktests bestanden.** Keine Skips oder Browserwiederholungen. Lint ohne Fehler (eine bestehende Warnung), erzwungener Typecheck, Produktionsbuild und Android-Releasebuild bestanden. [GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42384529210) prüft genau `20ee297dd7474ab500cc0d9f66396b60ad9141f8`. Die PowerShell-Befehle wurden syntaktisch mit PowerShell 7.5.4 geprüft; echte Windows-Signierung, Installation, Samsung-Fenster, Hörbarkeit und neue Geräteergebnisse bleiben offen. [Maschinenlesbarer Nachweis](UPDATEPRUEFUNG_RC3_NACHWEIS.json).

ZIP: 22207489 Bytes, SHA-256 `81aaea7818d58e254aacb215ec681132267003119a92c61c649c8f3e27833142`. Öffentlicher Download vollständig erneut gelesen und geprüft. Quellfingerabdruck `7582f7e48a17e66a5ffc4d8747049615fb98bacfc9a3fa1716f438bf2aa551c6`.
