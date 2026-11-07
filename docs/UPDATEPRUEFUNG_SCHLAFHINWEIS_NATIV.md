# Einmaliger stummer Schlafhinweis – nativer Teil

Stand 07.11.2026, Basis `bf90602`. Dieser Auftrag ist eine ausdrücklich gewünschte Erweiterung der vorherigen reinen Jetzt-Einstiegsprüfung. Der native Teil verwendet die eigene Special-Access-Freigabe **„Über anderen Apps anzeigen“** (`SYSTEM_ALERT_WINDOW`). Er ist standardmäßig inaktiv und startet ausschließlich nach bewusstem Aufruf. Die UI verwendet dafür den vorhandenen Wert `settings.sleep.fallAsleepMin` („Einschlafzeit“), kein neues Schlaf- oder Aufgabenmodell.

## Verhalten und Grenzen

- Eine manuell gestartete Sitzung hat eine zufällige Kennung, eine monotone Fälligkeit und eine Bootkennung. Eigene Credential-Prefs speichern nur Kennung, Zeitpunkte, Genauigkeit, Phase und technischen Grund. Keine Aufgaben-, Arbeits-, Gesundheits- oder Schlafeinträge.
- Ein eigener **`ELAPSED_REALTIME`-Termin ohne WAKEUP** genügt; kein Foreground Service, WakeLock, Ton, Vibration, AlarmClock, Full-Screen-Intent oder Audioattribut. Der Hauptwecker wird weder umgestellt noch gestartet oder beendet.
- `setExact` wird nur mit bereits vorhandenem Recht verwendet. Fehlt es oder wird es zwischen Prüfung und Planung entzogen, wird ein normaler ungenauer Termin verwendet und `exact:false` gemeldet. Es wird dafür kein zusätzliches Recht angefordert. Die UI erklärt mögliche Verzögerung.
- Ein vorher ausgeschalteter Bildschirm beendet `waiting` nicht. Auch ein kalter Receiver kann die gespeicherte Sitzung prüfen. Bei Zustellung sind **interaktiver Bildschirm, vollständig verschwundener Keyguard, erlaubtes Overlay und kein echter Alarm** erforderlich. Andernfalls endet die Sitzung als `skipped`, ohne beim späteren Entsperren nachgeholt zu werden.
- Non-WAKEUP-Termine können vom System beim nächsten Aufwachen nachgeliefert werden. Zustellungen später als **15 Sekunden** nach dem vorgesehenen monotonen Zeitpunkt verfallen. Das begrenzt Nachlieferungen; es ist kein lückenloser historischer Nachweis des tatsächlichen Displayzustands auf einer Samsung-Firmware und kein Pünktlichkeitsversprechen.
- Sichtbar wird höchstens 60 Sekunden lang eine echte, kleine `TYPE_APPLICATION_OVERLAY`-Karte mit „Anker · Schlafhinweis“, ruhigem Text, **„Jetzt öffnen“** und **„Schließen“**. Sie ist touchbar und nicht fokussierend; kein unsichtbares vollflächiges Fenster leitet Berührungen durch.
- Erst nach tatsächlichem View-Attach wird einmal über die legitime SAW-Ausnahme der bestehende Link `de.frnkrm.anker://now` versucht. Ein ohne Exception zurückkehrender `startActivity()`-Aufruf bestätigt keinen Erfolg: Android kann den Start still blockieren. Die Karte und ihr ausdrücklicher Öffnenknopf bleiben dann erhalten. Erst tatsächliches MainActivity-Resume, Bestätigung, Schließen oder Abbruch entfernt die Karte.
- ScreenOff, erneute Sperre, entzogene Overlayfreigabe und echter Alarm beenden eine **sichtbare** Karte. Nur während ihrer maximal 60 Sekunden läuft ein begrenzter 500-ms-Sichtbarkeitswächter; kein Hintergrund-Polling während der Einschlafzeit. Ein direkter Alarmbeginn-Hook räumt die Karte zusätzlich auf.
- Neustart, Paketupdate, abgelaufene Zeit und alte Kennungen können keine neue Sitzung erzeugen. Der Receiver ist nicht exportiert und nicht Direct-Boot-fähig. Beim gesperrten Boot wird kein Credential-Speicherzugriff erzwungen. Android-Force-stop kann Termine verhindern; beim erneuten Appstart wird nichts automatisch neu armiert.

## API am vorhandenen `AnkerNative`-Plugin

| Methode | Vertrag |
|---|---|
| `getBedtimePromptState()` | Aktuellen nativen Zustand lesen und ungültige/abgelaufene Sitzung bereinigen. Kein Start. |
| `startBedtimePrompt({ delayMinutes })` | Bewusster neuer Start, ganze Minuten 0–60. 0 bedeutet bewusst sofort. Freigabe, entsperrter interaktiver Zustand und fehlender echter Alarm werden vor Start geprüft. |
| `stopBedtimePrompt({ sessionId? })` | Ausdrückliches Beenden; mit Kennung wird eine inzwischen neuere Sitzung geschützt. |
| `ackBedtimePrompt({ sessionId })` | Nur die aktuelle `shown`-Sitzung bestätigen. Alte oder bereits bestätigte Kennungen bleiben wirkungslos. |
| `openOverlayPermissionSettings()` | Nur den ausdrücklich gewählten Systemeinstieg öffnen; erteilt selbst keine Freigabe und startet keine Sitzung. |

