# Gleitzeit und Kundenarbeit

Anker soll dir Entscheidungen abnehmen, nicht zur Zeiterfassung werden. Alles hier ist freiwillig, liegt auf dem Gerät und ist keine offizielle Arbeitszeiterfassung, keine Lohnabrechnung und keine Rechtsauskunft.

## Begriffe

| Begriff | Wo | Bedeutung |
|---|---|---|
| Wunsch-Beginn | `work[tag].start`, heute `override.workStart` | Wann du anfangen möchtest. Darf sich täglich ändern |
| Spätester Beginn | `flex.latestStart`, Vorgabe 09:00 | Eine Grenze am Arbeitsort oder im Homeoffice, kein Ziel. `null` = aus |
| Soll netto | `work[tag].durationMin`, heute `override.targetNetMin` | Arbeitszeit ohne Pausen. Dein Wert, je Wochentag |
| Übliche Pause | `work[tag].pauseMin`, heute `override.pauseMin` | Rechnet nur, solange keine Pause erfasst ist |
| Ist-Zeit | `LocalData.workSessions` | Nur, was du gestartet oder nachgetragen hast. Nie aus einem Plan abgeleitet |
| Geplanter Einsatz | `Commitment.workKind` | Bleibt ein Plan, bis du ihn startest |

Der **Freitag** ist ein normaler Eintrag in `work`. Anker rät keinen Wert: Solange du keinen kürzeren einträgst, gilt, was dort steht, und die Einstellungen weisen einmal darauf hin.

## Reihenfolge

Für den Beginn: bestätigter Kundentermin vor der Grenze > Tagesabweichung > Wochenregel.
Für das Ende: reales Ende > „Heute früher/länger“ (`override.workEnd`) > Prognose. Laufende Arbeit endet im Plan nie in der Vergangenheit.

## Rechnung (`src/core/worktime.ts`)

```text
Netto           = (Arbeitsabschnitte vereinigt) − (Pausen darin vereinigt)
Ohne Erfassung  : Feierabend = Beginn + Soll + übliche Pause
Arbeit läuft    : Feierabend = jetzt + Rest-Soll + übliche Pause, solange keine Pause erfasst ist
Pause erfasst   : Feierabend = jetzt + Rest-Soll, die erfasste Pause zählt allein
Pause läuft     : wie oben, wächst also mit jeder Minute Pause
Differenz       = Netto − Soll des Tages
```

Beispiel: Start 08:00, Soll 8 h, Pause 12:00 bis 13:30 ergibt 17:30. Korrigiert auf 13:15 ergibt das 17:15. Eine kürzere Pause zieht den Feierabend vor, ein Hinweis nennt es, wenn die Pause knapp werden könnte.

Eine positive Differenz heißt „zusätzlich gearbeitet“, eine negative „weniger als geplant“. Das sagt nichts über Bezahlung oder Ausgleich aus, und nichts davon wirkt aufs Spiel. Tage ohne Erfassung zählen im Wochenblick nicht als null, sondern gar nicht.

**Keine Pause erfasst, aber Start und Ende schon:** Anker zieht nichts ab und zeigt die Zeit so, wie sie erfasst ist. Mit einem Tipp lässt sich die übliche Pause nachtragen.

## Zeit

Echte Zeitpunkte sind UTC-ms, Dauern damit echte Zeit, auch über die Zeitumstellung. Eine Sitzung gehört **ganz zu dem Plantag, an dem sie begann** (Wechsel um 04:00) und wird nicht nach Kalendertagen aufgeteilt. Samstag 23:40 bis Sonntag 00:30 sind 50 Minuten am Samstag. Läuft eine Sitzung über 04:00 hinaus oder länger als 16 Stunden, fragt Anker nach. Beendet wird sie nie von selbst, denn das Ende kennst nur du.

## Einsätze

- **Geplant:** Wartung, Vor-Ort-Termin, Andere. Der Tag wird dadurch kein Arbeitstag und der Wochenstandard ändert sich nicht.
- **Spontan:** „Kundenproblem jetzt bearbeiten“, der Titel ist freiwillig.
- **Rufbereitschaft:** Zählt nie als Arbeitszeit und belegt den Tag nicht. Wie sie rechtlich einzuordnen ist, entscheidet Anker nicht. Läuft ein Einsatz, startest du ihn selbst.
- Vor einem geplanten Einsatz kommt eine Erinnerung, ohne Anlass und Ort im Text. Sie läuft über dieselben drei Plätze wie alles andere.

## Hinweise, abschaltbar

| Hinweis | Orientierung | Was Anker tut |
|---|---|---|
| Pause könnte knapp werden | [§ 4 ArbZG](https://www.gesetze-im-internet.de/arbzg/__4.html): über 6 h 30 min, über 9 h 45 min, Teilpausen ab 15 min | Nennt es, ändert nichts |
| Ruhezeit könnte knapp werden | [§ 5 ArbZG](https://www.gesetze-im-internet.de/arbzg/__5.html): 11 h, mit Ausnahmen | Nennt es. Ein fester Termin bleibt fest und wird als nicht auflösbar benannt |
| Sonntag | Sonn- und Feiertagsarbeit ist besonders geregelt | Bittet um Prüfung der betrieblichen Regelung |

Betriebliche und vertragliche Regeln kennt Anker nicht, Feiertage auch nicht. Schlafen oder Termine verschiebt Anker wegen dieser Hinweise nie.

## Was Anker nie tut

Nachrichten senden, Arbeitszeit aus Standort oder Wecker ableiten, Ist-Zeit erfinden, Lohn oder Zuschläge berechnen, wegen fehlender Stunden zum Nachholen auffordern, Weckzeit ohne deine Bestätigung ändern, deinen Wochenstandard wegen eines einzelnen Tages anpassen.

## Datenschutz

Ist-Zeiten, Einsätze, Kundennamen und Orte liegen in `LocalData`: kein Sync, nicht im Kalender, aber in der JSON-Sicherung. In Erinnerungen, im Widget und in der synchronisierten Änderungsliste eines Tages stehen sie nicht. Keine neue Berechtigung, kein neuer Dienst.
