# Anker aktualisieren: Code16

**Historischer B4-Direktdownload, Abgrenzung 14.11.2026:** Nutzer meldet Play-App-Signierer8A und UploadsigniererB4. Die folgende B4-APK ist kein belegtes reguläres Update einer8A-signierten Play-Installation; die damalige Direktupdatebeschreibung setzt eine passend signierte Zielinstallation voraus. [Aktuelle Rollen und vollständige öffentliche Fingerabdrücke](SIGNIER_GERAETEBUILD_VORAUSSETZUNGEN.md). Keine neue Installationsfreigabe, keine Deinstallation/Datenlöschung oder Schlüssel-/Versionsumgehung; tatsächlicher Gerätestand weiter unbekannt.

**1.5.0-rc.2 / Code16**, weiterhin **Anker**. Gleiche App-Kennung und geprüfte bestehende B4-Signatur; Routinen, Einstellungen, Spielstand und Berichte bleiben beim regulären Update erhalten.

1. Auf dem Handy [Anker-Code16-ZIP herunterladen](https://codeload.github.com/frnkrm/anker/zip/refs/heads/download-anker-code16-20261109).
2. In Eigene Dateien den Download öffnen und entpacken.
3. **Anker.apk → Aktualisieren** wählen. Die bisherige App dafür nicht deinstallieren. Falls Android die Installation ablehnt, den genauen Hinweis notieren und die vorhandenen Appdaten behalten.
4. Anker öffnen und unter **Wecker & QR-Code → Weckerverlauf & Diagnose** den neuen Verlauf ansehen. Der PC-Begleiter braucht für dieses Update keinen neuen Download.

## Nach einem auffälligen Morgen

Öffne **Weckerverlauf & Diagnose** über Wecker oder **Mehr → Einstellungen**. Wähle die letzten 24 Stunden, sieben Tage oder Von/Bis. Standardmäßig sind Wecker, stummer Schlafhinweis und Systemereignisse samt aktuellem technischem Status ausgewählt; alle zusätzlichen Einstellungsgruppen beginnen aus. Unter **Log- und Einstellungsbereiche auswählen** entscheidest du selbst, welche weiteren Angaben mitkommen. Vorschau prüfen, **Ausgewählte Diagnose exportieren** wählen und die JSON-Datei hier selbst anhängen. Es gibt keinen automatischen Versand. [Datenumfang und Grenzen](ANLEITUNG.md#weckerverlauf--diagnose-code16).

Das lokale Journal beginnt **erst mit diesem Update**, höchstens sieben Tage und 800 Ereignisse. Den früher betroffenen Morgen kann es nicht nachträglich rekonstruieren. Ein angenommener Weckauftrag oder gestarteter Player beweist weder hörbaren Ton noch Aufwachen. Solange die tatsächliche Zuverlässigkeit auf deinem Galaxy nicht erneut beobachtet wurde, für wichtige Morgen zusätzlich einen unabhängigen Wecker nutzen.

## Was korrigiert wurde

- Weckweg mit technischen Ereignissen und begrenztem Ersatztonversuch bei späterem Playerfehler; keine Änderung deiner Systemlautstärke oder Nicht-stören-Regeln.
- Selektiver Diagnoseexport mit Zeitraum, Log-/Statusbereichen, optionalen Einstellungen und Auswahlmanifest. Keine Aufgaben-/Notiztexte, QR-Inhalte, Zugangsdaten, PC-Schlüssel oder Gesundheitsprotokolle.
- Der stumme Schlafhinweis unterscheidet ein physisch eingeschaltetes Display von Androids Interaktivitätswert. CPU-Wecktermin, tatsächliches Zeichnen und bestätigtes App-Fortsetzen werden getrennt erfasst; höchstens zwei automatische Vordergrundversuche. Ein ausgeschaltetes Display wird nicht eingeschaltet und kein Touchschutz umgangen. Samsungs gedimmter Spielschutz ist eine plausible Besonderheit, aber keine bewiesene Weckerursache oder garantierte Spielminimierung.
- G1/G96/G101 bündeln die nötigen Beobachtungen im vorhandenen Katalog; weiterhin 103 IDs und sieben v7-Stationen, historische Berichte erhalten.

## Geprüfter Stand

Quelle `4d8eaa1cd1dc463e3ce9032779d857a215d020fc`, Laufzeitkennung `9786f18293f2eb5d9c3e61098cb03c07ad8e3e5cebcaca0c1c583e0bd9ea5ada`, **1.5.0-rc.2 / Code16**, Name Anker und Paket `de.frnkrm.anker.mobile`. **1.095 Logik-/271 Browser-/197 frische Android-JUnit-/89 PC-Pythonfälle**, 5 Paket-/Installer-, 19 klassische PC-/36 Updatefälle grün; TypeScript und Build erfolgreich, Lint 0 Fehler/1 bestehende Warnung. [GitHub-CI](https://github.com/frnkrm/anker/actions/runs/42619085381) bestätigt den exakten main/push-Stand mit allen drei Jobs. Der öffentliche ZIP-Download wurde vollständig mit TLS-Prüfung gespeichert; CRC und alle Dateien stimmen bytegleich. Der vorhandene Windows-PC-Begleiter wurde nicht neu veröffentlicht. Echte Galaxy-Ton-/Spiel-/Display-aus-/Standbyprüfungen bleiben offen.

APK-SHA256: `1627da4bdf00207533a8cff8fbc90f8b9d1770fe343eb37ec214903d70b330be`. ZIP-SHA256: `6567c750eba6e4c4d9754cb37a91cd210f61dabeef7790e09353fa7bb8735878`. [Vollständiger Nachweis](ANKER_CODE16_NACHWEIS.json) · [Testgrenzen](ANKER_TESTNACHWEISE.md#code16--weckerverlauf-selektiver-export-und-schlafhinweis) · [Öffentliche Signaturdaten](ANKER_CODE16_SIGNATUR.json).
