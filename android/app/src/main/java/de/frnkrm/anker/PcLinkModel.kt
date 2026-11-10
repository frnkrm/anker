package de.frnkrm.anker

import java.net.InetAddress
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64

/** Pure LAN/pinning/retry guards. Discovery is never a trust decision. */
object PcLinkModel {
    const val MAX_MESSAGE_BYTES = 65_536
    const val MAX_SAFE_SEQUENCE = 9_007_199_254_740_991L
    const val MAX_PAIR_AGE_MS = 10 * 60_000L
    const val MAX_LEASE_MS = 18 * 60 * 60_000L
    const val MAX_ACK_AGE_MS = 120_000L
    private val identifier = Regex("[A-Za-z0-9._:-]{1,160}")
    private val base64 = Regex("[A-Za-z0-9_-]+")
    private val stableVersion = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?")

    data class Endpoint(val host: String, val port: Int) {
        fun authority(): String = if (host.contains(':')) "[$host]:$port" else "$host:$port"
        fun https(path: String): String = "https://${authority()}$path"
        fun wss(path: String): String = "wss://${authority()}$path"
    }

    fun validIdentifier(value: String): Boolean = identifier.matches(value)
    /** JSONObject.getLong coerces floats/strings: authenticated wire counters must not. */
    fun wireInteger(value: Any?): Long? = when (value) {
        is Int -> value.toLong()
        is Long -> value
        else -> null
    }

    /** The two new optional fields require the stable 0.1.1 PC validator, not a protocol bump. */
    fun compatibleCompanion(protocol: Any?, version: Any?): Boolean {
        if (wireInteger(protocol) != 3L || version !is String || version.length !in 5..128) return false
        val matched = stableVersion.matchEntire(version) ?: return false
        val parts = (1..3).map { matched.groupValues[it].toLongOrNull() ?: return false }
        return parts[0] > 0L || parts[1] > 1L || (parts[1] == 1L && parts[2] >= 1L)
    }

