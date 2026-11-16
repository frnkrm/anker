# PR11: stabiler Zeitanker für den synthetischen Cleanup-Test

Der vom Nutzer gelieferte Screenshot des bestehenden Laufs43877868624, Job133335555439, belegt PostgreSQL23514 / `pc_link_mailbox_check` beim Insert für synthetischen BesitzerB, Paar synthetic-pair, Richtungphone, seq99. Das entspricht genau dem abschließenden Cleanup-Test in `scripts/test-pc-relay-sql.mjs`. Die frühere Aussage „Detailursache unbekannt“ ist damit überholt; alte Sicherungen bleiben unverändert.

Der produktive Tabellencheck verlangt `expires_at > created_at` und höchstens14Tage Abstand. Der Test verwendete zweimal `clock_timestamp()`: ersterWert−15Tage, zweiterWert−1Tag. Jeder Zeitfortschritt zwischen beiden Aufrufen macht den Abstand größer als14Tage. Der Screenshot enthält nicht beide tatsächlichen Zeitwerte; der Mechanismus ist am unveränderten SQL und deterministischen Gegenlauf belegt. Kein Anlass für Änderungen an Migration, RLS oder produktiver Aufbewahrungsfrist.

## Gezielter Rot-/Grünbeleg

Vor Fix wurde ausschließlich im Cleanup-Test `Date.now` vorübergehend durch eine pro Aufruf fortschreitende synthetische Uhr ersetzt und in finally wiederhergestellt. Die gepinnte PGlite0.5.16-WASM-Anbindung verwendet Date.now für die PostgreSQL-Echtzeituhr. Damit scheiterte der bestehende Insert reproduzierbar mit23514 / pc_link_mailbox_check nach15erfolgreichen Checks. Kein Schlafen, Wiederholen bisGrün oder Lockern eines Checks.

Der Fix ersetzt ausschließlich die beiden Zeitfunktionen in diesem Test-Insert durch `statement_timestamp()`. Beide Werte haben denselben Statementanker; RETURNING prüft exakt14Tage Abstand auch bei fortschreitender synthetischer Uhr. Anschließend werden unverändert RLS-Sichtbarkeit, Cleanup-Anzahl und tatsächliche Löschung geprüft. Eine zusätzliche Grenzprüfung weist direkte Inserts mit0Tagen sowie14Tagen+1ms jeweils mit dem erwarteten Tabellenconstraint zurück und bestätigt, dass keine Zeile angelegt wurde.

Gezielter Aufruf mit bereits vorhandenem temporärem Modul:

```
node scripts/test-pc-relay-sql.mjs --module /tmp/anker-relay-sql-t006-pr11/node_modules/@electric-sql/pglite/dist/index.js
```

Ergebnis:17/17grün, echte lokale PostgreSQL-Migration/RLS/RPC-Prüfungen, nur synthetische Daten. Migration-SHA256 `82175a20e1cf7584444f76537704c4da0ff56814362fc7076dc90db01d48ee45` unverändert. Kein Supabase-/pg_cron-/PC-/Gerätebeleg. Neue automatische CI ist separat erforderlich, lokales Grün schreibt den alten PR-Lauf nicht um.

## Quellen, Übertragung und Releasegrenzen

Isolierter neuer Arbeitsbaum vom gepushten PR-head99a84384506f313a95f96501af9a26ac76329c1a; bisherige lokale Dokumentationsnachfolger15c4/291ad werden nicht übertragen. Vorherige Arbeitsbäume/Sicherungen unverändert erhalten. Änderung nur SQL-Testskript plus diese Statusdokumentation. App-/native-/Paket-/Versions-/Workflow-/Freigabe-/Signierquellen bytegleich99a84384. Regulärer Fast-forward auf denselben Entwicklungsbranch aktualisiert PR11; keine direkte main-Änderung, kein Admin/Force/Queue/Automerge oder Workflow-Retry.

Appquelle bleibt0c31179be780e0bb6359dee79c3502d4e6e8ba4d mit Weckzeitfix und eigener exakter main-CI43873584133. Policyintegration wird erst nach erfolgreicher neuer PR-CI regulär fortgesetzt; W-final und dessen eigene exakte ci.yml/push/main/completed-success bleiben erforderlich. Keine Docs-Ausnahme. Historische M/P5/U1 und deren Proofs werden nicht als neues Fixbundle verwendet. Neuer finaler Prepare/Signier-/Uploadweg noch offen; kein AAB/S/HS/Play-/Handybeleg. B4Upload/8APlay getrennt, keine Schlüssel-/Secretänderung, kein Ersatzkey oder stillerCode19. T-006/V-014 IN_ARBEIT, E-002–E-005 und Geräte-/Gesamtfreigaben offen.

Logs, vollständiger Testdiff, Quellhashes, Git-Bundle und unabhängiger Restore werden unter `/workspace/anker-code18-relay-fixture-20261116/` gesichert. Alte Dokumentation zum fehlenden Fehlertext ist historisch; dieser Screenshot erledigt die damalige Informationslücke. Bestehende autonome Nutzerfreigabe gilt ohne erneute Promptkette.
