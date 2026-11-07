package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class AudioPlaybackLeaseTest {
    @Test fun rejectedOrDelayedFocusCannotStartOrResumeAudio() {
        val lease = AudioPlaybackLease()
        val id = lease.begin()
        assertFalse(lease.permits(id))
        assertFalse(lease.requested(id, false))
        assertFalse(lease.gain(id))
        assertFalse(lease.permits(id))
    }

    @Test fun onlyTransientLossCanResumeAnUnfinishedSession() {
        val lease = AudioPlaybackLease()
        val id = lease.begin()
        assertTrue(lease.requested(id, true))
        assertFalse(lease.gain(id)) // Kein zweiter Player bei doppeltem GAIN.
        assertTrue(lease.lose(id, true))
        assertFalse(lease.permits(id))
        assertTrue(lease.gain(id))
        assertTrue(lease.permits(id))
        assertTrue(lease.lose(id, false))
        assertFalse(lease.gain(id))
        assertFalse(lease.permits(id))
    }

    @Test fun oldPreWakeFocusCannotStopOrRestartTheMainAlarm() {
        val lease = AudioPlaybackLease()
        val preWake = lease.begin()
        assertTrue(lease.requested(preWake, true))
        assertTrue(lease.lose(preWake, true))
        val main = lease.begin()
        assertTrue(lease.requested(main, true))
        assertFalse(lease.gain(preWake))
        assertFalse(lease.lose(preWake, false))
        assertFalse(lease.requested(preWake, false))
        assertTrue(lease.permits(main))
    }

    @Test fun stoppedOrTimedOutSessionCannotResumeAfterLateFocusGain() {
        val lease = AudioPlaybackLease()
        val old = lease.begin()
        assertTrue(lease.requested(old, true))
        assertTrue(lease.lose(old, true))
        lease.cancel()
        assertFalse(lease.gain(old))
        assertFalse(lease.permits(old))
        val next = lease.begin()
        assertTrue(lease.requested(next, true))
        assertFalse(lease.lose(old, false))
        assertTrue(lease.permits(next))
    }

    @Test fun oldPreviewDeadlineCannotStopANewPreviewOrItsFocus() {
        val lease = AudioPlaybackLease()
        val oldPreview = lease.begin()
        assertTrue(lease.requested(oldPreview, true))
        lease.cancel() // Pause, Alarm oder Messstart beendet die erste Vorschau.
        val nextPreview = lease.begin()
        assertTrue(lease.requested(nextPreview, true))
        assertFalse(lease.permits(oldPreview)) // Alter Drei-Sekunden-Timer darf nicht stoppen.
        assertFalse(lease.lose(oldPreview, false))
        assertTrue(lease.permits(nextPreview))
    }
}
