# NFC-Machbarkeit und Prüfpfad für F-008

## Aktueller F-008-Softwareabschluss (13.11.2026)

Auf sauberem `e5f0030`, Branch `entwicklung/anker-neu`, ausdrücklich beauftragten lesenden Umfang umgesetzt. Die anschließenden T-004-Abschnitte sind der unveränderte historische Entwurf. Dessen Voraussetzungen sind jetzt softwareseitig erfüllt; E-005-Geräteabnahme bleibt offen. Kein Tag-Schreiben oder dauerhafte Zuordnung.

`NfcAnchorModel.kt` akzeptiert nur genau einen TNF_MIME_MEDIA-Record, MIME `application/vnd.frnkrm.anker.anchor`, strikt dekodiertes UTF-8 exakt `anker:1:now`, `anker:1:prep` oder `anker:1:recover`, maximal32Payload-/256Nachrichtenbytes. Zusätzlich leere NDEF-Record-ID erforderlich. Keine Normalisierung, Extras, URI/Text/AAR oder andere Ziele. Kein Tag-UID-Zugriff; freie Tagdaten verlassen den Parser nicht.

Ein `NfcAnchorReader` im vorhandenen Plugin liest nur Androids gecachte NDEF-Nachricht im Reader Mode (A/B/F/V, NO_PLATFORM_SOUNDS, ausdrücklich kein SKIP_NDEF_CHECK). Kein Ndef.connect/read/write/format, keine NFC-Intentfilter/Receiver/Dienste. Manifestdelta genau NFC-Recht und uses-feature optional. Kein Tool-/Paket-/Versionsupdate.

Vier passende TS/Kotlin-Methoden: `getNfcStatus`, `scanNfcAnchor(sessionId)`, `cancelNfcScan(sessionId)` und als begründete Entwurfspräzisierung **`confirmNfcAnchor(sessionId,target)`**. Letztere prüft vorhandene Vorschau, ursprüngliche Frist und aktuellen Vordergrund-/Sperr-/Wecker-/Adapterzustand nativ erneut und verbraucht sie einmalig. Keine Öffnungsfreigabe aus überholter Webvorschau. Vorzeitige Bestätigung zerstört keinen laufenden Scan; alte Kennungen/Generationen beeinflussen keinen neuen.

Maximal30Sekunden monotone Gesamtsitzung einschließlich Vorschau. Funk endet bei gültigem Ergebnis; ein nur sitzungsgebundener200ms-Wächter verwirft bei Frist/fehlender Eignung. Pause/Stop/Destroy und Alarmstart brechen zusätzlich direkt ab. Sperre/Power/WindowFocus/Vordergrund vor Scan, Ergebnis und Bestätigung prüfen. Resume öffnet keinen Scan. UI-Frist/Generation schützen auch gegen hängende Brücke/verspätete Bestätigung nach Abbruch oder Navigation. Vorschaubestätigung öffnet nur aktuelle vorhandene Ziele; Timerfortsetzung bleibt bei deren Besitzer ausdrücklich.

Seite `/anker` unter Mehr: inaktiv beim Öffnen, eigener Scanstart, neutrale Vorschau, Öffnen/Nicht öffnen. Drei manuelle Ziele bleiben auf Web/PWA/Windows sowie bei NFC fehlend/aus verfügbar. Unbekannter Brücken-/Sperrzustand gibt kein Öffnen frei; bestehende Shellnavigation bleibt verfügbar. Keine private Plan-/Aufgabenreferenz oder Rohdaten/UID in Brücke, DB, Diagnose, Backup, Import, Sync oder PC. Flüchtige Bedienkennungen sind keine Authentifizierung oder Ortsbelege.

