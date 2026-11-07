# Android-Audioaudit, 07.11.2026

Geprüfte Basis: `main` / `424e041309e82ec82804f0e951fa817bcd0ada70`,
**1.3.0-rc.2 / Code 9**, minSdk 26, compile/targetSdk 36. Der ältere
Ausgangswert `5223355` / rc.1 aus dem neuen Auftrag ist keine Rückrollanweisung.
`CLAUDE.md`, Implementierungsplan, Testnachweise und der vollständige
Updateprüfungsauftrag vom 06.11.2026 wurden vor den Änderungen gelesen.

## Ergebnis und Quellenstand

Ein vorhandener Audiofokusfehler ist unabhängig von einer Plattformmigration
belegt und korrigiert: `AlarmService` ignorierte das Ergebnis von
`requestAudioFocus`, hörte keine Fokusänderungen und meldete trotz abgelehnten
Fokus eine erfolgreiche Toninitialisierung. Lokale Sprachausgabe und der kurze
Wecker-Probeton hatten keinen eigenen Fokusvertrag.

Neu abgerufene AOSP-Primärtexte im öffentlichen Spiegel
`aosp-mirror/platform_frameworks_base`, Commit
`1cdfff555f4a21f71ccc978290e2e212e2f8b168`:

- [AudioFocusRequest.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/media/java/android/media/AudioFocusRequest.java#L45):
  „applications should not play anything until granted focus“. Beschreibt
  transienten Fokus für Alarme, gleiche AudioAttributes bei Anfrage und Ausgabe,
  Prüfung der Rückgabewerte sowie Pause bei Verlust. Das Beispiel erlaubt die
  Wiederaufnahme nach transientem Verlust; nach endgültigem Verlust bzw.
  Nutzerstopp wird die automatische Wiederaufnahme aufgehoben.
- [TextToSpeech.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/core/java/android/speech/tts/TextToSpeech.java#L1514):
  `setAudioAttributes` setzt die Attribute der Ausgabe; der Utterance-Listener
  meldet Ende/Fehler/Stopp. Ein erfolgreiches `speak` bestätigt die angenommene
  Anfrage, keine tatsächliche Hörbarkeit.
- [ForegroundServiceTypePolicy.java](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/core/java/android/app/ForegroundServiceTypePolicy.java#L456):
  Mikrofon-FGS verlangt den passenden FGS-Typ und u.a. `RECORD_AUDIO` mit
  Vordergrundbedingung. `systemExempted` prüft die zugehörige FGS-Berechtigung
  und als mögliche Voraussetzung `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`.

Diese Texte belegen den verwendeten API-Vertrag und die vorhandenen FGS-Typen.
**Sie bestätigen allein keine neue Android-17-/API-37-Regel.** Die im Auftrag
genannte [Android-17-Verhaltensseite](https://developer.android.com/about/versions/17/behavior-changes-all)
war zum Auditzeitpunkt durch die Netzrichtlinie nicht freigegeben. Die genaue
API-37-WIU-Regel und die behauptete Kombination aus Exaktalarm-Ausnahme und
`USAGE_ALARM` müssen anhand der aktuellen offiziellen Dokumentation weiter
geprüft werden. Keine Umgehung der Netzrichtlinie, keine targetSdk-Anhebung.

Lokale Belege: `/workspace/.cache/anker/android-audio-sources/`. SHA-256 der
gepinnten Texte: AudioFocusRequest `ad4d1524bd16c53f8578b25b4e773e907de252b16f778ff1ac74f85d8be3a51f`,
TextToSpeech `f0f552896ccd392164b527cb88cab744abe45cdf67c96a4ab6bf36e30f8b4407`,
FGS-Policy `73dfb47ab11fb7047ce34b2f8001f031e5d86a43785901d8d8501f7e1aa68ce4`.

## Geprüfte Pfade und minimale Änderungen

| Pfad | Vorhanden / ergänzt / Grenze |
|---|---|
| `AlarmService` | Startet den FGS vor Audio; auf API 34+ mit `systemExempted`. MediaPlayer, Ersatzton und Vibration verwenden Alarmattribute/-stream. Ergänzt: Ton erst bei `AUDIOFOCUS_REQUEST_GRANTED`; Ablehnung/Verlust setzen `audioOk=false`. Fokusverlust stoppt nur den Ton, nicht Alarmzustand, Vibration, Meldung oder Timeout. Nur transienter Verlust kann bei aktueller, noch laufender Alarmart automatisch fortgesetzt werden. Endgültiger Verlust braucht einen neuen Start. Fehlgeschlagene MediaPlayer-Kandidaten werden freigegeben; das boolesche `ToneGenerator.startTone`-Ergebnis wird berücksichtigt. |
| `AudioPlaybackLease` | Neue kleine reine Lebenszykluslogik. Ein alter Vorwecker-/Preview-/Sprachcallback darf eine neue Sitzung weder starten noch stoppen. Abgelehnter Fokus und endgültiger Verlust erlauben kein spätes GAIN. |
| `LocalVoiceController` | Lokale deutsche Stimme bleibt freiwillig; kein Aufnahme-/Cloud-Fallback. Ergänzt: explizites `USAGE_MEDIA` + `CONTENT_TYPE_SPEECH`, passender transienter Fokus mit Ergebnisprüfung und Freigabe bei Ende/Fehler/Stopp. Jeder Fokusverlust beendet den kurzen Hinweis. Activity-Pause/Destroy und Alarm-/Messstart stoppen Sprache weiterhin. Sprache erhält weder `USAGE_ALARM` noch einen Alarm-FGS. |
| `AlarmTonePreview` / Plugin | Der vorhandene dreisekündige Wecker-Probeton erhält einen eigenen Fokus-/Activity-Lebenszyklus. Kein Start während klingelndem Alarm oder laufender Messung. Späterer Alarm-/Messstart stoppt die Vorschau ebenfalls. Pause, Destroy, Zeitlimit und Fokusverlust räumen Player/Fokus auf; alte Timer/Listener greifen keine neue Sitzung an. Bei Ablehnung liefert das vorhandene Plugin-Ergebnis `{ok:false}`. Als bewusst angeforderter Wecker-Probeton verwendet er Alarmattribute; er erzeugt keinen Alarmzustand und keinen FGS. |
| `AlarmController` | Bleibt einziger Besitzer des Weckerzustands. Alarmstart stoppt Preview/Sprache. Ein FGS-Startfehler setzt zusätzlich `audioOk=false`; der vorhandene sichtbare Ersatzweg bleibt erhalten. Fokusänderungen ändern keinen Haupttermin und bestätigen kein Beenden. |
| `SmartWakeService` | Bleibt bewusst aus der sichtbaren Activity gestarteter Mikrofon-FGS, `START_NOT_STICKY`. Der Fensterreceiver aktiviert nur eine lebende Sitzung. Vor Messstart werden jetzt auch Preview-Töne gestoppt. Keine neue Aufnahme oder Audiofunktion. Bei Mikrofon-/Exaktalarm-/Sensorfehler endet das Extra; der feste Hauptwecker bleibt beim Controller. |
| `Receivers` / Manifest | Gelesen, keine Strategieänderung: getrennte Alarm-Identitäten, Direct Boot für Wecker, kein Mikrofonstart aus Boot-/Fensterreceiver. `SCHEDULE_EXACT_ALARM` nur bis API 32, `USE_EXACT_ALARM` ab unterstützter Plattform; passende `FOREGROUND_SERVICE*`-Rechte und Service-Typen vorhanden. `arm` kennzeichnet den vorhandenen ungenauen Fallback als `exact_denied`; das ist kein Exakt-/Hörbarkeitsnachweis. |

Die Dienstsitzung wird durch Alarmart und gespeicherten Startzeitpunkt
unterschieden; ein neuer Hauptalarm derselben Art erhält dadurch ebenfalls
einen neuen Fokusvertrag und ein neues Zeitlimit. Die Sicherung des
Hauptweckers bleibt in `AlarmModel`: Hauptalarm verdrängt
Vor-/Testalarm, ein verspäteter leichter Stopp beendet keinen Hauptalarm, und
ein Aktivitätshinweis verbraucht den festen Termin erst nach echter Bestätigung.
Audiofokusänderungen sind bewusst keine Zustandsereignisse dieses Modells.

## Ausgeführte Prüfung und offene Nachweise

- Isolierte Kotlin-Kompilierung der reinen Modelle und **50/50 JUnit-Fälle**
  erfolgreich: neue fünf `AudioPlaybackLeaseTest`-Fälle sowie vorhandene
  Alarm-, Sprach- und SmartWake-Modelltests. Prüft abgelehnten Fokus,
  transienten/endgültigen Verlust, alte Vorwecker-Callbacks, Stopp und alte
  Preview-Zeitlimits. Log: `/workspace/.cache/anker/android-audio-tests/junit.log`.
- Alle sieben geänderten Android-Kotlin-Dateien einschließlich Plugin wurden isoliert
  erfolgreich gegen Android-36-Artefakte kompiliert (nur die bestehende
  Vibrator-Deprecation). Log und gelesene Quellen-/Classpathliste:
  `/workspace/.cache/anker/android-audio-tests/android-compile.log` und
  `android-compile-inputs.txt`. Der vollständige integrierte
  Gradle-Kompilier-/JUnit-Lauf wird vom
  Hauptagenten nach Freigabe des gemeinsamen isolierten Native-Prüfbaums
  ausgeführt. Ein reiner Modelltest beweist keine Android-Fokuszustellung.
- `git diff --check` erfolgreich. Keine Gradle-Abhängigkeits-/Versionsdateien,
  keine Migration, Anbieteraktivierung, Veröffentlichung oder Bereitstellung
  geändert.

**Echter Androidtest offen:** neuer Stand auf Android 17/API 37, Bildschirm aus,
App im Hintergrund/Prozessneustart, Direct Boot, Exaktalarm-/Mikrofonrechte und
FGS-Ablehnung, Audiofokus während Anruf/anderer Audioausgabe einschließlich
transientem und endgültigem Verlust, Vorwecker→Hauptwecker, Preview→Alarm und
Preview→Messstart, Bluetooth sowie tatsächliche Hörbarkeit/Vibration testen.
Die bestehenden Geräteberichte werden durch diesen Audit nicht als neu
bestanden markiert. Das Aktivitäts-Weckfenster bleibt experimentell.

Bewusst zurückgestellt: target/compile 37, neue FGS-/Berechtigungsstrategie,
Hintergrundrauschen und andere neue Audiofunktionen. Nicht verifiziert:
vollständige API-37-Spezifik, reale Hersteller-/Gerätelaufzeit und Hörbarkeit.
