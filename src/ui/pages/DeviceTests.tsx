import { App as CapApp } from '@capacitor/app'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import catalog, { BUILD_FINGERPRINT } from 'virtual:anker-device-tests'
import { version as webVersion } from '../../../package.json'
import { DEVICE_TEST_CAMPAIGN_GROUP, DEVICE_TEST_SUITE, TEST_RESULT_LABEL, currentTestReport, deviceTestsFromLocal, type DeviceTestCase } from '../../core/deviceTests'
import { fmtTime } from '../../core/time'
import type { DeviceTestReport, DeviceTestResult } from '../../core/types'
import { saveFile } from '../../platform/files'
import { AnkerNative, isNative } from '../../platform/native'
import { useApp } from '../../state/store'
import { Button, Card, Page, Row, Section, TextInput } from '../components/ui'
import { AlarmDiagnosis, fmtDateTime } from './Alarm'

const SELECT_CLASS = 'min-h-12 w-full rounded-xl bg-surface-2 px-3 text-base'
const TEST_ALARM_CASES = new Set([1, 2, 3, 9, 14, 15, 16, 17, 18, 19, 20, 47, 48, 70])
const HARDWARE_CASES = new Set([...Array.from({ length: 30 }, (_, i) => i + 1), 35, 37, 38, 41, 45, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 79, 84, 85, 86, 88, 90, 94, 95])

const CAMPAIGN_LINKS: Record<number, { label: string; to: string }[]> = {
  86: [{ label: 'Sicherung und Vorschau öffnen', to: '/backup' }, { label: 'Vorhandene Aufgaben vergleichen', to: '/inbox' }],
  87: [{ label: 'Testabend im Tag planen', to: '/tag' }, { label: 'Jetzt und Abend vergleichen', to: '/' }],
  88: [{ label: 'Arbeitszeit und Testeinsatz öffnen', to: '/arbeitszeit' }, { label: 'Arbeitsaufgabe vergleichen', to: '/arbeit' }, { label: 'Homeoffice-Kontakt auf Jetzt öffnen', to: '/' }],
  89: [{ label: 'Termine und Orte vergleichen', to: '/tag' }, { label: 'Gespeicherte Orte öffnen', to: '/orte' }],
  90: [{ label: 'Morgenvorschau im Tag öffnen', to: '/tag' }, { label: 'Echten Weckerstand vergleichen', to: '/wecker' }, { label: 'Aufstehzeit ansehen', to: '/einstellungen/schlaf' }],
  91: [{ label: 'Vorbereitung und Packliste öffnen', to: '/vorbereitung' }, { label: 'Wetter und Alltagshilfen öffnen', to: '/einstellungen/hilfen' }],
  92: [{ label: 'Testaufgabe bewusst wählen', to: '/arbeit' }, { label: 'Gedanken und Entwurf vergleichen', to: '/inbox' }, { label: 'Wiedereinstieg auf Jetzt vergleichen', to: '/' }],
  93: [{ label: 'Optionale Vorschläge und Freigaben öffnen', to: '/einstellungen/assistenz' }, { label: 'Lokalen Plan ohne Dienst öffnen', to: '/tag' }],
  94: [{ label: 'Kalender und Integrationen öffnen', to: '/verbindungen' }, { label: 'Besuchstermin und Erinnerung öffnen', to: '/tag' }, { label: 'Gedanken für Spracheingabe öffnen', to: '/inbox' }],
  95: [{ label: 'Darstellung und Eingabe öffnen', to: '/einstellungen/darstellung' }, { label: 'Ausdruck und PDF öffnen', to: '/druck' }, { label: 'Jetzt und Navigation vergleichen', to: '/' }],
}

