# Anker v7 – Codex-Auftrag: PC-Begleiter, Abend & Morgen

Nov 9, 2026 · @Franky

## 00 Direkter Auftrag an Codex

Baue einen Windows-PC-Begleiter für Anker, der den Abend dort begleitet, wo die Aufmerksamkeit tatsächlich ist: am PC. Verbinde ihn mit der bestehenden App und ergänze wenige, recherchierte Abend-, Morgen- und Darstellungsfunktionen.

**Produktmaßstab:** Zur geplanten Zeit kommt der Nutzer ohne Kampf vom PC weg. PC und Handy kennen denselben Abendplan, und morgens fällt das Aufstehen zur geplanten Zeit leichter. Nichts davon darf strafen, Erledigungen vortäuschen oder heimlich überwachen.

**Arbeitsmodus:** Weiterentwicklung des bestehenden Repositorys `frnkrm/anker`, kein Neubau. Alle Regeln aus `docs/auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v6.md` gelten weiter, besonders 00.3 (Rangfolge), 01.2–01.5 (Audit, Git, Fortschritt), 02.3 (UX-Grenzen) und 15–17 (Etappen, Tests, Doku). Dieser Auftrag ergänzt v6 und ersetzt ihn nicht.

### Zuerst lesen, dann den echten Code prüfen

1. `CLAUDE.md` (Architektur, Konventionen, Fallstricke) – auch wenn Codex sie nicht automatisch lädt.
2. `docs/ANKER_IMPLEMENTIERUNGSPLAN.md` und `docs/ANKER_TESTNACHWEISE.md` (aktueller Stand, Nachweisformat).
3. `docs/STRUKTUR.md`, `docs/ANLEITUNG.md` (Abschnitt PC-Stopp), `docs/ADHS_DESIGNPRINZIPIEN.md`, `docs/UI_GLOSSAR.md`.
4. Den gesamten PC-Stopp-Pfad: `src/core/pcStop.ts`, `src/core/export/pcstop.ts`, `supabase/functions/_shared/pcStopProtocol.ts`, `supabase/functions/pc-stop/index.ts`, `src/platform/supabase.ts`, `src/ui/pages/PcStop.tsx`, `scripts/test-pc-stop.mjs`, `scripts/test/pc-stop.runtime.ps1`.
5. Abend-/Schlafpfad: `src/core/now.ts`, `src/core/sleep.ts`, `src/core/sleepDiary.ts`, `src/core/evening.ts`, `src/core/game/evaluate.ts`, `src/core/reminders/build.ts`, `src/platform/effects.ts`, `src/platform/qr.ts`.

### Lieferumfang und Priorität

| Modul | Inhalt | Priorität |
| --- | --- | --- |
| PC | Windows-Begleiter (Tauri 2), Kopplung per QR, Protokoll v3, Empfangsbestätigung, Abendablauf am PC | Pflicht |
| AB | Abendhilfen am PC und Handy: Speicherpunkt, sanfte Bildschirmdämmerung, ehrliche Verlängerung, Wenn-dann-Plan | Pflicht (AB-01 bis AB-04, AB-07), Rest Soll |
| MO | Morgenhilfen: Licht-Schritt, Rhythmus-Ansicht, Losgeh-Countdown am PC, optional Schlafdaten aus Health Connect | Soll, Health Connect Kann |
| VI | Sichtbare Zeit: Zeitbogen auf „Jetzt“ und im Tray, Wochenrhythmus | Soll |
| Relay | Optionaler verschlüsselter Weg über Supabase, wenn kein gemeinsames WLAN besteht | Kann |

Pflicht = nötig für „v7 fertig“. Soll = danach in dieser Reihenfolge. Kann = nur nach grünen Gates und ohne neue Pflichtdienste.

### Nicht-Ziele

- Kein Überwachen von Fenstertiteln, Programmnamen, URLs, Bildschirminhalten oder Tastatureingaben. Der Begleiter kennt nur Leerlaufzeit und Sperr-/Abmelde-/Energieereignisse.
- Kein erzwungenes Beenden von Programmen, kein `shutdown /f`, keine Sperre ohne Ausweg.
- Keine Änderung an Weckerlogik in `AlarmModel.kt`/`AlarmController.kt`, außer ein Test zeigt einen echten Fehler.
- Keine Medikamenten-, Melatonin- oder Dosierhinweise, keine Schlafphasen- oder Diagnoseaussagen.
- Kein neuer Pflichtdienst, kein Konto-Zwang, keine Analytics, keine kostenpflichtige Codesignatur ohne Freigabe.
- Zunächst nur Windows 10/11 (x64). macOS/Linux nicht bauen, aber Plattformcode sauber kapseln.
- Kein Push, Merge, Tag, Release oder Deployment ohne ausdrückliche Freigabe. Release-Signatur und App-Kennung `de.frnkrm.anker.mobile` bleiben unverändert.

**Konfliktregel:** Der tatsächliche Code bestimmt, *wie* du integrierst; dieser Auftrag bestimmt, *was* fachlich gilt. Echte Konflikte dokumentierst du im Implementierungsplan und wählst eine umkehrbare Lösung.

## 01 Geprüfter Ist-Stand

Anker 1.4.0-rc.1 / Code 14 (`main`, Commit `0084063`) hat bereits einen einseitigen PC-Stopp. v7 macht daraus eine zweiseitige, sichtbare Verbindung und erhält den alten Weg als Rückfall. Prüfe jede Aussage dieser Tabelle am aktuellen Code, bevor du darauf baust.

| Bereich | Ist-Stand (Datei / Symbol) | Grenze, die v7 adressiert |
| --- | --- | --- |
| Stack | React 19, TypeScript 5.9 strict, Vite 8, Tailwind 4, Zustand 5, Capacitor 8, Kotlin; Dexie (Web), SQLite (Android); `targetSdk`/`compileSdk` 36, `minSdk` 26 | – |
| PC-Stopp v2 | ZIP mit PowerShell-5.1-Skripten aus `src/core/export/pcstop.ts`; Aufgabenplanung alle 5 min und bei Anmeldung; Abruf von `{version:2, date, mode, revision, validUntil, stopAt?, localTime?}` per Header `x-anker-token` bei der Edge Function `pc-stop`; datumsgebundener Cache; Hinweise T−15/T−5, 5 min Schonfrist, `shutdown /s /t 0` ohne Zwang | Kein Rückkanal: App zeigt überall „Empfang nicht bestätigt“. 5-min-Raster. Toasts ohne Knöpfe. Aussetzen nur per Skript. Ohne Server nur feste Zeit |
| Server | `supabase/migrations/20261028000001_init.sql` (`pc_stop`, `pc_stop_tokens`, nur SHA-256-Hash), `functions/pc-stop` | Laut Doku ist keine reale Supabase-Instanz eingerichtet. v7 darf Supabase nicht voraussetzen |
| Tageslog | `DayLog.pcOffAt`, `bedAt`, `wakeAt`; `store.mark(date, field, at?)`; Knopf „PC ist aus“ in `Now.tsx` | „PC ist aus“ wird immer von Hand getippt |
| Spiel | Ziel „PC-Stopp eingehalten“: `pcOffAt <= plan.pcStop + PCSTOP_TOLERANCE` (5 min) in `src/core/game/evaluate.ts` | Echte PC-Ereignisse könnten das ehrlich belegen |
| Plan | `DayPlan.pcStop`, `bed`, `openEnd`; Plantag wechselt um 04:00 (`activePlanDate`, `pcPlanDate`); Standard `pcStop = bed − sleep.screenOffMin` (30) | – |
| Abendhilfen | Sanfter Abendübergang `support.windDown`, Android-Schlafhinweis `bedtimePrompt`, Schlafüberblick `sleepDiary`, „Morgen hier weitermachen“, „Länger wach“ (`DayOverride.lateUntil`) | Alles am Handy; der PC als Ort des Aufschiebens bleibt stumm |
| Morgen | Nativer Wecker mit QR/Rechnen/Notfall-Stopp, Vorwecker, Wachheits-Check, experimentelles Aktivitäts-Weckfenster, Morgenroutine im Fokus | Kein Licht-Schritt, keine Rhythmus-Sicht, kein PC-Bezug im Homeoffice |
| QR | `scanQr()` in `src/platform/qr.ts` (ML Kit) | Für die Kopplung wiederverwenden |
| Health Connect | Nur `READ_EXERCISE`/`READ_STEPS`; `READ_SLEEP` im Manifest per `tools:node="remove"` entfernt | Optionaler Schlafimport wäre eine bewusste neue Freigabe |
| Web/PWA | Netlify-Version für den PC | Kann weder herunterfahren noch im Hintergrund laufen |
| Tests | Vitest (`TZ=UTC`, Logik rechnet Berlin), Playwright gegen Produktionsbuild, JUnit, PowerShell-Harness `npm run test:pc`; CI auf `ubuntu-latest` | Kein Windows-Runner, kein Rust |
| Agentenregeln | Keine `AGENTS.md` im Repo (v6-Audit) | Codex lädt `CLAUDE.md` nicht automatisch |

Frühere Codex-Läufe konnten Leitlinien und Konkurrenzseiten nicht abrufen (HTTP 403). Die Recherche in Abschnitt 02 wurde am 09.11.2026 tatsächlich gelesen; du musst sie nicht wiederholen, darfst sie aber ergänzen.

**Wiederverwenden statt neu bauen:** Planer (`buildDayPlan`), `buildPcStopCommands`, `pcPlanDate`, `validPcStopCommand`, Store-Aktionen und Schreibqueue, `scanQr`, `Sheet`/`Card`/`Button` aus `ui.tsx`, Farb-Tokens aus `src/index.css`, die Nachweisformate der bestehenden Docs.

## 02 Recherche-Ergebnisse (gelesen am 09.11.2026)

Der Abend scheitert bei ADHS oft dort, wo Zeitreize verloren gehen: beim Spielen am PC. Deshalb gehört der Abendhinweis auf den PC-Bildschirm, nicht nur aufs Handy. Morgens zählen ein fester Weckanker und Licht.

Kein Befund belegt einen Nutzen von Anker selbst. Übernimm die Evidenzstufen in `docs/ADHS_DESIGNPRINZIPIEN.md` (klinisch / Hypothese) und schreibe nie „wissenschaftlich bewiesen“ in die App.

