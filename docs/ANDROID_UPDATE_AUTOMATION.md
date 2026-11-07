# Android-Updates manuell in GitHub Actions bauen

Stand: 7. November 2026. Vorbereitet ist ein ausschließlich manuell gestarteter APK-Build. Es wurden **keine privaten Schlüssel übertragen, keine Secrets eingerichtet und kein Workflow gestartet**. Echtes Signieren mit dem Nutzerschlüssel, Installation auf dessen Handy und Play-Verteilung sind noch nicht geprüft.

Nach einmaliger bewusster Einrichtung am PC kann GitHub ein signiertes APK bauen, das sich mit GitHub-Anmeldung am Handy herunterladen lässt. Pro Update ist dann kein PC nötig. Android verlangt weiterhin eine Installationsbestätigung. Die App installiert keine Updates selbst; der Workflow veröffentlicht keine Releases, Tags, Webseiten oder Play-Pakete und läuft weder bei Push noch bei Pull Requests automatisch.

## Was der Workflow prüft

`.github/workflows/android-update.yml` läuft nur mit `workflow_dispatch` auf dem Branch `main`. Sein Pflichtfeld `source_commit` verlangt die vollständige 40-stellige SHA eines bereits erfolgreichen **push-CI-Laufs auf main**. Der Commit muss zur aktuellen main-Historie gehören. Die Prüfhilfe muss in diesem Commit vorhanden sein; ältere Commits vor Einführung des Workflows werden früh mit einer verständlichen Anleitung abgelehnt.

Ein nachträglicher Dokumentationscommit mit `[skip ci]` hat oft keinen eigenen grünen CI-Lauf. In diesem Fall die SHA des gewünschten früheren grünen Codecommits angeben. Gebaut wird exakt dieser frühere Stand einschließlich seiner Dokumente. Es gibt keine pauschale Markdown-Ausnahme. Insbesondere **`GERAETETEST.md` ist ein Buildinput** des Gerätekatalogs: Soll eine Änderung daran im APK enthalten sein, benötigt der entsprechende Commit einen eigenen erfolgreichen CI-Lauf. Der Workflow setzt nicht still den neuesten main-Stand mit einem älteren CI-Nachweis gleich.

Die bestehende CI liefert für den ausgewählten Commit Lint-, TypeScript-, Unit-, PC- und Browsertests. Sie wird nicht vollständig doppelt ausgeführt. Der neue Buildjob prüft zusätzlich seine Hilfsskripte mit künstlichen Daten, baut unter Node 24/JDK 21 die Produktionsassets neu, synchronisiert Capacitor und führt beide AAR-Metadatenprüfungen, beide Kotlin-Kompilierungen, die vollständige Debug-JUnit-Suite und das unsignierte Release neu aus. JUnit-Ergebnisse müssen nach Beginn dieses Builds entstanden sein, ohne Fehler oder übersprungene Fälle; jede vorhandene native `*Test.kt`-/`*Test.java`-Klasse muss im Bericht vorkommen.

Die Prüfhilfe vergleicht Paketkennung `de.frnkrm.anker`, Versionsname und Versionscode mit den eingecheckten Defaults in `package.json` und `android/app/build.gradle`, API 26/36/36, Quellfingerabdruck und sämtliche Produktionsassets mit dem APK. ZIP-Ausrichtung und 16-KB-ELF-Loadsegmente werden geprüft. Die Appversion wird durch den Workflow nicht verändert. Für ein späteres Update müssen die beabsichtigte Version und der Versionscode vorher im geprüften Quellstand stehen.

Der Signierjob läuft auf einem **anderen Runner**. Er verwendet keinen Checkout, kein npm, kein Gradle und keine Programme aus dem Buildartefakt. Nur `unsigned.apk` und `build-proof.json` werden übergeben; ihre SHA-256-Prüfsummen sind an die Buildjob-Ausgaben gebunden. Paketmetadaten, CI-/JUnit-Nachweise und ZIP-Ausrichtung werden dort erneut geprüft. Die Signierung nutzt die offiziellen Android-Buildtools und kleinen Inline-Code des Workflows. Build-/Installationsprozesse aus npm können deshalb nicht auf später im selben Runner verfügbare Signiersecrets warten.