Softwarebelege:48gezielte TS-Fälle(14neu),274Android-JUnit in31Suiten(14neu),22Browserfälle(17neu+5bestehende). Lint0Fehler/1bekannte Warnung, Typecheck/Build grün. Lokaler Chromium156-Pfad,320px/160Prozent Schrift. [Testnachweise](ANKER_TESTNACHWEISE.md), [Datengrenzen](DATENSCHUTZ_DATENGRENZEN.md). Rohbelege/Sicherung `/workspace/anker-f008-20261113/`. Keine reale NFC-/Sperr-/Wecker-/Tagbeobachtung. Nach F-008 stoppen; nächster eigener Auftrag F-009 nur lokale stille Fokusbegleitung. E-005 verwendet weiterhin den unten beschriebenen Geräteprüfpfad nach gesonderter Freigabe.

## Historischer T-004-Vorbereitungsstand

Stand 13.11.2026. Ergänzende T-004-Vorbereitung auf sauberer Basis `5b6f893602c00da6cd1b7c4d13a821e0b47c1b10`, Branch `entwicklung/anker-neu`. **Lesender Softwareumfang technisch vorbereitbar; keine NFC-Funktion implementiert oder freigegeben.** Reale Android-/NFC-Beobachtungen bleiben offen. Anforderung: [ANKER_PLAN.txt](ANKER_PLAN.txt), F-008/V-004 und E-005; Datenrahmen: [DATENSCHUTZ_DATENGRENZEN.md](DATENSCHUTZ_DATENGRENZEN.md).

## Tatsächlich geprüfter Bestand

| Gegenstand | Beleg am vorhandenen Stand | Folgerung |
|---|---|---|
| Toolchain | JDK/Javac21.0.13 ausgeführt, jeweils Exit0. SDK android-36 Revision2/Extension17, Commandline-Tools23.0 und Build-Tools35.0.0 aus installierten source.properties gelesen | Keine Installation oder Versionsänderung erforderlich. Wrapper8.14.3/AGP8.13.0/Kotlin2.4.21, minSdk26, compile/target36 aus Projektdateien erhalten |
| NFC-APIs | Installiertes offizielles android.jar mit javap gelesen: NfcAdapter, ReaderCallback, Ndef/NdefMessage/NdefRecord, getDefaultAdapter/isEnabled, enable/disableReaderMode | Kein zusätzlicher Capacitor-/NFC-Fremdplugin nötig. Reader Mode laut installiertem data/api-versions.xml seitAPI19, unter minSdk26 |
| API-Verhalten | Offizielle SDK-Stubquellen android-stubs-src.jar: Reader Mode nur für Activity im Vordergrund; Adapter kann fehlen; NDEF-Cache kann null sein; NDEF-I/O verlangt NFC-Recht und darf nicht auf dem Hauptthread laufen | Fehlend/aus/leer/ungültig/abgebrochen als normale Ergebnisse behandeln, manuell fortfahren |
| Bestehende NFC-Funktion | Begrenzte Suche: nur der allgemeine Diagnosegrund nfc in NativeDiagnosticModel.kt und core/diagnostics/index.ts, kein NFC-/NDEF-Lesepfad oder Adapteraufruf. App-Manifest ohne NFC-Recht, NFC-Feature oder NFC-Intentfilter. Vorhandene zwei generierte Debug-Merge-Manifeste ebenfalls ohne diese Einträge | Aktuell kein Reader-/Tag-Einstieg. Generierte Manifeste sind erhaltene Artefakte, kein neuer Build oder neuer Freigabenachweis |
| Native Brücke | MainActivity registriert AnkerNativePlugin. TS-Vertrag und Webfallback in src/platform/native.ts; Kotlin-Methoden/Lebenszyklus in AnkerNativePlugin.kt | Dort passend beidseitig ergänzen, keinen zweiten Plugin-/Planungsbesitzer einführen. Pause/Destroy bereits für begrenzte native Vorgänge nutzbar |
| Bestehende Einstiege | src/platform/links.ts erlaubt feste App-Hosts; App.tsx schützt echte Weckerübergänge. QuickEntries.tsx: /fokus-start startet bewusst Fokus; Focus.tsx kann beim Öffnen neuen Routine-Timer erzeugen | NFC darf weder fremde URL ungeprüft weiterreichen noch diese Startwege automatisch auslösen |
| Passive Ziele | /vorbereitung in Daily.tsx zeigt vorhandene Vorbereitung/Packlisten; Häkchen schreiben erst bei eigener Bedienung. /wiedereinstieg nutzt vorhandene Recovery. / zeigt aktuelle Jetzt-Handlung | Diese drei Ziele als begrenzten ersten Umfang verwenden; keine zweite Checkliste, Routine oder Aufgabe |
| QR | platform/qr.ts nutzt vorhandenen Google-Code-Scanner ohne neues Kamerarecht; bei fehlendem Modul ist er nicht sofort verfügbar. Alarm.tsx/guidance.ts prüfen den eigenen QR-Wert bzw. nativen Hardwarebeleg | QR bleibt erhalten, ein neutraler NFC-Anker ersetzt weder Wecker-QR noch Bett-/PC-Nachweis. Manueller Rückweg muss auch ohne Scanner-Modul funktionieren |

