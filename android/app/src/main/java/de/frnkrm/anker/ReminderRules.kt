package de.frnkrm.anker

import java.time.Instant

/** Weekly baseline compiled by the canonical TypeScript planner. No task or arrival inference. */
data class NativeReminderRule(
    val ruleId: String,
    val key: String,
    /** Monday=0. */
    val weekday: Int,
    /** Logical plan minutes, including after-midnight values above1440. */
    val minute: Int,
    val channel: String,
    val title: String,
    val body: String,
    val slot: Int,
    val rank: Int,
    val exact: Boolean,
    val revision: String,
)

data class NativeReminderRuleSnapshot(
    val validFrom: Long,
    val excludedDates: Set<String>,
    val rules: List<NativeReminderRule>,
)

data class ReminderRuleOccurrence(val ruleId: String, val date: String, val at: Long, val revision: String)

object ReminderRules {
    private val CRITICAL_BASE_KEYS = setOf("leave", "latest-leave", "latest-start", "pcstop", "bed", "meds")
    private val SOFT_GUIDANCE_KEYS = setOf("guidance-wind-down", "guidance-brain-dump", "guidance-evening-light")
    private const val SEARCH_DAYS = 400L

    /** Invalid/corrupted or unsupported rules are ignored rather than turned into arbitrary alarms. */
    private fun valid(rule: NativeReminderRule): Boolean =
        (rule.key in CRITICAL_BASE_KEYS || rule.key in SOFT_GUIDANCE_KEYS) && rule.weekday in 0..6 && rule.minute in 0..2879 &&
            rule.ruleId == "basis:${rule.weekday}:${rule.key}" && rule.revision.isNotBlank() &&
            rule.channel in setOf("wecker", "uebergang", "sanft") && rule.slot in 0..2 && rule.rank >= 0 &&
            (rule.key !in SOFT_GUIDANCE_KEYS || (rule.channel == "sanft" && !rule.exact))

    fun critical(key: String): Boolean = key in CRITICAL_BASE_KEYS

    /**
     * One strictly future occurrence only. Missed days are never replayed. The caller persists
     * lastConsumedAt per rule to prevent clock rollback from regenerating a consumed occurrence.
     */
    fun nextOccurrence(rule: NativeReminderRule, snapshot: NativeReminderRuleSnapshot, now: Long, lastConsumedAt: Long = 0): ReminderRuleOccurrence? {
        if (!valid(rule) || rule !in snapshot.rules || snapshot.validFrom < 0 || now == Long.MAX_VALUE || lastConsumedAt == Long.MAX_VALUE) return null
        val after = maxOf(now, lastConsumedAt, snapshot.validFrom - 1)
        return try {
            // An after-midnight occurrence belongs to the previous logical plan day.
            val start = Instant.ofEpochMilli(after).atZone(AlarmPlanner.ZONE).toLocalDate()
                .minusDays(Math.floorDiv(rule.minute, 1440).toLong())
            for (offset in 0..SEARCH_DAYS) {
                val date = start.plusDays(offset)
                if (date.dayOfWeek.value - 1 != rule.weekday || date.toString() in snapshot.excludedDates) continue
                val at = AlarmPlanner.toUtc(date, rule.minute)
                if (at > after && at >= snapshot.validFrom) return ReminderRuleOccurrence(rule.ruleId, date.toString(), at, rule.revision)
            }
            null
        } catch (_: RuntimeException) {
            null
        }
    }
}