const CAMPAIGN_HELP: Record<number, string[]> = {
  86: ['Vergleiche nach dem Update einige dir bekannte Werte. Exportiere zuerst eine vollständige Sicherung. Das allein ist noch kein Import- oder Wiederherstellungsnachweis.', 'Du kannst dieselbe Datei auswählen und die Vorschau wieder abbrechen. Ein tatsächlicher Altimport gehört in eine passende Testkopie. Notiere Datenvergleich, Export und Import getrennt.'],
  87: ['Verwende einen eigenen Testtermin. Vergleiche Tag und Jetzt nach einer Verschiebung, einem offenen Abend und einer Rücknahme; prüfe die angezeigte Rücknahme vor dem Bestätigen.', 'Bleibe bei deinen echten Erledigungen. Eine verschobene Grenze darf weder offene Schritte abhaken noch Freizeit wegnehmen. Ein wirklich späterer Tageswechsel kann bis dahin offen bleiben.'],
  88: ['Das Öffnen der Arbeitszeitseite bucht nichts. Starte nur einen bewusst gewählten kurzen Testeinsatz, pausiere und setze ihn fort. Notiere, dass dies Testdaten sind.', 'Vergleiche Intervall, Pausen und Tagesplan nach erneutem Öffnen. Nachtgrenze, Neustart und reale Konflikte nur nach einem eigenen Versuch bestätigen; sonst „Teilweise“ wählen.'],
  89: ['Wähle bei einem Testtermin nacheinander zu Hause, einen gespeicherten Ort oder eine selbst eingetragene Adresse. Ortsfreigabe und externe Wegabfrage bleiben deine Entscheidung.', 'Lass bei einer Variante die Fahrzeit unbekannt. Ändere dann Ziel oder Zeitpunkt und kontrolliere die neue Annahme in der Vorschau. Ohne konfigurierte Verkehrsanbindung prüfst du den lokalen Weg.'],
  90: ['Öffne zuerst die Morgenvorschau im Tag und notiere den tatsächlichen Weckerstand. Wähle selbst, ob du eine vorgeschlagene Änderung übernehmen möchtest.', 'Für Klingeln und das Aktivitätsfenster nutze die alten Einzelprüfungen 53–61 und 65. Ein richtiger Vorschauwert bestätigt weder Sensorverhalten noch Ton. Behalte für den echten Nachtversuch einen unabhängigen Wecker.'],
  91: ['Öffne denselben Testtermin in der Vorbereitung, bestätige nur einen wirklich vorbereiteten Gegenstand und rufe die Seite erneut auf. Vergleiche mit der Morgenroutine.', 'Prüfe Wetter nur mit einem selbst gewählten Ort. Beobachte einen fehlenden oder veralteten Stand auch ohne Netz; speichere nicht absichtlich falsche Alltagswerte. Ungesehene Zustände bleiben offen.'],
  92: ['Wähle eine Testaufgabe und ergänze bei Bedarf deinen eigenen Grund. Öffnen der Liste startet keinen Fokus. Beginne erst bewusst, pausiere und öffne im Fokus den Gedankenknopf.', 'Lass zunächst einen Entwurf stehen, öffne neu und speichere später bewusst. Vergleiche Aufgabe, Teilabschlüsse und Rückkehr. Mehrtägige Nichtnutzung erst bestätigen, wenn sie wirklich vergangen ist.'],
  93: ['Lies die Freigaben zuerst ausgeschaltet. Ohne eingerichteten Dienst kannst du den lokalen Rückfall prüfen; das zählt nicht als erfolgreiche KI- oder Verkehrsabfrage.', 'Wenn du einen Dienst verwenden möchtest, prüfe Hinweis und Freigabe vor der Anfrage. Lies danach den Vorschlag und verwirf ihn einmal. Eine Übernahme muss deine bewusste Entscheidung bleiben; Daten und Zeiten vorher notieren.'],
  94: ['Prüfe nur die Hilfen, die du verwenden möchtest, und notiere jede getrennt. Öffnen eines Bereichs ist noch keine Freigabe. Ablehnung oder Abbruch darf nichts importieren oder erledigen.', 'Sprache braucht einen geprüften Entwurf; Kalender eine bewusst gewählte Übernahme. Einen Besuchshinweis musst du am echten Ort und Gerät beobachten. Nicht eingerichtete oder noch nicht besuchte Teile bleiben offen.'],
  95: ['Öffne Darstellung und ein Eingabefeld, drehe bei Bedarf das Handy und prüfe obere sowie untere Systemleiste. Öffne eine PDF und kontrolliere alle Seiten vor einem echten Druck.', 'Öffne Anker zusätzlich getrennt vom Homescreen-Widget und einer echten Benachrichtigung. Wechsle danach zu Tag und Mehr. Zustellung, echter QR-Scan, Ton und Langzeitverhalten bleiben eigene Einzelprüfungen; ein geöffneter Link bestätigt sie nicht.'],
}

const E03_LINKS: Record<number, { label: string; to: string }[]> = {
  76: [{ label: 'Aufgabe zum Fokus wählen', to: '/arbeit' }, { label: 'Gedanken und Entwurf öffnen', to: '/inbox' }],
  77: [{ label: 'Gedanken bewusst einplanen', to: '/inbox' }, { label: 'Aufgabe im Tagesplan prüfen', to: '/tag' }, { label: 'Jetzt-Empfehlung prüfen', to: '/' }],
  78: [{ label: 'Arbeitsaufgabe und Schritte öffnen', to: '/arbeit' }, { label: 'Private Aufgaben und Schritte öffnen', to: '/inbox' }],
  79: [{ label: 'Aufgabe für Fokus wählen', to: '/arbeit' }, { label: 'Private Aufgabe für Fokus wählen', to: '/inbox' }, { label: 'Fokus-Puls ansehen', to: '/einstellungen/hilfen' }],
  80: [{ label: 'Starthilfe auf Jetzt prüfen', to: '/' }],
  81: [{ label: 'Wiedereinstieg auf Jetzt öffnen', to: '/' }, { label: 'Gemerkte Arbeit ansehen', to: '/arbeit' }, { label: 'Private Aufgaben ansehen', to: '/inbox' }],
  82: [{ label: 'Aufgabenkontext auf Jetzt wählen', to: '/' }, { label: 'Dauer und Kontext der Aufgabe ansehen', to: '/inbox' }, { label: 'Tagesplan und Zeitfenster öffnen', to: '/tag' }],
  83: [{ label: 'Eigene Zeitschätzungen öffnen', to: '/arbeit' }, { label: 'Private Zeitschätzungen öffnen', to: '/inbox' }],
  84: [{ label: 'Sicherung öffnen', to: '/backup' }, { label: 'Bestehende private Aufgaben prüfen', to: '/inbox' }, { label: 'Bestehende Arbeitsaufgaben prüfen', to: '/arbeit' }],
  85: [{ label: 'Probeaufgabe und Mehrfachtipps prüfen', to: '/arbeit' }, { label: 'Aktuellen Stand auf Jetzt ansehen', to: '/' }],
}

