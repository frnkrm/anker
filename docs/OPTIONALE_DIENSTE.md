# Optionale KI- und Verkehrsvorschläge

**E04–E09: Software implementiert, echte Dienste nicht aktiviert.** Client, geschützter Supabase-Adapter und echte OpenAI-/Google-Routes-Anfragen sind im Quellcode implementiert. Diese Datei ist ein prüfbarer Einrichtungsvertrag; sie bestätigt keine Bereitstellung, keinen verbundenen Anbieter und keine Freigabe von Kosten. Es wurde dadurch nichts installiert oder aktiviert.

Lokale Teilschritt-Vorlagen, eigene Fahrzeiten und der restliche Offline-Kern benötigen diese Dienste nicht. Automatische Tests mit kontrollierten HTTP-Antworten prüfen Verhalten und Datenwege. **Ein Testbackend ist kein Nachweis eines echten Anbieterbetriebs.** Auch eine grüne CI ersetzt keinen Test mit der bewusst eingerichteten Verbindung.

## Vor der Einrichtung entscheiden

KI und Verkehr sind zwei getrennte Zwecke mit jeweils eigener Daten-/Kostenfreigabe. Beide beginnen ausgeschaltet. Unter **Einstellungen → Optionale Vorschläge** zeigt **Verbindung prüfen** die aktuell eingerichteten Serverfähigkeiten. Dieser GET-Check nutzt deine Anmeldung, überträgt keine Aufgaben oder Adressen und ruft noch keinen Anbieter auf.

Eine Anmeldung am bestehenden Supabase-Konto ist erforderlich; der Schalter für Datensync darf ausbleiben. Vor jedem KI-Auftrag wird der sichtbare Inhalt gesondert freigegeben. Beim Verkehr sind lokale Ortsfreigaben und der gewählte Auftrag maßgeblich. Automatische passende Wege brauchen einen zusätzlichen Schalter und starten durch die reine Verkehrsfreigabe nicht mit.

## Konfiguration, getrennt nach Speicherort

Alle Namen stammen aus `supabase/functions/assistant/index.ts` beziehungsweise dem vorhandenen App-Client. Werte sind projektspezifisch; keine echten Schlüssel in Dokumente, Chat oder Git kopieren.

| Speicherort | Name | Bedeutung |
|---|---|---|
| App-Build, öffentlich | `VITE_SUPABASE_URL` | URL deines bestehenden Supabase-Projekts |
| App-Build, öffentlich | `VITE_SUPABASE_ANON_KEY` | Dessen öffentlicher anon-Key, kein `service_role`-Key |
| Edge-Function-Umgebung | `SUPABASE_URL` | Projekt-URL für serverseitige Auth-/Budgetaufrufe; in Supabase üblicherweise bereitgestellt |
| Edge-Function-Umgebung | `SUPABASE_ANON_KEY` | Öffentlicher Projekt-Key für Auth-/Budgetaufrufe mit dem jeweiligen Nutzer-Bearer |
| Edge-Function-Umgebung | `ANKER_ASSISTANT_USER_IDS` | Kommagetrennte ausdrücklich erlaubte IDs bestehender Supabase-Auth-Nutzer; leer bleibt geschlossen |
| Edge-Function-Umgebung | `ANKER_ASSISTANT_ORIGINS` | Kommagetrennte erlaubte Origins deiner tatsächlich verwendeten Web-/Capacitor-App; exakter Vergleich, keine beliebige öffentliche Proxy-Nutzung |
| Nur Server-Secret | `OPENAI_API_KEY` | Bewusst eingerichteter OpenAI-API-Zugang, nur für KI nötig |
| Edge-Function-Umgebung | `ANKER_AI_MODEL` | Von dir bewusst gewähltes, beim Anbieter verfügbares Modell; **kein eingebautes Standardmodell** |
| Nur Server-Secret | `GOOGLE_ROUTES_API_KEY` | Bewusst eingerichteter Google-Routes-Zugang mit passender API-/Schlüsselbeschränkung, nur für Verkehr nötig |

Das gewählte KI-Modell muss den im Adapter verwendeten Chat-Completions-Aufruf mit JSON-Ausgabe und den dort gesetzten Grenzen unterstützen. Preise, Verfügbarkeit und Verarbeitung unterscheiden sich je Modell und Vertrag. Ein fehlender Key oder eine fehlende Modellwahl lässt den betreffenden Zweck unkonfiguriert. Die App erzeugt dafür keinen Ersatzschlüssel und wechselt nicht still zu einem anderen Modell.

