# Prüfung und nächste Auswahl

Stand: 05.11.2026. Ausgangspunkt: `38da41ef78a68f3d5d9ea25e73e1d4cf946b9d36`.
Die Prüfung richtet sich besonders auf die offenen und teilweise bestätigten Punkte in [GERAETETEST.md](GERAETETEST.md). Deren Ergebnisse wurden nicht geändert.

## Ziel und bestätigte Entscheidungen

Produktziel: abendliche Bedienlast reduzieren und zuerst vorhandene Funktionen vereinfachen.

Freigegeben und umgesetzt:
- Lokales „Jetzt → Mehr“ heißt „Plan & Optionen“; „Mehr“ in der Hauptnavigation bleibt.
- „Schlaf & Anker“ und „Abendpläne“ aus „Dein Tag“, „Abendroutine“ aus „Routinen“ sowie „Abendmodus“ aus „Alltagshilfen“ stehen gemeinsam unter „Einstellungen → Abend & Schlaf“. Vorhandene Einstellungen und Daten bleiben erhalten.
- Die Abschlussmeldung der Abendroutine berücksichtigt PC-Stopp, Bettzeit und ein offenes Abendende.
- Optionaler Schalter unter „Einstellungen → Arbeit & Gleitzeit → Nach Feierabend“: Arbeitsaufgaben verdrängen nach Feierabend keine Abendroutine mehr auf der Startseite. Standard ist aus. Laufende Arbeit, private Aufgaben und feste Termine bleiben bedienbar. Fristbenachrichtigungen werden dadurch nicht abgeschaltet.

## Behobene Fehler

| Bereich | Konkreter Fehler und Korrektur | Nachweis |
|---|---|---|
| Vor-/Hauptwecker | Eine veraltete Vorwecker-Stoppaktion ließ das Modell weiter klingeln, stoppte aber den Tondienst. Dienst und Sperrbildschirm folgen jetzt dem tatsächlich noch klingelnden Zustand; verzögerte Stopp-Intents prüfen erneut. | Kotlin/JUnit; Gerätetest 6 bleibt erforderlich. |
| Timeout/Uhrzeit | Nach großem Uhrzeitsprung konnte der Zustand beendet sein, während der Dienst weiter Ton ausgab. Beides wird gemeinsam beendet. | Reine Zustandslogik getestet; Android-Integration und Gerätetest 13 offen. |
| Gesperrter Neustart | Gesperrter Start und späteres Entsperren konnten einen bereits nachgeholten Wecker erneut zurücksetzen. Der Android-Startzähler unterscheidet einen echten Neustart von dessen zweitem Signal. | Kotlin/JUnit; Gerätetests 10–11 offen. |
| Verschobene Erinnerung | „5 Min später“ blieb nach Erledigen oder Entfernen der Aufgabe noch in der Warteschlange. Nur weiterhin relevante Erinnerungen bleiben erhalten. | Kotlin/JUnit; Ergänzung für Gerätetest 23 unten. |
| Zeitumstellung | Kotlin und TypeScript wählten in der doppelten Herbststunde unterschiedliche 02:30-Uhr-Zeitpunkte. Beide wählen jetzt das zweite Vorkommen. | Kotlin- und TypeScript-Regression. |
| Arbeitszeit/Daten | Ein Hintergrundladen konnte einen gerade gestarteten Arbeitsvorgang aus dem Store verdrängen; konkurrierende Schreibvorgänge konnten spätere Änderungen überschreiben. Schreibreihenfolge und Laden sind abgesichert. | Store-Tests für verzögerte Lese-/Schreibvorgänge, Doppeltippen und Spieleinlösung. |
| Sicherung | Beschädigte Einstellungen konnten importiert werden und den nächsten Start verhindern. Ungültige Einstellungen werden vor dem Schreiben abgewiesen; unterstützte ältere Teilstände werden ergänzt. | Import-/Neustarttests; gültige ältere Sicherung bleibt unterstützt. |
| Sicherung/Sync | Wiederhergestellte neuere Daten wurden als bereits synchronisiert markiert. Importierte Änderungen bleiben jetzt für den nächsten Sync vorgemerkt; Remote-Abrufe bleiben sauber. | Repository-/Store-Regression. |
| Sync-Seiten | Ein Abruf endete nach 1000 Einträgen; gleicher Server-Zeitstempel machte weitere Einträge unerreichbar. Stabile Seitengrenzen und ein wiederholbarer Abruf übernehmen alle Seiten. | Mehr als 2000 Datensätze, Zeitstempelgleichstand, Sonderzeichen, Fehler/Retry; kein Live-Supabase-Test. |
| Morgenplanung | Homeoffice verwendete pauschal fünf Minuten statt der eingestellten Rechnerstart-Zeit. Weckvorschläge vergaßen teilweise volle Routinen oder Fitnessstudio/Fahrt. | Vier Schlaf-/Morgenplanungsregressionen. |
| Aufräumtimer | Hintergrunddrosselung verlängerte den Timer; Wiederöffnen setzte ihn zurück. Er rechnet jetzt ab gespeichertem Startzeitpunkt. | Browserprüfung mit Uhrzeitsprung, Routenwechsel und Neuladen. |
| Abendabschluss | Nach PC-Stopp/Bettzeit bzw. bei offenem Abendende wurde weiterhin Freizeit bis zu einer unpassenden Uhrzeit angeboten. | Browserprüfungen an den Zeitgrenzen und mit offenem Ende. |

