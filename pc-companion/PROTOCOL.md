# Anker PC-Bridge v3 (verbindlicher Drahtvertrag)

Der PC ist ein lokaler TLS-Server auf Port **47830**, mDNS **`_anker._tcp.local.`**.
Android verwendet den SHA-256-Pin des Blattzertifikats. Keine globale
Cleartext-Freigabe, keine Systemlautstärke-/Sperrwirkung ohne eigene Aktivierung.
Zeitstempel sind ISO-8601 mit Zeitzone; Uhrzeiten kommen ausschließlich vom Handy.
Aktuelle Android-Zustände werden über **WSS `/v3/ws?pair=<id>`** mit Wiederverbindung
gesendet. Der Server unterstützt zusätzlich **POST `/v3/link`** für kompatible
Clients und Integrationstests; Android verspricht keinen REST-Datenfallback.
**GET `/health`** und **GET `/v3/hello`** sind wirkungsfrei.

## Kopplung

Der PC zeigt `anker-pc-pair:v3:` + base64url(JSON), ohne Padding:

```json
{"t":"anker-pc-pair","v":3,"id":"random-id","n":"Mein PC","k":"SEC1-P256-public-65-bytes-base64url","c":"leaf-certificate-sha256-hex","s":"32-random-bytes-base64url","a":["192.168.1.2:47830"],"e":"2026-11-12T21:10:00.000Z"}
```

Gültig zehn Minuten, einmalig. Das Handy erzeugt ein ephemeres ECDH-Schlüsselpaar
und einen eigenen langfristigen Android-Keystore-ECDSA-Schlüssel nur für bestätigte
Hardware-Notverlängerungen. POST `/v3/pair`:

```json
{"id":"random-id","n":"Mein Handy","k":"phone-ephemeral-public-SEC1","signingKey":"phone-emergency-public-SEC1","proof":"base64url-HMAC-SHA256"}
```

`proof = HMAC(s, UTF8("pair|" + id + "|" + k + "|" + signingKey))`.
Beide Seiten zeigen denselben vierstelligen Prüfcode:
`int(SHA256(pcPublicBytes || phonePublicBytes)[0:4], big-endian) % 10000`, mit Nullen.
POST antwortet `{status:"pending",id,code}`. Erst die Bestätigung im PC-Fenster
aktiviert die Kopplung. GET `/v3/pair/<id>` liefert `{status,id}` (`pending`,
`paired`, `rejected`, `expired`). Es werden darüber keine Schlüssel ausgegeben.

## Verschlüsselung

ECDH-P256 liefert die 32-Byte-x-Koordinate als IKM. HKDF-SHA256 mit Salt `s`
und Info `anker-link v3 phone->pc` bzw. `anker-link v3 pc->phone` erzeugt je einen
32-Byte-AES-GCM-Schlüssel. Schlüsselpaare danach verwerfen. PC persistiert
Schlüssel nur per DPAPI; Android nur im eigenen Keystore-Speicher, nie Backup/Sync.

```json
{"v":3,"kind":"anker-link","pair":"random-id","from":"phone","seq":1,"sentAt":"2026-11-12T21:00:00.000Z","nonce":"12-random-bytes-base64url","ct":"AES256GCM-ciphertext-and-tag-base64url"}
```

AAD ist sortiertes, kompaktes UTF-8-JSON der sechs Felder `v,kind,pair,from,seq,sentAt`.
Alle acht Felder sind Pflicht, weitere Felder verboten. `from`: `phone` oder `pc`.
Sequenzen steigen strikt je Richtung und werden vor Wirkung/Versand dauerhaft
gespeichert. Lücken sind erlaubt; alte Sequenzen, falsche Tags/Paare/Richtungen
werden abgelehnt. Envelope maximal 64 KiB, Freitext maximal 500 Zeichen.

## Nutzlasten

`state` hat genau diese Felder (optionale Felder mit `?`):

