# Anker – Arbeitsanweisungen

- Zuerst `CLAUDE.md`, `docs/ANKER_IMPLEMENTIERUNGSPLAN.md` und `docs/ANKER_TESTNACHWEISE.md` lesen.
- Aufträge: `docs/auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v6.md` und `docs/auftraege/ANKER_ENTWICKLUNGSAUFTRAG_v7_PC.md`.
- Direkte aktuelle Nutzeranweisungen haben Vorrang vor widersprechenden Anhangdetails; Entscheidungen im Implementierungsplan festhalten.
- Bestehende Planer, Store-Schreibqueue, Daten und IDs wiederverwenden. Kein zweiter Tagesplaner.
- Nur ein schreibender Agent pro Arbeitsbaum; parallele Implementierung in getrennten Worktrees.
- Keine destruktiven Git-Befehle, keine ungefragten externen Nachrichten oder kostenpflichtigen Aktivierungen.
- Privatschlüssel, Kopplungsgeheimnisse und Zertifikats-Pins gehören nicht in Sync, Sicherung, Logs oder öffentliche Downloads.
- Native Brücke immer auf TypeScript- und Kotlin-Seite passend halten.
- Implementierung, automatische Prüfungen und echte Android-/Windows-Beobachtungen getrennt dokumentieren.
- Keine Erledigung aus Uhrzeit, Timerende, PC-Sperre oder bloßer Nachrichtenzustellung ableiten.
- Neue strenge Führungs-, Audio- und PC-Wirkungen beginnen ausgeschaltet und benötigen eine ausdrückliche Wahl.
- Code14s abgesicherten Sheet-Verlauf, Weckeridentitäten, Datenbank-Atomarität und Notausgang erhalten.
- Version, Signatur, Veröffentlichung und Deployments nur im ausdrücklich autorisierten Umfang ändern.
- Stehender Nutzerauftrag vom 10.11.2026: Nach jedem fertig geprüften Release auch den bestehenden Google-Play-Uploadweg ausführen. Der autorisierte automatische Umfang bleibt ein interner Entwurf mit Readback; öffentliche/Produktionsfreigabe gesondert entscheiden. Aktive Releases erhalten, keine Review-Abbrüche, Testeränderungen oder Zugangsdaten in Logs.
