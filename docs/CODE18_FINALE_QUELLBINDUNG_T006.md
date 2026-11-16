# T-006 – integrierte Fixquelle und finale AAB-Quellbindung

Stand16.11.2026. Autonome Arbeitsfreigabe des Nutzers gilt weiter, keine neue Einzelpromptfreigabe benötigt. PR10 wurde tatsächlich regulär als Mergecommit integriert. Keine weiteren Produktänderungen durch diesen Quellbindungsstand.

## Bestätigte main-Integration

PR10Merged, tatsächliches main **`0c31179be780e0bb6359dee79c3502d4e6e8ba4d`**. Reguläre Eltern **R2 `860b0ca639b2271b357fd404df626c22ef30b29f`** und **Fixcommit `4ca5d08e60a8f9bac6f397c8ddadf7152124a03e`**. Der lokale Clone dieses neuen main bestätigt die Eltern und exakt denselben vollständigen Git-Baum `42cdfab645d7a165b20bda1b5f66a5586d21f21c` wie der geprüfte Fixcommit. Öffentlicher PR-Mergecommitlink stimmt überein, Entwicklung bleibt4ca5d08e. Kein synthetischer PR-Mergeref als main verwendet.

Eigene neue **[ci.yml43873584133](https://github.com/frnkrm/anker/actions/runs/43873584133)** für exakt **0c31179be780e0bb6359dee79c3502d4e6e8ba4d / push / main / Versuch1 / Success / 11m 6s**. Öffentliche vollständige Commit-/Ereignis-/Branch-/Statusbelege und Summary: **381 passed (9.5m); 1377 passed; 0 failed; 0 skipped**. Kein Ersatz durch vorherige Branch-/PR-CI, keine Docs-Ausnahme. API-run.head_sha und tatsächlicher Runnercheckout nicht separat gelesen; öffentliche Belege als solche dokumentiert.

Isolierter neuer Arbeitsort `/workspace/anker-code18-policy-final-20261116`, lokale Branch `fix/code18-finale-quellbindung-20261116`, Ausgang exakt dieser Mergecommit. Alte Arbeitsbäume und lokale Dokumentationsnachfolger unverändert; keine lokalen App-/Web-/Android-/APK-/AAB-Builds oder Produktvollsuiten wiederholt. Vorhandene bytegleiche Abhängigkeiten für die notwendigen Offlineprüfungen wiederverwendet.

## Kleinste notwendige neue feste Bindungen

Der bisherige AAB-Weg war weiterhin auf App-M10cc894 ohne Weckzeit-Fix festgelegt. Deshalb sind **zusammenhängend und fest**, ohne frei wählbare neue Quellen, geändert:

| Bindung | Neuer überprüfter Wert |
| --- | --- |
| Appquelle SOURCE, Workflow-Default und App-Checkout | `0c31179be780e0bb6359dee79c3502d4e6e8ba4d` |
| App-Quellfingerabdruck FINGERPRINT | `4f8a7b5add918138f3dadcfe84fc8f16c818ad8610481dd6b1b56f035923efc1` |
| Fester unabhängiger Quell-CI-Lauf im Resolve | `43873584133` |
| Künftige Workflowquelle W-final | Erst aus tatsächlicher regulärer Integration dieser Policy bestimmen; eigener exakter erfolgreicher push/main/ci.yml-Beleg zwingend |

Der Fingerabdruck wurde mit exakt der bestehenden Vite-Funktion aus dem neuen Quellbaum berechnet und ist im schon lokal geprüften Fix-Webbuild enthalten; kein eigener alternativer Fingerprintalgorithmus oder neuer Appbuild. Neuer main-Baum und getesteter4ca-Baum vollständig identisch.

**REFERENCE bleibt unverändert der historische unsigned U1-Beleg aus altem M10cc894.** Sein Hash/Bytezahl werden nicht als neues Fix-AAB umetikettiert. Die neue Quelle benötigt einen frischen Prepare mit eigenem Workflow-/Run-/Versuchs-/Artefakt-/AAB-/Proofhash. Alte P3/P4/P5-Proofs und U1/latest dürfen diesen Eingang nicht ersetzen, auch bei zufällig gleichen Bytes. H2 ist nicht HS.

Der vollständige Manifestpin bleibt unverändert: Android-/Gradle-/Paket-/SDK-/Permissions-/Versionsinputs sind zwischen altem M und neuer Fixquelle bytegleich. Paket/Code18/1.5.0-rc.4 bleiben erhalten; keine neue Manifestfreigabe oder Garantie der Play-Codeverfügbarkeit. Der bestehende vollständige Bundletool-/Manifest-/Asset-/ZIP-/JAR-/Signierer-/Nutzlastnachweis bleibt notwendig.

## Strikte Gates unverändert, gezielte lokale Regressionen

AST-Abgleich belegt: Helperlogik ist bis auf exakt Source-SHA, Fingerprint und festen Source-CI-Pfad unverändert. Strukturvergleich der YAML belegt: ausschließlich Default und fester App-Checkout anders. Resolve/main/GITHUB_SHA-/WORKFLOW_SHA-Vertrag, unabhängige Quell-/Workflow-main-CI, getrennte prepare/sign-Aufrufe, fünf ausdrückliche Signierbindungen, Versuch-/Artefakt-/Hash-/Proofgates, Null-Signierbindung, SDK-Schritt, Sign-/Verify-Isolation, B4-Zertifikatspin, Tools und Trigger unverändert. Keine globale Guardlockerung, kein unsigned Erfolgsfallback, keine neue Action oder Rechte.

Gezielte Rotbelege vor Bindungsänderung: alter Prepare-Input wurde noch akzeptiert, Helper/Workflow waren noch auf altes M festgelegt. Danach **38Protokoll-/Java-Verifikationsfälle und15Workflowfälle erfolgreich**. Neue Fälle weisen altes M vor jeder APIabfrage und alte M-CI als Quellbeleg des Fixes zurück; Workflow und Helper müssen dieselbe feste neue Fixquelle/Fingerprint verwenden. Synthetische Prozess-/APIwerte sind weder echter Runner-/Prepare- noch privater Signiernachweis.

17unveränderte SDK-Offlinefälle lokal nicht mechanisch wiederholt; ihr gesamter Workflowblock ist strukturidentisch. Die vorhandene automatische CI führt ihren bestehenden Umfang unverändert aus. Keine lokalen Produktvollsuiten/Webbuilds/SDK-/AAB-/Signierprozesse ausgelöst. Alte APK-/Release-/Playworkflows und Code17-Manifeste unverändert.

## Stand der weiteren Ausführung

Dieser neue Policy-/Übergabecommit ist noch **keine main-Workflowquelle W-final**. Erst regulär übertragen, neue tatsächlich ausgelöste Branch-/PR-CI und Serverregeln prüfen, regulär integrieren und eigene exakte main-Push-CI von tatsächlichem W-final abwarten. Keine Docs-Ausnahme, keine bloße Input-SHA-Ersetzung. Erst danach neuer secretfreier Prepare aus fixem Appcommit0c31179 mit W-final; noch kein Workflowstart aus einem ungeprüften Entwicklungshead.

Git-HTTPS funktioniert; der Agenten-APIweg ist weiter CONNECT403 und der vorbereitete Netzwerkentwurf noch nicht aktiv. Kein erreichbarer authentifizierter regulärer Agenten-PR-/Merge-/Dispatchweg angeboten. Besitzer kann den normalen UI-Weg unter bestehenden Serverregeln ausführen; keine Admin-/Force-/Queue-/Automerge-/Branchlöschumgehung. Die Arbeitsfreigabe umfasst unveränderte main-CI und gegebenenfalls bestehende automatische Webwirkung; keine aktive Cloudänderung.

B4-Material ist hier weiterhin nicht zugänglich belegt; kein endgültiger Verlust behauptet und keine neue Schlüsselsuche oder Signierprobe in diesem Schritt. Google-/Playzugang nicht nutzbar nachgewiesen. Kein Schlüsselersatz/Reset/Secretwechsel improvisiert. Ohne passende B4-Voraussetzungen keine Signierung; ohne tatsächlichen Playbestand/zulässigenCode18 und neuen gültigen Signier-/Verifikationsbeleg kein Upload. B4Upload/8APlay-App-Signierer getrennt.

Vollständiger ursprünglicher Weckzeit-Prompt unverändert letzter Planpunkt im bestehenden CODE18_AAB_SIGNIERWEG_PLAN.md. Der Fix liegt jetzt tatsächlich im integrierten Quellcommit und dessen eigener main-CI; ein finales Bundle daraus ist noch nicht erzeugt. Code18-Playbestand unbekannt, Konflikt bei verbrauchtemCode18 melden, kein stillerCode19. T-006/V-014 insgesamt IN_ARBEIT/E-002–E-005/Geräte-/Gesamtfreigaben offen.

## Lokale Sicherung

Quellbindung, Rot-/Grünlogs, AST-/YAML-/Nativeinput-Abgleich, öffentliche Merge-/main-CI-/spätere Branch-CI-Nachweise und Git-Bundles unter `/workspace/anker-code18-main-fix-20261116/` sichern. Appquelle0c31179, früherer Fix-/PR-head4ca5d08e, neuer Policy-/CI-head, späterer lokaler Dokumentationsnachfolger und erst künftiges W-final/AAB/Proof/S strikt trennen. Keine Credentials oder Schlüssel in Repository/Artefakte/Chat. Keine neue Promptkette erforderlich; reguläre Fortsetzung innerhalb bestehender Freigabe, soweit tatsächliche Zugänge verfügbar sind.
