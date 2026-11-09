package de.frnkrm.anker

enum class BedtimePromptPhase(val wire: String) {
    IDLE("idle"), WAITING("waiting"), SHOWN("shown"), SKIPPED("skipped"), ERROR("error");
    companion object { fun of(value: String) = entries.firstOrNull { it.wire == value } ?: IDLE }
}

enum class BedtimePromptForeground(val wire: String) {
    NOT_REQUESTED("not-requested"), REQUESTED("requested"), CONFIRMED("confirmed"), UNCONFIRMED("unconfirmed"), FAILED("failed");
    companion object { fun of(value: String) = entries.firstOrNull { it.wire == value } ?: NOT_REQUESTED }
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
    val wakeup: Boolean = false,
    val allowWhileIdle: Boolean = false,
    val foreground: BedtimePromptForeground = BedtimePromptForeground.NOT_REQUESTED,
    val foregroundAttempts: Int = 0,
    val foregroundRequestedElapsed: Long = 0,
)

/** Reine Einmalsitzung. Systemzustände und monotone Uhr werden ausdrücklich übergeben. */
object BedtimePromptModel {
    const val DELIVERY_GRACE_MS = 15_000L
    const val DISPLAY_DURATION_MS = 60_000L
    const val FOREGROUND_CONFIRMATION_MS = 3_000L
    const val MAX_AUTOMATIC_OPEN_ATTEMPTS = 2

    /** Android Display.STATE_ON ist echte Anzeige-Evidenz, auch bei nichtinteraktivem, gedimmtem Spiel.
     * OFF/DOZE/AOD/ON_SUSPEND sind niemals ein eingeschalteter Nutzungsbildschirm.
     * Nur wenn die Anzeige-Evidenz fehlt, bleibt die ältere Interactive-Auskunft der Fallback.
     */
    fun screenVisible(interactive: Boolean, defaultDisplayState: Int? = null): Boolean = when (defaultDisplayState) {
        null, 0 -> interactive // STATE_UNKNOWN / auf dem Gerät nicht abfragbar
        2 -> true // Display.STATE_ON
        else -> false
    }

    fun arm(id: String, delayMinutes: Int, elapsed: Long, wall: Long, boot: Int, exact: Boolean): BedtimePromptState {
        require(id.isNotBlank() && delayMinutes in 0..60 && elapsed >= 0 && wall >= 0)
        val delay = delayMinutes * 60_000L
        require(elapsed <= Long.MAX_VALUE - delay - DELIVERY_GRACE_MS - DISPLAY_DURATION_MS)
        require(wall <= Long.MAX_VALUE - delay)
        return BedtimePromptState(id, BedtimePromptPhase.WAITING, elapsed, elapsed + delay, wall + delay, boot, exact,
            wakeup = true, allowWhileIdle = true)
    }

    fun reconcile(s: BedtimePromptState, elapsed: Long, boot: Int): BedtimePromptState {
        if (s.phase != BedtimePromptPhase.WAITING && s.phase != BedtimePromptPhase.SHOWN) return s
        if (boot != s.bootCount || elapsed < s.startedElapsed) return skip(s, "restart")
        if (s.phase == BedtimePromptPhase.WAITING && elapsed > s.dueElapsed + DELIVERY_GRACE_MS) return skip(s, "expired")
        if (s.phase == BedtimePromptPhase.SHOWN && elapsed >= s.visibleUntilElapsed) return skip(s, "expired")
        if (s.phase == BedtimePromptPhase.SHOWN && s.foreground == BedtimePromptForeground.REQUESTED
            && elapsed >= s.foregroundRequestedElapsed + FOREGROUND_CONFIRMATION_MS)
            return s.copy(foreground = BedtimePromptForeground.UNCONFIRMED)
        return s
    }

    fun due(s: BedtimePromptState, id: String, elapsed: Long, boot: Int, interactive: Boolean,
            unlocked: Boolean, overlayAllowed: Boolean, alarmActive: Boolean, defaultDisplayState: Int? = null): BedtimePromptState {
        if (id != s.sessionId || s.phase != BedtimePromptPhase.WAITING) return s
        val checked = reconcile(s, elapsed, boot)
        if (checked != s) return checked
        if (elapsed < s.dueElapsed) return s
        return when {
            !screenVisible(interactive, defaultDisplayState) -> skip(s, "screen-off")
            !unlocked -> skip(s, "locked")
            !overlayAllowed -> skip(s, "permission-revoked")
            alarmActive -> skip(s, "alarm-active")
            else -> s.copy(phase = BedtimePromptPhase.SHOWN, visibleUntilElapsed = elapsed + DISPLAY_DURATION_MS)
        }
    }

    fun requestForeground(s: BedtimePromptState, id: String, elapsed: Long, automatic: Boolean): BedtimePromptState {
        if (id != s.sessionId || s.phase != BedtimePromptPhase.SHOWN || elapsed < s.dueElapsed || elapsed >= s.visibleUntilElapsed
            || s.foreground == BedtimePromptForeground.CONFIRMED
            || automatic && s.foregroundAttempts >= MAX_AUTOMATIC_OPEN_ATTEMPTS) return s
        return s.copy(foreground = BedtimePromptForeground.REQUESTED,
            foregroundAttempts = (s.foregroundAttempts + 1).coerceAtMost(1000), foregroundRequestedElapsed = elapsed)
    }

    fun foregroundConfirmed(s: BedtimePromptState, id: String, elapsed: Long): BedtimePromptState {
        if (id != s.sessionId || s.phase != BedtimePromptPhase.SHOWN || elapsed < s.dueElapsed || elapsed >= s.visibleUntilElapsed) return s
        return s.copy(foreground = BedtimePromptForeground.CONFIRMED)
    }

    fun foregroundFailed(s: BedtimePromptState, id: String): BedtimePromptState =
        if (id == s.sessionId && s.phase == BedtimePromptPhase.SHOWN) s.copy(foreground = BedtimePromptForeground.FAILED) else s

    fun foregroundUnconfirmed(s: BedtimePromptState, id: String): BedtimePromptState =
        if (id == s.sessionId && s.phase == BedtimePromptPhase.SHOWN && s.foreground != BedtimePromptForeground.CONFIRMED)
            s.copy(foreground = BedtimePromptForeground.UNCONFIRMED) else s

    fun skip(s: BedtimePromptState, reason: String): BedtimePromptState =
        if (s.phase == BedtimePromptPhase.WAITING || s.phase == BedtimePromptPhase.SHOWN) s.copy(phase = BedtimePromptPhase.SKIPPED, reason = reason) else s

    fun stop(s: BedtimePromptState, id: String? = null): BedtimePromptState =
        if (id != null && id != s.sessionId) s else s.copy(phase = BedtimePromptPhase.IDLE, reason = "stopped")

    fun ack(s: BedtimePromptState, id: String): BedtimePromptState =
        if (id == s.sessionId && s.phase == BedtimePromptPhase.SHOWN) s.copy(phase = BedtimePromptPhase.IDLE, reason = "acknowledged") else s
}
