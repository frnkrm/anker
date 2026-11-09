# Anker v7 – Update Code15

**In Vorbereitung:** Version **1.5.0-rc.1 / Code15**, weiterhin **Anker** und `de.frnkrm.anker.mobile`. Downloadlinks werden erst nach erfolgreicher Gesamtprüfung, Signaturprüfung und vollständig nachgelesenem Download freigegeben. Der bisherige Code14-Download enthält v7 nicht.

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
