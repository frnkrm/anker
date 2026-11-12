# Anker 2.0: Implementierungsplan

## Einrichtung auf entwicklung/anker-neu (13.11.2026)

Aktueller Auftrag erlaubt ausschließlich Bestandsprüfung/Einrichtung/Dokumentation. Historische umfassende Entwicklungs- und Play-Aufträge sind dafür keine neue Uploadfreigabe. T-001 bleibt wegen Originalumgebung/Nachfolgecommit und externer Nachweise blockiert. Keine erneute Anwendung früherer lokaler Dokumentationsänderungen. [Verifizierter Übergabestand](PROJECT_STATUS.md) und [einzige neue ID-Roadmap](OFFENE_ENTWICKLUNGEN.md); keine neue Produktfunktion oder Wiederherstellung begonnen.


## Code17: navigierende Fokusauswahl getrennt prüfen (10.11.2026)

Die Eingabe-Rennen nach normaler Auswahl sind mit gehaltenen Browserverläufen geschlossen. Der vollständige Stand `1e68b06` erreicht lokal und in CI jeweils 305/308: Die drei übrigen Fehler betreffen ausschließlich eine neue Prüfnachbedingung für eine Fokusauswahl, die ihre Ansicht bestimmungsgemäß schließt. Der betroffene Timer-Testablauf wird anhand der neuen Ziel-URL, Überschrift und abgeschlossenen Modalnavigation geprüft. Sämtliche fachlichen Timer-/Datenbedingungen bleiben erhalten. Produkt- und Nativequellen bleiben unverändert; Signierung und Playupload warten auf den gemeinsamen grünen Abschluss.


## Code17: Auswahlabschluss im Browserprüfhelfer (10.11.2026)

