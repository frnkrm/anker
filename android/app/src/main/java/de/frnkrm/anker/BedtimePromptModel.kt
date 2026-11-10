package de.frnkrm.anker

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

enum class BedtimePromptPhase(val wire: String) {
    IDLE("idle"), WAITING("waiting"), SHOWN("shown"), QUIET("quiet"), SKIPPED("skipped"), ERROR("error");
    companion object { fun of(value: String) = entries.firstOrNull { it.wire == value } ?: IDLE }
}

enum class BedtimePromptForeground(val wire: String) {
    NOT_REQUESTED("not-requested"), REQUESTED("requested"), CONFIRMED("confirmed"), UNCONFIRMED("unconfirmed"), FAILED("failed");
    companion object { fun of(value: String) = entries.firstOrNull { it.wire == value } ?: NOT_REQUESTED }
}

enum class BedtimeQuietTrigger { NON_WAKEUP_CHECK, USER_PRESENT, APP_RESUME, SCREEN_ON }
enum class BedtimeQuietSourceAction { REJECT, REUSE, START }

data class BedtimeQuietSource(val date: String, val key: String, val revision: String, val token: String, val at: Long)

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
    val followUps: Boolean = false,
    val quietDueElapsed: Long = 0,
    val quietDueAt: Long = 0,
    val quietUntilElapsed: Long = 0,
    val quietUntilAt: Long = 0,
    val quietVisible: Boolean = false,
    val quietToken: String = "",
    val quietSource: BedtimeQuietSource? = null,
)

/** Reine Einmalsitzung. Systemzustände und monotone Uhr werden ausdrücklich übergeben. */
object BedtimePromptModel {
    const val DELIVERY_GRACE_MS = 15_000L
    const val DISPLAY_DURATION_MS = 60_000L
    const val FOREGROUND_CONFIRMATION_MS = 3_000L
    const val MAX_AUTOMATIC_OPEN_ATTEMPTS = 2
    const val QUIET_SNOOZE_MS = 5 * 60_000L
    const val QUIET_WINDOW_MS = 2 * 60 * 60_000L
    private val BERLIN = ZoneId.of("Europe/Berlin")

    /** Android Display.STATE_ON ist echte Anzeige-Evidenz, auch bei nichtinteraktivem, gedimmtem Spiel.
     * OFF/DOZE/AOD/ON_SUSPEND sind niemals ein eingeschalteter Nutzungsbildschirm.
     * Nur wenn die Anzeige-Evidenz fehlt, bleibt die ältere Interactive-Auskunft der Fallback.
     */
    fun screenVisible(interactive: Boolean, defaultDisplayState: Int? = null): Boolean = when (defaultDisplayState) {
        null, 0 -> interactive // STATE_UNKNOWN / auf dem Gerät nicht abfragbar
        2 -> true // Display.STATE_ON
        else -> false
    }

    fun arm(id: String, delayMinutes: Int, elapsed: Long, wall: Long, boot: Int, exact: Boolean,
            followUps: Boolean = false, quietOnly: Boolean = false): BedtimePromptState {
        require(id.isNotBlank() && delayMinutes in 0..60 && elapsed >= 0 && wall >= 0)
        require(!quietOnly || followUps)
        val delay = delayMinutes * 60_000L
        require(elapsed <= Long.MAX_VALUE - delay - QUIET_WINDOW_MS)
        require(wall <= Long.MAX_VALUE - delay - QUIET_WINDOW_MS)
        val dueAt = wall + delay
        val endAt = if (followUps) minOf(dueAt + QUIET_WINDOW_MS, planWindowEnd(wall)) else 0
        return BedtimePromptState(id, if (quietOnly) BedtimePromptPhase.QUIET else BedtimePromptPhase.WAITING,
            elapsed, elapsed + delay, dueAt, boot, exact,
            wakeup = !quietOnly, allowWhileIdle = !quietOnly, followUps = followUps,
            quietDueElapsed = if (followUps) elapsed + delay else 0, quietDueAt = if (followUps) dueAt else 0,
            quietUntilElapsed = if (followUps) elapsed + (endAt - wall) else 0, quietUntilAt = endAt)
    }

    /** Only bounds the already chosen night. It does not calculate another bedtime or plan. */
    fun planWindowEnd(startedWall: Long): Long {
        val local = Instant.ofEpochMilli(startedWall).atZone(BERLIN)
        val date = if (local.toLocalTime() < LocalTime.of(4, 0)) local.toLocalDate() else local.toLocalDate().plusDays(1)
        return date.atTime(4, 0).atZone(BERLIN).toInstant().toEpochMilli()
    }

