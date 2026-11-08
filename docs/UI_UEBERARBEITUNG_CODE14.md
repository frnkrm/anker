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

**Implementiert und automatisch geprüft:** Quelle `1e1f0218ddaf14fa25b4dff0d3d9a0cc6ffb324a`, Version
**1.4.0-rc.1 / Code 14**, Laufzeitkennung `46cc0637832d20687f2a246cd3dd13a69b08efde6f071f6756ab942aa86b3e87`.
[GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42451162451) vollständig grün: **248/248 Browserfälle**, keine
Fehler, Flakies, Skips oder Retries. Zusätzlich **912/912 Vitest-Fälle**, TypeScript,
Produktionsbuild, Lint ohne Fehler (eine bestehende Cleanup-Warnung),
**36 Update-Mockfälle**, **19 PowerShell-Fälle und vier Parser** erfolgreich.
Die vollständige CI bezieht sich auf genau diesen Quellcommit; aus den lokalen
gezielten Nachprüfungen wird kein einzelner grüner lokaler Gesamtbrowserlauf abgeleitet.

Zusätzlich wurden zwei echte Dialogfehler mit verzögerten Browseraktionen am
alten Build rot reproduziert: doppelte Zurück-Anforderungen und das Schließen
eines bereits neu geöffneten Sheets. Beide Regressionen und alle 42 betroffenen
Browserfälle sind mit dem abgesicherten Manager grün.

Android wurde aus einer isolierten Kopie dieses Commits gebaut. **122 JUnit-Fälle
in elf Klassen frisch ausgeführt**, keine Fehler oder Skips; Debug-/Release-AAR-
Metadaten, Kotlin-Kompilierungen und zusammengeführte Manifeste erfolgreich.
Capacitor erzeugt zusätzlich seine bekannte `config.xml`: Das ändert die
native Eingabekennung auf `80f3774db7fc58a3f8eb3155c3de568b4d6930413c9505c1358d306e5ca17d85`. Diese einzige
abgeleitete Datei und alle übrigen unveränderten Eingabebytes sind separat
gebunden. Die getestete Webkennung wird dadurch nicht umgeschrieben.

APK mit bestehendem B4-Release-Zertifikat signiert, v2/v3 und 16-KB-Ausrichtung
geprüft. Anzeigename **Anker**, Paket `de.frnkrm.anker.mobile`, Code 14.
Alle 60 Webdateien entsprechen dem getesteten Produktionsstand. Alle bisherigen
Einträge im APK-Archiv bleiben beim Signieren bytegleich; hinzu kommen nur
Signaturdateien.
APK: **38042626 Bytes**, SHA-256
`e4685b32f9796c462f7d8f683088312e13fe2c324d702e002f6a3f5bb56bd834`.

[Fertiges APK-Paket herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-code14-20261108).
Der vollständige Chromium-Klickdownload wurde mit aktiver TLS-Prüfung gespeichert:
**21841197 Bytes**, SHA-256 `3b0584636576ab2d55d30db9f5d4bfa6b60e70734f894dd40ccc3b09e79a7779`.
ZIP-CRC, vollständige Dateiliste und alle enthaltenen Bytes wurden gegen die
veröffentlichten Dateien geprüft. Schlüssel oder Passwörter sind nicht enthalten.
[Maschinenlesbarer Nachweis](ANKER_CODE14_NACHWEIS.json).

### Bilder und Prüfwege

[Bilderpaket separat herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/screenshots-anker-code14-20261108).
Im entpackten Bilderpaket: **`screenshots/index.html`**. Acht gleiche Jetzt-Zustände
vorher/nachher, **54 Nachher-Ansichten mit 73 PNGs**, zusätzlich **89
frühere Seitenaufnahmen** für die übrigen betroffenen Bereiche. Frühere Aufnahmen
mit anderen Beispieldaten sind ausdrücklich gekennzeichnet. Nur Browserbilder,
keine behaupteten neuen Android-Gerätenachweise. Lokale Originalpfade:
`/workspace/artifacts/anker-code14/screenshots/{before,before-legacy,after}`.
Grundaufnahmen (44 Ansichten): `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node
scripts/ui-screenshots.mjs http://127.0.0.1:4173 <Ausgabeordner>`. Die zehn
ergänzten Aufnahmen zeigen weitere Einstiegsseiten und einen laufenden
Aufräumtimer; Aufrufpfade und Zustände stehen in der Bildliste.

Die sechs kurzen Geräte-Teststationen bleiben erhalten; G95 führt zu den
kompakten Routinen, G96 berücksichtigt die getrennte freiwillige Aktivierung
des stummen Hinweises. Einstieg: **Mehr → Einstellungen → Test- und
Entwicklerwerkzeuge anzeigen → Gemeinsam testen**. Frühere Berichte behalten
ihren jeweiligen Buildbezug.

### Annahmen und verbleibende Grenzen

- Die zwei Vorlagen teilen sich vorhandene Zustände, Aktionen und Routen.
  Es gibt keine parallele Planung und keine neue Netzwerkabhängigkeit.
- Einzelne technische Statusbegriffe in der optionalen Anbieterdiagnose und
  der Zeitzonenhinweis im Wetter sind noch sichtbar; diese sprachliche
  Restpolitur wurde zugunsten unveränderter Freigabe- und Fehlerinformationen
  zurückgestellt. Datenschutz-Empfänger bleiben vollständig benannt.
- Reale Installation, Systemleisten, Samsung-Touch, Alarm-/Hinweiszustellung,
  Mikrofon-/Bewegungsmessung und Windows-PC-Schaltung dieses Builds bleiben
  **offen**, bis sie tatsächlich auf den Geräten beobachtet wurden.
- Der nächste sinnvolle Durchlauf ist der gemeinsame kurze Gerätecheck mit
  diesem Gesamtstand. Daraus folgen konkrete Korrekturen statt weiterer Pflichtfälle.
