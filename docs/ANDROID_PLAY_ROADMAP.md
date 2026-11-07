# Android-Updates ohne PC und Google-Play-Roadmap

Stand: 7. November 2026. Geprüfter Quellstand für diese Vorbereitung: `2721fff`; Paketkennung `de.frnkrm.anker`, `minSdk 26`, `compileSdk 36`, `targetSdk 36`. Dieses Dokument aktiviert kein Konto, keine Zahlung, keinen Store, keine Veröffentlichung und keinen Upload.

Die Repository-Angaben unten wurden im Quellbaum geprüft. Eine aktuelle Bestätigung der Play-Regeln über die offiziellen Webseiten war in dieser Umgebung nicht möglich: `support.google.com` und `developer.android.com` fehlen in der durchgesetzten Netzwerkfreigabe. Der direkte Abruf der offiziellen Konto-Einstiegsseite und der Android-Signierungsdokumentation scheiterte am konfigurierten Proxy mit `CONNECT tunnel failed, response 403`. Die Quellenliste am Ende ist deshalb eine **offene Prüfliste für den tatsächlichen Einrichtungstermin**, keine Behauptung, dass die verlinkten Regeln am Dokumentdatum online bestätigt wurden. Die Netzwerkgrenze wurde nicht umgangen.

## Zwei mögliche Wege

| Weg | Ergebnis | Einmalig noch durch den Nutzer nötig | Grenze |
| --- | --- | --- | --- |
| Manuell gestarteter GitHub-Actions-Build | Ein geprüftes APK als Actions-Artefakt; nach Anmeldung bei GitHub auch auf dem Handy herunterladbar. | Vorhandenen passenden Keystore lokal sicher als GitHub Secrets einrichten, wenn signierte Builds gewünscht sind. | Der Download startet keine automatische Installation. Android muss die Installation aus der jeweiligen Quelle erlauben; Paket, Signatur und Versionscode müssen zur installierten App passen. Ohne vollständige Signing-Secrets ist ein unsigniertes APK kein installierbares Update. |
| Google Play | Nach Einrichtung, Tests und Freigabe Verteilung über einen Play-Testkanal oder den Store. Updates können anschließend über Play erfolgen. | Konto, gegebenenfalls Gebühr und Verifikation, belastbare Signierungsentscheidung, Tester, Store-/Datenschutzangaben und Freigaben. | Eine Play-Aufnahme und eine unterbrechungsfreie Aktualisierung der bisherigen Debug-signierten Installation sind derzeit nicht nachgewiesen. Der manuelle APK-Workflow lädt nichts zu Play hoch. |

Der erste Weg beseitigt den PC als Voraussetzung für **jedes weitere** Update nach der einmaligen Einrichtung. Er beseitigt weder den Schutz des Signierschlüssels noch die Bestätigung der Installation auf dem Handy. Für Play sind zusätzliche Schritte erforderlich; das bestehende APK-Artefakt ersetzt kein geprüftes Play-App-Bundle und keine Store-Freigabe.

## Signierschlüssel und öffentlicher Fingerabdruck

Der bestätigte öffentliche SHA-256-Fingerabdruck des bisherigen Zertifikats lautet:

```text
3F:75:45:F5:DD:8E:4F:8A:87:BE:F3:86:96:FB:16:28:4B:02:A2:D7:83:A0:F4:A3:5F:3B:2B:D0:84:D3:EA:AD
```

Dieser Fingerabdruck identifiziert das **öffentliche Zertifikat**. Er enthält keinen privaten Schlüssel, ist zum Vergleichen geeignet und kann den privaten Schlüssel nicht ersetzen. Der Keystore auf dem PC enthält den privaten Schlüssel; Dateiinhalte, Keystore-Passwort und Schlüsselpasswort gehören weder in Chat, Repository, Befehlsargumente noch Logs. Der Fingerabdruck allein erlaubt keinem Build, ein kompatibles Update zu signieren.

Der private Keystore liegt aktuell auf dem PC des Nutzers. Für künftig signierte Actions-Builds müsste der Nutzer einmalig eine geschützte Kopie mit der lokalen Einrichtungshilfe als verschlüsselte GitHub Secrets hinterlegen. Das ist eine zusätzliche Aufbewahrung bei GitHub; der Schlüssel bleibt dann nicht ausschließlich auf dem PC. Das Original und eine gesicherte Offline-Kopie bleiben wichtig. Die Einrichtung wird nicht durch diese Dokumentation ausgeführt, und hier wird kein neuer Schlüssel erzeugt.

