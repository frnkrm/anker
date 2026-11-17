# Entwicklungsstand nach dem aktuellen Codeabgleich

Aktuelle Fortsetzung17.11.: [Gerätebelege, kostenlose Schnittstellen und Code18-Auslieferung](ABNAHME_GRATIS_PLAY_20261117.md). PR14 integriert; neue Releasepolicy in Prüfung. Historische Stände darunter bleiben als Verlauf erhalten.

## Integrationsstand der neuen Alltagsfunktionen (17.11.2026)

Funktionspakete und anschließende gemeinsame UI-Phase sind im Arbeitsbaum
implementiert; der aktuelle differenzierte Stand steht in
[Alltagsumsetzung](ALLTAG_UMSETZUNG_20261117.md). Historische Planstände darunter
sind keine erneuten Aufträge. BF-001 bis BF-005 sowie F-011/F-012/F-015 bis F-018
befinden sich in der abschließenden Integration; echte Geräteabnahmen bleiben
separat offen. F-013/F-014 sind vorbereitet, benötigen aber kostenlose Provider-
Konten/Schlüssel. Code18-Releasebindung und installierte Code17-App unverändert.

Verbindlich für die weitere Bearbeitung: [Effizient und autonom arbeiten](ARBEITSWEISE.md). UI-Anpassungen gesammelt zum Schluss, nach Funktionslogik und Datenmodell.

## Aktuelle offene Punkte – Kurzfassung vom 17.11.2026

Diese Zusammenfassung berücksichtigt die neueren Beobachtungen aus dem aktuellen
Chat. Die datierten Einträge weiter unten bleiben historische Nachweise;
bereits integrierte Fixes sind keine erneut offenen Implementierungen.

- **BF-001:** Jetzt-Anzeige: Countdownbezug, nächste Handlung, doppelte Angaben und Punkteanzeige klären.
- **BF-002:** Offenen Unterwegs-Zustand außerhalb der App sichtbar halten und an die bewusste Rückkehrbestätigung erinnern.
- **BF-003:** Aufklappbare Bereiche mit eindeutigem Anfang, Inhalt und Ende gestalten.
- **BF-004:** KI-/Verkehrseinrichtung: Nutzen, Sperrgrund und passende nächste Schritte verständlich erklären.
- **BF-005:** „Heute anpassen“ nach täglichen Änderungen und verständlichen Themen strukturieren.
- **F-011:** Freiwillige Hobby-Vorschläge für tatsächlich freie Zeit; Einrichtung und Auswahl siehe unten.
- **F-012:** PC-Begleiter minimalistisch und ansprechend gestalten; Dialoge direkt über dem Hauptfenster öffnen.
- **F-013:** Kostenlose Hilfe zum Zerlegen von Aufgaben; lokale Grundfunktion erhalten, geeigneten KI-Anbieterweg ergänzen.
- **F-014:** Kostenlose Fahrzeit-/Verkehrsanbindung mit harten Gratisgrenzen und ehrlichem manuellen Rückweg.
- **F-015:** Nachtmessung auf Jetzt, sofortiger Bettgeh-Start, technisches Signalprotokoll, freiwillige Sperre und täglicher Automatikmodus mit Android-Machbarkeitsprüfung.
- **F-016:** Appweite lokale Suche mit Schlagwörtern und direktem Sprung zur passenden Funktion/Einstellung.
- **F-017:** Lange Funktionserklärungen appweit über ein zugängliches Infosymbol in Hilfefenstern öffnen.
- **F-018:** Geschätzter Schlafbeginn, freiwillige Energie-/Weckrückmeldungen und persönliche Zeitvorschläge aus dem bestehenden Schlafjournal.
- **T-006 / V-014:** Gesamtabschluss und Code18-Play-Update: Build, gültige Uploadsignatur, interne Freigabe und anschließendes Store-Update bestätigen. PR12/PR13 sind inzwischen integriert; der PC-Zeitstempelfix ist am Handy bestätigt. Uploadschlüssel laut Console erst am 18.11.2026 um 22:41 gültig; einmaliger Auftrag am 18.11. um 22:50 eingerichtet, Ausführung noch ausstehend.
- **E-002 / V-011:** Android-Wecker und Erinnerungen im echten Gerätebetrieb vollständig prüfen.
- **E-003 / V-012:** Windows-Begleiter vollständig prüfen, insbesondere Dialoge/DPI/Monitore, Tray, Netzwechsel und bewusst gewählte Systemwirkungen. Erfolgreiche Kopplung allein ist kein Gesamtabschluss.
- **E-004 / V-013:** Kalenderzugriff, Auswahl, Widerruf und echte Datenquellen am Handy prüfen.
- **E-005:** Optionalen NFC-Betrieb mit geeigneten Tags am Gerät prüfen.

F-001 bis F-010 gelten laut vorhandener Roadmap im jeweils dokumentierten
Softwareumfang als umgesetzt. Offene Geräteabnahmen stehen oben; sie sind keine
erneuten Implementierungsaufträge. Lichtwecker-Hardware, soziale Fokusbegleitung
und kostenpflichtige Windows-Codesignatur sind spätere Optionen beziehungsweise
Entscheidungen, aktuell keine beauftragte Implementierung.

## Aktuelle Umsetzung (17.11.2026)

Vom Nutzer jetzt ausdrücklich gestartet. Erstes Logikpaket BF-001/BF-002 umgesetzt:
kein erneuter Aufstehanker nach bestätigtem frühem Aufstehen; optionaler, einmaliger
und befristeter Unterwegs-Status-Check über bestehende TS-/Android-Erinnerungswege.
162 gezielte TS-/41 Android-Unit-Tests grün. Beide Punkte bleiben bis zur gemeinsamen
UI-Phase und echten Abnahme offen; neue Erinnerungswahl zunächst ausgeschaltet.
Nächste Funktionspakete: F-011 Hobbydaten/Auswahl, F-016 Suchkatalog; danach
Nachtmessungs-/Journalgrundlagen gemäß Abhängigkeiten. Keine neue UI vor Abschluss
der Funktionspakete, kein vorzeitiger Release. Details im Bugfix- und Testnachweis.

## Ausführungsreihenfolge für neue Entwicklungen

Verbindlich gemäß [Arbeitsweise](ARBEITSWEISE.md): zunächst Funktionsregeln,
Datenmodell, Logik, native Dienste und Integrationen für die jeweils beauftragten
Punkte stabilisieren. Danach eine gemeinsame UI-Phase für BF-001/BF-003/BF-004/
BF-005, F-012/F-016/F-017 sowie sämtliche Bedienelemente der neuen Funktionen.
BF-002 und F-011/F-013/F-014/F-015/F-018 bereiten zuerst ihre Regeln/Schnittstellen
vor, ihre Oberflächen kommen ebenfalls in diese letzte UI-Phase. F-016 kann den
Suchkatalog/die Rangfolge vorher vorbereiten. Keine neue Funktion ohne abschließende
UI-/E2E-/Geräteabnahme ausliefern. Diese Planung startet nicht automatisch die Umsetzung.

## F-011 – Hobbys einrichten und freie Zeit freundlich anbieten

**Status:** Implementiert und lokal automatisch geprüft; echte Abnahme offen. Nutzerwunsch vom 17.11.2026, Beispiel Fotografie.
Einordnung: neue freiwillige Produktfunktion. Integration über bestehenden Planer,
Jetzt-Projektion und Store; keine zweite Freizeitplanung.

**Einrichtung:** Unter „Mehr“ einen schlanken Bereich „Hobbys“ vorsehen. Zum Anlegen
genügt ein Name; optionale Vorlagen wie Fotografieren sind bearbeitbar. Danach
freiwillig konkrete kleine Aktivitäten mit geschätzter Gesamtdauer, Energiebedarf,
passendem Kontext (drinnen/draußen) und benötigten Dingen ergänzen. Optionale
Angaben nicht als Pflichtfragebogen gestalten. Dauer umfasst nötige Vorbereitung;
Wege nicht automatisch erfinden. Hobbys/Varianten lassen sich pausieren und bearbeiten.

**Beispiele für Fotografie:** „Ein Motiv mit dem Handy fotografieren“ (5 Minuten),
„Licht und Schatten ausprobieren“ (15 Minuten), „Eine kleine Fotorunde“ (30 Minuten).
Das sind bearbeitbare Startvorschläge, keine festgelegten Nutzerzeiten oder Aufgaben.

