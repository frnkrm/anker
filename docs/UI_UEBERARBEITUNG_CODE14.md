# Anker 1.4.0-rc.1 / Code 14 – gemeinsamer UI-Auftrag

Der Nutzer hat am 08.11.2026 beide hochgeladenen UI-Aufträge vollständig zur
Umsetzung freigegeben. Die Phase-1-Begrenzung und das Warten auf ein „Go“ sind
durch diesen ausdrücklichen Auftrag aufgehoben. Keine Rückfragen, kein neuer
Signierschlüssel, keine zusätzlichen Netzfunktionen oder kostenpflichtigen
Aktivierungen. Sichtbarer Appname wieder **Anker**. Bestehende Paketkennung
`de.frnkrm.anker.mobile` und Release-Signatur bleiben erhalten.

## Bestandsaufnahme

1. Ausgang: main `1c5e9d401374932f091e914f189751353e4b5ec1`, Code 13.
2. React, TypeScript strict, Vite, Tailwind; Router in `src/App.tsx`.
3. Deutschsprachige Texte in den Seiten und Bausteinen unter `src/ui/`.
4. Gemeinsame Controls in `components/ui.tsx`, Layout in `src/index.css`.
5. Zustand-Aktionen in `src/state/store.ts`, vorhandener lokaler Repository-Datenbestand.
6. Dexie im Browser, SQLite unter Android; keine zweite Planungsdatenbank.
7. Bestehender Planer, Fokus-Timer und native Wecker bleiben die jeweiligen Besitzer.
8. Baseline: 875 Logik-/220 Browserfälle aus dem geprüften Code-13-Abschluss.
9. Das frühere Screenshotpaket stammt aus isolierten Playwright-Aufnahmen mit Beispieldaten; es bleibt als Vorher-Nachweis erhalten.
10. Cloud-Quellarchiv vor Änderungen: SHA-256 `201995be855b9a60d3e4e44784a567d642222011acba3fd12b25d0a917844c35`. Kein Export vom Handy.

## Aufbau und Anforderungen

| Auftrag | Konkreter Aufbau | Nachweise |
|---|---|---|
| 1.1 | Feierabendruhe als neuer/fehlender Standard; ausdrücklich aus bleibt aus; „Heute länger“ berücksichtigt. | `defaultsUi.test.ts`, `support.test.ts` |
| 1.2 | Zentrale 120-Minuten-Frist; strukturierte lesende Konfliktprojektion; lokale tagesgebundene Quittierung; Markierung betroffener Zeilen im Tagesplan. | `planConflicts.test.ts`, `uiActions.test.ts`, `redesign-now.spec.ts` |
| 1.3 | Gemeinsame deutsche Zähltexte und Tageswörter; kurze tatsächliche Wochentage in der Tagesauswahl. | `uiText.test.ts`, `redesign-now.spec.ts` |
| 2 | „Jetzt“ mit einer Hauptaktion, kurzer Kontextzeile, Dauer im Startknopf, optionalem Arbeitszeit-Chip und „Heute anpassen“. Vollständiger Plan unter „Heute“. | `redesign-now.spec.ts` und bestehende Abend-/Einstiegsfälle |
| 3 | Acht Karten in vier Gruppen unter „Mehr“; drei Haupttabs; gemeinsame Arbeits-, Abend-, Spiel-, Rückblick- und Schlafbereiche. Alte Einstiegspfade bleiben gültig. | `redesign-routes.spec.ts`, bestehende Deep-Link-Tests |
| 3 / Entwickler | Standardmäßig ausgeschaltete Entwicklerwerkzeuge; Testseite, Zeitübersicht und technische Angaben bleiben direkt aufrufbar. | `redesign-settings.spec.ts` |
| 4 | Gemeinsame Ring-Timer, Dauerchips, 24-Stunden-Felder, deutsche Datumsanzeige, Checkboxen, Auswahllisten und Zurück-Tasten. Rückgängig für löschbare Listen. | `fieldValues.test.ts`, `uiActions.test.ts`, `listUndo.test.ts`, Kontroll- und Fokusfälle |
| 5 / Fokus | Gemeinsamer Rahmen, laufendes Ziel ohne Auswahlleiste, Stopp-Auswahl für Ende oder Wiedereinstieg; echte Timer und IDs erhalten. | `redesign-focus.spec.ts`, `subtask-timer.spec.ts`, `recovery.spec.ts` |
| 5 / Formulare | Termin zuerst mit Was/Wann/Ende; weitere Angaben eingeklappt. Aufgabendetails gestuft. Orte zuerst mit Weg von Zuhause. | vorhandene Aufgaben-, Reise- und Formularprüfungen |
| 5 / Routinen | Kompakte Zeilen mit Griff links und Details auf Tipp; Zeitbudget als Hinweis, Änderungen nur nach eigener Wahl. | `routine-layout.spec.ts`, `routine-sort.spec.ts` |
| 5 / Alltag | Vorbereitung als Abhak- oder Bearbeitungsansicht; kurze Schlafnächte; nächste Erfolge und nach fehlenden Punkten sortierte Belohnungen. | Alltag-/Hub-Prüfungen |
| 6 | Einheitliche Begriffe, technische Erklärungen hinter Details, lesbare Datenschutzinformationen, dreiteiliger PC-Einrichtungsassistent. | `UI_GLOSSAR.md`, Verbindungs-/PC-Prüfungen |
| Gemini | Progressive Offenlegung; tatsächliche erledigte Tagesblöcke eingeklappt; Gedanken mit sofortiger Eingabe und separater Aufgabenansicht; Inhalte in gemeinsamen Tabs. | Hub-, Tages-, Gedanken- und Fokusprüfungen |

