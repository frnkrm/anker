package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class BedtimePromptDeliveryTest {
    private class Backend(val actions: MutableList<String>, val exactFailure: Exception? = null, val inexactFailure: Exception? = null) : BedtimePromptDeliveryBackend {
        override fun exactIdleCpuCheck(atElapsed: Long) { actions.add("exact:$atElapsed"); exactFailure?.let { throw it } }
        override fun inexactIdleCpuCheck(atElapsed: Long) { actions.add("inexact:$atElapsed"); inexactFailure?.let { throw it } }
    }

    @Test fun existingExactPermissionUsesOneIdleCpuCheckAtTheOriginalMonotoneDeadline() {
        val actions = mutableListOf<String>()
        BedtimePromptDelivery.schedule(true, 123_456L, Backend(actions)) { actions.add("precision-lost") }
        assertEquals(listOf("exact:123456"), actions)
    }

    @Test fun revokedExactPermissionPersistsLostPrecisionBeforeTheSingleFallbackAtTheSameDeadline() {
        val actions = mutableListOf<String>()
        BedtimePromptDelivery.schedule(true, 234_567L, Backend(actions, SecurityException())) { actions.add("precision-lost") }
        assertEquals(listOf("exact:234567", "precision-lost", "inexact:234567"), actions)
    }

    @Test fun missingPermissionUsesTheInexactIdleCheckWithoutPretendingPrecision() {
        val actions = mutableListOf<String>()
        BedtimePromptDelivery.schedule(false, 345_678L, Backend(actions)) { actions.add("unexpected") }
        assertEquals(listOf("inexact:345678"), actions)
    }

    @Test fun systemFailuresAreNotSilentlyTurnedIntoSuccessfulSchedulingOrLoops() {
        for (exact in listOf(true, false)) {
            val actions = mutableListOf<String>()
            val error = IllegalStateException("synthetic")
            try {
                BedtimePromptDelivery.schedule(exact, 456_789L, Backend(actions, error, error)) { actions.add("unexpected") }
                fail("system error must reach the existing controller failure path")
            } catch (caught: IllegalStateException) { assertSame(error, caught) }
            assertEquals(listOf(if (exact) "exact:456789" else "inexact:456789"), actions)
        }
    }

    @Test fun failedPersistencePreventsAnUnreportedInexactFallback() {
        val actions = mutableListOf<String>()
        try {
            BedtimePromptDelivery.schedule(true, 567_890L, Backend(actions, SecurityException())) { throw IllegalStateException("synthetic persistence failure") }
            fail("storage error must stop fallback")
        } catch (_: IllegalStateException) { }
        assertEquals(listOf("exact:567890"), actions)
    }
}