const E03_HELP: Record<number, string[]> = {
  76: ['Wähle in Arbeit eine eigene Testaufgabe und starte ihren Fokus bewusst. Öffne den Gedankenknopf im Aufgabenfokus, damit du den tatsächlichen Kontext prüfst.', 'Tippe einen kurzen Entwurf, verlasse die App und öffne sie wieder. Prüfe den Entwurf, speichere erst danach bewusst und kehre zur Aufgabe zurück.', 'Notiere Entwurf, Rückkehr und Timer getrennt. Eine gespeicherte API-Antwort allein bestätigt kein sofortiges Android-Prozessende.'],
  77: ['Benutze eine Testnotiz. „Behalten“ bleibt eine Notiz; unter „Tag wählen oder verknüpfen“ kannst du eine bestehende Aufgabe wählen, ohne sie zu kopieren.', 'Plane eine andere Testnotiz bewusst für morgen oder einen gewählten Tag ein. Vergleiche Gedanken, Tagesplan und Jetzt; erledige sie einmal und nimm den Abschluss wieder zurück.', 'Eine heutige Vorausschau bestätigt noch keinen echten Tageswechsel. Dafür kannst du zunächst „Teilweise“ notieren.'],
  78: ['Öffne bei einer Testaufgabe „Details“. Wähle eine Detailtiefe und „In kleine Schritte zerlegen“; prüfe den lokalen Vorschlag vor „Vorschlag übernehmen“.', 'Erledige einen echten kleinen Testschritt. Ändere danach die Detailtiefe und öffne die App neu; kontrolliere den erhaltenen Teilabschluss.', 'Falls du Wiederholung prüfen möchtest, schalte sie nur bei der Testaufgabe bewusst ein. Ein Abschluss darf nur deren aktuelle Instanz erledigen; die nächste liegt für später bereit.'],
  79: ['Die Links öffnen nur die Aufgabenliste. Wähle dort selbst eine Testaufgabe, stelle bei Bedarf unter Details den Fokusblock ein und tippe erst dann „Starten“. „Arbeit starten“ wäre dagegen eine Arbeitszeitbuchung.', 'Pausiere, sperre das Handy kurz und öffne Anker erneut. Prüfe Restzeit und konkreten nächsten Schritt, bevor du selbst „Weiter“ wählst.', 'Ein kompletter Zeitablauf und optionale Pulse sind eigene Teilprüfungen. Eine richtige Anzeige beweist noch kein Android-Hintergrundsignal.'],
  80: ['Öffne auf Jetzt „Ich hänge fest“ und lies erst einige Sekunden. Vor deinem Tipp auf „Starten“ darf keine Hilfezeit laufen.', 'Starte danach bewusst den kleinen Schritt; prüfe Pause, Weiter und bei Gelegenheit das Zeitfensterende.', 'Kontrolliere, dass keine Aufgabe oder Routine durch Hilfeöffnung oder Zeitablauf als erledigt gilt. Deine ursprüngliche Aufgabe soll erhalten bleiben.'],
  81: ['Merke bei einer Testaufgabe einen konkreten nächsten Schritt, zum Beispiel „Tabelle öffnen“. Über „Ich bin abgedriftet“ auf Jetzt kommst du später wieder dorthin.', 'Du brauchst die App nicht absichtlich drei Tage wegzulegen. Prüfe die mehrtägige Rückkehr erst, wenn eine solche Pause ohnehin vorkommt; bis dahin bleibt dieser Teil offen.', 'Vergleiche dann den gemerkten Schritt und deinen bereits erworbenen Fortschritt. Ändere dafür weder Systemzeit noch gespeicherte Alltagsdaten.'],
  82: ['Öffne die Details einer Testaufgabe und notiere eigene Dauer, Frist, frühesten Start, Ort und Energiebedarf nur soweit sinnvoll.', 'Auf Jetzt findest du unter „Plan & Optionen“ den freiwilligen Aufgabenkontext. Vergleiche eine passende Auswahl mit einem tatsächlich knappen Zeitfenster.', 'Prüfe aktive Aufgabe, harten Termin und kleinen Einstieg getrennt. Stelle geänderte Testwerte oder deinen Kontext anschließend wieder nach Wunsch ein.'],
  83: ['Unten in Arbeit oder Gedanken liegt „Eigene Zeitschätzungen (freiwillig)“. Öffnen allein schaltet nichts ein; prüfe zuerst den Schalter und die angezeigten Werte.', 'Nur wenn du es nutzen möchtest: schalte lokal ein und bestätige später echte aktive Dauern beim Aufgabenabschluss. Ohne ausreichend echte Werte bleibt der Vorschlagsteil offen.', 'Eine Schätzung ändert sich erst durch „Schätzung übernehmen“. „Gelernte Zeiten zurücksetzen“ entfernt Lernwerte und schaltet Lernen aus; Aufgaben und Erledigungen bleiben.'],
  84: ['Exportiere zuerst eine neue Sicherung. Notiere eine vorhandene Aufgabe, einen echten Teilabschluss und einen gemerkten Wiedereinstieg.', 'Vergleiche diese Daten nach einem regulären Update. Ein alter Import gehört in eine passende eigene Testkopie, nicht ungeprüft über deinen neueren Alltagsstand.', 'Export, Update-Erhalt und Altbestand-Import sind getrennte Nachweise. Melde nur die tatsächlich beobachteten Teile; Appdaten müssen dafür nicht gelöscht werden.'],
  85: ['Verwende eine Testaufgabe und tippe ihren Abschluss oder eine Änderung wenige Male schnell. Kontrolliere anschließend genau eine passende Wirkung und die nächste künftige Instanz.', 'Prüfe den letzten gewünschten Stand auf Jetzt. Öffne das echte Anker-Widget getrennt vom Android-Homescreen und kehre über seinen Knopf zurück.', 'Widgettexte bleiben bewusst allgemein. Browsernavigation oder ein geöffneter Link bestätigt weder Android-Zustellung noch mehrere Tage ohne Appöffnung.'],
}

