# Native PC-Verbindung v3

Die Android-Schicht transportiert vorhandene Zustands-Snapshots. Sie erzeugt keine eigene Tagesplanung und übernimmt weder Morgenalarm noch Routine-Timer. Netzwerkaufrufe gehören auf den Hintergrund-Executor des Capacitor-Plugins.

## Integration

`android/app/build.gradle` benötigt `implementation "com.squareup.okhttp3:okhttp:4.12.0"`.

Das Manifest registriert `PcBridgeService` mit `android:exported="false"` und `android:foregroundServiceType="connectedDevice"`. Zusätzlich zu INTERNET und FOREGROUND_SERVICE werden FOREGROUND_SERVICE_CONNECTED_DEVICE, CHANGE_NETWORK_STATE, ACCESS_WIFI_STATE und CHANGE_WIFI_MULTICAST_STATE benötigt. Es wird keine globale Cleartext-Freigabe verwendet. Die native Suche läuft begrenzt und gibt den MulticastLock im finally-Block frei.

`anker_pc_bridge_secure_v3.xml` muss von Android-Cloud-Backup und Geräteübertragung ausgeschlossen sein. Die vollständige Datei ist mit einem nicht exportierbaren Android-Keystore-Schlüssel verschlüsselt und liegt im Credential-Protected Storage. Keine Schlüssel, Zähler oder Notfall-Tokens gehören in JS-Export, Sync oder AnkerPrefs/Direct-Boot-Speicher.

Das Plugin kann folgende synchronen Kotlin-Aufrufe auf seinem Hintergrund-Executor anbieten; Rückgaben sind JSONObject:

```kotlin
PcBridgeClient.discover(context, timeoutMs: Long)
PcBridgeClient.pair(context, qr: String, deviceName: String)
PcBridgeClient.state(context)
PcBridgeClient.configure(context, qrHash: String?, autoReconnect: Boolean?)
PcBridgeClient.send(context, payload: JSONObject)
PcBridgeClient.start(context)
PcBridgeClient.stop(context)
PcBridgeClient.drainEvents(context)
PcBridgeClient.ackEvents(context, ids: List<String>)
PcBridgeClient.unpair(context)
PcBridgeClient.emergency(context, qr: String, minutes: Int)
PcBridgeClient.wakeOnLan(mac: String, broadcast: String)
PcBridgeService.hasForeground()
```

`start`/`pair` werden bewusst aus einer sichtbaren App-Aktion aufgerufen. Der sichtbare Foreground-Service hält WSS mit 25-Sekunden-Ping und begrenztem Reconnect-Backoff von 1 bis 60 Sekunden. Die generische private Benachrichtigung bietet „Verbindung beenden“ und enthält keine Aufgabentitel oder Notizen. `hasForeground()` zählt beim gemeinsamen Dienstbudget nur einen tatsächlich laufenden Foreground-Dienst. Ein nicht erlaubter Android-Start meldet PC_FOREGROUND_NOT_ALLOWED.

## Status und Bestätigungen

Status: `state` = unpaired/pairing/paired-never-reached/connected/unreachable/rejected/companion-outdated; daneben `connected`, `active` (tatsächlicher Foreground-Service), `requestedActive`, `autoReconnect`, `lastReceivedAt`. Optional: `pairId`, `pcName`, vierstelliger Bestätigungscode `code`, `ack`, `error`, `emergencyAck`.

`send` liefert `{sent, queued}`: `sent` bedeutet nur in WSS eingereiht. Erst ein validiertes PC-ACK mit der erwarteten Revision bestätigt den Empfang. Eine erfolgreiche Notfallantwort wird separat als `emergencyAck: {commandId, until, receivedAt}` behalten; sie verlangt passende Befehls-ID, identische Endzeit, dieselbe laufende Session und gültige Lease. Nachfolgende normale ACKs überschreiben diese Bestätigung nicht.