## Geräteprüfung: priorisierte offene Nachweise

Automatische Logiktests bestätigen weder Tonausgabe noch Ausführung im Android-Hintergrund.

1. **6 und 37:** Vorwecker läuft → Hauptwecker übernimmt → alte Vorwecker-Seite beenden; Hauptwecker muss weiter hörbar sein. Während des Klingelns einen Termin speichern.
2. **10 und 11:** Gesperrter Neustart, verspätetes Einschalten innerhalb der Schonfrist und danach Entsperren; kein Verlust und kein zweites Klingeln.
3. **4–5:** Schlummern/Timeout und danach tatsächlich den nächsten Morgen abwarten. Die bisherigen Meldungen bestätigen diese Folgetage nicht.
4. **13 und 20:** Uhrzeit/Zeitzone ändern sowie App während des Klingelns schließen/erneut öffnen.
5. **23, 24–26:** Verschobene Erinnerung anschließend in der App erledigen bzw. Termin entfernen; nach fünf Minuten keine überholte Meldung. Mehrere Tage ohne App, Neustart und Update separat prüfen.
6. **35–36:** Einmalige Weckzeit anwenden, tatsächlich abwarten, anschließend Rückkehr zum Standard prüfen.
7. **41–42, 44, 46:** Homeoffice ohne Losgeh-Meldung, Arbeitszeit nach App-Schließen, schneller Doppeltipp, laufende Arbeit nach Update.
8. **7, 9, 12 und 21:** Kein falscher Einnahmeeintrag, Klingeln nach Wegwischen ausdrücklich bestätigen, Update-Wecker und maximale Meldungsanzahl.

Gerät laut Nutzerangabe vom 05.11.2026: Samsung Galaxy S26 Ultra. Android und One UI sind laut Nutzer auf dem neuesten Stand; genaue Versionsnummern sind noch nicht dokumentiert. Das Modell wurde im Testdokument ergänzt. Bestehende bestätigte Ergebnisse bleiben unverändert.

## Automatische Abschlussprüfung

- Lint und Typecheck bestanden.
- 303 TypeScript-Tests in 16 Testdateien bestanden.
- Produktionsbuild sowie alle 15 Browserprüfungen bestanden, darunter vier neue Fälle für Abendabschluss, Einstellungsgruppen/Opt-in und Aufräumtimer.
- Mobile Navigation und Einstellungen bei 390 Pixel Breite visuell geprüft.
- 34 reine Kotlin/JUnit-Tests bestanden. Acht neue Fälle sichern die Wecker-/Erinnerungskorrekturen ab.
- Ein bestehender Browserselektor wurde auf die Liste „Tageslinie“ eingegrenzt: „Abendroutine“ kann zusätzlich als Spielziel erscheinen und darf dort nicht als zweiter Zeitblock gezählt werden. Die erwartete Anzahl der Zeitblöcke bleibt unverändert.
- Android-Kompilierung in isolierter Buildkopie gegen SDK 36 erfolgreich: `:app:compileDebugKotlin` und `:app:testDebugUnitTest`. Alle 35 Android/JUnit-Tests bestanden (34 Wecker-/Erinnerungstests und ein vorhandener Java-Beispieltest). Die kompilierten Kotlin-Dateien stimmen bytegenau mit dem aktuellen Checkout überein; Controller, Dienste, Receiver und Plugin sind damit ebenfalls kompiliert. Kein APK, Emulator oder Gerätetest wurde ausgeführt.
- Die Schlussprüfung enthält zusätzlich die Fälle „Sync-Fehler nach exakt 1000 Einträgen“ und „entfernter plus lokaler Inbox-Eintrag während Hintergrundladen“. Ein fehlgeschlagener Seitenabruf übernimmt jetzt keine halbfertigen Daten; ein durch lokale Eingaben überholener Lesevorgang wird wiederholt.

