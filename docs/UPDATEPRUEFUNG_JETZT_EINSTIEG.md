# Anker beim Einschalten des Handys – Machbarkeitsprüfung

Stand: 07.11.2026. Geprüfter Repository-Ausgangspunkt: `424e041309e82ec82804f0e951fa817bcd0ada70`, App 1.3.0-rc.2 / Code 9, Capacitor 8.6.0, minSdk 26 und compileSdk/targetSdk 36. Diese Prüfung ändert ausschließlich Dokumentation.

**Mit den normalen Apprechten lässt sich nicht zuverlässig zusichern, dass bei jedem Einschalten des Displays zuerst Anker → Jetzt vor der bisherigen App erscheint.** Ein Display kann außerdem aufleuchten, während das Handy noch gesperrt bleibt. Android schützt diese Grenze und entscheidet über Starts aus dem Hintergrund. Das vorhandene Homescreen-Widget bietet bereits die nächste Aktion und einen bewussten direkten Einstieg nach Jetzt. Eine konkrete Samsung-Routine „jedes Entsperren → Anker öffnen“ ist hier nicht belegt.

## Was Android tatsächlich meldet

Die folgenden Aussagen wurden an offiziellen AOSP-Quelldateien des Android-16-Releasezweigs geprüft, festgehalten auf `99b01a65cc4c104933788b3143285ab6bae65827`, und mit dem abrufbaren `main`/`master` auf `1cdfff555f4a21f71ccc978290e2e212e2f8b168` ergänzt. Ein Branch `android17-release` wurde in diesem Mirror nicht gefunden; `main` wird deshalb nicht als Android 17 bezeichnet. Diese Quellen belegen Plattformverhalten; sie sind kein Laufzeittest der Samsung-Firmware.

| Ereignis / Fähigkeit | Belegter Umfang | Konsequenz für den Wunsch |
|---|---|---|
| `ACTION_SCREEN_ON` | Das Gerät wird **interaktiv**. Laut API-Kommentar kann dies vom physischen Displayzustand abweichen; nur dynamisch registrierte Receiver, keine Manifest-Receiver. | Kein allgemeiner AOD-/Display-Trigger, der eine beendete App bei jedem Aufleuchten zuverlässig startet. |
| Zustellung von Screen-On/Off | `Notifier` erlaubt das Zusammenfassen auf das jeweils neueste Ereignis und eine Verzögerung an gecachte Apps bis zu deren Aktivierung. | Keine lückenlose Ereignisfolge für „wirklich jedes Einschalten“. |
| `ACTION_USER_PRESENT` | Nutzerpräsenz nach dem Aufwachen, beispielsweise wenn der Keyguard weg ist. | Ein anderes Ereignis als Display an; der Empfang allein erteilt keine allgemeine Erlaubnis zum Öffnen einer Activity. |
| `ACTION_USER_UNLOCKED` | Der verschlüsselte Nutzerspeicher ist verfügbar. | Typischerweise für die erste Credential-Entsperrung nach Benutzerstart relevant; kein Ersatz für jedes spätere Displayeinschalten oder Entsperren. |
| Activity-Start aus dem Hintergrund | `BackgroundActivityStartController` prüft Sichtbarkeit, Aufrufer und konkrete Ausnahmen; ohne passende Freigabe wird der Start blockiert. Auch PendingIntents unterliegen diesen Prüfungen. | Ein Receiver plus `startActivity()` oder ein selbst gesendeter PendingIntent ist keine verlässliche Umsetzung des Wunsches. |
| Broadcast oder Foreground Service | `BroadcastOptions` erlaubt Hintergrund-Activity-Starts standardmäßig **nicht**. Die Prozessprüfung unterscheidet Privilegien zum Starten eines Foreground Service von Privilegien für Activity-Starts; ein bloß laufender Dienst ist keine allgemeine Ausnahme. | Empfangsbereitschaft oder ein dauerhafter Dienst lösen die geschützte Vordergrundübernahme nicht. |
| `START_ACTIVITIES_FROM_BACKGROUND` | Geschützte System-/Rollenberechtigung, keine gewöhnliche vom App-Nutzer erteilbare Laufzeitberechtigung. | Kein zusätzlicher Einrichtungs-Schalter, den Anker für diesen Zweck einfach anbieten könnte. |
| `showWhenLocked` / `turnScreenOn` | Regeln die Darstellung beziehungsweise das Aufwecken einer Activity, wenn sie sichtbar und fortgesetzt wird. | Diese Flags ersetzen weder eine Erlaubnis zum Hintergrundstart noch die normale Gerätesperre. |

