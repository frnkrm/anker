package de.frnkrm.anker

import android.content.Context
import android.content.Intent
import android.os.Build
import okhttp3.Dns
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.security.MessageDigest
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

/**
 * One native owner for connection keys, durable directional counters and received events.
 * Calls that perform I/O must run on the plugin's background executor, never on the UI thread.
 */
object PcBridgeClient {
    private val monitor = Any()
    private var socket: WebSocket? = null
    private var connected = false
    private var connecting = false
    private var generation = 0L
    private var attempts = 0
    private var reconnectAt = 0L
    private var lastPullAt = 0L
    private var awaitingEvents = false
    private var lastError = ""
    private val phaseNames = setOf("DAY_ACTIVE", "IDLE", "MORNING_PENDING", "MORNING_ACTIVE", "MORNING_COMPLETED", "ALARM_RINGING", "EVENING_WIND_DOWN", "WIND_DOWN_T30", "BRAIN_DUMP_T10", "BEDTIME_HARD_CUT", "NIGHT_LOCK", "ZOMBIE_MODE")
    private val eventKinds = setOf("pc-rest", "pc-resumed", "extended", "suspended-today", "resumed-today", "shutdown-started", "shutdown-blocked", "save-point", "thought", "unpaired")
    private val modes = setOf("scheduled", "paused", "suspended-today", "legacy-conflict", "locked", "released")

    fun discover(ctx: Context, timeoutMs: Long): JSONObject = PcBridgeDiscovery.discover(ctx, timeoutMs)

    fun configure(ctx: Context, qrHash: String?, autoReconnect: Boolean?): JSONObject = synchronized(monitor) {
        val vault = PcBridgeVault(ctx); val data = vault.read()
        if (qrHash != null) {
            require(qrHash.isEmpty() || PcLinkModel.validPin(qrHash)) { "PC_QR_HASH_INVALID" }
            data.put("qrHash", qrHash.lowercase())
        }
        if (autoReconnect != null) data.put("autoReconnect", autoReconnect)
        vault.write(data)
        stateLocked(data)
    }

    fun pair(ctx: Context, qr: String, deviceName: String): JSONObject = synchronized(monitor) {
        require(qr.startsWith("anker-pc-pair:v3:") && qr.length <= 8_192) { "PC_QR_INVALID" }
        val encoded = qr.removePrefix("anker-pc-pair:v3:")
        val payload = try { JSONObject(String(PcLinkModel.decoded(encoded), Charsets.UTF_8)) } catch (_: Exception) { throw IllegalArgumentException("PC_QR_INVALID") }
        exact(payload, setOf("t", "v", "id", "n", "k", "c", "s", "a", "e"))
        require(payload.getString("t") == "anker-pc-pair" && whole(payload, "v") == 3L) { "PC_PROTOCOL_UNSUPPORTED" }
        val id = payload.getString("id"); require(PcLinkModel.validIdentifier(id)) { "PC_QR_INVALID" }
        val name = boundedText(payload.getString("n"), 100)
        val expires = PcLinkModel.timestamp(payload.getString("e"))
        require(PcLinkModel.validPairExpiry(expires, System.currentTimeMillis())) { "PC_PAIR_EXPIRED" }
        val peer = PcLinkModel.decoded(payload.getString("k"), 65)
        PcBridgeCrypto.decodePublic(peer)
        val salt = PcLinkModel.decoded(payload.getString("s"), 32)
        val pin = PcLinkModel.normalisePin(payload.getString("c"))
        val addresses = payload.getJSONArray("a"); require(addresses.length() in 1..8) { "PC_QR_INVALID" }
        val endpoints = (0 until addresses.length()).map { PcLinkModel.endpoint(addresses.getString(it)) }
        val vault = PcBridgeVault(ctx)
        val before = vault.read()
        require(before.optString("pairStatus") !in setOf("pending", "paired")) { "PC_ALREADY_PAIRED" }
        val ephemeral = PcBridgeCrypto.generateEphemeral()
        val public = PcBridgeCrypto.publicSec1(ephemeral.public)
        val phonePublic = PcLinkModel.encoded(public)
        val signingPublic = PcLinkModel.encoded(vault.emergencyPublic(id))
        val proof = PcLinkModel.encoded(PcBridgeCrypto.hmac(salt, "pair|$id|$phonePublic|$signingPublic".toByteArray(Charsets.UTF_8)))
        val keys = PcBridgeCrypto.derive(ephemeral.private, peer, salt)
        salt.fill(0)
        val post = JSONObject().put("id", id).put("n", boundedText(deviceName.ifBlank { "Anker Handy" }, 100))
            .put("k", phonePublic).put("signingKey", signingPublic).put("proof", proof)
        var selected: PcLinkModel.Endpoint? = null
        var response: JSONObject? = null
        for (endpoint in endpoints) {
            try { response = request(endpoint, pin, "/v3/pair", post); selected = endpoint; break }
            catch (error: Exception) { lastError = errorCode(error) }
        }
        if (selected == null || response == null) { keys.phoneToPc.fill(0); keys.pcToPhone.fill(0); throw IllegalStateException(lastError.ifEmpty { "PC_UNREACHABLE" }) }
        exact(response, setOf("status", "id", "code"))
        val code = PcBridgeCrypto.confirmationCode(peer, public)
        require(response.getString("id") == id && response.getString("status") == "pending" && response.getString("code") == code) { "PC_PAIR_REJECTED" }
        closeSocket()
        val data = JSONObject().put("pairId", id).put("pcName", name).put("pin", pin)
            .put("addresses", JSONArray(endpoints.map { it.authority() })).put("endpoint", selected.authority())
            .put("pairExpiresAt", expires).put("pairStatus", "pending").put("code", code)
            .put("phoneKey", PcLinkModel.encoded(keys.phoneToPc)).put("pcKey", PcLinkModel.encoded(keys.pcToPhone))
            .put("seqOut", 0L).put("seqIn", 0L).put("events", JSONArray()).put("lastEventSeq", 0L)
            .put("active", true).put("autoReconnect", true).put("qrHash", before.optString("qrHash"))
        keys.phoneToPc.fill(0); keys.pcToPhone.fill(0)
        vault.write(data)
        startService(ctx)
        stateLocked(data)
    }