Origins sind beispielsweise deine echte Web-Adresse und gegebenenfalls der tatsächlich verwendete Capacitor-Origin. Herkunftsprüfung ersetzt keine Authentifizierung: Die Funktion prüft den Bearer bei Supabase und verlangt zusätzlich die erlaubte Nutzer-ID. Ein fremder Origin, eine fehlende Anmeldung oder eine nicht erlaubte ID erhält keinen Anbieterzugriff.

## Datenbank und Function

Vor einer späteren bewussten Bereitstellung müssen die vorhandene Projektdatenbank und die Migration `supabase/migrations/20261106000002_assistant_budget.sql` geprüft sein. Die Migration legt `assistant_usage` und `claim_assistant_request` an:

- Row Level Security: Nutzer können nur ihre eigenen technischen Zähler lesen. Die App schreibt keine beliebigen Zählerzeilen direkt.
- Die Budgetfunktion verwendet `auth.uid()` und ist für `authenticated`, nicht für `anon` oder die Öffentlichkeit ausführbar. Ohne funktionierende Budgetprüfung geht der Adapter nicht am Schutz vorbei zum Anbieter.
- Atomare Tagesbudgets je Konto und Berliner Kalendertag: **8 KI-Anfragen, 6 Verkehrsprüfungen**. Sie begrenzen Anfragen, nicht Eurobeträge. Fehlgeschlagene oder abgebrochene Anbieteraufrufe können bereits Budget verbraucht haben.
- Die Funktion speichert Konto-ID, Zweck, Budgetdatum und Anzahl; kein Aufgaben-, Adress- oder Promptarchiv. Beim nächsten Budgetabruf desselben Kontos werden Zähler ab 14 Tagen Alter bereinigt. Ohne erneuten Abruf ist das keine automatische Löschung nach exakt 14 Tagen; eine feste periodische Löschung wäre gesondert einzurichten und nachzuweisen.

Die Function heißt **`assistant`**. Sie ist vom PC-Stopp-Dienst getrennt; dessen persönlicher PC-Token und dessen besondere Deployment-Option dürfen nicht als öffentliche Auth-Umgehung für Vorschläge übernommen werden. Server-Secrets gehören weder in `VITE_*` noch in Android-Ressourcen oder das Repository. Die App erhält nur die öffentliche Supabase-Konfiguration und ihren angemeldeten Nutzer-Token.

Bereitstellung, SQL-Ausführung, Anbieter-API-Aktivierung und Kostenkonten sind bewusste externe Einrichtungsschritte. Diese Anleitung führt keinen davon aus. Vor echtem Betrieb müssen Projekt, Berechtigungen, RLS, Origins, Nutzerliste, Kosten und aktuelle Anbieterbedingungen geprüft werden.

## Technischer Anfragevertrag

Der vorhandene Client verwendet `${VITE_SUPABASE_URL}/functions/v1/assistant` mit dem Supabase-Nutzer-Bearer und dem öffentlichen anon-Key. `GET` liefert ausschließlich die eingerichteten Fähigkeiten und Tagesgrenzen. `POST` nimmt genau einen zweckgebundenen, schemageprüften Auftrag an; die Typen liegen in `supabase/functions/_shared/assistanceProtocol.ts`.

- `kind: "steps"`: `revision`, bearbeitbarer `title`, `depth` als `three`, `normal` oder `tiny`; nur freiwillig gewählte `description` und `nextStep`.
- `kind: "route"`: `revision`, `origin`, `destination`, `mode`, ISO-Zeitpunkt `at` und `timing` als `departure` oder `arrival`. Ein Routenpunkt ist entweder eine ausdrücklich gewählte `address` oder ein Paar aus `latitude` und `longitude`.
- Die Antwort muss Zweck und `revision` des Auftrags wiedergeben. KI liefert editierbare Schritte, Routes eine Schätzung mit Quelle, Zeit-/Abrufbezug und Unsicherheitsmerkmalen. Der Client weist beschädigte, überholte oder abgebrochene Antworten zurück; das ist keine automatische Schreibberechtigung für den Tagesplan.

Diese Beschreibung sendet keine Beispielanfrage. Ein tatsächlicher Aufruf ist erst nach den genannten Einrichtungs- und Nutzerentscheidungen vorgesehen.

