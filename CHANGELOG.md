# Patch Notes

## Lokal, nicht veröffentlicht – F-001 (2026-11-13)

- Jetzt zeigt zur relevanten geplanten Abfahrt die Restzeit, geschätzte offene Vorbereitung und den rechnerischen Puffer. Erledigte Routine-Schritte werden nicht erneut gezählt; unklare Zeiten bleiben offen. Keine neuen Erinnerungen oder automatischen Erledigungen, keine neue Versions-/Paket-/Signaturänderung. Echte Geräteprüfung und Veröffentlichung bleiben offen.

## 1.5.0-rc.3 / Code17 und PC0.1.1 – laufende Fertigstellung (2026-11-10)

Die gemeinsame Abschlussprüfung und die neuen Download-/Playbelege werden vor Auslieferung ergänzt. Die Code16-Belege darunter bleiben historisch; neue Gerätebeobachtungen sind nicht daraus abgeleitet.

- PC-Kopplungs-QR bleibt trotz Statusupdates sichtbar, läuft begrenzt ab und ist widerrufbar; vierstelliger Vergleichscode am Handy sichtbar, verspätete Statusantworten abgesichert.
- Gerundete PC-Buttons, Monitor-/DPI-Anpassung, Scroll-/Tastaturzugang und dauerhafte Aktionsrückmeldungen. Minimieren/X bleibt im Tray, Symbol-/Erinnerungsklick öffnet das Fenster; Beenden bleibt ausdrücklich möglich.
- Manueller WLAN-Abgleich bestätigt echten neu empfangenen Handystand und Zeitpunkt. Bis Uhrzeit bietet bestätigte Zielzeitvorschau mit Berliner Zeitumstellungen. Sanfte einzelne Abendfolge, freigegebener Wenn-dann-Satz und gewählte Morgenanzeige verwenden denselben vorhandenen Plan.
- Hell/Dunkel/System, eigener PC-Name, reservierte eigene Tastenkürzel, freiwillige Zeitpille/Kartenton und bestätigte lokale Datenlöschung. Installer und Reset verweigern verknüpfte Ziele; Handy-Daten und DPAPI-Bestand bleiben beim normalen Update erhalten.
- Android-Leseweg für ausdrücklich gewählte, bereits synchronisierte Google-Kalender. READ_CALENDAR nach eigener Wahl, kein WRITE_CALENDAR oder Dienstkontoschlüssel. Konto-/ID-Wechsel, verspätete Antworten und Sicherungen abgesichert; direkter Google-OAuth-/Schreibweg bleibt separat.
- Optionaler signierter PC-Updatekanal mit getrennten Entscheidungen für Prüfung, Download und Installation. Optionaler verschlüsselter Relay mit getrennten widerrufbaren Berechtigungen, LAN-Vorrang und gemeinsamer atomarer Empfangs-/Antwortpersistenz. Kein Cloudbetrieb oder kostenpflichtiger Windows-Signierschlüssel allein durch diesen Code aktiviert.
- Dieselben 103 Gerätetest-IDs und sieben v7-Stationen ergänzt, historische Ergebniszellen unverändert. Keine Erledigt-Haken oder XP aus Zeitablauf, Transportkontakt oder Softwaretests.


## 1.5.0-rc.2 / Code16 – Weckerverlauf & Diagnose (2026-11-09)

Ausgang ist der veröffentlichte Code15-Stand `53aca22`. [Signiertes Handyupdate](docs/UPDATE_CODE16.md) mit gleichem Appnamen, Paket und B4-Schlüssel bereitgestellt; vollständiger Browserdownload und Dateivergleich bestätigt. **1.095 Logik-/271 Browser-/197 frische Android-JUnit-/89 PC-Pythonfälle**, 5 Paket-/Installer-, 19 klassische PC-/36 Updatefälle grün; TypeScript und Build erfolgreich, Lint 0 Fehler/1 bestehende Warnung. [GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42619085381) bestätigt den exakten main/push-Stand mit allen drei Jobs. [Quell-/Artefaktnachweis](docs/ANKER_CODE16_NACHWEIS.json). Echte Galaxy-Hörbarkeit und Spiel-/Standbywirkung bleiben offen; die Code15-Nachweise darunter behalten ihren Stand.

