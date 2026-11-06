package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class VoiceModelTest {
    @Test fun noInventedTranscript() { assertNull(VoiceModel.transcript(emptyList())); assertNull(VoiceModel.transcript(listOf("  ", "\n"))) }
    @Test fun firstRealLocalResultIsBounded() { assertEquals("Gedanke", VoiceModel.transcript(listOf(" ", " Gedanke ", "Andere Idee"))); assertEquals(3000, VoiceModel.transcript(listOf("a".repeat(4000)))!!.length) }
    @Test fun controlsAreNotKept() { assertEquals("Eine\nIdee", VoiceModel.transcript(listOf("Eine\u0000\nIdee"))) }
    @Test fun cancelledPermissionCannotBorrowANewerRequest() {
        val lease = VoiceRequestLease()
        lease.begin("first")
        lease.cancel()
        lease.begin("second")
        assertFalse(lease.accepts("first"))
        assertTrue(lease.accepts("second"))
        lease.cancel()
        assertFalse(lease.accepts("second"))
    }
    @Test fun emptyLeaseNeverStartsAnEngine() {
        val lease = VoiceRequestLease()
        lease.begin("")
        assertFalse(lease.accepts(""))
    }
}
