# T-006 – Versions-/Quellvorschlag für den nächsten internen Play-Prüfstand

## Umsetzungsfortschreibung nach separatem Nutzerauftrag (14.11.2026)

Die später ausdrücklich freigegebene **lokale** Versionierung18/rc.4 ist umgesetzt: Versionsquellcommit `014870f3ee52c0233118d2852ef0719aa9bc602b` auf entwicklung/anker-neu, exakt drei Versionsdateien/fünf Werte und unveränderte Dependencies/Signierlogik/SDK/Rechte. [Frischer unsignierter Code18-AAB-Nachweis](CODE18_AAB_INTEGRATION_T006.md) bindet neue7608…Appkennung, aktuelle Webassets und neues AAB/SHA256d0d5cfedc21e2201329dccf77177040f85884136e0ee44e5ea6ee600acbe282b. Alte Code17-Artefakte/Quellen/Guards/Protokolle/Manifeste erhalten, nicht umetikettiert. Der vorherige Vorschlag gilt damit ausschließlich für die lokale Umsetzung als gesondert beauftragt; er reserviert18weiterhin nicht bei Play und erteilt keine Signier-/Upload-/Remote-/Gerätefreigabe.

Keine Schlüsselsuche, Secretwerte oder externe Abfrage/Signierung/Installation/Push/Merge/Tag/Workflow-/Cloud-/Playaktion. T-006/V-014/E-002–E-005/Gesamtfreigaben offen. Genau nächster eigener Auftrag zur separaten ausdrücklichen Beauftragung: GitHub-Voraussetzungen für den lokalen Code18-Stand ausschließlich lesend anhand Remote-/PR-/CI-/Workflowmetadaten und vorhandener Signing-Secretnamen/Scope prüfen, niemals Werte oder private Dateien. Aktuell nicht ausführen; fehlenden Zugriff als solchen dokumentieren, keine Auth-/Cloud-/Secretänderung. Der folgende ursprüngliche Planungsstand bleibt als historische Entscheidungskette erhalten.

## Ursprünglicher Planungsstand vor der lokalen Umsetzungsfreigabe

Stand 14.11.2026, Europe/Berlin. Saubere verfügbare Ausgangsbasis `b8306d6337ee4c7f4e8efdbdd82808eb8d8829ff`, Branch `entwicklung/anker-neu`. **Ausschließlich Planung: keine Version geändert, kein Code reserviert und keine Signier-/Upload-/Releasefreigabe erteilt.** Alte Umgebung/835235b bleiben zurückgestellt. Ein weiterer ausdrücklicher Auftrag ist vor jeder Umsetzung erforderlich.

## Belegstand

Auf die gezielte Nachfrage nach dem höchsten Code der vollständigen App-Bundle-Liste antwortet der Nutzer **„17“**. Als höchster bereits belegter Versionscode **laut Nutzer** erfasst; keine eigene Console-/GitHub-/Secret-/API-Abfrage. Der zuvor gezeigte Screenshot „Neueste Releases und Bundles“ allein war kein vollständiges Inventar und wird nicht nachträglich als solches ausgegeben.

Der Screenshot zeigt Code17 mit technischem Bundle-Versionsnamen `1.5.0-rc.3`, getrennt vom Release-Namen `Anker 1.5.0-rc.3 · Code17`. Damit ist die frühere Namen-Unterscheidung für den gezeigten Eintrag geklärt, ohne die damalige wörtliche Nutzerangabe umzuschreiben. Code17-Release im internen Test steht auf Entwurf; Code16-Release steht auf „Für interne Tester verfügbar / Vollständiger Roll-out“. Die „Aktiv“-Angaben der Bundlezeilen sind kein Beleg eines aktiven Code17-Testreleases oder eines öffentlichen Produktionsrollouts. Keine installierte Geräteversion daraus abgeleitet. Screenshot-Inhalte nur als erforderliche technische Angaben dokumentiert; keine Konto-/Appverwaltungs-IDs oder Bildkopie in die Planung übernommen.

## Konkreter Vorschlag – noch nicht freigegeben