- Neues lokales Android-Journal: höchstens sieben Tage und 800 technische Ereignisse zu Planung, angenommenen/verworfenem Wecksignal, Dienst, Audiofokus, Player/Ersatzton, Beenden und Schlafhinweis. Eigene gerätegeschützte Preferences und begrenzte Schreibqueue halten den Journalzugriff vom kritischen Weckerspeicher getrennt. Keine rückwirkenden Einträge für Nächte vor dem Update.
- **Weckerverlauf & Diagnose** unter Wecker oder Einstellungen, Route `/diagnose`: letzte 24 Stunden, sieben Tage oder eigener Zeitraum; auswählbare Log-/Statusbereiche und getrennte Einstellungsgruppen. Alle Einstellungsgruppen beginnen abgewählt. JSON-Vorschau und Dateiexport mit Auswahlmanifest; kein automatischer Versand, keine vollständige Datensicherung.
- Feste Datenfreigaben schließen private Texte, Aufgaben-/Schrittkennungen, QR-Inhalte, Zugangsdaten, PC-Schlüssel/-Pins, Audio-URIs und Gesundheitsprotokolle aus. Routinen exportieren nur Dauern und Kernschritt-Auswahl, Arbeitszeiten nur die ausdrücklich gewählte Wochenstruktur. Fehlende, wartende und verworfene Journaleinträge bleiben als Grenzen erkennbar. Playerstart bestätigt keine Hörbarkeit oder Wachheit.
- Fehler während laufender Playerwiedergabe versuchen die nächste vorhandene Tonquelle bzw. einen erzeugten Ersatzton. Nur der noch aktuelle Alarm mit gültiger Audiofreigabe und Restlaufzeit darf fortfahren; späte Fehler eines alten Players starten keinen neuen Alarm. Systemlautstärke und Nicht stören werden nicht verändert.
- Stummer Schlafhinweis: CPU-Wecktermin statt ausschließlich nicht weckendem Timer; `Display.STATE_ON` wird getrennt von `isInteractive` bewertet. Einblendung erst nach tatsächlichem Zeichnen als angehängt markieren, höchstens zwei automatische Vordergrundversuche, Erfolg erst nach echtem App-Resume. Ein ausgeschaltetes Display wird nicht eingeschaltet, eine Systemsperre nicht umgangen. Samsungs Spiel-Touchschutz ist eine plausible Besonderheit, aber keine bewiesene Ursache des ausgebliebenen Weckens und wird nicht umgangen.
- Bestehende G1/G96/G101 führen Hörbeobachtung, selektiven Export und optionalen Spiel-Touchschutz-Versuch zusammen. Weiterhin 103 IDs und sieben v7-Stationen; historische Ergebnisse bleiben erhalten, neue Geräteprüfungen offen.

## 1.5.0-rc.1 – v7: Abend, Morgen und lokaler PC-Begleiter (2026-11-09)

Auf ausdrücklichen Updateauftrag **1.5.0-rc.1 / Code15**, weiterhin **Anker**, gleiche App-Kennung und geprüfte bestehende B4-Signatur. [Signiertes Handyupdate und Windows-Quellpaket](docs/UPDATE_V7_CODE15.md) sind veröffentlicht und vollständig im Browser nachgelesen. **1.077 Logik-/267 Browser-/174 frische JUnit-/89 Pythonfälle**, fünf Paket- und bestehende PC-/Updateprüfungen grün; [GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42607136664) einschließlich Windows erfolgreich. [Gemeinsamer Beleg](docs/ANKER_V7_UPDATE_NACHWEIS.json). Echte Samsung-/Windows-Versuche bleiben offen; ältere Audit-Zahlen darunter behalten ihren damaligen Quellbezug.