## Welche Inhalte verlassen das Gerät?

| Zweck | Empfänger und Inhalt | Bewusste Übernahme |
|---|---|---|
| Kleine Schritte | Dein Supabase-Server und OpenAI: bearbeitbarer Aufgabentext, Detailtiefe, nur separat gewählte Beschreibung/nächster Schritt. Keine automatische Zugabe übriger Aufgaben, Medikamente, Adressen oder Arbeitszeiten | Jeder Vorschlag ist editierbar. Erst die eigene Übernahme ersetzt offene Teile; erledigte Teile bleiben erhalten. Eine zwischenzeitlich bearbeitete Aufgabe wird nicht mit einer alten Antwort überschrieben |
| Fahrtschätzung | Dein Supabase-Server und Google Routes: freigegebener Start, Ziel, Verkehrsmittel und gewählter Zeitbezug. Keine kontinuierliche GPS-Spur | Abweichung und Aktualität ansehen, dann gegebenenfalls Fahrzeit übernehmen. Keine automatische Änderung harter Termine oder Wecker |

Private oder berufliche Daten können auch in deinem frei eingegebenen Text stehen. Prüfe deshalb die Vorschau selbst. Ausschalten oder Abbrechen kann bereits übertragene Inhalte nicht vom Anbieter zurückholen. Die App schreibt keine Rohinhalte in Fehlertexte oder eigene Server-Promptlogs; allgemeine Infrastruktur- und Anbieterprotokolle sind nach dem tatsächlichen Vertrag zu prüfen.

## Fachliche Grenzen der Fahrtschätzung

| Gewählter Modus | Umsetzung und Grenze |
|---|---|
| Auto (`driving`) | Google Routes `DRIVE` mit `TRAFFIC_AWARE`. Bei gewünschter Ankunftszeit nähert der Adapter die nötige Abfahrtszeit mit höchstens drei Provideraufrufen an. Das ist kein direktes Ankunftszeitversprechen; instabile Näherungen bleiben als unsicher markiert |
| ÖPNV (`transit`) | `TRANSIT`, mit Abfahrtszeit oder direkt unterstütztem Ankunftsziel. Angebot, Zeiten, Umstiege und Verfügbarkeit hängen vom Anbieter ab |
| Fahrrad (`cycling`) | `BICYCLE`; im aktuellen Adapter eine allgemeine Dauerschätzung ohne zeitabhängige Verkehrsvorhersage |
| Zu Fuß (`walking`) | `WALK`; im aktuellen Adapter eine allgemeine Dauerschätzung ohne zeitabhängige Verkehrsvorhersage |

Eine Auto-Ankunftsprüfung kann somit mehr als einen kostenpflichtigen Provideraufruf enthalten, obwohl sie ein App-Tagesbudget belegt. Kartenabdeckung, Verkehr und Wetter können danebenliegen. Der einfache **Route öffnen**-Link ist ein eigener manueller Weg: Er meldet der App keine Fahrzeit oder Ankunft zurück. Bei Fehlern bleiben manuelle Fahrzeiten bestehen; die App erfindet weder Null-Minuten-Wege noch eine sichere Ankunft.

## Aktuelle Bedingungen vor echter Aktivierung lesen

- OpenAI: [API-Preise](https://openai.com/api/pricing/), [Geschäftsbedingungen](https://openai.com/policies/business-terms/), [API-Datenverarbeitung](https://platform.openai.com/docs/guides/your-data).
- Google Maps Platform: [Preise](https://mapsplatform.google.com/pricing/), [Bedingungen](https://cloud.google.com/maps-platform/terms), [Routes-Dokumentation](https://developers.google.com/maps/documentation/routes).
- Zusätzlich gelten die Bedingungen und Kosten deines Supabase-/Hosting-Projekts.

Hier wird kein kostenloser Betrieb zugesagt. Vor einer späteren echten Anfrage gilt die aktuelle Anbieterinformation, nicht ein historischer Preis in dieser Datei. Geräteverhalten, realer Backendbetrieb und Produktwirksamkeit bleiben unterschiedliche Nachweise; ihren tatsächlichen Stand führen [Implementierungsplan](ANKER_IMPLEMENTIERUNGSPLAN.md) und [Testnachweise](ANKER_TESTNACHWEISE.md).