```text
type="state", state, sessionId, revision, date, generatedAt, validUntil,
remainingSeconds, routineStep=null|{index,total}, lockEnforced,
schedule={windDownAt,brainDumpAt,bedAt,wakeAt,morningDeadlineAt,lightHintAt?,
          pcStopAt?,leaveAt?,workStartAt?,homeOffice?},
prefs={enforceEnabled,strictLock,dimEnabled,dimMax,audioDuck,shareBrainDump,
       morningCountdown,offlinePolicy,stopAction,graceSeconds,ifThen?,bedtimeSequence?}, brainDump?
```

Zustände: `DAY_ACTIVE`, `IDLE`, `MORNING_PENDING`, `MORNING_ACTIVE`,
`MORNING_COMPLETED`, `ALARM_RINGING`, `EVENING_WIND_DOWN`, `WIND_DOWN_T30`,
`BRAIN_DUMP_T10`, `BEDTIME_HARD_CUT`, `NIGHT_LOCK`, `ZOMBIE_MODE`.
`date` ist der Berliner Plantag (Wechsel 04:00), `revision` und `sessionId` stabil.
Die fünf verpflichtenden Schedule-Zeitpunkte dürfen `null` sein (offenes Ende oder
pausierter Ablauf). Es werden dafür keine Uhrzeiten erfunden. Auch optionale
Schedule-Zeitpunkte dürfen null sein. `prefs.ifThen` ist ein Text mit höchstens
500 Zeichen und wird nur nach der eigenen Wahl „Auf dem PC zeigen“ gesendet.
`routineStep` enthält nur Index/Gesamtzahl, keine Aufgabentitel. `dimMax` 0–0,4;
`bedtimeSequence` ist optional und bei Abwesenheit `false`. Nur die ausdrücklich
gewählte dreistufige Abendbegleitung sendet `true`: Der PC verwendet dann `bedAt`
für T30/T10 und den finalen Schnitt. Andernfalls bleibt `pcStopAt` maßgeblich;
die vom Handy gelieferten bettbezogenen Vorphasen werden zusammen um die
Differenz zur gewählten PC-Zeit verschoben. Eine Verlängerung verschiebt die
gesamte Serie. Ein offenes Ende ohne Zielzeit erzeugt keine Ersatzzeit.
`offlinePolicy`: `pause`/`fixed-time`; `stopAction`: `lock`/`hibernate`/`shutdown`;
`graceSeconds` mindestens 60. Alle Wirkungsfreigaben starten aus.
Brain-Dump ist `{text:string,nextStep?:string}` (je Text höchstens 500 Zeichen),
nur wenn `shareBrainDump=true`; sonst darf das Feld nicht vorkommen.
`validUntil` und `morningDeadlineAt` begrenzen Nacht-Watchdog und Offlinewirkung.
Eine Zustandsfreigabe gilt höchstens 18 Stunden; die Morgengrenze liegt höchstens
drei Stunden nach `wakeAt`. Ein gültiger Nachtauftrag verfällt nicht allein beim
04:00-Wechsel: die Nacht-Session bleibt bis zum echten Morgenabschluss gleich.
Nach 04:00 darf das Handy denselben Session-Identifier mit dem neuen Plantag
weiterführen. Tagesbriefings behalten die bisherige 04:00-Gültigkeit. Mehr als
zwei Minuten Uhrabweichung erzeugen `clock-skew` und pausieren Systemwirkungen,
bis ein neuer uhrzeitlich plausibler Auftrag bestätigt wurde.

`briefing`: `{type:"briefing",revision,generatedAt,validUntil,days,prefs}`.
`days` (1–14) enthält `{date,validUntil,pc:{mode:"scheduled"|"paused",stopAt?,localTime?},
bedAt?,wakeAt?,windDownAt?,brainDumpAt?,morningDeadlineAt?,lightHintAt?,morning?:{leaveAt?,workStartAt?,homeOffice}}`.

