package de.frnkrm.anker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

class AlarmModelTest {
    private val cfg = AlarmConfig(enabled = true, wakeMinutes = 6 * 60 + 10)
    private fun at(date: String, min: Int) = AlarmPlanner.toUtc(LocalDate.parse(date), min)
    private val wake = 6 * 60 + 10

    @Test
    fun jedeAlarmartHatEigeneIdentitaet() {
        val codes = AlarmKind.entries.map { it.requestCode }
        assertEquals(codes.size, codes.toSet().size)
    }

    @Test
    fun naechsterWeckerHeuteOderMorgen() {
        assertEquals(at("2026-11-04", wake), AlarmPlanner.next(cfg, at("2026-11-04", 300)).mainAt)
        assertEquals(at("2026-11-05", wake), AlarmPlanner.next(cfg, at("2026-11-04", wake)).mainAt)
    }

    @Test
    fun krankeTageWerdenUebersprungenAberNichtDauerhaft() {
        val c = cfg.copy(skipDates = setOf("2026-11-05"))
        assertEquals(at("2026-11-06", wake), AlarmPlanner.next(c, at("2026-11-04", 720)).mainAt)
    }

    @Test
    fun sommerzeitUmstellungBehaeltWandzeit() {
        // 29.03.2026: 02:00 → 03:00, 25.10.2026: 03:00 → 02:00
        val spring = AlarmPlanner.next(cfg, at("2026-03-28", 720)).mainAt
        assertEquals(Instant.parse("2026-03-29T04:10:00Z").toEpochMilli(), spring)
        val autumn = AlarmPlanner.next(cfg, at("2026-10-24", 720)).mainAt
        assertEquals(Instant.parse("2026-10-25T05:10:00Z").toEpochMilli(), autumn)
    }

    @Test
    fun zeitInDerSommerzeitLueckeRutschtNachVorn() {
        // Gleiches Ergebnis wie zonedToUtc in src/core/time.ts (siehe alarm.test.ts)
        assertEquals(Instant.parse("2026-03-29T01:30:00Z").toEpochMilli(), at("2026-03-29", 150))
    }

    @Test
    fun vorweckerIstUnabhaengigUndOptional() {
        val c = cfg.copy(preWakeEnabled = true, preWakeLeadMinutes = 45)
        val n = AlarmPlanner.next(c, at("2026-11-04", 60))
        assertEquals(n.mainAt - 45 * 60_000L, n.preWakeAt)
        assertEquals(0L, AlarmPlanner.next(cfg, at("2026-11-04", 60)).preWakeAt)
        // Vorwecker schon vorbei → Hauptwecker bleibt
        val late = AlarmPlanner.next(c, at("2026-11-04", wake - 10))
        assertEquals(at("2026-11-04", wake), late.mainAt)
        assertEquals(0L, late.preWakeAt)
    }

    @Test
    fun testalarmAendertWederHauptweckerNochSchlummern() {
        val now = at("2026-11-04", 720)
        val s = AlarmState(mainAt = at("2026-11-05", wake), snoozeUsed = true)
        val d = AlarmMachine.fired(s.copy(testAt = now), AlarmKind.TEST, now, now)
        assertTrue(d.ring)
        assertEquals(s.mainAt, d.state.mainAt)
        assertTrue(d.state.snoozeUsed)
        assertEquals("rang", d.state.testResult)
        val stopped = AlarmMachine.stopped(d.state, "test", cfg, now)
        assertEquals(s.mainAt, stopped.mainAt)
        assertEquals(0L, stopped.wakeCheckAt)
    }

    @Test
    fun hauptweckerVerdraengtVorweckerUndTest() {
        val now = at("2026-11-05", wake)
        val pre = AlarmMachine.fired(AlarmState(), AlarmKind.PRE_WAKE, now - 1000, now - 1000)
        assertEquals(AlarmKind.PRE_WAKE, pre.state.ringing)
        val main = AlarmMachine.fired(pre.state, AlarmKind.MAIN, now, now)
        assertTrue(main.ring)
        assertEquals(AlarmKind.MAIN, main.state.ringing)
    }

    @Test
    fun testVerdraengtKlingelndenHauptweckerNicht() {
        val now = at("2026-11-05", wake)
        val main = AlarmMachine.fired(AlarmState(), AlarmKind.MAIN, now, now)
        val test = AlarmMachine.fired(main.state, AlarmKind.TEST, now + 1, now + 1)
        assertFalse(test.ring)
        assertEquals(AlarmKind.MAIN, test.state.ringing)
    }

