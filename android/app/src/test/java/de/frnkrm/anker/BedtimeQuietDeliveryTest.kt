package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class BedtimeQuietDeliveryTest {
    private val wall = java.time.Instant.parse("2026-11-12T21:00:00Z").toEpochMilli()
    private val elapsed = 100_000L
    private fun visible() = BedtimePromptModel.presentQuiet(
        BedtimePromptModel.arm("night", 0, elapsed, wall, 7, false, true, true), elapsed, 7, wall,
        BedtimeQuietTrigger.NON_WAKEUP_CHECK, true, true, false, 2, "current-token")
    private fun allowed(s: BedtimePromptState = visible(), id: String = s.sessionId, token: String = s.quietToken,
                        at: Long = elapsed, boot: Int = 7, wallNow: Long = wall,
                        interactive: Boolean = true, display: Int? = 2, unlocked: Boolean = true, alarm: Boolean = false,
                        notifications: Boolean = true, importance: Int = 2, sound: Boolean = false,
                        vibration: Boolean = false, lights: Boolean = false) =
        BedtimePromptDelivery.canPostQuiet(s, id, token, at, boot, wallNow, interactive, display, unlocked, alarm,
            notifications, importance, sound, vibration, lights)

    @Test fun postRequiresCurrentSessionTokenAndFreshUnlockedDisplayObservation() {
        assertTrue(allowed())
        assertFalse(allowed(id = "old-night")); assertFalse(allowed(token = "old-token"))
        assertFalse(allowed(unlocked = false)); assertFalse(allowed(alarm = true))
        assertFalse(allowed(interactive = false, display = 2))
        for (state in listOf(1, 3, 4, 5, 6)) assertFalse(allowed(display = state))
        assertFalse(allowed(boot = 8)); assertFalse(allowed(at = elapsed - 1))
        assertFalse(allowed(s = BedtimePromptModel.stop(visible())))
        assertFalse(allowed(wallNow = visible().quietUntilAt))
    }

    @Test fun evenUserEscalatedChannelSettingsCannotTurnTheFollowUpIntoAnAlert() {
        assertFalse(allowed(notifications = false))
        for (importance in listOf(-1000, 0, 3, 4, 5)) assertFalse(allowed(importance = importance))
        assertFalse(allowed(sound = true)); assertFalse(allowed(vibration = true)); assertFalse(allowed(lights = true))
        assertTrue(allowed(importance = 1)); assertTrue(allowed(importance = 2))
    }

    @Test fun reservedButUnpostedIdentityDoesNotAuthorizeNotificationActionsAndInlineHelpRemainsReady() {
        val pending = visible().copy(quietVisible = false)
        assertTrue(allowed(pending)) // eligibility to make the first actual post, not a delivery receipt
        assertTrue(BedtimePromptModel.quietReady(pending, elapsed, 7, wall, true, 2, true, false))
        assertFalse(allowed(pending, notifications = false))
        assertEquals(pending, BedtimePromptModel.stopQuiet(pending, pending.sessionId, pending.quietToken))
        assertEquals(pending, BedtimePromptModel.snoozeQuiet(pending, pending.sessionId, elapsed, 7, wall, pending.quietToken))
        assertEquals(pending, BedtimePromptModel.stopQuiet(pending, pending.sessionId, "old-token"))
    }

    @Test fun oneDeferredCheckUsesOriginalFutureDeadlineThenFiveMinutesWithoutExtendingEnd() {
        val waiting = BedtimePromptModel.arm("later", 15, elapsed, wall, 7, false, true, true)
        assertEquals(waiting.quietDueElapsed, BedtimePromptDelivery.nextQuietCheck(waiting, elapsed))
        assertEquals(elapsed + BedtimePromptModel.QUIET_SNOOZE_MS, BedtimePromptDelivery.nextQuietCheck(visible(), elapsed))
        val end = visible().quietUntilElapsed
        assertEquals(end, BedtimePromptDelivery.nextQuietCheck(visible(), end - 1))
        assertNull(BedtimePromptDelivery.nextQuietCheck(visible(), end))
        assertNull(BedtimePromptDelivery.nextQuietCheck(BedtimePromptModel.stop(visible()), elapsed))
    }

    @Test fun aDozeDelayedCheckDoesNotCatchUpSeveralNotificationsOrResetTheTwoHourWindow() {
        val first = visible()
        val resumedAt = elapsed + 70 * 60_000L
        assertEquals(resumedAt + 5 * 60_000, BedtimePromptDelivery.nextQuietCheck(first, resumedAt))
        val resumed = BedtimePromptModel.presentQuiet(BedtimePromptModel.hideQuiet(first), resumedAt, 7,
            wall + 70 * 60_000L, BedtimeQuietTrigger.USER_PRESENT, true, true, false, 2, "next-token")
        assertTrue(resumed.quietVisible)
        assertEquals(first.sessionId, resumed.sessionId)
        assertEquals(first.quietUntilElapsed, resumed.quietUntilElapsed)
        assertFalse(allowed(first, at = first.quietUntilElapsed, wallNow = first.quietUntilAt))
    }
}
