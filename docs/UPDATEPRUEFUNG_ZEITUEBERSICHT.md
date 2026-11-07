# Zeitübersicht: lokaler Lesekatalog

Stand: 7. November 2026, Kern auf Basis `2721fff`. UI und Android-Gerätenachweise werden getrennt integriert.

Die Übersicht führt die vorhandenen zeitabhängigen Funktionen zusammen. Sie plant, startet, verschiebt und deaktiviert nichts. Berechnete Uhrzeiten beweisen weder native Planung noch Zustellung, Ton, PC-Empfang oder Ausführung. Vorschläge führen in bestehende Quellen; ihre Übernahme bleibt eine eigene bewusste Eingabe.

## Modell und API

`src/core/timeCatalog.ts` exportiert `TimeCategory`, `TimeCatalogEntry`, `TimeCatalogSuggestion`, `TimeCatalogSnapshot`, `TimeCatalogRuntime`, `TIME_CATEGORIES`, `TIME_STATUS_LABELS` und `TIME_EFFECT_LABELS`.

Ein Eintrag enthält eine stabile semantische `functionId`, eine kollisionsfreie Instanz-ID, Kategorie, Quellart und bestehende Quell-ID/Datum/Route, optional UTC-Zeit und Ende, Status, Wirkung, Evidenz und Erklärung. Die Kategorien sind Abend & Schlaf, Arbeit, Routinen, Termine & Wege, Bewegung & Gesundheit, Haushalt, Fokus & Pausen, Reflexion und Technik. Status und Wirkung bleiben getrennt: z. B. ein bedingter PC-Auftrag ist keine zugestellte Erinnerung.

- `buildTimeCatalog({ settings, days, inbox, events, local, plans, nowMs, runtime? })` projiziert rein lesend.
- `timeCatalogPlanDates(state, now)` liefert die 14 logischen Plantage sowie bekannte datierte Verpflichtungen und Tagesausnahmen für den vorhandenen `planFor()`.
- `timeCatalogSourceRevision(state, now)` ignoriert Cacheinhalt, Erstellungszeit und native Lesezeit; eine getrennte `runtimeRevision` berücksichtigt ausdrücklich gelesene Momentaufnahmen.
- `currentTimeCatalog(state, now, runtime?)` gibt nur einen schema-, revisions- und TTL-gültigen Stand zurück. Der Aufruf ohne Runtime benötigt keine erneute native Abfrage.
- `useApp.getState().refreshTimeCatalog(runtime?)` initialisiert beim ersten Öffnen. Ein ausgelassener Parameter behält zuletzt tatsächlich gelesene Runtime, `{}` setzt sie bewusst zurück. Parallelaufrufe werden zusammengefasst; die letzte echte Quelle gewinnt.

Ein Snapshot hält `version`, `sourceRevision`, `runtimeRevision`, Erstellungszeit, Gültigkeit, Plantag, Zeitraum, chronologische Einträge und Vorschläge. Er gilt höchstens eine Minute, spätestens bis zur nächsten enthaltenen Zeit oder zum Ablauf einer nativen Momentaufnahme. Der logische Tag wechselt wie im restlichen Produkt um 04 Uhr in Europe/Berlin; die Sortierung verwendet UTC. Einzeltermine, Fristen, Wiedervorlagen, datierte Weck- und Abend-/Routinenentscheidungen bleiben auch außerhalb der 14 Wiederholungstage erhalten. Einmalige Weckausnahmen behalten ihren eingeschalteten Vorwecker und ihr optionales Aktivitätsfenster.

## Belegte Quellen

| Funktionen | Vorhandene Wahrheit | Darstellung |
| --- | --- | --- |
| Haupt-/Vorwecker, Aktivitätsfenster, Kranktag, Weckausnahme | `buildAlarmConfig`, `nextAlarmTimes` | Berechnete Instanzen; Fenster bleibt bedingt |
| Schlummern, Wachheits-Check, Testalarm | Tatsächlich übergebenes `getAlarmState`-Ergebnis | Ohne frische Momentaufnahme keine erfundene Uhrzeit |
| Erinnerungen, Wiederholungen, Ruhe-/Krank-/Erledigt-Kontext | `buildReminders` | Nur tatsächlich geltende berechnete Hinweise |
| Routinen, Arbeit, Sport, Vorbereiten, Wege, Bettzeit | `planFor` / `buildDayPlan` | Planung/Anzeige; startet und erledigt nichts |
| PC-Stopp-Auftrag | `buildPcStopCommands` | Eigene bedingte Wirkung, keine PC-Ausführungsbestätigung |
| Bildschirmabstand | Bestehender Plan und `sleep.screenOffMin` | Nur Berechnung; manuelles `pcStop` bleibt erhalten |
| Termine, Aufgabenstart/-frist/-wiedervorlage, Gedanken, nächste Schritte | Bestehende Kalender-/LocalData-/Inbox-IDs | Explizite Einzelzeiten bleiben erhalten |
| Fokus-/Starthilfe-Ende und Fokus-Pulse | Bestehende timestampbasierte Countdownzustände | Pausen haben keine aktive Deadline; Pulse bleiben an sichtbaren Fokus und erlaubten Kontext gebunden |
| Aufräumende | Optional tatsächlich gelesener `anker.tidy.<Plantag>`-Start | Ohne Snapshot bedingt; startet keinen Timer |
| Kontakt später, Rückkehrfrage, Abendmodus | Bestehende freiwillige Daten/Tagesausnahmen | Kontextabhängige Anzeige, kein Versand und keine automatische Entscheidung |
| Wetter, Verkehr, Sprache, Standorthilfe | Bestehende Gerätefreigaben und Aktivierung | Bedingt, kein erfundener autonomer Abruf oder Aufenthaltsnachweis |
| Nativer Einschlafhinweis | Optional wirklich gelesener Controllerzustand | Controller bleibt alleiniger Besitzer; kein Zustand aus Einstellungen erfunden |

