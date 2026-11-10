package de.frnkrm.anker

/** Public relay metadata only. Encryption and replay state remain owned by PcBridgeClient. */
object PcRelayModel {
    const val MAX_CAPABILITY_MS = 14L * 24 * 60 * 60_000
    const val MAX_PAGE = 8
    const val DESKTOP_PREFIX = "anker-pc-relay:v1:"

    fun project(value: String): String {
        require(value.matches(Regex("[a-z0-9]{20}"))) { "PC_RELAY_SETUP_INVALID" }
        return value
    }

    fun endpoint(projectRef: String): String = "https://${project(projectRef)}.supabase.co/functions/v1/pc-link"
    fun validToken(value: Any?): Boolean = value is String && value.matches(Regex("[a-f0-9]{64}"))
    fun validPair(value: Any?): Boolean = value is String && PcLinkModel.validIdentifier(value)
    fun validExpiry(expiresAt: Long, now: Long): Boolean = now >= 0 && expiresAt > now &&
        now <= Long.MAX_VALUE - MAX_CAPABILITY_MS - 5_000 && expiresAt <= now + MAX_CAPABILITY_MS + 5_000
    fun sourceFresh(sentAt: Long, now: Long): Boolean = now >= MAX_CAPABILITY_MS &&
        sentAt >= now - MAX_CAPABILITY_MS && now <= Long.MAX_VALUE - 120_000 && sentAt <= now + 120_000
    fun liveContact(enabled: Boolean, expiresAt: Long, now: Long, lastReceivedAt: Long): Boolean =
        enabled && validExpiry(expiresAt, now) && lastReceivedAt > 0 && now >= lastReceivedAt && now - lastReceivedAt <= 90_000
    fun freshPeerFrame(sentAt: Long, now: Long): Boolean = now >= 90_000 && now <= Long.MAX_VALUE - 90_000 &&
        sentAt >= now - 90_000 && sentAt <= now + 90_000
    fun expiredCiphertext(sentAt: Long, now: Long): Boolean = now >= sentAt &&
        sentAt >= 0 && now - sentAt >= MAX_CAPABILITY_MS

    /** No URL, token, owner, pin or server body is returned to the UI. */
    fun publicStatus(enabled: Boolean, expiresAt: Long, now: Long, lanConnected: Boolean, mode: String): String = when {
        !enabled -> "off"
        !validExpiry(expiresAt, now) -> "expired"
        lanConnected -> "lan"
        mode in setOf("waiting", "received", "unavailable", "unauthorized", "rejected") -> mode
        else -> "waiting"
    }
}