Bei Play App Signing sind zwei Rollen auseinanderzuhalten:

| Schlüssel | Verwendung | Bedeutung für ein bestehendes installiertes APK |
| --- | --- | --- |
| App-Signierschlüssel | Signiert die APKs, die Android auf dem Gerät installiert; bei Play App Signing verwaltet Play diese Rolle. | Diese Signierungsidentität beziehungsweise eine von Android unterstützte und korrekt eingerichtete Signaturrotation bestimmt die Updatekompatibilität. |
| Uploadschlüssel | Bestätigt gegenüber Play, wer ein App-Bundle hochladen darf. | Ein Wechsel oder Zurücksetzen dieses Schlüssels allein macht ein anders signiertes APK nicht zum kompatiblen Update. |

Die bisherige Debug-Signierung ist kein freigegebener Play-Releaseweg: Play akzeptiert keine mit dem Android-Debugzertifikat signierten Release-Uploads. Ein anderer Alias oder ein umbenannter Keystore ändert das Zertifikat nicht. Vor einer Anmeldung oder einem Upload muss deshalb anhand der aktuellen Play-Signierungsregeln und des tatsächlichen bestehenden Zertifikats geklärt werden, ob es für diese installierte App überhaupt einen unterstützten Übergang gibt. Eine Änderung des privaten Schlüssels auf eigene Faust löst das Problem nicht.

Für ein gewöhnliches Update müssen insbesondere Paketkennung, akzeptierte App-Signierungsidentität und ein höherer `versionCode` zusammenpassen. Play App Signing mit einem neuen, abweichenden App-Signierschlüssel darf nicht als nahtloses Update der bisherigen Installation versprochen werden. Ein neuer Paketname erzeugt eine separate App; dafür wären ein bewusst geplanter Export/Import und angepasste Callback- beziehungsweise Dienstkonfiguration nötig. Das wäre eine eigene Migration und wird hier nicht umgesetzt.

## „App nicht installiert“ beim früheren Systemleisten-Update

Die Meldung auf dem Handy allein identifiziert die Ursache nicht. Der vorhandene historische Nachweis zum Systemleisten-Paket nennt `de.frnkrm.anker`, `1.2.0-rc.3`, `versionCode 5`, die Eingabe `Anker-Systemleisten-unsigniert.apk` und die von der lokalen Signierhilfe vorgesehene Ausgabe `Anker-Systemleisten-Update.apk`. Die damalige Anleitung setzte daher die lokale Signierung voraus. Ob auf dem Handy diese Ausgabe oder die unsignierte Eingabe geöffnet wurde, ist aus dem Cloud-Artefakt nicht belegbar.

Eine inzwischen installierte Version mit höherem Versionscode kann außerdem ein Update auf Code 5 ablehnen. Der installierte Versionscode, das installierte Zertifikat und der konkrete Android-Installationsfehler des Geräts sind hier unbekannt. Ein bekanntes APK-Zertifikat beweist nicht, dass auf dem Handy dieselbe Datei installiert ist.

Sichere Diagnose in dieser Reihenfolge:

1. Die vorhandene App installiert lassen. Falls möglich einen bewusst ausgewählten lokalen Datenexport erstellen und sicher aufbewahren; ein JSON-Export kann sensible Inhalte im Klartext enthalten. Nicht zur Fehlerbehebung deinstallieren, App-Daten löschen oder einen Versionsschutz umgehen.
2. Die tatsächlich heruntergeladene Datei mit dem Buildbericht vergleichen: Dateiname, SHA-256, Paketkennung, Versionsname, Versionscode und erfolgreich geprüfte Signatur. Eine Datei mit `unsigniert` im Namen ist kein fertiges Handy-Update. Ein Dateiname allein beweist umgekehrt keine gültige Signatur.
3. Öffentliche Metadaten der installierten App mit denen des APKs vergleichen: `de.frnkrm.anker`, Zertifikat und `versionCode`. Wenn diese Informationen nicht auf dem Gerät sichtbar sind, kann eine spätere lokale ADB-Diagnose helfen. Sie ist kein Beleg, der in dieser Cloud bereits vorliegt.
4. Android-Version, freien Speicher, Downloadsicherheit und die Installationsberechtigung der tatsächlich verwendeten Browser-/Dateimanager-App prüfen. `minSdk 26` entspricht Android 8.0; Geräte- und Herstellerbeschränkungen bleiben möglich. Sicherheitsprüfungen nicht pauschal deaktivieren.
5. Den genauen Fehlertext beziehungsweise einen verfügbaren Installationsfehlercode festhalten. Beispielsweise weisen `INSTALL_FAILED_UPDATE_INCOMPATIBLE` und `INSTALL_FAILED_VERSION_DOWNGRADE` auf unterschiedliche Probleme hin. Erst nach einem konkreten Befund die passende Korrektur bauen.

