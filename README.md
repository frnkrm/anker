# ⚓ Anker

Deine persönliche ADHS-Alltags-App: Sie sagt dir, **was jetzt dran ist**, plant den Tag rückwärts vom Arbeitsbeginn, erinnert freundlich und hartnäckig, weckt dich mit QR-Pflicht und macht aus Routinen ein Spiel ohne Bestrafung.

- **Android-App** (Capacitor) und **Web-Version/PWA** (Netlify, für den PC) aus derselben Codebasis
- **Offline zuerst:** Alles Wichtige läuft ohne Konto, ohne Server, ohne Internet
- **Optionale Extras:** Sync (Supabase), Google Kalender, Health Connect, PC-Stopp. Fallen sie aus, schalten sie sich still ab.
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

**Fertiges Update lokal signieren:** Ein vorbereitetes Updatepaket kann mit `scripts/sign-local-update.mjs` signiert werden, ohne das Projekt unter Windows neu zu bauen. Im Paket liegen der Helfer als `signieren.mjs`, ein CMD-Starter, das unsignierte APK und `update-info.json` mit dessen Prüfsumme, Paket/Version und dem vorher bestätigten öffentlichen Zertifikatsfingerabdruck. Benötigt werden die vorhandenen Node-, Java- und Android-Buildwerkzeuge sowie der **bisherige** lokale Debugschlüssel. Der Helfer erzeugt keinen Schlüssel, überträgt nichts und installiert nichts. Er prüft die neue Signatur und, falls vorhanden, die alte lokale APK; Android prüft beim Installieren zusätzlich die Kompatibilität zur tatsächlich installierten App. Ein abweichendes Schlüsselpasswort wird lokal geklärt, nicht im Chat geteilt.

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

**Sicherheit:** Jede Tabelle hat Row Level Security, jeder Nutzer sieht nur seine eigenen Daten. Die Edge Function liest nur die PC-Stopp-Zeit und sonst nichts. Vom PC-Token wird nur der SHA-256-Hash gespeichert.

### 3. Google Cloud (optional: Google Kalender)

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Anker“.
2. *APIs & Dienste → Bibliothek →* **Google Calendar API** aktivieren.
3. *OAuth-Zustimmungsbildschirm:* Typ **Extern**, App-Name „Anker“, deine E-Mail. Scopes `…/auth/calendar.readonly` und `…/auth/calendar.events` hinzufügen. Unter **Testnutzer** deine eigene Gmail-Adresse eintragen. Der Status „Testen“ reicht für dich allein.
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

### 9. PC-Stopp (Windows)

1. In der App: **Mehr → PC-Stopp → Paket für Windows herunterladen** (am besten in der Web-Version direkt auf dem PC).
   Bist du unter *Kalender & Sync* angemeldet, enthält das Paket einen persönlichen Token, und Verlängerungen kommen automatisch an. Sonst gilt die feste Zeit.
2. ZIP entpacken, **Rechtsklick auf `install.ps1` → „Mit PowerShell ausführen“**. Admin-Rechte sind nicht nötig.
3. Die Aufgabe „Anker PC-Stopp“ läuft alle 5 Minuten und bei der Anmeldung: Warnung 15 und 5 Minuten vorher, Meldung zur Stopp-Zeit, etwa 5 Minuten später Herunterfahren ohne Zwang. Ohne Internet gilt die zuletzt bekannte Zeit.
4. Für heute aussetzen: `pc-stop-abbrechen.ps1`. Entfernen mit `uninstall.ps1`.

---

## Datenschutz & Backup

- Daten liegen lokal: SQLite auf Android, IndexedDB im Browser.
- Termine, Orte, Arbeitsaufgaben und Einnahmeprotokoll werden nie synchronisiert.
- **Externe Dienste:** Wetter (Open-Meteo, standardmäßig aus, überträgt nur den gewählten Ort) und der Maps-Link (Adresse erst beim Antippen). Beide kostenlos und ohne Key. Details: [Flexible Planung](docs/FLEXIBLE_PLANUNG.md).
- **Mehr → Sicherung:** JSON-Export/-Import. Beim Import gewinnt pro Eintrag der neuere Stand.
- Sync (optional) nutzt last-write-wins pro Datensatz (`updated_at`).
- Keine Werbung, kein Tracking, keine Analytics. Werbe-IDs aus Abhängigkeiten werden im Android-Manifest entfernt, das Facebook-SDK ist ausgeschlossen.

## Dokumentation

- [Anleitung](docs/ANLEITUNG.md): Bedienung, Funktionen, bekannte Grenzen
- [Struktur des Repositorys](docs/STRUKTUR.md): wo liegt was, wo ändere ich was
- [Flexible Planung](docs/FLEXIBLE_PLANUNG.md): Zustände, Wege, Schlaf, externe Dienste
- [Geräteprüfung](docs/GERAETETEST.md): was auf dem Handy von Hand zu prüfen ist
- [Implementierungsplan](docs/ANKER_IMPLEMENTIERUNGSPLAN.md) und [ADHS-Designprinzipien](docs/ADHS_DESIGNPRINZIPIEN.md)
- [Testnachweise](docs/ANKER_TESTNACHWEISE.md): aktueller E00-Stand, Regressionen und offene Gerätegrenzen
- [Patch Notes](CHANGELOG.md): was sich in welcher Version geändert hat
- [CLAUDE.md](CLAUDE.md): Architektur und Regeln für spätere Claude-Sessions

## Gleitzeit

Spätester Beginn, eigener Freitag, flexible Pausen und einzelne Kundeneinsätze am Wochenende, alles freiwillig und lokal: [docs/GLEITZEIT.md](docs/GLEITZEIT.md).
