# Entwicklungsstand nach dem aktuellen Codeabgleich

Stand 10.11.2026. Der Nutzer hat nach dem Audit ausdrücklich alle verbleibenden Softwareentwicklungen beauftragt. Die folgende Liste ersetzt die frühere reine Vorschlagsliste und trennt integrierten Code, noch laufende Integration und echte Einrichtung/Beobachtung.

| Bereich | Aktueller Softwarestand |
|---|---|
| Kopplung | QR-Lebenszyklus unabhängig von Statusrenders, Widerruf/Ablauf, vierstelliger Handyvergleichscode und Schutz vor veralteten Statusantworten integriert |
| PC-Oberfläche/Tray | Abgerundete tastaturbedienbare Buttons, monitorangepasstes Fenster, Scrollzugang, dauerhafte Aktionsrückmeldung, Minimieren/X im Tray, Symbol-/Erinnerungsklick und ausdrücklich getrenntes Beenden integriert |
| Abgleich | Manueller PC-Abgleich über vorhandenen authentifizierten Kanal; echter Empfangszeitpunkt und Quellstand statt Erfolg aus bloßer Kopplung |
| AB-07 | Tatsächlicher sanfter Handy-Abendzeitpunkt als einzelne PC-Folge; keine doppelte T30/T10-/Dimm-/Audioserie |
| MO-04 | Gewählte Morgenanzeige mit tatsächlichem Losgeh-/Arbeitsziel und begrenztem einmaligem Hinweis |
| AB-04 | Freiwillig freigegebener Wenn-dann-Satz auf der PC-Karte, kein Text ohne Freigabe |
| AB-03/PC-09 | Bis… mit Vorschau, exakter Zielzeitbindung und Berliner Sommer-/Winterzeit; strenge Notverlängerung bleibt am Handy |
| PC-Verwaltung | Name, eigene Tastenkürzel mit atomarem Speichern und Registrierungs-Rollback, bestätigte lokale Datenlöschung/Neustart |
| Darstellung | Hell/Dunkel/System, optionale S−60-Pille, optionaler kurzer Kartenton unter Beachtung des Windows-Benachrichtigungszustands |
| Google-Kalender | Nativer READ_CALENDAR-Leseweg für synchronisierte Google-Kalender samt Konto-/ID-Wechselschutz; App-Auswahl-/Cache-/Backup-Integration in Arbeit. Bestehende direkte Google-Anmeldung und eigener Schreibkalender bleiben erhalten |
| PC-Updates | Signierter, fest gebundener Kanal mit optionaler automatischer Prüfung, bewusstem Download und gesonderter Installationsbestätigung in Integration |
| PC-14 Relay | Optionaler verschlüsselter Transport mit getrennten widerrufbaren Berechtigungen; SQL/Handler lokal geprüft, Android-/PC-/Einrichtungshooks in Integration. Kein laufendes Supabase behauptet |

Die nachfolgende finale Gesamtprüfung und Lieferung wird im [Implementierungsplan](ANKER_IMPLEMENTIERUNGSPLAN.md) und den [Testnachweisen](ANKER_TESTNACHWEISE.md) anhand konkreter Quellen dokumentiert. Ein bereits vorhandener Schalter allein gilt nicht als fertige Funktion.

## Externe Voraussetzungen und Beobachtungen

- Kalenderfreigabe und Auswahl müssen auf dem Handy erfolgen. Das vorhandene Play-Dienstkonto berechtigt nicht zum persönlichen Google-Kalender. Der neue Gerätekalenderweg benötigt keinen weiteren API-Schlüssel.
- Relaybetrieb benötigt ein tatsächlich eingerichtetes Supabase-Projekt und bewusst gewählte Aktivierung. Ohne Projektzugang gibt es nur geprüften optionalen Code und den lokalen LAN-Weg.
- Die schon früher beauftragte dauerhafte GitHub-Secret-Sicherung des B4-Schlüssels ist ohne freigegebenen Secret-Schreibzugang weiterhin nicht bestätigt. Vorhandenen Schlüssel erhalten; kein neues Zertifikat oder öffentlicher Schlüsselupload daraus abgeleitet.
- Ein vertrauenswürdiger signierter Windows-EXE-Installer erfordert ein passendes externes Codesignierungszertifikat. Kein kostenpflichtiges Zertifikat gekauft oder eine Signatur vorgetäuscht; Quellpaket und signierter Updatekanal sind getrennt beschrieben.
- MO-05 ist eine Machbarkeitsnotiz für einen Lichtwecker, keine Hardwareintegration. Zusätzliche Geräte werden nicht gekauft/angesteuert.
- Galaxy S26 Ultra, tatsächlicher Weckerton/Standby/Spiel-Touchschutz, reale Windows-Installation, mehrere Monitore mit verschiedener DPI, Tray-/Windows-Erinnerungsklick, LAN-Unterbrechung und bewusst gewählte Sperr-/Audio-/WoL-Wirkungen bleiben echte Geräteversuche. Dieselben sieben Stationen/103 IDs weiterverwenden, keine automatischen Geräte-Häkchen.

Die E00–E09-Basissoftware ist bereits umgesetzt. Historische Baselineblocker sowie erledigte AB-05/AB-06/MO-03 werden nicht erneut als fehlender aktueller Code aufgeführt. Claude Code ist hier nicht als Werkzeug oder CLI angeschlossen; die parallelen Prüfungen erfolgen durch Codex-Agenten in getrennten Arbeitsbäumen.
