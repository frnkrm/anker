package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class RoutinePaceKeeperModelTest {
    private fun spec() = RoutinePaceSpec("session", "water", "Wasser trinken", 120_000, 220_000,
        hapticsEnabled = true, speakStep = true)

    @Test fun intervalsAndThresholdsEmitOnceWithoutCompletingTheStep() {
        var state = RoutinePaceKeeperModel.sync(null, spec(), "running", 100_000)
        val intro = RoutinePaceKeeperModel.tick(state, 100_000)
        assertEquals("Wasser trinken. 2 Minuten.", intro.speech)
        assertFalse(intro.pulse)
        state = intro.state
        val half = RoutinePaceKeeperModel.tick(state, 160_000)
        assertTrue(half.pulse)
        assertNull(half.speech)
        assertFalse(RoutinePaceKeeperModel.tick(half.state, 160_001).pulse)
        val quarter = RoutinePaceKeeperModel.tick(half.state, 190_000)
        assertTrue(quarter.pulse)
        val tenth = RoutinePaceKeeperModel.tick(quarter.state, 208_000)
        assertTrue(tenth.pulse)
        assertEquals(setOf(50, 25, 10), tenth.state.passedThresholds)
        val ended = RoutinePaceKeeperModel.tick(tenth.state, 220_000)
        assertEquals("expired", ended.state.phase)
        assertFalse(ended.pulse)
        assertNull(ended.speech)
    }

    @Test fun disabledHapticsAndPausedTimersStaySilent() {
        val spec = spec().copy(hapticsEnabled = false, speakStep = false)
        val running = RoutinePaceKeeperModel.sync(null, spec, "running", 100_000)
        assertFalse(RoutinePaceKeeperModel.tick(running, 190_000).pulse)
        val paused = RoutinePaceKeeperModel.sync(running, spec, "paused", 150_000)
        val result = RoutinePaceKeeperModel.tick(paused, 190_000)
        assertEquals(paused, result.state)
        assertFalse(result.pulse)
        assertNull(result.speech)
    }

    @Test fun reopeningAndClockRollbackDoNotReplayOldPulsesOrSpeech() {
        val old = RoutinePaceKeeperModel.tick(RoutinePaceKeeperModel.sync(null, spec(), "running", 100_000), 160_000).state
        val resumed = RoutinePaceKeeperModel.sync(old, spec().copy(deadlineAt = 240_000), "running", 180_000)
        assertFalse(RoutinePaceKeeperModel.tick(resumed, 180_001).pulse)
        assertNull(RoutinePaceKeeperModel.tick(resumed, 180_001).speech)
        assertFalse(RoutinePaceKeeperModel.tick(old, 130_000).pulse)
    }

    @Test fun openingLateSkipsHistoricCuesAndOldDeadlineCannotRestart() {
        val late = RoutinePaceKeeperModel.sync(null, spec().copy(speakStep = false), "running", 205_000)
        assertFalse(RoutinePaceKeeperModel.tick(late, 205_001).pulse)
        val expired = RoutinePaceKeeperModel.sync(null, spec(), "running", 230_000)
        assertEquals("expired", expired.phase)
        assertFalse(RoutinePaceKeeperModel.tick(expired, 240_000).pulse)
    }

    @Test fun newStepGetsItsOwnIntroAndInvalidBoundsAreRejected() {
        val old = RoutinePaceKeeperModel.tick(RoutinePaceKeeperModel.sync(null, spec(), "running", 100_000), 100_000).state
        val next = RoutinePaceKeeperModel.sync(old, spec().copy(stepId = "light", title = "Licht an"), "running", 100_000)
        assertEquals("Licht an. 2 Minuten.", RoutinePaceKeeperModel.tick(next, 100_000).speech)
        for (bad in listOf(spec().copy(sessionId = ""), spec().copy(durationMs = Long.MAX_VALUE), spec().copy(intervalSeconds = 0))) {
            try { RoutinePaceKeeperModel.validate(bad); fail("Invalid request accepted") } catch (_: IllegalArgumentException) { }
        }
    }

    @Test fun enablingWhilePausedDoesNotConsumeFutureSignalsOrCatchUpOldOnes() {
        val paused = RoutinePaceKeeperModel.sync(null, spec().copy(deadlineAt = 0), "paused", 100_000)
        assertTrue(paused.passedThresholds.isEmpty())
        assertEquals(0L, paused.lastBucket)
        val resumed = RoutinePaceKeeperModel.sync(paused, spec(), "running", 100_000)
        assertFalse(RoutinePaceKeeperModel.tick(resumed, 100_000).pulse)
        assertTrue(RoutinePaceKeeperModel.tick(resumed, 160_000).pulse)
        val lateResume = RoutinePaceKeeperModel.sync(paused, spec(), "running", 160_000)
        assertFalse(RoutinePaceKeeperModel.tick(lateResume, 160_001).pulse)
        assertTrue(RoutinePaceKeeperModel.tick(lateResume, 190_000).pulse)
    }

    @Test fun quietHoursAcrossMidnightSuppressAndConsumeCuesWithoutCatchup() {
        val spec = spec().copy(quietStart = 23 * 60, quietEnd = 7 * 60)
        assertTrue(RoutinePaceKeeperModel.quietAt(spec, 0))
        assertTrue(RoutinePaceKeeperModel.quietAt(spec, 23 * 60))
        assertFalse(RoutinePaceKeeperModel.quietAt(spec, 7 * 60))
        assertFalse(RoutinePaceKeeperModel.quietAt(spec.copy(quietStart = 0, quietEnd = 0), 0))
        val initial = RoutinePaceKeeperModel.sync(null, spec, "running", 100_000)
        val silent = RoutinePaceKeeperModel.tick(initial, 160_000, quiet = true)
        assertFalse(silent.pulse); assertNull(silent.speech)
        val resumed = RoutinePaceKeeperModel.tick(silent.state, 160_001)
        assertFalse(resumed.pulse); assertNull(resumed.speech)
        assertTrue(RoutinePaceKeeperModel.tick(resumed.state, 190_000).pulse)
    }
}
