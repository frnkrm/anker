# Anker PC-Begleiter

Lokaler Windows-Begleiter für Anker. Das Handy bleibt der Planer; der PC zeigt
bestätigte Zeitpunkte, begleitet den Abend und führt nur ausdrücklich freigegebene
Aktionen aus. Python 3.11 oder neuer, Windows 10/11, kein Konto und kein Server nötig.
Der bisherige PowerShell-PC-Stopp bleibt eine getrennte Alternative.

## Einrichten

1. Python **3.12 von python.org** mit Tkinter installieren (mindestens 3.11).
   Das komplette Quellpaket-ZIP in einen neuen Ordner entpacken und dort
   **Einrichten.cmd** doppelklicken. Die Einrichtung prüft Dateihashes, Python/Tk,
   Protokoll und eine eventuell laufende Instanz vor dem Austausch. Sie installiert
   in `%LOCALAPPDATA%\AnkerPcCompanion\app`, ohne Administratorrechte, und richtet
   die Aufgabe **Anker PC-Begleiter** bei Anmeldung ein. Alternativ lässt
   `Einrichten.cmd -NoAutostart` den Autostart aus. Die PowerShell-Ausführungsrichtlinie
   gilt nur für diesen Prozess; keine Systemeinstellung wird geändert.
2. **Start.cmd** im entpackten Downloadordner oder Installationsordner öffnen.
   Das Startskript findet die installierte Laufzeit auch vom Downloadordner aus.
   Bei der Windows-Firewall
   ausschließlich **private Netzwerke** zulassen. Port **47830/TCP** und lokales
   mDNS **5353/UDP** müssen im Heimnetz erreichbar sein; keine Routerfreigabe nötig.
3. **Mit Handy koppeln** wählen, den QR-Code unter **Anker → Mehr → Abend & Alltag → PC-Stopp → Lokaler PC-Begleiter**
   scannen und den gleichen vierstelligen Prüfcode am PC bestätigen.
4. Zuerst **Testabend** wählen. Der Test dauert zwei Minuten und löst keine
   Windows-Sperre, kein Herunterfahren und keine Audioänderung aus.
5. Gewünschte Funktionen selbst einschalten: PC-Aktionen, strenger Nachtmodus,
   Bildschirmdämmerung und Audio-Absenkung beginnen ausgeschaltet. Die Auswahl
   am PC und die Freigabe im Handy müssen zusammenpassen.

Das Paket ist Quellcode mit Start-/Einrichtungsskripten, kein signierter
Windows-Installer. SmartScreen oder Smart App Control können unbekannte Programme
blockieren. Eine kostenpflichtige Signierung wurde nicht eingerichtet.
Für die Installation der festgelegten Python-Abhängigkeiten wird einmal Internet
benötigt. Die eigentliche Kopplung und Benutzung bleiben im eigenen Heimnetz.

## Aktualisieren

1. Im Fenster oder Tray des Begleiters **Beenden** wählen. Die Einrichtung beendet
   keinen laufenden Prozess und verweigert den Austausch, solange er noch läuft.
2. Das neue ZIP aus dem bereitgestellten Anker-Download in einen **neuen leeren
   Ordner** entpacken. Falls die `.sha256`-Datei vorliegt, lässt sich der ZIP-Hash
   mit `Get-FileHash .\Anker-PC-Begleiter-0.1.1.zip -Algorithm SHA256` vergleichen.
   `package-manifest.json` enthält Quellcommit, Version, Protokoll/Datenformat und
   die Hashes aller Programmdateien. Diese Integritätsprüfung ersetzt keine
   Herausgebersignatur: nur ein Paket aus dem bekannten Anker-Download verwenden.
3. **Einrichten.cmd** starten. Ein inkompatibles Protokoll/Datenformat oder eine
   beschädigte Datei stoppt die Einrichtung. Bei einer Python-/Netzwerkfehlermeldung
   Ursache beheben und erneut starten. Danach **Start.cmd** öffnen.

