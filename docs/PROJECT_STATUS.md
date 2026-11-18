# Aktueller Übergabestand

## Aktuell: F-019 für die geplante Play-Auslieferung neu paketiert (18.11.2026)

UX und persönliche Testansicht gemeinsam im neu signierten Code18/1.5.0-rc.4:
Appquelle003b144/main-CI44205435977, Policy8e670e7/main-CI44205697813 erfolgreich.
Prepare44207288338 und Sign/Verify44208364804 erfolgreich; ausschließlich finales
Artefakt14383604542. Tatsächlicher Publisherprüfer akzeptiert das neue AAB lokal;
sieben Textmarken der Testanleitung und UX in beiden Bundles bestätigt.

Bestehenden Play-Auftrag aktualisiert und vollständigen Prompt/Termin/Chat/Status
zurückgelesen: ACTIVE,18.11.2026 um22:50Europe/Berlin, interne Freigabe mit
anschließender Verfügbarkeitsmeldung. Kein Play-Upload oder Handyupdate vorweggenommen.
[Aktueller Beleg](CODE18_AUSLIEFERUNGSBELEG_20261117.json). Alter Testansichts-Build
14378791154 ist überholt. Reine Belegpflege auf eigenem Branch, damit main8e670e7
und seine geprüfte Dispatch-Bindung bis zum geplanten Upload stabil bleiben.

## Folgeentwicklung F-019: Jetzt und gemeinsame Bedienung (18.11.2026)

Auf separatem Branch `codex/ux-jetzt-20261118` umgesetzt: eindeutiger Countdown
mit Kalendertag, kompakte Abweichungs-/Unterwegs-/Messzustände, Erklärungen auf
Info-Tipp, kurze Weckerfehler mit direktem Einstellungsweg, Suchabsichten und
acht freiwillige lokale Favoriten. Gemeinsame Sheets halten den Schließen-Knopf
sichtbar, schmale Seitenköpfe lassen Überschriften lesbar. Vorhandene Handlung,
Planung, Historie, Rücknahme und Freigaben bleiben Grundlage.