## Bewusste Entscheidungen bei Widersprüchen

- Drei Haupttabs folgen dem Gemini-Auftrag. Spiel und Gedankenerfassung bleiben
  über die zusammengeführten Bereiche und bestehende Direktlinks erreichbar.
- Die normale Jetzt-Ansicht passt bei 390 × 844 in einen Bildschirm. Große
  Schrift, schmale Geräte und ein tatsächlich fälliger wichtiger Hinweis dürfen
  scrollen. Ein starres `overflow:hidden` würde Inhalte und Bedienhilfen verlieren.
- Höchstens sechs Hauptgruppen in „Heute anpassen“ lassen sich nicht zugleich
  mit maximal zwei Tipps zu jeder einzelnen erweiterten Option vereinbaren.
  Häufige Aktionen bleiben direkt erreichbar; seltene Optionen stehen unter
  „Weitere Möglichkeiten“. Keine Funktion wird deshalb gelöscht.
- Native Checkboxen existieren nur innerhalb des gemeinsamen barrierearmen
  Checkbox-Bausteins. Die Features verwenden diesen Baustein. Der native
  Datumspicker bleibt innerhalb `DateField`; die sichtbare Appanzeige ist deutsch.
- Laufende Schreibvorgänge, nicht anwendbare Aktionen und fehlende externe
  Freigaben bleiben sinnvoll gesperrt. Fehlende normale Formulareingaben werden
  erklärt, statt kommentarlos eine Aktion zu deaktivieren.
- Eine Betriebssystem-Fensterfreigabe allein aktiviert keine nächtliche Funktion.
  Der stumme Hinweis hat eine eigene ausgeschaltete Voreinstellung. Bei eigener
  Aktivierung verbindet „Ich liege im Bett“ die tatsächliche Bettmarkierung mit
  dem vorhandenen Hinweisablauf.
- Der PC-Assistent merkt nur sein bewusst bestätigtes Ansehen. Ein Download oder
  dieser Merker ist kein Nachweis für Installation, Empfang oder Abschalten am PC.
- Keine Änderungen an Kotlin-Wecker-, Erinnerungs-, Sensor- oder Drucklogik.
  Android-Änderungen beschränken sich auf Anzeigenamen und Versionswerte.

## Prüfung und Auslieferung

Die gemeinsame Abschlussprüfung, APK-Prüfsummen, Vorher/Nachher-Bilder und
Downloadnachweise werden nach dem eingefrorenen Quellstand ergänzt.
Implementiert, automatisch geprüft und tatsächlich am Android-Gerät geprüft
werden getrennt ausgewiesen. Geräteprüfungen dieses Builds sind bis zu einer
wirklichen Beobachtung offen. Frühere Geräteberichte behalten ihren Buildbezug.