    fun state(ctx: Context): JSONObject = synchronized(monitor) {
        try { stateLocked(PcBridgeVault(ctx).read()) }
        catch (error: Exception) { JSONObject().put("state", "unreachable").put("connected", false).put("active", false).put("error", errorCode(error)) }
    }

    fun start(ctx: Context): JSONObject = synchronized(monitor) {
        val vault = PcBridgeVault(ctx); val data = vault.read()
        check(data.optString("pairStatus") in setOf("pending", "paired")) { "PC_NOT_PAIRED" }
        data.put("active", true).put("autoReconnect", true)
        vault.write(data)
        reconnectAt = 0; attempts = 0
        startService(ctx)
        stateLocked(data)
    }

    fun stop(ctx: Context): JSONObject = synchronized(monitor) {
        try {
            val vault = PcBridgeVault(ctx); val data = vault.read()
            data.put("active", false).put("autoReconnect", false)
            vault.write(data)
            closeSocket()
            stateLocked(data)
        } finally {
            closeSocket()
            ctx.stopService(Intent(ctx, PcBridgeService::class.java))
        }
    }

    fun send(ctx: Context, payload: JSONObject): JSONObject = synchronized(monitor) {
        validateOutgoing(payload)
        require(payload.optString("action") != "EMERGENCY_EXTENSION") { "PC_HARDWARE_REQUIRED" }
        val vault = PcBridgeVault(ctx); val data = vault.read()
        check(data.optString("pairStatus") == "paired") { "PC_NOT_PAIRED" }
        val type = payload.getString("type")
        if (type == "state" || type == "briefing") {
            data.put(if (type == "state") "latestState" else "latestBriefing", copy(payload))
            vault.write(data)
        }
        val pending = data.optJSONArray("events") ?: JSONArray()
        val blocked = pending.length() > 0 || awaitingEvents
        val sent = connected && !blocked && transmit(ctx, data, payload)
        JSONObject().put("sent", sent).put("queued", !sent && type in setOf("state", "briefing"))
    }

    fun drainEvents(ctx: Context): JSONObject = synchronized(monitor) {
        val data = PcBridgeVault(ctx).read()
        val output = JSONArray()
        val pending = data.optJSONArray("events") ?: JSONArray()
        for (index in 0 until pending.length()) {
            val item = pending.getJSONObject(index)
            if (!item.optBoolean("__acked")) output.put(copy(item).apply { remove("__acked") })
        }
        JSONObject().put("events", output).put("lastSeq", data.optLong("lastEventSeq"))
    }

    fun ackEvents(ctx: Context, ids: List<String>): JSONObject = synchronized(monitor) {
        require(ids.size <= 1_000 && ids.all(PcLinkModel::validIdentifier)) { "PC_EVENT_IDS_INVALID" }
        val vault = PcBridgeVault(ctx); val data = vault.read()
        val pending = data.optJSONArray("events") ?: JSONArray()
        val chosen = ids.toSet()
        for (index in 0 until pending.length()) if (pending.getJSONObject(index).optString("id") in chosen) pending.getJSONObject(index).put("__acked", true)
        var cursor = data.optLong("lastEventSeq")
        while (pending.length() > 0 && pending.getJSONObject(0).optBoolean("__acked")) {
            cursor = maxOf(cursor, pending.getJSONObject(0).getLong("seq")); pending.remove(0)
        }
        data.put("events", pending).put("lastEventSeq", cursor)
        vault.write(data)
        // Never transmit an old state from this acknowledgement. The app persists
        // the event first and supplies a newly derived state afterwards.
        JSONObject().put("lastSeq", cursor)
    }

    fun unpair(ctx: Context): JSONObject = synchronized(monitor) {
        val vault = PcBridgeVault(ctx)
        // Explicit revocation also works if a previous Android key became invalid.
        val data = try { vault.read() } catch (_: Exception) { JSONObject() }
        if (connected && data.optString("pairStatus") == "paired") {
            try { transmit(ctx, data, JSONObject().put("type", "command").put("id", UUID.randomUUID().toString()).put("action", "unpair")) } catch (_: Exception) { /* local revocation does not depend on LAN */ }
        }
        closeSocket(); vault.clear()
        ctx.stopService(Intent(ctx, PcBridgeService::class.java))
        JSONObject().put("state", "unpaired").put("connected", false).put("active", false)
    }