| Feld | Vorgeschlagener Stand | Begründung und Grenze |
|---|---|---|
| Paketkennung | Unverändert `de.frnkrm.anker.mobile` | Keine neue App oder Datenmigration |
| Versionscode | **18** | Nächster ganzzahliger Kandidat nach gemeldetem Höchstcode17. Keine Reservierung, keine unabhängige Bestandsprüfung und keine Garantie späterer Verfügbarkeit |
| Technischer Versionsname | **`1.5.0-rc.4`** | Vorschlag für den nächsten internen Release-Kandidaten nach belegtem `1.5.0-rc.3`; weder bereits eingestellt noch fachlich freigegeben |
| Produkt-/Quellbasis | **`b8306d6337ee4c7f4e8efdbdd82808eb8d8829ff`** auf `entwicklung/anker-neu` | Enthält den geprüften lokalen F-001–F-010-Stand und dessen Dokumentation. Keine neue Produktfunktion oder Übernahme alter pausierter Arbeit |
| Bisherige Appquellkennung | `552f037d8560dcc3fe59b6ae441a0d77484e0ca40b479379a9cbe9be28b043a0` | Belegt den unveränderten Code17-Ausgangsstand, nicht einen zukünftigen Code18-Build |
| Bisheriges AAB | Quelle `f657d2e2dedab71bf0d70c9d88263bab258e9055`, SHA256 `c928963f83651306b9a65d21a8fbdb0064e1387eb2f36b5c80901db88410fe1c` | [Unsignierter lokaler Code17-Nachweis](AAB_INTEGRATION_T006.md), unverändert aufbewahren; nicht umbenennen/umpacken/neu etikettieren, um Code18 zu behaupten |
| Zukünftiger Versions-/Artefaktcommit | **Noch nicht vorhanden** | Erst ein neuer Versionscommit könnte die spätere Quelle exakt binden; dessen neue Appkennung/Artefakthash wären frisch zu ermitteln |
| Späterer Vertrieb | Interner Play-Prüfstand nach separater Freigabe | Herkunft Google Play, App-Signierer8A und UploadB4 laut Nutzer. Kein lokales B4-Direktupdate einer8A-Installation zusagen |

Die gerade erstellte Dokumentation ergänzt nur die geprüfte Quellbasis; deren Produktinputs und Code17-Identität bleiben unverändert. Finale Planungscommit-ID im lokalen Abschlussmanifest, keine selbstreferenzierende Dateischleife. Bei Umsetzung von einem späteren Dokumentationshead dessen Abstammung/Produktdiff gegen die Basis prüfen und den tatsächlich neu committeten Versionsstand als Artefaktquelle nennen, nicht die alte Code17-SHA als Code18-Quelle ausgeben.

## Kleinster späterer Änderungsumfang

Nach eigener ausdrücklicher Beauftragung der Version18/rc.4 wären ausschließlich folgende vorhandene Versionsfelder konsistent zu ändern:

| Datei | Bisher tatsächlich vorhanden | Nur vorgeschlagene Änderung |
|---|---|---|
| [package.json](../package.json) | `version: 1.5.0-rc.3` | `1.5.0-rc.4` |
| [package-lock.json](../package-lock.json) | Oberes `version` und `packages[""].version` jeweils `1.5.0-rc.3` | Beide Root-Versionsfelder `1.5.0-rc.4`; Abhängigkeiten/Integritätswerte/aufgelöste Paketversionen unverändert |
| [android/app/build.gradle](../android/app/build.gradle) | Fallbackcode17 / Fallbackname `1.5.0-rc.3` | Fallbackcode18 / Fallbackname `1.5.0-rc.4`; Signierlogik, SDKs und alle übrigen Bindungen unverändert |

[app.config.ts](../app.config.ts) enthält App-ID/Name und kein entsprechendes Versionsfeld; dort keine unnötige Änderung. Keine Paketinstallation/-aktualisierung, Wrapper-/Plugin-/Berechtigungsänderung oder zusätzliche Featurearbeit. Aktuell bleiben alle genannten Dateien bytegleich auf17/rc.3.

Diese Dateien sind Inputs der bestehenden Appquellkennung. Eine spätere Versionsänderung erfordert daher einen **frischen Webbuild samt notwendigem Capsync und neuen unsignierten AAB-Nachweis**. Vorher generierten Bestand sichern und Änderungen prüfen. Die alte Code17-Identität oder alte Artefakthashes dürfen nicht als neue Version ausgegeben werden. Neue externe Guard-/Prüfmetadaten auf den ausdrücklich freigegebenen Versionscommit binden; alte Code17-Guarddateien/Protokolle/Sicherungen nicht überschreiben und keine Projekt-Signierkonfiguration ändern.

Der vorhandene signaturfreie `packageReleaseBundle`-Weg mit vorgeschaltetem Präsenz-/Dryrun-/Taskgraph-/AGP-Nachweis kann als Vorlage dienen. Für Version18 erneut eindeutig Signaturfreiheit und konkrete Metadaten prüfen; keinen signierenden Finalisierungstask oder Debug-APK-Nebenweg verwenden. Neue AAB-spezifische Bundletool-/Manifest-/ZIP-/JAR-/Asset-/Quellprüfungen sind nötig. Frühere Nutzlast-Gleichheit mit Code17 nicht blind als Pflicht übernehmen, wenn Versionsinputs legitime neue Kennungen/Ressourcen erzeugen. Geänderte Metadaten bewusst prüfen, nicht als Produktfehler oder unverändertes Artefakt tarnen.

