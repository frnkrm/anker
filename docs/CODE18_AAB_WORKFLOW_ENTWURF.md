# T-006 – lokaler Entwurf des manuellen Code18-AAB-Prüfworkflows

## Fortschreibung: L übertragen, separate Branch-CI nachkontrolliert (14.11.2026)

[Push-/CI-Nachkontrolle](AAB_ENTWURF_BRANCH_PUSH_T006.md): Entwurfshead L `3f5345dd08032aa6d19328a2c2cee22527150266` genau einmal gepusht; main M unverändert. CI43614039702 / push / Entwicklung / exakt L / Versuch1 **erfolgreich**. Kein AAB-Workflowstart oder echte Signierung. Die folgenden Angaben „nur lokal/nicht übertragen“ beschreiben den vorherigen Entwurfsauftrag. D ist neuer lokaler Dokumentationsabschluss, nicht nachgepusht; W/U2/S bleiben unbelegt. Gesamt-/Gerätefreigaben offen.

Stand **14.11.2026, Europe/Berlin**. [Signierwegplan Stufe A](CODE18_AAB_SIGNIERWEG_PLAN.md) lokal umgesetzt und gezielt offline geprüft. **Keine Workflowausführung, Appbuilds, echte Signierung oder Übertragung.**

## Identitäten und Umfang

Arbeitsort `/workspace/anker-main-code18-aab`, Branch `entwicklung/anker-neu`, sauberer Ausgangshead **`3fbc6541da51dc9662f60e02b6c535e4bc16ccff`**. Der neue lokale Entwurfs-/Dokumentationscommit **L** steht im Sicherungsmanifest RESULT.json. Er ist **nicht** die spätere tatsächliche main-Workflowquelle **W**.

Appquelle bleibt **M `10cc894a27302a5a49b6884c843d2a6b509ab354`**, Fingerabdruck `e9c1249900f449001be6dfb80674a5fe9b2b27af8d2cabf195dba9b2ab654b99`, Code18/1.5.0-rc.4 und unveränderte Paket-/SDK-/Berechtigungs-/Signierlogik. Gespeicherter erfolgreicher Quellbeleg `ci.yml43601398931`,push/main/M,379Browser/1372Vitest bleibt historischer vorhandener Nachweis; **keine heutige externe Bestätigung**. Späteres W braucht eigene main-Push-CI; keine Docs-Ausnahme.

U1 bleibt unverändertes lokales unsigned Referenz-AAB unter `/workspace/anker-main-code18-aab-pruefung-20261114/Anker-Code18-main-10cc894-UNSIGNIERT.aab`,54.264.632Bytes,SHA256 **`74e65b1a1999f7a1b9b19244d9aa5fcf058d025904009d8ca0c08448de050d50`**. Es wurde nicht als Runner-U2 oder signiertes S umetikettiert. U2,H2,HP,Prepare-P/Artefakt-ID A,S/HS und W **existieren noch nicht als reale Laufnachweise**.

## Tatsächlich geänderte Automationsdateien