Rohbelege unter `/workspace/anker-nfc-vorbereitung-20261113/`: inventory.json mit Manifest-/SDK-Hashes, toolchain-inventory.log, sdk-nfc-api.log, sdk-local-metadata.log und sdk-nfc-javadoc.log. Quellen/Definitionen geprüft, kein Reader aufgerufen. Hier kein zugeordnetes NFC-Testgerät/Tag, platform-tools/adb nicht eingerichtet. Das beweist keine Hardwareeigenschaft des privaten Galaxy. SDK/JDK sind Umgebungstools und nicht Teil des Git-Bundles.

## Kleinster sinnvoller F-008-Umfang – Vorschlag, noch nicht umgesetzt

**Ein ausdrücklich gestarteter, zeitlich begrenzter Lesevorgang im entsperrten Android-Vordergrund.** Standard ist aus/inaktiv; keine dauerhafte Freigabe oder automatische Wiederaufnahme aus Sicherung/Reload. Keine Speicherung erforderlich: der Tag enthält ein festes neutrales Ziel, die App prüft es und bietet eine bewusste Bestätigung zum Öffnen. Kein Scanverlauf oder UID-Mapping.

| Neutrales Ziel | Vorhandener Besitzer / bewusste Bestätigung | Beispiel für selbst gewählten Platz |
|---|---|---|
| now | Jetzt öffnen → /, aktuelle gemeinsame Handlung | Bad: aktuelle Routine, falls sie tatsächlich dran ist; sonst aktuelle Handlung, keine erzwungene Morgenroutine |
| prep | Vorbereitung öffnen → /vorbereitung, vorhandene Liste und Packvorbereitung | Haustür oder Ablage: bewusst gewählte Vorbereitung; diese Seite heißt Für morgen vorbereiten, keine Zusage zur heutigen Abfahrtsbereitschaft |
| recover | Wiedereinstieg öffnen → /wiedereinstieg | Schreibtisch: aktuelle gültige Recovery, Timerfortsetzung weiterhin ausdrücklich |

Die Plätze sind Beispiele für die private Beschriftung, kein technischer Ortsbeleg. Feste Ziele statt frei eingegebener URLs/Aufgaben-IDs. Keine persistenten Zuordnungen, GPS, Hintergrundbeobachtung oder Ortsereignisse. Zielauswahl/Scanner starten durch eigenen Handgriff; vor Öffnen den tatsächlichen aktuellen Appzustand erneut prüfen. Wenn ein Wecker klingelt, bleibt dessen bestehender Weg vorrangig. Der neue NFC-Lesepfad öffnet keine externen URLs und löst keine Systemwirkung aus.

### Einrichten und Tagformat

