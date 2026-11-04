# Flexible Planung

Ein Plan ist ein Angebot, keine Verpflichtung. Diese Datei beschreibt, wie Anker damit rechnet.

## Zustände

| Zustand | Bedeutung | Zählt als erledigt | XP |
|---|---|---|---|
| `done`, `minimal` | Wirklich gemacht | ja | ja |
| `skipped` | Übersprungen | nein | nein |
| `not-needed` | „Heute nicht nötig“ | nein | nein |
| Routine später (`routineAt`) | Bleibt offen, neue Zeit | nein | erst beim Tun |
| Versorgt (`coveredSteps`, `routineLinks`) | Entfällt an diesem Tag, gilt dort nicht als gemacht | nein | nein |

`routineDone` heißt „nichts mehr offen“, `routineCompleted` heißt „wirklich gemacht“. Nur Letzteres setzt `eveningRoutineDoneAt`.

Ein Tag mit `override.adjusted` zählt nie als verfehlt: Sind die Ziele erfüllt, ist er geschafft, sonst neutral. Verdiente XP bleiben, alte Tage ohne dieses Feld bewerten sich wie bisher.

## Reihenfolge

Einmalige Tagesänderung > bestätigter Termin > wiederkehrende Regel > allgemeiner Standard. Tagesänderungen schreiben den Wochenstandard nie um.

**Hart oder flexibel:** Harte Termine verschiebt Anker nie. Überschneiden sie sich, wird das benannt, ändern kann es nur der Nutzer. Flexible Dinge rücken nach: Evening-Plan entfällt bei einem Abendtermin, die Abendroutine kommt danach, kurz wenn es spät wird, oder wartet auf „Bin wieder da“.

## Wege

Der Start einer Strecke ist der letzte bekannte Ort (`planLegs` in `src/core/planner/adaptive.ts`): Wohnung, Büro bei Arbeit vor Ort, sonst der vorige Termin. Von dort geht es direkt weiter, ohne Umweg über die Wohnung.

- **Fahrzeit:** deine Schätzung am Termin oder am gespeicherten Ort. Fehlt sie, gibt es keine errechnete Abfahrt, sondern den Hinweis „Fahrzeit fehlt noch“. Nie 0 Minuten und nie eine erfundene Zahl.
- **Rückkehr:** Ohne Endzeit wird keine angenommen.
- **Karte:** Der Link zu Google Maps braucht keinen Key und überträgt die Adresse erst beim Antippen. Maps gibt Anker keine Fahrzeit zurück, deshalb steht überall „deine Schätzung“.
- **Verkehrsdaten und Standort sind nicht umgesetzt.** Beides bleibt optional und braucht eine eigene Entscheidung (siehe Plan).

## Morgen und Schlaf

```text
Abfahrt       = Ankunft - Ankunftspuffer - Fahrt
Weckzeit      = Abfahrt - Morgenroutine - Wach werden
Homeoffice    = Arbeitsbeginn - Rechnerstart - Morgenroutine - Wach werden
```

Anker zeigt daraus einen Vorschlag und ändert den Wecker **nur nach Bestätigung**, einmalig für diesen Tag (`wakeOverride`). Kotlin übernimmt das über `wakeOverrides` und plant den Folgetag wieder normal. Ein klingelnder Wecker bleibt davon unberührt.

Schlaf ist eine Schätzung aus Bettzeit, Einschlafzeit und Weckzeit, keine Messung und keine Therapie. Anker nennt eine kurze Nacht sachlich und empfiehlt nie, weniger zu schlafen. Medikation spielt in dieser Rechnung keine Rolle.

## Zeit

Alles in Plan-Minuten für `Europe/Berlin`, Werte über 1440 liegen nach Mitternacht. Der Plantag wechselt um 04:00. UTC nur an den Rändern.

## Datenschutz und Dienste

Termine, Orte, Adressen, Arbeit und Einnahmeprotokoll liegen in `LocalData` (`meta/local`): kein Sync, nicht im Kalender. In der JSON-Sicherung sind sie enthalten. Erinnerungen nennen weder Anlass noch Ort.

| Dienst | Wofür | Kosten | Was wird übertragen | Cache | Abschalten |
|---|---|---|---|---|---|
| Open-Meteo | Wetter, Standard aus | Frei für private nichtkommerzielle Nutzung, unter 10.000 Abrufen am Tag, CC BY 4.0 | Eingegebener Ort bzw. dessen Koordinaten, IP-Adresse. Open-Meteo löscht Logs nach 90 Tagen | 3 Stunden | *Alltagshilfen → Wetter* |
| Google Maps (Link) | Route öffnen | Frei, kein Key | Adresse, erst beim Antippen | keiner | Knopf nicht nutzen |

Ohne Netz: „Wetter gerade nicht verfügbar“, der Rest läuft weiter.
