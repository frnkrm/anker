# Kompakte Routinekarten

Stand: 7. November 2026, Anker Neu 1.3.0-rc.6 / Code 13.

Nutzerauftrag: Dauer rechts neben der Beschriftung, Entfernen am Kartenende, niedrigere gut verschiebbare Karten und keine überlappenden Felder oder Knöpfe.

## Aufbau und Erhalt der Bedienung

Die Karten zeigen Titel, eine gemeinsame Dauerzeile mit Minus, direkter Zahleneingabe, Einheit und Plus sowie darunter die bestehende Minimal-Version. Griff und Sortierpfeile stehen mit Entfernen in einer Fußzeile unter allen Eingaben. Keine Eingabe wird für die kompakte Darstellung versteckt.

Die Routinefelder verwenden lokal eine 196-Pixel-Bediengruppe mit 60-Pixel-Zahlenfeld. Andere Einstellungsseiten behalten ihre bisherigen 256-/160-Pixel-Spalten. Einheit, Plus und Minus haben feste Positionen; Touchflächen bleiben mindestens44Pixel groß. Die Karten dürfen mit großer Schrift wachsen, damit Inhalte nicht verdeckt werden. Auch die tatsächlichen gezeichneten Griffzeichen dürfen ihre Fläche nicht verlassen.

Im normalen390-Pixel-Handylayout sind die Karten220Pixel hoch; die ersten beiden Griffe sind ohne Scrollen oberhalb der Navigation erreichbar. Bei320Pixeln/160Prozent bleiben Dauer und Zahl nebeneinander, alle Bedienflächen innerhalb ihrer Karte. Freitexte können wie bisher im Eingabefeld horizontal bearbeitet werden.

`SortableList` verwendet weiterhin dieselbe Pointer-Capture-/Scroll-/ID-Logik. Die optionale Fußzeile wird nur im Routineneditor gewählt; Unteraufgaben behalten die vorhandene Seitenanordnung. Speichern, Erledigungen, Dauern, Minimal-Versionen, IDs, Datenbankmodell und Planerregeln werden nicht geändert. Vorherige Testergebnisse bleiben mit ihrem Buildbezug erhalten; G95 erhält die passende Anleitung statt einer zusätzlichen Teststation.

## Nachweise und Grenzen

Vier gezielte Geometriefälle in `e2e/routine-layout.spec.ts` prüfen Morgen und Abend jeweils bei320/390Pixeln und100/160Prozent Schrift: echte Textgrenzen, einzeiliges Dauer-Label, vollständige120Minuten, Karten- und Button-Grenzen, keine überlappenden Flächen und erreichbare Griffe. `settings-layout.spec.ts` erhält nur für Routinefelder ein eigenes strenges Größenprofil. Der vorhandene echte CDP-Touchsortierfall bearbeitet zusätzlich die Dauer direkt und prüft sie nach Sortieren und Reload zusammen mit Titel, Minimal-Version und IDs.

Die visuelle Nachkontrolle entdeckte trotz zunächst unauffälliger Button-Rechtecke bei großer Schrift einen umbrechenden Doppelgriff und ein zweizeiliges Dauer-Label. Lokale Griffschrift ohne Umbruch und die schmalere Bediengruppe beheben dies; Text-Range-Prüfungen ergänzen die bisherigen Flächenprüfungen. Screenshots und lokale Logs liegen unter `/workspace/.cache/anker/routine-layout-rc6/`.

Der Gesamtabschluss mit Produktionsbrowsern, Android-Paket und genauem Quellcommit wird in [Testnachweise](ANKER_TESTNACHWEISE.md) und [Implementierungsplan](ANKER_IMPLEMENTIERUNGSPLAN.md) festgehalten. Bildschirmfoto des Nutzers ist der Änderungsauftrag; es bestätigt noch keinen neuen Test dieser Korrektur auf dem echten Samsung.
