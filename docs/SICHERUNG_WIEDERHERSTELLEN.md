# Vorhandene Daten bewusst wiederherstellen

Die bisherige App bleibt installiert, bis du deine übernommenen Daten verglichen hast. Bei einer zweiten Installation werden ihre Android-Freigaben, Widgets und Anmeldungen gesondert eingerichtet; eine JSON-Datei überträgt diese Systemzustände nicht.

1. In der bisherigen App **Mehr → Sicherung → Sicherung exportieren** öffnen. Standardmäßig sind Arbeitsdaten, private Protokolle, Orte/Termine und Testberichte enthalten. Die Datei auf dem Handy aufbewahren; für diesen Weg muss sie nicht hochgeladen werden.
2. In der neuen App beim ersten Start **Vorhandene Sicherung übernehmen** wählen. Der Link öffnet die bestehende Sicherungsseite mit der ausdrücklich benannten Wiederherstellungswahl. Die Ersteinrichtung muss dafür nicht erneut abgeschlossen werden.
3. **Sicherung importieren**, eigene Datei auswählen und die Vorschau lesen. **Werte aus dieser Sicherung wiederherstellen** übernimmt die gewählten Werte auch aus einer älteren Sicherung. Der gewöhnliche Import ohne diese Wahl behält weiterhin neuere lokale Datensätze.
4. Erst **Sicherung jetzt wiederherstellen** schreibt. Abbrechen oder die Dateiauswahl allein ändern nichts. Andere Datensätze und ausgelassene Bereiche bleiben erhalten. Ausdrücklich enthaltene Löschungen werden in der Vorschau gezählt.
5. Routinen, Spielstand, QR-Wert, Aufgaben, Arbeitszeiten und freiwillige Protokolle vergleichen. Die internen Recordrevisionen werden für die bewusste Wiederherstellung neu gesetzt; tatsächliche Ereigniszeiten und ursprüngliche Testberichte bleiben erhalten. Alte Testberichte ergänzen frühere Belege und ersetzen keine aktuell berichteten Probleme.
6. **Wecker & Benachrichtigungen prüfen** führt zur vorhandenen Diagnose. In Android kann die Benachrichtigungsfreigabe über den eigenen Knopf bewusst angefragt werden. Ein Restore allein bestätigt weder Freigaben noch Zustellung oder Hörbarkeit.
7. Zwei Installationen können unabhängig erinnern und wecken. Nach einem selbst beobachteten neuen Weckertest entscheidest du über das Abstellen der bisherigen Wecker. Die neue App schaltet die andere Installation nicht ab und entfernt deren Daten nicht.

## Technischer Nachweis

Der Modus `restore` erweitert ausschließlich den bestehenden `previewImport`-/Store-/Repository-Schreibweg. Die Standard-LWW-Logik und die Sync-Aufrufe bleiben unverändert. Die Store-Schreibbarriere berechnet die Übernahme gegen den wirklich aktuellen Bestand erneut; Quelldaten und ihre Sicherungsdatei werden nicht verändert.

Neue Kern- und Storefälle belegen ältere Settings/Spielstände gegen frischere Ersteinrichtungsdaten, erhaltene ausgelassene Privatgruppen, originalgetreue Berichtsidentitäten, keine Umdeutung alter Beobachtungen, Warteschlangenreihenfolge und Abbruch bei ungültigem Batch oder Speicherfehler. Zwei zusätzliche Browserfälle führen durch Erststart/Dateiauswahl/Vorschau/Abbruch/bewusste Übernahme; fünf bestehende Backupfälle bleiben als Regression erhalten. Implementiert und automatisch geprüft ist getrennt von der noch offenen echten Android-/Dateiauswahl-/Freigabeprüfung.