Eine Akku-Ausnahme ist kein Nachweis einer erlaubten oder zuverlässigen Vordergrundübernahme. Auch aus einem auf einzelnen Versuchen erfolgreichen Start ließe sich keine Garantie für jeden späteren Einschaltvorgang ableiten.

## Bereits in Anker vorhanden

| Bestehender Weg | Tatsächliches Verhalten | Einrichtung / Grenze |
|---|---|---|
| Homescreen-Widget | Die Hauptfläche sendet einen Activity-PendingIntent mit `de.frnkrm.anker://now`. `nativeDestination()` bildet ihn auf `/` ab, dort liegt Jetzt. | Widget bewusst auf dem Homescreen hinzufügen. Eine Berührung der Hauptfläche öffnet Jetzt; die beiden kleinen Flächen öffnen Gedanken beziehungsweise Wiedereinstieg. |
| Widget-Anzeige | Verwendet dieselbe Handlungsauswahl wie Jetzt, mit datensparsamer Projektion und begrenzter Gültigkeit. Bei abgelaufenem Stand erscheint „Anker öffnen“ / „Stand aktualisieren“. | Kein ständig laufendes WebView und kein Screen-On-Start. Die Widgetaktualisierung kann systembedingt verzögert werden. |
| App-Schnellzugriffe | Statisch vorhanden: „Gedanke festhalten“, „Wieder einsteigen“, „Fokus starten“. | Ein eigenständiger statischer „Jetzt“-Shortcut fehlt. Für diesen Wunsch nicht automatisch den Fokus-Shortcut aufrufen: Er kann einen Fokus bewusst starten. |
| App-Symbol | Startet die normale MainActivity. | Eine bereits vorhandene Appinstanz kann auf ihrer bisherigen Seite weiterlaufen; das Symbol allein erzwingt nicht bei jedem Öffnen Jetzt. Der Widget-Link benennt Jetzt ausdrücklich. |
| Native Link-Navigation | Neue bekannte Links werden angenommen; der alte Android-Startlink wird nicht bei jedem Seitenwechsel erneut gelesen. Ein tatsächlich klingelnder Wecker hat Vorrang. | Die reparierte freie Navigation bleibt erhalten. Kein Wiederaufgreifen eines alten Links in einer Render-/Resume-Schleife. |

Die relevante Widgetdefinition lautet ausdrücklich `android:widgetCategory="home_screen"`. Eine Sperrbildschirm-Widgetunterstützung wird damit nicht behauptet. Der vorhandene `USER_UNLOCKED`-Eintrag gehört zur Geofence-Wiederherstellung; er ist kein implementierter Jetzt-Autostart und kein Beleg für eine Zustellung bei jeder Entsperrung.

## Praktisch mögliche Einrichtung ohne Appänderung

1. Auf dem Homescreen eine freie Stelle lange drücken, **Widgets → Anker** wählen und die Hauptfläche gut erreichbar auf die erste Seite legen. Dieser Weg ist bereits in der Anker-README beschrieben; genaue Launcher-Bezeichnungen können abweichen.
2. Nach dem normalen Entsperren bei Bedarf zur Home-Seite wechseln und die große Anker-Fläche berühren. Das ist ein ausdrücklicher Einstieg nach Jetzt, ohne die Aufgabenliste durchsuchen zu müssen.
3. Soll Anker nach dem nächsten Entsperren wieder sichtbar sein, kann man Jetzt vor dem Sperren geöffnet lassen. Das kann den Einstieg vereinfachen, ist jedoch keine geräteübergreifend garantierte Einstellung; eine zwischenzeitlich benutzte andere App bleibt davon unberührt.

