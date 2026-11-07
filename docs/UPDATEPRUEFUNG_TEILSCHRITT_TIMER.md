# Timer für einzelne Aufgaben-Teilschritte

Stand: 07.11.2026. Ausgang `main` auf `424e041`, App 1.3.0-rc.2 / Code 9. Dieser Beleg beschreibt den Kern und seine Datengrenzen; Bedienung und gemeinsamer Update-/Gerätenachweis werden separat integriert.

## Erneut geprüfter Anlass

Die Lücke aus Auftrag 2 bestand im aktuellen Code: `TaskPart` enthielt stabile IDs, Titel, Schätzung und echte Erledigungszeit. `FocusTarget` konnte nur eine Routine oder die ganze Aufgabe referenzieren. `startTaskFocus(ref, minutes)` und das Fokusarchiv unterschieden keine Teilschritte; `TaskFocus.tsx` bot für Teile nur Checkboxen. Routine- und Aufgabentimer hatten bereits denselben UTC-Countdown mit expliziter Pause.

Vier gezielt ausgeführte Regressionen scheitern auf den unveränderten Produktionsquellen von `424e041`: fehlende Teilreferenz, nicht getrennte Archive, fehlende dauerhafte Referenzbereinigung beim alten Aufgabenimport und vermischte Sitzungsdaten beim alten Elternfokusimport. Der letzte Fall zeigt bereits ohne neue Teilfelder, dass rekursives Ergänzen einer vollständigen Fokussitzung alte `pausedAt`-/`remainingMs`-Werte in eine importierte laufende Sitzung kopieren konnte. Die gleiche Ergänzung hätte künftig auch eine fremde `partId` übernommen.

## Bestehendes Modell und API

```ts
type TaskFocusTarget = TaskRef & { partId?: string }
// TaskPart.timerMin?: number; ResumePoint.partId?: string
startTaskFocus(ref: TaskRef, minutes?: number, partId?: string): Promise<void>
pauseTaskFocus(ref: TaskRef, nextStep?: string, note?: string, expectedPartId?: string): Promise<void>
```

`TaskRef` bleibt die Elternreferenz. Ohne neue Parameter startet die Elternaufgabe weiterhin mit 25 Minuten. Für einen Teil gilt bei einem neuen Zeitfenster: ausdrücklich gewählte Dauer, sonst dessen gespeicherte `timerMin`, sonst `estimateMin`, sonst 25 Minuten. Gültig sind endliche Dauern über 0 bis 1440 Minuten. `timerMin` beschreibt die bewusst gewählte Timerdauer; Schätzung, echte Arbeitszeit und Lerndauer bleiben getrennt.

Eine noch positive Restzeit desselben Ziels hat Vorrang vor einer neu übergebenen Dauer. Erst ein bewusstes neues Zeitfenster nach Ablauf oder Entfernen der Sitzung erhält eine neue Sitzungs-ID und Dauer. Ein Wechsel pausiert und archiviert die vorherige Sitzung unter ihrer vollständigen Eltern-/Teilidentität. IDs mit Doppelpunkten, Schrägstrichen und anderen Sonderzeichen können keine Eltern- und Teilziele vermischen.

`pauseTaskFocus` bleibt für bestehende Elternaufrufe kompatibel. Mit `expectedPartId` wirkt eine verspätete Pause nur auf den gerade passenden Teil; sie ändert sonst weder den anderen Timer noch Status, nächsten Schritt oder Notiz. Der unveränderte Teiltitel aus einem Unterbrechungsformular überschreibt keinen eigenen nächsten Schritt der Elternaufgabe. Wiedereinstiege verwenden den aktuellen Titel des referenzierten Teils und eine kanonische Route mit kodiertem `?teil=`.

## Lebenszyklus und Datenerhalt

