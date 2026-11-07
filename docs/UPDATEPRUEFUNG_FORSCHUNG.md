# Updateprüfung: Forschung und vorhandene Alltagshilfen

Stand: **07.11.2026**. Codevergleich gegen `424e041309e82ec82804f0e951fa817bcd0ada70` (1.3.0-rc.2/Code 9). Diese Prüfung ergänzt ausschließlich Dokumentation. Sie führt weder eine Therapie noch neue Erfassung persönlicher Befindlichkeiten ein.

## Evidenzstatus

Die vier im Ausgangsbericht genannten Primärquellen wurden am 07.11.2026 um etwa 13:20 UTC tatsächlich angefragt. Alle vier Abrufe scheiterten am angewendeten Cloud-Netzzugang mit `CONNECT 403 Forbidden`. Abstracts, Volltexte, Registereinträge und Studienprotokolle konnten deshalb **nicht erneut gelesen werden**. Die nachfolgende Tabelle inventarisiert die Ausgangsangaben; sie bestätigt weder Existenz und Veröffentlichungsdatum noch Kennzahlen oder Schlussfolgerungen der genannten Studien. Eine Quellenadresse allein ist kein Wirksamkeitsbeleg.

Die bereits vorbereitete Änderung der Netzkonfiguration ist erst nach tatsächlicher Anwendung und erfolgreichem neuem Abruf ein Quellenzugang. Dieser Bericht setzt eine Freigabe oder Wirksamkeit der Änderung nicht voraus. Keine Quelle wurde über einen alternativen Proxy beschafft.

## Studieninventar zur anschließenden Primärprüfung

Alle in dieser Tabelle genannten Studienmerkmale sind **ungeprüfte Ausgangsangaben**. Fehlende Angaben werden nicht ergänzt oder geraten.

