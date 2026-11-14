# T-006 – NFC-Navigationsrace lokal belegt und korrigiert

Stand 14.11.2026, Europe/Berlin. Sauberer Ausgangscommit **`1b1bce8b964acfc89c032cd04f60d18e718be380`**, Branch `entwicklung/anker-neu`. Letzter bestätigter gepushter Stand **`1847c8a041432d41a4598f5ab2e6d99540f8ddac`** aus dem vorherigen Auftrag, heute keine Remoteabfrage oder Übertragung. Alte Umgebung/835235b zurückgestellt. Nur die belegte NFC-CI-Lücke lokal korrigieren; keine neue Funktion oder zweite Engine.

## Befund und gezielte Reproduktion

[Vorherige CI-Nachkontrolle](GITHUB_BRANCH_PUSH_CODE18.md): Push43549032956 rot,1372Vitestgrün/377Browsergrün/1NFCrot; PR43549036157 separat grün mit1372Vitest/378Browser. Betroffener Test `e2e/nfc.spec.ts:150`: nach Wechsel nach `/mehr` und verspäteter Freigabe einer Öffnungsbestätigung landete die App auf `/vorbereitung`. Aus der Abweichung allein zunächst keine bestimmte Ursache abgeleitet; keine neuen CI-/Secret-/Besitzerfragen.

Vor jeder Änderung sauberen Stand und Vorher-Bundle gesichert. Vorhandener BrowserRouter und NFC-Lebenszyklus geprüft: Der Router schreibt den Browser-Historyeintrag **vor** seiner über React.startTransition geplanten Renderaktualisierung. Die NFC-Seite prüfte nach der asynchronen Bestätigung nur `live` und die lokale Sitzungsgeneration; beide können bis zum späteren Effect-Cleanup der alten Seite noch gültig sein. Ein URLwechsel ist daher kein Nachweis eines bereits beendeten React-Lebenszyklus. Das ist eine reale Produktlücke; bloß auf einen späteren Unmount im Test zu warten würde sie verdecken.

Neue Regression verwendet weiterhin den echten Mehr-Link und dessen echten Historywechsel. Sie hält die vorhandene künstliche Native-Bestätigung und löst sie gezielt im tatsächlichen pushState-Aufruf nach dem Historywechsel, vor dem anschließenden Router-Render auf. Nur der Zeitpunkt der Brückenantwort wird gesteuert; kein Timer/Store/Erwartungswert ersetzt, kein Retry oder Timeout verändert.

**Vor Korrektur auf unverändertem Produktcode:** alter betroffener Fall lokal1/1grün; neue gesteuerte Regression1/1rot mit demselben `/vorbereitung` statt `/mehr`. Zusammen zwei Fälle,1bestanden/1fehlgeschlagen,31,8s; Trace/Fehlerbild/JSON erhalten. Somit deterministischer Nachweis statt zufälligem Wiederholen eines gelegentlich grünen Falls.

## Kleinste gemeinsame Gültigkeitskorrektur

Produktänderung ausschließlich `src/ui/pages/NfcAnchors.tsx`:

- `useLocation` liest den bereits vorhandenen BrowserRouter-Besitzer. Die gemeinsame `isCurrent(version)`-Prüfung verbindet vorhandenes live-/Generationssignal mit dem tatsächlichen Browserpfad und dessen aktuellem History-entry-key. Standardkey `default` bleibt bei frischem Routereintritt nutzbar.
- Nach Navigationsbeginn ist eine alte Antwort bereits vor dem React-Cleanup ungültig. Der Entrykey unterscheidet auch verschiedene Einträge mit gleichem Pfad; keine eigene Historyverwaltung oder Navigationserkennung neben dem Router.
- Dieselbe Prüfung schützt Scan-/Öffnungsbeginn, die Wartephase auf vorherigen Abbruch, Scanantworten und Statusantworten. Die bisherigen Abbruch-, Vorschau-, Frist-, Vordergrund-/Wecker-, Epoch-/Native-Revalidierungsregeln bleiben bestehen.
- Keine native Methode, Kotlinquelle, Berechtigung, Plan-/Storequeue-/Reminder-/Weckerlogik, Persistenz, Freigabe oder Datenstruktur verändert. Keine neue Zeitmessung und kein automatisches Öffnen/Fortsetzen/Erledigen/Punktevergeben.

Teständerung ausschließlich `e2e/nfc.spec.ts`: ein neuer gezielter Regressionstest; der alte Fall und alle alten Erwartungen bleiben unverändert. Nach dem Wechsel wird die Mehr-Ansicht geprüft, LocalData bleibt gleich, erneuter Ankerseiteneintritt zeigt keine alte Vorschau und keinen zusätzlichen Scan.

## Tatsächlich ausgeführte Nachprüfung

