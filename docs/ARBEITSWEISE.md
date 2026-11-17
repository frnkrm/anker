# Verbindliche Arbeitsweise für alle Pläne

Nutzerentscheidung vom 17.11.2026: effizient, ohne Verschwendung des
Nutzungskontingents, und autonom im jeweils beauftragten Umfang arbeiten.
Gilt für bestehende und künftige Entwicklungs-, Bugfix-, Implementierungs-,
Integrations- und Releasepläne sowie deren spätere Ausführung.

- Zuerst vorhandenen Stand und passende Nachweise nutzen; gezielt lesen und
  recherchieren, keine wiederholten Vollinventuren oder unnötigen Installationen.
- Zusammenhängende kleine Arbeiten bündeln. Keine parallelen Agenten oder
  umfangreichen Refactorings für klar begrenzte Aufgaben.
- Einen beauftragten Arbeitsschritt selbstständig bis zu seinem prüfbaren Ergebnis
  ausführen; Routineentscheidungen und reversible Korrekturen ohne neue Freigaberunde.
  Nur notwendige fehlende Angaben, echte Blocker oder erforderliche Freigaben erfragen.
- Kleinste passende Änderung, gezielte aussagekräftige Tests. Erfolgreiche Prüfungen
  nur bei neuen Änderungen oder begründetem Risiko wiederholen. Gesamtsuiten am
  Integrationsstand bündeln; notwendige CI-, Signatur- und Releasegates erhalten.
- Für reine Dokumentation keine App bauen und keine Produktsuite starten.
  Fortschritt knapp an Erkenntnissen, Ergebnissen und Blockern erklären.
- 6.1 sol / mittel bleibt die derzeitige Empfehlung. Niedrig für einfache Textarbeit;
  mehr Aufwand oder anderes Modell nur bei konkretem Bedarf empfehlen. Keine
  automatische Änderung der Modellauswahl behaupten.
- Planung, Implementierung, automatische Tests und echte Geräteprüfung getrennt
  dokumentieren. Bestehende Daten und IDs schützen; keine unbelegten Erfolge.
- Autonomie erweitert nicht automatisch den Auftrag auf neue Funktionen, Käufe,
  Datenweitergabe, Veröffentlichung oder Gerätewirkungen. Bereits ausdrücklich
  erteilte Freigaben aus dem Chat nutzen; nicht erneut um dieselbe Erlaubnis bitten.
- Historische Stopps und frühere Zugriffsprobleme sind keine neue Promptpflicht.
  Vor Ausführung aktuelle Nutzerfreigabe und tatsächlichen Zustand abgleichen;
  technische Schutzregeln nicht umgehen und geschlossene Aufträge nicht neu starten.

Diese Ergänzung vereinheitlicht die Arbeitsweise. Sie startet weder alle offenen
Aufgaben noch ändert sie die separat eingerichtete Play-Releaseautomation.

## Verbindliche Reihenfolge: UI gesammelt zum Schluss

Weitere Nutzerentscheidung vom 17.11.2026: Erst Anforderungen, Daten-/Ereignismodell,
reine Logik, native Fähigkeiten und Schnittstellen der beauftragten Funktionen
stabilisieren und prüfen. Danach sämtliche neuen Bedienelemente und visuellen
Überarbeitungen gemeinsam in einer abschließenden UI-Phase umsetzen und abnehmen.
Nicht nach jeder einzelnen Funktion dieselben Screens erneut gestalten.

Die Reihenfolge gilt für alle verlinkten Pläne, auch wenn ihre Kapitel anders
angeordnet sind. Vorgesehene Oberfläche früh beschreiben und Schnittstellen dafür
vorbereiten; bis zur UI-Phase vorhandene Oberflächen erhalten. Für interne Tests
vorhandene Testwege nutzen, keine wegzuwerfenden Zwischenoberflächen bauen.
Schwerwiegende Sicherheits-/Bedienblocker bei Bedarf gezielt beheben, ohne daraus
eine vorgezogene allgemeine Neugestaltung zu machen. Die finale UI-Phase gehört
vor End-to-End-/Geräteabnahme und Auslieferung einer neuen Funktion, nicht danach.
