package de.frnkrm.anker

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Reine Wecker-Logik ohne Android-Abhängigkeit (per JUnit getestet, siehe AlarmModelTest).
 * Jede Alarmart hat eine eigene PendingIntent-Identität und eigenen Zustand:
 * Ein Testalarm kann so weder den Hauptwecker noch die Schlummer-Regel berühren.
 */
enum class AlarmKind(val wire: String, val requestCode: Int, val rank: Int, val timeoutMs: Long) {
    MAIN("main", 4711, 4, 30 * 60_000L),
    SNOOZE("snooze", 4713, 4, 30 * 60_000L),
    WAKE_CHECK("wakecheck", 4715, 3, 5 * 60_000L),
    PRE_WAKE("prewake", 4714, 2, 10 * 60_000L),
    TEST("test", 4716, 1, 2 * 60_000L);

    companion object {
        fun of(wire: String?): AlarmKind? = entries.firstOrNull { it.wire == wire }
    }
}

/** Kleiner Spiegel der Einstellungen. Quelle ist immer der Store der App (Konfliktregel: App gewinnt). */
data class AlarmConfig(
    val enabled: Boolean,
    val wakeMinutes: Int,
    val skipDates: Set<String> = emptySet(),
    val preWakeEnabled: Boolean = false,
    val preWakeLeadMinutes: Int = 30,
    val wakeCheckEnabled: Boolean = false,
    val wakeCheckDelayMinutes: Int = 5,
    val label: String = "Aufstehen",
)

data class NextAlarms(val mainAt: Long, val preWakeAt: Long)

data class AlarmState(
    val ringing: AlarmKind? = null,
    val ringStartedAt: Long = 0,
    val mainAt: Long = 0,
    val preWakeAt: Long = 0,
    val snoozeAt: Long = 0,
    val testAt: Long = 0,
    val wakeCheckAt: Long = 0,
    val snoozeUsed: Boolean = false,
    val lastMainFiredAt: Long = 0,
    val lastPreWakeFiredAt: Long = 0,
    val lastSnoozeFiredAt: Long = 0,
    val lastTestFiredAt: Long = 0,
    val lastWakeCheckFiredAt: Long = 0,
    val lastStopMethod: String = "",
    val lastStopAt: Long = 0,
    val lastTimeoutAt: Long = 0,
    val missedMainAt: Long = 0,
    /** "" | scheduled | rang | heard | not-heard | failed */
    val testResult: String = "",
    val testResultAt: Long = 0,
)

data class FireDecision(val state: AlarmState, val ring: Boolean)
data class ReconcileResult(val state: AlarmState, val fireLate: AlarmKind?)

object AlarmPlanner {
    val ZONE: ZoneId = ZoneId.of("Europe/Berlin")
    private const val SEARCH_DAYS = 400L

    /** Lokale Berliner Wandzeit → UTC-ms. Zeiten in der Sommerzeit-Lücke rutschen nach vorn (wie core/time.ts). */
    fun toUtc(date: LocalDate, minutes: Int): Long {
        val base = date.plusDays(Math.floorDiv(minutes, 1440).toLong())
        val m = Math.floorMod(minutes, 1440)
        return ZonedDateTime.of(base, LocalTime.of(m / 60, m % 60), ZONE).toInstant().toEpochMilli()
    }

    /** Nächster Hauptwecker samt Vorwecker. mainAt = 0, wenn der Wecker aus ist. */
    fun next(cfg: AlarmConfig, now: Long): NextAlarms {
        if (!cfg.enabled) return NextAlarms(0, 0)
        val today = Instant.ofEpochMilli(now).atZone(ZONE).toLocalDate()
        for (i in 0..SEARCH_DAYS) {
            val date = today.plusDays(i)
            if (date.toString() in cfg.skipDates) continue
            val at = toUtc(date, cfg.wakeMinutes)
            if (at > now) {
                val pre = if (cfg.preWakeEnabled && cfg.preWakeLeadMinutes > 0) at - cfg.preWakeLeadMinutes * 60_000L else 0L
                return NextAlarms(at, if (pre > now) pre else 0L)
            }
        }
        return NextAlarms(0, 0)
    }
}

object AlarmMachine {
    /** Bis zu dieser Verspätung wird ein verpasster Wecker nachgeholt (z. B. Handy war aus). */
    const val LATE_GRACE_MS = 30 * 60_000L

    private fun lastFired(s: AlarmState, k: AlarmKind) = when (k) {
        AlarmKind.MAIN -> s.lastMainFiredAt
        AlarmKind.PRE_WAKE -> s.lastPreWakeFiredAt
        AlarmKind.SNOOZE -> s.lastSnoozeFiredAt
        AlarmKind.TEST -> s.lastTestFiredAt
        AlarmKind.WAKE_CHECK -> s.lastWakeCheckFiredAt
    }

