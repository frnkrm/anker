# ADHS-Designprinzipien

Grundsatz: nicht den Menschen optimieren, sondern kognitive Last auslagern. Anker ist Alltagsassistenz, kein Medizinprodukt und keine Therapie.

**E04–E09 in Entwicklung.** Die zentrale Produktregel ist Selbstbestimmung: spontan entscheiden, Pläne ändern, Freizeit genießen und pausieren, ohne falsche Erledigt-Häkchen, Fortschrittsverlust oder Strafen. Technische Akzeptanztests und echte Geräteberichte werden getrennt geführt; beides ist kein therapeutischer Wirksamkeitsnachweis.

**Evidenzstufen**
- **Klinisch:** Allgemeine Empfehlung in Leitlinien, etwa [NICE NG87](https://www.nice.org.uk/guidance/ng87) und [AADPA](https://adhdguideline.aadpa.com.au/). Sie betrifft strukturierte Interventionen und Umweltanpassung, **nicht den Wirksamkeitsnachweis dieser App**.
- **Hypothese:** Plausibel abgeleitete Produktidee, ohne eigenen Wirksamkeitsnachweis.

Für Anker selbst gibt es **keine Wirksamkeitsstudie**. Alle Akzeptanztests prüfen Bedienung und Logik, nicht den gesundheitlichen Nutzen.

| Problem | Prinzip | Funktion | Evidenz | Akzeptanztest | Risiken |
|---|---|---|---|---|---|
| Entscheidungsblockade | Genau eine nächste Handlung | „Jetzt“, `nextAction()` | Klinisch (organisatorische Strategien), Umsetzung Hypothese | `support.test.ts`, E2E: höchstens 3 Handlungen | Falsche Priorität; Grundauswahl bleibt regelbasiert, Vorschläge sind ablehnbar |
| Nicht ins Tun kommen | Kleinster Schritt, sichtbare kurze Zeit | „Ich hänge fest“, Einfach anfangen | Hypothese | `stuckLadder`-Tests | Kann bevormundend wirken, ist daher freiwillig |
| Abschweifen, Vergessen | Gedanke parken, Kontext erhalten | Gedanken-Sheet „Du warst bei“ | Hypothese | E2E Gedanke und zurück | Inbox wächst, Abend-Durchsicht ist freiwillig |
| Unterbrechung | Wiedereinstieg speichern | „Ich wurde unterbrochen“, gemeinsamer Aufgaben-/Fokusstand | Hypothese | `tasks.test.ts`, Aufgaben-E2E | Kein starrer 8-Stunden-Verfall; referenzierte Aufgabe muss noch offen sein, Änderungen dürfen alte Antworten nicht überschreiben |
| Zeitblindheit | Feste Zeit dauerhaft sichtbar | Kopfzeile mit Balken, Erinnerungen | Klinisch (vorhersehbare Umgebung), Umsetzung Hypothese | `now.test.ts` | Druckgefühl, deshalb kein Rot |
| Aufstehen fällt schwer | Eigene Wahl statt Modell | Hauptwecker, optionaler Vorwecker | Hypothese | JUnit `AlarmModelTest` | Keine Weckgarantie, zweiter Wecker empfohlen |
| Medikation im Alltag | Nur Notizbuch, nichts ableiten | Einnahmeprotokoll, standardmäßig aus | Keine medizinische Aussage | `alarm.test.ts`, Wecker-Ende trägt nichts ein | Fehlinterpretation, deshalb keine Wirkungsanzeige und ärztlicher Verweis |
| Wenig Kapazität abends | Weniger Entscheidungen | Modi, Ankommen, Gericht aus eigener Liste | Hypothese | `support.test.ts` | Zu wenig Struktur, jederzeit umschaltbar |
| Verlorene Zeit | Ab jetzt planen, kein Stapel | „Tag neu sortieren“, keine Rückstände | Hypothese | Vitest: höchstens 3, kein Rückstandstext | Wichtiges fällt weg, harte Zeiten bleiben fest |
| Berufliches Risiko | Top-1, konkreter nächster Schritt | Arbeit, Fristen, Übergabe | Klinisch (organisatorische Strategien), Umsetzung Hypothese | Vitest und E2E | Vertrauliche Daten, daher lokal und ohne Inhalt in Meldungen |
| Meldungsflut | Wenige, relevante Hinweise | Drei Slots mit Rang | Hypothese | JUnit `ReminderModelTest` | Hinweis wird verdrängt, geplante gehen nicht verloren |
| Scham, Abbruch | Keine Strafen | Kein Rot, Spiel abschaltbar, Kapitel zählen echte Erfolgstage ohne Frist | Hypothese | Spielelogik und Nichtnutzungs-/Backup-E2E | Keine XP, Kapitel oder Abzeichen wegen Pausen entziehen; historisch erworbene Daten erhalten |
| Eingesperrt im Alarm | Immer ein Ausweg | Notfall-Stopp | Sicherheitsprinzip | Am Gerät offen | Umgehen möglich, wird bewusst akzeptiert |
| Fahren, Maschinen, Schlaf | Keine aggressive Unterbrechung | Arbeitsweg ohne Überlagerung, Ruhezeiten | Sicherheitsprinzip | `support.test.ts` | Anker weiß nicht, ob du gerade fährst |
| Zu großer nächster Schritt | Lokale Vorlagen zuerst, optional editierbare KI-Hilfe | „Kleine Schritte“, bewusst freigegebene Vorschau | Hypothese, keine Therapieempfehlung | Assistance-/Aufgaben-Tests; kontrollierte Browserantworten | Falscher KI-Inhalt, berufliche/private Daten und Kosten; aus, bis gewählt, keine automatische Übernahme oder Erledigung |
| Fehlende Orientierung unterwegs | Unbekanntes offenlassen | Gespeicherte lokale Orte, manuelle Wege, freiwillige Routes-Schätzung | Hypothese | Reise-/Routenlogik und Browserwege | Unzuverlässige Schätzungen; harte Termine bleiben fest, Weckeränderung braucht Bestätigung |
| Dinge vergessen | Erinnern ohne neue Pflicht | Terminbezogene Packliste, Vorlagen, „vorbereitet“ | Hypothese | Packlogik und Browserwege | Checkliste kann wachsen; editierbar, offline nutzbar, kein falscher Terminabschluss |
| Schreiben ist gerade schwer | Bewusstes lokales Diktieren | Bearbeitbarer Gedankenentwurf | Hypothese | Adapter-/Abbruchlogik; echter Android-Test offen | Mikrofonfreigabe, Fehltranskription; kein Cloud-Fallback, kein automatisches Speichern |
| Ankunft vergessen | Hinweis statt unsichtbarer Buchung | Optionaler besuchsgebundener Standorthinweis | Hypothese | Geofence-Logik; tatsächliche Registrierung/Erkennung am Gerät offen | Ungefähre/verspätete Ortung, eigene Standortrechte; Ankunft erst nach Ja, nie Arbeitszeit oder Einnahme ableiten |

**Messgröße:** weniger Tipps bis zur echten Handlung und gelungener Wiedereinstieg, nicht lange Nutzung.

KI, Verkehr, lokale Sprache und Standorthinweise sind sensible freiwillige Extras, die zunächst ausbleiben. Ihre Funktionsprüfungen beweisen keine Erleichterung im Alltag. Entscheidungen aus Alarmy, Sleep Cycle oder To-do-Apps werden nicht als klinische Evidenz behandelt; Anker misst insbesondere keine Schlafphasen und leitet aus Medikamenten keine Produktivität oder Weckzeit ab. [Anleitung](ANLEITUNG.md) und [optionale Dienste](OPTIONALE_DIENSTE.md) erklären die konkreten Freigaben und Grenzen.