| Datei | Aufgabe |
|---|---|
| [android-aab-pruefstand.yml](../.github/workflows/android-aab-pruefstand.yml) | Neuer ausschließlich manueller main-Prüfworkflow; getrennte Modi prepare/sign; resolve,prepare,sign,verify mit begrenzten Leserechten |
| [android-aab-proof.py](../scripts/android-aab-proof.py) | Strikte Quellen-/Workflow-/main-CI-/Run-/Versuchs-/Artefakt-/Archiv-/AAB-/Metadatenbindung, sichere Dateneingabe, Paket-/Asset-/JAR-/ELF-Prüfung und isolierter späterer Signierpfad |
| [AnkerAabVerifier.java](../scripts/AnkerAabVerifier.java) | Liest alle JAR-Payload-Einträge; fordert im Signaturmodus genau einen B4-Leafsignierer je Eintrag; prüft Zertifikatsgültigkeit/Schlüsselstärke, SHA256-Digests und Signaturcontainer. Lädt niemals Appklassen |
| [android-aab-unsigned.gradle](../scripts/android-aab-unsigned.gradle) | Vor Projektkonfiguration Signierdatei/-umgebung ablehnen; tatsächlich angeforderten Paketgraph,Release-Nullbindung,Version und Worker beobachten; verändert keine Signierkonfiguration |
| [android-aab-tools.json](../scripts/android-aab-tools.json) |17 bereits vorhandene öffentliche JAR-Versionen aus dem geprüften M/AGP8.13.0-Classpath mit SHA256 und offiziellen Google-Maven/Maven-Central-URLs gebunden. Werkzeug-Lock, **keine neue Appabhängigkeit/Uploadfreigabe** |
| [test-android-aab-proof.py](../scripts/test-android-aab-proof.py) |29 gezielte Offline-Protokoll-/JAR-Grenzfälle |
| [test-android-aab-workflow.py](../scripts/test-android-aab-workflow.py) |14 YAML-/Shell-/Workflowstruktur-/Trigger-/Secretgrenzenfälle |
| [ci.yml](../.github/workflows/ci.yml) | Nur JDK21 für den Prüfhelfer und genau zwei neue Offline-Testaufrufe ergänzt; übrige Prüfungen erhalten |

Die vier bestehenden APK-/Release-/Play-/Diagnoseworkflows,alte Signier-/Publisher-/Authskripte und sämtliche Code17-Freigabemanifeste bleiben bytegleich. Keine Produktdatei,Version,Paketdefinition,SDK- oder Android-Berechtigung geändert. Keine zusätzlichen schreibenden GitHub-/Google-Rechte: neuer Workflow hat root `permissions:{}`,nur jobweise contents/actions read nach dem vorhandenen Muster.

## Implementierte Übergabe und Schutzgrenzen

**resolve:** ausschließlich Repositoryfrnkrm/anker,workflow_dispatch/main,festes M und explizites W,Abgleich mit tatsächlichen GITHUB_WORKFLOW_SHA/GITHUB_SHA. Frische main-Vorfahren- und completed/success/push/main/ci.yml-Gates für M und W werden erst im später autorisierten Runnerlauf per GET geprüft. M-Run43601398931 bleibt ausdrücklich separat; keine PR-/Branch-/Docs-Ausnahme. APIfehler brechen mit begrenzten Fehlercodes ab,keine Authreparatur.

**prepare:** ausschließlich eigener manueller Modus,keine Signiersecretreferenz. Separater Appcheckout exakt M und sparsam ausgecheckte W-Prüfhelfer. Frischer Web-/Capacitorstand mit belegter Fingerprint-Stabilisierung,signaturfreier Guard/Dryrun/Pakettask. Vollständiger Manifestvergleich gegen den lokal geprüften M-Referenzmanifest-Hash zusätzlich zu Paket/SDK/Rechten schützt auch Komponentenänderungen bei gleicher Berechtigungszahl. Proof bindet alle unkomprimierten Eintragshashes,aktuelle Assetbytes,M/F/W/CI,Run/Versuch und Werkzeuge. Nur `unsigned.aab` und `proof.json` als Datenartefakt. U2 bekommt eigene H2/HP/Artefakt-ID; H1 von U1 ersetzt keinen dieser Werte.

**sign:** kann nicht von prepare abhängen oder nach prepare automatisch laufen. Pflichtinputs binden P,Versuch,A,H2 und HP; nur erster Versuch eines neuen Sign-Dispatchs zulässig,kein erneutes Signieren über Re-run. Prepare-Lauf muss tatsächlich erfolgreich sein,Repo/Branch/W/Versuch und Artefakt-ID mit Servermetadaten übereinstimmen; alte Versuche abweisen. Actions-Archivdigest getrennt von innerem AAB-Hash prüfen. Begrenzte ZIP-/JSON-Eingabe,reguläre Datei-Whitelist,keine Symlinks/Pfadtraversierung/Duplicate-Keys/unkontrollierte Expansion; signed storage redirect erhält **keinen GitHub Authorizationheader**.