function linksFor(id: number): { label: string; to: string }[] {
  if (CAMPAIGN_LINKS[id]) return CAMPAIGN_LINKS[id]
  if (E03_LINKS[id]) return E03_LINKS[id]
  if (id === 75) return [{ label: 'Jetzt mit Testbegleitung öffnen', to: '/' }, { label: 'Aufgabe für eigene Fokusprüfung wählen', to: '/arbeit' }, { label: 'Schrift & Tastatur prüfen', to: '/einstellungen/darstellung' }]
  if (id >= 72 && id <= 74) return [{ label: 'Druckauswahl öffnen', to: '/druck' }, { label: 'Morgenroutine öffnen', to: '/fokus/morning' }, { label: 'Abendroutine öffnen', to: '/fokus/evening' }]
  if (id >= 66 && id <= 71) return [{ label: 'Erinnerungen einstellen', to: '/einstellungen/erinnerungen' }, { label: 'Tagesplan öffnen', to: '/tag' }, { label: 'Weckerstatus und Messung öffnen', to: '/wecker' }, ...(id === 69 ? [{ label: 'Morgenfokus öffnen', to: '/fokus/morning' }] : [])]
  if (id === 64) return [{ label: 'Mehr öffnen', to: '/mehr' }, { label: 'Tag öffnen', to: '/tag' }, { label: 'Wecker öffnen', to: '/wecker' }]
  if (id === 65) return [{ label: 'Messung und Vorwecker prüfen', to: '/wecker' }]
  if (id === 62) return [{ label: 'Uhrzeiten direkt ändern', to: '/einstellungen/schlaf' }, { label: 'Fahrzeit direkt ändern', to: '/einstellungen/weg' }]
  if (id === 63) return [{ label: 'Schlaf & Anker öffnen', to: '/einstellungen/schlaf' }]
  if (id >= 53 && id <= 59) return [{ label: 'Aktivitäts-Weckfenster öffnen', to: '/wecker' }]
  if (id === 49) return [{ label: 'Idee parken', to: '/abend' }, { label: 'Gedanken ansehen', to: '/inbox' }]
  if (id === 50) return [{ label: 'Nächsten Schritt merken', to: '/abend' }]
  if (id === 51) return [{ label: 'Sanften Übergang einstellen', to: '/einstellungen/abenduebergang' }]
  if (id === 52) return [{ label: 'Schlafüberblick öffnen', to: '/schlaf' }]
  if (id === 34) return [{ label: 'Schriftgröße einstellen', to: '/einstellungen/darstellung' }, { label: 'Alltag ausprobieren', to: '/' }]
  if (id >= 31 && id <= 32) return [{ label: 'Fokus-Puls einstellen', to: '/einstellungen/hilfen' }, { label: 'Morgenfokus öffnen', to: '/fokus/morning' }]
  if ([12, 26, 33, 46].includes(id)) return [{ label: 'Sicherung vor Update', to: '/backup' }, { label: 'Wecker prüfen', to: '/wecker' }, { label: 'Arbeitszeit prüfen', to: '/arbeitszeit' }]
  if (id >= 27 && id <= 30) return [{ label: 'Druckauswahl öffnen', to: id === 29 ? '/druck?typ=qr' : '/druck' }, { label: 'QR-Wecker öffnen', to: '/wecker' }]
  if (id >= 21 && id <= 25) return [{ label: 'Erinnerungen einstellen', to: '/einstellungen/erinnerungen' }, { label: 'Tagesplan öffnen', to: '/tag' }]
  if (id >= 41 && id <= 46) return [{ label: 'Arbeit & Gleitzeit einstellen', to: '/einstellungen/arbeit' }, { label: 'Arbeitszeit & Einsätze öffnen', to: '/arbeitszeit' }]
  if (id >= 35 && id <= 40) return [{ label: 'Tag und Morgen anders planen', to: '/tag' }, { label: 'Heute anders öffnen', to: '/' }, { label: 'Weckerdiagnose öffnen', to: '/wecker' }]
  const links = [{ label: 'Weckeroptionen & Diagnose öffnen', to: '/wecker' }]
  if ([4, 60, 61].includes(id)) links.unshift({ label: 'Aufstehzeit direkt einstellen', to: '/einstellungen/schlaf' })
  return links
}