`emergency` prüft zuerst den frisch gescannten QR-Inhalt gegen den lokal hinterlegten SHA-256-Hash. Erst danach signiert der nicht exportierbare P-256-Notfallschlüssel ein maximal fünf Minuten gültiges Token. Verlängerung maximal zwei Stunden und nie über die aktuell vom Telefon gelieferte Lease hinaus. Die Methode gibt `{until, tokenId, sent}` zurück, keine Signatur und keinen privaten Schlüssel. Die Oberfläche darf „PC bestätigt“ erst nach passendem emergencyAck anzeigen.

`drainEvents` liefert `{events, lastSeq}`. Die App validiert den fachlichen Inhalt, speichert ihn transaktional im bestehenden Store und ruft erst danach `ackEvents(ids)` auf. Die native Queue und die eingehende Sequenz werden bereits beim Empfang gemeinsam verschlüsselt gespeichert. Beim Reconnect erfolgt zuerst Pull, vor erneutem Senden vorhandener Snapshots. Nach Event-ACK sendet die App einen neu abgeleiteten Zustand. Ein authentifiziertes `unpaired`-Ereignis löscht Verbindungsschlüssel sofort; sein Queue-Eintrag bleibt bis zum Store-ACK verfügbar.

## Sicherheit und Nachweise

Verbindungsaufbau ausschließlich zu privaten LAN-/Loopback-Adressen, private-only DNS und SHA-256-Pin des exakten QR-Zertifikats; keine System-Trust-Ausweichroute. Ein DHCP-Wechsel kann neue private NSD-Kandidaten liefern, ändert aber nie den Pin. Protokoll v3 nutzt P-256-ECDH, HKDF-SHA256, getrennte AES-256-GCM-Richtungs-Schlüssel, zufällige 96-Bit-Nonces und persistent vor Versand reservierte Sequenzen. Replays, fremde Pair-IDs, unbekannte Felder, überlange Texte und Frames werden verworfen. Diagnosen sind feste Fehlercodes ohne Adressen, Inhalte oder Schlüssel.

Automatisch geprüft: 14 reine JVM-Tests für private Adressen, URL-Injection, exakten Zertifikat-Pin, Replay-/Sequenzgrenzen, begrenztes Backoff, kanonisches Base64, Ablaufgrenzen, explizite Zeitzonen, P-256/HKDF und AES-GCM gegen dieselben öffentlichen Vektoren wie `src/core/pcLink/fixtures/v3-crypto.json`, manipulierte AAD/Chiffrate und ungültige Kurvenpunkte.

Alle sechs neuen nativen Klassen wurden außerdem isoliert gegen Android-36-SDK, OkHttp 4.12.0 und Okio 3.6.0 kompiliert. Die Vollintegration einschließlich Capacitor, Servicebudget und Manifest wird anschließend im gemeinsamen Android-Build geprüft.

Die geschlossene App erhält die freiwilligen T30-/T10-Hinweise über den bestehenden Reminder-Builder und seine Wochenregeln (`guidance-wind-down`, `guidance-brain-dump`). Der vorhandene Schlüssel `bed` bedient die Bettzeit einmalig. Bei aktiver v7-Abendeskalation ersetzt diese Serie die alte wind-down/pcstop-Serie; Krankheit, offenes Ende, Bettbestätigung, abgeschlossene oder heute abgewählte Abendroutine unterdrücken sie. Die sanften Vorhinweise dürfen auch als Wochenregeln weder Ruhezeiten noch Fokus durchbrechen. Dafür erweitert die native Integration die feste Key-Whitelist und leitet `critical` aus dem tatsächlichen Schlüssel ab. Typecheck und alle 46 Tests des Reminder-Testordners sind grün.

Auf echtem Android-Gerät noch offen: CE/Keystore über Neustart/Entsperren, WSS im Standby, Android-Foreground-Budget, mDNS/Firewall im privaten WLAN, Zertifikatwechsel, QR-Kopplung mit PC-Bestätigung, persistente Ereignisse nach Prozessende und Notfall-ACK bei WLAN-Abbruch. Ein erfolgreicher JVM- oder Android-Build ersetzt diese Geräteprüfungen nicht.