Native Momentaufnahmen gelten nur zwei Minuten und werden als „nativ ausgelesen“ bezeichnet. Auch ein hinterlegter Zeitpunkt ist kein Zustellnachweis. Abweichungen der ausgelesenen Haupt-/Vorweckzeit von der aktiven Berechnung führen nur zur vorhandenen Weckerdiagnose.

Der aktivierte Abendübergang ersetzt im bestehenden Reminderbuilder bereits PC-Stopp-vorab, PC-Stopp und Bettzeit. Diese Quellen erscheinen ausdrücklich als **inaktiv / bereits abgestimmt**. Sie erzeugen keine Doppelwarnung und keinen Vorschlag zum Abschalten. Der tatsächliche PC-Befehl bleibt eine eigene Wirkung. Gleichzeitige aktive Hinweise werden anhand ihrer echten UTC-Zeit verglichen, auch wenn ihre logischen Plantage verschieden sind. Weitere Vorschläge betreffen Start nach Frist, bestehende Plankonflikte oder eine gewählte private Erinnerung ohne eigene Uhrzeit. Keine Quelle wird automatisch geändert.

## Persistenz und Datenbewahrung

Die kleine Datenbank ist ein abgeleiteter Record `meta/time-catalog` im **vorhandenen Repository**, mit demselben atomaren Storewriter wie echte Änderungen. Beim Laden wird er ausschließlich als `LocalData.timeCatalog` angefügt. Er ist kein zweiter Zeitplan und keine Importquelle. Cachewrites verändern den `updated_at`-Zeitstempel von `meta/local` nicht. Alle echten `meta/local`-Writes, auch `putMany`, Recovery-, Wetter- und Importpfade, entfernen den angefügten Cache aus dem Quellpayload.

Ohne bisherige Initialisierung gibt es auf alten Seiten keinen zusätzlichen Cachewrite. Nach Nutzung aktualisiert `changed()` die Übersicht zusammengefasst; Cachewrites selbst rufen `changed()` nie auf. Frische unveränderte Snapshots werden nicht erneut geschrieben. Fehler veröffentlichen keinen halben Cache und ändern keine Quelle.

Voll- und Teilbackups lassen den gesamten Cache-Record und auch ein mögliches eingebettetes Alt-/Fremdfeld weg, einschließlich Tombstones. Import und Importvorschau verwerfen beides. Der vorhandene Syncfilter schließt alle Meta-Records aus; reine Cacheänderungen lösen keinen Planchange und damit keinen Cloudpush aus. Ausgeschlossene Arbeits-/Orts-/Gesundheitsgruppen können so nicht als abgeleiteter Text wieder auftauchen. Erlaubte große Originalbestände werden nicht still gekürzt; Cachevalidierung hat keine kleineren Mengenlimits als die Originalmodelle.

## Automatisch geprüft

Die neuen Core-/Storetests prüfen aktive gegen bereits abgestimmte Hinweise, echte Überschneidungen mit verschiedenen Plantagen, manuelle PC-Zeit und reine Bildschirmberechnung, Kranktage, 03-/04-Uhr-Grenze, Mitternachts-Abendhinweise, 14 Tage und weit entfernte Einzelquellen samt abhängigen Weckern, datierte Routinen/Abende, Pausen und Runtime-Frische, fehlende Nebenwirkungen, Source-/TTL-Änderungen, Koaleszierung und konkurrierende Quelländerung, keine `changed()`-Schleife, Schreibfehler, vollständige Backup-/Import-/Syncgrenze und echte LWW-Teilimporte zwischen Quellwrite und späterem Cachewrite. Ein großer erlaubter Altbestand mit über 2.000 Konflikten und gebrochenen UTC-Millisekunden bleibt lesbar.

Vollständiger Vitest-Lauf: **845 Tests in 85 Dateien grün**. Typecheck und Produktionsbuild: grün. Lint: keine Fehler, eine bereits vorhandene `TaskAssistance.tsx`-Ref-Warnung. Logs: `/workspace/.cache/anker/time-catalog-core/`.

Unabhängige Prüfung in einer getrennten Quellkopie: **27/27** (21 eigene plus 6 zusätzliche Reviewfälle), darunter 20.001 gültige Kalendertermine sowie Runtime-/Load-/04-Uhr-/TTL-Races. Beide konkret gefundenen Randlücken (abhängige Vorwecker/Fenster bei entfernter Weckausnahme und inkonsistente Cache-Mengengrenzen) wurden behoben. Beleg: `/workspace/.cache/anker/updatepruefung/time-catalog-review/snapshot-final/final-review-green.log`.

Nicht als Gerätenachweis ausgegeben: reale Android-Zustellung, Ton, Schlafphasen, Geofence-Aufenthalt, PC-Empfang oder PC-Ausführung. Diese Änderung liest vorhandene Zustände; sie führt keine dieser Wirkungen aus.
