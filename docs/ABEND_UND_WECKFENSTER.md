# Abend & morgen und das optionale Weckfenster

## Die vier Abendhilfen

Öffne **Mehr → Abend & morgen** oder **Jetzt → Plan & Optionen → Abend & morgen**.

1. **Ideen für morgen parken:** Gedanken aufschreiben und Datum/Uhrzeit für die Wiedervorlage wählen. Bis dahin liegt die Idee unter „Für später geparkt“. Danach erscheint sie wieder bei den offenen Gedanken. Daraus entsteht keine Aufgabe. Früheres Ansehen, Zeitpunkt ändern und Entfernen sind möglich.
2. **Morgen hier weitermachen:** Freizeitaktivität und einen konkreten nächsten Schritt sichern. Die Notiz bleibt über Tageswechsel und Neustart erhalten. Nur bewusstes Erledigen oder Entfernen beendet sie; Arbeitszeit wird dadurch nicht beendet.
3. **Sanfter Abendübergang:** Unter **Einstellungen → Abend & Schlaf → Sanfter Abendübergang** eine ruhige Tätigkeit und Uhrzeit wählen. Der Schalter ist zunächst aus. Eingeschaltet ersetzt ein einzelner sanfter Hinweis die PC-Stopp- und Bett-Meldungen. Deine geplanten Zeiten und der Morgenwecker bleiben bestehen. Ruhezeiten gelten weiterhin.
4. **Schlafüberblick:** Eigene Müdigkeits-, Bett- und Aufstehzeitpunkte festhalten, nachtragen, korrigieren oder löschen. Die Übersicht zeigt sieben Nächte. Der Abstand zwischen Bett und Aufstehen ist keine gemessene Schlafdauer. Es gibt keine Punkte oder Serien für diese Eingaben.

Private nächste Schritte und Schlafangaben bleiben lokal und werden nicht synchronisiert. Eine bewusst exportierte Datensicherung enthält sie. Geparkte Gedanken bleiben Teil der vorhandenen Inbox und deren optionalem Sync. Neue Hinweise enthalten auf dem Sperrbildschirm keine privaten Texte.

Einzelne Gedanken/Schritte erinnern nur, wenn „Einmal erinnern“ ausdrücklich gewählt wurde. Hinweise bei geschlossener App benötigen die Android-App und Benachrichtigungsfreigabe. Die Web-Version zeigt die gespeicherten Einträge. Der genaue Tagesvorrat umfasst mindestens14 Tage; wichtige gespeicherte Wochenregeln laufen anschließend weiter. Einmalige private Gedanken werden dabei nicht als Wochenregel wiederholt. Neue Tagesänderungen erreichen die native Planung beim erneuten Öffnen.

## Experimentelles Aktivitäts-Weckfenster

Unter **Mehr → Wecker & QR-Code → Aktivitäts-Weckfenster** aktivieren. Standardmäßig aus; vorgeschlagene Länge 45 Minuten, einstellbar von 5 bis 90 Minuten.

Beispiel: Bei festem Wecker um 06:30 und 45 Minuten Fenster beginnt die Auswertung um 05:45. Ein früherer Alarm kann innerhalb dieses Fensters ausgelöst werden. Eine kürzere Nacht ist dadurch möglich.

### Für jede Nacht

1. Gewünschte feste Weckzeit und Fensterlänge prüfen.
2. Bei geöffneter Android-App **Messung für diese Nacht starten** antippen und das Mikrofon erlauben.
3. Den tatsächlichen Status „Vorbereitet“ prüfen. Android zeigt eine laufende Dienstmeldung; dort und in der App lässt sich die Messung beenden.
4. Das Handy liegt auf der Matratze und muss deren Bewegungen erfassen können.

**Vorwecker:** Beim erfolgreichen Start einer Messnacht pausiert er für genau diesen Haupttermin, damit sein Ton und seine Vibration nicht als Aktivität eingehen. Das wird vor dem Start und im Status angezeigt. Die Pause bleibt auch nach Messungsende oder Neustart bestehen; der feste Hauptwecker bleibt gestellt. Ein abgelehnter Messstart entfernt keinen Vorwecker. Bei einer neuen Weckzeit oder der nächsten Nacht ohne Messung gilt wieder deine gespeicherte Vorwecker-Einstellung.

Vor dem Fenster werden keine Sensorwerte ausgewertet. Im Fenster werden Beschleunigung und Mikrofonlautstärke kombiniert. Kurze Audiopuffer und Aktivitätsaggregate liegen nur im RAM; es werden keine Tondateien gespeichert oder Daten versendet. Die Auswertung hat eine kurze Einlaufzeit und benötigt mehrere Aktivitätshinweise.

Das ist **keine Erkennung von Schlafstadien oder tatsächlicher Wachheit**. Umdrehen, Schnarchen, Partner oder andere Geräusche können Signale beeinflussen. Die Heuristik wurde mit künstlichen Signalen getestet; ihre Eignung auf der konkreten Matratze ist noch nicht am Gerät bestätigt.

### Absicherung

- Ohne passende Signale bleibt es beim festen Wecker.
- Messabbruch, fehlende Berechtigungen oder ein gestoppter Messdienst verändern den festen Hauptwecker nicht.
- Ein Neustart setzt die Mikrofonmessung nicht heimlich fort. Für die Messung erneut die App öffnen und starten.
- Ein früher Alarm nutzt denselben QR-/Rechen-/Notfall-Ausweg wie der Hauptwecker. Erst nach seinem bestätigten Beenden wird der zweite Alarm zur ursprünglichen Zeit übersprungen.
- Ohne Bestätigung bleiben feste Weckzeit, Timeout- und Neustart-Abgleich erhalten. Frühes Schlummern gibt keinen zusätzlichen zweiten Schlummerdurchgang am festen Zeitpunkt frei.
- Eine Änderung am Weckplan beendet eine laufende Messsitzung; für die neue Zeit muss sie erneut gestartet werden.

Bis die offenen Gerätetests bestanden sind, ist das Weckfenster eine zusätzliche, experimentelle Option.