- Freiwillige Abend-/Morgenführung aus demselben Tagesplan: Cyan/Amber/OLED-Darstellung, Zeitbogen und bestehender Fokus-Timer mit Restzeitfarben. Keine automatische Erledigung aus Zeitablauf.
- Optionale lokale Schrittstimme und Vibrationsimpulse, begrenztes ausblendendes Brown Noise, direkter Morgenfokus nach bestätigtem Wecker, Ein-Tipp-Wachrückfrage und selbst gewählte Zombie-Kernschritte. Weckerbesitz, alternative Beenden-Wege und Notfall-Stopp bleiben erhalten.
- Abendphasen 30/10 Minuten vor Bett, privater Gedankenparkplatz, Speicherpunkt und Wenn-dann-Plan. Offenes Ende bleibt offen; tatsächliche Morgenabschlüsse und private Textfreigaben bleiben getrennte Handlungen.
- Neuer Python-Begleiter unter `pc-companion/`: lokale QR-Kopplung mit PC-Bestätigung, gepinntes TLS/WSS, mDNS, dauerhafte verschlüsselte Ereignisse und ehrlicher Planempfang. Standardmäßig nur Zeiten, Zustände und Schrittnummern; keine Programmanalyse.
- Optionaler PC-Schleier, Audio-Ducking und gewählte Abendaktion nach mindestens 60 Sekunden eigener Speicherfrist. Klassische PC-Stopp-Aufgabe verhindert Doppelwirkung. Separater strenger Modus mit begrenztem Wieder-Sperrwächter und signierter QR-Notverlängerung am Handy; sichtbares Beenden bleibt möglich. Der Morgenabschluss entsperrt Windows nicht automatisch.
- Freiwilliger Licht-Schritt, neutrale 7-/14-Tage-Rhythmusansicht und optionaler Morgen-Countdown/Wake-on-LAN. Kein Relay, Schlafdatenimport, Lichtgerät oder kostenpflichtiger Dienst aktiviert.
- Sieben gemeinsame Prüfstationen 97–103 im bestehenden Bericht-/Exportmodell; die bisherigen sechs kurzen Updateprüfungen und alle alten Ergebnisse bleiben erhalten. [Bedienung und Windows-Setup](docs/PC_BEGLEITER.md) · [Architektur und Datenvertrag](docs/PC_LINK_PROTOKOLL.md).
- Folgeaudit: PC-Leiste mit Phasentitel und laufenden Sekunden; gewählte v7-Abendfolge berücksichtigt die Bettzeit, klassischer PC-Stopp bleibt eigenständig. Verlängerungen verschieben alle Vorphasen; +15 Minuten am Bett addieren den Bildschirm-aus-Puffer nicht erneut. QR-Notverlängerung funktioniert auch nach bestätigtem automatischem PC-Nachtbeginn, mit unveränderten Hardware-/Signaturgrenzen.
- Morgen-Zombie verkleinert ausschließlich den Morgen. Ein offen gebliebener Morgen verdrängt später die Abendführung nicht und wird nicht automatisch erledigt. 1.043 Logik-/265 Browser-/167 frische JUnit-/83 Pythonfälle sowie bestehende PC-/Updateprüfungen grün; [neuer Nachweis](docs/ANKER_V7_FOLGE_NACHWEIS.json), keine Geräte-Häkchen daraus.
- Ergänzter Abendlichthinweis und freiwillige Entlastung der Handy-PC-Hinweise nur mit frischer passender PC-Bestätigung. Bestehende Abendphasen ersetzen den Lichthinweis; Bett und Wecker bleiben unabhängig.
- Eigene ausgeschaltete Health-Connect-Schlaflesefreigabe, lokale Vorschläge für 14 Nächte und bewusste Übernahme ausschließlich in leere Nächte. Herkunft bleibt erkennbar, eigene Angaben geschützt; keine automatische Schlafphasen- oder Morgenbewertung.
- Windows-Quellpaket mit reproduzierbarem Manifest, Einrichten.cmd, funktionierendem Start aus dem Downloadordner und geprüftem manuellem Updateweg. Benutzergebundene Daten bleiben außerhalb des Programmordners erhalten; kein EXE- oder automatischer Updatekanal behauptet.

## 1.3.0-rc.6 – Kompakte Routinekarten (2026-11-07)

875 Logik-/220 Browserfälle und CI28 grün. Signiertes Code13-Update mit [geprüftem ZIP-Handydownload](docs/INSTALLATION_ANKER_NEU.md); dieselbe Signatur wie Code11/12. Native122Fälle für unveränderte Inputs wiederverwendet. Neuer Samsung-Test offen.

- Dauer, direkte Zahleneingabe und Einheit stehen in einer Zeile. Andere Einstellungsbereiche behalten ihre bisherigen Feldgrößen.
- Griff, Sortierpfeile und Entfernen sind unter allen Eingaben gebündelt. Die Minimal-Version bleibt sichtbar; normale Karten sind220Pixel hoch.
- Feste Touchflächen und geprüfte Textgrenzen verhindern Überlagerungen auch bei großer Schrift. Bestehende Sortier-/Speicherlogik und Nutzerdaten bleiben erhalten.
- G95 begleitet den gezielten Handyversuch; Gesamtprüfung und neuer Android-Gerätebericht werden getrennt dokumentiert. [Details](docs/UI_ROUTINEN_RC6.md).

## 1.3.0-rc.5 – Antworten auf Alltags-Erinnerungen (2026-11-07)

875 Logik-/215 Browser-/122 frische native JUnit-Fälle und CI26 grün. Signiertes Code12-Update mit derselben Release-Signatur wie Code11 und vollständig geprüftem [Handydownload](docs/INSTALLATION_ANKER_NEU.md). Neue Samsung-Prüfung offen.

- „Erledigt“ aus der Abend-Erinnerung bestätigt die noch offenen geplanten Schritte; bereits gewählte Ergebnisse bleiben erhalten. Auch die Vorwarnungen für Losgehen und PC-Stopp übernehmen die bestätigte Handlung.
- „Heute nicht“ lässt offene Abend-Schritte nur für diesen Tag entfallen. Keine neuen Erledigt-Häkchen oder Punkte; frühere echte Handlungen bleiben erhalten.
- Vorübergehend fehlgeschlagene Listener werden erneut eingerichtet; Rückmeldungen am Ende eines laufenden Abgleichs gehen nicht mehr bis zur nächsten Appöffnung unter. Speichern und Empfangsbestätigung bleiben atomar und wiederholbar.
- Zweimal „5 Min später“ erhält die anderen Antwortknöpfe. Der Abgleich holt ersetzte Wiederholungen nicht erneut zurück; bestehende Ruhe-/Fokusregeln gelten weiter.
- Die vorhandenen Teststationen G21/G67 erklären den gezielten Geräteversuch. Historische Berichte bleiben erhalten; tatsächliche Samsung-Zustellung und Installation sind separat zu prüfen.