function extraHelp(id: number): string[] {
  if (CAMPAIGN_HELP[id]) return CAMPAIGN_HELP[id]
  if (E03_HELP[id]) return E03_HELP[id]
  if (id === 75) return ['Öffne zuerst „Jetzt mit Testbegleitung“. Prüfe oben Uhr und Akku sowie den Knopf „Zurück zu Test 75“. Für den Fokus wähle in Arbeit eine Aufgabe und starte sie erst bewusst selbst.', 'Drehe das Handy ins Querformat und zurück. Vergleiche bei Bedarf Gesten- und Drei-Tasten-Navigation in den Android-Einstellungen; stelle danach deine übliche Navigation wieder her.', 'Öffne „Schrift & Tastatur prüfen“, tippe in das Schriftgrößenfeld und schließe die Tastatur wieder. Du brauchst keinen Wert zu ändern. Notiere obere und untere Abstände sowie Tastatur und Drehung getrennt; ungeprüfte Teile bleiben offen.']
  if (id === 71) return ['Lies den Android-Stand ein und öffne den Weckerstatus. Die gespeicherten Basisregeln gelten nach dem genauen Tagesvorrat; neue spontane Änderungen kennt Android erst nach erneutem Öffnen.', 'Der vollständige Langzeittest braucht echte Zeit ohne Appöffnung. Notiere den Beginn und halte einen unabhängigen Wecker bereit. Nur die angezeigte Regelzahl zu prüfen ist „Teilweise“, kein Zustellnachweis.']
  if (id >= 72 && id <= 74) return ['Öffne die Druckauswahl oder den direkten Link aus deiner Routine. Wähle nur den gewünschten Inhalt und A5 oder A4.', 'PDF-Datei auf Android und Systemdruck sind getrennte Wege. Öffne die Datei und prüfe alle Seiten; ein geöffneter Dialog oder abgebrochenes Teilen gilt nicht als gedruckt.', 'QR-Code nach Möglichkeit wirklich auf Papier scannen. Deine Einstellungen und der QR-Wert werden durch die Auswahl nicht geändert.']
  if (id >= 66 && id <= 70) return ['Notiere vorher deine eigenen Zeiten und Optionen. Die Knöpfe unten führen direkt zu Erinnerungen, Tagesplan und Weckerstatus.', 'Führe den beschriebenen Ablauf mit einer bewusst gewählten Erinnerung aus. Der separate Testalarm prüft nur den Alarm und kann keine Aufgaben-Erledigung simulieren.', 'Stelle anschließend deine eigenen Einstellungen wieder her. Notiere, welchen Teil du tatsächlich beobachtet hast; nichts wird automatisch als bestanden eingetragen.']
  if (id === 64) return ['Öffne Anker über sein Widget oder eine Benachrichtigung. Rufe danach über die Navigation andere Seiten auf.', 'Auch bei „Gute Nacht“ müssen die gewählten Seiten offen bleiben. Prüfe neue Benachrichtigungslinks und den separaten Testwecker anschließend getrennt.']
  if (id === 65) return ['Notiere zuerst deine eigenen Weckzeiten. Aktiviere den Vorwecker und prüfe die feste Hauptzeit, bevor du die Messung bewusst startest.', 'Der Status muss den Vorwecker für diese Messnacht als pausiert zeigen. Seine Einstellung bleibt gespeichert. Auch nach Messungsende oder Neustart bleibt die Pause für diesen Haupttermin erhalten.', 'Warte den Vorwecktermin und die feste Hauptzeit tatsächlich ab. Danach eine neue Weckzeit oder den nächsten Morgen ohne Messung prüfen und deine eigenen Einstellungen wiederherstellen. Teilprüfungen als „Teilweise“ speichern.']
  if (id === 3) return ['Lies vor dem Test den Android-Stand unten ein. Die geplante Hauptzeit und der Schlummerzähler werden zum Vergleich gespeichert.', 'Starte den separaten Testalarm, beende ihn und kehre über „Zurück zu Test 3“ hierher zurück.', 'Lies den Android-Stand erneut und vergleiche die Hauptzeit. Nur dein beobachtetes Ergebnis wird abgehakt.']
  if ([4, 60, 61].includes(id)) return ['Notiere deine bisherige Aufstehzeit. Der separate Testalarm kann Schlummern nicht prüfen; dieser Test braucht bewusst einen regulären Hauptwecker.', 'Öffne „Aufstehzeit direkt einstellen“ und wähle eine Zeit wenige Minuten voraus. Abends kann das die berechneten Schlafzeiten verändern; deine manuell gesetzten Werte bleiben geschützt.', 'Führe die beschriebene Änderung durch. Stelle danach deine eigene Aufstehzeit und den gewünschten Ein-/Aus-Zustand wieder her. Falls du vorher automatische Zeiten genutzt hast, kannst du „Vorschlag übernehmen“ wählen.']
  if (id === 47) return ['Samsung: Öffne die Systemeinstellungen und suche dort nach „Always On Display“. Schalte es für diesen Test ein; die genaue Menüposition hängt von deiner One-UI-Version ab.', 'Starte hier den Testalarm, sperre das Handy und warte zehn Sekunden. Beobachte Ton und Vollbild getrennt.']
  if (id === 48) return ['Lass Always On Display eingeschaltet, halte das Handy diesmal entsperrt und starte den separaten Testalarm.', 'Eine Meldung oben ist hier das erwartete Verhalten. Notiere Ton und Anzeige getrennt.']
  if (id === 10) return ['Dies ist ein Hauptweckertest, kein Testalarm. Wähle bewusst eine nahe Hauptweckzeit, starte das Handy neu und entsperre es vor dieser Zeit noch nicht.', 'Notiere, ob Ton und Beenden-Knopf verfügbar waren. Danach entsperren und deine eigenen Zeiten zurückstellen.']
  if (id === 11) return ['Wähle eine nahe Hauptweckzeit und schalte das Handy vorher aus. Schalte es zehn Minuten nach dem Termin wieder ein.', 'Beobachte einmaliges Nachholen und prüfe danach die nächste geplante Hauptzeit. Anschließend eigene Zeiten zurückstellen.']
  if (id === 5) return ['Benutze dafür bewusst einen regulären Hauptwecker. Reagiere 30 Minuten nicht und öffne die App auch nach dem Verstummen zunächst nicht.', 'Der Folgetag muss wirklich klingeln. Das Verstummen allein bestätigt diesen zweiten Teil noch nicht: speichere bis dahin „Teilweise“.']
  if (id === 6 || id === 7) return ['Öffne die Weckeroptionen und schalte „Vorwecker“ bewusst ein. Prüfe die angezeigten Zeiten für Vor- und Hauptwecker.', 'Ein separater Testalarm ersetzt diesen Ablauf nicht. Stelle die Option nach dem Versuch wieder so ein, wie du sie nutzen möchtest.']
  if (id === 8) return ['Schalte „Wachheits-Check“ in den Weckeroptionen ein. Beende einen regulären Hauptwecker und warte die eingestellte Verzögerung ab.', 'Nach dem Beenden des Checks darf kein weiterer Check entstehen. Stelle die Option anschließend nach deinem Wunsch ein.']
  if (id === 14) return ['Öffne „Nicht stören“ unten. Teste einmal mit und einmal ohne erlaubte Wecker-Ausnahme.', 'Notiere beide Ergebnisse. Stelle danach deine üblichen Nicht-stören-Einstellungen wieder her.']
  if (id === 15) return ['Öffne die Ton-Einstellungen. Stelle die Alarmlautstärke bewusst niedrig und kontrolliere die Warnung in der Diagnose.', 'Teste die tatsächliche Hörbarkeit und stelle danach deine übliche Lautstärke wieder her. Anker regelt sie nicht automatisch.']
  if (id >= 53 && id <= 59) return ['Öffne die Weckeroptionen, prüfe deinen festen Hauptwecker und schalte das Aktivitäts-Weckfenster nur für diesen Versuch bewusst ein.', 'Die Messung muss für jede Nacht bei geöffneter App gestartet werden. Sie wertet erst im gewählten Fenster aus; es gibt hier keinen beschleunigten Nachweis für Schlafphasen.', 'Dein Handy liegt auf der Matratze. Beobachte Bewegung, Geräusche und den festen Ersatztermin getrennt. Beende die Messung oder schalte die Option nach dem Versuch aus, wenn du sie nicht nutzen möchtest.']
  if (id === 62) return ['Notiere deine eigenen Zeiten und Dauern vor der Änderung.', 'Tippe in die angezeigte Uhrzeit und gib 20:00 bzw. 00:30 ein. Bei einer Dauer kannst du die Zahl direkt eingeben und das Feld verlassen.', 'Öffne die App neu, prüfe die Werte und stelle deine eigenen Einstellungen anschließend wieder her.']
  if (id === 63) return ['Speichere unten bewusst „Teilweise“ mit einer kurzen Beobachtung. Öffne die App neu und wähle diesen Test erneut.', 'Öffne die verlinkte Einstellung und kehre mit dem Test-Banner zurück. Kontrolliere, dass weder Routine noch Spiel dadurch als erledigt markiert wurden.']
  return ['Öffne den passenden Bereich über die Knöpfe unten.', 'Führe den beschriebenen Versuch aus. Falls du dafür Einstellungen änderst, notiere vorher deine Werte und stelle sie danach wieder her.', 'Vergleiche deine Beobachtung mit der Erwartung und speichere dein Ergebnis. „Teilweise“ ist sinnvoll, wenn noch ein Teil offen ist.']
}