Die geschützten Geräteergebnisse, Paketversionen und Lockdatei blieben unverändert. Es wurde kein Release veröffentlicht.

## Weitere gefundene Punkte, noch nicht geändert

- Einige Kopieraktionen melden „Kopiert“, obwohl die Zwischenablage abgewiesen wurde: Now, WorkControls, Work und Static. Nächste Korrektur: Erfolg erst nach erfolgreichem Kopieren melden und einen echten Fehler anzeigen.
- Dialoge sollten den Tastaturfokus im Dialog halten und nach Schließen zurückgeben. Manche Unterseiten von „Heute anders“ brauchen einen eindeutigen Dialognamen.
- „Routine fertig“ kann auch bei ausschließlich übersprungenen Schritten erscheinen. Der gespeicherte Spielstatus unterscheidet das, der Text sollte es ebenfalls tun.
- Online-Sync wurde gegen Testdoubles geprüft. Eine reale Supabase-Instanz ist nicht konfiguriert. Der Zeitstempel-Cursor bietet keine transaktionsübergreifende Momentaufnahme bei beliebig langen parallelen Servertransaktionen.

## Recherche: aktueller Zugriff und nächste Quellen

Live-Abrufe von NICE, Alarmy, Todoist und Tiimo wurden mit HTTP-Proxyfehler 403 abgewiesen. Deshalb enthält dieser Bericht keine Behauptung über aktuell überprüfte Leitlinien oder Konkurrenzfunktionen.

Der gespeicherte Netzwerkentwurf ergänzt ausschließlich:
`www.nice.org.uk`, `www.nimh.nih.gov`, `www.nhs.uk`, `alar.my`, `www.todoist.com`, `www.tiimoapp.com`, `structured.app`.
Die Änderung muss in den Umgebungseinstellungen angewendet werden; der Entwurf verlangt anschließend Veröffentlichung. Erst danach Zugriff erneut prüfen.