| Befund | Quelle | Art | Konsequenz für Anker |
| --- | --- | --- | --- |
| Schlafprobleme bei bis zu 80 % der Erwachsenen mit ADHS, verspätetes Schlaf-Wach-Timing bei bis zu 78 %; Melatonin-Beginn (DLMO) bei Erwachsenen etwa 90 min später. Kausalität offen | [Luu & Fabiano 2025, Frontiers in Psychiatry](https://www.frontiersin.org/articles/10.3389/fpsyt.2025.1697900/full) | Perspektive/Übersicht | Später Rhythmus ist häufig und kein Versagen. Weckanker und Morgenlicht unterstützen, keine Therapieaussage |
| Morgendliches helles Licht (10.000 Lux, 30 min, 2 Wochen) verschob DLMO um 31 min und Schlafmitte um 57 min nach vorn; Verschiebung korrelierte mit weniger Symptomen. Protokoll: Deckenlicht ab 16 Uhr reduzieren | [Pilotstudie, J Psychiatr Res 2017 (PubMed 28327443)](https://pubmed.ncbi.nlm.nih.gov/28327443/) | Kleine Pilotstudie ohne Kontrolle | MO-01 Licht-Schritt am Morgen; AB-05 optionaler Abendlicht-Hinweis. Keine Wirkzusage |
| Höherer Gaming-Schweregrad und Abendtyp hingen jeweils mit mehr Schlafaufschub zusammen (51 Spielende mit ADHS-Symptomen; zusammen 44,6 % Varianz) | [Aktürk 2026, Bağımlılık Dergisi](https://turkmedline.net/detay/internet-gaming-disorder-severity-and-chronotype-in-relation-to-bedtime-procrastination-among-adults-with-adhd-symptoms-reporting-regular-digital-game-engagement/2d706351716f8e7f/tr/53) | Querschnitt, Pilot | Der PC ist der richtige Ort für den Abendreiz: Modul PC hat Vorrang |
| Wenn-dann-Vorsätze allein wirkten in Vorarbeiten nicht, vermutlich weil Zeitreize beim Spielen/Fernsehen verloren gehen. Vorgeschlagen: Lampen dimmen zur geplanten Bettzeit als Umgebungsreiz | [Nauts et al. 2016, European Health Psychologist (Poster)](https://www.ehps.net/ehp/index.php/contents/article/view/2169) | Poster, Ergebnis offen | AB-02 sanfte Bildschirmdämmerung am PC als Umgebungsreiz. Hypothese |
| MCII (Wunsch → bestes Ergebnis → eigenes Hindernis → Wenn-dann-Plan) senkte in zwei randomisierten Studien die Tagebuch-Abweichung von der geplanten Bettzeit um etwa 33–38 min pro Nacht; subjektiver Aufschub und Schlafdauer änderten sich nicht | [Valshtein, Oettingen & Gollwitzer 2020, Psychology & Health](https://www.psy.uni-hamburg.de/arbeitsbereiche/paedagogische-psychologie-und-motivation/personen/oettingen-gabriele/dokumente/valshtein-oettingen-gollwitzer-2020-bedtime-procrastination.pdf) | 2 RCTs, Studierende | AB-04 optionaler Wenn-dann-Abendplan mit eigenem Hindernis. Ehrlich messen: geplant vs. tatsächlich, kein Versprechen von mehr Schlaf |
| „Night Shift“ (wärmerer Bildschirm) änderte den Schlaf bei 167 jungen Erwachsenen nicht; anregende Tätigkeiten zählen vermutlich mehr | [Duraccio et al. 2021, Sleep Health (Bericht)](https://www.managedhealthcareexecutive.com/view/-night-shift-feature-on-iphone-does-not-help-sleep-quality-say-researchers) | Studie, 3 Gruppen | Dämmerung ist ein Signal zum Übergang, kein Blaulicht-Heilversprechen. Den Übergang selbst erleichtern (AB-01 Speicherpunkt) |
| Regelmäßigkeit des Schlafs (SRI) hängt stärker mit Sterblichkeit zusammen als Schlafdauer (60.997 UK-Biobank-Teilnehmende, Aktigrafie) | [Zuraikat et al., Editorial zu Windred et al. 2024, Sleep](https://pmc.ncbi.nlm.nih.gov/articles/PMC10782489) | Beobachtungsstudie | VI-02 Rhythmus-Ansicht betont gleichmäßige Aufstehzeit. Kein Score, keine Serie |
| Zwei Wochen Dämmerungssimulation verbesserten die Alertness-Komponente der Aufmerksamkeit bei 56 Jugendlichen; Schlafzeiten unverändert | [Tonetti et al. 2015, Eur J Appl Physiol](https://rd.springer.com/article/10.1007/s00421-014-3033-4) | Within-Subject | MO-05 Lichtwecker nur als Machbarkeitsnotiz. Hypothese |
| Windows schaltet „Nicht stören“ auf Wunsch automatisch beim Spielen und bei Vollbild-Apps ein; dann kommen nur Banner für Wecker, Erinnerungen und gewählte Apps | [Microsoft Support](https://support.microsoft.com/windows/feeca47f-0baf-5680-16f0-8801db1a8466) | Herstellerdoku | PC-07: Nie nur auf Toasts verlassen. Eigenes Overlay, optional Ton, Hinweis auf Prioritätsliste; Zustand per [`SHQueryUserNotificationState`](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate) |
| Tauri 2 hat offizielle Plugins für Autostart, globale Tastenkürzel, Einzelinstanz, Benachrichtigung, Updater, Store. Benachrichtigungs-Aktionen gibt es nur mobil; unter Windows nur für installierte Apps | [Tauri: Plugins](https://v2.tauri.app/plugin/), [Notification](https://v2.tauri.app/plugin/notification/) | Herstellerdoku | Knöpfe gehören in eigene Fenster, nicht in Toasts. Installer (NSIS) Pflicht |
| Android 17 (API 37) erzwingt Schutz des lokalen Netzes: Apps mit `targetSdk` 37 brauchen `ACCESS_LOCAL_NETWORK` (auch für `NsdManager`, TCP ins LAN; WebView erbt). Bis `targetSdk` 36 vorübergehend impliziter Zugriff über `INTERNET`. Alternative: NSD-Systemauswahl | [Android Developers](https://developer.android.com/privacy-and-security/local-network-permission) | Herstellerdoku | PC-04 funktioniert heute ohne neue Berechtigung; Weg für API 37 jetzt vorbereiten und Ablehnung sauber behandeln |
| Smart App Control blockiert unbekannten, unsignierten Code, außer er ist mit einem Zertifikat aus dem Trusted Root Program signiert | [Microsoft Learn](https://learn.microsoft.com/windows/apps/develop/smart-app-control/overview) | Herstellerdoku | PC-12: Installationsgrenzen ehrlich dokumentieren. Signatur ist eine Kostenentscheidung des Nutzers |
| Focus Bear (ADHS/Autismus) startet eine Fokus-Sitzung gleichzeitig auf Computer und Handy; Notausgang bewusst mit Reibung | [Focus Bear](https://www.focusbear.io/), [Closing the Gap, 2026](https://www.closingthegap.com/focus-bear-a-calm-structured-way-to-block-distractions-and-see-the-whole-day/) | Produkt | Übernehmen: geräteübergreifend derselbe Zustand. Nicht übernehmen: strafende Reibung. Anker bleibt beim ehrlichen, leichten Ausweg |
| Health Connect liefert Schlafsitzungen über das vorhandene Plugin: `readSamples({ dataType: 'sleep' })`, Phasen nur falls vorhanden, etwa 30 Tage Rückblick | [@capgo/capacitor-health README](https://cdn.jsdelivr.net/npm/@capgo/capacitor-health@8.7.0/README.md) | Bibliotheksdoku | MO-03 optional: Vorschlag für den Schlafüberblick, nur nach eigener Freigabe |

## 03 Zielbild und verbindliche Architekturentscheidungen

Das Handy bleibt der einzige Planer; der PC-Begleiter empfängt nur datierte Zeitpunkte, führt sie sichtbar aus und meldet zurück, was wirklich passiert ist. Die Verbindung läuft im Heim-WLAN ohne Konto und ohne Server.

&#91;embedded content: Architektur · Handy, PC-Begleiter, optionales Relay\]

Das Handy schickt nur Zeitpunkte; der PC bestätigt sofort in der Antwort und liefert seine Ereignisse beim nächsten Kontakt. Das klassische PowerShell-Paket bleibt daneben als Rückfall (D10).

### Bausteine

| Baustein | Ort im Repo | Aufgabe |
| --- | --- | --- |
| Protokoll v3 „Anker-Link“ (Referenz) | `src/core/pcLink/` (neu): Typen, Validierung, Briefing aus `DayPlan`, Ereignis-Abbildung, Fixtures | Reine Funktionen mit Vitest. Einzige fachliche Quelle für App und PC |
| Krypto und Transport im Handy | `src/platform/pcLink.ts` (neu), Kotlin `PcLinkTransport.kt` + Methoden in `AnkerNativePlugin.kt`/`native.ts` | WebCrypto für Schlüssel und Umschlag; Kotlin nur für gepinntes HTTPS ins LAN und mDNS-Suche |
| App-Oberfläche | `src/ui/pages/PcStop.tsx` (Route `/pc-stopp` bleibt), neue Bausteine in `src/ui/components/` | Kopplung, ehrlicher Verbindungsstatus, Ereignisse übernehmen, PC-Abend-Einstellungen |
| PC-Begleiter | `desktop/` (neu): `desktop/src-tauri/` (Rust) und `desktop/src/` (React-UI) | Tray, Abendablauf, Herunterfahren ohne Zwang, LAN-Server, Kopplungs-QR, Ereignisse |
| Klassisches Windows-Paket | `src/core/export/pcstop.ts` (unverändert lauffähig) | Rückfall ohne Begleiter; Protokoll v2 bleibt |
| Optionales Relay | `supabase/` (Kann, P09) | Gleicher verschlüsselter Umschlag, wenn kein gemeinsames WLAN besteht |

### Entscheidungen

| ID | Entscheidung | Begründung | Verworfen |
| --- | --- | --- | --- |
| D1 | PC-Begleiter mit **Tauri 2** (Rust + WebView2), nur Windows 10/11 x64 | Offizielle Plugins für Tray, Autostart, Hotkey, Einzelinstanz; React/TS-Oberfläche; kleine Installer | PowerShell erweitern (keine Oberfläche, kein Rückkanal), Electron (groß), .NET (keine TS-Wiederverwendung), PWA (kann nicht herunterfahren, läuft nicht im Hintergrund) |
| D2 | **Kein zweiter Planer.** Das Handy rechnet, der PC vergleicht nur „jetzt“ mit gelieferten Zeitpunkten | Gleiche Regel wie beim Kotlin-Spiegel in `CLAUDE.md`; verhindert Abweichungen | Planlogik in Rust nachbauen |
| D3 | Protokoll v3 als TS-Referenz plus gemeinsame JSON-Fixtures; der Rust-Port muss dieselben Fixtures bestehen | Eine Wahrheit, zwei Laufzeiten, ein Test-Satz | Getrennte Spezifikationen |
| D4 | **Pflicht-Transport: LAN.** PC = HTTPS-Server mit selbstsigniertem Zertifikat, dessen SHA-256 im Kopplungs-QR steht; Handy = Client über Kotlin mit Zertifikats-Pinning | WebView darf von `https://localhost` nicht per HTTP ins LAN (Mixed Content); kein Server nötig; passt zu „Offline zuerst“ | Klartext-HTTP (Android blockiert ohne globale Ausnahme), Supabase als Pflicht |
| D5 | Kopplung per QR **am PC angezeigt, vom Handy mit `scanQr()` gelesen**, danach Bestätigung am PC | Wiederverwendung des vorhandenen Scanners; physische Nähe als Vertrauensanker | Manuelle Codes, Cloud-Konto |
| D6 | Ende-zu-Ende-Umschlag: ECDH P-256 → HKDF-SHA-256 → AES-256-GCM, ein Schlüssel pro Richtung, Sequenznummern | Läuft mit WebCrypto ohne neue App-Abhängigkeit; derselbe Umschlag passt später durchs Relay | Nur TLS (Relay wäre lesbar), eigene Kryptografie |
| D7 | **Richtungen:** Handy schiebt bei jeder Planänderung und beim App-Start ein Briefing; die Bestätigung kommt in derselben Antwort. PC-Ereignisse holt das Handy beim nächsten Kontakt ab (Outbox) | Handy kann im Hintergrund keinen Server betreiben | Dauerverbindung, Push-Dienste |
| D8 | Web/PWA koppelt nicht; dort steht ein Hinweis auf die Android-App | Browser darf weder gepinnt noch ins private Netz | – |
| D9 | Datenordner des Begleiters = Tauri-App-Datenordner zur Kennung `de.frnkrm.anker.desktop`, **nie** `%LOCALAPPDATA%\Anker` | `uninstall.ps1` des klassischen Pakets löscht diesen Ordner komplett | Gemeinsamer Ordner |
| D10 | Klassisches Paket und Begleiter dürfen nie beide herunterfahren. Findet der Begleiter die Aufgabe „Anker PC-Stopp“, warnt er und bietet das Entfernen an; bis dahin zeigt er nur Hinweise und fährt selbst nicht herunter | Doppelte Abschaltung und widersprüchliche Zeiten vermeiden | Stilles Entfernen fremder Installationen |
| D11 | Begriffe: „PC-Begleiter“, „gekoppelt“, „vom PC bestätigt“, „Speicherpunkt“, „PC-Ruhe“. In `docs/UI_GLOSSAR.md` ergänzen | Konsistente, ehrliche Sprache | „verbunden“ für bloß gespeicherte Daten |

**Abhängigkeiten:** Neue Pakete nur in `desktop/` (eigene `package.json` und `Cargo.toml`). In der Haupt-App keine neue npm-Abhängigkeit; WebCrypto, `fflate` und vorhandene Capacitor-Plugins reichen. Jede neue Rust-Crate begründest du im Plan (Zweck, Lizenz, Pflege). Erwartbar: `tauri` 2 mit `tray-icon`, `tauri-plugin-autostart`, `-global-shortcut`, `-single-instance`, `-notification`, `-store`, `axum`/`hyper` mit `rustls`, `rcgen`, `mdns-sd`, `p256`, `hkdf`, `aes-gcm`, `sha2`, `chrono-tz`, `serde`, `windows`.

## 04 Modul PC: PC-Begleiter und Anker-Link

PC-01 bis PC-13 sind Pflicht, PC-14 ist Kann. Jede Anforderung gilt erst als implementiert, wenn Bedienweg, Speicherzustand und Fehlerfälle funktionieren und die genannten Szenarien aus Abschnitt 10 automatisch geprüft sind.

### PC-01 Projektstruktur und Build

- Neuer Ordner `desktop/` mit eigener `package.json`, `vite.config.ts`, `tsconfig.json` und `src-tauri/` (Cargo, `tauri.conf.json`, Kennung `de.frnkrm.anker.desktop`, Produktname „Anker PC-Begleiter“, eigene SemVer ab `0.1.0`).
- Die Desktop-UI importiert reine Module aus `../src/core/` (nur `core`, nie `state`, `platform` oder `ui` der App) und die Farb-Tokens aus `src/index.css`.
- Root-Skripte ergänzen: `desktop:dev`, `desktop:build`, `desktop:test` (über `npm --prefix desktop`). `npm test`, `npm run build` und die bestehende CI dürfen dadurch nicht langsamer oder abhängig von Rust werden.
- ESLint und TypeScript strict gelten auch in `desktop/`; Rust mit `cargo fmt --check` und `cargo clippy -- -D warnings`.

* Rust als Cargo-Workspace: `desktop/crates/anker-link-core` (rein, ohne Tauri: Protokoll, Krypto, Abendlogik, Server, Plattform-Traits mit Mocks) und `desktop/src-tauri` (Tauri-App mit Windows-Implementierung der Traits). Linux-Tests und `test:link` bauen nur den Kern und brauchen keine WebKit-Systempakete; die Tauri-App baut der Windows-Job.
* Root-`eslint.config.js`: `desktop/dist`, `desktop/src-tauri/target` und `desktop/src-tauri/gen` ignorieren. Root-Vitest (`src/**/*.test.ts`) und die Quellkennung in `vite.config.ts` bleiben unverändert; Desktop-Tests laufen nur über `desktop:test`.

### PC-02 Protokoll v3 „Anker-Link“

TS-Referenz in `src/core/pcLink/` (Typen, `validate*`, `seal`/`open` über eine injizierbare Krypto-Schnittstelle, `buildPcBriefing`, Ereignis-Abbildung). Spezifikation zusätzlich in `docs/PC_LINK_PROTOKOLL.md`. Gemeinsame Fixtures in `src/core/pcLink/fixtures/` (gültige und ungültige Nachrichten, Krypto-Testvektoren mit festen Schlüsseln/Nonces, Plantag- und Sommerzeitfälle); der Rust-Port lädt dieselben Dateien in `cargo test`.

Umschlag (jede Nachricht, beide Richtungen):

```json
{ "v": 3, "kind": "anker-link", "pair": "<pairingId>", "from": "phone", "seq": 42,
  "sentAt": "2026-11-09T20:03:00.000Z", "nonce": "<base64url, 12 Byte>", "ct": "<base64url>" }
```

- Schlüssel: `ikm = ECDH-P256(eigenerPrivat, fremderPublic)`; je Richtung `HKDF-SHA256(ikm, salt = Kopplungsgeheimnis, info = "anker-link v3 phone->pc" | "anker-link v3 pc->phone")` → AES-256-GCM.
- AAD = kanonisches JSON (sortierte Schlüssel, ohne Leerzeichen) von `v, kind, pair, from, seq, sentAt`. Nonce zufällig. Empfänger lehnt `seq` ≤ zuletzt akzeptierter `seq` derselben Richtung ab; Lücken sind erlaubt.
- Grenzen: Umschlag ≤ 64 KiB, Texte ≤ 500 Zeichen, unbekannte Felder ablehnen, Zeitstempel nur ISO-8601 mit Zone (wie `pcStopProtocol.ts`).

* Publickeys als unkomprimierter SEC1-Punkt (65 Byte, base64url); `ikm` ist die 32-Byte-x-Koordinate (WebCrypto `deriveBits(…, 256)`, RustCrypto `diffie_hellman().raw_secret_bytes()`). Die Testvektoren belegen, dass beide Seiten byte-gleich ableiten.
* Schlüsselpaare je Kopplung neu erzeugen und nach der Ableitung verwerfen. Gespeichert werden nur die zwei AES-Richtungsschlüssel, der Zertifikats-Pin und die Zähler: am Handy in einem eigenen lokalen Datensatz außerhalb von Sync und JSON-Sicherung (zusätzlich per Android Keystore verschlüsselt, falls ohne großen Umbau möglich), am PC per DPAPI. Langlebig am PC ist nur der TLS-Schlüssel.

Nutzlasten im Klartext von `ct`:

| Typ | Richtung | Inhalt |
| --- | --- | --- |
| `briefing` | Handy → PC | `revision`, `generatedAt`, `days[]` für bis zu 14 Plantage: `date`, `validUntil`, `pc` (`{mode:"scheduled", stopAt, localTime}` oder `{mode:"paused"}`), optional `bedAt`, `wakeAt`, windDownAt, `morning {leaveAt?, workStartAt?, homeOffice}`, `ifThen {text}`; dazu `prefs` (Vorlauf `[15,5]`, Schonfrist 5, Fenster 6 h, Dämmerung, Zeitpille, Ton, Speicherpunkt-Frage, Morgen-Countdown, `offlinePolicy` `pause`/`fixed-time`, `eventsAuto`, bedAfterStopMin) |
| `ack` | PC → Handy (Antwort) | `revision`, `receivedAt`, `effective {date, mode: scheduled \| paused \| suspended-today \| legacy-conflict, stopAt?}`, `companion {version, protocol}`, `warnings[]` |
| `command` | Handy → PC | `id`, `action`: `resume-today`, `test-evening`, `ping`, `unpair` |
| `pull` / `events` | Handy → PC / Antwort | `after` (Cursor) / `items[]`, `lastSeq` |
| `event` | PC → Handy (Outbox) | `id`, `at`, `date` (Plantag), `kind`: `pc-rest`, `pc-resumed`, `extended`, `suspended-today`, `resumed-today`, `shutdown-started`, `shutdown-blocked`, `save-point`, `thought`, `unpaired`; optional `basis` (`anker-shutdown`, `user-shutdown`, `sleep`, `lock`, `logoff`, `idle`), `newStopAt`, `text`, `nextStep` |

### PC-03 Kopplung per QR

1. Begleiter zeigt auf Wunsch „Mit Handy koppeln“ einen QR-Code: `{"t":"anker-pc-pair","v":3,"id":pairingId,"n":PC-Name,"k":PC-Publickey,"c":TLS-SHA256,"s":Kopplungsgeheimnis (32 Byte),"a":["IP:Port"],"e":Ablauf}` als base64url-JSON. Gültig 10 Minuten, einmalig.
2. App: *PC → Mit PC koppeln* öffnet `scanQr()`, erzeugt ein eigenes Schlüsselpaar und sendet `POST /v3/pair` mit Publickey, Gerätename und `HMAC-SHA256(Kopplungsgeheimnis, "pair|" + id + "|" + Publickey)`.
3. Beide Geräte zeigen denselben 4-stelligen Prüfcode (aus beiden Publickeys abgeleitet). Erst „Ja, koppeln“ am PC schließt ab; die App fragt `GET /v3/pair/{id}` ab.
4. Entkoppeln geht auf beiden Seiten; die andere Seite erfährt es beim nächsten Kontakt (`unpair`-Befehl bzw. Ereignis) und löscht ihre Schlüssel. Eine Kopplung verbindet genau ein Handy mit genau einem PC. Mehrere PCs sind möglich, je mit eigener Kopplung; das Briefing geht an jeden erreichbaren gekoppelten PC.

### PC-04 Transport im Heimnetz

- PC: HTTPS-Server (rustls) auf Port 47830 (einstellbar), Zertifikat ECDSA P-256 von `rcgen`, bleibt bis zum bewussten Zurücksetzen gleich. Anfragen nur aus privaten Adressbereichen. Endpunkte: `GET /v3/hello` (Version, PC-Name, ob Kopplung offen; keine Geheimnisse), `POST /v3/pair`, `GET /v3/pair/{id}`, `POST /v3/link` (jeder Umschlag; Antwort ist wieder ein Umschlag). Keine CORS-Header.
- PC bewirbt `_anker-link._tcp` per mDNS (`mdns-sd`) mit minimalem TXT (`v=3`, gekürzte Geräte-ID).
- Android: neue Kotlin-Klasse `PcLinkTransport` mit `HttpsURLConnection`, eigenem `X509TrustManager`, der **nur** das Blattzertifikat mit dem gepinnten SHA-256 akzeptiert, und einem Hostname-Prüfer, der nur nach erfolgreichem Pin durchlässt. Kein Rückfall auf Systemvertrauen, kein Klartext. Reine Pin-Prüfung als `PcLinkModel` mit JUnit.
- Plugin-Methoden (TS und Kotlin synchron, wie `CLAUDE.md` verlangt): `pcLinkRequest({url, method, body, pinSha256, timeoutMs})`, `pcLinkDiscover({timeoutMs})` über `NsdManager`.
- Adressreihenfolge: zuletzt erfolgreich → Adressen aus dem QR → mDNS-Ergebnis; je 3 s Zeitlimit.
- Android 17: Anker zielt auf `targetSdk` 36 und hat damit vorübergehend impliziten LAN-Zugriff. Bereite den Wechsel vor (Manifest-Eintrag `ACCESS_LOCAL_NETWORK` erst mit `targetSdk` 37, Laufzeitfrage, sauberer Fehlerzustand bei `EPERM`/Timeout, optional NSD-Systemauswahl), aktiviere ihn aber nicht vorzeitig.

### PC-05 Briefing und ehrliche Empfangsbestätigung

- Reine Funktion `buildPcBriefing(plans, settings, prefs, now)` aus den Ergebnissen von `buildDayPlan` für 14 Plantage; der `pc`-Teil nutzt `buildPcStopCommands` (gleiche Semantik, gleiche Revisionslogik).
- Senden: nach Planänderungen über `src/platform/effects.ts` (gedrosselt, höchstens alle 30 s, bewusste Abendänderungen sofort), beim App-Start/Resume und über „Jetzt abgleichen“. Vorher immer erst Ereignisse abholen (PC-08), damit eine PC-Verlängerung nicht überschrieben wird.
- Status in `LocalData` (nicht synchronisiert): `unpaired`, `paired-never-reached`, `confirmed`, `unreachable`, `rejected`, `companion-outdated`.
- Texte: „Vom PC bestätigt um 21:03 · PC-Stopp 22:30“. Nicht erreichbar: „PC gerade nicht erreichbar. Zuletzt bestätigt um 21:03: 22:30. Neue Änderungen kommen an, sobald beide im selben WLAN sind.“ Niemals „PC fährt sicher um … herunter“.

* Weicht die PC-Uhr mehr als 2 min von `sentAt` ab, enthält die Bestätigung die Warnung `clock-skew`; die App zeigt einen ruhigen Hinweis zur Windows-Zeitsynchronisierung.
* Meldet der Begleiter ein älteres Protokoll, zeigt die App `companion-outdated` mit dem Weg zum neuen Installer und sendet nichts, was der PC falsch deuten könnte.

### PC-06 Abendablauf am PC

- **Gleiche Fachregeln wie PowerShell-Protokoll 2**, als Rust-Port mit denselben Fixtures: Berliner Plantag mit Wechsel 04:00; nur ein heute gültiger Eintrag (`validUntil`); kein Ableiten aus gestern; `paused` bedeutet keine Abschaltung; ohne gültigen Eintrag gilt `offlinePolicy` (gekoppelt: `pause`; feste Zeit nur ausdrücklich gewählt); Fenster bis S + 6 h; nach Anmeldung, Neustart oder zurückgestellter Uhr beginnt eine neue volle Schonfrist.
- Ablauf relativ zur Stoppzeit S: S−60 Zeitpille (optional), S−30 bis S Dämmerung (optional, AB-02), S−15 und S−5 Hinweiskarte, S Stoppkarte, nach 5 min Schonfrist Herunterfahren **ohne Zwang** (Semantik von `shutdown /s /t 0`; niemals `/f` oder `/t` > 0, das impliziert Zwang). Danach alle 5 min erneuter Versuch bis S + 6 h, wie bisher; jede Nutzerwahl beendet die Wiederholung.
- Karten-Knöpfe: „Speicherpunkt setzen“ (AB-01), „+15 Min“ (AB-03), „Heute ohne PC-Stopp“ (bis 04:00, ersetzt `pc-stop-abbrechen.ps1`), an der Stoppkarte zusätzlich „Jetzt herunterfahren“.
- Lokale Verlängerung gilt, bis das Handy für denselben Plantag einen **geänderten** PC-Eintrag schickt; ein unverändertes Briefing hebt sie nicht auf. Mindestvorlauf: Keine Quelle darf eine Abschaltung früher als 15 Minuten nach Empfang des Auftrags auslösen; alle Karten laufen dann vollständig ab (V31).
- „Abendablauf testen“ spielt alle Stufen in 2 Minuten ab und fährt nicht herunter (sichtbar „Test“).

&#91;embedded content: Abendablauf am PC · Standardwerte relativ zu S\]

Zeitpille und Dämmerung sind optional; Karten und Schonfrist gelten immer, außer bei Pause, offenem Ende oder „Heute ohne PC-Stopp“.

### PC-07 Sichtbar trotz „Nicht stören“ und Vollbild

- Hinweise sind eigene Tauri-Fenster: immer oben, ohne Fokusraub, nicht in der Taskleiste, per Tastatur bedienbar. Toasts zusätzlich, nie als einziger Kanal.
- Vor jeder Stufe `SHQueryUserNotificationState` lesen. Bei Vollbild-Direct3D, „beschäftigt“, Präsentation oder Ruhezeit trotzdem Karte zeigen und, falls eingeschaltet, einen kurzen leisen Ton abspielen. Systemeinstellungen nie ändern.
- Einrichtungshilfe: Anker zur Prioritätsliste für Benachrichtigungen hinzufügen; erklären, dass exklusives Vollbild Fenster überdecken kann (randloses Fenster empfehlen).

### PC-08 Ereignisse zurück ans Handy

- PC erkennt nur: Sperren/Entsperren (WTS-Sitzungsmeldungen), Energie (Ruhezustand/Aufwachen), Abmelden/Herunterfahren (`WM_QUERYENDSESSION`/`WM_ENDSESSION`, vor Prozessende auf Platte schreiben) und Leerlauf (`GetLastInputInfo`, alle 30 s).
- `pc-rest` = Beginn eines Zeitraums von mindestens 30 min ohne Nutzung (aus, Ruhezustand, gesperrt, abgemeldet oder ≥ 15 min Leerlauf), nur im Abendfenster S−120 bis 04:00. Kehrt Nutzung zurück, folgt `pc-resumed`. Maßgeblich ist die letzte Ruhe ohne spätere Nutzung.
- Zustellung mindestens einmal: Outbox am PC, Abholung beim nächsten Kontakt, Verarbeitung im Handy idempotent nach Ereignis-ID; Cursor erst nach atomarer Store-Persistenz weiterschieben (gleiches Muster wie die Erinnerungs-Receipts aus E02).
- Abbildung (reine Funktionen in `src/core/pcLink/events.ts`): `pc-rest` → Vorschlag „PC-Ruhe seit 22:31 (Herunterfahren). Als ‚PC ist aus' übernehmen?“; mit `eventsAuto` direkt `store.mark(date, 'pcOffAt', at)` plus Rücknahme. Nie einen vorhandenen `pcOffAt` überschreiben, nie `bedAt`, `wakeAt` oder Routinen daraus ableiten. `extended` → nur solange der Plantag aktiv ist und keine neuere Handy-Änderung existiert, über denselben Weg wie `LateForm` (`src/ui/components/TodayDifferent.tsx`), rückgängig machbar. `save-point` → `saveTomorrowStep(…)`. `thought` → `addInbox(text, 'PC')`. Alles andere nur als Status.

### PC-09 Tray und Zeitring

- Tray-Symbol mit Anker und Ring, der die verbleibenden Minuten der letzten Stunde vor dem nächsten PC-Zeitpunkt zeigt; Tooltip „PC-Stopp 22:30 · noch 47 Min“, „Heute ohne PC-Stopp“ oder „Nicht gekoppelt“.
- Menü: Status, Speicherpunkt setzen, Gedanke notieren, +15 Min, Heute ohne PC-Stopp/wieder aktivieren, Abendablauf testen, Mit Handy koppeln, Einstellungen, Beenden (ehrlich: „Dann läuft heute kein PC-Stopp“).
- Globale Tastenkürzel, Standard `Strg+Alt+A` (Speicherpunkt) und `Strg+Alt+G` (Gedanke), änderbar, Konflikte melden.

### PC-10 Autostart und Robustheit

- Autostart bei Anmeldung (Benutzerebene, Standard an, abschaltbar), Einzelinstanz. Zustand atomar speichern (temporäre Datei + Umbenennen) mit Schemaversion.
- Keine langen Timer: alle 15–30 s gegen die Wanduhr prüfen. Ruhezustand, Uhrzeitänderung, Sommerzeit und Neustart dürfen keine Stufe doppelt auslösen oder eine Schonfrist verkürzen.

### PC-11 Koexistenz mit dem klassischen Paket

- Erkennen der Aufgabe „Anker PC-Stopp“ (Aufgabenplanung). Dann Hinweis mit zwei Wegen: „Klassisches Paket entfernen“ (gleiche Schritte wie `uninstall.ps1`, nur nach Klick) oder „So lassen“. Solange beides aktiv ist, fährt der Begleiter nicht herunter (`effective.mode = legacy-conflict`).
- `PcStop.tsx` erklärt beide Wege: Begleiter empfohlen, klassisches Paket bleibt verfügbar.

### PC-12 Installation und Verteilung

- NSIS-Installer pro Benutzer ohne Administratorrechte, WebView2-Bootstrapper, Deinstallation entfernt Autostart und auf Wunsch die Begleiter-Daten (nie das klassische Paket).
- Erste Inbetriebnahme führt in drei Schritten: PC-Name wählen → Firewall-Frage „private Netzwerke zulassen“ erklären → Koppeln.
- Doku zu SmartScreen („Weitere Informationen → Trotzdem ausführen“) und Smart App Control (unsignierter Code kann blockiert werden). Eine kostenpflichtige Codesignatur ist eine offene Nutzerentscheidung; nicht kaufen, nicht vortäuschen.

* Weitergabe an den Nutzer wie bei den APKs nur nach ausdrücklicher Freigabe (zum Beispiel über einen eigenen Download-Branch mit Prüfsumme). Ohne P09 gibt es keinen automatischen Update-Kanal; der Begleiter zeigt nur seine Version und Protokollnummer.

### PC-13 Privatsphäre am PC

- Nie erfassen: Prozess- oder Fensterlisten, Fenstertitel, URLs, Bildschirminhalte, Tastatureingaben. Leerlauf nur als Sekundenzahl.
- Schlüssel und Geheimnisse per DPAPI (`CryptProtectData`, Benutzerbereich). Rotierendes lokales Protokoll (≤ 1 MB, 14 Tage) ohne Texte. Knopf „Alle Begleiter-Daten löschen“.

### PC-14 Optionales Relay (Kann, erst in P09)

- Nur wenn der Nutzer Supabase einrichtet: Tabelle `pc_link_mailbox` (Kopplung, Richtung, `seq`, Umschlag, Ablauf nach 14 Tagen) mit RLS für das Handy und Edge Function `pc-link` mit Gerätetoken für den PC (nur Hash speichern, wie `pc_stop_tokens`). Der Server sieht nur Umschläge. LAN bleibt erster Weg; keine neue Pflicht.

## 05 Modul AB: Abend und Bettzeit

Der Abendreiz kommt an den Ort der Ablenkung, und das Aufhören wird billiger: erst Stand sichern, dann gehen. AB-01 bis AB-04 und AB-07 sind Pflicht, AB-05 und AB-06 Soll. Alles bleibt freiwillig, ohne Punkteabzug und ohne Schuld-Sprache.

### AB-01 Speicherpunkt (Pflicht)

- Zweck: Die Angst, den Faden zu verlieren, hält am PC fest. Ein Speicherpunkt notiert in höchstens zwei Feldern, wo du stehst und was als Nächstes kommt (Hypothese).
- Wege am PC: Knopf auf der S−15-Karte, Tray-Menü, `Strg+Alt+A`. Kleines Fenster: „Wo stehst du gerade?“ und „Nächster Schritt (optional)“, `Enter` speichert, ein Feld genügt.
- Beim nächsten PC-Start einmalig: „Gestern gemerkt: …“ mit „Ok“. Dann ist er am PC erledigt.
- Am Handy wird daraus über das Ereignis `save-point` ein Eintrag in „Morgen hier weitermachen“ (`saveTomorrowStep`), mit derselben Standard-Wiedervorlage wie im Formular in `src/ui/pages/Evening.tsx` und ohne Erinnerung. Keine XP, kein Erledigt-Status.

### AB-02 Sanfte Bildschirmdämmerung (Pflicht, standardmäßig aus)

- Ein klickdurchlässiges, randloses Overlay über allen Monitoren, warm getönt, Deckkraft linear von 0 bei S−30 bis zum gewählten Höchstwert bei S (Standard 0,25, höchstens 0,4). Bleibt bis zum Ende der Schonfrist.
- Nimmt nie Eingaben weg, wird nie schwarz, blinkt nie. Bei „Reduzierte Bewegung“ in Stufen statt fließend. Per `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` aus Aufnahmen und Streams ausnehmen.
- Verschwindet bei „+15 Min“ (Rampe beginnt neu ab neuem S−30), „Heute ohne PC-Stopp“, Pause, offenem Ende und Sperre.
- Text im Schalter: „Signal zum Übergang“. Nicht als Blaulichtschutz oder Schlafverbesserung bewerben (Abschnitt 02).

### AB-03 Ehrliche Verlängerung (Pflicht)

- Am PC: „+15 Min“ auf jeder Karte, im Tray zusätzlich „+30 Min“ und „Bis …“. In der App bleibt `LateForm` der Weg. Kein Limit (v6 K04), keine Zählung auf dem Bildschirm, keine Schuld-Sätze.
- Jede Verlängerung nennt sachlich die Folge: „PC-Stopp 22:45 · Bett etwa 23:15 · bis zum Wecker 6 h 55 Min“. Dafür liefert das Briefing `wakeAt` und `prefs.bedAfterStopMin` (= `min(sleep.screenOffMin, 30)`, wie in `src/core/planner/plan.ts`); der PC rechnet sonst nichts.
- Rückweg ins Handy über `extended` (PC-08), dort als `adjustDay(…, override.lateUntil)` wie `LateForm`.

### AB-04 Wenn-dann-Abendplan (Pflicht, freiwillig nutzbar)

- Unter *Einstellungen → Abend & Schlaf* vier kurze Felder nach MCII: Wunsch, bestes Ergebnis, eigenes inneres Hindernis, Wenn-dann-Satz. Drei editierbare Vorlagen, zum Beispiel: „Wenn die 15-Minuten-Karte kommt, dann setze ich einen Speicherpunkt und beende die Runde.“
- Der Wenn-dann-Satz erscheint abends auf „Jetzt“ und, nur mit eigenem Schalter „Auf dem PC zeigen“, auf der S−15-Karte (`ifThen.text` im Briefing).
- Lokal in `LocalData`, nicht synchronisiert. Keine Bewertung, keine Erfolgsquote; die Rhythmus-Woche (VI-02) zeigt nur geplant und tatsächlich.

### AB-05 Abendlicht-Hinweis (Soll, standardmäßig aus)

- Einmaliger Hinweis zur gewählten Zeit (Vorschlag: Bettzeit − 2 h): „Deckenlicht aus, warmes Licht an.“ Am Handy über `src/core/reminders/build.ts` als niedrig priorisierter Hinweis, der Ruhezeiten und das Drei-Slot-Budget achtet; am PC als kleine Karte, falls gekoppelt.
- Ist der sanfte Abendübergang aktiv, entfällt dieser Hinweis (keine Stapelung).

### AB-06 Handy-Erinnerung entlasten (Soll, standardmäßig aus)

- Schalter: „Wenn der PC den heutigen Auftrag bestätigt hat, keine PC-Stopp-Erinnerung am Handy.“ Gilt nur für den bestätigten Plantag und die bestätigte Revision; Bett-Erinnerung und Wecker bleiben unverändert. Tests: kein Wegfall ohne passende Bestätigung.

### AB-07 Zusammenspiel mit dem sanften Abendübergang (Pflicht)

- Ist `support.windDown.enabled`, zeigt der PC standardmäßig eine Übergangskarte zur gewählten Zeit plus die Stoppkarte und lässt S−15/S−5 weg. Die Wahl steht sichtbar in den Begleiter-Einstellungen und im Briefing (`prefs`). Dämmerung folgt nur ihrem eigenen Schalter.
- Die Stoppkarte endet ruhig: „Gute Nacht. Auf dem Handy wartet dein nächster Schritt.“ Keine Liste, keine Zahlen.

## 06 Modul MO: Morgen und Aufwachen

Der Wecker bleibt unangetastet; v7 stärkt das Drumherum: Licht nach dem Aufstehen, ein sichtbarer Weckanker und am PC ein Countdown für Homeoffice-Morgen. MO-01, MO-02 und MO-04 sind Soll, MO-03 Kann, MO-05 nur eine Machbarkeitsnotiz.

### MO-01 Licht-Schritt (Soll)

- Neue Routine-Vorlage für den Morgen: „Licht: Vorhang auf, ans Fenster oder 10 Minuten raus“, kleine Version „Vorhang auf, Licht an“, stabile Schritt-ID `light`.
- **Nicht** automatisch in bestehende Routinen einfügen. Einmal als Vorschlag anbieten (vorhandener Mechanismus `settings.suggestions` oder Karte unter *Einstellungen → Routinen*), mit „Hinzufügen“ und „Nein danke“. Ablehnung bleibt gespeichert.
- Ist Wetter eingeschaltet und der Sonnenaufgang bekannt, lautet der Text vor Sonnenaufgang „Helles Licht an“. Ohne Wetter bleibt der allgemeine Text.
- Erklärung unter „Mehr erfahren“ mit Evidenzstufe Hypothese (Abschnitt 02). Keine Lichtgeräte empfehlen, keine Lux-Vorgaben als Therapie.

### MO-02 Weckanker sichtbar halten (Soll)

- Teil der Rhythmus-Woche (VI-02): geplante Aufstehzeit, tatsächliches `DayLog.wakeAt` (heute beim Beenden des Hauptweckers oder über „Ich bin wach“ gesetzt) und das Toleranzband aus `anchor.wakeToleranceMin` bzw. `weekendToleranceMin`.
- Satz statt Score: „An 5 von 7 Tagen im eigenen Rahmen aufgestanden.“ Fehlende Tage heißen „ohne Eintrag“, nie „verpasst“.

### MO-03 Schlafdaten aus Health Connect (Kann, standardmäßig aus)

- Eigener Schalter unter *Einstellungen → Abend & Schlaf*. Erst dann `requestAuthorization({ read: ['sleep'] })` über das vorhandene `@capgo/capacitor-health`.
- Manifest: nur `READ_SLEEP` freigeben (die `tools:node="remove"`-Zeile dafür entfernen), `WRITE_SLEEP` bleibt entfernt. Begründungstext für die Health-Connect-Freigabe ergänzen.
- `readSamples({ dataType: 'sleep' })` für die letzten 14 Nächte. Daraus nur **Vorschläge** für den Schlafüberblick (Bett = Beginn, Aufstehen = Ende), gekennzeichnet „aus Health Connect“. Eigene Einträge nie überschreiben; keine Schlafphasen-Auswertung, kein Score.
- Lokal, nicht synchronisiert. Ausschalten stoppt das Lesen; übernommene Einträge bleiben, bis der Nutzer sie löscht.

### MO-04 Morgen-Countdown am PC (Soll, standardmäßig aus)

- Ist der PC morgens an, zeigen Tray und Zeitpille den Countdown bis `morning.leaveAt` (Bürotag) oder `morning.workStartAt` (Homeoffice). Bei −10 min eine kleine Karte: „In 10 Minuten los“ bzw. „In 10 Minuten Arbeitsbeginn“.
- Keine Abschaltung, keine Ereignisse zurück, kein Setzen von `leftAt` oder Arbeitszeit (Gleitzeit-Regeln in `CLAUDE.md`). Morgendaten stehen nur bei eingeschaltetem Schalter im Briefing.

### MO-05 Lichtwecker (nur Machbarkeitsnotiz)

- Nicht implementieren. In `docs/PC_BEGLEITER.md` kurz festhalten, wie eine spätere Dämmerungssimulation über eine lokale Lichtsteuerung (Zeitplan auf der Bridge, ohne Cloud) aussehen könnte, welche Hardware nötig wäre und dass die Evidenz schwach ist. Umsetzung nur mit eigener Freigabe.

## 07 Modul VI: Ausdrucksstärkere Zeitdarstellung

Zeit soll man sehen, nicht ausrechnen: ein schrumpfender Bogen vor jeder festen Zeit und eine ruhige Wochenansicht von Plan und Wirklichkeit. Alle vier Punkte sind Soll und nutzen vorhandene Bausteine statt neuer Engines.

### VI-01 Zeitbogen auf „Jetzt“

- In der letzten Stunde vor der nächsten festen Zeit (PC-Stopp, Bett, Losgehen) zeigt „Jetzt“ einen Bogen mit der Restzeit. Wiederverwenden: `RingTimer` aus `src/ui/components/ui.tsx`; keine zweite Timer-Logik, Zeitpunkte aus dem Plan.
- Farben nur `accent` und `warm`, nie Rot. Bildschirmleser-Text: „Noch 47 Minuten bis PC-Stopp um 22:30“. „Reduzierte Bewegung“: Aktualisierung pro Minute ohne Animation.
- Schalter unter *Einstellungen → Darstellung*, Standard an. Bei offenem Ende oder pausiertem PC-Stopp kein Bogen für den PC-Stopp.

### VI-02 Rhythmus-Woche

- Neue Ansicht unter *Abend & morgen* (Route `/abend`): 7 Tage, umschaltbar auf 14. Je Plantag eine Zeile auf einer Zeitachse 20:00–09:00 über Mitternacht: geplanter PC-Stopp, tatsächliche PC-Ruhe (`pcOffAt`), geplantes und tatsächliches Bett (`bedAt`, sonst Schlafüberblick), geplantes und tatsächliches Aufstehen (`wakeAt`) mit Toleranzband.
- Nur vorhandene Daten, keine neue Erfassung. Plan als feine Markierung, Wirklichkeit als Punkt, fehlende Werte als „ohne Eintrag“.
- Darunter höchstens zwei neutrale Sätze, zum Beispiel „Aufstehen lag an 5 von 7 Tagen in deinem Rahmen.“ Kein Score, keine Serie, keine Rangliste, kein Rot.
- Barrierefrei: „Als Tabelle anzeigen“ mit denselben Werten; Diagramm als SVG mit Beschriftungen, bei 320 px Breite und 160 % Schrift lesbar.

### VI-03 Zeitpille und Tray-Ring am PC

- Zeitpille (optional, ab S−60): kleines, klickdurchlässiges Element unten rechts mit Ring und „noch 47 Min“. Ausblenden für heute über das Tray-Menü.
- Tray-Ring: 13 Zustände (alle 5 Minuten) beim Build aus einer SVG-Vorlage erzeugen, ähnlich `scripts/icons.mjs`; keine Laufzeit-Grafikbibliothek.

### VI-04 Einheitliche Optik des Begleiters

- Gleiche Tokens wie die App (`--accent`, `--warm`, `--surface` … aus `src/index.css`), Hell/Dunkel nach Windows-Einstellung, Schrift `Inter` mit Systemrückfall, Windows-Skalierung bis 200 % prüfen.
- Karten mit höchstens zwei Zeilen Text und höchstens drei Knöpfen (UX-Grenze aus v6 02.3). Signalton im Repo selbst erzeugt (kurze Sinus-Glocke), keine fremden Audiodateien.

* Barrierefrei: Karten und Fenster mit Windows-Sprachausgabe (Narrator) lesbar, vollständig per Tastatur bedienbar (`Tab`, `Enter`, `Esc`), sichtbarer Fokusrahmen, keine Information nur über Farbe.

## 08 Datenschutz, Sicherheit und Einwilligungen

Der PC erfährt standardmäßig nur Uhrzeiten und eigene Einstellungen; Aufgaben, Termine, Orte und Gesundheitsangaben verlassen das Handy nie. Kein Auftrag darf den PC früher als 15 Minuten nach Empfang herunterfahren.

### Datenklassen

| Klasse | Richtung | Standard | Gespeichert | Sync / JSON-Sicherung |
| --- | --- | --- | --- | --- |
| PC-Zeitpunkte: Datum, Stopp oder Pause, Gültigkeit | Handy → PC | an, sobald gekoppelt | Begleiter-Datenordner | nein / nein |
| Bett- und Weckzeit (nur für die Verlängerungsfolge) | Handy → PC | an, sobald gekoppelt | Begleiter-Datenordner | nein / nein |
| Losgehen, Arbeitsbeginn, Homeoffice ja/nein | Handy → PC | aus (MO-04) | Begleiter-Datenordner | nein / nein |
| Wenn-dann-Satz | Handy → PC | aus (AB-04) | Begleiter-Datenordner | nein / nein |
| PC-Ereignisse mit Uhrzeit und Grundlage | PC → Handy | an, sobald gekoppelt | `LocalData`, 30 Tage; nach Übernahme `DayLog.pcOffAt` | Ereignisse nein / abwählbare Gruppe; `pcOffAt` wie bisher |
| Speicherpunkt- und Gedankentexte | PC → Handy | nur bei eigener Eingabe | „Morgen hier weitermachen“ bzw. Gedanken | wie die bestehenden Typen |
| Schlüssel, Kopplungsgeheimnis, Zertifikats-Pin | beide | – | Handy: eigener lokaler Datensatz; PC: DPAPI | nie / nie |

**Nie übertragen:** Aufgaben und Arbeitsaufgaben, Termine, Orte, Gedankenliste, Einnahmeprotokoll, Gesundheitsdaten, Spielstand, Fenstertitel, Programmnamen, URLs.

### Einwilligung und Transparenz

- Die Kopplung selbst ist die Einwilligung für die Standardklassen; der Kopplungsdialog nennt sie vorher in zwei Sätzen. Morgenzeiten und Wenn-dann-Satz haben eigene Schalter.
- In App und Begleiter gibt es „Was weiß dein PC?“ mit dem zuletzt gesendeten Briefing in lesbarer Form und „Entkoppeln und löschen“.
- Nach einer Wiederherstellung aus der JSON-Sicherung fehlt die Kopplung bewusst; die PC-Seite zeigt „PC neu koppeln“. Bestehende Sicherungsvalidierung (`backupValidation.ts`) bleibt rückwärtskompatibel.
- Logs und Fehlermeldungen enthalten keine Texte, Schlüssel oder Adressen; Fehler als neutrale Codes.

### Bedrohungsmodell

| Risiko | Schutz | Szenario |
| --- | --- | --- |
| Fremdes Gerät im WLAN sendet Befehle | Ohne gültigen AEAD-Umschlag keine Wirkung; nur private Adressen | V15 |
| Mitgeschnittene Nachricht wird erneut gesendet | Strikt steigende `seq` je Richtung | V15 |
| Webseite im PC-Browser ruft den Begleiter auf | Kein Endpunkt mit Wirkung ohne Umschlag, keine CORS-Header | V28 |
| Kopplungs-QR wird abfotografiert | 10 min gültig, einmalig, Prüfcode, Bestätigung am PC | V16 |
| Anderer Rechner gibt sich als PC aus | Zertifikats-Pin und PC-Publickey aus dem QR | V29 |
| Verlorenes oder fremdes Handy | Entkoppeln am PC; Wirkung begrenzt auf PC-Zeiten; Mindestvorlauf 15 min vor jeder Abschaltung | V31 |
| Übergroße oder fehlerhafte Nachrichten | Größen- und Schemagrenzen, unbekannte Felder ablehnen | V30 |
| Relay-Betreiber (nur PC-14) | Sieht nur Umschläge und Metadaten; Löschung nach 14 Tagen | P09 |

## 09 Etappen P00–P10 und Qualitätsgates

Arbeite die Etappen der Reihe nach und vertikal: reine Logik → Tests → Persistenz → Oberfläche/Plattform → Regression → Doku. Eine Etappe ist erst fertig, wenn ihr Gate erfüllt und im Implementierungsplan belegt ist.

1. **P00 Audit und Baseline.** Dateien aus Abschnitt 00 lesen; `git status --short`, Branch, `git log -5`; Branch `entwicklung/anker-v7-pc` anlegen. Baseline ausführen: `npm ci`, `lint`, `typecheck`, `test`, `build`, `test:e2e`, `test:pc` und, falls SDK vorhanden, `node scripts/gradle.mjs :app:testDebugUnitTest`. Kurze `AGENTS.md` (höchstens 30 Zeilen) mit Verweis auf `CLAUDE.md` und diesen Auftrag. Delta-Matrix um alle IDs PC/AB/MO/VI erweitern.
   - Gate: Baselinezahlen dokumentiert, vorbestehende Fehler getrennt.
2. **P01 Protokoll v3 in TS.** `src/core/pcLink/` mit Typen, Validierung, `buildPcBriefing`, Ereignis-Abbildung, Krypto über injizierbares WebCrypto, Fixtures und Testvektoren; `docs/PC_LINK_PROTOKOLL.md`.
   - Gate: alle Fixtures grün, bestehende PC-Stopp-Tests unverändert grün, keine neue App-Abhängigkeit.
3. **P02 Gerüst des Begleiters.** `desktop/` mit Tauri 2, Tray, Einzelinstanz, Autostart, Einstellungen, atomarem Zustand. Rust-Port des Protokolls gegen dieselben Fixtures. Abendlogik als reines Rust-Modul mit injizierbarer Uhr; die Fälle aus `scripts/test/pc-stop.runtime.ps1` als Paritätstabelle. Plattformcode (Windows-APIs) hinter Traits, damit Server, Protokoll und Abendlogik auch unter Linux testbar sind.
   - Gate: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` grün; Paritätstabelle vollständig.
4. **P03 Kopplung und LAN.** TLS-Server, mDNS, Kopplungsendpunkte und QR-Fenster am PC; `PcLinkTransport.kt` mit Plugin-Methoden und JUnit-Pin-Modell; Kopplungsweg in der App mit `scanQr()`; Entkoppeln.
   - Gate: Integrationstest „Handy-Simulator in Node ↔ Rust-Server unter Linux“ für Kopplung, Briefing/Bestätigung, Replay- und Manipulationsablehnung grün.
5. **P04 Briefing und Status in der App.** Anstoß über `effects.ts`, Statusmodell, ehrliche Texte, überarbeitete PC-Seite mit klassischem Paket als zweitem Weg, „Was weiß dein PC?“.
   - Gate: Vitest für Statusübergänge; Playwright für die PC-Seite mit kontrolliertem Transport; kein „bestätigt“ ohne passende Bestätigung.
6. **P05 Abendablauf am PC.** Karten, Dämmerung, Ton, `SHQueryUserNotificationState`, Herunterfahren ohne Zwang, Aussetzen, Verlängern, Erkennung des klassischen Pakets, Testmodus; AB-01, AB-02, AB-03, AB-07.
   - Gate: Rust-Tests inklusive Neustart, Ruhezustand, Uhr zurück und Sommerzeit; Oberflächentests der Desktop-UI mit gemockter Tauri-API; neue manuelle Windows-Stationen dokumentiert.
7. **P06 Ereignisse zurück.** Windows-Erkennung, Outbox, Abholung und Abbildung im Handy, Receipts und Idempotenz.
   - Gate: V10–V14 grün; Store-Tests für atomares Speichern und kein Überschreiben eigener Einträge.
8. **P07 Abend-, Morgen- und Darstellungsfunktionen.** AB-04 bis AB-06, MO-01, MO-02, MO-04, VI-01 bis VI-04.
   - Gate: Logik- und Browsertests inklusive 320 px und 160 % Schrift; bestehende Barrierefreiheitsprüfungen grün.
9. **P08 Installer, CI und Doku.** Windows-Job in der CI, Installer als Artefakt (7 Tage), alle Dokumente aus Abschnitt 12.
   - Gate: CI grün auf dem Branch, sofern Push freigegeben ist; sonst lokale Entsprechung belegt und Grenze benannt.
10. **P09 Kann-Module, nur nach ausdrücklicher Freigabe.** PC-14 Relay, MO-03 Health Connect, In-App-Updater des Begleiters.
    - Gate: wie oben, zusätzlich Datenschutz- und Kostenhinweis in `docs/OPTIONALE_DIENSTE.md`.
11. **P10 Gesamtregression und Abschluss.** Alle Befehle aus Abschnitt 11, Version erst jetzt und nur auf Wunsch auf `1.5.0-rc.1` / Code 15 (Signatur unverändert), Abschlussbericht nach Abschnitt 12.
    - Gate: Definition von „fertig“ aus v6 17.3 erfüllt; offene Geräte- und Windows-Prüfungen ehrlich offen.

## 10 Abnahmeszenarien

Jedes Szenario braucht mindestens einen automatischen Test; Windows-Echtbetrieb zusätzlich als manuelle Station in `docs/GERAETETEST.md`. Alle Zahlen sind Testkonfigurationen, keine persönlichen Standards: Plantag Do 12.11.2026, PC-Stopp S = 22:30, Bett 23:00, Wecker 06:15 (Europe/Berlin).

| ID | Gegeben | Aktion | Erwartung |
| --- | --- | --- | --- |
| V01 | Gekoppelt, PC erreichbar | 21:00 App öffnen | Briefing gesendet, Bestätigung in der Antwort; App: „Vom PC bestätigt um 21:00 · PC-Stopp 22:30“ |
| V02 | V01 | 22:20 in der App „Länger wach“ bis 23:00 | Erst Ereignisse abholen, dann neues Briefing; PC bestätigt 23:00; keine S−5-Karte um 22:25 |
| V03 | Handy nicht im WLAN | 22:20 Verlängerung in der App | „PC gerade nicht erreichbar. Zuletzt bestätigt um 21:00: 22:30“; PC führt 22:30 aus; kein „bestätigt“ |
| V04 | Offenes Ende gewählt | Briefing senden | PC: `paused`, keine Dämmerung, keine Karten, kein Herunterfahren; Tray „Heute ohne PC-Stopp“ |
| V05 | Letztes Briefing endet gestern | 22:30 erreicht | `offlinePolicy` `pause`: keine Abschaltung; nie aus gestern ableiten |
| V06 | Kein Handykontakt | 22:30 am PC „+15 Min“ | Wirksam 22:45; Ereignis `extended`; beim nächsten Kontakt übernimmt die App `lateUntil` 22:45 per `adjustDay` und bestätigt mit neuem Briefing |
| V07 | V06 ohne Abholung | Briefing mit unverändertem 22:30-Eintrag, danach eines mit 23:15 | Erstes lässt 22:45 bestehen; zweites ersetzt sie durch 23:15 |
| V08 | S 22:30 | 22:20 „Heute ohne PC-Stopp“ am PC, 22:25 neues Briefing 22:40 | Keine Abschaltung bis 04:00; Ereignis `suspended-today`; „Wieder aktivieren“ hebt auf |
| V09 | Simuliert `QUNS_RUNNING_D3D_FULL_SCREEN` | S−15 erreicht | Karte und (falls an) Ton; Toast nicht einziger Kanal; Log ohne Programmnamen |
| V10 | Keine Reaktion | S erreicht | 22:30 Stoppkarte, 22:35 Herunterfahren ohne Zwang; `pc-rest` 22:35, Grundlage `anker-shutdown`; nach Übernahme `pcOffAt` 22:35, Spielziel erfüllt |
| V11 | `pcOffAt` 22:28 von Hand | `pc-rest` 22:35 kommt an | Kein Überschreiben; Ereignis nur als Info |
| V12 | 22:40 gesperrt bis 23:30 | Abholung | `pc-rest` 22:40, Grundlage `lock` |
| V13 | 22:40 gesperrt, 22:50 entsperrt, 23:20 heruntergefahren | Abholung | `pc-rest` 22:40 und `pc-resumed` 22:50; maßgeblich 23:20 |
| V14 | Abend am PC | 22:16 `Strg+Alt+A`: „Dungeon Ebene 3“ / „Schlüssel holen“ | Eintrag in „Morgen hier weitermachen“ ohne Erinnerung und ohne XP; nächster PC-Start zeigt ihn einmal |
| V15 | `seq` 42 akzeptiert | Umschlag mit `seq` 41; ein Byte in `ct` geändert; fremder Schlüssel | Alle abgelehnt, kein Zustandswechsel |
| V16 | Kopplungs-QR | Nach 11 min scannen; denselben QR zweimal nutzen; nicht am PC bestätigen | Abgelehnt bzw. keine Kopplung; Prüfcodes stimmen beidseitig überein |
| V17 | Gekoppelt | In der App entkoppeln; am PC entkoppeln | Gegenseite löscht beim nächsten Kontakt; alte Schlüssel wirkungslos |
| V18 | 13.11. 01:30 Berlin | Briefing enthält 12.11. und 13.11. | Plantag 12.11.; Eintrag 13.11. erst ab 04:00 |
| V19 | Stoppzeit 25.10.2026 02:30; 29.03.2026 02:30 | Plantag auswerten | Doppelte Stunde: zweites Vorkommen wie TS/Kotlin; fehlende Stunde: Verhalten von `zonedToUtc` |
| V20 | Aufgabe „Anker PC-Stopp“ vorhanden | Begleiter startet | Hinweis; Karten ja, Herunterfahren nein (`legacy-conflict`, auch in der Bestätigung) |
| V21 | Lokales Netz verweigert (Android-17-Simulation) | Senden | Status „nicht erreichbar“ mit Freigabe-Hinweis; Backoff, kein Absturz |
| V22 | Gekoppelt | JSON-Sicherung exportieren und importieren | Keine Schlüssel/Pins im Export; danach „PC neu koppeln“; alte Sicherungen bleiben importierbar |
| V23 | Stoppkarte 22:30 | Neustart 22:33 | Nach Anmeldung neue volle Schonfrist von 5 min |
| V24 | S 22:30 | PC wird 23:50 eingeschaltet | Stoppkarte und Schonfrist; nach 04:00 kein Übertrag |
| V25 | 21:43, S 22:30 | „Jetzt“ öffnen | Bogen bei 47 von 60 min; Text „Noch 47 Minuten bis PC-Stopp um 22:30“; bei offenem Ende kein Bogen |
| V26 | Homeoffice, Arbeitsbeginn 08:00, MO-04 an | PC um 07:40 an | „Arbeitsbeginn in 20 Min“, Karte um 07:50; keine Arbeitszeit, kein `leftAt` |
| V27 | Wenn-dann-Satz gesetzt | „Auf dem PC zeigen“ aus, dann an | Erst kein `ifThen` im Briefing; dann Satz auf der S−15-Karte |
| V28 | Begleiter läuft | Webseite postet an `/v3/link` ohne gültigen Umschlag | 4xx, keine Wirkung, keine CORS-Header |
| V29 | Gekoppelt | Anderer Server mit anderem Zertifikat unter derselben Adresse | Pin schlägt fehl; „PC nicht erkannt – neu koppeln?“ |
| V30 | Gekoppelt | 65 KiB, unbekanntes Feld, Text mit 501 Zeichen | Abgelehnt |
| V31 | 22:25 | Briefing setzt S auf 22:26 | Abschaltung frühestens 22:40, mit vollständigen Karten |
| V32 | Sanfter Abendübergang 22:00 | Abend läuft | Eine Übergangskarte 22:00, keine S−15/S−5-Karten, Stoppkarte um S |
| V33 | AB-06 an | PC bestätigt Plantag und Revision; danach neue Revision ohne Bestätigung | Erst keine Handy-PC-Stopp-Erinnerung; dann wieder geplant |
| V34 | Dämmerung an, Höchstwert 0,25 | S−30 bis S, dann „+15 Min“ | Deckkraft linear 0 → 0,25; Klicks gehen durch; nach Verlängerung weg und Neustart ab neuem S−30; nicht in Aufnahmen |

## 11 Tests, Befehle und CI

Alle bestehenden Prüfungen bleiben grün und unverändert streng; neue Prüfungen kommen in eigenen Befehlen und CI-Jobs dazu. Kein Test wird gelockert, übersprungen oder mit Retries grün gemacht.

### Bestehend (müssen grün bleiben)

```bash
npm run lint && npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:pc
python3 scripts/test-android-update.py
node scripts/gradle.mjs :app:testDebugUnitTest
```

### Neu

```bash
npm run desktop:lint    # ESLint in desktop/, cargo fmt --check, cargo clippy -- -D warnings
npm run desktop:test    # Vitest der Desktop-UI mit gemockter Tauri-API, cargo test
npm run test:link       # Handy-Simulator (Node, src/core/pcLink) gegen Rust-Testserver unter Linux
npm run desktop:build   # nur Windows: tauri build mit NSIS
```

### Testebenen

1. **Vitest:** `src/core/pcLink/*.test.ts` (Fixtures, Krypto-Testvektoren mit Node-WebCrypto, `buildPcBriefing`, Statusmodell, Ereignis-Abbildung); Store-Tests für atomare, idempotente Ereignisübernahme ohne Überschreiben; Erinnerungstests für AB-05/AB-06.
2. **Rust:** dieselben Fixtures und Testvektoren; Abendlogik mit injizierbarer Uhr inklusive Parität zu `scripts/test/pc-stop.runtime.ps1`; `pc-rest`-Erkennung aus simulierten Ereignisfolgen; atomare Persistenz und Schemaversion; Endpunkte mit Test-Client.
3. **Integration:** Node-Simulator mit Zertifikats-Pin (`checkServerIdentity`) gegen einen Rust-Testserver mit gemockter Plattformschicht: Kopplung, Briefing/Bestätigung, Abholung, V15, V16, V28–V31.
4. **Playwright:** PC-Seite mit kontrolliertem nativen Transport (Muster aus `e2e/helpers/`), Zeitbogen, Rhythmus-Woche inklusive Tabellenansicht, neue Einstellungen; Desktop-Oberfläche (Karten, Kopplungs-QR, Einstellungen) gegen den Desktop-Vite-Build. Immer auch 320 px und 160 % Schrift.
5. **JUnit:** `PcLinkModelTest` für Pin-Vergleich, Adressreihenfolge und Backoff.
6. **Manuell (neue Stationen in `docs/GERAETETEST.md`):** Installation mit SmartScreen/Smart App Control, Firewall-Frage, Kopplung mit dem echten Galaxy, Abend mit einem Spiel im randlosen und im exklusiven Vollbild, Herunterfahren mit ungespeichertem Editor (blockiert → `shutdown-blocked`), Ruhezustand, Neustart in der Schonfrist, Autostart, Deinstallation, Parallelbetrieb mit dem klassischen Paket.

### CI-Erweiterung in `.github/workflows/ci.yml`

- Bestehenden Job `check` nicht verändern.
- Neuer Job `desktop-linux` (`ubuntu-latest`): Rust stable mit Cache, `desktop:lint`, `desktop:test`, `test:link`.
- Neuer Job `desktop-windows` (`windows-latest`): Node 24, Rust stable, `npm ci --prefix desktop`, `cargo test` (Windows-Tests ohne Systemänderung), `desktop:build`, Upload des NSIS-Installers als Artefakt `anker-pc-begleiter` mit 7 Tagen Aufbewahrung. Keine Signier-Secrets, kein Release.

**Nachweise** im Format von `docs/ANKER_TESTNACHWEISE.md`: Befehl, Commit, Zahlen, Datum, Umgebung, Status `bestanden` / `fehlgeschlagen` / `blockiert` / `nicht ausgeführt`. Fehlt in deiner Umgebung Windows oder Rust, sag das und behaupte keinen Lauf.

## 12 Dokumentation und Abschlussbericht

Dokumentiere nur, was tatsächlich gebaut und geprüft ist, und trenne „implementiert“, „automatisch geprüft“, „am PC geprüft“ und „am Handy geprüft“.

### Neue Dokumente

- `docs/auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v7_PC.md`: dieser Auftrag. Liegt er noch nicht im Repo, speichere den bereitgestellten Text dort unverändert ab.
- `docs/PC_BEGLEITER.md`: Installation (SmartScreen, Smart App Control, Firewall), Kopplung, Abendablauf, Einstellungen, „Was weiß dein PC?“, Grenzen (exklusives Vollbild, „Nicht stören“, nur Heimnetz), Deinstallation, Machbarkeitsnotiz MO-05.
- `docs/PC_LINK_PROTOKOLL.md`: Protokoll v3 mit Beispielen, Versionierung, Verhältnis zu Protokoll 2.
- `AGENTS.md`: höchstens 30 Zeilen, verweist auf `CLAUDE.md` und die Aufträge; keine Kopie der Spezifikation.

### Zu pflegen

| Datei | Änderung |
| --- | --- |
| `README.md` | Abschnitt 9: PC-Begleiter als empfohlener Weg, klassisches Paket als Alternative; neue Befehle unter „Entwicklung“ |
| `docs/ANLEITUNG.md` | PC-Abschnitt neu, Speicherpunkt, Dämmerung, Verlängerung, Wenn-dann-Plan, Licht-Schritt, Rhythmus-Woche, Zeitbogen; Tabelle „Handy oder PC?“ ergänzen |
| `docs/STRUKTUR.md` | `desktop/`, `src/core/pcLink/`, `src/platform/pcLink.ts`, `PcLinkTransport.kt`, neue Seiten und Routen |
| `CLAUDE.md` | Architektur um Begleiter ergänzen; Regeln: kein zweiter Planer, Datenklassen, Datenordner, Mindestvorlauf 15 min, nie Zwang beim Herunterfahren |
| `docs/ADHS_DESIGNPRINZIPIEN.md` | Neue Zeilen: Aufschieben am PC → Umgebungsreiz; Angst vor Fadenverlust → Speicherpunkt; Zeitblindheit am PC → Zeitring; Morgenlicht; Rhythmus statt Serie. Jeweils Evidenzstufe aus Abschnitt 02 |
| `docs/UI_GLOSSAR.md` | PC-Begleiter, gekoppelt, vom PC bestätigt, Speicherpunkt, PC-Ruhe |
| `docs/GERAETETEST.md` | Neue Windows- und Kopplungsstationen; bestehende Ergebnisse unverändert |
| `docs/ANKER_IMPLEMENTIERUNGSPLAN.md` | Abschnitt v7 mit Delta-Matrix und Etappenstatus |
| `docs/ANKER_TESTNACHWEISE.md` | Tatsächliche Läufe mit Zahlen |
| `CHANGELOG.md` | Neuer Abschnitt nur für tatsächlich geänderte Funktionen |
| `docs/OPTIONALE_DIENSTE.md` | Nur bei P09: Relay und Health Connect |

### Zwischenstand nach jeder Etappe

Nutze das Format aus v6 17.2 (Arbeitsverzeichnis, Branch, abgeschlossene IDs, veränderte Dateien, Tests mit Ergebnis, offene Geräte-/Windows-Prüfungen, bekannte Fehler, nächster kleiner Schritt). Lokale Commits klein, thematisch, auf Deutsch.

### Abschlussbericht an den Nutzer

Deutsch, ruhig und kurz genug zum Handeln. Der Nutzer hat ADHS: Überschriften, kurze Punkte, eine klare Reihenfolge.

1. Was du jetzt am Abend und am Morgen anders machen kannst (3–5 Punkte).
2. Was erhalten und wiederverwendet wurde.
3. Geprüft: automatisch, am PC, am Handy – getrennt.
4. Offene Entscheidungen: Codesignatur, Relay, Health Connect, Lichtwecker.
5. Installer- und APK-Pfad nur, wenn tatsächlich gebaut.
6. Höchstens 10 Prüfschritte in dieser Reihenfolge: installieren → koppeln → Testabend → echter Abend.
7. Genau ein nächster Schritt.

## 13 Quellen

Alle Seiten wurden am 09.11.2026 geöffnet und gelesen. Prüfe vor der Implementierung Plattformseiten (Android, Windows, Tauri, Plugin) erneut gegen die tatsächlich installierten Versionen; das Plugin-README ist Version 8.7.0, im Repo steht `^8.11.14`.

**ADHS, Schlaf und Abendverhalten**

- [Luu & Fabiano 2025: ADHD as a circadian rhythm disorder, Frontiers in Psychiatry](https://www.frontiersin.org/articles/10.3389/fpsyt.2025.1697900/full)
- [Pilotstudie zu morgendlichem hellem Licht bei Erwachsenen mit ADHS, J Psychiatr Res 2017 (PubMed 28327443)](https://pubmed.ncbi.nlm.nih.gov/28327443/)
- [Aktürk 2026: Gaming-Schweregrad, Chronotyp und Schlafaufschub bei ADHS-Symptomen, Bağımlılık Dergisi](https://turkmedline.net/detay/internet-gaming-disorder-severity-and-chronotype-in-relation-to-bedtime-procrastination-among-adults-with-adhd-symptoms-reporting-regular-digital-game-engagement/2d706351716f8e7f/tr/53)
- [Nauts et al. 2016: Implementation Intentions und Nudging gegen Schlafaufschub (Poster)](https://www.ehps.net/ehp/index.php/contents/article/view/2169)
- [Valshtein, Oettingen & Gollwitzer 2020: MCII gegen Schlafaufschub, Psychology & Health](https://www.psy.uni-hamburg.de/arbeitsbereiche/paedagogische-psychologie-und-motivation/personen/oettingen-gabriele/dokumente/valshtein-oettingen-gollwitzer-2020-bedtime-procrastination.pdf)
- [Bericht zu Duraccio et al. 2021: Night Shift und Schlaf, Sleep Health](https://www.managedhealthcareexecutive.com/view/-night-shift-feature-on-iphone-does-not-help-sleep-quality-say-researchers)
- [Zuraikat et al.: Editorial zu Windred et al. 2024, Schlafregelmäßigkeit und Sterblichkeit, Sleep](https://pmc.ncbi.nlm.nih.gov/articles/PMC10782489)
- [Tonetti et al. 2015: Dämmerungssimulation und Aufmerksamkeit, Eur J Appl Physiol](https://rd.springer.com/article/10.1007/s00421-014-3033-4)

**Plattformen und Bibliotheken**

- [Android Developers: Local network permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Microsoft Support: Benachrichtigungen und „Nicht stören“](https://support.microsoft.com/windows/feeca47f-0baf-5680-16f0-8801db1a8466)
- [Microsoft Learn: SHQueryUserNotificationState](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate) (Enum-Werte auf der verlinkten Enum-Seite prüfen)
- [Microsoft Learn: Smart App Control](https://learn.microsoft.com/windows/apps/develop/smart-app-control/overview)
- [Tauri 2: Plugin-Übersicht](https://v2.tauri.app/plugin/) und [Notification](https://v2.tauri.app/plugin/notification/)
- [@capgo/capacitor-health 8.7.0 README](https://cdn.jsdelivr.net/npm/@capgo/capacitor-health@8.7.0/README.md)

**Vergleichsprodukt**

- [Focus Bear](https://www.focusbear.io/) und [Closing the Gap: Focus Bear (2026)](https://www.closingthegap.com/focus-bear-a-calm-structured-way-to-block-distractions-and-see-the-whole-day/)

## 14 Startanweisung an Codex

Beginne jetzt mit P00 und arbeite danach selbstständig Etappe für Etappe weiter, ohne nach jeder kleinen Änderung zu fragen.

- Lies `CLAUDE.md`, den Implementierungsplan, die Testnachweise und diesen Auftrag vollständig. Prüfe jede Ist-Aussage aus Abschnitt 01 am Code.
- Kein zweiter schreibender Agent im selben Arbeitsbaum. Kein `reset --hard`, `clean -fd`, Force-Push. Kein Push, Merge, Tag, Release, Deployment oder kostenpflichtiger Dienst ohne ausdrückliche Freigabe.
- Fehlt in deiner Umgebung Rust, Windows oder ein Android-SDK, setze trotzdem alles Plattformunabhängige um (Protokoll, Abendlogik, App-Seite, Kotlin-Modelle) und führe den Rest ehrlich als offen.
- Frage nur bei echten Nutzerentscheidungen: Codesignatur (Kosten), Relay über Supabase, Health Connect, Lichtwecker. Alles andere entscheidest du nach diesem Auftrag und dokumentierst es.
- Halte durchgehend „geplant“, „tatsächlich“, „bestätigt“ und „noch nicht geprüft“ auseinander – in Code, Texten und Berichten.

**Letzter Produktmaßstab:** Sitzt der Nutzer um 22:20 mitten im Spiel, sieht er auf dem PC ruhig, wie viel Zeit bleibt, kann mit einem Tastendruck seinen Stand sichern oder bewusst verlängern, und das Handy weiß am Ende, was wirklich passiert ist – ohne Strafe, Scheinerledigung oder Überwachung.
