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
    fun nurExpliziteBekannteFireActionsSindWecksignale() {
        for (kind in AlarmKind.entries) assertEquals(kind, AlarmKind.fromFireAction(AlarmKind.FIRE_ACTION_PREFIX + kind.wire))
        for (action in listOf(null, "", "main", "other.main", AlarmKind.FIRE_ACTION_PREFIX, AlarmKind.FIRE_ACTION_PREFIX + "unknown")) {
            assertNull(AlarmKind.fromFireAction(action))
        }
    }

    private fun scheduled(kind: AlarmKind, at: Long): AlarmState = when (kind) {
        AlarmKind.MAIN -> AlarmState(mainAt = at)
        AlarmKind.SNOOZE -> AlarmState(snoozeAt = at, snoozeUsed = true)
        AlarmKind.PRE_WAKE -> AlarmState(preWakeAt = at)
        AlarmKind.TEST -> AlarmState(testAt = at)
        AlarmKind.WAKE_CHECK -> AlarmState(wakeCheckAt = at)
    }

    @Test
    fun alteOderFehlendeSignaleAendernKeineAktuelleAlarmart() {
        val old = at("2026-11-05", wake)
        val replacement = old + 50 * 60_000L
        for (kind in AlarmKind.entries) {
            val state = scheduled(kind, replacement)
            for (stamp in listOf(old, 0L, -1L)) {
                val result = AlarmMachine.firedScheduled(state, kind, stamp, old)
                assertFalse(result.ring)
                assertEquals(state, result.state)
            }
            val cancelled = scheduled(kind, 0)
            assertEquals(FireDecision(cancelled, false), AlarmMachine.firedScheduled(cancelled, kind, old, old))
        }
    }

    @Test
    fun aktuellerTerminKlingeltEinmalUndVerzoegertesDuplikatBleibtStill() {
        val now = at("2026-11-05", wake)
        for (kind in AlarmKind.entries) {
            val first = AlarmMachine.firedScheduled(scheduled(kind, now), kind, now, now)
            assertTrue(first.ring)
            val stopped = AlarmMachine.stopped(first.state, "emergency", cfg, now + 1000)
            val duplicate = AlarmMachine.firedScheduled(stopped, kind, now, now + 2000)
            assertFalse(duplicate.ring)
            assertEquals(stopped, duplicate.state)
        }
    }

    @Test
    fun abgleichHoltFaelligesSchlummernEinmalNach() {
        val now = at("2026-11-05", wake + 5)
        val reconciled = AlarmMachine.reconcile(AlarmState(snoozeAt = now - 1000, snoozeUsed = true), cfg, now)
        assertEquals(AlarmKind.SNOOZE, reconciled.fireLate)
        val fired = AlarmMachine.firedScheduled(reconciled.state, AlarmKind.SNOOZE, reconciled.state.snoozeAt, now)
        assertTrue(fired.ring)
        assertTrue(fired.state.snoozeUsed)
        assertNull(AlarmMachine.reconcile(fired.state, cfg, now + 1).fireLate)
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
    fun einmaligeWeckzeitGiltNurFuerDiesenTag() {
        val c = cfg.copy(wakeOverrides = mapOf("2026-11-05" to 8 * 60))
        assertEquals(at("2026-11-05", 8 * 60), AlarmPlanner.next(c, at("2026-11-04", 720)).mainAt)
        assertEquals(at("2026-11-06", wake), AlarmPlanner.next(c, at("2026-11-05", 8 * 60)).mainAt)
    }

    @Test
    fun klingelnderWeckerBleibtBeiNeuplanungUnberuehrt() {
        val now = at("2026-11-05", wake)
        val ringing = AlarmMachine.fired(AlarmState(), AlarmKind.MAIN, now, now).state
        val r = AlarmMachine.reconcile(ringing, cfg.copy(wakeOverrides = mapOf("2026-11-06" to 8 * 60)), now + 1000)
        assertEquals(AlarmKind.MAIN, r.state.ringing)
        assertEquals(at("2026-11-06", 8 * 60), r.state.mainAt)
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
    fun doppelteHerbstStundeNutztWieWebDasSpaetereVorkommen() {
        assertEquals(Instant.parse("2026-10-25T01:30:00Z").toEpochMilli(), at("2026-10-25", 150))
        val c = cfg.copy(wakeMinutes = 150)
        assertEquals(at("2026-10-25", 150), AlarmPlanner.next(c, Instant.parse("2026-10-25T00:45:00Z").toEpochMilli()).mainAt)
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
    fun tippAufVorweckerBeendetHauptweckerNicht() {
        val now = at("2026-11-05", wake)
        val main = AlarmMachine.fired(AlarmState(), AlarmKind.MAIN, now, now).state
        assertEquals(AlarmKind.MAIN, AlarmMachine.stopped(main, "prewake", cfg, now).ringing)
        assertEquals(AlarmKind.MAIN, AlarmMachine.stopped(main, "test", cfg, now).ringing)
        assertEquals(AlarmKind.MAIN, AlarmMachine.stopped(main, "check", cfg, now).ringing)
        assertNull(AlarmMachine.stopped(main, "emergency", cfg, now).ringing)
    }

    @Test
    fun abgelehnterLeichterStoppDarfAuchDenKlingeldienstNichtBeenden() {
        val now = at("2026-11-05", wake)
        for (kind in listOf(AlarmKind.MAIN, AlarmKind.SNOOZE)) {
            val ringing = AlarmMachine.fired(AlarmState(), kind, now, now).state
            for (method in listOf("prewake", "test", "check")) {
                val after = AlarmMachine.stopped(ringing, method, cfg, now + 1)
                assertEquals(ringing, after)
                assertFalse(AlarmMachine.shouldStopRingingService(after))
            }
            assertTrue(AlarmMachine.shouldStopRingingService(AlarmMachine.stopped(ringing, "qr", cfg, now + 1)))
        }
    }

    @Test
    fun verzoegerterStoppIntentDarfNeuenHauptweckerNichtStilllegen() {
        val now = at("2026-11-05", wake)
        val pre = AlarmMachine.fired(AlarmState(), AlarmKind.PRE_WAKE, now - 1000, now - 1000).state
        val stopped = AlarmMachine.stopped(pre, "prewake", cfg, now - 1)
        assertTrue(AlarmMachine.shouldStopRingingService(stopped))
        // Der Stopp-Intent wird erst nach dem Hauptwecker-Start vom Dienst empfangen.
        val main = AlarmMachine.fired(stopped, AlarmKind.MAIN, now, now).state
        assertFalse(AlarmMachine.shouldStopRingingService(main))
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
        assertTrue(AlarmMachine.shouldStopRingingService(out))
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
    fun entsperrenNachGesperrtemStartBeendetNachgeholtenWeckerNicht() {
        val mainAt = at("2026-11-05", wake)
        val now = mainAt + 10 * 60_000L
        val old = AlarmState(bootCount = 4, ringing = AlarmKind.TEST, ringStartedAt = mainAt - 60_000, mainAt = mainAt)
        val booted = AlarmMachine.booted(old, 5, lockedBoot = true)
        assertNull(booted.ringing)
        assertEquals(0L, booted.ringStartedAt)
        val due = AlarmMachine.reconcile(booted, cfg, now)
        assertEquals(AlarmKind.MAIN, due.fireLate)
        val ringing = AlarmMachine.firedScheduled(due.state, AlarmKind.MAIN, due.state.mainAt, now).state
        val unlocked = AlarmMachine.booted(ringing, 5, lockedBoot = false)
        assertEquals(ringing, unlocked)
        assertFalse(AlarmMachine.shouldStopRingingService(unlocked))
        // Auch eine doppelte Zustellung im selben Start lässt den neuen Wecker bestehen.
        assertEquals(ringing, AlarmMachine.booted(ringing, 5, lockedBoot = true))
        assertNull(AlarmMachine.booted(ringing, 6, lockedBoot = false).ringing)
    }

    @Test
    fun ohneStartzaehlerSetztNurDasGesperrteStartsignalKlingelnZurueck() {
        val main = AlarmState(ringing = AlarmKind.MAIN, ringStartedAt = 1234)
        assertNull(AlarmMachine.booted(main, null, lockedBoot = true).ringing)
        assertEquals(main, AlarmMachine.booted(main, null, lockedBoot = false))
    }

    @Test
    fun abgeschalteterWeckerPlantNichts() {
        val r = AlarmMachine.reconcile(AlarmState(mainAt = 5, snoozeAt = 0), cfg.copy(enabled = false), 10_000)
        assertEquals(0L, r.state.mainAt)
        assertNull(r.fireLate)
    }

    @Test
    fun abgeschalteterWeckerHoltAuchFaelligesSchlummernNichtNach() {
        val now = at("2026-11-05", wake + 5)
        val state = AlarmState(mainAt = now + 86_400_000L, snoozeAt = now - 1000, wakeCheckAt = now + 1000, snoozeUsed = true)
        val result = AlarmMachine.reconcile(state, cfg.copy(enabled = false), now)
        assertNull(result.fireLate)
        assertEquals(0L, result.state.mainAt)
        assertEquals(0L, result.state.snoozeAt)
        assertEquals(0L, result.state.wakeCheckAt)
        assertTrue(result.state.snoozeUsed)
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