Schlüssel, Kopplung, eigene Notizen und Einstellungen bleiben verschlüsselt im
übergeordneten Datenordner erhalten. Unter demselben Windows-Benutzer aktualisieren;
DPAPI-Schlüssel werden weder exportiert noch ersetzt. Das Update installiert keine
zweite Planung, keinen automatischen Internet-Updater und keinen Windows-Dienst.
Im installierten Ordner liegen auch Anleitung und `uninstall.ps1` für später.

## Im Alltag

- 30 Minuten vor der gelieferten Bettzeit zeigt der Begleiter den Übergang.
  Zehn Minuten vorher weist er auf den Gedankenparkplatz hin. Ein eigenes
  Overlay und die Zeitpille ergänzen Windows-Benachrichtigungen.
- **Speicherpunkt** merkt in zwei kurzen Feldern den aktuellen Stand und den
  nächsten Schritt. **Gedanke** speichert eine eigene Notiz. Beide werden über
  die verschlüsselte Outbox beim nächsten Kontakt ans Handy übergeben.
- Im normalen Modus lassen sich **+15/+30 Minuten** beliebig erneut wählen oder
  **Heute ohne PC-Stopp** setzen. Ein unveränderter Handyauftrag hebt eine lokale
  Verlängerung nicht auf.
- Im ausdrücklich eingeschalteten strengen Modus kommt eine Notverlängerung nur
  vom bestätigten Anker-QR im Handy. Der PC stellt kein solches Token aus.
  Die Annahme wird erst nach passender PC-Antwort bestätigt.
- Vor einer Windows-Aktion gibt es mindestens **60 Sekunden zum Speichern**.
  Standard ist Sperren. Ruhezustand und Herunterfahren sind eigene Wahlen.
  Herunterfahren nutzt nach dem eigenen Countdown `/s /t 0`, nie `/f` und nie
  einen Windows-Countdown, der offene Programme erzwungen schließen könnte.
- Der strenge Wieder-Sperrschutz prüft alle zehn Sekunden. Er gilt nur für die
  bestätigte endliche Nacht-Session. Ein gewöhnlicher Tageszustand hebt ihn
  nicht auf; echter Morgenabschluss oder gültiger Hardware-Token tun es.
  Morgenabschluss beendet den Watchdog, meldet dich aber nicht ohne Windows-
  Passwort an. **Beenden** bleibt als Ausweg erreichbar.
- Dämmerung ist ein optionales warmes, klickdurchlässiges Signal mit höchstens
  40 Prozent Deckkraft, kein Schlaf- oder Blaulicht-Heilversprechen. Audio wird
  optional jede Minute um neun Prozent abgesenkt und respektiert manuelle Änderungen.
- Ist im Handy der eigenständige Abendlicht-Hinweis eingeschaltet, erscheint zur
  gelieferten Uhrzeit einmal die Karte **Deckenlicht aus, warmes Licht an.**
  Ohne Ton, Dämmerung oder PC-Aktion; nach fünf Minuten wird sie nicht nachgeholt.
  Während eines laufenden Abendübergangs oder nachts erscheint keine zweite Karte.

Bei WLAN-Ausfall pausiert die Standardwahl nach 90 Sekunden ohne authentifizierten
Kontakt. Die eigene Wahl **Feste Zeit verwenden** führt nur die ausdrücklich
vorbereiteten, noch gültigen Tagesaufträge aus; sie erfindet keinen nächsten Termin.
Eine bereits aktivierte strikte Nacht bleibt bis zu ihrer ursprünglichen endlichen
Grenze bestehen. Der 14-Tage-Cache wählt ausschließlich den Eintrag zum aktuellen
Berliner Plantag (Wechsel 04:00); ein fehlender oder pausierter Tag bleibt frei.
Eine Tagesvorschau ohne echte Nacht-Session startet keinen neuen Nacht-Watchdog.
Anmeldung, Aufwachen und eine zurückgestellte
Uhr beginnen eine neue volle Speicherfrist. Der Nutzer behält seine Windows-Rechte;
dies ist kein manipulationssicherer Administrator- oder Überwachungsdienst.

## Daten und Sicherheit

