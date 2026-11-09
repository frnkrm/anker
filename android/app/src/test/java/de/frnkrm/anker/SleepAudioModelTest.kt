package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class SleepAudioModelTest {
    @Test fun fadeIsLinearBoundedAndEndsAtTheDeadline() {
        val duration = 20 * 60_000L
        assertEquals(0.3f, SleepAudioModel.volume(0.3, 0, duration), 0.00001f)
        assertEquals(0.15f, SleepAudioModel.volume(0.3, duration / 2, duration), 0.00001f)
        assertEquals(0f, SleepAudioModel.volume(0.3, duration, duration), 0f)
        assertEquals(0f, SleepAudioModel.volume(0.3, duration + 1, duration), 0f)
        assertEquals(0.3f, SleepAudioModel.volume(0.3, -1, duration), 0f)
    }

    @Test fun invalidVolumeAndUnboundedDurationAreRejected() {
        for (volume in listOf(Double.NaN, Double.POSITIVE_INFINITY, -0.1, 0.61)) {
            try { SleepAudioModel.volume(volume, 0, 60_000); fail("Invalid volume") } catch (_: IllegalArgumentException) { }
        }
        try { SleepAudioModel.volume(0.2, 0, 61 * 60_000L); fail("Unbounded session") } catch (_: IllegalArgumentException) { }
    }

    @Test fun noiseIsGeneratedLocallyAndStaysInsideSafePcmBounds() {
        val first = ShortArray(4096)
        val second = ShortArray(4096)
        BrownNoiseGenerator(42).fill(first)
        BrownNoiseGenerator(42).fill(second)
        assertArrayEquals(first, second)
        assertTrue(first.any { it != 0.toShort() })
        assertTrue(first.all { kotlin.math.abs(it.toInt()) <= (Short.MAX_VALUE * 0.8).toInt() })
        assertTrue((1 until first.size).all { kotlin.math.abs(first[it].toInt() - first[it - 1].toInt()) < 5_000 })
    }
}
