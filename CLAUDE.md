# CLAUDE.md – Anker

Persönliche ADHS-Alltags-App (Deutsch). Android via Capacitor 8 + Web/PWA via Netlify, eine Codebasis.
Leitlinien: eine nächste Aktion groß, keine Schuld-Sprache, kein Rot für Verpasstes, Offline-Kern,
alle Online-Extras optional und still bei Fehlern.

## Befehle

```bash
npm run dev            # Vite-Dev-Server :5173
npm test               # Vitest (src/**/*.test.ts), TZ=UTC erzwungen, Logik rechnet selbst in Europe/Berlin
npm run test:e2e       # Playwright-Smoke-Test gegen Produktions-Build (:4173)
npm run lint && npm run typecheck
npm run build          # tsc -b + vite build → dist/
npm run android:debug  # build + cap sync + gradlew assembleDebug
node scripts/gradle.mjs :app:testDebugUnitTest  # JUnit für die reine Kotlin-Logik
node scripts/icons.mjs # PNG-Icons (PWA + Android) aus public/icon.svg neu erzeugen
```

Windows-Hinweis: Android-Build braucht `JAVA_HOME` (JDK 21) und `ANDROID_HOME`. Der Dev-Server nutzt
unter Windows Polling, weil schnelle Dateiänderungen sonst verpasst werden.

## Architektur

```
src/core/          Reine Logik, keine Seiteneffekte, vollständig getestet
  time.ts          Europe/Berlin: Plan-Minuten (ab lokaler Mitternacht, >1440 = nach Mitternacht) ↔ UTC-ms
  types.ts         Settings, DayLog, DayPlan, Block, GameState …
  defaults.ts      Standardwerte, suggestSchedule() (rückwärts vom Arbeitsbeginn)
  planner/         buildDayPlan(): Zeitleiste, Termine, Minimal-Versionen, „Ich mache länger“
  now.ts           nowView(): was der Tagesplan gerade vorsieht
  support.ts       nextAction(): genau eine Handlung inkl. Arbeit, Aufgaben, Wiedereinstieg; Modi, Puls
  alarm.ts         Konfiguration für den nativen Wecker
  game/            Themen, XP/Level, Tagesziele je Stufe, Kapitel mit „Nie zweimal“ + Joker, Erfolge
  reminders/       buildReminders(): Erinnerungen mit Slot und Rang inkl. Eskalation/Ruhezeiten
  export/          .ics, JSON-Backup, PC-Stopp-Skripte (PowerShell)
src/data/          Repository-Schnittstelle: SqliteRepository (Android), DexieRepository (Web), Memory
                   Ein generischer Datensatz {collection, id, data, updated_at, deleted, dirty}
src/state/         Zustand-Store (useApp), planFor() mit Cache, onPlanChange()-Hook
src/platform/      Alles Native/Netz, jeweils in safe() gekapselt:
                   notifications, alarm, native (eigenes Plugin), health, qr, google, supabase, files, effects
src/ui/            components/ (UI-Kit, Shell, Timeline, Sortable …), pages/ (eine Datei pro Bereich)
android/app/src/main/java/de/frnkrm/anker/   Kotlin: AnkerNativePlugin, AlarmModel/Controller/Service,
                   ReminderModel/Scheduler, Widget, Receiver
supabase/          migrations/ (RLS, upsert_records mit LWW), functions/pc-stop (Deno)
e2e/               Playwright-Smoke-Test
```

Datenfluss: UI → Store-Aktion → Repository (lokal, `dirty=1`) → `onPlanChange` → effects.ts plant
Erinnerungen/Wecker neu, aktualisiert Widget, synchronisiert (gedrosselt: Sync 1 min, Kalender 15 min).

## Konventionen

