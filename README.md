# ⚓ Anker

Deine persönliche ADHS-Alltags-App: Sie bietet dir **einen nächsten Schritt**, plant mit deinen Arbeitszeiten und Terminen, erinnert und unterstützt Routinen ohne Bestrafung. Du darfst spontan umplanen, Freizeit genießen und pausieren.

**E04–E09 in Entwicklung.** Diese Anleitung beschreibt den erweiterten Entwicklungsstand. Implementierung, automatische Prüfungen und echte Android-Geräteberichte sind getrennt im [Implementierungsplan](docs/ANKER_IMPLEMENTIERUNGSPLAN.md) und den [Testnachweisen](docs/ANKER_TESTNACHWEISE.md) dokumentiert. Ein erfolgreicher Build bestätigt weder Weck-Hörbarkeit noch funktionierende Standort- oder Sprachdienste auf deinem Handy.

- **Android-App** (Capacitor) und **Web-Version/PWA** (Netlify, für den PC) aus derselben Codebasis
- **Offline zuerst:** Alles Wichtige läuft ohne Konto, ohne Server, ohne Internet
- **Optionale Extras:** Sync, Kalender, Health Connect, Wetter, PC-Stopp, lokale Sprache, besuchsbezogene Standorthinweise sowie KI- und Verkehrsvorschläge. Sensible neue Extras beginnen ausgeschaltet. Ein Ausfall ändert keinen erledigten Schritt und lässt manuelle Wege verfügbar; Freigaben werden nicht still erteilt.
- Keine Werbung, kein Tracking, keine Analytics

> Anker ersetzt keine ärztliche Beratung. Anlaufstellen findest du in der App unter **Mehr → Hilfe**.

---

## Schnellstart (nur das Nötigste)