Die kommende RC3 ist als Version `1.3.0-rc.3` mit Code 10 vorgesehen. Dieses Dokument belegt weder ihren fertigen Build noch die auf dem Gerät installierte Ausgangsversion. Ein höherer Code allein behebt keinen Zertifikatswechsel oder eine fehlende Signatur.

## Konkrete Play-Einrichtung in Freigabeschritten

Jeder Schritt endet mit einem prüfbaren Ergebnis. Die folgenden Punkte sind Vorbereitung; externe Aktionen erfolgen erst nach einer eigenen Entscheidung des Nutzers.

| Schritt | Konkretes Ergebnis vor dem nächsten Schritt | Noch offene Nutzerentscheidung oder Prüfung |
| --- | --- | --- |
| 1. Entwicklerkonto planen | Persönliches oder Organisationskonto, Land, erreichbare Kontaktdaten und Anforderungen an öffentliche Entwicklerangaben sind geklärt. | Welche Identität soll veröffentlichen? Aktuelle Identitäts-, Kontakt-, gegebenenfalls Geräte- und Organisationsverifikation im offiziellen Ablauf prüfen; keine D-U-N-S- oder Gerätepflicht pauschal auf jeden Kontotyp übertragen. |
| 2. Preis und Bedingungen bestätigen | Der aktuelle Preis und die akzeptierten Zahlungs-/Kontobedingungen sind unmittelbar im offiziellen Ablauf gelesen. | **Planungswert, hier nicht aktuell online bestätigt:** einmalig 25 USD für die Registrierung; die tatsächliche Anzeige sowie mögliche landesabhängige Abwicklung sind vor Zahlung maßgeblich. Es wird keine Zahlung ausgelöst. |
| 3. Signierungsübergang entscheiden | Tatsächliches bisheriges Zertifikat, geplanter Play-App-Signierschlüssel, Uploadschlüssel und Updatepfad sind dokumentiert; ein Test beweist die gewählte Migration. | Debug-Zertifikat und Play-Annahme prüfen. Wenn kein unterstützter Übergang möglich ist, einen separaten App-/Datenmigrationsweg bewusst entscheiden. Bestehende Installation nicht vorschnell ersetzen. |
| 4. Release-Build vorbereiten | Ein reproduzierbarer Release-Build, geprüftes App-Bundle für Play und die dazugehörigen Quellen-/Testbelege liegen vor. | Der neue manuelle Workflow liefert APKs; ein AAB-/Play-Uploadweg wäre ein eigener, ausdrücklich freizugebender Auftrag. Signing, Paketkennung und Versionscodes müssen über beide Wege konsistent bleiben. |
| 5. Technische Play-Anforderungen prüfen | Aktueller Ziel-API-Stichtag, native ABI-/64-Bit-/16-KB-Anforderungen und Bibliotheken sind für das **tatsächlich hochzuladende** AAB geprüft. | Der gelesene Quellstand verwendet Ziel-API 36. Daraus folgt keine pauschale Bestätigung aller im November 2026 geltenden Fristen. Android 17 oder ein neueres Ziel-SDK wird nicht still eingeführt. |
| 6. Angaben und Berechtigungen abschließen | Store-Eintrag, Zielgruppe, Inhaltsbewertung, Support, öffentliche Datenschutzseite, Data safety und alle zutreffenden Gesundheits-/Berechtigungserklärungen sind stimmig. | Tatsächliche Funktionen und erreichbare optionale Dienste des vertriebenen Builds beschreiben. Konto-/Datenlöschung prüfen, sobald Kontenerstellung oder entsprechende serverseitige Daten angeboten werden. |
| 7. Intern testen | Installation, Upgrade mit Datenbestand, Start nach Neustart, Alarm/Benachrichtigung, Offline-Nutzung und Ablehnung optionaler Berechtigungen sind auf echten Geräten protokolliert. | Tests müssen den Play-Signierungsweg und die tatsächlich erzeugten Split-APKs abdecken; ein lokaler APK-Test allein reicht dafür nicht. |
| 8. Erforderlichen geschlossenen Test absolvieren | Play Console akzeptiert den Test und gegebenenfalls den Antrag auf Produktionszugang. | **Planungswert, hier nicht aktuell online bestätigt:** Für neue persönliche Konten ab 13. November 2023 mindestens 12 angemeldete Tester über 14 zusammenhängende Tage vor dem Produktionsantrag. Die aktuelle Definition, Zählung und Kontozuordnung im offiziellen Artikel und in der Console prüfen. Tester müssen real mitwirken; Zeitablauf allein garantiert keine Freigabe. |
| 9. Veröffentlichung separat freigeben | Nutzer hat Listing, Datenschutz, Signierung, Testresultate und konkrete Verteilung geprüft. | Erst danach gesonderter Auftrag für einen Upload oder Rollout. Ein manueller Actions-Start erteilt keine allgemeine Publikationsfreigabe. |

