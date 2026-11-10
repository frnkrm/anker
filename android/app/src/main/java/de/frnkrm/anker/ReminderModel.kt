package de.frnkrm.anker

/**
 * Reine Logik der Erinnerungen (JUnit: ReminderModelTest).
 * Warteschlange (geplant) und Slots (sichtbar) sind getrennt: Wird eine sichtbare Meldung ersetzt,
 * geht keine geplante verloren. Sichtbar sind höchstens drei eigene normale Meldungen.
 */
data class ReminderEntry(
    val key: String,
    val date: String,
    val at: Long,
    val channel: String,
    val title: String,
    val body: String,
    val actions: Boolean,
    /** 0 = Fokus, 1 = Harter Anker, 2 = Neueste */
    val slot: Int,
    /** Höher schlägt niedriger */
    val rank: Int,
    val exact: Boolean,
    val snoozes: Int = 0,
    val revision: String = "",
    val token: String = "",
    val critical: Boolean = false,
    val ruleId: String = "",
    val deferredFrom: Long = 0,
    val quietFollowUps: Boolean = false,
)

data class SlotEntry(val slot: Int, val key: String, val date: String, val rank: Int, val expiresAt: Long, val revision: String = "", val token: String = "")
data class ReminderQuietRange(val from: Long, val to: Long)
data class ReminderPolicy(val quietStart: Int = 0, val quietEnd: Int = 0, val ranges: List<ReminderQuietRange> = emptyList(),
    val bedtimeFollowUpsEnabled: Boolean = false, val bedtimeFollowUpsDelayMinutes: Int = 0)

data class Placement(val slots: List<SlotEntry>, val slot: Int?, val replaced: SlotEntry?)
data class DueResult(val due: List<ReminderEntry>, val remaining: List<ReminderEntry>)
data class ReminderTickTargets(val exact: ReminderEntry?, val inexact: ReminderEntry?, val quiet: ReminderEntry?)

object ReminderLogic {
    const val SLOT_FOCUS = 0
    const val SLOT_HARD = 1
    const val SLOT_LATEST = 2
    const val FIRST_NOTIFICATION_ID = 1001
    const val MAX_SNOOZE = 2
    const val SNOOZE_MS = 5 * 60_000L
    const val SNOOZE_RETRY_MS = 60_000L

    /** Älter als das wird nicht mehr zugestellt: kein Stau nach Tagen ohne Strom oder im Tiefschlaf. */
    const val STALE_MS = 30 * 60_000L
    const val QUIET_BED_FRESH_MS = 2 * 3600_000L

    /** So lange bleibt eine Meldung sichtbar, danach räumt Android sie weg. */
    const val VISIBLE_MS = 90 * 60_000L
    const val MAX_CONSUMED_TOKENS = 2048

    fun notificationId(slot: Int) = FIRST_NOTIFICATION_ID + slot

    fun quietBed(entry: ReminderEntry): Boolean = entry.key == "bed" && entry.quietFollowUps
    fun freshness(entry: ReminderEntry): Long = if (quietBed(entry)) QUIET_BED_FRESH_MS else STALE_MS
    fun quietPath(entry: ReminderEntry, policy: ReminderPolicy): Boolean = entry.quietFollowUps || entry.key == "bed" && policy.bedtimeFollowUpsEnabled
    fun canStartQuietBed(entry: ReminderEntry, policy: ReminderPolicy, revisions: Map<String, String>): Boolean =
        quietBed(entry) && policy.bedtimeFollowUpsEnabled && entry.revision.isNotEmpty() && entry.token.isNotEmpty() && revisions["${entry.date}|${entry.key}"] == entry.revision

    /** protectedDisplays already includes the quiet notification when it exists. */
    fun quietDisplayFits(normalDisplays: Int, protectedDisplays: Int, alreadyShown: Boolean, alarmRinging: Boolean): Boolean =
        !alarmRinging && normalDisplays >= 0 && protectedDisplays >= 0 && normalDisplays + protectedDisplays + (if (alreadyShown) 0 else 1) <= 3