| Quelle / berichtetes Datum | Berichtete Population und Intervention | Berichteter Vergleich / Nachbeobachtung | Grenzen und offene Primärprüfung |
|---|---|---|---|
| Deutschland, attexis; 11.03.2026; [PubMed 41810578](https://pubmed.ncbi.nlm.nih.gov/41810578/) | 337 Erwachsene mit ADHS; digitales CBT-/Achtsamkeitsprogramm zusätzlich zur üblichen Versorgung | Übliche Versorgung; Auswertung nach 3 Monaten, Nachbeobachtung bis 6 Monate | Kein gleich intensiver aktiver Psychotherapievergleich laut Ausgangsbericht. Randomisierung, Ein-/Ausschlüsse, Registrierung, fehlende Daten, Finanzierung und Endpunkte müssen im Original geprüft werden. Berichtete ASRS-Differenz und Effektstärke werden hier nicht als bestätigte Ergebnisse übernommen. Produktergebnisse wären auch nach Bestätigung kein Wirksamkeitsbeleg für Anker. |
| China; 09.05.2026; [BMC Psychiatry / DOI 10.1186/s12888-026-08130-w](https://link.springer.com/article/10.1186/s12888-026-08130-w) | 98 Erwachsene; 12 Wochen Gruppen-DBT | Gruppen-CBT; Nachbeobachtung bis 6 Monate | Berichtete Verbesserungen beider Gruppen begründen keine Überlegenheit. Formale Nichtunterlegenheit laut Ausgangsbericht nicht gezeigt; Nichtunterlegenheitsgrenze, Power, Auswertungsstrategie und Konfidenzintervalle im Original prüfen. Ein nicht signifikanter Unterschied belegt keine Gleichwertigkeit. |
| Japan; 31.08.2026; [Scientific Reports / DOI 10.1038/s41598-026-68665-6](https://www.nature.com/articles/s41598-026-68665-6) | Kleine CBT-Studie; 8-Jahres-Nachbeobachtung; 24 von ursprünglich 48 Teilnehmenden | Ursprüngliche Vergleichsarme im Ausgangsbericht nicht ausreichend beschrieben. Zusätzliches digitales Boosterangebot demnach freiwillig und nicht randomisiert | Hoher Ausfall, mögliche Selbstselektion und wenig präzise Ergebnisse. Ursprüngliches Design und Umgang mit Ausfällen offen. Eine Assoziation bei freiwilliger Boosterteilnahme wäre kein kausaler Booster-Effekt. |
| Schweden; [ISRCTN15774751](https://www.isrctn.com/ISRCTN15774751) | Berufstätige Erwachsene mit ADHS; internetbasiertes CBT-/Achtsamkeits-Stressmanagement | Vergleichsarm, Rekrutierungsstand, Registrierung und Ergebnisveröffentlichung nicht erneut geprüft; Datum im Ausgangsbericht nicht angegeben | Registrierung beschreibt ein Vorhaben. Ohne gelesene Ergebnisse entsteht daraus kein Wirksamkeitsnachweis. Vorab registrierte Endpunkte und spätere Publikationen gesondert abgleichen. |

Nach erfolgreichem Zugriff sind pro Quelle Titel, Autoren, genaue Population, Publikations-/Registerdatum, Randomisierung, Vergleichsbedingungen, primäre Endpunkte, absolute Ergebnisse mit Unsicherheit, Ausfälle, Interessenkonflikte und Korrekturen zu prüfen. Bei PubMed reicht ein gelesener Abstract nur für dessen ausdrücklich enthaltene Angaben; Detailbehauptungen benötigen den Volltext bzw. das Protokoll. Ergebnislose Registereinträge bleiben als solche markiert. Die Recherche ist keine systematische Übersicht aller Länder oder Sprachen.

CBT und DBT sind bestehende Behandlungsansätze. Die Ausgangsangaben betreffen zusätzliche Evidenz bzw. Anwendungsformen und begründen keine neu erfundene Therapie. Eine kurze Alltagshilfe in Anker ist nicht mit den untersuchten, längeren Programmen gleichzusetzen. Insbesondere wird **keine Werbung mit einer Effektstärke von 0,85 für Anker** abgeleitet.

## Überschneidungen im tatsächlich gelesenen Anker-Code

| Bereits vorhanden | Konkrete Stelle | Bedeutung für den Inhaltskandidaten |
|---|---|---|
| Freiwillig einmal ausatmen oder beide Füße auf den Boden stellen | `src/ui/components/Stuck.tsx`, `StuckSheet` | Der vorgeschlagene kurze Achtsamkeitseinstieg existiert bereits als freiwillige Alltagshilfe. |
| Eigene Aufgabe beibehalten; kleinerer Anfang, Pause, nochmal; bewusster Hilfetimerstart | `StuckSheet`; `src/core/support.ts`, `stuckLadder`; `src/core/focus.ts` | Übung und nächster kleiner Schritt brauchen keine zusätzliche Timer- oder Erledigungslogik. Ablauf der Hilfezeit ist kein Erledigungsnachweis. |
| „Hier warst du“, vorhandene Notiz, dort weitermachen oder kleinen Schritt wählen, Gedanken festhalten, „Heute anders“ | `src/ui/pages/Now.tsx`, `RecoverySheet` | Wiedereinstieg und selbst gewählte Anpassung sind schon im Hauptablauf erreichbar. |
| Unterstützungsmodus „Überlastet“: nur das Nötigste, Pausen erlaubt, Spiel ausgeblendet | `src/core/support.ts`, `modeHint`; `src/ui/components/Shell.tsx` | Kein zusätzlicher Modus und keine automatische Stimmungsdiagnose erforderlich. |
| Gültige offene Aufgabenreferenzen und Wiederaufnahme statt pauschalem Zeitverfall | `src/core/recovery.ts`, `usableResume` | Eine Auffrischung darf keine alten oder erledigten Aufgaben wiederbeleben. |

Dies sind statisch gelesene Produktfunktionen, keine neue klinische oder reale Geräteprüfung. Aus ihrer Existenz wird kein therapeutischer Nutzen behauptet.

## Freiwilliger Originalentwurf, nur zur Evaluation

**Entscheidung: zuerst die vorhandene Hilfe verständlicher machen und deren Bedienlast prüfen; keine neue Therapieseite.** Folgender selbst formulierter Entwurf dient einer späteren fachlichen und nutzerbezogenen Bewertung. Er wird in diesem Auftrag nicht ausgeliefert und übernimmt keine proprietären Behandlungstexte.

1. Optionaler Einstieg in der bestehenden Hilfe: „Was passt gerade: direkt klein anfangen oder kurz innehalten?“ Überspringen und Schließen bleiben jederzeit möglich. Kein klinischer Score, keine verpflichtende Benennung oder Speicherung von Gefühlen.
2. Auf eigenen Wunsch genau eine Auswahl: „Wenn du magst, spüre kurz beide Füße am Boden.“ Alternativ die schon vorhandene Ausatem-Anregung oder eine selbst gewählte Pause. Keine vorgeschriebene Atemdauer, keine Bewertung, kein Versprechen einer Wirkung.
3. Danach: „Welchen kleinen Schritt möchtest du jetzt wählen?“ Bestehende nächste Aktion anzeigen; „Etwas kleiner“, eigene Formulierung oder Pause zulassen. Nur eine vom Nutzer bestätigte echte Handlung kann Aufgabe/XP ändern; die Übung oder abgelaufene Zeit kann das nicht.
4. Eine Auffrischung bleibt ein gesonderter, freiwilliger Kandidat: nur nach eigener Zeitwahl, jederzeit abwählbar und ohne automatisches Wiederanschalten. Keine neue Erinnerung im Standardzustand; kein Nachholen, Erfolgsdruck oder Ableiten aus Health-Daten.

Evaluation zuerst mit kurzer Verständlichkeits-/Bedienprüfung im bestehenden Stuck-/Recovery-Weg: Wird ein kleiner Schritt schneller gefunden? Lässt sich ohne Datenverlust schließen? Wird „Pause“ als gleichberechtigte Wahl verstanden? Verdrängt die Auswahl die eigentliche Aufgabe oder erhöht sie die Zahl notwendiger Entscheidungen? Keine Symptomverbesserung aus Klicks, Timerzeiten oder freiwilligen Rückmeldungen ableiten. Falls zusätzlicher Text die Bedienlast erhöht, beim vorhandenen Angebot bleiben.

Ein klinisches Programm, Diagnose, Symptomscore oder gesundheitsbezogene Wirkbehauptung wäre ein eigener Auftrag mit fachlicher Prüfung. Weder Stimmung noch Medikamentenwirkung werden aus Schritten, Training, Schlaf- oder Mikrofonwerten abgeleitet.

## Ergebnis und Prüfgrenzen

| Vorhanden | Ergänzt | Bewusst zurückgestellt | Nicht verifiziert |
|---|---|---|---|
| Stuck, Recovery, Supportmodi, kleine Schritte und Pausen | Dieses Evidenzinventar, Überschneidungsprüfung und Originalentwurf zur Evaluation | Neue Seite, neues Therapieprogramm, klinische Scores, Auffrischungsfunktion | Alle vier aktuellen Forschungsquellen; klinischer Nutzen des Entwurfs; echte Gerätebedienung |

Keine App-, Modell-, Daten- oder Versionsänderung in diesem Dokumentauftrag. Prüfung: Quellstellen gelesen, tatsächliche HTTP-Fehler erfasst, Dokumentdiff geprüft. Lint, Build und Laufzeittests werden für diese reine Dokumentation nicht erneut als Nachweis ausgegeben. Die Integrationsprüfungen der separat implementierten Produktänderungen stehen im Abschlussbericht des Gesamtauftrags.