Erster Softwareumfang ist **nur Lesen bereits vorbereiteter neutraler NDEF-Tags**. Bewusste Einrichtung bedeutet: Ziel ansehen, Lesevorgang selbst starten, erkannten neutralen Anker ansehen und das Öffnen bestätigen. Ohne passenden Tag sind dieselben manuellen Ziele erreichbar. Kein Beschreiben, Formatieren, Sperren oder Überschreiben von Tags durch diesen ersten Umfang. Beschaffung/Vorbereitung eines Testtags benötigt einen eigenen bewussten Schritt außerhalb dieses Tasks; keine fremde Writer-App wird installiert oder aufgerufen. Ein vollständig in Anker integrierter Tag-Schreiber wäre ein zusätzlicher, gesondert zu beauftragender Umfang.

Festgelegter technischer Entwurf, keine Android-Plattformgrenze: genau ein NDEF-Record, TNF_MIME_MEDIA, MIME `application/vnd.frnkrm.anker.anchor`, UTF-8-Payload **exakt** einer von `anker:1:now`, `anker:1:prep`, `anker:1:recover`. Payload höchstens32Bytes, gesamte NDEF-Nachricht höchstens256Bytes. Keine stillen Normalisierungen, Trims oder Mehrdeutigkeiten. Andere Versionen/Records, AAR, URI-/Text-Records, falscher MIME/TNF, Zusatzdaten, überlange/fehlerhafte UTF-8-Payloads und Mehrfachrecords ablehnen. Kein vom Tag übernommener freier Text in UI, Logs oder Brückenantwort.

Nicht auf den Tag: Namen, Adressen, Termine, Aufgaben-/Teil-IDs, freie Notizen, QR-Geheimnis, Kopplung/Pins, Benutzerkennung oder Authentifizierungstoken. Gültige Tags sind frei kopierbar und beweisen weder Identität, Aufenthalt, Wachheit, Schrittabschluss noch Schlaf. Kein Tag-UID-/Hash-Vergleich als Sicherheitsnachweis. Ein manipulierter äußerer Tag kann Android/andere Apps unabhängig beeinflussen. Die neue F-008-Lesesitzung verarbeitet ausschließlich ihr begrenztes Format. Vorhandene allgemeine App-Links bleiben ein gesonderter bestehender Einstieg, keine NFC-Freigabe.

### Android-Vertrag und Lebenszyklus