1. APK aufs Handy (siehe [APK installieren](#7-apk-installieren)), öffnen
2. Arbeitsbeginn, Fahrzeit, Thema wählen → **„Passt, los geht’s“**
3. Zwei Berechtigungen erlauben: Benachrichtigungen, pünktliche Wecker
4. Fertig. Alles andere ist optional und kann später kommen.

---

## Entwicklung

Voraussetzungen: Node.js 24, für Android zusätzlich JDK 21 und Android SDK (Platform 36).

```bash
npm install
npm run dev          # Web-Version auf http://localhost:5173
npm test             # Logik-Tests (Vitest)
npm run test:e2e     # Smoke-Test der Web-Version (Playwright)
npm run lint
npm run build        # Typecheck + Produktions-Build nach dist/
npm run android:debug  # Web bauen, nach Android kopieren, Debug-APK bauen
node scripts/gradle.mjs :app:testDebugUnitTest  # Kotlin-Logik (JUnit)
```

Die Debug-APK liegt danach unter `android/app/build/outputs/apk/debug/app-debug.apk`.

**Fertiges Update lokal signieren:** Ein vorbereitetes Updatepaket kann mit `scripts/sign-local-update.mjs` signiert werden, ohne das Projekt unter Windows neu zu bauen. Benötigt werden Node, Java17 oder neuer und der **bisherige** lokale Debugschlüssel; ein Android-SDK ist ab Signierhilfe2 nicht mehr nötig. Im Paket liegen CMD-Starter, unsigniertes APK und `update-info.json` mit Prüfsummen, Paket/Version und dem bestätigten öffentlichen Zertifikatsfingerabdruck. `tools/` enthält die unveränderte Apache-2.0-Bibliothek apksig8.13.0 mit Lizenz/Herkunft sowie den aus `scripts/AnkerApkTool.java` mit `javac --release 17` kompilierten lokalen Helfer und dessen Quelltext. JAR und Klasse werden vor Ausführung per SHA256 geprüft. Der Helfer erzeugt keinen Schlüssel, überträgt nichts und installiert nichts. Er prüft die neue Signatur und, falls vorhanden, die alte lokale APK; Android prüft beim Installieren zusätzlich die Kompatibilität zur tatsächlich installierten App. Ein abweichendes Schlüsselpasswort wird lokal geklärt, nicht im Chat geteilt.

Umgebungsvariablen: `.env.example` nach `.env` kopieren und ausfüllen. **Alle sind optional.** Ohne sie läuft Anker komplett offline.

---

## Einrichtung Schritt für Schritt

### 1. GitHub

1. Auf github.com ein **privates** Repository `anker` anlegen (ohne README).
2. Lokal verbinden und hochladen:
   ```bash
   git remote add origin https://github.com/frnkrm/anker.git
   git push -u origin main
   ```
3. Bei jedem Push laufen automatisch Lint, Typecheck, Tests, Build und der Smoke-Test (`.github/workflows/ci.yml`).

### 2. Supabase (optional: Sync + PC-Stopp mit Verlängerung)

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. **Datenbank:** Im Dashboard → *SQL Editor* den Inhalt von `supabase/migrations/20261028000001_init.sql` ausführen.
   Alternativ mit der CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <projekt-ref>
   npx supabase db push
   ```
3. **Edge Function** `pc-stop` deployen (prüft den PC-Token selbst, deshalb ohne JWT-Prüfung):
   ```bash
   npx supabase functions deploy pc-stop --no-verify-jwt
   ```
4. **Login per Magic Link:** *Authentication → URL Configuration*
   - *Site URL:* deine Netlify-Adresse, z. B. `https://anker-frnkrm.netlify.app`
   - *Redirect URLs:* `https://anker-frnkrm.netlify.app/verbindungen` und `de.frnkrm.anker://login`
5. *Project Settings → API:* `Project URL` und `anon public` Key in `.env` eintragen:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Der anon-Key darf in die App, die Daten sind per Row Level Security geschützt. Den `service_role`-Key **niemals** in die App oder ins Repo.

**Sicherheit:** Die Tabellen verwenden Row Level Security. Die Funktion `pc-stop` liefert dem PC nur den datierten Stopp-/Pausenauftrag, keine Aufgaben oder Orte. Vom PC-Token wird nur der SHA-256-Hash gespeichert. Die gesonderte Funktion `assistant` hat einen eigenen authentifizierten Zugriff für ausdrücklich gewählte Vorschlagsinhalte.

### 2a. KI- und Verkehrsvorschläge (optional, externe Einrichtung offen)

Der Client und die echte Supabase-Edge-Function `assistant` sind implementiert. Ein App-Build richtet noch keinen Anbieter ein und aktiviert keine kostenpflichtige API. Ohne Serverkonfiguration bleiben die lokalen Teilschritt-Vorlagen und deine manuellen Fahrzeiten nutzbar.

Der genaue, inaktive [Einrichtungsvertrag für optionale Dienste](docs/OPTIONALE_DIENSTE.md) beschreibt Konfigurationsnamen, Datenbank-/Authgrenzen, Routenmodi und offene Echtanbieterprüfungen. Antworten eines kontrollierten Testbackends bestätigen keinen echten Anbieterbetrieb.

- **App:** vorhandene `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`, gültige Anmeldung. Datensync muss dafür nicht eingeschaltet sein.
- **Server:** Budgetmigration `supabase/migrations/20261106000002_assistant_budget.sql`, Function `assistant`, erlaubte Konten über `ANKER_ASSISTANT_USER_IDS` und erlaubte Ursprünge über `ANKER_ASSISTANT_ORIGINS`. API-Schlüssel ausschließlich als Server-Secrets: `OPENAI_API_KEY` zusammen mit `ANKER_AI_MODEL` beziehungsweise `GOOGLE_ROUTES_API_KEY`. Kein Provider-Schlüssel gehört in `VITE_*`, die App oder ins Repository. Das PC-Token-Verfahren gilt ausschließlich für `pc-stop`.
- **In der App:** *Einstellungen → Optionale Vorschläge → Verbindung prüfen*. Der Check sendet keine Aufgaben oder Adressen und aktiviert nichts. KI und Verkehr brauchen jeweils eine eigene Kosten-/Datenfreigabe. Eine Verkehrsfreigabe schaltet automatische Prüfungen nicht mit ein.
- **Inhalte:** KI erhält nur den vorab bearbeitbaren Text mit gewählter Detailtiefe und freiwillig angehakten Zusatzfeldern. Routes erhält nur die ausdrücklich freigegebenen Fahrtdaten. Antworten bleiben Vorschläge; Übernahme und Weckzeitänderung sind eigene bestätigte Schritte.
- **Kosten und Daten:** [OpenAI-Preise](https://openai.com/api/pricing/), [OpenAI-Bedingungen](https://openai.com/policies/business-terms/), [Google-Maps-Preise](https://mapsplatform.google.com/pricing/) und [Maps-Bedingungen](https://cloud.google.com/maps-platform/terms) vor echter Aktivierung prüfen. Die Servergrenzen von 8 KI-Anfragen und 6 Verkehrsprüfungen je Konto/Tag sind keine garantierte Geldobergrenze; ein Routenauftrag kann mehrere begrenzte Anbieterabfragen benötigen.

Die App protokolliert auf dem Server keine Aufgaben-/Adress-Prompts. Technische Tageszähler enthalten Konto, Zweck, Datum und Anzahl. Die Budgetfunktion bereinigt beim nächsten Abruf desselben Kontos Einträge ab 14 Tagen Alter; ohne weiteren Abruf ist das keine garantierte Löschfrist. Anbieterbedingungen und etwaige Plattformprotokolle sind zusätzlich zu beachten. Bereitstellung, Schlüssel, Abrechnung und echter Anbieterbetrieb sind gesonderte Einrichtungsschritte und hier noch nicht als durchgeführt nachgewiesen.

### 3. Google Cloud (optional: Google Kalender)

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Anker“.
2. *APIs & Dienste → Bibliothek →* **Google Calendar API** aktivieren.
3. *OAuth-Zustimmungsbildschirm:* Typ **Extern**, App-Name „Anker“, deine E-Mail. Lesen nutzt `https://www.googleapis.com/auth/calendar.readonly`. Erst für bewusst gewählte Schreibfunktionen kommt `https://www.googleapis.com/auth/calendar.app.created` hinzu; geschrieben wird nur in Ankers eigenen Kalender. Unter **Testnutzer** deine eigene Gmail-Adresse eintragen. OAuth-Einrichtung und tatsächlicher Rückweg auf Android müssen mit deinem Projekt und Signaturschlüssel geprüft werden.
4. *Anmeldedaten → OAuth-Client-ID erstellen:*
   - **Webanwendung:** Autorisierte JavaScript-Quellen: `http://localhost:5173` und deine Netlify-Adresse. Die Client-ID kommt in `.env`:
     ```
     VITE_GOOGLE_WEB_CLIENT_ID=1234-abc.apps.googleusercontent.com
     ```
   - **Android:** Paketname `de.frnkrm.anker`, dazu der **SHA-1-Fingerabdruck** deines Signaturschlüssels:
     ```bash
     # Release-Schlüssel (siehe Abschnitt 5)
     keytool -list -v -keystore anker.keystore -alias anker
     # Debug-Schlüssel (für Debug-APKs)
     cd android && ./gradlew signingReport
     ```
     Für Debug und Release jeweils einen eigenen Android-Client anlegen, falls du beide nutzt. Die Android-Client-ID wird nicht eingetragen, Google ordnet sie über Paketname + SHA-1 zu.

### 4. Netlify (Web-Version für den PC)

1. [app.netlify.com](https://app.netlify.com) → *Add new site → Import from GitHub* → Repo `anker`.
2. Build-Einstellungen kommen automatisch aus `netlify.toml` (`npm run build`, Ordner `dist`).
3. *Site configuration → Environment variables:* dieselben `VITE_*`-Werte wie in `.env`, dazu `VITE_PUBLIC_URL=https://<deine-seite>.netlify.app`.
4. Deploy. Im Browser lässt sich Anker als App installieren (Chrome/Edge: Installieren-Symbol in der Adressleiste).

### 5. Keystore erzeugen (für signierte Release-APKs)

Einmalig, gut aufbewahren (Passwort-Manager). **Nie ins Repo**, `.gitignore` schließt `*.keystore` aus.

```bash
keytool -genkeypair -v -keystore anker.keystore -alias anker -keyalg RSA -keysize 2048 -validity 10000
```

**Lokal signieren:** Datei `android/keystore.properties` anlegen (ist in `.gitignore`):
```
storeFile=../../anker.keystore
storePassword=…
keyAlias=anker
keyPassword=…
```
Dann `cd android && ./gradlew assembleRelease`.

**Über GitHub Actions:** Keystore als Base64 kodieren (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("anker.keystore")) | Set-Content anker.keystore.b64
```
Im Repo unter *Settings → Secrets and variables → Actions* anlegen:

| Secret | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Inhalt von `anker.keystore.b64` (danach Datei löschen) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore-Passwort |
| `ANDROID_KEY_ALIAS` | `anker` |
| `ANDROID_KEY_PASSWORD` | Schlüssel-Passwort |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_PUBLIC_URL` | optional, wie in `.env` |

Release erstellen:
```bash
git tag v1.0.0
git push origin v1.0.0
```
Die signierte APK hängt danach am GitHub-Release (`.github/workflows/release.yml`).

### 6. Paketname ändern (falls nötig)

Zentral in `app.config.ts`, außerdem `namespace`/`applicationId` in `android/app/build.gradle`, das Java/Kotlin-Paket unter `android/app/src/main/java/` und die Redirect-URL in Supabase.

### 7. APK installieren

1. APK auf dem Handy öffnen (aus dem GitHub-Release herunterladen oder per USB kopieren).
2. Samsung fragt nach „Unbekannte Apps installieren“ → für den Browser bzw. „Eigene Dateien“ erlauben.
3. Updates: neue APK einfach drüber installieren, die Daten bleiben erhalten (gleicher Signaturschlüssel nötig).

### 8. Handy-Berechtigungen (Samsung Galaxy, One UI)

In der App: **Mehr → Einrichtungs-Check**. Dort zeigen Ampeln, was eingerichtet ist, und Knöpfe führen direkt in die richtige Einstellung.

| Was | Warum | Pflicht? |
|---|---|---|
| Benachrichtigungen | Erinnerungen | ja |
| Wecker & Erinnerungen (exakte Alarme) | Ab Android 13 fest erteilt, darunter hier erlauben | ja |
| Vollbild-Benachrichtigungen | Wecker über dem Sperrbildschirm | empfohlen |
| Akku: „Nicht optimiert“ | Samsung beendet sonst Hintergrund-Apps | empfohlen |
| „Nie schlafende Apps“ | *Einstellungen → Akku → Hintergrund-Nutzungslimits → Nie schlafende Apps → Anker* | empfohlen |
| Nicht stören: Ausnahme | Wecker klingelt auch bei „Nicht stören“ | empfohlen |
| QR-Scanner | wird einmalig von Google Play geladen | für den Wecker |
| Health Connect | Training automatisch abhaken (nur Lesen) | optional |
| Widget | Homescreen lange drücken → Widgets → Anker | optional |

Mehr zu Samsung und Hintergrund-Apps: [dontkillmyapp.com/samsung](https://dontkillmyapp.com/samsung)

**Wecker-QR-Code:** *Mehr → Wecker & QR-Code → Drucken* (oder *Mehr → Druckansicht*), ausdrucken, im Bad aufhängen. Danach einmal **„Wecker testen“** antippen und Handy sperren.

**Weckerprüfung:** Native Folgetage und Wiederherstellung sind implementiert; frühere Geräteberichte bestätigen nur die jeweils genannten Builds und Teilfälle. Neue Weckerkorrekturen und das Aktivitäts-Weckfenster bleiben geräteoffen. **Mehr → Gemeinsam testen** führt mit direkten Einstellungswegen durch [die Geräteprüfung](docs/GERAETETEST.md). Lass dabei einen unabhängigen Wecker gestellt. **Drucken:** Auf Android öffnet *Drucken oder als PDF speichern* den Systemdialog, im Browser `window.print()`.

**Gemeinsam testen:** Die App führt durch den jeweils aktuellen Katalog mit direkten Einstellungswegen. E04–E09 ergänzt eine gemeinsame Prüfrunde; einzelne Detailversuche und frühere Berichte bleiben erhalten. Testseitenbesuch und Build setzen keine Geräte-Häkchen. Neue Android-Laufzeit-, Sprach-, Standort- und Papiernachweise stehen weiterhin aus.

### 9. PC-Stopp (Windows)

1. In der App: **Mehr → PC-Stopp → Paket für Windows herunterladen** (am besten in der Web-Version direkt auf dem PC).
   Mit Anmeldung kann das Paket einen persönlichen Token für deinen Server enthalten. Die App zeigt, ob der gewünschte Auftrag bereitgestellt wurde; Empfang und spätere Ausführung am PC sind dadurch nicht bestätigt. Ohne Server verwendet ein neu erstelltes Paket eine ausdrücklich gewählte feste Zeit.
2. ZIP entpacken, **Rechtsklick auf `install.ps1` → „Mit PowerShell ausführen“**. Admin-Rechte sind nicht nötig.
3. Die Windows-Aufgabe ruft den datierten Auftrag ab: Warnung 15 und 5 Minuten vorher, zur Stopp-Zeit eine echte Schonfrist von 5 Minuten, dann Herunterfahren ohne Zwang. Ohne Netz kann ein noch gültiger letzter Auftrag gelten; ein abgelaufener Auftrag darf nicht still zum nächsten Abend werden.
4. Für heute aussetzen: `pc-stop-abbrechen.ps1`. Entfernen mit `uninstall.ps1`.

Unter *PC-Stopp → Abendzeit ändern* kannst du frei verlängern oder das Ende offenlassen. Ein offenes Ende pausiert den datierten Stoppauftrag. **Dafür brauchen Windows-Paket und Serverfunktion Protokoll 2.** Alte Installationen können weiter nach ihrem alten Auftrag abschalten; lade das neue Paket und prüfe es am PC. Eine Änderung in der App bestätigt keinen PC-Empfang.

---

## Datenschutz & Backup

- Daten liegen lokal: SQLite auf Android, IndexedDB im Browser.
- Termine, Orte, Arbeitsaufgaben und Einnahmeprotokoll werden nie synchronisiert.
- **Wetterort, Ortsfreigaben, Packlisten und Vorschlagsfreigaben** sind lokale Daten. Sync überträgt den Wetterort und seine Aktivierung nicht; frühere Serverstände werden dadurch nicht rückwirkend gelöscht.
- **Externe Dienste:** Wetter nur nach Wahl eines lokalen Wetterorts; Maps öffnet erst beim Antippen. KI, Routes und Android-/Google-Standorthinweise haben eigene Freigaben und unterschiedliche Empfänger. Daten und Grenzen: [Flexible Planung](docs/FLEXIBLE_PLANUNG.md).
- **Mehr → Sicherung:** unverschlüsselter JSON-Export mit bewusst abwählbaren sensiblen Gruppen und Importvorschau vor der Übernahme. Beim Import gewinnt pro Eintrag der neuere Stand; ausgelassene Gruppen einer Teilsicherung löschen vorhandene Daten nicht.
- Sync (optional) nutzt last-write-wins pro Datensatz (`updated_at`).
- Keine Werbung, kein Tracking, keine Analytics. Werbe-IDs aus Abhängigkeiten werden im Android-Manifest entfernt, das Facebook-SDK ist ausgeschlossen.

## Dokumentation

- [Anleitung](docs/ANLEITUNG.md): Bedienung, Funktionen, bekannte Grenzen
- [Struktur des Repositorys](docs/STRUKTUR.md): wo liegt was, wo ändere ich was
- [Flexible Planung](docs/FLEXIBLE_PLANUNG.md): Zustände, Wege, Schlaf, externe Dienste
- [Optionale Dienste](docs/OPTIONALE_DIENSTE.md): KI-/Routes-Konfiguration, Freigaben, Kosten und fachliche Grenzen
- [Geräteprüfung](docs/GERAETETEST.md): was auf dem Handy von Hand zu prüfen ist
- [Implementierungsplan](docs/ANKER_IMPLEMENTIERUNGSPLAN.md) und [ADHS-Designprinzipien](docs/ADHS_DESIGNPRINZIPIEN.md)
- [Testnachweise](docs/ANKER_TESTNACHWEISE.md): tatsächliche automatische Nachweise und offene Gerätegrenzen
- [Patch Notes](CHANGELOG.md): was sich in welcher Version geändert hat
- [CLAUDE.md](CLAUDE.md): Architektur und Regeln für spätere Claude-Sessions

## Gleitzeit

Spätester Beginn, eigener Freitag, flexible Pausen und einzelne Kundeneinsätze am Wochenende, alles freiwillig und lokal: [docs/GLEITZEIT.md](docs/GLEITZEIT.md).

### PC-Scriptprüfung in der Entwicklung

`npm run test:pc` benötigt zusätzlich PowerShell (`pwsh` im PATH oder `PWSH_PATH` mit absolutem Programmpfad). Der eigene CI-Schritt führt die exportierten Scripts mit simulierten Uhrzeiten/Systemaktionen unter PowerShell aus. Eine fehlende Laufzeit bricht diesen Befehl ab; `npm test` bleibt der normale Logiklauf. Windows-Aufgabenplanung, Toasts und echte Abschaltung werden dadurch nicht geprüft.