Vorhandene Node-Abhängigkeiten und `/usr/bin/chromium` mit externer lokaler Playwright-Konfiguration verwendet. Nur Browserpfad, absolute Ausgabe-/Testpfade und Reporter angepasst; keine CI-/Timeout-/Retry-/Workerregeln gelockert. Konfiguration/Logs außerhalb des Repositorys im Sicherungsordner.

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| NFC-Browserdatei nach Korrektur | **18/18**,61,2s einschließlich Webbuild;0Fehler/Skip/Flaky, kein Retry. Alter betroffener Fall und neue kontrollierte Regression grün; bestehende Abbruch-/Pause-/Resume-/Frist-/Wecker-/Ablehnungs-/Doppeltipp-/Ungültig-/Web-/320px-/160%-Fälle erhalten |
| NFC-/Brücken-/Datenschutzregressionen | **31/31in5Dateien**,0Fehler/Skip: core/nfc,platform/nfc,platform/native,platform/nativeSafe,core/export/privacyBoundaries |
| Lint | Exit0,0Fehler/1bereits bekannte TaskAssistance-Refwarnung; keine Lockerung oder unabhängige Korrektur |
| Typecheck | `npm run typecheck`,Exit0; App-/Node-/e2e-Typen enthalten |
| Webbuild | `npm run build`,Exit0; keine Capsync-/APK-/AAB-/Signierausführung |
| Native/PC/Gesamtsuiten | Quellen unverändert, kein neuer nativer/PC-/Vollbrowser-/Vollvitestlauf. Historische274JUnit und frühere Gesamtbelege bleiben ihren alten Quellen/Prüfumfängen zugeordnet |

Der letzte komplette lokale378Browserbeleg und die alte GitHub-PR-CI bleiben historische Ergebnisse. Heute wurden18gezielte Browserfälle geprüft, kein neuer vollständiger379-Fälle-Lauf und keine neue Remote-CI behauptet. Keine reale NFC-/Galaxy-/Windows-/Kalenderbeobachtung oder echten Tag-/Geräteaktionen.

## Datengrenzen und bisheriger Paketstand

Routerpfad/-entry-key werden nur zur flüchtigen Gültigkeitsprüfung im vorhandenen UI-Lebenszyklus gelesen. Keine neuen gespeicherten Felder, Proben, Verläufe, Logs mit Router-/Tagdaten, Backups/Import-/Sync-/Widget-/PC- oder zusätzlichen Brückenübertragungen. Keine Rohpayloads/UIDs, Secret-/Schlüsselwerte oder privaten Dateien gesucht/gelesen. Nur synthetische Testbrücke; keine echte NFC-Funktion aufgerufen oder Nutzdaten gelöscht.

Neue im Webbuild eingebettete Appquellkennung **`e9c1249900f449001be6dfb80674a5fe9b2b27af8d2cabf195dba9b2ab654b99`**. Paket-/Projektversion unverändert Code18/1.5.0-rc.4; keine neue Versions-/Signier-/Uploadfreigabe. Das alte unsigned AAB aus **`014870f3ee52c0233118d2852ef0719aa9bc602b`**, Quellkennung760868d…/SHA256d0d5cfed…, bleibt unverändert **historischer Nachweis vor dieser Korrektur** und enthält diesen Fix nicht. Ebenso keine Korrektur der eingebetteten nativen Webassets behaupten: kein Capsync/Paketneubau. Alte Code17-Manifeste/Artefakte/SDK-/Signier-/Workflowbindungen erhalten.

## Abschlussumfang und nächster separater Auftrag

**Lokale Ursache/Korrektur/gezielte Regression abgeschlossen.** Aktueller Remote-Pushfehler bleibt bis zu einem neuen autorisierten Push und tatsächlich erfolgreicher neuer CI ein offener Remote-Nachweis. T-006/V-014 **IN_ARBEIT**; E-002–E-005 sowie main-/Paket-/Signier-/Upload-/Geräte-/Release-/Gesamtfreigaben offen. Keine aktuelle Remoteverfügbarkeitsbehauptung aus lokalen Trackingrefs, kein Push/Merge/Tag/Fetch/Checkout oder Workflowstart/-neustart/-änderung, Cloud-/Auth-/Secret-/Playaktion. Keine Paketupdates/anderen Produktaufgaben.

Validierten Produkt-/Testdiff und Dokumentation lokal committen und sichern. Finale Commit-ID und geprüfte Dateihashes in `/workspace/anker-t006-nfc-fix-20261114/RESULT.json`; geänderte Produkt-/Testdateien entsprechen dort dem tatsächlich geprüften Arbeitsstand. Vorher-/Nachher-Bundle, rote und grüne Testbelege, Build-/Lint-/Typechecklogs, Quell-/Versions-/Dokumentintegrität, unabhängige Bundleprüfung/fsck/Dateihashes, RESTORE.md/SHA256SUMS. Nur Cloud-lokal, kein neuer externer Backup-/CI-Beleg.

Genau nächster zulässiger Einzelauftrag nach neuer ausdrücklicher Beauftragung: den korrigierten finalen Commit einmalig per normalem Fast-forward ausschließlich auf den Entwicklungsbranch übertragen und die dadurch ausgelöste unveränderte Push-/PR-CI/gegebenenfalls bereits vorhandene Previewautomatik lesend nachkontrollieren. Vorher aktuelle Zielrefs/Quell-/Workflowgrenzen prüfen; Ausgangs-Remote H1847c8a ist historisch aus dem vorherigen Auftrag, nicht heute erneut geprüft. GitHub-HTML ist belegter lesender Metadatenweg trotz API-CONNECT403, keine Authreparatur oder erneuten Nutzer-/Secretfragen. Keine main-/Tag-/Signier-/Paket-/Playfreigabe. Jetzt nach lokalem Abschluss stoppen.
