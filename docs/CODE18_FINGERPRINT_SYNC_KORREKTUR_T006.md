# Code18-AAB: korrekte Quellkennung nach bestehendem Capacitor-Sync

## Tatsächlicher Befund und eng begrenzte Korrektur

Nutzerscreenshot zum Prepare43941667392/Versuch1/Job133560604382 belegt **AAB-Prüfung abgebrochen: FINGERPRINT_NATIVE**. QuelleW2793dbaa59dbab1d4cbcba9cf4bb4bd350beb529, feste Appquelle0c31179be780e0bb6359dee79c3502d4e6e8ba4d mit Weckzeitfix. Paketierung grün, Unsignedprüfung rot, Upload/Ausgabe/sign/verify übersprungen. Vorgelagerte Quell-/ZIP-/JAR-/Bundletool-/Manifestprüfungen sind nach bestehendem Kontrollfluss vor dieser Stelle durchlaufen; endgültiger Proof und Assetabschluss fehlen. Der gemeinsame Code bedeutet fehlende passende Kennung oder fehlende64BitELFs. Konkrete Runnerbytes/ELFzahl sind nicht gelesen; daraus keine Bibliotheksabwesenheit erfinden.

Die bisher von uns gebundene Kennung4f8a7b5a… stammt vom Webbuild vor Capacitor-Sync. Das war für diesen Android-Prüfweg die falsche Phase. Der vorhandene Workflow führt bereits Webbuild/CapSync/Webbuild/CapSync aus; diese Sequenz und die produktive Kennungsfunktion werden nicht geändert. Die Vite-Funktion hashte immer auch android/app/src/main/res/xml/config.xml, sobald Capacitor diese ignorierte Datei angelegt hat. Deshalb ist für denselben festen Appquellcommit eine andere Kennung nach Sync korrekt.

| Bindung | Vollständiger Wert |
| --- | --- |
| Feste Appquelle | 0c31179be780e0bb6359dee79c3502d4e6e8ba4d |
| Bisheriger Vor-Sync-Pin | 4f8a7b5add918138f3dadcfe84fc8f16c818ad8610481dd6b1b56f035923efc1 |
| Korrigierter Nach-Sync-Pin | fff132db9c3e7f1654081665551ecabef096717d022bf1588c1d99a2362773df |
| Generierte config.xml SHA256 | e9dcda493e663c5c4db9e3cb3bd968477a6e90aa8840bcbba40d72ed54b767ce |
| Unabhängige eigene App-main-CI | 43873584133/exaktApp0c31179/push/main/Versuch1/Success |
| Bisherige eigene Workflow-main-CI | 43939327282/exaktW2793dbaa/push/main/Versuch1/Success |

## Unabhängige lokale Reproduktion

Exakte App0c31179 über vorhandenes git archive in ein neues isoliertes Datenverzeichnis kopiert, vorhandene gepinnte node_modules eingebunden. Keine Änderung alter Arbeitsbäume, kein Fetch/Checkout/Reset/Neuinstallation. Die tatsächliche bestehende Vite-Virtualmodule-load-Funktion wurde mit einem minimalen Pluginkontext aufgerufen; keine zweite Fingerprint-Engine, kein App-/Web-/Androidbuild.

Vor Sync ergibt sie4f8a7b5a…. Ausschließlich synthetische dist/index.html angelegt, dann vorhandenes Capacitor sync android in der isolierten Fixture ausgeführt: echte statische Sync-Dateierzeugung ohne Gradle/SDK/Signierung/Installation/Netzwerkdienst. Danach ergibt dieselbe Vite-Funktionfff132db…. Zweiter Sync liefert denselben Wert. Wird nur die neu erzeugte config.xml vorübergehend außerhalb des Hashbaums abgelegt, entsteht wieder4f8a7b5a…. Anschließend Datei unverändert zurückgelegt. Damit ist gerade dieser Eingabedelta belegt; Runtime-AAB-Bestand wird dadurch nicht vorgetäuscht.

Die lokale Abhängigkeitssymlink-Topologie bewirkt zusätzlich andere relative Pluginpfade in der ausschließlich synthetischen Fixturedatei android/capacitor.settings.gradle. Diese Datei gehört nicht zu den Fingerprint-Eingaben. Dieser Unterschied ist in source-fingerprint-reproduction.json offen ausgewiesen und wird nicht als Runneränderung oder produktiver Patch übertragen. Originale Quellen/Sicherungen erhalten. Synthetische dist-Dateien sind keine getesteten Appassets oder Paketartefakte.

## Minimalfix, Rot-/Grünbeleg und erhaltene Gates

Nur scripts/android-aab-proof.py und notwendige Offline-Regressionsfälle ändern:

