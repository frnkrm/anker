package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class ReturnCheckReminderTest {
    private val now = AlarmPlanner.toUtc(java.time.LocalDate.parse("2026-11-02"), 1140)
    private val entry = ReminderEntry("return-check:visit", "2026-11-02", now, "sanft", "Status prüfen", "", false, 2, 1, false,
        revision = "current", token = "once", validUntil = now + 60 * 60_000)

    @Test fun offenerTerminErlaubtBewusstGewaehltRueckfrageAberFokusUndNachtruheBleiben() {
        assertTrue(ReminderLogic.allowed(entry, now, ReminderPolicy(ranges = listOf(ReminderQuietRange(now - 1, now + 1))), 0))
        assertFalse(ReminderLogic.allowed(entry, now, ReminderPolicy(), now + 1))
        assertFalse(ReminderLogic.allowed(entry, now, ReminderPolicy(quietStart = 1100, quietEnd = 1200), 0))
        assertEquals("now", ReminderLogic.tapDestination(entry.key))
    }
    @Test fun keineSpaeteOderManipulierteRueckfrageUndKeinWeckerVerdraengen() {
        assertFalse(ReminderLogic.validAt(entry, entry.validUntil))
        for (bad in listOf(entry.copy(validUntil = 0), entry.copy(actions = true), entry.copy(critical = true), entry.copy(exact = true))) {
            assertFalse(ReminderLogic.validAt(bad, now))
        }
        assertNull(ReminderLogic.place(emptyList(), entry, now, true).slot)
        val shown = ReminderLogic.place(emptyList(), entry, now, false).slots
        assertEquals(shown, ReminderLogic.obsolete(shown, emptySet(), now + 1, emptyMap()))
    }
}