Im Signierjob nur sparsam ausgecheckter W-Werkzeugcode und bekannte SHA-gebundene Vendorwerkzeuge;kein Appcheckout/npm/Gradle und kein ausführbarer Code aus Buildartefakten. Alle Daten-/Paketprüfungen vor dem einzigen Schritt mit den vier bestehenden ANKER_ANDROID-Namen. Keine Namens-/Scope-Abfrage;fehlende/unvollständige Werte bedeuten Abbruch,**kein unsigned Erfolgsfallback**. Private File0600/Temp0700,Alias begrenzt,öffentliches Aliaszertifikat vor jarsigner exakt B4,starke RSA/EC-Signatur mitSHA256. Passwörter nur per Prozessumgebung,keine privaten Prozessausgaben im Log;finally entfernt Tempdateien und leert den Bytepuffer. Signierung schreibt separate S-Datei und nur als **pending/unverifiziert** etikettierte Zwischenmetadaten.

**verify:** eigener Job ohne Signiersecrets,erhält exakt die Prepare- und pending-Artefakte des gebundenen Versuchs. Für jeden Payload-Eintrag kryptografische JAR-Prüfung und genau B4,Uncompressed-Bytes U2↔S gleich;nur eng benannte zusätzliche Signaturmetadaten erlaubt. Vollständige Bundletool-/Manifest-/SDK-/Identitäts-/ELF-Kontrolle auch auf S. Temporärer Truststore enthält ausschließlich das bereits gepinnte öffentliche B4-Zertifikat für striktes jarsigner-Verify,keine globale Truststoreänderung. Erst dann finales signiertes Prüfarbeitsartefakt samt öffentlichem Provenienznachweis;IDs/Archivdigests,H2/HP/HS/Bytes getrennt. Kein Playzugriff,GitHub-Release,Tag,Installation oder Geräteabnahme.

Der zukünftige private Schlüsselgebrauch bleibt vollständig unbestätigt und **nicht ausgeführt**. B4 ist Uploadrolle,8A die gemeldete Play-Approlle; daraus keine direkte Updatekompatibilität oder Schlüsselverfügbarkeit ableiten.

## Tatsächliche lokale Prüfungen und Grenzen

| Prüfung | Ergebnis / Aussagegrenze |
|---|---|
| Protokoll-/JAR-Grenzfälle | **29/29 grün**,0Skip;M/W-/CI-Verwechslung,alte Versuche,API-/Archiv-/AAB-/Metadatenidentität,ZIP-/JSON-/Dateitypen,fehlerhafte Manifeste/gleichzählige Berechtigungsswaps,Secretisolation/fehlende Werte,Passwort-/Fehlerausgaben,Tempcleanup,manipulierte Nutzlast,falsche/zusätzliche/fehlende Signierer und finale Erfolgsbarriere |
| Workflowstruktur | **14/14 grün**,0Skip;YAML mit bestehendem gesperrtem js-yaml geparst,alle Shellblöcke bash -n,Python AST,manuelle Trigger,HASH-Pins,Checks vor Secrets,keine automatische Signierkante,Source-M/Policy-W-Checkouts,keine Upload-/Play-/Releasepfade und gezielte CI-Einbindung |
| Echter Java-Grenzfall | Nur W-Verifikationshelfer mit bestehendem JDK21 kompiliert;synthetisches unsignedZIP tatsächlich gelesen und im signed-Modus abgewiesen. **Kein Appcode kompiliert,kein Schlüssel erzeugt oder verwendet** |
| Positive Signierfälle | Ausschließlich Prozess-/APIattrappen und ausdrücklich synthetische Nichtschlüsselbytes. **Kein realer kryptografischer B4-Signiernachweis**;keine Dummyidentität als B4 ausgegeben |
| Werkzeug-Lock |17bestehendeJARs lokal kopiert und SHAgeprüft;Bundletool1.18.1-Version/validate-/dump-Kommandohilfe offline erfolgreich. Keine Downloads/Installationen/Versionsupdates |
| Gezielte lesende U1-Kompatibilität | Neuer17JAR-Lock und neue Hilfen lesen unveränderte U1-Referenz:672Payload-Dateien,0Signer,vollständiges Manifest und8ELF64 bestätigt. Neue Helfer-/Classpathintegration begründet diese einmalige lesende Prüfung;keine alte Produktvollsuite wiederholt,kein neuer U2-Build |
| Fehlendes Prüfmittel | `actionlint` über vorhandenen PATH/gezielte bekannte Cachepfade nicht verfügbar. Keine Installation. Daher **kein Actionlint-Erfolg/GitHub-Server-Ausführungsbeleg** behauptet;YAML-/Shell-/Strukturprüfungen ersetzen diesen Nachweis nicht vollständig |
| Nicht ausgeführt | Neuer Gradle-Guard nicht an echtem Appbuild gestartet,kein App-/SDK-Build,kein Workflow/API-/Secret-/Cloud-/Play-/Geräteeingriff. Echte Runner-/Signing-/GitHubmetadaten bleiben für später autorisierte Stufen offen |

