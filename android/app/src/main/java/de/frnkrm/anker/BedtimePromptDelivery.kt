package de.frnkrm.anker

/** Kleine testbare Systemgrenze; Termin und Sitzungsbesitz bleiben beim bestehenden Controller. */
interface BedtimePromptDeliveryBackend {
    fun exactIdleCpuCheck(atElapsed: Long)
    fun inexactIdleCpuCheck(atElapsed: Long)
}

object BedtimePromptDelivery {
    /** Nur entzogene Exact-Freigabe erhält einen inexact Fallback. Andere Fehler bleiben Fehler. */
    fun schedule(exact: Boolean, atElapsed: Long, backend: BedtimePromptDeliveryBackend, precisionLost: () -> Unit) {
        if (!exact) { backend.inexactIdleCpuCheck(atElapsed); return }
        try { backend.exactIdleCpuCheck(atElapsed) }
        catch (_: SecurityException) {
            precisionLost()
            backend.inexactIdleCpuCheck(atElapsed)
        }
    }

    /** One non-wakeup check; there is deliberately no exact/idle/foreground fallback. */
    fun nextQuietCheck(s: BedtimePromptState, elapsed: Long): Long? {
        if (s.phase != BedtimePromptPhase.QUIET || elapsed >= s.quietUntilElapsed) return null
        return if (elapsed < s.quietDueElapsed) minOf(s.quietDueElapsed, s.quietUntilElapsed)
            else elapsed + minOf(BedtimePromptModel.QUIET_SNOOZE_MS, s.quietUntilElapsed - elapsed)
    }

    /** Rechecked immediately before posting, independently of a former display observation. */
    fun canPostQuiet(s: BedtimePromptState, id: String, token: String, elapsed: Long, boot: Int, wall: Long,
                     interactive: Boolean, displayState: Int?, unlocked: Boolean, alarmActive: Boolean,
                     notificationsEnabled: Boolean, channelImportance: Int, channelSound: Boolean,
                     channelVibration: Boolean, channelLights: Boolean): Boolean =
        s.sessionId == id && token.isNotBlank() && s.quietToken == token &&
            BedtimePromptModel.quietReady(s, elapsed, boot, wall, interactive, displayState, unlocked, alarmActive) && notificationsEnabled &&
            channelImportance in 1..2 && !channelSound && !channelVibration && !channelLights
}
