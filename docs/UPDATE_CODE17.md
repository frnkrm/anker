# Code17: Abschluss und Readback-Sicherung (15.11.2026)

Dieser Abschluss wurde aus tatsächlichem main `024db974952de0842c50f1273609f52185be0c67` und der Nutzerübergabe rekonstruiert. Die ursprünglichen ungesicherten Dokumente und die Fixcommits `835235b74765f2eed5519c8f40fc1126458c1063` / `ce42193ca15328d008ae3deceaf04bc8cf4ea6d3` sind hier nicht verfügbar; beide Remote-Fetchversuche ergaben `not our ref`. Neuere Code18-/T-006-Arbeit bleibt erhalten. Dies ist keine neue Veröffentlichung.

## Aktuell geprüft

Nur `scripts/google-play-upload.py` und seine Tests geändert: Der abschließende Vergleich akzeptiert identische vollständige Release-Dictionaries auch als umgekehrtes Paar. Anzahl, Mehrfachheit, Metadaten und beobachteter Entwurf bleiben gebunden. Keine allgemeine Sortierung oder Feldreduktion.

Neue Regressionen waren vor Fix in beiden Commitpfaden rot (77 Methoden, zwei erwartete Fehler); nach Fix `python3 scripts/test-google-play-upload.py`: **77 grün**, `python3 scripts/test-google-play-auth.py`: **24 grün**, `python3 scripts/test-google-play-workflow.py`: **35 grün**. Insgesamt 136 aktuelle Offline-Testmethoden. Umkehrung bei normalem/kompatiblem Commit erlaubt; geänderte Code16-/Code17-Metadaten, Duplikate, zusätzliche/fehlende Releases und fehlender Entwurf abgelehnt. Keine echten Googleanfragen. Dateihashes in [ANKER_CODE17_NACHWEIS.json](ANKER_CODE17_NACHWEIS.json) binden die Ausführung an die getesteten Quellen. Logs nur lokal unter `/workspace/work/t001-proof/`.

Der vorhandene PC-Updatekanal wurde mit `verify_channel` kryptographisch und zeitlich geprüft (Vergleichsversion 0.1.0). Ablauf **17.11.2026, 04:26:52 Europe/Berlin**; keine Verlängerung. Das bestätigt das lokale Kanalmanifest, keinen heutigen entfernten Download oder Windowsbetrieb.

## Historischer Release, keine heutige Play-Bestätigung

Laut übergebener Historie: Anker 1.5.0-rc.3 / Code17, Paket `de.frnkrm.anker.mobile`, Appquelle `80f6a692b005ab08edacf9e6ad9e9669e4c383f7`, Laufzeitkennung `10c21f4f5bb07215244a1cc53dc21f8423a020f24aa7c1cfb4df38b9c3e441c7`. Bestehende B4-Signierung; Uploadzertifikat allein beweist keine APK-Kompatibilität mit Play App Signing.

Historisch gemeldet: 1183 Logik-, 308 Browser-, 252 Android-JUnitfälle/28 Suiten, 680 frische Gradleaufgaben, Typecheck/Build, Lint 0 Fehler/1 bekannte Warnung, Signatur/16KB und 70 Webdateien. [App-CI42748341550](https://github.com/frnkrm/anker/actions/runs/42748341550) gehört exakt zur Appquelle. Historisch wiederverwendet: 284 PC-, 5 Paket-/Installer-, 16 PostgreSQL-/RLS-Fälle; hier nicht erneut ausgeführt. Reale Galaxy-/Windows-/Kalenderprüfungen offen, keine Gerätehäkchen geändert.

[Upload42753495276](https://github.com/frnkrm/anker/actions/runs/42753495276) hatte laut Übergabe bestätigten Commit mit anschließend rotem Reihenfolgevergleich. [Bestandsprüfung42754888346](https://github.com/frnkrm/anker/actions/runs/42754888346) auf `e48d2892846b4a2fec45bf0cefc396e1a4c92f10` bestätigte damals Code17-Entwurf und aktiven Code16 sowie passende Bundle-SHA, ohne neuen Upload/Trackwechsel. Dies beweist keine vollständige Gleichheit privater historischer Code16-Metadaten. Heute Actions-API `Forbidden`; keine Live-Playprüfung, kein neuer Erfolgsstatus für diese alten Läufe.

## Historische Downloads

URL, Bytes und SHA256 sind ausschließlich aus der Nutzerübergabe übernommen, heute nicht erneut heruntergeladen. PC-ZIP-Hash gilt exakt für die hier genannte Codeload-URL, nicht für andere ZIP-Namen oder RAW-Dateien.

- [APK](https://raw.githubusercontent.com/frnkrm/anker/a33801e734b9d2d2d31b50b55521742e2ab19ad2/Anker.apk): 38645786 Bytes; SHA256 `e9823be7f69c6304320c5f3c5e94e485ef7bcd4c13482f2a11505f8ef9f269e4`.
- [AAB](https://raw.githubusercontent.com/frnkrm/anker/e448f35c88a4483a6451a1b65b78b2101f8485bd/Anker.aab): 22705124 Bytes; SHA256 `2e53d046d32ec4fc53f083a0a9a59e688f1224615af7946330642e97b8c84098`.
- [PC-ZIP](https://codeload.github.com/frnkrm/anker/zip/f8275544b1192d069e23b49d79529f9e805d3945): 101757 Bytes; SHA256 `5ff9081dc3feef75bc193d8c50f7ab483b6904a8bc526df005c61e94ff2c7ddf`.

APK: als Update versuchen; bei Signaturablehnung keine Deinstallation/Datenlöschung. Stille Folgehinweise: Mehr → Einstellungen → Schlaf & Anker → Leise Schlafenszeit-Folgehinweise (standardmäßig aus). Kalender: Mehr → Einstellungen → Kalender & Sync → Google-Kalender auf dem Handy auswählen; persönliche Freigabe am Handy erforderlich. LAN-Abgleich benötigt kein Supabase; produktiver Relaybetrieb und kostenpflichtige Windows-EXE-Signierung nicht nachgewiesen.

## Sicherungsgrenzen

Eigener Branch `fix/t001-readback-abschluss-20261115` ab obiger main-Basis. Andere Arbeitsbäume und lokale Commits erhalten. Offene PRs konnten per API nicht gelesen werden; keine Aussage über andere laufende Chats.

Alle Workflowtrigger vor Sicherung gelesen: Branch-Push/PR starten normale CI; Release nur bei v-Tag, Play nur manuell oder main+Workflowpfad+Marker, Android-Update/AAB nur manuell. Kein Tag/Dispatch/Playmarker verwendet. Keine workflow_run-Trigger gefunden. Externe Hostingkonfiguration ist dadurch nicht bewiesen; kein Deployment beauftragt.

`play-upload-diagnose.yml` bleibt erhalten: eng an alten Bericht gebunden, aber mehrere aktuelle T-006-Übergaben referenzieren die Datei; heutige Erledigung des Diagnosezwecks nicht unabhängig bestätigt. Historie: `134fd35b6b9bbf47cd0b02875b8f68c1cbad22d7`, [Lauf42751498157](https://github.com/frnkrm/anker/actions/runs/42751498157). Keine erforderliche Prüfung entfernt.

App-/Android-/PC-Laufzeitcode, Version, Paket, Artefakte, Schlüssel, Pins und Nutzerdaten unverändert. Deshalb keine neue App-/Android-/Browser-Vollsuite oder APK/AAB-Erzeugung. Neue Code18- und Roadmapnachweise behalten ihren eigenen Stand.