Bestehende erfolgreiche Softwarebelege erhalten. Nur neu erforderliche Versions-/Paket-/Buildregressionen ausführen und begründen; keine komplette Logik-/Browser-/PC-/JUnit-Suite ohne Integrationsgrund wiederholen. Historische JUnit nur bei erneut belegter Gleichheit relevanter nativer/Testinputs erhalten, nicht nach beliebigen Konfigurationsänderungen pauschal als frisch bestanden ausgeben.

## Erforderliche getrennte Freigaben

| Stufe | Noch erforderlicher Umfang | Heute ausdrücklich nicht erlaubt |
|---|---|---|
| Lokale Versionierung und unsignierter Prüfbuild | Neuer ausdrücklicher Auftrag für Code18/rc.4, die oben drei Versionsdateien, lokale Versionsquellbindung, notwendigen Web-/Capacitor-/AAB-Bau und passende Prüfungen | Aktuell keine Projektversion/Freigabedatei ändern oder Build starten |
| Remoteintegration/CI | Nur soweit der später gewählte bestehende Workflow dies verlangt: exakt gebundene Quelle auf zugelassenem Branch und passende echte CI. Push/Merge/Workflowausführung benötigen eigenen autorisierten Umfang | Lokales Grün ist kein main/push-CI; keine Gates umgehen oder alten Code17-Manifeststand auf neue Quelle umschreiben |
| Uploadsignierung | Bestätigte nutzbare passende Uploadsigniermöglichkeit und eigene Signier-/Schlüsselzugriffs- bzw. Workflowfreigabe | B4 ist laut Nutzer Uploadzertifikat; kein privater Schlüsselbesitz durch öffentlichen Fingerabdruck oder vermutete GitHub-Ablage bewiesen. Keine Suche/Secretabfrage/-einrichtung/-übertragung |
| Play-Upload, Aktivierung und Gerätebeobachtung | Separat autorisierter aktueller Bestands-/Versions-/Artefaktabgleich, Upload/Readback bzw. Aktivierung eines internen Testreleases, spätere bewusste Aktualisierung und reale E-002–E-005-Beobachtungen | Kein Upload, Entwurfsaktivieren, Tester-/Review-/Produktionswechsel oder Installieren aus diesem Vorschlag ableiten; aktive Releases/Daten erhalten |

Code18 ist anhand des gemeldeten Standes der konkrete Vorschlag, **nicht als frei reserviert bestätigt**. Vor einem späteren tatsächlichen Upload müsste im dafür ausdrücklich erlaubten Umfang der dann aktuelle Zustand abgeglichen werden. Eine neue Belegung oder fehlende Freigabe führt zu einer neuen Entscheidung statt stiller Nummernänderung. Keine automatische öffentliche Veröffentlichung oder Wiederverwendung von17.

## Abschluss dieses Planungsauftrags

Ausschließlich Planungs-/Status-/Testdokumentation aktualisieren, lokal committen/sichern. Keine Projekt-/Versions-/Workflow-/Signier-/historische Freigabedatei geändert, keine eigene externe Abfrage, Schlüsselsuche, Build/Signieren/Installieren/Cloud-/Playaktion oder Testwiederholung. T-006/V-014 bleiben IN_ARBEIT, E-002–E-005/Gesamt-/Versions-/Signier-/Upload-/Geräte-/Releasefreigaben offen. Bisherige Artefakte/Nachweise behalten ihren ursprünglichen Code17-/Quellbezug. Alte Umgebung/835235b zurückgestellt.

Lokale Sicherung `/workspace/anker-t006-versionsplan-20261114/`: nicht freigegebener Versionsvorschlag/Nutzerbeleg, Versionsdateihashes, Dokumentintegrität, Vorher-/Nachher-Git-Bundle, unabhängige Wiederherstellung/fsck/Dokumenthashes, RESTORE.md und SHA256SUMS. Nur Cloud-lokal, keine externe Kopie bestätigt.

**Genau nächster Einzelauftrag zur separaten ausdrücklichen Beauftragung:** T-006 – Code18/`1.5.0-rc.4` ausschließlich lokal in den drei Versionsdateien umsetzen, Version zuerst in einem lokalen Quellcommit binden und daraus einen frischen UNSIGNIERTEN AAB-Prüfbuild mit notwendigen Webassets/Capacitor-Synchronisation und gezielten Prüfungen erstellen. Kein Signieren/Upload/Installieren/Push/Merge/Tag/Workflow-/Cloud-/Secretzugriff oder historisches Freigabemanifest ändern. Ohne diesen neuen Auftrag keine Umsetzung. Nach jetzigem Planungsabschluss stoppen.