Die erste Offlineprüfung fand einen CLI-Reihenfolgefehler: außerhalb Actions wurde zuerst nach API-Tokenverfügbarkeit statt zuerst nach dem main/dispatch-Kontext gesehen. Korrigiert,ursprüngliches Fehlerprotokoll erhalten;abschließend alle43Fälle grün. Weitere gezielte Ergänzungen nach Codeänderungen erneut geprüft. Keine Retries/Skips/Timeoutlockerungen oder unveränderten Logik-/Browser-/PC-/JUnit-Vollsuiten. M-CI379/1372 und274historischeJUnit bleiben frühere getrennte Softwarebelege,keine neue Hardwarebeobachtung.

## Lokaler Abschluss und nächste Grenze

Nur diese Entwurfsdateien/gezielte CI-Erweiterung und neue Dokumentation lokal committen/sichern. U1,Originalplan/36IDs/103historischeGerätezeilen,Produktquellen/Versionen/Code17-Dateien/alteArbeitsbäume/Sicherungen bleiben unverändert. Neuer lokaler L enthält noch keinen realen Workflow-W-/Runner-U2-/signedS-Nachweis. **T-006/V-014 IN_ARBEIT,E-002–E-005 und Integrations-/Workflowstart-/Signier-/Upload-/Geräte-/Gesamtfreigaben offen.**

Sicherung `/workspace/anker-t006-code18-aab-entwurf-20261114/`: Ausgangs-/Nachher-Gitbundles,alleTestlogs/strukturierte Ergebnisse,vorhandene öffentliche Vendor-JAR-Testkopien/Hashes,U1-Referenzkompatibilität,Dokument-/Quell-/Artefakt-/Altbestandsschutz,unabhängige Bundlewiederherstellung,RESTORE.md/SHA256SUMS. Keine private Datei,echte Signierwerte oder neue AAB-Kopie. Nur Cloud-lokal;keine neue externe Kopie bestätigt.

**Genau nächster separat zu beauftragender Einzelauftrag:** begrenzter einmaliger Entwicklungsbranch-Push exakt L nach frischer Ref-/Quell-/Hook-/Triggerprüfung und lesende Nachkontrolle der dadurch ausgelösten CI. Historisch zuletzt DevC2c3a290/mainM10cc894,heute nicht extern abgefragt. Neue manuelle AAB-Definition darf dabei nicht gestartet werden;main bleibt unverändert. Bestehende Push-/gegebenenfalls Previewautomatik erst in diese neue Freigabe einschließen. Bei abweichenden Refs/Risiken stoppen,bei roter CI nur dokumentieren. Reguläre spätere PR-/main-Integration,W/main-CI und prepare/sign/Upload bleiben weitere eigene Freigaben. Jetzt nicht übertragen;danach stoppen.
