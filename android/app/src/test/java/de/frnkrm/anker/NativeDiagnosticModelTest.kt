package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class NativeDiagnosticModelTest {
    private val now = 1_000_000_000L
    private fun row(seq: Long, at: Long = now, details: Map<String, Any> = emptyMap(), code: String = "scheduled") =
        NativeDiagnosticEntry(seq, at, seq * 1000, "alarm", code, details)

    @Test fun journalAcceptsOnlyKnownTechnicalCodesAndNoPrivateTextKeys() {
        assertTrue(NativeDiagnosticModel.valid("alarm", "player_error"))
        assertTrue(NativeDiagnosticModel.valid("bedtime", "overlay_attached"))
        assertFalse(NativeDiagnosticModel.valid("alarm", "private-text"))
        assertFalse(NativeDiagnosticModel.valid("health", "scheduled"))
        val safe = NativeDiagnosticModel.details(mapOf("targetAt" to now, "interactive" to true, "label" to "PRIVATE", "qr" to "PRIVATE", "errorMessage" to "PRIVATE", "uri" to "content://PRIVATE", "alarmVolume" to Double.NaN, "playerSource" to 0.5, "outputTypes" to listOf(2, 8), "reasonCode" to "PRIVATE"))
        assertEquals(mapOf("targetAt" to now, "interactive" to true, "outputTypes" to listOf(2,8), "reasonCode" to "unknown"), safe)
        assertFalse(safe.toString().contains("PRIVATE"))
    }

    @Test fun reasonCodesAndErrorClassesAreBoundedAndNotExceptionMessages() {
        assertEquals("screen-off", NativeDiagnosticModel.details(mapOf("reasonCode" to "screen-off"))["reasonCode"])
        assertEquals("time-changed", NativeDiagnosticModel.details(mapOf("reasonCode" to "time-changed"))["reasonCode"])
        for (name in listOf("Exception", "IllegalStateException", "SecurityException", "OutOfMemoryError")) assertEquals(name, NativeDiagnosticModel.details(mapOf("errorClass" to name))["errorClass"])
        for (name in listOf("private text Exception", "RuntimeException: private", "x".repeat(100)+"Exception")) assertFalse(NativeDiagnosticModel.details(mapOf("errorClass" to name)).containsKey("errorClass"))
        assertTrue(NativeDiagnosticModel.details(mapOf("outputTypes" to listOf("PRIVATE"))).isEmpty())
    }

    @Test fun retentionKeepsSevenDayBoundaryAndDropsOlderFacts() {
        val old = row(1, now - NativeDiagnosticModel.RETENTION_MS - 1)
        val boundary = row(2, now - NativeDiagnosticModel.RETENTION_MS)
        assertEquals(listOf(boundary), NativeDiagnosticModel.retain(listOf(old, boundary), now))
    }

    @Test fun clockRollbackKeepsFutureEvidenceInSequenceOrderAndStillBoundsSize() {
        val rows = (1L..900L).map { row(it, now + it * 1000) }.reversed()
        val kept = NativeDiagnosticModel.retain(rows, now - 60_000)
        assertEquals(800, kept.size)
        assertEquals(101L, kept.first().seq)
        assertEquals(900L, kept.last().seq)
    }

    @Test fun repeatedPlanningWithOnlySnapshotTimeChangedDoesNotFillTheJournal() {
        val first = row(1, details = mapOf("kind" to "main", "targetAt" to now + 10000, "observedAt" to now))
        val repeated = row(2, details = first.details + ("observedAt" to now + 1000))
        assertEquals(listOf(first), NativeDiagnosticModel.append(listOf(first), repeated, now))
        val changed = repeated.copy(seq=3, details=repeated.details + ("targetAt" to now + 20000))
        assertEquals(listOf(first, changed), NativeDiagnosticModel.append(listOf(first), changed, now))
        val denied = repeated.copy(seq=4, details=repeated.details + ("exactAllowed" to false))
        assertEquals(listOf(first, denied), NativeDiagnosticModel.append(listOf(first), denied, now))
    }

    @Test fun separateActualFiringsAndPlayerErrorsAreNeverDeduplicated() {
        for (code in listOf("fired_accepted", "fired_rejected", "player_error")) {
            val first = row(1, code=code)
            val second = row(2, code=code)
            assertEquals(listOf(first,second), NativeDiagnosticModel.append(listOf(first), second, now))
        }
    }
    @Test fun cancellingOrFailedSchedulingIsNotHiddenByAnOlderIdenticalPlan() {
        val first = row(1, details=mapOf("kind" to "main", "targetAt" to now+10000))
        for (transition in listOf("schedule_cancelled", "schedule_fallback", "schedule_error")) {
            val intervening = row(2, details=mapOf("kind" to "main"), code=transition)
            val rearmed = first.copy(seq=3)
            assertEquals(listOf(first,intervening,rearmed), NativeDiagnosticModel.append(listOf(first,intervening),rearmed,now))
        }
    }

}