**Anzeige und Auswahl:** Neben dem normalen Jetzt-Inhalt eine dezente nachgeordnete
Karte, etwa „Lust auf 5 Minuten Fotografieren?“. Höchstens ein Vorschlag gleichzeitig,
mit „Andere Idee“ und „Heute nicht“. „Einfach Pause machen“ bleibt gleichwertig.
Die aktuelle Hauptaktion bleibt erkennbar, die App wechselt nicht selbst die Seite.
Nur bei einem aus vorhandenen Daten plausibel freien Zeitfenster vorschlagen:
keine laufende Arbeit/Routine, kein offener Unterwegs-Zustand, kein anstehender
Pflichtschritt, Alarm oder Schlaf-/Nachtzustand. Bekannte Vorbereitung/Puffer vor
dem nächsten festen Planpunkt berücksichtigen. Bei unklarer Verfügbarkeit keine
sichere Zeitspanne behaupten. Vorschläge nicht bei jeder Aktualisierung wechseln.

**Grenzen:** Keine Hobby-Pflicht, Streaks oder Schuldtexte; keine automatische
Erledigung oder XP durch Vorschlag/Start/Timerende. Kein automatischer Kalendereintrag,
Verschieben von Verpflichtungen oder Freizeit-Timerzwang. Grundfunktion offline,
keine KI-Aufrufe, Kamera-/Foto-/Standortrechte oder Cloudübertragung zum bloßen
Einrichten nötig. Speicherung über vorhandene Store-/Repositorywege; Datenschutz,
Backup und optionale Synchronisation vor neuen Datenfeldern ausdrücklich festlegen.

**Abnahme:** Ein Hobby nur mit Namen anlegen; eigene Varianten bearbeiten/pausieren;
passende Dauer/Kontext/Energie berücksichtigen, ohne Unbekanntes zu erraten; freiwillige
Abwahl respektieren; kein Vorschlag in gesperrten Zuständen; Freiraum und harte Termine
aus demselben Plan berechnen. Offline sowie bei 320px/großer Schrift prüfen.
Reine Auswahlregel gezielt testen, dann UI; noch keine Umsetzung oder Produktprüfung.

**Recherche, 17.11.2026:**

