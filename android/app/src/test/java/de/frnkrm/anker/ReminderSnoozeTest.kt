package de.frnkrm.anker

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test

class ReminderSnoozeTest {
    private val now = AlarmPlanner.toUtc(LocalDate.parse("2026-11-12"), 21 * 60)
    private val source = ReminderEntry("evening", "2026-11-12", now, "sanft", "Allgemeiner Hinweis", "", true,
        ReminderLogic.SLOT_FOCUS, 2, true, revision = "current-plan", token = "original-delivery")
    private fun atDue() = ReminderLogic.snooze(emptyList(), source, now)!!.single()

    @Test fun ausdruecklichesVerschiebenGehtBeiFokusAmZielNichtVerloren() {
        val end = now + 8 * 60_000L
        val next = ReminderLogic.requestSnooze(emptyList(), source, now, ReminderPolicy(), end)!!.single()
        assertEquals(end, next.at)
        assertEquals(now + ReminderLogic.SNOOZE_MS, PcReminderGate.originalAt(next))
        assertEquals(source.revision, next.revision)
        assertNotEquals(source.token, next.token)
        assertEquals(1, next.snoozes)
    }

    @Test fun globaleRuheUndPlanruheWerdenNichtDurchSnoozeUmgangen() {
        val quietStart = AlarmPlanner.toUtc(LocalDate.parse("2026-11-12"), 21 * 60 + 4)
        val quietEnd = AlarmPlanner.toUtc(LocalDate.parse("2026-11-12"), 21 * 60 + 9)
        val rangeEnd = quietEnd + 2 * 60_000L
        val policy = ReminderPolicy(21 * 60 + 4, 21 * 60 + 9, listOf(ReminderQuietRange(quietStart, rangeEnd)))
        val next = ReminderLogic.requestSnooze(emptyList(), source, now, policy, 0)!!.single()
        assertTrue(next.at >= rangeEnd)
        assertFalse(ReminderLogic.allowed(next, now + ReminderLogic.SNOOZE_MS, policy, 0))
        assertTrue(ReminderLogic.allowed(next, next.at, policy, 0))
    }

    @Test fun fehlenderPlatzBeiLaufendemWeckerBehaeltSnoozeOhneTokenverbrauch() {
        val due = atDue()
        val round = PcReminderGate.capture(null, { null }, due.at).prepare(listOf(due))
        val placement = ReminderLogic.place(emptyList(), round.deliveries.single(), due.at, 3)
        assertNull(placement.slot)
        val retry = ReminderLogic.retrySnooze(round.deliveries.single(), due.at, ReminderPolicy(), 0)!!
        assertEquals(due.token, retry.token)
        assertEquals(due.revision, retry.revision)
        assertEquals(due.snoozes, retry.snoozes)
        assertEquals(due.at, PcReminderGate.originalAt(retry))
        assertTrue(retry.at > due.at)
        assertFalse(ReminderLogic.consumeTokens(emptyMap(), round.consumed.filter { it.token != retry.token }).containsKey(retry.token))
        val nextRound = PcReminderGate.capture(null, { null }, retry.at).prepare(listOf(retry))
        assertNotNull(ReminderLogic.place(emptyList(), nextRound.deliveries.single(), retry.at, 0).slot)
    }

    @Test fun hoehererTerminBleibtVorrangigUndAbgelehnterPostKannErneutVersuchtWerden() {
        val due = atDue()
        val hard = listOf(SlotEntry(1, "leave", source.date, 4, due.at + ReminderLogic.VISIBLE_MS))
        assertNull(ReminderLogic.place(hard, due, due.at, 2).slot)
        val retry = ReminderLogic.retrySnooze(due, due.at, ReminderPolicy(), 0)!!
        assertEquals(due.token, retry.token)
        assertEquals(hard, ReminderLogic.trimToBudget(hard, retry.at, 2))
        assertEquals(due.token, ReminderLogic.retrySnooze(due, due.at, ReminderPolicy(), 0)!!.token)
    }

    @Test fun wiederholtesWartenVerlaengertDieDreissigMinutenFrischeNicht() {
        val due = atDue()
        val first = ReminderLogic.retrySnooze(due, due.at, ReminderPolicy(), 0)!!
        val second = ReminderLogic.retrySnooze(first, first.at, ReminderPolicy(), 0)!!
        assertEquals(due.at, PcReminderGate.originalAt(second))
        assertNull(ReminderLogic.retrySnooze(second, due.at + ReminderLogic.STALE_MS, ReminderPolicy(), 0))
        assertTrue(ReminderLogic.takeDue(listOf(second), due.at + ReminderLogic.STALE_MS + 1).due.isEmpty())
        assertNull(ReminderLogic.retrySnooze(source, source.at, ReminderPolicy(), 0))
    }

    @Test fun appAbgleichBehaeltRetryUndVerwirftWeiterhinGeaenderteOderEntferntePlaene() {
        val due = atDue()
        val retry = ReminderLogic.retrySnooze(due, due.at, ReminderPolicy(), 0)!!
        val key = "${source.date}|${source.key}"
        val revisions = mapOf(key to source.revision)
        val originalEscalation = source.copy(at = retry.at + 1000, token = "original-later")
        assertEquals(listOf(retry), ReminderLogic.replace(listOf(retry), listOf(originalEscalation), revisions.keys, due.at, revisions))
        assertTrue(ReminderLogic.replace(listOf(retry), emptyList(), emptySet(), due.at, emptyMap()).isEmpty())
        val changed = originalEscalation.copy(revision = "different-plan", token = "different-token")
        assertEquals(listOf(changed), ReminderLogic.replace(listOf(retry), listOf(changed), setOf(key), due.at, mapOf(key to changed.revision)))
    }

    @Test fun langeNachtruheWirdNichtZumSpaetenWeckauftrag() {
        val policy = ReminderPolicy(21 * 60 + 4, 7 * 60)
        val next = ReminderLogic.requestSnooze(emptyList(), source, now, policy, 0)!!.single()
        assertEquals(now + ReminderLogic.SNOOZE_MS, PcReminderGate.originalAt(next))
        assertTrue(next.at <= PcReminderGate.originalAt(next) + ReminderLogic.STALE_MS + 1)
        assertTrue(ReminderLogic.takeDue(listOf(next), next.at).due.isEmpty())
    }

    @Test fun ungesperrterSnoozeBleibtBeiFuenfMinutenUndAmZweitenLimit() {
        val first = ReminderLogic.requestSnooze(emptyList(), source, now, ReminderPolicy(), 0)!!.single()
        assertEquals(now + ReminderLogic.SNOOZE_MS, first.at)
        assertEquals(0L, first.deferredFrom)
        val second = ReminderLogic.requestSnooze(emptyList(), first, first.at, ReminderPolicy(), 0)!!.single()
        assertEquals(2, second.snoozes)
        assertNull(ReminderLogic.requestSnooze(emptyList(), second, second.at, ReminderPolicy(), 0))
        assertTrue(second.actions)
    }
}