TLS mit lokalem Zertifikats-Pin, ECDH-P256/HKDF und richtungsgetrenntem AES-256-GCM.
QR-Kopplungen sind einmalig und zehn Minuten gültig. Steigende dauerhaft gespeicherte
Zähler verhindern Replay. Es gibt keine Klartext- oder unverschlüsselte LAN-Ausnahme.
Vollständiger Drahtvertrag: [PROTOCOL.md](PROTOCOL.md).

Zustand, Schlüssel und eigene Notizen werden unter
`%LOCALAPPDATA%\AnkerPcCompanion` mit Windows-DPAPI für den aktuellen Benutzer
verschlüsselt gespeichert. Der private TLS-Schlüssel ist dauerhaft nur dort
verschlüsselt gespeichert; zum Laden in OpenSSL wird kurz eine private temporäre
Datei erzeugt und anschließend gelöscht. Abgebrochene Reste werden beim Start entfernt.
Protokolle enthalten nur neutrale Fehlercodes, insgesamt höchstens etwa 1 MB,
und werden spätestens nach 14 Tagen bereinigt. Keine Fenstertitel, Programme,
URLs, Bildschirmbilder oder Tastatureingaben werden erfasst. Globale Hotkeys
sind Registrierungen einzelner Kombinationen, kein Keylogger.

Der alte Ordner `%LOCALAPPDATA%\Anker` und seine Aufgabe werden nicht still
entfernt. Solange **Anker PC-Stopp** noch erkannt wird, führt der neue Begleiter
keine konkurrierende Sperre oder Abschaltung aus. Entfernen ist eine eigene Aktion.

## Entfernen und Entwickeln

`uninstall.ps1` entfernt nur den eigenen Autostart. Vor dem Löschen der
Programmdateien den Begleiter beenden. Mit `-DeleteData` werden zusätzlich
eigene Schlüssel, Notizen und Protokolle entfernt; der klassische PC-Stopp bleibt.

```powershell
python -m anker_companion --port 47830 --name "Mein PC"
python -m unittest discover -s tests -v
node tests/node_phone_simulator.mjs
```

Aus dem Repository-Hauptordner baut `python scripts/package-pc-companion.py
--output dist-pc/Anker-PC-Begleiter-0.1.1.zip` ein reproduzierbares Quellpaket.
`python scripts/test-pc-package.py` prüft Paket und Installer mit injizierten
Prozess-/Python-/Autostart-Grenzen, unter Windows mit Windows PowerShell 5.1.
Die CI stellt das geprüfte ZIP und seinen SHA-256-Wert als Artefakt
**Anker-PC-Begleiter-Quellpaket** bereit. Es enthält keine virtuelle Umgebung,
Schlüssel, Nutzerdaten, Testdaten oder Windows-EXE.

Unter Linux laufen ausschließlich injizierte Plattform-/Vault-Mocks und lokale
TLS-/WebSocket-Integrationstests. Der normale Programmeinstieg verweigert dort
Windows-Aktionen. Tests verwenden denselben öffentlichen Kryptovektor wie
`src/core/pcLink/fixtures/v3-crypto.json`; in einem isolierten Worktree kann
`ANKER_SHARED_FIXTURE` auf diese Datei zeigen.

Neue Abhängigkeiten bleiben auf dieses Modul beschränkt: aiohttp (HTTP/WSS, Apache-2.0),
cryptography (bewährte Krypto/TLS-Zertifikate, Apache-2.0/BSD), zeroconf (mDNS, LGPL),
qrcode/Pillow (lokales QR-Fenster, BSD/HPND), unter Windows pycaw/comtypes (Core Audio,
MIT) und pystray (Tray, LGPL). Die Android-/Web-App erhält dadurch kein neues npm-Paket.

**Geprüft** sind reine Logik, gemeinsame Kryptovektoren, echte lokale TLS-/WSS-
Kommunikation und Windows-Adapter mit Mocks. **Noch am echten PC/Handy zu prüfen:**
Firewalldialog, mDNS im Heimnetz, Kopplung mit Galaxy, exklusive Spiele/Vollbild,
Narrator, 200-Prozent-Skalierung, echte Audioausgabe, WTS-/Energieereignisse,
Autostart, Sperren, Ruhezustand und offene ungespeicherte Windows-Programme.