| Konfiguration im Repository | Ergebnis |
| --- | --- |
| Alle vier Signiersecrets fehlen | Klar als `UNSIGNIERT` bezeichnetes APK; noch nicht installierbar. |
| Nur ein Teil ist vorhanden | Abbruch, kein fertiges Updateartefakt. |
| Alle vier vorhanden, aber falsches Zertifikat/Passwort oder ungültiger Keystore | Abbruch; bei abweichendem Zertifikat schon vor der Signierung. |
| Alle vier vorhanden und Signaturprüfung erfolgreich | APK mit `SIGNIERT` im Namen und öffentlichem Prüfbericht. Kompatibilität mit der tatsächlich installierten App bleibt separat zu prüfen. |

Vor und nach der Signierung muss exakt dieses öffentliche SHA-256-Zertifikat passen:

```text
3F:75:45:F5:DD:8E:4F:8A:87:BE:F3:86:96:FB:16:28:4B:02:A2:D7:83:A0:F4:A3:5F:3B:2B:D0:84:D3:EA:AD
```

## Einmalige Einrichtung am eigenen PC

Dieser Schritt bleibt eine bewusste lokale Nutzeraktion. Der private Keystore liegt bisher nur beim Nutzer; die Cloud hat ihn nicht erhalten. Der öffentliche Fingerabdruck oben ist nur eine Identifikation des Zertifikats und enthält keinen privaten Schlüssel. Er kann weder ein APK signieren noch den Keystore ersetzen.

Voraussetzungen: PowerShell **7.2 oder neuer** (`pwsh`), Java mit `keytool`, aktuelle offizielle GitHub CLI (`gh`), Anmeldung mit `gh auth login` und Berechtigung, Actions-Secrets im richtigen Repository zu setzen. Den überprüften aktuellen Repositorystand lokal verwenden und die lesbare Datei `scripts/setup-android-signing.ps1` vor dem Start ansehen. Das Skript erzeugt keinen neuen Schlüssel.

Der folgende Aufruf enthält nur öffentliche Angaben und den lokalen Dateipfad. **Keine Passwörter an den Aufruf anhängen.** Falls der vorhandene Keystore oder Alias anders heißt, nur diese beiden Angaben anpassen:

```powershell
pwsh -NoProfile -File .\scripts\setup-android-signing.ps1 `
  -Repository frnkrm/anker `
  -KeystorePath "$env:USERPROFILE\.android\debug.keystore" `
  -KeyAlias AndroidDebugKey
