# RC3: Updateprüfung und gemeinsame Erweiterungen

Stand: 7. November 2026. Dieser Überblick beschreibt den integrierten Arbeitsstand für das nächste Update. **Die endgültige Version, die gemeinsamen Abschlussprüfungen, der genaue CI-Commit und die Paket-Prüfsummen sind unten ausdrücklich noch offen.** Sie werden erst nach den tatsächlich abgeschlossenen Läufen eingetragen.

Ausgangspunkt ist **1.3.0-rc.2 / Code 9**, Commit `424e041309e82ec82804f0e951fa817bcd0ada70`. Der ältere RC1-Bezug des Prüfauftrags ist ein historischer Suchhinweis. Die danach korrigierte Routinensortierung und die Hinweise zur optionalen KI-Freigabe bleiben erhalten. Der private Auftragstext und private Schlüssel gehören nicht in diesen Bericht oder ins öffentliche Repository.

## Was sich für dich ändert

Aufgaben können einzelne Teilschritte mit eigener, bewusst gewählter Timerdauer fokussieren. Auf Jetzt werden nahe Startzeiten und Fristen offener Arbeitsaufgaben als freiwillige Vorbereitung sichtbar. Die Alltags-Erinnerungsdiagnose unterscheidet die globale Freigabe von den einzelnen Android-Kanälen. Ein ausdrücklich gestarteter stummer Schlafhinweis kann nach deiner Einschlafdauer ein kleines Fenster anbieten. Die neue Zeitübersicht in den Einstellungen zeigt zusammengehörige Zeitfunktionen und vorsichtige Hinweise auf Überschneidungen. Unter Gemeinsam testen gibt es einen kurzen Einstieg und den Austausch früherer Testberichte mit Vorschau.

Der vorhandene Planer und der Store bleiben die fachliche Wahrheit. Die Zeitübersicht speichert eine **abgeleitete lokale Datenbank als Record `meta/time-catalog` im vorhandenen Repository**. Sie verändert keine Aufgaben, Erinnerungen, Wecker oder Arbeitszeiten. Der Cache wird aus Sicherungen und Sync ausgeschlossen; seine Aktualisierung erhöht auch nicht den Änderungszeitstempel echter privater Quelldaten.

## Status nach Themen

„Ergänzt“ beschreibt implementierten Code oder die genannte Analyse. Daraus folgt noch kein erfolgreicher Handyversuch. Die gemeinsamen endgültigen Testzahlen stehen ausschließlich in der Nachweistabelle weiter unten.