## 1.3.0-rc.4 – Anker Neu mit eigener Release-Signatur (2026-11-07)

- Neue App-Kennung und Release-Signatur: direkte APK-Installation parallel zum bisherigen Anker.
- Bewusste Wiederherstellung älterer eigener Sicherungen mit Vorschau und atomarem Speichern; fehlende Bereiche und historische Testbelege bleiben erhalten. Standardimport bleibt LWW.
- Ersteinrichtung bietet den Datenumzug direkt an; Felder passen auch bei 320 px/160 % Schrift. Planung und Fortschritt beginnen erst nach Einrichtung oder Übernahme.
- 864 Logik-/211 Browser-/116 frisch ausgeführte native JUnit-Fälle und 36 Update-Mockfälle grün. Echte Cloud-Signierung und vollständiger öffentlicher Download geprüft; Samsung-Installation und externe Schlüsselsicherung bleiben offen.

[Handyinstallation](docs/INSTALLATION_ANKER_NEU.md) · [Nachweis](docs/ANKER_NEU_RC4_NACHWEIS.json).

## 1.3.0-rc.3 – gemeinsame Updateprüfung (2026-11-07)

- Einstellungen und Zeit-/Dauerfelder einheitlich ausgerichtet; Bildschirmabstand und bereits abgestimmte Abendhinweise erklärt.
- Lokale Zeitübersicht kategorisiert bestehende Quellen und bietet Prüfvorschläge, ohne etwas abzuschalten oder zu erledigen.
- Optionale Teilschritt-Timer, nahe Arbeitszeiten auf Jetzt, native Audiofokus-/Erinnerungskorrekturen und einzelne Kanaldiagnose.
- Bewusst gestarteter stummer Schlafhinweis mit freiwilliger Android-Fensterfreigabe; nur bei eingeschaltetem, entsperrtem Bildschirm vorgesehen.
- Sechs empfohlene Geräteprüfungen sowie Berichtsexport, Importvorschau und unveränderte historische Belege.
- Gezielte kompatible Abhängigkeiten und manueller GitHub-Signierweg vorbereitet. Kein Anbieter, Playkonto oder kostenpflichtiger Dienst aktiviert.

853 Logik-/209 Browserfälle, 19 PowerShell- und 34 Update-Mockfälle grün. 116 native JUnit-Fälle wurden im selben RC3-Auftrag ausgeführt und nach dem reinen Weblayoutfix mit nachweislich gleichen Nativeinputs wiederverwendet. Neue Samsung-, Windows- und echte Signier-/Installationsprüfungen bleiben offen. [Update](docs/UPDATE_RC3.md) · [Nachweise](docs/UPDATEPRUEFUNG_RC3.md). Historische RC2-Nachweise und Funktionen bleiben erhalten.

## 1.3.0-rc.1 – E04–E09 (2026-11-06)

Gemeinsamer geprüfter Updatekandidat, Code8. GitHub-CI21 grün auf240033c; neue asynchrone Testbarrieren gegen vorzeitige Navigation/Reloads sind mit echten IDB-Verzögerungen abgesichert. Automatisch780 Logik-/139 Browser-/87 Kotlinfälle und19 PowerShell-Fälle grün, unsignierte APK gebaut. Echte Android-Prüfungen des neuen Stands und echte Anbieter-/Windows-Ausführung bleiben offen. Tatsächliche automatische Nachweise, Integrationsstand und verbleibende Grenzen führen [Implementierungsplan](docs/ANKER_IMPLEMENTIERUNGSPLAN.md) und [Testnachweise](docs/ANKER_TESTNACHWEISE.md). Ältere Versionsabschnitte bleiben als Verlauf erhalten.