    fun emergency(ctx: Context, qr: String, minutes: Int): JSONObject = synchronized(monitor) {
        require(qr.length in 1..4_096 && minutes in 1..120) { "PC_EMERGENCY_INVALID" }
        val vault = PcBridgeVault(ctx); val data = vault.read()
        check(data.optString("pairStatus") == "paired" && connected) { "PC_UNREACHABLE" }
        val storedHash = data.optString("qrHash")
        val suppliedHash = PcLinkModel.hex(PcBridgeCrypto.sha256(qr.toByteArray(Charsets.UTF_8)))
        check(storedHash.length == 64 && MessageDigest.isEqual(storedHash.toByteArray(), suppliedHash.toByteArray())) { "PC_HARDWARE_REQUIRED" }
        val current = data.optJSONObject("latestState") ?: throw IllegalStateException("PC_NO_CURRENT_STATE")
        val now = System.currentTimeMillis()
        val validUntil = PcLinkModel.timestamp(current.getString("validUntil"))
        val schedule = current.getJSONObject("schedule")
        val deadline = if (schedule.isNull("morningDeadlineAt")) null else PcLinkModel.timestamp(schedule.getString("morningDeadlineAt"))
        val preferences = current.getJSONObject("prefs")
        val targetKey = if (preferences.optBoolean("bedtimeSequence")) "bedAt" else if (schedule.has("pcStopAt")) "pcStopAt" else "bedAt"
        val target = if (schedule.isNull(targetKey)) null else PcLinkModel.timestamp(schedule.getString(targetKey))
        val acknowledgement = data.optJSONObject("ack")?.let { ack ->
            runCatching {
                val effective = ack.getJSONObject("effective")
                val warnings = ack.getJSONArray("warnings")
                PcLinkModel.EmergencyAcknowledgement(
                    revision = ack.getString("revision"), date = effective.getString("date"), mode = effective.getString("mode"),
                    receivedAt = PcLinkModel.timestamp(ack.getString("receivedAt")),
                    localReceivedAt = data.optLong("lastReceivedAt").takeIf { it > 0 },
                    stopAt = if (effective.has("stopAt")) PcLinkModel.timestamp(effective.getString("stopAt")) else null,
                    warnings = (0 until warnings.length()).map { warnings.getString(it) }.toSet(),
                )
            }.getOrNull()
        }
        val night = PcLinkModel.EmergencyState(
            revision = current.getString("revision"), date = current.getString("date"),
            generatedAt = PcLinkModel.timestamp(current.getString("generatedAt")), validUntil = validUntil,
            morningDeadlineAt = deadline, targetAt = target, lockEnforced = current.optBoolean("lockEnforced"),
            strictEnabled = preferences.optBoolean("strictLock"), enforcementEnabled = preferences.optBoolean("enforceEnabled"),
        )
        check(PcLinkModel.emergencyNightConfirmed(night, acknowledgement, now)) { "PC_NIGHT_NOT_CONFIRMED" }
        val until = PcLinkModel.emergencyUntil(now, minutes, validUntil, deadline)
        val token = JSONObject().put("v", 3).put("pair", data.getString("pairId"))
            .put("sessionId", current.getString("sessionId")).put("date", current.getString("date"))
            .put("issuedAt", Instant.ofEpochMilli(now).toString()).put("expiresAt", Instant.ofEpochMilli(minOf(now + 5 * 60_000L, until)).toString())
            .put("until", Instant.ofEpochMilli(until).toString()).put("nonce", PcLinkModel.encoded(PcBridgeCrypto.random(16)))
        token.put("signature", PcLinkModel.encoded(PcBridgeCrypto.sign(vault.emergencyKey(data.getString("pairId")), canonicalToken(token))))
        val id = UUID.randomUUID().toString()
        data.put("pendingEmergency", JSONObject().put("commandId", id).put("until", until).put("sessionId", current.getString("sessionId")))
        vault.write(data)
        val command = JSONObject().put("type", "command").put("id", id).put("action", "EMERGENCY_EXTENSION").put("token", token)
        check(transmit(ctx, data, command)) { "PC_UNREACHABLE" }
        JSONObject().put("until", until).put("tokenId", id).put("sent", true)
    }

