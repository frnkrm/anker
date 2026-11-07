ANKER – SCREENSHOTPAKET
Version 1.3.0-rc.6 · Code 13

SCHNELLSTART
1. Das ZIP vollständig entpacken. Die Ordnerstruktur beibehalten.
2. index.html im Browser öffnen. Die Galerie funktioniert offline.
3. Nach Seite, Titel oder Route suchen. Ein Bild anklicken, um die Original-PNG zu öffnen.
4. Einzelbilder liegen geordnet in den Unterordnern; native-simulation ist gesondert markiert.

ENTHALTEN
175 PNG-Dateien: 158 normale Browseraufnahmen und 17 ausdrücklich markierte native Browser-Simulationen.
100 normale Seiten-/Dialog-/Zustandsaufnahmen; zusätzliche Simulationsbilder können dieselbe Ansicht als Gesamtbild zeigen.
Handyansicht: der sichtbare Bildschirmbereich.
Gesamtansicht: eine lange Seite zum vollständigen Nachlesen.
Dialog-Scrollteil: ein tieferer Ausschnitt eines separat scrollenden Dialogs.
Alle Bildpfade sind eindeutig; PNG-Signatur, Abmessungen und Chunk-Prüfsummen sind geprüft.

LANGE SEITEN
Nur für Gesamtansichten wird die sonst feststehende Anker-Navigation durch eine Aufnahmeoption einmal unter dem vollständigen Inhalt angeordnet. So verdeckt sie keine Stelle in einem langen Bild. Die Handyansichten zeigen die normale feste Navigation; der Appcode bleibt unverändert.
Offene Dialoge werden als Handyansicht und bei Bedarf in mehreren Scrollteilen gezeigt.

RAHMEN
Chromium mit mobiler Ansicht von 390 × 844 CSS-Pixeln.
Die tatsächlichen PNG-Pixelmaße stehen für jede Datei in paket-inventar.json.
Hauptaufnahmen: Beispieltagesplan Montag, 09.11.2026, Europe/Berlin.
Weitere Tages-/Abendzustände sind zusätzliche Varianten. Native Nachtansichten
verwenden eine kontrollierte Beispielsituation um 23:30 Uhr.
Alle Aufgaben, Orte, QR-Codes, Spiel- und Schlafwerte sind synthetische Beispieldaten.
Es wurden keine Handydaten übernommen und keine persönlichen Alltagsdaten aufgenommen.
Der Appcode wurde für das Screenshotpaket nicht verändert.
Quellcommit der App: 855b0bef8c276f358ce4f7db5fa3ac1299ead2ae

BROWSER-SIMULATIONEN
Die Android-Ansichten stammen aus dem Browser mit einer kontrollierten
Capacitor-Brücke. Die sichtbaren nativen Zustandswerte sind simuliert.
Sie zeigen Ankers Oberfläche, sind aber keine Aufnahmen von einem echten Samsung
und bestätigen weder Ton noch Sensoren oder Zustellung.

NICHT ALS ECHTE ANDROID-AUFNAHMEN ENTHALTEN
- Android-Systemdialoge für Berechtigungen, Akku und Nicht stören
- echter Sperrbildschirm, Always-on-Display und Android-Systemleisten
- echte Benachrichtigungen und deren Android-Antwortaktionen
- Homescreen-Widget und Launcher-Schnellzugriffe auf einem echten Handy
- QR-Kamerabild, Android-Dateiauswahl, Teilen- und Druck-Systemdialoge
- das Android-Fenster über anderen Apps und deren tatsächliches Minimieren
- echter Weckton, Sensor-/Mikrofonmessung und Schlafphasen oder Schlafqualität
- externe Anbieter-, Google-Anmelde- und Play-Store-Oberflächen

DATEIEN
index.html                  Suchbare Offline-Galerie
README-DE.txt               Diese Anleitung
seiten-manifest.json        Seiten, Dialoge und Bildzuordnung
native-simulation/          Deutlich benannte Simulationsbilder und eigenes Manifest
paket-inventar.json         Vollständige Bildliste, Maße, SHA-256 und Herkunft
SHA256SUMS                  SHA-256 aller Paketdateien außer dieser Liste selbst

Die Galerie braucht weder Anmeldung noch Internet. Betriebssystemdialoge und
unendlich viele mögliche persönliche Eingaben sind keine zusätzlichen Appseiten.
