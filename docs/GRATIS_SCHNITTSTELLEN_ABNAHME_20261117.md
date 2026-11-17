# Kostenlose Schnittstellen: echte Abnahme am17.11.2026

## Tatsächlicher Stand

F-013/F-014 sind serverseitig eingerichtet und im angemeldeten lokalen Browserclient
gegen echte Anbieter geprüft. Kein Backend-Mock, keine Test-Identität, keine bezahlte
Aktivierung. Die Google-signierte Handy-App bleibt bis zum Store-Update Code17.
Das ist kein nachträglicher nativer Gerätebeleg für diese beiden UI-Wege.

- Supabase-Free-Projekt, eigene bestehende Anmeldung, explizite Benutzer-Allowlist.
  Datensync und Kalenderzugriff blieben aus. Fähigkeitencheck: beide Anbieter
  eingerichtet, Grenzen8KI-/6Routenanfragen pro Tag.
- Erste KI-Probe scheiterte geschlossen, Aufgabe blieb unverändert. Inhaltsfreie
  Diagnose bestätigte HTTP404 für Gemini2.5Flash-Lite. Google beschränkt 2.5-Zugriff
  auf vorher aktive Projekte; neues festes Modell ist Gemini3.1Flash-Lite (Stable,
  geprüftes Free Tier), ohne bezahlten Ersatz oder automatische Modellrotation.
- Echte KI-Probe mit öffentlichem harmlosen Text zum Packen einer Fototasche:
  drei bearbeitbare Schritte eingetroffen, Übernehmen ohne eigene Prüfbestätigung
  gesperrt. Vorschlag verworfen und ausschließlich die lokale Probeaufgabe entfernt.
- Echte App→Supabase→TomTom-Probe mit den öffentlichen Berliner Koordinaten aus der
  TomTom-Dokumentation, Auto/Ankunftsziel17.11.22:50Berlin: Vorschlag6Minuten.
  Manuelle10Minuten, Termin und feste Weck-/Abendzeiten unverändert. Vorschlag
  verworfen, lokale Prüffahrt abgesagt. Keine private Adresse und keine Ortung.
- Lokale KI-/Verkehrsfreigaben und Abrufmerker danach gelöscht, automatische
  Fahrtschätzungen blieben aus. Echte Kontingentzähler nicht zurückgesetzt.
- Temporären Assistant-Origin und lokalen Login-Callback wieder entfernt. Nur
  ursprüngliche Native-Origins und zusätzlich freigegebener fester Android-Callback
  bleiben; alte Webdomain erhalten. Ursprünglicher Origins-Digest bytegleich bestätigt.
- Eigene eindeutig zugeordnete neue Testsitzung samt Refresh-Tokens gezielt beendet;
  zwei ältere Sitzungen erhalten. Kein globales Abmelden anderer Geräte. Lokale
  Prüftabs geschlossen und Testserver beendet.

## Implementierung und automatische Nachweise

Minimaler serverseitiger Modellwechsel; Metadaten und HTTP-Modell nutzen dieselbe
Konstante. Neue Betriebsdiagnose enthält ausschließlich festen Ereignistyp, Anbieter
und HTTP-Status. Niemals URL, Schlüssel, Header, Aufgaben-, Adress- oder Antworttext.
Zwei Regressionen prüfen diese Informationsgrenze und das Auslassen erfolgreicher
sowie Auth-/Budgetaufrufe. Sieben gezielte Provider-/Diagnosefälle und TypeScript
bestanden. Lint0Fehler/1bestehendeRef-Cleanup-Warnung; vollständige neue CI wird separat gelesen.

Tatsächlicher Server nach Aufräumen: assistant ACTIVE,v6, unveränderte eigene
Authentifizierung über /auth/v1/user, Benutzer-Allowlist und SQL-Budget. Gateway-
JWT-Prüfung bleibt wie zuvor aus, weil der Handler selbst authentifiziert. Codehash
3f419412c35d0d8a106f0b9bdbfac2a8ffad0df074702fe90c8cdcafbb11483b.
Schlüssel ausschließlich im Secretstore, keine neuen Schlüssel erzeugt. TomTom-
Schlüssel nur für Routing/Geocoding; Freemium-Konto ohne Zahlungsdaten.

## Quellen und Releasegrenze

- [Google:2.5-Zugriff und Modelllebenszyklus](https://aistudio.google.com/docs/deprecations)
- [Google:Gemini3.1Flash-Lite Stable](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite)
- [Google:aktuelles Free Tier](https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite)
- [TomTom:Gratis-Kontingente](https://docs.tomtom.com/pricing)

Appquelle für Code18 bleibt9bc717985ca6c9fadb13c0dbb38b0ba3d427715c; diese Korrektur
ändert ausschließlich den Server und zugehörige Prüfungen/Dokumentation. Der
vorhandene Client nimmt das bestätigte Modell über die Fähigkeitenantwort an.
Releasepolicy aus PR15 ist als ce07450700707b1abf57036c3a4b05100f48c6f8 integriert;
eigene main-CI44164946645 grün. Secretfreier AAB-Prepare44167654681 läuft separat.
Signieren/Upload/Freigabe nur anhand tatsächlicher Folgebelege bestätigen; Play-
Uploadschlüssel laut Console weiterhin erst18.11.22:41Berlin gültig.

## Tatsächlich fertig signiertes Code18-Artefakt

[Maschinenlesbarer vollständiger Auslieferungsbeleg](CODE18_AUSLIEFERUNGSBELEG_20261117.json).
Prepare44167654681/1 und Sign+Verify44169177734/1 erfolgreich auf gleicher
Policyce07450. Finales Artefakt14367656025, SHA256f4d3796b…f666382,
54.615.244Bytes; Final-Proof-SHA923c8cc3…e96941a. Vorhandener privater Actions-
Schlüssel hat die exakte Prüfung gegen das heruntergeladene Google-Uploadzertifikat
48:79…00:A3 bestanden.677Nutzlasteinträge, genau1RSA-Signierer,SHA256withRSA,
Nutzlast unverändert. Neuer Code18-Publisher zusätzlich lokal mit echtem finalem
AAB, Manifest-/Native-/JAR-Prüfung und jarsigner -verify -strict erfolgreich ausgeführt;
dabei keine Google-Anfrage und kein privater Schlüssel auf dem PC.

[Finales geprüftes GitHub-Artefakt](https://github.com/frnkrm/anker/actions/runs/44169177734/artifacts/14367656025)
bleibt7Tage verfügbar. Bestehende einmalige Automation erhält konkrete IDs/Hashes;
kein erneuter Build nötig, sofern Provenienz/Verfügbarkeit/Signatur frisch bestätigt
werden. Uploadworkflow muss seine eigene aktuelle main-SHA und erfolgreiche CI
binden; das Signierartefakt bleibt an ce07450 gebunden. Keine zusätzlichen
Produktänderungen in die feste Appquelle mischen.

Noch kein Play-Upload, interne Freigabe oder Store-Update bestätigt. Der von Google
angekündigte Schlüsseltermin18.11.22:41ist weiterhin eine reale Zeitgrenze. Die
Ausführung am18.11.22:50soll intern aktiv freigeben und danach frisch nachlesen,
Code16/17im neuen Release behalten, bei Konflikt/unklarem Commit ohne Wiederholung
stoppen. Handy bleibt Google-signierter Code17; keine Deinstallation/USB-Installation.
