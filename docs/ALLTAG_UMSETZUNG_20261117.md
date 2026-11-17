# Umsetzung der Alltagswünsche – 17.11.2026

Aktueller Auftrag: alle geplanten Punkte autonom fortführen, ohne Paketfreigaben;
UI gesammelt nach Funktionslogik und nativen Schnittstellen. Keine Termingarantie
und kein Abschluss ohne Nachweis. Lokaler Arbeitsbaum; Code18-Releasebindung bleibt
unverändert. Vorherige Dokumentänderungen gehören zum Nutzerauftrag und bleiben erhalten.

## Funktionspakete vor der gemeinsamen UI-Phase

- BF-001/BF-002: erster Stand siehe Bugfix-Plan. Zusätzlich bewusste einzelne spätere
  Rückfrage über `Commitment.returnCheckAt`, neue Zustellgelegenheit ausschließlich
  nach dieser Wahl. Rückkehr bleibt eine eigene Aktion.
- F-011: `core/hobbies.ts`, lokale Sammlung mit Namen, pausierbaren Varianten,
  optionaler Gesamtdauer/Kontext/Energie/Dingen. Auswahl verwendet dieselbe
  Jetzt-Projektion, nur echten freien Planblock; sperrt Arbeit, offene Termine,
  Nacht/Alarm/Fokus und unklare freie Zeit. Stabile Idee pro Block, bewusste Rotation
  und Heute-Abwahl. Store-Schreibqueue, Backup-Validierung; meta/local bleibt vom
  Sync ausgeschlossen. Bewusst erstellte lokale Sicherung enthält die Sammlung.
- F-016: `core/functionSearch.ts` mit festem Katalog, Schlagwörtern, Umlautnormalisierung,
  Teilwort-/Ein-Tippfehler-Suche, Rangfolge und festen Einstellungszielen. Kein Index
  privater Inhalte. Sprung/Markierung und ergänzte Zielanker folgen in der UI-Phase.
- F-015: bestehender SmartWakeService misst ab explizitem Start; frühes Wecken bleibt
  im vorhandenen Morgenfenster/AlarmController. Technische Eingangs-/Stille-/Lückenzähler
  im bestehenden begrenzten Diagnosejournal, keine Rohaufnahmen. Neue Exportkategorie
  `measurement` muss ausgewählt werden. Sichtbares Mikrofon-FGS bleibt erforderlich.
  Option tägliche Messung zunächst aus: sichtbare App darf nach Wahl starten, im
  Hintergrund nur täglicher Start-Hinweis; kein Mikrofonstart beim Booten.
- F-015 Sperre: ausschließlich optionaler Android-Geräteadministrator mit force-lock;
  eigene Systemfreigabe und anschließende ausdrückliche Wahl erforderlich. Kein
  Accessibility-Dienst. Sperre stoppt fremde Medien nicht zuverlässig; manuelles
  Sperren bleibt möglich. Noch keine Rechte am echten Handy angefordert/aktiviert.
- F-018: Sichtbarkeitsbeleg benötigt 60 Sekunden kontinuierlich beobachtete gezeichnete
  Frage, interaktives/entsperrtes Display und maximal zwei Sekunden Beobachtungslücke.
  Timeout speichert nur eine **unbestätigte Schätzung**, nie einen Schlafnachweis.
  Native Übergabe ins vorhandene sleepDiary bewahrt eigene Korrekturen/Bestätigungen.
  Freiwillige Weckzeit-Rückmeldung, QR-/Alarmzeit getrennt; Energie des Folgetags gehört
  zur vorangegangenen Nacht, auch bei Eingabe nach Mitternacht. Lokale Median-Auswertung:
  nur bestätigte Einschlafzeiten, fehlende Antworten bleiben fehlend; erst nach 14
  bewerteten Nächten und mindestens fünf passenden Beobachtungen vorsichtiger Vorschlag.
  Das ist eine Produktgrenze, keine medizinische Diagnose oder Schlafbedarfsbestimmung.
  Skalen/Datenfelder bleiben vorläufig und bearbeitbar; keine automatische Zeitübernahme.
- Neue Audio-/Sperr-/Automatikwahlen werden nicht per Sync oder Import aktiviert.
- F-012: reine Dialoggeometrie für tatsächliches Elternfenster, dessen Monitor,
  negative Koordinaten/DPI und begrenzte Arbeitsfläche vorbereitet und getestet.

