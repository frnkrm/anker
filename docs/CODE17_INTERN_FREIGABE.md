# Code17 im internen Test bereitstellen

## Auftrag und exakte Wirkung (15.11.2026)

Nach frisch bestätigtem Bestand hat der Nutzer die Bereitstellung von Code17 für seinen internen Test freigegeben. Seine installierte Handyversion ist 1.5.0-rc.2; PC-Begleiter nicht installiert. [Leselauf43738232703](https://github.com/frnkrm/anker/actions/runs/43738232703) auf `40cc4c2ec45d83ac0442a69e37d6c75d13849bd5` bestätigte am15.11.2026 um16:56UTC Code17 draft und Code16 completed, passendes Code17-Bundle, keine Mutation/Veröffentlichung, eigenes leeres Edit gelöscht. PR7 vorher grün/integriert; dessen anfängliche Planung ohne Playmarker wurde durch die spätere ausdrückliche Lese-Freigabe ersetzt.

Diese neue Freigabe betrifft nur `de.frnkrm.anker.mobile`, Track `internal`, bestehendes Code17-Bundle SHA256 `2e53d046d32ec4fc53f083a0a9a59e688f1224615af7946330642e97b8c84098`. Keine neue Appversion, kein Build, Upload oder Signing, keine Tester-/Produktionsänderung. Paket, Signaturen, Quelldaten, unveränderliche Entwurfsfreigabe und Auth bleiben erhalten.

## Begrenzter Ablauf

Neues Programm `scripts/google-play-internal-release.py` liest das unveränderte Code17-Freigabemanifest und verlangt zusätzlich `RELEASE_CODE17_INTERNAL`. Es akzeptiert im frischen Edit nur die genaue Ausgangsstruktur mit Code16 completed und Code17 draft; Zielname und Bundlehash müssen stimmen. Fremde/zusätzliche/doppelte Versionen, geänderte Bundlehashes und Staged-Rollout-Felder stoppen vor Änderung.

Der vollständige Code17-Release-Datensatz wird übernommen, Status completed und Versionen [16,17] gesetzt. Die bisherigen beiden Release-Dictionaries werden durch diesen einen internen Release ersetzt. Code16 bleibt dabei als Bundle im neuen Release erhalten; seine alten separaten privaten Release-Metadaten werden nicht als unverändert bewahrt behauptet. Code17 wird geeigneten internen Testern als höhere Version angeboten. Keine öffentliche Produktionsfreigabe.

Die offizielle Discovery von Google (am15.11.2026 über googleapis/google-api-python-client/discovery_cache/documents/androidpublisher.v3.json gelesen) beschreibt completed als Bereitstellung an alle Nutzer des betreffenden Tracks und verlangt zur Beibehaltung alter Versionen deren Aufnahme in versionCodes. userFraction ist nur bei inProgress/halted zulässig und wird hier abgelehnt.

Nur internal-Track-PUT, Validate und einmal Commit mit `changesInReviewBehavior=ERROR_IF_IN_REVIEW`; eine laufende Prüfung wird niemals abgebrochen. Kein `changesNotSentForReview`-Fallback und keine Mutationsretries. Bei unklarer Antwort bleibt der Zustand als inconclusive offen, bevor etwas erneut gestartet wird. Ein neues Edit liest den gespeicherten vollständigen Release und Bundlehash nach; nur identische Metadaten, beide Codes ohne Duplikate und completed bestätigen Erfolg. Reihenfolge der zwei versionCodes darf sich ändern. Ein bereits genau passender aktiver Release wird nur gelesen.

## GitHub-Ausführung und Nachweise

Eigener Branch `release/code17-internal-20261115` ab `40cc4c2ec45d83ac0442a69e37d6c75d13849bd5`. Neuer Workflow `.github/workflows/google-play-internal-release.yml`: ausschließlich main, manuelle exakte Bestätigung oder eigener main-Pushpfad plus Marker `[anker-internal17-release]`. Keine PR-/workflow_run-Ausführung. Gemeinsame Play-Sperrgruppe, keine Abbruchkonkurrenz. Offlineprüfungen und bytegleich wiederverwendeter ursprünglicher App-/CI-Gate vor Auth; Secret nur im Authschritt, kurzlebiges Token nur im Aktivierungsschritt. Bereinigter Ergebnisbericht als Actions-Artefakt14Tage. Kein Aufruf von Upload-/Produktions-/Testerendpunkten im eng begrenzten Transport.

Aktuell lokal **17 neue Aktivierungs-/Workflowmethoden, 77 bestehende Upload-/Inspektor-, 24 Auth- und 36 Workflowmethoden =154 grün**. Tests decken Bestands-/Metadatenabweichungen, Bundlehash, Bestätigung, Idempotenz, Readback, keine Wiederholung/unklare Antwort, bereinigte CLI-Berichte, Endpunktgrenzen und Workflowgates ab. YAML zusätzlich geparst; keine Installation. Logs nur lokal unter `/workspace/work/code17-internal-proof/`. Originale Appsoftware-/Gerätenachweise bleiben ihren bisherigen Quellen zugeordnet; keine neue Geräteabnahme.

Normale Push-/PR-CI muss vor der Integration erfolgreich sein. Nutzerfreigabe gilt für diese notwendige Integration und den eng gebundenen internen Bereitstellungsschritt. Der spätere explizite Merge-Marker startet diesen Schritt; ein gewöhnlicher Branchpush/PR allein nicht. Die zusätzliche main-CI läuft unabhängig und wird getrennt berichtet. Eine erfolgreiche API-Freigabe allein bestätigt weder sofortige Play-Store-Verfügbarkeit noch Installation oder Gerätefunktion.

Stand dieses vorbereiteten Commits: noch keine Aktivierung ausgeführt. Tatsächliches Ergebnis erst durch den zugehörigen späteren Actionsbericht belegen; kein Erfolg aus bloßem Merge oder Jobstart.
