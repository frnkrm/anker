# Optionales PC-Relay außerhalb des Heimnetzes

Das Relay ist zusätzlicher, ausdrücklich gewählter Transport für die bereits im
Heimnetz bestätigte PC-Kopplung. Es richtet weder einen Server noch ein Konto ein.
Ohne eigene Supabase-Konfiguration bleibt es aus; alle Heimnetzfunktionen bleiben
nutzbar. Ein erreichbares Relay oder eine gespeicherte Nachricht bestätigt keinen
PC-Plan, keine Windows-Aktion und keine erledigte Routine.

## Eigener Dienst: Einrichtung bleibt eine bewusste Entscheidung

Diese Anleitung beschreibt Software und spätere Bedienung. In der
Entwicklungsumgebung wurden kein Supabase-Projekt angelegt, keine Migration
deployed und kein kostenpflichtiger Dienst aktiviert. Die tatsächlichen Kosten,
Kontoeinrichtung, Berechtigungen und Erreichbarkeit des eigenen Projekts müssen
vor der Aktivierung geprüft werden.

1. Ein eigenes Supabase-Projekt einrichten. Für die vorhandene Anker-Anmeldung
   werden wie bisher `VITE_SUPABASE_URL` und der öffentliche
   `VITE_SUPABASE_ANON_KEY` beim App-Build benötigt. Unterstützt ist ausschließlich
   `https://<20-stellige-projektkennung>.supabase.co`. Beliebige Relay-URLs und
   Klartext-HTTP werden nicht akzeptiert.
2. Erst nach bewusster Projektwahl die Repository-Migrationen einschließlich
   `20261110000001_pc_link_relay.sql` in dieses Projekt übernehmen. Danach die
   Edge Function `pc-link` mit dem vorhandenen Supabase-CLI bereitstellen:

   ```sh
   supabase functions deploy pc-link --no-verify-jwt
   ```

   `--no-verify-jwt` betrifft die vorgelagerte Gateway-Prüfung, weil der PC einen
   begrenzten Gerätetoken verwendet. Der Handler selbst prüft Handy-Owner-JWTs
   mit `Auth.getUser` und Geräteberechtigungen anhand ihrer gespeicherten Hashes.
   `SUPABASE_SERVICE_ROLE_KEY` bleibt ausschließlich in der Edge Function und
   gehört niemals in die App, den PC, Einrichtungscodes oder öffentliche Dateien.
3. **Regelmäßige Löschung verbindlich einrichten und prüfen.** Nachrichten laufen
   spätestens 14 Tage nach ihrem ursprünglichen Sendezeitpunkt ab. Abgelaufene
   Einträge werden nicht mehr ausgeliefert oder über Owner-RLS angezeigt.
   `pc_link_relay_cleanup()` löscht sie tatsächlich; sie läuft zusätzlich bei
   Relayzugriffen. Falls `pg_cron` bereits ausdrücklich eingerichtet ist, legt
   die Migration den stündlichen Job `anker-pc-link-expiry` an. Andernfalls einen
   eigenen regelmäßigen administrativen Aufruf einrichten, bevor das Relay
   genutzt wird. Ohne Job können nach dem letzten Zugriff abgelaufene rohe
   Datenbankzeilen länger liegen; eine TTL allein ist keine Löschbestätigung.
4. Im eigenen Projekt die Anwendung der Migration, Owner-Isolation, vorhandenen
   Bereinigungsjob und dessen tatsächliche erfolgreiche Ausführung prüfen.
   Die lokalen Softwaretests beweisen diesen Livebetrieb nicht.

## Handy und PC bewusst freigeben

1. Handy und PC zuerst im Heimnetz koppeln, Prüfcode vergleichen und den
   Planabgleich bestätigen. Das Relay erzeugt keine zweite Kopplung und keine
   neuen Verschlüsselungsschlüssel. Beide Geräte müssen die aktuelle
   Begleiterversion unterstützen; die Erkennung eines alten PC-Begleiters wird
   durch das Relay nicht umgangen.
2. In der angemeldeten Android-App **Mehr → Abend & Alltag → PC-Stopp →
   Optional außerhalb des Heimnetzes verbinden** öffnen. Die Erläuterung lesen,
   die eigene Wahl aktivieren und **Relay bewusst einrichten** wählen.
3. Den einmalig gezeigten privaten Einrichtungscode selbst an den eigenen PC
   übertragen. Er wird verdeckt angezeigt und ist kein QR-, Backup- oder
   Testexport. **Privaten Einrichtungscode kopieren** kopiert ihn nur auf eigene
   Wahl; Anker verschickt keine Nachricht. Beim Verbergen/Verlassen der App wird
   das Feld geleert, auch wenn eine verspätete Einrichtung erst danach antwortet.
