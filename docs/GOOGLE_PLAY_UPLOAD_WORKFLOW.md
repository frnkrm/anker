# Google Play: internen Entwurf hochladen

Stand 10. November 2026: Nutzer bestätigt App-Anlage und Repository-Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. Der [GitHub-Workflow](https://github.com/frnkrm/anker/actions/workflows/google-play-upload.yml) verarbeitet genau das bereits geprüfte Code16-App-Bundle. [Der erste tatsächliche Lauf](https://github.com/frnkrm/anker/actions/runs/42720560496) auf `55a383f` bestätigt Secret-Verfügbarkeit, erfolgreiche OAuth-Anmeldung und lesenden Play-API-Zugriff. Er stoppt vor Bundleupload, Trackänderung und Commit mit `EXISTING_RELEASE_CONFLICT`. Welches Trackfeld oder welcher Release den sicheren Stopp ausgelöst hat, ist aus dieser ersten Annotation noch nicht erkennbar; ein aktiver Release wird daraus nicht behauptet. Ein gespeicherter Entwurf ist noch nicht bestätigt.

Die anschließende Diagnosergänzung gibt ausschließlich Trackgleichheit, Listenform sowie höchstens sechs Releasezustände und je sechs numerische Versionscodes aus. Namen, Notizen und andere Remote-Felder werden verworfen; die öffentliche Annotation filtert die Daten nochmals. Die bestehenden Konfliktgrenzen bleiben erhalten. Ein erneuter autorisierter Versuch klärt den konkreten Bestand; keine automatische Wiederholung einer unklaren Commitmutation.

**Tatsächlich geklärter Bestand:** [Lauf42721343910](https://github.com/frnkrm/anker/actions/runs/42721343910) auf `19115e2` bestätigt `internal`, genau einen Release mit `status=completed` und `versionCodes=[16]`. Der damalige reine Draftpfad stoppt deshalb weiterhin vor jedem Upload/Track-Commit. Die folgende eng begrenzte Ergänzung kann diesen bereits bestehenden Release rein lesend bestätigen: nur bei exakt passender Code16-Bundle-SHA und genau diesem einzelnen `completed`-Release. Ergebnis `already-active` behauptet weder einen neuen Entwurf noch eine Veröffentlichung durch diesen Workflow. Andere aktive, gemischte oder unklare Bestände bleiben Konflikte.

Der erste ausdrücklich beauftragte Versuch startet beim Einchecken des Workflows auf main mit der Commitmarkierung `[anker-play-draft]`. Spätere Läufe erfolgen über **Actions → Google Play – internen Entwurf hochladen → Run workflow → main**. Normale Appänderungen, Pull Requests und fremde Branches lösen keinen Play-Upload aus. Gleichzeitige Uploadläufe werden serialisiert.

## Was der Workflow macht

1. Offline-Tests für OAuth, Upload und Workflowgrenzen ausführen. Den freigegebenen App-Stand, seinen exakten erfolgreichen main/push-CI-Lauf und alle drei damaligen CI-Jobs über GitHub unabhängig prüfen.
2. Genau das signierte Code16-Bundle aus dem unveränderlichen Git-Blob herunterladen; Größe und SHA256 prüfen. Zwei öffentliche Datendateien über eine Artefakt-ID dieses Laufs an einen getrennten Job übergeben.
3. Identität der getesteten Upload-/Authprogramme, Manifest und Bundle erneut prüfen, bevor auf das Google-Secret zugegriffen wird.
4. Das Servicekonto ausschließlich im Auth-Schritt verwenden. Standard-OAuth-JWT-Austausch für `androidpublisher`, ohne Delegations-`sub` oder zusätzliche IAM-Rollen. Temporärer Schlüssel wird vor dem HTTP-Aufruf entfernt; Token wird vor der Ausgabe maskiert und nur dem Upload-Schritt übergeben.
5. Ausschließlich `de.frnkrm.anker.mobile`, Version16, Kanal `internal`, Status **draft** bearbeiten. Vorhandene passende Entwürfe wiederverwenden, andere Entwürfe erhalten und bei unerwarteten Beständen stoppen. Den bereits aktiven Einzelrelease16 nur bei identischer Bundle-SHA rein lesend als `already-active` bestätigen; dabei kein neuer Upload, Trackänderung, Validate oder Commit. Kein Erzeugen von App-Signierschlüsseln, kein Testerlisten-, Produktions- oder Zahlungsaufruf.
6. Edit validieren und mit `changesInReviewBehavior=ERROR_IF_IN_REVIEW` committen. Eine laufende Google-Prüfung wird nicht automatisch abgebrochen. Zusätzlich bleibt `changesNotSentForReview=true` gesetzt; dieser Parameter ist laut aktueller API-Beschreibung für Ablehnungsfälle und keine universelle Veröffentlichungssperre. Die feste Release-Eigenschaft **draft** ist die entscheidende Verteilungsgrenze.
7. Den gespeicherten Entwurf in einem neuen reinen Prüfsnapshot lesen. Öffentliche Statusannotation und bereinigten Ergebnisbericht erstellen. Ein Timeout nach Commit wird als unklar gemeldet, nicht automatisch wiederholt oder als Erfolg ausgegeben.

Ein interner Entwurf ist noch kein gestarteter Testrelease und noch kein Play-Store-Download. Dafür sind anschließend passende App-Signierung, Testerzuordnung und Bereitstellung des internen Tests erforderlich. Die App-Signieridentität B4 muss für kompatible Updates der vorhandenen APK erhalten bleiben; das Dienstkonto ist nicht der App-Signierschlüssel.

## Feste Freigabe und Nachweise

[PLAY_UPLOAD_APPROVAL.json](PLAY_UPLOAD_APPROVAL.json) bindet Paket, Version16, Quellstand `4d8eaa1cd1dc463e3ce9032779d857a215d020fc`, Laufzeitkennung, B4, Bundlecommit und SHA256 sowie [CI42619085381](https://github.com/frnkrm/anker/actions/runs/42619085381). Dieselben Werte werden im Uploadprogramm fest geprüft. Ein späteres Appupdate erfordert ein neu geprüftes Bundle und eine passende neue Freigabe; der Workflow wählt keine beliebige Datei oder Version.

Lokale Vorbereitung nach Diagnose und rein lesendem Bestandspfad: **38 Upload-/24 Auth-/30 Workflow-Testmethoden**, insgesamt **92**, bestanden. Der erste reale Runnerlauf verwendete den vorherigen Stand mit 78, der zweite mit 86 Methoden. Dazu echte Syntaxprüfung durch Actionlint1.7.9 sowie Download und vollständige Übergabeprüfung mit dem tatsächlichen signierten AAB; keine Google-Anmeldung oder Google-Mutation aus diesen Offlineprüfungen abgeleitet. Die vorhandenen 197 Code16-JUnit und App-CI bleiben ausdrücklich die bisherigen Nachweise der unveränderten App, keine neu ausgeführten Tests für diesen Automationsschritt.

Die API-Verträge wurden aus der offiziellen Android-Publisher-Discovery, Revision20261026, geprüft. Der OAuth-Ablauf entspricht dem offiziellen Google-Servicekonto-JWT-Bearer-Verfahren. Es wird kein `roles/iam.serviceAccountTokenCreator` für den direkten Austausch des eigenen Servicekontoschlüssels benötigt.

## Zugang und Fehler

Das JSON gehört ausschließlich in das gleichnamige Repository-Secret. Kein Schlüssel, JWT oder Token wird in Repositorydateien, Downloadpakete, Statusberichte oder Fehlertexte übernommen. Der Inhalt des GitHub-Secrets kann von dieser Cloud-Sitzung nicht ausgelesen werden. Der GitHub-Runner stellt ihn nur dem Auth-Schritt bereit; dadurch ist die Google-Netzwerksperre dieser Cloud-Sitzung kein Uploadhindernis auf dem Runner.

- Secret fehlt: Namen und Verfügbarkeit als Repository-Secret prüfen.
- Authentifizierung abgewiesen: bereinigten Auth-Code lesen; JSON-Servicekonto, aktiven Schlüssel und Google-Konfiguration prüfen.
- Google403: App-Testrechte des Dienstkontos und aktivierte Android Publisher API prüfen.
- Google404: App-/Paketzuordnung und Zugriff prüfen. Ob zuerst ein manueller Console-Upload notwendig ist, muss am konkreten Fehler und in der Console geklärt werden.
- Version-/Releasekonflikt: bestehenden Console-Stand erhalten und klären. Keine automatische Versionsänderung oder Überschreibung.
- Unklarer Commit: Console prüfen, bevor erneut gestartet wird; der Lauf wiederholt keine Mutation automatisch.