    fun wakeOnLan(mac: String, broadcast: String): JSONObject {
        val digits = mac.replace(":", "").replace("-", "")
        require(digits.matches(Regex("[a-fA-F0-9]{12}"))) { "PC_MAC_INVALID" }
        val destination = try { InetAddress.getByName(broadcast) } catch (_: Exception) { throw IllegalArgumentException("PC_ADDRESS_INVALID") }
        require(destination.address.size == 4 && (broadcast == "255.255.255.255" || PcLinkModel.privateAddress(destination))) { "PC_ADDRESS_NOT_LOCAL" }
        val bytes = ByteArray(6) { digits.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
        val magic = ByteArray(102) { if (it < 6) 0xff.toByte() else bytes[(it - 6) % 6] }
        DatagramSocket().use { socket -> socket.broadcast = true; socket.send(DatagramPacket(magic, magic.size, destination, 9)) }
        return JSONObject().put("sent", true)
    }

    /** Service-owned worker tick; this does not calculate a second daily plan. */
    internal fun tick(ctx: Context) = synchronized(monitor) {
        val vault = PcBridgeVault(ctx); val data = vault.read()
        if (!data.optBoolean("active")) return@synchronized
        if (data.optString("pairStatus") == "pending") { pollPair(ctx, data); return@synchronized }
        if (data.optString("pairStatus") != "paired") return@synchronized
        val now = System.currentTimeMillis()
        if (!connected && !connecting && now >= reconnectAt) {
            rotateEndpoint(ctx, data)
            connect(ctx, data)
        }
        if (connected && now - lastPullAt >= 15_000) {
            lastPullAt = now; awaitingEvents = true
            transmit(ctx, data, JSONObject().put("type", "pull").put("after", data.optLong("lastEventSeq")))
        }
    }

    internal fun serviceDestroyed() = synchronized(monitor) { closeSocket() }
    internal fun serviceFailed(ctx: Context, code: String) = synchronized(monitor) {
        lastError = code
        try { val vault = PcBridgeVault(ctx); val data = vault.read(); data.put("active", false); vault.write(data) } catch (_: Exception) { /* unavailable storage never becomes success */ }
        closeSocket()
    }

    private fun pollPair(ctx: Context, data: JSONObject) {
        if (System.currentTimeMillis() >= data.optLong("pairExpiresAt")) {
            data.put("pairStatus", "expired").put("active", false); PcBridgeVault(ctx).write(data); lastError = "PC_PAIR_EXPIRED"; return
        }
        try {
            val result = request(PcLinkModel.endpoint(data.getString("endpoint")), data.getString("pin"), "/v3/pair/${data.getString("pairId")}")
            exact(result, setOf("status", "id"))
            require(result.getString("id") == data.getString("pairId")) { "PC_PAIR_REJECTED" }
            when (result.getString("status")) {
                "paired" -> { data.put("pairStatus", "paired"); data.remove("code"); PcBridgeVault(ctx).write(data); reconnectAt = 0; lastError = "" }
                "rejected", "expired" -> { data.put("pairStatus", result.getString("status")).put("active", false); PcBridgeVault(ctx).write(data); lastError = "PC_PAIR_REJECTED" }
                "pending" -> Unit
                else -> throw IllegalArgumentException("PC_PROTOCOL_UNSUPPORTED")
            }
        } catch (error: Exception) { lastError = errorCode(error) }
    }

    private fun connect(ctx: Context, data: JSONObject) {
        val endpoint = PcLinkModel.endpoint(data.getString("endpoint"))
        val pair = data.getString("pairId")
        val selectedGeneration = ++generation
        connecting = true
        try {
            val client = httpClient(data.getString("pin")).newBuilder().readTimeout(0, TimeUnit.MILLISECONDS).pingInterval(25, TimeUnit.SECONDS).build()
            val request = Request.Builder().url(endpoint.wss("/v3/ws?pair=$pair")).build()
            socket = client.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) = synchronized(monitor) {
                    if (selectedGeneration != generation) { webSocket.close(1000, "superseded"); return@synchronized }
                    connecting = false; connected = true; attempts = 0; lastError = ""; lastPullAt = System.currentTimeMillis(); awaitingEvents = true
                    val current = PcBridgeVault(ctx).read()
                    transmit(ctx, current, JSONObject().put("type", "pull").put("after", current.optLong("lastEventSeq")))
                }
                override fun onMessage(webSocket: WebSocket, text: String) = synchronized(monitor) {
                    if (selectedGeneration != generation) return@synchronized
                    try { receive(ctx, text) }
                    catch (error: Exception) { lastError = errorCode(error); webSocket.close(1008, "invalid-message") }
                }
                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = disconnected(selectedGeneration, t)
                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = disconnected(selectedGeneration, null)
                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, null) }
            })
        } catch (error: Exception) { disconnected(selectedGeneration, error) }
    }

    private fun rotateEndpoint(ctx: Context, data: JSONObject) {
        if (attempts == 0) return
        val known = data.optJSONArray("addresses") ?: JSONArray().put(data.getString("endpoint"))
        if (attempts >= known.length() && attempts % maxOf(known.length(), 1) == 0) {
            // A DHCP change may invalidate all QR addresses. NSD supplies candidates
            // only: the old certificate pin still authenticates every connection.
            try {
                val devices = discover(ctx, 1_500).getJSONArray("devices")
                val candidates = (0 until devices.length()).map { devices.getJSONObject(it) }
                    .sortedBy { if (it.optString("name") == data.optString("pcName")) 0 else 1 }
                val existing = (0 until known.length()).map(known::getString).toMutableSet()
                for (candidate in candidates) {
                    val endpoint = PcLinkModel.Endpoint(candidate.getString("host"), candidate.getInt("port"))
                    if (known.length() < 12 && existing.add(endpoint.authority())) known.put(endpoint.authority())
                }
            } catch (_: Exception) { /* bounded retry remains available without discovery */ }
        }
        if (known.length() > 0) data.put("endpoint", known.getString(attempts % known.length()))
        data.put("addresses", known)
        PcBridgeVault(ctx).write(data)
    }

    private fun disconnected(selectedGeneration: Long, error: Throwable?) = synchronized(monitor) {
        if (selectedGeneration != generation) return@synchronized
        connected = false; connecting = false; socket = null; awaitingEvents = false
        if (error != null) lastError = errorCode(error)
        reconnectAt = System.currentTimeMillis() + PcLinkModel.retryDelayMs(attempts++)
    }

    private fun transmit(ctx: Context, data: JSONObject, payload: JSONObject): Boolean {
        val currentSocket = socket ?: return false
        val seq = data.optLong("seqOut") + 1
        check(PcLinkModel.validSequence(seq)) { "PC_SEQUENCE_EXHAUSTED" }
        data.put("seqOut", seq)
        PcBridgeVault(ctx).write(data) // Reserve before encrypt/send; gaps survive crashes safely.
        val header = PcBridgeCrypto.Header(data.getString("pairId"), "phone", seq, Instant.now().toString())
        val nonce = PcBridgeCrypto.random(12)
        val encrypted = PcBridgeCrypto.seal(PcLinkModel.decoded(data.getString("phoneKey"), 32), nonce, header, payload.toString().toByteArray(Charsets.UTF_8))
        val envelope = JSONObject().put("v", 3).put("kind", "anker-link").put("pair", header.pair).put("from", "phone")
            .put("seq", seq).put("sentAt", header.sentAt).put("nonce", PcLinkModel.encoded(nonce)).put("ct", PcLinkModel.encoded(encrypted)).toString()
        require(envelope.toByteArray(Charsets.UTF_8).size <= PcLinkModel.MAX_MESSAGE_BYTES) { "PC_MESSAGE_TOO_LARGE" }
        return currentSocket.send(envelope)
    }

    private fun receive(ctx: Context, raw: String) {
        require(raw.toByteArray(Charsets.UTF_8).size <= PcLinkModel.MAX_MESSAGE_BYTES) { "PC_MESSAGE_TOO_LARGE" }
        val envelope = JSONObject(raw)
        exact(envelope, setOf("v", "kind", "pair", "from", "seq", "sentAt", "nonce", "ct"))
        val vault = PcBridgeVault(ctx); val data = vault.read()
        require(whole(envelope, "v") == 3L && envelope.getString("kind") == "anker-link" && envelope.getString("from") == "pc" && envelope.getString("pair") == data.getString("pairId")) { "PC_ENVELOPE_INVALID" }
        val seq = whole(envelope, "seq")
        require(PcLinkModel.acceptSequence(data.optLong("seqIn"), seq)) { "PC_REPLAY_REJECTED" }
        val sentAt = envelope.getString("sentAt"); PcLinkModel.timestamp(sentAt)
        val header = PcBridgeCrypto.Header(data.getString("pairId"), "pc", seq, sentAt)
        val plaintext = PcBridgeCrypto.open(PcLinkModel.decoded(data.getString("pcKey"), 32), PcLinkModel.decoded(envelope.getString("nonce"), 12), header, PcLinkModel.decoded(envelope.getString("ct")))
        val payload = JSONObject(String(plaintext, Charsets.UTF_8)); plaintext.fill(0)
        when (payload.getString("type")) {
            "ack" -> {
                exact(payload, setOf("type", "revision", "receivedAt", "effective", "companion", "warnings"), setOf("commandId", "emergencyUntil"))
                boundedText(payload.getString("revision"), 128); PcLinkModel.timestamp(payload.getString("receivedAt"))
                val effective = payload.getJSONObject("effective"); exact(effective, setOf("date", "mode"), setOf("stopAt"))
                LocalDate.parse(effective.getString("date")); require(effective.getString("mode") in modes) { "PC_PAYLOAD_INVALID" }
                optionalTimestamp(effective, "stopAt")
                val companion = payload.getJSONObject("companion"); exact(companion, setOf("version", "protocol"))
                if (whole(companion, "protocol") != 3L) { lastError = "PC_PROTOCOL_UNSUPPORTED"; throw IllegalArgumentException("PC_PROTOCOL_UNSUPPORTED") }
                val warnings = payload.getJSONArray("warnings"); require(warnings.length() <= 20) { "PC_PAYLOAD_INVALID" }
                for (i in 0 until warnings.length()) require(warnings.getString(i).matches(Regex("[a-z0-9-]{1,80}"))) { "PC_PAYLOAD_INVALID" }
                data.put("ack", copy(payload)).put("lastReceivedAt", System.currentTimeMillis())
                if (payload.has("commandId")) require(PcLinkModel.validIdentifier(payload.getString("commandId"))) { "PC_PAYLOAD_INVALID" }
                if (payload.has("emergencyUntil")) {
                    require(payload.has("commandId")) { "PC_PAYLOAD_INVALID" }
                    val until = PcLinkModel.timestamp(payload.getString("emergencyUntil"))
                    val pending = data.optJSONObject("pendingEmergency")
                    val state = data.optJSONObject("latestState")
                    if (pending != null && state != null && pending.optString("commandId") == payload.getString("commandId")
                        && pending.optLong("until") == until && pending.optString("sessionId") == state.optString("sessionId")
                        && until > System.currentTimeMillis() && until <= PcLinkModel.timestamp(state.getString("validUntil"))) {
                        data.put("emergencyAck", JSONObject().put("commandId", payload.getString("commandId"))
                            .put("until", until).put("receivedAt", System.currentTimeMillis()))
                        data.remove("pendingEmergency")
                    }
                }
            }
            "events" -> {
                exact(payload, setOf("type", "items", "lastSeq"))
                val items = payload.getJSONArray("items"); require(items.length() <= 500 && whole(payload, "lastSeq") in 0..PcLinkModel.MAX_SAFE_SEQUENCE) { "PC_PAYLOAD_INVALID" }
                val pending = data.optJSONArray("events") ?: JSONArray()
                val ids = (0 until pending.length()).map { pending.getJSONObject(it).getString("id") }.toMutableSet()
                var previous = data.optLong("lastEventSeq")
                for (i in 0 until items.length()) {
                    val item = items.getJSONObject(i); validateEvent(item)
                    require(item.getLong("seq") > previous && item.getLong("seq") <= payload.getLong("lastSeq")) { "PC_EVENT_INVALID" }
                    previous = item.getLong("seq")
                    if (ids.add(item.getString("id")) && item.getLong("seq") > data.optLong("lastEventSeq")) pending.put(copy(item))
                }
                require(pending.length() <= 1_000) { "PC_EVENT_QUEUE_FULL" }
                data.put("events", pending).put("lastReceivedAt", System.currentTimeMillis())
                awaitingEvents = false
            }
            else -> throw IllegalArgumentException("PC_PAYLOAD_INVALID")
        }
        data.put("seqIn", seq)
        vault.write(data) // Receipt and native outbox are one encrypted durable commit.
        if ((data.optJSONArray("events") ?: JSONArray()).let { events -> (0 until events.length()).any { events.getJSONObject(it).optString("kind") == "unpaired" } }) {
            // Keep the durable receipt available to JS, but revoke native capabilities now.
            vault.deleteEmergencyKey(data.getString("pairId"))
            for (key in setOf("phoneKey", "pcKey", "latestState", "latestBriefing", "pendingEmergency", "emergencyAck", "pin", "addresses", "endpoint")) data.remove(key)
            data.put("pairStatus", "revoked").put("active", false).put("autoReconnect", false)
            vault.write(data)
            closeSocket()
            return
        }
        if (payload.getString("type") == "events" && (data.optJSONArray("events")?.length() ?: 0) == 0) {
            data.optJSONObject("latestBriefing")?.takeIf { fresh(it) }?.let { transmit(ctx, data, it) }
            data.optJSONObject("latestState")?.takeIf { fresh(it) }?.let { transmit(ctx, data, it) }
        }
    }

    private fun fresh(value: JSONObject): Boolean = try { PcLinkModel.timestamp(value.getString("validUntil")) > System.currentTimeMillis() } catch (_: Exception) { false }

    private fun validateOutgoing(payload: JSONObject) {
        require(payload.toString().toByteArray(Charsets.UTF_8).size <= 46_000) { "PC_MESSAGE_TOO_LARGE" }
        when (payload.getString("type")) {
            "state" -> {
                exact(payload, setOf("type", "state", "sessionId", "revision", "date", "generatedAt", "validUntil", "remainingSeconds", "routineStep", "lockEnforced", "schedule", "prefs"), setOf("brainDump"))
                require(payload.getString("state") in phaseNames && PcLinkModel.validIdentifier(payload.getString("sessionId"))) { "PC_PAYLOAD_INVALID" }
                LocalDate.parse(payload.getString("date")); boundedText(payload.getString("revision"), 128)
                require(payload.get("lockEnforced") is Boolean && whole(payload, "remainingSeconds") in 0..64_800) { "PC_PAYLOAD_INVALID" }
                require(PcLinkModel.validLease(PcLinkModel.timestamp(payload.getString("generatedAt")), PcLinkModel.timestamp(payload.getString("validUntil")))) { "PC_LEASE_INVALID" }
                if (!payload.isNull("routineStep")) {
                    val step = payload.getJSONObject("routineStep"); exact(step, setOf("index", "total"))
                    require(whole(step, "total") in 1..200 && whole(step, "index") in 0..whole(step, "total")) { "PC_PAYLOAD_INVALID" }
                }
                val schedule = payload.getJSONObject("schedule")
                exact(schedule, setOf("windDownAt", "brainDumpAt", "bedAt", "wakeAt", "morningDeadlineAt"), setOf("pcStopAt", "leaveAt", "workStartAt", "homeOffice"))
                for (key in setOf("windDownAt", "brainDumpAt", "bedAt", "wakeAt", "morningDeadlineAt", "pcStopAt", "leaveAt", "workStartAt")) optionalTimestamp(schedule, key)
                if (schedule.has("homeOffice")) require(schedule.get("homeOffice") is Boolean) { "PC_PAYLOAD_INVALID" }
                validatePreferences(payload.getJSONObject("prefs"))
                if (payload.has("brainDump")) {
                    require(payload.getJSONObject("prefs").getBoolean("shareBrainDump")) { "PC_PRIVATE_CONTENT_REJECTED" }
                    val note = payload.getJSONObject("brainDump"); exact(note, setOf("text"), setOf("nextStep"))
                    boundedText(note.getString("text"), 500)
                    if (note.has("nextStep")) boundedText(note.getString("nextStep"), 500)
                }
            }
            "briefing" -> {
                exact(payload, setOf("type", "revision", "generatedAt", "validUntil", "days", "prefs"))
                boundedText(payload.getString("revision"), 128); PcLinkModel.timestamp(payload.getString("generatedAt")); PcLinkModel.timestamp(payload.getString("validUntil"))
                val days = payload.getJSONArray("days"); require(days.length() in 1..14) { "PC_PAYLOAD_INVALID" }
                validatePreferences(payload.getJSONObject("prefs"))
                for (i in 0 until days.length()) {
                    val day = days.getJSONObject(i)
                    exact(day, setOf("date", "validUntil", "pc"), setOf("bedAt", "wakeAt", "windDownAt", "brainDumpAt", "morningDeadlineAt", "morning"))
                    LocalDate.parse(day.getString("date")); PcLinkModel.timestamp(day.getString("validUntil"))
                    val pc = day.getJSONObject("pc"); exact(pc, setOf("mode"), setOf("stopAt", "localTime"))
                    require(pc.getString("mode") in setOf("scheduled", "paused")) { "PC_PAYLOAD_INVALID" }
                    if (pc.getString("mode") == "scheduled") {
                        PcLinkModel.timestamp(pc.getString("stopAt"))
                        require(pc.getString("localTime").matches(Regex("(?:[01][0-9]|2[0-3]):[0-5][0-9]"))) { "PC_PAYLOAD_INVALID" }
                    } else require(pc.length() == 1) { "PC_PAYLOAD_INVALID" }
                    for (key in setOf("bedAt", "wakeAt", "windDownAt", "brainDumpAt", "morningDeadlineAt")) optionalTimestamp(day, key)
                    if (day.has("morning")) {
                        val morning = day.getJSONObject("morning"); exact(morning, setOf("homeOffice"), setOf("leaveAt", "workStartAt"))
                        require(morning.get("homeOffice") is Boolean) { "PC_PAYLOAD_INVALID" }; optionalTimestamp(morning, "leaveAt"); optionalTimestamp(morning, "workStartAt")
                    }
                }
            }
            "pull" -> { exact(payload, setOf("type", "after")); require(whole(payload, "after") in 0..PcLinkModel.MAX_SAFE_SEQUENCE) { "PC_PAYLOAD_INVALID" } }
            "command" -> {
                exact(payload, setOf("type", "id", "action"), setOf("minutes", "token"))
                require(PcLinkModel.validIdentifier(payload.getString("id")) && payload.getString("action") in setOf("ping", "unpair", "test-evening", "resume-today", "suspend-today", "extend", "EMERGENCY_EXTENSION")) { "PC_PAYLOAD_INVALID" }
                if (payload.has("minutes")) require(whole(payload, "minutes") in 1..1_440) { "PC_PAYLOAD_INVALID" }
            }
            else -> throw IllegalArgumentException("PC_PAYLOAD_INVALID")
        }
    }

    private fun validatePreferences(value: JSONObject) {
        exact(value, setOf("enforceEnabled", "strictLock", "dimEnabled", "dimMax", "audioDuck", "shareBrainDump", "morningCountdown", "offlinePolicy", "stopAction", "graceSeconds"), setOf("ifThen", "bedtimeSequence"))
        if (value.has("bedtimeSequence")) require(value.get("bedtimeSequence") is Boolean) { "PC_PAYLOAD_INVALID" }
        for (key in setOf("enforceEnabled", "strictLock", "dimEnabled", "audioDuck", "shareBrainDump", "morningCountdown")) require(value.get(key) is Boolean) { "PC_PAYLOAD_INVALID" }
        require(value.get("dimMax") is Number && value.getDouble("dimMax") in 0.0..0.4 && whole(value, "graceSeconds") in 60..600
            && value.getString("offlinePolicy") in setOf("pause", "fixed-time") && value.getString("stopAction") in setOf("lock", "hibernate", "shutdown")) { "PC_PAYLOAD_INVALID" }
        if (value.has("ifThen")) boundedText(value.getString("ifThen"), 500)
    }

    private fun validateEvent(value: JSONObject) {
        exact(value, setOf("id", "seq", "at", "date", "kind"), setOf("basis", "newStopAt", "text", "nextStep", "anchor"))
        require(PcLinkModel.validIdentifier(value.getString("id")) && PcLinkModel.validSequence(whole(value, "seq")) && value.getString("kind") in eventKinds) { "PC_EVENT_INVALID" }
        LocalDate.parse(value.getString("date")); PcLinkModel.timestamp(value.getString("at")); optionalTimestamp(value, "newStopAt")
        for (key in setOf("text", "nextStep")) if (value.has(key)) boundedText(value.getString(key), 500)
        if (value.has("anchor")) require(value.getString("kind") == "extended" && value.get("anchor") is String && value.getString("anchor") in setOf("bed", "pc-stop")) { "PC_EVENT_INVALID" }
        if (value.has("basis")) require(value.getString("basis") in setOf("anker-shutdown", "user-shutdown", "sleep", "lock", "logoff", "idle")) { "PC_EVENT_INVALID" }
    }

    private fun canonicalToken(value: JSONObject): ByteArray = value.keys().asSequence().filter { it != "signature" }.sorted().joinToString(",", "{", "}") { key ->
        PcBridgeCrypto.quote(key) + ":" + if (key == "v") "3" else PcBridgeCrypto.quote(value.getString(key))
    }.toByteArray(Charsets.UTF_8)

    private fun request(endpoint: PcLinkModel.Endpoint, pin: String, path: String, body: JSONObject? = null): JSONObject {
        require(path.matches(Regex("/(?:v3/(?:pair(?:/[A-Za-z0-9._:-]{1,160})?|link|hello)|health)"))) { "PC_PATH_INVALID" }
        val builder = Request.Builder().url(endpoint.https(path))
        if (body != null) builder.post(body.toString().toRequestBody("application/json".toMediaType()))
        httpClient(pin).newCall(builder.build()).execute().use { response ->
            check(response.isSuccessful) { if (response.code == 426) "PC_PROTOCOL_UNSUPPORTED" else "PC_REQUEST_REJECTED" }
            val stream = response.body?.byteStream() ?: throw IllegalStateException("PC_RESPONSE_INVALID")
            val output = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(4_096)
            while (output.size() <= PcLinkModel.MAX_MESSAGE_BYTES) {
                val read = stream.read(buffer, 0, minOf(buffer.size, PcLinkModel.MAX_MESSAGE_BYTES + 1 - output.size()))
                if (read < 0) break
                output.write(buffer, 0, read)
            }
            val bytes = output.toByteArray()
            require(bytes.size <= PcLinkModel.MAX_MESSAGE_BYTES) { "PC_MESSAGE_TOO_LARGE" }
            return JSONObject(String(bytes, Charsets.UTF_8))
        }
    }

    private fun httpClient(pin: String): OkHttpClient {
        val trustedPin = PcLinkModel.normalisePin(pin)
        val manager = object : X509TrustManager {
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) { throw CertificateException("PC_CLIENT_CERT_NOT_SUPPORTED") }
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                if (chain.isNullOrEmpty() || !PcLinkModel.matchesPin(trustedPin, chain[0].encoded)) throw CertificateException("PC_PIN_MISMATCH")
                chain[0].checkValidity()
            }
        }
        val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf(manager), null) }
        return OkHttpClient.Builder().sslSocketFactory(ssl.socketFactory, manager)
            .hostnameVerifier { _, session -> try { PcLinkModel.matchesPin(trustedPin, session.peerCertificates[0].encoded) } catch (_: Exception) { false } }
            .dns(object : Dns {
                override fun lookup(hostname: String): List<InetAddress> = InetAddress.getAllByName(hostname).toList().also { addresses ->
                    require(addresses.isNotEmpty() && addresses.all(PcLinkModel::privateAddress)) { "PC_ADDRESS_NOT_LOCAL" }
                }
            })
            .connectTimeout(3, TimeUnit.SECONDS).readTimeout(3, TimeUnit.SECONDS).callTimeout(5, TimeUnit.SECONDS)
            .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()
    }

    private fun startService(ctx: Context) {
        try {
            val intent = Intent(ctx, PcBridgeService::class.java).setAction(PcBridgeService.ACTION_START)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent) else ctx.startService(intent)
        } catch (_: Exception) { serviceFailed(ctx, "PC_FOREGROUND_NOT_ALLOWED"); throw IllegalStateException("PC_FOREGROUND_NOT_ALLOWED") }
    }

    private fun closeSocket() {
        generation++; socket?.close(1000, "stopped"); socket = null; connected = false; connecting = false; awaitingEvents = false
    }

    private fun stateLocked(data: JSONObject): JSONObject {
        val paired = data.optString("pairStatus")
        val state = when {
            paired.isEmpty() || paired == "revoked" -> "unpaired"
            paired == "pending" -> "pairing"
            paired in setOf("expired", "rejected") -> "rejected"
            lastError == "PC_PROTOCOL_UNSUPPORTED" -> "companion-outdated"
            connected -> "connected"
            lastError.isNotEmpty() -> "unreachable"
            else -> "paired-never-reached"
        }
        return JSONObject().put("state", state).put("connected", connected).put("active", PcBridgeService.hasForeground())
            .put("requestedActive", data.optBoolean("active")).put("autoReconnect", data.optBoolean("autoReconnect"))
            .put("lastReceivedAt", data.optLong("lastReceivedAt")).apply {
                for (key in setOf("pairId", "pcName", "code")) if (data.has(key)) put(key, data.getString(key))
                data.optJSONObject("ack")?.let { put("ack", copy(it)) }
                data.optJSONObject("emergencyAck")?.let { put("emergencyAck", copy(it)) }
                if (lastError.isNotEmpty()) put("error", lastError)
            }
    }

    private fun errorCode(error: Throwable): String {
        val message = error.message.orEmpty()
        if (message.matches(Regex("PC_[A-Z_]{1,60}"))) return message
        var cause: Throwable? = error
        while (cause != null) {
            if (cause is CertificateException || cause is javax.net.ssl.SSLPeerUnverifiedException) return "PC_PIN_MISMATCH"
            if (cause is SecurityException) return "PC_NETWORK_PERMISSION"
            if (cause is java.net.SocketTimeoutException) return "PC_TIMEOUT"
            cause = cause.cause
        }
        return "PC_UNREACHABLE"
    }
    private fun optionalTimestamp(value: JSONObject, key: String) { if (value.has(key) && !value.isNull(key)) PcLinkModel.timestamp(value.getString(key)) }
    private fun whole(value: JSONObject, key: String): Long = PcLinkModel.wireInteger(value.get(key)) ?: throw IllegalArgumentException("PC_INTEGER_INVALID")
    private fun boundedText(value: String, maximum: Int): String = value.also {
        require(it.length <= maximum && !it.contains('\u0000')) { "PC_TEXT_INVALID" }
        var index = 0
        while (index < it.length) {
            val character = it[index]
            if (Character.isHighSurrogate(character)) {
                require(index + 1 < it.length && Character.isLowSurrogate(it[index + 1])) { "PC_TEXT_INVALID" }
                index += 2
            } else {
                require(!Character.isLowSurrogate(character)) { "PC_TEXT_INVALID" }
                index++
            }
        }
    }
    private fun exact(value: JSONObject, required: Set<String>, optional: Set<String> = emptySet()) {
        val keys = value.keys().asSequence().toSet()
        require(keys.containsAll(required) && (keys - required - optional).isEmpty()) { "PC_PAYLOAD_INVALID" }
    }
    private fun copy(value: JSONObject): JSONObject = JSONObject(value.toString())
}
