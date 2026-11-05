package de.frnkrm.anker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReminderModelTest {
    private val now = 1_000_000_000L
    private fun e(key: String, slot: Int, rank: Int, at: Long = now, snoozes: Int = 0) =
        ReminderEntry(key, "2026-11-04", at, "sanft", key, "", true, slot, rank, true, snoozes)

    @Test
    fun fuenfEreignisseErgebenHoechstensDreiSichtbare() {
        var slots = emptyList<SlotEntry>()
        val events = listOf(e("a", 0, 2), e("b", 1, 4), e("c", 2, 1), e("d", 0, 2), e("f", 2, 1))
        for (ev in events) slots = ReminderLogic.place(slots, ev, now, false).slots
        assertTrue(slots.size <= 3)
        assertEquals(setOf("d", "b", "f"), slots.map { it.key }.toSet())
    }

    @Test
    fun harterTerminVerschwindetNichtWegenKleinigkeit() {
        val hard = ReminderLogic.place(emptyList(), e("leave", 1, 4), now, false).slots
        val p = ReminderLogic.place(hard, e("trivia", 1, 1), now, false)
        assertEquals(ReminderLogic.SLOT_LATEST, p.slot)
        assertEquals("leave", p.slots.first { it.slot == ReminderLogic.SLOT_HARD }.key)
    }

    @Test
    fun beimKlingelnBleibtDerDritteSlotFrei() {
        val two = listOf(SlotEntry(0, "x", "d", 2, now + 1000), SlotEntry(1, "y", "d", 4, now + 1000))
        val p = ReminderLogic.place(two, e("trivia", 2, 1), now, true)
        assertNull(p.slot)
        assertEquals(2, p.slots.size)
    }

    @Test
    fun geplantesGehtBeimErsetzenNichtVerloren() {
        val snoozed = e("leave", 1, 4, now + 100, snoozes = 1)
        val q = ReminderLogic.replace(listOf(snoozed, e("alt", 0, 2, now + 50)), listOf(e("leave", 1, 4, now + 5), e("neu", 0, 2, now + 9)), now)
        assertEquals(listOf("neu", "leave"), q.map { it.key })
        assertEquals(1, q.last().snoozes)
    }

    @Test
    fun keinStauNachLangerPause() {
        val q = listOf(
            e("uralt", 0, 2, now - 3 * 24 * 3600_000L),
            e("leave", 1, 4, now - 10 * 60_000L),
            e("leave", 1, 4, now - 5 * 60_000L),
            e("zukunft", 0, 2, now + 1000),
        )
        val r = ReminderLogic.takeDue(q, now)
        assertEquals(listOf("leave"), r.due.map { it.key })
        assertEquals(now - 5 * 60_000L, r.due.single().at)
        assertEquals(listOf("zukunft"), r.remaining.map { it.key })
    }

    @Test
    fun schlummernErzeugtKeineDuplikateUndIstBegrenzt() {
        val source = e("leave", 1, 4)
        val q1 = ReminderLogic.snooze(listOf(source, e("leave", 1, 4, now + 300_000), e("x", 0, 2, now + 1)), source, now)
        assertNotNull(q1)
        assertEquals(1, q1!!.count { it.key == "leave" })
        assertNull(ReminderLogic.snooze(q1, source.copy(snoozes = 2), now))
    }

    @Test
    fun erledigtesVerschwindetAusSlots() {
        val slots = listOf(SlotEntry(1, "leave", "d", 4, now + 1000), SlotEntry(0, "morning", "d", 2, now - 1))
        val gone = ReminderLogic.obsolete(slots, setOf("d|morning"), now)
        assertEquals(setOf("leave", "morning"), gone.map { it.key }.toSet())
    }
}
