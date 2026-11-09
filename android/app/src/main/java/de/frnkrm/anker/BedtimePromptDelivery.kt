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
}