Geplante Primärquellen:
- [NICE NG87: Empfehlungen zu ADHS](https://www.nice.org.uk/guidance/ng87/chapter/Recommendations): erwachsenenspezifische psychologische Unterstützung, Organisation und Grenzen der App-Unterstützung.
- [NIMH](https://www.nimh.nih.gov/) und [NHS](https://www.nhs.uk/): ADHS bei Erwachsenen sowie Schlafprobleme; Ursachen von abendlicher Wachheit nicht aus App-Nutzung ableiten.
- [Alarmy](https://alar.my/en): Weckaufgaben und Wachheitsprüfung mit den bereits vorhandenen QR-, Rechen- und Wachheitsfunktionen vergleichen.
- [Todoist](https://www.todoist.com/features): Aufgabenaufnahme, Wiedervorlage und Filter mit der vorhandenen Inbox vergleichen.
- [Tiimo](https://www.tiimoapp.com/) und [Structured](https://structured.app/): visuelle Tagesplanung und reibungsarme Übergänge mit Ankers Zeitleiste/Fokus vergleichen.

Eine App-Funktion wird nicht allein dadurch zu einer evidenzbasierten Behandlung, dass sie ein verhaltenstherapeutisches Prinzip aufgreift. Neue therapeutisch begründete Funktionen brauchen erst Quellenprüfung und Zustimmung.

## Freigegebene Abendfunktionen

Alle vier Vorschläge wurden vom Nutzer freigegeben und umgesetzt. Einstieg: **Mehr → Abend & morgen** oder **Jetzt → Plan & Optionen → Abend & morgen**. Unter **Einstellungen → Abend & Schlaf** stehen zusätzlich der sanfte Übergang und der Schlafüberblick.

| Nr. | Vorschlag | Was konkret hinzukäme |
|---|---|---|
| 1 | **Ideen für morgen parken** | Die vorhandene Gedanken-Inbox erhält einen ruhigen Abendzugang: Idee festhalten und zu einem selbst gewählten Zeitpunkt wieder ansehen, ohne sofort eine neue Aufgabe daraus zu machen. |
| 2 | **Morgen hier weitermachen** | Einen kreativen oder privaten Vorgang bewusst für heute beenden und den nächsten Schritt für morgen sichern. Der bisherige Wiedereinstieg verfällt nach acht Stunden/am Tageswechsel. |
| 3 | **Sanfter Abendübergang** | Eine selbst gewählte ruhige Tätigkeit und eine einmalige Übergangserinnerung statt wiederholter Aufforderungen. Kein automatischer Produktivitätsmodus, keine erzwungene frühere Weckzeit. |
| 4 | **Schlafrhythmus verstehen** | Freiwilliger kurzer Überblick aus selbst eingetragenem Müdigkeits-, Bett- und Aufstehzeitpunkt, ohne Punkte, Ranglisten oder behauptete Schlafmessung. |

Geparkte Gedanken nutzen die vorhandene Inbox. Private nächste Schritte und freiwillige Schlafangaben liegen in den lokalen Meta-Daten, werden nicht synchronisiert und sind in einer bewusst exportierten Datensicherung enthalten. Nächste Schritte verfallen nicht; nur bewusstes Erledigen oder Entfernen beendet sie. Spielmeldungen werden auf den neuen ruhigen Seiten ausgeblendet.

Einmalige Erinnerungen sind freiwillig und beachten Ruhezeiten. Der sanfte Übergang ist zunächst aus; eingeschaltet ersetzt sein einzelner Hinweis die PC-Stopp- und Bett-Meldungen. Morgenwecker, Tagesplan und andere Erinnerungen bleiben erhalten. Bei geschlossener App sind die Hinweise auf Android verfügbar. Native Meldungen enthalten keine privaten Texte; ihre Einstiege öffnen Gedanken bzw. Abend & morgen. Die Zustellung muss weiterhin am Gerät geprüft werden.

Prüfung dieser Erweiterung: 327 TypeScript-Tests, alle 19 Browserprüfungen, Lint, Typecheck, Produktionsbuild und Android-Kompilierung mit 38 Android/JUnit-Tests bestanden. Die neuen Ansichten wurden bei 390 Pixel Breite und 160 Prozent Schrift geprüft. Die erneute Leitlinien- und Konkurrenzrecherche blieb mit HTTP 403 blockiert; es werden keine therapeutischen Wirksamkeitsbehauptungen abgeleitet.

## Zusätzlich freigegeben: Aktivitäts-Weckfenster

Testkonfiguration: ein Fenster von beispielsweise 45 Minuten vor dem festen Wecker, Bewegungs- plus Geräuschaktivität und ein Smartphone auf der Matratze.

Die optionale, standardmäßig ausgeschaltete Funktion steht unter **Wecker & QR-Code → Aktivitäts-Weckfenster**. Jede Nacht bewusst bei geöffneter App starten und Mikrofonfreigabe erteilen. Ein sichtbarer Mikrofon-Foreground-Dienst wartet bis zum gewählten Fenster; erst dort beginnen die Sensorabfragen. Audio- und Bewegungsaggregate bleiben im RAM. Es gibt keine gespeicherten Tonaufnahmen und keinen Versand. Ein nach Prozessabbruch fehlender Messdienst wird nicht automatisch mit Mikrofonzugriff neu gestartet.

Die experimentelle Heuristik verlangt mehrere kombinierte Aktivitätshinweise nach einer kurzen Kalibrierung. Sie erkennt keine Schlafstadien oder tatsächliche Wachheit. Die praktische Eignung der Schwellenwerte auf der konkreten Matratze wurde nicht validiert.

Ein vorgezogener Hauptwecker lässt den festen Zeitpunkt zunächst bestehen. Erst QR-/Rechen-/Notfall-Bestätigung verbraucht diesen Termin. Abbruch, Timeout, Neustart, doppelte Broadcasts und ein Prozessabbruch zwischen Bestätigung und Neuplanung sind durch Zustandsregressionen abgesichert. Ein früher Schlummerdurchgang wird durch den festen Fallback nicht nochmals freigegeben.

Endstand: **330 TypeScript-Tests**, **20 Browserprüfungen**, Lint, Typecheck und Produktionsbuild bestanden. Android-Kompilierung und **44 Android/JUnit-Tests** erfolgreich. Die Sensoren selbst wurden in der Cloud nicht betrieben; Mikrofonbetrieb bei gesperrtem Galaxy und echte Weckwirkung bleiben offen. Anleitung: [Abendhilfen und Weckfenster](ABEND_UND_WECKFENSTER.md). Gerätetests 49–59 wurden ergänzt und bleiben ohne Ergebnis.