Der Stand `613e71f` besteht lokal sämtliche305 Browserfälle und die unveränderten1.183 Logik-/252 Nativefälle. [CI42744262870](https://github.com/frnkrm/anker/actions/runs/42744262870) liefert303/305: eine Fahrzeit landet am vorherigen Adressfeld, eine Testnotiz bleibt leer. Beide Eingaben folgen unmittelbar einer Auswahl. Der gemeinsame Testhelfer muss die bestehende Sheet-/History-/inert-Freigabe abwarten; dafür entsteht eine gehaltene Browser-Back-Regression mit unveränderten Datenbedingungen. Keine Timeouterhöhung, keine Testskips und keine Signierung vor dem neuen grünen Gesamtstand.


## Code17: erneuter Gesamtabschluss nach Layout-Testbudget (10.11.2026)

Die stillen Folgehinweise, Snoozekorrektur und übrigen Softwareänderungen sind integriert. Der gemeinsame Lauf auf `f19064d` besteht 1.183 Logik- und 252 Nativefälle, erreicht aber 296/297 Browserfälle: ein 17-Seiten-Test verbraucht sein gemeinsames 30-Sekunden-Budget. Die Testaufteilung wird korrigiert, ohne eine Route oder Geometrieprüfung zu entfernen und ohne Timeouterhöhung. CI42741944545 ist im App-Browserjob rot; PC-Linux/Windows sind grün. Vor Signierung und Playupload wird ein neuer finaler Gesamtstand geprüft. Details und unveränderte Rotbelege stehen in den Testnachweisen.



## Stille Schlaf-Folgehinweise und erhaltenes Verschieben (10.11.2026)

**Direkter Folgeauftrag:** Hartnäckiger an die Schlafenszeit erinnern, ohne bei möglichem Schlaf Ton, Vibration, Bildschirmwecken oder eine automatische Appöffnung auszulösen. Ausdrückliches „5 Min später“ darf nicht verloren gehen. Änderungen selbstständig abschließen, committen, pushen und auf Play Console hochladen; künftige fertig geprüfte Releases ebenfalls über den vorhandenen internen Entwurfsworkflow hochladen. Öffentliche/Produktionsfreigabe ist davon weiterhin getrennt. Vorhandene aktive Version und B4-Schlüssel erhalten.

**Umsetzung in denselben Besitzern:** Neuer eigener Schalter **Schlaf & Anker → Leise Schlafenszeit-Folgehinweise**, zunächst aus. Ein neutraler `bed`-Trigger aus datierter Planung oder bestehenden Wochenregeln übergibt an `BedtimePromptController`; keine zweite Bettzeitplanung. Bestehende Einschlafdauer bestimmt den ersten möglichen Zeitpunkt. Derselbe Controller führt ein begrenztes, monotones Zwei-Stunden-Fenster. Er prüft Display an, interaktiv und entsperrt, aktuelle Quelle, eigene Abwahl und echten Wecker vor jeder stillen Möglichkeit. Die einmalige alte Überblendung bleibt eine eigene Wahl. Neue Folgehinweise nutzen LOW-Kanal plus `setSilent(true)`, NON_WAKEUP und dieselbe Drei-Karten-Grenze; kein Ton, keine Vibration, kein Vollbild, kein Overlay oder Weck-Lock. **Heute Ruhe** beendet die Nacht; **5 Min später** verschiebt innerhalb der ursprünglichen Grenze. Android kann NON_WAKEUP später zustellen. Ein offener Abend hat keinen automatischen Bettzeitstart.

`quietReady` bedeutet, dass die native Jetzt-Hilfe fällig und zulässig ist; `quietVisible` wird erst nach erfolgreichem Benachrichtigungsaufruf gesetzt. Auch letzteres beweist weder menschliche Wahrnehmung noch Wachheit oder Schlaf. Folgehinweise bleiben vollständig still auch in allgemeinen Ruhezeiten; eigene Abwahl, Sperre und echte Alarme haben Vorrang. Keine Schlafmessung, Mikrofon-/Usage-/Accessibility-Rechte, Routineerledigung, Bettbuchung oder XP aus einer Erinnerung.

**Snooze-Fehler:** Bisher konnten Zielzeit in Ruhe/Fokus und das vorzeitige Verbrauchen eines Tokens bei belegtem Benachrichtigungsbudget die gewählte Erinnerung löschen. Ausdrückliche Snoozes bleiben nun bei temporären Hindernissen innerhalb der bestehenden 30-Minuten-Frische erhalten; normale ungeforderte Meldungen werden nicht nachgeholt. Das umgeht weder allgemeine Ruhe-/Fokusregeln noch Android-Energiesperren. Acht gezielte Regressionen und der SDK-Lauf sind belegt; finale gemeinsame neue Quellenprüfung, Signierung, Downloads und Play-Readback sind zu diesem Zwischenstand **noch offen**. Der vorherige F384-Browserlauf ist mit 184 beobachteten bestandenen Fällen abgebrochen/unvollständig, kein grüner Gesamtlauf.

[Verhalten, Quellen und Grenzen](SCHLAF_FOLGEHINWEISE.md) · [Anforderungsnachweise](ANKER_TESTNACHWEISE.md#stille-schlaf-folgehinweise-und-snooze--gezielte-nachweise-10112026). G21/G67/G96/G101 werden innerhalb derselben 103 IDs ergänzt; alle historischen Ergebniszellen und Berichte bleiben unverändert. Echte Galaxy-/Samsung-/Standbybeobachtungen werden erst nach Nutzerbericht bestätigt.

## Fortsetzung: alle offenen Entwicklungen und Kalender (10.11.2026)

**Neue ausdrückliche Freigabe:** Der Nutzer beauftragt nun sämtliche beim aktuellen Audit aufgeführten Softwarelücken durchgehend umzusetzen und zu committen. Dazu gehören AB-03/AB-04/AB-07, MO-04, PC-Verwaltung/Hotkeys/Datenlöschung, weitere Desktopdarstellung und optionale Einrichtungs-/Updatewege. Der vorherige engere Auftrag „zunächst QR/UX, Rest nur auflisten“ ist damit überholt. Keine neue Android-Appkennung oder Signatur, keine kostenpflichtigen Aktivierungen, keine tatsächliche Hardwareansteuerung ohne vorhandene Geräte. Ein Supabase-Relay bleibt freiwillig; ohne eingerichtete Instanz wird kein laufender Cloudbetrieb behauptet.

**Kalenderauftrag:** Vorhandenes Google-Calendar-OAuth und eigener Schreibkalender bleiben erhalten. Ein Play-Dienstkonto gewährt keinen privaten Google-Kalenderzugriff. Mangels bereitgestellter OAuth-Webclient-Konfiguration wird zusätzlich ein direkter Android-Leseweg für am Handy synchronisierte Google-Kalender eingerichtet: ausdrückliche Kalenderfreigabe und Auswahl am Gerät, dieselben lokalen Terminmodelle/Schreibqueue, keine Servicekontoschlüssel in der App. Echte Kontozustimmung kann nur der Nutzer am Gerät erteilen.

**Nachweisgrenze bei erweitertem Umfang:** Die grüne Zwischenprüfung auf `7c765c52b109efb2cb03f8ea3d288eae4dba2392` (1095 Logik-/277 Browser-/197 Nativefälle, CI42726629352) bleibt historischer Zwischenbeleg. Sie wird nicht für die nachfolgenden App-/Kotlin-/Kalenderänderungen als finale Gesamtprüfung ausgegeben. Code17 wurde daraus noch nicht signiert oder zu Google hochgeladen; finale gemeinsame Prüfungen folgen auf dem neuen eingefrorenen Stand.

## Integrierter Ausbau nach dem Folgeaudit (10.11.2026)

AB-03/AB-04/AB-07 und MO-04 sind im vorhandenen TS-/Kotlin-/Python-Vertrag umgesetzt: freie Uhrzeit mit bestätigter Zielzeitvorschau und Berliner Zeitumstellungen, privater Wenn-dann-Satz, eine vom Handy gewählte sanfte Abendfolge statt paralleler T30/T10-Serie, Morgenanzeige mit tatsächlichem Zielpunkt. Strenge Verlängerung bleibt hardwaregebunden am Handy; Pause, offenes Ende und echte Erledigungen werden erhalten.

PC-Verwaltung und Darstellung sind integriert: Hell/Dunkel/System, lokaler PC-Name, eigene Tastenkürzel mit Reservieren→dauerhaft Speichern→Aktivieren/Rollback, bestätigte lokale Datenlöschung mit Neustart, optionale Zeitpille und kurzer Kartenton mit Windows-Benachrichtigungszustand. Reset prüft Ordneridentität und Verknüpfungen vor jeder Dateilöschung, beendet Verbindungen und darf keinen geschlossenen Store wieder anlegen. Keine Windows-Lautstärke-/Nicht-stören-Änderung für den Kartenton.

Der Kalender-Nativteil liest nur explizit gewählte synchronisierte Google-Kalender nach READ_CALENDAR-Freigabe; Kalender-ID und Konto werden auch pro Ereigniszeile sowie nach dem Lesen erneut gebunden. Kein WRITE_CALENDAR, keine Kontoschlüssel. Android-Kompilierung und neun Kalender-JUnit sind grün. App-Auswahl, exklusive Gerätekalender-/OAuth-Quelle sowie Backup- und Navigations-/Schreibqueuegrenzen sind integriert und gezielt geprüft.

Optionale Relaymigration und Edge-Handler sind integriert; tatsächliche lokale PostgreSQL-/RLS-Prüfung 16/16 grün. Der zunächst echte SQL-Regexfehler ist korrigiert. PC-/Android-Transport, Einrichtung und signierter PC-Updatekanal sind jetzt integriert. Ein unabhängiger Review hat nach dem ersten grünen PC-Lauf noch alte Relaykontakte und verzögerte Bedienbefehle als echte Fehler gefunden: 90-Sekunden-Frischegrenzen, negative atomare Receipts und fortsetzbarer Empfang ohne falschen Morgenabschluss sind ergänzt. Der frühere 270er-PC-Lauf auf `6ece499` bleibt Zwischenbeleg; der neue gemeinsame Freeze erhält frische Gesamtläufe. Diese Zwischenprüfungen behaupten weder eine vollständige finale Gesamtsuite noch einen Live-Dienst, Gerätestest oder neuen Playupload. Siehe aktuelle [Testnachweise](ANKER_TESTNACHWEISE.md).

## Kopplung: QR-Fenster verschwindet sofort (10.11.2026)

**Nutzerbefund und tatsächliche Ursache:** Im installierten PC-Begleiter erscheint nach **Mit Handy koppeln** kein QR. `BridgeServer.ui_action(pair)` stellt einen QR-Render und unmittelbar danach zwei normale Statusrenders in dieselbe Tk-Queue. `DesktopUI._render` schließt das Fenster bei jedem Render ohne `pairingQr`; so verschwindet es noch im selben Queue-Durchlauf, spätestens beim regulären Engine-Tick. Zusätzlich liefert Android den vierstelligen Vergleichscode bereits, aber `PcCompanionPanel` zeigt ihn nicht an.

**Laufende Korrektur:** Eigener flüchtiger, zeitlich begrenzter UI-Lebenszyklus für das Kopplungsangebot, unabhängig von Plansnapshots; Ablauf/Schließen/Bestätigung/Ablehnung räumen es ab. Ein einzelner UI-Fehler darf die Queue nicht dauerhaft stoppen. Am Handy ausschließlich gültigen vierstelligen Code während der nativen offenen Kopplung anzeigen; nie speichern/exportieren oder veralteten Code im verbundenen Zustand zeigen. Paket **PC0.1.1**, Handy **1.5.0-rc.3 / Code17** für diese Fehlerkorrektur; bestehende Appkennung, B4, Protokoll3, Datenformat1, Wecker und Nutzerentscheidungen erhalten. Neue öffentliche Veröffentlichung nicht abgeleitet; Playupdate zunächst interner Entwurf, bestehender aktiver Code16 bleibt erhalten.

**Nachweise vorgesehen:** Reproduktion Button→Server→Queue, UI-Lebenszyklus und Fehlerfortsetzung; unabhängiger echter Tk/Xvfb-Versuch unter Linux mit ausschließlich synthetischen Kopplungsdaten, getrennt von echtem Windows. Produktionsbrowserprüfung der Handy-Kopplung und Paket-/Installerregression. Gerätehäkchen und alte Berichte bleiben unverändert. Root integriert nacheinander aus getrennten Arbeitsbäumen; kein parallel schreibender Claude.

**Zusätzliche ausdrückliche Nutzerwünsche während der Korrektur:** PC-Oberfläche mit abgerundeten, tastaturbedienbaren Buttons; verlässliche Aktionsrückmeldungen; passendes Grundfenster mit Monitor-/DPI-Anpassung und Scrollzugang bei wenig Platz. Manueller Abgleich am PC über den vorhandenen verschlüsselten LAN-Kanal, mit echtem Empfangszeitpunkt und Quellstand statt Erfolg aus bloßer Kopplung. Minimieren und X führen in den Infobereich; nur **Beenden** beendet. Tray- und Erinnerungsklick öffnen das Hauptfenster; fehlt das Tray, bleibt ein erreichbares Taskleistenfenster als Rückweg. Keine Supabase-Aktivierung für den lokalen Begleiter, keine fremden Apps oder neuen Konten. Der Nutzer erlaubt gemeinsame Arbeit mit Claude Code; aktuell sind weder Claude-Werkzeug noch CLI angeschlossen. Mehrere Codex-Prüfer arbeiten weiter in getrennten Bäumen. Eine ergänzende Liste offener Pflichtentwicklungen, bedingter Extras und Geräteprüfungen wird separat aus aktuellem Code/Plan abgeleitet; keine stillen neuen Featurezusagen.

**Historischer Zwischenstand vor der Umfangserweiterung:** Handy-Laufzeit war eingefroren auf `7c765c52b109efb2cb03f8ea3d288eae4dba2392`, Fingerprint `657180633146d0e7619f3e1b07a5dbcb7d8fb1ba136eeef61c13d73d7a346e2a`. Die nachfolgend ausdrücklich beauftragten Kalender-/PC-Erweiterungen verändern Appinputs. Der finale Stand benötigt daher einen neuen Freeze, frische Gesamtprüfungen und einen neuen sauberen Release-View; frühere Signiergates werden nicht gelockert.

**Ergänzender Soll-/Ist-Abgleich:** [Offene Entwicklungen](OFFENE_ENTWICKLUNGEN.md) korrigiert die zu breite frühere v7-Abschlussaussage. Insbesondere MO-04 (PC-Morgenanzeige) und AB-04 (Wenn-dann-Satz auf PC-Karten) sind trotz vorhandener Übertragungsfelder noch nicht vollständig dargestellt. Weitere Komfort-/Kannmodule sind getrennt aufgeführt. Die anschließende ausdrückliche Freigabe aller offenen Entwicklungen am Beginn dieses Plans erweitert diesen früheren Scope. Kostenpflichtige Dienste oder nicht vorhandene Kontozugänge werden dadurch nicht aktiviert.

## Google Play – Uploadworkflow nach Secret-Einrichtung (10.11.2026)

**Abgeschlossen – Kontoanbindung und identischen Bestand tatsächlich bestätigt:** [Lauf42721896696](https://github.com/frnkrm/anker/actions/runs/42721896696) auf `d1ff7b90035786e4d0411431dbac4d3a216c1041` ist mit beiden Jobs grün. `already-active`: Google bestätigt im internen Track genau den bereits aktiven `completed`-Release16 mit passender freigegebener Bundle-SHA. Kein neuer Upload, Trackwechsel oder Commit; keine öffentliche oder neue Testveröffentlichung durch diesen Auftrag. Die vorherigen roten Läufe waren Bestandsschutz vor dem damals noch unbekannten aktiven Release, kein Produkt-CI-Fehler. [Nachweis](PLAY_CODE16_KONTO_NACHWEIS.json). Testerlisten, Play-App-Signieridentität und konkrete Handyinstallation bleiben gesondert und unverändert. Die folgenden Versuchsbeschreibungen bleiben als Verlauf erhalten.

**Nutzerstand:** Die Play-Console-App wurde laut Nutzer angelegt; das angeleitete Repository-Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` ist angelegt. Der ausdrückliche Uploadauftrag besteht weiter. Ein neuer GitHub-Workflow führt den bereits signierten Code16-Stand zunächst als internen Entwurf zu Google; keine öffentliche oder gestartete Testveröffentlichung daraus abgeleitet.

**Implementiert und lokal geprüft:** Zweijob-Workflow mit fester App-/CI-/Artefaktfreigabe, nach Diagnose und rein lesendem Bestandspfad 38 Upload-, 24 OAuth- und 30 Workflowtests (**92**), realer Actionlint-Prüfung und vollständiger echter AAB-Übergabeprüfung. Standard-Servicekonto-JWT-Bearer, feste Android-Publisher-Scope, keine Delegation oder zusätzliche IAM-Rollen; Secret/Token nur im jeweiligen Schritt. `internal`/`draft`, Idempotenz/Bestandserhalt, keine Mutationsretries, `ERROR_IF_IN_REVIEW` gegen Abbruch laufender Prüfungen, Readback statt Erfolg aus bloßem Commit. Appcode, Version, B4, Datenmodelle, 103 Geräteprüfungen und APK bleiben unverändert. [Ablauf, feste Grenzen und Prüfbezug](GOOGLE_PLAY_UPLOAD_WORKFLOW.md).

**Tatsächlicher Runner-/Google-Nachweis:** [Lauf42720560496](https://github.com/frnkrm/anker/actions/runs/42720560496), Quelle `55a383fb5ad9c62aa4233bce2f6958716326fef4`, main/push: Vorprüfungen, Secret-Verfügbarkeit und OAuth erfolgreich; lesender API-Zugriff erfolgt. Sicherer Stopp `EXISTING_RELEASE_CONFLICT` vor Bundleupload, Trackänderung und Commit. Der erste Fehler unterscheidet noch nicht zwischen aktivem Release und unerwarteter Entwurfsform; kein gespeicherter Draft behauptet. Ergänzung: eng gefilterte Trackzustände/Versionsnummern im Bericht und öffentliche Annotation, ohne Abschwächen der bestehenden Prüfungen. Ein zweiter tatsächlicher Versuch soll den konkreten Bestand klären.

**Zweiter tatsächlicher Versuch:** [Lauf42721343910](https://github.com/frnkrm/anker/actions/runs/42721343910), Quelle `19115e2a6b4ddab0c9f06480f591e007805a9fef`, bestätigt genau einen internen `completed`-Release mit Version16. Der damalige Draftpfad stoppt deshalb vor Upload/Änderung/Commit. Ergänzung: diesen bestehenden Einzelrelease ausschließlich bei passender Bundle-SHA als rein lesendes `already-active` bestätigen. Kein Herabsetzen auf Entwurf oder neue Veröffentlichung. Der tatsächliche Bundleidentitätsnachweis erfolgte im erfolgreichen abschließenden Runnerlauf; Geräteinstallation, Testerzugang und Googles App-Signierzertifikat werden nicht daraus abgeleitet.


## Google Play – Erstupload vorbereiten (09.11.2026)

**Neuer ausdrücklicher Auftrag:** Anker in das vorhandene Google-Play-Console-Konto hochladen. Nutzer bestätigt: Entwicklerkonto vorhanden, Anker noch nicht angelegt. Für diesen Auftrag ist ein unveröffentlichter interner Testentwurf vorgesehen; daraus wird keine öffentliche Storefreigabe, Zahlung oder private Schlüsselübertragung abgeleitet.

**Erledigt:** Aus dem unveränderten geprüften Code16-Stand ein Android App Bundle gebaut, mit vorhandenem B4 signiert und mit echtem Bundletool, unabhängigem JarFile-Verifier, Web-/DEX-/JNI-/16KB-Abgleich sowie tatsächlichem öffentlichen ZIP-Download geprüft. Die 197 frischen Code16-JUnit werden anhand identischer Inputs ausdrücklich wiederverwendet; kein neuer Testlauf behauptet. APK/Version/Signatur und Nutzerdaten unverändert. [Uploadpaket, Nachweise und genaue Grenzen](GOOGLE_PLAY_CODE16.md).

**Noch offen / tatsächlich blockiert:** Kein Google-Login oder Play-API-Kontozugriff eingerichtet, Google-Ziele vom aktiven Netzwerkproxy mit CONNECT 403 abgewiesen, kein Desktop-Bedienwerkzeug verfügbar. Google-Domain-Erweiterung nur als Entwurf gespeichert, nicht angewendet. Keine Console-App erstellt, kein authentifizierter Upload versucht, kein Release angelegt oder eingereicht. Die App-Signierung muss in der echten Console für den bestehenden B4-Schlüssel passend eingerichtet werden; ein JAR-signiertes Uploadbundle allein erledigt keine Play-App-Signing-Aufnahme. Kontoinhaberaktion/Zugang sind für die Fortsetzung notwendig.


## Code16 – Weckerverlauf, selektiver Debugexport und Schlafhinweis (09.11.2026)

**Auftrag und Baseline:** Der Nutzer hat einen nicht wahrgenommenen Morgenwecker sowie einen ausgebliebenen Rückweg aus einem Samsung-Spiel mit gedimmtem Touchschutz gemeldet. Er möchte ein lokales Log und einen Export mit selbst gewählten Log- und Einstellungsbereichen. Ausgang ist der abgeschlossene Code15-Stand `53aca2207479505a4cd4054aaa96f54ac15c9759`; Ziel **1.5.0-rc.2 / Code16**, weiterhin Anker und dieselbe App-Kennung. Der frühere Morgen lässt sich ohne damaliges Journal nicht nachträglich rekonstruieren. Samsung-Touchschutz ist ein plausibler Einfluss auf Display-/Vordergrundverhalten, keine bewiesene Ursache für einen ausgebliebenen Weckerton.

| Delta | Integration in den vorhandenen Ablauf | Konkreter Prüfnachweis / Gerätegrenze |
|---|---|---|
| Weckweg ist nachträglich nicht nachvollziehbar | `NativeDiagnosticModel`/`NativeDiagnosticJournal`: erlaubte technische Codes zu Planung, Zustellung, Dienst, Audio, Beenden und Systemänderungen; sieben Tage/800 Einträge. Eigene gerätegeschützte Preferences und begrenzte Schreibqueue, getrennt vom kritischen Alarmspeicher; `AlarmController` bleibt alleiniger Besitzer | `NativeDiagnosticModelTest.kt`, `NativePreferenceFilesTest.kt`; tatsächlichen Ton weiter in G1 beobachten. Aufzeichnung beginnt erst mit dem Update |
| Fehler nach erfolgreichem Playerstart bleiben ohne Ersatz | `AlarmService` behandelt `OnError` mit nächster Quelle/erzeugtem Ersatzton; nur aktuelle Player-/Alarmidentität, gültige Audiofreigabe und ursprüngliche Restlaufzeit erlauben weitere Wiedergabe | `AlarmPlaybackModelTest.kt`: veralteter Callback, Stopp, Austausch, fehlende Freigabe und Zeitlimit. Modelltest ersetzt keinen Android-MediaPlayer-/Hörversuch |
| Debugdaten sind bisher nur als breite Sicherung verfügbar | `core/diagnostics/` projiziert feste Freigaben, `platform/diagnostics.ts` liest verfügbare native Angaben, `/diagnose` liefert Auswahl/Vorschau/Dateiexport. Keine zweite Datenbank oder Planung; keine automatische Übertragung | `core/diagnostics/diagnostics.test.ts`, `platform/diagnostics.test.ts`, `e2e/diagnostic-export.spec.ts`: Bereichs-/Zeitwahl, fehlende/corrupte Daten, Datenschutz, Android-Lesegrenzen und Browserexport. G1 ergänzt die echte Dateiauswahl |
| Ein sichtbares, nicht interaktives Display kann als ausgeschaltet gelten; Vordergrundanforderung allein belegt keinen Erfolg | CPU-Wecktermin für den stummen Hinweis; Displayzustand getrennt von Interaktivität, unbekannter Displayzustand mit bestehender Interaktivitätsauskunft als Fallback. Tatsächliches `onDraw`, höchstens zwei automatische Öffnungsversuche, Vordergrunderfolg erst durch App-Resume | `BedtimePromptModelTest.kt`, `BedtimePromptDeliveryTest.kt`; G96/G101 vergleichen normalen Bildschirm, ausgeschaltet/gesperrt und freiwillig Samsung-Spiel-Touchschutz. Keine Schutzumgehung oder garantierte Spielminimierung |

**Exportentscheidung:** Standardmäßig letzte 24 Stunden, Wecker + stummer Schlafhinweis + Systemereignisse und aktueller technischer Status; alle Einstellungsgruppen abgewählt. Optional sieben Tage/eigener Zeitraum, Alltags-Erinnerungen/PC und getrennte Wecker-, Schlaf-, Routinen-, Erinnerungs-, Darstellungs- oder Wochenarbeitszeitstruktur. Kategorieabwahlen gelten auch für ihre aktuellen Statusdaten, und die Statuswahl kann vollständig entfallen. Keine privaten Texte, Aufgaben-/Schrittkennungen, Orte, Medikamenten-/Schlaf-/Health-Protokolle, QR-Inhalte, Schlüssel, Pins, Tokens oder Audio-URIs. Routinen enthalten nur Positionen, Dauern und Kernschrittflags. Die JSON-Datei enthält ein Auswahl-/Auslassungsmanifest und App-/Build-/Quellbezug; sie ist keine Datensicherung.

**Ehrliche Beleggrenzen:** Planung ≠ zugestelltes Wecksignal ≠ Playerstart ≠ hörbarer Ton ≠ Aufwachen. Angeforderter Vordergrund ≠ tatsächlich fortgesetzte App; gezeichnetes Fenster ≠ garantierte Sichtbarkeit über einem Systemfenster. Aktuelle Einstellungen/Status sind keine historische Konfiguration, `observedAt` kann später als das Ereignis liegen. Wartende/verworfene Journaleinträge, Prozessende, Aufbewahrung und Geräteuhrkorrekturen können Lücken hinterlassen; Fehlstellen beweisen keinen stummen Alarm.

**Status: implementiert, automatisch geprüft und bereitgestellt.** Quelle `4d8eaa1cd1dc463e3ce9032779d857a215d020fc`, Laufzeitkennung `9786f18293f2eb5d9c3e61098cb03c07ad8e3e5cebcaca0c1c583e0bd9ea5ada`, **1.5.0-rc.2 / Code16**, Name Anker und Paket `de.frnkrm.anker.mobile`. **1.095 Logik-/271 Browser-/197 frische Android-JUnit-/89 PC-Pythonfälle**, 5 Paket-/Installer-, 19 klassische PC-/36 Updatefälle grün; TypeScript und Build erfolgreich, Lint 0 Fehler/1 bestehende Warnung. [GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42619085381) bestätigt den exakten main/push-Stand mit allen drei Jobs. Beide nativen Compile-/Manifestvarianten, Release-Lint und alle 68 im Browser geprüften Produktionsdateien bytegleich im APK; signierte Nutzdaten/16KB-Ausrichtung erneut geprüft. [Signierter Download](UPDATE_CODE16.md), [Gesamtnachweis](ANKER_CODE16_NACHWEIS.json). Kein neuer Schlüssel, Tag, Store-Release oder PC-Paket veröffentlicht. Ergebnisse der frühen Arbeitsbäume werden nicht zur Gesamtsuite addiert. **Echte Geräteprüfung bleibt offen:** Galaxy S26 Ultra, Ton, Spiel-Touchschutz, Display aus und Standby. Keine Beobachtung wird aus einem Playerstart oder Systemstatus erfunden; Code15-Belege bleiben historisch.

**Testumfang erhalten:** G1, G96 und G101 sind im bestehenden Katalog ergänzt; weiterhin genau 103 IDs, sechs kurze Updateprüfungen und sieben v7-Stationen G97–G103. Alte Ergebniszellen und lokale Berichte bleiben unverändert, keine neuen automatischen Geräte-Häkchen. Der geänderte Katalog ist in der geprüften Laufzeitkennung und APK enthalten; nach dem Freeze wurde er nicht verändert.

**Dokumentationsprüfung:** Der bestehende Katalog-/Berichtsparser-Test `src/core/deviceTests.test.ts` besteht mit **6/6 Fällen**. Separater Vergleich gegen `d894582`: alle 103 eindeutigen IDs und ihre bestehende Bereichsreihenfolge erhalten, nur Vorgehen/Erwartung von G1/G96/G101 angepasst, sämtliche historischen Ergebniszellen bytegleich; sieben v7-Stationen erhalten. `git diff --check` ohne Befund. Das sind Dokumentations-/Katalogprüfungen, keine Geräteergebnisse.

## v7-Updateauftrag – vollständiges Paket bereitstellen (09.11.2026)

Der Nutzer hat die durchgehende Fertigstellung und Updatebereitstellung jetzt ausdrücklich beauftragt. Ausgang ist der saubere lokale Abschluss `c996171`. Sicherung: `/workspace/.cache/anker/v7-followup/pre-update-c996171.tar.gz`, SHA256 `a516a9ee887843d07e8d17b8d93d74218fe14b71cde2c7cf2da297c78294ec13`. Der vorherige Abschnitt „keine neue APK“ dokumentiert den früheren, engeren Auftrag und blockiert diese neue Freigabe nicht.

**Abgeschlossen und bereitgestellt:** AB-05 (Abendlicht) und AB-06 (Handy-PC-Hinweise nur bei passender Bestätigung entlasten) ergänzen den vorhandenen Erinnerungsweg. MO-03 liefert freiwillige lokale Health-Connect-Schlafvorschläge; keine automatische Übernahme, keine Synchronisierung, eigene Einträge geschützt. Das Windows-Quellpaket hat einen geprüften Installations-/Start-/Updateweg und eine deterministische Paketprüfung. Android **1.5.0-rc.1 / Code15**, Name **Anker**, gleiche Paketkennung und tatsächlich geprüfte bestehende B4-Signatur. Nutzerdaten, Schlüssel und alte Geräteberichte bleiben erhalten. Umsetzung in getrennten Arbeitsbäumen, nacheinander nur durch Root integriert. [Geprüfte Downloads](UPDATE_V7_CODE15.md), [Gesamtnachweis](ANKER_V7_UPDATE_NACHWEIS.json).

**Gezielte Integration vor Gesamtprüfung:** 48 kombinierte Logik-/Store-/Facade-/Katalogfälle und sechs Produktionsbrowserfälle grün; darunter beide neuen Optionen, direkte Vorlauf-Eingabe und alle Einstellungsfelder einschließlich Begleitung bei 320/390 px sowie 100/160 Prozent Schrift. Fünf Paket-/Installerfälle mit vorhandenem PowerShell grün. Ein enger unabhängiger Review fand einen ACK-Wechsel während der Queue-Aufteilung und eine zu frühe Reaktivierung nach Uhr-Rückstellung. Ein gemeinsamer unveränderlicher Scheduler-Snapshot und eine Untergrenze am Originaltermin beheben beide; drei neue gezielte native Regressionen grün. Der erste neue Layouttest verwendete einen falschen Testdaten-Feldnamen und der erste lokale Installerlauf fand PowerShell ohne PATH-Ergänzung nicht; die Fehlprotokolle bleiben erhalten. Keine gelockerten Tests oder Retries. Jetzt folgt die frische gemeinsame Abschlussprüfung auf dem eingefrorenen integrierten Stand; die gezielten Zahlen werden nicht zur Gesamtsuite addiert.

**Liefer-Gates erfüllt:** Quelle `0c3ac21a537fa95e686de53ab95ca4476af9d39c`, Laufzeitkennung `0d550798869cb1d8c6c83a84a401b5bed422a60f3602f59a07d1775c865913ea`. **1.077 Logik-/267 Browser-/174 frische JUnit-/89 Python-/5 Paketfälle**, 19 PowerShell-/36 Updatefälle, TypeScript/Build/Lint grün (eine bekannte Warnung). Native: 680 Aufgaben frisch, beide Compile-/Manifestvarianten, Release-Lint und alle 66 Browser-Webdateien bytegleich im APK. [CI42607136664](https://github.com/frnkrm/anker/actions/runs/42607136664) bestätigt exakt diesen main/push-Stand, 1.077/267 und beide PC-OS-Jobs. APK mit demselben B4-Schlüssel signiert, v2/v3 und zusätzliche JAR-Signatur separat verifiziert, Payload/Metadaten/16KB unverändert geprüft. Neue Downloadbranches getrennt von main: `download-anker-v7-code15-20261109` und `download-anker-pc-v7-20261109`; beide vollständig im Browser heruntergeladen, CRC und sämtliche Dateien bytegleich. Keine Tags oder Store-Releases. Eine erfolgreiche Softwareprüfung setzt keine Geräte-Häkchen.

**Verbleibender Nutzerweg:** [Handy-ZIP](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-v7-code15-20261109) entpacken, **Anker.apk → Aktualisieren**. Der vorhandene Code14-Download ist historisch. Die sieben bestehenden G97–G103 sind aktualisiert, 103 IDs und alte Berichte erhalten; echte Galaxy-/Windows-/LAN-/Audio-/Standby-/WoL-Prüfungen bleiben offen. Die damalige Anweisung weiter unten, erst eine v7-APK zu beauftragen, ist durch diesen abgeschlossenen ausdrücklichen Updateauftrag erledigt.

**Unverändert bedingte Extras:** PC-14 Relay setzt ausdrücklich eine eingerichtete Supabase-Instanz voraus; diese liegt nicht vor und wird durch einen APK-Auftrag nicht kostenpflichtig eingerichtet. MO-05 verlangt ausdrücklich nur eine Machbarkeitsnotiz, keine neue Licht-Hardware. Der Windows-Begleiter erhält einen vollständigen manuellen Updateweg; ein automatischer Download-/Ausführungskanal und eine kostenpflichtige Windows-Codesignatur werden nicht still aktiviert.

## Anker v7 – PC-Begleiter, Abend und Morgen (09.11.2026)

### Erneuter Auftragsabgleich und gezielte Folgekorrekturen

Der erneut angehängte Auftrag ist bytegleich (`3fbcae2adf023dcedb3e551070ac20522fc8f7e4d3167ee85f762868499f2554`). Ausgang dieses Folgeaudits ist `ad91ca2`; alle 368 Laufzeit-Eingaben und 63 Produktionsdateien stimmten vor Änderungen mit den bisherigen Nachweisen überein. Die bisherigen Abschlusszahlen darunter gelten weiterhin für ihren damaligen Stand, nicht als frische Prüfung der folgenden Korrekturen.

| Konkretes Delta | Integration ohne neue Planungsdatenbank | Neuer Nachweis |
|---|---|---|
| PC-Fortschrittsleiste verschwindet bei leerer Speicherfrist; Overlay ohne Phasentitel/Sekunden | Anzeige verwendet verbleibende Abendzeit bis zum Übergang, danach die echte Speicherfrist; Titel und Sekunden werden aktualisiert | Engine-geformte UI-Grenztests, echter 60→59→0-Verlauf ohne Windows-Systemwirkung |
| Verschiedene PC-/Bettzeiten überspringen T10 | Gewählte v7-Abendfolge über optionales `bedtimeSequence` an Bett binden; normaler PC-Stopp behält seine Zeit und vollständige Vorphasen | Beide Zeitmodi und Verlängerungen in denselben Python-/Wire-Prüfungen |
| Automatische PC-Nacht ohne Handy-Bett-QR verhindert QR-Verlängerung | Frischer authentifizierter PC-ACK ergänzt den bereits vorhandenen Handy-Nachtbeleg; QR, Zustimmung, Sitzung und ursprüngliche Frist bleiben verpflichtend | Native Gate-Grenzfälle, verspäteter ACK und verschlüsselte Serverfälle nach 04 Uhr |
| +15 Bettverlängerung erhält erneut Bildschirm-aus-Puffer | Explizites `extended.anchor=bed` auf vorhandenes `lateUntil` zurückführen; vorhandener Planner bleibt maßgeblich | Tatsächlicher Planner-Rundweg, Mitternacht, neue Handywahl und atomarer Retry/Replay |
| Morgen-Zombie verkleinert auch den Abend | Morgenumfang im vorhandenen Override/Fokus begrenzen; Abend-Fokus/IDs/Haken/Spielstand und alte Unterstützung erhalten | Planner-/Store- und bestehende Routine-Layoutfälle |
| Unerledigter Morgen verdrängt T30/T10/Hard-Cut | Bestehendes Morgenanzeigefenster beachten; offene Daten nicht erledigen oder löschen, echte Nachtbindung erhalten | Uhrverlauf bis zum Abend und persistierter offener Fokus |

**Status der Folgekorrekturen:** implementiert und gemeinsam lokal automatisch geprüft auf `7cccb464b6df0132b76abfbe991a5a16eb7136a5`, Laufzeitkennung `78f5e674939bed16a04877835c83efba5602a6f550b8879eca08ecb730b14590`. **1.043 Logik-/265 Browser-/167 frische Android-JUnit-/83 PC-Pythonfälle**, verschlüsselte Node↔Python-Schleife, 19 klassische PowerShell-/36 Updatefälle grün. Keine Browser-Retries, Flakies oder Skips; 369 Laufzeit-Eingaben und 63 tatsächlich geprüfte Produktionsdateien mit der nativen Prüfung bytegleich. TypeScript/Build grün, Lint ohne Fehler mit einer bekannten Warnung. [Frischer Gesamtnachweis](ANKER_V7_FOLGE_NACHWEIS.json), [Native-Inputs und Berichte](ANKER_V7_FOLGE_NATIVE_NACHWEIS.json), [Grenzen und Zuordnung](ANKER_TESTNACHWEISE.md#v7--folgeaudit-und-korrigierter-gemeinsamer-stand). G100–G102 wurden innerhalb der vorhandenen sieben Prüfcluster aktualisiert; keine neuen Testpflichten oder automatischen Geräte-Häkchen. Echte Samsung-/Windows-/LAN-/Audio-/Standbyprüfungen bleiben offen. Keine neue APK, Veröffentlichung, Signatur oder Version abgeleitet.

### Ursprünglicher v7-Abschluss vor den Folgekorrekturen

Die folgenden Ausgangs- und Abschlussangaben dokumentieren den ursprünglichen v7-Aufbau. Der aktuelle korrigierte Softwarestand und seine neu ausgeführten Prüfungen stehen darüber; frühere Nachweise werden nicht überschrieben.

**Phase 1 abgeschlossen; Phase 2–4 implementiert und lokal gemeinsam automatisch geprüft.** Ausgang `main`/`0084063345791302bb414d930ee066d777dc57cf`, App 1.4.0-rc.1/Code14. Root-Arbeitsbaum war sauber. Keine geltende AGENTS-Datei vorgefunden; kurze Verweisdatei neu angelegt. README, CLAUDE, Struktur, Anleitung, Changelog, aktueller Plan und v7-Anhang geprüft; bestehender Daten-/Wecker-/Fokus-/PC-Pfad an konkretem Code auditiert. Der Anhang liegt bytegleich unter `docs/auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v7_PC.md`. Sicherung des getrackten Ausgangscodes: `/workspace/.cache/anker/v7/baseline-main-0084063.tar.gz`, SHA256 `fe04d501f291e97e3397fa5ac4f53725c936f94cfda078f122fbeea2ddf87f79`. Kein Export vom Handy, keine Änderung seiner Daten. **Kein Versionswechsel, neuer APK-Build zur Verteilung, Signieren, Push oder Release aus diesem Auftrag abgeleitet.**

**Arbeitsverzeichnis/Branch:** `/workspace/anker`, `entwicklung/anker-v7-pc`. Reine Baseline im detached Worktree `/workspace/anker-v7-baseline`. Kern, Android, PC-Begleiter, PC-Transport und UI schreiben ausschließlich in eigenen v7-Worktrees und werden nacheinander integriert. Keine parallelen schreibenden Agenten im selben Arbeitsbaum.

### Verbindliche Entscheidungen bei widersprechenden Vorgaben

| Konflikt | Gewählte Integration |
|---|---|
| Anhang Tauri/`desktop/`, direkter Auftrag bevorzugt Python/`pc-companion` | Python-Begleiter unter `pc-companion/`; bestehender TS/React-/Kotlin-App-Stack bleibt. Kein zweites Desktop-Produkt. |
| Anhang nur gepinntes HTTPS, direkt Echtzeit-WebSocket | WSS mit gepinntem TLS-Blattzertifikat, mDNS `_anker._tcp.local.` und REST-Healthcheck. Der Server unterstützt zusätzlich verschlüsseltes POST; Android nutzt WSS mit Reconnect und keinen automatischen REST-Datenfallback. Kein Klartext und kein Pflichtserver. |
| Anhang Wecker unverändert, direkt neue Morgenverkettung/Anti-Relapse | Bestehender AlarmController bleibt alleiniger Besitzer. Neue Optionen ausdrücklich aus; bestehende Vorwecker-/Wachheits-Identitäten, QR/Rechnen/Notfall und SmartWake-Absicherung bleiben. |
| Anhang keine roten Farben, direkt rote OLED-Nacht/Depletion-Timer | Optische Führungsvariante freiwillig; Rot bezeichnet Zustand/Restzeit, nie Verspätung oder Schuld. Normale Themen und Schriftwahl bleiben. |
| Anhang freie Verlängerung, direkt Hardware-Notverlängerung und Sperrwächter | Standardmodus erlaubt freie Verlängerung. Strenger Modus benötigt eigene Wahl am Handy und PC; signierte zeitlich begrenzte Notverlängerung nur nach Handy-Hardwareprüfung. Begleiter bleibt beendbar, keine Hardwaretasten-/Administrationssperre. |
| Direkter Beispielbefehl `shutdown /s /t 30` vs. Bestand schützt ungespeicherte Programme | Eigener 60-Sekunden-Speicherhinweis, danach optional `/s /t 0`, niemals `/f`. Windows-Anmeldung wird nicht fernentsperrt; Morgenabschluss beendet nur den Wieder-Sperrwächter. |
| Automatischer Fokusstart vs. „ersten Schritt nicht gestartet“ | Automatischer Countdown beweist keine reale Handlung. Auto-Zombie orientiert sich an ausbleibender bewusster Interaktion/Schrittbestätigung und ist gesondert abschaltbar. |
| Privater Brain-Dump vs. morgens am PC zeigen | Notiz im vorhandenen lokalen `tomorrowSteps`; PC-Übertragung nur mit eigenem Freigabeschalter. Standardmäßig nur Zeiten, Zustände und Schrittnummern. |

### Technische Delta-Matrix

Status: **V** vorhandenen Pfad wiederverwendet · **I** implementierter Codepfad · **T** automatisch geprüft; konkreter gemeinsamer Nachweis im Testprotokoll · **O** offen/zurückgestellt · **X** echte Geräte-/externe Prüfung. Automatische Ausführungen stehen ausschließlich im [Testprotokoll](ANKER_TESTNACHWEISE.md#v7--audit-baseline-und-gemeinsame-regression). Diese Matrix ist keine zweite Produktplanung.

| IDs | Bestand / Integration | Aktueller Status und Nachweis-Gate |
|---|---|---|
| P00 | Code14 eingefroren, Paketlock und 630 tatsächlich installierte Versionen geprüft | Abgeschlossen: 912/912 Vitest, 122/122 frische JUnit, 19 PC-/36 Updatefälle; Browser 247/248 mit erhaltenem Nachtlabel-Befund P00-B01. Keine grüne Baseline behauptet |
| PC-01/09/10/12, P02/P08 | Python `pc-companion/`, Tk/Tray, Windows-Adapter, DPAPI, Benutzer-Autostart und eigener CI-Pfad | I – Quellen und simulierbare Grenzen vorhanden. Kein signierter Windows-Installer; echte Installation, Skalierung und Systemeffekte X |
| PC-02/03/04, P01/P03 | `core/pcLink`, v3-Fixtures, AES-GCM/ECDH/HKDF, einmaliger QR+PC-Bestätigung, mDNS und gepinntes WSS | I – passende TS/Kotlin/Python-Verträge. Android-Daten über WSS+Reconnect; POST/v3/link nur zusätzlicher Serverendpunkt, kein behaupteter Native-Fallback |
| PC-05/08/13, P04/P06 | Handyplan/Revision → aktueller ACK; dauerhafte PC-Outbox → atomare Store-Wirkung/Receipts; native Geheimnisse außerhalb Backup/Sync | I – Empfang und Live-Verbindung getrennt, private Texte eigens freigegeben. Echte LAN-/Standby-Kopplung X |
| PC-06/07/11, P05 | Countdown/Schleier, optionale Sperre/Ducking, eigene mindestens 60 s Schonfrist; Altpaket-Konflikt verhindert Doppelwirkung | I – Windows-Adapter injizierbar, Normalmodus frei verlängerbar; begrenzter strenger Wächter nur gesondert gewählt. Vollbild/Session/Audio X |
| AB-01/02/03/04/07 | `tomorrowSteps`, `adjustDay` und vorhandener Abendübergang; PC-Speicherpunkt, Dämmerung und lokaler Wenn-dann-Plan | I – keine zweite Notiz-/Planungsdatenbank; Notiz-/Ereignis-/Verlängerungsfälle der Gesamtregression zuordnen |
| AB-05/06 | Zusätzliche Soll-Extras des Anhangs: Abendlichthinweis und Empfangs-abhängige Entlastung von Handy-PC-Hinweisen | O – gegenüber dem direkten 30/10-Minuten-Auftrag zurückgestellt: kein zusätzlicher Hinweisstapel und keine automatische Unterdrückung normaler Handy-Erinnerungen vor echter PC-Geräteprüfung. Die gewählte v7-T30/T10-Serie ersetzt bereits die alten doppelten Abendserien |
| MO-01/02/04, VI-01/02/03/04, P07 | Bewusste Licht-Vorlage, `/rhythmus` mit7/14 Tagen, bestehender Ring, Morgen-Countdown und Tray | I – Plan und tatsächliche Einträge getrennt; keine automatische Routinenänderung. Darstellung320 px/160 % automatisch, echte Skalierung X |
| Direkt: Circadian UI/Depletion | Vorhandene Tokens, FocusFrame und RingTimer statt neuer Timer-Engine | I – freiwilliges Cyan/Amber/OLED, maximal reduzierte Nachtansicht und reduzierte Bewegung; Farben erledigen nichts |
| Direkt: PaceKeeper/Schlafaudio | Lokale Stimme/Audiopriorität, `RoutinePaceKeeperService`, begrenzter `SleepAudioService` | I – Schwellen, Deduplizierung, Pause, Deadline und Alarmvorrang in Modellen prüfbar. Tatsächliche Stimme, Vibration, Ausblendung und Hörbarkeit X |
| Direkt: Zero-Gap/Anti-Relapse | V: QR→Fokus; I: dauerhafte atomare Morgenübergabe, nativer Einmalbeleg, Wieder-Klingeln über denselben AlarmController | I – DB-Fehler/Crash/Duplikat/04:00 ohne falschen Schrittabschluss. Ein-Tipp-Wachbestätigung, kein neuer Step-Counter. Echtes erneutes Klingeln X |
| Direkt: Zombie/Abendphasen | `core/guidance` als Planprojektion; essentielle Schrittflags, lokaler Nachtfakt und signierter QR-Notverlängerungsbeleg | I/T – keine Überschreibmigration; leere/ausgelassene Schritte erzeugen keinen echten Morgenabschluss. T30/T10 im bestehenden nativen Reminderpfad integriert; echte Zustellung X |
| PC-14/MO-03/MO-05, P09 | Relay/Health-Schlafimport/Lichtgeräte | O – Kann-Module bzw. Machbarkeitsnotiz; keine externe Aktivierung und keine zusätzliche Schlafberechtigung ohne eigenen Auftrag |
| P10 | Gemeinsame Regression und Abschlussdokumentation | I/T – Dokumentation, Setup/Vertrag und sieben Stationen97–103 vollständig; 1.017 Logik-/263 Browser-/161 frische Native-/72 Pythonfälle plus 19 PC-/36 Updatefälle grün, konkrete Quellbindung im Testprotokoll |

### Integration und verbleibende Gates

1. **P00 abgeschlossen:** eingefrorene Baseline mit unverändert erhaltenem Fehlerbeleg und unabhängigen Native-Inputs. Auf `npm ci` wurde im Baseline-Worktree bewusst verzichtet, um die gemeinsam genutzten installierten Abhängigkeiten nicht zu verändern; Lockhash und alle erforderlichen physischen Versionen wurden stattdessen geprüft. Dies ist als Abweichung protokolliert.
2. **P01–P07 implementiert und integriert:** ein Vertrag und ein Planner; native Belege erst nach durablem Store-Commit. Alle getrennten Worktrees nacheinander übernommen. Gemeinsame Logik-, Produktionsbrowser-, Python-/TLS- und frische Native-Prüfung bestanden; keine Modulzahlen zu einer angeblichen Gesamtsuite addiert.
3. **P08 Dokumentation/CI implementiert:** Python-Tests unter Linux und Windows als unabhängige Matrix konfiguriert; Linux mit gepinnten Abhängigkeiten ausgeführt. Eine konfigurierte Windows-CI ist noch keine tatsächlich ausgeführte Windowsprüfung. Benutzerinstallation ohne Admin/Firewalländerung dokumentiert. Neue Stationen nutzen vorhandene Testberichte, Historie und Export statt eines zweiten Modells.
4. **P09 zurückgestellt:** Relay, Health-Schlafimport, automatische Begleiter-Updates und echte Lichtgeräte bleiben ohne zusätzliche Aktivierung. Keine neue Schlafberechtigung oder kostenpflichtige Einrichtung.
5. **P10 Softwareprüfung abgeschlossen:** Lint/TypeScript/Produktionsbuild, 1.017 Vitest-/263 Browser-/72 Python-/161 frisch ausgeführte native Fälle, echte Node↔Python-TLS-Schleife sowie 19 PowerShell-/36 Updatefälle erfolgreich. Alle 63 geprüften Produktionsdateien bytegleich in der nativen Prüfung, 368 Laufzeit-Inputs abgeglichen; frühere Fehlerbelege erhalten. Quellen/Hashes im Testprotokoll und ANKER_V7_NACHWEIS.json.
6. **Echte Geräteprüfung X:** G97–G103 unter **v7 gemeinsam ausprobieren · 7 Stationen** verbinden Samsung und Windows. Alte G1–G96 und ihre Berichte bleiben unverändert. Installation, native Audio-/Hintergrund-/Sessionwirkung, LAN und WoL nur nach tatsächlich beobachtetem Versuch bestätigen.

**Bedienung/Architektur:** [PC_BEGLEITER.md](PC_BEGLEITER.md), [PC_LINK_PROTOKOLL.md](PC_LINK_PROTOKOLL.md). **Nächster Schritt:** Bereitstellung einer neuen v7-APK gesondert beauftragen und anschließend die sieben gemeinsamen Gerätecluster tatsächlich am Galaxy und Windows-PC prüfen. Der vorhandene Code14-Download enthält v7 noch nicht. Kein neuer Gerätebericht, Release oder Versionswechsel wird daraus abgeleitet.


## Gesamtauftrag v6: Baseline und aktueller Fortschritt

**UI-Gesamtauftrag Code 14, 08.11.2026 – implementiert und automatisch geprüft:** Beide UI-Aufträge zusammengeführt, drei Haupttabs und gebündelte Bereiche, gemeinsame Form-/Fokusbausteine, kompakte Routinen und rücknehmbare Listenänderungen. Anzeigename **Anker**, Version **1.4.0-rc.1 / Code 14**, bestehende Paketkennung und Signatur. Quelle `1e1f0218ddaf14fa25b4dff0d3d9a0cc6ffb324a`, Laufzeitkennung `46cc0637832d20687f2a246cd3dd13a69b08efde6f071f6756ab942aa86b3e87`. **912 Logikfälle, 248 Browserfälle in [grüner CI](https://github.com/frnkrm/anker/actions/runs/42451162451), 122 frisch ausgeführte native JUnit-Fälle, 36 Update-Mock-/19 PowerShell-Fälle und vier Parser erfolgreich; keine Browser-Skips oder Retries.** APK signiert, vollständig heruntergeladen und bytegleich geprüft. [Installation](INSTALLATION_ANKER_CODE14.md) · [Anforderungsmatrix und Abweichungen](UI_UEBERARBEITUNG_CODE14.md) · [Nachweis](ANKER_CODE14_NACHWEIS.json). Neue echte Geräteprüfungen bleiben offen; frühere Berichte und die folgenden Code-13-/E00-Absätze bleiben historische Belege.

**Abschluss RC6 / Code 13, 7. November 2026 – implementiert und automatisch geprüft:** Kompakte Routinekarten mit Dauer und Eingabe nebeneinander, sichtbarer Minimal-Version und Fußzeile für Griff, Pfeile und Entfernen. Normale Karten sind 220 Pixel hoch; Beschriftung und Einheit erhalten ihre echte Textbreite statt starrer Restspalten. Kein geänderter Planer-/Datenbestand. **875 Logik-/220 lokale und externe Browserfälle, 36 Signier-Mock-/19 PowerShell-Fälle grün, keine Skips oder Retries.** [CI28](https://github.com/frnkrm/anker/actions/runs/42405382711) auf exakt `855b0bef8c276f358ce4f7db5fa3ac1299ead2ae`, Quellkennung `4f90a1d9e60e53d1860cdbffdad95ee3b121ad5242ed629f32fbc7164c17399b`. Die 122 nativen JUnit-Fälle desselben RC6-Auftrags sind durch vollständige Native-/Test-/Dependencybytegleichheit wiederverwendet; alle drei DEX-Dateien und das binäre Manifest bleiben gleich, kein neuer Testlauf nach dem CSS-Fix behauptet. Release, gleiche B4-Signatur/v2/v3/16KB sowie [ZIP-Handydownload](INSTALLATION_ANKER_NEU.md) vollständig im Browser und bytegleich geprüft; [Nachweis](ANKER_NEU_RC6_NACHWEIS.json). G95 aktualisiert, frühere Testberichte erhalten. **Neue Samsung-Installation und Touchprüfung offen.** Die folgenden RC6-Absätze dokumentieren vorherige Zwischenstände.

**RC6-Nachkorrektur nach CI27:** Lokal 219/219, extern 218/219; ein echter Dauer-Umbruch bei 320 Pixeln/160 % Schrift wurde erkannt und bei 305 Pixeln verfügbarer Breite lokal rot reproduziert. Intrinsische Beschriftungs-/Einheitsspalten und das anpassbare Zahlenfeld beheben die feste Restbreite, ohne Texte, Touchflächen oder die Einzeiligkeitsprüfung zu verkleinern/lockern. 13 betroffene Produktionsfälle plus normalisierter Zusatzfall grün. Neue Gesamtprüfung umfasst220Fälle; Abschluss erst nach grüner CI. Native122Fälle werden für die unveränderten nativen/Test-/Abhängigkeitsinputs mit separatem Bytegleichheitsnachweis wiederverwendet, kein neuer Native-Testlauf behauptet. Neue Quellkennung `4f90a1d9e60e53d1860cdbffdad95ee3b121ad5242ed629f32fbc7164c17399b`.

**Kompakte Routinekarten, RC6 / Code 13, 7. November 2026 – implementiert:** Dauer mit direkter Eingabe und Einheit nebeneinander, sichtbare Minimal-Version und gemeinsame Fußzeile für Griff, Pfeile und Entfernen. Normale Karten sind 220 Pixel hoch, zwei Griffe ohne Scrollen erreichbar. Keine Änderung an Planer-, Speicher- oder Sortierlogik; Nutzerdaten bleiben erhalten. 875 Logikfälle und zwölf gezielte aktuelle Produktionsbrowserfälle grün; die bestehenden 13 Touchsortierfälle bestanden im ersten gemeinsamen Lauf. Tatsächliche Textgrenzen ergänzen die Flächenprüfung: kein umbrechender Griff, einzeiliges Dauer-Label, passende Einheit auch bei 320 Pixeln/160 % Schrift. Neue volle 219-Browserprüfung, frische native Prüfung und Remote-CI laufen noch; neue Samsung-Prüfung offen. Quellkennung `2d63c69417cc0620e97b43b1723768b1c043bac99bc2e46c0bf5e491abae4530`. G95 angepasst, keine neue Teststation. [Aufbau und Testpfade](UI_ROUTINEN_RC6.md).

**Download-Nachprüfung RC5, 7. November 2026:** Nutzer meldet eine volle Ladeleiste ohne gespeicherte APK. Raw-Datei erneut vollständig und mit richtiger Prüfsumme erreichbar, genaue Handyclient-Ursache offen. Der bevorzugte Download ist jetzt die ZIP des bestehenden Downloadbranches mit ausdrücklichem Attachment-Header: 21833772 Bytes, in Chromium vollständig gespeichert, CRC geprüft, enthaltene APK bytegleich mit der signierten Code12-Datei. Appcode, Signatur, Planer und Nutzerdaten unverändert; keine neue Version oder Release. [Download und Entpacken am Handy](INSTALLATION_ANKER_NEU.md). Tatsächlicher Samsung-Download bleibt bis Nutzerbericht offen; bisherige Geräteberichte unverändert.

**Erinnerungsantworten, RC5 / Code 12, 7. November 2026 – implementiert und automatisch geprüft:** Abend-Erledigt übernimmt offene aktuelle Planschritte, Vorwarnungen bestätigen dieselbe echte Handlung wie der Haupthinweis. Auf bestätigten Nutzerwunsch lässt Heute nicht offene Abend-Schritte für diesen Tag ohne neue Erledigt-Haken/XP entfallen; spätere echte Handlungen bleiben möglich. Listener-/Drain-Abschlussfehler und zurückkehrende Snooze-Stufen korrigiert, vorhandene atomare Queue/Receipts/Token wiederverwendet. **875 Logik-/215 vollständige Browser-/122 frische native JUnit-Fälle, 36 Signier-Mock-/19 PowerShell-Fälle grün, keine Skips oder Retries.** Beide AAR-/Kotlinvarianten, TypeScript, Lint, Release und echte APK-v2/v3-Signierung bestanden. [CI26](https://github.com/frnkrm/anker/actions/runs/42399563581) auf exakt `3ecbc198022eb89906a8e72107d245be7f8703bd`; Quellkennung `d3df94c5a1bc0ee42af11b87aaab7aca8eb8e8068618700b7ed9a6d1a480c96f`. [Signierter Handydownload](INSTALLATION_ANKER_NEU.md) vollständig erneut gelesen und bytegleich geprüft; [Nachweis](ANKER_NEU_RC5_NACHWEIS.json). G21/G67 erklären den gezielten Versuch, keine zusätzlichen Stationen oder automatischen Geräte-Häkchen. **Neue Samsung-Installation und echte Benachrichtigungsaktionen offen.** GitHub-Schlüsselübertragung beauftragt, aber wegen fehlender API-Netzfreigabe noch ausstehend. [Verhalten, Ursachen und Testpfade](KORREKTUR_ERINNERUNGSAKTIONEN_RC5.md).

**Neue Signierung und Handyinstallation, 7. November 2026 – implementiert und automatisch geprüft:** **Anker Neu 1.3.0-rc.4 / Code 11**, Paket `de.frnkrm.anker.mobile`, ist separat installierbar und mit dem ausdrücklich neu erzeugten Release-Schlüssel signiert. Die bisherige App bleibt erhalten; bewusster Restore übernimmt auch ältere eigene Einstellungen/Spielstände und erhält Berichtshistorie. Erste Planung und Fortschritt warten bis zur Einrichtung. **864 Logik-/211 Browser-/116 frische native JUnit-Fälle, 36 Update-Mockfälle grün**, keine Skips oder Retries. [CI](https://github.com/frnkrm/anker/actions/runs/42393476035) auf exakt `2fad314a8a131218df2fa62dfd545c82972a0b2b`; Quelle `46e13c2813340e5579d4351ebd35ec38d9d5de7976fe8fa625aa7c4f0bd04673`. Echte Signatur und öffentlicher APK-Download geprüft. [Handyinstallation und Datenübernahme](INSTALLATION_ANKER_NEU.md) · [Nachweis](ANKER_NEU_RC4_NACHWEIS.json). Neue Samsung-Installation, Übernahme und Zustellung bleiben als echte Geräteprüfungen offen. Privater Schlüssel nicht im Repo/Download; dauerhafte externe Sicherung noch offen. Historische RC3-Nachweise darunter bleiben erhalten.

**Updateprüfung und RC3-Erweiterungen, 7. November 2026:** Kompatible Abhängigkeiten, Audiofokus, Teilschritt-Timer, die Vorschau naher Arbeitsaufgaben und die Diagnose normaler Erinnerungen sind integriert. Hinzu kommen der bewusst gestartete stumme Schlafhinweis mit freiwilliger Fensterfreigabe, verständlichere und ausgerichtete Einstellungen, die rein lesende Zeitübersicht mit lokalem abgeleitetem `meta/time-catalog`-Cache sowie sechs Standardstationen und erhaltener Testberichtshistorie. Der manuelle GitHub-Updateweg nach einmaliger Signiereinrichtung und die Play-Roadmap sind vorbereitet; OCR, Hintergrundrauschen, größere Plattform-/TypeScript-Migrationen und neue Therapieinhalte bleiben bewusst zurückgestellt. **Finaler Stand: 1.3.0-rc.3 / Code 10, `20ee297dd7474ab500cc0d9f66396b60ad9141f8`; gemeinsame Prüfungen: 853 Logik-/209 Browser-/116 im selben RC3-Auftrag ausgeführte native JUnit-Fälle (für den Weblayoutfix mit identischen Inputs wiederverwendet), 19 PowerShell-Fälle und 34 Update-Mocktests grün; keine Skips oder Retries; CI: [vollständig grün](https://github.com/frnkrm/anker/actions/runs/42384529210) auf exakt `20ee297dd7474ab500cc0d9f66396b60ad9141f8`; Paket: [22207489 Bytes / geprüftes Update](UPDATE_RC3.md), SHA-256 `81aaea7818d58e254aacb215ec681132267003119a92c61c649c8f3e27833142`.** Neue Android-/Samsung-/Windowsprüfungen und echte Signierung/Installation werden nur nach tatsächlichem Nachweis bestätigt. [Überblick, Statusmatrix und nächste Handyschritte](UPDATEPRUEFUNG_RC3.md). Historische RC2- und Geräteberichte darunter bleiben mit ihrem bisherigen Buildbezug erhalten.

**Nachkorrektur 07.11.2026, implementiert und lokal geprüft:** Update **1.3.0-rc.2 / Code 9**, Quellkennung `b131b9b89e3d27fede35ec7d699950385d1917f2881e4445647fb7d46cb783f2`. Routinen lassen sich am Griff sortieren; stabile Messung, Abbruch, aktuelle Schritt-IDs und Speicherbestätigung bewahren Texte, Dauern und Minimal-Versionen. G95 führt direkt zu beiden Editoren. Der KI-Schalter erklärt fehlende Einrichtung und nächste Schritte, ohne Freigaben zu umgehen. **785 Logiktests und der vollständige Lauf mit 156 Browserfällen** grün, darunter 13 Routinen- und vier neue KI-Fälle; keine Skips oder Retries. Lint, TypeScript, Produktionsbuild und Android-Release-/Paketprüfungen bestanden. [GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42314785412) auf `41b9521` vollständig grün:156 Browserfälle in4,3min. Öffentlicher ZIP-Download vollständig geprüft; echte Samsung-/Windows-/Anbieterprüfungen offen. E04–E09 bleiben implementiert. [Updateanleitung](UPDATE_ROUTINEN_RC2.md) · [Nachweis](KORREKTUREN_RC2_NACHWEIS.json).

**Aktuell 06.11.2026:** Die Softwareentwicklung E04–E09 ist abgeschlossen und gemeinsam geprüft. Update **1.3.0-rc.1 / Code 8**, Quellkennung `e8625c6f0443c315be57936c8b496037e4c5d72a8f917e8a6b23ae30925d843b`. [GitHub-CI21](https://github.com/frnkrm/anker/actions/runs/42289520357) ist für `240033c` vollständig grün: **139 Browserfälle**, Logik, Lint, TypeScript, PowerShell und Build. Lokal 780 Vitest-/87 native JUnit-/19 PowerShell-Fälle und Release-APK-Build grün. Zusätzliche gezielte Integration nach CI20:24/24 Fälle, keine Timeoutlockerung oder Skips. E09-Geräteanteil wie vom Nutzer gewünscht offen: zehn StationenG86–95, frühere Berichte erhalten. KI-/Verkehrsadapter implementiert, echte Anbieter nicht aktiviert; echte Android-/Windows-/Providerprüfungen offen. [Gemeinsames Update und PowerShell-Anleitung](UPDATE_E04_E09.md) · [Maschinenlesbarer Beleg](E04_E09_SOFTWARENACHWEIS.json). Historische Zwischenstände darunter bleiben als solche erhalten.

**E00 abgeschlossen:** tatsächlicher Branch `work`, HEAD `38da41ef78a68f3d5d9ea25e73e1d4cf946b9d36`, Ursprung `github.com/frnkrm/anker`, App `1.2.0-rc.1`. Vorhandene Änderungen und unversionierte Dateien sind Teil der Baseline, nicht zurückgesetzt. Kein Claude-Prozess festgestellt; nur der Hauptagent schreibt, Unteragent prüft lesend. Keine geltenden `AGENTS.md`/`AGENTS.override.md` an den übergeordneten oder relevanten Projektpfaden gefunden. `CLAUDE.md`, Projektanleitung, Struktur, Changelog, Plan und Fach­dokumentation gelesen.

**Sicherung vor Edits:** 221 Quelldateien samt vorhandenen Änderungen archiviert und jeden Inhalt anhand SHA-256 nachgelesen. Quellfingerabdruck `7062052bccfb03e8222d78f1980eead1e4543b899f03fbf9de4412be02b769d5`. Lokales Archiv/Logs: `/workspace/.cache/anker/e00-baseline-20261105T225426Z/`. Das ist eine Sicherung dieser Cloud-Arbeitskopie, kein Export der Daten vom Handy und keine dauerhafte externe Sicherung. Signierschlüssel und Windows-Ordner `D:\Projekt\Anker` liegen hier nicht vor. Keine Migration, Löschung oder Änderung bestehender Nutzerdaten für E00.

**Frische Baseline:** Lint, Typecheck, Produktionsbuild bestanden; 330 Vitest-Tests/22 Dateien, 20 Playwright-Tests, Android-Kotlin-Kompilierung und 44 ausdrücklich neu ausgeführte JUnit-Tests ohne Fehler/Skip. Befehle und Grenzen: [Testnachweise](ANKER_TESTNACHWEISE.md). Kein APK gebaut, kein Push/Release. Automatisierte Tests bestätigen weder zukünftige Hörbarkeit noch Sensorqualität auf der Matratze.

**Geräteberichte erhalten:** G1–59 bezeichnen die bestehenden Fälle in [GERAETETEST.md](GERAETETEST.md). Darunter sind echte Nutzerberichte aus früheren Builds, Teilresultate und offene Fälle. G47/48 bestätigen den AOD-Fix am 05.11.; die frühere pauschale Aussage „kein Handy-Test“ ist deshalb historisch. Keine neue Änderung gilt dadurch als am Gerät geprüft. Galaxy S26 Ultra laut Nutzer; genaue Android-/One-UI-Version offen.

### Delta-Matrix der E00-Baseline, vor E01

Status: **V** vorhanden und im genannten automatischen Umfang geprüft · **U** vorhanden, dafür kein spezifischer automatischer Nachweis · **T** teilweise · **F** fehlt · **K** Konflikt · **X** externe Voraussetzung. Ein V bedeutet nie automatisch „am Android-Gerät geprüft“. Prüfungen beziehen sich auf die E00-Baseline; Testdateien unter `src/`, Kotlin unter `android/app/src/`.

| IDs | Ist-Stand / konkrete Integration | Automatischer Nachweis / Gerät / nächstes Delta |
|---|---|---|
| AL-01 | T `AlarmModel`, `AlarmController`, `Receivers`: ein Besitzer, getrennte Arten | `AlarmModelTest` Identität/Duplikate; alte bereits unterwegs befindliche Intents nicht gegen aktuelle Occurrence geprüft → E01 |
| AL-02 | T `reconcile`, `AnkerPrefs`: native Folgetage/Direct Boot | JUnit Timeout/Boot/DST; G5 nur teilweise, G10–13 offen; keine Produktiv-Weckfreigabe |
| AL-03 | T Test und Snooze getrennt | JUnit Testisolation/1×Snooze; G3 bestätigt, G4 teilweise; fälliges Snooze trotz deaktiviertem Wecker → E01 |
| AL-04 | T `AlarmService`, Manifest, Diagnose | Build/Modelltests; G14–16/18 historisch bestätigt, G17 nicht geprüft; aktuelle offizielle API-Quellen vor Strategieänderung erforderlich |
| AL-05 | V `Alarm.tsx`, `buildAlarmConfig`, Einnahme separat | `alarm.test.ts`, `AlarmModelTest`; G6/7 offen |
| AL-06 | V `Alarm.tsx`, `qr.ts`, `stopped` mit Notfallweg | JUnit Wachheits-Check; G8/19 historisch bestätigt, Scanner-Ausfallvarianten offen |
| AL-07 | T `AlarmDiagnosis`, `Check`, Plugin | PendingIntent ist keine Zustellbestätigung; aktuell falsches Grün bei Exakt-Fallback möglich → E01 |
| AL-08 | T `wakeOverride`, `sleep.ts`, native Tagesausnahme | `flexible.test.ts`, JUnit einmalige Zeit; G36 bestätigt, G35 offen; alte Signale nach Verschieben → E01 |
| NO-01 | V `reminders/build`, `ReminderModel/Scheduler` | Slot/Rang/Relevanztests; G22/23 historisch, Gesamtbudget G21 offen |
| NO-02 | T Queue und sichtbare Slots getrennt | JUnit Vorrat/Snooze; alte Action-Buttons ohne Planrevision, Q16 offen → E02 |
| NO-03 | T Alarm reserviert Slot | JUnit höchstens3/Alarmplatz; G22 bestätigt, Kombination Mikrofon-Dienst geräteoffen |
| NO-04 | T `notifications.ts`: 14 Tage und Öffnen-Hinweis | `support.test.ts` Mehrtag/Horizont; G24/25 offen, keine autonome Regel nach Vorratsende |
| NO-05 | T Ruhezeiten, Priorität, Freizeit | `support.test.ts`, `flexible.test.ts`; G40 historisch, Fokus-/Freizeitmatrix teilweise |
| PR-01 | V `Static.Print`, `core/print` | `print.test.ts`, E2E Druckansicht; G27–30 historisch bestätigt |
| PR-02 | T Browser-/Android-Systemdialog | E2E + Build; G27/28/30 bestätigt; unabhängiger PDF-Fallback ohne Druckdienst fehlt |
| PR-03 | T Druck-CSS, A4/A5, QR nur gelesen | Printtests/E2E; G28/29 bestätigt; lange Routine/große Schrift als vollständige Matrix offen |
| TA-01 | T bestehende `InboxItem`, `WorkTask`, kein neues Taskmodell | Support/E2E; generische Unteraufgaben/Wiederholungsinstanzen/Statusdetails fehlen → E03 |
| TA-02 | T `Shell.InboxSheet`, Store `addInbox` | E2E Gedanke und zurück; ungespeicherter Draft bei Prozessende/Schnellzugriffe offen |
| TA-03 | V `taskDate`, `DayTasks`, `tasksFor`, gemeinsamer Abschluss | Supporttests Morgen/einmaliger Abschluss; G49 neue Wiedervorlage offen |
| TA-04 | T zentrale `support.nextAction` | Prioritäten/echte Begründungen getestet; Dauer-/Ort-/Energie-Fitting und aktiver Taskstatus fehlen |
| TA-05 | F persistente Aufgabenzerlegung | Kein Test; Stuck-Mikroschritte sind kein Unteraufgabenmodell, lokale Vorlagen zuerst |
| TA-06 | T `Work`, `ResumePoint`, Handover/Vorlagen | Support/E2E Arbeit; frei wählbare Task-Fokusblöcke fehlen |
| TA-07 | T `Stuck`, Wiedereinstieg | Stuck/Resume getestet; Resume verfällt nach8h/Plantag → längeren Wiederanlauf ermöglichen |
| TA-08 | T `Focus`-Zeitstempel, persistierter Aufräumtimer | Supporttimer/E2E Aufräumen; G31/32 historischer Puls, persistente Fokus-Pause/Tasktimer offen |
| TA-09 | T `routineLinks` und einzelne Vorlagen | Flexible T5; persönliche Dauerschätzung/allgemeine Wenn-dann-Regeln fehlen |
| FL-01 | T `DayOverride`, `Commitment`, ehrliche Routinezustände | Flexible T14; generische Taskzustände nur teilweise |
| FL-02 | V `TodayDifferent`, `adjustDay`, Vorschau | E2E Heute anders, klare Zeiteingabe; systematische Bedienmatrix offen |
| FL-03 | T Undo/echt Erledigtes erhalten | Flexible T8/T9/T14, E2E; keine formale Planrevision, Widget/Druck teilweise abweichend |
| FL-04 | V `planLegs`, Planer, `legAction` | Flexible Filmabend T2; vollständiger Handyablauf offen |
| FL-05 | T/K `Longer`, `openEnd`, `PcStop` | Flexible T3/E2E; G40 bestätigt; PC noch1×15/behaupteter Empfang → E04/IN-02 |
| FL-06 | V `backAt`, Rückkehr/Absage | Flexible T8/T9; neue Änderungen geräteoffen |
| FL-07 | T `coveredSteps`, `routineLinks`, `routineCompleted` | Flexible T5 ohne doppelte XP; allgemeine Bedarfsvorlagen teilweise |
| FL-08 | K `chapter.ts`: Nichtnutzung kann Kapitel neu starten | `game.test.ts` belegt den alten Strafpfad; angepasst ist neutral, aber Nichtnutzung noch nicht → E04, erworbenen Fortschritt bewahren |
| WO-01 | V `worktime`, `WorkControls`, Einstellungen | Worktime A/J/L, keine erfundene Ist-Zeit; nur G43/45 historisch berichtet |
| WO-02 | T eigenes Wochenprofil/Freitag, Tagesoverride | Worktime C/E2E Freitag; Startgrenze/Ortsregel nicht je Wochentag |
| WO-03 | V Start/Pause/Ende/Nachtrag/Undo | Store-Doppeltap/E2E; G42/44/46 offen |
| WO-04 | T `dayActual`: Vereinigungsintervalle | Worktime B/I; widersprüchliche Nachträge still vereinigt, Restpause nicht als untere Prognose markiert |
| WO-05 | V `latestInfo`, Morgenplan, `sleep` | Worktime A/D/E, Sleep-Puffer; G35/41 offen |
| WO-06 | T `forecastEnd`, `workStop`, Tagesoverride | Worktime B/F/K; G43 Pause bestätigt, Konfliktplatzierung teilweise |
| WO-07 | V `workKind`, Sessions, Einsatz-UI | Worktime G/H, E2E Sonntag; G45 Hinweis bestätigt, Nachtablauf offen |
| WO-08 | T/X abschaltbare `workHints`, `restConflict` | Worktime H/K; aktuelle Rechtsquellenprüfung extern, keine betriebliche Freigabe |
| WO-09 | T `weekSummary`, `WorkTime`, Planintegration | Worktime/E2E; Widget verwendet `nowView`, nicht vollständige nächste Aktion |
| TR-01 | T `Place`, `Commitment`, reale Ortskette | Flexible T7; Orteverwaltung fehlt, unbekannter Ort wird zu remote |
| TR-02 | T Kundenformular/`PlanWorkForm`, Puffer | Flexible T3, Worktime E; Quellen-Dubletten und unklarer Ort offen |
| TR-03 | V `travelMin`, `mapsUrl`, manuelle Ankunft | Flexible T6; G38/39 historisch bestätigt, keine Live-ETA behaupten |
| TR-04 | F/X kein Routenprovider | Anbieter/Kosten/Datenschutzentscheidung in E07, manueller Pfad vorhanden |
| TR-05 | F/X keine Verkehrsrequests/Revisionen | Erst nach Providerentscheidung; kein fingierter Integrationstest |
| TR-06 | T manuelle Fallbackbasis | Flexible T6 keine erfundene Abfahrt; echter Provider-Ausfallpfad fehlt |
| SL-01 | T `sleepInfo`, freiwilliges Schlafprotokoll | `sleepDiary.test.ts`, Flexible T3; G52 offen, Zeitabstand keine Schlafmessung |
| SL-02 | T `latestWake`, `morningNeed` inkl. Rechnerstart/Gym | `sleep.test.ts`, Worktime D/E; G35 tatsächliches Wecken offen |
| SL-03 | V neutrale Schlaf-/Terminkonflikte | Flexible T3, Worktime K; G40 historisch berichtet |
| SL-04 | T bestätigter Override → Kotlin | Flexible T4/T16/JUnit; G36 Rücknahme, G35 Klingeln offen; AL-08 gilt |
| SL-05 | V spätes Arbeitsende und feste Folgeankunft | Worktime K; realer Ablauf offen, keine Gesundheits-/Rechtsfreigabe |
| WX-01 | T `weather`, `WeatherCard`, Providerparser | Flexible T11; fehlende Werte fälschlich0, Ortswechsel lädt nicht neu, Zielortbezug fehlt |
| WX-02 | T Jacke/Regenregel, `items`, Vorbereitung | Flexible T11/Gymbag; Packvorlagenverwaltung fehlt |
| WX-03 | V `legAction`, manuelle Ankunft | Flexible T2; keine automatische Arbeitsbuchung |
| WX-04 | F/X keine Geofences | E08 erst nach gesonderter Entscheidung und Geräteprüfung |
| UX-01 | T ruhige Tokens/Karten/Einzelschritt | E2E Handlungsbudget; G34 historischer TalkBack/160%, Fokusfalle/Focus-Return in Sheets offen |
| UX-02 | T kurze Gründe, Capture, Stuck | E2E/Support; Fokus-Abschlusssprache bei nur übersprungenen Schritten teilweise falsch |
| UX-03 | T Onboarding, Modi, spätere Einstellungen | E2E/Migration; Kapazitätsfragen/fehlende Werte nicht systematisch geprüft |
| UX-04 | T `MainGoal`, Vorbereitung, kleine Hilfen | Planer/Support teilweise; eigener Zielkompass/flexible Haushaltstasks fehlen |
| UX-05 | T Homeoffice-Text zum Kopieren | Planertests; Clipboard-Erfolg trotz Fehler möglich, Share-Abbruchtest fehlt |
| UX-06 | T lokale7-/14-Tage-Probe | Kein spezifischer Aus/Löschen/Update-Test; max3 Lernpunkte fehlen |
| UX-07 | T `Static.Help`, `AskSomeone` | Kein aktueller Quellen-/Clipboardnachweis; keine externen Nachrichten gesendet |
| IN-01 | T alle bisherigen Bereiche erhalten | Bestehende330/20/44 Tests; kein pauschaler Vollständigkeitsnachweis |
| IN-02 | T/K `PcStop`, `export/pcstop`, `pushPcStop` | Exportinhalt getestet; kein Windowslauf/Empfangskanal, falscher Erfolg und15-Minuten-Limit |
| IN-03 | T `widgetEntries`, `AnkerWidget` | Datenschutztest kein Kunde/Anlass; Recovery/Aktualität/Neustart/Doppeltap offen |
| IN-04 | U begrenzter System-Fokusweg | Kein besonderer Integrationstest, kein eigener Blocker/ungefragte Zusatzrechte |
| IN-05 | T Sync/Kalender/Health optional | Pagination-/Sync-/Sporttests; echte Dienste nicht E2E geprüft, Google-Aktualität teilweise |
| IN-06 | T Settingsmigration, Store-Queue, Repositories, Backup | Store-Rennen/Repository-/Backup-Roundtrip; G26/33 historisch; aktuelle SQLite-/Updatefälle offen |
| IN-07 | T/X Wetter-/Maps-Herkunft dokumentiert | Core-Fallbacktests; aktuelle Bedingungen extern, Wetterparser0 ist kein echter Messwert |
| 03.4 | T kanonischer Store, sequenzielle Persistenz | Storetests; `effects.run()` noch parallel möglich → E03 mit Regression sequenzieren |
| 03.5 / Q82 | V Berlin-Planminuten, UTC-Istintervalle | `time.test.ts`, Worktime H, Kotlin DST; tatsächlicher Uhrwechsel am Gerät offen |
| Aktivitäts-Weckfenster / G53–59 | T optional, standardmäßig aus, Bewegung+Geräusch, keine Aufnahme | `smartWake.test.ts`, `SmartWakeModelTest` synthetisch; komplett geräteoffen, kein Schlafstadiennachweis |

### Etappen und nächster sicherer Schritt

| Etappe | Status / Gate |
|---|---|
| E00 Audit/Baseline/Delta | abgeschlossen; Nachweise oben und im Testprotokoll |
| E01 Wecker | sichere Delta-Umsetzung implementiert;340 Vitest-/29 Browser-/50 JUnit-Tests bestanden, Lint/Typecheck/Build bestanden. Details im Etappenergebnis und Testprotokoll. Geräte-Gate offen; keine neue Android-API-/Berechtigungsstrategie |
| E02 Erinnerungen/Druck | implementiert; aktuelle Nachweise und Hardwaregrenzen im E02-Ergebnis unten. NO-01–05/PR-01–03 im vorhandenen Modell integriert,74 geführte Gerätefälle insgesamt |
| E03 Zustände/Tasks/Recovery | implementiert und automatisch geprüft:499 Logik-/59 Browser-/73 Kotlinfälle, Release-APK rc.5/Code7; Remote-CI18 grün auf main5c898a8. Geführte G76–G85 ergänzt; echte Android-Prüfungen offen. Keine Freigabe aus einem Browsermock abgeleitet; Details unten |
| E04 Flexible Planung/Spiel | integriert und automatisch geprüft: atomare private Undo-Basis, echte Ist-Handlungen erhalten, freie Verlängerung/PC-Pause, Fokus→Heute anders, Tages-Coverage und Tagesdruck. Integrierter Stand550 Unit/29 gezielte Browserfälle; Windows/Server/Handy offen |
| E05 Arbeit | danach: Intervallkonflikte/Restprognose, Wochenprofil |
| E06 lokale Wege/Schlaf | danach: unklare Orte/Bedarf/Material, keine erfundenen Daten |
| E07 Wetter/Provider | externe Quellen und ggf. notwendige Entscheidung, offline Teilaufgaben möglich |
| E08 sensible Integrationen | nur nach gesonderter Freigabe, standardmäßig aus |
| E09 Gesamtregression | laufend Nachweise, am Ende vollständige Regression/Accessibility/Geräteprüfung |

Fehlende Hardware blockiert unabhängige sichere Offline-Arbeit nicht. E01 bleibt bis zu den echten Gerätetests **automatisch geprüft, Geräte-Gate offen**. Keine produktive Weckzuverlässigkeit behaupten. Aktuelle offizielle Android-/Leitlinien-/Providerseiten waren wegen Netzrichtlinie nicht abrufbar; Quellenprüfung als externe Voraussetzung führen, keine Umgehung/erfundene Recherche.

### E01 – Ergebnis der ersten sicheren Delta-Umsetzung (05.11.2026)

Bestehende Wecker-, Planer-, Zeit- und Datenmodelle wiederverwendet. Kein Schreiben durch andere Agenten, kein Push, Release oder APK. Alle ursprünglichen Quelldateien vorhanden; vorherige Abend-/Weckfenster- und Claude-Änderungen erhalten. Frühere Handyberichte bleiben historisch.

| Anforderung / Delta | Implementiert | Konkreter automatischer Nachweis | Android-Gerät |
|---|---|---|---|
| AL-01/AL-08, Q07/Q12: veraltete Signale | `AlarmMachine.firedScheduled` akzeptiert je Alarmart nur den aktuell gespeicherten positiven Termin; unbekannte Actions werden verworfen. Legacy ohne Action läuft durch Migration/Abgleich gespeicherter Termine | JUnit `alteOderFehlendeSignaleAendernKeineAktuelleAlarmart`, `aktuellerTerminKlingeltEinmalUndVerzoegertesDuplikatBleibtStill`, `nurExpliziteBekannteFireActionsSindWecksignale`; Controller/Receiver kompiliert | neue G60 offen; Android-Receiverzustellung selbst nicht per JUnit bewiesen |
| AL-02/AL-03, Q02/Q08: deaktiviertes fälliges Snooze | `reconcile` holt Snooze bei ausgeschaltetem Hauptwecker nicht nach; aktiviertes fälliges Snooze weiterhin genau einmal | reproduzierbarer Rotnachweis vor Fix; JUnit `abgeschalteterWeckerHoltAuchFaelligesSchlummernNichtNach`, `abgleichHoltFaelligesSchlummernEinmalNach` | G4/G10/G11/G61 offen für diesen Stand |
| AL-02, Q03/Q08: Boot und feste Absicherung | bestehende Planung erhalten; Boot-Nachholen und SmartWake-Fallback am produktiven Guard geprüft | JUnit `entsperrenNachGesperrtemStartBeendetNachgeholtenWeckerNicht`, `fixedScheduledBoundarySurvivesEarlyTimeoutAndBoot` | Folgetag, Direct Boot und G53–59 weiter offen |
| AL-07, Q09: ehrliche Diagnose | `alarmPlanningStatus` wird von Plattform und Diagnose geteilt, auch für Vorwecker. Ungenaues Scheduling, fehlender Exaktstatus und gemeldete Fehler sind kein Grün; keine Hörbarkeitszusage aus Token. Ursache eines ausgelassenen Termins bleibt unbekannt | `core/alarm.test.ts` „Ehrliche Weckerplanung“; native Brücke unverändert wiederverwendet | Rechtewechsel/Audio/Vollbild Q09–11 müssen am Gerät geprüft werden; requestbezogene native Quittierung bleibt eigenes Delta |
| Nutzerwunsch geführte Testseite / UX-03 | `/geraetetest`,63 bestehende/ergänzte G-Fälle, Anleitung, gezielte App-/Systemwege, bestehender separater Testalarm, Planvergleich, Rückkehrbanner. Nur bewusster Bericht, kein XP und keine Alarmregeländerung | `deviceTests.test.ts`, Store-Test ohne Planabgleich/XP,9 neue Browserfälle in `e2e/device-tests.spec.ts` | Teststart/Hauptzeitvergleich G1–3, AOD G47/48 neu prüfen; Seite G63 offen |
| IN-06, Q81/Q83: Berichte und Entwürfe erhalten | bestehendes `meta/local`, lokale Entwürfe beim Feldverlassen, JSON-Backup-Validierung, Export nur der Testberichte. Plattform, Datum, Appversion/Build, Teststand und Quellkennung; ältere Ergebnisse bleiben erhalten und zählen nicht als aktuell | alte Backups/fehlerhafte neue Felder/Roundtrip, Store-Schreibfehler, E2E Entwurf/Rückkehr/Export. Produktionskatalog enthält keine historischen Ergebniszellen | echte SQLite-/App-Update-Übernahme offen; Prozessabbruch mitten in unbestätigter Eingabe nicht abgesichert |
| Nutzerwunsch direkte Zeit-/Dauereingabe, UX-03/Q82 | `TimeStepper` verwendet vorhandenes `TimeField`; numerische `Stepper` direkt bearbeitbar. Nacht00:30 bleibt1470; manuelle Onboarding-/Settingszeiten geschützt. +/- bleiben | E2E direkte Eingabe/persistierte Nachtzuordnung/Neuberechnung/Onboarding/Leerwert/Grenzen/Dezimaldauer,320px bei160% Schrift | Android-Uhrzeit-/Tastaturbedienung G62 offen |

**Geräteführung:** aktueller Katalog G1–63 ist nicht die vollständige Umsetzung der84 Q-Szenarien. Weitere Q-Szenarien bleiben gemäß Delta-Matrix an ihren Etappen. Neue Prüfungen werden erst nach Nutzerbericht für konkreten Stand als Gerätebeobachtung geführt. Quellkennung ist keine APK-Prüfsumme und erfasst nicht jede native Ressource oder Buildumgebung.

**Bewusste Restgrenzen von E01:** offizielle aktuelle Android-Quellen und Geräteprüfung der bestehenden API-/Berechtigungsstrategie, native requestbezogene Planungsquittierung, alle neuen Hardwarefälle. Die Modellkorrekturen erlauben die nächste unabhängige E02-Arbeit, ersetzen aber keine Gerätefreigabe für produktives Wecken. Nächster Code-Schritt: veraltete Reminder-Actions reproduzieren und mit dem vorhandenen Relevanz-/Zustandsmodell absichern; keine zweite Task- oder Plan-Engine.

### Handy-Update vorbereiten (06.11.2026, Europe/Berlin)

Nutzer hat die App-JSON-Sicherung bestätigt und den öffentlichen Windows-Signierbericht geliefert: lokale Debugsignierung mit bestehendem `debug.keystore`, Alias `AndroidDebugKey`; Release-Konfiguration lokal leer. Der private Schlüssel wurde nicht angefordert oder übertragen. Das installierte Handy-Zertifikat ist damit noch nicht unabhängig ermittelt.

- Aktuellen Web-Build in die isolierte Android-Kopie synchronisiert; vollständiges `:app:assembleRelease` inklusive Release-Lint bestanden. Diese Buildvariante erzeugt hier ein **unsigniertes APK**, keine Veröffentlichung.
- Paket `de.frnkrm.anker`, Version `1.2.0-rc.1`, Code3; Quellkennung unverändert `2bb70a922b749bdd0c176c233d9380504275bb10e4535692b08e958644dcbabf`. ZIP-/ARM64-ELF-Ausrichtung für16-KB-Seiten geprüft.
- `scripts/sign-local-update.mjs` für lokale Signierung mit dem vorhandenen Schlüssel. Prüft Eingabe-SHA256, Paket/Version und den gemeldeten öffentlichen Zertifikatsfingerabdruck. Falls die alte lokale APK vorliegt, zusätzlicher Zertifikats-/Versionsvergleich; ein höherer alter Code stoppt den Vorgang. Kein Schlüssel wird angelegt, verändert oder hochgeladen; keine Installation.
- 7 echte kryptografische Integrationstests unter Linux bestanden: Erfolg mit/ohne alte APK, falscher Schlüssel, falsche Prüfsumme, höherer alter Versionscode, fehlender Schlüssel, falsches Paket. Dafür nur kurzlebige Testschlüssel verwendet und wieder entfernt. Windows-Ausführung und echte Installation weiterhin offen.
- Updatepaket `/workspace/artifacts/Anker-Update-E01-Windows.zip` enthält unsigniertes APK, einfachen CMD-Starter, Node-Helfer, Metadaten und kurze Anleitung. ZIP nach Erstellung entpackt/inhaltsgeprüft; keine privaten Schlüssel enthalten. Noch kein mit dem Nutzerschlüssel signiertes APK vorhanden.

**Nächster Nutzerschritt:** ZIP auf dem Windows-PC entpacken und `Update-signieren.cmd` starten. Danach nur die erzeugte `Anker-E01-Update.apk` über die vorhandene App installieren. Android prüft dabei zusätzlich die tatsächliche Updatekompatibilität. Bei Ablehnung App installiert lassen und Fehler auswerten. Anschließend zuerst Gerätefälle1–3. Nächste Code-Etappe bleibt E02; aktuelle Gerätefreigabe ist offen.

### Freigegebener Upload und Integration (06.11.2026)

Der Nutzer hat den öffentlichen Paket-Upload sowie Commit, Push und Merge aller bislang unpublizierten Appänderungen ausdrücklich freigegeben. Es wird kein Versionstag/GitHub-Release erzeugt. Der Paketbranch bleibt vom App-Hauptbranch getrennt.

- Paketbranch `download-anker-e01-20261106`, Commit `529d37590c14f4d1f26e53228a2a6481ab8a0b1d`, erfolgreich hochgeladen. Tatsächlicher öffentlicher HTTPS-Download: HTTP200,21699399Bytes, SHA256 `364d7d28537b747695e3ad8b73e2aa8539e6d4cad0c6f9d2b7f60ea7ca8446cd` vollständig nachgelesen.
- Download: `https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e01-20261106/Anker-Update-E01-Windows.zip`. Die früheren Cloud-Dateilinks sind kein bestätigter Übertragungsweg und werden für dieses Paket nicht weiter verwendet.
- Öffentliche technische v6-Fassung enthält weiterhin alle71 Anforderungs-IDs. Persönliche Gesundheits-/Lebensangaben wurden generalisiert; das unveränderte private Original ist exakt per `.gitignore` ausgenommen und lokal erhalten.
- Frisch vor Integration: Lint/Typecheck bestanden,340 Vitest-/29 Browser-/50 Kotlin-Tests bestanden,0 Fehler/0 übersprungene Kotlin-Tests. Bytegleichheit der16 eigenen nativen Quell-/Test-/Manifestdateien zur Buildkopie bestätigt. Logs: `/workspace/.cache/anker/merge-validation-20261106/`.
- Zwei lesende Abschlussreviews fanden keine blockierende neue Regression. Ein nicht blockierender Textfall bleibt dokumentiert: Beim bewusst ausgeschalteten Hauptwecker kann eine beendete SmartWake-Messung noch den allgemeinen Hinweis auf den festen Wecker anzeigen; die eigentliche Planung und Diagnose sind korrekt ausgeschaltet. Späteren Text verbessern, keine Hardwarefreigabe daraus ableiten.

Gerätetests, lokale Windows-Signierung und echte Installation sind weiterhin offen. Die öffentliche Integration des geprüften Codes ist keine Bestätigung produktiver Weckzuverlässigkeit.

**Git-Integration abgeschlossen:** Appstand in Commit `ab686481641eab085ad844cd82ae9d45eaa6cfb7` auf `entwicklung/anker-e01` gesichert, gepusht und per Fast-forward in `main` übernommen. Der Remote-Abgleich bestätigt denselben Commit auf beiden Branches. Der Paketbranch bleibt separat auf `529d37590c14f4d1f26e53228a2a6481ab8a0b1d`. Arbeitsbaum nach der Integration sauber, privates Original weiterhin lokal und ignoriert. GitHub-CI für den veröffentlichten Stand ist gestartet; lokale Abschlussnachweise stehen oben, ein Remote-Erfolg wird nur nach tatsächlich abgeschlossenem Lauf behauptet.

### Signierhilfe2 – SDK-Abhängigkeit entfernen (06.11.2026)

Nutzer meldete unter Windows „Android-Buildwerkzeuge nicht gefunden“. Der erste Helfer verlangte ein lokal auffindbares SDK, obwohl für die fertige APK nur Signatur und Metadatenprüfung benötigt werden. Der Fehler wurde mit der alten Hilfe bei absichtlich entfernten SDK-Variablen und ohne lokale SDK-Konfiguration reproduziert.

- Die neue Hilfe benötigt Node, Java17+ und den vorhandenen Debugschlüssel. SDK-Suche und natives `aapt` entfallen. Java wird in `JAVA_HOME`, PATH und üblichen Installationsorten gesucht; nicht lesbare optionale Herstellerordner blockieren die Suche nicht.
- Portable Bibliothek `com.android.tools.build:apksig:8.13.0` unverändert, mit enthaltener Apache-2.0-Lizenz und Herkunftsnachweis. Eigener dünner Java-Helfer aus `scripts/AnkerApkTool.java`, kompiliert mit `--release 17`; kein eigener AXML-Parser. JAR/Klasse werden zusätzlich per SHA256 geprüft.
- APK-Prüfsumme, Paket, Zertifikat vor privatem Schlüsselzugriff und signiertes Ergebnis bleiben geprüft. Versionscodes werden vollständig als BigInt verglichen. Normale APK-Signaturen v1/v2/v3 und16-KB-Ausrichtung geprüft; keine inkrementelle Installation/v4-Sidecardatei nötig.
- Repro plus10 neue echte kryptografische Integrationsfälle bestanden. Darunter Erfolg mit/ohne vorherige APK bei fehlendem SDK, falscher Schlüssel/Prüfsumme/Paket, höherer und sehr großer alter Versionscode, fehlender Schlüssel sowie beschädigte JAR/Klasse. Nur kurzlebige Testschlüssel, unverändert und anschließend entfernt; unabhängiges SDK-Werkzeug nur als Testorakel.
- `Anker-Update-E01-Portable.zip`:22172417Bytes, SHA256 `1b46d36d431ecd4c5275ca0eacf1cd30a2202a19c6c81b36a2172abc914bb307`. Die App-APK im Paket bleibt bytegleich (`850e0844…`), Quellkennung2bb70a… unverändert. Keine App-/Planer-/Datenmodelländerung.

Der separate Downloadbranch wurde auf `8f1457daffc72742ff1d15560fb4a080133a119e` aktualisiert. Die neue portable ZIP ist öffentlich abrufbar; auch der bisherige Windows-Dateiname verweist im aktuellen Branch auf dasselbe korrigierte Paket. Der neue Download wurde vollständig über HTTPS gelesen und gegen Größe und SHA256 geprüft (HTTP200, bytegleich).

Windows-Ausführung und echte Installation sind weiterhin offen. Nächster Nutzerschritt: neues Paket vollständig in einen eigenen Ordner entpacken und dort den CMD-Starter ausführen; alte Signierhilfe nicht weiter verwenden. Keine Schlüsselübertragung oder Deinstallation.

### Update und Datenerhalt vom Nutzer bestätigt (06.11.2026)

Nach Bereitstellung der SDK-freien Signierhilfe hat der Nutzer die erfolgreiche Aktualisierung auf seinem Handy gemeldet. Auf Nachfrage bestätigte er ausdrücklich, dass die bisherigen Routinen, Einstellungen und der Spielstand vorhanden sind. Dies ist ein echter Nutzerbericht zur Installation und sichtbaren Datenübernahme, kein hier ausgeführter Windows-/Android-Test. Versions-/Quellkennung am Gerät und Signierprotokoll wurden nicht ausgelesen.

Die Installation allein bestätigt weder die weitere Weckerplanung (G12) noch einen der Klingel-, Sensor- oder Testseitenfälle. Diese bleiben für den aktuellen Stand offen. Nächster gemeinsamer Schritt: **Mehr → Gemeinsam testen → Erster Weckertest → Separaten Test in 10 Sekunden starten**, zunächst bei entsperrtem Handy. Den beobachteten Ausgang bewusst auf der Testseite speichern. Die unabhängige Code-Etappe E02 bleibt der nächste Entwicklungsschritt.

---

## E01-Nachbesserung und Übergang zu E02 (06.11.2026)

Nutzerbericht: Nach Start über Benachrichtigung/Widget führt jeder Seitenwechsel zurück zu Jetzt; normaler Appstart erlaubt Navigation. Ursache am produktiven Router reproduziert: `useNavigate` wechselt seine Identität und der Bridge-Effekt liest dadurch den von Android beibehaltenen Startlink erneut. `useEffectEvent` hält die Navigation aktuell, während Startlink/Listener nur einmal je Mount eingerichtet werden. Neue native Einstiege und Klingelereignisse bleiben aktiv.

Zusätzliche Nutzerentscheidung: Während einer bewusst gestarteten Messnacht den Vorwecker ausschalten und informieren. Umsetzung als `preWakePausedForTargetAt` im bestehenden nativen Alarmzustand, ohne Änderung der gespeicherten Vorwecker-Einstellung. Erfolgreicher Vordergrund-/Timerstart bzw. erfolgreiche Sensor-/Mikrofoninitialisierung gehen der Pause voraus. Gleicher Haupttermin bleibt auch nach Stop/Boot pausiert; neuer Termin löscht die Ausnahme. Fester Hauptwecker und Bestätigungsregeln bleiben erhalten. Brücke, Diagnose und sichtbare Info vor/nach Start sind angepasst.

**Nachweise:** alter Code scheitert am echten Browser-Navigationsablauf; neuer Stand besteht340 Vitest-,33 Browser- und54 Kotlin-Tests, Lint/Typecheck/Produktionsbuild sowie vollständigen unsignierten Release-APK-Build. Browser simuliert native API-Werte, kein Android-Sensor-/Dienstnachweis. Neue G64/65 offen. Appversion für das nächste Update:1.2.0-rc.2, Code4; noch kein neues Paket ausgeliefert. Logs: `/workspace/.cache/anker/navigation-fix/`.

**E02 jetzt ausdrücklich vollständig beauftragt:** NO-01–05 und PR-01–03 im vorhandenen Modell vervollständigen; Testseite ergänzen, geprüften Stand in main pushen und automatischen PowerShell-Updateweg liefern. Erneuter Appstart über das Symbol ist nur der vom Nutzer bestätigte Zwischenweg, kein Ersatz für den Navigationsfix. E02-Prüfung erfolgt parallel ausschließlich lesend bzw. in getrennten Arbeitsbäumen; keine konkurrierenden Schreibzugriffe auf denselben Baum.

## E02 – integriertes Ergebnis (06.11.2026)

Ausdrücklicher Auftrag für die gesamte Etappe, main-Push und neues lokales Updatepaket. Basis nach E01-Nachbesserung: `8b08fd7`. Teilaufgaben wurden in getrennten Worktrees umgesetzt und im Hauptbaum integriert; keine zwei schreibenden Agenten im selben Baum. Bestehende Planer, Tasks, Routinen, QR-Werte und Daten bleiben maßgeblich. Keine neuen Abhängigkeiten, Provider oder Gebühren.

| Anforderungen | Umsetzung im vorhandenen Weg | Automatischer Nachweis / Gerätefall |
|---|---|---|
| NO-01, Q13/14: Relevanz/Lebensdauer/Priorität | `reminders/build` und `ReminderLogic`: generische Texte, aktuelle logische Revision, getrennte Queue/Slots, Ablauf-/Stale-Pruning; höhere Wichtigkeit bleibt | Policy-/Modelltests; G21/66/68 offen |
| NO-02, Q16/17: alte und doppelte Aktionen | getrennter Zustellungstoken, Tokenhash in PendingIntent-Identität; Slot/Revision/Quelle vor Wirkung prüfen; native Slots/Queue/Aktion gemeinsam committen. Ausgang lesen, nach atomarem Store-`putMany` per ID ACK. Receipts bewahren echte Zeiten/XP, fehlgeschlagene Transaktion bleibt ohne RAM-Erfolg erneut versuchbar | Schreibfehler/Retry, paralleler Drain/UI-Eingabe, alte Revision, Doppeltap, ACK-Reihenfolge, Dexie-Rollback; G66/67 offen |
| NO-03, Q15: gemeinsames Budget | Alarm und Mikrofon-Dienst reservieren Platz; normale Karten nach Rang auf3 minus geschützte Anzeigen reduzieren. Reservierung vor Foreground-Post; Pflichtanzeigen nie löschen, fremde Apps unberührt | Modelltest0–3 Reservierungen, Lifecycle-Review und SDK-Kompilierung; physisches Budget G70 offen |
| NO-04, Q18: Mehrtag ohne Nachholsturm | mindestens14 vollständige Plantage bis04:00, weitere bekannte Sondertage datiert; neutrale Wochenregeln aus kanonischem `buildDayPlan` als Snapshot. Kotlin rechnet nur nächste Berliner Vorkommnisse, genau ein zukünftiger Eintrag je Regel. Highwater/Tokenledger gegen Rückstau/Zeitrückstellung. Regelzahl/Gültigkeit ehrlich in Diagnose |7 TS-Regeltests,9 Kotlin-Regeltests, zukünftige Ausnahmen/Nacht/DST; G24/25/71 offen |
| NO-05, Q19: Ruhe/Freizeit/Fokus | zentrale Policy pro tatsächlicher Stufe, Snooze erneut geprüft. Wichtige Anker behalten ihre Ausnahme, gewöhnliche Hinweise respektieren Fokus-Timerende, Freizeit/Fahrt und Modus. Fokusspiegel endet beim Seitenaustritt, keine fingierte Erledigung | Policytests, Native-`allowed`, Browser-Fokusspiegel; G68/69 offen |
| PR-01, Q20: tatsächlich erreichbare Auswahl | bestehende `PrintSheet` für Morgen/Abend/beide/QR/Haustür, direkte Fokus-/Weckerlinks; Test-Rückweg außerhalb des Druckinhalts | Auswahl-/Persistenz-/Navigationsfälle; G74 offen |
| PR-02, Q22: Dialog und unabhängige PDF | Fonts/Bilder/QR-Bereitschaft statt150ms; dedizierter lokaler Android-Druck-WebView, eigener `PdfDocument` ohne Druckdienst, bestehender Share-Weg. Haupt-WebView erhalten. Fehler/Abbruch melden keinen Ausdruck/Versand | Native-API-/SDK-Build, Browser-Brückensimulation/Fallback; G73 offen |
| PR-03, Q21: Papierqualität | A5/A4, skalierte Schrift, Checkboxen, einzelne Schritte paginiert, lange Einzeltexte und gleiche Titel erhalten; QR unverändert mit4 Modulen Ruhezone | reine Kotlin-Paginierung, Browser-PDF90 Schritte bei160%: A5 21/A4 9Seiten, alle Texte und kein Overlay; Papier-Scan G72/74 offen |

Der native Snapshot-Abgleich wird serialisiert und fasst schnelle Änderungen zusammen, damit ein älterer Plan keinen neueren überschreibt. Zusätzliche transaktionale Repository-Methode ist die kleinste Integration für Wirkung/Receipt/XP, kein zweites Datenmodell. Die übrige globale Effekt-Sequenzierung bleibt E03.

**Statusgrenzen:** implementiert und im dokumentierten automatischen Umfang geprüft. Android-SQLite-Transaktion, Receiver/PendingIntent-Zustellung, sichtbare Anzahl, Mikrofonstart, nativer Druck/PDF und Papier-QR bleiben auf dem Galaxy offen. Offizielle Android-Dokumentationsseiten waren durch die Netzrichtlinie gesperrt; keine aktuelle Webprüfung behauptet, vorhandene SDK36-APIs und tatsächliche Kompilierung genutzt. Neue Regeln kennen Änderungen erst nach erneutem App-Abgleich; keine unbekannten Termine, Live-Anpassungen oder Schlafphasen erfinden. Nächste Entwicklungsetappe E03.

**Übergabe:** Appänderungen in Quellcommit `f272c514772a32c4529b92088467851e7f940668` auf main integriert. E02-Paket separat auf `download-anker-e02-20261106`, Commit `bbbd844737c71f827095c8ba9cd1058d93d647d8`; kein Merge der Binärdatei in den Appbaum, kein Tag/Store-Release. Öffentlicher Download vollständig nachgelesen: HTTP200,21972987Bytes, SHA256 `5e754fa1de871ad8077a2925dd36e46b1cf3623f86e786420069afeec6cf22b5` stimmt. URL: `https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e02-20261106/Anker-Update-E02.zip`.

Nächster Nutzerschritt: Download prüfen, entpacken und lokal mit dem vorhandenen Schlüssel signieren; die erzeugte `Anker-E02-Update.apk` über die bestehende App installieren. Danach zuerst Daten und G64 prüfen, dann **Gemeinsam testen → Erinnerungen & Druck prüfen**. Neue Gerätebeobachtungen erst nach tatsächlichem Bericht eintragen. Die private Auftragskopie ist weiterhin bytegleich und ignoriert.

**CI-Nachprüfung,06.11.2026, abgeschlossen:** Remote-Lauf13 scheiterte im kombinierten Playwright-Schritt; bereits Läufe7–12 zeigten dieselbe Grenze vor E02. Diagnose getrennt und öffentliche Fehlerannotation/-berichte ergänzt. Nachlauf14 liefert den konkreten Rotnachweis:33/39 bestanden, fünf voreilige Hard-Navigationen vor abgeschlossener Speicherung und ein Drucküberschriften-Überlauf. Speicherbedingungen in den Tests ergänzt (lokal5/5), Überschriften in der Druckansicht umbrechbar gemacht (Altcode bei320px rot, danach4/4 Druckfälle inklusive PDFs grün). Keine Erwartungen abgeschwächt oder Timeouts erhöht. **[Remote-Lauf15](https://github.com/frnkrm/anker/actions/runs/42152225401) auf main `e6e254b` vollständig erfolgreich,39/39 Browsertests und sämtliche übrigen Checks grün.** Details im Abschnitt „CI-Untersuchung nach E02“ der [Testnachweise](ANKER_TESTNACHWEISE.md). Ausgelieferte APK/Nutzerdaten unverändert; Web-Druckumbruch folgt im nächsten Appbuild, echte Android-Tests bleiben offen. Nächste Produktetappe bleibt E03.

## Aktuelle Nachbesserung: Android-Systemleisten (06.11.2026)

Nutzer bestätigt Überlagerung durch Uhr-/Akku-Leiste. `viewport-fit=contain` und synchroner SystemBars-Hinweis nutzen den bereits vorhandenen nativen Capacitor-Abstand für die gesamte App, einschließlich Testbegleitung und Fokus. Kein eigenes Insets-Modell, keine festen Pixelwerte, bestehende Tastaturbehandlung bleibt erhalten. Appversion1.2.0-rc.3/Code5; G75 ergänzt,75 geführte Fälle insgesamt. Implementiert;376 Logiktests, Lint/Typecheck/Build und **[CI16](https://github.com/frnkrm/anker/actions/runs/42191095861) mit40 Browserfällen vollständig grün**. Unsig­niertes APK erfolgreich gebaut; Paketversion, eingebettete Konfiguration und Webassets geprüft. Neues portables `Anker-Systemleisten-Update.zip` auf getrenntem Downloadbranch bereitgestellt und HTTPS-Download vollständig gegen SHA256 geprüft. Details im Abschnitt „Android-Systemleisten“ der [Testnachweise](ANKER_TESTNACHWEISE.md).

**Geräterückmeldung06.11.2026:** Nutzer bestätigt **„oben frei“** nach der Bitte zum ersten Sichttest auf Jetzt. Der gemeldete obere Überlagerungsfehler ist damit am Galaxy nicht mehr sichtbar; G75 bleibt als Teilprüfung geführt. Fokus, Tastatur, Rotation, Kameraaussparung und untere Systemnavigation sind nicht bestätigt. Installierte Buildkennung und Windows-Ausführung wurden nicht unabhängig ausgelesen. Der Bericht erfordert kein weiteres Update und ändert keine lokalen App-Häkchen oder Nutzerdaten. Nächste Produktetappe bleibt E03.

## E03 – initial umgesetzt und lokal automatisch geprüft (06.11.2026)

Ausdrückliche Freigabe „du kannst gerne schon mal mit E03 beginnen“. Startstand `34f8a87`, sauberer Hauptbaum; Entwicklungsbranch `entwicklung/anker-e03`. Quellsnapshot `/workspace/.cache/anker/e03/baseline-source.tar.gz`, SHA256 `8543d35dfe82701a5d493aad4676f0b6fb335d35092da8fdd4854c3e626f75a8`. Baseline376 Logik-/40 Browserfälle, App rc.3/Code5. Hauptagent schrieb allein im Integrationsbaum; Teilagenten ausschließlich in getrennten Worktrees. Bestehende Datenmodelle und Claude-Änderungen wiederverwendet, privates Original unverändert und ausgeschlossen.

| IDs | Implementiertes Delta im vorhandenen Modell | Konkrete automatische Nachweise / Grenze |
|---|---|---|
| TA-01/03,03.3 | Optionale gemeinsame TaskFields an InboxItem/WorkTask; ehrliche Zustände, stabile Unteraufgaben-/Wiederholungs-IDs. Gemeinsamer Abschluss/Undo. Inbox→Arbeit inklusive neutralem Tombstone atomar; Importkonflikt bewahrt beide Fassungen | `tasks.test.ts` (Core/Store), `tasks-ui.spec.ts`, `tasks.spec.ts`: Morgen→Tagesplan/Jetzt→gemeinsamer Abschluss/Undo, Transfer/Transaktionsfehler/Importkonflikt |
| TA-02 | Lokaler Capture-Entwurf mit tatsächlichem Fokuskontext, Pending-Guard und explizitem Notizspeichern. Berufliche Metadaten nur allgemein im synchronisierbaren Inboxrecord | `tasks.spec.ts`: Entwurf→Reload→Speichern→derselbe Schritt/Timer, Workkontext-Privacy. Vorhandener Widget-Capture bleibt; weitere Android-Launcher-Shortcuts bewusst später bei E08, keine zweite Startebene |
| TA-04 | Eine gemeinsame nextAction für aktive Priorität, passende Dauer, verfügbares Fenster, Fristen, frühesten Start, Kontext/Energie und Erholung. Widget verwendet dieselbe Auswahl mit neutraler Projektion | `taskSelection.test.ts`, `support.test.ts`, `widgetPrivacy.test.ts`, `tasks.spec.ts`; künftige Umschaltpunkte mitgeplant. Keine Standortmessung |
| TA-05/06 | Lokale Zerlegung mit Vorschau/Detailtiefe und erhaltenen echten Teilen; Fokus15/25/40/50, nächste Schritte und Notizen je Aufgabe. Fokus und Arbeitszeit getrennt | `tasks-ui.spec.ts`, `tasks.spec.ts`, Storefälle A→B→A, Undo, doppelte Wiederholung. Bestehende Arbeitsübergabe/Vorlagen bleiben; keine externen Nachrichten |
| TA-07/08 | Kein8h-Verfall, referenztreuer Wiedereinstieg, unabhängige persistente Fokus-/Hilfetimer. Starthilfe erst auf Start, Deadline/Pause, neutrale Zeitüberschreitung, geschützte deduplizierte Pulse | `focus.test.ts`, `recovery.test.ts`, sieben `recovery.spec.ts`-Fälle einschließlich alter Timerübernahme und verspäteter Brückenantwort. Prozessbeendigung/Sperren/Pulse am echten Handy offen |
| TA-09 | Freiwillige lokale, bestätigte Dauerproben; robuster Median als ausdrücklich anzuwendender Vorschlag, Aus/Reset und Undo ohne doppelte Proben | Core-/Store-/Lern-UI-Tests. Bestehende Ankommen-/Routinenverknüpfungen und kleine Tagesmodi wiederverwendet; keine zusätzliche allgemeine Regelengine, KI oder Sprachübertragung |
|03.4/IN-06 | Atomare Task-/Fokus-/Receiptaktionen vor RAM-Erfolg; serialisierter gemeinsamer lokaler/native Abgleich, langsame Extras getrennt, direkte Alarm-/Widgetaufrufe abgesichert. Import/Sync-Merge aktualisiert RAM vor nächster Bearbeitung; SQLite-Batches transaktional | Coalesced-/Effects-/Alarm-/Health-Tests, SQLite-/Repositorytests, zusätzliche Store-Regressionen: verspätete Antwort, Rollback, Import+Bearbeitung, Doppelbelohnung, native Wiederholung und alte Deadline-Aktion nach Undo |
| UX-01/02/03 | Bestehende Gedanken/Arbeit/Tag statt zusätzlicher Hauptnavigation. Aufgaben Start/Erledigt/Details; seltene Angaben darunter. Private Später-Aktion unter Plan & Optionen, „Ich bin abgedriftet“ als kurzer Rettungsweg | Browserprüfung Interaktionsbudget und320px/160%-Schrift; Capture/Recovery ohne Pflichtreflexion. Weitere Onboarding-/Personalisierungswünsche gehören zu späteren Etappen |
| Q34 / nötige FL-08-Voraussetzung | Automatischer Kapitelverlust bei Nichtnutzung entfernt; nur echte Erfolgstage zählen. Bestehende Versuche/Joker/XP/Abzeichen erhalten, keine erfundene Rückgewinnung |2 reale Nichtnutzungsfälle vorher rot;30 Spieleinheiten grün, Altbackup-Offlinefluss nach3 Tagen ohne Verlust. Weitere E04-Planungs-/Freizeitfunktionen nicht vorgezogen |

**Automatisches Gate:** Lint/Typecheck/Produktionsbuild erfolgreich;499 Vitest-Tests/40 Dateien und58 Playwright-Fälle vollständig grün, keine Skips. Frischer Produktionsbuild, eigener Port4195, System-Chromium155. Android-Release mit aktivem Lint gebaut und73 Kotlin-Tests in6 Suiten tatsächlich neu ausgeführt, keine Fehler/Skips. Testseite85 Fälle, darunter zehn neue geführte E03-Prüfwege G76–G85. Links ändern keine Einstellungen oder Tasks und starten keine Timer; Berichte nur nach bewusster Rückmeldung.

**Update:** App1.2.0-rc.4/Code6; Quellkennung `e4541ce7f2587af4796541c6da5d81396a5542819106b79ff75759ec8a37bb2e`. SDK-freie Signierhilfe unverändert, kein Nutzerschlüssel verwendet. Paket- und Prüfdetails im E03-Abschnitt der [Testnachweise](ANKER_TESTNACHWEISE.md).

**Statusgrenzen:** E03 implementiert und automatisch getestet; noch keine neue echte Android-Prüfung. G75 hat weiterhin ausschließlich die frühere obere Anzeige bestätigt. Fokus-Resume nach echter Prozessbeendigung, Hardwarepulse, native SQLite-Laufzeit, Widgets und sämtliche G76–G85 bleiben am Galaxy offen. Keine KI oder produktiven externen Dienste aktiviert; kein Release/Tag. Main-Übernahme und GitHub-CI werden nach Durchführung unten mit tatsächlichen IDs ergänzt. Nächste Produktetappe ist E04, hier nicht begonnen.

### E03-Nachbesserung nach Remote-CI17

Main `5e46b17` und initiales Update rc.4/Code6: lokal499/58/73 grün, aber [GitHub-CI17](https://github.com/frnkrm/anker/actions/runs/42254106105)57/58 rot. Ausschließlich der verspätete native Puls schlug fehl: URL bereits verlassen, React-Komponente vor dem Unmount noch aktiv. Keine Erwartungen abgeschwächt. Neuer deterministischer Plattformtest hält diesen Übergang fest und liefert am Altcode reproduzierbar1 statt0 Pulse. `useFocusPulse` bindet jetzt den gerenderten Routerpfad und vergleicht die Browseradresse vor und nach asynchronen Aufrufen. Session-/Off-/Alarm-/Sichtbarkeits-/Restzeitprüfungen bleiben.

**Abschluss rc.5/Code7:** Lint/Typecheck/499 Logikfälle, alle8 Recovery-Browserfälle und der vollständige frische59-Fälle-Lauf grün (2,6min,0 Skips/Flaky). Android-Release mit aktivem Lint und73 erneut ausgeführten Kotlinfällen grün. [Remote-CI18](https://github.com/frnkrm/anker/actions/runs/42255441031) für exakt `5c898a8448cca1bbfb030eff74ed3dd3a4fcf667` vollständig erfolgreich,59 Browserfälle/1,7min. Beide Codeetappen nach main übernommen und Remote-Refs geprüft; Abschlussdokumentation separat mit `[skip ci]`, unveränderte Appquellen.

Aktuelles [Update-ZIP](https://github.com/frnkrm/anker/raw/refs/heads/download-anker-e03-rc5-20261106/Anker-E03-Update.zip) auf getrenntem Downloadbranch `download-anker-e03-rc5-20261106`, Commit `736f2a7`. HTTPS200 vollständig erneut gelesen,21996214Bytes, SHA256 `8903450c1bf9a98d4e9d3e71c6ba3b24cb486274db1c2dc49f7564bdfa7ec5de`. Quellkennung `3b102c5d15afe9e4950e565697e811edb2d0e0bd9a8f832aacfb927b4d370a5b`. SDK-freie lokale Signierhilfe unverändert; keine Nutzerkeys/Windows-Signierung/Installation/Hardwaretests. Die initiale rc.4-Datei und ihre Nachweise bleiben als Verlauf erhalten, aktuelles Paket ist rc.5. Nächster kleiner Nutzerweg: signiertes Update installieren, Mehr→Gemeinsam testen→Aufgaben & Wiedereinstieg prüfen→G76. Keine Pflicht, alle85 Tests abzuarbeiten. E04 nicht begonnen.

## E04–E09 – Softwareentwicklung abgeschlossen, Geräteprüfung offen (06.11.2026)

Nutzerauftrag: alle verbleibenden Etappen entwickeln; echte Handytests ausdrücklich erst gemeinsam am Schluss. Vorhandene Commit-/Main-/Downloadfreigabe bleibt, keine Releases/Tags, kostenpflichtigen Aktivierungen oder externen Nachrichten. Neue sensible Funktionen werden entwickelt, aber erst auf ausdrückliche Einwilligung des jeweiligen App-Nutzers aktiv. Kein vorweggenommenes Geräte-Gate.

Baseline `59c530f8f012587d6d1533ad26227342dc60d875`, sauberer Hauptbaum, App rc.5/Code7. Archiv `/workspace/.cache/anker/e04-e09/baseline-source.tar.gz`, SHA256 `d7128621da7409121db12f1a201ace244b661e549499432008da29e8553e2b9a`,339 Einträge nach Entpackung gelesen. Frisch499 Logiktests/40 Dateien sowie Lint/Typecheck grün; letzte vollständige Browser-/Kotlin-/Remote-CI-Nachweise bleiben59/73/CI18. Privates Original vollständig gelesen und ausgeschlossen; bestehende Modelle/Claude-Änderungen erhalten. Hauptagent allein im Integrationsbaum `entwicklung/anker-e04-e09`; Teilagenten schreiben ausschließlich in sechs getrennten Worktrees. Integration/Gates in E04→E09-Reihenfolge, spätere unabhängige Vorarbeit parallel.

| Etappe | Tatsächliches noch offenes Delta | Integration / Nachweisziel |
|---|---|---|
| E04 FL/IN-02 | Undo sagt bislang auch alte Termine ab; zwei Transaktionen. Einmaliges15min-Limit, offenes Ende als falscher PC-Termin, unbestätigte Empfangsbehauptung. Fokus ohne Heute anders; Coverage-Override und Tagesdruck fehlen | atomare private Undo-Baseline, freie Verlängerung/PC-Pause, drei Hauptwege+Details, Vorabendquelle/Tagesoverride, gemeinsame Tagesinstanz-Druckdaten, passive Feieranzeige. Kapitelverlust seitE03 bereits beseitigt |
| E05 WO | Prognose kann Restarbeit ab vergangenem Wunschbeginn rechnen; widersprüchliche Nachträge still normalisiert, Undo kann spätere echte Arbeit löschen. Offene Pause/unbestätigte Langzeittimer, Tagesgrenze/Endwunsch und alte Korrekturen unvollständig | vorhandenes Intervallmodell validieren, atomare Korrektur/CAS-Undo, verlässliche Restprognose/Konflikte, optionales Wochenprofil erweitern, Datumsauswahl |
| E06 TR/SL | unklarer Ort wird als remote behandelt; früher Remote-/Kalendertermin und Kundenprep fehlen im Morgenbedarf, Ursprung/Rückweg falsch, Wecktoast vor nativer Bestätigung | offene Ortszustände, lokale Orte/Termindetails, richtige Kette, gemeinsamer rückwärts gerechneter Bedarf, explizit bestätigte native Übernahme |
| E07 WX/TR-Provider | fehlende Werte als0; alter Forecast unter neuer Stadt, späte Antworten, fehlendes Cachealter. Packvorlagen/Vorbereitetzustand fehlen. Wetterort in Syncsettings | validierte lokale Standortprofile/Ortswechselguards, echte Stundenfenster, lokale wiederverwendete Packitems. Vollständiger optionaler Verkehrsadapter mit geschütztem Backend und manueller Alternative; keine Provideraktivierung/Schlüssel im Client |
| E08 IN/optionale Extras | lokale Sprache, Geofencevorschläge und Launcherwege fehlen; Widgetsnapshot läuft nicht ab. Google fordert Schreibscope zu früh, unvollständige Seiten/HTTPfehler/Aktualität | bewusste lokale ASR/TTS, besuchsgebundene Ortvorschläge ohne Arbeitsbuchung, Widget-TTL/Schnellzugriffe, ehrliche Systemwege, Google-Lese-/Schreibwahl und Fehlerzustand. Vollständiger optionaler KI-Adapter mit editierbarer Vorschau; echte Verbindung ohne Konfiguration separat offen |
| E09 Qualität/UX/IN-06 | beschädigte Sicherung kann teilweise importieren, Speicherinitfehler wird still RAM. Export sensible Gruppen, Tastatur/Touch/Kontrast/ReducedMotion, Zielgrund/Erprobung unvollständig | kompatible Vorabvalidierung/Importvorschau, sichtbarer Speicherfehler+Retry, Datenschutzprojektion, A11y, höchstens drei lokale Lernpunkte, gemeinsame Regression und maximal zehn geführte Gerätestationen |

Vor UI-Arbeit mitgeteilt: Heute anders auch im Routinefokus; seltene Wege unter Weitere Möglichkeiten. Arbeitsdetails bleiben Arbeit & Gleitzeit, Wetter-/Packdetails Vorbereitung, keine neue Hauptnavigation pro Feature. Alle Geräteberichte bleiben erhalten; keine automatische Erledigung oder Testhäkchen. Alle Etappen sind jetzt integriert; neue Abschlusskorrekturen erhalten eigene Regressionen vor dem gemeinsamen finalen Gate.

### E04 – integriertes Ergebnis

Integrierte Codecommits `7603162` (PC-Protokoll), `5710282`/`96837ad` (atomare Tagesrücknahme und Ist-Erhalt), `7213062` (Bedienung/Tagesdruck); kleiner gemeinsamer Weckbestätigungsvertrag `311783c` als notwendige sichere Voraussetzung aus E06. Unabhängige Vorarbeit `af29472` (Zielgrund) und `6edb46d` (geschlossene Providerbasis) ebenfalls enthalten, keine reale Anbieteraktivierung.

**Implementiert:** nur zum Tages-Undo gehörende private Baseline in meta/local, gemeinsam mit Tageslog transaktional; vorhandene Termine und echte Fahrt/Ankunft/Arbeit/Stepabschlüsse erhalten. Wiederholte freie +30/+60/Uhrzeit/offene Abende, neue PC-Aufträge scheduled/paused mit stabiler Revision und Berliner Plantag. Kein03:59-Scheinauftrag/kein behaupteter PC-Empfang; Windows-Paket2 bewahrt heutige Pause offline, setzt alte Cache-Uhrzeit nicht auf neue Tage und bietet datumsgebundenen Abbruch ohneZwang. Neue Windows-/Serverversion für den Protokollweg nötig; kein Deployment ausgeführt. Heute anders auch im Fokus, drei Hauptwege und übrige Details; Öffnen erledigt nichts, Anwenden pausiert passend. Quellen der Vorabendabdeckung sichtbar und nur für heute übersteuerbar. Tagesinstanzdruck verwendet denselben Plan/Log, Vorlage bleibt wählbar. Rückfrage später erfindet keine Rückkehr. Spielrückmeldungen passiv statt blockierend; Nichtnutzungsverlust seitE03 bereits entfernt.

**Automatisch geprüft:**550 Vitest/47 Dateien, Lint/Typecheck grün im Integrationsbaum. Frischer Produktionsbrowser auf4213/System-Chromium155:29/29,0 Skips/Flaky (1,3min), darunter alle8 neuen E04-Fälle, neue Zielnotiz und bestehende Abend-/Druck-/Native-Navigations-/Recoveryregressionen. Rotnachweise:4 ursprüngliche Undo-Risiken,1 später bestätigter Schritt,3 PC-Publishfehler. Logs `e04-e09/e04-integrated-*` und `e04-browser*`; unabhängige E04-Belege unter `e04/`.

**Offen:** tatsächlicher Windows2-Scriptlauf/Systemaufgabe, Serverfunktionsversion2, PC-Empfang und alle neuen Android-Gerätetests. Keine Tests vom Nutzer verlangt. Nächster Integrationsschritt E05; Codes in getrennten Worktrees bleiben Vorarbeit bis Übernahme/Prüfung.

### E05 – integrierte Arbeitszeit und sichere Korrekturen

Code `82450dc`/`b41f6c6`/`f877be2`: bestehendes Intervallmodell und Wochenprofil erweitert, kein zweites Zeiterfassungsmodell. Laufende Pause zeigt eine untere Grenze oder ausdrücklich gewählte Endschätzung; Restarbeit beginnt nicht in der Vergangenheit. Widersprüchliche Nachträge werden sichtbar abgelehnt. Korrektur und Rücknahme sind atomar; eine spätere echte Buchung macht eine alte Rücknahme ungültig. Tagesabhängige Startgrenze und Feierabendwunsch bleiben optional, vorhandene Sollzeiten/Freitagwerte unverändert. Historische Tage und Nachtschichten sind ausdrücklich auswählbar, Endkorrekturen behalten den tatsächlichen Folgetag. Lange offene Abschnitte verlangen ein bestätigtes tatsächliches Ende. Einsatzänderung und Tagesplan verwenden dieselbe Rücknahme.

Frischer integrierter Stand:572 Vitest/49 Dateien, Lint/Typecheck grün (`e04-e09/e05-integrated-*`). Frischer Produktionsbrowser:19/19 E05-/bestehende Smoke-Fälle grün (`e05-browser.log`); der zusätzliche gefundene Nachtschicht-Kontextfehler nach04:00 wird vor dem Gesamtabschluss ebenfalls integriert und gezielt geprüft. Echte Arbeitszeitbedienung auf dem Galaxy bleibt wie beauftragt offen. Nächste Integration E06.

### E06 – integrierte lokale Orte, Wege und Morgenbedarf

Code `3313fe5` bis `5bdd3cf` plus bestätigter Weckvertrag ausE04. Lokale Orte besitzen getrennte Zweckfreigaben, unbekannt/Remote/Zuhause/vorOrt sind ausdrücklich verschieden. Tatsächliche Ortsfolgen berücksichtigen bestätigte Rückkehr und direkte Weiterfahrt; unbekannte Dauer bleibt offen. Harte Kalender-/Kundentermine einschließlich Remote und früher Termine gehen in denselben rückwärts gerechneten Morgenbedarf ein; Zusatzvorbereitung wird nur auf ausdrückliche Wahl als bereits enthalten behandelt. Kein zweiter Planer. Gemeinsame Termin-/Einsatzfelder, explizite Kalenderquellverknüpfung gegen Dubletten, Maps bleibt manuell. Jetzt-Aktionen markieren Ist-Zeiten atomar anhand der aktuellen Instanz. Weckvorschläge werden nur bewusst übernommen; Android-Erfolg erst nach nativer Bestätigung und mit geschützter Rücknahme bei Fehlern.

**Automatisch geprüft:**603 Vitest/52 Dateien, Lint/Typecheck,6/6 frische Produktionsbrowserfälle (4 Orte/Termine/Morgen/Maps plus2 Nachtschichten;35,3s,0Skip). `e04-e09/e06-*`. Zusätzlich PC-Nachbesserung `9683370`: echte fünf Minuten Schonfrist nach tatsächlicher Warnung, strikte ISO-Stempel, Pause/Legacy/Uhrrücksprung geprüft.19/19 isolierte PowerShell7.5.4-Fälle und4 Exportparser grün (`pc-proof-approved.log`); CI erhält eigenen verpflichtenden `test:pc`-Schritt. Das ist Linux-Scriptlogik mit simulierten Systemaktionen, keine Windows-/Abschaltbestätigung. Alle neuen Android-Geräteabläufe bleiben offen. Nächste Integration E07.

### E07 – Wetter, Packlisten und optionaler Verkehr integriert

`6c7e5df`/`fc5d02b`/`54b3063`: Wetterwerte vollständig prüfen, fehlend bleibt unbekannt, alter Ort und spät eintreffende Antwort werden nicht unter neuem Ort angezeigt. Stundenfenster richten sich nach konkretem Außenweg; Anbieter/Alter/Offlinecache bleiben sichtbar. Wetteraktivierung/Koordinaten liegen im lokalen Profil, Syncprojektion bereinigt den alten Settings-Ort in beide Richtungen. Abschließender zentraler Altbackup-/Load-Migrationsanschluss wird zusätzlich geprüft. Kundenorte verlassen das Gerät erst nach eigener Zweckfreigabe. Vorlagen für Kundenbesuch/Sport/Ausgehen und eigene Dinge nutzen dieselbe lokale Termininstanz; vorbereitet ist kein Routine-/Arbeitsabschluss. Offizielle Forecast-/Geocodingherkunft und unterschiedliche Lizenzen werden getrennt ausgewiesen.

Frisch6/6 Produktionsbrowserfälle inklusive320px/160%Schrift, Stadtwechsel/fehlendeWerte/Offline/Pack-Roundtrip (`e07-browser.log`,36,2s); Logiklauf629 Tests/55Dateien grün (`e07-unit.log`). Während dieses Zwischenlaufs wurden zwei unabhängige Assistance-Commits früh übernommen; deshalb zählt dies als Zwischenbeleg, der gesamte endgültige Stand wird erneut frisch geprüft. Providerbasis ist geschlossen/default-off, vollständiger Trafficadapter samt Vorschau und Revisionsschutz folgt vor E08-Abschluss. Tatsächliche Kosten-/Kontoeinrichtung bleibt bewusst offen. Keine neuen Handytests.

### E08 – optionale Funktionen integriert

Gemeinsame Anbieterbasis und KI-Eingabe `3617c1e`/`d304af1`, Verkehrsadapter `f5a3b80`/`c2d8afe`, Extras-/Google-/Native-/Geofencecode `74f3508` bis `eba0d7f`. Neue Vorschläge befinden sich in vorhandenen Aufgaben-/Termindetails, getrennte Freigaben unter Einstellungen → Optionale Vorschläge, keine neue Hauptnavigation. Lokales Diktieren startet nur bewusst und bleibt Entwurf; Vorlesen ist unabhängig optional. Android-On-Device-Erkennung ohne Cloudfallback, Mikrofon-/Sprachausgabe stoppt vor Aktivitäts-Weckmessung. Standorthinweise sind an konkreten Besuch/Ort/Koordinaten gebunden, verlangen separate Rechte, speichern niemals selbst Ankunft/Arbeit/Medikation. Jetzt zeigt optionalen Vorschlag; Tag bietet dieselbe bewusste Bestätigung. Widgetsnapshot läuft ab, Schnellzugriffe nutzen bestehende Capture-/Fokus-/Recoverywege. Google zunächst lesen, Schreibfreigabe separat; Pagination/Abbruch/Fehler/Aktualität ehrlich. Private automatische OS-Sicherungen/Transfers ausgeschlossen; manuelle Sicherung bleibt verfügbar, bestehende Cloudkopien werden dadurch nicht entfernt.

**Zwischengate:**689 Vitest/65Dateien, Lint/Typecheck grün;18/18 frische Produktionsbrowserflows für Sprache/Schnellzugriffe/Geofences/KI/Verkehr,0Skip (`e08-*`,1,1min). Nativeowner bestätigt87/87JUnit und echten Kotlincompile, der finale Root-APK-Build folgt nach E09. Browserbrücken und Anbieter sind kontrolliert simuliert; kein Gerät/echter Anbieter. Ein zusätzlicher Review hat Abbruch-/Payload- und Widerrufs-/Sync-Ränder reproduziert; diese werden vor dem endgültigen Gate behoben. Externe Schlüssel/Konten/Kosten-/Bedingungsfreigabe und alle Hardwaretests bleiben offen, sensible Dienste standardmäßig aus. Nächster Integrationsschritt E09.

### E09 – integrierte Datensicherheit, Bedienung und gemeinsame Tests

`167f2c6`/`d083e64`/`38ff7e5`/`78e6a1d`/`cbcb1fb`: Backupbatch vollständig vor Persistenz prüfen, Import mit Vorschau und bewusster Bestätigung. Fehlende Objektfelder aus Teilsicherungen bleiben erhalten; Import wird innerhalb der Storequeue gegen frische Daten vorbereitet. Sensible Exportgruppen wählbar, JSON ist eine unverschlüsselte manuelle Sicherung. Speicherinitialisierung meldet Fehler sichtbar und bietet Retry, kein stiller flüchtiger RAM-Ersatz. Ein echter Wecker bleibt bei Speicherfehler über eigenen Notfallweg erreichbar, keine fingierte Einnahme. Tastatur/Touch/Vorlesehilfe/Kontrast/reduzierte Bewegung verbessert. Eigener Aufgabengrund bleibt freiwillig.7-/14Tage-Probe zeigt höchstens drei lokale Lernpunkte, keine Nutzungsstrafe.

**Zwischengate:**725 Vitest/71Dateien, Lint/Typecheck;27/27 frische Produktionsbrowserfälle für Sicherung/Storage/A11y/Testbegleitung,0Skip (`e09-*`,1,4min). Testseite beginnt mit zehn Stationen G86–95 statt95 Pflichtfällen; bestehende Detailfälle und frühere Berichte bleiben erhalten. Jede Station hat direkte sichere Zielwege, Öffnen erzeugt weder Alltagshandlung noch Erfolgshäkchen. Weitere Abschlussreviewkorrekturen und Q84 laufen noch; finale Zahlen/CI/APK werden erst nach tatsächlichem Abschluss eingetragen. Sämtliche neuen Android-Gerätefälle sind offen.

### Gemeinsamer Abschlussreview – umgesetzte Regressionen

Nach der Etappenintegration wurden konkrete Fehler mit roten Regressionen belegt und behoben: tatsächliche PC-Schonfrist/strikte Zeitstempel; laufende Nachtschicht über04:00; Großschrift-Tageslinie; verspätete Anbieterantwort und unnötige Payloadfelder; synchroner KI-/Verkehrswiderruf; Syncfreigabe einschließlich wartender Storequeue und privater Settings/Arbeitsgedanken; Teilsicherung ohne Arbeitskopien; atomare Alt-Wettermigration und Importprojektion vor Commit; feste Termine im Krankmodus; knappe Büro-/Heim-/Anschlusswege; korrekter nächster Kalender-Morgen und Sommer-/Winterzeit-Schlafgelegenheit; wahrer Kopiererfolg; allgemeine Remote-Widgetbezeichnung. UX-05 ergänzt die ausdrücklich gewünschte lokale Kontaktwahl mit einmaliger freiwilliger Rückfrage, ohne Versandbehauptung. Alle Änderungen nutzen bestehende Plan-/Store-/Backupwege.

Frischer integrierter Crossflow:15/15 Browserfälle,0Skip,59,1s (`cross-review-browser.log`):3Homeoffice,3Q84,6Plan-/Copy-/DST,3Sync. Zusätzlich30 relevante Unit-/Import-/Consenttests und Typecheck grün. Alle beschriebenen Sync-/Persistenz-/PC-Ränder sind mit zusätzlichen Regressionen integriert; der Quellstand wird jetzt eingefroren und vollständig geprüft. Die71 Anforderungen sind in den Testnachweisen den tatsächlichen Softwarewegen, konkreten Tests und offenen Gerätestationen zugeordnet. Native Root-Quellen88/89bytegleich (nur generierte Modulpfade abweichend),87/87JUnit ohneSkip,196GradleTasks erneut ausgeführt (`android-native-check/BUILD_REPORT.md`). Kein Gerätetest daraus abgeleitet.

### Abschließender gemeinsamer Softwarelauf und Updatekandidat

Appcode eingefroren in `cd2c63c`, danach ausschließlich zwei bestehende E2E-Abläufe in `baad9f7` auf den neuen Ausklapper/Homeoffice-/Terminpfad nachgeführt und vor Save zusätzlich auf unveränderte Daten geprüft. Der erste vollständige Lauf fand genau diese3 veralteten Testannahmen (134/137grün); Appcode unverändert. Gezielter16/16-Lauf und danach der gesamte frische137/137-Lauf in4,2min grün,0Skip/Flaky/Retry. Die gebaute Quellkennung blieb bytegleich. Lint/Typecheck,780Vitest/80Dateien und19 echte Linux-PowerShell7.5.4-Fälle mit4Parsern grün. Nativer Sourceabgleich88Dateien (nur generierte Modulpfade ausgenommen),87JUnit ohneSkip, Releasebuild mit484tatsächlich ausgeführten Tasks/2m59s. Kein Signierschlüssel verwendet.

APK `de.frnkrm.anker`,1.3.0-rc.1/Code8, SHA256 `9fb488411de0c389a7ffa06a544a27065f1e9c85e1e440ed770774be8d0b9599`.67Webassets bytegleich, CSS/contain-Systemleistenfix erhalten; ZIP16KB-ausgerichtet, alle4ARM64ELFs16KB-ausgerichtet,16JNIBibliotheken bytegleich. Portable ZIP22137167Bytes, SHA256 `bff0a29aeaa9decd390001f1ff2de4306bb076f349c4cb5307ed844eff29b81e`,10Dateien, unveränderteSignierhilfe2. Noch keine Windows-Ausführung oder Installation dieses Updates, keine echte neue Geräteprüfung. Privates Original unverändert/ungetrackt; keineSchlüssel/Umgebungsdateien/APKs/ZIPs im Appbranch. Keine Tags/Releases/Deployments/Anbieteraktivierungen.

Main-Integration, öffentlicher Download und Remote-CI werden erst nach tatsächlichem Abschluss ergänzt. Nächster Nutzerschritt danach: Paket lokal signieren, über bestehende App installieren und mitStationG86 Datenvergleich beginnen; weitere Handytests erst dann gemeinsam.

### GitHub-CI19 – getrennte Testablaufkorrektur

Main `e59cc42` erfolgreich gepusht; [CI19](https://github.com/frnkrm/anker/actions/runs/42283981487) bestand Install/Lint/Typecheck/780Logik/PowerShell/Build, Browser132/137. Drei konkret nicht deterministische Testannahmen nachgewiesen: Bericht95 nach unverändertem0-Zähler vor tatsächlichem Commit neu geladen; zwei gehaltene Sync-Schreibvorgänge freigegeben, bevor lazy Tag-Navigation tatsächlich den alten Bereich unmountete. Neue Barrieren warten auf bestätigte Persistenz, kaltes Tag-DOM und echte Transaktionsabschlüsse; SW nur in dieser HTTP-Mockfixture blockiert. Neue positive IDB-Regressionsprüfung ergänzt. Appcode/Quellkennung unverändert, keine Timeoutlockerung/Skips.

Zwei Nachtfälle waren lokal wiederholt grün, die Browser156-Abweichung noch nicht erklärt. Verschärfte Prüfung enthält exakte Start-/Pause-/Uhrwerte, reine Projektion und datensparsame H1-Diagnose; gleiche5sFrist. Der nächste vollständige CI-Lauf entscheidet, kein Produktfix oder Erfolg vorweggenommen. Offizieller Browser156-Container konnte wegen gesperrtem Auslieferungshost nicht vollständig geladen werden, keine Netzrichtlinie umgangen. LokalerBrowser bleibt155, GitHub nutzt156. Downloadbranch `download-anker-e04-e09-rc1-20261106`/`699df5e` enthält bytegleiches Paket; HTTPS200/22137167Bytes/SHA256bff0a29a… vollständig bestätigt, Appcode weiterhin e862… . Kein neues Gerätetestresultat.

### CI20 – Ursache der verbleibenden Testabläufe belegt

[CI20](https://github.com/frnkrm/anker/actions/runs/42286857557),8506325:135/138Browserfälle grün; die zuvor reparierten Gerätebericht-/Sync-Schreibbarrieren bestanden. Die Nacht-Diagnose zeigte korrekte Uhr, gespeicherte Sitzung und aktive Coreprojektion, aber `/start` stattJetzt. Nacht- und Sync-Setup navigierten nach dem Klick hart weiter, bevor die asynchrone Ersteinrichtung gespeichert war. Echte gehaltene Settings-Schreibvorgänge reproduzieren das; die Tests warten nun vor Navigation auf Home-URL und persistiertes onboarded=true. Vier weitere direkte Testnavigationen derselben Klasse ebenfalls abgesichert.

Die Homeoffice-Rückfrage wurde mit echtem verzögertem IDB-Load reproduziert: Negativcheck schon im Loader bestanden, dann Uhrwechsel und alter Now-Mount, der die Rückfrage korrekt einmal verbrauchte; sofortiger zweiter Reload konnte sie folgerichtig nicht erneut anzeigen. Test wartet jetzt auf vollständiges Jetzt/persistierten Eintrag, verlässt Now vor dem Uhrwechsel und prüft danach genau eine Rückfrage sowie keine Wiederholung. Kein Produktcode/Fingerprint/APK geändert, keine Timeouts verlängert und keine Fälle übersprungen.

Integrierter Root-Ziellauf24/24 in45s grün,0Skip/Retry. Zusätzlich15wiederholte Nachtläufe,4Syncfälle und3Homeoffice-Fälle getrennt grün; neue physische IDB-Setupregression ergänzt. Nächster vollständiger CI-Lauf mit139Fällen ist das ausstehende Remote-Gate. LokalerLint0Fehler/1bestehendeRef-Cleanup-Warnung; Warnung nicht mit dem eigentlichen CI-Fehler verwechselt. Quellen unverändert e862… , vorhandene ZIP unverändert bff0a29a… .

### Endgültiger Remote-Abschluss und Übergabe

CI21 auf `240033c246892113ecd0650ffe2d673d34740b38` ist vollständig erfolgreich:139/139 Browserfälle in3,8min, gesamter Job5m55s, einschließlich npm-ci/Lint/Typecheck/Logik/PowerShell/Build. Die früheren CI19/20-Abweichungen wurden mit realen IDB-Schreib-/Ladebarrieren reproduziert und ausschließlich in den Testabläufen korrigiert. Appcode und APK blieben unverändert; ein neuer Versionscode oder erneutes Signierpaket war deshalb nicht nötig. Zwei Hinweise zu Actions-Node20-Migration und einer bestehenden Ref-Cleanup-Linterwarnung sind keine Testfehler;0Lintfehler.

Main ist integriert und gepusht. Downloadbranch `download-anker-e04-e09-rc1-20261106` stellt die unveränderte ZIP bereit:HTTPS200,22137167Bytes,SHA256bff0a29a… vollständig überprüft; Signierhilfe2 bytegleich. APK/Sourcekennung entsprechen den bestandenen Softwareprüfungen. Finale Dokumentationskorrekturen werden separat mit `[skip ci]` gesichert; sie verändern weder Appcode noch die geprüfte Quellkennung. Keine Tags, Store-Releases, Deployments, Anbieteraktivierung oder externe Nachrichten.

Nächster Nutzerschritt: den geprüften PowerShell-Block aus UPDATE_E04_E09.md ausführen, APK lokal mit bestehendem Schlüssel signieren und über die vorhandene App installieren. Danach StationG86 beginnen. Neue Gerätehäkchen werden erst nach tatsächlichem Bericht gespeichert. Sämtliche Softwareetappen sind entwickelt; offene Geräte-/Windows-/Anbieterwirkung bleibt ausdrücklich getrennt.

## Historischer Verlauf (Angaben gelten für den damaligen Stand)

Fortsetzbarer Stand. Status: `offen` · `implementiert` · `automatisch getestet` · `am Gerät verifiziert` · `blockiert`

**Am Gerät geprüft (04.11.2026, vom Nutzer gemeldet):** Wecker 1–3, 8, 14–16, 18, 19, einmalige Weckzeit und Termine 36, 38–40, Erinnerungen 22, 23, Druck 27–30, Alltag 31–34, Gleitzeit 43, 45. **Offen oder auffällig:** Vollbild erscheint bei 4 und 9 nicht von selbst, 4 und 5 nur teilweise gemeldet, die übrigen Punkte noch nicht getestet. Einzelheiten in [GERAETETEST.md](GERAETETEST.md).
Grüne Tests und ein Build zeigen nur, dass die reine Logik stimmt und der Code kompiliert. Handprüfung: [GERAETETEST.md](GERAETETEST.md).

Branch: `entwicklung/anker-2` (nicht gepusht).

## Ausgangslage (04.11.2026)

| Prüfung | Ergebnis vor Änderungen |
|---|---|
| Git | `main` sauber, lokal = `origin/main` (98f8e2d) |
| `npm test` | 106 Tests in 7 Dateien bestanden |
| `npm run lint`, `typecheck` | bestanden |
| `npm run android:debug` | bestanden |

## Audit-Befunde

| Befund | Ursache in 1.0.1 | Status |
|---|---|---|
| Testalarm verdrängt echten Wecker | Gleicher PendingIntent, Receiver löschte `alarmAt` und Schlummern | behoben, automatisch getestet |
| Test zählte als „wach“ | `stop()` setzte immer `wakeAt` | behoben, implementiert |
| Kein Folgetag ohne App | Nur JS plante nach | behoben, automatisch getestet |
| Doppelte Klingel-Instanz möglich | `onStartCommand` startete jedes Mal neu | behoben, implementiert |
| Zeitlimit nach Prozess-Neustart neu | Handler ab Neustart | behoben, Logik getestet |
| 48-h-Lücke | Plan an JS gebunden | behoben, Logik getestet |
| Meldungen ohne Obergrenze | Eigene ID je Stufe | behoben, Logik getestet |
| Inbox-Sackgasse | `taskDate` wurde nirgends gelesen | behoben, automatisch getestet |
| Handzeiten überschrieben | `applySchedule` ignorierte sie | behoben, automatisch getestet |
| PC-Stopp erzwingt | `shutdown /s /t N` impliziert `/f` | behoben, Skriptinhalt getestet, nicht unter Windows ausgeführt |
| Web-Sheets ohne fertige Animation | Bewegtes `animate-pop` | entfernt |

## Pakete

### A: Wecker

| Schritt | Status |
|---|---|
| Zustandsmaschine `AlarmModel.kt` | automatisch getestet |
| `AlarmController`, eigene Identität je Alarmart | implementiert, Codes getestet |
| Native Folgetagplanung, Konfigurationsspiegel | automatisch getestet |
| Abgleich: Stopp, Timeout, Neustart, Update, Zeit, Zeitzone, Rechte | implementiert, Logik getestet |
| Zeitumstellung, 04:00-Wechsel | automatisch getestet (Kotlin und TS mit gleichen Werten) |
| Verpasste Wecker: 30 min nachholen | automatisch getestet |
| Vorwecker, Wachheits-Check | automatisch getestet |
| Notfall-Stopp, Rechenaufgaben einstellbar | implementiert |
| Einnahmeprotokoll getrennt, lokal | automatisch getestet |
| Ton-Rückfall, Audiofokus, WakeLock, Ersatzmeldung | implementiert |
| Exakt-Recht | implementiert, Manifest gebaut |
| Direct Boot: Daten im Geräteschutz-Speicher, Beenden in der Meldung | implementiert, Grenze dokumentiert |
| Diagnose mit echten Android-Werten | implementiert |
| Temporäre Lautstärkeanhebung | bewusst nicht umgesetzt (Auftrag bevorzugt das) |
| Gerätematrix | **offen, braucht Handy** |

### B: Benachrichtigungen

| Schritt | Status |
|---|---|
| Slots, Rang, Warteschlange | automatisch getestet |
| Zustellung und Knöpfe ohne JS | implementiert |
| 14 Tage voraus, Hinweis am Ende, kein Stau | Logik getestet |
| Abräumen der Altlasten aus dem Plugin | implementiert |
| WorkManager | nicht nötig: je ein geplanter Alarm für den nächsten exakten und den nächsten ungenauen Eintrag |
| Am Gerät | **offen, braucht Handy** |

### C: Druck

| Schritt | Status |
|---|---|
| Auswahl, A5/A4, Druck-CSS | automatisch getestet (Vitest, Playwright, PDF im Browser) |
| Native Brücke `printPage` | implementiert, Dialog **am Gerät offen** |
| PDF-Export als Alternative ohne Druckdienst | offen: Anker verweist auf die Web-Version |
| QR auf Papier scannen | **offen, braucht Drucker und Handy** |

### D: ADHS-Kern

| Schritt | Status |
|---|---|
| D1 Modi, Abendvorschlag | automatisch getestet |
| D2 `nextAction()` mit Begründung | automatisch getestet |
| D3 Fokus-Puls, Timer per Zeitstempel | automatisch getestet, Vibration am Gerät offen |
| D4 Blitzableiter | automatisch getestet (E2E) |
| D5 Inbox im Tagesplan, eine Wahrheit | automatisch getestet |
| D6 „Ich hänge fest“ | Logik getestet, im Browser angesehen |
| D7 Arbeitsmodus, Übergabe, Vorlagen | automatisch getestet (Vitest, E2E) |
| D8 Handzeiten, „Tag neu sortieren“ | automatisch getestet |
| D9 Ankommen, Gericht aus eigener Liste | automatisch getestet |

### E: Oberfläche

| Schritt | Status |
|---|---|
| „Jetzt“: eine Hauptaktion, Rest unter „Mehr“ | automatisch getestet (E2E), im Browser angesehen |
| Fokus mit Gedanken-Knopf und Puls-Schalter | implementiert |
| Ruhigere Karten mit 1-px-Rahmen | implementiert |
| Kontrast, große Schrift, Screenreader | **nicht systematisch geprüft** |

### F: Reifegrad

| Schritt | Status |
|---|---|
| F1 PC-Stopp ohne Zwang, Android-Fokus verlinkt | Skriptinhalt getestet, nicht unter Windows ausgeführt |
| F1 Spracheingabe, eigene Ablenkungsblocker | bewusst nicht umgesetzt (keine neue Berechtigung) |
| F1 Widget | unverändert, zeigt bewusst keine Arbeitsinhalte |
| F2 Migration, Sicherung, lokale Daten vom Sync ausgenommen | automatisch getestet |
| F3 Freiwillige Probe | implementiert |
| F4 Hilfe-Hinweise, vertraute Person | implementiert |
| Doku | aktualisiert |

## v4: Flexibler Alltag

Vorrang hatte P0. Dessen Geräteprüfung steht noch aus, daher ist auch hier nichts am Gerät verifiziert. Semantik: [FLEXIBLE_PLANUNG.md](FLEXIBLE_PLANUNG.md).

### Delta gegen den Stand von v3

| Anforderung | Einordnung | Umsetzung |
|---|---|---|
| Eine nächste Aktion, Modi, Wiedereinstieg | schon durch v3 vorhanden | `nextAction()` erweitert, kein zweiter Planer |
| `DayOverride`, Homeoffice, Tagesarten | für v4 erweitern | gleiche Struktur, neue optionale Felder |
| Neutrale Zustände | für v4 erweitern | `StepResult` um `not-needed`, statt paralleler `Resolution` |
| Falsches „Abendroutine erledigt“ beim Überspringen | Konflikt, behoben | `routineCompleted` |
| Termine, Orte, Wege | neu nötig | `Commitment`, `Place`, `Leg` in `LocalData`, Kalender-Events bleiben getrennt |
| Einmalige Weckzeit | für v4 erweitern | `wakeOverrides` im bestehenden Wecker-Spiegel |
| Live-Verkehr, Geofencing | technisch begrenzt, optional | nicht umgesetzt, siehe unten |

### Stand

| Schritt | Status |
|---|---|
| A1 Heute anders, Undo, Änderungsliste | automatisch getestet (Vitest, E2E) |
| A2 Grund nie Pflicht, abschaltbar, Text erst nach Vorschau | implementiert, Vorschau per E2E getestet |
| A3 Neutrale Zustände, faires Spiel | automatisch getestet |
| A4 Soziale Termine, offene Rückkehr, stille Freizeit | automatisch getestet |
| A5 Tageszustände, Reihenfolge, Zurück zum Plan | automatisch getestet |
| B1 Wege ohne Umweg, B2 Kundentermin, „Nur morgen“ | automatisch getestet |
| B2 Gespeicherte Orte verwalten, Packlisten-Vorlagen | teilweise: Datenmodell und Planer fertig, **noch keine Eingabemaske** |
| B3 Stufe 1: Schätzung und Maps-Link | automatisch getestet |
| B3 Stufe 2: Live-Verkehr | **offen, braucht deine Entscheidung** (Google Routes ist kostenpflichtig, Key darf nicht ins APK) |
| C1–C3 Rückwärtsplanung, Schlafhinweis, einmaliger Wecker | automatisch getestet, Wecker am Gerät **offen** |
| C4 Länger wach, Freizeit ohne Pings | automatisch getestet |
| C4 Eine einzelne selbst gesetzte Erinnerung am Abend | offen |
| C5 Dusch-Regel und „für morgen schon erledigt“ | automatisch getestet |
| D1 Wetter, D2 Packliste im Termin | Logik getestet, Abfrageformat einmal live geprüft, Datenanzeige nicht E2E-getestet |
| E1 Bin los, Angekommen, Bin wieder da | implementiert |
| E2 Geofencing | **offen**, bewusst nicht ohne Gerätetest und Berechtigungsentscheidung |
| F2 Rückkehr-Abfrage, F3 Homeoffice-Vorlage, F4 eigene Puffer | implementiert |
| F1 Zielkompass aus eigenen Zielen, F3 einmalige Erinnerung, F6 „Nicht vergessen“ | offen |
| Durchgängig nur Gerät | **offen** |

## v5: Gleitzeit und Kundenarbeit

Eigenständiges Zusatzpaket. Regeln und Rechenwege: [GLEITZEIT.md](GLEITZEIT.md). Annahmen werden nicht geraten: Freitags-Soll, Wochenstunden, Vergütung und Betriebsregeln trägst du selbst ein oder sie bleiben offen.

### Delta gegen den Stand von v4

| Anforderung | Einordnung | Umsetzung |
|---|---|---|
| Wunsch-Beginn, Netto-Soll und Pause je Wochentag | schon vorhanden | `WorkDay.start`, `durationMin` (war schon netto), `pauseMin`. Keine zweite Tabelle |
| Spätester Beginn | neu | `settings.flex.latestStart`, Vorgabe 09:00 aus deinem Auftrag |
| Tagesabweichung | erweitern | `DayOverride` um `workStart`, `targetNetMin`, `pauseMin`, läuft über `adjustDay` |
| Geplante Einsätze | erweitern | `Commitment` um `workKind`, kein zweites Terminmodell |
| Ist-Zeiten | neu | `LocalData.workSessions`, lokal und ohne Sync, getrennt vom Plan |
| Prognose Feierabend | neu | `src/core/worktime.ts`, vom Planer genutzt |
| Hinweise zu Pause, Ruhezeit, Sonntag | neu | reine Informationen, abschaltbar, keine Rechtsauskunft |
| Losgehen-Meldung im Homeoffice, Ziel „Pünktlich los“ im Homeoffice | Fehler aus 1.0, behoben | `plan.leave` bleibt im Homeoffice leer |
| Heute anders, Termine, Wecker-Vorschlag, Nachrichtenentwurf | wiederverwendet | gleiche Abläufe, keine zweite Override-Engine |
| Neue Berechtigungen, APIs, nativer Code | nicht nötig | keine |

### Stand

| Schritt | Status |
|---|---|
| Rechenkern, Szenarien A bis L | automatisch getestet (Vitest) |
| Planer, nächste Aktion, Erinnerungen, Hinweise | automatisch getestet (Vitest) |
| Start, Pause, Feierabend, Nachtragen, Sonntagseinsatz, Später anfangen | automatisch getestet (E2E), im Browser angesehen |
| Einstellungen, Arbeitszeit-Seite | E2E und im Browser angesehen, nicht jeder Korrekturweg einzeln |
| Abgleich mit deinem Arbeitgeber-Stempel, Feiertage, Bezahlregeln | bewusst nicht umgesetzt |
| Packlisten und feste Orte für Einsätze | offen, gleiche Lücke wie in v4 |
| Am Gerät | **offen**, Punkte 41 bis 46 in [GERAETETEST.md](GERAETETEST.md) |

## Nächster Schritt

APK aufs Handy, Abschnitt „Wecker“ aus [GERAETETEST.md](GERAETETEST.md) durchgehen. Fehler dort haben Vorrang vor allem Weiteren.
