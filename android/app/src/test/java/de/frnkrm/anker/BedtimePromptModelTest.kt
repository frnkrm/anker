package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class BedtimePromptModelTest {
    private val start = 100_000L
    private val wall = 1_790_000_000_000L
    private fun waiting(minutes: Int = 15) = BedtimePromptModel.arm("night-a", minutes, start, wall, 7, true)
    private fun due(s: BedtimePromptState, id: String = s.sessionId, at: Long = s.dueElapsed, boot: Int = 7,
                    interactive: Boolean = true, unlocked: Boolean = true, permission: Boolean = true,
                    alarm: Boolean = false) =
        BedtimePromptModel.due(s, id, at, boot, interactive, unlocked, permission, alarm)

    @Test fun defaultsNeverArmAnything() {
        val empty = BedtimePromptState()
        assertEquals(BedtimePromptPhase.IDLE, empty.phase)
        assertEquals(empty, due(empty, "old", 900_000))
    }
    @Test fun manualStartUsesExistingDelayAndMonotoneDeadline() {
        val s = waiting()
        assertEquals(BedtimePromptPhase.WAITING, s.phase)
        assertEquals(start + 15 * 60_000, s.dueElapsed)
        assertEquals(wall + 15 * 60_000, s.dueAt)
        assertEquals(s, due(s, at = s.dueElapsed - 1))
    }
    @Test fun zeroMinutesIsAConsciousImmediateOneShot() {
        val s = waiting(0)
        assertEquals(start, s.dueElapsed)
        assertEquals(BedtimePromptPhase.SHOWN, due(s).phase)
    }
    @Test fun invalidDelayAndClockOverflowCannotCreateSessions() {
        for (minutes in listOf(-1, 61, Int.MAX_VALUE)) {
            try { waiting(minutes); fail("invalid delay") } catch (_: IllegalArgumentException) { }
        }
        try { BedtimePromptModel.arm("", 1, start, wall, 7, true); fail("empty nonce") } catch (_: IllegalArgumentException) { }
        try { BedtimePromptModel.arm("x", 60, Long.MAX_VALUE, wall, 7, true); fail("overflow") } catch (_: IllegalArgumentException) { }
    }
    @Test fun onlyCurrentNonceCanConsumeTheDueEvent() {
        val s = waiting()
        assertEquals(s, due(s, "previous-night"))
        val shown = due(s)
        assertEquals(BedtimePromptPhase.SHOWN, shown.phase)
        assertEquals(shown, due(shown))
        assertEquals(shown, due(shown, at = shown.dueElapsed + 1000))
    }
    @Test fun nonWakeupLateDeliveryIsNotCaughtUp() {
        val s = waiting()
        val late = due(s, at = s.dueElapsed + BedtimePromptModel.DELIVERY_GRACE_MS + 1)
        assertEquals(BedtimePromptPhase.SKIPPED, late.phase)
        assertEquals("expired", late.reason)
        assertEquals(late, due(late))
    }
    @Test fun screenOffAtDueSkipsAndNeverResumesAtUnlock() {
        val s = waiting()
        val skipped = due(s, interactive = false)
        assertEquals("screen-off", skipped.reason)
        assertEquals(BedtimePromptPhase.SKIPPED, skipped.phase)
        assertEquals(skipped, due(skipped, interactive = true))
    }
    @Test fun waitingDoesNotDependOnEarlierScreenStateOrAnAliveProcess() {
        // Ein aus Prefs restaurierter Wert genügt: kein flüchtiger Prozess-/Activitybesitz.
        val persisted = waiting().copy()
        assertEquals(persisted, BedtimePromptModel.reconcile(persisted, persisted.dueElapsed - 1, 7))
        assertEquals(BedtimePromptPhase.SHOWN, due(persisted, interactive = true, unlocked = true).phase)
    }
    @Test fun lockedDeviceAndRevokedOverlayPermissionNeverShow() {
        assertEquals("locked", due(waiting(), unlocked = false).reason)
        assertEquals("permission-revoked", due(waiting(), permission = false).reason)
    }
    @Test fun realAlarmHasPriorityAndIsNotModifiedByTheModel() {
        assertEquals("alarm-active", due(waiting(), alarm = true).reason)
        val shown = due(waiting())
        assertEquals(BedtimePromptPhase.SKIPPED, BedtimePromptModel.skip(shown, "alarm-active").phase)
    }
    @Test fun bootChangeAndClockRollbackCancelOldSessions() {
        assertEquals("restart", due(waiting(), boot = 8).reason)
        assertEquals("restart", BedtimePromptModel.reconcile(waiting(), start - 1, 7).reason)
    }
    @Test fun receiverAfterColdStartStillRejectsScreenOffAtDue() {
        assertEquals("screen-off", due(waiting().copy(), interactive = false).reason)
    }
    @Test fun overlayIsBoundedAndExpiryIsIdempotent() {
        val shown = due(waiting())
        assertEquals(shown.dueElapsed + BedtimePromptModel.DISPLAY_DURATION_MS, shown.visibleUntilElapsed)
        assertEquals(shown, BedtimePromptModel.reconcile(shown, shown.visibleUntilElapsed - 1, 7))
        val expired = BedtimePromptModel.reconcile(shown, shown.visibleUntilElapsed, 7)
        assertEquals("expired", expired.reason)
        assertEquals(expired, BedtimePromptModel.reconcile(expired, shown.visibleUntilElapsed + 1, 7))
    }
    @Test fun stopAndAckCannotDismissANewerSession() {
        val shown = due(waiting())
        assertEquals(shown, BedtimePromptModel.stop(shown, "old"))
        assertEquals(shown, BedtimePromptModel.ack(shown, "old"))
        assertEquals(waiting(), BedtimePromptModel.ack(waiting(), "night-a"))
        assertEquals(BedtimePromptPhase.IDLE, BedtimePromptModel.ack(shown, "night-a").phase)
        val stopped = BedtimePromptModel.stop(shown, "night-a")
        assertEquals(BedtimePromptPhase.IDLE, stopped.phase)
        assertEquals(stopped, due(stopped))
    }
    @Test fun aNewManualNightHasItsOwnNonceAndPrecisionFlag() {
        val old = waiting()
        val next = BedtimePromptModel.arm("night-b", 60, start + 2000, wall + 2000, 7, false)
        assertFalse(next.exact)
        assertEquals(next, due(next, old.sessionId))
        assertEquals(next, BedtimePromptModel.stop(next, old.sessionId))
    }
    @Test fun updateAndRevocationConsumeBothWaitingAndShownSessions() {
        for (s in listOf(waiting(), due(waiting()))) for (reason in listOf("updated", "permission-revoked", "locked", "screen-off")) {
            val ended = BedtimePromptModel.skip(s, reason)
            assertEquals(BedtimePromptPhase.SKIPPED, ended.phase)
            assertEquals(reason, ended.reason)
            assertEquals(ended, due(ended))
        }
    }
}
