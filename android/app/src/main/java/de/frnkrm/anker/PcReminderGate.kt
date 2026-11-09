package de.frnkrm.anker

/** Non-secret, immutable projection of the authenticated native channel. Not saved or exported. */
data class PcReminderProof(val connected: Boolean, val revision: String, val date: String, val validUntil: Long,
    val ackRevision: String, val ackDate: String, val mode: String, val receivedAt: Long, val noWarnings: Boolean, val enforceEnabled: Boolean)
data class PcReminderExpectation(val revision: String, val date: String, val validUntil: Long)

object PcReminderGate {
    const val FRESH_MS = 90_000L
    const val RETRY_MS = 30_000L
    fun suppress(entry: ReminderEntry, expected: PcReminderExpectation?, proof: PcReminderProof?, now: Long): Boolean {
        if (entry.key !in setOf("pcstop", "pcstop-15") || expected == null || proof == null) return false
        val local = java.time.Instant.ofEpochMilli(now).atZone(AlarmPlanner.ZONE)
        val today = local.toLocalDate().minusDays(if (local.hour < 4) 1 else 0).toString()
        return entry.date == today && expected.date == today && proof.date == today && proof.ackDate == today
            && expected.revision.isNotEmpty() && expected.revision == proof.revision && proof.revision == proof.ackRevision
            && expected.validUntil > now && proof.validUntil > now && proof.connected && proof.enforceEnabled && proof.noWarnings
            && proof.mode in setOf("scheduled", "locked") && proof.receivedAt in (now - FRESH_MS)..(now + 5_000)
    }
    fun defer(entry: ReminderEntry, now: Long): ReminderEntry = entry.copy(at = now + RETRY_MS,
        deferredFrom = if (entry.deferredFrom > 0) entry.deferredFrom else entry.at)
    fun originalAt(entry: ReminderEntry): Long = if (entry.deferredFrom > 0) entry.deferredFrom else entry.at
}
