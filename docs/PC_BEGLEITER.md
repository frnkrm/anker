# PC-Begleiter: Abend und Morgen gemeinsam begleiten

Der Windows-Begleiter verbindet sich direkt im Heimnetz mit Anker auf Android. Das Handy behält den Tagesplan; der PC zeigt den bestätigten Stand und kann nach deiner Wahl beim Aufhören helfen. Ein Konto oder Cloudserver ist dafür nicht erforderlich.

**v7 verfügbar, 09.11.2026:** [Windows-Quellpaket herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-pc-v7-20261109) und [Anker 1.5.0-rc.1 / Code15](UPDATE_V7_CODE15.md) mit gleicher App-Kennung/B4-Signatur. Gemeinsame lokale Prüfungen, beide GitHub-PC-Jobs und vollständiger Paketdownload sind grün. [Testnachweise](ANKER_TESTNACHWEISE.md), [maschinenlesbarer Abschluss](ANKER_V7_UPDATE_NACHWEIS.json). Echte LAN-, Windows-Installation und Galaxy-S26-Ultra-Prüfungen bleiben offen.

## Zuerst ausprobieren, danach Wirkungen wählen

Die Begleitung am Handy, der PC-Eingriff und der strenge Modus beginnen ausgeschaltet. Kopplung allein sperrt nichts. Zum Ausprobieren gibt es am PC einen **Testabend** ohne echte Sperre, Ruhezustand oder Herunterfahren.

| Hilfe | Was sie tut | Was du dafür wählst |
|---|---|---|
| Zeit sichtbar machen | Zeitpille, Ring im Tray und Hinweis auf den nächsten Übergang | Anzeigeoptionen am PC |
| Bildschirmdämmerung | Klickdurchlässiger warmer Schleier, maximal 40 Prozent Deckkraft | Eigener PC-Schalter; kein Versprechen einer Schlafwirkung |
| Ton langsam leiser | Verringert die aktuelle PC-Gesamtlautstärke jede volle Minute um 9 Prozent, bis zur Untergrenze | Eigener PC-Schalter; eine manuelle Lautstärkeänderung hat Vorrang |
| Am Abend aufhören | Erst sichtbare Speicherfrist, danach sperren; Ruhezustand oder Herunterfahren nur nach eigener Auswahl | Gültiger Handyauftrag und lokale PC-Freigabe |
| Strenger Nachtmodus | Sperrt eine wieder geöffnete Windows-Sitzung innerhalb der begrenzten Nachtfreigabe erneut | Zusätzliche bewusste Wahl an Handy und PC |
| Morgen anzeigen | Countdown für Losgehen oder Arbeitsbeginn, wenn diese Zeiten bekannt sind | Eigener Schalter; keine Arbeitszeitbuchung |

## Windows einrichten

Voraussetzungen: Windows, Python **3.11 oder neuer** einschließlich Python-Launcher `py`, ein beschreibbares Benutzerprofil und dasselbe private Netzwerk wie das Handy. Das Paket enthält Python-Quellen; ein signierter EXE-Installer oder automatischer Downloadkanal ist nicht Bestandteil dieses Arbeitsstands. SmartScreen oder Smart App Control können unbekannte Software zurückhalten. Sicherheitsfunktionen nicht pauschal ausschalten; einen blockierten Start als offenen Installationsbefund behandeln.

Das vollständige Windows-Quellpaket in einen neuen Ordner entpacken. **Einrichten.cmd** doppelklicken oder die folgenden Befehle in einer normalen PowerShell aus diesem Ordner ausführen:

```powershell
.\Einrichten.cmd -NoAutostart
.\Start.cmd
```

Der Installer legt eine virtuelle Python-Umgebung an und installiert die festgehaltenen Abhängigkeiten. Programmdateien liegen unter `%LOCALAPPDATA%\AnkerPcCompanion\app`, Zustand und technische Logs eine Ebene darüber. Die Installation braucht keine Administratorrechte und ändert keine Firewallregel.

Erst nach dem ersten erfolgreichen Versuch kannst du den Benutzer-Autostart einrichten:

```powershell
.\Einrichten.cmd
```

Das erstellt die Aufgabe **Anker PC-Begleiter**, beim Anmelden dieses Benutzers und ohne erhöhte Rechte. `Start.cmd` startet dieselbe Installation; ein zweiter Prozess wird verhindert.

