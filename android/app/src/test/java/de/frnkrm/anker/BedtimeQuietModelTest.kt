package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class BedtimeQuietModelTest {
    private val start = 100_000L
    private fun at(value: String) = Instant.parse(value).toEpochMilli()
    private val wall = at("2026-11-12T21:00:00Z")
    private fun quiet(minutes: Int = 0) = BedtimePromptModel.arm("chosen-night", minutes, start, wall, 7, false, true, true)
    private fun present(s: BedtimePromptState, elapsed: Long = s.quietDueElapsed, boot: Int = 7,
                        wallNow: Long = wall + elapsed - start, trigger: BedtimeQuietTrigger = BedtimeQuietTrigger.NON_WAKEUP_CHECK,
                        interactive: Boolean = true, unlocked: Boolean = true, alarm: Boolean = false,
                        display: Int? = 2, token: String = "delivery-a") =
        BedtimePromptModel.presentQuiet(s, elapsed, boot, wallNow, trigger, interactive, unlocked, alarm, display, token)

    @Test fun oldStartKeepsItsSingleShotSemanticsAndNewModesRequireConsent() {
        val old = BedtimePromptModel.arm("old", 15, start, wall, 7, true)
        assertFalse(old.followUps)
        assertEquals(BedtimePromptPhase.WAITING, old.phase)
        assertTrue(old.wakeup); assertTrue(old.allowWhileIdle)
        assertEquals(0L, old.quietUntilElapsed)
        assertThrows(IllegalArgumentException::class.java) { BedtimePromptModel.arm("x", 0, start, wall, 7, false, false, true) }
        val chosen = quiet()
        assertEquals(BedtimePromptPhase.QUIET, chosen.phase)
        assertFalse(chosen.wakeup); assertFalse(chosen.allowWhileIdle); assertFalse(chosen.exact)
    }

    @Test fun dismissingTheChosenFirstHintRetainsOnlyTheSameBoundedSilentSession() {
        val first = BedtimePromptModel.arm("chosen", 0, start, wall, 7, true, true)
        val shown = BedtimePromptModel.due(first, first.sessionId, start, 7, true, true, true, false)
        val repeat = BedtimePromptModel.quiet(shown, shown.sessionId, start + 1000, wall + 1000)
        assertEquals(shown.sessionId, repeat.sessionId)
        assertEquals(BedtimePromptPhase.QUIET, repeat.phase)
        assertEquals(start + 301_000, repeat.quietDueElapsed)
        assertEquals(first.quietUntilElapsed, repeat.quietUntilElapsed)
        assertFalse(repeat.wakeup); assertFalse(repeat.allowWhileIdle); assertFalse(repeat.exact)
        assertEquals(repeat, BedtimePromptModel.requestForeground(repeat, repeat.sessionId, repeat.quietDueElapsed, true))
        assertEquals(repeat, BedtimePromptModel.foregroundConfirmed(repeat, repeat.sessionId, repeat.quietDueElapsed))
        assertEquals(repeat, BedtimePromptModel.due(repeat, repeat.sessionId, repeat.quietDueElapsed, 7, true, true, true, false))
    }

    @Test fun quietExpiryOfTheFirstCardNeverStartsAnotherOverlayOrActivity() {
        val first = BedtimePromptModel.arm("chosen", 0, start, wall, 7, true, true)
        val shown = BedtimePromptModel.due(first, first.sessionId, start, 7, true, true, true, false)
        val result = BedtimePromptModel.reconcile(shown, shown.visibleUntilElapsed, 7, wall + 60_000)
        assertEquals(BedtimePromptPhase.QUIET, result.phase)
        assertEquals(BedtimePromptForeground.NOT_REQUESTED, result.foreground)
        assertFalse(result.quietVisible)
    }

    @Test fun monotoneTwoHourEndNeverMovesAfterSnoozeOrWallClockRollback() {
        var current = present(quiet())
        val end = current.quietUntilElapsed
        repeat(8) {
            val elapsed = start + (it + 1) * 300_000L
            current = BedtimePromptModel.snoozeQuiet(current, current.sessionId, elapsed, 7, wall - 86_400_000L)
            assertEquals(end, current.quietUntilElapsed)
            current = present(current, current.quietDueElapsed)
        }
        val expired = BedtimePromptModel.reconcile(current, end, 7, wall - 86_400_000L)
        assertEquals(BedtimePromptPhase.SKIPPED, expired.phase)
        assertFalse(expired.quietVisible)
        assertEquals(expired, present(expired, end + 1))
    }

    @Test fun wallClockForwardAndBootChangesCannotCarryANightIntoAnotherDay() {
        val original = quiet()
        assertEquals("quiet-expired", BedtimePromptModel.reconcile(original, start + 1, 7, original.quietUntilAt).reason)
        assertEquals("restart", BedtimePromptModel.reconcile(original, start + 1, 8, wall).reason)
        assertEquals("restart", BedtimePromptModel.reconcile(original, start - 1, 7, wall).reason)
    }

    @Test fun existingFourAmPlanBoundaryHandlesBerlinBothDstChanges() {
        val spring = at("2026-03-29T00:30:00Z")
        val autumn = at("2026-10-25T00:30:00Z")
        assertEquals(at("2026-03-29T02:00:00Z"), BedtimePromptModel.planWindowEnd(spring))
        assertEquals(at("2026-10-25T03:00:00Z"), BedtimePromptModel.planWindowEnd(autumn))
        val late = BedtimePromptModel.arm("late", 0, start, at("2026-11-13T02:58:00Z"), 7, false, true, true)
        assertEquals(start + 120_000, late.quietUntilElapsed)
        val after = BedtimePromptModel.reconcile(late, late.quietUntilElapsed, 7, late.quietUntilAt)
        assertEquals(BedtimePromptPhase.SKIPPED, after.phase)
    }

    @Test fun displayOnIsNotAWakefulnessClaimAndSamsungNoninteractiveDisplayCannotPost() {
        val original = quiet()
        assertFalse(present(original, interactive = false, display = 2).quietVisible)
        assertFalse(present(original, trigger = BedtimeQuietTrigger.SCREEN_ON).quietVisible)
        for (display in listOf(1, 3, 4, 5, 6)) assertFalse(present(original, display = display).quietVisible)
        // A non-wakeup tick may expose a silent card during continuous unlocked use.
        // This says nothing about whether the person is awake and permits no audio/wake effect.
        assertTrue(present(original).quietVisible)
    }

    @Test fun lockedAlarmAndEarlyChecksStayPendingWithoutConsumingTheSession() {
        val original = quiet(15)
        assertEquals(original, present(original, elapsed = start + 1000))
        assertEquals(original, present(original, unlocked = false))
        assertEquals(original, present(original, alarm = true))
        assertTrue(present(original, trigger = BedtimeQuietTrigger.USER_PRESENT).quietVisible)
        assertTrue(present(original, trigger = BedtimeQuietTrigger.APP_RESUME).quietVisible)
    }

    @Test fun deleteSnoozeAndOldActionTokensCannotAffectANewerQuietDelivery() {
        val visible = present(quiet())
        val snoozed = BedtimePromptModel.snoozeQuiet(visible, visible.sessionId, start + 1000, 7, wall + 1000, "delivery-a")
        assertFalse(snoozed.quietVisible)
        assertEquals("", snoozed.quietToken)
        assertEquals(snoozed, BedtimePromptModel.stopQuiet(snoozed, visible.sessionId, "delivery-a"))
        assertEquals(snoozed, present(snoozed, elapsed = snoozed.quietDueElapsed - 1))
        val newer = present(snoozed, token = "delivery-b")
        assertEquals(newer, BedtimePromptModel.snoozeQuiet(newer, newer.sessionId, newer.quietDueElapsed, 7, wall, "delivery-a"))
        assertEquals(newer, BedtimePromptModel.stopQuiet(newer, "other-night", "delivery-b"))
        val stopped = BedtimePromptModel.stopQuiet(newer, newer.sessionId, "delivery-b")
        assertEquals(BedtimePromptPhase.IDLE, stopped.phase)
        assertEquals(stopped, present(stopped))
    }

    @Test fun sourceDelayAndWindowComeFromTheExistingBedtimeRatherThanLateDelivery() {
        val deliveredWall = wall + 25 * 60_000
        val delayed = BedtimePromptModel.fromReminder("bed", wall, 15, start, deliveredWall, 7)
        assertEquals(wall + 15 * 60_000, delayed.quietDueAt)
        assertEquals(wall + 135 * 60_000, delayed.quietUntilAt)
        assertEquals(start + 110 * 60_000, delayed.quietUntilElapsed)
        assertEquals(start, delayed.quietDueElapsed)
        val stale = BedtimePromptModel.fromReminder("bed", wall, 15, start, wall + 136 * 60_000, 7)
        assertEquals(BedtimePromptPhase.SKIPPED, stale.phase)
        assertFalse(stale.quietVisible)
    }

    @Test fun todayQuietAndExistingManualOwnerWinOverSourceRevisionOrTokenChanges() {
        val source = BedtimeQuietSource("2026-11-12", "bed", "revision-a", "token-a", wall)
        val revisions = mapOf("2026-11-12|bed" to "revision-a")
        assertEquals(BedtimeQuietSourceAction.START, BedtimePromptModel.quietSourceAction(BedtimePromptState(), source, revisions, true, ""))
        assertEquals(BedtimeQuietSourceAction.REJECT, BedtimePromptModel.quietSourceAction(BedtimePromptState(), source, revisions, false, ""))
        val newSource = source.copy(revision = "revision-b", token = "token-b")
        val newRevisions = mapOf("2026-11-12|bed" to "revision-b")
        assertEquals(BedtimeQuietSourceAction.REJECT, BedtimePromptModel.quietSourceAction(BedtimePromptState(), newSource, newRevisions, true, source.date))
        assertEquals(BedtimeQuietSourceAction.REJECT, BedtimePromptModel.quietSourceAction(quiet(), source, revisions, true, ""))
        val stopped = BedtimePromptModel.stop(quiet().copy(quietSource = source))
        assertEquals(BedtimeQuietSourceAction.REUSE, BedtimePromptModel.quietSourceAction(stopped, source.copy(token = "new-token"), revisions, true, ""))
        assertFalse(BedtimePromptModel.currentQuietSource(source, emptyMap())) // open end/removed source
        assertFalse(BedtimePromptModel.currentQuietSource(source.copy(date = "2026-02-30"), mapOf("2026-02-30|bed" to source.revision)))
    }

    @Test fun realCanonicalWeeklyRevisionIsRetainedWithoutTruncationOrAnExtraHash() {
        // Actual TypeScript buildReminderRuleSnapshot fixture, including the chosen existing delay.
        val revision = """[{"ruleId":"basis:0:bed","key":"bed","weekday":0,"minute":1315,"channel":"sanft","title":"Deine gewählte Schlafenszeit","body":"Anker kann dich nach deiner Einschlafdauer still an deinen Plan erinnern. Du entscheidest, wie es weitergeht.","slot":1,"rank":4,"exact":false,"quietFollowUps":true},{"delayMinutes":20}]|2026-11-09"""
        assertEquals(325, revision.length)
        val source = BedtimeQuietSource("2026-11-09", "bed", revision, "synthetic-token", wall)
        val revisions = mapOf("2026-11-09|bed" to revision)
        assertTrue(BedtimePromptModel.currentQuietSource(source, revisions))
        assertEquals(BedtimeQuietSourceAction.START, BedtimePromptModel.quietSourceAction(BedtimePromptState(), source, revisions, true, ""))
        assertFalse(BedtimePromptModel.currentQuietSource(source.copy(revision = revision.dropLast(1)), revisions))
    }

    @Test fun clockRollbackBeforeAsyncHandoffCannotCreateAnUnboundedMonotoneSession() {
        for (rollback in listOf(1L, 60_000L, 86_400_000L)) {
            assertThrows(IllegalArgumentException::class.java) {
                BedtimePromptModel.fromReminder("bed", wall, 20, start, wall - rollback, 7)
            }
        }
        val onTime = BedtimePromptModel.fromReminder("bed", wall, 20, start, wall, 7)
        assertEquals(start + 140 * 60_000, onTime.quietUntilElapsed)
        val delayed = BedtimePromptModel.fromReminder("bed", wall, 20, start, wall + 5 * 60_000, 7)
        assertTrue(delayed.quietUntilElapsed < onTime.quietUntilElapsed)
        assertEquals(onTime.quietUntilAt, delayed.quietUntilAt)
    }
}
