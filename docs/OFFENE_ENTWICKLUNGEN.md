# Entwicklungsstand nach dem aktuellen Codeabgleich

**Fortschreibung Versionsplanung 14.11.2026:** [Konkreter Vorschlag Code18/1.5.0-rc.4 auf Basisb8306d6](PLAY_PRUEFSTAND_VERSION_PLAN.md), nachdem Nutzer höchsten Gesamtcode17 nennt. Keine Nummer reserviert/frei garantiert, Projekt-/Versions-/Freigabedateien unverändert17/rc.3. Neuer Versionscommit/Quellkennung/Artefakthash noch nicht vorhanden; alte Code17-Belege erhalten. Nur Planung lokal sichern, keine externe Abfrage/Schlüssel-/Build-/Signier-/Upload-/Geräteaktion oder Testwiederholung. T-006/V-014 IN_ARBEIT und E-002–E-005/Gesamtfreigaben offen. Genau nächster Auftrag zur separaten ausdrücklichen Beauftragung: begrenzte lokale Versionierung18/rc.4 und frischer UNSIGNIERTER AAB-Prüfbuild, aktuell nicht ausführen.

**Fortschreibung AAB-Prüfauftrag 14.11.2026:** [Lokale unsignierte AAB-Paketintegration belegt](AAB_INTEGRATION_T006.md), vorab gesichert/Taskgraph signaturfrei, vorhandenes Bundletool1.18.1/Manifest/Config/672JAR-Einträge/CRC/Assets geprüft. Code17/1.5.0-rc.3 unverändert, keine Signier-/Upload-/Geräte-/Playfreigabe. Keine Produkt-/Versions-/Workflowänderung oder erfolgreiche Suite wiederholt. T-006/V-014 IN_ARBEIT, E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag Versionsentscheidung anhand höchstem bereits belegtem Artefakt-/Trackcode als Nutzerangabe vorbereiten, ohne Änderung oder eigene externe Abfrage.