## Kostenfreie Anbieter und externe Voraussetzungen

Bestehende Supabase-Verbindung per Skill und aktuellen offiziellen Dokumenten geprüft.
Verbundenes Projekt hatte beim Readback **keine Edge Functions**; kein Deployment erfolgt.
Neue optionale Adapter im vorhandenen AssistantHandler: Gemini Free Tier und TomTom.
Aktueller Edge-Einstieg erzwingt `freeOnly`, verlangt explizit bestätigte Free-Tier-
Projekte ohne Abrechnung und passende **serverseitige** Schlüssel. Alte kostenpflichtige
OpenAI-/Google-Wege dienen nicht als Fallback. App sendet Free-only-Anforderung.
Authentifizierung, Nutzer-Allowlist, CORS, SQL-Tagesbudget und reine Vorschlagssemantik
bleiben erhalten. TomTom unterstützt hier Auto/Rad/Fuß, keinen vorgetäuschten ÖPNV-Ersatz;
mehrdeutige Adressen werden nicht als beliebiger erster Treffer übernommen.

Für echte Aktivierung fehlen derzeit GEMINI_API_KEY, TOMTOM_API_KEY und geprüfte
Free-Tier-/Serverkonfiguration. Kein Konto angelegt, keine Bedingungen akzeptiert,
keine Zahlung/Cloudaktivierung, keine privaten Aufgaben/Adressen versendet. Adaptertests
ersetzen keine echte Providerprüfung. F-013/F-014 deshalb nicht als ausgeliefert schließen.

Quellen (17.11.2026):
- https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- https://developer.android.com/reference/android/app/admin/DevicePolicyManager
- https://supabase.com/changelog.md
- https://ai.google.dev/gemini-api/docs/billing
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/api/generate-content
- https://docs.tomtom.com/pricing (Routing aktuell 20K kostenlose Monatsanfragen;
  Konto-/Abrechnungswahl zusätzlich prüfen, keine dauerhafte Preisgarantie)
- https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route
- https://docs.tomtom.com/search-api/documentation/search-service/fuzzy-search

## Gemeinsame UI-Phase umgesetzt

Nach den Funktionspaketen wurden die Oberflächen gemeinsam ergänzt:

- BF-001: „Aufstehen in … · um …“ nennt den Countdownbezug. Allgemeine freie
  Momente heißen „Ein ruhiger Moment“; doppelte Angaben und unnötiger Hilfeknopf
  entfallen. Bestätigtes frühes Aufstehen bleibt berücksichtigt. Keine neue
  Punktevergabe; der bestehende kurze XP-Hinweis quittiert eigene Handlungen.
- BF-002: eigene Rückkehr-Erinnerung in den Einstellungen, zunächst aus; bei
  offenem Termin zusätzlich „In 30 Minuten an meinen Status erinnern“.
- BF-003/BF-005: gemeinsame aufklappbare Karten mit Rand, Überschrift und
  Inhaltstrenner; Heute anpassen gliedert Unterstützung, Termine/Tagesplan,
  Routinen/Aufgaben, Abend/Schlaf und weitere Möglichkeiten.
- F-011: Hobbys mit Name allein anlegen, umbenennen und pausieren; bearbeitbare
  Fotovorlagen und Aktivitäten mit freiwilligen Angaben. Eine nachgeordnete
  Idee in echter freier Zeit, andere Idee oder Pause für heute ohne Punkte.
- F-012: PC-Hauptfenster in vier Bereiche gegliedert. Normale Aktionsdialoge
  gehören zum Hauptfenster und werden über dessen tatsächlicher Position im
  selben Monitor-Arbeitsbereich zentriert. Kein globales Immer-im-Vordergrund.
- F-016: globale Suche, feste Ziele und Schlagwörter, direkter Sprung öffnet
  zugehörige Bereiche und markiert/fokussiert das Ziel. Suchtexte bleiben flüchtig.