## Berechtigungen und Daten: konkrete Prüfpunkte dieses Builds

Im gelesenen Manifest fehlt `SYSTEM_ALERT_WINDOW`. Die Vollbildanzeige eines Weckers ist deshalb nicht als allgemeine Overlay-Funktion zu deklarieren. Es werden dafür auch keine zusätzlichen Overlay-, Accessibility- oder VPN-Berechtigungen ergänzt.

| Vorhandene Funktion beziehungsweise Berechtigung | Im Quellstand erkennbarer Zweck | Vor Play-Verteilung benötigte Prüfung und Grenze |
| --- | --- | --- |
| `READ_EXERCISE`, `READ_STEPS` über Health Connect | Freiwillige Sportsynchronisation; Autorisierung fordert `workouts` und `steps`. Der gelesene Sync fragt Workouts ab und kann ab acht Minuten einen Sporteintrag für den Tag setzen. | Datenminimierung offen: Im gelesenen Quellstand wurde kein `querySteps` gefunden. Den tatsächlichen Zweck von `READ_STEPS` nachweisen oder die unbenötigte Anforderung in einem eigenen Codeauftrag entfernen. Nur tatsächlich benötigte Gesundheitsdaten deklarieren; Health-Connect-/Gesundheits-App-Erklärung, Zweckdarstellung und Lösch-/Widerrufsverhalten prüfen. Keine nicht implementierten Messungen oder medizinische Wirkung behaupten. |
| `USE_FULL_SCREEN_INTENT`, `USE_EXACT_ALARM`; `SCHEDULE_EXACT_ALARM` nur bis API 32 | Wecker, der auch bei gesperrtem Gerät sichtbar und rechtzeitig auslösen soll. | Aktuelle Play-Zulässigkeit, Kernfunktion, Console-Erklärungen und Nutzerzugriff prüfen. Manifest-Eintrag allein garantiert weder Store-Genehmigung noch automatische Berechtigung auf jedem Android-Gerät. Bei verweigertem Zugriff verständlich zurückfallen; keine pauschale Overlay-Freigabe verlangen. |
| `FOREGROUND_SERVICE_SYSTEM_EXEMPTED` für `AlarmService` | Länger laufender Alarmdienst. | Berechtigung und konkrete Laufzeitvoraussetzungen des FGS-Typs sowie gegebenenfalls Play-Erklärung und Demo prüfen. Eine erfolgreiche Kompilierung belegt die Policy-Eignung nicht. |
| `RECORD_AUDIO`, `FOREGROUND_SERVICE_MICROPHONE` für `SmartWakeService` | Optionaler experimenteller Aktivitätswecker; außerdem lokale Spracheingabe im entsprechenden Nutzerablauf. | Nur bei bewusster Nutzung autorisieren; Mikrofonstatus, Dienstlebensdauer und Stoppen sichtbar testen. Lokale ASR ohne Cloud-Fallback nicht mit einer Aussage über sämtliche anderen optionalen Datenflüsse vermischen. Keine Schlafphasenmessung oder Therapiewirkung versprechen. |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` | Optionale Orts-/Geofence-Abläufe; manuelle Alternative vorhanden. | Aktuellen Kernfunktions- und Hintergrundstandort-Nachweis, hervorgehobene Information vor Zustimmung, Ablehnungsfall und gegebenenfalls Play-Demo prüfen. Hintergrundstandort ist ein eigener Prüfpunkt und folgt nicht automatisch aus Vordergrundstandort. |
| `POST_NOTIFICATIONS`, `ACCESS_NOTIFICATION_POLICY`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Alarm-/Benachrichtigungsverhalten und vom Nutzer freigegebene Sonderzugriffe. | Den konkreten Zweck erklären und Betrieb ohne Sonderzugriff prüfen. Keine allgemeine Aufforderung, sämtliche Geräteschutzmechanismen auszuschalten. |
| `INTERNET`; optionale Supabase-/KI-/Routen-/Wetter-/Karten-Funktionen | Lokaler Kern mit getrennt aktivierbaren externen Diensten. | Data safety und Datenschutz müssen alle im veröffentlichten Build erreichbaren Datenflüsse abbilden, auch optionale. „Offline nutzbar“ bedeutet nicht automatisch „keine Datenerhebung/-weitergabe“. Anbieter, Zweck, Datenarten, Löschung, Übertragung und Vertragsstand konkret prüfen. |

Der Quellstand entfernt zahlreiche nicht benötigte Health-Schreib-/Leserechte sowie Werbe-ID-/AdServices-Rechte und enthält keine eigene Kamera-Anforderung. Daraus folgt keine automatische Play-Freigabe. Maßgeblich sind das **zusammengeführte Manifest des fertigen Release-Artefakts** und das tatsächliche Verhalten einschließlich Bibliotheken.

Für den Datenschutzabgleich sind insbesondere diese vorhandenen Grenzen wichtig:

- Termine, Orte, Arbeitsaufgaben und Medikamentenprotokoll sind laut vorhandener Dokumentation lokal; Android verwendet SQLite, Web IndexedDB. Das ist am vertriebenen Build und seinen aktivierten Diensten zu bestätigen.
- Eine freiwillige KI-Anfrage kann ausgewählte Aufgabeninhalte an den konfigurierten Supabase-Dienst und OpenAI senden. Eine Routenanfrage kann gewählte Start-/Zielangaben, Modus und Zeit über Supabase an Google Routes senden. Abbruch holt bereits gesendete Daten nicht zurück. Keine solchen Provider werden durch dieses Dokument aktiviert.
- Wetter, Öffnen einer Karten-App, Routen, KI, Standort und optionale Synchronisation benötigen einen verständlichen Abgleich ihrer jeweils tatsächlichen Empfänger. Ein Login kann auch bei ausgeschalteter Datensynchronisation Daten beim Authentifizierungsanbieter erzeugen.
- Ein manueller JSON-Export ist unverschlüsselt und kann bewusst ausgewählte sensible Gruppen enthalten. `allowBackup=false` ist keine Aussage, dass dieser bewusste Export verschlüsselt wäre.
- Die Store-Beschreibung sollte Unterstützung im Alltag beschreiben. Sie darf aus den optionalen Gesundheitsfunktionen keine Diagnose, Behandlung, garantierte Weckwirkung oder wissenschaftlich validierte Schlafmessung ableiten.

Die Datenschutzseite muss vor der Verteilung öffentlich erreichbar und im Build/Store korrekt verlinkt sein. Eine lokale Markdown-Datei allein erfüllt diese Nutzerschnittstelle nicht. Für ein Kontoangebot sind die aktuell geltenden Anforderungen an Kontolöschung, zugehörige Datenlöschung, Aufbewahrungsgründe und einen gegebenenfalls erforderlichen externen Löschweg gesondert zu prüfen. Dies sind noch offene Veröffentlichungsnachweise, keine schon eingerichteten Dienste.

## Offizielle Quellen und noch ausstehende Bestätigung

Alle folgenden Links führen zu Primärquellen von Google/Android. Die Play-/Android-Webseiten waren hier netzseitig nicht abrufbar. Deshalb muss beim tatsächlichen Einrichtungstermin jede relevante Seite erneut gelesen werden; die Tabelle bestätigt weder Erreichbarkeit des konkreten Artikels noch unveränderte Grenzwerte.

| Thema | Offizielle Prüfstelle | Hier belegter Stand |
| --- | --- | --- |
| Registrierung, Gebühr und Kontowahl | [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en) | Abruf versucht, Proxy verweigert (403); 25 USD nur offener Planungswert. |
| Tests vor Produktionszugang bei neuen persönlichen Konten | [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) | Nicht abrufbar; Datum/12 Tester/14 Tage und konkrete Kontoregeln vor Einrichtung bestätigen. |
| Aktuelle Konto- und Identitätsverifikation | [Play Console Help](https://support.google.com/googleplay/android-developer/?hl=en) und tatsächlicher Konto-Einrichtungsablauf | Nicht abrufbar; kontotyp- und länderspezifische Anforderungen offen. |
| Android-App-Signierung und Schlüsselrollen | [Sign your app](https://developer.android.com/studio/publish/app-signing) | Abruf versucht, Proxy verweigert (403); konkrete Play-Migrationsentscheidung offen. |
| Play App Signing | [Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en) | Nicht abrufbar; App-Signierschlüssel, Uploadschlüssel und Debug-Zertifikatsgrenze vor Upload prüfen. |
| Android-Versionierung | [Version your app](https://developer.android.com/studio/publish/versioning) | Nicht abrufbar; konkrete APK-/Gerätemetadaten separat prüfen. |
| Ziel-API-Fristen | [Meet Google Play's target API level requirement](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) | Nicht abrufbar; vorhandene Ziel-API 36 ist eine Repository-Angabe. |
| Native 16-KB-Seitengrößen | [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes) | Nicht abrufbar; ein konkreter Release-Nachweis muss zum finalen AAB/APK gehören. |
| Health Connect veröffentlichen | [Publish your app](https://developer.android.com/health-and-fitness/guides/health-connect/publish) | Nicht abrufbar; Freigaben und Erklärungen offen. |
| Health-Connect-Berechtigungen und Entwicklung | [Get started with Health Connect](https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started) | Nicht abrufbar; gelesene Codeanforderung ist `workouts`/`steps`, tatsächliche Steps-Verwendung offen. |
| Android-14-FGS-/Vollbildanforderungen in Play | [Understanding foreground service and full-screen intent requirements](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en) | Nicht abrufbar; aktuelle Deklarationen und Eignung offen. |
| Hintergrundstandort | [Understanding location in the background permissions](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en) | Nicht abrufbar; tatsächliche Kernfunktions-/Erklärungsprüfung offen. |
| Data safety | [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) | Nicht abrufbar; keine ausgefüllte oder eingereichte Erklärung. |
| Nutzerdaten und Datenschutz | [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) | Nicht abrufbar; Datenschutz-/Löschpflichten anhand des konkreten Angebots prüfen. |

Die Codesichtung für dieses Dokument umfasste `android/app/src/main/AndroidManifest.xml`, `android/variables.gradle`, `capacitor.config.ts`, `src/platform/health.ts`, `docs/OPTIONALE_DIENSTE.md` und die vorhandenen Datenschutzangaben in `README.md`. Das historische Systemleisten-Paket wurde nur über seine vorhandene `update-info.json` eingeordnet; das Handy wurde nicht untersucht.

## Bereit und noch offen

Vorbereitet sind ein überprüfbarer Weg für manuell gestartete APK-Builds und diese Entscheidungsfolge. Noch offen sind die einmalige lokale Secret-Einrichtung für signierte Actions-Builds, die tatsächliche Geräte-/Installationsdiagnose, alle aktuellen Play-Web-/Console-Bestätigungen, die Signierungsübergangsentscheidung, Play-spezifische Release-/Gerätetests, Erklärungen, Tests mit realen Teilnehmern und jede Veröffentlichung. Ohne diese Belege wird weder eine sichere Store-Migration noch eine Store-Zulassung versprochen.
