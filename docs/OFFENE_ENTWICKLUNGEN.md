# Offene Entwicklungen nach aktuellem Codeabgleich

Stand 10.11.2026. Diese Liste trennt fehlenden Code von noch ausstehenden Geräteversuchen. Frühere Abschlussangaben und ältere offene Baselinepunkte werden nicht ungeprüft als aktueller Stand übernommen.

## Laufendes Update

- PC-Kopplung: QR-Fenster bleibt unabhängig von Statusmeldungen geöffnet; kurzlebiger, widerrufbarer Code und sichtbare Fehlererholung.
- Handy: vierstelliger Prüfcode während der offenen Kopplung, Schutz vor verspäteten Statusantworten.
- PC-Oberfläche: abgerundete, tastaturbedienbare Buttons, monitorangepasstes Fenster, verlässliche Aktionsrückmeldungen.
- Manueller LAN-Abgleich mit tatsächlichem Handystand und Zeitpunkt; keine Erfolgsanzeige aus bloßer Kopplung.
- Minimieren/X in den Infobereich, erreichbarer Rückweg über Symbol und Erinnerung, ausdrücklich getrenntes Beenden.

Implementierung, Prüfungen und Auslieferungsstand stehen im [Implementierungsplan](ANKER_IMPLEMENTIERUNGSPLAN.md). Diese laufenden Punkte sind vor ihrem Abschluss nicht als bereits ausgeliefert zu lesen.

## Konkrete noch offene v7-Umsetzungen

| Priorität | Punkt | Tatsächlicher Codebefund |
|---|---|---|
| Hoch | **AB-07: sanften Abendübergang auch am PC berücksichtigen** | Der gemeinsame PC-Zeitplan verwendet weiterhin feste Bett−30-/Bett−10-Zeiten und trägt die eigene `support.windDown.at`-Auswahl nicht vollständig als vereinfachte Folge weiter. Eine eigene `EVENING_WIND_DOWN`-Karte fehlt im bisherigen PC-Ablauf. Die Vermeidung überlappender Abendserien braucht hier noch eine gemeinsame Umsetzung. |
| Hoch | **MO-04: Morgen-Countdown am PC** | `morningCountdown` und `leaveAt`/`workStartAt` sind im gemeinsamen Vertrag vorhanden. `pc-companion/anker_companion/engine.py` verwendet für die sichtbare Restzeit bislang den Abendzielpunkt; die gewählte Morgenanzeige und deren Vorwarnung werden nicht vollständig umgesetzt. Ein übertragener Schalter allein erfüllt die Funktion nicht. |
| Mittel | **AB-04: Wenn-dann-Hinweis auf der PC-Karte** | Der freiwillig freigegebene Satz kommt über `prefs.ifThen` an; die PC-Karte in `ui.py` zeigt ihn bislang nicht an. |
| Mittel | **AB-03/PC-09: freie Zielzeit und Verlängerungsvorschau** | +15/+30 und freier Abend sind vorhanden. Eine eigene Zeitwahl „Bis …“ und eine klare Vorschau der neuen PC-/Bettzeit bzw. Restzeit bis zum Wecker fehlen. |
| Niedrig | **PC-09: Tastenkürzel selbst wählen** | `windows.py` registriert bisher feste Tastenkürzel. |
| Niedrig | **PC-12/PC-13: lokale Verwaltungsfelder** | PC-Name ist per `--name`, vollständiges Löschen über `uninstall.ps1 -DeleteData` möglich. Entsprechende Einrichtungs-/Einstellungsfelder fehlen. |
| Niedrig | **VI-03/VI-04/PC-07: weitere Darstellungsoptionen** | Eigene ausblendbare S−60-Pille, Windows-Hellmodus und optionaler Signalton mit Berücksichtigung des Windows-Benachrichtigungszustands sind nicht vollständig umgesetzt. Vorhandene T30-Anzeige und dunkle Oberfläche nicht mit diesen Optionen verwechseln. |

Diese Befunde korrigieren die zu breite frühere Aussage, sämtlicher v7-Umfang sei softwareseitig abgeschlossen. Die Punkte sind keine durch Timer oder Tests automatisch erfüllten Nutzeraufgaben und keine lediglich offenen Geräte-Häkchen. Sie werden nicht zusätzlich zur laufenden Fehlerkorrektur still implementiert.

## Bedingte, optionale Erweiterungen

- **PC-14: Verbindung außerhalb des Heimnetzes über einen Relay.** Kein laufender Supabase-Relay für den lokalen Begleiter eingerichtet. Er verlangt eine eigene Architektur-/Datenschutz-/Betriebsentscheidung; die lokale Kopplung benötigt ihn nicht.
- **Automatischer Windows-Updatekanal und signierter EXE-Installer.** Das vorhandene Quellpaket hat einen manuellen Installations-/Updateweg. Automatische Fremdcodeausführung und kostenpflichtige Codesignierung sind daraus nicht aktiviert.
- **Neue Licht-Hardware.** Der vorhandene Lichthinweis ist keine eingerichtete Smart-Home-Anbindung. Zusätzliche Hardware bleibt eine eigene Wahl.

## Keine neue Entwicklung, aber noch echte Beobachtung nötig

Galaxy S26 Ultra, tatsächlicher Weckerton/Standby/Spiel-Touchschutz, Windows-Installation und mehrere echte Monitore mit unterschiedlicher DPI, Tray-/Windows-Erinnerungsklick, LAN/WLAN-Unterbrechung sowie gewählte Sperr-/Audio-/WoL-Wirkungen. Bestehende sieben v7-Stationen und 103 Test-IDs weiterverwenden; keine bestandenen Häkchen aus Softwaretests erzeugen.

Die E00–E09-Entwicklung ist im aktuellen Plan softwareseitig abgeschlossen. Historische Baselineangaben wie „E05 danach“ und alte Providerblocker sowie die inzwischen erledigten AB-05/AB-06/MO-03 werden nicht erneut als offener aktueller Auftrag aufgeführt.