    fun retryQuietSource(entry: ReminderEntry, now: Long): ReminderEntry? {
        val original = PcReminderGate.originalAt(entry)
        if (!quietBed(entry) || now < original || now - original >= QUIET_BED_FRESH_MS) return null
        return entry.copy(at = minOf(now + SNOOZE_RETRY_MS, original + QUIET_BED_FRESH_MS + 1), deferredFrom = original)
    }

    fun completeQuietSource(queue: List<ReminderEntry>, consumed: Map<String, Long>, source: ReminderEntry, accepted: Boolean, now: Long): Pair<List<ReminderEntry>, Map<String, Long>> =
        if (accepted) queue.filterNot { it.token == source.token && it.revision == source.revision } to consumeTokens(consumed, listOf(source))
        else queue.mapNotNull { entry ->
            if (entry.token == source.token && entry.revision == source.revision) retryQuietSource(entry, now) else entry
        } to consumed

    /** The explicitly silent source never shares a WAKEUP alarm with ordinary delivery. */
    fun nextTicks(queue: List<ReminderEntry>): ReminderTickTargets = ReminderTickTargets(
        queue.filter { !it.quietFollowUps && it.exact }.minByOrNull { it.at },
        queue.filter { !it.quietFollowUps && !it.exact }.minByOrNull { it.at },
        queue.filter { it.quietFollowUps }.minByOrNull { it.at },
    )

    /** Nur feste App-Ziele: private Gedanken, Schritte und IDs werden nicht in Links weitergegeben. */
    fun tapDestination(key: String): String? = when {
        key == "guidance-wind-down" || key == "guidance-brain-dump" || key == "guidance-evening-light" -> "now"
        key == "wind-down" -> "evening"
        key.startsWith("thought-review:") && key.length > "thought-review:".length -> "thoughts"
        key.startsWith("tomorrow-step:") && key.length > "tomorrow-step:".length -> "evening"
        else -> null
    }

    /** Neue Planung aus der App. Nur weiterhin relevante verschobene Erinnerungen bleiben erhalten. */
    fun replace(old: List<ReminderEntry>, incoming: List<ReminderEntry>, relevant: Set<String>, now: Long, revisions: Map<String, String>? = null, consumed: Set<String> = emptySet()): List<ReminderEntry> {
        val current = old.filter { "${it.date}|${it.key}" in relevant && (revisions == null || revisions["${it.date}|${it.key}"] == it.revision) }
        // Ein noch unterwegs befindlicher Receiver darf seinen frischen Termin nicht durch Appöffnung verlieren.
        val due = current.filter { it.at <= now && now - PcReminderGate.originalAt(it) <= freshness(it) }
        val snoozed = current.filter { (it.snoozes > 0 || it.deferredFrom > 0) && it.at > now && now - PcReminderGate.originalAt(it) <= freshness(it) }
        // Auch ein frisch fälliger Snooze ersetzt die alten Stufen, bis sein Receiver ihn verarbeitet.
        val snoozedKeys = (snoozed + due.filter { it.snoozes > 0 }).map { it.date to it.key }.toSet()
        return (due + snoozed + incoming.filter { it.token !in consumed && it.at > now && (it.date to it.key) !in snoozedKeys }).sortedBy { it.at }
    }

    /** Teilt in Fälliges und Restliches. Veraltetes fällt weg, je Schlüssel kommt nur die neueste Stufe. */
    fun takeDue(queue: List<ReminderEntry>, now: Long): DueResult {
        val (reached, remaining) = queue.partition { it.at <= now }
        val fresh = reached.filter { now - PcReminderGate.originalAt(it) <= freshness(it) }
        val latest = fresh.groupBy { it.date to it.key }.map { (_, v) -> v.maxBy { it.at } }.sortedBy { it.at }
        return DueResult(latest, remaining)
    }

    /**
     * Wählt den Slot. Niedrigeres verdrängt nie Höheres: Ein harter Termin bleibt sichtbar, wenn eine
     * Kleinigkeit eintrifft. Klingelt der Wecker, bleibt der dritte Slot frei, damit höchstens drei Meldungen stehen.
     */
    fun place(slots: List<SlotEntry>, e: ReminderEntry, now: Long, alarmRinging: Boolean): Placement = place(slots, e, now, if (alarmRinging) 1 else 0)