- **E04 – frei umplanen:** „Heute anders“ auch im Routinefokus, häufige Wege direkt und Details nach Bedarf. Rücknahme verändert Planungen atomar und erhält später wirklich erledigte Handlungen. Freizeit mit offenem Ende erhält keinen erfundenen PC-Termin; freie Verlängerungen und datierte Pausen benötigen das neue Windows-/Serverprotokoll 2. Bereitstellen ist kein Empfangsnachweis. Kapitel verlieren seit der vorangegangenen E03-Korrektur keinen Fortschritt durch Nichtnutzung.
- **E05 – Arbeitszeit:** bestätigte Intervalle, Pausen und laufende Nachtschichten bleiben die gemeinsame Grundlage. Restprognose, unbestätigte Konflikte, ältere Datumsauswahl, sichere Korrektur-/Rücknahmewege sowie getrennte Wochen-Startgrenzen und Feierabendwünsche. Kein Plan gilt automatisch als gearbeitet.
- **E06 – Orte, Wege und Morgen:** lokale wiederverwendbare Orte, Termindetails, offene beziehungsweise Remote-Orte und echte Abfahrts-/Ankunfts-/Rückkehrhandlungen. Wegeketten erfinden weder Ursprung noch Fahrzeit. Harte frühe Pflichten und Vorbereitungsbedarf fließen in die Vorschau ein; einmalige Weckzeit nur nach Bestätigung.
- **E07 – Wetter und Packen:** lokaler Wetterort, Ortswechsel-/Antwortprüfung, Stundenfenster und sichtbarer Abrufstand. Fehlende Werte werden nicht zu sicheren Nullen. Packvorlagen und vorbereitete Gegenstände verwenden die bestehenden Termine/Orte. Wetterort und Aktivierung verlassen den lokalen Speicher nicht per Sync; frühere Serverkopien werden nicht rückwirkend gelöscht.
- **E07/E08 – optionale Vorschläge:** echte geschützte OpenAI-/Google-Routes-Adapter mit bestehenden Supabase-Konten, eigener Nutzer-/Originfreigabe und Tagesbudgets. KI und Verkehr sind getrennt aus, Vorschläge vor Übernahme bearbeitbar, automatische Wege brauchen eine zusätzliche Wahl. Externe Bereitstellung, Modellwahl, Schlüssel und Kostenaktivierung sind offen; Testbackend-Antworten sind kein Echtanbieter-Nachweis. [Einrichtungsvertrag](docs/OPTIONALE_DIENSTE.md).
- **E08 – Android-Extras:** bewusst gestartetes lokales Diktieren, lokale kurze Zeitinfos, besuchsgebundene Standorthinweise mit manueller Ankunftsbestätigung, ablaufende allgemeine Widget-Inhalte und Schnellzugriffe. Lesen/Schreiben bei Google Kalender getrennt, Fehler und ältere Daten erkennbar. Sprache, Geofences, Launcher-/Widgetwege und tatsächlicher Google-Rückweg brauchen neue Gerätetests.
- **Homeoffice-Kontakt:** eigene Tageswahl schon erledigt/nicht nötig/später; ehrlicher Kopier-/Sharestatus und höchstens eine freiwillige Rückfrage nach30Minuten im ruhigen Arbeitskontext.
- **E09 – Sicherheit und Bedienung:** Importvorschau und Validierung vor Übernahme, bewusst abwählbare sensible Sicherungsgruppen, sichtbare Speicherfehler mit erneutem Versuch, Tastatur-/Touch-/Schrift-/Bewegungsverbesserungen. Gemeinsame geführte Prüfrunde statt automatisch gesetzter Geräte-Häkchen; frühere Berichte bleiben erhalten.

## 1.2.0-rc.2 in Entwicklung (2026-11-06)

- Öffnungslinks aus Widget/Benachrichtigung sperren die Navigation nicht mehr durch erneutes Öffnen nach jedem Seitenwechsel. Neue Links und klingelnde Wecker bleiben erreichbar.
- Eine bewusst gestartete Aktivitäts-Messnacht pausiert ihren Vorwecker. Hinweis vor dem Start sowie im Mess- und Weckerstatus; Hauptwecker und gespeicherte Vorwecker-Einstellung bleiben erhalten. Die Pause gilt auch nach Messungsende bis zu diesem Haupttermin, neue Termine verwenden wieder die Einstellung.
- Geführte Gerätefälle64/65 ergänzen Navigation und Vorweckerpause. Neue Ergebnisse bleiben bis zum eigenen Test offen.
- **E02 Erinnerungen:** aktuelle Revision/Zustellung prüfen, Wirkung und Receipt atomar speichern, erst dann bestätigen. Schnelle Planänderungen werden nacheinander abgeglichen; alte Buttons und doppelte Rückmeldungen erzeugen keine neue Erledigung. Jede Wiederholung und jedes Snooze respektiert die Ruhe-/Freizeit-/Fokuspolitik.
- **E02 Mehrtag:** vollständiger Tagesvorrat bis zum Plantagwechsel, zusätzliche bekannte Sondertage datiert, danach wichtige gespeicherte Wochenregeln ohne Nachholsturm. Erforderliche Alarm-/Messanzeigen reservieren vor dem Posten Platz im gemeinsamen Meldungsbudget.
- **E02 Papier:** direkte Routinen-Druckwege, dedizierter Android-Druckinhalt und eigenständige PDF-Datei ohne Druckdienst. Lange Routinen dürfen mehrere Seiten nutzen, QR mit vier Modulen Rand; Dialog-/Share-Abbruch ist kein Druckerfolg.
- **E02 Prüfweg:**74 geführte Fälle mit direktem Einstieg **Erinnerungen & Druck prüfen**. Keine automatischen Geräte-Häkchen.

