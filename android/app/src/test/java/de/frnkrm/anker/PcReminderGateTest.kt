package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

class PcReminderGateTest {
    private val now = Instant.parse("2026-11-12T21:30:00Z").toEpochMilli()
    private val date = "2026-11-12"
    private val expected = PcReminderExpectation("r-new", date, now + 3600000)
    private val proof = PcReminderProof(true, "r-new", date, now + 3600000, "r-new", date, "scheduled", now, true, true)
    private val entry = ReminderEntry("pcstop", date, now, "uebergang", "PC aus", "", true, 1, 4, true, revision = "reminder", token = "delivery")
    @Test fun requiresLiveFreshSameDayAndRevision() {
        assertTrue(PcReminderGate.suppress(entry, expected, proof, now))
        for (invalid in listOf(proof.copy(connected = false), proof.copy(ackRevision = "old"), proof.copy(revision = "other"), proof.copy(ackDate = "2026-11-11"), proof.copy(date = "2026-11-13"), proof.copy(validUntil = now), proof.copy(receivedAt = now - 90001), proof.copy(receivedAt = now + 5001), proof.copy(noWarnings = false), proof.copy(enforceEnabled = false), proof.copy(mode = "paused"))) assertFalse(PcReminderGate.suppress(entry, expected, invalid, now))
        assertFalse(PcReminderGate.suppress(entry, null, proof, now))
        assertFalse(PcReminderGate.suppress(entry, expected, null, now))
        assertFalse(PcReminderGate.suppress(entry, expected.copy(revision = "newer-unacked"), proof, now))
    }
    @Test fun neverSuppressesBedAlarmMedicationOtherDayOrOtherHints() {
        for (key in listOf("bed", "meds", "morning", "evening", "guidance-wind-down", "guidance-evening-light", "alarm")) assertFalse(PcReminderGate.suppress(entry.copy(key = key), expected, proof, now))
        assertFalse(PcReminderGate.suppress(entry.copy(date = "2026-11-13"), expected, proof, now))
        assertTrue(PcReminderGate.suppress(entry.copy(key = "pcstop-15", snoozes = 2), expected, proof, now))
    }
    @Test fun logicalDayStillBelongsToPreviousEveningBeforeFour() {
        val afterMidnight = Instant.parse("2026-11-13T00:30:00Z").toEpochMilli()
        val fresh = proof.copy(receivedAt = afterMidnight, validUntil = afterMidnight + 60000)
        assertTrue(PcReminderGate.suppress(entry, expected.copy(validUntil = afterMidnight + 60000), fresh, afterMidnight))
        assertFalse(PcReminderGate.suppress(entry, expected.copy(validUntil = afterMidnight + 60000), fresh, Instant.parse("2026-11-13T03:00:00Z").toEpochMilli()))
    }
    @Test fun deferredSnoozeKeepsIdentityAndOriginalStaleBoundaryAcrossAppResync() {
        val snooze = entry.copy(snoozes = 1)
        val held = PcReminderGate.defer(snooze, now)
        val revisions = mapOf("$date|pcstop" to entry.revision)
        val queue = ReminderLogic.replace(listOf(held), emptyList(), revisions.keys, now + 1, revisions)
        assertEquals(listOf(held), queue)
        assertEquals(entry.at, PcReminderGate.originalAt(PcReminderGate.defer(held, now + 30000)))
        assertEquals(snooze.token, held.token)
        assertEquals(1, held.snoozes)
        assertEquals(0L, ReminderLogic.snooze(emptyList(), held, now + 30000)!!.single().deferredFrom)
        assertEquals(listOf(held), ReminderLogic.takeDue(queue, now + 30000).due)
        assertTrue(ReminderLogic.takeDue(queue, now + ReminderLogic.STALE_MS + 1).due.isEmpty())
        assertTrue(ReminderLogic.replace(queue, emptyList(), emptySet(), now + 1, emptyMap()).isEmpty())
        assertTrue(ReminderLogic.replace(queue, emptyList(), revisions.keys, now + 1, revisions.mapValues { "changed" }).isEmpty())
    }
    @Test fun ackArrivingBetweenPartitionAndConsumptionCannotDropOrDoubleConsumeDelivery() {
        val live = AtomicReference<PcReminderProof?>(null)
        var reads = 0
        val round = PcReminderGate.capture(expected, { reads++; live.get() }, now)
        val batch = round.prepare(listOf(entry))
        // The network receives an ACK after the queue split, before actual posting/consumption.
        live.set(proof)
        val posted = batch.deliveries.filterNot(round::suppress)
        val ledger = ReminderLogic.consumeTokens(emptyMap(), batch.consumed)
        assertEquals(1, reads)
        assertEquals(listOf(entry), posted)
        assertTrue(batch.remaining.isEmpty())
        assertEquals(setOf(entry.token), ledger.keys)
        // A subsequent round cannot redeliver a token already consumed by this one.
        val nextQueue = ReminderLogic.replace(batch.remaining, listOf(entry), setOf("$date|pcstop"), now,
            mapOf("$date|pcstop" to entry.revision), ledger.keys)
        assertTrue(PcReminderGate.capture(expected, live::get, now).prepare(nextQueue).deliveries.isEmpty())
    }

    @Test fun disconnectBetweenHoldingAndConsumptionPreservesOnePendingTokenForNextRound() {
        val live = AtomicReference<PcReminderProof?>(proof)
        var reads = 0
        val round = PcReminderGate.capture(expected, { reads++; live.get() }, now)
        assertTrue(round.suppress(entry))
        live.set(null) // Disconnect before holding/posting checks in this round.
        val batch = round.prepare(listOf(entry))
        assertTrue(batch.deliveries.isEmpty())
        assertTrue(batch.consumed.isEmpty())
        assertEquals(1, reads)
        assertEquals(listOf(entry.token), batch.remaining.map { it.token })
        assertTrue(round.suppress(batch.remaining.single()))
        val next = PcReminderGate.capture(expected, live::get, now + 1).prepare(batch.remaining)
        assertEquals(listOf(entry.token), next.deliveries.map { it.token })
        assertEquals(listOf(entry.token), next.consumed.map { it.token })
        assertTrue(next.remaining.isEmpty())
        assertEquals(setOf(entry.token), ReminderLogic.consumeTokens(emptyMap(), next.consumed).keys)
    }

    @Test fun clockRollbackNeverReleasesHeldReminderBeforeItsOriginalTime() {
        val held = PcReminderGate.defer(entry, now)
        val earlier = now - 10 * 60_000
        val batch = PcReminderGate.capture(expected, { proof }, earlier).prepare(listOf(held))
        // The ACK is now in the future, so the gate opens; the original due time still applies.
        assertTrue(batch.deliveries.isEmpty())
        assertTrue(batch.consumed.isEmpty())
        assertEquals(entry.at, batch.remaining.single().at)
        assertEquals(entry.at, PcReminderGate.originalAt(batch.remaining.single()))
        val reached = PcReminderGate.capture(expected, { null }, now).prepare(batch.remaining)
        assertEquals(listOf(entry.token), reached.deliveries.map { it.token })
        assertEquals(listOf(entry.token), reached.consumed.map { it.token })
        assertTrue(reached.remaining.isEmpty())
    }

}