- F-017: gemeinsame Info-Schaltfläche öffnet vorhandenen abgesicherten Sheet-
  Verlauf; passive Bereichserklärungen und ausführliche Mess-/Einrichtungshilfe
  sind darüber erreichbar. Entscheidungsrelevante kurze Grenzen, aktueller
  Status und konkrete Datenfreigaben bleiben sichtbar. Info-/Suchfenster erhalten
  Fokus, verschachtelte Auswahl und Zurück-Verlauf; Hash-Rücksprung korrigiert.
- F-015/F-018: Messstart auf Jetzt bei gewählter Messoption, gemeinsame Bettaktion,
  zunächst ausgeschaltete tägliche Automatik/Sperre/Schätzung, eigene Android-
  Freigaben. Stille Vollbildfrage nur bei tatsächlich aktivem nativen Schätzweg;
  Antwort/Heute-Ruhe bleiben möglich. Freiwillige Morgen-/Energie-Rückmeldung,
  Schätzung bestätigen/korrigieren/verwerfen, bestehendes Schlafjournal ergänzt.
- BF-004/F-013/F-014: kurze klare Sperrgründe und Schritte zur Einrichtung;
  aktuelle Empfänger Gemini/TomTom, neue Einwilligungsversion 2 statt Übernahme
  historischer OpenAI-/Google-Freigaben. Keine Schlüssel in App oder Protokoll.

## Prüfstand und verbleibende Grenzen

- 1.434 TypeScript-Tests in 140 Dateien bestanden; Typprüfung grün. ESLint ohne
  Fehler, ein Hinweis zur bereits vorhandenen Request-Generation-Ref-Bereinigung.
- 281 Android-Unit-Tests in 34 Klassen bestanden. Native TS-/Kotlin-Brücke und
  Android-Debug-Kompilierung geprüft; keine Installation auf dem Nutzerhandy.
- PC-Begleiter: 290 Tests durchgelaufen, 2 begründet übersprungen, übrige grün.
  Echter Windows-Tk-Lauf prüft Tastatur, Fokus, deaktivierte Knöpfe, Matching-
  Rückmeldung, 200%-Monitoranpassung und kleines 340×400-Fenster ohne Callback-
  Fehler. Ein zusätzlicher Test reproduzierte eine zu frühe Positionierung vor
  dem Anzeigen; Zentrierung erfolgt jetzt nach dem Map-Ereignis. Tatsächlicher
  Win32-Rahmen trifft die berechnete Position mit 0 Pixel Abweichung und bewahrt
  360×220 Wunschgröße sowie die Eigentümerschaft. Nur synthetische Daten, keine
  Windows-Systemwirkung. Screenshot zeigt
  Windows-Sperrbildschirm: daraus folgt **keine** visuelle PC-Designabnahme.
- 29 gezielte Browserprüfungen für Wecker-Navigation und Einstellungen bei
  320/390 Pixeln und 100/160% Schrift bestanden. Vollständiger Lauf: 386/387
  bestanden; ein veralteter Gleitzeit-Testselektor wurde an die Abschnittsgrenze
  angepasst. Der einzelne Fall danach bestanden (1/1), keine weitere Produktänderung.
  Neue Brückenfälle prüfen aktive Messung als Voraussetzung der Einschlaffrage,
  sichtbare Beobachtungsberichte und eigenes Wegdrücken ohne Schlafbuchung.
- Browser-Sichtprüfung: Jetzt und gruppiertes Heute-anpassen-Sheet bei 390×844.
  Echte Android-Zustellung, Mikrofon-/Sensorinput, Display-/Overlay-/Sperrverhalten,
  ganze Messnacht und neue Rückmeldungen bleiben am Gerät zu prüfen. Browser-
  Brückenfixtures und synthetische Unit-Tests ersetzen diese Beobachtung nicht.
- Kostenlose Provideraktivierung benötigt externe Schlüssel und geprüfte
  Free-Tier-Konten. Kein bezahlter Ersatz, keine echte Anfrage ohne Einrichtung.
- Nutzerhandy bleibt auf Google-signiertem Code17. Lokaler Uploadschlüssel kann
  kein direktes Daten-erhaltendes USB-Update ersetzen. Keine Deinstallation,
  kein Appdatenverlust, keine Versionsänderung. Neue Arbeit ist noch kein Release.
- Der geplante Code18-Play-Auftrag vom 18.11. um 22:50 bleibt an seine bisherige
  Quelle gebunden. Diese neue Funktionsserie wurde nicht still hineingemischt.