- Laufende Zeit kommt weiterhin aus der UTC-Deadline, pausierte Zeit aus der gespeicherten Restdauer. Anzeigeintervalle sind keine Zeitquelle. Ablauf erledigt weder Teil noch Elternaufgabe, vergibt keine XP und bucht weder Arbeitszeit noch Dauerlernproben.
- Umbenennen und Umordnen mit derselben ID bewahren Sitzung und Restzeit. Erledigte oder entfernte Teile verlieren ihre unbrauchbaren aktiven/archivierten Timer und Wiedereinstiege. Ein verspäteter Teilstart wird niemals zu einem Elternstart. Der Abschluss der Elternaufgabe entfernt ihre Teiluhren; Rücknahme startet keine Uhr.
- Der bestehende Transfer von Inbox nach Arbeit erhält Teil-, Fokus- und Archividentitäten sowie den Wiedereinstieg. Entfernen einer Aufgabe bereinigt ihre Verweise weiterhin im gemeinsamen Taskcommit.
- Load, Sync und Import prüfen die reale offene Eltern-/Teilreferenz. Entfernte Referenzen werden dauerhaft bereinigt; beim Import geschieht dies im selben Repository-Merge wie die Aufgabenänderung. Eine spätere alte Aufgabenliste kann so keine frühere Deadline wiederbeleben. Speicher-/Importfehler veröffentlichen keinen halben RAM-Erfolg.
- Explizit importierte `focus`, `resume` und `captureDraft` werden als vollständige Identitätsobjekte übernommen. Ausgelassene ganze Privatfelder einer Teilsicherung bleiben erhalten. Einstellungen einschließlich ihrer Fokuskonfiguration werden weiterhin additiv ergänzt. Alte Elternfokussitzungen behalten ihre eigene Startzeit/Deadline und erben keine Teilreferenz.
- Neue Felder sind optional und werden vor Import geprüft. Alte Task-/Fokus-/Backupformen bleiben gültig. Bei einem beschädigten neuen `timerMin` in lokal geladenen Daten bleiben gültige ältere Teiltitel und echte Teilabschlüsse erhalten. Keine Schema- oder pauschale Datenmigration.
- Arbeit bleibt in `meta/local` vom Sync ausgeschlossen. Die vorhandene Auswahl ohne Arbeitsdaten entfernt weiterhin Arbeitsfokus, Archive, Wiedereinstieg und Captureentwurf einschließlich der neuen Teilreferenzen. Private Aufgaben behalten ihren bestehenden Syncweg. Widget-/Benachrichtigungstexte erhalten keine neuen Inhalte.
- Der vorhandene Schutz verspäteter Fokus-Pulse bezieht zusätzlich die Query in den Navigationsvergleich ein: Auch der Wechsel zwischen `?teil=`-Ansichten beendet den Geltungsbereich einer alten Pulsantwort. Die Deadline- und Pausenlogik bleibt dieselbe.

## Automatischer Beleg und Grenzen

`src/state/subtaskFocus.test.ts` ergänzt zwölf tatsächliche Lebenszyklus-/Datenrisiken. Zusätzliche Corefälle prüfen kollisionsfreie Identität, aktuelle Teilwiedereinstiege und den Erhalt alter Teilangaben bei beschädigtem optionalem Dauerfeld. Die bestehenden Task-, Import-, Backup-, Sync-, Widget- und Routineprüfungen bleiben enthalten.

Abschließender Kernstand: **799 Vitest-Tests in 82 Dateien**, keine Fehler; Lint mit 0 Fehlern und einer bestehenden Ref-Cleanup-Warnung in `TaskAssistance.tsx`; Typecheck und Produktionsbuild erfolgreich. Belege liegen unter `/workspace/.cache/anker/subtask-timer-core/`: `vitest-full-final.log`, `lint-final.log`, `typecheck-final.log`, `build-final.log`. Der gezielte Rotlauf auf `424e041` liegt in `baseline-red.log`; seine sieben übrigen Fälle waren durch den Testfilter nicht ausgewählt.

Dieser Kernbeleg führt keine neue Android-Geräteprüfung, native Audio-/Vibrationsprüfung, SQLite-Updateprüfung oder Anbieteraktivierung als bestanden. Die kombinierte Browserprüfung einschließlich Teilauswahl, Capture, Wiedereinstieg und verspätetem Puls erfolgt im UI-/Integrationsstand. Keine früheren Geräteberichte oder Nutzerdaten wurden geändert; kein Push, Release oder Deployment durch diese Etappe.