| Bereich | Vorhanden | Ergänzt | Bewusst zurückgestellt oder nicht vorgesehen | Nicht verifiziert |
| --- | --- | --- | --- | --- |
| Android-Abhängigkeiten | SDK/Target 36, minSdk 26 und bestehende Buildplattform | Kompatible Auswahl: Activity 1.13.0, AppCompat 1.8.0, Core/KTX 1.18.0, WebKit 1.18.0; tatsächlicher Debug-/Release-Graph geprüft | Core 1.19.1 mit nötiger SDK-37-/AGP-9.1-Migration | Herstellerverhalten, WebView und Bibliothekswirkung am Handy |
| Web-Abhängigkeiten und TypeScript | Node 24, 39 direkte npm-Pakete, TypeScript 5.9.3 | Gezielter Health-Patch 8.11.14 sowie Tailwind und Vite-Plugin 4.3.5; Versions-, Peer- und Advisoryprüfung | TypeScript 7, weitere Majorwechsel und separat zu prüfende Updates | Keine pauschale Sicherheitsfreigabe; bekannte offene Dev-/Buildtool-Advisories bleiben dokumentiert |
| Audio | Getrennte echte Alarmarten, lokale Sprache, Tonvorschau und Mikrofonmessung | Audioausgabe erst nach gewährtem Fokus; Verlust, Ende und veraltete Rückmeldungen geschützt; gewöhnliche Sprache bleibt getrennt vom Alarmton | Neue Audiofunktionen und ungeprüfte API-37-/FGS-Strategie | Tatsächlicher Ton, Anruf-/Bluetooth-Konflikte und Herstellerlaufzeit |
| Teilschritt-Timer | Bestehende Aufgaben, Teilschritte, Countdownzustände und Fokusarchive | Optionaler stabiler Teilbezug, freie Timerdauer, bewusster Start, Pause/Fortsetzen und zeitstempelbasierter Wiederaufruf; Schutz bei Umbenennen, Entfernen, Abschluss und Altimport | Nicht vorgesehen: paralleles Aufgaben-/Timermodell und automatische Erledigung | Android-Prozessende, SQLite-/Update-Erhalt und reale Langzeitbedienung |
| Nahe Arbeitsaufgaben | Offene Arbeitsaufgaben mit Start, Frist und bestehender Jetzt-Auswahl | Bis zu drei Hinweise auf Startzeiten/Fristen innerhalb der nächsten Stunde, auch über den Tageswechsel; bestehender Krank-/Feierabendschutz bleibt wirksam | Nicht vorgesehen: automatischer Arbeitsbeginn, Verschiebung oder Buchung von Ist-Zeit | Persönlicher Nutzen und echter Handyablauf |
| Alltags-Erinnerungen | Bestehende Queue, Ruhe-/Fokusregeln, Revisionen und Anzeigenbudget | Weiter relevante fällige Einträge bleiben innerhalb ihrer Grenze erhalten; Kartenquellen über Mitternacht; Kanalprüfung und ehrliche Diagnose aktiver Android-Meldungen | Dauerhafter Hintergrunddienst oder automatisches Freischalten von Kanälen | Tatsächliche Zustellung bei geschlossener App, Display aus, Neustart und Update |
| Stummer Schlafhinweis und Jetzt-Einstieg | Einschlafdauer, Jetzt-Seite und antippbares Widget | Einmalige native Sitzung nach bewusstem Start und freiwilliger Fensterfreigabe; stumme sichtbare Karte mit manuellem Öffnen-/Schließenweg | Allgemeiner automatischer Start bei jedem Einschalten/Entsperren; neue Schlafmessung | Samsung-Overlay, zulässiger Vordergrundwechsel, Sperr-/Energiesparverhalten; genaue Android-/One-UI-Version |
| Einstellungen und Bildschirmabstand | Direkte Zahlen-/Zeiteingabe und bestehende Schlafberechnung | Einheitliche Ausrichtung und besserer Umbruch; Erklärung für Abstand vom Scrollen, ruhige Beschäftigung und Einschlafdauer | Zusätzlicher Bildschirm-aus-Timer oder neue Zwangssperre | Tastatur, große Schrift und Bedienung am echten Gerät |
| Zeitübersicht und Konflikte | Bestehende Wecker-, Plan-, Reminder-, Aufgaben- und Timerquellen | Kategorien, chronologische 14-Tage-Projektion und bekannte Einzelzeiten darüber hinaus; lokaler Lesecache und freiwillige Quellenlinks bei Überschneidungen/Unstimmigkeiten | Nicht vorgesehen: automatisches Deaktivieren, Korrigieren oder Verschieben; zweiter Zeitplanbesitzer | Eine berechnete Zeit beweist weder Zustellung noch PC-Ausführung; native Einträge benötigen tatsächlich gelesenen Status |
| Gemeinsame Geräteprüfung | Historische Nutzerberichte und bestehender vollständiger Testkatalog | Sechs Standardstationen; Berichte exportieren, Datei vor Übernahme prüfen, frühere Beobachtungen mit Herkunft erhalten; aktuelle Probleme nicht durch Import überschreiben | Nicht vorgesehen: automatische Erfolgsbestätigung aus Browser- oder Modelltests | Neue echte Geräteergebnisse und Ausführung auf dem Nutzer-PC |
| GitHub-Update ohne wiederkehrenden PC-Schritt | Bestehender passender Signierschlüssel und lokaler Signierweg | Manuell startbarer Workflow mit exakt grünem main-Stand, getrenntem Build-/Signierjob und geprüftem APK-Artefakt; Auswahl des freigegebenen Stands ohne SHA-Eingabe vorbereitet | Automatische Installation, ungefragter Release oder Storeupload | Einmalige Secret-Einrichtung, echter signierter Workflowlauf und Installation auf dem Handy |
| Google Play | Android-App mit lokalem Kern und optionalen Integrationen | Roadmap für Konto, Schlüsselentscheidung, Testkanal, Datenschutz und Berechtigungserklärungen | Kontoeröffnung, Zahlung, Upload und Rollout | Aktuelle Console-/Policybestätigung, Übergang der bisherigen Installation und Play-Gerätetests |
| Foto/OCR und Hintergrundrauschen | Manuelle Eingabe, lokale Sprache, vorhandene Audio-/Messpfade | Begrenzte Machbarkeits- und Überschneidungsbewertung | OCR-Implementierung, Rauschplayer und zusätzliche parallele Funktionsseiten | Konkurrenzmeldungen, Handschriftqualität, Offline-OCR und neue Audiofunktion am Gerät |
| Forschung und Alltagshilfen | Freiwillige kleine Schritte, Ausatmen/Bodenkontakt, Pause und Wiedereinstieg | Evidenzinventar und eigener Inhaltsentwurf zur späteren Bewertung | Therapieprogramm, klinische Scores und neue Auffrischungserinnerung | Aktuelle Studieninhalte und klinischer Nutzen; kein Wirksamkeitsbeleg für Anker |

