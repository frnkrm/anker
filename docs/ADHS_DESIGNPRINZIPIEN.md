# ADHS-Designprinzipien

Grundsatz: nicht den Menschen optimieren, sondern kognitive Last auslagern. Anker ist Alltagsassistenz, kein Medizinprodukt und keine Therapie.

**Evidenzstufen**
- **Klinisch:** Allgemeine Empfehlung in Leitlinien oder Reviews (NICE NG87, AADPA, siehe Auftrag Abschnitt 9). Sie gilt für strukturierte Interventionen und Umweltanpassung, **nicht für diese App**.
- **Hypothese:** Plausibel abgeleitete Produktidee, ohne eigenen Wirksamkeitsnachweis.

Für Anker selbst gibt es **keine Wirksamkeitsstudie**. Alle Akzeptanztests prüfen Bedienung und Logik, nicht den gesundheitlichen Nutzen.

| Problem | Prinzip | Funktion | Evidenz | Akzeptanztest | Risiken |
|---|---|---|---|---|---|
| Entscheidungsblockade | Genau eine nächste Handlung | „Jetzt“, `nextAction()` | Klinisch (organisatorische Strategien), Umsetzung Hypothese | `support.test.ts`, E2E: höchstens 3 Handlungen | Falsche Priorität, deshalb Regeln statt KI und alles überspringbar |
| Nicht ins Tun kommen | Kleinster Schritt, sichtbare kurze Zeit | „Ich hänge fest“, Einfach anfangen | Hypothese | `stuckLadder`-Tests | Kann bevormundend wirken, ist daher freiwillig |
| Abschweifen, Vergessen | Gedanke parken, Kontext erhalten | Gedanken-Sheet „Du warst bei“ | Hypothese | E2E Gedanke und zurück | Inbox wächst, Abend-Durchsicht ist freiwillig |
| Unterbrechung | Wiedereinstieg speichern | „Ich wurde unterbrochen“, `ResumePoint` | Hypothese | Vitest und E2E | Veralteter Stand, verfällt nach 8 Stunden |
| Zeitblindheit | Feste Zeit dauerhaft sichtbar | Kopfzeile mit Balken, Erinnerungen | Klinisch (vorhersehbare Umgebung), Umsetzung Hypothese | `now.test.ts` | Druckgefühl, deshalb kein Rot |
| Aufstehen fällt schwer | Eigene Wahl statt Modell | Hauptwecker, optionaler Vorwecker | Hypothese | JUnit `AlarmModelTest` | Keine Weckgarantie, zweiter Wecker empfohlen |
| Medikation im Alltag | Nur Notizbuch, nichts ableiten | Einnahmeprotokoll, standardmäßig aus | Keine medizinische Aussage | `alarm.test.ts`, Wecker-Ende trägt nichts ein | Fehlinterpretation, deshalb keine Wirkungsanzeige und ärztlicher Verweis |
| Wenig Kapazität abends | Weniger Entscheidungen | Modi, Ankommen, Gericht aus eigener Liste | Hypothese | `support.test.ts` | Zu wenig Struktur, jederzeit umschaltbar |
| Verlorene Zeit | Ab jetzt planen, kein Stapel | „Tag neu sortieren“, keine Rückstände | Hypothese | Vitest: höchstens 3, kein Rückstandstext | Wichtiges fällt weg, harte Zeiten bleiben fest |
| Berufliches Risiko | Top-1, konkreter nächster Schritt | Arbeit, Fristen, Übergabe | Klinisch (organisatorische Strategien), Umsetzung Hypothese | Vitest und E2E | Vertrauliche Daten, daher lokal und ohne Inhalt in Meldungen |
| Meldungsflut | Wenige, relevante Hinweise | Drei Slots mit Rang | Hypothese | JUnit `ReminderModelTest` | Hinweis wird verdrängt, geplante gehen nicht verloren |
| Scham, Abbruch | Keine Strafen | Kein Rot, Spiel abschaltbar | Hypothese | Vitest und E2E auf Texte | Weniger Anreiz für manche |
| Eingesperrt im Alarm | Immer ein Ausweg | Notfall-Stopp | Sicherheitsprinzip | Am Gerät offen | Umgehen möglich, wird bewusst akzeptiert |
| Fahren, Maschinen, Schlaf | Keine aggressive Unterbrechung | Arbeitsweg ohne Überlagerung, Ruhezeiten | Sicherheitsprinzip | `support.test.ts` | Anker weiß nicht, ob du gerade fährst |

**Messgröße:** weniger Tipps bis zur echten Handlung und gelungener Wiedereinstieg, nicht lange Nutzung.
