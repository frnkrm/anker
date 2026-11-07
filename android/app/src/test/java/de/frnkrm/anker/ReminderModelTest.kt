package de.frnkrm.anker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class ReminderModelTest {
    private val now = 1_000_000_000L
    private fun e(key: String, slot: Int, rank: Int, at: Long = now, snoozes: Int = 0) =
        ReminderEntry(key, "2026-11-04", at, "sanft", key, "", true, slot, rank, true, snoozes)

    @Test fun appAbgleichErhaeltFrischeFaelligeNochNichtZugestellteErinnerung() {
        val due = e("morning", 0, 2, now - 60_000).copy(revision = "same", token = "pending")
        val relevant = mapOf("${due.date}|${due.key}" to due.revision)
        val queue = ReminderLogic.replace(listOf(due), emptyList(), relevant.keys, now, relevant)
        assertEquals(listOf(due), ReminderLogic.takeDue(queue, now).due)
        assertEquals(listOf(due), ReminderLogic.replace(queue, emptyList(), relevant.keys, now + 1, relevant))
    }

    @Test fun faelligeStufenUndSnoozeBleibenEinmaligOhneRueckstau() {
        val first = e("evening", 0, 2, now - 5 * 60_000).copy(revision = "same", token = "first")
        val latest = first.copy(at = now - 60_000, token = "latest", snoozes = 1)
        val next = first.copy(at = now + 60_000, token = "future")
        val revisions = mapOf("${first.date}|${first.key}" to first.revision)
        val queue = ReminderLogic.replace(listOf(first, latest), listOf(next), revisions.keys, now, revisions)
        assertEquals(listOf(latest), ReminderLogic.takeDue(queue, now).due)
        val remaining = ReminderLogic.takeDue(queue, now).remaining
        // Der fällige Snooze ersetzt auch eine noch zukünftige Originalstufe.
        assertTrue(remaining.isEmpty())
        assertTrue(ReminderLogic.takeDue(remaining, now + 1).due.isEmpty())
    }

    @Test fun abgleichHoltNurBisDreissigMinutenNachUndKeineEntfernteOderGeaenderteRevision() {
        val due = e("morning", 0, 2, now - ReminderLogic.STALE_MS).copy(revision = "same", token = "pending")
        val relevant = mapOf("${due.date}|${due.key}" to due.revision)
        assertEquals(listOf(due), ReminderLogic.replace(listOf(due), emptyList(), relevant.keys, now, relevant))
        assertTrue(ReminderLogic.replace(listOf(due), emptyList(), relevant.keys, now + 1, relevant).isEmpty())
        assertTrue(ReminderLogic.replace(listOf(due), emptyList(), emptySet(), now, emptyMap()).isEmpty())
        assertTrue(ReminderLogic.replace(listOf(due), emptyList(), relevant.keys, now, relevant.mapValues { "changed" }).isEmpty())
    }

    @Test fun abgelehnterErsatzDerselbenSlotIdBelegtKeinenNeuenSlotUndErhaeltDieKarte() {
        val before = ReminderLogic.place(emptyList(), e("old", 0, 2), now, 0).slots
        val placement = ReminderLogic.place(before, e("replacement", 0, 3), now, 0)
        assertEquals(before, ReminderLogic.afterPostRequest(before, placement, false))
        assertEquals(placement.slots, ReminderLogic.afterPostRequest(before, placement, true))
        val first = ReminderLogic.place(emptyList(), e("new", 0, 2), now, 0)
        assertTrue(ReminderLogic.afterPostRequest(emptyList(), first, false).isEmpty())
        // Angenommene Anfrage ist nur ein logischer Slot; reale Android-Auskunft wird separat ermittelt.
        assertEquals(listOf("new"), ReminderLogic.afterPostRequest(emptyList(), first, true).map { it.key })
    }

    @Test fun budgetWirdVorNeuerAndererSlotIdReserviertAuchWennPostDanachScheitert() {
        val before = listOf(SlotEntry(0, "routine", "d", 2, now + 1000))
        val placement = ReminderLogic.place(before, e("leave", 1, 4), now, 2)
        val reserved = ReminderLogic.reserveBeforePost(before, placement)
        assertTrue(reserved.isEmpty())
        assertTrue(2 + (reserved.map { it.slot } + placement.slot!!).toSet().size <= 3)
        assertTrue(ReminderLogic.afterPostRequest(reserved, placement, false).isEmpty())
        assertEquals(listOf("leave"), ReminderLogic.afterPostRequest(reserved, placement, true).map { it.key })
        val sameId = ReminderLogic.place(before, e("replacement", 0, 3), now, 2)
        assertEquals(before, ReminderLogic.reserveBeforePost(before, sameId))
    }

    @Test fun globaleFreigabeUeberstimmtKeinenBlockiertenOderUnbekanntenKanal() {
        assertFalse(ReminderLogic.canPost(true, 0))
        assertFalse(ReminderLogic.canPost(true, -1))
        assertFalse(ReminderLogic.canPost(false, 4))
        assertTrue(ReminderLogic.canPost(true, 1)) // Sichtbar, aber bewusst ohne Ton zulässig.
        assertTrue(ReminderLogic.canPost(true, 4))
    }

    @Test fun quellkarteUeberlebtMitternachtBisZumEigenenNeunzigMinutenLimit() {
        val beforeMidnight = AlarmPlanner.toUtc(java.time.LocalDate.parse("2026-11-06"), 23 * 60 + 50)
        val previous = SlotEntry(0, "evening", "2026-11-06", 2, beforeMidnight + ReminderLogic.VISIBLE_MS)
        val afterMidnight = SlotEntry(1, "bed", "2026-11-07", 4, beforeMidnight + 30 * 60_000 + ReminderLogic.VISIBLE_MS)
        val stored = setOf("shown:2026-11-06|evening", "shown:2026-11-07|bed", "shown:2026-11-05|old", "alarmState")
        assertEquals(setOf("shown:2026-11-05|old"), ReminderLogic.obsoleteShownKeys(stored, listOf(previous, afterMidnight), beforeMidnight + 30 * 60_000))
        assertEquals(setOf("shown:2026-11-06|evening", "shown:2026-11-05|old"), ReminderLogic.obsoleteShownKeys(stored, listOf(previous, afterMidnight), previous.expiresAt))
    }

    @Test fun ruhestandEndetAnSeinerGrenzeUndAbgelaufenerFokusBleibtNichtStill() {
        val date = java.time.LocalDate.parse("2026-11-06")
        val at = AlarmPlanner.toUtc(date, 23 * 60 + 40)
        val end = AlarmPlanner.toUtc(date.plusDays(1), 5 * 60)
        val quiet = ReminderPolicy(23 * 60 + 30, 5 * 60)
        assertEquals(end, ReminderLogic.quietUntil(at, quiet))
        assertEquals(0, ReminderLogic.quietUntil(end, quiet).toInt())
        assertFalse(ReminderLogic.allowed(e("morning", 0, 2, end), end, ReminderPolicy(), end + 1))
        assertTrue(ReminderLogic.allowed(e("morning", 0, 2, end), end, ReminderPolicy(), end))
    }

    @Test fun alteButtonsRevisionenUndAbgelaufeneKartenAendernNichts() {
        val source = e("leave", 1, 4).copy(revision = "new-plan", token = "new-delivery")
        val slots = ReminderLogic.place(emptyList(), source, now, 0).slots
        assertNull(ReminderLogic.currentAction(slots, source.date, source.key, "old-plan", "old-delivery", now))
        assertNull(ReminderLogic.currentAction(slots, source.date, source.key, source.revision, "old-delivery", now))
        assertNull(ReminderLogic.currentAction(slots, source.date, source.key, "", "", now))
        assertNull(ReminderLogic.currentAction(slots, source.date, source.key, source.revision, source.token, now + ReminderLogic.VISIBLE_MS))
        assertNotNull(ReminderLogic.currentAction(slots, source.date, source.key, source.revision, source.token, now))
        assertNull(ReminderLogic.currentAction(emptyList(), source.date, source.key, source.revision, source.token, now))
    }

    @Test fun verschobenerPlanVerwirftAltesSnoozeUndAlteKarte() {
        val old = e("leave", 1, 4, now + 1000, 1).copy(revision = "old", token = "delivery")
        val incoming = old.copy(at = now + 2000, snoozes = 0, revision = "new", token = "next")
        val revisions = mapOf("${old.date}|${old.key}" to incoming.revision)
        assertEquals(listOf(incoming), ReminderLogic.replace(listOf(old), listOf(incoming), revisions.keys, now, revisions))
        val slots = ReminderLogic.place(emptyList(), old, now, 0).slots
        assertEquals(slots, ReminderLogic.obsolete(slots, revisions.keys, now, revisions))
    }

    @Test fun zweiErforderlicheDienstanzeigenLassenNurWichtigsteNormaleKarte() {
        val slots = listOf(SlotEntry(0, "routine", "d", 2, now + 1000), SlotEntry(1, "departure", "d", 4, now + 1000), SlotEntry(2, "hint", "d", 1, now + 1000))
        assertEquals(listOf("departure"), ReminderLogic.trimToBudget(slots, now, 2).map { it.key })
        assertNull(ReminderLogic.place(slots, e("trivia", 0, 1), now, 2).slot)
        assertTrue(ReminderLogic.trimToBudget(slots, now, 3).isEmpty())
        assertEquals(3, ReminderLogic.trimToBudget(slots, now, 0).size)
    }

    @Test fun normaleHinweiseBleibenInRuheFokusUndPrivatemZeitfensterStill() {
        val at = AlarmPlanner.toUtc(java.time.LocalDate.parse("2026-11-06"), 23 * 60 + 40)
        val policy = ReminderPolicy(23 * 60 + 30, 6 * 60)
        val normal = e("evening", 0, 2, at)
        assertFalse(ReminderLogic.allowed(normal, at, policy, 0))
        assertTrue(ReminderLogic.allowed(normal.copy(critical = true), at, policy, 0))
        assertFalse(ReminderLogic.allowed(normal, at, ReminderPolicy(), at + 1000))
        assertFalse(ReminderLogic.allowed(normal, at, ReminderPolicy(ranges = listOf(ReminderQuietRange(at, at + 1000))), 0))
        assertTrue(ReminderLogic.allowed(normal.copy(key = "go:appointment", critical = true), at, ReminderPolicy(ranges = listOf(ReminderQuietRange(at, at + 1000))), at + 1000))
        assertTrue(ReminderLogic.allowed(normal, at + 1000, ReminderPolicy(), at + 1000))
    }

    @Test
    fun abenderinnerungenOeffnenDenAbendbereich() {
        assertEquals("evening", ReminderLogic.tapDestination("wind-down"))
        assertEquals("evening", ReminderLogic.tapDestination("tomorrow-step:private-id"))
    }

    @Test
    fun gedankenerinnerungenGebenNurDasAllgemeineZielWeiter() {
        assertEquals("thoughts", ReminderLogic.tapDestination("thought-review:private-id"))
        assertEquals("thoughts", ReminderLogic.tapDestination("thought-review:anderer-gedanke"))
        assertEquals("evening", ReminderLogic.tapDestination("tomorrow-step:anderer-schritt"))
    }

    @Test
    fun nurVollstaendigeNeueErinnerungsschluesselBekommenEinZiel() {
        for (key in listOf("morning", "evening", "leave", "go:termin", "wind-down:extra", "thought-review", "thought-review:", "tomorrow-step", "tomorrow-step:", "https://example.org")) {
            assertNull(key, ReminderLogic.tapDestination(key))
        }
    }

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
        val q = ReminderLogic.replace(listOf(snoozed, e("alt", 0, 2, now + 50)), listOf(e("leave", 1, 4, now + 5), e("neu", 0, 2, now + 9)), setOf("2026-11-04|leave", "2026-11-04|neu"), now)
        assertEquals(listOf("neu", "leave"), q.map { it.key })
        assertEquals(1, q.last().snoozes)
    }

    @Test
    fun erledigteOderEntfernteVerschobeneErinnerungenKommenNichtZurueck() {
        val snoozed = e("evening", 0, 2, now + 300_000, snoozes = 1)
        val removedAppointment = e("go:termin", 1, 4, now + 300_000, snoozes = 1)
        val q = ReminderLogic.replace(listOf(snoozed, removedAppointment), emptyList(), emptySet(), now)
        assertTrue(q.isEmpty())
        assertTrue(ReminderLogic.takeDue(q, now + 300_000).due.isEmpty())
    }

    @Test
    fun relevanteVerschobeneErinnerungBleibtAuchOhneWeitereEskalationsstufe() {
        val snoozed = e("evening", 0, 2, now + 300_000, snoozes = 1)
        val q = ReminderLogic.replace(listOf(snoozed), emptyList(), setOf("2026-11-04|evening"), now)
        assertEquals(listOf(snoozed), q)
        assertEquals(listOf(snoozed), ReminderLogic.takeDue(q, now + 300_000).due)
    }

    @Test
    fun frischerFaelligerSnoozeErsetztBeimAppAbgleichWeiterhinDieUrspruenglichenStufen() {
        val snoozed = e("evening", 0, 2, now + ReminderLogic.SNOOZE_MS, snoozes = 1).copy(revision = "current", token = "snoozed")
        val originalLater = snoozed.copy(at = now + 60 * 60_000, snoozes = 0, token = "original-escalation")
        val revisions = mapOf("${snoozed.date}|${snoozed.key}" to snoozed.revision)
        for (at in listOf(snoozed.at - 1, snoozed.at, snoozed.at + 1, snoozed.at + ReminderLogic.STALE_MS)) {
            val q = ReminderLogic.replace(listOf(snoozed), listOf(originalLater), revisions.keys, at, revisions)
            assertEquals("Ein noch frischer Snooze muss bei $at die alten Stufen ersetzen", listOf(snoozed), q)
        }
    }

    @Test
    fun abgelaufenerOderAndersRevidierterSnoozeBlockiertKeinenNeuenPlan() {
        val snoozed = e("evening", 0, 2, now, snoozes = 1).copy(revision = "old", token = "snoozed")
        val incoming = snoozed.copy(at = now + 60 * 60_000, snoozes = 0, token = "future")
        val key = "${snoozed.date}|${snoozed.key}"
        val stale = ReminderLogic.replace(listOf(snoozed), listOf(incoming), setOf(key), now + ReminderLogic.STALE_MS + 1, mapOf(key to "old"))
        assertEquals(listOf(incoming), stale)
        val changed = incoming.copy(revision = "new")
        assertEquals(listOf(changed), ReminderLogic.replace(listOf(snoozed), listOf(changed), setOf(key), now, mapOf(key to "new")))
        assertTrue(ReminderLogic.replace(listOf(snoozed), emptyList(), emptySet(), now, emptyMap()).isEmpty())
    }

    @Test
    fun nachZugestelltemSnoozeHoltEinNeuerAbgleichKeineUrspruenglicheStufeZurueck() {
        val source = e("evening", 0, 2).copy(revision = "current", token = "first")
        val originalLater = source.copy(at = now + 60 * 60_000, token = "later")
        val queue = listOf(source, originalLater)
        val snoozed = ReminderLogic.snooze(queue, source, now)!!
        val consumed = ReminderLogic.consumeSnoozeTokens(emptyMap(), queue, source)
        assertEquals(setOf(source.token, originalLater.token), consumed.keys)
        assertFalse(snoozed.single().token in consumed)
        val due = ReminderLogic.takeDue(snoozed, now + ReminderLogic.SNOOZE_MS)
        assertEquals(1, due.due.size)
        val key = "${source.date}|${source.key}"
        val after = ReminderLogic.replace(due.remaining, listOf(originalLater), setOf(key), now + ReminderLogic.SNOOZE_MS + 1, mapOf(key to source.revision), consumed.keys)
        assertTrue("Eine durch Snooze ersetzte Originalstufe darf nach seiner Zustellung nicht zurückkommen", after.isEmpty())
        val changed = originalLater.copy(revision = "changed-plan", token = "changed-delivery")
        assertEquals(listOf(changed), ReminderLogic.replace(due.remaining, listOf(changed), setOf(key), now + ReminderLogic.SNOOZE_MS + 1, mapOf(key to changed.revision), consumed.keys))
    }

    @Test
    fun snoozeVerbrauchtNurErsetztePlanrevisionUndBegrenztDasLedger() {
        val source = e("evening", 0, 2).copy(revision = "current", token = "source")
        val same = source.copy(token = "same", at = now + 100)
        val otherKey = same.copy(key = "other", token = "other-key")
        val otherDate = same.copy(date = "2026-11-05", token = "other-date")
        val otherRevision = same.copy(revision = "new-plan", token = "other-revision")
        val old = (0..ReminderLogic.MAX_CONSUMED_TOKENS).associate { "old-$it" to it.toLong() }
        val ledger = ReminderLogic.consumeSnoozeTokens(old, listOf(same, otherKey, otherDate, otherRevision), source)
        assertEquals(ReminderLogic.MAX_CONSUMED_TOKENS, ledger.size)
        assertEquals(now, ledger[source.token])
        assertEquals(now + 100, ledger[same.token])
        assertFalse(otherKey.token in ledger || otherDate.token in ledger || otherRevision.token in ledger)
        assertFalse("old-0" in ledger)
        assertEquals(ledger, ReminderLogic.consumeTokens(ledger, listOf(source.copy(token = ""))))
    }

    @Test
    fun relevanzUnterscheidetTageMitGleichemSchluessel() {
        val old = e("evening", 0, 2, now + 300_000, snoozes = 1)
        val nextDay = old.copy(date = "2026-11-05")
        val q = ReminderLogic.replace(listOf(old, nextDay), emptyList(), setOf("2026-11-05|evening"), now)
        assertEquals(listOf(nextDay), q)
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
    fun nachZweitemVerschiebenBleibenErledigtUndHeuteNichtVerfuegbar() {
        val source = e("evening", 0, 2).copy(revision = "current", token = "first-delivery")
        val first = ReminderLogic.snooze(emptyList(), source, now)!!.single()
        val second = ReminderLogic.snooze(emptyList(), first, now + ReminderLogic.SNOOZE_MS)!!.single()
        assertEquals(2, second.snoozes)
        assertEquals(now + 2 * ReminderLogic.SNOOZE_MS, second.at)
        assertTrue("Erledigt und Heute nicht dürfen mit dem Snooze-Limit nicht verschwinden", second.actions)
        assertEquals(source.revision, second.revision)
        assertTrue(source.token != first.token && first.token != second.token)
        assertNull(ReminderLogic.snooze(emptyList(), second, second.at))
    }

    @Test
    fun verschiebenErfindetKeineAktionenFuerEineHinweiskarte() {
        val source = e("hint", 2, 1).copy(actions = false)
        assertFalse(ReminderLogic.snooze(emptyList(), source, now)!!.single().actions)
    }

    @Test
    fun erledigtesVerschwindetAusSlots() {
        val slots = listOf(SlotEntry(1, "leave", "d", 4, now + 1000), SlotEntry(0, "morning", "d", 2, now - 1))
        val gone = ReminderLogic.obsolete(slots, setOf("d|morning"), now)
        assertEquals(setOf("leave", "morning"), gone.map { it.key }.toSet())
    }
}