- Nur im später ausdrücklich beauftragten F-008 zulässig: Manifestrecht `android.permission.NFC` und `<uses-feature android:name="android.hardware.nfc" android:required="false" />`. Die unten verlinkte Android-Berechtigungsreferenz klassifiziert NFC als normales Manifest-/Installationsrecht, keine Kamera-/Standort-Laufzeitfreigabe; eigene Scanwahl bleibt erforderlich. Lokal sind Konstante und NFC-Methodenbedarf belegt, kein System-Freigabedialog ausgeführt. Jetzt nichts eingetragen. Keine neuen NFC-Intentfilter, Receiver, Services, Web-NFC-, Hintergrund-, Standort-, Kamera-, HCE-/Beam- oder Herstellerrechte.
- Vor Start Fähigkeiten prüfen: native Plattform, NFC-Feature/Adapter vorhanden, NFC eingeschaltet, App im Vordergrund, Gerät entsperrt, kein aktiver Wecker. Fehlendes/ausgeschaltetes NFC führt zu verständlichem Rückweg. Globales NFC nicht selbst ein-/ausschalten. Ohne NFC bleibt die App installierbar/nutzbar; Web/PWA/Windows bieten nur manuelle Ziele.
- Reader Mode für genau eine ausdrückliche Sitzung, vorgeschlagen maximal30Sekunden mit monotoner Frist; das ist ein Entwurfswert. Geeignete Leserflags für NfcA/B/F/V; **kein FLAG_READER_SKIP_NDEF_CHECK**, da dann laut SDK die benötigte Ndef-Technologie/Erkennung entfällt. FLAG_READER_NO_PLATFORM_SOUNDS kann den Android-Auffindeton unterdrücken, ist kein Beleg über sämtliche One-UI-Signale.
- Bevorzugt bereits beim Fund gelesene cachedNdefMessage nutzen, keine eigenen Tag-Kommandos/Schreibzugriffe oder Authentifizierung. Vor Kopie/Parsing Größen-/Recordgrenzen prüfen. Falls später echte I/O notwendig würde: Hintergrundausführung, IOException/TagLostException/FormatException und schließen/cancel sauber behandeln. Keine SDK-NDEF-Konstruktoren als echte Tags in einfachen JVM-Tests ausgeben.
- Genau eine ausstehende PluginCall/Sitzungskennung. Doppeltippen keinen zweiten Reader beginnen lassen. Nach Erfolg, Fehler, Timeout, explizitem Abbruch, Pause/Stop/Destroy oder beginnendem Wecker Reader deaktivieren und Sitzung abschließen. Resume startet nichts neu. Verspätete Callbacks alter Sitzungen verwerfen, auch nach neuer Sitzung oder geänderter UI-Wahl.
- Vor Ergebnisübernahme und Navigation erneut Vordergrund/Entsperrung/Weckervorrang prüfen. MainActivity kann bei Alarm absichtlich über dem Sperrbildschirm liegen; bloßes Activity-Resume reicht deshalb nicht. Bestehenden Alarmzustandsweg nutzen, keinen zweiten Weckercontroller. QR-/Wecker-/Notfallwege behalten ihre Identität.
- Vorgeschlagene kleine Brückenschnittstelle im vorhandenen AnkerNative: NFC-Status, eine Scanmethode, Abbruch. TS/Kotlin/Webfallback passend halten; nur bekannte Ergebnis-Codes und neutrales Ziel zurückgeben. Keine rohe NDEF-Nachricht, Tag-UID/Technologieliste, Scanzeit oder private Payload. Neue Scanner-Sitzung ausschließlich flüchtig, keine Wiederbelebung durch importierte Daten.

## Datenschutz vor F-008

Dieser erste Umfang benötigt weder neue Settings-/LocalData-Felder noch eine DB-Tabelle: nur vorhandene Zielansichten und flüchtige Sitzung. Ablehnung/Abbruch/Tagzustellung verändert keine bestehenden Nutzdaten, Timer, Häkchen, Punkte oder Reminder. Bestätigtes Öffnen benutzt dieselben Besitzer; erst spätere eigene Bedienhandlungen haben ihre bisherige Wirkung. Vorhandene optionale Dienstfreigaben einer geöffneten Seite bleiben deren eigene Grenze, kein neuer NFC-Datenkanal.

Keine Scanliste/-anzahl, Tages-/Ortsstatistik, UID, NDEF-Rohdaten oder neuer Diagnoseexport. Keine zusätzliche Sync-/PC-/Kalender-/Widgetausgabe und keine SDK-/Serverregistrierung. Sitzungsdaten bei Ende verwerfen; Backup/Import übernimmt keine laufende Scansitzung oder Scanfreigabe. Soll später eine dauerhafte Zuordnung gewünscht sein, vorher Schema/Zweck/Felder, lokale Wahl, Aufbewahrung/Löschung und vollständige Backup-/Teilimportgrenzen in T-005 konkret ergänzen. Dieser Bericht autorisiert sie nicht.

## Geplanter Softwareprüfpfad – noch keine Ergebnisse

