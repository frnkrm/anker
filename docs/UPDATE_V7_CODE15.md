# Anker v7 – Update Code15

**Verfügbar:** Version **1.5.0-rc.1 / Code15**, weiterhin **Anker**, Paket `de.frnkrm.anker.mobile` und derselbe geprüfte Release-Schlüssel wie Code14.

- [Handyupdate als ZIP herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-v7-code15-20261109) – 22.357.013 Bytes.
- [Windows-PC-Begleiter herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-pc-v7-20261109) – 55.795 Bytes, Quellpaket.

Beide ZIPs wurden vollständig in Chromium gespeichert, CRC und jede enthaltene Datei mit dem veröffentlichten Stand verglichen. Die Installation auf deinem Galaxy und Windows-PC bleibt ein eigener Versuch. Quellstand `0c3ac21a537fa95e686de53ab95ca4476af9d39c`, [vollständig grüne CI](https://github.com/frnkrm/anker/actions/runs/42607136664), [Gesamtnachweis](ANKER_V7_UPDATE_NACHWEIS.json).

## Auf dem Handy aktualisieren

1. Das APK-Paket vollständig herunterladen und entpacken.
2. **Anker.apk** antippen und **Aktualisieren** bestätigen. Die installierte Anker-App behalten; eine Deinstallation ist für dieses Update nicht vorgesehen.
3. Anker öffnen: **Mehr → Einstellungen → Zusätzliche Werkzeuge → Test- und Entwicklerwerkzeuge anzeigen** einschalten. Darunter **Gemeinsam testen → v7 gemeinsam ausprobieren · 7 Stationen** wählen und mit G97 beginnen. Alte Berichte bleiben erhalten; nur eigene Beobachtungen bestätigen.

Das Update verwendet denselben Release-Schlüssel wie Code14. Android prüft die Signatur zusätzlich beim Installieren. Falls „App nicht installiert“ erscheint, die vorhandene App behalten und die genaue Meldung sowie ihre unter **Über Anker** angezeigte Version notieren.

## Was enthalten ist

- Freiwillige Abend-/Morgenbegleitung mit Zustandsfarben, sichtbarer Restzeit, lokaler Schrittstimme und Vibrationsimpulsen.
- Direkter Morgenfokus nach dem bestätigten Hauptwecker, Wachrückfrage und bewusst gewählte Zombie-Kernschritte. Ein Timer erledigt keine Routine.
- Abendphasen, Gedankenparkplatz, QR-Übergang und stoppbares Brown Noise. Offene Morgenschritte verdrängen später keinen neuen Abend.
- Lokaler PC-Begleiter mit bestätigten Plänen, Speicherpunkt und sichtbarem Countdown. Strenger Modus, Audioeingriffe und PC-Aktionen benötigen eigene Schalter.
- Optionaler Abendlichthinweis und Entlastung der Handy-PC-Erinnerungen ausschließlich bei passender PC-Bestätigung. Bett-Erinnerung und Wecker bleiben unabhängig.
- Freiwillige Schlafvorschläge aus Health Connect: eigene Lesefreigabe, lokale Anzeige und bewusste Übernahme in leere Nächte. Keine automatische Erfassung, Schlafphasenbewertung oder Überschreibung eigener Angaben.

Die neuen Eingriffe und Gesundheitsdaten-Freigaben beginnen ausgeschaltet. Frühere Routinen, Einstellungen, Spielstände, IDs und Berichte werden erhalten.

## Windows-Begleiter

Das separate Windows-Paket enthält die Python-Quellen und eine Einrichtungshilfe. Windows und Python einschließlich Tcl/Tk sind erforderlich; es ist kein signierter EXE-Installer. Nach dem Entpacken **Einrichten.cmd** starten. Der Begleiter installiert sich im eigenen Benutzerprofil, verändert keine globale Ausführungsrichtlinie und öffnet keine Firewallregel von selbst.

Für eine Aktualisierung den laufenden Begleiter zuerst über **Beenden** schließen und danach die Einrichtung des neuen Pakets ausführen. Die vorhandenen lokalen Daten und die benutzergebundene Kopplung liegen außerhalb der Programmdateien und bleiben erhalten. Einrichtung, Firewall für private Netzwerke und Kopplung sind in [PC_BEGLEITER.md](PC_BEGLEITER.md) erklärt.

## Gemeinsam prüfen

Die sieben bestehenden Stationen G97–G103 decken Installation/Kopplung, Darstellung, Morgen, Stimme/Vibration, Abend, PC und lokale Daten ab. Eine nicht gewählte Option muss nicht ausprobiert werden. **Teilweise** ist ein gültiger Bericht; es werden keine Prüfungen automatisch als bestanden markiert. Testberichte lassen sich weiterhin als Datei exportieren und mit ursprünglichem Buildbezug wieder einlesen.

Automatische Nachweise stehen im [Testprotokoll](ANKER_TESTNACHWEISE.md). Echte Galaxy-S26-Ultra-/Windows-/LAN-/Audio-/Standby-Beobachtungen bleiben bis zum tatsächlichen Versuch offen. Relay außerhalb des Heimnetzes, neue Licht-Hardware, kostenpflichtige Dienste und ein automatischer Windows-Updatekanal werden nicht eingerichtet.

## Prüfsummen

| Datei | SHA256 |
|---|---|
| Enthaltene `Anker.apk` | `03f79fa2cfd7758c14cedf9f33bf4a65c8f55cbde2faf9c06654e1c580d59496` |
| Vollständig heruntergeladene Handy-ZIP | `015626940e6997f898b280532a6823f194caa5bd712c1f8205da2c6273b2c626` |
| Vollständig heruntergeladene PC-ZIP | `af42238112aa8377eafa4792bd9adfee08cf2ed3613bd0d00a7fea5d3dea2b16` |

Öffentliches Signaturzertifikat: `B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A`. APK-Name/-Version, v2/v3, zusätzliche JAR-Signatur und 16-KB-Ausrichtung sind geprüft. Die private Schlüsseldatei ist kein Paketbestandteil.
