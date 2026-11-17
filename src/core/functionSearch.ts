/** Ausschließlich öffentliche Funktionsnamen, niemals Nutzertexte oder Serverdaten. */
export interface FunctionEntry {
  id: string
  title: string
  group: string
  route: string
  anchor?: string
  keywords: string
  nativeOnly?: boolean
}
const entry = (id: string, title: string, group: string, route: string, keywords: string, anchor?: string, nativeOnly?: boolean): FunctionEntry =>
  ({ id, title, group, route, keywords, ...(anchor ? { anchor } : {}), ...(nativeOnly ? { nativeOnly } : {}) })

export const FUNCTION_CATALOG: readonly FunctionEntry[] = [
  entry('wake', 'Aufstehzeit und Schlafenszeit', 'Schlaf & Morgen', '/einstellungen/schlaf', 'wecken weckzeit uhrzeit bett schlafdauer ausschlafen früher override'),
  entry('alarm', 'Wecker und QR-Stopp', 'Schlaf & Morgen', '/wecker', 'alarm klingeln schlummern snooze qr code scannen aufwachen', 'alarm'),
  entry('smartwake', 'Nachtmessung und Aktivitäts-Weckfenster', 'Schlaf & Morgen', '/wecker', 'messung schlafen mikrofon bewegung smart wake einschlafen automatisch nacht', 'nachtmessung', true),
  entry('sleepdiary', 'Schlafprotokoll und Rückmeldungen', 'Schlaf & Morgen', '/schlaf', 'schlaftagebuch energie auswertung wach aufstehzeit einschlafzeit feedback', 'schlafprotokoll'),
  entry('morning', 'Morgenroutine', 'Routinen', '/einstellungen/routinen', 'morgens schritte wasser frühstück zähne', 'morning'),
  entry('evening', 'Abendroutine', 'Routinen', '/einstellungen/routinen', 'abends schritte gesicht zähne schlafen', 'evening'),
  entry('work', 'Arbeitszeiten und Gleitzeit', 'Arbeit', '/einstellungen/arbeit', 'job arbeitstag homeoffice feierabend arbeitsbeginn pause gleitzeit'),
  entry('worklog', 'Arbeit erfassen', 'Arbeit', '/arbeit', 'arbeitszeit start ende einsatz überstunden zeiterfassung'),
  entry('commute', 'Arbeitsweg und Startpuffer', 'Planung', '/einstellungen/weg', 'pendeln fahren abfahrt losgehen büro fahrzeit puffer'),
  entry('today', 'Heute anpassen', 'Planung', '/', 'heute anders termin abweichung ändern rückkehr unterwegs', 'heute-anpassen'),
  entry('places', 'Orte und Packlisten', 'Planung', '/orte', 'adresse zuhause standort packen tasche dinge fahrt'),
  entry('sport', 'Sport planen', 'Planung', '/einstellungen/sport', 'training fitness bewegung sporttage'),
  entry('evenings', 'Abendpläne', 'Planung', '/einstellungen/abend', 'kochen freunde verabredung woche', 'plaene'),
  entry('winddown', 'Sanfter Abendübergang', 'Abend & Alltag', '/einstellungen/abenduebergang', 'runterkommen licht entspannen hobby abend'),
  entry('pc', 'PC-Begleiter und PC-Stopp', 'Abend & Alltag', '/pc-stopp', 'computer laptop koppeln verbinden live wlan lan pc ausschalten sperren wake on lan'),
  entry('guidance', 'Abend- und Morgenbegleitung', 'Abend & Alltag', '/einstellungen/begleitung', 'führung stumm einschlafhinweis zombie streng nacht begleitung'),
  entry('hobbies', 'Hobbys und freiwillige Ideen', 'Abend & Alltag', '/einstellungen/hobbys', 'hobby hobbies fotografieren fotografie freizeit vorschlag pause idee'),
  entry('reminders', 'Erinnerungen und Ruhezeiten', 'App', '/einstellungen/erinnerungen', 'benachrichtigung hinweis mitteilung leise laut erinnern ruhe', 'erinnerungen'),
  entry('return', 'Rückkehr-Erinnerung', 'App', '/einstellungen/erinnerungen', 'bin wieder da unterwegs termin rückkehr status vergessen später erinnern', 'rueckkehr'),
  entry('look', 'Darstellung und Schriftgröße', 'App', '/einstellungen/darstellung', 'design theme farbe dunkel hell schrift gross größer kontrast'),
  entry('supports', 'Alltagshilfen', 'App', '/einstellungen/hilfen', 'wenig energie modus überlastet startschwierigkeiten hilfe'),
  entry('connections', 'Anmeldung und Verbindungen', 'Einrichtung & Daten', '/verbindungen', 'login konto server supabase synchronisation sync kalender google anmeldung'),
  entry('ai', 'KI für kleine Schritte', 'Einrichtung & Daten', '/einstellungen/assistenz', 'ki künstliche intelligenz assistenz aufgabe zerlegen kostenlos ollama', 'ki'),
  entry('traffic', 'Fahrzeiten und Verkehr', 'Einrichtung & Daten', '/einstellungen/assistenz', 'verkehr stau route routing tomtom google maps kostenlos fahrzeit', 'verkehr'),
  entry('backup', 'Sicherung und Wiederherstellung', 'Einrichtung & Daten', '/backup', 'backup export import daten sichern wiederherstellen datei'),
  entry('diagnostics', 'Diagnose und technisches Protokoll', 'Einrichtung & Daten', '/diagnose', 'log journal fehler eingang signal messung debug weckerverlauf'),
  entry('nfc', 'Ankerpunkte', 'Werkzeuge', '/anker', 'nfc tag scan manuell anker ziel'),
  entry('inbox', 'Gedanken und Aufgaben', 'Werkzeuge', '/inbox', 'notiz gedanke erfassen aufgabe todo liste'),
  entry('focus', 'Fokus starten', 'Werkzeuge', '/fokus-start', 'timer konzentrieren zeitfenster pause'),
  entry('recovery', 'Wieder einsteigen', 'Werkzeuge', '/wiedereinstieg', 'fest hängen hilfe start hilfetimer stuck'),
  entry('food', 'Essen', 'Alltag', '/essen', 'rezept mahlzeit kochen einkaufen'),
  entry('tidy', 'Aufräumen', 'Alltag', '/aufraeumen', 'ordnung haushalt putzen'),
  entry('prep', 'Vorbereiten', 'Alltag', '/vorbereitung', 'vorkochen packen morgen bereit'),
  entry('review', 'Wochenrückblick', 'Alltag', '/rueckblick', 'woche rückblick vorschläge auswertung'),
  entry('game', 'Punkte und Belohnungen', 'Spiel', '/spiel', 'xp kopfgeld level kapitel belohnung spiel'),
  entry('print', 'Drucken', 'Einrichtung & Daten', '/druck', 'pdf ausdrucken qr papier'),
  entry('help', 'Hilfe', 'Einrichtung & Daten', '/hilfe', 'anleitung erklärung support funktionen'),
  entry('meds', 'Privates Einnahmeprotokoll', 'Schlaf & Morgen', '/wecker', 'medikament medikamente einnahme notizbuch erinnerung', 'einnahme'),
  entry('prewake', 'Vorwecker', 'Schlaf & Morgen', '/wecker', 'sanfter ton früher vorwecken pause', 'vorwecker'),
  entry('wakecheck', 'Wachheits-Check', 'Schlaf & Morgen', '/wecker', 'wachheit check nochmal nachfragen wach', 'wachheitscheck'),
  entry('pulse', 'Fokus-Puls', 'Alltagshilfen', '/einstellungen/hilfen', 'fokus puls vibrieren haptisch deutlich dezent timer signal', 'fokus-puls'),
  entry('arrival', 'Ankommen nach der Arbeit', 'Alltagshilfen', '/einstellungen/hilfen', 'ankommen feierabend übergang schritte ankunft', 'ankommen'),
  entry('voice', 'Lokale Sprache und Diktat', 'Alltagshilfen', '/einstellungen/hilfen', 'sprache diktat diktieren sprechen vorlesen stimme tts mikrofon lokal', 'sprache'),
  entry('weather', 'Wetter und Kleidung', 'Alltagshilfen', '/einstellungen/hilfen', 'wetter regen outfit kleidung temperatur wetterort', 'wetter'),
  entry('ifthen', 'Mein Wenn-dann-Abendplan', 'Abend & Alltag', '/einstellungen/begleitung', 'wenn dann abendplan ersatz strategie vorsatz', 'wenn-dann'),
  entry('sleep-lock', 'Handy bei Messstart sperren', 'Schlaf & Morgen', '/wecker', 'handy bildschirm display sperren sperre nachts instagram admin geräteadministrator', 'nachtmessung', true),
  entry('sleep-auto', 'Tägliche Nachtmessung', 'Schlaf & Morgen', '/wecker', 'jeden tag täglich automatisch automatik messen messung starten nacht', 'nachtmessung', true),
]

