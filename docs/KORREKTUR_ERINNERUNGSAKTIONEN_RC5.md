# Antworten auf Alltags-Erinnerungen

Stand: 7. November 2026, Anker Neu 1.3.0-rc.5 / Code 12.

Nutzerbericht: Nach Erledigt, 5 Min später oder Heute nicht verschwindet die Benachrichtigung, in Anker ist aber keine Änderung erkennbar. Die installierte Buildkennung und ein tatsächlicher Android-Log fehlen. Das Verschwinden allein bestätigt weder einen gespeicherten Store-Abschluss noch einen neuen Erinnerungstermin.

## Korrigiertes Verhalten

- **Abendroutine, Erledigt:** Die ausdrückliche Bestätigung übernimmt die noch offenen Schritte des aktuellen Plans. Minimal-Versionen bleiben minimal; vorherige done/minimal/skipped/not-needed-Ergebnisse und fremde Routinen bleiben erhalten. Jetzt bietet diese Schritte anschließend nicht erneut an.
- **Abendroutine, Heute nicht:** Auf ausdrücklichen Nutzerwunsch entfallen noch offene Schritte nur für diesen Tag (`not-needed`). Keine neue Erledigung, kein Abschlusszeitpunkt und keine neuen XP. Eine spätere Notiz erzeugt ebenfalls keinen Abschluss; eine später bewusst neu erledigte Handlung bleibt möglich. Die Standardroutine wird nicht verändert.
- **Frühe Hinweise:** Erledigt bei Losgehen in zehn Minuten bzw. PC-Stopp in fünfzehn Minuten bestätigt dieselbe echte Handlung wie beim Haupthinweis (`leftAt`/`pcOffAt`). Bisher wurde nur der Hinweis abgewählt.
- **5 Min später:** Verschiebt die Erinnerung nativ, ohne eine Erledigung oder Planverschiebung in Jetzt zu behaupten. Nach zweimaligem Verschieben entfällt nur der Später-Knopf. Die anderen Antworten bleiben bedienbar. Ersetzte Eskalationen bleiben über Fälligkeit, Zustellung und erneuten Planabgleich hinweg verbraucht. Ein geänderter Plan erhält weiter seine eigene Revision. Ruhe-/Fokusregeln und das Budget von höchstens drei Anzeigen bleiben bestehen.
- **Übernahme:** Vorübergehend abgelehnte Listener werden beim nächsten Abgleich erneut eingerichtet. Eine neue Rückmeldung während des Abschlusses einer leeren Queue-Abfrage wird noch verarbeitet. Native Queue lesen, Wirkung und Receipt atomar speichern, erst danach bestätigen: dieser bestehende Vertrag bleibt erhalten. Bei geschlossener App erfolgt der Store-Nachtrag beim nächsten Öffnen.

## Konkrete Fehler und Nachweise

`src/state/store.test.ts` reproduziert die zuvor fehlenden Zuordnungen und offenen Abend-Schritte, prüft Erledigt/Heute nicht, aktuelle Minimal-Versionen, atomaren Neuversuch, mehrfache Zustellung, Reload und ehrlichen Wiedereinstieg. `src/platform/notifications.test.ts` und `effects.test.ts` reproduzieren Listenerfehler, Rückkehr und verlorene Queue-Anfragen im Abschlussbereich. `ReminderModelTest.kt` prüft die erhaltenen Antwortknöpfe, fällige und bereits zugestellte Snoozes, Verbrauchsgrenzen und unveränderte gegenüber neuen Planrevisionen.

Die Verbrauchstokens eines angenommenen Snooze werden mit Slot, Queue und Aktionsqueue in demselben Preferences-Commit gespeichert. Es entsteht kein zweiter Aufgaben-/Planungsbestand. Die neue Snooze-UUID wird dabei nicht verbraucht; alte Token/Revisionen dürfen keine neuen Handlungen bestätigen.

Die Browserprüfung simuliert die Capacitor-Brücke und SQL-Speicherung. Sie ist kein Nachweis, dass Samsung eine Meldung tatsächlich zustellt oder ein echter Android-PendingIntent ausgelöst wurde. Die bestehenden Stationen G21/G67 enthalten den gezielten Geräteablauf; die Zahl der Stationen und frühere Berichte bleiben erhalten. Frühere Erfolge bei G23 gehören weiter zu ihrem damaligen Build.

Gemeinsame automatische Ergebnisse und der genaue ausgelieferte Stand werden in [Testnachweise](ANKER_TESTNACHWEISE.md) und [Implementierungsplan](ANKER_IMPLEMENTIERUNGSPLAN.md) nach Abschluss festgehalten. Echte Installation und neue Android-Beobachtungen bleiben bis zum Nutzerbericht offen.