export default function DeviceTests() {
  const progress = useApp((s) => s.local.deviceTests)
  const saved = deviceTestsFromLocal({ deviceTests: progress })
  const [params, setParams] = useSearchParams()
  const [group, setGroup] = useState(() => Number(params.get('fall') ?? saved.activeId ?? 1) >= 86 ? DEVICE_TEST_CAMPAIGN_GROUP : 'Alle')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const platform = isNative() ? 'android' : 'web'
  const requested = Number(params.get('fall') ?? saved.activeId ?? 1)
  const visible = catalog.filter((test) => (group === 'Alle' || test.group === group) && (!onlyOpen || currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result !== 'passed'))
  const selected = visible.find((test) => test.id === requested) ?? visible[0]
  const passed = catalog.filter((test) => currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result === 'passed').length
  const campaign = catalog.filter((test) => test.group === DEVICE_TEST_CAMPAIGN_GROUP)
  const campaignPassed = campaign.filter((test) => currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result === 'passed').length
  const select = (id: number) => setParams({ fall: String(id) })

  return <Page title="Gemeinsam testen" back="/mehr">
    <Card className="space-y-2">
      <p>Ein Versuch nach dem anderen. Du kannst jederzeit aufhören und später weitermachen.</p>
      <p className="text-sm text-muted">{campaignPassed} von {campaign.length} Abschlussstationen {platform === 'android' ? 'auf Android' : 'im Browser'} von dir als „Hat geklappt“ gemeldet. Frühere Geräteberichte bleiben erhalten; sie werden für diesen Stand nicht automatisch abgehakt.</p>
      {platform === 'web' && <p className="text-sm text-warm">Du bist in der Web-Version. Klingeln, Sperrbildschirm, Sensoren, Android-Widgets und Android-Druck lassen sich nur auf dem Handy prüfen. Deine Einträge hier bleiben Browserberichte.</p>}
    </Card>
    <Section title="Womit möchtest du anfangen?">
      <p className="px-1 text-muted">Zehn Stationen führen dich durch das Zusammenspiel. Nutze eine kleine Testaufgabe oder einen Testtermin. Du musst die alten Einzelfälle nicht alle nacheinander abarbeiten; ungeprüfte Teile dürfen offen bleiben.</p>
      <Button variant="primary" onClick={() => { setGroup(DEVICE_TEST_CAMPAIGN_GROUP); setOnlyOpen(false); select(86) }}>Gemeinsamer Abschlusslauf</Button>
      <details className="rounded-2xl border border-line p-3">
        <summary className="min-h-11 py-2">Einzelne Bereiche prüfen</summary>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setGroup('Alle'); setOnlyOpen(false); select(1) }}>Erster Weckertest</Button>
        <Button onClick={() => { setGroup('E02: Erinnerungen und Papier'); setOnlyOpen(false); select(66) }}>Erinnerungen & Druck prüfen</Button>
        <Button onClick={() => { setGroup('E03: Aufgaben und Wiedereinstieg'); setOnlyOpen(false); select(76) }}>Aufgaben & Wiedereinstieg prüfen</Button>
        <Button onClick={() => { setGroup('Alle'); setOnlyOpen(false); select(53) }}>Weckfenster prüfen</Button>
        <Button onClick={() => { setGroup('Alle'); setOnlyOpen(false); select(62) }}>Zeiteingabe prüfen</Button>
        <Button onClick={() => { setGroup('Android-Systemleisten'); setOnlyOpen(false); select(75) }}>Systemleisten prüfen</Button>
      </div>
      </details>
      <label className="block space-y-1"><span>Bereich</span><select aria-label="Testbereich" className={SELECT_CLASS} value={group} onChange={(e) => { setGroup(e.target.value); setParams({}) }}>
        {['Alle', ...new Set(catalog.map((test) => test.group))].map((name) => <option key={name}>{name}</option>)}
      </select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />Nur noch nicht bestandene Tests</label>
      <label className="block space-y-1"><span>Test auswählen</span><select aria-label="Test auswählen" className={SELECT_CLASS} value={selected?.id ?? ''} onChange={(e) => select(Number(e.target.value))}>
        <option value="" disabled>{visible.length ? 'Test auswählen' : 'Hier ist gerade nichts offen'}</option>
        {visible.map((test) => <option key={test.id} value={test.id}>{currentTestReport(saved.reports[test.id], platform, BUILD_FINGERPRINT)?.result === 'passed' ? '✓ ' : ''}{test.id}: {test.action}</option>)}
      </select></label>
    </Section>
    {selected ? <>
      <TestView key={selected.id} test={selected} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={selected === visible[0]} onClick={() => select(visible[Math.max(0, visible.indexOf(selected) - 1)]!.id)}>Vorheriger Test</Button>
        <Button disabled={selected === visible.at(-1)} onClick={() => select(visible[Math.min(visible.length - 1, visible.indexOf(selected) + 1)]!.id)}>Nächster Test</Button>
      </div>
    </> : <Card><p>In dieser Auswahl ist gerade nichts offen. Du kannst die Filter ändern oder für heute aufhören.</p></Card>}
    <Section title="Nachweise getrennt halten">
      <p className="px-1 text-sm text-muted">Im gesamten freiwilligen Katalog: {passed} von {catalog.length} {platform === 'android' ? 'auf Android' : 'im Browser'} von dir als „Hat geklappt“ gemeldet. Die Einzelfälle sind keine Pflichtliste.</p>
      <Card><p className="text-sm text-muted">Logik, Speicherung und Bedienwege werden zusätzlich automatisch geprüft. Das bestätigt keinen Ton und kein Vollbild auf deinem Handy. Hier setzt nur deine bewusste Rückmeldung einen Haken. Es gibt dafür weder Punkte noch Strafen.</p></Card>
      <ReportExport />
    </Section>
  </Page>
}