`lightHintAt` ist ein optionaler gültiger ISO-Zeitpunkt, niemals `null`. Fehlt er,
bleibt das bisherige Verhalten erhalten. Er erlaubt nur eine lokale Abendlicht-Karte,
einmal je Plantag und höchstens fünf Minuten nach Fälligkeit. Ein laufender
Abendübergang, T30/T10, Nacht oder eine ungültige/pausierte Quelle unterdrücken sie.
Keine Audioänderung, Dämmerung, Sperre oder Routine-Erledigung wird damit ausgelöst.
Ein unveränderter PC-Eintrag überschreibt eine lokale Standardmodus-Verlängerung nicht.
Der PC wählt ausschließlich den expliziten Eintrag zum aktuellen Berliner Plantag
mit noch gültigem Tages- und Gesamtbriefing. Pausierte, fehlende oder abgelaufene
Tage erzeugen keinen Ersatztermin. `pcStopAt` bzw. `pc.stopAt` ist die genaue
PC-Stopp-Zeit; `bedAt` bleibt die davon unabhängige Schlafenszeit.

`ack`: `{type:"ack",revision,receivedAt,effective:{date,mode,stopAt?},
companion:{version:"0.1.1",protocol:3},warnings}`.
Bei Befehlsantworten zusätzlich `commandId`; bei einer tatsächlich angenommenen
Hardware-Notverlängerung zusätzlich `emergencyUntil` (ISO). Erst die passende
ID und bestätigte Zielzeit belegen die Annahme; ein gesendeter WebSocket-Frame
allein bestätigt sie nicht.
Modi: `scheduled`, `paused`, `suspended-today`, `legacy-conflict`, `locked`, `released`.
Nur passende Revision und heutige Gültigkeit dürfen in Android als bestätigt gelten.
`effective.stopAt` ist auch bei tatsächlich beobachtetem Modus `locked` enthalten.
Damit kann das Handy nach dem 04-Uhr-Tageswechsel die bereits fällige ursprüngliche
PC-Nacht vor einem QR-Notverlängerungstoken prüfen, ohne eine neue Bettbestätigung
oder ein bloßes erfolgreiches Lock-API-Kommando als Beobachtung auszugeben.
Bekannte Warnungen: `clock-skew`, `local-enforcement-off`, `legacy-conflict`,
`source-expired`, `no-schedule`, `morning-deadline-reached`, `pairing-required`.
Zusätzlich `link-stale`: Nach 90 Sekunden ohne authentifizierten Kontakt pausiert
`offlinePolicy=pause` alle neuen Wirkungen. Ping/Pong auf einem durch mindestens
einen gültigen AES-Frame authentifizierten WSS-Socket hält den Kontakt frisch;
ein alter `generatedAt`-Wert allein unterbricht den laufenden Auftrag nicht.
`fixed-time` verwendet ein gültiges, explizit vorbereitetes Tagesbriefing oder
den noch gültigen heutigen Zustandsauftrag. Eine bereits aktivierte strikte Nacht
läuft bei Verbindungsverlust nur bis zu ihrer ursprünglichen endlichen Grenze.
Ein Tagesbriefing ohne echte Nacht-Session startet keinen neuen Nacht-Watchdog.

`command`: `{type:"command",id,action,minutes?,token?}`. Aktionen `ping`, `unpair`,
`test-evening`, `resume-today`, `suspend-today`, `extend`, `EMERGENCY_EXTENSION`.
Im strengen Modus keine Verlängerung am PC; Notverlängerung nur mit folgendem Token:

```text
{v:3,pair,sessionId,date,issuedAt,expiresAt,until,nonce,signature}
```

Signiert wird kanonisches JSON ohne `signature`, UTF-8, `SHA256withECDSA` mit
DER-Signatur als base64url. `nonce` einmalig, Gültigkeit höchstens fünf Minuten,
`until` höchstens zwei Stunden ab Ausstellung und innerhalb der Auftragsgültigkeit.
Das Handy darf erst nach bestätigtem QR/NFC-Override signieren. Der PC hat keinen
Endpunkt zum Ausstellen solcher Tokens. Er kann Windows nicht selbst entsperren,
sondern beendet beim Morgenabschluss lediglich den Wieder-Sperr-Watchdog.

