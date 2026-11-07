# Updateprüfung: Produktmeldungen und begrenzte Machbarkeit

Stand: **07.11.2026**. Codevergleich gegen `424e041309e82ec82804f0e951fa817bcd0ada70`. Diese Dokumentation enthält keine OCR- oder Rauschfunktion und keine Aktivierung von Netz-, Kamera- oder Mikrofonzugriffen.

## Konkurrenzmeldungen erneut angefragt

Die offiziellen Produktseiten wurden am 07.11.2026 um etwa 13:20 UTC tatsächlich abgerufen. Alle drei Anfragen scheiterten mit `CONNECT 403 Forbidden`. Inhalte, Veröffentlichungsdaten und Verfügbarkeit auf einzelnen Plattformen wurden deshalb **nicht aktuell verifiziert**. Die Angaben in der nächsten Tabelle sind Ausgangsangaben, keine bestätigte Marktübersicht. Fehlender Zugriff beweist weder eine Funktion noch deren Abwesenheit.

| Offizielle Zielquelle / Ausgangsangabe | Verifizierter Anker-Bestand der Baseline | Konsequenz |
|---|---|---|
| [Tiimo: Timer auf Unteraufgaben](https://www.tiimoapp.com/resource-hub/timers-on-subtasks), laut Ausgangsbericht 21.09.2026, Web/Android/iOS | Routine-Schritttimer und persistenter Aufgabenfokus vorhanden. `FocusTarget` besitzt in der Baseline bei Aufgaben nur `kind`/`id`; `TaskFocus.tsx` zeigt Unteraufgaben ohne eigenen Timerbezug. | Funktionale Lücke am Anker-Code belegbar, unabhängig vom ungeprüften Konkurrenzdatum. Der separate Teilschritttimer-Implementierungszweig dieses Auftrags behandelt sie; sein finaler Status gehört in den Integrationsbericht. |
| [Tiimo: Snap to plans / iOS 27](https://www.tiimoapp.com/resource-hub/tiimo-ios-27), laut Ausgangsbericht 15.09.2026 | Keine Foto-OCR-Importstrecke gefunden; manuelle Gedanken-/Aufgabeneingabe und lokale Sprache bestehen bereits. | Androidlokalen Entwurf evaluieren; keine Übernahme einer Apple-Plattformbibliothek oder Annahme gleicher Android-Verfügbarkeit. |
| [Routinery 3.27.13: Hintergrundrauschen](https://www.routinery.app/updatenote/v-3-27-13), laut Ausgangsbericht 02.05.2025 | Kein bewusst wählbarer Rauschplayer gefunden. Alarmtöne, lokale Sprache und SmartWake-Mikrofon sind andere Funktionen. | Niedrig priorisierter optionaler Kandidat; laut Ausgangsdatum eine ältere Meldung. Keine frische Wochenneuheit oder ADHS-Wirksamkeit behaupten. |

Einzelaufgaben, Tageslinie, Sprache und Widget sind bereits vorhanden. Diese Meldungen rechtfertigen keine parallelen Kalender-/Aufgaben-/Sprachmodelle. Eine aus Produktwerbung abgeleitete „gesundheitsadaptive Planung“ bleibt ungeprüft und ist keine Grundlage für automatische Stimmungs- oder Medikamentenannahmen.

## Androidlokal: Foto zu bearbeitbarem Aufgabenentwurf

**Einschätzung: ein kleiner Prototyp ist technisch plausibel; Handschriftqualität, exakte Bibliotheksanforderungen und Offlineverhalten sind noch nicht nachgewiesen.** Kein OCR-Paket wurde installiert oder in Anker eingebaut.

### Gelesene technische Primärquellen

Die Google-Dokumentationsseiten [Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2/android), [Digital Ink](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android) und die [Android-Picker-Anleitung](https://developer.android.com/training/data-storage/shared/photopicker) waren mit `CONNECT 403` gesperrt. Offizielle Quellbeispiele auf GitHub waren dagegen lesbar:

| Tatsächlich gelesen, HTTP 200 am 07.11.2026 | Daraus belegbare Aussage / Grenze |
|---|---|
| [AndroidX ActivityResultContracts.kt](https://raw.githubusercontent.com/androidx/androidx/androidx-main/activity/activity/src/main/java/androidx/activity/result/contract/ActivityResultContracts.kt) | `PickVisualMedia` liefert eine einzelne URI oder `null`. Implementierung bevorzugt System-Picker, dann OEM-Fallback und schließlich `ACTION_OPEN_DOCUMENT`; Kommentar nennt API 19+. Das ist aktueller Upstream-Code, kein Beleg für die genaue in Anker aufgelöste Activity-Version. |
| [Offizielles ML-Kit-Beispiel: build.gradle](https://raw.githubusercontent.com/googlesamples/mlkit/master/android/vision-quickstart/app/build.gradle) | Beispiel unterscheidet `com.google.mlkit:text-recognition:16.0.1` von der kommentierten Play-Services-Alternative `19.0.1`. Diese Beispielversionen sind keine Aussage zur neuesten Version oder Freigabe für Ankers Abhängigkeitsgraph. |
| [Offizielles ML-Kit-Beispiel: TextRecognitionProcessor.java](https://raw.githubusercontent.com/googlesamples/mlkit/master/android/vision-quickstart/app/src/main/java/com/google/mlkit/vision/demo/java/textdetector/TextRecognitionProcessor.java) | Native `TextRecognizer`-/`InputImage`-Verarbeitung sowie Block-/Zeilen-/Elementausgabe vorhanden. Der Beispielcode nennt On-device-Erkennung, enthält jedoch auch Debugausgabe erkannten Texts: solche Inhaltslogs dürfen nicht in Anker übernommen werden. Keine Qualitätsgarantie für Handschrift. |
| [Offizielles Digital-Ink-README](https://raw.githubusercontent.com/googlesamples/mlkit/master/android/digitalink/README.md) | Beispiel beschreibt Schreiben auf dem Bildschirm und Erkennung dieser Eingabe. Das belegt keine OCR aus fotografierten handschriftlichen Notizen. Zwei vermutete Kotlin-Dateipfade lieferten 404 und werden nicht als gelesene Implementierung ausgegeben. |

Quellstände der drei gelesenen Implementierungsdateien sind über ihre beim Abruf berechneten SHA-256-Werte identifizierbar: ActivityResultContracts `eec7dcc8d97d2daccf1c3d88f0f46ac65d8ef1e3d5aa8f59782cd27b47d42889`; ML-Kit-Gradle `0fdcddbaf49feff6723512fa821aacf0db306a0631650817ed95e9915b28a8b6`; TextRecognitionProcessor `20f8437e86c7c9dfc2a7f98180042fc0bf76cd234f78d18aca6c63f30ecd71df`. Die Links auf beweglichen Branches sind keine versionsgebundenen Kompatibilitätszusagen.

### Kleinstmöglicher Prototyp als separater Auftrag

1. Nutzer wählt **ein vorhandenes Bild** über Android-Picker/Dateiauswahl. Abbruch erzeugt nichts. Keine Kameraintegration im ersten Umfang; Ankers Manifest entfernt derzeit das Kamerarecht. Keine pauschale Galerie- oder Speicherberechtigung vorsehen.
2. Bild lokal über die erhaltene URI öffnen, Format und tatsächlich decodierte Größe begrenzen, Ausrichtung berücksichtigen, Arbeit abbrechbar außerhalb des UI-Threads ausführen. Keine ungeschützten Pfade oder beliebigen URIs aus der WebView entgegennehmen. Temporäre Kopien nur im privaten Cache; nach Abbruch/Verarbeitung entfernen, Bibliotheksobjekte schließen.
3. Für den Offline-Kern die gebündelte Erkennungsvariante evaluieren. Modellverfügbarkeit und tatsächlich ausbleibende Erkennungsrequests durch Netzwerkbeobachtung und Flugmodus **vom ersten Start an** prüfen. „Lokal“ beschreibt hier die Verarbeitung durch Anker, nicht automatisch die Herkunft einer vom Systempicker angebotenen Datei: ein Dateianbieter kann Cloud-Dateien zum Download anbieten. Dafür keine heimliche Garantie „das ganze Gerät nutzt kein Netz“ geben; für den Offlinetest ein vorhandenes lokales Bild nutzen.
4. Allen erkannten Text zuerst in einem veränderbaren lokalen Entwurf zeigen, mit einzeln auswählbaren Zeilen, einfacher Korrektur und klarer Abbruchmöglichkeit. Jede OCR-Zeile ist unsicher; fehlende oder vermeintlich hohe Konfidenz ersetzt keine Prüfung. Keine automatische Datumsinterpretation, Terminplanung, Priorisierung, Erledigung oder Aufgabenerstellung.
5. Erst **„Ausgewählte Aufgaben speichern“** schreibt über vorhandene Store-Aktionen; Doppeltippen und Teilfehler dürfen keine Duplikate erzeugen. Vorher Ziel/Privatheit nennen. Arbeitsaufgaben bleiben ausschließlich in `LocalData`; keine Vermischung mit synchronisierten Gedanken. Ohne Zustimmung gehen weder Bilder noch rohe OCR-Auszüge an Sync, KI, Kalender, Analytics oder Logs. Für ausdrücklich bestätigte Aufgaben müssen bestehende Syncregeln vor dem Speichern klar sein; andernfalls ist die erste Version auf lokale Entwürfe zu begrenzen.
6. Nutzer kann auf manuelle Eingabe wechseln. Kein Cloud-OCR- oder KI-Fallback bei schlechtem Ergebnis, fehlendem Modell oder Fehler. Das Bild wird nicht automatisch Teil von Backup, Export oder Appdatenbank.

Vor Integration: aktuelle ML-Kit-Version, Lizenz, AAR-Metadaten/minSdk, Paketgröße, Modellbereitstellung sowie Capacitor-/Activity-Kompatibilität prüfen. Bestehende SQLite-/IndexedDB-/Storemodelle verwenden; keine Migration nur für diese Idee. Keinen zusätzlichen Drittanbieter-Picker allein wegen eines Konkurrenzfeatures installieren.

### Handschrift und Datenschutz ausdrücklich testen

Handschrift ist eine **offene Qualitätsfrage**, kein ausgeliefertes Versprechen. Für eine Evaluation nur eigens freigegebene oder künstlich erstellte Notizen verwenden: lesbare Druckhandschrift und verbundene Schrift, Umlaute/ß, Zahlen, Abkürzungen, Streichungen, mehrere Spalten, gedrehtes/dunkles/unscharfes Foto. Ergebnis anhand einer manuell erfassten Referenz prüfen: Zeichenfehlerquote, ausgelassene Zeilen, falsche Zeilentrennung und Zeit bis zur korrigierten Auswahl getrennt ausweisen. Ein gut erkanntes Beispiel erlaubt keine allgemeine Handschriftzusage.

Risikofälle für den späteren Prototyp: abgebrochener Picker, entzogene/abgelaufene URI, nicht lesbares oder beschädigtes Bild, sehr großes Bild/OOM, OCR-Abbruch, verspätete Antwort nach Seitenwechsel, Prozessneustart, fehlendes Modell, Flugmodus, doppelte Speicherung und Repositoryfehler. Vor ausdrücklichem Speichern dürfen Datenbank und ausgehende Requests unverändert bleiben. Inhalte dürfen weder Logcat noch Diagnoseexport erreichen. Cache-/URI-Lebensdauer und Android-/One-UI-Version am echten Gerät protokollieren.

## Optionales lokales Hintergrundrauschen

**Entscheidung: separat zurückstellen.** Eine Vordergrundvorschau wäre technisch klein; zuverlässiges Hintergrundverhalten, Audioprioritäten und Interaktion mit dem Mikrofon benötigen eine eigene native Umsetzung und Geräteprüfung. Weder Soundasset noch Player, neuer Dienst oder Berechtigung wurden ergänzt.

Baseline: `AlarmController` besitzt den Weckerzustand; `AlarmService` nutzt `USAGE_ALARM`. `LocalVoiceController` verwirft Sprachaufträge bei laufendem Alarm oder messendem SmartWake, und `AnkerNativePlugin.handleOnPause` beendet Sprache/Diktat. `SmartWakeService` misst freiwillig mit `AudioRecord`. Das sind vorhandene Schutzstellen, keine bereits implementierte Rauschkoordination. Die separate Android-Audioprüfung dieses Gesamtauftrags kann diese Baseline ändern; ihr Ergebnis bleibt maßgeblich für den Wecker.

Für einen späteren Prototyp gilt folgende bewusst festzulegende Priorität:

| Ereignis | Erforderliches Verhalten des Rauschplayers |
|---|---|
| Nutzer startet Vorschau sichtbar | Nur nach bewusstem Start lokal abspielen; jederzeit ein direkt erreichbarer Ausschalter. Kein automatischer Start beim Öffnen einer Aufgabe. |
| Fester/Test-/Schlummer-/Wachheitsalarm beginnt | Sofort stoppen; kein Alarmzustand und keine Alarm-Audioattribute für Rauschen vortäuschen. Nach Alarmende nicht automatisch wieder starten. |
| Bewusst gestartete Sprachausgabe | Rauschen pausieren/stoppen, Sprache verständlich halten; erneute Wiedergabe nur auf Wunsch. |
| SmartWake misst oder Diktat beginnt | Rauschen stoppen bzw. Start ablehnen. Das Mikrofon darf die Appwiedergabe nicht als Aktivität auswerten; Messen und Abspielen sind getrennte Fähigkeiten. Kein Stummschalten des festen Weckers. |
| Audiofokus abgelehnt oder verloren, Anruf, Bluetooth-/Kopfhörerwechsel | Kein unkontrolliertes Weiterlaufen oder automatischer Lautstärkesprung; Status ehrlich aktualisieren, Ressourcen freigeben, Wiedergabe erst bewusst erneut starten. |
| App geht im ersten Prototyp in Hintergrund / Prozess endet | Wiedergabe stoppen. Timer bleiben Zeitstempel; keine WebView-Schleife als Dienstersatz. |

Rauschen gehört semantisch zur Medienwiedergabe (`USAGE_MEDIA`), nicht zu `USAGE_ALARM`. `AlarmService` und dessen Sonderstatus dürfen dafür nicht wiederverwendet werden. Für einen später ausdrücklich gewünschten Hintergrundplayer sind passender `mediaPlayback`-FGS-Lebenszyklus, sichtbare Mediensteuerung, Fokusanforderung, Startberechtigungen und Stop-/Aufräumwege separat zu prüfen. Kein Lautstärke-/Nicht-stören-Eingriff, kein Mixen oder Ducken auf Kosten des Weckers. Nur lokale, selbst erzeugte oder passend lizenzierte Assets; keine Streaming-URLs oder Wirksamkeitszusage für ADHS.

Die offiziellen Seiten zu [Audiofokus](https://developer.android.com/media/optimize/audio-focus) und [Android 17](https://developer.android.com/about/versions/17/behavior-changes-all) waren mit `CONNECT 403` gesperrt. Ihre aktuellen Android-17-Regeln sind hier deshalb **nicht erneut verifiziert**. Keine targetSdk-Anhebung und keine vermeintliche Hintergrundfreigabe aus dieser Machbarkeit ableiten.

Spätere Geräte-Matrix: Rauschen versus jeder Alarmart, Sprache und Mikrofon; Vordergrund/Hintergrund/Sperrbildschirm; Start während Fokusverweigerung; Anruf und Kopfhörertrennung; Rechteentzug, Prozessende, Neustart und Update. Android-/One-UI-Version, Codestand, tatsächliche Hörbarkeit und sichtbarer Stop müssen erfasst werden. Build- und reine Modelltests können diese Hörprüfung nicht ersetzen.

## Reviewstatus

| Vorhanden | Ergänzt | Bewusst zurückgestellt | Nicht verifiziert |
|---|---|---|---|
| Aufgaben-/Routinentimer, manuelle Eingabe, lokale Sprache, Widget, Alarm und Mikrofonmessung | Diese Quellen- und Machbarkeitsprüfung | OCR-Prototyp, Hintergrundrauschen, zusätzliche Therapie-/Kalender-/Sprachseiten | Konkurrenzdaten/-Plattformen, aktuelle Google-Dokumentation, Handschriftqualität, OCR-Offline-/Datenschutzlauf und Audiomatrix am Gerät |

Nur Dokumentation geändert. Geprüft wurden Quellstellen, gelesene HTTP-200-Inhalte, Fehlerstatus und Dokumentdiff; keine OCR-/Audiolaufzeit oder neue Hardwareprüfung durchgeführt. Forschungsüberschneidungen: [UPDATEPRUEFUNG_FORSCHUNG.md](UPDATEPRUEFUNG_FORSCHUNG.md).