Automatische Nachweise im Testprotokoll; diese Korrekturen und E02 sind noch nicht am Handy geprüft. Keine neue Abhängigkeit; bestehende Daten werden kompatibel erweitert.

## Unveröffentlicht: E00-Audit und erste E01-Verbesserungen

Versionsnummer unverändert. Automatische Nachweise und Grenzen in [ANKER_TESTNACHWEISE.md](docs/ANKER_TESTNACHWEISE.md); diese Änderungen sind **noch nicht auf dem Galaxy geprüft**, kein Release/APK.

- **Gemeinsam testen:** eigene Seite mit63 geführten Versuchen, direkten Einstellungswegen, Rückkehrbanner, lokalen Notizentwürfen und bewusst gespeicherten Berichten. Browser und Android sowie unterschiedliche Codestände bleiben unterscheidbar. Keine Punkte oder Alltags-Erledigungen für Test-Häkchen. Alte Geräteberichte werden nicht automatisch übernommen.
- **Zeiten direkt eingeben:** Uhrzeiten zwischen +/- antippen, Dauern als Zahl bearbeiten. Leere Zahleneingaben setzen nichts auf0. Nachtzeiten und manuell gewählte Zeiten bleiben auch in der Ersteinrichtung geschützt.
- **Wecker:** Bereits unterwegs befindliche, inzwischen verworfene/verschobene Signale werden abgewehrt. Ein deaktivierter Wecker holt kein fälliges Schlummern nach. Feste Absicherung des experimentellen Weckfensters bleibt erhalten.
- **Diagnose:** ungenaue Planung und gemeldete Fehler sind kein grüner Erfolg. Hinterlegte Planung bestätigt keine Hörbarkeit; für ausgelassene Termine wird keine Ursache erfunden.
- **Audit:** aktuellen Code statt historischer Version ausgewertet,71 Anforderungs-IDs im vorhandenen Plan zugeordnet, vorherige Änderungen gesichert und erhalten.

## Unveröffentlicht: Gleitzeit und Kundenarbeit

Versionsnummer unverändert, **nicht auf einem echten Handy geprüft**.

### Neu
- **Gleitzeit:** spätester Beginn (Vorgabe 09:00, änderbar), Wunsch-Beginn, Netto-Soll und übliche Pause je Wochentag, auch ein eigener Freitag. Anker rät keine Werte.
- **Arbeit starten, Pause, Feierabend:** freiwillig, höchstens zwei Tipps. Der Feierabend rückt mit der echten Pause in beide Richtungen.
- **Nachtragen und korrigieren** ohne Timer, mit Rückgängig. Wochenblick nur auf Wunsch und ohne Wertung.
- **Einsätze:** Wartung planen, Kundenproblem jetzt, Vor-Ort-Termin, Rufbereitschaft. Der freie Tag bleibt frei.
- **Heute anders → Arbeit heute anders:** später anfangen, Pause, früher Schluss, länger, Ziel für heute. Nur dieser Tag.
- **Hinweise** zu Pause, Ruhezeit und Sonntag, sachlich und abschaltbar. Nachricht zum Kopieren, Anker sendet nichts.

### Behoben
- **Wecker bei Always-on-Display:** Es kam nur die Meldung, das Vollbild erst nach einem Tipp. Anker schaltet beim Klingeln jetzt den Bildschirm ein und stößt das Vollbild erneut an. Am Gerät bestätigt.
- **Homeoffice meldete „Losgehen“** und zählte „Pünktlich los“ als Ziel. Beides entfällt dort jetzt.
- **Datenschutz:** Der Terminname stand in der Änderungsliste des Tages und damit im Sync, der Anlass stand im Widget und, beim Merken eines Gedankens, als Kontext im Sync. Alles drei ist nun allgemein gehalten. Bereits synchronisierte Einträge werden nicht rückwirkend geändert.
- **Früher zurück** beendet nun auch den Termin im Plan, statt ihn bis zum geplanten Ende anzuzeigen.

## 1.2.0-rc.1 (2026-11-04), Vorabversion

**Noch nicht auf einem echten Handy geprüft,** auch die Prüfung von 1.1.0-rc.1 steht noch aus.