**Bestehenden Begleiter aktualisieren:** Zuerst über Fenster oder Tray **Beenden**, das neue vertrauenswürdige Paket vollständig in einen neuen Ordner entpacken und **Einrichten.cmd** erneut starten. Paketmanifest und Dateihashes, Python/Tk, laufende Instanz sowie Protokoll/Datenformat werden vor dem Austausch geprüft. Die vorhandenen DPAPI-Daten liegen außerhalb von `app` und bleiben unter demselben Windows-Benutzer erhalten. Ein fehlgeschlagener Paket-/Pythoncheck wird als Fehler gemeldet; er ist keine erfolgreiche Installation. Die Einrichtung erlaubt PowerShell-Skripte nur für ihren eigenen Prozess, ohne globale Richtlinienänderung. Das Paket ist Quellcode, keine signierte EXE.

Für die Entwicklung funktioniert auch der direkte Start aus `pc-companion`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m anker_companion --name "Mein PC" --port 47830
```

`--data-dir` wählt bei Bedarf einen anderen eigenen Datenordner. Ein geschützter Datenstand lässt sich mit DPAPI nur im passenden Windows-Benutzerkontext öffnen.

## Heimnetz und Firewall

Der lokale TLS-Server verwendet standardmäßig **TCP 47830**. Die Erkennung veröffentlicht **`_anker._tcp.local.`** über mDNS (UDP 5353). Wenn Windows nach Netzwerkzugriff fragt, nur das eigene **private Netzwerk** für die installierte Python-Laufzeit erlauben. Öffentliche Netze sind nicht nötig. Es ist keine Router-Portfreigabe vorgesehen.

Handy und PC müssen sich erreichen können. Gast-WLAN, Client-Isolation, VPN oder blockiertes mDNS können das verhindern. Der beim Koppeln angezeigte QR enthält lokale Adresskandidaten; spätere Adressänderungen werden über die lokale Erkennung gesucht. Es gibt keinen Cloud-Relay und keinen Klartext-Ersatz. Das eigene TLS-Zertifikat wird anhand des beim Koppeln übernommenen Pins geprüft; ein anderes Zertifikat wird nicht still akzeptiert.

## Handy koppeln

1. Am PC **Mit Handy koppeln** öffnen. Den angezeigten QR nur mit deinem Handy scannen; er enthält ein kurzlebiges Kopplungsgeheimnis und gehört nicht in Screenshots oder Testexporte.
2. In Anker **Mehr → Abend & Alltag → PC-Stopp → Lokaler PC-Begleiter** öffnen und den QR scannen. Falls der Kameraweg nicht verfügbar ist, bleibt der ungekuppelte Zustand erhalten.
3. Den **vierstelligen Prüfcode auf beiden Geräten vergleichen**. Die Kopplung im PC-Fenster ausdrücklich bestätigen. Ein abweichender Code ist ein Grund zum Abbrechen und erneuten Koppeln.
4. **Jetzt abgleichen** wählen. Erst **Plan bestätigt** mit passender Revision und Gültigkeit belegt den Empfang. „Verbunden“, „Gesendet“ oder ein sichtbarer QR allein reichen dafür nicht.
5. Unter **Was weiß dein PC?** prüfen, welche Daten du teilst. Danach die gewünschten Anzeige- oder Eingriffsoptionen auf beiden Seiten bewusst aktivieren.

Der QR gilt höchstens zehn Minuten und einmalig. Entkoppeln verwirft die Verbindungsfreigabe; eine neue Kopplung ist ein neuer bewusster Schritt. Ein Backup oder Datensync überträgt die privaten Kopplungsschlüssel nicht.

## Abendablauf

Die Handyoptionen liegen unter **Einstellungen → Abend & Morgen begleiten**. Die drei Phasen orientieren sich an deiner vorhandenen, für diesen Tag gültigen Bettzeit:

| Zeitpunkt | Handy und PC |
|---|---|
| 30 Minuten vorher | Warmer Übergang, sichtbare verbleibende Zeit; optionaler PC-Schleier |
| 10 Minuten vorher | Gedanken für morgen parken, Speicherpunkt setzen; auf Wunsch den PC-Ton langsam reduzieren |
| Bettzeit | Nächsten kleinen Abend-Schritt zeigen; bei gewählter QR-Bestätigung deinen Anker-Code scannen |
| Gewählte PC-Grenze | Mit der Drei-Phasen-Begleitung ist dies die Bettzeit, sonst die eigene PC-Stoppzeit. Zunächst mindestens **60 Sekunden sichtbar zum Speichern**, danach die gewählte Aktion |
| Nach der bewussten Abendbestätigung | Optional lokales Brown Noise mit Ausblendung; der Scan bestätigt den Übergang, keinen tatsächlichen Schlaf |

Der Speicherpunkt ist eine Notiz, zum Beispiel „Dokument gespeichert; morgen bei Absatz 3 weiter“. Anker speichert keine anderen Programme für dich. Bei gewähltem Herunterfahren lautet der Windows-Aufruf nach dem eigenen Countdown `shutdown /s /t 0`, niemals mit `/f`. Ungespeicherte Programme können das verhindern; rechtzeitig selbst speichern bleibt nötig.

Im normalen Modus kannst du **+15 Minuten**, **+30 Minuten** oder **Heute ohne PC-Stopp** wählen. Der tatsächliche neue Termin wird an dasselbe Handy zurückgemeldet. Ein offenes Abendende erzeugt keine erfundene Bettzeit und pausiert die zeitgesteuerten Abendphasen. Ein später eintreffender unveränderter Plan nimmt eine bereits angenommene freie Verlängerung nicht still zurück.

Im gesondert gewählten strengen Modus wird eine Notverlängerung am Handy über deinen vorhandenen **Anker-QR** bestätigt. Der PC kann das dafür nötige signierte Token nicht selbst erzeugen. Erst die passende Empfangsbestätigung mit Zielzeit bestätigt die Verlängerung. NFC wird in diesem Arbeitsstand nicht als eigener neuer Einrichtungsweg angeboten.

Die gespeicherte PC-Stoppzeit bleibt von der Bettzeit getrennt. Schaltest du die drei Abendphasen ein, folgt der lokale Begleiter der Bettzeit mit den vollständigen Vorwarnungen 30 und 10 Minuten davor. Ohne diese Wahl folgt er der normalen PC-Stoppzeit mit denselben Vorabständen. Die Vorschau **Was weiß dein PC?** zeigt beide Zeiten und den tatsächlichen Beginn der Speicherfrist. Eine Verlängerung verschiebt die ganze Folge; 15 Minuten zusätzliche Bettzeit erhalten nicht nochmals den Bildschirm-aus-Puffer. Vorbereitete Morgenzeiten gehören zum tatsächlichen nächsten Morgen, einschließlich seiner Arbeits- oder Homeoffice-Auswahl. Der PC erzeugt keine eigenen Ersatzzeiten.

**Abendlicht und weniger Doppelhinweise:** Unter **Abend & Morgen begleiten** kannst du zusätzlich einen einzelnen Lichthinweis wählen. Er verwendet dieselbe Bettzeit und erscheint nicht neben einem gewählten sanften Übergang oder der Drei-Phasen-Serie. Der PC zeigt die kleine Lichtkarte nur für den gültigen bestätigten Tag. Die getrennte Option zum Entlasten der Handy-PC-Hinweise braucht einen frischen, authentifizierten PC-Beleg für genau dieselbe Revision und den heutigen Plantag. Verbindung allein genügt nicht. Nach Verlust des Belegs werden bestehende Hinweise innerhalb ihrer ursprünglichen Frist wieder möglich; es entsteht kein später Nachholstapel. Bett- und Weckhinweise werden nicht unterdrückt.

**Bei Verbindungsunterbrechung:** Nach 90 Sekunden ohne authentifizierten Kontakt greift die gewählte Offline-Regel. „Pause“ setzt neue Wirkungen aus; „Vorbereitete Zeiten“ verwendet nur den ausdrücklich gelieferten, noch gültigen Eintrag des passenden Berliner Plantags. Der Vorrat reicht bis zu 14 Tage. Ein fehlender, abgelaufener oder als offen markierter Tag wird nicht durch den Vortag ersetzt. Eine schon beiderseits freigegebene strenge Nacht bleibt innerhalb ihrer ursprünglichen Frist geschützt. Diese Frist endet spätestens drei Stunden nach der vorbereiteten Weckzeit und nie später als die ursprüngliche, höchstens 18 Stunden gültige Nachtfreigabe. Ein späterer Abgleich verlängert sie nicht still.

Ein ausdrücklich gewählter strenger PC-Abend kann auch ohne vorherigen Handy-Bettscan an der gelieferten Grenze beginnen. Der echte Abschluss des zugehörigen Morgens gibt ihn dennoch frei; ein späterer Bett-QR oder Tageswechsel erzeugt keine unbegrenzte neue Sperre. Eine erledigte Abendroutine allein bestätigt weder Bettzeit noch Schlaf und unterdrückt deshalb die späteren T30-/T10-/Bett-Hinweise nicht.

Eine QR-Notverlängerung braucht dafür keinen zusätzlichen vorbereitenden Bett-Scan: Bei einer automatisch begonnenen PC-Nacht prüft das Handy zuerst die frische, passende PC-Bestätigung. Erst der gescannte Anker-QR, die gewählten Freigaben und die noch gültige ursprüngliche Nachtfrist erlauben ein signiertes Token. Ohne Bestätigung wird keine erfolgreiche Verlängerung angezeigt.

**Beenden bleibt möglich.** Das Hauptfenster und das Tray bieten einen sichtbaren Ausgang. Der Begleiter blockiert keine Systemtasten, erhebt sich nicht zum Administrator und entsperrt Windows niemals selbst. Der echte Abschluss der Morgenroutine beendet lediglich den Wieder-Sperrwächter; anmelden musst du dich weiterhin selbst. Optionales Wake-on-LAN kann einen entsprechend eingerichteten PC wecken, keine Windows-Anmeldung ersetzen.

## Morgen und Handy-Hilfen

- **Direkt nach dem Wecker:** Optional startet nach bestätigtem Hauptwecker der erste offene Schritt derselben Morgenroutine mit Countdown. Der Countdown beweist noch keine echte Handlung.
- **Wachsein bestätigen:** Optional eine kurze Ein-Tipp-Rückfrage, zunächst nach fünf Minuten. Ohne Bestätigung kann der vorhandene Hauptwecker einmal erneut angefordert werden. Eine erledigte Routine wird daraus nicht abgeleitet.
- **Zombie-Modus:** Du wählst Kernschritte in den Details deiner Morgenroutine. Die kleine Routine kann bewusst oder nach ausbleibender erster Rückmeldung angeboten werden. Weggefilterte Schritte gelten nicht als erledigt und geben keine Punkte.
- **Schritttempo:** Optionale Vibrationen und eine lokale Android-Stimme begleiten laufende Schritte. Pause, Stoppen und Wecker haben Vorrang. Es gibt keinen Cloud-Stimmenersatz.
- **Gedankenparkplatz:** Der Abendtext bleibt im vorhandenen privaten Morgen-Schritt-Speicher. Nach tatsächlich abgeschlossener Morgenroutine wird er wieder angeboten. An den PC geht er nur mit eigener Inhaltsfreigabe.
- **Rhythmus-Woche:** Sieben oder vierzehn Tage, mit getrennten geplanten und tatsächlich bestätigten Zeiten und deinem Aufstehfenster. Fehlende Einträge bleiben fehlend; kein Score, keine Strafe und keine Diagnose.

Der bestehende Vorwecker kann auf Wunsch zehn Minuten vorher sanft einblenden. Das bewusst gestartete Aktivitäts-Weckfenster hat weiterhin Vorrang und pausiert seinen Vorwecker für diesen Haupttermin. Es bleibt eine experimentelle Aktivitätsheuristik und keine Schlafphasenmessung.

## Unterbrechung, alter PC-Stopp und Daten

Bei Verbindungsabbruch zeigt Anker den fehlenden bzw. älteren Empfang. Ein schon bestätigter PC-Auftrag wirkt nur innerhalb seiner zeitlichen Freigabe und der gewählten Offlinepolitik weiter. Abgelaufene oder zeitlich unplausible Aufträge erzeugen keine neue Nacht. Größere Uhrabweichungen pausieren Systemwirkungen. Nach Neustart oder Wiederaufwachen beginnt eine neue Speicherfrist; ein authentifizierter begrenzter Nachtwächter kann bis zum Morgenabschluss weiter gelten.

Die bisherige Aufgabe **Anker PC-Stopp** wird erkannt und blockiert neue Systemwirkungen, damit zwei Mechanismen nicht gleichzeitig abschalten. Ihr klassisches PowerShell-Paket wird weder unbemerkt ersetzt noch entfernt. Erst nach deiner ausdrücklichen Wahl lässt sich die alte Aufgabe entfernen. Wer den klassischen Weg weiter nutzt, richtet den neuen Eingriff nicht zusätzlich ein.

Der PC erhält standardmäßig Zustände, Zeiten und Schrittnummern, keine Aufgabentitel. Brain-Dump und eigener Wenn-dann-Satz brauchen separate Inhaltsfreigaben. Beobachtet werden nur Sitzungs-, Energie- und Leerlaufzustände; keine Programme, Fenstertitel, URLs, Tastatureingaben oder Bildschirmaufnahmen. Technische Logs enthalten keine Notiztexte oder Schlüssel. Windows-Schlüssel und lokaler Zustand sind benutzergebunden mit DPAPI geschützt, Android-Schlüssel mit dem Keystore.

## Entfernen

Begleiter über **Beenden** schließen, dann aus dem Quellpaket:

```powershell
.\uninstall.ps1
```

Das entfernt den neuen Autostart. Optional `.\uninstall.ps1 -DeleteData` löscht zusätzlich die Begleiter-Daten; anschließend können die Programmdateien im eigenen Profil entfernt werden. Das klassische PC-Stopp-Paket bleibt unberührt. Nach Datenlöschung ist eine erneute Kopplung nötig.

## Sieben gemeinsame Prüfungen statt einer langen Einzelliste

In der App **Gemeinsam testen → v7 gemeinsam ausprobieren · 7 Stationen** verwenden. Die Stationen **G97–G103** verbinden Handy und PC und nutzen denselben vorhandenen Berichtsexport. Nur tatsächlich beobachtete Teile bestätigen; „Teilweise“ ist ein vollständiger, ehrlicher Bericht. Ein Browser- oder Mocktest ersetzt diese Runde nicht.

| Station | Gemeinsamer Versuch |
|---|---|
| G97 | Eigene Daten und ausgeschaltete neue Optionen prüfen; koppeln, Code vergleichen, passenden Empfang und Entkoppeln prüfen |
| G98 | Zustandsfarben, Zeitbogen und Fokus-Timer mit kleiner Breite, großer Schrift und reduzierter Bewegung ansehen |
| G99 | Regulären Hauptwecker per QR beenden, sofortigen ersten Schritt und echten Morgenabschluss prüfen; Wiederöffnung vergleichen |
| G100 | Gewünschte Vibration/Stimme, Pause und Weckervorrang; Zombie-Kernschritte und Wachrückfrage einzeln ausprobieren |
| G101 | Kurzen Testabend mit T30/T10, Gedanken, QR, stoppbarem Rauschen und gegebenenfalls angenommener Notverlängerung durchgehen |
| G102 | PC-Testabend, Empfang, Schonfrist, eigener Ausstieg, LAN-Ausfall/Neustart und Altpaket-Konflikt; echte Sperre/WoL nur nach eigener Wahl |
| G103 | Gedankenparkplatz und PC-Speicherpunkt wiederfinden, Wenn-dann-Plan und freiwilligen Licht-Schritt prüfen; Rhythmus zeigt nur tatsächliche Einträge |

Vor einem späteren Update **Testberichte als Datei exportieren** und die Datei für den nächsten Abgleich aufbewahren. Sie enthält die alten Buildbezüge und setzt keinen neuen Erfolg. Ein Testbericht ersetzt keine vollständige Datensicherung. Für Weckertests einen unabhängigen Wecker verwenden.

## Grenzen und spätere Möglichkeiten

Exklusives Vollbild, Spiele, Windows-Energiezustände und „Nicht stören“ können Anzeigen beeinflussen. Das Overlay ist eine Hilfe und kein garantierter Weg über jedem Spiel. Verhalten mit mehreren Monitoren, hoher Skalierung, Tray und tatsächlichem Audio ist noch auf Windows zu prüfen. Android-Standby und herstellerabhängige Hintergrundgrenzen erfordern den gemeinsamen Galaxy-Test.

Ein Licht-Schritt ist ein freiwilliger Routinevorschlag. Ein echter Lichtwecker bräuchte zusätzlich steuerbare Hardware und eine eigene bestätigte Integration. Schlafvorschläge aus Health Connect haben jetzt einen eigenen ausgeschalteten Leseschalter und bleiben ausschließlich am Handy; der PC erhält keine Schlafsitzungen. Relay außerhalb des Heimnetzes, automatische Begleiter-Updates und ein signierter Windows-Installer sind hier nicht aktiviert. Die Quellen im [v7-Auftrag](auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v7_PC.md#13-quellen) begründen Ideen, keine persönliche Wirkungszusage für Anker.