    /** Ein Alarm ist fällig. Doppelte Broadcasts klingeln nicht zweimal, Höherrangiges wird nie verdrängt. */
    fun fired(s: AlarmState, kind: AlarmKind, at: Long, now: Long): FireDecision {
        if (at > 0 && at <= lastFired(s, kind)) return FireDecision(s, false)
        val stamp = if (at > 0) at else now
        val marked = when (kind) {
            // Nur ein echter Hauptwecker gibt das Schlummern wieder frei
            AlarmKind.MAIN -> s.copy(mainAt = 0, lastMainFiredAt = stamp, snoozeUsed = false, wakeCheckAt = 0)
            AlarmKind.PRE_WAKE -> s.copy(preWakeAt = 0, lastPreWakeFiredAt = stamp)
            AlarmKind.SNOOZE -> s.copy(snoozeAt = 0, lastSnoozeFiredAt = stamp)
            AlarmKind.TEST -> s.copy(testAt = 0, lastTestFiredAt = stamp, testResult = "rang", testResultAt = now)
            AlarmKind.WAKE_CHECK -> s.copy(wakeCheckAt = 0, lastWakeCheckFiredAt = stamp)
        }
        val cur = s.ringing
        if (cur != null && cur.rank >= kind.rank) return FireDecision(marked, false)
        return FireDecision(marked.copy(ringing = kind, ringStartedAt = now), true)
    }

    /** Beenden per QR, Rechenaufgaben, Notfall-Stopp usw. Danach immer neu planen. */
    fun stopped(s: AlarmState, method: String, cfg: AlarmConfig?, now: Long): AlarmState {
        val kind = s.ringing ?: return s
        val base = s.copy(ringing = null, ringStartedAt = 0, lastStopMethod = method, lastStopAt = now)
        return if (kind == AlarmKind.MAIN || kind == AlarmKind.SNOOZE) {
            val check = if (cfg?.wakeCheckEnabled == true) now + cfg.wakeCheckDelayMinutes * 60_000L else 0L
            base.copy(snoozeAt = 0, wakeCheckAt = check)
        } else {
            base
        }
    }

    /** Höchstens einmal schlummern, und nur beim Hauptwecker. */
    fun snoozed(s: AlarmState, minutes: Int, now: Long): AlarmState? {
        if (s.ringing != AlarmKind.MAIN || s.snoozeUsed) return null
        return s.copy(ringing = null, ringStartedAt = 0, snoozeUsed = true, snoozeAt = now + minutes * 60_000L)
    }

    /** Sicherheitslimit erreicht: still werden, aber der nächste Morgen bleibt geplant. */
    fun timedOut(s: AlarmState, now: Long): AlarmState {
        val kind = s.ringing ?: return s
        val base = s.copy(ringing = null, ringStartedAt = 0, lastTimeoutAt = now)
        return if (kind == AlarmKind.MAIN || kind == AlarmKind.SNOOZE) base.copy(snoozeAt = 0) else base
    }

    fun ringExpired(s: AlarmState, now: Long): Boolean {
        val k = s.ringing ?: return false
        return now - s.ringStartedAt >= k.timeoutMs
    }

    /**
     * Gleicht Plan und Zustand ab. Idempotent: beliebig oft aufrufbar.
     * Verpasste Wecker werden innerhalb der Schonfrist einmal nachgeholt, ältere nur vermerkt,
     * damit nach Tagen ohne Strom keine alten Alarme nachklingeln.
     */
    fun reconcile(s: AlarmState, cfg: AlarmConfig?, now: Long): ReconcileResult {
        var state = s
        var late: AlarmKind? = null

        val missedMain = state.mainAt in 1..now && state.lastMainFiredAt < state.mainAt
        if (missedMain) {
            if (cfg?.enabled != false && now - state.mainAt <= LATE_GRACE_MS) late = AlarmKind.MAIN
            else state = state.copy(missedMainAt = state.mainAt, mainAt = 0)
        }
        if (state.snoozeAt in 1..now) {
            if (late == null && now - state.snoozeAt <= LATE_GRACE_MS) late = AlarmKind.SNOOZE
            else state = state.copy(snoozeAt = 0)
        }
        if (state.preWakeAt in 1..now) state = state.copy(preWakeAt = 0)
        if (state.wakeCheckAt in 1..now) state = state.copy(wakeCheckAt = 0)
        if (state.testAt in 1..now) {
            state = state.copy(testAt = 0, testResult = "failed", testResultAt = now)
        }

        if (cfg != null) {
            if (late != AlarmKind.MAIN) {
                val next = AlarmPlanner.next(cfg, now)
                state = state.copy(mainAt = next.mainAt, preWakeAt = next.preWakeAt)
            }
            if (!cfg.enabled) state = state.copy(snoozeAt = 0, wakeCheckAt = 0)
            if (!cfg.wakeCheckEnabled) state = state.copy(wakeCheckAt = 0)
        }
        return ReconcileResult(state, late)
    }
}