    /** Keeps the original app-supplied bedtime/delay even if Android delivers later. */
    fun fromReminder(id: String, at: Long, delayMinutes: Int, elapsed: Long, wall: Long, boot: Int): BedtimePromptState {
        require(id.isNotBlank() && at >= 0 && wall >= at && elapsed >= 0 && delayMinutes in 0..60)
        val delay = delayMinutes * 60_000L
        require(at <= Long.MAX_VALUE - delay - QUIET_WINDOW_MS)
        val due = at + delay
        val end = minOf(due + QUIET_WINDOW_MS, planWindowEnd(at))
        val remaining = (end - wall).coerceAtLeast(0)
        val untilDue = (due - wall).coerceAtLeast(0)
        require(elapsed <= Long.MAX_VALUE - maxOf(remaining, untilDue))
        return BedtimePromptState(sessionId = id, phase = if (remaining > 0) BedtimePromptPhase.QUIET else BedtimePromptPhase.SKIPPED,
            startedElapsed = elapsed, dueElapsed = elapsed + untilDue, dueAt = due, bootCount = boot,
            followUps = true, quietDueElapsed = elapsed + untilDue, quietDueAt = due,
            quietUntilElapsed = elapsed + remaining, quietUntilAt = end,
            reason = if (remaining > 0) "quiet-follow-up" else "quiet-expired")
    }

    fun currentQuietSource(source: BedtimeQuietSource, revisions: Map<String, String>): Boolean = try {
        source.key == "bed" && LocalDate.parse(source.date).toString() == source.date && source.at >= 0 &&
            source.revision.isNotBlank() && source.token.isNotBlank() && source.token.length <= 256 &&
            revisions["${source.date}|${source.key}"] == source.revision
    } catch (_: Exception) { false }

    fun quietSourceAction(current: BedtimePromptState, source: BedtimeQuietSource, revisions: Map<String, String>,
                          enabled: Boolean, restDate: String): BedtimeQuietSourceAction = when {
        !enabled || !currentQuietSource(source, revisions) || restDate == source.date ||
            current.phase in setOf(BedtimePromptPhase.WAITING, BedtimePromptPhase.SHOWN) ||
            current.phase == BedtimePromptPhase.QUIET && current.quietSource == null -> BedtimeQuietSourceAction.REJECT
        current.quietSource?.let { it.date == source.date && it.key == source.key && it.revision == source.revision } == true -> BedtimeQuietSourceAction.REUSE
        else -> BedtimeQuietSourceAction.START
    }

    fun reconcile(s: BedtimePromptState, elapsed: Long, boot: Int, wall: Long = -1): BedtimePromptState {
        if (s.phase !in setOf(BedtimePromptPhase.WAITING, BedtimePromptPhase.SHOWN, BedtimePromptPhase.QUIET)) return s
        if (boot != s.bootCount || elapsed < s.startedElapsed) return skip(s, "restart")
        if (s.phase == BedtimePromptPhase.QUIET && (!s.followUps || elapsed >= s.quietUntilElapsed
                || wall >= 0 && wall >= s.quietUntilAt)) return skip(s, "quiet-expired")
        if (s.phase == BedtimePromptPhase.WAITING && elapsed > s.dueElapsed + DELIVERY_GRACE_MS) return skip(s, "expired")
        if (s.phase == BedtimePromptPhase.SHOWN && elapsed >= s.visibleUntilElapsed)
            return if (s.followUps) quiet(s, s.sessionId, elapsed, wall) else skip(s, "expired")
        if (s.phase == BedtimePromptPhase.SHOWN && s.foreground == BedtimePromptForeground.REQUESTED
            && elapsed >= s.foregroundRequestedElapsed + FOREGROUND_CONFIRMATION_MS)
            return s.copy(foreground = BedtimePromptForeground.UNCONFIRMED)
        return s
    }

