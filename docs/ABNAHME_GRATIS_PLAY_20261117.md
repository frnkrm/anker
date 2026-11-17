# Geräteabnahme, kostenlose Schnittstellen und Code18 (17.11.2026)

Arbeitsweise: autonom und effizient gemäß ARBEITSWEISE.md. Keine erneute Produkt-UI-Phase.

## Geprüfte Appquelle

PR14 wurde nach ausdrücklicher Nutzerfreigabe integriert. Appquelle
`9bc717985ca6c9fadb13c0dbb38b0ba3d427715c`, eigene main/push-CI
[44144640024](https://github.com/frnkrm/anker/actions/runs/44144640024) erfolgreich.
Vorheriger PR-Lauf44013093571: 387 Browserfälle,1434 TS-Fälle, PC290/2ausgenommen;
Android281 lokale Unitfälle getrennt. Die Quelle bleibt Code18/1.5.0-rc.4.

## Tatsächliches Android-Gerät

Auf ausdrückliche Freigabe isolierte Prüf-App mit eigener Paketkennung installiert,
keine Produktionsdaten übernommen. Tatsächlicher Mikrofon-/Bewegungsdienst etwa21s:
311 Audioblöcke,977 Bewegungsereignisse,2gültige/0fehlende Zusammenfassungen.
Keine Tondateien gespeichert. Optionale reine Bildschirmsperre wurde ausgelöst;
Keyguard gesperrt und Display nicht interaktiv. Daraus wurde kein Schlaf und keine
Erledigung abgeleitet. Messung gestoppt; Nutzer entsperrte selbst. Geräteadministrator
anschließend deaktiviert, Mikrofonrecht nicht mehr erteilt, Prüf-App deinstalliert.
Produktions-App blieb Google-signierter Code17; kein Datenverlust/USB-Update.
Jetzt, gruppiertes Heute-anpassen und Suche zu Hobbys auf echtem Android beobachtet.
Eine ganze Messnacht, Schlafhinweis-/Weck-/QR-Abläufe und visuelle PC-Abnahme sind
hierdurch ausdrücklich nicht vollständig abgenommen.

## Kostenlose Schnittstellen

Bestehendes Supabase-Projekt im Free-Plan. Nur bestehende assistant_budget-Migration
angewendet, keine zusätzliche Sync-/Datenschemamigration. Kontingent-RPC unter
transaktionalem Rollback geprüft:8Schritt-/6Routenanfragen erlaubt, nächste abgewiesen,
ungültiger Zweck abgewiesen, keine Probezeilen behalten; RLS aktiv, anon ohne EXECUTE.
Assistant Edge Function v1 aus unveränderter Appquelle eingerichtet. Gateway-JWT-Prüfung
aus, da der Handler selbst /auth/v1/user und eine explizite eigene Benutzer-Allowlist
prüft (moderne Publishable Keys). Ohne Anmeldung401, fremder Origin403 beobachtet.
Bestehender Gemini-Schlüssel nach ausdrücklicher Freigabe ausschließlich serverseitig
hinterlegt; Free-Plan-Bestätigung und eigene Benutzer-/Native-Origin-Allowlist gesetzt.
Kein Anbieter-/Service-Role-Schlüssel in App, Git oder Protokollen.
Ein authentifizierter echter Gemini-Aufruf ist noch offen; kein Gesamterfolg behauptet.
TomTom-Registrierung und serverseitige Schlüsselablage ausdrücklich freigegeben.
Nutzer hat Passwort/Registrierung selbst abgeschlossen; Portal zeigt Freemium.
Automatisch angelegten bestehenden Schlüssel auf Geocoding API/Routing API begrenzt,
NameAnker Fahrzeiten, keine Rotation/neuer Schlüssel, keine Zahlung/Upgrade.
TOMTOM_API_KEY im bestehenden Supabase-Secretstore gespeichert und Namen nachgelesen.
Echter TomTom-Maps-v1-API-Explorer-Aufruf mit diesem Schlüssel auf öffentliche
Dokumentationskoordinaten: HTTP200,2.280m/385s am17.11.20:31Berlin. Keine privaten
Adressen. Das bestätigt den Providerzugang, noch keinen authentifizierten kompletten
App→Supabase→Provider-Rückweg. Origin-/Nutzer-/Tagesbudgetgates bleiben aktiv.
[Offizielle aktuelle Preise](https://docs.tomtom.com/pricing): jeweils20.000 monatliche
Gratisanfragen für Routing/Geocoding; kein kostenpflichtiger Ersatz. Eigener bisheriger
Serverdeckel6Routen/Tag und höchstens2Geocodes pro Route bleibt deutlich darunter.

## Releasebindung und Schutzgrenzen

Lokales unsigned AAB aus9bc7179 mit öffentlicher Supabase-Konfiguration gebaut und
mit Bundletool/JAR-/Native-Prüfern geprüft:54.551.397Bytes,
SHA256`53e3235a4c8feb43e26a590fb4a918580c9df67a704149586ac35115d694bcec`.
Nach-Capacitor-Sync-Fingerprint
`f595199f70ff101f11a164156d96f55d941f1a40ce756e284419640bb31f64ec`.
Kanonischer Manifestpin
`e41f769f6f9efe90ba45ec9cacfb673d43c4f03e949bf6d2095631bb0b1287bf`.
Geprüftes Manifestdelta: optionaler SleepLockAdmin-Receiver mit BIND_DEVICE_ADMIN;
31uses-permissions unverändert. Kein lokales Signieren/Upload als Erfolg ausgegeben.

AAB-Prüfworkflow nun an diese feste Quelle, deren eigene main-CI und neue Kennung
gebunden. Öffentliche Serverkonfiguration aus Repositoryvariablen ausschließlich
im unsigned Build, nicht aus privaten Secrets. Vor npm ci verlangt der Build zusätzlich
die konkrete freigegebene Projekt-URL und einen modernen sb_publishable_-Schlüssel;
Secret-/Service-Role-Werte werden dadurch nicht versehentlich in die App eingebaut. Signatur-/Payload-/16KB-/Lauf-/Versuchs-
und Artefaktprüfungen bleiben erhalten. Neue Code18-Auslieferung strikt manuell/main,
standardmäßig interner Entwurf; interner aktiver Test erfordert die gesonderte
RELEASE_CODE18_INTERNAL-Wahl. Bestehender Code17-Weg unverändert. Exakte finale
Artefakt-ID, Signierlauf/-versuch, Workflow-SHAs, AAB-/Proof-Hashes nötig. Unklarer
Upload/Commit wird nicht wiederholt; kein stiller Code19, kein Production-/Testerpfad,
keine Reviewabbrüche. Im Entwurf bleibt der aktive Code16/17-Release bytegleich erhalten. Bei der
internen Aktivierung werden16/17 gemäß Googles TrackRelease-Vertrag ausdrücklich
in versionCodes des neuen abgeschlossenen Releases16/17/18 aufgenommen; kein
vorheriges aktives Bundle wird entfernt. Zwei konkurrierende completed-Releases
werden nicht gesendet. Das folgt dem bereits vorhandenen Code17-Aktivierungsweg
und [Google TrackRelease](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks).

Console hat neuen Uploadschlüssel weiterhin in Bearbeitung angezeigt, gültig erst
18.11.2026 22:41Berlin. Neuer Uploader blockiert zusätzlich vor diesem Zeitpunkt.
Bestehende einmalige Automation18.11.22:50 wird an die aktuellen konkreten Nachweise
angepasst, keine zweite Automation. Tatsächlichen akzeptierten Uploadschlüssel dann
nochmals mit dem vorhandenen Signierschlüssel vergleichen.

## Prüfstand dieser Fortsetzung

15 neue Offline-Tests für Code18-Auslieferung bestanden; inklusive Freigabe-/Hash-/
Zeit-/Konflikt-/Erhaltungs-/Wiederholungsgrenzen sowie Workflowtrennung.
Lokale bestehende AAB-Suite41:39bestanden,2Windows-Unverträglichkeiten (ZIP-Writer
normalisiert Backslashes; Python-Unterprozess mit bewusst minimaler Linux-Umgebung).
Workflow-SDK-Suite benötigt echte Linux-Pfade/symlinks; volle Bestätigung über eigene
Linux-CI erforderlich. Keine Tests übersprungen oder Gates gelockert. Lokales echtes
unsigned AAB unabhängig mit aktualisierter Policy erfolgreich geprüft.

## Anmelderückkehr

Tatsächliche Supabase-URLkonfiguration erlaubte nur die alte Webdomain. Nach
konkreter Nutzerfreigabe native Rückkehr de.frnkrm.anker.mobile://login ergänzt,
bestehende Site-URL/Web-Allowlist erhalten. Für echte lokale Prüfung vorübergehend
http://localhost:4173/verbindungen und entsprechender Assistant-Origin freigegeben.
Anmelde-Link wurde im lokalen App-Prüfstand erfolgreich versandt; Nutzer öffnet ihn
selbst. Lokale Freigaben und Testsession nach Abschluss wieder entfernen.
