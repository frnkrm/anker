package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class SmartWakeModelTest {
    private val target = 10_000_000L
    private val from = target - 45 * 60_000L
    private val cfg = AlarmConfig(enabled = true, wakeMinutes = 390, smartWakeEnabled = true)

    @Test fun preparedNightPausesOnlyPrewakeAndRejectsItsOldSignal() {
        val s = AlarmState(mainAt = target, preWakeAt = target - 30 * 60_000L)
        val prepared = AlarmMachine.preparedSmartWake(s, cfg.copy(preWakeEnabled = true), target, from)!!
        assertEquals(target, prepared.mainAt)
        assertEquals(0L, prepared.preWakeAt)
        assertEquals(target, prepared.preWakePausedForTargetAt)
        assertEquals(s.copy(preWakeAt = 0, preWakePausedForTargetAt = target), prepared)
        assertFalse(AlarmMachine.firedScheduled(prepared, AlarmKind.PRE_WAKE, s.preWakeAt, s.preWakeAt).ring)
        assertTrue(AlarmMachine.firedScheduled(prepared, AlarmKind.MAIN, target, target).ring)
    }

    @Test fun nightPauseSurvivesReconcileBootAndLaterEnablingPrewake() {
        val hard = AlarmPlanner.toUtc(java.time.LocalDate.parse("2026-11-06"), cfg.wakeMinutes)
        val now = hard - 60 * 60_000L
        val prepared = AlarmMachine.preparedSmartWake(AlarmState(mainAt = hard), cfg, hard, now)!!
        val withPrewake = cfg.copy(preWakeEnabled = true)
        for (initial in listOf(prepared, AlarmMachine.booted(prepared, 5, true))) {
            val once = AlarmMachine.reconcile(initial, withPrewake, now).state
            assertEquals(hard, once.mainAt)
            assertEquals(0L, once.preWakeAt)
            assertEquals(once, AlarmMachine.reconcile(once, withPrewake, now).state)
        }
    }

    @Test fun newMainOccurrenceRestoresConfiguredPrewake() {
        val day = java.time.LocalDate.parse("2026-11-06")
        val hard = AlarmPlanner.toUtc(day, cfg.wakeMinutes)
        val now = hard - 60 * 60_000L
        val withPrewake = cfg.copy(preWakeEnabled = true)
        val prepared = AlarmMachine.preparedSmartWake(AlarmState(mainAt = hard), withPrewake, hard, now)!!
        val changed = AlarmMachine.reconcile(prepared, withPrewake.copy(wakeMinutes = cfg.wakeMinutes + 60), now).state
        assertEquals(0L, changed.preWakePausedForTargetAt)
        assertEquals(changed.mainAt - 30 * 60_000L, changed.preWakeAt)
        val fired = AlarmMachine.firedScheduled(prepared, AlarmKind.MAIN, hard, hard).state
        val tomorrow = AlarmMachine.reconcile(fired, withPrewake, hard).state
        assertEquals(AlarmPlanner.toUtc(day.plusDays(1), cfg.wakeMinutes), tomorrow.mainAt)
        assertEquals(tomorrow.mainAt - 30 * 60_000L, tomorrow.preWakeAt)
        assertEquals(0L, tomorrow.preWakePausedForTargetAt)
        val disabled = AlarmMachine.reconcile(prepared, withPrewake.copy(enabled = false), now).state
        assertEquals(0L, disabled.mainAt)
        assertEquals(0L, disabled.preWakePausedForTargetAt)
    }

    @Test fun rejectedMeasurementPreparationDoesNotChangeExistingAlarms() {
        val s = AlarmState(mainAt = target, preWakeAt = target - 30 * 60_000L)
        assertNull(AlarmMachine.preparedSmartWake(s, cfg.copy(enabled = false), target, from))
        assertNull(AlarmMachine.preparedSmartWake(s, cfg.copy(smartWakeEnabled = false), target, from))
        assertNull(AlarmMachine.preparedSmartWake(s, cfg, target + 1, from))
        assertNull(AlarmMachine.preparedSmartWake(s, cfg, target, target))
        assertNull(AlarmMachine.preparedSmartWake(s.copy(ringing = AlarmKind.PRE_WAKE), cfg, target, from))
        assertEquals(target - 30 * 60_000L, s.preWakeAt)
    }

    @Test fun combinedActivityOnlyInsideWindowAfterCalibrationAndOnce() {
        val d = SmartWakeDetector(from, target)
        assertFalse(d.observe(from - 1, 1.0, 0.2))
        for (i in 1..3) assertFalse(d.observe(from + i * 10_000, 0.02, 0.002))
        assertFalse(d.observe(from + 40_000, 1.0, 0.1))
        assertFalse(d.observe(from + 50_000, 1.0, 0.1))
        assertTrue(d.observe(from + 60_000, 1.0, 0.1))
        assertFalse(d.observe(from + 70_000, 1.0, 0.1))
    }

    @Test fun movementOrConstantNoiseAloneDoesNotWake() {
        for (motionOnly in listOf(true, false)) {
            val d = SmartWakeDetector(from, target)
            for (i in 1..3) d.observe(from + i * 10_000, 0.02, 0.01)
            for (i in 4..20) assertFalse(d.observe(from + i * 10_000, if (motionOnly) 1.0 else 0.02, 0.01))
            assertFalse(d.observe(target, 1.0, 0.2))
        }
    }

    @Test fun activityMustBeRecentAndCannotBeSimulatedByRapidDuplicateTicks() {
        val d = SmartWakeDetector(from, target)
        for (i in 1..3) d.observe(from + i * 10_000, 0.02, 0.002)
        assertFalse(d.observe(from + 40_000, 1.0, 0.1))
        assertFalse(d.observe(from + 40_001, 1.0, 0.1))
        assertFalse(d.observe(from + 50_000, 1.0, 0.1))
        assertFalse(d.observe(from + 180_000, 1.0, 0.1))
    }

    @Test fun earlyAlarmLeavesFixedDeadlineUntilRealConfirmation() {
        val s = AlarmState(mainAt = target)
        assertFalse(AlarmMachine.smartFired(s, cfg, target, from - 1).ring)
        val early = AlarmMachine.smartFired(s, cfg, target, from + 60_000)
        assertTrue(early.ring)
        assertEquals(target, early.state.mainAt)
        val planned = AlarmMachine.reconcile(early.state, null, from + 60_000).state
        // Mit echter Datumskonfiguration separat unten: ungeprüftes frühes Klingeln gilt nie als bestätigt.
        assertEquals(0L, planned.smartConfirmedAt)
        assertEquals(AlarmKind.MAIN, planned.ringing)
        assertFalse(AlarmMachine.smartFired(early.state, cfg, target, from + 70_000).ring)
        assertEquals(0L, AlarmMachine.stopped(early.state, "prewake", cfg, from + 70_000).smartConfirmedAt)
        assertEquals(target, AlarmMachine.stopped(early.state, "qr", cfg, from + 70_000).smartConfirmedAt)
    }

    @Test fun realPlannerKeepsFallbackThroughTimeoutAndRebootButSkipsAfterQr() {
        val day = java.time.LocalDate.parse("2026-11-06")
        val hard = AlarmPlanner.toUtc(day, cfg.wakeMinutes)
        val earlyAt = hard - 20 * 60_000
        val early = AlarmMachine.smartFired(AlarmState(mainAt = hard), cfg, hard, earlyAt).state
        assertEquals(hard, AlarmMachine.reconcile(early, cfg, earlyAt).state.mainAt)
        val timeout = AlarmMachine.timedOut(early, earlyAt + 1000)
        assertEquals(hard, AlarmMachine.reconcile(timeout, cfg, earlyAt + 1000).state.mainAt)
        val armed = AlarmMachine.reconcile(early, cfg, earlyAt).state
        val reboot = AlarmMachine.booted(armed, 2, true)
        val late = AlarmMachine.reconcile(reboot, cfg, hard + 5 * 60_000)
        assertEquals(AlarmKind.MAIN, late.fireLate)
        val stopped = AlarmMachine.stopped(early, "math", cfg, earlyAt + 1000)
        assertEquals(AlarmPlanner.toUtc(day.plusDays(1), cfg.wakeMinutes), AlarmMachine.reconcile(stopped, cfg, earlyAt + 1000).state.mainAt)
        assertFalse(AlarmMachine.firedScheduled(stopped, AlarmKind.MAIN, hard, hard).ring)
        val stoppedThenCrash = stopped.copy(mainAt = hard)
        assertNull(AlarmMachine.reconcile(stoppedThenCrash, cfg, hard + 1000).fireLate)
    }

    @Test fun fixedFallbackDoesNotGrantExtraSnoozeAfterEarlySnooze() {
        val early = AlarmMachine.smartFired(AlarmState(mainAt = target), cfg, target, from + 60_000).state
        val snoozed = AlarmMachine.snoozed(early, 5, from + 70_000)!!
        val fallback = AlarmMachine.firedScheduled(snoozed, AlarmKind.MAIN, target, target).state
        assertTrue(fallback.snoozeUsed)
        assertNull(AlarmMachine.snoozed(fallback, 5, target + 1))
        assertFalse(AlarmMachine.smartFired(AlarmState(mainAt = target), cfg.copy(smartWakeEnabled = false), target, from + 1).ring)
    }

    @Test fun fixedScheduledBoundarySurvivesEarlyTimeoutAndBoot() {
        val hard = AlarmPlanner.toUtc(java.time.LocalDate.parse("2026-11-06"), cfg.wakeMinutes)
        val earlyAt = hard - 40 * 60_000L
        val early = AlarmMachine.smartFired(AlarmState(mainAt = hard), cfg, hard, earlyAt).state
        for (recovered in listOf(AlarmMachine.timedOut(early, earlyAt + AlarmKind.MAIN.timeoutMs), AlarmMachine.booted(early, 3, true))) {
            val due = AlarmMachine.reconcile(recovered, cfg, hard + 1000)
            assertEquals(AlarmKind.MAIN, due.fireLate)
            assertTrue(AlarmMachine.firedScheduled(due.state, AlarmKind.MAIN, due.state.mainAt, hard + 1000).ring)
        }
        val confirmed = AlarmMachine.stopped(early, "qr", cfg, earlyAt + 1000)
        assertFalse(AlarmMachine.firedScheduled(confirmed, AlarmKind.MAIN, hard, hard).ring)
        val next = AlarmMachine.reconcile(confirmed, cfg, earlyAt + 1000).state
        assertFalse(AlarmMachine.firedScheduled(next, AlarmKind.MAIN, hard, hard).ring)
    }
}