    /** Dismissing a chosen first hint may retain only a silent, bounded follow-up. */
    fun quiet(s: BedtimePromptState, id: String, elapsed: Long, wall: Long): BedtimePromptState {
        if (id != s.sessionId || !s.followUps || s.phase != BedtimePromptPhase.SHOWN &&
            !(s.phase == BedtimePromptPhase.WAITING && elapsed >= s.dueElapsed)) return s
        if (elapsed < s.startedElapsed || elapsed >= s.quietUntilElapsed || wall >= 0 && wall >= s.quietUntilAt)
            return skip(s, "quiet-expired")
        val next = elapsed + minOf(QUIET_SNOOZE_MS, s.quietUntilElapsed - elapsed)
        return s.copy(phase = BedtimePromptPhase.QUIET, foreground = BedtimePromptForeground.NOT_REQUESTED, exact = false,
            wakeup = false, allowWhileIdle = false, visibleUntilElapsed = 0, reason = "quiet-follow-up",
            quietDueElapsed = next, quietDueAt = quietWallAt(s, elapsed, wall, next), quietVisible = false, quietToken = "")
    }

    /** A check only permits a completely silent card; screen-on never means the person is awake. */
    fun presentQuiet(s: BedtimePromptState, elapsed: Long, boot: Int, wall: Long, trigger: BedtimeQuietTrigger,
                     interactive: Boolean, unlocked: Boolean, alarmActive: Boolean, displayState: Int?, token: String): BedtimePromptState {
        val checked = reconcile(s, elapsed, boot, wall)
        if (checked.phase != BedtimePromptPhase.QUIET || trigger == BedtimeQuietTrigger.SCREEN_ON || !interactive
            || !screenVisible(interactive, displayState) || !unlocked || alarmActive
            || elapsed < checked.quietDueElapsed || checked.quietVisible || token.isBlank()) return checked
        return checked.copy(quietVisible = true, quietToken = token)
    }

    /** Eligibility of the passive in-app card, independent of Android notification delivery. */
    fun quietReady(s: BedtimePromptState, elapsed: Long, boot: Int, wall: Long, interactive: Boolean,
                   displayState: Int?, unlocked: Boolean, alarmActive: Boolean): Boolean =
        s.phase == BedtimePromptPhase.QUIET && reconcile(s, elapsed, boot, wall) == s && elapsed >= s.quietDueElapsed &&
            interactive && screenVisible(interactive, displayState) && unlocked && !alarmActive

    fun snoozeQuiet(s: BedtimePromptState, id: String, elapsed: Long, boot: Int, wall: Long, token: String? = null): BedtimePromptState {
        if (id != s.sessionId || token != null && (token != s.quietToken || !s.quietVisible)) return s
        val checked = reconcile(s, elapsed, boot, wall)
        if (checked.phase != BedtimePromptPhase.QUIET || elapsed < checked.quietDueElapsed) return checked
        val next = elapsed + minOf(QUIET_SNOOZE_MS, checked.quietUntilElapsed - elapsed)
        return checked.copy(quietDueElapsed = next, quietDueAt = quietWallAt(checked, elapsed, wall, next),
            quietVisible = false, quietToken = "", reason = "quiet-snoozed")
    }

    fun stopQuiet(s: BedtimePromptState, id: String, token: String): BedtimePromptState =
        if (s.phase == BedtimePromptPhase.QUIET && id == s.sessionId && s.quietVisible && token == s.quietToken)
            stop(s, id) else s

    fun hideQuiet(s: BedtimePromptState): BedtimePromptState =
        if (s.phase == BedtimePromptPhase.QUIET) s.copy(quietVisible = false, quietToken = "") else s

    private fun quietWallAt(s: BedtimePromptState, elapsed: Long, wall: Long, next: Long): Long =
        if (wall >= 0 && wall <= Long.MAX_VALUE - (next - elapsed)) wall + (next - elapsed)
        else s.dueAt + (next - s.dueElapsed)

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
        if (s.phase in setOf(BedtimePromptPhase.WAITING, BedtimePromptPhase.SHOWN, BedtimePromptPhase.QUIET))
            s.copy(phase = BedtimePromptPhase.SKIPPED, reason = reason, quietVisible = false, quietToken = "") else s

    fun stop(s: BedtimePromptState, id: String? = null): BedtimePromptState =
        if (id != null && id != s.sessionId) s else s.copy(phase = BedtimePromptPhase.IDLE, reason = "stopped", quietVisible = false, quietToken = "")

    fun ack(s: BedtimePromptState, id: String): BedtimePromptState =
        if (id == s.sessionId && s.phase == BedtimePromptPhase.SHOWN) s.copy(phase = BedtimePromptPhase.IDLE, reason = "acknowledged") else s
}
