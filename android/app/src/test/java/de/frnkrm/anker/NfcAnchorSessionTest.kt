package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class NfcAnchorSessionTest {
    @Test fun startsOnlyExplicitlyAndNeverOverwritesAnActiveAttempt() {
        val session = NfcAnchorSession()
        assertNull(session.current)
        val first = session.begin("first", 10)!!
        assertNull(session.begin("second", 20))
        assertEquals(first, session.current)
        session.cancel()
        assertNull(session.current)
    }
    @Test fun malformedSessionOrOverflowNeverStarts() {
        for (id in listOf("", "a".repeat(81), "private/note", "\n")) assertNull(NfcAnchorSession().begin(id, 0))
        assertNull(NfcAnchorSession().begin("valid", -1))
        assertNull(NfcAnchorSession().begin("valid", Long.MAX_VALUE))
    }
    @Test fun oneReadAndOneExplicitConfirmationWithinOriginalDeadline() {
        val session = NfcAnchorSession()
        val first = session.begin("first", 10)!!
        assertTrue(session.read(first.generation, "prep", 20, true))
        assertFalse(session.read(first.generation, "now", 30, true))
        assertEquals(first.deadline, session.current!!.deadline)
        assertTrue(session.confirm("first", "prep", first.deadline - 1, true))
        assertFalse(session.confirm("first", "prep", first.deadline - 1, true))
        assertNull(session.current)
    }
    @Test fun prematureConfirmationCannotStrandAnActiveScan() {
        val session = NfcAnchorSession(); val first = session.begin("first", 0)!!
        assertFalse(session.confirm("first", "now", 1, true))
        assertEquals(first, session.current)
        assertTrue(session.read(first.generation, "now", 2, true))
    }
    @Test fun oldResultsCancellationAndConfirmationCannotBorrowNewSession() {
        val session = NfcAnchorSession(); val first = session.begin("first", 0)!!
        assertTrue(session.cancel("first"))
        val second = session.begin("second", 5)!!
        assertFalse(session.read(first.generation, "now", 6, true))
        assertFalse(session.cancel("first"))
        assertFalse(session.confirm("first", "now", 6, true))
        assertEquals(second, session.current)
    }
    @Test fun invalidOrIneligibleReadsDoNotCreateAPreview() {
        val session = NfcAnchorSession(); val first = session.begin("first", 0)!!
        assertFalse(session.read(first.generation, "alarm", 1, true))
        assertFalse(session.read(first.generation, "now", 1, false))
        assertFalse(session.read(first.generation, "now", first.deadline, true))
        assertNull(session.current!!.target)
    }
    @Test fun expiredBlockedOrChangedPreviewCannotOpenOrBeRetried() {
        for (reason in listOf("expired", "blocked", "changed")) {
            val session = NfcAnchorSession(); val first = session.begin("first", 10)!!
            assertTrue(session.read(first.generation, "recover", 20, true))
            assertFalse(session.confirm("first", if (reason == "changed") "now" else "recover", if (reason == "expired") first.deadline else 30, reason != "blocked"))
            assertNull(session.current)
            assertFalse(session.confirm("first", "recover", 31, true))
        }
    }
    @Test fun abortClearsPreviewAndDoesNotRestartOnForeground() {
        val session = NfcAnchorSession(); val first = session.begin("first", 0)!!
        session.read(first.generation, "recover", 1, true)
        session.cancel()
        assertFalse(session.valid(first.generation, 2, true))
        assertFalse(session.confirm("first", "recover", 2, true))
        assertNull(session.current)
    }
}
