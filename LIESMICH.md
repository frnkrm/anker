# Anker – Play-Uploadpaket Code17

**Anker 1.5.0-rc.3 / Code17**, Paket **de.frnkrm.anker.mobile**.
Anker ist in deiner Play Console bereits angelegt. Diese ZIP enthält nur das signierte Uploadformat **Anker.aab** und öffentliche Prüfangaben. Sie legt weder eine App noch einen Dienst oder eine Signierung an.

Ein Upload darf ausschließlich im vorgesehenen **internen Track als Entwurf** erfolgen. Vorhandene Veröffentlichungen bleiben erhalten; weder Review-Einreichung noch Aktivierung oder öffentliche Freigabe werden von diesem Paket ausgeführt.

Das lokal geprüfte B4-Zertifikat ist B4:7F:FF:FE:BE:13:7C:F1:51:29:96:1D:E4:3A:27:E3:EC:81:1A:CF:FE:45:42:B6:32:4E:11:76:89:95:B1:3A. Der Uploadsignierer und Googles tatsächlicher App-Signierer sind getrennte Rollen. Bestehende Play-App-Signing-Einstellungen nicht ersetzen; aus dieser ZIP erfolgt keine Schlüsselübertragung. Private Schlüssel, PEPK-Ausgaben, Passwörter und Signierkonfigurationen sind nicht enthalten.

Lokal bestanden: Bundletool-Strukturprüfung, gegen B4 geprüfte JAR-Signatur, alle originalen Nutzdaten bytegleich und signiert, native 16-KB-Prüfung. Die 252 Android-JUnit-Fälle gehören zum exakt identischen aktuellen Quellstand und werden für diesen AAB-Schritt ausdrücklich wiederverwendet. Native Inputs und Webassets sind bytegleich gebunden. Vollständige main/push-CI: 1183 Logik- und 308 Browserfälle; Check und beide PC-Matrixjobs erfolgreich.

Kein Google-Upload oder Play-Installationsnachweis ist damit behauptet. Google-generierte Split-APKs, deren Signierer und die tatsächliche Installation sind eigene spätere Nachweise.

Quellcommit: 80f6a692b005ab08edacf9e6ad9e9669e4c383f7
Laufzeitkennung: 10c21f4f5bb07215244a1cc53dc21f8423a020f24aa7c1cfb4df38b9c3e441c7
CI: https://github.com/frnkrm/anker/actions/runs/42748341550
AAB-SHA256: 2e53d046d32ec4fc53f083a0a9a59e688f1224615af7946330642e97b8c84098