    /** Presence is explicit: null, coerced numbers and unknown/local-only keys are never optional. */
    fun validCompanionPreferenceExtensions(values: Map<String, Any?>): Boolean = values.all { (key, value) ->
        when (key) {
            "singleTransition" -> value is Boolean
            "bedAfterStopMin" -> wireInteger(value)?.let { it in 0..30 } == true
            else -> false
        }
    }
    fun validSequence(value: Long): Boolean = value in 1..MAX_SAFE_SEQUENCE
    fun acceptSequence(previous: Long, incoming: Long): Boolean = validSequence(incoming) && incoming > previous
    fun retryDelayMs(attempt: Int): Long = (1_000L shl attempt.coerceIn(0, 6)).coerceAtMost(60_000L)
    fun validPin(value: String): Boolean = value.matches(Regex("[A-Fa-f0-9]{64}"))
    fun normalisePin(value: String): String = value.replace(":", "").lowercase().also { require(validPin(it)) { "PC_PIN_INVALID" } }
    fun matchesPin(expected: String, certificateDer: ByteArray): Boolean {
        if (!validPin(expected)) return false
        val actual = MessageDigest.getInstance("SHA-256").digest(certificateDer)
        val wanted = ByteArray(32) { expected.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
        return MessageDigest.isEqual(actual, wanted)
    }

    fun encoded(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    fun decoded(text: String, expectedBytes: Int? = null): ByteArray {
        require(text.length <= MAX_MESSAGE_BYTES && base64.matches(text) && text.length % 4 != 1) { "PC_ENCODING_INVALID" }
        val bytes = try { Base64.getUrlDecoder().decode(text) } catch (_: IllegalArgumentException) { throw IllegalArgumentException("PC_ENCODING_INVALID") }
        require(encoded(bytes) == text && (expectedBytes == null || bytes.size == expectedBytes)) { "PC_ENCODING_INVALID" }
        return bytes
    }

    fun privateAddress(address: InetAddress): Boolean {
        if (address.isAnyLocalAddress || address.isMulticastAddress) return false
        val bytes = address.address
        val uniqueLocalV6 = bytes.size == 16 && (bytes[0].toInt() and 0xfe) == 0xfc
        return address.isLoopbackAddress || address.isSiteLocalAddress || address.isLinkLocalAddress || uniqueLocalV6
    }

    fun endpoint(raw: String): Endpoint {
        require(raw.length in 3..300 && !raw.contains('/') && !raw.contains('@') && !raw.contains('?') && !raw.contains('#') && !raw.any { it.isWhitespace() }) { "PC_ADDRESS_INVALID" }
        val host: String
        val port: Int
        if (raw.startsWith('[')) {
            val end = raw.indexOf(']')
            require(end > 1 && raw.getOrNull(end + 1) == ':') { "PC_ADDRESS_INVALID" }
            host = raw.substring(1, end)
            port = raw.substring(end + 2).toIntOrNull() ?: throw IllegalArgumentException("PC_ADDRESS_INVALID")
            require(host.matches(Regex("[A-Fa-f0-9:.]+(?:%[A-Za-z0-9_.-]{1,30})?"))) { "PC_ADDRESS_INVALID" }
        } else {
            val split = raw.lastIndexOf(':')
            require(split > 0 && raw.indexOf(':') == split) { "PC_ADDRESS_INVALID" }
            host = raw.substring(0, split)
            port = raw.substring(split + 1).toIntOrNull() ?: throw IllegalArgumentException("PC_ADDRESS_INVALID")
            require(host.matches(Regex("[0-9.]+")) || host.matches(Regex("[A-Za-z0-9][A-Za-z0-9.-]{0,240}\\.local"))) { "PC_ADDRESS_INVALID" }
        }
        require(port in 1..65535) { "PC_ADDRESS_INVALID" }
        // Literal addresses can be rejected without performing DNS/network work.
        if (host.contains(':') || host.matches(Regex("[0-9.]+"))) {
            if (!host.contains(':')) {
                val pieces = host.split('.')
                require(pieces.size == 4 && pieces.all { it.isNotEmpty() && it.length <= 3 && it.toIntOrNull() in 0..255 && (it == "0" || !it.startsWith('0')) }) { "PC_ADDRESS_INVALID" }
            }
            val literal = try { InetAddress.getByName(host) } catch (_: Exception) { throw IllegalArgumentException("PC_ADDRESS_INVALID") }
            require(privateAddress(literal)) { "PC_ADDRESS_NOT_LOCAL" }
        }
        return Endpoint(host, port)
    }

    fun timestamp(value: String): Long {
        require(value.length in 20..40 && (value.endsWith('Z') || value.matches(Regex(".*[+-][0-9]{2}:[0-9]{2}$")))) { "PC_TIME_INVALID" }
        return try { Instant.parse(value).toEpochMilli() } catch (_: Exception) { throw IllegalArgumentException("PC_TIME_INVALID") }
    }

    fun validPairExpiry(expiresAt: Long, now: Long): Boolean = expiresAt > now && expiresAt - now <= MAX_PAIR_AGE_MS
    fun validLease(generatedAt: Long, validUntil: Long): Boolean = validUntil > generatedAt && validUntil - generatedAt <= MAX_LEASE_MS

    data class EmergencyState(
        val revision: String,
        val date: String,
        val generatedAt: Long,
        val validUntil: Long,
        val morningDeadlineAt: Long?,
        val targetAt: Long?,
        val lockEnforced: Boolean,
        val strictEnabled: Boolean,
        val enforcementEnabled: Boolean,
    )

    /** Supplied only from a PC payload that has passed native AEAD/sequence validation. */
    data class EmergencyAcknowledgement(
        val revision: String,
        val date: String,
        val mode: String,
        val receivedAt: Long,
        val localReceivedAt: Long?,
        val stopAt: Long?,
        val warnings: Set<String> = emptySet(),
    )

    /** QR proof is checked separately before this bounded, content-free night gate. */
    fun emergencyNightConfirmed(state: EmergencyState, acknowledgement: EmergencyAcknowledgement?, now: Long): Boolean {
        if (now !in 0..Long.MAX_VALUE - MAX_ACK_AGE_MS || state.generatedAt < 0
            || !state.strictEnabled || !state.enforcementEnabled
            || !validLease(state.generatedAt, state.validUntil)
            || state.generatedAt > now + MAX_ACK_AGE_MS
            || state.validUntil <= now || state.morningDeadlineAt?.let { it <= now } == true) return false
        // Preserve an explicitly confirmed phone-night, while keeping its original consent/lease gates.
        if (state.lockEnforced) return true
        val ack = acknowledgement ?: return false
        if (ack.revision != state.revision || ack.date != state.date
            || ack.mode !in setOf("locked", "scheduled") || ack.warnings.isNotEmpty()
            || ack.receivedAt < now - MAX_ACK_AGE_MS || ack.receivedAt > now + MAX_ACK_AGE_MS) return false
        val localReceivedAt = ack.localReceivedAt
        if (localReceivedAt != null && (localReceivedAt <= 0 || localReceivedAt > now || now - localReceivedAt > MAX_ACK_AGE_MS)) return false
        // After 04:00 the phone already projects the next evening. The authenticated
        // PC ACK can still identify the actual, already-due target of the prior-night latch.
        val target = ack.stopAt ?: state.targetAt
        return target != null && target in 0..now
    }

    /** Hardware extensions end with this night's lease and its existing morning safety deadline. */
    fun emergencyUntil(now: Long, minutes: Int, validUntil: Long, morningDeadlineAt: Long? = null): Long {
        require(minutes in 1..120 && now in 0..Long.MAX_VALUE - 120 * 60_000L) { "PC_EMERGENCY_INVALID" }
        val until = minOf(now + minutes * 60_000L, validUntil, morningDeadlineAt ?: Long.MAX_VALUE)
        check(until > now) { "PC_NO_ACTIVE_NIGHT" }
        return until
    }
    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
}