    fun trimToBudget(slots: List<SlotEntry>, now: Long, protectedDisplays: Int): List<SlotEntry> =
        slots.filter { it.expiresAt > now }.sortedWith(compareByDescending<SlotEntry> { it.rank }.thenBy { it.slot }).take((3 - protectedDisplays).coerceIn(0, 3))

    fun place(slots: List<SlotEntry>, e: ReminderEntry, now: Long, protectedDisplays: Int): Placement {
        val live = trimToBudget(slots, now, protectedDisplays)
        val candidates = linkedSetOf(e.slot, SLOT_LATEST).filter { !(protectedDisplays > 0 && it == SLOT_LATEST) }
        for (c in candidates) {
            val occ = live.firstOrNull { it.slot == c }
            if (occ == null || occ.rank <= e.rank) {
                val entry = SlotEntry(c, e.key, e.date, e.rank, now + VISIBLE_MS, e.revision, e.token)
                val next = trimToBudget(live.filter { it.slot != c } + entry, now, protectedDisplays)
                if (entry in next) return Placement(next, c, occ)
            }
        }
        return Placement(live, null, null)
    }

    /** Erledigt oder „Heute nicht“: alle Stufen dieses Schlüssels fallen weg. */
    fun withoutKey(queue: List<ReminderEntry>, date: String, key: String) = queue.filter { !(it.date == date && it.key == key) }

    fun slotOf(slots: List<SlotEntry>, date: String, key: String) = slots.firstOrNull { it.date == date && it.key == key }

    /** „5 Min später“: ersetzt alle Stufen durch genau einen späteren Eintrag, höchstens zweimal. */
    fun snooze(queue: List<ReminderEntry>, source: ReminderEntry, now: Long): List<ReminderEntry>? {
        val n = source.snoozes + 1
        if (n > MAX_SNOOZE) return null
        // Der Scheduler blendet nur „5 Min später“ am Limit aus; Erledigt/Heute nicht bleiben erhalten.
        val next = source.copy(at = now + SNOOZE_MS, snoozes = n, token = java.util.UUID.randomUUID().toString(), deferredFrom = 0)
        return (withoutKey(queue, source.date, source.key) + next).sortedBy { it.at }
    }

    /** An explicit choice is kept even when focus/quiet starts before its five-minute target. */
    fun requestSnooze(queue: List<ReminderEntry>, source: ReminderEntry, now: Long, policy: ReminderPolicy, focusUntil: Long): List<ReminderEntry>? {
        val next = snooze(queue, source, now) ?: return null
        return next.map { entry ->
            if (entry.date == source.date && entry.key == source.key && !allowed(entry, entry.at, policy, focusUntil))
                retrySnooze(entry, entry.at, policy, focusUntil) ?: entry
            else entry
        }.sortedBy { it.at }
    }

    /** Retry only an explicitly requested snooze, never a backlog of ordinary hints. */
    fun retrySnooze(entry: ReminderEntry, now: Long, policy: ReminderPolicy, focusUntil: Long): ReminderEntry? {
        val original = PcReminderGate.originalAt(entry)
        if (entry.snoozes <= 0 || original > now || now - original >= STALE_MS) return null
        val expiresAt = original + STALE_MS
        var nextAt = minOf(now + SNOOZE_RETRY_MS, expiresAt + 1)
        // Jump to known quiet/focus ends instead of waking Android every minute
        // throughout a blocked period. Overlapping ranges can extend that end.
        for (ignored in 0..policy.ranges.size + 2) {
            if (nextAt > expiresAt) break
            val rangeEnd = if (entry.key.startsWith("go:") || entry.key.startsWith("prep:")) 0L
                else policy.ranges.filter { nextAt >= it.from && nextAt < it.to }.maxOfOrNull { it.to } ?: 0L
            val next = minOf(expiresAt + 1, maxOf(nextAt, rangeEnd,
                if (entry.critical) 0L else focusUntil, if (entry.critical) 0L else quietUntil(nextAt, policy)))
            if (next == nextAt) break
            nextAt = next
        }
        return entry.copy(at = nextAt, deferredFrom = original)
    }

