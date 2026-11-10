package de.frnkrm.anker

/** Only explicitly selected technical facts enter the local journal. No arbitrary text or identifiers. */
data class NativeDiagnosticEntry(val seq: Long, val at: Long, val elapsedMs: Long, val category: String,
    val code: String, val details: Map<String, Any>)

object NativeDiagnosticModel {
    const val VERSION = 1
    const val MAX_ENTRIES = 800
    const val RETENTION_DAYS = 7
    const val RETENTION_MS = RETENTION_DAYS * 24 * 3600_000L
    private val categories = setOf("alarm", "bedtime", "reminder", "system", "pc")
    private val numbers = setOf("targetAt", "driftMs", "alarmVolume", "alarmVolumeMax", "interruptionFilter", "channelImportance",
        "focusChange", "focusResult", "playerSource", "playerError", "playerExtra", "displayState", "remainingMs", "timeoutMs", "sdk", "observedAt", "count", "routedDeviceType")
    private val booleans = setOf("interactive", "keyguardLocked", "userUnlocked", "alarmMuted", "notificationsEnabled", "exactAllowed",
        "fullScreenAllowed", "batteryIgnored", "powerSave", "bluetooth", "wired", "overlayAllowed", "accepted", "started", "foreground", "attached", "alarmEnabled")
    private val reasons = setOf("boot", "locked-boot", "package-replaced", "time-changed", "timezone-changed", "exact-permission-changed", "system", "config", "fired", "timeout", "stopped", "snoozed", "smart-fired", "smart-prepared", "morning-confirmed", "legacy-fire", "unknown", "qr", "nfc", "math", "emergency", "locked", "prewake", "wakecheck", "test", "test-stop", "invalid-target", "replaced-target", "already-consumed", "priority", "ignored", "no-active-alarm", "expired", "normal", "exact-fallback", "screen-off", "permission-revoked", "restart", "updated", "alarm-active", "storage-failed", "schedule-failed", "overlay-failed", "acknowledged", "interrupted", "overlay-not-drawn", "foreground-unconfirmed", "foreground-requested", "foreground-confirmed", "activity-start-failed", "inexact-schedule", "stale-session", "not-due", "focus", "quiet-hours", "budget", "channel-blocked", "quiet-finished", "quiet-disabled")
    private val codes = mapOf(
        "alarm" to setOf("scheduled", "schedule_cancelled", "schedule_fallback", "schedule_error", "reconcile", "fired_accepted", "fired_rejected",
            "service_requested", "service_start_error", "service_entered", "foreground_started", "foreground_error", "screen_wake_requested", "screen_wake_error", "screen_wake_notify_error",
            "audio_focus_result", "audio_focus_change", "audio_focus_error", "player_started", "player_error", "player_route_changed", "tone_started", "tone_error", "audio_stopped", "service_destroyed",
            "stop_requested", "stop_error", "snooze_accepted", "snooze_rejected", "timeout", "smart_fired_accepted", "smart_fired_rejected", "test_confirmed", "fallback_posted", "fallback_error"),
        "bedtime" to setOf("scheduled", "schedule_failed", "due_received", "due_rejected", "due_accepted", "overlay_requested", "overlay_attached", "foreground_requested", "foreground_confirmed", "foreground_unconfirmed", "foreground_failed", "stopped", "acknowledged", "session_skipped", "session_error", "app_paused", "quiet_scheduled", "quiet_posted", "quiet_deferred", "quiet_snoozed", "quiet_stopped", "quiet_expired", "quiet_source_rejected"),
        "system" to setOf("reconcile", "journal_dropped"),
        "reminder" to setOf("scheduled", "delivered", "delivery_rejected", "action_accepted", "action_rejected"),
        "pc" to setOf("connected", "disconnected", "ack_accepted", "ack_rejected"),
    )
    fun valid(category: String, code: String): Boolean = category in categories && code in (codes[category] ?: emptySet())
    fun details(values: Map<String, Any>): Map<String, Any> = values.mapNotNull { (key, value) ->
        when {
            key in numbers && value is Number && value.toDouble().isFinite() && value.toDouble() % 1.0 == 0.0 && kotlin.math.abs(value.toDouble()) <= 9_007_199_254_740_991.0 -> key to value.toLong()
            key in booleans && value is Boolean -> key to value
            key == "audioSource" && value in setOf("alarm-default", "notification-default", "ringtone-default", "generated") -> key to value
            key == "kind" && value in setOf("main", "snooze", "prewake", "wakecheck", "test") -> key to value
            key == "reasonCode" && value is String -> key to if (value in reasons) value else "unknown"
            key == "errorClass" && value is String && value.matches(Regex("(?:[A-Za-z][A-Za-z0-9_$]{0,79})?(?:Exception|Error)")) -> key to value
            key == "outputTypes" && value is List<*> && value.size <= 32 && value.all { it is Int && it in 0..100 } -> key to value.toList()
            else -> null
        }
    }.toMap()

    /** Sequence order survives wall-clock rollback. Future rows are bounded by count, not silently erased. */
    fun retain(entries: List<NativeDiagnosticEntry>, now: Long): List<NativeDiagnosticEntry> = entries
        .filter { it.at >= 0 && (it.at > now || now - it.at <= RETENTION_MS) }
        .sortedBy { it.seq }.takeLast(MAX_ENTRIES)

    fun append(entries: List<NativeDiagnosticEntry>, entry: NativeDiagnosticEntry, now: Long): List<NativeDiagnosticEntry> {
        val retained = retain(entries, now)
        if (entry.code in setOf("scheduled", "reconcile")) {
            val related = if (entry.code == "scheduled") setOf("scheduled", "schedule_cancelled", "schedule_fallback", "schedule_error") else setOf("reconcile")
            val previous = retained.lastOrNull { it.category == entry.category && it.code in related && it.details["kind"] == entry.details["kind"] }
            val stable = entry.details - "observedAt"
            if (previous?.code == entry.code && previous.details - "observedAt" == stable) return retained
        }
        return retain(retained + entry, now)
    }
}