- Festen FINGERPRINT-Pin auf den aus der unveränderten Appquelle nach bestehendem Sync gewonnenen Wert korrigieren. Keine Akzeptanz beliebiger/mehrerer Kennungen oder Fallback auf alten Wert.
- Dieselbe abschließende Bedingung fingerprint AND elf>0 in zwei gleich strikte require-Prüfungen zerlegen. Nun eindeutige begrenzte Fehler FINGERPRINT_MISMATCH beziehungsweise NATIVE_MISSING. ELF-Schleife/64Bit-/16KB-/Loadsegmentprüfungen byte-/ASTgleich erhalten.
- Unabhängig von P.FINGERPRINT konstruierte synthetische ZIP-Fixture enthält den tatsächlich ermittelten Nach-Sync-Pin und eine gültige künstliche64Bit-ELF. Vor Fix reproduziert sie FINGERPRINT_NATIVE; nach Fix wird sie akzeptiert. Gegenfälle falsche/alte Kennung trotz gültigerELF, fehlende/32Bit-nativeBibliothek und4KB-Alignment werden weiterhin abgelehnt.

Ergebnis **41Protokoll-/Javafälle und32Workflowfälle einschließlich17SDK-Attrappen grün**. Vorheriger einzelner roter neuer Regressionsfall unverändert gesichert. Keine Produktvollsuiten/App-/SDK-/AAB-Builds oder Signierprobe lokal wiederholt. Attrappen sind kein Runner-/Kryptografie-/Installierbarkeitsnachweis. AST-Vergleich bestätigt: außer FINGERPRINT und gleichwertig aufgeteiltem Schlussguard keine Helperänderung. Workflowdefinitionen, Appquelle/Quell-CI, GITHUB_SHA-/WORKFLOW_SHA-/main-/Dispatch-/Null-Signier-/Signierer-/Versuchs-/Artefakt-/Hash-/Manifestgates unverändert. Alte Code17-Manifeste/APK-/Release-/Playpfade und B4Upload/8APlay bleiben erhalten.

## Regulärer weiterer Weg und offene Grenzen

Isolierter neuer Fixarbeitsbaum basiert auf Remote-Entwicklung6c2031dbe7f4ceb49370f8ea86de22536538df03; bisherige ausschließlich lokale Dokumentationsnachfolger bis a201b2947285764da87ed68f8b8b0e9f25913260 bleiben in ihrem bisherigen Arbeitsbaum unverändert und werden nicht übertragen. Frische Refs vor einem normalen Fast-forward-Push prüfen. Neuer Fix-/CI-head ist noch keine main-Workflowquelle. Neue automatische Branch-CI vollständig nachkontrollieren, keine Docs-Ausnahme. Danach regulären neuen PR nach main2793dbaa erstellen/prüfen, keine direkte main-Änderung, kein Force/Admin/Squash/Rebase/Queue/Automerge/Branchlöschen. Bei fehlendem Agenten-APIweg normalen bereits angemeldeten Besitzer-UI-Weg konkret vorbereiten, keine neue Berechtigungsfrage oder Promptkette.

Erst tatsächliches regulär integriertes W-neu und dessen eigene erfolgreiche exakte ci.yml/push/main/Versuch1-bzw-tatsächlicherVersuch nachweisen. App0c31179 und eigener Quellbeleg43873584133 bleiben unabhängig. Neuer Prepare muss neu an W-neu gebunden werden; alten Lauf43941667392 nicht neustarten, kein P5-/U1-/latest-/Proof-Ersatz. Neues U2/H2/HP/A und späteres S/HS fehlen. Lokaler Kennungsbeleg ist noch kein vollständiger erfolgreicher Runner-Prepare; mögliche zusätzliche native Fehler bleiben ohne tatsächliches neues Ergebnis offen.

Code18/1.5.0-rc.4/Paket/SDK/Rechte unverändert; kein Play-Code18-Inventarbeleg oder stillerCode19. Kein privater Schlüsselzugriff, Secret-/Auth-/Cloudwechsel, Signieren/Installieren/Upload oder echte Geräte-/NFC-/PCaktion. B4-/API-/Googlezugang bleibt Releaseblocker. T-006/V-014 IN_ARBEIT, E-002–E-005/Geräte/Gesamt offen. Ursprünglicher vollständiger Weckzeit-Übergabeprompt unverändert letzter Planpunkt; Fix selbst ist in fester Appquelle0c31179 enthalten.

Quellen, Screenshotzuordnung als Nutzerbeleg, isolierte Reproduktionsdaten, Rot-/Grünlogs, Nachkontrolle und Git-Bundles/Restore unter /workspace/anker-code18-fingerprint-fix-20261116/ sichern; keinen erfundenen AAB-/Screenshot-Dateizugriff ausgeben. Nachkontrollnachfolger nur lokal committen und nicht nachpushen.