export function normaliseSearch(text: string): string {
  return text.toLocaleLowerCase('de').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}
/** Genau ein Tippfehler, nur bei hinreichend langen Wörtern. */
function near(a: string, b: string): boolean {
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}
export interface FunctionResult extends FunctionEntry { score: number; target: string; unavailableReason?: string }
export function searchFunctions(query: string, options: { native?: boolean; limit?: number } = {}): FunctionResult[] {
  const q = normaliseSearch(query.slice(0, 160))
  const terms = q.split(' ').filter(w => w.length > 1 && !['ich', 'wie', 'kann', 'die', 'das', 'der', 'und', 'fur', 'meine', 'mein'].includes(w))
  if (!terms.length) return []
  const results = FUNCTION_CATALOG.flatMap(e => {
    const title = normaliseSearch(e.title), words = normaliseSearch(`${e.title} ${e.keywords}`).split(' ')
    const scores = terms.map(t => title === t ? 100 : title.split(' ').includes(t) ? 70 : words.includes(t) ? 40 : words.some(w => w.startsWith(t)) ? 25 : words.some(w => w.includes(t)) ? 15 : words.some(w => near(t, w)) ? 5 : 0)
    if (scores.some(score => score === 0)) return []
    return [{ ...e, score: scores.reduce<number>((a, b) => a + b, title === q ? 100 : 0),
      target: `${e.route}${e.anchor ? `#${encodeURIComponent(e.anchor)}` : ''}`,
      ...(e.nativeOnly && !options.native ? { unavailableReason: 'Diese Funktion benötigt die Android-App.' } : {}),
    }]
  })
  const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(50, options.limit!)) : 12
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'de')).slice(0, limit)
}