    /** Das bestehende begrenzte Ledger verhindert spätere Wiederaufnahme bereits verbrauchter Zustellungen. */
    fun consumeTokens(consumed: Map<String, Long>, entries: List<ReminderEntry>): Map<String, Long> =
        (consumed + entries.filter { it.token.isNotEmpty() }.associate { it.token to it.at })
            .entries.sortedByDescending { it.value }.take(MAX_CONSUMED_TOKENS).associate { it.key to it.value }

    /** Nur die ersetzten Zustellungen dieses Plans verbrauchen; die neue Snooze-UUID bleibt unberührt. */
    fun consumeSnoozeTokens(consumed: Map<String, Long>, queue: List<ReminderEntry>, source: ReminderEntry): Map<String, Long> =
        consumeTokens(consumed, listOf(source) + queue.filter { it.date == source.date && it.key == source.key && it.revision == source.revision })

    /** Sichtbare Meldungen, die laut aktuellem Plan nicht mehr relevant sind (erledigt, geändert, abgelaufen). */
    fun obsolete(slots: List<SlotEntry>, relevant: Set<String>, now: Long, revisions: Map<String, String>? = null): List<SlotEntry> =
        slots.filter { it.expiresAt <= now || "${it.date}|${it.key}" !in relevant || (revisions != null && revisions["${it.date}|${it.key}"] != it.revision) }

    fun currentAction(slots: List<SlotEntry>, date: String, key: String, revision: String, token: String, now: Long): SlotEntry? =
        slots.firstOrNull { revision.isNotEmpty() && token.isNotEmpty() && it.expiresAt > now && it.date == date && it.key == key && it.revision == revision && it.token == token }

    /** Andere IDs müssen vor dem Post weichen; dieselbe ID ersetzt Android ohne vierte Meldung. */
    fun reserveBeforePost(before: List<SlotEntry>, placement: Placement): List<SlotEntry> =
        if (placement.slot == null) placement.slots else before.filter { it.slot == placement.slot || it in placement.slots }

    /** Bei nachträglichem Rechteentzug bleiben nur die noch nicht abgeräumten alten Karten. */
    fun afterPostRequest(reserved: List<SlotEntry>, placement: Placement, accepted: Boolean): List<SlotEntry> =
        if (placement.slot != null && !accepted) reserved else placement.slots

    fun canPost(notificationsEnabled: Boolean, importance: Int): Boolean = notificationsEnabled && importance > 0

    /** Quellen bleiben genau so lange erhalten wie ihre Karten, auch über Kalender- und Plantagsgrenzen. */
    fun obsoleteShownKeys(stored: Set<String>, slots: List<SlotEntry>, now: Long): Set<String> {
        val retained = slots.filter { it.expiresAt > now }.map { "shown:${it.date}|${it.key}" }.toSet()
        return stored.filter { it.startsWith("shown:") && it !in retained }.toSet()
    }

    /** Ende der aktuell geltenden globalen Ruhezeit;0 bedeutet gerade keine Ruhezeit. */
    fun quietUntil(now: Long, policy: ReminderPolicy): Long {
        val local = java.time.Instant.ofEpochMilli(now).atZone(AlarmPlanner.ZONE)
        val minute = local.hour * 60 + local.minute
        val quiet = if (policy.quietStart <= policy.quietEnd) minute >= policy.quietStart && minute < policy.quietEnd
            else minute >= policy.quietStart || minute < policy.quietEnd
        if (!quiet) return 0
        val date = if (policy.quietStart > policy.quietEnd && minute >= policy.quietStart) local.toLocalDate().plusDays(1) else local.toLocalDate()
        return AlarmPlanner.toUtc(date, policy.quietEnd)
    }

    /** Only explicitly critical anchors bypass global quiet and a currently running focus. */
    fun allowed(e: ReminderEntry, now: Long, policy: ReminderPolicy, focusUntil: Long): Boolean {
        if (!e.key.startsWith("go:") && !e.key.startsWith("prep:") && policy.ranges.any { now >= it.from && now < it.to }) return false
        if (e.critical) return true
        if (now < focusUntil) return false
        return quietUntil(now, policy) == 0L
    }
}
