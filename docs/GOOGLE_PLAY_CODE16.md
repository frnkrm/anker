# Anker: erster Google-Play-Upload

**Nachtrag 10.11.2026:** Nutzer bestätigt inzwischen die angelegte Play-App und das Repository-Secret. Der [neue Uploadworkflow](GOOGLE_PLAY_UPLOAD_WORKFLOW.md) ist implementiert und lokal geprüft; ein tatsächlicher Google-Upload wird erst nach dessen Runner-Ergebnis bestätigt. Die Zugriffs-/Kontoangaben vom 9. November darunter bleiben der historische Vorbereitungsstand.


Stand 9. November 2026: **Bundle vorbereitet und signiert; noch nicht zu Google hochgeladen.** Das Entwicklerkonto ist laut Nutzer vorhanden, Anker noch nicht angelegt. Es wurden keine App, kein Testrelease, keine Play-App-Signing-Aufnahme und keine kostenpflichtige Aktivierung im Google-Konto vorgenommen.

[Geprüftes Uploadpaket herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-play-code16-20261109). ZIP entpacken; die Datei **Anker.aab** ist für den Upload in die Play Console bestimmt. Das bisherige [APK-Update](UPDATE_CODE16.md) bleibt separat verfügbar.

## Einmalige Schritte im Konto

1. [Google Play Console](https://play.google.com/console/) öffnen und Anker als neue App anlegen. Vorgeschlagen: Name **Anker**, Standardsprache **Deutsch**, Typ **App**, kostenlos. Konto- und Vertragsangaben muss der Kontoinhaber anhand der tatsächlichen Console prüfen.
2. Bei der App-Signierung den **bestehenden B4-App-Signierschlüssel** erhalten, damit spätere Play-Updates zur bisherigen Installation passen. Das signierte AAB allein überträgt diesen Schlüssel nicht an Google. Die tatsächlich angebotene Übernahmeoption zuerst prüfen.
3. Falls Google die Übernahme über PEPK verlangt: erst die Vorgaben und den Verschlüsselungsschlüssel aus der eigenen Console lesen. Ein PEPK-Export enthält verschlüsseltes privates Schlüsselmaterial und gehört in einen geschützten Übertragungsweg zu Google, nicht in dieses ZIP oder ein öffentliches Repository. Noch kein solcher Export oder Transfer ausgeführt.
4. Für den ersten Versuch ist ein **interner Test als Entwurf** vorgesehen. Dort nach geklärter App-Signierung **Anker.aab** auswählen. Upload, Kontoannahme, Testfreigabe und öffentliche Veröffentlichung sind getrennte Ergebnisse; bislang ist keines davon in Google bestätigt.

Öffentlicher B4-Fingerabdruck: `B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A`. Uploadschlüssel und App-Signierschlüssel haben unterschiedliche Rollen. Eine automatisch neu erzeugte App-Signierungsidentität wäre nicht dieselbe wie die bisherige Installation. Der vorhandene private Schlüssel bleibt geschützt; das Downloadpaket enthält nur Bundle, Anleitung und öffentliche Signaturdaten.

## Tatsächliche technische Prüfung

**Anker 1.5.0-rc.2 / Code16**, Paket `de.frnkrm.anker.mobile`, Quelle `4d8eaa1cd1dc463e3ce9032779d857a215d020fc`; gleicher App-Code und gleiche Laufzeitkennung wie im geprüften Code16-APK. Kein Versions-, Paket- oder Funktionswechsel.

- `bundleRelease` erfolgreich; echtes cached **Bundletool 1.18.1** validiert unsigned und signiertes AAB. Manifest, Ressourcen und BundleConfig geprüft.
- Alle **68 Webdateien**, drei DEX und 16 JNI-Dateien bytegleich zum geprüften APK. Acht ELF64-Bibliotheken unterstützen 16KB; BundleConfig verlangt `PAGE_ALIGNMENT_16K`. Die tatsächlich von Play erzeugten Split-APKs sind noch nicht geprüft.
- JAR-Signierung mit bestehendem B4, `SHA256withRSA` und SHA-256. Unabhängiger Java-JarFile-Streamcheck bestätigt die Signatur und unveränderten Bytes aller **669 ursprünglichen Dateien**. Kein `apksigner` zum Signieren des AAB verwendet.
- **197 Android-JUnit ausdrücklich wiederverwendet**, nicht erneut ausgeführt: Quell-, Test-, Native- und Webinputs sind unverändert an den erfolgreichen Code16-Lauf gebunden. [CI mit 1.095 Logik-/271 Browserfällen](https://github.com/frnkrm/anker/actions/runs/42619085381) und [Code16-Nachweise](ANKER_CODE16_NACHWEIS.json) behalten ihren ursprünglichen Bezug.
- Öffentlichen ZIP-Download vollständig in Chromium mit TLS-Prüfung gespeichert; CRC und alle drei Dateien bytegleich geprüft. Keine Google-Annahme und kein echter Play-Installationsnachweis daraus abgeleitet.

AAB: **22655691 Bytes**, SHA256 `522e3feb9dbfd8a146dec903dff3e496fc50d4e5a8cead72a5a43bc85964d76e`. ZIP: **22413675 Bytes**, SHA256 `83dd8f20bfd688e2faedd2aefd7a5f309869a9293a7fc4e56adfa33145913f2a`. [Maschinenlesbarer Nachweis und offener Uploadstatus](PLAY_CODE16_VORBEREITUNG.json).

## Aktueller Zugriffsblocker

Die Cloud-Umgebung hat keine eingerichtete Google-Identität; die vorhandene ADC-Datei enthält keine Anmeldedaten. Zugriffe auf `play.google.com` und `androidpublisher.googleapis.com` scheitern bereits am Netzwerkproxy mit CONNECT 403. Ein gemeinsames Browser-Bedienwerkzeug wird in diesem Chat nicht angeboten. Das ist kein abgelehnter Google-Upload: es wurde kein authentifizierter Upload versucht.

Die benötigten Google-Adressen sind als **Netzwerkentwurf gespeichert**, noch nicht angewendet. Für einen direkten Zugriff muss der Nutzer den Entwurf in den Umgebungseinstellungen prüfen, speichern und die Umgebung veröffentlichen. Danach müssen Netzwerkzugang und ein sicher eingerichteter Kontozugriff neu geprüft werden; eine Netzwerkfreigabe allein meldet kein Google-Konto an. Passwörter, Anmeldecodes und private Schlüssel gehören nicht in den Chat.

Storeangaben, öffentliche Datenschutzerklärung/Kontakt, Health- und Hintergrunddeklarationen sowie weitere kontospezifische Verteilungsvoraussetzungen bleiben vor einer tatsächlichen Freigabe in der Console zu klären. Es wurde keine Erklärung mit erfundenen Angaben übermittelt. Die [frühere Roadmap](ANDROID_PLAY_ROADMAP.md) bleibt historisch; ihr alter Debug-Signierungsblocker trifft auf das heutige B4-Releasezertifikat nicht zu.
