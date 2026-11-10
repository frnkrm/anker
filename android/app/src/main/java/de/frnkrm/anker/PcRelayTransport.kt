package de.frnkrm.anker

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.concurrent.TimeUnit

/** Optional hosted ciphertext mailbox. Uses normal HTTPS verification, never local TLS trust. */
internal object PcRelayTransport {
    private val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS).callTimeout(12, TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false).build()
    fun cancelRequests() { http.dispatcher.cancelAll() }

    /** Only called with a verified existing LAN pair and the current foreground SDK session. */
    fun ownerOperation(project: String, pair: String, bearer: String, operation: String): JSONObject {
        require(PcRelayModel.validPair(pair) && operation in setOf("provision", "renew-phone", "revoke")) { "PC_RELAY_SETUP_INVALID" }
        require(bearer.matches(Regex("[A-Za-z0-9._~-]{20,8192}"))) { "PC_RELAY_AUTH_REQUIRED" }
        val body = JSONObject().put("operation", operation).put("pair", pair)
        val reply = request(project, body, bearer = bearer)
        if (operation == "revoke") {
            exact(reply, setOf("ok")); require(reply.opt("ok") == true) { "PC_RELAY_RESPONSE_INVALID" }
            return JSONObject().put("revoked", true)
        }
        exact(reply, setOf("ok", "phoneToken", "phoneExpiresAt") + if (operation == "provision") setOf("deviceToken") else emptySet())
        require(reply.opt("ok") == true && PcRelayModel.validToken(reply.opt("phoneToken"))) { "PC_RELAY_RESPONSE_INVALID" }
        val expiry = PcLinkModel.timestamp(reply.getString("phoneExpiresAt"))
        require(PcRelayModel.validExpiry(expiry, System.currentTimeMillis())) { "PC_RELAY_RESPONSE_INVALID" }
        val config = JSONObject().put("enabled", true).put("project", PcRelayModel.project(project)).put("pair", pair)
            .put("phoneToken", reply.getString("phoneToken")).put("phoneExpiresAt", expiry)
        val result = JSONObject().put("configuration", config)
        if (operation == "provision") {
            require(PcRelayModel.validToken(reply.opt("deviceToken")) && reply.getString("deviceToken") != reply.getString("phoneToken")) { "PC_RELAY_RESPONSE_INVALID" }
            val setup = JSONObject().put("project", project).put("pair", pair).put("deviceToken", reply.getString("deviceToken"))
            result.put("desktopSetup", PcRelayModel.DESKTOP_PREFIX + PcLinkModel.encoded(setup.toString().toByteArray(Charsets.UTF_8)))
        }
        return result
    }

    fun configuration(value: JSONObject, pair: String, now: Long = System.currentTimeMillis()): JSONObject {
        exact(value, setOf("enabled", "project", "pair", "phoneToken", "phoneExpiresAt"))
        require(value.opt("enabled") is Boolean && value.optBoolean("enabled") && value.opt("pair") == pair
            && PcRelayModel.validPair(pair) && PcRelayModel.validToken(value.opt("phoneToken"))) { "PC_RELAY_DISABLED" }
        PcRelayModel.project(value.getString("project"))
        val expiry = PcLinkModel.wireInteger(value.opt("phoneExpiresAt")) ?: throw IllegalArgumentException("PC_RELAY_SETUP_INVALID")
        check(PcRelayModel.validExpiry(expiry, now)) { "PC_RELAY_AUTH_EXPIRED" }
        return value
    }

    fun put(configuration: JSONObject, pair: String, raw: String) {
        val now = System.currentTimeMillis()
        val config = configuration(configuration, pair, now)
        val envelope = envelope(JSONObject(raw), pair, "phone", now)
        val expiry = minOf(now + PcRelayModel.MAX_CAPABILITY_MS, PcLinkModel.timestamp(envelope.getString("sentAt")) + PcRelayModel.MAX_CAPABILITY_MS)
        val body = JSONObject().put("operation", "put").put("pair", pair).put("envelope", envelope)
            .put("expiresAt", Instant.ofEpochMilli(expiry).toString())
        val result = request(config.getString("project"), body, token = config.getString("phoneToken"))
        exact(result, setOf("ok")); require(result.opt("ok") == true) { "PC_RELAY_RESPONSE_INVALID" }
    }

    fun get(configuration: JSONObject, pair: String, after: Long): List<String> {
        require(after in 0..PcLinkModel.MAX_SAFE_SEQUENCE) { "PC_RELAY_CURSOR_INVALID" }
        val now = System.currentTimeMillis()
        val config = configuration(configuration, pair, now)
        val result = request(config.getString("project"), JSONObject().put("operation", "get").put("pair", pair).put("after", after), token = config.getString("phoneToken"))
        exact(result, setOf("ok", "envelopes")); require(result.opt("ok") == true) { "PC_RELAY_RESPONSE_INVALID" }
        val rows: JSONArray = result.getJSONArray("envelopes")
        require(rows.length() <= PcRelayModel.MAX_PAGE) { "PC_RELAY_RESPONSE_INVALID" }
        var last = after
        return (0 until rows.length()).map { index ->
            val value = envelope(rows.getJSONObject(index), pair, "pc", now)
            val sequence = PcLinkModel.wireInteger(value.opt("seq")) ?: throw IllegalArgumentException("PC_RELAY_RESPONSE_INVALID")
            require(sequence > last) { "PC_RELAY_RESPONSE_INVALID" }; last = sequence
            value.toString()
        }
    }

    private fun envelope(value: JSONObject, pair: String, direction: String, now: Long): JSONObject {
        exact(value, setOf("v", "kind", "pair", "from", "seq", "sentAt", "nonce", "ct"))
        require(PcLinkModel.wireInteger(value.opt("v")) == 3L && value.opt("kind") == "anker-link" && value.opt("pair") == pair && value.opt("from") == direction
            && PcLinkModel.wireInteger(value.opt("seq"))?.let(PcLinkModel::validSequence) == true
            && value.toString().toByteArray(Charsets.UTF_8).size <= PcLinkModel.MAX_MESSAGE_BYTES) { "PC_RELAY_RESPONSE_INVALID" }
        require(PcRelayModel.sourceFresh(PcLinkModel.timestamp(value.getString("sentAt")), now)) { "PC_RELAY_RESPONSE_INVALID" }
        PcLinkModel.decoded(value.getString("nonce"), 12)
        require(PcLinkModel.decoded(value.getString("ct")).size >= 16) { "PC_RELAY_RESPONSE_INVALID" }
        return value
    }

    private fun request(project: String, body: JSONObject, bearer: String? = null, token: String? = null): JSONObject {
        require((bearer == null) != (token == null)) { "PC_RELAY_AUTH_REQUIRED" }
        val bytes = body.toString().toByteArray(Charsets.UTF_8)
        require(bytes.size <= PcLinkModel.MAX_MESSAGE_BYTES + 2048) { "PC_RELAY_MESSAGE_TOO_LARGE" }
        val builder = Request.Builder().url(PcRelayModel.endpoint(project))
            .post(bytes.toRequestBody("application/json".toMediaType()))
        if (bearer != null) builder.header("authorization", "Bearer $bearer")
        if (token != null) { require(PcRelayModel.validToken(token)) { "PC_RELAY_AUTH_REQUIRED" }; builder.header("x-anker-relay-token", token) }
        try {
            http.newCall(builder.build()).execute().use { response ->
                check(response.code !in setOf(401, 403)) { "PC_RELAY_UNAUTHORIZED" }
                check(response.isSuccessful && response.code == 200) { "PC_RELAY_UNAVAILABLE" }
                check(response.body?.contentType()?.let { it.type == "application" && it.subtype == "json" } == true) { "PC_RELAY_RESPONSE_INVALID" }
                val stream = response.body?.byteStream() ?: throw IllegalStateException("PC_RELAY_RESPONSE_INVALID")
                val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) {
                    val count = stream.read(buffer); if (count < 0) break
                    check(output.size() + count <= PcRelayModel.MAX_PAGE * PcLinkModel.MAX_MESSAGE_BYTES + 2048) { "PC_RELAY_MESSAGE_TOO_LARGE" }
                    output.write(buffer, 0, count)
                }
                return JSONObject(output.toString(Charsets.UTF_8.name()))
            }
        } catch (error: Exception) {
            val code = error.message.orEmpty()
            throw IllegalStateException(if (code.matches(Regex("PC_RELAY_[A-Z_]{1,60}"))) code else "PC_RELAY_UNAVAILABLE")
        }
    }

    private fun exact(value: JSONObject, keys: Set<String>) {
        require(value.keys().asSequence().toSet() == keys) { "PC_RELAY_RESPONSE_INVALID" }
    }
}