Logikprüfung 1.442/1.442, Browser-Gesamtabnahme 391/391 und Produktions-Build
erfolgreich; Lint ohne Fehler. Jetzt-Screenshot zusätzlich visuell geprüft.
[Umfang](ANKER_IMPLEMENTIERUNGSPLAN.md#f-019--ruhige-eindeutige-alltagsoberfläche-18112026)
und [Nachweise](ANKER_TESTNACHWEISE.md). Diese Folgeentwicklung ist noch nicht
auf dem Handy installiert. Der anschließende ausdrückliche Auslieferungsauftrag
ist im aktuellen Abschnitt oben umgesetzt; der folgende frühere Paketstand ist historisch.

## Historisch: Code18 nur mit neuer Testansicht (18.11.2026)

PR17 integriert; Appquelle8a51bdb und Policy918370f haben ihre eigenen main-CIs
44191339291/44191751112 vollständig bestanden. Neues AAB aus Prepare44193618462
und Sign/Verify44194672103 erfolgreich gebaut, signiert und unabhängig geprüft.
Finales Artefakt14378791154 enthält die neue Restanleitung und technischen Teilbelege;
im unsigned und signierten Bundle direkt nachgewiesen. Echter Publisherprüfer
akzeptiert das neue AAB zusätzlich lokal ohne Google-Anfrage.

Bestehende Automation `anker-play-update-intern-freigeben` auf diese neue Bindung
aktualisiert und aus der gespeicherten Planung zurückgelesen: weiterhin ACTIVE,
18.11.2026 um22:50 Europe/Berlin, gleicher Chat und interner Umfang. Noch kein
Play-Upload oder interner Release bestätigt. Produktive Handy-App weiterhin Code17.
[Damals gültiger Beleg](belege/20261118-code18-vor-f019.json);
[überholtes Paket als historischer Beleg](belege/20261117-code18-vor-testansicht.json).

Die Belegpflege liegt separat von der unveränderten ausführbaren main-Policy918370f,
damit die geprüfte Dispatch-Bindung bis zum geplanten Upload erhalten bleibt.

## Historische Zwischenstände

Neue Folgeänderung17.11.: Die persönliche Restanleitung ist im Testmodul umgesetzt.
Eigene verbleibende Versuche stehen zuerst, belegte technische Teilprüfungen sind
gesondert gekennzeichnet; der bisherige Katalog samt Berichten bleibt aufklappbar.
Auf aktuellen ausdrücklichen Nutzerauftrag nun Aufnahme in die geplante
Code18-Auslieferung: neue Quelle/CI und neues signiertes Artefakt werden gebunden,
danach derselbe Play-Termin aktualisiert. Noch kein neuer Signier-/Uploaderfolg
behauptet. [Entscheidung](ANKER_IMPLEMENTIERUNGSPLAN.md#folgeauftrag-persönliche-restanleitung-im-testmodul-17112026).

Stand 17.11.2026, nach PR16: **BF-001–BF-005 und F-001–F-018 sind im
dokumentierten Softwareumfang implementiert und integriert**, einschließlich der
abschließenden gemeinsamen UI-Phase. F-013/F-014 sind zusätzlich über die echte
angemeldete App und kostenlose Anbieter erfolgreich geprüft. Aktueller main-Code:
`8f452fd5317cabc002f53ebe55ceedfc47559e0b`; eigene CI `44172620113` erfolgreich
(1.436 TypeScript-, 387 Browserfälle; PC-Matrix je 290 Fälle, davon zwei erwartete
Plattform-Skips). Das ist keine vollständige Geräte- oder Nachtabnahme.

Verbindliche [Restliste mit Voraussetzungen](OFFENE_ENTWICKLUNGEN.md#tatsächlich-offene-prüfungen).
[Anbieterbelege](GRATIS_SCHNITTSTELLEN_ABNAHME_20261117.md),
[gebundenes signiertes Code18-Artefakt](CODE18_AUSLIEFERUNGSBELEG_20261117.json).
Auf dem Handy ist weiterhin Code17/1.5.0-rc.3 installiert. Code18 ist fertig
signiert; Play-Ausführung bleibt für den 18.11.2026 um 22:50 Berlin geplant,
nach der Schlüsselaktivierung um 22:41. Kein neuer App-Build, keine neue Version
oder Änderung am gebundenen Artefakt durch diese reine Status-/Abnahmepflege.

Zusätzliche USB-Geräteabnahme17.11.: Testwecker im Hintergrund technisch ausgelöst
und gestoppt, befristete Unterwegs-Erinnerung zugestellt und entfernt, stummer
Schlafhinweis, NFC-Abbruch und Schutzgrenzen geprüft. Suche/Heute-anpassen/Info-
Fenster auf echtem Android gesichtet. Isolierten Code18-Prüfstand danach entfernt;
Produktions-App weiterhin Code17. [Belege und verbleibende Grenzen](ANKER_TESTNACHWEISE.md#android-geräteprüfung-über-usb-am-17112026).

## Historische Zwischenstände

Die folgenden datierten Abschnitte bleiben als Verlauf erhalten; der obige aktuelle Stand hat Vorrang.

## Laufende autonome Umsetzung (17.11.2026, nachts)

[Aktueller Arbeitsstand aller neuen Pakete](ALLTAG_UMSETZUNG_20261117.md).
F-011/F-016/F-015/F-018 sowie kostenlose Provideradapter sind in Umsetzung;
UI bleibt bis zur gemeinsamen Schlussphase zurückgestellt. Kein Paketabschluss-Prompt
an den Nutzer nötig. Externe Schlüssel/Play-Signaturgrenze bleiben reale Voraussetzungen.

## Umsetzung begonnen: erstes Logikpaket (17.11.2026)

BF-001: bestätigtes frühes Aufstehen erzeugt keinen erneuten Aufsteh-Countdown.
BF-002: vorhandene Erinnerungsplanung um bewusst wählbaren, einmaligen und
befristeten Unterwegs-Status-Check erweitert; zunächst aus. TS/Kotlin passend,
keine automatische Rückkehr. 162 gezielte TS-/41 Android-Unit-Tests und Typprüfung/
gezieltes ESLint grün. Bedienung/Status/Snooze, übrige Countdownklärung und echte
Geräteabnahme offen. Alle UI-Arbeit bleibt gesammelt am Ende. Noch keine neue
Version gebaut/installiert oder neue Änderungen in den gebundenen Play-Weg übernommen.

Verbindlich für die weitere Bearbeitung: [Effizient und autonom arbeiten](ARBEITSWEISE.md). UI-Anpassungen gesammelt zum Schluss, nach Funktionslogik und Datenmodell.

## Neue Planung und gemeinsame Arbeitsweise (17.11.2026)

F-015 erweitert und F-018 neu geplant: nächtliche Automatik mit Android-Prüfgate,
sofortiger Start bei Bettbestätigung, unsichere Einschlafschätzung, freiwillige
Morgen-/Energierückmeldungen und ausschließlich bestätigungsbedürftige Zeitvorschläge.
Endgültige Datenablage bleibt Gesprächspunkt. Alle UI-Arbeit gesammelt zum Schluss.

Neu: BF-005 und F-015–F-017 (Heute-anpassen-Struktur, Nachtmessung/Signaljournal/
optionale Sperre, Funktionssuche, Hilfedialoge), alle nur geplant. Quellabgleich:
neue Weckzeit-Override-Anzeige erst nach Code17. Allgemeiner Messstatus bereits
vorhanden, dauerhaftes Eingangsjournal im gelesenen SmartWake-Dienst nicht vorhanden.

BF-004 (Einrichtung) und F-013/F-014 (kostenfreie KI-/Verkehrswege) ergänzt.
Kostenfreiheit ist eine ausdrückliche Nutzeranforderung; bestehende OpenAI-/Google-
Routes-Anbindung ist dafür nicht freigegeben. Keine Server-/Provideraktivierung erfolgt.

Aktuelle kurze [Gesamtübersicht](OFFENE_ENTWICKLUNGEN.md): BF-001–BF-003 offen,
F-011 Hobby-Vorschläge und F-012 PC-Gestaltung/Dialogposition neu geplant.
[Arbeitsweise](ARBEITSWEISE.md) gilt für alle Pläne. Bestehende F-001–F-010 nicht
erneut als unimplementiert aufführen; Geräteabnahme und Play-Release bleiben getrennt.

## Alltags-Bugfixes (17.11.2026)

Neuer [Bugfix-Plan](BUGFIX_PLAN.md): BF-001 betrifft die unklare Jetzt-Anzeige,
BF-002 eine Erinnerung an den offenen Unterwegs-Zustand und „Bin wieder da“.
Beide offen, bisher nur geplant;
effiziente autonome Bearbeitung und konkrete Abnahme im Plan festgehalten.

## T-006: AAB-Quellkennung nach Capacitor-Sync korrigiert (16.11.2026)

[Konkreter Screenshotbefund, isolierte Reproduktion und kleinster Policyfix](CODE18_FINGERPRINT_SYNC_KORREKTUR_T006.md): Prepare43941667392/W2793dbaa/1 scheiterte laut Nutzerlog mit FINGERPRINT_NATIVE. Die vorhandene Vite-Funktion ergibt für feste App0c31179 vor Sync4f8a7b5a…, nach bestehendem Capacitor-Sync stabilfff132db…; einzig generierte res/xml/config.xml erklärt diese Kennungsabweichung. Bisher fälschlich Vor-Sync-Wert gebunden. Minimaler Policyfix pinnt Nach-Sync-Wert, trennt FINGERPRINT_MISMATCH/NATIVE_MISSING ohne Akzeptanzänderung. App-/Workflow-/Manifest-/Signierquellen und CI-/Versuchs-/Hashgates unverändert.41Protokoll-/Java- und32Workflow-/SDK-Offlinefälle grün; neue unabhängige Nach-Sync-Fixture vorher rot.

Tatsächlicher Runner-ELFbestand/Proof/H2/HP/A bleibt unbekannt, kein erfolgreicher neuer Prepare/AAB/S/HS/Upload/Handybeleg. Geprüften Entwicklungsfix regulär übertragen und dessen neue CI lesen, dann neuer PR/regelgerechte Integration/eigene exakte main-CI nötig. Kein Workflowretry oder Guardlockern, keine neue Promptkette. App0c31179 mit Weckzeitfix/eigener CI43873584133 bleibt fest, bisheriges mainW2793dbaa/eigene CI43939327282 historisch getrennt. T-006/V-014 IN_ARBEIT, E-002–E-005/Geräte/Gesamt offen. Folgende Abschnitte historisch.

## T-006: PR11-Relaytest – Uhrzeitrennen im Cleanup-Datensatz korrigiert (16.11.2026)

[Nutzerscreenshot, Rot-/Grünbeleg und Grenzen](PR11_RELAY_ZEITANKER_T006.md): Fehlgeschlagener PR-Lauf43877868624/Job133335555439 zeigt pc_link_mailbox_check beim synthetischen Cleanup-Insert seq99. Zwei volatile Zeitabfragen konnten die erlaubten14Tage überschreiten. Deterministischer lokaler Rotbeleg mit fortschreitender synthetischer Uhr, dann gemeinsamer statement_timestamp-Anker ausschließlich im Test.17PGlite0.5.16-Prüfungen grün einschließlich echter Migration/RLS/Cleanup/exakterGrenze und Ablehnung von0Tagen/14Tagen+1ms. Produktmigration, Schutzregeln, Appquelle0c31179, Workflows/Version/Signierweg unverändert. Keine vollständigen Produktsuiten lokal wiederholt.

Korrektur wird innerhalb der bestehenden autonomen Freigabe regulär in PR11 übertragen; neue Push-/PR-CI separat nachkontrollieren. Altes PR-Rot bleibt historisch, kein Retry. Noch kein W-final oder dessen main-CI/Prepare/Sign/AAB/Upload/Handyupdate. T-006/V-014 IN_ARBEIT, E-002–E-005/Geräte/Gesamt offen. Folgende Abschnitte historisch.

## T-006: Weckzeit-Fix regulär in main und eigene main-CI erfolgreich (16.11.2026)

[Fixquelle und AAB-Quellbindung](CODE18_FINALE_QUELLBINDUNG_T006.md): PR10Merged, main **0c31179be780e0bb6359dee79c3502d4e6e8ba4d**, ElternR2/4ca5d08e, Baum vollständig gleich zum geprüften Fix. Eigene **ci.yml43873584133/exakt0c31179/push/main/Versuch1/Success11m 6s**, öffentliche Summary **381 passed (9.5m); 1377 passed; 0 failed; 0 skipped**. Kein Branch-/PR-Ersatz oder Docs-Sonderfall.

Bestehender AAB-Weg jetzt lokal fest an Appquelle0c31179, Quellkennung4f8a7b5a… und Quell-CI43873584133 gebunden; Workflowdefault/App-Checkout/Helper/Fingerprint gemeinsam angepasst. Alle Guards/Trigger/Null-Signier-/SDK-/Sign-/Verify-/Hash-/Versuchsgates unverändert, AST-/YAML-Abgleich;38Protokoll-/Java- und15Workflowfälle grün. Kein Appbuild/Signieren/Workflowstart. Dieser Entwicklungsstand ist noch nicht W-final; reguläre Policyintegration/eigene W-final-main-CI/neuer Prepare/Artefakt/Proof fehlen. Alte ReferenzU1/P5 nicht als Fixbundle ausgeben. B4-/API-/Playzugänge weiter tatsächliche Blocker, Code18 unverändert/Playbestand unbekannt/kein stillerCode19; T-006/V-014 IN_ARBEIT/E-002–E-005/Geräte/Gesamt offen. Autonome Arbeitsfreigabe gilt weiter, keine neue Promptkette. Folgende Abschnitte historisch.

## T-006: autonome Fortsetzung, Weckzeitkorrektur auf aktueller isolierter Basis (16.11.2026)

[Autonomer Weckzeit-/Releasestand](CODE18_AUTONOME_FORTSETZUNG_T006.md): Nutzer meldet Herkunftsreferenz „unbekannt“ und erlaubt die selbstständige Fortsetzung ohne wiederholte Einzelprompts. Alter gemeldeter uncommitteter Weckzeit-Diff hier nicht vorhanden; beschriebene Korrektur deshalb gezielt auf isoliertem mainR2 neu umgesetzt. Effektive Weckzeit/Tagespriorität sichtbar, bewusst ändern/entfernen, Standardänderung erhält Override; Smart-Wake-Vorschau aus aktueller Konfiguration.35gezielteVitest/6Chromiumfälle, Typecheck/Webbuild/Lint0Fehler/1bestehendeWarnung grün. Kein nativer Quellenwechsel, kein Gerätebeleg.

Git-Refs/Clone erreichbar; GitHub-API und Google-Play-API CONNECT403. Keine lokal gefundene passende Schlüsselsicherung oder nutzbare Google-Identität belegt, kein Ersatzkey/Reset. Geprüften Entwicklungsstand/CI vom späteren main-Fixquellcommit und neuer Policy-/Prepare-/Signier-/Uploadbindung trennen. M/P5 ohne Fix erfüllt Update nicht. Code18/rc4 unverändert, Playbestand unbekannt/kein stillerCode19. T-006/V-014 IN_ARBEIT/E-002–E-005/Geräte/Gesamt offen. Weitere Ausführung im erteilten Umfang selbstständig, vorhandene Server-/Quell-/CI-/Signiergates erhalten; folgende Abschnitte historisch.

## T-006: Prepare-sdkmanager-Auflösung lokal korrigiert (15.11.2026)

[Lokale Prepare-sdkmanager-Korrektur und Offlinebelege](PREPARE_SDK_AUFLOESUNG_T006.md): Ausgang D4 d565f84 sauber gesichert. Vor Fix reproduziert ein künstlich vorhandenes SDK ohne PATH-Eintrag Exit127. Nur der bestehende Prepare-SDK-run-Block löst jetzt PATH beziehungsweise den festen Kandidaten cmdline-tools/latest/bin/sdkmanager unter konsistenten konfigurierten SDK-Wurzeln auf. Klare Abbrüche bei Fehlbestand/Konflikt, keine Installation oder PATH-Änderung. Argumente android-36/build-tools35.0.0, übrige Workflowjobs/Trigger, M-/CI-/Signier-/Artefaktgates und APK-/Playpfade unverändert.

17 neue SDK-Fälle, 14 bestehende Workflowfälle und sieben gezielte Protokollfälle grün (30+1+7), ausschließlich Attrappen; keine echten SDK-Prozesse oder Builds. J nur lokaler Fix-/Übergabehead; exakte SHA in RESULT.json unter `/workspace/anker-t006-prepare-sdk-fix-20261115/`, nicht gepusht und keine neue main-Workflowquelle. Bekannte M/W2/K heute nicht extern neu geprüft; tatsächlicher Runnerbestand und Erfolg eines künftigen Prepare weiter offen. U1 unverändert, U2/H2/HP/A/S fehlen. T-006/V-014 IN_ARBEIT, E-002–E-005/weitere Freigaben offen. Genau nächster eigener Auftrag: einmaliger begrenzter Entwicklungsbranch-Push J mit frischer Ref-/Quell-/Triggerprüfung und CI-Nachkontrolle; weder main-Integration noch prepare/sign. Folgende Abschnitte historisch.

## T-006: P2-Detailfehler belegt – sdkmanager nicht auflösbar (15.11.2026)

[P2-SDK-Detailfehler und begrenzter Folgeplan](P2_SDK_DETAILFEHLER_T006.md): Nutzerscreenshot zu P2 43679893044/Versuch1/Job132708064401 zeigt `line 1: sdkmanager: command not found` und Exit127. Resolve grün, Paketierung/Unsigned-Prüfung sowie sign/verify übersprungen. Belegt ist die fehlende Befehlsauflösung; tatsächliche SDK-Installation oder PATH-Ursache bleiben unbekannt. Keine Korrektur, Tests, SDK-/PATH-Einrichtung oder Workflowwiederholung. P2 zeigt drei Prepare-Inputfelder ohne optionale Signierfelder; keine rückwirkende Aussage über alten P-Rohinput.

Sauberer Ausgang D3 `288d9ec3899080f834561d85930b5986dc4b803b`; D4 nur lokale Dokumentation/Sicherung, exakte SHA in RESULT.json unter `/workspace/anker-t006-p2-sdk-detail-20261115/`. M/W2/K unverändert bekannte Quellen, heute keine frischen Remote-Refs. U1 erhalten, U2/H2/HP/A/S fehlen. T-006/V-014 IN_ARBEIT, E-002–E-005/weitere Freigaben offen. Genau nächster separat zu beauftragender Einzelauftrag: kleinste lokale Prepare-sdkmanager-Auflösung samt gezielten Offlinefällen, ohne Neuinstallation/Dispatch/Übertragung. Folgende Abschnitte sind historisch; ihre frühere Aussage „Detailfehler unbekannt“ ist durch den Screenshot überholt.

## T-006: neuer Prepare-Lauf – Resolve grün, SDK-Schritt rot (15.11.2026)

[Neuer W2-prepare-Lauf und belegter SDK-Abbruch](CODE18_PREPARE_W2_NACHKONTROLLE_T006.md): Besitzer startete genau einen neuen P2 **43679893044 / workflow_dispatch / main / W2 / Versuch1 / Failure nach30s**. Vollständiger Lauf-Commitlink und Workflowdateiquelle W2 `87c83fedf5c1aa52450ee36f650134c442928c28` belegt, main=W2/Entwicklung=K erhalten. Resolve132708027128 Success/8s; prepare132708064401 Failure/17s im Schritt „Benötigte bestehende Android-SDK-Versionen bereitstellen“, öffentlich nur `Process completed with exit code 127.`. Sign/verifySkipped; keine Artefakte/U2/H2/HP/A/S.

Quellbefehl im unveränderten Workflow ist sdkmanager mit android-36/build-tools35.0.0; konkrete Runtimefehlermeldung nicht ausgelesen. Jobseite Sign in to view logs, CLI failed to get job/APIForbidden. Keine Ursache aus Exitcode/Schrittname erfunden; tatsächliche Raw-Inputstrings unbekannt. Angefordert war prepare mitM/W2 und fünf leeren Signierbindungen; Prepare-Zweig und erfolgreiches Resolve sind belegt. Kein Rerun/Fix/SDK-Eingriff oder Signieren.

Vorab beide unabhängigen M-/W2-main-CI-Gates und W2-Quellzeilen frisch bestätigt; erster lesender Workflow-Quellabruf503, ein erfolgreicher weiterer Abruf danach, kein Workflowretry. Historischer P43637658561 bleibt getrennt. U1/alte Arbeitsbäume/Sicherungen/Code17 erhalten; D3 nur lokale Nachkontrolle, nicht nachpushen. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag vorhandenen P2-Prepare-SDK-Detailfehler ausschließlich lesend einholen/zuordnen; keine Tests/Neuinstallation/Korrektur. Folgende Abschnitte historisch.

## T-006: PR4 regulär integriert, eigene W2-main-CI grün (15.11.2026)

[PR4-Merge und eigene W2-main-CI](PR4_MAIN_CI_NACHKONTROLLE.md): Besitzer führte den autorisierten regulären UI-Merge aus. PR4Merged, tatsächliches main-W2 `87c83fedf5c1aa52450ee36f650134c442928c28` und öffentliche Eltern W/K belegt; Entwicklung/PR4-headK erhalten. Letzte Refkontrolle 05:35:46 MEZ. Kein synthetischer PR-Mergeref als W2 vorweggenommen; lokale Q/R-Nachfolger nicht übertragen. W2 fehlt lokal als Gitobjekt, kein Fetch/Checkout.

Neue **ci.yml43676620317 / exakt W2 / push / main / Versuch1 / Success**,10m31s. Öffentliche Summary: **1372 Vitest ohne Fehler/Skips,379 Playwright (9.0m)**. Vollständiger Summary-Commitlink und Workflowdateiquelle W2 getrennt von nicht gelesenen API-/Runnerdaten. Eigener W2-Gate statt Branch-/PR-/Docs-Ausnahme. Unabhängige M-CI43601398931/M/push/main/Versuch1Success erneut gelesen, nicht gestartet. W2-Helper717Zeilen gleich geprüftem K/R-Helper.

D2 nur neuer lokaler Dokumentationsabschluss, nicht nachpushen. Keine lokalen Tests/Builds, manuellen Workflows, Signier-/Play-/Cloud-/Geräteaktionen. Erlaubte bestehende automatische main-CI/gegebenenfalls main-Webautomatik getrennt; tatsächliche Webveröffentlichung nicht separat belegt. U1/alte Arbeitsbäume/Sicherungen/Code17 erhalten; kein U2/H2/HP/A/S, alte P-Rohinputform unbekannt. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag einmaligen secretfreien prepare-Prüflauf mit M/W2 starten und nachkontrollieren, erst nach neuer separater Freigabe; folgende Abschnitte historisch.

## T-006: PR4-main-Integration konkret vorbereitet, nicht freigegeben (15.11.2026)

[Konkreter PR4-main-Integrationsplan](PR4_MAIN_INTEGRATION_PLAN.md): Saubere Basis Q `1d014c2`, K/M als Vorfahren bestätigt; aktuelle Refs Entwicklung/PR4-head=K `77316d69d637c0445cf5d2f4dada37c23011a70f` und main=W `741fb7b09f0a442d779aaed192bd223724d3523f` belegt. PR4 Open/Zielmain; Push-CI43664473155 und PR-CI43666843700 erneut lesend Success/Versuch1/1372Vitest ohne Fehler/Skips und379Playwright. Vollständiger übernommener W...K-Vergleich mit lokalem L→K-Diff inhaltlich gleich, aktuelle Vergleichsansicht weiterhin7Commits/16Dateien. Kein neuer direkter PR-Rohdiffdownload behauptet.

Vorlage bindet späteren regulären unmittelbaren Merge-Commit an frische Quellen, erfüllte Serverregeln und eigene exakte push/main/ci.yml für tatsächliches W2. No reviews/leere Rulesets sind keine Schutzfreigabe; klassische Schutz-/Konflikt-/angemeldete Bedingungen und PR-Runtime-SHA bleiben unbekannt. Synthetischer Mergeref1f97… nicht W2. App-M behält unabhängigen Quell-CI-Gate, keine Docs-Ausnahme.

Alle sechs Workflowdefinitionen unverändert. Mögliche bereits bestehende main-Webautomatik muss in künftige Integrationsfreigabe eingeschlossen sein; keine Cloudänderung. R nur neue lokale Planungs-/Statusdokumentation, nicht nachpushen. Keine Tests/Builds/CI wiederholt, kein Merge/PR-Schreiben oder prepare/sign/Play-/Secret-/Geräteeingriff. U1/alte Sicherungen/Code17 erhalten; U2/H2/HP/A/S fehlen. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag reguläre PR4-Integration samt neuer W2-main-CI-Nachkontrolle erst nach separater Beauftragung; folgende Abschnitte historisch.

## T-006: regulärer PR4 offen, eigene PR-CI grün (15.11.2026)

[Regulärer Schemafix-PR4 und neue PR-CI](SCHEMAFIX_PR4_T006.md): Besitzer führte den vorgesehenen normalen UI-Handgriff aus. PR4 Open, Quelle Entwicklung/K `77316d69d637c0445cf5d2f4dada37c23011a70f`, Ziel main/W `741fb7b09f0a442d779aaed192bd223724d3523f`. Frische Gitrefs bestätigen Entwicklung/PR4-head=K und main=W. Lokaler Ausgang N `a16ac724` nicht übertragen. Vollständiger öffentlicher W...K-Vergleich mit lokalem L→K-Diff inhaltlich abgeglichen: 7 Commits/16 Dateien/713+2−, nur Dokumentation/Helper-/Testfix. Zusätzlicher direkter PR-.diff-Download scheitert nach Weiterleitung an Tunnel403; Vergleichsbeleg und PR-Dateiansicht bleiben getrennt gesichert.

Neue CI **43666843700 / ci.yml / pull_request opened #4 / Entwicklung / Versuch1 / Success**, 9m51s. Öffentliche Summary: **1372 Vitest ohne Fehler/Skips, 379 Playwright (8.7m)**. Workflowdateiquelle und Checksansicht K; API-run.head_sha/Runnercheckout unbekannt. Synthetischer PR-Mergeref `1f97d8d2…` ist weder main-W2 noch bestätigter Checkout. Bestehende K-Push-CI43664473155 separat grün erhalten, nicht wiederholt.

Öffentlich No reviews/leere Rulesets sind keine Schutz-/Mergefreigabe; klassische Schutz-/Konflikt-/angemeldete Serveranforderungen nicht unabhängig lesbar. APIForbidden nicht repariert, keine PR-Schreibprobe/Auth-/Cloud-/Secret-/Playaktion. Heute keine lokalen Tests/Builds, kein Merge/Push oder manueller AAB-Aufruf. U1/alte Sicherungen/Code17 erhalten; kein U2/H2/HP/A/S. Q nur lokaler Abschluss, nicht nachpushen. T-006/V-014 IN_ARBEIT, E-002–E-005/weitere Freigaben offen. Genau nächster eigener Auftrag PR4-main-Integration ausschließlich lesend konkret vorbereiten; noch keine Integrationsfreigabe. Folgende Abschnitte historisch.

## T-006: Prepare-Schemafix gepusht, eigene Branch-CI grün (15.11.2026)

[Schemafix-Push und neue CI-Nachkontrolle](CODE18_SCHEMAFIX_BRANCH_PUSH_T006.md): Genau ein normaler Fast-forward-Push von K `77316d69d637c0445cf5d2f4dada37c23011a70f` auf Entwicklung erfolgreich. Frische Refs vorab L/W, danach und zuletzt um 01:55:13 UTC Entwicklung=K und main=W `741fb7b09f0a442d779aaed192bd223724d3523f`. Vollständiger Übergabediff 16 Dateien/713+2−, nur Dokumentation und belegter Helper-/Testfix. Alle sechs Workflows unverändert, keine lokalen Tests/Builds wiederholt.

Neue CI **43664473155 / ci.yml / push / Entwicklung / exakt K / Versuch 1 / Success**, 10m 3s. Öffentliche Summary: **1372 Vitest bestanden, 0 Fehler/Skips; 379 Playwright bestanden (8.8m)**. Workflowdateiquelle K und HTML-Commitlink belegt; API-head_sha/Runnercheckout nicht eigenständig ausgelesen. Kein PR-Lauf oder main-Ersatz. Öffentliche PR-Liste weiterhin 0 offen/3 geschlossen; kein PR erstellt.

N nur neuer lokaler Dokumentationsnachfolger, nicht nachpushen. M bleibt Appquelle, W main-Workflowquelle; K ist nicht neue main-Quelle. Kein prepare/sign gestartet, kein U2/H2/HP/A/S. U1, alte Arbeitsbäume/Sicherungen/Code17 erhalten; P-Runtimeform unbekannt. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag: neuen regulären PR K→main/W vorbereiten und erstellen, ohne Merge; separate Beauftragung nötig. Folgende Abschnitte historisch.

## T-006: Prepare-Defaults gezielt lokal korrigiert (15.11.2026)

[Lokale Eingabeschema-Korrektur und Offlinebelege](CODE18_INPUTSCHEMA_KORREKTUR_T006.md): Ausgang I `6fa3af1` sauber bestätigt und gesichert. Vor Fix sieben neue Testmethoden am unveränderten Helper: 32 erwartete INVALID_SCHEMA-Fehler für ausgelassene optionale Prepare-Felder und den zugehörigen Resolve-Pfad. Drei zusätzliche Helperzeilen ergänzen nur bei prepare fehlende optionale leere Defaults. Pflichtfelder, unbekannte Schlüssel, Typprüfungen, sign-Bindungen und sämtliche M-/W-/main-/CI-/Versuchs-/Artefaktgates bleiben strikt. Keine Workflowänderung.

Nach Fix **35 ProtocolTests + 5 gezielte Workflow-Grenztests grün**, keine Skips. Künstliche Werte/Attrappen; keine echte Signierung oder neuer Runnernachweis. Unveränderte Java-/Produkt-/Web-/Browser-/Android-Suiten nicht wiederholt. Tatsächliche Runtimeform von P43637658561 bleibt unbekannt; kein GitHub-Mobile- oder Nutzerfehler behauptet.

Neuer Fix-/Dokumentationsabschluss K ausschließlich lokal, exakte SHA in RESULT.json der Sicherung `/workspace/anker-t006-aab-inputschema-fix-20261115/`. Kein Push oder Workflowstart. M/W/L bleiben historisch getrennte Quellen; aktuelle Remote-Refs heute nicht abgefragt. U1, alte Arbeitsbäume/Sicherungen und Code17 erhalten. Kein U2/H2/HP/A/S. T-006/V-014 IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster eigener Auftrag: einmaliger begrenzter Entwicklungsbranch-Push K samt automatischer CI-Nachkontrolle nach frischen Ref-/Quell-/Triggerprüfungen; keine main-Integration oder prepare/sign-Freigabe. Folgende Abschnitte historisch.

## T-006: Resolve-Schemaabbruch durch Screenshot zugeordnet (15.11.2026)

[Resolve-Schema-Befund und begrenzter Folgeplan](CODE18_RESOLVE_SCHEMA_BEFUND_T006.md): Der Nutzerscreenshot zu P43637658561/Versuch 1 zeigt `AAB-Prüfung abgebrochen: INVALID_SCHEMA`. Der unveränderte Helper aus W wurde öffentlich vollständig mit dem lokalen Code abgeglichen. Der Abbruch liegt in `invocation()`/Zeile 111, vor der GitHub-Konstruktion und den CI-Abfragen: Das geparste Eingabe-JSON ist kein Objekt oder hat eine andere Schlüsselmenge als die acht verlangten Felder. Die tatsächliche Eingabeform und konkrete fehlende oder zusätzliche Felder bleiben unbekannt.

Der Parser verlangt auch für prepare alle fünf optionalen Signierfelder. Die bisherigen positiven Test-Fixtures setzen sie immer ausdrücklich. Ausgelassene optionale Felder sind damit eine gezielt zu untersuchende Vertrags-/Abdeckungslücke; ihr Fehlen im echten P-Payload ist nicht belegt. Kein Nutzerfehler, falscher SHA-Wert, CI- oder Netzwerkfehler wird daraus abgeleitet. Heute keine Korrektur, Testausführung oder Wiederholung des Workflows.

P bleibt fehlgeschlagen; prepare/sign/verify wurden übersprungen. U2/H2/HP/A/S fehlen. H bezeichnet den Ausgang, I den neuen ausschließlich lokalen Dokumentationsabschluss; W/M bleiben getrennt. Aktuelle Remote-Refs wurden heute nicht erneut abgefragt. U1, alte Arbeitsbäume, Sicherungen und Code17-Nachweise bleiben erhalten. T-006/V-014 bleiben IN_ARBEIT, E-002–E-005 und weitere Freigaben offen. Genau nächster separat zu beauftragender Auftrag: Eingabeschema gezielt lokal untersuchen und ausschließlich den kleinsten durch Vertrag und Offlinefälle belegten Fehler beheben. Kein Push oder Workflowstart. Die folgenden Abschnitte beschreiben historische Stände.

## T-006: erster prepare-Lauf in resolve abgebrochen (14.11.2026)

[Erster prepare-Lauf und Abbruchbeleg](CODE18_PREPARE_NACHKONTROLLE_T006.md): P43637658561 / workflow_dispatch / main / WorkflowW741fb7b / Versuch1 **Failure nach9s**. Resolvefailed im Schritt „Exakte getrennte main-CI für M und W prüfen“,prepare/sign/verifyskipped;keine Artefakte/U2/H2/HP/A/S. Angefordert war ausschließlichprepare mitApp-M10cc894a/W741fb7b und leerenSignierbindungen; tatsächlicheInputstrings nicht unabhängig öffentlich ausgelesen. Kein Appcheckout/Build/Unsigned-Prüferfolg behauptet.

Öffentlich nur `Process completed with exit code 1.`. Resolve-DetailseiteHTTP200/`Sign in to view logs`;eigentlicheUrsache unbekannt. BekanntegrüneM-/W-main-CI nicht mit diesem rotenPrepare-Lauf gleichsetzen. Kein Fix/Neustart oder Signieraufruf.

Gnur Ausgang,Hnur lokalerAbschluss,nichtpushen. U1/alteArbeitsbäume/Sicherungen/Code17 erhalten;T-006/V-014 IN_ARBEIT,E-002–E-005 und weitereFreigabenoffen. Genau nächster eigenerAuftrag vorhandenenResolve-Detailfehler ausP ausschließlichlesend einholen/zuordnen;keine erneuten bekanntenMetadatenfragen. FolgendeStände historisch;danachstoppen.

## T-006: PR3 regulär integriert, eigene W-main-CI nachkontrolliert (14.11.2026)

[PR3-Merge und neue exakte main-CI](PR3_MAIN_CI_NACHKONTROLLE.md): PR3Merged, tatsächlichesW `741fb7b09f0a442d779aaed192bd223724d3523f` mit ElternM/L und EntwicklungsheadL erhalten. Neue ci.yml43622275785 / exaktW / push / main / Versuch1 **erfolgreich**. Öffentliche Summary: 1372 Vitest bestanden / 0 Fehler / 0 Skips; 379 Playwright bestanden (9.4m).

Appquelle bleibtM `10cc894a27302a5a49b6884c843d2a6b509ab354`,eigener M-CI43601398931/push/main/Versuch1/Success heute erneut gelesen. Workflowdateien ausW entsprechen den geprüften L-Quellzeilen; W noch kein lokales Gitobjekt,kein Fetch/Checkout. AusgangF nicht übertragen, neuer AbschlussG nur lokal. Kein Ersatz durch Branch-/PR-Grün und keine Docs-Ausnahme.

Besitzer führte den erlaubten normalen UI-Merge nach API-Forbidden/fehlenderAgentensteuerung aus. Nur bestehende automatische main-CI/Webbuild/Artefakte und gegebenenfalls bestehende main-Webautomatik freigegeben; tatsächlicheWebveröffentlichung nicht separat belegt. Kein manueller AAB-Dispatch,Signieren,Play-/Cloud-/Geräteeingriff oder lokaleTests/Builds. U1/alteArbeitsbäume/Sicherungen erhalten; U2/S fehlen.

Main-Integration belegt; T-006/V-014 IN_ARBEIT,E-002–E-005 und Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. Genau nächster eigener Auftrag einmaligen secretfreien prepare-Prüflauf aus M mit Workflow W starten und U2-Nachweise nachkontrollieren,separate Beauftragung nötig. Folgende Stände historisch;danach stoppen.

## T-006: PR3-main-Integration konkret geplant, noch nicht freigegeben (14.11.2026)

[Neue PR3-main-Integrationsvorlage](PR3_MAIN_INTEGRATION_PLAN.md): saubere lokale BasisE1231b3d, aktuelle Refs Entwicklung/PR3-headL3f5345dd und main/App-M10cc894a bestätigt. PR3Open; vorhandene PushCI43614039702 und PRCI43616437865 weiterhin Success, jeVersuch1/1372Vitest/379Playwright. Vollständiger M→L-Diff3Commits/17Dateien/2308+2− abgeglichen; lokale Dokumentationsnachfolger nicht im PR. Keine Tests/CI/Builds wiederholt.

Regulärer späterer Merge-Commit nur nach neuer Integrationsfreigabe und erfüllten Serverbedingungen. No reviews/öffentliche leereRulesetsseite sind keine Schutz-/Reviewfreigabe; klassischerBranchschutz/Konflikt-/angemeldeteAnforderungen und PR-Runtime-SHA bleiben unbekannt. Tatsächlichesmain-W erst nach Merge bestimmen,0874-Mergeref nicht vorwegnehmen; exakte erfolgreiche push/main/ci.yml fürW und getrenntesM-Gate erhalten. Kein Docs-Ersatz. Eine mögliche bestehende main-Webautomatik muss die neue Freigabe ausdrücklich einschließen.

Heute nur Planung/Status lokal committen und sichern, kein Nachpush/Merge/AAB-Dispatch/Signieren/Play-/Cloud-/Geräteeingriff. U1/alteArbeitsbäume/Sicherungen erhalten; W/U2/S fehlen. T-006/V-014 IN_ARBEIT,E-002–E-005 und weitere Freigaben offen. Genau nächster separat zu beauftragender Auftrag: PR3 regulär als Merge-Commit integrieren und eigene main-CI für tatsächlichesW nachkontrollieren, einschließlich unveränderter Automatik nur im ausdrücklich neu freigegebenen Umfang. Folgende Stände historisch; danach stoppen.

## T-006: regulärer PR3 offen, CI nachkontrolliert (14.11.2026)

[PR3 und CI-Nachkontrolle](AAB_ENTWURF_PR3_T006.md): Besitzer hat den normalen UI-Handgriff ausgeführt; [PR3](https://github.com/frnkrm/anker/pull/3) Open, QuelleL `3f5345dd08032aa6d19328a2c2cee22527150266`, Zielmain/AppquelleM `10cc894a27302a5a49b6884c843d2a6b509ab354`. Lokaler AusgangD `a72741d5985ae67d3c790017a9099e8e38d20856` nicht übertragen. Neuer ci.yml-Lauf43616437865 / pull_request opened#3 / Entwicklung / Versuch1 **erfolgreich**. Öffentliche Summary: 1372 Vitest bestanden / 0 Fehler / 0 Skips; 379 Playwright bestanden (8.8m).

Workflowansicht referenziert ci.yml ausL; PR-Checks wählenL. Synthetischer Mergeref `0874d430eea96a7f7f521e26a03d0d2a30ee05cb` separat beobachtet, tatsächliches API-run.head_sha und Runnercheckout öffentlich nicht ausgelesen. Kein Gleichsetzen mitmain/W. No reviews; klassischer Branchschutz/Konfliktstatus/angemeldete Serveranforderungen öffentlich unbekannt, keine Freigabe daraus. APIForbidden/fehlendeBrowsersteuerung nicht repariert; kein Doppel-PR, Push, Merge, AAB-Dispatch, Signieren oder Play-/Cloud-/Geräteeingriff.

E nur lokaler Dokumentationsabschluss/Sicherung, nicht nachpushen. U1/alteArbeitsbäume/Sicherungen unverändert, W/U2/S fehlen. T-006/V-014 IN_ARBEIT, E-002–E-005 und alle weiteren Freigaben offen. Genau nächster eigener Auftrag: PR3-main-Integration ausschließlich lesend konkret vorbereiten; separate Beauftragung nötig. Folgende Stände historisch; danach stoppen.

## T-006: AAB-Entwurf auf Entwicklungsbranch übertragen (14.11.2026)

[Push-/CI-Nachkontrolle](AAB_ENTWURF_BRANCH_PUSH_T006.md): genau ein Fast-forward-Push von **L `3f5345dd08032aa6d19328a2c2cee22527150266`** auf Entwicklung; main **M `10cc894a27302a5a49b6884c843d2a6b509ab354`** erhalten. PR2 bleibt Merged mit historischem head C; heute kein neuer PR. CI **43614039702**, ci.yml / push / entwicklung/anker-neu / exakt L, Versuch **1**, Ergebnis **erfolgreich**. Die erfolgreiche Entwicklungsbranch-CI ist belegt; ein neuer PR wurde heute nicht angelegt.

Öffentliche Summary: **1372 Vitest bestanden / 0 Fehler / 0 Skips, 379 Playwright bestanden**. API CONNECT403, HTML lesbar; Joblogs verlangen Anmeldung. Keine Authreparatur, keine weiteren Detailzahlen ohne Beleg. Lokale43Offlinefälle bleiben historischer eigener Nachweis; keine lokalen Tests/Builds wiederholt. AAB-Workflow nicht gestartet, kein Signieren/Play-/Cloud-/Geräteeingriff. U1/alte Arbeitsbäume/Sicherungen erhalten. D nur lokaler Abschluss, nicht nachpushen; L ist nicht künftiges main-W, U2/S fehlen.

T-006/V-014 IN_ARBEIT, E-002–E-005 und main-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. Genau nächster eigener Auftrag: neuen regulären PR für den AAB-Workflowentwurf vorbereiten und erstellen, ohne Merge; separate Freigabe erforderlich. Folgende Stände historisch; danach stoppen.

## T-006: manueller AAB-Workflow lokal entworfen und offline geprüft (14.11.2026)

[Lokaler Entwurfs-/Prüfnachweis](CODE18_AAB_WORKFLOW_ENTWURF.md): saubere Basis3fbc6541,Branchentwicklung/anker-neu. Neuer ausschließlicher main/workflow_dispatch-Workflow mit getrennten prepare/sign-Aufrufen,festem App-M,separatem künftigem W,exakten M-/W-main-CI-Gates und Run-/Versuch-/Artefakt-/Archiv-/AAB-/Metadatenbindung. Kein Appcode/Buildartefaktcode im Signierjob,nur W-Prüfcode und bekannteWerkzeuge;vierSecretreferenzen ausschließlich im tatsächlichen Signierschritt,keine Verfügbarkeitsabfrage/kein unsigned Fallback. Secretfreies vollständiges JAR-/B4-/U2↔S-Payloadverify vor finalem Prüfarbeitsartefakt. Bestehende APK-/Release-/Play-/Code17-Pfade unverändert;ci.yml nur JDK21/gezielte neue Offlineprüfungen ergänzt.

**43/43 Offlinefälle grün** (29Protokoll/JAR-Grenzen,14Workflow/YAML/Shell/Struktur),0Skip. Echte Java-Unsigned-/Signed-required-Negativgrenze ohne Schlüssel,positive Signierfälle ausschließlich gemockt.17vorhandeneWerkzeugJARs hashgebunden/offline geprüft;neue Hilfen lesend mit U1 kompatibel,Hash74e65b1a…de050d50 unverändert. Actionlint nicht verfügbar,nicht installiert;kein neuer GitHub-/Runner-/B4-Signierbeleg. Kein Appbuild,echteSignierung,API-/Secret-/Cloud-/Play-/Geräteaktion oder Push.

Lokaler Abschlusscommit L und Sicherung `/workspace/anker-t006-code18-aab-entwurf-20261114/`,nicht übertragen. L ist nicht W,M bleibt10cc894;U2/S existieren nicht. AlteArbeitsbäume/Artefakte/Sicherungen und zurückgestellteUmgebung835235b erhalten. T-006/V-014 IN_ARBEIT,E-002–E-005/Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. Genau nächster eigener Auftrag einmaliger begrenzter Entwicklungsbranch-PushL nach frischer Quellen-/Triggerprüfung und neue CI lesend nachkontrollieren,erst nach separaterFreigabe samt bestehenderPush-/Previewautomatik. Keine neueAAB-Dispatch-/main-/Signierfreigabe. Folgende Abschnitte historisch;danach stoppen.

## T-006: konkreter AAB-Signierweg nur geplant (14.11.2026)

[Konkreter Code18-AAB-Signierwegplan](CODE18_AAB_SIGNIERWEG_PLAN.md) aus sauberem Ausgangse3ef74fa: U1/54.264.632Bytes/SHA25674e65b1a…de050d50 und vorhandene M-CI-/Paketbelege lokal bestätigt,keine externe Abfrage oder erneute Suite/Build/Signierprobe. APK-Update/sign-local/Tagrelease sind keine AAB-Signierer; alter Publisher und Code17-Manifeste sind fest gebunden und bleiben unverändert.

Neuer manueller Zwei-Modus-Workflow ist ausschließlich **geplant**, nicht angelegt: prepare ohne Secrets erzeugt eigenes U2 aus exakt M; dessen Hash/Metadaten/Run-/Artefakt-ID werden vor separat freizugebendem sign festgelegt. Isolierter B4-Keygebrauch erst dann,secretfreie vollständige JAR-/Nutzlast-Verifikation danach. Lokales U1 und Runner-U2 nicht gleichsetzen; W erst nach regulärer späterer Integration/CI benennen. M-main-CI bleibt eigenständiger exakter Gate,keine Docs-Ausnahme. B4Upload/8APlay-App und unbekannter Secret-/Keyzugriff getrennt;keine bekannten Metadatenfragen wiederholen.

Nur neue Dokumentation lokal committen/sichern `/workspace/anker-t006-code18-aab-signierplan-20261114/`,nicht pushen. Originalartefakt/Code17-Guards/Workflows/Produktquellen/alte Arbeitsbäume/Sicherungen unverändert;keine Schlüssel-/Wertsuche oder Auth-/Cloud-/Play-/Geräteaktion. T-006/V-014 IN_ARBEIT,E-002–E-005/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. Genau nächster separat zu beauftragender Auftrag: lokalen neuen AAB-Workflow-/Prüfhelferentwurf mit gezielten Offlineprüfungen und CI-Einbindung erstellen;kein Appbuild/Signierung/Workflowstart/Übertragung. Folgende Stände historisch;danach stoppen.

## T-006: korrigiertes unsigniertes AAB aus geprüfter main-Quelle lokal belegt (14.11.2026)

[Frischer unsignierter AAB-Nachweis aus main M](MAIN_CODE18_AAB_PRUEFBUILD_T006.md): isolierter neuer Arbeitsort `/workspace/anker-main-code18-aab`,Branchentwicklung/anker-neu,Buildquelle **10cc894a27302a5a49b6884c843d2a6b509ab354**,sauber vor/nach Bau. Vorherige717559ab-Dokumentation und altes4f-Repository/Sicherungen unverändert. Genau ein neuer freigegebener Clone ohne Tags,Quell-M-Bundle geprüft; keine alten Produktpatches. Code18/rc.4/Paket/SDK/Rechte/Signierlogik unverändert.

Frischer Web-/Capacitorstand stabil e9c124…nach notwendiger Generator-Konsistenzrunde. Guard/Dryrun/Workerbytecode/143Classpath-JARs belegen Nullsignierbindung und keinen Signiertask. Fehlende bestehende Mavenbibliotheken ohne Versionsänderung nachgeladen; finaler Paketbuild51s grün **mit normaler Dependencyauflösung, nicht offline**. Neues AAB **54264632Bytes,SHA256 `74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`**,Bundletool/ZIP/JAR/Assets/Manifest/ELF grün,672Einträge ohne Signierer.71Web-/75Generatorassets bytegleich,31Rechte/SDK26/36/36,8ELF64PT_LOAD16KB. Kein APK/Signieren/Installieren/Play-/Cloud-/Workflow-/Remote-Schreibeingriff.

Nur Dokumentation lokal committen/sichern `/workspace/anker-main-code18-aab-pruefung-20261114/`,nicht pushen. BuildquelleM vom Abschlusshead trennen. Historisches014-AAB enthält den Fix nicht und wurde nicht wiederhergestellt; Code17-Freigaben erhalten. M-CI43601398931/379Browser/1372Vitest sowie274historischeJUnit bei Quellgleichheit erhalten,keine Vollsuite/Gerätebeobachtung neu. T-006/V-014 IN_ARBEIT,E-002–E-005/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. Genau nächster Auftrag signierten Code18-AAB-Prüfweg ausschließlich lesend konkret planen;keine Schlüssel/Secrets/externe Abfrage oder Aktion. Folgende Einträge historisch;danach stoppen.

## T-006: NFC-Navigationsrace lokal korrigiert, noch nicht gepusht (14.11.2026)

Saubere verfügbare Basis `1b1bce8b964acfc89c032cd04f60d18e718be380`, Branch `entwicklung/anker-neu`. [NFC-CI-Korrektur mit Rot-/Grünnachweis](NFC_CI_KORREKTUR_T006.md): BrowserRouter schreibt History vor React-Transition/Unmount; bisheriges live-/Epochsignal lässt da noch ein verspätetes Ja passieren. Neue Regression löst vorhandene künstliche Bestätigung gezielt beim echten Mehr-Link/Historywechsel auf. Vor Fix alter Fallgrün/neuerFallrot mit demselben `/vorbereitung`statt`/mehr`; reale Produktlücke statt bloßer Testwarteannahme belegt. Nur NfcAnchors.tsx um vorhandenen Routerpfad/-entry-key in gemeinsamer Gültigkeitsprüfung ergänzt; ein Regressionstest hinzu, alte Erwartungen unverändert. Keine zweite Engine, Messung, Persistenz oder Native-/Store-/Reminderänderung.

Nach Fix18/18NFC-Browser,31/31TS-Brücken-/Datenschutzfälle, Lint0Fehler/1bekannteWarnung, Typecheck/Webbuild grün. Kein Retry/Skip/Timeoutlockern, Vollsuite oder nativeJUnit wiederholt. E-002–E-005 weiterhin echte Geräteabnahmen offen. Neue Webquellkennung `e9c1249900f449001be6dfb80674a5fe9b2b27af8d2cabf195dba9b2ab654b99`. Code18/1.5.0-rc.4 unverändert; altes AAB Quelle014870f3/7608…enthält den Fix nicht, bleibt historisch. Kein Capsync/APK-/AAB-Neubau und keine neue Paket-/Signier-/Uploadfreigabe.

Nur lokal committen und sichern `/workspace/anker-t006-nfc-fix-20261114/`; exakte finale SHA/Dateihashes im Abschlussmanifest, Arbeitsstand nach Prüfung quellengebunden. Heute keine Remoteabfrage/Übertragung/Workflow-/Cloud-/Secret-/Play-/Geräteaktion. Letzter gepushter H1847c8a samt rotem Push-/grünem PR-Lauf bleibt historisch, neue lokale Tests sind keine neue Remote-CI. T-006/V-014 IN_ARBEIT; main-/Paket-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen. Alte Umgebung/835235b zurückgestellt, alte Code17-Manifeste erhalten. Genau nächster eigener Auftrag erneuter begrenzter Entwicklungsbranch-Push exakt des korrigierten Abschlusscommits samt dadurch ausgelöster unveränderter CI/gegebenenfalls bestehender Previewautomatik und lesender Nachkontrolle; neue ausdrückliche Beauftragung nötig. Keine erneuten Metadatenfragen, jetzt stoppen.

## T-006: Entwicklungsbranch H übertragen, main erhalten (14.11.2026)

Sauberer Ausgangs-/Übergabehead **`1847c8a041432d41a4598f5ab2e6d99540f8ddac`**, Branch `entwicklung/anker-neu`. Aktuelle Sollrefs vorab bestätigt, Vorfahren-/Quell-/Workflow-/Hookprüfung und Vorher-Bundle grün. [Push und neue CI-Nachkontrolle](GITHUB_BRANCH_PUSH_CODE18.md): genau ein normaler Fast-forward-Push erfolgreich, danach Entwicklung/PR2-head exakt H und main unverändert `e48d2892846b4a2fec45bf0cefc396e1a4c92f10`. Jetzt32lokale Nachfolger/121Dateien und Versionsquelle014870f3 auf Entwicklungsbranch nachgewiesen; nicht auf main integriert. Kein zweiter Push/Tag/Fetch/Checkout oder PR-Schreibzugriff. Lokaler origin-Cache unverändert; angezeigte ahead-Zahl nicht mit frischem ls-remote-H verwechseln.

API weiterhin Forbidden/CONNECT403, aber unveränderte lesende GitHub-HTML-Anfragen liefern HTTP200. PR2 dort Open, Entwicklung→main,33Commits bestätigt. Neue CI: [Push43549032956](https://github.com/frnkrm/anker/actions/runs/43549032956),headSHA H; [PR43549036157](https://github.com/frnkrm/anker/actions/runs/43549036157),synchronize#2/Entwicklung,Titelanker@1847c8a. Status-/Dauer-/Quellgrenzen im Bericht; PR-Checkout-SHA/Versuch aus sichtbarer Summary nicht eigenständig geliefert. Nicht die synthetische PR-Mergeref oder alte6dfa632-CI gleichsetzen. HTML ist jetzt belegter lesender Nachkontrollweg, keine erneuten Nutzer-/Secretfragen oder Auth-/Cloudreparatur.

Aktuelle CI-Endergebnisse: Push43549032956 **Failure**,10m28s,1372Vitestgrün und377Browsergrün/1NFCrot; PR43549036157 **Success**,11m57s,1372Vitest/378Browsergrün. Pushannotation e2e/nfc.spec.ts:158:22: nach Verlassen/verspätetem Ja statt `/mehr` unerwartet `/vorbereitung`. Ursache nicht geprüft, keine Fix-/Rerunfreigabe in diesem Auftrag; aktueller Integrationsblocker trotz grünem PR-Lauf erhalten. Genau nächster eigener Auftrag nur gezielte lokale Untersuchung und belegte minimale NFC-Korrektur/Regression, kein weiterer Push oder neue Funktion. Keine erneuten Metadatenfragen.

Vorhandenes unsigned Code18-AAB bleibt an **`014870f3ee52c0233118d2852ef0719aa9bc602b`** gebunden, nicht als Datei mitgepusht oder neu gebaut. Exakte main-Push-CI/Signier-/Upload-/Geräte-/Release-/Gesamtfreigaben offen; T-006/V-014 IN_ARBEIT, E-002–E-005 OFFEN. Alte Code17-Manifeste, Produkt-/Versions-/Workflowquellen und zurückgestellte Umgebung/835235b erhalten. Durch den erlaubten Push ausgelöste bestehende CI separat von lokalen Grenzen; keine lokalen Tests/Builds, Fixes/Neustarts, Signier-/Installations-/Secret-/Cloud-/Playaktionen. Abschlussdokumentation nur lokal committen/sichern `/workspace/anker-t006-branch-push-20261114/`, nicht nachpushen. Finale lokale Commit-ID und genau nächster Auftrag im Sicherungsmanifest; danach stoppen.

## T-006: GitHub-Übergabe konkret vorbereitet, nicht ausgeführt (14.11.2026)

Sauberer Ausgangshead `08813c644373302975bdf3bd250972464b00ef11`, Branch `entwicklung/anker-neu`. [Konkrete GitHub-Übergabevorlage](GITHUB_UEBERGABE_CODE18_PLAN.md): gegenüber lokal vorhandener, zuletzt am14.11.2026um01:59–02:00UTC bestätigter Entwicklungs-SHA6dfa632 zunächst31Commits/120Dateien (67src/19e2e/10Android/20docs/4Root), jetzt ausschließlich Übergabedokumentation hinzu. Keine heutige Remoteverfügbarkeitsbehauptung oder externe Abfrage. F-001–F-010, lokale Tastaturtestnachbereitunge421ee5, Integration/Code18-Version enthalten. Dependencygraph ohne Rootversionen, fünf Workflows, SDK-/Capacitorvorgaben und alte Code17-Freigabemanifeste gleich Vergleichsbasis. Quelle014870f3 bleibt von vorgesehenem finalem Übergabehead H und künftiger Branch-/PR-/main-CI getrennt; seit Quelle nur Dokumentationsdiff. Vorhandenes unsigned Code18-AAB in Datei/Größe/SHA bestätigt, nicht neu gebaut oder in Git aufgenommen.

Konkrete noch nicht ausgeführte Ein-Ref-Pushvorlage, frische Zielrefprüfung, Abbruch bei Abweichung, anschließender PR-/CI-Abgleich und separate main-/Signier-/AAB-/Uploadentscheidungen dokumentiert. Automatische Push-/PR-CI und mögliche unveränderte externe Preview-Automatik müssen in eine spätere Pushfreigabe eingeschlossen sein. API-CONNECT403 ist kein zusätzlicher erfundener Gate für einen auf aktuell bestätigten Refs ausdrücklich erlaubten Branch-Push; PR-/CI-Belege blieben dann offen. Keine erneuten CI-/PR-/Secret-/Play-/Besitzerfragen. Exakte main-Push-CI-Gates bleiben; keine Docs-Ausnahme oder alter17-/neuer18-Quelltausch. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamtfreigaben offen.

Nur Planungsdokumentation lokal committen/sichern `/workspace/anker-t006-github-uebergabe-20261114/`: H in HANDOFF_COMMIT.txt/RESULT.json, finale Diffs/Quellen/Nachweise/Bundles/Restore/SHA256. Kein Push/Merge/Tag/Fetch/Checkout, Workflow-/Cloud-/Signier-/Geräte-/Playeingriff, Produkt-/Versions-/Freigabemanifestwechsel oder Test-/Buildwiederholung. Alte Umgebung/835235b zurückgestellt. Genau nächster eigener Auftrag wäre begrenzter aktueller Ref-/PR-/CI-Abgleich und einmaliger Fast-forward-Push exakt H nur auf Entwicklungsbranch samt dadurch ausgelöster unveränderter CI-/gegebenenfalls Previewautomatik; keine main-/Tag-/Signier-/Playfreigabe. Dieser Auftrag ist heute nur vorbereitet, nicht ausgeführt. Danach stoppen.

## T-006: CI-Nutzerzuordnung abgeschlossen, Push-Check rot (14.11.2026)

Saubere Basis `208691836849aed7bb0758175d3e1976f7110842`, Branch `entwicklung/anker-neu`. [Ergänzte CI-Zuordnung](GITHUB_VORAUSSETZUNGEN_CODE18.md): Nutzer nennt zum vorhandenen Lauf43331316553 die SHA `6dfa632c94422d61d6a71c6a4a72c15fefd4a407`; Screenshot der passenden Commitseite zeigt CI/check(push) fehlgeschlagen und fünf erfolgreiche Checks einschließlich CI/check(pull_request). Ergebnisfeld im Text leer, Versuchnummer unbekannt. Screenshot ist Commit-Checkübersicht; Run-ID/Versuch/Gesamtmetadaten nicht eigenständig per API bestätigt. Quelle/Nutzerbericht/Oberflächenbeleg getrennt; kein neuer Fehlergrund aus dem Status abgeleitet.

Diese CI-Rückfrage ist im belegbaren Umfang erledigt, keine weitere Frage nach derselben SHA/dem sichtbaren Ergebnis oder nicht einsehbaren Secrets. Alter CI-Commit6dfa632 bewertet keinen neuen Code18-AAB-Quellcommit014870f3. Dokumentationshead/Artefaktquelle/CI-SHA bleiben getrennt, erfolgreiche exakte main-Push-CI fehlt weiterhin. Secrets/Scopes unbekannt, Signierbarkeit offen. Alte Code17-Manifeste/Code18-Artefaktbindung unverändert; alte Umgebung/835235b zurückgestellt. Nur Dokumentation/Cloud-lokale Sicherung `/workspace/anker-t006-ci-zuordnung-20261114/`, keine externe Abfrage, Tests/Builds oder GitHub-/Signier-/Cloud-/Play-/Geräteaktionen. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag: lokale GitHub-Übergabe anhand vorhandener Diffs/Workflowdefinitionen konkret vorbereiten, Quellen/Push-/PR-Wirkungen und separate Freigaben benennen; keine Übertragung/Workflow-/Signieraktion oder erneute Metadatenfrageschleife. Danach stoppen.

## T-006: GitHub-Oberflächenangaben als Nutzerbericht zugeordnet (14.11.2026)

Saubere verfügbare Basis `def0c5fab72d1a935c5cedc798d2689544442484`, Branch `entwicklung/anker-neu`. [Zuordnung des Nutzerberichts](GITHUB_VORAUSSETZUNGEN_CODE18.md): PR2 Open von Entwicklung nach main; genannter [CI-Lauf43331316553](https://github.com/frnkrm/anker/actions/runs/43331316553), push/entwicklung/anker-neu laut Nutzer. CI-headSHA/Ergebnis mit `?` gemeldet und weiterhin unbekannt. Nicht selbst extern nachgeprüft; kein bestätigter aktueller letzter Lauf/Versuch. Alte Screenshot-Fehlerbelege nicht als aktuelles CI-Ergebnis übernehmen und PR2-head6dfa632 nicht als CI-headSHA einsetzen. Versionsquelle014870f3 bleibt unverändert. Ein Entwicklungsbranch-Push erfüllt auch bei Grün nicht das exakte main-Push-CI-Gate.

Vier Signing-Secrets: unveränderte Auswahlvorlage ist kein Vorhandenseinsbeleg; Scope jeweils nicht einsehbar laut Nutzer. Bestand/Scope unbekannt, keine fehlenden Secrets/Rechte oder Signierbarkeit ableiten. Keine Secrets erneut abfragen oder Konfiguration ändern. Keine eigene externe Abfrage, Tests/Builds oder GitHub-/Workflow-/Cloud-/Signier-/Play-/Geräteaktionen. Alte Umgebung/835235b zurückgestellt, Code17-Nachweise erhalten. Sicherung `/workspace/anker-t006-github-nutzerbelege-20261114/`, nur Cloud-lokal; lokale Dokumentation committen. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag: nur fehlende headSHA/angezeigten Versuch/Ergebnis des bereits genannten CI-Laufs aus vorhandener Nutzeroberfläche zuordnen, keinen Lauf starten und bekannte PR-/Secret-/Playangaben nicht erneut erfragen. Danach stoppen.

## T-006: GitHub-Refs bestätigt, API-Metadaten blockiert (14.11.2026)

Sauberer Ausgangshead `a29ba67ac0fcfac0abe439194075069e62bb45e4`, Branch `entwicklung/anker-neu`; Versionsquelle des unsignierten Code18-AAB bleibt `014870f3ee52c0233118d2852ef0719aa9bc602b`. [GitHub-Bestandsaufnahme](GITHUB_VORAUSSETZUNGEN_CODE18.md): frisches ls-remote bestätigt main `e48d2892846b4a2fec45bf0cefc396e1a4c92f10`, Entwicklungsbranch/PR2-head `6dfa632c94422d61d6a71c6a4a72c15fefd4a407`. Beide neuen lokalen Quellen fehlen in diesen beiden Branchhistorien. Alle fünf Workflowdefinitionen anhand vorhandener Gitobjekte bytegleich an diesen frisch bestätigten Remote-SHAs; kein Fetch/Checkout.

PR-/CI-/Actions-/Secretnamen-/Scope-APIabrufe mit bestehendem Zugriff enden `Forbidden`; zusätzlicher Clientbeleg exakt `curl: (56) CONNECT tunnel failed, response 403`, HTTP=000. Proxy-Transportblockade, keine nachgewiesene GitHub-Rechteentscheidung und kein fehlendes Secret behauptet. Vier ANKER_ANDROID-Secretnamen/Scopes bleiben unbekannt; Workflowreferenzen beweisen keine Verfügbarkeit oder Signierbarkeit. PR2-Refs beweisen keinen aktuellen PR-Status/Review-/Merge-/CI-Erfolg. Exakte main-/Push-CI-SHA-Gates bleiben, keine Docs-Ausnahme. Android-Updateweg erzeugt APK, etabliert keinen signierten Code18-AAB-Prozess; Playworkflow kann bei Dispatch hochladen und ist weiterhin auf alte Code17-Freigaben gebunden.

Nur lesende Erhebung/Dokumentation, API-Teil blockiert; keine Produkt-/Versions-/Workflow-/Manifeständerung oder Tests/Build/Signierung/Geräte-/Playaktion, kein Push/Merge/Tag/Workflowstart/Cloud-/Auth-/Secretwechsel. Alte Umgebung/835235b zurückgestellt. T-006/V-014 IN_ARBEIT; E-002–E-005/Gesamt-/Signier-/Upload-/Geräte-/Releasefreigaben offen. Lokale Sicherung `/workspace/anker-t006-github-voraussetzungen-20261114/`, Abschlusscommit dort gebunden; keine externe Kopie. Genau nächster separat zu beauftragender Einzelauftrag: vorhandene nichtgeheime GitHub-Oberflächenbelege zu PR2/CI und vier Signing-Secretnamen/Scopes vom Nutzer einholen/zuordnen; keine Werte/Schlüssel oder Zugangskonfigurationsänderung. Frühere Abschnitte dokumentieren ihren jeweiligen damaligen Auftrag.

## T-006: Code18/1.5.0-rc.4 lokal umgesetzt und unsigniert geprüft (14.11.2026)

Saubere Ausgangsbasis `0c78c9e814e158e73125556aae2c06fc471feb0d`, Branch `entwicklung/anker-neu`. Versionsquellcommit **`014870f3ee52c0233118d2852ef0719aa9bc602b`** vor jedem Build sauber gebunden: exakt drei Versionsdateien/fünf freigegebene Werte, keine Dependency-/Signierlogik-/SDK-/Rechte-/Produkt-/Workflowänderung. [Neuer Code18-AAB-Nachweis](CODE18_AAB_INTEGRATION_T006.md). Frischer Webbuild einschließlich Typecheck und Capsync erfolgreich, kein getrackter Syncdiff. Neue Appkennung `760868d78627f3450f60361e32bd57e1bdc677777784cc84b87834f375e0ef75`, bisherige552f…Kennung nicht als18umetikettiert.

Neuer18/rc.4-Guard/Präsenz-/Offline-Dryrun und echte null-Signierbindung belegt; PackageBundleTask ohne Signiertask/APK-Erzeugung. Offlinebau1m1s,44Tasks ausgeführt/440wiederverwendet,143AGP-Classpath-JARs/Bundletool1.18.1 unverändert. Bundletool validate/Manifest/Config,672JAR-Dateieinträge ohne Signierer, keine Signaturmetadaten, ZIP-CRC grün. Code18/1.5.0-rc.4/.mobile/SDK26/36/36 bestätigt; vollständiges Manifest nur in Versionsattributen verschieden,31Rechte/Komponenten/Backupregeln/NFCoptional erhalten.71aktuelle Web-/75generierte Assets bytegleich,16Nativebibliotheken/3DEX gleich17,8ELF64PT_LOAD16KBkonform. AAB54.264.513Bytes/SHA256 `d0d5cfedc21e2201329dccf77177040f85884136e0ee44e5ea6ee600acbe282b`. Code17-AAB/Guards/Logs/alte Freigabemanifeste unverändert, alter Rohoutput vor Wiederverwendung separat archiviert. Keine neue Tools/Pakete, keine unveränderte Suite wiederholt;274JUnit/1372TS/378Browser/284Python historisch im belegten Produktumfang erhalten.

Lokale Versionierung18/rc.4 und unsignierter Paketauftrag abgeschlossen; T-006/V-014 insgesamt IN_ARBEIT, E-002–E-005/Gesamt-/Signier-/Upload-/Geräte-/Releasefreigaben offen. Keine Play-Code-Reservierung/Uploadannahme oder neue Remote-CI behauptet. Kein Signieren/Installieren/Push/Merge/Tag/Workflow-/Cloud-/Secretänderung/eigene externe Abfrage oder Geräteaktion. Herkunft Play/Rollen8A-B4 bleiben Nutzerberichte, private Signierbarkeit offen. Neue Sicherung nur Cloud-lokal `/workspace/anker-code18-aab-20261114/`, SOURCE_COMMIT.txt und finale Dokumentationscommit-ID im Abschlussmanifest unterscheiden. Alte Umgebung/835235b zurückgestellt. Danach stoppen. Genau nächster eigener Auftrag zur separaten ausdrücklichen Beauftragung: nur lesende GitHub-Remote-/PR-/CI-/Workflow-/Signing-Secretnamenmetadaten prüfen, keine Werte oder Schlüsseldateien und keine Google-Play-/Schreib-/Build-/Signieraktion; aktuell nicht ausführen.

## T-006: Code18/1.5.0-rc.4 nur vorgeschlagen, Projekt bleibt17/rc.3 (14.11.2026)

Saubere verfügbare Basis `b8306d6337ee4c7f4e8efdbdd82808eb8d8829ff`, Branch `entwicklung/anker-neu`. Nutzer nennt auf die Nachfrage zur vollständigen Bundleliste den höchsten belegten Code17; keine eigene Console-/GitHub-/Secretabfrage. Screenshot zuvor zeigt technische Bundleversion1.5.0-rc.3 getrennt vom Release-Namen, Code17-Testrelease Entwurf/Code16fürinterneTester; Bundlezeilen „Aktiv“ nicht mit aktivem Code17-Testrelease verwechseln. [Konkreter Versions-/Quellvorschlag und getrennte Freigaben](PLAY_PRUEFSTAND_VERSION_PLAN.md): Code18/1.5.0-rc.4 auf Basisb8306d6, ausdrücklich nicht umgesetzt, reserviert oder als später frei garantiert.

Projekt-/Versions-/Freigabedateien bleiben bytegleich auf17/1.5.0-rc.3. Kleinster späterer Umsetzungsumfang wäre genau drei Versionsdateien (package.json, zwei Root-Versionsfelder im Lockfile, Android-Defaults), dann exakter neuer Versionscommit und frischer Web-/Capacitor-/UNSIGNIERTER AAB-Nachweis; alte Code17-Artefakte/Manifeste nicht umetikettieren oder überschreiben. Zukünftige Appkennung/Artefakt-SHA/Versionscommit noch nicht vorhanden. Keine Schlüssel-/Build-/Signier-/Installations-/Remote-/Workflow-/Cloud-/Playaktion oder Testwiederholung. Nur Planung lokal committen/sichern unter `/workspace/anker-t006-versionsplan-20261114/`, finale Commit-ID dort. T-006/V-014/E-002–E-005/Gesamt-/Versions-/Signier-/Upload-/Gerätefreigaben offen, alte Umgebung/835235b zurückgestellt. Danach stoppen. Genau nächster Auftrag zur separaten ausdrücklichen Beauftragung: Code18/rc.4 ausschließlich lokal umsetzen und neuen unsignierten AAB-Prüfbuild erstellen/prüfen, ohne Signieren/Upload/Installieren/Push/Merge/Workflow oder alte Freigabemanifeste zu ändern.

## T-006: lokaler unsignierter AAB-Prüfbuild belegt (14.11.2026)

Saubere verfügbare Basis `f657d2e2dedab71bf0d70c9d88263bab258e9055`, Branch `entwicklung/anker-neu`. [AAB-Prüfpfad, Artefaktmetadaten und Grenzen](AAB_INTEGRATION_T006.md). Offline `:app:packageReleaseBundle` erfolgreich:21Tasks ausgeführt/463wiederverwendet. Vorher Zustand/153generierte Dateien gesichert, Signierpräsenz/Dryrun/AGP-Paketworker geprüft; externer beobachtender Guard erzwingt null-Signierbindung. Separater signReleaseBundle-/APK-Erzeugungsweg nicht ausgeführt, keine Signierkonfiguration verändert oder privaten Schlüssel gesucht/gelesen. Vorhandenes Bundletool1.18.1 validiert das AAB, Manifest/Config ausgelesen.672Dateieinträge ohne Signierer/Zertifikate vollständig gelesen; JAR-Signaturdateien fehlen, ZIP-CRC grün.

Prüf-AAB54.264.513Bytes, SHA256 `c928963f83651306b9a65d21a8fbdb0064e1387eb2f36b5c80901db88410fe1c`, Quellef657d2e, Quellkennung `552f037d8560dcc3fe59b6ae441a0d77484e0ca40b479379a9cbe9be28b043a0`. Paket `.mobile`, unverändert Code17/1.5.0-rc.3/min26/target36/compile36.71Web-/75generierte Assets bytegleich,31Manifestrechte/Backupgrenzen/NFC optional erhalten,16Bibliotheken/3DEX bytegleich bisherigem APK,8ELF64PT_LOAD16KBkonform. APK-zipalign nicht als AAB-Prüfung benutzt. Quellen/Assethashes bereits aktuell, deshalb kein Webbuild/Capsync oder erfolgreiche Suite wiederholt.274historische JUnit und1372TS/378Browser/284Python erhalten, keine neue CI-/Geräte-/Play-Annahme behauptet.

Nur lokaler unsignierter Paketnachweis abgeschlossen; T-006/V-014 insgesamt IN_ARBEIT und E-002–E-005/Gesamt-/Versions-/Signier-/Upload-/Releasefreigaben offen. Code17 ist nur Prüfversion, kein neuer Play-Uploadcode. Historische Code17-Manifeste bytegleich, keine Produkt-/Versions-/Paket-/Workflowänderung. Kein Signieren/Installieren/Push/Merge/Tag/externe Console-/GitHubabfrage/Cloud-/Playeingriff. Galaxy-Herkunft Play und Rollen8A/B4 bleiben Nutzerberichte, private Schlüsselverfügbarkeit/Gerätestand offen. Sicherung nur Cloud-lokal `/workspace/anker-t006-aab-20261114/`, finale Dokumentationscommit-ID im Abschlussmanifest; alte Umgebung/835235b zurückgestellt. Danach stoppen. Damals nächster, inzwischen oben abgeschlossener Auftrag: Versionsentscheidung anhand des höchsten bereits belegten Codes über alle Artefakte/Tracks als Nutzerangabe vorbereiten, ohne Version/Quelle/Freigaben zu ändern oder nächste freie Nummer zu erraten.

## T-006: genutzte Galaxy-App laut Nutzer aus Google Play (14.11.2026)

Saubere verfügbare Basis `d32c0a3ef608df4cf1c17ee287ec9af49161aac5`, Branch `entwicklung/anker-neu`. Nutzerantwort auf die Herkunftsfrage wörtlich „google play“; [Zuordnung und gestufter Prüfweg](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Herkunft als Nutzerbericht erfasst, kein ausgelesener Gerätesignatur-/Versions-/Quellbeleg. Weitere Vorbereitung auf Play-Verteilweg ausrichten; B4-Direkt-APK ist bei gemeldetem Play-App-Signierer8A kein belegtes reguläres Update. Keine Geräteaktion, erneute bekannte Metadatenfrage, eigene Console-/GitHub-/Secret-/API-Abfrage oder private Schlüsselsuche.

Vorhandenes unsigniertes APK belegt, aktueller AAB-Paketnachweis noch offen. Damals nächster, inzwischen oben abgeschlossener Einzelauftrag: lokaler UNSIGNIERTER AAB-Integrationsbuild mit vorhandenen Werkzeugen, unveränderter Version und vorherigem signaturfreiem Tasknachweis. Herkunftsantwort selbst erteilt keine Buildfreigabe. Lokales Code17-Prüfartefakt ist keine neue Upload-/Versionsfreigabe; kein nächster freier Code gewählt, alte Code17-Manifeste erhalten. Aktuell nur Dokumentation lokal committen/sichern unter `/workspace/anker-t006-play-herkunft-20261114/`, finale Commit-ID dort. Kein Build/Signieren/Installieren/Workflow-/Cloud-/Playeingriff oder Testwiederholung. T-006/V-014/E-002–E-005/Gesamtfreigaben offen, alte Umgebung/835235b zurückgestellt. Danach stoppen.

## T-006: Play-App-Signierer8A und UploadsigniererB4 getrennt (14.11.2026)

Saubere verfügbare Basis `f08d6205dbb3fac28526128049571dfcf412c567`, Branch `entwicklung/anker-neu`. Nutzer meldet öffentliches Play-App-Signierzertifikat8A und UploadzertifikatB4; vollständige Fingerabdrücke und [rollengetrennter Abgleich](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Vier vorhandene öffentliche B4-Nachweise entsprechen dem gemeldeten Uploadzertifikat, nicht dem gemeldeten Play-App-Signierer. B4 bleibt historischer Signierer direkt verteilter APKs. Keine eigene Console-/GitHub-/Secret-/API-Abfrage, Geräte- oder neue kryptografische APK-Prüfung. Öffentliche Fingerabdrücke beweisen keinen privaten Schlüsselzugriff.

Ein allein B4-signiertes APK ist kein belegtes reguläres Update einer8A-signierten Installation; höhere Version allein beseitigt diesen Unterschied nicht. Keine passende Signierrotation belegt. Alte Direktinstallationsanleitungen eingeordnet, Code17-JSON-Manifeste bytegleich erhalten; keine Signier-/Versions-/Upload-/Installationsfreigabe. Tatsächlich genutzte Galaxy-Installation weiter nicht zugeordnet. Keine neue Softwarefunktion, Build/Signieren/Geräte-/Cloud-/Workflow-/Playaktion oder Testwiederholung. T-006/V-014 und E-002–E-005/Gesamtfreigaben offen. Lokal committen/sichern unter `/workspace/anker-t006-signierrollen-20261114/`; alte Umgebung/835235b zurückgestellt. Damals nächster, inzwischen oben abgeschlossener Auftrag: ausschließlich Herkunft der tatsächlich genutzten Galaxy-App anhand Nutzerangaben klären, ohne Geräteaktion oder erneute Besitzer-/Console-Entwurfs-/Zertifikatsabfrage.

## T-006: interner Play-Testeintrag als Entwurf zugeordnet (14.11.2026)

Saubere verfügbare Basis `37bc7b97972f47144331d488fb35a1d45564f57e`, Branch `entwicklung/anker-neu`. [Neue Nutzerangaben und Beleggrenzen](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md): Paket `de.frnkrm.anker.mobile`, Code17, gemeldeter Versionsname wörtlich `Anker 1.5.0-rc.3 · Code17`, Status `Entwurf`. Technischer Bundle-Versionsname gegenüber frei gewähltem Release-Namen nicht unabhängig bestätigt. Nur Paket-/Codezuordnung; kein aktives Testrelease, Quellcommit des Entwurfs oder installierter Gerätestand belegt. Keine eigene Console-/GitHub-/Secret-/API-Abfrage.

Öffentlicher Play-App-Signierer/Uploadsignierer und nutzbares privates Signiermaterial weiter unbekannt; Besitzerangabe erhalten, GitHub-Ablage bleibt Vermutung. Keine Schlüssel gesucht/gelesen/kopiert, kein Build/Signieren/Installieren/Versions-/Cloud-/Workflow-/Playeingriff oder Testwiederholung. Alte Code17-Manifeste/Artefakte unverändert; T-006/V-014 und E-002–E-005/Gesamtfreigaben offen. Dokumentation lokal committen/sichern unter `/workspace/anker-t006-play-metadaten-20261114/`, finale Commit-ID dort; alte Umgebung/835235b zurückgestellt. Danach stoppen. Damals nächster, inzwischen oben abgeschlossener Auftrag: öffentliche App-Signier-/Uploadzertifikatsfingerabdrücke rollengetrennt anhand Nutzerangaben zuordnen, soweit bereitstellbar; keine eigene externe Abfrage oder Schlüssel-/Geräteaktion.

## T-006: nichtgeheime Nutzerantwort eingeordnet (14.11.2026)

Saubere verfügbare Basis `563e3dad9d763b278f1e1e4bbdf20a5389ed0cad`, Branch `entwicklung/anker-neu`. [Nutzerantwort, Entscheidungsstand und nächste Metadatenklärung](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Nutzer bezeichnet sich als Besitzer und meldet internen Test in seiner Play Console. Die Aussage „auf GitHub sollte es einen Schlüssel geben“ ist eine Vermutung, kein bestätigter Zugriff auf passendes Signiermaterial. Keine erneute Besitzerfrage und keine Schlüsselsuche/-lesung oder GitHub-/Playabfrage. Auch interne Testbuilds besitzen Versionscodes; heutiger Testcode und tatsächliche Zielinstallation/Signatur bleiben unbekannt. Kein öffentlicher Rollout behauptet.

Ausschließlich Dokumentation fortgeschrieben; kein Build/Sync/Signieren/Installieren, keine Geräte-/Cloud-/Workflow-/Playaktion oder grüne Testwiederholung. Alte Code17-Manifeste und bisherige Pakete/Nachweise unverändert. T-006/V-014 IN_ARBEIT, E-002–E-005/Gesamt-/Geräte-/Releasefreigabe offen; alte Umgebung/835235b zurückgestellt. Lokal committen/sichern unter `/workspace/anker-t006-entscheidungsangaben-20261114/`, finale Commit-ID dort. Danach stoppen. Damals nächster, inzwischen oben fortgeschriebener Auftrag: vorhandene nichtgeheime Paket-/Versions-/öffentliche Zertifikatsangaben des internen Play-Testbuilds beim Nutzer erfragen und zuordnen; keine eigene externe Abfrage oder Schlüssel-/Geräteaktion.

## T-006: Signier-/Geräteprüfvoraussetzungen lesend geklärt (13.11.2026)

Verfügbare saubere Basis `b816e1a4145a079fa35241194facb5f3f811cc1c`, Branch `entwicklung/anker-neu`. [Voraussetzungen, Versionsentscheidung und Codebelege](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Vorhandenes unsigniertes APK weiterhin vorhanden/38.608.942 Bytes/hashgleich; keine Build-/Sync-/Signier-/Geräte-/Remoteaktion und keine grüne Suite wiederholt. Öffentliche Code15-/Code16-/Code17-Zertifikatsangaben konsistent B4, aber kein heutiger Besitznachweis eines privaten Schlüssels oder Signaturbeleg der installierten App.

Konkrete Lücke im alten lokalen Weg: `sign-local-update.mjs`/`AnkerApkTool.java` setzen historischen Debugpfad, Alias `AndroidDebugKey` und Debugpasswort voraus; nicht als geprüften Weg für den dokumentierten Releasealias `anker-mobile-release` ausgeben. Vorhandene offizielle Build-Tools können später nach ausdrücklicher Schlüsselzugriffs-/Signierfreigabe das bestehende hashgebundene APK lokal beim Besitzer signieren; GitHub-Secrets oder Wiederherstellung der alten Umgebung sind dafür keine automatische Voraussetzung. Nichts implementiert oder umkonfiguriert.

Aktuelle Zielinstallation (Paket/Code/Herkunft/gegebenenfalls vorhandener öffentlicher Signierer) und bestätigter erreichbarer Signierbesitzer fehlen. Gleicher Code17 ist nicht allein ein Downgradefehler, höherer installierter Code verhindert aber einen regulären Rückschritt; keine Versionszahl erraten oder ändern. Play-AAB-Uploadzertifikat beweist nicht das ausgelieferte App-Zertifikat. Alte Code17-Manifeste auf80f6a692 unverändert und nicht auf den neuen Appstand übertragbar. T-006/V-014 IN_ARBEIT, E-002–E-005 und Gesamt-/Releasefreigabe offen.

Nur Dokumentation lokal committen/sichern unter `/workspace/anker-t006-signiervoraussetzungen-20261113/`, finale Commit-ID dort. Alte Umgebung/835235b zurückgestellt, keine privaten Schlüssel gesucht/gelesen/kopiert. Danach stoppen. **Damals nächster, inzwischen oben fortgeschriebener Auftrag: fehlende nichtgeheime Zielinstallations-/Signierbesitzerangaben beim Nutzer einholen und zuordnen; noch kein Schlüsselzugriff, Signieren, Bauen, Installieren oder Cloud-/Workflow-/Playeingriff.**

Stand 13.11.2026, Europe/Berlin. **T-006: Web-/Logik-/PC-Integration und unsignierte lokale Android-Paketintegration belegt; Gesamtabschluss IN_ARBEIT.** Ausgangsbasis dieses Paketauftrags `18f6bb2959f26882c9860a104e8bc3e85512fe04`, Branch `entwicklung/anker-neu`, sauber verifiziert. Finale lokale Commit-ID im Abschlussmanifest. [Paketnachweis, Workflows und offene Grenzen](INTEGRATION_T006.md). Alte Umgebung/835235b zurückgestellt.

## T-006: neuer unsignierter Android-Prüfbuild

Auf sauber geprüftem `18f6bb2959f26882c9860a104e8bc3e85512fe04` Produktions-Webbuild/Typecheck und Capacitor-Synchronisation, danach abgesicherter unsignierter Release-Varianten-Build erfolgreich. Paket `de.frnkrm.anker.mobile`, Code17/`1.5.0-rc.3`, min26/target36/compile36 unverändert. Kein getrackter generierter Diff, keine Produkt-/Versions-/Berechtigungs-/Signier-/Workflowänderung. Vor/nach Sync Taskplan trocken geprüft; externer beobachtender Guard erzwingt null-Signierkonfiguration und verbietet Signier-/Debugpaket-/Installationstasks. Zwei fehlende festgelegte Bestandsartefakte nach Offlinefehler nachgeladen, erfolgreicher Folgelauf 1m43s/211ausgeführt/273wiederverwendet. Vorhandene Warnungen nicht unterdrückt.

APK 38.608.942Bytes; Quellkennung `552f037d8560dcc3fe59b6ae441a0d77484e0ca40b479379a9cbe9be28b043a0`; SHA256 `94f240a18f2047a57dcf5e13075504f02889a3281de00a40e4bcd8836baf7a0f`.71dist-/75generierte Android-Assets bytegleich, CRC/Manifest/SDK/31unveränderte Rechte/optionales NFC/Backupgrenzen/ZIP16KB/8ELF64-Bibliotheken geprüft. Signatur fehlt: apksigner Exit1 `Missing META-INF/MANIFEST.MF`, v1-Dateien und v2/v3-Block ausgeschlossen. Keine Installierbarkeits-/Update-/Gerätezusage.274JUnit aus F-008 wegen unveränderter Quellen erhalten, ebenso1372TS-/378Browser-/284Pythonfälle und übrige grüne Nachweise; kein neuer Vollauf oder Remote-CI.

[Ausführlicher Nachweis](INTEGRATION_T006.md). APK/Metadaten/Logs/Snapshots/Bundles/Wiederherstellungsprüfung/SHA256 nur Cloud-lokal `/workspace/anker-t006-android-20261113/`; finale Dokumentationscommit-ID dort, Appquellcommit bleibt18f6bb2. Originalplan/36IDs/103Gerätezeilen und ausgelieferter Katalog erhalten. E-002–E-005, signierter geeigneter Geräteprüfbuild, exakte Remote-CI und Gesamt-/Releasefreigabe offen; alte auf80f6a692gebundene Code17-Manifeste unverändert. Kein Push/Merge/Tag/Signieren/Installieren/Workflow-/Cloud-/Playeingriff. Alte Umgebung/835235b zurückgestellt.

Nach diesem Auftrag stoppen. Damals nächster, inzwischen oben abgeschlossener Auftrag: **T-006 – Signier- und Geräteprüfbuild-Voraussetzungen ausschließlich lesend klären.** Vorhandenen lokalen Signier-/Prüfweg, öffentliche Paket-/Zertifikatszuordnung und Versions-/Updategrenzen abgleichen, fehlende Nachweise/kleinste separate Freigabe benennen. Keine privaten Schlüssel suchen/lesen, nicht signieren/konfigurieren/installieren.

## T-006: belegt geprüfter Teil und verbleibende Grenzen

1372/1372vollständige TS-Tests in133Dateien.378verschiedene Browserfälle zuletzt grün:375/378im Vollauf,3belegte alte Annahmen (F-006-Abendübergänge und T-005-Importfreigabe), gezielte Korrektur und3/3grün; keine375grünen Fälle wiederholt, keine automatischen Retries/Skip/Flaky. Sechs Screenshots in vier Specs jetzt in Testausgaben statt festen alten Sicherungs-/Temppfaden.284Python-PC-Fälle zuletzt grün über initialen Lauf und ausschließlich betroffene Nachprüfungen nach fehlender QR-/PowerShell-Basis.19PowerShellfälle/4Parser,5Paketfälle, Node↔Python-Loopback/CLI-Hilfe und16lokale SQL/RLS-Fälle erfolgreich.36Update-/134Play-Offlinefälle grün, keine Appsignierung oder Googleanfrage.

Lint0Fehler/1bekannte fremde Warnung, Typecheck/Build grün; nach Testkorrekturen gezieltes ESLint/e2e-Typecheck. Neue notwendige Testwerkzeuge isoliert `/workspace/anker-t006-tools-20261113/env.sh`: qrcode8.2/zeroconf0.154.0 gemäß bestehender requirements, PGlite0.5.16 gemäß CI, PowerShell7.5.4 mit offiziellem SHA256 und beschreibbaren XDG-Pfaden. Keine App-Paket-/Versions-/Cloudänderung. Native-/NFC-/TS-Brückenquellen seit F-008 identisch;274JUnit/31Suiten aus dessen79Dateien vollständig hashgeprüfter Sicherung erhalten und nicht erneut ausgeführt. Keine reale Windows-/Galaxy-/Kalender-/NFC-Aussage aus diesen Softwarebelegen.

Letzte lesende Remote-Abfrage im vorherigen T-006-Auftrag bestätigt main e48d2892846b4a2fec45bf0cefc396e1a4c92f10 und dev6dfa632c94422d61d6a71c6a4a72c15fefd4a407. PR2-Status/neue Arbeitshead-CI nicht abgefragt; keine Remoteänderung. Feste Code17-Manifestfreigabe bindet80f6a692 und gilt nicht für diesen neuen Appstand. Workflows/Netlifydeklaration ausschließlich gelesen, kein Start. Beim vorherigen Web-/PC-Abschluss waren die Android-Webassets veraltet; der oben belegte Capsync/unsignierte Prüfbuild schließt diese lokale Paketlücke. Keine Signierung. Signier-Konfiguration aktuell nicht gebunden; keine privaten Schlüssel gesucht/gelesen und kein Verlust behauptet. E-002–E-005 und Gesamt-/Releaseabnahme bleiben offen, T-006/V-014 IN_ARBEIT.

Nachweise und geprüfte lokale Sicherung `/workspace/anker-t006-20261113/`, nur Cloud-lokal: volle/gezielte JSON-/Textberichte, erste rote Belege, kombinierte Abdeckung, Tool-/Workflow-/Quellmetadaten, native-retained.json, android-package-gap.json, Remote-Readback, Vorher-/Nachher-Bundle, unabhängiger Klon/fsck/Dateihashes, RESTORE.md/SHA256SUMS. F-008/F-009/F-010-Sicherungen vollständig unverändert hashgeprüft. Nach Umgebungsneustart Ausgangshead, sechs Teständerungen und Berichte wiedergefunden, keine erfolgreichen Prüfungen wiederholt. Originalplan/36IDs/103Gerätezeilen erhalten. Integriert lokal ja, main nein; veröffentlicht nein. Alte Umgebung/835235b zurückgestellt. Der damalige nächste Paketauftrag ist oben inzwischen begrenzt ausgeführt; nach aktuellem Auftrag stoppen.

## F-010: geprüfter lokaler Softwareabschluss

Bestandsabgleich: drei freiwillige Rückblickfragen, bisheriger Save-/Vorschlagswriter und Rhythmusansicht vorhanden. Fehlte die belegbare Wochenübersicht. Nur diese ergänzt: `core/weeklyReview.ts` liest bekannte DayLog-Modi/Flags und Routinenresultate, keine Freitexte, Fokusarchive, Lernstichproben oder technischen Zustellungsbelege. F-009 hat keinen gespeicherten Begleitverlauf. Keine Rekonstruktion alter Pläne aus heutigen Einstellungen.

`WeeklyEvidence` im bisherigen Review öffnet nur nach eigener Wahl und ist jederzeit abwählbar; Zeitraumwahl nur flüchtig. Reload/Verlassen/Tabwechsel schließen. Aktuelle Montag-bis-Sonntag-Planwoche nur bis heute oder vorherige volle Woche, Berliner04:00-Grenze und heutiger Tag ausdrücklich noch offen. Leere/fehlende/anders befüllte Tage nicht als Nichtnutzung oder Hindernis zählen. Kleine Grundlage, überschreibbarer Tagesstand und fehlender Ursachen-/Wirksamkeitsbeleg offen benannt. Eigene Antworten und bewusster Save/Vorschlag bleiben beim bisherigen Besitzer; keine automatische Plan-/Timer-/Erledigungs-/Punktewirkung oder XP-Strafe.

**101/101 gezielte Aggregations-/Support-/Store-/Datenschutzfälle** in6Dateien (16neu), **16/16 verschiedene Browserfälle** (7neu+9bestehende). Zusätzlich nur320px-Fall1/1 für unverdeckte Bildnachprüfung nach vorhandener Erfolgseinblendung aus synthetischen Daten; keine Produktänderung dafür. Keine roten Testläufe. Lint0Fehler/1bekannte fremde Warnung, Typecheck einschließlich e2e und Produktionsbuild grün. Chromium156,320px/160Prozent Schrift visuell geprüft; Abwahl/eigene Antworten erreichbar ohne horizontalen Überlauf. Keine komplette App-/Remote-CI-/Gerätesuite behauptet.

Keine Native-/Manifest-/Brücken-/Reminder-/PC-/Storewriter-/Schema-/Export-/Paket-/Workflowänderung;274Android-JUnit aus F-008 historisch erhalten, nicht wiederholt. Originalplan/36IDs/103Gerätezeilen erhalten. Nachweise und lokale Sicherung `/workspace/anker-f010-20261113/`: Logs, UI-Bilder, Integrität, Vorher-/Nachher-Bundles, Wiederherstellung/fsck/RESTORE.md/SHA256SUMS, nur Cloud-lokal. Integriert lokal ja, main nein; veröffentlicht nein. Alte Umgebung/835235b zurückgestellt. Nach F-010 gestoppt. T-006 benötigt eigenen Auftrag; Hardwarelücken bleiben Release-/Abnahmegrenzen.

## F-009: geprüfter lokaler stiller Softwareabschluss

Vorhandene Fokus-/Starthilfe-/Recovery-/Storebesitzer gegen Abnahme geprüft. Fehlte die freiwillige lokale Begleitwahl; nur diese ergänzt. `core/focusCompanion.ts` verwendet bestehende recoveryPreview ohne alten Merker-/Archivfallback, mit aktueller Aufgabe/Teil-/Routinenvariante, Berliner Plantag und Arbeitsruhe. Kompakte gemeinsame Karte unter den bisherigen Hauptaktionen in FocusFrame. Ein generischer ruhiger Satz, keine Person oder Verbindung. Keine eigene Zeitmessung oder neue Datenquelle.

Start nur für einen gültigen bereits laufenden Fokus nach frischem Store-/Plan-/Zeitcheck. Ausdrücklicher Begleitstopp lässt den Fokus weiter unverändert. Pause, Zeitablauf, neuer Fokus, überholter Kontext, Planwechsel, Blur/Verbergen, Verlassen/Reload verwerfen die flüchtige Wahl. Weiter im bisherigen Fokus übernimmt keine Begleitwahl. Keine Erledigung, Punkte oder Arbeitszeit aus Begleitung/Ablauf. Arbeits-/Notiztexte erscheinen nicht zusätzlich in der Begleitkarte; Backup/Import können keine Wahl übernehmen. Vorab festgelegter [Datenrahmen](DATENSCHUTZ_DATENGRENZEN.md).

**139/139 gezielte TS-/Store-/Datenschutzfälle** in7Dateien (12neu). **21verschiedene Browserfälle zuletzt grün** (10neu): erster Lauf14/15, ein neuer Test verwechselte vorhandene Radiobuttons mit combobox; ausschließlich Testzugriff korrigiert. Anschließend7/7 mit korrigiertem Fall, zusätzlichem Planreferenzfall und5bestehenden Regressionen. Keine bereits grünen Fälle unnötig wiederholt. Lint0Fehler/1bekannte fremde Warnung, Typecheck einschließlich e2e und Produktionsbuild grün. Chromium156,320px/160Prozent Schrift, Bild visuell geprüft. Keine neue vollständige Web-/CI-/Gerätesuite behauptet.

Native-/Manifest-/Brücken-/Reminder-/PC-/Storewriter-/Schema-/Paket-/Workflowquellen unverändert;274Android-JUnit aus F-008 historisch erhalten, nicht wiederholt. Originalplan/36Roadmap-IDs/103Gerätezeilen erhalten. Nachweise und geprüfte lokale Sicherung `/workspace/anker-f009-20261113/`: erste/finale Logs und Fehlerartefakte, browser-coverage.json, Integrität, Vorher-/Nachher-Bundles, Wiederherstellung/fsck/RESTORE.md/SHA256SUMS. Nur Cloud-lokal. Integriert lokal ja, main nein; veröffentlicht nein. Alte Umgebung/835235b zurückgestellt. Nach F-009 gestoppt; F-010 benötigt eigenen Auftrag.

## F-008: geprüfter lesender Softwareabschluss

`/anker` unter Mehr startet inaktiv. Eigener Scan öffnet maximal30Sekunden Reader Mode im entsperrten Android-Vordergrund. Neutrale Vorschau Jetzt/Vorbereitung/Wiedereinstieg; Öffnen benötigt einen eigenen Tipp und native einmalige Revalidierung. Vorhandene Routen und aktuelle Plan-/Recovery-Besitzer bleiben zuständig. Keine Aufgaben-/Teil-IDs oder alten Planstände auf dem Tag. Manueller Rückweg auf Web/PWA/Windows und bei fehlendem/ausgeschaltetem NFC. Brückenfehler bleiben geschlossen; bestehende Shellnavigation bleibt verfügbar.

Ein MIME-NDEF-Record, exakter UTF-8-Wert, maximal32Payload-/256Nachrichtenbytes, keine Record-ID. Monotone native Sitzung verwirft alte Generationen. Scan und Vorschau teilen dieselbe30Sekundenfrist; Funk endet nach gültigem Fund. Pause/Stop/Destroy, Sperre, fehlender Vordergrund und Wecker beenden die Sitzung; Resume startet nichts. Vier passende Brückenmethoden einschließlich `confirmNfcAnchor` zum einmaligen frischen Öffnungscheck. UI zusätzlich gegen Abbruch, Unmount, Timeout und verspätete Antworten geschützt. Keine UID/Rohdaten in Brücke, Logs, DB, Sicherung oder Sync; keine neue Persistenz/Freigabe aus Import.

**48/48 gezielte TS-Fälle** in7Dateien (14neu), **274/274 Android-JUnit** in31Suiten (14neu, bestehende260 vollständig mitgeprüft), **22/22 Browserfälle** in zwei erfolgreichen Auswahlen14+8 (17neu,5bestehende). Lint0Fehler/1bekannte fremde Warnung, Typecheck einschließlich e2e und Produktionsbuild grün. System-Chromium156,320px/160Prozent Schrift, Vorschau visuell kontrolliert. Keine vollständige Websuite/Remote-CI/Geräteabnahme behauptet. Erster nativer Kompilierlauf mit Bestand erfolgreich; finaler Lauf mit neuen Tests und ergänztem Schutz vor vorzeitiger Bestätigung. Erfolgreiche unveränderte Prüfungen nicht weiter wiederholt.

Nachweise `/workspace/anker-f008-20261113/`: Logs, JUnit-XML, UI-Bild, Integrität, Vorher-/Nachher-Bundles, RESTORE.md und SHA256SUMS. Nur Cloud-lokal. Originalplan/36Roadmap-IDs/103historische Gerätezeilen erhalten. SDK/JDK unverändert wiederverwendet. Keine echten Geräte-/Tagaktionen, Paket-/Versions-/Signatur-/Workflowänderungen. Integriert lokal ja, main nein, veröffentlicht nein. Alte Umgebung/835235b bleiben zurückgestellt. Nach F-008 stoppen; F-009 nur nach eigenem Auftrag.

## Arbeitsbasis und Verfügbarkeit

- T-001 ist nach ausdrücklicher Nutzerentscheidung gesichert pausiert. Originalumgebung und `835235b` bleiben zurückgestellt und sind keine Voraussetzung. Mögliche spätere Wiederherstellung separat sichern/vergleichen; keine automatische Übernahme oder Rekonstruktion.
- Lokale Historie: `6dfa632` (vollständiger Nutzerplan), `f7fa4e3` (Planungsdokumentation), `e421ee5` (Testkorrektur). Einrichtungsabschluss `32b9a15`, F-001 `8149ece`, F-002 `b669856`, T-004 `a820115`, native T-002 `2bef19d`, F-003 `4e23706`, T-005 `4b6e3fd`, F-004 `b4ec5a4`, F-005 `769ea77`, F-006 `7a2b227`, F-007 `5b6f893`, darauf der lokale T-004-NFC-Dokumentationsabschluss. Die finale Commit-ID steht im Abschlussbericht, nicht als selbstreferenzierende Dateischleife hier.
- Letzte erfolgreiche Remote-Abfrage in dieser Unterhaltung: main/HEAD `e48d289`, Arbeitsbranch/PR2-Head `6dfa632`. Lokale Nachfolgecommits wurden nicht gepusht. PR2 laut Nutzerscreenshot/-bericht offen und nicht gemergt; kein aktueller unabhängiger API-Nachweis (`Forbidden`). Beim Wechsel in einen anderen Task zuerst prüfen, ob dieser lokale Abschluss tatsächlich vorhanden ist; ein Prompt überträgt keine Commits.
- Seit F-001/F-002 gezielte TS-/Jetzt-Änderungen und neue Logik-/Store-/Browsertests. F-002 ergänzt optional `DayOverride.shortMorning` samt Sicherungsvalidierung und bestehender atomarer Tagesplanaktion; keine neue DB-Tabelle, Engine oder Schreibqueue. Zum damaligen F-002-Abschluss waren Android, Reminder-Regeln und Paket-/Lockdateien unverändert. F-003 ergänzt nun passende TS-/Kotlin-Reminderfelder und Logik; Paket-/Lockdateien bleiben unverändert. e2e-Timerkorrektur aus `e421ee5` erhalten. Keine neue Release-/Gerätezusage. Nutzer-Screenshot zu GitHub-Lauf43331316553: 307/308 Browserfälle, Timerstart erwartete675000/tatsächlichundefined. Dieser Remote-Lauf bleibt historisch rot; kein neuer Runnerlauf ausgelöst.
- Branch `work` bis `02e0a01` und frühere Bundles bleiben erhalten. `/workspace/anker-ci-fix-20261113/after.bundle` erfolgreich verifiziert; Original-/Planungssicherungen unter `/workspace/anker-recovery-20261113/` und `/workspace/anker-preparation-20261113/`. Nur Cloud-lokal, keine bestätigte externe Sicherung. Fehlende Originaldateien werden nicht als verloren ausgegeben.

## Abnahme T-002 / E-001 / T-003

| ID | Abschlussnachweis | Verbleibende Grenze |
|---|---|---|
| T-002 | Web-Abnahme erhalten; vollständiges JDK21/SDK36/Build-Tools35.0.0 eingerichtet, Wrapper8.14.3 und252/252 Android-JUnit bestätigt | Reale Android-/Windows-/Kalenderbeobachtungen offen; keine Cloud-Konfiguration geändert |
| E-001 | Cloudstatus aktuell running/enforced; Git-Lesen und API-Grenzen geklärt; keine Secretbindungen/Identitäten; Nutzerwahl GPT-6.1 Sol/Hoch bestätigt | Keine Konto-/OAuth-/Play-Freigaben erteilt; fehlender Zugriff ist dokumentiert, nicht repariert |
| T-003 | Alle36 IDs samt V-Zuordnungen, Abhängigkeiten und Originalabnahmen erfasst; eine Roadmap, ein Status, genau drei Fallvorlagen; Links und Widersprüche geprüft | F-001 inzwischen lokal umgesetzt; spätere Aufgaben einzeln beauftragen |

Integriert: ja im lokalen Arbeitsbranch; nein auf main und nicht als neue GitHub-Verfügbarkeit bestätigt. Gerätetest für diesen Dokumentationsabschluss nicht nötig; veröffentlicht nein. Vollständige App-/Android-/Windows-Prüfung oder Releasefreigabe ist kein Teil dieser Abnahme.

## Umgebung und reproduzierbare Befehle

Für F-004 aktive neue Umgebung `ccarenv_b64_Y2NhcmVudl8zYmQ3Nzk2MTg1Nzg4MTkxOTAyY2EyNzBiMGY2YzQyNQ`, lesend bestätigt running, Beobachtungen aktuell, Netzwerkpolitik restricted/enforced. T-005-Umgebung zuvor beim Dateizugriff nicht benutzbar; daraus keine verlorenen Daten abgeleitet. Vorherige Umgebung hiermit nicht erneut verfügbar behauptet. Keine Secretbindungen/Laufzeitvariablen. Keine Cloud-Einstellungen verändert. Der zuletzt lesbare Konfigurationsentwurf hatte kein Installationsskript und Repository-ref `main`; tatsächlicher Arbeitsbranch bleibt `entwicklung/anker-neu` und muss beim nächsten Task geprüft werden.

Node24.22.1, npm11.9.0, Python3.12.14, nun vollständiges lokales JDK21.0.13 (vorher nur Java-Runtime); installiertes System-Chromium156.0.8078.79. Web-Abhängigkeiten vorhanden, `npm ls --depth=0` erfolgreich. Kein erneutes `npm ci` ohne Anlass. Falls die Abhängigkeiten nach Umgebungswechsel fehlen: `npm ci --cache /tmp/anker-npm-cache --no-audit --no-fund`. Dieser Cachepfad vermeidet den zuvor nicht beschreibbaren Standardcache. Lockdateien und Paketversionen bleiben erhalten.

Geprüfte Repositorybefehle: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Passende Tests gezielt auswählen; keine automatischen Systemwirkungen starten. `npm run test:pc` benötigt PowerShell; Native-Unit-Tests `node scripts/gradle.mjs :app:testDebugUnitTest` benötigen die Android-Einrichtung. PC-Python-Tests aus `pc-companion` mit `python -m unittest discover -s tests -v`, Abhängigkeiten später bei Bedarf isoliert installieren.

Standard-Playwright-Browserdownload ist mit `403 Domain forbidden` blockiert. Für lokale Webtests existiert eine getestete Konfiguration mit installiertem Chromium; sie ändert nur Browserpfad, absolute Verzeichnisse und Reporter, nicht Prüfregeln/Timeouts/Retries:

```bash
cd /workspace/anker
CI=true npx playwright test --config=/workspace/anker-ci-fix-20261113/local-playwright.config.ts e2e/subtask-timer.spec.ts e2e/redesign-controls-extra.spec.ts --workers=2
```

Konfiguration und Systembrowser vor neuem Task auf Existenz prüfen; Testausgaben gehen nach `anker-ci-fix-20261113/test-results`. Vor späterem Wiederverwenden relevante alte Fehlerartefakte separat erhalten. Falls die lokale Hilfsdatei fehlt, aus `playwright.config.ts` außerhalb des Repositorys eine Konfiguration mit `use.launchOptions.executablePath: '/usr/bin/chromium'`, absoluten Test-/Ausgabepfaden und Webserver-cwd erstellen; keine CI-Datei ändern. F-001 benötigt keinen nativen Transport und keine neuen Berechtigungen. JDK/SDK werden im jeweiligen Shellaufruf durch `/workspace/anker-toolchains/env.sh` aktiviert; globales Gradle, adb und PowerShell wurden nicht installiert. T-004s Planung ist abgeschlossen; echte Galaxy-/Windows-/Kalenderbeobachtungen bleiben E-002–E-004 offen.

Optionaler, nicht angewendeter Vorschlag für das Cloud-Installationsskript:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /workspace/anker
npm ci --cache /tmp/anker-npm-cache --no-audit --no-fund
```

Nur falls später gewünscht: in „Umgebung bearbeiten“ das Setup-/Installationsskript eintragen und speichern. Keine manuelle Browserhandlung ist für die jetzige lokale Weiterarbeit erforderlich. Keine Veröffentlichung der Umgebung beauftragt.

## Grenzen und Nachweise

[OFFENE_ENTWICKLUNGEN.md](OFFENE_ENTWICKLUNGEN.md) ist die einzige ID-Roadmap, [ANKER_PLAN.txt](ANKER_PLAN.txt) das unveränderte Anforderungsinventar einschließlich Abnahmen/Prüfstrategie. Architektur in [STRUKTUR.md](STRUKTUR.md), Nachweise in [ANKER_TESTNACHWEISE.md](ANKER_TESTNACHWEISE.md), drei Vorlagen in [PROMPT_TEMPLATES.md](PROMPT_TEMPLATES.md).

Erhaltene Prüfung aus dem unmittelbar vorherigen Task: 15/15 gezielte Browsertests und Produktionsbuild grün; Lint0Fehler/1bestehende Warnung. Kontrollierter roter Versuch belegt das Timer-Eingabe-Rennen. Rohberichte und `RESULT.json` unter `/workspace/anker-ci-fix-20261113/`. Unveränderte erfolgreichen Prüfungen nicht wiederholt; keine neue vollständige App-/Gerätesuite behauptet.

Keine Pushes, Merges, Workflow-/Cloudänderungen oder Google-Play-Aktionen. CI läuft bei Push/PR; Play-Dispatch wählt Upload; Play-Pushpfad verlangt main/Workflowänderung/Marker; `v*`-Tags veröffentlichen APK-Releases. Externe Netlify-Kontoverknüpfung nicht unabhängig sichtbar. Historische Uploadaufträge sind für diese Einrichtung und F-001 keine Veröffentlichungsfreigabe. Aktueller Play-Bestand bleibt separat unbestätigt.

## F-001-Abschluss

`src/core/departure.ts` ist eine reine Projektion vorhandener Büro-/Terminwege, Morgenroutine und vom Planer bereits überlappungsbereinigter Vorbereitungsblöcke. Anzeige unter der Hauptaktion: Restzeit, geschätzte offene Vorbereitung, rechnerischer Puffer oder ehrlicher Hinweis auf offene Zeiten. Erledigte/entfallene Routine-Schritte nicht erneut zählen; explizite Wegbestätigung entfernt die jeweilige Karte. Homeoffice erzeugt keinen Büro-Weg; gesonderte Termine bleiben möglich. Vergangene Abfahrt bleibt negativ, beendet keine Routine und vergibt keine XP. Physische Restzeit aus bestehenden Berliner UTC-Konvertierungen, auch nach Mitternacht und bei Zeitwechseln. Nach 04:00 kein alter Plantag. Kein zweiter Planer, keine neue Persistenz oder Reminder.

Prüfung auf gemeinsamem F-001-Code: **1.206/1.206 Logiktests** (23 neu), **15/15 ausgewählte Browserfälle** (5 neu, 6 bestehende Jetzt-/Layoutfälle und 4 Termin-/Wegefälle), Typecheck/Produktionsbuild grün; Lint0Fehler/1bestehende Warnung. System-Chromium156, 320px/160Prozent Schrift geprüft. Erster Buildversuch erkannte einen fehlenden Datumsparameter in neuer Browserfixture; korrigiert, danach Typecheck/Build/Browser grün. Historische Erstfehlerlogs bleiben erhalten. Keine neue vollständige Browser-/Android-/Windows-Suite oder erfolgreiche GitHub-CI behauptet. Echte Galaxy-/Windows-Beobachtungen weiterhin offen.

Nachweise `/workspace/anker-f001-20261113/` einschließlich Logs, `RESULT.json`, Vorher-/Nachher-Bundles und SHA256-Verzeichnis. Integriert lokal ja, auf main nein; veröffentlicht nein. Sicherung nur Cloud-lokal. Zum damaligen F-001-Abschluss waren F-002/F-003 nicht implementiert; F-002 ist im folgenden Abschnitt abgeschlossen, F-003 bleibt offen.

## F-002-Abschluss

`core/morningShort.ts` verwendet die F-001-Projektion: nur bei bekannter Abfahrt, bekannten Dauern, negativem Vorbereitungspuffer und noch positiver Restzeit. Die Vorschau zeigt ausschließlich offene Schritte mit echten kürzeren benannten Varianten. Bereits kleine Varianten, fehlende Zeiten, Erledigungen/Entfall und abgelaufene Abfahrt erzeugen kein neues Angebot. Auch wenn die kurze Schätzung nicht reicht, bleibt eine freiwillige Wahl mit ausdrücklichem Hinweis möglich.

`MorningShortOffer` erscheint unter der Abfahrtskarte. **Kurzmodus übernehmen** ist die ausdrückliche Bestätigung. Der Store revalidiert Plan und Fakten innerhalb derselben vorhandenen Schreibqueue. Alter Plan, neue Erledigung, wartender konkurrierender Auftrag, Tages-/Zeitablauf und Wiederholung werden vor dem Schreiben verworfen. Ein optionaler Tages-Override `shortMorning` wählt im vorhandenen Planer nur kürzere Morgenvarianten; alle IDs, Erledigungen und Kernschritte bleiben. Abend und globale Unterstützung unverändert. Bestehende Tagesplan-Rücknahme bleibt verfügbar, kein gesonderter Undo-Writer. Alte Sicherungen ohne Flag bleiben gültig; neuer optionaler Wert ist streng boolean-validiert.

**So lassen** ändert keine gespeicherten Daten und blendet dasselbe Angebot in dieser Ansicht auch über Uhrticks aus. Nach neuem Plan oder erneutem Öffnen der Ansicht kann wieder ein Angebot erscheinen; kein dauerhafter Tages-Stummschalter behauptet. Speicherfehler bleiben sichtbar und erlauben erneute Annahme. Die Wahl löst keine Erledigung oder Punkte aus, auch nicht für vorher unquittierte Handlungen; dafür überspringt allein dieser neue Transaktionspfad die sonst übliche Awardauswertung. Andere Tagesplanaktionen behalten ihr Verhalten.

Prüfung final: **1.224/1.224 Logiktests** in119Dateien (18 neu), **17/17 ausgewählte Browsertests** (6 neu, 5F-001 und6Jetzt-/Layoutregressionen), Typecheck und Produktionsbuild grün, Lint0Fehler/1bestehende Warnung. System-Chromium156; 320px/160Prozent Schrift, Persistenz/Reload, explizite Annahme und tatsächlicher Minimalabschluss geprüft. Storetests belegen Doppeltippen, Stale-/Queueprüfung, Fehler/Rücknahme und Sicherungsgrenzen. Keine neue komplette Browser-/Native-/Windows-Suite, keine echten Geräte oder grüne GitHub-CI behauptet.

Rohbelege unter `/workspace/anker-f002-20261113/`: frühe Tests/Fehlerlogs, `first-browser-results/` (XP-Nebenwirkung vor Korrektur), finale Logs/Bildbelege, `RESULT.json`, Vorher-/Nachher-Bundles und SHA256-Verzeichnis. Nur Cloud-lokal gesichert, auf main/GitHub nicht übernommen, veröffentlicht nein. Keine F-003-Implementierung, neuen Reminder, Dienste, Berechtigungen oder Paketupdates.

## T-004-Abschluss und damaliger Toolchainblocker

Maßgeblicher Prüfplan: [GERAETETEST.md, T-004-Abschnitt](GERAETETEST.md). Bestehende103 Geräte-IDs und sämtliche Ergebniszellen unverändert. F-003 ist nicht implementiert. Gezielte TS-/Store-/Bridge-/Kotlin-/Browserpfade und G21/G38/G66–G71 für dynamischen Impuls, Abfahrt, Revision, Doppelschutz, Ruhe/Fokus und Budget dokumentiert; Wecker separat G1/G22/G35–G37. Kalender G94/G35–G39, Windows G97/G98/G102/G103. Historische `ok` gelten nur für damalige Builds, keine neuen Geräteerfolge. Lokales `b669856` ist nicht der installierte Code17-Stand; Buildzuordnung bleibt Voraussetzung echter Beobachtung.

Beim T-004-Abschluss vor der folgenden Nachbereitung: Wrapper8.14.3 ausführbar/JAR lesbar, AGP8.13.0, Kotlin2.4.21, SDK compile/target36/min26. Aber kein javac in PATH/vorgefundenen JVMs und kein konfiguriertes SDK/sdkmanager/adb; Java-Runtime allein reicht nicht. `ci.yml` enthält keinen Android-JUnit-/App-Buildjob. Kein Wrapperstart, Download, SDK-Lizenzannahme, JUnit-, Browser- oder Hardwarelauf in dieser Vorbereitung.

Damals kleinste Folgearbeit, inzwischen unten erledigt: **T-002 gezielte Nachbereitung für native Android-Prüfungen**; die bisherige Web-Abnahme bleibt erhalten. Vollständiges JDK21, Android-Commandline-Tools und API36-Plattform plus tatsächlich von AGP verlangte Build-Tools einrichten; genaue Defaultversion erst aus offizieller AGP-Auflösung bestimmen (Repo pinnt keine Build-Tools). Kein globales Gradle, Emulator oder Android-Studio-Komplettpaket nötig. Native `:app:testDebugUnitTest` danach prüfen; keine Signierung, Veröffentlichung, Geräteinstallation oder F-003-Implementierung. Dieser damalige Blocker wurde durch die folgende ausdrücklich beauftragte T-002-Nachbereitung behoben.

Windows ist in dieser Linuxumgebung nicht verfügbar; PowerShell und PC-Basispakete zeroconf/qrcode fehlen. Kein Bedarf, diese für F-003 jetzt zu installieren. Kalender-Softwarepfade sind vorhanden, READ_CALENDAR im Manifest ist keine erteilte Kontofreigabe. Beide Bereiche bleiben echte spätere Geräteaufgaben; keine Gegenprüfung aus Offline-Mocks erfinden.

Neue Nachweise nur lesende Einrichtungskontrolle: `/workspace/anker-t004-20261113/TOOLS.json`, `java-version.log`, Abschlussprüfung und Vorher-/Nachher-Git-Bundles. Frühere1224 Logik-/17 Browserfälle aus F-002 nicht wiederholt. Integriert lokal ja, main nein, Geräteergebnisse offen, veröffentlicht nein. Keine Cloud-/Workflow-/Play-Aktionen. Dieser damalige nächste Schritt ist inzwischen erledigt; aktueller Folgeauftrag im Abschnitt darunter.

## Native T-002-Nachbereitung: betriebsbereiter Prüfweg

Werkzeuge außerhalb des Repositorys unter `/workspace/anker-toolchains`: vorhandene JRE21.0.13 und exakt passendes offizielles Debian-Sicherheits-JDK-Paket21.0.13+9-1~deb13u2 in einem lokalen vollständigen JDK kombiniert. Paket-SHA256 stimmt mit offiziellem Index überein. Android-Commandline-Tools23.0 und Plattform android-36 Revision2 aus offiziellen Google-Metadaten; Build-Tools35.0.0 ist per `javap` aus AGP8.13s ToolsRevisionUtils als tatsächlicher Default belegt. Wrapper8.14.3 und Projektpluginversionen unverändert, keine globale Installation oder Cloud-Einstellungsänderung.

```bash
cd /workspace/anker
source /workspace/anker-toolchains/env.sh
javac -version
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
node scripts/gradle.mjs :app:testDebugUnitTest --no-daemon --console=plain --max-workers=2
```

Das Aktivierungsskript setzt nur lokale Tool-/Cache-/Proxyselektoren für diese angebundene Umgebung; es verändert weder HOME noch Kontoberechtigungen oder Cloud-Konfiguration. Android-Userverzeichnis und XDG-Pfade liegen im Workspace. Die offiziellen Tools23 leiten sdkmanager an Android CLI weiter; ein zusätzlicher lokaler Wrapper deaktiviert bei weiteren Aufrufen Metriken. `sdkmanager --version` meldet dabei nur `unknown (Android CLI)`; tatsächliche Paketrevision23.0 ist über source.properties und installierte Pakete belegt. Nicht durch CLI-Namensänderung eine nicht existierende ältere SDK-Version behaupten.

Erster SDK-Inventarversuch scheiterte am nicht beschreibbaren Benutzerverzeichnis; mit ANDROID_USER_HOME/XDG behoben. Erster JUnit-Aufruf scheiterte vor Tests an fehlender generierter `cordova.variables.gradle`. Erst darauf `npx cap sync android` ausgeführt: Datei erzeugt, **kein getrackter Diff**. Zweiter JUnit-Lauf **Exit0,252Tests/28Suiten,0Fehler/Skips,196Tasks ausgeführt,2m2s** einschließlich App-/Test-Kotlin-/Java-Kompilierung. Bestehende Deprecated-/Unchecked-Warnungen und Kotlin-Hinweis zu künftigem Gradleminimum erhalten, nichts aktualisiert oder unterdrückt. Keine APK-/Releaseerzeugung, Signierung oder Geräteinstallation.

Belege unter `/workspace/anker-native-setup-20261113/`: `RESULT.json`, `TOOLCHAIN.json` mit offiziellen URLs/Hashes, env.sh/Konfigurationskopien, Wrapper-/Compiler-/SDK-Ausgaben, AGP-Bytecodebeleg, erste Fehlerversuche, cap-sync.log, finaler Gradlelog und rohe JUnit-XML/HTML-Berichte sowie Git-Bundles/SHA256-Verzeichnis. Installierte Tools und Downloads verbleiben zusätzlich unter `anker-toolchains`; das Git-Bundle enthält die Repositoryhistorie, **nicht** alle SDK-/JDK-Binärdateien oder Gradlecaches. Alles nur Cloud-lokal; keine unabhängige externe Sicherung oder Übertragbarkeit in eine neue Umgebung bestätigt. Bei Umgebungswechsel Selektoren/Proxy und Pfade erneut prüfen.

Genau nächster Schritt: F-003 in derselben Unterhaltung einzeln beauftragen; vorhandene TS-/Native-Reminderbesitzer und die T-004-Prüfkette verwenden. Native Softwareprüfung nun möglich, echte Galaxy-/Windows-/Kalenderbeobachtungen weiterhin offen. Keine pauschale Produkt-/Push-/Merge-/Release-/Playfreigabe aus dieser Werkzeugabnahme ableiten.


## F-003 / V-010: dynamische Vorbereitung, lokal abgeschlossen

`departureReadinesses` projiziert dieselben bereits geplanten Wege wie F-001; die Jetzt-Ansicht verwendet weiterhin nur den nächsten. `core/reminders/preparation.ts` nutzt die datierte Projektion am kanonischen Plantagesanfang04:00 für alle vorhandenen Wege und deren jeweils offene Vorbereitung. Keine zweite Tagesplanung, neue Messdaten, DB-Tabelle, Einstellungen oder Persistenzaktion.

Bei bekannten Zeiten und offener Vorbereitung: **Impulszeit = Abfahrt in UTC − max(10min, offene Vorbereitungsdauer + vorhandene travel.activationMin)**. Der Ankunftspuffer steckt bereits in der geplanten Abfahrt und wird nicht erneut abgezogen. Physische Minuten über Berliner DST-/Mitternachtsgrenzen; keine erneute Interpretation einer mehrdeutigen lokalen Uhrzeit. Bestätigte/entfallene Schritte zählen nicht; F-002-Varianten und vom Planer bereinigte Morgen-/Terminüberlappung werden übernommen. Ein freies Vorbereitungsbudget ohne eigene Erledigungsfakten bleibt eine Schätzung, keine beobachtete Tätigkeit.

`prepare:work` bzw. `prepare:commitment:<id>` ersetzen für berechenbare Wege leave-10/prep und den gleichartigen Morgenstart-Hinweis. Die tatsächliche Abfahrt leave/go bleibt; ein Morgen-Termin erzeugt keine doppelte Büroabfahrt. Keine erfundenen Büro-Wege im Homeoffice. Vollständig erledigte Vorbereitung, bestätigte Abfahrt/Ankunft/Rückkehr oder Absage entfernen den Impuls. Unbekannte Dauern/Fahrzeiten erzeugen keine dynamische Zeit; vorhandene allgemeine Vorwarnungen bleiben nur als neutraler Fallback, ohne berechnete Pünktlichkeitszusage. Bestehende bewusste Vorwarnungs-Ablehnungen bleiben wirksam.

Normaler sanfter Hinweis, keine Eskalation/Exaktanforderung/Erledigt-/Snooze-Schaltfläche, Rang3 unter Abfahrt Rang4. Kein Umgehen von Fokus, Ruhe, Filmfenstern, reduziertem Modus, Kartenbudget oder Weckervorrang. Tippen öffnet nur Jetzt. TS und Kotlin weisen Erledigungsaktionen für diesen Schlüssel ab; reine Planung/Zustellung vergibt keine Punkte. Keine aktiven PC-Wirkungen.

Offene Fakten und Uhrzeiten ändern die opake Revision; der Zustellungstoken bleibt einmal pro datiertem Weg stabil, auch beim Wechsel zum Zehn-Minuten-Fallback. Das vorhandene begrenzte native Verbrauchsledger verhindert Wiederholung nach Zustellung oder bewusst unterdrücktem fälligem Hinweis. Unverarbeitete geänderte Impulse ersetzen ihren Vorgänger. Kein neuer Belegspeicher/Writer. Vergangene Impulszeiten werden bei Neuplanung nicht nachgeholt; Native verwirft verspätete Impulse spätestens zur Abfahrt. Optionales `validUntil` wird auf beiden Brückenseiten und im bestehenden Queue-JSON erhalten, begrenzt Slot und Android-Timeout. Legacy-Einträge ohne Feld bleiben gültig; neue prepare-Einträge ohne brauchbare Frist oder mit widersprüchlichen Wirkungsflags werden verworfen. Basiswochenregeln bleiben ohne Fortschritts-/Terminimpulse. Keine garantierte Android-Zustellung.

Prüfbelege: vollständiger Logiklauf **1255/1255 in120Dateien**; nach letzter Ergänzung zum Erhalt bestehender Ablehnungen **105/105 gezielte Reminder-/Store-/Brückenfälle** (ein weiterer neuer Fall, insgesamt32 neue TS-Fälle gegenüber1224). **260/260 Android-JUnit in29Suiten**,8neu, App-/Test-Kompilierung, vorhandene Toolchain wiederverwendet. **30 ausgewählte Browserfälle** final abgedeckt:28Bestandsfälle grün plus2neue nach Korrektur des Tests auf bestätigte Persistenz/Cacheaktualisierung; kein erneuter vollständiger Browserlauf behauptet. Typecheck, Produktionsbuild und Lint bestanden; Lint nur bekannte TaskAssistance-Warnung. Chromium156,320px/160Prozent Schrift. Webtests prüfen Darstellung/Cache/Handlungen, keine native Zustellung.

Frühe rote Logs bleiben erhalten: zwei geänderte Bestandsannahmen (legacy leave-10 vs. dynamisch, Katalogrolle prep vs. prepare), neue Fixtures für bekannten Streckenursprung/Ruhezeit, ungenutzter Testimport beim ersten TS-/Browserstart und Browsernavigation vor bestätigter Erledigung. Keine Timeout-/Retrylockerung. Nachweise `/workspace/anker-f003-20261113/`: Logs, JUnit-XML/HTML, Browserbilder/erste Fehlertrace, RESULT.json, Vorher-/Nachher-Bundles und SHA256SUMS. Nur Cloud-lokal gesichert; keine bestätigte externe Sicherung und keine neue GitHub-/CI-Verfügbarkeit. Originalumgebung/835235b bleiben zurückgestellt.

Geräteabnahme zu bestehenden G21/G38/G66–G71 und Weckervorrang G1/G22/G35–G37 offen; alle103historischen Geräteergebniszeilen erhalten. Details in GERAETETEST.md. Nächster sinnvoller Schritt T-005: Datengrenzen vor F-004 prüfen, keine automatische Freigabe neuer Messdatenerfassung.


## T-005 / V-015: Datengrenzen und Importfreigaben

Verbindliche Datenfluss-/Löschinventur und Voraussetzungen für F-004 in [DATENSCHUTZ_DATENGRENZEN.md](DATENSCHUTZ_DATENGRENZEN.md). Vier belegte Gruppen von Korrekturen: Import übernimmt keine fremden Integrations-/KI-/Routen-/Audio-/PC-/Geofencing-/Lernfreigaben; importierte Wetterorte und private PC-Texte brauchen erneute Wahl. Alle exportierten Tombstones ohne ehemaligen Body. Arbeits- und unklar zuordenbare Lern-/Fokus-/Rückkehrkopien bei privater Teilsicherung ausgeschlossen und im Ziel erhalten. Aktuelle Schlaf-Lesewahl bleibt bei Nachvalidierung bestehen; keine Lesefreigabe aus einer Rohdatei. Unveränderte bekannte Nutzdaten bleiben wiederherstellbar, gleiche Storequeue/atomare Importprojektion. Importseite erklärt die bestehenden Geräteentscheidungen und erneute Wetter-/Textwahl.

Prüfung:176/176 gezielte TS-Fälle in16Dateien,17neue TS-/Storefälle;14/14 ausgewählte Browserfälle einschließlich einer neuen Altdatei-/Freigaberegression, ohne tatsächlichen externen Datentransfer. Lint0Fehler/1bestehende Warnung, Typecheck/Produktionsbuild grün. Kein kompletter Logik-/Browser-/Native-/CI-Neulauf behauptet. Vorherige F-003-Erfolge erhalten; Android und Berechtigungen unverändert, keine erneute Werkzeugeinrichtung. Softwareprüfung, keine neuen Gerätebelege.

Neue Umgebung enthält Basiscommit, Vorarbeiten, Node-Abhängigkeiten, lokalen Chromium-Testweg und Toolchainpfade. Keine Cloudkonfiguration angepasst, keine Anmeldung oder echte Anbieterabfrage. Frühe rote Regressionen und passende Fixture-/Bestandsanpassungen unter `/workspace/anker-t005-20261113/`; außerdem Vorher-/Nachher-Bundles, RESULT.json, Datengrenzenprüfung und SHA256SUMS. Nur Cloud-lokal, keine bestätigte externe Sicherung oder neue GitHub-Verfügbarkeit. Originalumgebung/835235b zurückgestellt. Alle36Roadmap-IDs/103Gerätezeilen und Originalplan erhalten.

F-004 darf als nächster Einzelauftrag bestehende Zeit-/Fokus-/Lernwege und reine Anzeige prüfen. Vor neuen persönlichen Stichproben Schema, ausdrückliche lokale Wahl, aktive Zeit vs. Pause/Schätzung, Quell-/Privatkontext, Grenzen, Löschung sowie Backup-/Importregressionen im oben verlinkten Rahmen konkret festlegen. Keine neue Messung oder automatische Aufgabenabnahme durch T-005. Echte Geräte-/Kontonachweise bleiben offen.


## F-004 / V-005: Zeitvergleich und vorsichtige Dauerabschätzung

Vorhanden und erhalten: Ring/Countdown, Pausen/Reload/Hintergrundzeit, eigener Fokus je Teilaufgabe, explizite Dauerbestätigung, Lernwahl mit Reset/Rücknahme, robuster Median ab3brauchbaren Bestätigungen, bewusste Schätzungsübernahme. Ergänzt ausschließlich die fehlende verständliche Trennung und Randkorrekturen. Keine zweite Uhr, Stichprobentabelle, neue Reminder, Messdatenerfassung oder Systemwirkung.

Im Fokus bleibt die Hauptaktion an ihrer bisherigen Position; sichtbar ist kompakte **Timerzeit ohne Pause**. Der neue Vergleich liegt bei Aufgaben unter **Details & Abschluss**, bei Routinen unter **Weitere Möglichkeiten**: Schätzung, gewähltes Zeitfenster und Timerlaufzeit getrennt; ganze Aufgaben zusätzlich bestätigte Dauer oder ehrlich „Noch nicht bestätigt“. Nach ausdrücklich bestätigtem Aufgabenabschluss wird dessen vorhandene bestätigte Dauer mit der Schätzung verglichen. Keine erfundene Bestätigung für Teilaufgaben/Routinen und keine Vorbelegung des Bestätigungsfeldes aus einem Timer. Timerzeit läuft im Hintergrund, ist keine beobachtete menschliche Tätigkeit oder Arbeitsbuchung. Kleine Ansichten: Vergleich einspaltig, große Schrift/320px geprüft.

Bestandsfehler rot nachgewiesen: Nach Ablauf konnte Pause den vorher angezeigten Überzug auf die Fensterlänge zurücksetzen. Optionales `CountdownState.overrunMs` bewahrt nur diesen bereits berechneten Anteil desselben Fensters. Pause/Weiter/Reload zählen die Unterbrechung nicht mit, Ablauf bleibt bei Restzeit0, ein bewusst neues Fenster beginnt ohne Überzug. Alte Timer ohne Feld gültig, früher nicht gespeicherter Überzug nicht rekonstruiert. Importvalidierung prüft den Wert; gleiche lokale Fokus-/Archivbesitzer und bestehende Backup-/Syncgrenzen. Vorabentscheidung in DATENSCHUTZ_DATENGRENZEN.md, keine neue Lernstichprobe daraus.

`taskDurationEvidence` ist eine Leseprojektion vor dem bestehenden Schätzer: gleiche vorhandene Titel-/Seriengruppe, vorhandene Quell-ID mit aktuellem explizitem Arbeits-/Privatkontext und eindeutiger Bestätigungsidentität. Nur bestätigte Werte1–480min; ungültige, doppelte, widersprüchliche oder nicht mehr zuordenbare Angaben zählen nicht. Aktueller Quellkontext ist kein rekonstruierter historischer Kontextwechsel. Rohwerte bleiben erhalten. Bei weniger als3Angaben ehrliche Anzeige statt Vorschlag; darüber Anzahl und vorsichtiger Richtwert, keine sichere Vorhersage. Wahl/Bestätigung/Übernahme bleiben ausdrücklich, keine Änderung der bestehenden Stichprobenfelder oder Schreibqueue.

Prüfung: **175/175 gezielte Logik-/Store-/Datenschutzfälle in15Dateien**,15neue TS-Fälle. **26unterschiedliche Browserfälle final abgedeckt**: erster Auswahllauf23/24, geänderte alte Textannahme auf getrennten Zeitvergleich angepasst; gezielter Schlusslauf6/6 einschließlich3neuer F-004-Fälle und2Routinefälle. Keine unnötige Wiederholung des unveränderten restlichen Bestands. Typecheck/Produktionsbuild und Lint0Fehler/1bekannte Warnung. Ein zusätzlicher Routinenstart traf zunächst auf den noch laufenden Testserver-Port; nach dessen Ende ohne Regeländerung grün. Erste Fehlerlogs/Traces und Bilder erhalten.

Nachweise und Sicherungen `/workspace/anker-f004-20261113/`: rote/finale Logs, System-Chromium-Konfiguration, Bilder für Hauptansicht und geöffneten Vergleich, RESULT.json, Vorher-/Nachher-Bundles und SHA256SUMS. Nur Cloud-lokal. Alle36Roadmap-IDs,103Gerätezeilen und Originalplan erhalten. Native-/Reminder-/PC-/Sync-/Paket-/Berechtigungsbestand unverändert;260Android-JUnit aus F-003 bleiben ihr damaliger Nachweis, kein neuer Native-/CI-/Gerätelauf. Reale Galaxy-/Windows-/Kalenderbeobachtungen bleiben offen. F-005 erst nach eigenem Auftrag, keine Veröffentlichung durch diesen Abschluss.


## F-005 / V-001: Wiedereinstieg aus vorhandenen Daten

Bestandsabgleich: `recovery.ts`/`support.ts` besaßen bereits Merker und Prioritäten, das gemeinsame `RecoverySheet` in `Now.tsx` sowie `/wiedereinstieg` bereits Schritt/Notiz. Es fehlten Timerstatus und eine am aktuellen Plan validierte Routinenkarte. Der alte Rückkehrknopf rief bei Aufgaben `startTaskFocus` auf und setzte pausierte Zeitfenster nebenbei fort. Jetzt reine `recoveryPreview`-Projektion im bestehenden Besitzer; keine neue Hauptkarte oder zusätzliche Hauptaktion.

Aktueller gültiger Fokus hat Vorrang im geöffneten Wiedereinstieg. Aufgabentitel, offener exakter Teil und Notiz kommen aus den aktuellen Aufgaben; fremde Teilnotizen und unpassende Archivtimer werden nicht zugeordnet. Erledigung, Absage, Entfall, zukünftiger Beginn/Verschiebung/Plantag sowie entfernte Teile werden ausgeschlossen. Routinen erfordern denselben aktuellen ersten offenen Planschritt und dieselbe gewählte Voll-/Minimalvariante. Berliner Tagesgrenze einschließlich bestehender ausdrücklicher Weckeraktivierung vor04:00 wie in der Fokusansicht; diese Datumsfunktion bekommt lediglich einen engeren Lesetyp, keine neue Regel. Nicht belegbare alte Routinenrouten werden nicht angeboten, Rohmerker bleiben gespeichert. Die bestehende freiwillige Arbeitsruhe bleibt erhalten.

Die kurze lokale Karte trennt laufend, pausiert, beendet und kein gespeichertes Zeitfenster. Öffnen/Reload ändert keine Aufgaben, Timer, Lernwerte, Tagesfakten oder Punkte. **Dort weitermachen** prüft die aktuelle Referenz erneut und navigiert nur; **Weiter** beziehungsweise ein neuer Start im Fokus bleibt ausdrücklich. Das gilt auch für die bestehende Jetzt-Resume-Hauptaktion. Der ausdrücklich startende Fokusshortcut und andere Startaktionen behalten ihre bisherige Bedeutung. Ein bereits laufender Timer läuft weiter; bloßes Öffnen pausiert ihn nicht. Keine zweite Uhr, Schreibqueue, Persistenz, Lern-/Diagnosedaten oder externe Ausgabe.

Prüfung: **171/171 gezielte TS-/Store-/Datenschutzfälle in10Dateien**,14neue Recoveryfälle. **30unterschiedliche Browserfälle abgedeckt**: erste Auswahl27/28, Starthilfe-Reload scheiterte nach Escape mit `net::ERR_ABORTED`; reale Dialog-/History-Abschlussbarriere ergänzt. Gezielter Folgelauf3/3 einschließlich bestehender Hauptaktion/Quick-Recovery; nach Ergänzung der frühen Morgeninstanz Schlusslauf9/9 einschließlich aller6neuen F-005-Fälle. Ein Zwischenbuild erkannte den zu breiten bisherigen `guidancePlanDate(LocalData)`-Parameter; auf tatsächlich gelesene Guidance-Daten eingegrenzt, nicht mit Dummy-Daten umgangen. Typecheck/Produktionsbuild und Lint0Fehler/1bekannte Warnung. Keine abgeschwächten Timeouts/Retries oder übersprungenen Tests.

Lokales Chromium156,320px/160Prozent Schrift, Scrollbedienung und horizontale Grenzen belegt; Bilder, erste Fehlerartefakte und finale Logs unter `/workspace/anker-f005-20261113/`. Ergebnis, Wiederherstellungsanleitung, geprüfte Vorher-/Nachher-Bundles und SHA256-Verzeichnis ebenfalls dort, nur Cloud-lokal gesichert. Alle36Roadmap-IDs,103Gerätezeilen und Originalplan erhalten. Native/Storequeue/Reminder/Wecker/Transport/Workflows/Pakete unverändert;260Android-JUnit aus F-003 bleiben historischer Nachweis. Kein neuer Native-/CI-/Hardwarelauf. Reale Galaxy-/Windows-/Kalenderbeobachtungen bleiben offen. Nach F-005 gestoppt, F-006 nicht implementiert.


## F-006 / V-002: eine aktuelle Handlung für den Übergang

Bestandsabgleich: Morgen-/Abendroutine, Fokus-Pause/Weiter, freiwillige Abendverlängerung/offenes Ende, PC-Rückmeldung und optionale Nachtführung vorhanden. Konkrete Lücken: pauschale Folgetexte nach Routine statt aktueller Handlung; abgeschlossene Routineblöcke konnten als Tätigkeit stehenbleiben; früher Morgen fiel in `nextNow` auf den vorherigen Plantag zurück; überholte Routinen-/verschobene Aufgabenmerker konnten als Hauptaktion erscheinen. Rote Core-/Storebelege erhalten. Keine neue Aufgabenverwaltung oder parallele Controller.

`nextNow` bleibt ein Leseweg zum bestehenden `nextAction`/Planer: dieselbe Berliner Datumsprojektion wie der Fokus einschließlich ausdrücklich aktivierter früher Morgeninstanz, Revalidierung ausschließlich des vorhandenen Merkers über F-005s `recoveryPreview`. Kein fremder Fokus als neue Hauptaktion eingesetzt. Jetzt, Routinenabschluss und die bestehenden Leser für Capture/Shortcut verwenden denselben Weg. `nowView` gibt nach dem letzten offenen Routine-Schritt den vorhandenen Folgeabschnitt frei, ohne erledigte/übersprungene/entfallene Fakten umzuschreiben. Feste Zeiten, Wege, Arbeit und echte Fristen behalten ihre bisherige Priorität.

Routinenabschluss: eine aktuelle nächste Handlung, Weiter navigiert zur Jetzt-Ansicht und startet keinen Timer. Die Anzeige bleibt über Zeit-/Planwechsel aktuell, auch ohne laufenden Timer. Bei gewählter Nachtführung wird unmittelbar dieselbe `GuidanceNightPage` mit demselben `BedtimeSessionProvider` wie auf Jetzt benutzt; gemeinsamer Einstiegsschutz statt zweiter Nachtregel. Der Provider beobachtet vorhandenen lokalen nativen Status und bietet dieselbe Aktionsbarriere, keine zweite Schlaf-/Remindersteuerung. Ohne Wahl bleibt dieser Einstieg aus.

Freizeit und PC-Stopp erhalten kurze Texte innerhalb der vorhandenen Handlung. PC-Rückmeldung verlangt bewusstes Ausschalten; der Speicherhinweis behauptet keine tatsächliche Speicherung. Abendzeit ändern öffnet dieselbe bestehende LateForm; Abbruch schreibt nichts, Übernahme/offenes Ende nutzt dieselbe Storequeue und bestehenden optionalen Freigaben. Keine zusätzliche PC-Nachricht, Wirkung oder Kopplung implementiert. Nach der eigenen PC-Rückmeldung kann der bereits freiwillig gewählte ruhige Handgriff angezeigt werden. Dessen Text bleibt an bisherigen Settings-/Backup-/Syncgrenzen; keine neue Kopie oder Übertragung.

Prüfung: **169unterschiedliche gezielte TS-/Store-/Datenschutzfälle in12Dateien abgedeckt**,9neu. Auswahl167/168, korrigierte neue Fixture und zugehörige Fälle8/8, zusätzlicher gemeinsamer Nachteinstieg6/6; maschinell zusammengeführter letzter Ergebnisstand169/169 in `logic-coverage.json`. **29unterschiedliche Browserfälle abgedeckt**: erste Auswahl24/25; fehlender Schlafhinweis-Provider im neuen Fokus-Nachtzweig anhand des Traces belegt und ergänzt, danach betroffener Schlusslauf11/11 einschließlich7neuer F-006-Fälle und4bestehender Pause-/Hauptaktions-/Quick-Recoveryfälle. Abschließende reine Layoutprüfung1/1 nach schmaler Überschrift; alle weiteren unverändert erfolgreichen Fälle erhalten. Lint0Fehler/1bekannte Warnung, Typecheck und Produktionsbuild grün. Keine Timeouts/Retries/Assertions abgeschwächt.

Chromium156,320px/160Prozent Schrift mit bedienbarer Hauptaktion ohne horizontalen Überlauf. Endbilder mit vorhandener freiwilliger Spieleinblendung ausgeschaltet; frühere Bilder mit synthetischer Einrichtungs-Erfolgsanzeige erhalten. Neue Storeprojektion schreibt nichts und verändert weder Timer noch Game/Tagesdaten; früher Morgen, Pause/Rückkehr, aktuelle Folgereihenfolge, PC-Rückmeldung, bewusste Verlängerung/offenes Ende und gewählte/ausgeschaltete Begleitung belegt. PC-Link-/Widgetprivatheit softwareseitig geprüft; keine echte PC-/Android-Wirkung oder externe Übertragung getestet/ausgeführt.

Rohbelege und lokale Sicherung `/workspace/anker-f006-20261113/`: rote/frühe/finale Logs und Traces, Bilder, System-Chromium-Konfiguration, RESULT.json, geprüfte Vorher-/Nachher-Bundles, Wiederherstellungsanleitung und SHA256SUMS. Nur Cloud-lokal. Originalplan,36Roadmap-IDs und103Gerätezeilen erhalten. Native-/Reminder-/Wecker-/Storewriter-/Transportquellen, Paketbindungen, Workflows und Berechtigungen unverändert.260Android-JUnit aus F-003 bleiben historischer Nachweis, kein neuer Native-/CI-/Hardwarelauf. Reale Galaxy-/Windows-/Kalenderbeobachtungen offen. Nach F-006 gestoppt; F-007 nicht implementiert.


## F-007 / V-003: freiwillige Vereinfachung mit belegtem Auslöser

Bestandsabgleich: `suggestedMode` bietet nur den bewusst eingeschalteten Abendmodus an; Starthilfe besitzt bereits 120-/30-Sekunden-Stufen, Pause/Weiter und explizites Etwas kleiner. Aufgaben speichern state/deferredUntil/letztes Datum, keinen belastbaren Verlauf wiederholter Verschiebungen. Deshalb keine automatische Erkennung solcher Wiederholungen oder psychischer Blockaden zugesagt. Zulässiger Beleg ist die ausdrücklich verkleinerte Starthilfe (`level === 1`) für denselben tatsächlich aktuellen Kontext. Ohne diesen Beleg, bei geändertem Modus oder überholtem Kontext erscheint kein Angebot.

Das Angebot steht ausschließlich in der manuell geöffneten bestehenden Starthilfe, nicht als neue Hauptkarte oder automatisch öffnender Dialog. Es erklärt seinen Auslöser und bietet den vorhandenen Tagesmodus Einfach anfangen an. Bei Routinen stellt dieser die Starthilfe nach vorne; alle Routinen-/Kernschritte bleiben. Annahme startet keinen Timer, erledigt nichts und vergibt keine Punkte. Bereits auf30Sekunden verkleinerte Hilfe wird auf Jetzt zutreffend als Klein anfangen statt erneut pauschal2Minuten bezeichnet. Die ursprünglichen Hilfeschlüssel samt Teilidentitäten bleiben erhalten; der Routinentag folgt auch hier der bestehenden frühen Weckerinstanz.

Datenentscheidung vor Implementierung in [DATENSCHUTZ_DATENGRENZEN.md](DATENSCHUTZ_DATENGRENZEN.md): einzig neuer gespeicherter Wert `offer:start-small` in vorhandener `DayLog.dismissed`-Liste; Annahme setzt zusätzlich nur vorhandenen `override.mode`. Allgemeine Tagespräferenz ohne Titel/Notiz/Arbeits-/Teil-ID, Zähler oder Zeitpunkt, bestehende Tagesaufbewahrung/Backup-/Import-/optionale Syncgrenzen. Heute ohne Angebot und Annahme unterdrücken dieses Angebot für den ganzen Tag, auch bei Reload, anderem Kontext oder späterem Moduswechsel. Bloßes Schließen wählt nichts und unterdrückt keine ausdrücklich später erneut geöffnete Hilfe. Neue Tage erzeugen keinen Präferenzeintrag ohne Wahl.

Gemeinsame Leseprojektion und bestehende Schreibqueue: F-006s vorhandene nextNow-Eingabe und Merkerprüfung sind für UI und Store wiederverwendbar aufgeteilt, keine neue Handlungsauswahl. Vor Annahme werden aktueller Tag/Plan/Inhalt/Modus/Teil und Angebotsrevision innerhalb derselben atomaren Queue erneut geprüft. Doppelte/überholte Annahmen schreiben nichts. Allgemeine heutige Abwahl bleibt bei zwischenzeitlicher Umplanung gültig, nie über einen Tageswechsel zurückdatieren. Schreibfehler publizieren weder Modus noch Abwahl; erneuter Versuch bleibt möglich. Keine Fortschrittsauswertung oder Timer-/Fokusänderung in diesem Pfad.

Prüfung: **114unterschiedliche gezielte Fälle in9Dateien abgedeckt**,19neu. Bestand62/62; zusätzliche Auswahl50/51 (neue Testassertion nutzte toContain auf optionalem undefined statt leerer Liste), korrigierte neue Pakete18/18, zusätzlicher selektierter Reminder-Isolationsfall1/1. `logic-coverage.json` führt letzten Ergebnisstand aller114Fälle grün zusammen;10bereits geprüfte Fälle im letzten Namensfilter nicht erneut ausgewählt. **23Browserfälle**, erste Auswahl18/18 einschließlich5neuer F-007-Fälle, ergänzende Pause-/Teilkontext-/Hauptaktions-/Quick-Recoveryauswahl5/5. Lint0Fehler/1bekannte Warnung, Typecheck und Produktionsbuild grün. Frühe TS-Testfixturefehler (überzählige Lesefelder/fehlende Nachweise für nichtleere Tagesmaps) korrigiert, keine Produktregeln oder Timeouts abgeschwächt.

Chromium156,320px/160Prozent Schrift: Angebot und Schaltflächen scrollend ohne horizontalen Überlauf; Hauptaktion erhalten. Store-/Datenschutzfälle belegen0zusätzliche Fortschritts-/Timerdaten, bewusste Tageswahl, Queuewartezeit/Stale-/Doppeltippschutz, Speicherfehler und Tageswechsel. Teilbackup/Import/Sync enthalten nur die allgemeine Präferenz; Erinnerungsbau mit demselben Tageswert bytegleich zur Ausgangsprojektion. Keine neue Messfreigabe, Diagnose, externe Datenquelle oder PC-Wirkung. Reale Galaxy-/Windows-/Kalender-/NFC-Beobachtungen offen.

Nachweise `/workspace/anker-f007-20261113/`: frühe/finale Logs, Bildbelege, lokale Chromium-Konfiguration, RESULT.json/logic-coverage.json, geprüfte Vorher-/Nachher-Bundles, Wiederherstellung und SHA256SUMS. Nur Cloud-lokal. Originalplan/36Roadmap-IDs/103Gerätezeilen erhalten. Native-/Reminder-/Wecker-/Transport-/Paket-/Workflowbestand unverändert,260Android-JUnit aus F-003 historisch, kein neuer Native-/CI-/Hardwarelauf. Nach F-007 gestoppt. F-008 verlangt noch Machbarkeitsprüfung/Freigabe; nächster eigener Auftrag ist die gezielte T-004-Prüfvorbereitung, noch keine NFC-Implementierung oder Berechtigungsänderung.


## Historische T-004-Vorbereitung: NFC-Machbarkeit und F-008-Prüfpfad

Auf tatsächlich vorhandenem sauberem `5b6f893` ausschließlich gelesen/dokumentiert. Neue Umgebung nicht eingerichtet, bestehende Tools verwendet. JDK/Javac21.0.13 ausgeführt (Exit0), installierte SDK36-Revision2-/Build-Tools35-/CLI23-Metadaten gelesen. Offizielle installierte API-Stubs/Javadoc/API-Versionsdaten per javap/ZIP/XML geprüft: Reader Mode seitAPI19, Projekt minSdk26/target36. Wrapper8.14.3/AGP8.13.0/Kotlin2.4.21 unverändert. Keine Installation, Gradle-/JUnit-/Browser-/Buildwiederholung oder echter Scan nötig/ausgeführt.

Kein vorhandener NFC-Lesepfad/Adapteraufruf. Lediglich allgemeiner Diagnose-Allowlistgrund nfc in TS/Kotlin gefunden, keine Lesefunktion oder Berechtigung daraus ableiten. Keine NFC-Berechtigung/Features/Intentfilter im App-Manifest und den erhaltenen Debug-Merge-Manifesteinträgen. Letztere sind kein neu erzeugter Build. Passender Besitzer: AnkerNativePlugin/TS-Vertrag einschließlich Webfallback und vorhandene Pause-/Destroy-Hooks. Bestehende Fokus-Einstiege können Timer starten; daher nur neutrale Zielvorschau und eigene Bestätigung zu Jetzt, Vorbereitung oder Recovery. QR-/Wecker-/Bett-/PC-Hardwarebelege bleiben eigene Wege, NFC ist kein Ersatz und keine Authentifizierung.

[NFC_MACHBARKEIT.md](NFC_MACHBARKEIT.md) legt den kleinsten lesenden Entwurf fest: nur ausdrücklich gestartete entsperrte Vordergrundsitzung, monotone30Sekunden-Grenze, Abbruch/keine automatische Wiederaufnahme; eine begrenzte neutrale MIME-NDEF-Nachricht mit genau drei Zielkennungen, keine URI-/AAR-/Freitext-/ID-Payloads. Keine Tag-Schreibfunktion, dauerhafte Zuordnung oder Sensor-/Ortsgeschichte. Vorbereitete neutrale Tags/deren Bereitstellung bleiben eigener bewusster Schritt, kein Writer-Aufruf durch diese Prüfung. Optionales NFC-Manifestrecht/Feature erst in einem ausdrücklich beauftragten Folgeauftrag, jetzt unverändert.

Softwareprüfpfad zu Parser/Sitzung/Brücke/Web/UI/Store und nativer JUnit-Abnahme vorbereitet, noch keine F-008-Softwaretests vorhanden oder bestanden behauptet. Reale E-005-NFC-Eignung mit zugeordnetem Galaxy/Tag offen; an bestehende G78/G80/G81/G84/G85/G86/G98 und QR-/Weckervorrang G1/G99/G101 angehängt, ohne neue G-IDs/Häkchen. Web/PWA/Windows bleiben manuell, keine Kalender-/PC-Funktion.114F-007-TS-/23Browserfälle und260F-003-Android-JUnit behalten ihre historischen Quellstände.

Belege `/workspace/anker-nfc-vorbereitung-20261113/`: SDK-/Javadoc-/Manifest-/Toolinventar mit Hashes, RESULT.json, Dokumentintegrität, Vorher-/Nachher-Bundles/Restore/fsck/SHA256. Nur Cloud-lokal. Originalplan/36Roadmap-IDs/103Gerätezeilen erhalten; sämtliche Produkt-, Paket-, Workflow- und Plattformquellen bytegleich zur Basis. Kein öffentlicher Quellenabruf oder externer Nutzdatentransfer, keine Cloud-/Geräte-/GitHub-/Playänderung. Nächster eigener Auftrag: F-008 im dokumentierten lesenden Softwareumfang, mit ausdrücklicher Erlaubnis genau der NFC-Manifestdeklarationen; keine echte Tag-/Geräteaktion daraus ableiten.