    @Test
    fun doppelterBroadcastKlingeltNichtZweimal() {
        val now = at("2026-11-05", wake)
        val a = AlarmMachine.fired(AlarmState(), AlarmKind.MAIN, now, now)
        val stopped = AlarmMachine.stopped(a.state, "qr", cfg, now + 5000)
        val b = AlarmMachine.fired(stopped, AlarmKind.MAIN, now, now + 6000)
        assertFalse(b.ring)
        assertNull(b.state.ringing)
    }

    @Test
    fun schlummernHoechstensEinmal() {
        val now = at("2026-11-05", wake)
        val main = AlarmMachine.fired(AlarmState(), AlarmKind.MAIN, now, now)
        val snoozed = AlarmMachine.snoozed(main.state, 5, now)!!
        assertEquals(now + 300_000L, snoozed.snoozeAt)
        assertNull(snoozed.ringing)
        val again = AlarmMachine.fired(snoozed, AlarmKind.SNOOZE, snoozed.snoozeAt, snoozed.snoozeAt)
        assertEquals(AlarmKind.SNOOZE, again.state.ringing)
        assertNull(AlarmMachine.snoozed(again.state, 5, snoozed.snoozeAt))
        // Nächster Morgen: wieder einmal erlaubt
        val next = at("2026-11-06", wake)
        val fresh = AlarmMachine.fired(AlarmMachine.stopped(again.state, "qr", cfg, now), AlarmKind.MAIN, next, next)
        assertFalse(fresh.state.snoozeUsed)
    }

    @Test
    fun nachTimeoutIstDerNaechsteMorgenGeplant() {
        val now = at("2026-11-05", wake)
        val main = AlarmMachine.fired(AlarmState(mainAt = now), AlarmKind.MAIN, now, now)
        val t = now + AlarmKind.MAIN.timeoutMs
        assertTrue(AlarmMachine.ringExpired(main.state, t))
        val out = AlarmMachine.timedOut(main.state, t)
        val r = AlarmMachine.reconcile(out, cfg, t)
        assertNull(r.fireLate)
        assertEquals(at("2026-11-06", wake), r.state.mainAt)
    }

    @Test
    fun wachheitsCheckNurWennEingeschaltetUndNichtBeimTest() {
        val now = at("2026-11-05", wake)
        val main = AlarmMachine.fired(AlarmState(), AlarmKind.MAIN, now, now).state
        assertEquals(0L, AlarmMachine.stopped(main, "qr", cfg, now).wakeCheckAt)
        val on = cfg.copy(wakeCheckEnabled = true, wakeCheckDelayMinutes = 7)
        assertEquals(now + 420_000L, AlarmMachine.stopped(main, "qr", on, now).wakeCheckAt)
        // Wachheits-Check erzeugt keine Kette
        val check = AlarmMachine.fired(AlarmState(wakeCheckAt = now), AlarmKind.WAKE_CHECK, now, now).state
        assertEquals(0L, AlarmMachine.stopped(check, "check", on, now).wakeCheckAt)
    }

    @Test
    fun neustartHoltKurzVerpasstenWeckerNachAberKeineAltlasten() {
        val mainAt = at("2026-11-05", wake)
        val late = AlarmMachine.reconcile(AlarmState(mainAt = mainAt), cfg, mainAt + 10 * 60_000L)
        assertEquals(AlarmKind.MAIN, late.fireLate)
        val old = AlarmMachine.reconcile(AlarmState(mainAt = mainAt), cfg, mainAt + 3 * 3600_000L)
        assertNull(old.fireLate)
        assertEquals(mainAt, old.state.missedMainAt)
        assertEquals(at("2026-11-06", wake), old.state.mainAt)
    }

    @Test
    fun abgeschalteterWeckerPlantNichts() {
        val r = AlarmMachine.reconcile(AlarmState(mainAt = 5, snoozeAt = 0), cfg.copy(enabled = false), 10_000)
        assertEquals(0L, r.state.mainAt)
        assertNull(r.fireLate)
    }

    @Test
    fun ohneKonfigurationBleibtZukuenftigerWeckerErhalten() {
        val now = at("2026-11-04", 720)
        val future = at("2026-11-05", wake)
        val r = AlarmMachine.reconcile(AlarmState(mainAt = future), null, now)
        assertEquals(future, r.state.mainAt)
        assertNotEquals(0L, r.state.mainAt)
    }
}
