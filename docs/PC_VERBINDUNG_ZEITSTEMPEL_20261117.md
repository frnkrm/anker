# Lokale PC-Verbindung: Android-Zeitstempel (17.11.2026)

## Ursache und Änderung

Android Code17 / 1.5.0-rc.3 konnte koppeln und den PC per LAN erreichen,
aber keine dauerhafte Live-Verbindung beziehungsweise Planbestätigung herstellen.
Eine zeitlich begrenzte lokale Diagnose zeigte `ProtocolError: timestamp` beim
verschlüsselten Nachrichtenaustausch. Android verwendet `Instant.now()`, dessen
ISO-Zeitstempel bis zu neun Nachkommastellen enthalten. Der Python-Empfänger
akzeptierte höchstens drei.

Der PC-Parser akzeptiert jetzt eine bis neun Nachkommastellen. Für die
AES-GCM-Authentifizierung wird der originale Zeitstempeltext unverändert verwendet.
Zeitzone, gültiges Datum, Obergrenze der Präzision und Replayprüfung bleiben Pflicht.
Die bisherige Millisekunden-Ausgabe des PC bleibt erhalten.

## Automatische Prüfung

Der neue Regressionstest scheiterte vor dem Fix für sechs und neun
Nachkommastellen mit `timestamp`. Nach der Korrektur lief die vollständige
Python-Suite unter Windows: 286 Tests, davon zwei übersprungen, keine Fehler.
Die neuen Fälle prüfen Android-Präzision in authentifizierten Umschlägen,
Manipulationen am Zeitstempel, fehlende Zeitzone, ungültiges Datum und überlange
Nachkommastellen. `git diff --check` ohne Befund.

## Tatsächlich beobachtet

Auf dem vorhandenen Windows-PC wurde nur die installierte `protocol.py` nach
Sicherung korrigiert und der Begleiter regulär neu gestartet. Die Android-App
Code17 wurde nicht ersetzt. Danach zeigte das echte Handy „Jetzt verbunden“
und „Der aktuelle Plan wurde vom PC bestätigt.“ Der PC-Zustand enthielt erstmals
Tagesplan und Vorschau. Laptop über LAN, Handy über das Haupt-WLAN.

Temporäre Diagnosehilfen wurden entfernt und der normale Begleiter gestartet.
Kopplung und Nutzerdaten blieben erhalten. Keine Veröffentlichung, kein neuer
Installer, kein Handyupdate und keine Prüfung von Sperre, Audio oder Herunterfahren.
Ein späteres Update aus unverändertem Remote-Code kann den lokalen Fix ersetzen;
die Änderung ist bislang nur lokal angewendet und nicht gepusht.

Separater Befund: Laptop-WLAN hat DHCP ausgeschaltet und kein Gateway. Diese
Netzwerkeinstellungen wurden nicht geändert; für die bestätigte LAN-Verbindung
zum Begleiter war das nicht erforderlich.