## Drei wichtige Zusammenhänge

**„Bildschirm aus“ ist bereits eine Rechengröße.** Der Vorschlag für PC-Stopp ergibt sich aus Bettzeit minus gewähltem Bildschirmabstand. Eine manuell gesetzte PC-Stopp-Zeit bleibt bei der bestehenden Neuberechnung erhalten. Die Hinweise erklären den Abstand vom Scrollen und mögliche ruhige Tätigkeiten; sie steuern das Display nicht. Der aktivierte sanfte Abendübergang ersetzt bereits die PC-/Bett-Hinweise. Die Zeitübersicht kennzeichnet das als abgestimmt und empfiehlt dafür kein Abschalten. Ein tatsächlicher PC-Stopp-Auftrag hat eine andere Wirkung und bleibt gesondert sichtbar.

**Der Schlafhinweis ist eine einmalige freiwillige Sitzung.** Er nutzt die eingestellte Einschlafdauer erst nach deinem Start. Neu ist dafür die gezielt anforderbare Freigabe „Über anderen Apps anzeigen“ (`SYSTEM_ALERT_WINDOW`). Er erzeugt keinen Ton, keine Vibration und keinen aufweckenden Alarmtermin. Eine beim Fälligwerden gesperrte oder ausgeschaltete Anzeige wird nicht als spätere Überraschung nachgeholt. Android kann den automatischen Wechsel nach Jetzt begrenzen; der sichtbare Öffnenknopf bleibt der bewusste Rückweg. Der echte Morgenwecker bleibt getrennt.

**Timerablauf und Planung sind keine erledigte Arbeit.** Restzeiten beruhen auf Zeitstempeln. Pause, Ansichtwechsel, abgelaufene Zeit, Starthilfe und Konfliktvorschläge erledigen nichts, vergeben keine XP und buchen keine Arbeitszeit. Alte Aufgaben-/Teilreferenzen dürfen nach Import oder Sync nicht versehentlich eine andere Sitzung fortsetzen.

## Abschließende Nachweise – noch einzutragen

Die Einzelberichte enthalten bereits ausgeführte Teilprüfungen. Ihre Zahlen werden hier nicht addiert oder als gemeinsamer Abschlusslauf ausgegeben. Alle folgenden Platzhalter sind **offen**, bis Quelle und Ergebnis tatsächlich feststehen.

