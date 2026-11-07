package de.frnkrm.anker

enum class BedtimePromptPhase(val wire: String) {
    IDLE("idle"), WAITING("waiting"), SHOWN("shown"), SKIPPED("skipped"), ERROR("error");
    companion object { fun of(value: String) = entries.firstOrNull { it.wire == value } ?: IDLE }
}

/** Nur Sitzungskennung und Zeitpunkte; keine Schlafmessung oder Alltagsinhalte. */
data class BedtimePromptState(
    val sessionId: String = "",
    val phase: BedtimePromptPhase = BedtimePromptPhase.IDLE,
    val startedElapsed: Long = 0,
    val dueElapsed: Long = 0,
    val dueAt: Long = 0,
    val bootCount: Int = -1,
    val exact: Boolean = false,
    val visibleUntilElapsed: Long = 0,
    val reason: String = "",
)

/** Reine Einmalsitzung. Systemzustände und monotone Uhr werden ausdrücklich übergeben. */
object BedtimePromptModel {
    const val DELIVERY_GRACE_MS = 15_000L
    const val DISPLAY_DURATION_MS = 60_000L

    fun arm(id: String, delayMinutes: Int, elapsed: Long, wall: Long, boot: Int, exact: Boolean): BedtimePromptState {
        require(id.isNotBlank() && delayMinutes in 0..60 && elapsed >= 0 && wall >= 0)
        val delay = delayMinutes * 60_000L
        require(elapsed <= Long.MAX_VALUE - delay - DELIVERY_GRACE_MS - DISPLAY_DURATION_MS)
        require(wall <= Long.MAX_VALUE - delay)
        return BedtimePromptState(id, BedtimePromptPhase.WAITING, elapsed, elapsed + delay, wall + delay, boot, exact)
    }

    fun reconcile(s: BedtimePromptState, elapsed: Long, boot: Int): BedtimePromptState {
        if (s.phase != BedtimePromptPhase.WAITING && s.phase != BedtimePromptPhase.SHOWN) return s
        if (boot != s.bootCount || elapsed < s.startedElapsed) return skip(s, "restart")
        if (s.phase == BedtimePromptPhase.WAITING && elapsed > s.dueElapsed + DELIVERY_GRACE_MS) return skip(s, "expired")
        if (s.phase == BedtimePromptPhase.SHOWN && elapsed >= s.visibleUntilElapsed) return skip(s, "expired")
        return s
    }

    fun due(s: BedtimePromptState, id: String, elapsed: Long, boot: Int, interactive: Boolean,
            unlocked: Boolean, overlayAllowed: Boolean, alarmActive: Boolean): BedtimePromptState {
        if (id != s.sessionId || s.phase != BedtimePromptPhase.WAITING) return s
        val checked = reconcile(s, elapsed, boot)
        if (checked != s) return checked
        if (elapsed < s.dueElapsed) return s
        return when {
            !interactive -> skip(s, "screen-off")
            !unlocked -> skip(s, "locked")
            !overlayAllowed -> skip(s, "permission-revoked")
            alarmActive -> skip(s, "alarm-active")
            else -> s.copy(phase = BedtimePromptPhase.SHOWN, visibleUntilElapsed = elapsed + DISPLAY_DURATION_MS)
        }
    }

    fun skip(s: BedtimePromptState, reason: String): BedtimePromptState =
        if (s.phase == BedtimePromptPhase.WAITING || s.phase == BedtimePromptPhase.SHOWN) s.copy(phase = BedtimePromptPhase.SKIPPED, reason = reason) else s

    fun stop(s: BedtimePromptState, id: String? = null): BedtimePromptState =
        if (id != null && id != s.sessionId) s else s.copy(phase = BedtimePromptPhase.IDLE, reason = "stopped")

    fun ack(s: BedtimePromptState, id: String): BedtimePromptState =
        if (id == s.sessionId && s.phase == BedtimePromptPhase.SHOWN) s.copy(phase = BedtimePromptPhase.IDLE, reason = "acknowledged") else s
}