**Fortschreibung Galaxy-Herkunft 14.11.2026:** Nutzer antwortet „google play“ zur aktuell genutzten App; [Herkunftszuordnung und gestufter Prüfweg](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Kein ausgelesener Gerätesignatur-/Versionsbeleg. Weitere Vorbereitung auf Play-Weg, kein B4-Direktupdate einer8A-Installation zusagen. Genau nächster Auftrag zur separaten ausdrücklichen Beauftragung: lokaler UNSIGNIERTER AAB-Integrationsbuild mit unveränderter Version und nachgewiesener Signaturfreiheit; Herkunftsantwort selbst erteilt keine Buildfreigabe. Aktuell keine Software-/Geräte-/externe Aktion, T-006/V-014 IN_ARBEIT und E-002–E-005/Gesamtfreigaben offen.

**Fortschreibung Signierrollen 14.11.2026:** [Nutzerfingerabdrücke lokal verglichen](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md): Play-App-Signierer8A und UploadB4 verschieden; vier B4-Nachweise passen zum Uploadzertifikat. Historische B4-Direkt-APKs sind kein belegtes reguläres Update einer8A-Installation; keine Rotation oder heutiger privater Schlüsselzugriff belegt. Keine eigene externe/Schlüssel-/Geräte-/Build-/Signier-/Playaktion. Genau nächster eigener Auftrag tatsächliche Galaxy-Installationsherkunft anhand Nutzerangaben zuordnen. T-006/V-014 IN_ARBEIT, E-002–E-005/Gesamtfreigaben offen.

**Fortschreibung interne Testmetadaten 14.11.2026:** Nutzer meldet Paket `de.frnkrm.anker.mobile`, Code17, Versionstext wörtlich `Anker 1.5.0-rc.3 · Code17`, Status `Entwurf`. [Zuordnung und Beleggrenzen](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Kein aktiver Release-/Quell-/Gerätenachweis und keine stille Normalisierung des Versionstexts. Nächster eigener Auftrag nur öffentliche App-Signier-/Uploadzertifikatsrollen anhand Nutzerangaben zuordnen, falls bereitstellbar. Keine eigene externe Abfrage, Schlüssel-/Geräteaktion oder neue Freigabe; T-006/V-014 IN_ARBEIT, E-002–E-005 offen.

**Fortschreibung 14.11.2026:** [Nichtgeheime Nutzerantwort eingeordnet](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md): Nutzer nennt sich Besitzer und meldet internen Play-Test. GitHub-Schlüsselablage bleibt Vermutung; aktueller Testcode/Zielinstallation/Signierer und nutzbares Signiermaterial unbekannt. Keine Schlüssel-/Console-/Geräteabfrage oder neue Freigabe. T-006/V-014 IN_ARBEIT, E-002–E-005 offen. Nächster eigener Auftrag nur nichtgeheime Metadaten des internen Testbuilds beim Nutzer einholen; bekannte Besitzerangabe nicht erneut abfragen.

## Verbindliche Roadmap – Einrichtungsabschluss 13.11.2026

Maßgebliches Anforderungsinventar: [ANKER_PLAN.txt](ANKER_PLAN.txt), insbesondere Abschnitt 2; Arbeitsregeln in Abschnitt 5. Die Datei bleibt unverändert. Diese Tabelle ist die einzige aktuelle ID-Roadmap; die unten erhaltene Bestandsliste vom 10.11. ist historischer Kontext, keine zusätzliche Freigabe.

**Neue Nutzerentscheidung vom 13.11.2026:** Originalumgebung und `835235b` zurückstellen; auf `entwicklung/anker-neu` lokal weiterarbeiten. T-001 ist als gesichert pausiert abgeschlossen, nicht wiederhergestellt. Vorhandene Sicherungen erhalten. Die alte Umgebung blockiert die weitere Einrichtung nicht mehr. T-002/E-001/T-003 sind für die lokale Web-/Logikentwicklung abgeschlossen. F-001 wurde anschließend einzeln freigegeben und lokal umgesetzt. F-002 wurde anschließend einzeln freigegeben und lokal umgesetzt. T-004 ist als Prüfvorbereitung abgeschlossen. T-002s native Nachbereitung hat JDK21/SDK36 eingerichtet und252Android-JUnit bestätigt; der Toolchainblocker für F-003 ist aufgehoben. F-003 wurde anschließend gesondert beauftragt und lokal umgesetzt; native Softwareabnahme260/260, reale Geräte offen. T-005 wurde anschließend gesondert beauftragt und lokal abgeschlossen; Datengrenzen/Backupimport abgesichert. F-004 wurde danach gesondert beauftragt und lokal abgenommen; F-005 wurde anschließend gesondert beauftragt und lokal abgenommen; F-006 wurde anschließend gesondert beauftragt und lokal abgenommen; F-007 wurde anschließend gesondert beauftragt und lokal abgenommen; T-004s gezielte NFC-Machbarkeits-/Prüfpfadvorbereitung ist anschließend lokal dokumentiert. F-008 wurde anschließend im ausdrücklich freigegebenen lesenden Softwareumfang lokal geprüft; genau NFC-Recht/optionale Hardware ergänzt, keine Tag-Schreibfunktion oder dauerhaften Zuordnungen. F-009 anschließend ausschließlich als lokale stille Fokusbegleitung umgesetzt und geprüft; keine soziale Variante oder Begleitstatistik. F-010 anschließend freiwillig lokal aus vorhandenen Tagesständen geprüft; keine neue Messung/Persistenz oder Ursachenbehauptung. T-006s gemeinsamer Web-/Logik-/PC-Teil anschließend lokal geprüft; Produktquellen unverändert, Testannahmen/Artefaktpfade korrigiert. T-006s unsignierte lokale Android-Paketintegration anschließend auf18f6bb2softwareseitig geprüft; Webassets aktuell, Signaturfreiheit belegt. T-006/V-014 insgesamt IN_ARBEIT; E-002–E-005, signierter Geräteprüfbuild und Remote-/Gesamt-/Releaseabnahme offen. Signier-/Geräteprüfvoraussetzungen danach aufb816e1a ausschließlich lesend geklärt: alter Helfer hat feste Debugannahmen; heutige Zielinstallation und erreichbarer passender Signierbesitzer unbelegt. Nächster eigener Auftrag fehlende nichtgeheime Nutzerangaben einholen, kein Signieren oder Geräteeingriff. Keine F-003-Implementierung durch T-004. Status OFFEN bedeutet unbewertete Restabnahme, nicht „im Bestand fehlt alles“. [Aktuelle Nachweise und Wiederaufnahme](PROJECT_STATUS.md).

Statuswerte: OFFEN, IN_ARBEIT, BLOCKIERT, BEREIT_ZUR_PRÜFUNG, ERLEDIGT. Für diese neue Planungsdokumentation: Integriert ja im lokalen Arbeitsbranch, nein auf main (nicht gepusht; PR2 laut Nutzer offen, API-Nachweis fehlt); Gerätetest nicht nötig; veröffentlicht nein. F-001/V-008, F-002/V-009, F-003/V-010, F-004/V-005, F-005/V-001, F-006/V-002, F-007/V-003, F-008/V-004 (nur lesender Softwareumfang), F-009/V-006 (nur lokal still) und F-010/V-007 (lokale Leseübersicht): Softwareabnahme ERLEDIGT, integriert ja im lokalen Arbeitsbranch, nein auf main; Gerätetest offen, veröffentlicht nein. Für übrige F-IDs kein nachgewiesener vollständiger Abschluss; vorhandene Teilfunktionen bleiben davon unberührt. E-002–E-005/T-004/T-006 benötigen Gerätebelege, T-005 abhängig vom Datenfluss. Keine historische Gerätezelle ändern.

| ID | Titel | Status | Abhängigkeit | Planverweis |
|---|---|---|---|---|
| T-001 | Unterbrochene Entwicklung retten | ERLEDIGT | gesichert pausiert; bekannte Basis ausdrücklich freigegeben, spätere Wiederherstellung separat | [§ 2.2, T-001](ANKER_PLAN.txt) |
| T-002 | Umgebung und Entwicklungsbefehle prüfen | ERLEDIGT | T-001; Web-Abnahme erhalten; native Nachbereitung für F-003 mit252/252 JUnit abgeschlossen | [§ 2.2, T-002](ANKER_PLAN.txt) |
| T-003 | Roadmap und Übergabedokumentation einrichten | ERLEDIGT | T-002 | [§ 2.2, T-003](ANKER_PLAN.txt) |
| T-004 | Plattform- und Geräteprüfungen vorbereiten | ERLEDIGT | T-003; nur Vorbereitung, E-002–E-004/Gerätebeobachtungen offen | [§ 2.2, T-004](ANKER_PLAN.txt) |
| T-005 | Datenschutz und Datengrenzen absichern | ERLEDIGT | Software lokal; Datengrenzen für F-004 dokumentiert, neue Flüsse konkret prüfen | [§ 2.2, T-005](ANKER_PLAN.txt) |
| T-006 | Integration und Gesamtabschluss | IN_ARBEIT | Software/unsigned APK und AAB lokal belegt;18/rc.4 nur Vorschlag nach Gesamtcode17 laut Nutzer; Umsetzung/Signier-/Remote-/Geräte-/Gesamtfreigabe offen | [§ 2.2, T-006](ANKER_PLAN.txt) |
| F-001 | Abfahrtsbereitschaft sichtbar machen | ERLEDIGT | T-003 | [§ 2.3, F-001](ANKER_PLAN.txt) |
| F-002 | Kurzmodus bei Zeitmangel anbieten | ERLEDIGT | T-003, F-001 | [§ 2.3, F-002](ANKER_PLAN.txt) |
| F-003 | Dynamischen Vorbereitungsimpuls ergänzen | ERLEDIGT | T-003, F-001; F-002 nur bevorzugte Reihenfolge | [§ 2.3, F-003](ANKER_PLAN.txt) |
| F-004 | Zeitgefühl und Dauerabschätzung verbessern | ERLEDIGT | T-003, F-001; T-005 vor neuen Messdaten | [§ 2.3, F-004](ANKER_PLAN.txt) |
| F-005 | Wiedereinstiegs-Assistent | ERLEDIGT | T-003 | [§ 2.3, F-005](ANKER_PLAN.txt) |
| F-006 | Übergangshelfer | ERLEDIGT | T-003 | [§ 2.3, F-006](ANKER_PLAN.txt) |
| F-007 | Blockaden sanft erkennen und Vereinfachung anbieten | ERLEDIGT | T-003 | [§ 2.3, F-007](ANKER_PLAN.txt) |
| F-008 | NFC-Ankerpunkte | ERLEDIGT | Nur lesender Softwareumfang lokal; E-005 offen, kein Writer/UID-Mapping | [§ 2.3, F-008](ANKER_PLAN.txt) |
| F-009 | Freiwilliges Body Doubling | ERLEDIGT | T-005; nur lokale stille Software, soziale Variante nicht freigegeben | [§ 2.3, F-009](ANKER_PLAN.txt) |
| F-010 | Wochenrückblick über Hindernisse | ERLEDIGT | T-005/F-004/F-007; lokal lesend aus Tagesständen, keine neue Messung | [§ 2.3, F-010](ANKER_PLAN.txt) |
| E-001 | Cloud-Zugriffe prüfen | ERLEDIGT | T-001; Zugriffsgrenzen dokumentiert, keine neuen Kontorechte | [§ 2.4, E-001](ANKER_PLAN.txt) |
| E-002 | Android-Wecker real prüfen | OFFEN | T-004, Android-Gerät und Buildzuordnung | [§ 2.4, E-002](ANKER_PLAN.txt) |
| E-003 | Windows-Begleiter prüfen | OFFEN | T-004, Windows-Gerät | [§ 2.4, E-003](ANKER_PLAN.txt) |
| E-004 | Kalenderzugriff prüfen | OFFEN | T-004, Kalenderfreigabe am Gerät | [§ 2.4, E-004](ANKER_PLAN.txt) |
| E-005 | Optionalen NFC-Betrieb einrichten | OFFEN | F-008, geeignete Hardware | [§ 2.4, E-005](ANKER_PLAN.txt) |
| V-001 | Wiedereinstiegs-Assistent | ERLEDIGT | F-005 | [§ 2.1, V-001](ANKER_PLAN.txt) |
| V-002 | Übergangshelfer | ERLEDIGT | F-006 | [§ 2.1, V-002](ANKER_PLAN.txt) |
| V-003 | Vereinfachung bei Blockaden | ERLEDIGT | F-007 | [§ 2.1, V-003](ANKER_PLAN.txt) |
| V-004 | Physische NFC-Ankerpunkte | ERLEDIGT | F-008 lesende Software lokal; echte E-005-Beobachtung offen | [§ 2.1, V-004](ANKER_PLAN.txt) |
| V-005 | Zeitgefühl und realistische Zeitschätzungen | ERLEDIGT | F-004; Software lokal, Geräte offen | [§ 2.1, V-005](ANKER_PLAN.txt) |
| V-006 | Freiwilliges Body Doubling | ERLEDIGT | F-009 nur lokal still; keine soziale Kommunikation | [§ 2.1, V-006](ANKER_PLAN.txt) |
| V-007 | Wochenrückblick über Hindernisse | ERLEDIGT | F-010 lokal lesend; Ursachen/Wirksamkeit nicht behauptet | [§ 2.1, V-007](ANKER_PLAN.txt) |
| V-008 | Abfahrts-Countdown mit Pufferbewertung | ERLEDIGT | F-001 | [§ 2.1, V-008](ANKER_PLAN.txt) |
| V-009 | Rechtzeitiger Kurzmodus | ERLEDIGT | F-002 | [§ 2.1, V-009](ANKER_PLAN.txt) |
| V-010 | Dynamischer Vorbereitungsimpuls | ERLEDIGT | F-003; Software lokal, Geräte offen | [§ 2.1, V-010](ANKER_PLAN.txt) |
| V-011 | Tatsächliche Weckerzuverlässigkeit prüfen | OFFEN | T-004, E-002 | [§ 2.1, V-011](ANKER_PLAN.txt) |
| V-012 | Windows-Begleiter im Gerätebetrieb prüfen | OFFEN | T-004, E-003 | [§ 2.1, V-012](ANKER_PLAN.txt) |
| V-013 | Kalenderintegration tatsächlich prüfen | OFFEN | T-004, E-004 | [§ 2.1, V-013](ANKER_PLAN.txt) |
| V-014 | Gesamttests und sichere Releasevorbereitung | IN_ARBEIT | Software/unsigned APK und AAB belegt;18/rc.4 nur geplant, Versions-/Signier-/Upload-/Geräte-/Remote-/Gesamtfreigabe offen | [§ 2.1, V-014](ANKER_PLAN.txt) |
| V-015 | Diagnose und Datenschutz überprüfen | ERLEDIGT | T-005; Code-/Softwareprüfung, Geräte/Konten offen | [§ 2.1, V-015](ANKER_PLAN.txt) |

Bevorzugte spätere Reihenfolge F-001 → F-002 → F-003 → F-004 → F-005 → F-006 → F-007 → F-008 → F-009 → F-010; nicht automatisch abarbeiten. F-003 benötigt technisch kein F-002. Der in T-004 festgestellte native Toolchainblocker ist durch T-002 behoben; keine neue F-002-Abhängigkeit; [T-004-Prüfplan und Toolchainbedarf](GERAETETEST.md). T-004/T-005 rechtzeitig vor abhängigen Aufgaben, T-006 erst zum gemeinsamen Abschluss. Keine Bündelung ohne ausdrückliche Freigabe.

### Belegte vorhandene Grundlagen, keine vollständige neue Abnahme

- T-006: [Signier-/Geräteprüfvoraussetzungen lesend geklärt](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md), Zielinstallation/erreichbarer Signierbesitzer weiter unbelegt; keine Signierung/Tests wiederholt. Unsignierter Android-Prüfbuild auf18f6bb2mit aktuellen bytegleichen Webassets, Manifest/SDK/fehlender Signatur/16KBgeprüft; kein Geräte-/Releasebeleg.1372TS,378Browser und284Pythonfälle zuletzt grün, ergänzende PowerShell/SQL/Offlinegrenzen geprüft; native274JUnit aus F-008 quellen-/hashgleich erhalten. Keine neue Produktfunktion. [Gemeinsame Integration, Workflow-Auslöser und Paket-/Geräte-/Releasegrenzen](INTEGRATION_T006.md). Gesamtstatus IN_ARBEIT, keine Veröffentlichung.

- F-001/V-008 abgeschlossen: `src/core/departure.ts` projiziert Restzeit, offene Vorbereitung und rechnerischen Puffer aus bestehendem Plan/Log. `DepartureReadiness` ergänzt Jetzt ohne weitere Aktion oder Persistenz. 23 neue Logikfälle, 5 neue Browserfälle und bestehende Regressionen belegt; echte Geräte offen. [Nachweise](ANKER_TESTNACHWEISE.md). F-002/V-009 abgeschlossen: bekanntes Zeitdefizit bietet ausschließlich vorhandene kürzere Morgenvarianten an. Explizite Annahme, atomare Aktualitäts-/Doppelprüfung, keine Punkte aus der Wahl, keine Schrittentfernung. Ablehnung nur für die unveränderte aktuelle Ansicht; `shortMorning` im bestehenden Tages-Override ist rücknehmbar. Abend/globaler Modus unverändert. Vorhandene `leave-10`-/`leave`-/`latest-leave`-Regeln unverändert.
- F-003: vorhandene Reminder-Engine und Android-`ReminderScheduler` erweitert; datierter dynamischer Impuls ersetzt passende Vorwarnungen, fristgebunden und ohne Erledigungswirkung. Software lokal abgenommen; tatsächliche Android-Zustellung offen, siehe PROJECT_STATUS.md/GERAETETEST.md.
- T-005: [Datenfluss-/Löschinventur und F-004-Rahmen](DATENSCHUTZ_DATENGRENZEN.md); keine Freigabe neuer externer Datenflüsse.
- F-004: bestehende Fokus-/Lernwege ergänzt, Zeitvergleich und Pausenüberzug lokal abgenommen; keine neue Messstichprobe. Details in PROJECT_STATUS.md.
- F-009/V-006 lokal still abgeschlossen: gemeinsame Fokus-/Recoveryprüfung und bewusste flüchtige Begleitwahl, kein Timer-/Storewriter oder neue Daten.139TS/21verschiedene Browserfälle zuletzt grün. Soziale Variante nicht freigegeben; kein Begleitverlauf für F-010. [Stand und Grenzen](PROJECT_STATUS.md).
- F-005/V-001 lokal softwareseitig abgeschlossen: reine Recoveryprojektion auf aktuelle offene Referenzen/Planvarianten, Timerstatus/Restzeit und vorhandene Notiz in derselben kurzen Karte. Rückkehr navigiert ohne Timerstart; Fortsetzung ausdrücklich im Fokus. Hauptaktion, Schreibqueue und Datenschutzgrenzen erhalten; echte Geräte offen. [Prüfungen/Übergabe](PROJECT_STATUS.md).
- F-006/V-002 lokal softwareseitig abgeschlossen: aktueller Übergang aus demselben Jetzt-Leseweg, korrekte Routine-/Freizeit-/PC-Folge, frühe Morgeninstanz, bewusste Pause/Verlängerung und gemeinsame gewählte Nachtansicht. Keine neue PC-Steuerung, Geräte offen. [Nachweise](PROJECT_STATUS.md).
- F-007/V-003 lokal softwareseitig abgeschlossen: ausdrückliche Verkleinerung als belegter Auslöser, freiwilliger bestehender Tagesmodus, allgemeine Tagesabwahl und atomare Revalidierung. Keine automatische Diagnose oder behaupteter Verschiebeverlauf; genaue Grenze und Nachweise in PROJECT_STATUS.md.
- F-008: [Lesender Softwareabschluss und E-005-Prüfpfad](NFC_MACHBARKEIT.md) lokal geprüft:48TS/274JUnit/22Browser, ausdrückliche Scan-/Öffnungswahl, genau optionale NFC-Manifestfreigabe. Keine Tag-Schreibfunktion/dauerhafte Zuordnung. F-008/V-004 nur im beauftragten lesenden Softwareumfang ERLEDIGT; reale E-005-Geräteabnahme bleibt OFFEN.
- F-010/V-007 lokal abgeschlossen: freiwillige abwählbare Wochenübersicht bekannter Tagesstände, Lücken/kleine Grundlage und aktuelle Auswahl statt Ursachenverlauf.101TS/16verschiedene Browserfälle grün; keine neue Persistenz/Messung/Übertragung. Echte Gerätebelege offen. [Nachweise/Übergabe](PROJECT_STATUS.md).

---


Stand 10.11.2026. Der Nutzer hat nach dem Audit ausdrücklich alle verbleibenden Softwareentwicklungen beauftragt. Die folgende Liste ersetzt die frühere reine Vorschlagsliste und trennt integrierten Code, gemeinsame Abschlussprüfung und echte Einrichtung/Beobachtung.

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
| Google-Kalender | Nativer READ_CALENDAR-Leseweg für synchronisierte Google-Kalender samt Konto-/ID-Wechselschutz; App-Auswahl, exklusive Lesequelle, Cache-/Backup-Grenzen und Abbruch-/Navigationsschutz integriert. Bestehende direkte Google-Anmeldung und eigener Schreibkalender bleiben erhalten |
| PC-Updates | Signierter, fest gebundener Kanal mit optionaler automatischer Prüfung, bewusstem Download und gesonderter Installationsbestätigung integriert |
| PC-14 Relay | Optionaler verschlüsselter Transport mit getrennten widerrufbaren Berechtigungen; SQL/Handler lokal geprüft, Android-/PC-/Einrichtungshooks integriert. Kontaktfrische und abgelaufene Bedienbefehle auch bei WLAN-Rückkehr abgesichert. Kein laufendes Supabase behauptet |
| Stille Schlafbegleitung | Eigener ausgeschalteter Schalter, vorhandener Bettquellen-/Controllerweg, vollständig stille Folgekarte mit 5 Min später/Heute Ruhe und Zwei-Stunden-Grenze; finale gemeinsame Prüfungen und echte Samsung-Beobachtung getrennt offen |
| Erinnerungen verschieben | Expliziter Snooze bleibt bei temporärem Ruhe-/Fokus-/Budgethindernis erhalten; acht gezielte Regressionen und SDK-Kompilierung geprüft, keine exakte Android-Zustellzeit zugesagt |

Die nachfolgende finale Gesamtprüfung und Lieferung wird im [Implementierungsplan](ANKER_IMPLEMENTIERUNGSPLAN.md) und den [Testnachweisen](ANKER_TESTNACHWEISE.md) anhand konkreter Quellen dokumentiert. Ein bereits vorhandener Schalter allein gilt nicht als fertige Funktion.

## Externe Voraussetzungen und Beobachtungen

- Kalenderfreigabe und Auswahl müssen auf dem Handy erfolgen. Das vorhandene Play-Dienstkonto berechtigt nicht zum persönlichen Google-Kalender. Der neue Gerätekalenderweg benötigt keinen weiteren API-Schlüssel.
- Relaybetrieb benötigt ein tatsächlich eingerichtetes Supabase-Projekt und bewusst gewählte Aktivierung. Ohne Projektzugang gibt es nur geprüften optionalen Code und den lokalen LAN-Weg.
- Die schon früher beauftragte dauerhafte GitHub-Secret-Sicherung des B4-Schlüssels ist ohne freigegebenen Secret-Schreibzugang weiterhin nicht bestätigt. Vorhandenen Schlüssel erhalten; kein neues Zertifikat oder öffentlicher Schlüsselupload daraus abgeleitet.
- Ein vertrauenswürdiger signierter Windows-EXE-Installer erfordert ein passendes externes Codesignierungszertifikat. Kein kostenpflichtiges Zertifikat gekauft oder eine Signatur vorgetäuscht; Quellpaket und signierter Updatekanal sind getrennt beschrieben.
- MO-05 ist eine Machbarkeitsnotiz für einen Lichtwecker, keine Hardwareintegration. Zusätzliche Geräte werden nicht gekauft/angesteuert.
- Galaxy S26 Ultra, tatsächlicher Weckerton/Standby/Spiel-Touchschutz, reale Windows-Installation, mehrere Monitore mit verschiedener DPI, Tray-/Windows-Erinnerungsklick, LAN-Unterbrechung und bewusst gewählte Sperr-/Audio-/WoL-Wirkungen bleiben echte Geräteversuche. Dieselben sieben Stationen/103 IDs weiterverwenden, keine automatischen Geräte-Häkchen.

Die E00–E09-Basissoftware ist bereits umgesetzt. Historische Baselineblocker sowie erledigte AB-05/AB-06/MO-03 werden nicht erneut als fehlender aktueller Code aufgeführt. Claude Code ist hier nicht als Werkzeug oder CLI angeschlossen; die parallelen Prüfungen erfolgen durch Codex-Agenten in getrennten Arbeitsbäumen.