4. Im PC-Begleiter unter **Einstellungen → Relay** den Code in das verdeckte
   Einrichtungsfeld einfügen und bewusst übernehmen. Der Code wird danach aus dem
   Feld entfernt. Der PC speichert seinen Gerätetoken nur im bestehenden
   benutzergebundenen DPAPI-Speicher; das Handy speichert seine Berechtigung im
   bestehenden Keystore-geschützten PC-Brückenspeicher. Keine Zugangsdaten stehen
   im normalen App-Store, Datensync, JSON-Backup, Status oder technischen Log.

Die Handyberechtigung läuft nach 14 Tagen aus. Nur eine vorhandene, offene
SDK-Anmeldung darf sie erneuern; Android bekommt keine Kopie des
Supabase-Refresh-Tokens und startet keinen zweiten Anmelde-/Refreshprozess.
**Handyfreigabe für 14 Tage erneuern** behält den PC-Gerätetoken und beide
gemeinsamen Replayzähler. Ohne Erneuerung erscheint ein ehrlicher Ablaufstatus,
während die Heimnetzverbindung weiter funktionieren kann.

## Transport und Widerruf

- Eine frisch authentifizierte Heimnetzverbindung hat Vorrang. Bloßes TCP,
  Discovery oder Relayverkehr erzeugt keinen Heimnetzbeleg. Android führt
  höchstens einen Ciphertext-Post und eine kleine Inbox-Abfrage je Relayzyklus
  außerhalb des Verbindungsschlosses aus; Stoppen oder Entkoppeln invalidiert
  laufende Arbeit. Verspätete Antworten dürfen keine gelöschten Daten neu anlegen.
- Es gelten dieselben AES-GCM-v3-Umschläge, Paar-ID und persistenten Zähler für
  beide Wege. Der Server sieht nur Ciphertexte und Paar-/Richtungs-/Zeitmetadaten.
  Er hat keine AES-Schlüssel und darf keine Klartextplanung erzeugen.
- Der PC übernimmt Eingang, bestehende Wirkung, Ausgangssequenz und versiegelte
  Antwort atomar im vorhandenen Store. Eine verlorene HTTP-Antwort wiederholt
  denselben Ciphertext, statt die Alltagshandlung erneut auszuführen. Offene
  PC-Ereignisse bleiben in der vorhandenen dauerhaften Outbox.
- **Relay auf diesem Handy ausschalten** beziehungsweise am PC lokal ausschalten
  stoppt dieses Gerät. Das ist kein behaupteter Dienstwiderruf.
  **Relay für beide Geräte widerrufen** verlangt die Owner-Anmeldung und bestätigt
  Erfolg erst nach dem tatsächlichen Serverwiderruf. Der Dienst invalidiert beide
  Token und löscht nur die Mailbox dieser eigenen Paarung. Bei unbekannter
  Serverantwort bleibt der Widerruf ausdrücklich unbestätigt.
- Beim authentifizierten Entkoppeln kann der PC ausschließlich eine schon atomar
  versiegelte Abschlussantwort ausliefern und löscht danach die lokale
  Relayberechtigung. Das erlaubt keine neue Inbox-Abfrage, Entschlüsselung,
  Kopplung oder PC-Wirkung. Lokales Disable/Clear/Reset unterbindet auch diesen
  letzten Versand.

## Reproduzierbare Softwareprüfungen

Die Handlerfälle prüfen den echten HTTP-Handler mit kontrollierter Auth- und
Repositorygrenze, Rollen-/Tokenwiderruf, Bounds und echter v3-AES-GCM-Hin-/Rückrunde.
Die Pythonfälle verwenden tatsächlichen lokalen TLS-Verkehr, Zertifikatsprüfung,
den produktiven `BridgeServer.relay_exchange`, Storefehlersimulation und kontrollierte
Disable-/LAN-Races. Das ist kein externer Supabase- oder Android-/Windows-Gerätetest.

Für die Migration gibt es einen echten lokalen PostgreSQL-/RLS-Nachweis mit
PGlite; die Entwicklungsabhängigkeit liegt außerhalb der App:

```sh
npm install --prefix /tmp/anker-relay-sql --no-audit --no-fund --ignore-scripts --save-exact @electric-sql/pglite@0.5.16
node scripts/test-pc-relay-sql.mjs --module /tmp/anker-relay-sql/node_modules/@electric-sql/pglite/dist/index.js
```

Der Test erzeugt ausschließlich eine isolierte lokale Datenbank mit synthetischen
`auth.users`, `auth.uid` und Rollen. Er führt die tatsächliche Migration und
RLS-/RPC-/Widerrufs-/Expiry-/Cleanupfälle aus. Er startet weder Supabase noch
`pg_cron`, verwendet keine vorhandenen Nutzerdaten und aktiviert keinen Dienst.
