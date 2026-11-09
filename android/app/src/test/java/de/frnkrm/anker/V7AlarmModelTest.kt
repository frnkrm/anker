package de.frnkrm.anker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class V7AlarmModelTest {
    private val cfg = AlarmConfig(enabled = true, wakeMinutes = 390, antiRelapseEnabled = true, zeroGapEnabled = true)
    private val now = 1_800_000_000_000L
    private val next = now + 86_400_000L

    private fun stopped(method: String = "qr", config: AlarmConfig = cfg): AlarmState {
        val main = AlarmMachine.fired(AlarmState(mainAt = now), AlarmKind.MAIN, now, now).state.copy(mainAt = next)
        return AlarmMachine.stopped(main, method, config, now + 1000)
    }

    @Test fun neueOptionenSindOhneFreigabeAus() {
        val defaults = AlarmConfig(enabled = true, wakeMinutes = 390)
        assertFalse(defaults.preWakeFadeIn)
        assertFalse(defaults.antiRelapseEnabled)
        assertFalse(defaults.zeroGapEnabled)
        assertEquals(5, defaults.antiRelapseDelayMinutes)
        val legacy = stopped(config = defaults.copy(wakeCheckEnabled = true, wakeCheckDelayMinutes = 7))
        assertEquals(now + 1000 + 7 * 60_000L, legacy.wakeCheckAt)
        assertEquals(0L, legacy.antiRelapseAt)
        assertEquals(0L, legacy.morningHandoffAt)
        assertEquals(AlarmKind.WAKE_CHECK, AlarmMachine.firedScheduled(legacy, AlarmKind.WAKE_CHECK, legacy.wakeCheckAt, legacy.wakeCheckAt).state.ringing)
    }

    @Test fun bestaetigterHauptUndSchlummerStoppBindenCheckUndDauerhafteUebergabe() {
        for (method in listOf("qr", "math", "emergency")) {
            for (kind in listOf(AlarmKind.MAIN, AlarmKind.SNOOZE)) {
                val ring = AlarmState(ringing = kind, lastMainFiredAt = now, mainAt = next)
                val s = AlarmMachine.stopped(ring, method, cfg, now + 1000)
                assertEquals(now + 301_000L, s.wakeCheckAt)
                assertEquals(s.wakeCheckAt, s.antiRelapseAt)
                assertEquals(now, s.antiRelapseOriginAt)
                assertEquals(now + 1000, s.morningHandoffAt)
                assertEquals(now, s.morningHandoffOriginAt)
                assertEquals(method, s.morningHandoffMethod)
                assertNull(s.ringing)
            }
        }
        for (kind in listOf(AlarmKind.TEST, AlarmKind.PRE_WAKE, AlarmKind.WAKE_CHECK)) {
            val s = AlarmMachine.stopped(AlarmState(ringing = kind, lastMainFiredAt = now), "qr", cfg, now + 1000)
            assertEquals(0L, s.antiRelapseAt)
            assertEquals(0L, s.morningHandoffAt)
        }
        val unconfirmed = stopped("unknown")
        assertEquals(0L, unconfirmed.antiRelapseAt)
        assertEquals(0L, unconfirmed.morningHandoffAt)
    }

    @Test fun rueckfallKlingeltEinmalAlsHauptOhneNaechstenMorgenZuVeraendern() {
        val s = stopped()
        val due = AlarmMachine.relapseDue(s, cfg, s.antiRelapseAt, s.antiRelapseAt)
        assertTrue(due.ring)
        assertEquals(AlarmKind.MAIN, due.state.ringing)
        assertEquals(next, due.state.mainAt)
        assertEquals(now, due.state.lastMainFiredAt)
        assertEquals(s.antiRelapseAt, due.state.lastWakeCheckFiredAt)
        assertEquals(s.antiRelapseAt, due.state.antiRelapseTriggeredAt)
        assertEquals(0L, due.state.wakeCheckAt)
        assertTrue(due.state.snoozeUsed)
        assertNull(AlarmMachine.snoozed(due.state, 5, s.antiRelapseAt))
        assertEquals(due.state, AlarmMachine.confirmMorningActivity(due.state, s.antiRelapseAt + 1))
        val stoppedAgain = AlarmMachine.stopped(due.state, "math", cfg, s.antiRelapseAt + 1000)
        assertEquals(0L, stoppedAgain.wakeCheckAt)
        assertFalse(AlarmMachine.relapseDue(stoppedAgain, cfg, s.antiRelapseAt, s.antiRelapseAt + 2000).ring)
        val fresh = AlarmMachine.fired(stoppedAgain, AlarmKind.MAIN, next, next).state
        assertEquals(0L, fresh.antiRelapseTriggeredAt)
        assertFalse(fresh.snoozeUsed)
        assertTrue(AlarmMachine.stopped(fresh, "qr", cfg, next + 1000).antiRelapseAt > next)
    }

    @Test fun frueheFremdeAlteAbgeschalteteUndDoppelteSignaleBleibenStill() {
        val s = stopped()
        val due = s.antiRelapseAt
        val invalid = listOf(
            Triple(s, cfg, due - 1),
            Triple(s, cfg.copy(enabled = false), due),
            Triple(s, cfg.copy(antiRelapseEnabled = false), due),
            Triple(s.copy(antiRelapseOriginAt = now - 1), cfg, due),
            Triple(s.copy(antiRelapseTriggeredAt = due), cfg, due),
            Triple(s.copy(wakeCheckAt = due + 1), cfg, due),
            Triple(s.copy(ringing = AlarmKind.TEST), cfg, due),
            Triple(s, cfg, now + AlarmMachine.LATE_GRACE_MS + 1),
        )
        for ((state, config, time) in invalid) {
            assertEquals(FireDecision(state, false), AlarmMachine.relapseDue(state, config, due, time))
        }
        for (stamp in listOf(0L, due - 1, due + 1)) assertFalse(AlarmMachine.relapseDue(s, cfg, stamp, due).ring)
        assertFalse(AlarmMachine.firedScheduled(s, AlarmKind.WAKE_CHECK, due, due).ring)
    }

    @Test fun echteMorgenhandlungLoeschtNurPassendenOffenenCheck() {
        val s = stopped()
        val confirmed = AlarmMachine.confirmMorningActivity(s, now + 2000)
        assertEquals(0L, confirmed.wakeCheckAt)
        assertEquals(0L, confirmed.antiRelapseAt)
        assertEquals(s.morningHandoffAt, confirmed.morningHandoffAt)
        assertFalse(AlarmMachine.relapseDue(confirmed, cfg, s.antiRelapseAt, s.antiRelapseAt).ring)
        val replaced = s.copy(wakeCheckAt = s.wakeCheckAt + 1)
        assertEquals(replaced, AlarmMachine.confirmMorningActivity(replaced, now + 2000))
        val fired = s.copy(antiRelapseTriggeredAt = now + 1500)
        assertEquals(fired, AlarmMachine.confirmMorningActivity(fired, now + 2000))
    }

    @Test fun uebergabeBleibtBisZurPassendenQuittungErhalten() {
        val s = stopped()
        assertEquals(s, AlarmMachine.ackMorningHandoff(s, 0))
        assertEquals(s, AlarmMachine.ackMorningHandoff(s, s.morningHandoffAt - 1))
        val ack = AlarmMachine.ackMorningHandoff(s, s.morningHandoffAt)
        assertEquals(0L, ack.morningHandoffAt)
        assertEquals(0L, ack.morningHandoffOriginAt)
        assertEquals("", ack.morningHandoffMethod)
        assertEquals(s.wakeCheckAt, ack.wakeCheckAt)
    }

    @Test fun smartWakeBindetZukunftszielAberFristAnTatsaechlichesKlingeln() {
        val target = now + 40 * 60_000L
        val smartCfg = cfg.copy(smartWakeEnabled = true)
        val smart = AlarmMachine.smartFired(AlarmState(mainAt = target), smartCfg, target, now).state
        val stopped = AlarmMachine.stopped(smart, "qr", smartCfg, now + 1000)
        assertEquals(target, stopped.antiRelapseOriginAt)
        assertEquals(target, stopped.morningHandoffOriginAt)
        assertTrue(AlarmMachine.relapseDue(stopped, smartCfg, stopped.antiRelapseAt, stopped.antiRelapseAt).ring)
        val tomorrow = AlarmMachine.fired(stopped, AlarmKind.MAIN, next, next).state
        assertEquals(next, AlarmMachine.stopped(tomorrow, "qr", smartCfg, next + 1000).antiRelapseOriginAt)
    }

    @Test fun abgleichHoltNurFrischenGebundenenCheckNachUndIstIdempotent() {
        val s = stopped()
        val due = AlarmMachine.reconcile(s, cfg, s.antiRelapseAt + 1000)
        assertEquals(AlarmKind.WAKE_CHECK, due.fireLate)
        assertEquals(s.antiRelapseAt, due.state.wakeCheckAt)
        assertEquals(due, AlarmMachine.reconcile(due.state, cfg, s.antiRelapseAt + 1000))
        for (config in listOf(cfg.copy(enabled = false), cfg.copy(antiRelapseEnabled = false), null)) {
            val suppressed = AlarmMachine.reconcile(s, config, now + 2000)
            assertEquals(0L, suppressed.state.wakeCheckAt)
            assertEquals(0L, suppressed.state.antiRelapseAt)
            assertNull(suppressed.fireLate)
        }
        val old = AlarmMachine.reconcile(s, cfg, now + AlarmMachine.LATE_GRACE_MS + 1)
        assertEquals(0L, old.state.wakeCheckAt)
        assertEquals(0L, old.state.antiRelapseAt)
        assertNull(old.fireLate)
        assertEquals(0L, AlarmMachine.reconcile(old.state, cfg, now + AlarmMachine.LATE_GRACE_MS + 2).state.antiRelapseAt)
    }
}