function TestView({ test }: { test: DeviceTestCase }) {
  const nav = useNavigate()
  const st = useApp()
  const progress = deviceTestsFromLocal(st.local)
  const report = progress.reports[test.id]
  const draft = progress.drafts?.[test.id]
  const native = isNative()
  const alarmTools = native && test.id <= 75
  const [note, setNote] = useState(draft?.note ?? report?.note ?? '')
  const [device, setDevice] = useState(draft?.device ?? progress.device ?? '')
  const [os, setOs] = useState(draft?.os ?? progress.os ?? '')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [comparison, setComparison] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(''); setStatus('')
    try { await action() } catch { setError('Das hat nicht geklappt. Es wurde kein Testerfolg eingetragen. Versuche es erneut.') } finally { setBusy(false) }
  }
  const saveDraft = () => st.saveDeviceTests((p) => ({ ...p, device, os, drafts: { ...p.drafts, [test.id]: { note, device, os } } }))
  const draftBlur = () => void saveDraft().catch(() => setError('Der Notizentwurf konnte nicht gespeichert werden. Bitte kopiere deinen Text vor dem Verlassen.'))
  const activate = async () => { await saveDraft(); await st.saveDeviceTests((p) => ({ ...p, activeId: test.id })) }
  const readAndroid = async () => {
    const d = await AnkerNative.getAlarmDiagnostics()
    setDevice((value) => value || d.device)
    setOs((value) => value || `Android-API ${d.sdk}; One UI noch nicht angegeben`)
    const before = progress.alarmBefore
    setComparison(`Jetzt: Hauptwecker ${d.scheduledAt ? fmtDateTime(d.scheduledAt) : 'nicht hinterlegt'}, Schlummerzähler ${d.snoozed}.${before ? ` Vor Teststart: ${before.mainAt ? fmtDateTime(before.mainAt) : 'nicht hinterlegt'}, Schlummerzähler ${before.snoozed}.` : ''} Das ist ein Planvergleich, noch kein bestandener Hörtest.`)
    await st.saveDeviceTests((p) => ({ ...p, device: device.trim() || d.device, os: os.trim() || `Android-API ${d.sdk}; One UI noch nicht angegeben` }))
  }
  const startTest = async () => {
    const state = await AnkerNative.getAlarmState()
    if (state.ringing) throw new Error('Ein Alarm klingelt bereits.')
    await st.saveDeviceTests((p) => ({ ...p, activeId: test.id, alarmBefore: { at: Date.now(), mainAt: state.scheduledAt ?? 0, preWakeAt: state.preWakeAt ?? 0, snoozed: state.snoozed } }))
    const result = await AnkerNative.testAlarm({ seconds: 10 })
    setStatus(`Separater Test angefordert für ${fmtDateTime(result.at)}. Sperre das Handy, wenn dieser Test das verlangt. Deine Beobachtung trägst du anschließend hier ein.`)
  }
  const saveResult = async (result: DeviceTestResult) => {
    const info = native ? await CapApp.getInfo().catch(() => ({ version: webVersion, build: 'Nicht ermittelt' })) : { version: webVersion, build: 'Web' }
    const next: DeviceTestReport = { result, note: note.trim(), at: Date.now(), platform: native ? 'android' : 'web', device: device.trim() || 'Nicht angegeben', os: os.trim() || 'Nicht angegeben', appVersion: info.version, build: info.build, suiteVersion: DEVICE_TEST_SUITE, buildFingerprint: BUILD_FINGERPRINT }
    await st.saveDeviceTests((p) => ({ ...p, activeId: test.id, device: device.trim(), os: os.trim(), reports: { ...p.reports, [test.id]: next } }))
    setStatus(`Deine Rückmeldung wurde gespeichert: ${TEST_RESULT_LABEL[result]}.`)
  }

  return <Section title={`Test ${test.id} · ${test.group}`}>
    <Card className="space-y-4">
      <h2 className="text-xl font-semibold">{test.action}</h2>
      {!native && HARDWARE_CASES.has(test.id) && <p className="text-sm text-warm">Dieser Versuch braucht ein echtes Android-Gerät. Ein Ergebnis im Browser bestätigt ihn dafür nicht.</p>}
      <div><p className="font-medium">Daran erkennst du, dass es klappt</p><p>{test.expected}</p></div>
      <ol className="list-decimal space-y-2 pl-5">{extraHelp(test.id).map((step) => <li key={step}>{step}</li>)}</ol>
      <p className="text-sm text-muted">Deine gespeicherte Standard-Aufstehzeit: {fmtTime(st.settings.anchor.wake)}. Einstellungen änderst du nur selbst; ein Test-Haken verändert weder Weckregel noch Routine oder Spielstand.</p>
      <div className="space-y-2">{linksFor(test.id).map((link) => <Row key={link.to} label={link.label} onClick={() => void run(async () => { await activate(); nav(link.to) })} />)}</div>
      {alarmTools && <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run(readAndroid)}>Android-Stand lesen</Button>
        {TEST_ALARM_CASES.has(test.id) && <Button disabled={busy} variant="primary" onClick={() => void run(startTest)}>Separaten Test in 10 Sekunden starten</Button>}
        {[14].includes(test.id) && <Button disabled={busy} onClick={() => void run(() => AnkerNative.openDndSettings())}>Nicht stören öffnen</Button>}
        {[15, 16, 17].includes(test.id) && <Button disabled={busy} onClick={() => void run(() => AnkerNative.openAlarmChannelSettings())}>Ton-Einstellungen öffnen</Button>}
        {test.id === 18 && <Button disabled={busy} onClick={() => void run(() => AnkerNative.openBatteryOptimizationSettings())}>Akku-Einstellungen öffnen</Button>}
      </div>}
      {comparison && <p role="status" className="text-sm text-muted">{comparison}</p>}
      {alarmTools && <details><summary className="min-h-11 py-2">Weckerdiagnose anzeigen</summary><AlarmDiagnosis /></details>}
    </Card>
    <Card className="space-y-3">
      <h2 className="text-lg font-medium">Deine Beobachtung</h2>
      <label className="block space-y-1"><span>Gerät (optional)</span><TextInput aria-label="Testgerät" value={device} placeholder="Zum Beispiel Galaxy S26 Ultra" onChange={(e) => setDevice(e.target.value)} onBlur={draftBlur} /></label>
      <label className="block space-y-1"><span>Android / One UI oder Browser (optional)</span><TextInput aria-label="Systemversion beim Test" value={os} placeholder="In den Systemeinstellungen unter Telefoninfo" onChange={(e) => setOs(e.target.value)} onBlur={draftBlur} /></label>
      <label className="block space-y-1"><span>Was hast du beobachtet? (optional)</span><textarea aria-label="Testbeobachtung" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={draftBlur} className="w-full rounded-xl bg-surface-2 p-3" /></label>
      <p className="text-sm text-muted">Deine Notiz bleibt beim Verlassen des Feldes als Entwurf gespeichert. Ein Entwurf setzt keinen Haken.</p>
      <p className="text-sm text-muted">Tippe erst nach deinem Versuch auf das passende Ergebnis. „Nicht relevant“ zählt nicht als bestanden.</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(TEST_RESULT_LABEL) as DeviceTestResult[]).map((result) => <Button key={result} disabled={busy} variant={result === 'passed' ? 'primary' : 'secondary'} onClick={() => void run(() => saveResult(result))}>{result === 'passed' ? '✓ ' : ''}{TEST_RESULT_LABEL[result]}</Button>)}</div>
      {report && <div className="space-y-2 text-sm">
        <p>{report.platform === 'android' ? 'Dein Android-Bericht' : 'Dein Browserbericht'}: {TEST_RESULT_LABEL[report.result]} · {fmtDateTime(report.at)} · App {report.appVersion} ({report.build}) · {report.device} · {report.os}</p>
        <p className="text-muted">Codestand: {report.buildFingerprint?.slice(0, 12) ?? 'Nicht ermittelt'}</p>
        {(report.suiteVersion !== DEVICE_TEST_SUITE || report.buildFingerprint !== BUILD_FINGERPRINT) && <p className="text-warm">Dieses Ergebnis gehört zu einem anderen Codestand. Es bleibt erhalten und zählt für diesen Stand als offen.</p>}
        <Button size="sm" disabled={busy} onClick={() => void run(async () => { await st.saveDeviceTests((p) => { const reports = { ...p.reports }; const drafts = { ...p.drafts }; delete reports[test.id]; delete drafts[test.id]; return { ...p, reports, drafts } }); setNote(''); setStatus('Nur dieser Testbericht wurde entfernt. Deine Alltagsdaten bleiben erhalten.') })}>Diesen Test wieder öffnen</Button>
      </div>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert" className="text-warm">{error}</p>}
      {progress.activeId !== undefined && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await st.saveDeviceTests((p) => ({ ...p, activeId: undefined })); setStatus('Testbegleitung pausiert. Deine Ergebnisse bleiben gespeichert.') })}>Testbegleitung pausieren</Button>}
    </Card>
  </Section>
}

function ReportExport() {
  const progress = useApp((s) => s.local.deviceTests)
  const [message, setMessage] = useState('')
  return <>
    <Button onClick={async () => {
      try { await saveFile('anker-testberichte.json', JSON.stringify({ app: 'anker', exportedAt: new Date().toISOString(), reports: progress?.reports ?? {} }, null, 2), 'application/json'); setMessage('Datei an den Download bzw. das Teilen-Menü übergeben. Du entscheidest, ob du sie weitergibst.') }
      catch { setMessage('Export nicht abgeschlossen. Deine Berichte bleiben in der App.') }
    }}>Testberichte als Datei exportieren</Button>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </>
}