- [GTD: Choosing what to do](https://gettingthingsdone.com/2023/01/choosing-what-to-do/)
  beschreibt Auswahl nach verfügbarem Kontext, Zeit und Energie. Daraus leiten wir
  optionale Auswahlfelder für passende Hobbyvarianten ab, keinen Wirksamkeitsnachweis.
- [Daylio: Ziele aus Aktivitäten](https://daylio.net/faq/docs/daylio-faq/tutorials/setting-up-goals/)
  zeigt eigene Aktivitäten sowie getrennte Wiederholungs-/Erinnerungseinstellungen.
  Anker übernimmt die einfache eigene Einrichtung; feste Ziele/Streaks sind dafür
  nicht erforderlich. Das ist unsere Produktentscheidung.
- [Bearable: Konfiguration](https://bearable.app/support/howto/configure-and-enter-data-into-bearable/)
  beschreibt anpassbare und abschaltbare Bereiche. Für Anker spricht das für ein
  bewusst eingerichtetes, pausierbares Angebot statt zusätzlicher Pflichtverwaltung.

## F-012 – PC-Begleiter: ruhige Gestaltung und zugehörige Dialogfenster

**Status:** Implementiert; Windows-Lauf/Geometrie geprüft, visuelle Abnahme offen. Nutzerwunsch vom 17.11.2026: minimalistisch, aber
ansehnlicher. Separate Fenster nach Buttonklick bleiben; sie sollen direkt über
dem Hauptfenster erscheinen. Der optische Gesamtwunsch ist eine Weiterentwicklung;
fehlerhafte Dialogzuordnung/-positionierung wird in diesem Paket mit korrigiert.

**Umfang:** Einheitliche Schrift, bewusste Abstände, dezente Flächen/Umrandungen,
klare Statusanzeige und eine erkennbare Hauptaktion statt einer gleichgewichteten
Buttonwand. Bestehende Funktionen und freiwillige Systemwirkungen erhalten.
Bestehendes Python-/Tk-UI verbessern, kein Frameworkwechsel oder Komplettneubau.

**Dialogverhalten:** Beim Öffnen zum tatsächlichen aktuellen Hauptfenster zentrieren,
über diesem Fenster anzeigen und ihm zuordnen; kein globales Always-on-top.
Auf demselben Monitor und vollständig in dessen nutzbarem Bildschirmbereich halten.
Lange/große Dialoge begrenzen und bei Bedarf scrollbar machen. Fokus beim Öffnen
passend setzen und beim Schließen zurückgeben. Modale Sperre nur dort, wo der
Vorgang sie braucht; Beenden/Abbrechen muss zuverlässig erreichbar bleiben.

**Abnahme:** Hauptfenster verschieben und erneut Dialog öffnen; gleicher Monitor
auch bei negativen Monitorpositionen; gemischte DPI und große Schrift; kleine
Bildschirme/Taskleiste; Hauptfenster minimiert oder per Tray wieder geöffnet;
Dialog bleibt sichtbar und bedienbar, keine verlorenen Fenster oder abgeschnittenen
Bestätigungen. Helle/dunkle Darstellung, Tastatur, Escape/Abbrechen und bestehende
Bestätigungsgrenzen prüfen. Geometrie soweit sinnvoll rein testen, tatsächliche
Position/Fokus/Skalierung anschließend unter Windows beobachten. Noch keine neue
UI implementiert oder echte Dialogprüfung durchgeführt.

## F-013 – Kostenlose Unterstützung für kleine Aufgabenschritte

**Status:** Kostenloser Adapter und Einrichtung vorbereitet; externe Gratis-Konten/Schlüssel fehlen. Nutzerforderung vom 17.11.2026: keine Anbietergebühren.
Nutzen: Einen bewusst ausgewählten Aufgabentext in bearbeitbare kleine Schritte
zerlegen. Bereits vorhandene lokale Teilschritt-Vorlagen bleiben kostenlos/offline.
Das ist keine frei generierende KI, aber ein unmittelbar nutzbarer Rückweg.

Der bestehende Onlineweg ist OpenAI über Supabase und nicht als garantiert kostenlos
eingerichtet. Kostenfreie Alternativen benötigen eine echte Anbieterintegration;
keinen fremden API-Key in die OpenAI-Konfiguration stecken. Bevorzugte kostenfreie
KI-Variante zunächst auf Machbarkeit prüfen: lokal ausgeführtes Modell über Ollama
auf dem vorhandenen PC. Keine API-Nutzungsgebühr bei lokalem Betrieb, aber Hardware,
Strom und ein laufender/erreichbarer PC werden benötigt. Modelllizenz/Eignung prüfen.
Keine ungeschützte Ollama-Schnittstelle ins LAN/Internet öffnen; vorhandene sichere
PC-Verbindung nur nach Vertrags-/Datengrenzenprüfung erweitern, nicht voraussetzen.

Gemini-Free-Tier als mögliche Onlinealternative prüfen: modell-/konto-/regionabhängige
Gratislimits, aktuelle Datenbedingungen und Verfügbarkeit. Nicht als unbegrenzt oder
dauerhaft gratis garantieren. Ohne aktives Bezahlmodell arbeiten, bei Quotenende
stoppen und lokale Hilfe anbieten, niemals automatisch kostenpflichtig ausweichen.
Serverbetrieb ebenfalls in die Kostenprüfung einbeziehen. Keine Zahlungsdaten,
Tarifupgrades oder neue Konten ohne erforderliche Nutzerhandlung einrichten.

Abnahme: verständliche Einrichtung (BF-004), deutscher kleiner Schrittvorschlag,
Vorschau/Einzelfreigabe vor Versand, keine Pflichtübertragung von Beschreibung/Notiz,
lokale Funktion ohne Server, klarer Fehler bei nicht erreichbarem PC oder erschöpfter
Quote. Keine automatische Übernahme/Erledigung und keine Dienstschlüssel in App/Logs.
Vorerst keine Bereitstellung oder Aktivierung erfolgt.

Recherche 17.11.2026: [Ollama API](https://docs.ollama.com/api/introduction),
[lokaler Betrieb](https://docs.ollama.com/faq),
[Gemini API-Preise und Free Tier](https://ai.google.dev/gemini-api/docs/pricing).
Die lokale Variante ist eine Planungsempfehlung, noch kein nachgewiesener Anschluss.

## F-014 – Kostenfreie Fahrzeit-/Verkehrsvorschläge

**Status:** Kostenloser Adapter vorbereitet; Aktivierung ohne geprüfte Gratis-Konten/Schlüssel gesperrt. Kostenlose Schnittstelle ausdrücklich gewünscht.
Nutzen: Für eine bewusst freigegebene Strecke eine aktuelle Fahrzeitschätzung
anbieten. Normale Routenschätzung, Live-Verkehr und ÖPNV getrennt ausweisen;
eine kostenlose Routing-API ohne Verkehrsdaten nicht als Stauprognose bezeichnen.

Der bestehende Handler verwendet Google Routes über Supabase. Google Maps Platform
hat Freikontingente, benötigt aber Billing und ist damit kein bedingungslos kostenloser
Weg. Kostenhinweise nicht einfach entfernen und die aktuelle Freigabe nicht ankreuzen.

TomTom als konkreten Kandidaten prüfen: offizielle Preisseite nennt für Routing
20.000 kostenlose monatliche Anfragen und Einstieg ohne Kreditkarte. Die API bietet
verkehrsberücksichtigte Routen. Vor Einrichtung tatsächlichen kostenlosen Kontotarif,
gewählte API, Region, Geocodingbedarf, Nutzungs-/Speicherbedingungen und Verhalten
bei Quotenende verifizieren. Keine automatische Nachzahlung, kein Guthabenkauf,
kein Bezahlfallback. Alte Tageslimits aus Drittanbieterartikeln nicht übernehmen.
Auch Gateway/Server müssen in die Kostenbetrachtung einfließen; App-Zähler allein
sind keine garantierte Kostensperre.

Abnahme: klare schrittweise Einrichtung (BF-004), Schlüssel sicher verwahren,
Start-/Zieladresse nur nach bewusster Freigabe, kein dauerhaftes GPS. Quoten technisch
begrenzen, Abrufe drosseln und Ergebnisse nur im erlaubten Rahmen zwischenspeichern.
Bei Fehler/Gratislimit manuelle Fahrzeit erhalten und Datenalter anzeigen; keine
Pünktlichkeitsgarantie oder automatisch geänderte Weckzeit. Unterstützte Verkehrsmittel
ehrlich ausweisen statt den bisherigen Google-Funktionsumfang zu versprechen.
Noch keine neue Anbindung implementiert oder ein Konto aktiviert.

Recherche 17.11.2026: [TomTom Preise](https://docs.tomtom.com/pricing),
[TomTom Limits/FAQ](https://docs.tomtom.com/platform/documentation/status-and-support/faqs),
[Google Maps Billing/FAQ](https://developers.google.com/maps/faq).

## F-015 – Nachtmessung von Jetzt aus starten und nachvollziehbar machen

**Status:** Implementiert und automatisch geprüft; reale Messnacht/Freigaben noch offen. Nutzerwunsch vom 17.11.2026. Gemeint ist das
experimentelle Aktivitäts-Weckfenster (SmartWake), keine durchgehende Schlafaufnahme.
Vorhanden: `SmartWake.tsx` für Einrichtung/Start und `SmartWakeService.kt` für
Mikrofon-Foreground-Dienst, Beschleunigung und kurzlebige Pegelwerte. Derzeit wird
vor dem eigentlichen Weckfenster nicht ausgewertet; Abendstart und tatsächlicher
Messbeginn sind verschiedene Zustände. Keine Tondateien gespeichert/versendet.
Es gibt aktuelle Phase/Meldung/Zielzeit in Preferences, aber im gelesenen Dienst
kein dauerhaftes Journal der Messsignal-Eingänge. Nicht behaupten, dass deshalb
bisher keine Signale eingingen.

**Jetzt-Einstieg:** Nur bei aktivierter Setup-Option anbieten, bevorzugt im passenden
Abend-/Nachtkontext. Dieselben Start-/Stopp-/Berechtigungswege wiederverwenden;
keine zweite SmartWake-Instanz. „Messung für diese Nacht starten“ und danach
„Bereit – Auswertung ab …“ beziehungsweise „Messung läuft“ ehrlich unterscheiden.
Tatsächlich wirksame Weckzeit einschließlich Tagesüberschreibung verwenden.
Startanfrage ist kein Laufbeleg; Doppelklicks, fehlender Sensor/Mikrofonrecht,
laufende Messung und später geänderte Weckzeit sauber behandeln. Deaktiviertes
Setup entfernt die Startmöglichkeit; laufenden Zustand über bestehenden Weg beenden.

**Technisches Protokoll:** Bestehendes lokales Diagnosejournal erweitern, soweit
passend, statt unbeschränktes neues Log anzulegen. Pro Messnacht Start, Ziel und
Auswertungsfenster, tatsächlichen Beginn, Sensor-/Mikrofonverfügbarkeit, ersten/letzten
gültigen Eingang, aggregierte Anzahl gültiger Bewegungs-/Audioblöcke und Lücken,
Lesefehler, Ablehnungs-/Abbruchgrund und Ergebnis festhalten. Signal vorhanden,
Signal unter Schwelle, kein Eingang und nicht ausgewertet unterscheiden; die Werte
sind keine verlässliche Schlafphasen- oder Wachheitserkennung. Keine Rohsamples,
Tondateien, Transkripte, Appinhalte oder personenbezogenen Umgebungsdaten persistieren.
Begrenzte Aufbewahrung/Größe im vorhandenen Journalrahmen, zusammengefasste Einträge
statt Schreiben pro Sample, Export nur bewusst ausgewählt. Ohne Export kein Sync.

**Start mit Bildschirm sperren:** Gewünschten Ablauf „Messung starten und sperren“
prüfen: zuerst erforderliche Freigaben und tatsächliche Dienstbereitschaft, dann
eine ausdrücklich gewählte Sperre. Abendlicher Nutzerstart soll sperren können;
beim späteren Auswertungsbeginn nicht ungefragt erneut sperren, insbesondere nicht
über einem Wecker. Android-Machbarkeit und erforderliche Rechte zuerst gezielt
prüfen; keine Geräteadministrator-/Bedienungshilferechte still hinzufügen oder
Sperre allein durch eine schwarze Appansicht vortäuschen. Ohne verfügbare Sperrfähigkeit
ehrlicher Hinweis auf die seitliche Sperrtaste, normaler Messstart bleibt möglich.
Sperren bleibt reversibel durch normales Entsperren, kein Blockieren von Hardwaretasten.

**Wichtige Grenze:** Bildschirmsperre garantiert keine Stille: Medien können unter
Android auch bei gesperrtem Gerät weiterlaufen. Eigenen Medienbetrieb soweit zulässig
erkennen und als mögliche Störquelle erklären; eine gezielt erlaubte Pause vorhandener
Wiedergabe erst technisch prüfen, nicht versprechen. Niemals andere Apps zwangsbeenden,
Lautstärke/DND selbst ändern oder sämtliche Fremdgeräusche als ausgeschlossen melden.
Auch ohne hörbaren Handyton können Umgebungsgeräusche Signale beeinflussen.

**Abnahme:** Setup aus/an; Start in Jetzt; verweigertes Recht; Abend-Wartephase und
echter Fensterbeginn; Eingänge unter/über Schwelle und fehlende Eingänge; Mikrofon-
Lesefehler; manueller Stopp; geänderte Zielzeit; Prozess-/Geräteunterbrechung.
Echte Android-Sperre, gesperrtes Display, Medienwiedergabe und normale Entsperrung
separat am Gerät prüfen. Regulärer Hauptwecker bleibt abgesichert; Vorweckerpause
bleibt auf den Zieltermin begrenzt und wird nicht versehentlich wieder eingeschaltet.
Keine Erledigung/XP aus Messung oder Weckerereignis. TS-/Kotlin-Brücke und reine
Status-/Diagnoselogik gemeinsam sinnvoll testen; Geräteeingänge nicht aus Tests ableiten.

Quellen für die Machbarkeitsprüfung:
[Android lockNow](https://developer.android.com/reference/android/app/admin/DevicePolicyManager#lockNow()),
[Android-Hintergrundwiedergabe](https://developer.android.com/media/media3/session/background-playback).
Keine Messung gestartet, Rechte aktiviert oder Gerätewirkung ausgeführt.

### Erweiterung F-015: tägliche Automatik und sofortiger Beginn beim Bettgehen

Nutzerwunsch vom 17.11.2026 erweitert den bisherigen reinen Weckfensterbetrieb:
Eine eigene ausgeschaltete Setup-Option „Jede Nacht automatisch“ soll die Messung
regelmäßig starten. Geplante Start-/Endbedingungen, „Heute nicht“, sichtbarer
Mikrofonstatus und jederzeitiger Stopp müssen Teil der Einrichtung sein; keine
24-Stunden-Überwachung und keine heimliche Mikrofonaktivierung.

Vor einem Versprechen vollautomatischer Starts Android-Machbarkeit am Zielgerät
prüfen: Mikrofon-Foreground-Dienste können wegen While-in-use- und Hintergrundregeln
nicht beliebig aus einer Uhrzeit-/Bootaktion gestartet werden. Der Automatikschalter
ist keine Umgehung solcher Regeln. Ist ein Start im Hintergrund nicht zulässig,
eine ehrliche Startaufforderung anbieten und die verbleibende Nutzeraktion klar
benennen, nicht als laufende Messung ausgeben. Keine neue Sonderberechtigung still
vergeben. Die bereits vorhandene Hauptweckerplanung bleibt unabhängig funktionsfähig.

Bei einem bewussten Bettgeh-Ereignis wie „Ich liege im Bett“ soll die eingerichtete
Messung nach erfolgreicher Freigabe/Dienstbereitschaft **sofort** beginnen, auch vor
dem Weckfenster. Ähnliche Einstiegspunkte fachlich zentral zuordnen: Nur eine echte
bewusste Schlafabsicht, nicht das Öffnen einer Seite, planmäßige Bettzeit oder ein
Infofenster, löst aus. Diese Änderung des bisherigen Dienstverhaltens muss explizit
umgesetzt/getestet werden; ein neuer Button allein reicht nicht.

Eine gemeinsame Nachtinstanz führt zwei getrennte Phasen: abendliche Ruhe-/
Einschlafschätzung (F-018) und morgendliches Aktivitäts-Weckfenster. Abendliche
Signale dürfen keinen frühen Morgenwecker auslösen. Doppelte Starts aus Automatik,
Jetzt und Bettbestätigung zusammenführen; Zeiten/Quelle protokollieren. Erweiterten
Akkuverbrauch und tatsächlichen kontinuierlichen Dienst-/Sensorbetrieb prüfen;
ein zeitlich vorbereitetes Fenster ist keine durchgehende Messung. Alte Aussagen
„vor dem Fenster keine Auswertung“ bleiben Ist-Codebefund, nicht Ziel dieses Zusatzes.

[Android-Startbeschränkungen](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)
sind ein technisches Prüfgate, keine bereits gelöste Voraussetzung.

## F-016 – Suche für Funktionen und Einstellungen

**Status:** Implementiert und automatisch geprüft. Ein gut erreichbarer Suchen-Button öffnet eine
lokale Suche, etwa aus Jetzt/Mehr, ohne die Hauptaktion zu verdrängen. Ein gemeinsamer
Katalog erhält pro tatsächlich vorhandener Funktion einen verständlichen Namen,
passende deutsche Stichwörter/Synonyme, Kurzbeschreibung, Kategorie, Route und bei
Bedarf ein stabiles Abschnittsziel. Beispiele: „Aufstehen/Weckzeit/Wecker“,
„Messung/Nacht/Mikrofon“, „Termin/Heute anders“, „PC/Kopplung“, „Hobbys/Fotografie“
erst nach Umsetzung. Katalog mit bestehenden Routen und Labels abgleichen, keine
Suche durch private Aufgaben/Notizen und keine externen KI-/Suchanfragen.

Exakte Namen zuerst, dann Synonyme/Wortteile; Groß-/Kleinschreibung und Umlaute
handhaben, begrenzte Tippfehlertoleranz gezielt prüfen. Wenige nachvollziehbar
sortierte Treffer mit Kategorie und Kurzbeschreibung statt einer unstrukturierten
Liste. Keine Treffer ehrlich melden. Antippen navigiert wie bei Android zur
passenden Seite, öffnet nötigen Bereich und macht die konkrete Einstellung durch
Scroll-/Fokusziel und dezente Markierung sichtbar. Es ändert keinen Schalter und
startet keine Messung, Anmeldung oder PC-Wirkung. Nicht verfügbare Android-/Online-
Funktionen als solche kennzeichnen; keine toten Verweise auf geplante Funktionen.

Abnahme: Synonyme, Wortteile, Umlaute, Tippfehler und leere/fehlende Treffer; passende
Zielmarkierung bei geschlossenen Bereichen, Zurücknavigation und Tastatur/Screenreader;
Web-/Android-Unterschiede, Offlinebetrieb und große Schrift. Reine Suchrangfolge
gezielt testen und repräsentative Navigation prüfen. Keine Suchhistorie oder
Telemetrie nötig. Bestehende Sheet-Portal-/Historyregeln weiterverwenden.

## F-017 – Erklärungen bei Bedarf im Infofenster statt dauerhaftem Langtext

**Status:** Gemeinsame Info-Komponente und zentrale Erklärungen implementiert; gilt appweit für wiederkehrende Funktionserklärungen,
z.B. den langen Text unter „Deine gewählte Schlafenszeit“ auf Jetzt. Ein benanntes,
gut antippbares Infosymbol bei der jeweiligen Funktion öffnet einen kurzen
verständlichen Hilfedialog mit Zweck, Ablauf und Grenzen. Keine reine Hoverhilfe
oder unbeschriftete Mini-Schaltfläche. Einheitliche Komponente/Struktur im vorhandenen
UI-Kit und Portal-Sheet bevorzugen; vorhandene Texte prüfen und wiederverwenden.

Vor Umsetzung betroffene Erklärtexte gezielt inventarisieren und in überschaubaren
Bereichen umstellen. Aktuelle nächste Handlung, Zeit, laufender Messstatus,
konkreter Fehler/Sperrgrund und notwendige Entscheidung bleiben unmittelbar sichtbar.
Längere allgemeine Erklärungen wandern ins Infofenster. Daten-/Kostenfreigabe vor
Aktivierung/Versand bleibt ausdrücklich; nicht durch ein verstecktes Infofenster
ersetzen. Kein Funktionsstart oder Speichern durch Öffnen/Schließen einer Hilfe.

Abnahme: gleiche Hilfe aufrufbar in Jetzt, Einstellungen und weiteren betroffenen
Seiten; klarer Titel, lesbarer Text und Schließen; Fokus im Dialog und Rückkehr zur
Info-Schaltfläche, Escape/Android-Zurück ohne unerwartete Navigation; mehrere Sheets
und große Schrift/320px. Texte für Messung und Schlafhinweis fachlich nicht mischen.
Info- und Suchfenster gemeinsam mit BF-003/BF-005 abstimmen, ohne eine zweite UI-Lösung.
[WAI-Dialogmuster](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
als Grundlage; bei der Entwicklung gezielt aktuelle Gestaltungsquellen ergänzen.

## F-018 – Schlafjournal, Rückfragen und persönliche Zeitvorschläge

**Status:** Lokales Modell, Auswertung und freiwillige UI implementiert; echte Nachtprüfung und endgültige Skalenabstimmung offen. Nutzerwunsch vom 17.11.2026; abhängig von F-015.
Persönliche Beobachtung und Vorschläge, keine medizinische Diagnose oder automatische
Festsetzung des Schlafbedarfs. Endgültige Ablage, Darstellung, Skalen und Auswertungs-
schwellen ausdrücklich später mit dem Nutzer besprechen. Jetzt nur fachlichen
Vertrag festhalten. Bestehende `LocalData.sleepDiary`-/`sleepNightFor`- und Health-
Übernahmepfade erweitern, kein zweites Schlafjournal und keine Überschreibung eigener
oder bestätigter Einträge durch Heuristiken.

### Abend: Ruhe erkennen und nach Schlafabsicht still rückfragen

- Mit dem tatsächlichen Messbeginn ab Bettbestätigung beobachten, ob es ruhiger
  wird. Pegel-/Bewegungsdaten nur zusammenfassen; keine gespeicherten Tonaufnahmen,
  Sprachinhalte, Fremdappdaten oder Cloudauswertung. Leise Umgebung allein beweist
  keinen Schlaf; Sensorfehler oder fehlender Audioeingang bedeuten nicht „leise“.
- Im ausdrücklich gewählten Modus gelegentlich still „Schläfst du schon?“ nachfragen:
  gewünschte Vollbild-Überlagerung über anderen Apps auf Basis des vorhandenen
  stummen Schlafhinweis-Controllers prüfen. Kein zweiter Overlaybesitzer. Schließen/
  Wegdrücken und „Noch wach“ einfach erreichbar, keine Hardwaretastensperre, keine
  Wiedervorlage unmittelbar nach Abwahl. „Heute Ruhe“ und Gesamt-Aus erhalten.
- Kein Ton, Vibration, automatisches Entsperren oder Displaywecken. Wecker/System-
  Sicherheitsdialoge haben Vorrang. Gesperrtes oder ausgeschaltetes Display nicht
  aufwecken, um eine Schlafvermutung zu testen; die Sperrfunktion aus F-015 und die
  Überlagerung sind unterschiedliche, nicht gleichzeitig erzwingbare Zustände.
- Gewünschte Größenordnung „nach etwa einer Minute ohne Wegdrücken“ als
  **Timeout-Heuristik** aufnehmen. Frist erst ab nachweislich sichtbarer, bedienbarer
  Überlagerung bei interaktivem Display zählen. Geplant/zugestellt ist kein Sichtbeleg.
  Abbruch, verdecktes Fenster, App-/Prozesswechsel oder Display-Aus ergeben keinen
  bestätigten Antwortausfall. Frequenz und Höchstzahl später festlegen; begrenzen,
  damit Rückfragen nicht selbst Schlaf stören.
- Nach gültigem Timeout einen **vermuteten Einschlafzeitpunkt** mit Quelle und
  Unsicherheit vormerken; Beginn der ruhigen Phase, Sichtbeginn und Timeout getrennt
  nachvollziehbar halten. Nicht still als exakte Einschlafzeit, Schlafphase oder
  erfülltes Tagesziel ausgeben. Weitere Rückfragen für diese vermutete Schlafphase
  beenden. Spätere Interaktion kann die Vermutung entkräften. Morgens bestätigbar,
  korrigierbar oder verwerfbar; fehlende Bestätigung bleibt fehlend.

### Morgen: Weckereignisse und subjektive Rückmeldung

- Frühen Aktivitätsalarm, reguläres Klingeln, Schlummern, Stoppen und QR-Scan als
  technische Ereignisse mit Uhrzeit/Quelle auseinanderhalten. Ein QR-Scan belegt
  eine Interaktion zu dieser Zeit, nicht die erste Wachminute oder das Aufstehen.
- Nach dem bewussten Beenden eine kurze überspringbare Frage zur Weckzeit anbieten,
  auch bei regulärem Alarm und nach QR: beispielsweise „Zu früh / passend / zu spät“
  und optional „Wie erholt fühlst du dich?“. Skala später festlegen. Keine Rückfrage,
  die Alarmstoppen/QR blockiert; keine doppelte Frage aus denselben Nacht-/Alarmereignissen.
- Tatsächliche Rückmeldezeit vom bewerteten Weckzeitpunkt und einer vom Nutzer
  bestätigten/korrigierten Wach-/Aufstehzeit trennen. Kein Eintrag „aufgestanden“
  allein aus Alarmende oder QR. Rückmeldung auslassen/nachtragen/löschen erlauben.
- Nacht über vorhandene Nachtzuordnung auch nach 04:00/bei Nachtarbeit stabil
  referenzieren, nicht blind den aktuellen Plantag verwenden. Sommerzeit, Zeitkorrektur,
  mehrere Alarme und verspätetes Feedback gezielt behandeln.

### Tagesenergie und Auswertung

- Vor dem Schlafengehen optional „Wie viel Energie hattest du heute?“ anbieten,
  ausdrücklich überspringbar und nicht Voraussetzung für Messung oder Bettbestätigung.
  Keine fehlende Angabe als schlechte Energie oder mittleren Wert auffüllen.
- Tagesenergie gehört zum vergangenen Wach-Tag und zur **davorliegenden** Nacht;
  nicht zur erst bevorstehenden Nacht. Bei unklarer Zuordnung keine Beziehung erfinden.
- Einschlafschätzung, geschätzte Wachzeit und bestätigte Angaben getrennt halten.
  Bettzeit bis QR-Scan ist keine gemessene Schlafdauer; unbekannte nächtliche
  Wachphasen erlauben höchstens eine entsprechend beschriftete Zeitspanne/Schätzung.
- Zunächst eine nachvollziehbare lokale Tagebuchübersicht. Erst bei ausreichend
  vollständigen, vergleichbaren Nächten vorsichtige Zusammenhänge anbieten, etwa
  „Bei diesen Zeitfenstern hast du häufiger gute Energie gemeldet“. Anzahl/Zeitraum,
  Datenqualität, fehlende Werte und Unsicherheit sichtbar machen. Keine exakte
  „optimale Schlafdauer“ aus einer Handvoll unbestätigter Timeouts berechnen.
- Geplantes Auswertungsverfahren: bestätigte Angaben bevorzugen, unbestätigte
  Schätzungen separat; robuste Zusammenfassungen/Spannen statt Scheingenauigkeit;
  Arbeits-/freie Tage und freiwillig gemeldete Störungen berücksichtigen, ohne neue
  Gesundheitsdaten automatisch zu sammeln. Ausreißer nicht heimlich löschen. Wenige
  vergleichbare Nächte ergeben „noch nicht genug Daten“, keinen erfundenen Vorschlag.
- Mehrwöchige Beobachtung, z.B. ein initiales Zwei-Wochen-Tagebuch, als Entwurfsstart,
  nicht als klinisch validierte Mindestgrenze oder Erfolgsgarantie. Konkrete Schwellen,
  Skalen, Gewichtung, Aufbewahrung und Export erst im späteren Datenmodellschritt klären.
- Vorschläge zu Bett-/Aufstehzeit oder einer auszuprobierenden Zeitspanne nur mit
  Begründung und bewusster Annahme. Keine automatische Änderung von Wecker, Tages-
  Override, Arbeitsbeginn oder hartem Termin; kein absichtliches Verkürzen der
  Schlafzeit für Datensammlung. Ruhe/Pausieren/Abwahl ohne Nachteile ermöglichen.
- Keine Diagnose von Schlafstörungen, keine Aussage, eine bestimmte Zeit mache den
  Nutzer sicher „happy“. Bei eigener anhaltender Beschwerde kann der vorhandene
  Hilfebereich unterstützen; die App ersetzt keine fachliche Schlafdiagnostik.

**Prüfung:** Reine Ereignis-/Nachtzuordnung, ruhige Werte versus fehlende Samples,
sichtbarer versus nur geplanter Timeout, spätere Wachinteraktion, manuelle Korrektur,
übersprungene/doppelte Rückmeldung, Tagesenergie-Zuordnung, kleine/unvollständige
Stichproben und harte Plananker automatisiert prüfen. Android-Mikrofon, Overlay-
Sichtbarkeit, Sperrbildschirm, Medien, Nacht-/Uhrwechsel und Akku separat am Gerät.
Keine neue Implementierung, Messung oder Gesundheitsdatenpersistenz erfolgt.

**Recherche vom 17.11.2026:**
[NHLBI-Schlaftagebuch](https://www.nhlbi.nih.gov/resources/sleep-diary) erfasst
Schlafmenge/-qualität und Befinden am Tag. Das stützt die Tagebuchstruktur, nicht
die Validität einer Mikrofon-/Timeout-Erkennung.
[National Sleep Foundation: Tagebuch](https://www.thensf.org/nsf-sleep-diary/)
nennt zwei Wochen Beobachtung; daraus folgt keine bewiesene Anker-Optimierung.
[AASM-Positionspapier](https://pmc.ncbi.nlm.nih.gov/articles/PMC5940440/) grenzt
nicht hinreichend validierte Consumer-Schlaftechnik von medizinischer Diagnostik ab.
Die konkrete Heuristik und spätere Empfehlung sind eigene Produktentwürfe.

## Geklärt: Tagesüberschreibung der Weckzeit und Code17

Quellvergleich vom 17.11.2026: Die sichtbare „Nächste wirksame Weckzeit“ samt
explizitem Vorrang der Tagesüberschreibung (`NextWake.tsx`/`nextWakeDetails`) wurde
zwischen der freigegebenen Code17-Quelle `80f6a692…` und der Code18-Appquelle
`0c31179…` hinzugefügt. Aktuell in Wecker-/Planungseinstellungen eingebunden.
Die Tagesüberschreibungslogik selbst war schon vorher vorhanden; neue Anzeige und
bereits vorhandene Override-Funktion nicht gleichsetzen. Kein neuer Bugfix nur
wegen der fehlenden Anzeige in Code17. Code18-Quellstand ist kein Beleg einer bereits
erfolgten Play-Veröffentlichung. F-015 verwendet dieselbe wirksame Weckzeit.

## Neue Alltagsmeldungen

Siehe [Bugfix-Plan](BUGFIX_PLAN.md): BF-001 zur unklaren Jetzt-Anzeige und BF-002
zur Erinnerung an einen offenen Unterwegs-Zustand sind offen.
Bestehende Auftrags-IDs und Releasebindungen bleiben erhalten.

## T-006: AAB-Quellkennung nach Capacitor-Sync korrigiert (16.11.2026)

[Konkreter Screenshotbefund, isolierte Reproduktion und kleinster Policyfix](CODE18_FINGERPRINT_SYNC_KORREKTUR_T006.md): Prepare43941667392/W2793dbaa/1 scheiterte laut Nutzerlog mit FINGERPRINT_NATIVE. Die vorhandene Vite-Funktion ergibt für feste App0c31179 vor Sync4f8a7b5a…, nach bestehendem Capacitor-Sync stabilfff132db…; einzig generierte res/xml/config.xml erklärt diese Kennungsabweichung. Bisher fälschlich Vor-Sync-Wert gebunden. Minimaler Policyfix pinnt Nach-Sync-Wert, trennt FINGERPRINT_MISMATCH/NATIVE_MISSING ohne Akzeptanzänderung. App-/Workflow-/Manifest-/Signierquellen und CI-/Versuchs-/Hashgates unverändert.41Protokoll-/Java- und32Workflow-/SDK-Offlinefälle grün; neue unabhängige Nach-Sync-Fixture vorher rot.

Tatsächlicher Runner-ELFbestand/Proof/H2/HP/A bleibt unbekannt, kein erfolgreicher neuer Prepare/AAB/S/HS/Upload/Handybeleg. Geprüften Entwicklungsfix regulär übertragen und dessen neue CI lesen, dann neuer PR/regelgerechte Integration/eigene exakte main-CI nötig. Kein Workflowretry oder Guardlockern, keine neue Promptkette. App0c31179 mit Weckzeitfix/eigener CI43873584133 bleibt fest, bisheriges mainW2793dbaa/eigene CI43939327282 historisch getrennt. T-006/V-014 IN_ARBEIT, E-002–E-005/Geräte/Gesamt offen. Folgende Abschnitte historisch.

## T-006: Weckzeit-Fix regulär in main und eigene main-CI erfolgreich (16.11.2026)

[Fixquelle und AAB-Quellbindung](CODE18_FINALE_QUELLBINDUNG_T006.md): PR10Merged, main **0c31179be780e0bb6359dee79c3502d4e6e8ba4d**, ElternR2/4ca5d08e, Baum vollständig gleich zum geprüften Fix. Eigene **ci.yml43873584133/exakt0c31179/push/main/Versuch1/Success11m 6s**, öffentliche Summary **381 passed (9.5m); 1377 passed; 0 failed; 0 skipped**. Kein Branch-/PR-Ersatz oder Docs-Sonderfall.

Bestehender AAB-Weg jetzt lokal fest an Appquelle0c31179, Quellkennung4f8a7b5a… und Quell-CI43873584133 gebunden; Workflowdefault/App-Checkout/Helper/Fingerprint gemeinsam angepasst. Alle Guards/Trigger/Null-Signier-/SDK-/Sign-/Verify-/Hash-/Versuchsgates unverändert, AST-/YAML-Abgleich;38Protokoll-/Java- und15Workflowfälle grün. Kein Appbuild/Signieren/Workflowstart. Dieser Entwicklungsstand ist noch nicht W-final; reguläre Policyintegration/eigene W-final-main-CI/neuer Prepare/Artefakt/Proof fehlen. Alte ReferenzU1/P5 nicht als Fixbundle ausgeben. B4-/API-/Playzugänge weiter tatsächliche Blocker, Code18 unverändert/Playbestand unbekannt/kein stillerCode19; T-006/V-014 IN_ARBEIT/E-002–E-005/Geräte/Gesamt offen. Autonome Arbeitsfreigabe gilt weiter, keine neue Promptkette. Folgende Abschnitte historisch.

## T-006: autonome Fortsetzung, Weckzeitkorrektur auf aktueller isolierter Basis (16.11.2026)

[Autonomer Weckzeit-/Releasestand](CODE18_AUTONOME_FORTSETZUNG_T006.md): Nutzer meldet Herkunftsreferenz „unbekannt“ und erlaubt die selbstständige Fortsetzung ohne wiederholte Einzelprompts. Alter gemeldeter uncommitteter Weckzeit-Diff hier nicht vorhanden; beschriebene Korrektur deshalb gezielt auf isoliertem mainR2 neu umgesetzt. Effektive Weckzeit/Tagespriorität sichtbar, bewusst ändern/entfernen, Standardänderung erhält Override; Smart-Wake-Vorschau aus aktueller Konfiguration.35gezielteVitest/6Chromiumfälle, Typecheck/Webbuild/Lint0Fehler/1bestehendeWarnung grün. Kein nativer Quellenwechsel, kein Gerätebeleg.

Git-Refs/Clone erreichbar; GitHub-API und Google-Play-API CONNECT403. Keine lokal gefundene passende Schlüsselsicherung oder nutzbare Google-Identität belegt, kein Ersatzkey/Reset. Geprüften Entwicklungsstand/CI vom späteren main-Fixquellcommit und neuer Policy-/Prepare-/Signier-/Uploadbindung trennen. M/P5 ohne Fix erfüllt Update nicht. Code18/rc4 unverändert, Playbestand unbekannt/kein stillerCode19. T-006/V-014 IN_ARBEIT/E-002–E-005/Geräte/Gesamt offen. Weitere Ausführung im erteilten Umfang selbstständig, vorhandene Server-/Quell-/CI-/Signiergates erhalten; folgende Abschnitte historisch.

## T-001: Wiederaufnahme des Readback-Fixes (15.11.2026)

Direkter Wiederaufnahmeauftrag: ausschließlich fehlenden Reihenfolgevergleich rekonstruieren und Abschluss sichern. [Geprüfter Umfang und historische Grenzen](UPDATE_CODE17.md), [Quellenbindung](ANKER_CODE17_NACHWEIS.json). 77 Upload-/24 Auth-/35 Workflowmethoden aktuell grün; keine neue App-/Play-/Gerätefreigabe. Neuere T-006-Arbeit unverändert. Historische Pausierung unten bleibt als damaliger Stand erhalten.

## T-006: lokale Prepare-SDK-Auflösung geprüft, Remoteabnahme offen (15.11.2026)

[Lokale Prepare-sdkmanager-Korrektur und Offlinebelege](PREPARE_SDK_AUFLOESUNG_T006.md): Nur Prepare-run-Block und Offlinefälle ergänzt; Rot127 vor Fix, 17SDK/14Workflow/7Protokoll grün. Keine Installation/echte SDK-Ausführung oder Übertragung. J nur lokal, nicht W2/CI-head. Tatsächlicher Runnerbestand sowie U2/S offen. Genau nächster separat zu beauftragender Auftrag: J einmalig auf Entwicklung pushen und bestehende automatische CI lesen, vorher frische Zielrefs/Quellen/Trigger prüfen. T-006/V-014 IN_ARBEIT, E-002–E-005/Freigaben offen; folgende Abschnitte historisch.

## T-006: P2-Detailfehler zugeordnet, lokale SDK-Auflösung noch offen (15.11.2026)

[P2-SDK-Detailfehler und begrenzter Folgeplan](P2_SDK_DETAILFEHLER_T006.md): Nutzerscreenshot belegt `sdkmanager: command not found`/Exit127 im vorhandenen P2; tatsächliche Installation/PATH-Ursache offen. Kein Fix/Neulauf. Genau nächster separater Auftrag: nur lokalen Prepare-Auflösungsfehler minimal absichern und Offlinefälle mit künstlicher Runnerumgebung prüfen; keine Installation/Übertragung/Workflowausführung. D4 nur lokale Dokumentation, T-006/V-014 IN_ARBEIT; E-002–E-005/Freigaben und U2/H2/HP/A/S offen. Folgende Abschnitte historisch.

## T-006: P2-Resolve grün, Prepare-SDK-Detailfehler offen (15.11.2026)

[Neuer W2-prepare-Lauf und belegter SDK-Abbruch](CODE18_PREPARE_W2_NACHKONTROLLE_T006.md): Neuer P2/Versuch1Failure im Prepare-SDK-Schritt/Exit127, vorher ResolveSuccess. Genaues Detail hinter Sign in to view logs/APIForbidden, keine Artefakte/U2/S. Nur dokumentiert, keine Korrektur oder Wiederholung; nächster eigener Auftrag vorhandene Fehlerzeilen lesend beschaffen/zuordnen. D3 nur lokal, T-006/V-014 IN_ARBEIT,E-002–E-005/Freigaben offen; folgende Abschnitte historisch.

## T-006: PR4Merged und W2-main-CI grün, prepare separat offen (15.11.2026)

[PR4-Merge und eigene W2-main-CI](PR4_MAIN_CI_NACHKONTROLLE.md): Tatsächliches mainW2=87c83fed, reguläre ElternW/K, EntwicklungK erhalten. Neue eigene ci.yml43676620317/W2/push/main/Versuch1Success; M-Quell-Gate separat gelesen. Main-Integration im belegten Umfang abgeschlossen, kein prepare/sign/U2/S. D2 nur lokal, T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag separat einmaliger secretfreier prepare-Lauf M/W2; folgende Abschnitte historisch.

## T-006: PR4-main-Plan erstellt, Integration separat offen (15.11.2026)

[Konkreter PR4-main-Integrationsplan](PR4_MAIN_INTEGRATION_PLAN.md): PR4Open/K→mainW, bestehende Push-/PR-CI grün. Konkreter regulärer Integrationsweg und spätere W2-main-CI geplant; noch kein Merge/Workflowstart/U2/S. Öffentliche Schutz-/Konflikt-/Runtimegrenzen erhalten. R nur lokaler Abschluss. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen; nächster eigener Auftrag reguläre PR4-Integration nur nach separater Freigabe einschließlich unveränderter main-Automatik. Folgende Abschnitte historisch.

## T-006: PR4 Open und PR-CI grün, main-Planung offen (15.11.2026)

[Regulärer Schemafix-PR4 und neue PR-CI](SCHEMAFIX_PR4_T006.md): PR4/K→mainW erstellt; eigene PR-CI43666843700 und K-Push-CI43664473155 jeweils Success/Versuch1. Kein Merge oder manueller AAB-Aufruf. Runtime-/Schutz-/Konfliktgrenzen ausdrücklich erhalten; nächster eigener Auftrag ausschließlich lesende konkrete PR4-main-Integrationsvorlage. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen; Q nur lokal. Folgende Abschnitte historisch.

## T-006: K übertragen und Branch-CI grün, neuer PR noch zu erstellen (15.11.2026)

[Schemafix-Push und neue CI-Nachkontrolle](CODE18_SCHEMAFIX_BRANCH_PUSH_T006.md): Entwicklung=K, main=W nach einmaligem Push aktuell bestätigt. CI43664473155/K/push/Entwicklung/Versuch1 erfolgreich; 1372 Vitest/379 Browser laut Summary. Kein offener PR vorhanden, keiner erstellt; nächster eigener Auftrag regulären PR K→main/W erstellen, ohne Merge. K nicht main-Workflowquelle, kein prepare/sign/U2/S. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Folgende Abschnitte historisch.

## T-006: lokaler Prepare-Schemafix grün, Remoteprüfung offen (15.11.2026)

[Lokale Eingabeschema-Korrektur und Offlinebelege](CODE18_INPUTSCHEMA_KORREKTUR_T006.md): Optionale Prepare-Defaults nach Rotbeleg minimal korrigiert; 35 Protokoll- und fünf gezielte Workflow-Grenztests lokal grün. Tatsächliche Eingabeform des fehlgeschlagenen P bleibt unbekannt. K nur lokal, kein neuer Remote-CI-/Workflow-/U2-/Signiernachweis. Nächster eigener Auftrag ausschließlich begrenzter Entwicklungsbranch-Push und CI-Nachkontrolle nach neuer Ref-/Triggerprüfung. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen; folgende Abschnitte historisch.

## T-006: Resolve-Detailfehler bekannt, lokaler Schemafolgeplan offen (15.11.2026)

[Resolve-Schema-Befund und begrenzter Folgeplan](CODE18_RESOLVE_SCHEMA_BEFUND_T006.md): `INVALID_SCHEMA` ist dem Eingangsschema in `invocation()`/Zeile 111 vor den CI-Abfragen zugeordnet. Der Screenshot zeigt keine Runtime-Schlüsselmenge. Gezielte lokale Vertrags-/Offlineprüfung und ausschließlich ein belegter Minimalfix bilden den nächsten eigenen Auftrag. Heute keine Korrektur, Tests oder Workflowwiederholung. P bleibt fehlgeschlagen; U2/S fehlen. T-006/V-014 bleiben IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Die folgenden Abschnitte beschreiben historische Stände.

## T-006: prepare in resolve rot, Detailfehler fehlt (14.11.2026)

[Erster prepare-Lauf und Abbruchbeleg](CODE18_PREPARE_NACHKONTROLLE_T006.md): P43637658561 / workflow_dispatch / main / WorkflowW741fb7b / Versuch1 **Failure nach9s**. Resolvefailed im Schritt „Exakte getrennte main-CI für M und W prüfen“,prepare/sign/verifyskipped;keine Artefakte/U2/H2/HP/A/S. KonkreterBlocker fehlenderDetailfehler hinterJoblog-Anmeldung,nichtunbelegteRootcause. Bestehende W/M-main-CI grün erhalten. Genau nächster eigenerAuftrag vorhandenenP-Resolvefehler lesend einholen/zuordnen,keinFix/Neustart/Signieren. T-006/V-014 IN_ARBEIT,E-002–E-005/Freigabenoffen.

## T-006: PR3Merged, Paket-/Geräteabschluss weiter offen (14.11.2026)

[PR3-Merge und neue exakte main-CI](PR3_MAIN_CI_NACHKONTROLLE.md): PR3Merged, tatsächlichesW `741fb7b09f0a442d779aaed192bd223724d3523f` mit ElternM/L und EntwicklungsheadL erhalten. Neue ci.yml43622275785 / exaktW / push / main / Versuch1 **erfolgreich**. Öffentliche Summary: 1372 Vitest bestanden / 0 Fehler / 0 Skips; 379 Playwright bestanden (9.4m). WorkflowquelleW jetzt konkret,AppquelleM/U1 getrennt erhalten; W lokal nicht beschafft. U2/S/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. T-006/V-014 IN_ARBEIT,E-002–E-005 OFFEN. Genau nächster eigener Auftrag einmaligen secretfreien prepare-Prüflauf aus M mit Workflow W starten und U2-Nachweise nachkontrollieren.

## T-006: PR3-Integrationsvorlage bereit, Merge weiter offen (14.11.2026)

[Neue PR3-main-Integrationsvorlage](PR3_MAIN_INTEGRATION_PLAN.md): PR3Open/L→mainM, vorhandene Push-/PR-CI weiterhin grün,Diff-/Triggerabgleich konkret. Keine neue Freigabe: normaler Merge-Commit/eigene main-W-CI und mögliche bestehende main-Webautomatik erst separat autorisieren. Weitere AAB-Dispatch-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen,unbekannte Schutz-/Review-/Runtime-SHA-Belege erhalten. T-006/V-014 IN_ARBEIT,E-002–E-005 OFFEN. Genau nächster eigener Auftrag regulärePR3-main-Integration samt automatischerCI-Nachkontrolle,kein prepare/sign.

## T-006: AAB-Entwurf in PR3, Integration weiter offen (14.11.2026)

[PR3 und CI-Nachkontrolle](AAB_ENTWURF_PR3_T006.md): PR3Open/QuelleL/mainM, neuer PR-Lauf43616437865 Versuch1 **erfolgreich**. Kein Merge/W/AAB-Dispatch/Signieren. Fehlende Review-/Konflikt-/klassischeSchutz-/Runtime-SHA-Belege ehrlich offen. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag PR3-main-Integration ausschließlich lesend konkret vorbereiten.

## T-006: AAB-Entwurf remote, Integration weiter offen (14.11.2026)

[Push-/CI-Nachkontrolle](AAB_ENTWURF_BRANCH_PUSH_T006.md): Entwicklung jetzt L3f5345dd, main weiter M10cc894a; CI43614039702 / push / exakt L / Versuch1 **erfolgreich**. Kein neuer PR/Merge/AAB-Dispatch oder Signieren. Genau nächster separat beauftragbarer Schritt: neuen regulären PR für den AAB-Workflowentwurf vorbereiten und erstellen, ohne Merge. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen; lokale43Offlinefälle und U1 bleiben getrennte Nachweise.

## T-006: AAB-Entwurf lokal geprüft, Remoteintegration offen (14.11.2026)

[EntwurfStufeA](CODE18_AAB_WORKFLOW_ENTWURF.md): manuellerprepare/sign-Weg/striktePrüfhelfer/gezielteCI-Einbindung lokal fertig,43Offlinefällegrün. Keine echteSignierung/Runnerausführung,Actionlintfehlend;U1unverändert,Mfest,W/U2/Snichtbelegt. T-006/V-014 IN_ARBEIT,E-002–E-005/Gesamtfreigaben offen. Genau nächster eigenerAuftrag begrenzter Entwicklungsbranch-PushL mit frischemRef-/Triggerabgleich/erlaubterautomatischerCI-Nachkontrolle,separateFreigabe nötig. Kein main-/Workflowstart-/Signier-/Uploadauftrag.

## T-006: AAB-Signierweg konkret geplant, noch nicht implementiert (14.11.2026)

[Plan mit getrennten Freigaben](CODE18_AAB_SIGNIERWEG_PLAN.md): manueller prepare/sign-Entwurf,exakte M-/W-/CI-/U2-/S-Zuordnung,B4/8A-Rollen,Fail-closed-Prüfung und unberührte Code17-Grenzen konkret. Nur lokale Dokumentation,keine externe Abfrage/Tests/Build/Signierung/Workflowänderung. T-006/V-014 IN_ARBEIT,E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag lokale AAB-Workflow-/Prüfhelferentwurfsimplementierung mit Offlineprüfungen/CI-Einbindung,keine Remote-/Signieraktion.

## T-006: korrigiertes M-AAB lokal unsigniert geprüft (14.11.2026)

[Neuer M-Paketnachweis](MAIN_CODE18_AAB_PRUEFBUILD_T006.md): QuelleM10cc894/e9c124…,Code18rc4,54264632Bytes/SHA25674e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50,unsigned/Bundletool/ZIP/JAR/Assets/Manifest/SDK/ELF grün. Nur bestehende Mavenbibliotheksversionen nachgeladen,keine Tools/Projektversionen aktualisiert. Alte Arbeitsbäume/Sicherungen erhalten,kein Push/Signieren/Installieren/Play-/Workflow-/Cloudschreiben. T-006/V-014 IN_ARBEIT,E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag ausschließlich lesenden konkreten Code18-AAB-Signierwegplan erstellen,keine Schlüssel-/Secret-/bekannten Metadatenfragen. Historisches014-AAB bleibt vorFix/nicht wiederhergestellt.

## T-006: NFC-CI-Lücke lokal geschlossen, Remoteprüfung offen (14.11.2026)

[NFC-CI-Korrektur mit Rot-/Grünnachweis](NFC_CI_KORREKTUR_T006.md): deterministischer Rot-/Grünfall belegt Navigation vor React-Unmount; minimaler Routereintragsguard/einRegressionstest,18Browser/31TS/Lint/Typecheck/Webbuild grün. Keine neue Remote-CI oder aktueller korrigierter Paketbuild. AltesAAB014870f3 historisch vorFix; Geräteabnahmen unverändert offen. T-006/V-014 IN_ARBEIT. Nächster eigener Auftrag korrigierten Abschlusscommit begrenzt auf Entwicklungsbranch pushen/neue automatischeCI lesend nachkontrollieren, nur nach separater ausdrücklicher Freigabe. Jetzt nur lokaler Abschluss, keine erneuten Metadatenfragen.

## T-006: Entwicklung H auf GitHub, Gesamtfreigabe offen (14.11.2026)

[Push und neue CI-Nachkontrolle](GITHUB_BRANCH_PUSH_CODE18.md): einmaliger erlaubter Fast-forward-Push auf H1847c8a, Entwicklung/PR2-head H/main e48d289 unverändert. PR2 Open via GitHub-HTML bestätigt, neue Push-/PR-CI-Läufe43549032956/43549036157 im Bericht. API gesperrt, Webmetadaten lesbar; keine erneute Nutzer-/Secretfrage nötig. Lokales AAB weiter Quelle014870f3, keine main-/Signier-/Upload-/Gerätefreigabe. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamtfreigaben offen. Abschluss nur lokal committen/sichern, kein zweiter Push; Neuer Push-NFC-Fall rot(PR-CIgrün),e2e/nfc.spec.ts:158:22; nächster eigener Auftrag gezielte lokale Untersuchung/minimale belegte Korrektur, keine Remoteaktion. Frühere Pushvorlagen sind historisch und keine Wiederholungsfreigabe.

## T-006: GitHub-Übergabevorlage lokal bereit (14.11.2026)

[Konkrete GitHub-Übergabevorlage](GITHUB_UEBERGABE_CODE18_PLAN.md): konkreter Delta-/Quell-/Workflow-/Nachweisabgleich und noch nicht ausgeführte Ein-Ref-Pushvorlage. Historische Remoteangaben14.11.2026um01:59–02:00UTC, keine aktuelle externe Abfrage. Geplanter H getrennt von014870f3-AAB-Quelle und künftiger CI/main-SHA; unveränderte automatische CI/gegebenenfalls bestehende Previewautomatik braucht spätere Pushfreigabe. Kein main-/Signier-/Upload-/Gerätebeleg. T-006/V-014 IN_ARBEIT, E-002–E-005/Gesamtfreigaben offen. Nächster eigener Auftrag begrenzter aktueller Ref-/PR-/CI-Abgleich und einmaliger Fast-forward-Entwicklungsbranch-Push nur bei ausdrücklicher separater Beauftragung; jetzt keine Übertragung/Aktion. Keine erneuten Metadatenfragen.

## T-006: CI-Nutzerbeleg vervollständigt, Gesamtfreigabe offen (14.11.2026)

[Ergänzte CI-Zuordnung](GITHUB_VORAUSSETZUNGEN_CODE18.md): Nutzer-SHA6dfa632 und passender Commit-Screenshot mit fehlgeschlagenem Push-Check/fünf grünen Checks; Versuchnummer unbekannt. Keine weitere SHA-/Ergebnis-/Secretfrage nötig. Keine neue main-Push-CI/Code18-/Signierfreigabe. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamtfreigaben offen. Nächster eigener Auftrag konkrete lokale GitHub-Übergabeplanung aus vorhandenen Diffs/Workflows, keine externe Abfrage oder Übertragung/Ausführung. Ältere nächste Aufträge bleiben historisch.

## T-006: unvollständige GitHub-Nutzerbelege zugeordnet (14.11.2026)

[Zuordnung des Nutzerberichts](GITHUB_VORAUSSETZUNGEN_CODE18.md): PR2 Open/Entwicklung→main; CI43331316553 push/Entwicklung, headSHA/Ergebnis unbekannt. Signing-Secrets nicht bestätigt, Scope laut Nutzer nicht einsehbar. Keine externe Abfrage oder Rechte-/Secretänderung, kein neuer CI-/Signierbeleg. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag nur fehlende headSHA/Versuch/Ergebnis des vorhandenen CI-Laufs beim Nutzer zuordnen; keine erneuten Secret-/bekannten PRfragen oder Workflowstarts. Frühere nächste Schritte im folgenden Text sind historisch.

## T-006: aktuelle GitHub-Bestandsaufnahme (14.11.2026)

[GitHub-Bestandsaufnahme](GITHUB_VORAUSSETZUNGEN_CODE18.md): main e48d289/dev6dfa632 frisch bestätigt, neue Code18-Quellen lokal; fünf Workflowdefinitionen bytegleich. API-CONNECT403 blockiert PR-/CI-/Secretnamen-/Scope-Nachweise. Keine Secrets als fehlend melden, kein grüner Remote-CI-Beleg. T-006/V-014 insgesamt IN_ARBEIT; E-002–E-005 und Gesamt-/Signier-/Upload-/Gerätefreigaben offen. Nächster eigener Auftrag vorhandene nichtgeheime GitHub-Oberflächenbelege vom Nutzer einholen/zuordnen, ohne Auth-/Cloudänderung oder Werte/Schlüssel. Frühere nächste Aufträge im folgenden historischen Text werden dadurch nicht erneut freigegeben.

**Fortschreibung lokale18/rc.4-Umsetzung 14.11.2026:** [Frischer unsignierter Code18-AAB-Nachweis](CODE18_AAB_INTEGRATION_T006.md), Versionsquelle014870f vor Bau gebunden; genau drei Versionsdateien/fünf Werte, Dependencies/Produkt-/Signierlogik unverändert. Neue7608…Appkennung, AABd0d5cfed…/Manifest18/rc.4 tatsächlich geprüft; alte Code17-Artefakte/Guards/Logs/Manifeste erhalten. Keine Signierung/Installation/externe Abfrage/Push/Merge/Workflow-/Cloud-/Playaktion oder neue Vollsuite. T-006/V-014 IN_ARBEIT und E-002–E-005/Gesamt-/Signier-/Upload-/Gerätefreigaben offen. Genau nächster separater Auftrag nur lesende GitHub-Refs/PR-/CI-/Workflow-/Signing-Secretnamenmetadaten prüfen, keine Werte oder Schreib-/Signieraktion; heute nicht ausführen.

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
| T-006 | Integration und Gesamtabschluss | IN_ARBEIT | PR4Merged/W2-CI belegt; P2 sdkmanager nicht auflösbar belegt; lokale Auflösung/38Offlinefälle grün, Remote-/U2-/Signier-/Gerätefreigaben offen | [§ 2.2, T-006](ANKER_PLAN.txt) |
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
| V-014 | Gesamttests und sichere Releasevorbereitung | IN_ARBEIT | M/U1/W2-CI belegt; SDK-Auflösung lokal geprüft; neue CI/U2/S und Geräte/Gesamtfreigaben offen | [§ 2.1, V-014](ANKER_PLAN.txt) |
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
