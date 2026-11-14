package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class PreparationReminderTest {
    private val now = AlarmPlanner.toUtc(java.time.LocalDate.parse("2026-11-02"), 480)
    private val e = ReminderEntry("prepare:work", "2026-11-02", now, "sanft", "Vorbereitung", "", false, 1, 3, false,
        revision = "current", token = "dated-route", validUntil = now + 20 * 60_000)
    private val revisions = mapOf("${e.date}|${e.key}" to e.revision)

    @Test fun verspaeteteZustellungEndetGenauZurAbfahrtUndNichtErstNachDreissigMinuten() {
        assertEquals(listOf(e), ReminderLogic.takeDue(listOf(e), e.validUntil - 1).due)
        assertTrue(ReminderLogic.takeDue(listOf(e), e.validUntil).due.isEmpty())
        assertFalse(ReminderLogic.allowed(e, e.validUntil, ReminderPolicy(), 0))
        assertNull(ReminderLogic.place(emptyList(), e, e.validUntil, false).slot)
        assertTrue(ReminderLogic.replace(listOf(e), emptyList(), revisions.keys, e.validUntil, revisions).isEmpty())
    }
    @Test fun sichtbareKarteUndAndroidTimeoutEndenZurAbfahrt() {
        val placement = ReminderLogic.place(emptyList(), e, now + 19 * 60_000, false)
        assertEquals(e.validUntil, placement.slots.single().expiresAt)
        assertEquals(60_000L, ReminderLogic.displayDuration(e, now + 19 * 60_000))
        assertEquals(0L, ReminderLogic.displayDuration(e, e.validUntil))
        assertEquals(placement.slots, ReminderLogic.obsolete(placement.slots, revisions.keys, e.validUntil, revisions))
        assertNull(ReminderLogic.currentAction(placement.slots, e.date, e.key, e.revision, e.token, e.validUntil))
    }
    @Test fun erledigungAbsagePlanwechselRaeumenQueueUndSichtbareKarte() {
        val shown = ReminderLogic.place(emptyList(), e, now, false).slots
        for (current in listOf(emptyMap(), revisions.mapValues { "new-plan" })) {
            assertTrue(ReminderLogic.replace(listOf(e), emptyList(), current.keys, now + 1, current).isEmpty())
            assertEquals(shown, ReminderLogic.obsolete(shown, current.keys, now + 1, current))
        }
    }
    @Test fun neuberechnungNachSchrittOderKurzmodusIstVorZustellungAktuellUndDanachKeinZweiterImpuls() {
        val changed = e.copy(at = now + 5 * 60_000, revision = "less-open")
        val current = mapOf("${e.date}|${e.key}" to changed.revision)
        assertEquals(listOf(changed), ReminderLogic.replace(listOf(e), listOf(changed), current.keys, now, current))
        val consumed = ReminderLogic.consumeTokens(emptyMap(), listOf(e))
        assertTrue(ReminderLogic.replace(emptyList(), listOf(changed), current.keys, now, current, consumed.keys).isEmpty())
        assertTrue(ReminderLogic.replace(listOf(e), emptyList(), revisions.keys, now + 1, revisions, consumed.keys).isEmpty())
    }
    @Test fun stilleFokusUndFilmgrenzenBleibenAuchBeiVerspaeteterZustellungWirksam() {
        assertTrue(ReminderLogic.allowed(e, now, ReminderPolicy(), 0))
        assertFalse(ReminderLogic.allowed(e, now, ReminderPolicy(), now + 1))
        assertFalse(ReminderLogic.allowed(e, now, ReminderPolicy(quietStart = 470, quietEnd = 490), 0))
        assertFalse(ReminderLogic.allowed(e, now, ReminderPolicy(ranges = listOf(ReminderQuietRange(now - 1, now + 1))), 0))
        assertNull(ReminderLogic.retrySnooze(e, now, ReminderPolicy(), now + 1))
    }
    @Test fun weckerUndHarteAnkerBehaltenBudgetUndVorrang() {
        val hard = SlotEntry(1, "go:visit", e.date, 4, now + ReminderLogic.VISIBLE_MS)
        val focus = SlotEntry(0, "focus", e.date, 4, now + ReminderLogic.VISIBLE_MS)
        assertNull(ReminderLogic.place(listOf(hard, focus), e, now, true).slot)
        val placed = ReminderLogic.place(listOf(hard, focus), e, now, false)
        assertEquals(2, placed.slot)
        assertEquals(3, placed.slots.size)
        assertTrue(placed.slots.containsAll(listOf(hard, focus)))
        assertEquals("now", ReminderLogic.tapDestination("prepare:commitment:PRIVATE-ID"))
    }
    @Test fun fehlendeFristOderManipulierteWirkungenWerdenAbgewiesenLegacyBleibtGueltig() {
        for (bad in listOf(e.copy(validUntil = 0), e.copy(validUntil = now), e.copy(actions = true),
            e.copy(critical = true), e.copy(exact = true), e.copy(channel = "wecker"), e.copy(quietFollowUps = true))) {
            assertFalse(ReminderLogic.validAt(bad, now))
            assertTrue(ReminderLogic.takeDue(listOf(bad), now).due.isEmpty())
        }
        val legacy = e.copy(key = "morning", validUntil = 0, actions = true, exact = true)
        assertTrue(ReminderLogic.validAt(legacy, now))
        assertEquals(ReminderLogic.VISIBLE_MS, ReminderLogic.displayDuration(legacy, now))
    }
    @Test fun festeVorwarnungMitFristKannNichtNachAbfahrtZugestelltWerden() {
        val legacy = e.copy(key = "leave-10", actions = true, channel = "uebergang", exact = true)
        assertTrue(ReminderLogic.allowed(legacy, now, ReminderPolicy(), 0))
        assertTrue(ReminderLogic.takeDue(listOf(legacy), e.validUntil).due.isEmpty())
    }
}