`pull`: `{type:"pull",after}`. Antwort `events`: `{type:"events",items,lastSeq}`.
Ereignisse `{id,seq,at,date,kind,basis?,newStopAt?,text?,nextStep?,anchor?}`; `kind`:
`pc-rest`, `pc-resumed`, `extended`, `suspended-today`, `resumed-today`,
`shutdown-started`, `shutdown-blocked`, `save-point`, `thought`, `unpaired`.
`basis`: `anker-shutdown`, `user-shutdown`, `sleep`, `lock`, `logoff`, `idle`.
Ein `extended`-Ereignis der Bettzeit-Sequenz trägt `anchor:"bed"`, damit das Handy
die echte neue Bettgrenze übernimmt, ohne seinen alten Bildschirm-aus-Puffer
nochmals hinzuzurechnen. Normale PC-Verlängerungen behalten die bisherige Form
ohne Anker; ein explizites `anchor:"pc-stop"` ist ebenfalls zulässig.
Outbox dauerhaft, mindestens einmal zugestellt; Handy speichert Wirkung und Receipt
atomar, erst dann den Cursor. Kein Ereignis erledigt eigenständig eine Routine.

## Windows-Wirkungen und Wiederanlauf

Nur eigene ausdrückliche Aktivierung + gültiger authentifizierter Tagesauftrag
erlauben Systemwirkungen. Alte Aufgabe „Anker PC-Stopp“ blockiert neue Wirkung.
WLAN-Ausfall läuft in einen endlichen bestätigten Zustand, nicht in neue erfundene
Termine. Nach Neustart, Aufwachen oder Uhr-Rückstellung beginnt die Schonfrist neu.
60 Sekunden eigener Speicher-Countdown vor Lock/Hibernate; Shutdown ausschließlich
`shutdown /s /t 0` nach eigenem Countdown, niemals `/f` oder `/t 30`.
Testabend: zwei Minuten, keine Systemwirkung. Standardmodus hat +15/+30 und
„Heute ohne PC-Stopp“. Strenger Modus ist eigens bestätigt, bleibt beendbar und
überwacht alle zehn Sekunden nur die Sitzung, keine Programme/Fenster/Tastaturen.
Bei beiderseitig aktiviertem strengem Modus beginnt ein gültiger Handy-Nachtauftrag
an seiner zugesagten Stoppzeit auch dann, wenn der NFC-/QR-Abschluss am Handy noch
aussteht. Gewöhnliche neue Zustände oder geänderte Einstellungen heben diese
begrenzte Nachtfreigabe nicht auf; dafür dienen echter Morgenabschluss oder
signierte Hardware-Notverlängerung.
Eine ausschließlich am PC-Zeitpunkt aktivierte Nacht ist intern `scheduledNight`.
Ohne Handy-Bett-Override wechselt dessen Standard-ID nach 04:00 von
`day:<Abenddatum>` zu `day:<Weckdatum>`. Nur ein authentifiziertes echtes
`MORNING_COMPLETED` desselben Pair, exakt mit dieser neuen ID, diesem Berliner
Plantag und einem `wakeAt` desselben Kalendertags löst die zugehörige Auto-Nacht.
Andere Tage, Paare und Session-IDs lösen sie nicht. Ein danach bestätigter
Hardware-Bett-Override derselben Nacht übernimmt nur die echte `night:…`-Identität;
Frist, Freigaben und ursprüngliche Zeitpunkte werden nicht verlängert. Danach
gilt wieder ausschließlich dieselbe Hardware-Nacht-ID. Signierte Notverlängerungen
können dieselbe eng begrenzte Zuordnung nutzen; der PC signiert keine Tokens.