| Nachweis | Endgültiger Wert / Beleg |
| --- | --- |
| Appversion / Versionscode / Paketkennung | **[OFFEN: FINALE_VERSION_CODE_PAKET]** |
| Geprüfter Quellcommit und Quellfingerabdruck | **[OFFEN: FINALER_COMMIT_UND_QUELLFINGERABDRUCK]** |
| Logiktests | **[OFFEN: FINALE_VITEST_ZAHL_DATEIEN_ERGEBNIS_LOG]** |
| Browserprüfungen einschließlich neuer Abläufe | **[OFFEN: FINALE_BROWSERZAHL_ERGEBNIS_SKIPS_RETRIES_LOG]** |
| Lint, erzwungener Typecheck und Produktionsbuild | **[OFFEN: FINALE_ERGEBNISSE_UND_WARNUNGEN]** |
| Android-AAR-/Kotlinvarianten, frische JUnit und Releasebuild | **[OFFEN: FINALE_NATIVE_ZAHLEN_ERGEBNIS_LOG]** |
| Paket-/Webasset-/Berechtigungs-/16-KB-Prüfung | **[OFFEN: FINALE_PAKETPRUEFUNG]** |
| Automatisierte Signier-/PowerShellprüfungen | **[OFFEN: FINALE_SIGNIERPRUEFUNGEN_UND_PLATTFORM]** |
| GitHub-CI für exakt den freigegebenen Quellcommit | **[OFFEN: CI_URL_COMMIT_ERGEBNIS]** |
| Unsigniertes APK: SHA-256 und Größe | **[OFFEN: UNSIGNIERTES_APK_SHA256_BYTES]** |
| Falls tatsächlich erzeugt: signiertes APK und Zertifikatsabgleich | **[OFFEN: SIGNIERTES_APK_SHA256_BYTES_ZERTIFIKAT_ODER_NICHT_ERZEUGT]** |
| Update-ZIP: SHA-256 und Größe | **[OFFEN: UPDATE_ZIP_SHA256_BYTES]** |
| Tatsächlich erneut gelesener Download und freigegebener Update-Stand | **[OFFEN: DOWNLOAD_URL_PRUEFUNG_UND_FREIGABESTAND]** |

Ein grüner Build bestätigt keine Hörbarkeit oder Benachrichtigungszustellung. Frühere RC2-Nachweise bleiben erhalten und gehören zu ihrem damaligen Stand. Der historische Nutzerbericht vom 6. November bestätigt Installation und sichtbaren Datenerhalt; er bestätigt keinen der neuen RC3-Gerätefälle.

## Die nächsten Schritte auf dem Handy

Vor einem regulären Update eine aktuelle JSON-Sicherung exportieren und wichtige vorhandene Werte notieren. Die bestehende App bei einem Signatur- oder Installationsfehler installiert lassen. Nach erfolgreicher Aktualisierung zuerst Appversion/Build und genaue Android-/One-UI-Version erfassen und den Datenerhalt vergleichen.

Unter **Mehr → Gemeinsam testen** beginnt die kurze Auswahl mit sechs Stationen:

1. **G1 – Wecker:** Den separaten Test bewusst starten und tatsächlichen Ton, Vibration und Anzeige getrennt berichten. Danach die unveränderte nächste Hauptweckzeit prüfen.
2. **G21 – Alltags-Erinnerungen:** Die neue Diagnose mit den einzelnen Kanälen öffnen und eine tatsächlich geplante normale Meldung beobachten. Eine grüne globale Freigabe allein reicht als Bericht nicht aus.
3. **G62 – Einstellungen:** Uhrzeit und Dauer direkt eingeben, Bildschirmabstand und manuelle PC-Zeit nachvollziehen; danach eigene Werte wiederherstellen.
4. **G92 – Aufgabe und Wiederaufnahme:** Einen eigenen Teilschritt bewusst starten, pausieren und nach Wiederöffnung fortsetzen. Nahe Arbeitsaufgaben dürfen nur eine Vorschau sein und keine Arbeit starten.
5. **G95 – Bedienung und Quellen:** Routinen am Griff sortieren und gespeicherte Texte/Dauern vergleichen. Zusätzlich die Zeitübersicht ansehen; ein Routinen-Quellenlink soll den Editor öffnen und keinen Fokus starten.
6. **G96 – Stummer Schlafhinweis:** Freiwillig einen kurzen Versuch mit entsperrtem Display und anderer App durchführen; ausgeschaltetes/gesperrtes Display separat prüfen. Schließen/Abbrechen und den manuellen Öffnenweg beobachten; anschließend die eigene Einschlafdauer wiederherstellen.

