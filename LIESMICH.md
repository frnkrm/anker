# Anker – Uploadpaket für deine Play Console

**Anker 1.5.0-rc.2 / Code16**, Paket **de.frnkrm.anker.mobile**.
Dieses Paket enthält das Uploadformat **Anker.aab** und öffentliche Prüfangaben.

## In deinem Konto weiter

1. Die ZIP vollständig herunterladen und entpacken. Die App ist in deiner Play Console noch anzulegen.
2. App anlegen: **Anker**, Standardsprache **Deutsch**, Typ **App**, **kostenlos**.
3. Für erste Versuche einen **internen Test als Entwurf** vorbereiten. Lade dort Anker.aab hoch und prüfe die tatsächlichen Console-Rückmeldungen. Eine Veröffentlichung ist damit nicht beauftragt.

## Vorhandene Signierung erhalten

Für kompatible Updates deiner bestehenden Installation muss bei **Play App Signing der vorhandene App-Signierschlüssel B4** übernommen werden:

B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A

Die AAB-Signatur bestätigt hier den vorhandenen Schlüssel als lokalen Uploadsignierer. Ein Uploadschlüssel allein garantiert nicht, dass Google die installierten APKs anschließend mit B4 signiert. Dieses Paket richtet Play App Signing nicht ein und erteilt keine Zustimmung zu einem neuen App-Signierschlüssel.

Für die Übernahme eines vorhandenen App-Signierschlüssels kann die Console **PEPK** und ihren öffentlichen Verschlüsselungsschlüssel vorgeben. Das ist eine geschützte Schlüsselübertragung an Google. PEPK-Ausgaben, private Schlüssel, Passwörter und Signierkonfigurationen gehören nicht in dieses Downloadpaket; sie sind nicht enthalten. Eine Schlüsselauswahl oder -übertragung wurde hier nicht vorgenommen.

## Tatsächlicher Prüfstand

Das Bundle wurde lokal strukturell und seine JAR-Signatur gegen B4 geprüft. Originale Nutzdaten sind bytegleich und signiert; vorhandene native 16-KB-Eigenschaften wurden geprüft. Die 197 Android-JUnit-Fälle des identischen Code16-Appstands wurden wiederverwendet, nicht erneut für dieses AAB ausgeführt. Bestehende vollständige Code16-Regression: 1095 Logik- und 271 Browserfälle; CI https://github.com/frnkrm/anker/actions/runs/42619085381.

Es erfolgten **kein Upload zu Google Play, keine App-Anlage, keine Google-Freigabe und keine Installation über Play**. Google-generierte Split-APKs und ihre tatsächliche Installation sind noch nicht hier geprüft.

Quellcommit: 4d8eaa1cd1dc463e3ce9032779d857a215d020fc
Laufzeitkennung: 9786f18293f2eb5d9c3e61098cb03c07ad8e3e5cebcaca0c1c583e0bd9ea5ada
AAB-SHA256: 522e3feb9dbfd8a146dec903dff3e496fc50d4e5a8cead72a5a43bc85964d76e