| Bereich / bestehender Besitzer | Erforderliche Fälle ohne Testduplikate | Ausführung / Grenze |
|---|---|---|
| Reines NFC-Modell, neu im vorhandenen Core-/Native-Umfang | Drei erlaubte Ziele, falscher MIME/TNF/Version/UTF-8, leere/zu große/mehrfache Records, URI/AAR/QR-Geheimnis als Payload; keinerlei Befehle/Erledigung aus Parsergebnis | Kotlin-Parser auf einfachen Recordwerten/Bytes testen, TS nur Ergebnisvertrag und erlaubte Zielprojektion; gemeinsame Fallwerte statt unabhängiger Protokollvarianten. Keine neuen Mockito/Robolectric-Pakete notwendig |
| Native Sitzung / AnkerNativePlugin | fehlender Adapter, aus, gesperrt, Alarm, Abbruch/Timeout/Pause/Destroy, Doppeltippen, verspätetes Ergebnis nach neuer Sitzung; keine automatische Resume-Aktivierung | Pure Sitzungsregeln mit bestehender JUnit-Werkzeugkette; Android-API-/Lebenszyklus-/Readerwirkung zusätzlich real prüfen. Mocks sind kein Funk-/Gerätenachweis |
| Brücke/Webfallback/UI | Nicht-Android/manuell, generische Fehler, expliziter Start/Bestätigung, wiederholter Tag genau eine Zielöffnung, Abbruch/Seitenwechsel,320px/Großschrift, klare fehlende NFC-Eignung | Lokale Chromium-/Brückenregressionen; e2e/recovery-preview.spec.ts, e2e/transitions.spec.ts, passende Quick-Recovery-/Hauptaktionsfälle erhalten und nur bei betroffener Quelle wiederholen |
| Bestehende Planung/Store/Datengrenzen | Tagzustellung/Abbruch öffnet/startet/erledigt nichts; Zielzustand nach Plan-/Tageswechsel aktuell; Timerpause erhalten; keine neuen gespeicherten/übertragenen Daten | Vorhandene Recovery-/Transition-/Store-/Backup-/Privacy-/PC-/Widgetfälle gezielt auswählen; keine zweite Planung oder tägliche NFC-Schreibaktion |
| Gemeinsame native Softwareabnahme | TS/Kotlin-Vertrag passt, Manifest optional, vorhandene Wecker/Reminder/QR-Besitzer bleiben | Nach Implementierung `source /workspace/anker-toolchains/env.sh`, `node scripts/gradle.mjs :app:testDebugUnitTest`; dazu Lint/Typecheck/Build. Bestehende Node-Abhängigkeiten/SDK verwenden. Capacitor-Sync nur bei nachgewiesen fehlenden generierten Dateien und danach Diff prüfen. Keine Signierung/APK-Installation/Veröffentlichung |

In dieser Vorbereitung **keine** dieser künftigen NFC-Suiten ausgeführt oder als bestanden markiert. F-007s114gezielte Fälle/23Browserfälle und F-003s260Android-JUnit bleiben historische Belege auf ihrem jeweiligen Quellstand. Für unveränderten Produktcode kein neuer kompletter Lint-/Build-/Browser-/JUnitlauf nötig.

## Reale Prüfung – E-005 und bestehende Stationen, alles offen

Keine neuen G-IDs oder Ergebnis-Häkchen. E-005 bleibt der Besitzer optionaler NFC-Geräteeinrichtung. Vor späterem Versuch Buildcommit/App-Version, tatsächliches Gerät/Android-/One-UI-Version, NFC-Zustand und neutral vorbereiteten Tagtyp/Format notieren. Frühere Galaxy-Nutzerangabe ist kein NFC-Eignungsnachweis.