Nur tatsächlich beobachtete Teile als Ergebnis speichern. Anschließend lassen sich die Testberichte als Datei exportieren. Die spätere Dateiauswahl zeigt zuerst eine Vorschau; Übernahme und Verwerfen sind getrennt. Frühere Beobachtungen behalten Gerät, Datum, Version und Herkunft und werden nicht zu neuen Erfolgshäkchen.

## Einmalige Einrichtung für spätere Updates

Für spätere Updates ohne wiederkehrenden PC-Schritt kann der **vorhandene passende Keystore einmalig als GitHub Secrets eingerichtet** werden. Der private Schlüssel und seine Passwörter gehören weder in den Chat noch in Git. Danach kann der manuelle Android-Update-Workflow auf main gestartet werden; ein leeres SHA-Feld verwendet ausschließlich den hinterlegten freigegebenen Stand mit dessen exaktem grünen CI-Nachweis. Fehlt dieser Nachweis, wird kein anderer Commit automatisch ausgewählt.

Der getrennte Signierjob prüft Daten, Paket und Zertifikat. Ohne vollständige Secrets entsteht kein als installierbar ausgegebenes Update. Herunterladen und Installation auf dem Handy bleiben bewusste Schritte; ein neuer Workflow ist noch kein erfolgreich ausgeführter Remote-Signierlauf. Die [Play-Roadmap](ANDROID_PLAY_ROADMAP.md) behandelt die darüber hinaus nötigen Konto-, Signierungs-, Test- und Veröffentlichungsentscheidungen. Eine Play-Aufnahme oder ein verlustfreier Wechsel der bisherigen Signatur ist noch nicht belegt.

## Quellen und Detailberichte

Live gelesene npm-/Maven-Artefakte und gepinnte AOSP-Quellen belegen die jeweils beschriebenen Verträge. Mehrere offizielle Android-/Play-, Samsung-, Konkurrenz- und Forschungsseiten waren durch die Netzfreigabe blockiert. Diese Inhalte bleiben unbestätigt; aus einer URL oder einem fehlgeschlagenen Abruf wird kein Ergebnis abgeleitet. Für Play müssen außerdem das zusammengeführte Manifest des finalen Pakets und insbesondere die neue freiwillige Overlayfreigabe berücksichtigt werden. Aktuelle Play-Regeln werden erst bei erfolgreichem Zugriff und konkreter Einrichtung bestätigt.

Details: [npm](UPDATEPRUEFUNG_NPM.md), [AndroidX](UPDATEPRUEFUNG_ANDROIDX.md), [Audio](UPDATEPRUEFUNG_ANDROID_AUDIO.md), [TypeScript](UPDATEPRUEFUNG_TYPESCRIPT.md), [Teilschritt-Timer](UPDATEPRUEFUNG_TEILSCHRITT_TIMER.md), [Alltags-Erinnerungen](UPDATEPRUEFUNG_BENACHRICHTIGUNGEN.md), [nativer Schlafhinweis](UPDATEPRUEFUNG_SCHLAFHINWEIS_NATIV.md), [Jetzt-Einstieg](UPDATEPRUEFUNG_JETZT_EINSTIEG.md), [Zeitübersicht](UPDATEPRUEFUNG_ZEITUEBERSICHT.md), [OCR/Rauschen](UPDATEPRUEFUNG_KANDIDATEN.md), [Forschung](UPDATEPRUEFUNG_FORSCHUNG.md), [Geräteprüfung](GERAETETEST.md), [Testnachweise](ANKER_TESTNACHWEISE.md).