Damit wird die Einstiegshürde reduziert. Der zusätzliche bewusste Tap und gegebenenfalls der Wechsel zum Homescreen bleiben erforderlich; das zugesagte Verhalten lautet nicht „bei jedem Einschalten automatisch im Vordergrund“.

## Samsung Modi und Routinen

Für dieses Galaxy wurden weder die genaue **Android-Version** noch **One-UI-, One-UI-Home- und Modi-und-Routinen-Version** ausgelesen. Bekannt ist lediglich das vom Nutzer genannte Galaxy S26 Ultra. Ein offizieller Samsung-Supportabruf wurde am Prüftag vom Netzwerkproxy mit `CONNECT 403` abgewiesen. Das beweist keine fehlende Gerätefunktion.

Deshalb ist hier weder eine konkrete Bedingung „Entsperren/Bildschirm an“ noch eine passende Aktion mit festem Jetzt-Ziel bestätigt. Eine herstellereigene Automation wäre separat am Gerät zu prüfen: Welche Bedingung existiert tatsächlich, startet sie erst nach erfolgreichem Entsperren, und kann sie den expliziten Jetzt-Link öffnen statt nur Ankers zuletzt verwendete Seite? Eine ungetestete Schrittfolge wird dafür nicht vorgegeben. Zusätzliche Samsung-Module oder Drittanbieter-Automationen werden nicht als vorhanden vorausgesetzt.

## Datenschutz, Navigation und echte Wecker

Die vollständige Jetzt-Seite kann persönliche Aufgaben und Tagesinformationen zeigen. Sie wird für diesen Wunsch nicht über die Gerätesperre gelegt und die Sperre wird nicht entfernt. Im vorhandenen Widget werden Aufgaben-/Arbeits- und Kalendertitel maskiert; eigene Routinentitel können weiterhin sichtbar sein. Platzierung und Sichtbarkeit bewusst wählen.

Der echte Alarmweg bleibt getrennt. `Notification.Builder.setFullScreenIntent()` ist laut AOSP für äußerst dringende Aufmerksamkeit wie einen tatsächlich gesetzten Wecker oder einen eingehenden Anruf gedacht; das System kann stattdessen eine Heads-up-Benachrichtigung anzeigen. Weder der bestehende noch ein späterer eigener nativer Alarmbildschirm wird als allgemeiner Einschaltbildschirm verwendet. Keine falschen Klingelzustände, Testalarme, exakten Alarme oder Alarm-Audioattribute erzeugen, um Jetzt nach vorne zu holen.

Es werden keine Overlay-, Accessibility-, Launcher-, Device-Owner- oder Kioskwege implementiert und keine Berechtigungen erweitert. Eine mögliche kleine spätere Erweiterung wäre ein **bewusst antippbarer Jetzt-Schnellzugriff** auf den bereits vorhandenen Deep Link. Er würde den Wunsch nach einem verlässlichen Autostart bei jedem Displayereignis weiterhin nicht erfüllen. Eine optionale Startseitenwahl beim normalen Appöffnen müsste unabhängig geprüft werden und dürfte weder laufende Eingaben/Fokus noch die reparierte Navigation oder einen echten Alarm verdrängen.

## Kleiner tatsächlicher Gerätecheck

Keine neue Softwareprüfung wird aus dieser Dokumentation abgeleitet. Ein späterer kurzer Geräteversuch sollte Modell, Android-/One-UI-/Launcher-Version, Anker-Version und Beobachtung festhalten:

- Widget-Hauptfläche aus einer anderen App und aus einer bereits offenen Anker-Unterseite antippen: Jetzt erscheint; anschließend frei zu Mehr/Tag navigieren, ohne Rücksprungschleife.
- Separat betrachten: Display an bei weiterhin gesperrtem Gerät, normales Entsperren, AOD/Benachrichtigungs-Aufleuchten, Neustart mit erster Entsperrung. Die normale Sperre bleibt bestehen; diese Ereignisse gelten nicht als automatische Jetzt-Starts.
- Nach altem/offlinem Widgetstand bleibt das Öffnen möglich und ein abgelaufener Stand wird ehrlich angezeigt. Ein echter Wecker behält seine vorhandene Priorität.
- Nur falls eine konkrete Samsung-Option tatsächlich gefunden und freiwillig eingerichtet wird: ihre Bedingung und Aktion exakt protokollieren, einen Ausschaltweg prüfen und keine allgemeine Zuverlässigkeit aus einem Einzelversuch ableiten.

Hier wurden Quellen und vorhandener Code gelesen. Kein Handy wurde eingerichtet, kein Gerätecheck durchgeführt und kein früheres Ergebnis als neuer Erfolg übernommen. Für reine Dokumentation genügen Diff-/Linkkontrolle; App-, APK- und Hörbarkeitsprüfungen gehören zu ihren eigenen Änderungen.

## Primärquellen und Repositorybelege

- AOSP `Intent.java`: [SCREEN_ON / USER_PRESENT](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/java/android/content/Intent.java#L2540), [USER_UNLOCKED](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/java/android/content/Intent.java#L4196).
- AOSP `Notifier.java`: [Bündelung und verzögerbare Zustellung von Screen-On/Off](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/services/core/java/com/android/server/power/Notifier.java#L275).
- AOSP [BackgroundActivityStartController](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/services/core/java/com/android/server/wm/BackgroundActivityStartController.java#L845), [geschützte Hintergrundstart-Berechtigung](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/res/AndroidManifest.xml#L4352).
- Ergänzend im abgerufenen AOSP-`main`: [gleiche Screen-On/Off-Zustelloptionen](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/services/core/java/com/android/server/power/Notifier.java#L265), [USER_UNLOCKED beim Benutzerzustandswechsel](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/services/core/java/com/android/server/am/UserController.java#L801), [BroadcastOptions: Startfreigabe standardmäßig false](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/core/java/android/app/BroadcastOptions.java#L561), [tatsächliche Berechtigungsprüfung](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/services/core/java/com/android/server/am/BroadcastController.java#L995), [BAL-Ausnahmen](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/services/core/java/com/android/server/wm/BackgroundActivityStartController.java#L1004), [getrennte Prozessprivilegien für FGS und Activity](https://github.com/aosp-mirror/platform_frameworks_base/blob/1cdfff555f4a21f71ccc978290e2e212e2f8b168/services/core/java/com/android/server/wm/BackgroundLaunchProcessController.java#L109).
- AOSP `Activity.java`: [showWhenLocked](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/java/android/app/Activity.java#L9748), [turnScreenOn](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/java/android/app/Activity.java#L9786).
- AOSP `Notification.java`: [Zweck und Grenzen von Full-Screen-Intents](https://github.com/aosp-mirror/platform_frameworks_base/blob/99b01a65cc4c104933788b3143285ab6bae65827/core/java/android/app/Notification.java#L5207).
- Anker: [Widget-PendingIntents](../android/app/src/main/java/de/frnkrm/anker/AnkerWidget.kt), [Widgetkategorie](../android/app/src/main/res/xml/anker_widget_info.xml), [bestehende Shortcuts](../android/app/src/main/res/xml/anker_shortcuts.xml), [Linkziele](../src/platform/links.ts), [einmalige Startlinkbehandlung](../src/App.tsx), [Widgetprojektion](../src/core/now.ts), [Widgetgültigkeit](../android/app/src/main/java/de/frnkrm/anker/WidgetModel.kt), [Geräteversionsstand](GERAETETEST.md).

Die AOSP-Rohquellen und deren Herkunft liegen lokal unter `/workspace/.cache/anker/updatepruefung/jetzt-einstieg-aosp/`; der gesperrte Samsung-Abruf unter `/workspace/.cache/anker/updatepruefung/jetzt-einstieg/`. Die Android-Webdokumentation und konkrete Samsung-Menüwege bleiben von der verifizierten AOSP-/Codeprüfung getrennt.
