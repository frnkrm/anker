package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class PreWakeFadeModelTest {
    @Test fun gainStartsAtZeroAndReachesOnlyTheRequestedPlayerVolume() {
        assertEquals(0f, PreWakeFadeModel.volume(0, 0.6f), 0f)
        assertEquals(0.3f, PreWakeFadeModel.volume(30_000, 0.6f), 0.0001f)
        assertEquals(0.6f, PreWakeFadeModel.volume(60_000, 0.6f), 0f)
        assertEquals(0.6f, PreWakeFadeModel.volume(120_000, 0.6f), 0f)
    }
    @Test fun clockRollbackCannotCreateANegativeGain() {
        assertEquals(0f, PreWakeFadeModel.volume(-1, 0.6f), 0f)
    }
}
