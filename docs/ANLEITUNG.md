# Anker: Anleitung

Anker sagt dir, was jetzt dran ist. Du musst den Tag nicht selbst planen, sondern nur den nächsten Schritt machen.

**Stand 1.1.0-rc.1:** Der Android-Teil ist gebaut und seine Logik automatisch getestet, aber noch **nicht auf einem echten Handy geprüft**. Lass deshalb zusätzlich den Android-Wecker gestellt, bis du Anker selbst geprüft hast (Liste: [GERAETETEST.md](GERAETETEST.md)). Einschränkungen stehen [ganz unten](#bekannte-grenzen). Für die Einrichtung von APK, Supabase, Google und Netlify siehe [README](../README.md).

## Dein Tag mit Anker

| Wann | Was du tust |
|---|---|
| **Morgens** | Wecker klingelt, QR-Code im Bad scannen. Danach führt dich der Fokus-Modus durch die Morgenroutine. |
| **Vor dem Losgehen** | Anker zeigt die Restzeit. Zur Losgeh-Zeit tippst du **„Bin los“**. |
| **Arbeit** | Anker zeigt deine wichtigste Aufgabe. **„Ich wurde unterbrochen“** merkt den nächsten Schritt. Wird es später: **„Heute länger“** unter *Mehr*. |
| **Abends** | Erst Abendplan (Essen, Freunde, Sport), dann Abendroutine. |
| **Danach** | Freizeit, zocken erlaubt, bis zum PC-Stopp. |
| **PC-Stopp, Bett** | **„PC ist aus“**, später **„Ich liege im Bett“**. |

**Die Grundregeln:**
- Eine kleine Version zählt voll als erledigt.
- Ein schlechter Tag macht nichts. Nur nie zwei hintereinander.
- Krank? Oben rechts **„Krank“** wählen, dann gibt es nur das Nötigste und nichts geht verloren.

## Die fünf Bereiche

Unten ist die Navigation: **Jetzt · Tag · 💭 · Spiel · Mehr**

### Jetzt
- **Die eine Aktion**, groß, mit einem Hauptknopf und höchstens zwei weiteren. Darüber in einem Satz, warum das gerade dran ist, wenn es dafür einen echten Grund gibt.
- **Oben** die nächste feste Zeit mit dünnem Balken.
- **„Ich hänge fest“:** ein Bildschirm mit einem winzigen Schritt und 2-Minuten-Ring (Starten, Geschafft, Etwas kleiner, Pause).
- **„Mehr“** klappt Tageslinie, Fokus-Modus, Überspringen, Hinweise und „Tag neu sortieren“ auf.
- **Knopf oben rechts** (z. B. „Arbeitstag ▾“): Unterstützung, Tagesart, spontan Homeoffice, Abendplan.

**Was als Nächstes kommt, entscheidet eine feste Reihenfolge:** feste Zeiten und Termine, Arbeit mit naher Frist, wo du unterbrochen wurdest, heute Eingeplantes, Routine, dann Pause oder Freizeit. Auf dem Arbeitsweg unterbricht nichts.

### Heute anders

Ein Plan ist ein Angebot. Der Knopf **Heute anders** steht immer auf der Startseite, auch mitten in einer Routine. Für einen späteren Tag nimmst du unter **Tag** den Knopf **Morgen anders**.

| Weg | Was passiert |
|---|---|
| **Ich habe heute etwas anderes vor** | Text, Uhrzeit, optional Ende, Ort und Fahrzeit. Du siehst zuerst eine Vorschau. Anker plant Fertigmachen und Losgehen rückwärts, die Abendroutine kommt danach oder wartet auf dich. |
| **Diese Routine später** | In einer Stunde, zu einer Uhrzeit oder „Wenn ich zurück bin“. |
| **Heute nicht nötig** | Ein Schritt oder die ganze Routine. Das gilt nicht als erledigt und nicht als verfehlt, und dein Standard bleibt. |
| **Länger wach bleiben** | +30 Minuten, +1 Stunde, bis zu einer Uhrzeit oder „Weiß ich noch nicht“. Anker nennt sachlich die Schlafzeit, Erinnerungen bleiben still, der Wecker bleibt gestellt. |
| **Plan ab jetzt neu machen** | Rest des Tages in kleinen Versionen. |
| **Für morgen schon erledigt** | Etwa abends geduscht: Der Morgenschritt entfällt, gilt dort aber nicht als erledigt. Als feste Regel unter *Alltagshilfen*. |

**Zurück zum ursprünglichen Plan** steht unter *Heute anders*, sobald du etwas geändert hast. Wirklich Erledigtes bleibt erledigt.

Ein Tag, den du bewusst geändert hast, zählt im Spiel nie als verfehlt. XP gibt es nur für das, was du wirklich gemacht hast, abgezogen wird nichts.

**Beispiele:**
- **Film bei einer Freundin um 17 Uhr:** Heute anders → etwas anderes vor. Kein Heimweg, stattdessen Fertigmachen und Losgehen. Danach tippst du **Bin wieder da**, und Anker bietet höchstens die kurze Abendroutine an.
- **Kunde morgen um 9:** Tag → Morgen → Morgen anders → Termin, Art „Kunde“, Ort und deine Fahrzeit, „Statt ins Büro“. Anker rechnet die Abfahrt aus und schlägt eine Weckzeit vor. Der Wecker ändert sich erst, wenn du **Einmalig um … wecken** antippst.
- **Homeoffice:** Oben rechts „Arbeitstag ▾“ → Homeoffice. Dort kannst du einen Text kopieren, falls du jemandem Bescheid geben musst. Anker sendet nichts und weiß nicht, ob du Homeoffice machen darfst.

**Unterwegs:** Die Startseite zeigt der Reihe nach Fertigmachen, **Bin los**, **Ich bin angekommen**, **Bin wieder da**. **Route öffnen** startet Google Maps. Die Fahrzeit bleibt deine Schätzung, Maps meldet Anker nichts zurück.

### Unterstützung wählen

Oben rechts, gilt für heute, jederzeit änderbar. Es ist deine Wahl, Anker leitet sie nie aus Uhrzeit oder Medikamenten ab.

| Modus | Was passiert |
|---|---|
| **Einfach anfangen** | Hauptknopf „2 Minuten anfangen“ |
| **Wenig Energie** | Routinen sofort in kleinen Versionen |
| **Überlastet** | Nur Zähne und Gesicht, keine zusätzlichen Aufgaben, Spiel ausgeblendet |
| **Auf Kurs** | Nur noch wichtige Erinnerungen |

Feste Zeiten ändern sich in keinem Modus.

### Arbeit

*Mehr → Arbeit.* Ein Titel genügt, oben steht die wichtigste Aufgabe, höchstens zwei weitere sind sichtbar. Unter *Details* gehen nächster Schritt, Schätzung und Frist. Vor einer Frist erinnert Anker am Vortag und eine Stunde vorher, ohne den Inhalt zu nennen. Abends notierst du in der Übergabe, wo du morgen weitermachst. **Arbeitsaufgaben bleiben auf dem Gerät** und werden nicht synchronisiert. Anker sendet nichts an Kollegen oder Vorgesetzte.

### Tag
Der Ablauf für heute, morgen und übermorgen, dazu die heutigen Kernziele mit Häkchen.

### 💭 Gedanken
Von fast überall in einer Zeile festhalten. Danach zeigt Anker „Du warst bei: …“ und einen Knopf **Weiter**. Der Gedanke bleibt erst mal geparkt. Abends gehst du sie unter **Mehr → Gedanken** durch: **Behalten**, **Morgen erledigen**, **Arbeit** oder **Löschen**.

**„Morgen erledigen“** erscheint am nächsten Tag unter **Tag** als flexible Aufgabe und nach Feierabend auf der Startseite. Es bleibt verschiebbar und wird nie zum festen Termin. Erledigt ist überall erledigt, unter *Gedanken* kannst du es zurücknehmen.

### Spiel
Level, Kapitel, Stufe, Belohnungen, Heatmap, Abzeichen und Erfolge.

### Mehr
Alles andere, siehe [Was Anker alles kann](#was-anker-alles-kann).

## So funktioniert das Spiel

**XP** (je nach Thema z. B. „Seemeilen“ oder „Kraft“):

| Wofür | XP |
|---|---|
| Schritt erledigt | 10 |
| Kleine Version | 6 |
| Pünktlich aufgestanden, pünktlich los, PC-Stopp eingehalten, rechtzeitig im Bett | je 25 |
| Aufräum-Timer | 15 |
| Tag geschafft | 50 |
| Erfolg freigeschaltet | 50 |
| Kapitel abgeschlossen | 100 pro angefangene Woche |

**Ein Tag gilt als geschafft**, wenn alle Kernziele erfüllt sind:

| Stufe | Kernziele |
|---|---|
| **1** | Aufstehzeit (±15 min, frei ±60 min), pünktlich los (nur an Tagen mit Arbeitsweg), Abendroutine vor dem Zocken, PC-Stopp |
| **2** | zusätzlich Bewegung am Morgen |
| **3** | zusätzlich Sport an Sporttagen, Vorkochen am Vorkoch-Tag, Aufräumen |

**Kapitel** dauern 7, 14, 30 und 66 Tage.
- Ein verpasster Tag unterbricht nichts.
- Der zweite in Folge wird einmal pro Kapitel automatisch vom **Joker** aufgefangen.
- Danach startet ein neuer Anlauf für dasselbe Kapitel. Deine XP bleiben.
- Krankheitstage zählen weder dafür noch dagegen.

**Stufen:** Nach einem geschafften Kapitel bietet Anker die nächste Stufe an, Stufe 2 ab Woche 3 und Stufe 3 ab Woche 5. Du kannst sie ablehnen oder jederzeit von Hand ändern.

**Themen:** Seefahrt, Piraten-Abenteuer, Weltraum-Saga, Kampfkunst-Saga, Schlicht. Wechseln unter *Mehr → Einstellungen → Darstellung & Thema*.

## Sport abhaken

An Sporttagen gibt es drei Wege:

| Weg | Wann |
|---|---|
| **Morgenroutine** | Training zu Hause oder Laufen am Morgen: Der Trainings-Schritt zählt, auch als kleine Version. |
| **Knopf „Erledigt“** | Unter **Tag**. Bei Fitnessstudio oder Sport nach der Arbeit steht er auch auf der Startseite, bis du ihn antippst. Tippst du ihn unter **Tag** noch einmal an, wird das Häkchen zurückgenommen. |
| **Health Connect** | Automatisch, wenn dort ein Training ab 8 Minuten für den Tag steht. |

## Erinnerungen

Unter *Einstellungen → Erinnerungen* wählst du die Stärke:

| Stärke | Verhalten |
|---|---|
| **Sanft** | Einmal |
| **Normal** | Einmal, nach 5 Minuten noch einmal |
| **Hartnäckig** | Zusätzlich ein drittes Mal auf dem Wecker-Kanal |

Wichtige Erinnerungen haben die Knöpfe **Erledigt**, **5 Min später** (höchstens 2×) und **Heute nicht**. Sie wirken auch bei geschlossener App. In den Ruhezeiten kommen nur die festen Zeiten: Losgehen, PC-Stopp, Bett.

**Höchstens drei** Anker-Meldungen stehen gleichzeitig in der Leiste: eine zur laufenden Aufgabe, eine zur nächsten festen Zeit, eine für den Rest. Eine Kleinigkeit verdrängt nie einen festen Termin. Klingelt der Wecker, bleibt der dritte Platz frei. Erledigtes verschwindet von selbst, nach 90 Minuten auch Unbeantwortetes.

Anker plant **zwei Wochen voraus**, auch wenn du die App nicht öffnest. Kurz vor Ende kommt ein einzelner Hinweis, die App einmal zu öffnen. War das Handy lange aus, kommen keine alten Meldungen nach.

## Der Wecker

1. *Mehr → Wecker & QR-Code → Drucken*, den Code im Bad aufhängen.
2. **„Wecker testen“** antippen und das Handy sperren. Danach fragt Anker, ob du ihn gehört hast. Dein echter Wecker bleibt dabei gestellt.
3. Morgens: Handy entsperren, **QR-Code scannen**.

- **Schlummern:** einmal für 5 Minuten.
- **Anderen Weg wählen:** Rechenaufgaben (3, 5 oder 8) oder **Notfall-Stopp**: 10 Sekunden warten, einmal tippen. Kein Lesen, Rechnen oder Kamera nötig.
- **Nach 30 Minuten** verstummt der Wecker von selbst. Der nächste Morgen ist dann schon geplant.
- **Neuer Code:** Danach gilt der alte Ausdruck nicht mehr, also neu drucken.

Der Wecker plant sich selbst weiter, auch wenn die App zu ist. Er klingelt jeden Tag zur gleichen Zeit, auch am Wochenende und im Urlaub. An Tagen, die du als krank markierst, pausiert er, danach klingelt er wieder. War das Handy zur Weckzeit aus, klingelt er beim Einschalten noch, wenn seitdem höchstens 30 Minuten vergangen sind.

**Optional, alle aus, bis du sie einschaltest:**
- **Vorwecker:** früher und sanfter, Minuten frei wählbar. Der Hauptwecker klingelt immer, egal was du damit machst.
- **Wachheits-Check:** einmal kurz nachfragen, keine Wiederholung.
- **Privates Einnahmeprotokoll:** nur ein Notizbuch. „Einnahme bestätigt“, „Noch nicht“, „Unsicher“ sind getrennte Knöpfe. Das Beenden eines Weckers trägt nie etwas ein. Es bleibt auf dem Gerät, sagt dir nie, was du wann nehmen sollst, und zeigt keine Wirkung an. Das klärst du mit deiner Ärztin oder deinem Arzt.

**So steht dein Wecker** (unter *Wecker* und im *Einrichtungs-Check*) zeigt, was Android tatsächlich meldet: nächster Wecker, letzter Test, Lautstärke, Bluetooth, Rechte, jeweils mit dem Weg in die richtige Einstellung. Anker ändert von sich aus weder Lautstärke noch „Nicht stören“, und die Lautstärketasten funktionieren normal.

## PC-Stopp

Unter *Mehr → PC-Stopp* lädst du das Windows-Paket. Entpacken, dann Rechtsklick auf `install.ps1` → **„Mit PowerShell ausführen“**.

- Warnung etwa 15 und 5 Minuten vorher. Zur Stopp-Zeit kommt eine weitere Meldung, etwa 5 Minuten später fährt der PC ohne Zwang herunter. Programme mit ungespeicherter Arbeit können das aufhalten. **Speichere trotzdem rechtzeitig**, nicht jedes Programm fragt nach.
- Bis 6 Stunden nach der Stopp-Zeit versucht er es auch nach einem Neustart wieder.
- **Verlängerung:** einmal pro Abend um 15 Minuten. Beim PC kommt sie nur an, wenn Sync eingerichtet ist und du angemeldet bist.
- **Ohne Sync** gilt die feste Zeit, die beim Herunterladen eingestellt war. Änderst du sie später, lade das Paket neu und installiere es erneut.
- **Für heute aussetzen:** `pc-stop-abbrechen.ps1` mit PowerShell ausführen. Entfernen mit `uninstall.ps1`. Pakete von vor 1.1.0 fahren noch erzwungen herunter, also bitte neu herunterladen und installieren.

## Was Anker alles kann

| Bereich | Funktionen |
|---|---|
| **Tagesplan** | Rückwärts vom Arbeitsbeginn, kürzt Routinen bei Zeitnot, meldet Konflikte, plant bei Überstunden den Abend neu |
| **Tagesarten** | Arbeit, frei, Urlaub, krank, spontan Homeoffice |
| **Routinen** | Frei editierbar, Reihenfolge per Ziehen, Dauer und kleine Version pro Schritt |
| **Sport** | Tage, Art und Zeitpunkt wählbar, Taschen-Erinnerung am Vorabend, Abhaken von Hand oder automatisch über Health Connect |
| **Essen** | Eigene Gerichte, Vorschlag per Zufall, Vorkoch-Tag |
| **Aufräumen** | 10-Minuten-Timer, täglich wechselnde Zonen |
| **Vorbereitung** | Eigene Checkliste für den Abend |
| **Wochenrückblick** | 3 Fragen, die Änderung landet als Vorschlag in den Einstellungen |
| **Belohnungen** | Eigene Belohnungen gegen XP einlösen |
| **Widget** | Nächste Aktion, nächste feste Zeit, Knopf für Gedanken |
| **Druckansicht** | Morgen, Abend, beide, QR-Code oder Haustür, A5 oder A4, auf Android auch „Als PDF speichern“ im Systemdialog |
| **Alltagshilfen** | Fokus-Puls, Abendmodus-Vorschlag, Ankommen nach der Arbeit, Spiel ausblenden (alles in den Einstellungen) |
| **Kalender** | Google-Termine im Tagesplan, Routinen in eigenen Kalender schreiben, `.ics`-Export |
| **Daten** | Läuft offline und ohne Konto, Sicherung als JSON, optionaler Sync |
| **Anzeige** | Dunkel oder hell, Schriftgröße 80–160 % |
| **Hilfe** | Wege zur ADHS-Diagnose, kostenlose Schuldnerberatung |

### Handy oder PC?

| Funktion | Android | Web-Version |
|---|---|---|
| Plan, Routinen, Spiel, Gedanken, Einstellungen | ✓ | ✓ |
| Sicherung, Druckansicht, PC-Stopp-Paket | ✓ | ✓ |
| Erinnerungen | ✓ | – |
| Wecker, QR-Scan, Widget, Health Connect | ✓ | – |
| Gemeinsame Daten auf beiden Geräten | nur mit Sync | nur mit Sync |

Ohne Sync hat jedes Gerät seine eigenen Daten.

## Deine Standardwerte

Alles änderbar unter *Mehr → Einstellungen*.

| Einstellung | Wert |
|---|---|
| Arbeit | Mo–Fr 8:00–17:00 |
| Arbeitsweg | 35 min Auto + 10 min Puffer |
| Aufstehen / Losgehen | 06:10 / 07:15 |
| PC-Stopp / Bett | 21:25 / 21:55 |
| Sport | Mo, Mi, Fr morgens, 20 min zu Hause |
| Abende | Mo, Mi, So kochen · Fr Freunde · sonst frei |
| Vorkoch-Tag | Sonntag |
| Erinnerungen | Normal, Ruhezeit 23:30–05:00 |

Wenn dir die Zeiten zu früh sind, verschiebe sie in kleinen Schritten unter *Einstellungen → Schlaf & Anker*.

Änderst du Arbeit, Arbeitsweg, Schlafwerte, Sport oder die Morgenroutine, rechnet Anker Aufstehen, PC-Stopp und Bett neu. **Von Hand gesetzte Zeiten bleiben dabei stehen** und sind als „Von dir gesetzt“ markiert. Erst „Vorschlag übernehmen“ hebt das auf.

## Bekannte Grenzen

- **Kein Handy-Test bisher:** Wecker, Benachrichtigungen, Sperrbildschirm und Druckdialog sind nicht auf einem echten Gerät geprüft. Anker kann nicht garantieren, dass ein Wecker klingelt.
- **Handy aus oder Neustart:** Vor dem ersten Entsperren nach einem Neustart kann die App nicht öffnen. Der Wecker soll trotzdem klingeln, und in der Meldung steht ein Knopf „Beenden“.
- **Andere Zeitzone:** Anker rechnet immer in deutscher Zeit, auch auf Reisen.
- **Kranktage und Änderungen** erreichen den Wecker erst, wenn die App sie gespeichert hat. Der Plan der nächsten zwei Wochen ändert sich nicht, solange die App zu ist.
- **Fokus-Puls** läuft nur, solange der Fokus-Modus offen ist.
- **Sync:** Arbeitsaufgaben und Einnahmeprotokoll bleiben auf dem Gerät. Tagesdaten wie Routinen, Gedanken und der gewählte Modus werden mitsynchronisiert, wenn du Sync eingerichtet hast.
- **Sprache:** Gedanken lassen sich nur tippen, Spracheingabe gibt es nicht.
- **Keine Live-Verkehrsdaten und keine Ankunftserkennung:** Fahrzeiten sind deine Schätzungen, „Angekommen“ tippst du selbst.
- **Termine und Orte** bleiben auf dem Gerät und erscheinen deshalb nicht auf anderen Geräten. Orte lassen sich noch nicht als feste Liste speichern, du gibst sie pro Termin ein.
- **Wetter** ist aus, bis du es unter *Einstellungen → Alltagshilfen* mit einem Ort einschaltest. Es kommt von Open-Meteo, übertragen wird nur dieser Ort. Eine Vorhersage kann danebenliegen.
- **Hartnäckig** bedeutet 3 Erinnerungen, nicht Dauerklingeln bis zur Bestätigung.
- **Google-Anmeldung:** Sie gilt auf Handy und im Browser etwa eine Stunde. Danach bleiben die zuletzt geladenen Termine stehen, bis du dich unter *Kalender & Sync* neu verbindest.
- **Fitnessstudio morgens** passt bei 8:00 Arbeitsbeginn rechnerisch nicht. Anker schlägt dann Training zu Hause vor.

## Gleitzeit und Einsätze

**Einstellen:** *Mehr → Einstellungen → Arbeit*. Dort stehen dein spätester Beginn und für jeden Wochentag Wunsch-Beginn, Soll netto und übliche Pause. Dein Freitag ist einfach der Eintrag „Freitag“.

**Im Alltag** erscheint zur passenden Zeit auf der Startseite ein kleiner Bereich:

- **Arbeit starten**, **Pause starten**, **Feierabend**. Alles freiwillig, ohne Erfassung rechnet Anker mit dem Plan.
- **Längere Pause:** Beim Beenden rückt der Feierabend von selbst mit. Ohne Timer: *Heute anders → Arbeit heute anders → Pause heute*.
- **Früher Schluss:** *Feierabend* tippen, oder *Heute anders → Arbeit heute anders → Heute früher Schluss*.
- **Länger:** Weiterarbeiten genügt. Nach dem Feierabend: *Noch etwas arbeiten*.
- **Später anfangen:** *Heute anders → Arbeit heute anders*. Liegt die Zeit nach deiner Grenze, sagt Anker das und bietet eine Nachricht zum Kopieren an.

**Einsatz am Wochenende:** *Mehr → Arbeitszeit & Einsätze*. *Kundenproblem jetzt bearbeiten* startet sofort, *Einplanen* legt einen Einsatz für später an. Zur Zeit steht er auf der Startseite, mit *Einsatz starten* und *Einsatz beenden*. Der Tag bleibt ein freier Tag.

**Nachtragen:** Unter *Arbeitszeit & Einsätze* trägst du Von, Bis und Pause von Hand ein oder korrigierst sie. Details: [GLEITZEIT.md](GLEITZEIT.md).

Anker ist deine Planungshilfe, keine offizielle Zeiterfassung. Bezahlung und Ausgleich regelt dein Arbeitgeber.
