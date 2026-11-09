package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class AlarmPlaybackModelTest {
    private val start = 1_000_000L
    private fun state(kind: AlarmKind = AlarmKind.MAIN) = AlarmState(ringing=kind, ringStartedAt=start)
    @Test fun runtimeErrorCanAdvanceThroughOnlyThreeSourcesThenGeneratedFallback() {
        assertEquals(1, AlarmPlaybackModel.nextSource(0))
        assertEquals(2, AlarmPlaybackModel.nextSource(1))
        assertEquals(AlarmPlaybackModel.MEDIA_SOURCE_COUNT, AlarmPlaybackModel.nextSource(2))
        assertEquals(AlarmPlaybackModel.MEDIA_SOURCE_COUNT, AlarmPlaybackModel.nextSource(3))
        assertTrue(AlarmPlaybackModel.mayPlay(state(), AlarmKind.MAIN, start, start+1, true))
    }
    @Test fun fallbackNeverRestartsStoppedReplacedTimedOutOrUnfocusedAlarm() {
        assertFalse(AlarmPlaybackModel.mayPlay(state().copy(ringing=null), AlarmKind.MAIN, start, start+1, true))
        assertFalse(AlarmPlaybackModel.mayPlay(state(AlarmKind.PRE_WAKE), AlarmKind.MAIN, start, start+1, true))
        assertFalse(AlarmPlaybackModel.mayPlay(state().copy(ringStartedAt=start+1), AlarmKind.MAIN, start, start+1, true))
        assertFalse(AlarmPlaybackModel.mayPlay(state(), AlarmKind.MAIN, start, start+AlarmKind.MAIN.timeoutMs, true))
        assertFalse(AlarmPlaybackModel.mayPlay(state(), AlarmKind.MAIN, start, start+1, false))
        assertFalse(AlarmPlaybackModel.mayPlay(state(), AlarmKind.MAIN, start, start-1, true))
    }
    @Test fun generatedPulsesRemainWithinOriginalTimeLimitAndFocusLease() {
        val lease = AudioPlaybackLease()
        val id = lease.begin(); assertTrue(lease.requested(id,true))
        for (elapsed in listOf(0L, AlarmPlaybackModel.FALLBACK_GAP_MS, AlarmKind.MAIN.timeoutMs-1)) assertTrue(AlarmPlaybackModel.mayPlay(state(),AlarmKind.MAIN,start,start+elapsed,lease.permits(id)))
        assertTrue(lease.lose(id,true))
        assertFalse(AlarmPlaybackModel.mayPlay(state(),AlarmKind.MAIN,start,start+2000,lease.permits(id)))
        lease.cancel()
        assertFalse(AlarmPlaybackModel.mayPlay(state(),AlarmKind.MAIN,start,start+3000,lease.permits(id)))
    }
}
