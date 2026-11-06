package de.frnkrm.anker

import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test

class ReminderRulesTest {
    private fun utc(value: String) = Instant.parse(value).toEpochMilli()
    private fun rule(weekday: Int = 0, minute: Int = 7 * 60, key: String = "leave") = NativeReminderRule(
        ruleId = "basis:$weekday:$key", key = key, weekday = weekday, minute = minute,
        channel = "uebergang", title = "Allgemeiner Übergang", body = "Öffne Anker.",
        slot = 1, rank = 4, exact = true, revision = "r1",
    )
    private fun snapshot(rule: NativeReminderRule, from: Long = 0, excluded: Set<String> = emptySet()) =
        NativeReminderRuleSnapshot(from, excluded, listOf(rule))

    @Test fun nextOccurrenceIsStrictlyFutureAndKeepsRuleIdentity() {
        val r = rule()
        val at = utc("2026-11-02T06:00:00Z")
        val first = ReminderRules.nextOccurrence(r, snapshot(r), at - 1)!!
        assertEquals(at, first.at)
        assertEquals("2026-11-02", first.date)
        assertEquals(r.ruleId, first.ruleId)
        assertEquals(r.revision, first.revision)
        assertEquals("2026-11-09", ReminderRules.nextOccurrence(r, snapshot(r), at)!!.date)
    }

    @Test fun snapshotBoundaryIsInclusiveButNeverProducesEarlierDate() {
        val r = rule()
        val at = utc("2026-11-02T06:00:00Z")
        assertEquals(at, ReminderRules.nextOccurrence(r, snapshot(r, at), at - 1000)!!.at)
        assertEquals("2026-11-09", ReminderRules.nextOccurrence(r, snapshot(r, at + 1), at - 1000)!!.date)
    }

    @Test fun exclusionBelongsToLogicalPlanDayForAfterMidnightTimes() {
        val r = rule(weekday = 6, minute = 1470, key = "bed")
        val now = utc("2026-11-01T22:00:00Z")
        val first = ReminderRules.nextOccurrence(r, snapshot(r), now)!!
        assertEquals("2026-11-01", first.date)
        assertEquals(utc("2026-11-01T23:30:00Z"), first.at)
        assertEquals(first, ReminderRules.nextOccurrence(r, snapshot(r, excluded = setOf("2026-11-02")), now))
        assertEquals("2026-11-08", ReminderRules.nextOccurrence(r, snapshot(r, excluded = setOf("2026-11-01")), now)!!.date)
    }

    @Test fun springGapMovesForwardAndAutumnOverlapUsesLaterOccurrence() {
        val r = rule(weekday = 6, minute = 150, key = "bed")
        assertEquals(utc("2026-03-29T01:30:00Z"), ReminderRules.nextOccurrence(r, snapshot(r), utc("2026-03-29T00:00:00Z"))!!.at)
        assertEquals(utc("2026-10-25T01:30:00Z"), ReminderRules.nextOccurrence(r, snapshot(r), utc("2026-10-24T22:00:00Z"))!!.at)
    }

    @Test fun weeklyWallTimeSurvivesWinterSummerAndBothDstTransitions() {
        val r = rule(weekday = 6, minute = 7 * 60)
        for ((date, expected) in listOf(
            "2026-01-04" to "2026-01-04T06:00:00Z",
            "2026-03-29" to "2026-03-29T05:00:00Z",
            "2026-07-05" to "2026-07-05T05:00:00Z",
            "2026-10-25" to "2026-10-25T06:00:00Z",
        )) {
            val before = AlarmPlanner.toUtc(LocalDate.parse(date), 0)
            assertEquals(expected, utc(expected), ReminderRules.nextOccurrence(r, snapshot(r), before)!!.at)
        }
    }

    @Test fun monthsWithoutOpeningGenerateOnlyNextFutureOccurrence() {
        val r = rule()
        val s = snapshot(r, utc("2026-01-01T00:00:00Z"))
        val next = ReminderRules.nextOccurrence(r, s, utc("2026-04-02T12:00:00Z"))!!
        assertEquals("2026-04-06", next.date)
        assertEquals(utc("2026-04-06T05:00:00Z"), next.at)
    }

    @Test fun consumedHighwaterPreventsReplayAfterClockRollback() {
        val r = rule()
        val old = utc("2026-11-02T06:00:00Z")
        val next = ReminderRules.nextOccurrence(r, snapshot(r), old - 3600_000L, old)!!
        assertEquals("2026-11-09", next.date)
        assertTrue(next.at > old)
    }

    @Test fun knownSpecialDaysAreSkippedWithoutInventingTheirPlan() {
        val r = rule()
        val next = ReminderRules.nextOccurrence(r, snapshot(r, excluded = setOf("2026-11-02", "2026-11-09")), utc("2026-11-01T12:00:00Z"))!!
        assertEquals("2026-11-16", next.date)
    }

    @Test fun exhaustedSearchInvalidRulesAndRemovedRevisionsStayUnscheduled() {
        val r = rule()
        val start = LocalDate.parse("2026-11-01")
        val excluded = (0L..401L).map { start.plusDays(it).toString() }.toSet()
        assertNull(ReminderRules.nextOccurrence(r, snapshot(r, excluded = excluded), utc("2026-11-01T12:00:00Z")))
        for (bad in listOf(r.copy(weekday = 7), r.copy(minute = -1), r.copy(minute = 2880), r.copy(key = "go:private"), r.copy(ruleId = "different"), r.copy(revision = ""))) {
            assertNull(ReminderRules.nextOccurrence(bad, snapshot(bad), utc("2026-11-01T12:00:00Z")))
        }
        assertNull(ReminderRules.nextOccurrence(r, snapshot(r.copy(revision = "r2")), utc("2026-11-01T12:00:00Z")))
        assertNull(ReminderRules.nextOccurrence(r, snapshot(r), Long.MAX_VALUE))
    }
}