### Neu
- **Heute anders:** etwas anderes vor, Routine später, heute nicht nötig, länger wach, Plan ab jetzt neu. Mit Änderungsliste und „Zurück zum ursprünglichen Plan“.
- **Termine und Wege:** Freunde, Kunden und eigene Termine mit Uhrzeit, optional Ort, Fahrzeit und Ende. Der Weg startet am letzten bekannten Ort, ohne Umweg über die Wohnung. Die Rückkehr wird nicht erfunden.
- **Unterwegs:** Fertigmachen, Bin los, Ich bin angekommen, Bin wieder da, Route in Google Maps.
- **Morgen rückwärts geplant:** Vorschlag für eine einmalige Weckzeit, nur nach Bestätigung. Der Standard bleibt.
- **Schlaf:** sachlicher Hinweis zur erwarteten Schlafzeit, keine Bewertung.
- **Abends schon erledigt:** Morgenschritt entfällt, gilt dort aber nicht als erledigt.
- **Wetter für morgen** (aus, bis du es einschaltest), **Homeoffice-Text zum Kopieren**, eigene Puffer für Wege.

### Behoben
- **Überspringen galt als „Abendroutine erledigt“.** Das Kernziel ließ sich so ohne echte Handlung erreichen. Jetzt zählt nur, was du wirklich gemacht hast.
- **Haken in der Tageslinie** erscheinen nur noch bei wirklich Gemachtem.

### Geändert
- **Ein bewusst geänderter Tag zählt nie als verfehlt** und kostet im Kapitel nichts. Alte Tage bleiben, wie sie sind.

### Noch offen
- Live-Verkehrsdaten und Ankunftserkennung per Standort sind nicht umgesetzt.
- Orte lassen sich noch nicht als feste Liste speichern. Zielkompass, „Nicht vergessen“-Liste und eine selbst gesetzte einzelne Abend-Erinnerung fehlen noch.

## 1.1.0-rc.1 (2026-11-04), Vorabversion

**Noch nicht auf einem echten Handy geprüft.** Logik per Unit-Tests geprüft, die APK ist gebaut. Lass den Android-Wecker zusätzlich gestellt, bis du [die Geräteprüfung](docs/GERAETETEST.md) durchlaufen hast.

### Behoben
- **„Wecker testen“ löscht den echten Wecker nicht mehr.** Der Test war derselbe Alarm wie der Hauptwecker, ersetzte ihn und setzte das Schlummern zurück.
- **Der Test zählt nicht mehr als „aufgestanden“.**
- **Der nächste Morgen plant sich selbst,** auch nach dem 30-Minuten-Ende und bei geschlossener App.
- **Doppelte Signale erzeugen keine zweite Klingel,** das Zeitlimit übersteht einen Neustart der App.
- **Erinnerungen laufen zwei Wochen weiter,** auch ohne die App zu öffnen, und bauen keinen Stau auf.
- **Höchstens drei Anker-Meldungen in der Leiste,** feste Termine werden nicht von Kleinigkeiten verdrängt.
- **Knöpfe in Meldungen wirken bei geschlossener App.**
- **„Morgen erledigen“ erscheint jetzt wirklich** am richtigen Tag unter **Tag** und auf der Startseite.
- **Von Hand gesetzte Zeiten bleiben stehen,** wenn Anker neu rechnet.
- **PC-Stopp erzwingt nichts mehr:** Das frühere Herunterfahren mit Wartezeit schloss Programme laut Windows-Doku erzwungen. Jetzt gibt es 5 Minuten Schonfrist, ein Herunterfahren ohne Zwang und ein Skript zum Aussetzen. Dafür das Paket neu installieren.
- **Drucken auf Android:** eigener Weg zum Systemdialog, der `window.print()` in der App nicht zuverlässig war.

### Neu
- **Startseite:** eine Hauptaktion, höchstens zwei weitere, Rest unter „Mehr“. Warum etwas dran ist, steht in einem Satz.
- **Arbeit:** wichtigste Aufgabe statt „nichts zu tun“, „Ich wurde unterbrochen“, Fristen, Feierabend-Übergabe. Bleibt auf dem Gerät.
- **Unterstützung wählen:** Einfach anfangen, Wenig Energie, Überlastet, Auf Kurs.
- **Gedanken:** nach dem Speichern „Du warst bei …“ und zurück.
- **„Ich hänge fest“:** ein Bildschirm, ein Schritt, 2-Minuten-Ring, „Etwas kleiner“.
- **„Tag neu sortieren“:** höchstens drei Dinge ab jetzt, kleine Versionen für den Rest.
- **Wecker:** optionaler Vorwecker und Wachheits-Check, Notfall-Stopp ohne Lesen und Rechnen, Diagnose mit echten Android-Werten.
- **Privates Einnahmeprotokoll:** aus, bis du es einschaltest. Bleibt auf dem Gerät, nie automatisch, keine Wirkungsanzeige.
- **Fokus-Puls** (aus), **Abendmodus-Vorschlag** (aus), **Ankommen nach der Arbeit** (aus), **Spiel ausblendbar**, **freiwillige 7- oder 14-Tage-Probe**.
- **Druckauswahl:** Morgen, Abend, beide, QR-Code, Haustür, A5 oder A4.