State: `phase: idle | waiting | shown | skipped | error`, `sessionId?`, `dueAt?` (UTC-ms zur Anzeige), `overlayPermission`, `exact`, `reason?`. Das optionale Ereignis **`bedtimePromptChanged`** meldet denselben Zustand. Gründe umfassen `screen-off`, `locked`, `permission-revoked`, `expired`, `restart`, `updated`, `alarm-active`, `schedule-failed`, `overlay-failed`, `storage-failed`, `stopped` und `acknowledged`.

Startfehler vor einer neuen Sitzungsanlage werden als abgelehnter PluginCall gemeldet; die UI darf daraus keinen erfolgreichen Start ableiten. UI-Ack darf erst bei tatsächlich aktivem Anker, sichtbarem Dokument und angezeigter Jetzt-Information erfolgen, sonst würde ein Hintergrundereignis die externe Karte zu früh entfernen. Der getrennte UI-Agent setzt diesen Vertrag um. `Native.ts`, Web-Store, UI und Gradle-Versionen wurden in diesem nativen Branch nicht geändert.

## Quellen und unabhängiger Review

Offizieller AOSP-Mirror, Android-16-Stand `99b01a65cc4c104933788b3143285ab6bae65827`:

- [BAL-SAW-Ausnahme](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/services/core/java/com/android/server/wm/BackgroundActivityStartController.java#L1114) und [AppOp-/Berechtigungsprüfung](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/services/core/java/com/android/server/wm/ActivityTaskManagerService.java#L1096). Die gesonderte Anforderung eines sichtbaren Overlays bei bestimmten FGS-Starts ab target 35 wird nicht mit dieser Activity-Regel verwechselt.
- [TYPE_APPLICATION_OVERLAY und Einschränkungen nicht vertrauenswürdiger Touchfenster](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/java/android/view/WindowManager.java#L2806).
- [Stiller BAL-Abbruch](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/services/core/java/com/android/server/wm/ActivityStarter.java#L2245) und [Umsetzung von START_ABORTED auf START_SUCCESS nach außen](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/services/core/java/com/android/server/wm/ActivityStarter.java#L1558).

Quellenauszüge, zusätzliche Zeitplanungs-/Keyguardbelege und 16 geprüfte Datei-Hashes: `/workspace/.cache/anker/updatepruefung/bedtime-prompt/overlay-source-notes.md` und `source-fetch-manifest.json`. Ein unabhängiger lesender Review fand einen zunächst ungeschützten Commitfehlerpfad in nativen Klick-/Handler-Callbacks. Die ergänzte Fehlergrenze entfernt Karte und Termine auch bei Speicherfehlern und lässt keine Exception in den gemeinsamen Weckerprozess entkommen; Gegenreview ohne weitere konkrete Befunde.

## Automatische Nachweise und offener Geräteanteil

Eigene isolierte Androidkopie unter `/workspace/.cache/anker/updatepruefung/bedtime-prompt/android-check/`, JDK 21.0.8, SDK 36, vorhandener Gradle-Cache. Die Init-Datei lenkt sämtliche Plugin-Ausgaben aus dem gemeinsamen `node_modules` in diese Kopie. Das generierte Cordova-Modul wurde aus der vorhandenen Buildumgebung ergänzt. Weil kein `cap sync` durchgeführt wird, wurden die ohnehin in `capacitor.config.ts` ausgeschalteten Facebook-/Apple-/Twitter-Provider als entsprechende Gradle-Properties übergeben; es wurden keine zusätzlichen Provider eingebaut.

**Bestanden:** echte Debug-Kotlin-Kompilierung und **16/16 reine JUnit-Modellfälle**, null Fehler oder Skips, auf sechs bytegleich geprüften nativen Eingabedateien. Abschließender Lauf 27 Sekunden; App-Kotlin, Testkompilierung und Testtask tatsächlich ausgeführt. Fälle: inaktiver Default, manuelle Dauer einschließlich 0, ungültige/überlaufende Werte, monotone Fälligkeit, alte Kennung, einmaliger Verbrauch, verspätete Zustellung, ausgeschalteter/gesperrter Bildschirm bei Zustellung, erlaubter Kaltstart, vorheriger ScreenOff ohne Abbruch, entzogene Freigabe, echter Alarm, Boot/Uhrrücksprung, Anzeigeablauf, Stop/Ack und neue Sitzung. Die rohe Manifest-Differenz enthält genau **eine neue Permission: `SYSTEM_ALERT_WINDOW`**.

Logs und kopierte JUnit-XMLs liegen im genannten Cache. Die ersten beiden reinen Buildkopie-Versuche fehlten am generierten Cordova-Modul beziehungsweise den deaktivierten Provider-Properties; diese Einrichtungsfehler sind separat erhalten und nicht als Produktfehler ausgegeben. Keine APK erstellt, kein bestehendes RC-Paket überschrieben. Der gemeinsame vollständige Androidlauf folgt nach Root-Integration.

**Nicht am Galaxy verifiziert:** Zeitpunkt unter Samsung-Energiesparen, Overlaydarstellung und eventuelles Verbergen durch Spiele/Sicherheitsfenster, erlaubter automatischer Activity-Start, still blockierter Start mit funktionierendem Öffnenknopf, reale Screen-/Keyguard-Rennen und Force-stop. Android-/One-UI-Version sind weiterhin offen. Gerätefälle müssen insbesondere Bildschirm aus/gesperrt bei Fälligkeit, frühes Aus-/Einschalten während `waiting`, Hintergrund/Kaltstart, Schließen/Stop/Ack, Rechteentzug, Neustart/Update und einen gleichzeitig echten Wecker abdecken. Weder ein Build noch ein Modelltest bestätigt diese reale Herstellerwirkung.