```

Das Skript fragt die beiden Passwörter mit `Read-Host -AsSecureString` ab und prüft zuerst lokal das öffentliche Zertifikat. Bei abweichendem Fingerabdruck überträgt es nichts. Die GitHub CLI erhält vier Werte ausschließlich über umgeleitetes **stdin**, verschlüsselt die Secretwerte clientseitig für das Repository und überträgt sie über ihre authentifizierte API-Verbindung:

| Secretname | Inhalt |
| --- | --- |
| `ANKER_ANDROID_KEYSTORE_BASE64` | Base64 der bestehenden Keystoredatei. Base64 selbst ist keine Verschlüsselung; GitHub-Secretverschlüsselung schützt die Übertragung/Aufbewahrung. |
| `ANKER_ANDROID_STORE_PASSWORD` | Passwort des bestehenden Keystores. |
| `ANKER_ANDROID_KEY_ALIAS` | Alias des vorhandenen Schlüssels. |
| `ANKER_ANDROID_KEY_PASSWORD` | Passwort dieses Schlüssels. |

Keine dieser Angaben gehört in Chat, Zwischenablage, Repository, Shell-Befehlsargumente oder Logs. Das Skript schreibt keine temporäre Datei mit Secretwerten. Werkzeugsfehler werden ohne deren möglicherweise sensible Ausgaben gemeldet. Java erhält das Passwort über eine ausschließlich für den Kindprozess gesetzte Umgebungsvariable. Für die lokale Übergabe sind kurzzeitig Klartextwerte im Prozessspeicher erforderlich; eine vollständige Löschung verwalteter Zeichenketten aus dem Speicher wird nicht versprochen.

**Nach diesem vom Nutzer ausgeführten Schritt existiert zusätzlich eine verschlüsselte Keystorekopie bei GitHub. Der private Schlüssel bleibt dann nicht ausschließlich auf dem PC.** Der signierende Actions-Runner entschlüsselt sie vorübergehend, legt sie in einem privaten temporären Verzeichnis mit Dateimodus 0600 ab und entfernt dieses Verzeichnis anschließend. Nur der Signierschritt erhält die Secrets. Das Original am PC wird nicht verändert; eine gesicherte Offline-Kopie bleibt erforderlich. Repositoryzugriff und die Möglichkeit, vertrauenswürdige Workflows auf main zu ändern, müssen entsprechend geschützt bleiben.

Die vier Secret-Uploads erfolgen nacheinander. Ein Abbruch kann eine unvollständige Konfiguration hinterlassen; dann den sicheren lokalen Einrichtungsschritt vollständig erneut ausführen. Der Workflow lehnt Teilkonfigurationen ab. Keinen Schlüssel zur Fehlerbehebung neu erzeugen und keine Secretwerte zur Prüfung hierher schicken.

## Ein Update ohne PC herunterladen

1. Nach Integration dieses Workflows und erfolgreicher CI auf main den gewünschten grünen Lauf unter **Actions → CI** öffnen. Die vollständige Commit-SHA kopieren; nötigenfalls im verlinkten Commit die volle SHA anzeigen lassen. Ein grüner Feature-Branch-Lauf oder verkürzte SHA genügt nicht.
2. **Actions → Android-Update manuell bauen → Run workflow** öffnen, Branch `main` wählen und die SHA in `source_commit` eintragen. Dieser Start erteilt keine Veröffentlichungsfreigabe.
3. Nach erfolgreichem Lauf das endgültige Artefakt **`Anker-Android-Update-…`** herunterladen. Das kurzlebige Artefakt `ANKER-INTERN-UNSIGNIERT-…` ist nur die interne Übergabe und kein Handy-Update.
4. Mit GitHub-Anmeldung und passendem Repositoryzugriff funktioniert der Artefaktdownload auch im mobilen Browser. GitHub liefert eine ZIP: im Dateimanager entpacken, `INSTALLATION.txt` und `build-proof.json` ansehen und ausschließlich die beabsichtigte signierte APK öffnen. Finale Artefakte werden sieben Tage aufbewahrt; bei Bedarf einen neuen manuellen Lauf starten.
5. Paket, Versionscode und öffentliches Zertifikat mit der installierten App vergleichen. Die vorhandene App installiert lassen. Android fragt nach der Installationsbestätigung und gegebenenfalls der Installationsberechtigung des verwendeten Browsers/Dateimanagers. Diese Berechtigung nur für den bewusst gewählten Installationsweg verwenden.

Der Bericht enthält Quellcommit, CI-Link, Versionscode, Quellfingerabdruck, JUnit-/Assetbelege und APK-Prüfsumme. Er enthält keine Passwörter und keinen privaten Keystore. Eine gültig signierte Datei ist noch kein Beweis für erfolgreiches Aktualisieren auf einem unbekannten Gerät.

## Wenn Android „App nicht installiert“ meldet

Die frühere Systemleisten-Datei war als unsignierte Eingabe plus separat lokal zu erzeugende signierte Ausgabe vorbereitet. Aus der Cloud ist nicht feststellbar, welche Datei damals geöffnet wurde. Außerdem sind der installierte Versionscode, dessen Zertifikat, freier Speicher und die Android-/Herstellervorgaben unbekannt.

Die vorhandene App **nicht deinstallieren und keine Appdaten löschen**, um den Fehler zu umgehen. Zuerst Dateiname/Prüfbericht, tatsächliche Signatur, `de.frnkrm.anker`, installierten und neuen Versionscode sowie den genauen Installationsfehler vergleichen. `INSTALL_FAILED_VERSION_DOWNGRADE` und `INSTALL_FAILED_UPDATE_INCOMPATIBLE` verlangen unterschiedliche Korrekturen. Ein späterer lokaler ADB-Befund kann nötig sein; er wurde hier nicht erhoben. Ein höherer Versionscode repariert kein falsches Zertifikat. Details einschließlich datenschonender Diagnose und Play-Grenzen stehen in [ANDROID_PLAY_ROADMAP.md](ANDROID_PLAY_ROADMAP.md).

## Getestet und noch nicht nachgewiesen

Die neue Offline-Testsuite wird mit `python3 scripts/test-android-update.py` ausgeführt. PowerShell 7.2+ muss für die beiden Secret-Übergabetests im PATH liegen; lokal kann `PWSH_PATH` auf die geprüfte Laufzeit gesetzt werden. Der Actions-Build verlangt vorhandenes `pwsh`, damit diese Tests dort nicht übersprungen werden. Die Tests verwenden ausschließlich künstliche Werte und Mockwerkzeuge: JSON-/Versions-/API-Grenzen, exakter CI-Commit, fehlender CI-/Helpernachweis, neue vollständige JUnit, manipulierte Assets, 16-KB-Ausrichtung, Artefaktdigests, Teilkonfiguration, abweichendes Zertifikat, Secretübergabe ausschließlich über stdin, redigierte Werkzeugfehler und separate Runner werden geprüft.

Zusätzlich werden YAML, die beiden Inline-Pythonblöcke, Python-AST und der PowerShell-Parser geprüft. **Parser-, AST-, Shell- und Mocktests ersetzen weder eine echte kryptografische Signierung noch einen tatsächlichen Actions-/Geräte-/Storetest.** Der erste reale manuelle Lauf nach Integration und gegebenenfalls der bewussten lokalen Secret-Einrichtung bleibt offen. Ein neues APK erhält keine historischen Geräteprüfungen als vorgeblichen eigenen Nachweis.

Lokaler Befund am 7. November 2026: **27/27 Offline-/Mocktests erfolgreich, keine übersprungen**, unter Python 3 und PowerShell 7.5.4. YAML mit separater Trigger-/Berechtigungsprüfung, Python-/Inline-AST und PowerShell-Parser erfolgreich. Keine Netzwerk-Secretübertragung und kein echtes Signing in diesen Tests.

## Verwendete offizielle Actions

Die Tags wurden am 7. November 2026 direkt mit `git ls-remote` bei den offiziellen GitHub-Repositories aufgelöst. Der Workflow verwendet die vollständigen Commit-SHAs:

| Offizielle Action / geprüfter Tag | Gepinnte SHA |
| --- | --- |
| [actions/checkout v6](https://github.com/actions/checkout) | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| [actions/setup-node v6](https://github.com/actions/setup-node) | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| [actions/setup-java v5](https://github.com/actions/setup-java) | `b6effb05e454b25005698d916606bdc6ffcbf961` |
| [gradle/actions v5](https://github.com/gradle/actions) | `4c125117fe7c5aed11272ec4213f602f012f89f2` |
| [actions/upload-artifact v6](https://github.com/actions/upload-artifact) | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` |
| [actions/download-artifact v6](https://github.com/actions/download-artifact) | `018cc2cf5baa6db3ef3c5f8a56943fffe632ef53` |

Die Buildtools sind auf `35.0.0`, die Plattform auf `android-36`, Java auf Major 21 und Node auf Major 24 festgelegt. Der GitHub-Runner und SDK-/Java-Distributionen bleiben externe Buildwerkzeuge; bitidentische Builds über beliebige zukünftige Runner werden nicht zugesagt. GitHub-Dokumentation: [workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch), [Artefaktdownload](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/downloading-workflow-artifacts), [gh secret set](https://cli.github.com/manual/gh_secret_set), [verschlüsselte Secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

Für Play gibt es ausschließlich die getrennte [Roadmap](ANDROID_PLAY_ROADMAP.md): Konto-/Kostenentscheidung, aktuelle Google-Regeln, Gesundheits-/Datenschutzangaben, echte Tests und insbesondere der Übergang vom bisherigen Debugzertifikat zu Play App Signing sind offen. APK-Signierung und ein neuer Uploadschlüssel allein versprechen keinen nahtlosen Store-Updatepfad.