### Geändert
- Fortschritt beim Fokus-Timer übersteht Pausieren und Neuöffnen.
- Exakte Wecker: `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` nur noch bis Android 12.

### Daten
Einstellungen, Routinen, Spielstand, Gedanken, QR-Code und Sicherungen aus 1.0.x bleiben erhalten. Neues ist standardmäßig aus.

### Noch offen
- Alle Punkte aus [GERAETETEST.md](docs/GERAETETEST.md), besonders Samsung, Sperrbildschirm, „Nicht stören“, Neustart und der gedruckte QR-Code.
- Spracheingabe für Gedanken ist nicht umgesetzt. Das Widget zeigt keine Arbeitsaufgaben.

## 1.0.1 (2026-11-04)

### Behoben
- **Schlummern löscht den Wecker nicht mehr:** Der Schlummer-Wecker läuft jetzt getrennt vom Wecker für den nächsten Morgen. Er bleibt auch nach einem Neustart des Handys bestehen.
- **Schlummern bleibt auf 1× begrenzt:** Wenn du in die App zurückkehrst oder sich der Plan ändert, erscheint der Schlummer-Knopf nicht mehr erneut.
- **Sport lässt sich jetzt abhaken:** Unter **Tag** gibt es einen „Erledigt“-Knopf, den du auch zurücknehmen kannst. Bei Fitnessstudio oder Sport nach der Arbeit steht er auch auf der Startseite. So sind Sporttage in Stufe 3 auch ohne Health Connect schaffbar.

### Geändert
- **Training in der Morgenroutine zählt als Sport:** Das gilt für Training zu Hause und Laufen, auch als kleine Version. Beim Fitnessstudio zählt nur der Knopf oder Health Connect.

### Dokumentation
- Neu: [Anleitung](docs/ANLEITUNG.md) und [Struktur des Repositorys](docs/STRUKTUR.md)

### Noch offen
- Die Schlummer-Korrektur ist kompiliert, aber noch nicht auf einem echten Handy getestet.

## 1.0.0 (2026-10-28)

Erste Version als Android-App und Web-Version.

### Kern
- **Tagesplan:** rückwärts vom Arbeitsbeginn berechnet, mit Kalenderterminen, Minimal-Versionen und „Ich mache heute länger“
- **Startseite „Jetzt“:** eine nächste Aktion, Countdown zur nächsten festen Zeit, „Ich hänge fest“ mit 2-Minuten-Timer
- **Routinen:** Fokus-Modus Schritt für Schritt, frei editierbar, Reihenfolge per Ziehen
- **Tagesarten:** Arbeit, frei, Urlaub, krank, spontan Homeoffice

### Android
- **Erinnerungen:** mit drei Stärken, Ruhezeiten und den Knöpfen „Erledigt“, „5 Min später“ und „Heute nicht“
- **Wecker:** Vollbild-Alarm, Ausschalten per QR-Code oder 3 Rechenaufgaben
- **Widget:** nächste Aktion, nächste feste Zeit, Knopf für Gedanken
- **Einrichtungs-Check:** Ampeln für Berechtigungen und Extras
- **Health Connect:** nur Lesen von Training und Schritten

### Spiel
- **Fünf Themen:** Seefahrt, Piraten-Abenteuer, Weltraum-Saga, Kampfkunst-Saga, Schlicht
- **Fortschritt:** XP, Level, Abzeichen und Erfolge
- **Kapitel:** 7, 14, 30 und 66 Tage mit der Regel „Nie zweimal“ und einem Joker
- **Stufen und Belohnungen:** drei Stufen, die neue Ziele freischalten, und ein Shop für eigene Belohnungen

### Alltag
- **Gedanken-Inbox** mit 2-Minuten-Durchsicht
- **Essen:** eigene Gerichte, Zufallsvorschlag, Vorkoch-Tag
- **Aufräumen:** 10-Minuten-Timer mit wechselnden Zonen
- **Weiteres:** Abend-Checkliste, Wochenrückblick, Druckansicht (A5), Hilfe-Seite

### Optionale Extras
- **Sync und Login:** Supabase mit Magic Link, jeder Nutzer sieht nur seine Daten
- **Kalender:** Google Kalender und `.ics`-Export
- **PC-Stopp für Windows:** Warnungen, Herunterfahren, einmal pro Abend 15 Minuten Verlängerung
- **Sicherung:** JSON-Export und -Import

### Datenschutz
- Der Kern läuft offline und ohne Konto.
- Keine Werbung, kein Tracking, keine Analytics.