- TypeScript strict, `noUncheckedIndexedAccess`. Keine `any`.
- Neue Logik zuerst in `src/core/` als reine Funktion + Vitest-Test, dann UI.
- Zeiten im Plan immer als Plan-Minuten; nur an Rändern (Notifications, Kalender, Logs) in UTC-ms umrechnen.
- Texte: Deutsch, du-Form, freundlich, kurz. Kein „verpasst/versagt“, keine roten Farben (Tokens: accent, warm).
- Optionale Extras nie blockierend: `safe()` verwenden, Fehler nur loggen.
- Store-Aktionen sind die einzige Stelle, die ins Repository schreibt.
- Native Fähigkeiten über `AnkerNative` (TS: `src/platform/native.ts`, Kotlin: `AnkerNativePlugin.kt`), beide Seiten synchron halten.
- Sheets/Overlays per Portal rendern (`Sheet` in ui.tsx), da die Navigation `backdrop-filter` nutzt.
- Commits auf Deutsch, klein und thematisch.

## Wecker und Erinnerungen (Regeln)

- `AlarmController` ist der einzige Besitzer des Weckerzustands. Regeln nur in `AlarmModel.kt` ändern, mit JUnit-Test.
- Jede Alarmart (Haupt, Vor, Schlummern, Test, Wachheit) hat eigenen requestCode und eigene Action. Nie teilen.
- Der Store ist die Wahrheit, Kotlin hält über `syncAlarmConfig` eine Kopie und plant damit selbst weiter. Keine Inhalte in diesen Spiegel: Er liegt im Geräteschutz-Speicher, ohne Entsperren lesbar.
- `reconcile` nach Feuern, Stopp, Timeout, Schlummern, Neustart, Update, Zeit-/Rechteänderung. Muss idempotent bleiben.
- Weckerplanung nicht über `safe()`: Fehler landen in `alarmStatus` und sind auf „Jetzt“ sichtbar.
- Niemals: Einnahme aus Wecker-Ereignissen ableiten, Wirkung anzeigen, Lautstärke oder „Nicht stören“ von selbst ändern, Hardwaretasten blockieren.
- Erinnerungen stellt `ReminderScheduler` zu, nicht das Capacitor-Plugin (das nur noch für Berechtigungen). Höchstens drei sichtbare Slots, der laufende Alarm wird nie weggeräumt.
- Arbeit und Einnahmeprotokoll liegen in `LocalData` (`meta/local`), ausgenommen vom Sync. Texte auf dem Sperrbildschirm allgemein halten.
- Status ehrlich führen: „am Gerät verifiziert“ nur nach echtem Handy-Test (`docs/GERAETETEST.md`).

## Flexible Planung (Regeln, Details in docs/FLEXIBLE_PLANUNG.md)

- Nichts als erledigt ausgeben, was nicht gemacht wurde: `routineCompleted` für echte Erledigung, `not-needed` und `skipped` bringen keine XP.
- `override.adjusted` macht einen Tag höchstens neutral, nie verfehlt.
- Harte Termine nie selbst verschieben, Fahrzeiten und Rückkehr nie erfinden, Weckzeit nur nach Bestätigung und nur für einen Tag.
- Termine und Orte nur in `LocalData`. Erinnerungstexte nennen weder Anlass noch Ort.
- Änderungen über „Heute anders“ laufen durch `adjustDay`, damit sie rückgängig zu machen sind.

## Fallstricke

- Paketname `de.frnkrm.anker` steht in `app.config.ts`, `android/app/build.gradle`, Kotlin-Paket, Supabase-Redirect.
- Health-Connect-Plugin deklariert viele Rechte; das App-Manifest entfernt alle außer READ_EXERCISE/READ_STEPS.
- Werbe-IDs (AD_ID, AdServices) werden im Manifest per `tools:node="remove"` entfernt; SocialLogin ohne Facebook (capacitor.config.ts).
- Plan-Tag wechselt erst um 04:00 (`activePlanDate`), damit Bettzeiten nach Mitternacht zum Vortag gehören.
- Edge Function `pc-stop` mit `--no-verify-jwt` deployen (Auth über `x-anker-token`).