| Beobachtung im späteren E-005-Versuch | Bestehende Station / Abgrenzung |
|---|---|
| NFC-fähiges Galaxy, NFC aus/an durch Nutzer; möglichst Gerät ohne NFC; passende/ungeeignete Tags, Wiederholung, Tag entfernen; Abbruch/30Sekunden; Sperren/Hintergrund/Resume | E-005 als zusätzliche NFC-Variante, UI-/Rückwege an G98. Kein automatischer Systemschalter und keine echte Tagbeschreibung in diesem Prüfauftrag |
| Erkanntes Ziel bestätigen/abbrechen, drei manuelle Ziele, laufender/pausierter Fokus, tatsächlicher Plan-/Tageswechsel, keine Häkchen/Punkte aus Zustellung | G78/G80/G81/G85 und G98 statt neuer Aufgaben-/Timerstationen; NFC ergänzt nur den Einstieg |
| Wecker beginnt während Scans; vorhandener Wecker-QR, Bett-QR und Notausgang funktionieren weiterhin | G1/G99/G101 bei eigener späterer Gerätefreigabe. NFC ist weder QR-Ersatz noch Hardwarebeleg/PC-Notverlängerung |
| Installation auf nicht NFC-fähiger Variante, normale Daten-/Backupgrenzen, keine neue Systemfreigabe aus Import | E-005 sowie bestehende G84/G86. NFC-UID/Quellpayload darf weder Datei noch Diagnose enthalten |

Keine Windows-NFC-, Kalender- oder Serverfunktion im ersten Umfang. Bestehende E-002/E-003/E-004-Beobachtungen bleiben gesondert offen; NFC-Mocktests schließen sie nicht ab.

## Voraussetzungen und nächster zulässiger Auftrag

**Kein festgestellter Toolchainblocker für den beschriebenen lesenden Softwareumfang.** APIs und Compiler vorhanden, passende Brücke/Ansichten vorhanden. Noch offen sind der ausdrücklich beauftragte F-008-Softwareumbau einschließlich genau benannter optionaler Manifestdeklarationen und später die echte E-005-NFC-Eignungs-/Gerätebeobachtung samt vorbereitetem neutralem Testtag. Ein NFC-Adapter oder Tag kann aus diesem Cloud-Executor nicht verifiziert werden. App-Code, Manifest, Pakete und Geräteeinstellungen wurden hier nicht geändert.

Nächster Einzelauftrag kann F-008 in genau diesem begrenzten lesenden Umfang sein. Er muss die beiden Manifestdeklarationen ausdrücklich erlauben; keine weitere Berechtigung, Tag-Schreibfunktion, dauerhafte Zuordnung oder echte Geräte-/PC-/Cloud-/Play-Aktion daraus ableiten. Ein nativer Simulator/Browser ersetzt E-005 nicht. F-008 und E-005 bleiben bis eigenen Ergebnissen offen.

## Quellen und Beleggrenzen

- Primär offline geprüft: installierte offizielle SDK36-Revision2-Dateien android.jar, android-stubs-src.jar, data/api-versions.xml und deren SHA256 im lokalen inventory.json. Javadoc-Auszüge im Sicherungsordner, keine heruntergeladenen/neu installierten Pakete. Android API-Stubs sind Schnittstellen-/Dokumentationsbelege, keine ausgeführte NFC-Implementierung.
- Produktquellen: android/variables.gradle, build.gradle, gradle/wrapper/gradle-wrapper.properties, app/src/main/AndroidManifest.xml, MainActivity.kt, AnkerNativePlugin.kt; src/platform/native.ts, qr.ts, links.ts, guidance.ts; src/App.tsx, ui/pages/QuickEntries.tsx, Daily.tsx, Focus.tsx und Alarm.tsx. Unverändert auf obiger Basis geprüft.
- Weiterführende offizielle Referenzen: [NfcAdapter](https://developer.android.com/reference/android/nfc/NfcAdapter), [NFC-Manifestrecht](https://developer.android.com/reference/android/Manifest.permission#NFC), [NDEF](https://developer.android.com/reference/android/nfc/tech/Ndef), [NFC-Grundlagen](https://developer.android.com/develop/connectivity/nfc/nfc). Diese Webreferenzen wurden in diesem Task nicht extern abgerufen; lokale SDK-Belege und tatsächliche Laufzeit-/Gerätebeobachtungen sind getrennt ausgewiesen.
