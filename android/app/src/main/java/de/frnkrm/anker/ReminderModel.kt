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
)

data class SlotEntry(val slot: Int, val key: String, val date: String, val rank: Int, val expiresAt: Long)

data class Placement(val slots: List<SlotEntry>, val slot: Int?, val replaced: SlotEntry?)
data class DueResult(val due: List<ReminderEntry>, val remaining: List<ReminderEntry>)

object ReminderLogic {
    const val SLOT_FOCUS = 0
    const val SLOT_HARD = 1
    const val SLOT_LATEST = 2
    const val FIRST_NOTIFICATION_ID = 1001
    const val MAX_SNOOZE = 2
    const val SNOOZE_MS = 5 * 60_000L

    /** Älter als das wird nicht mehr zugestellt: kein Stau nach Tagen ohne Strom oder im Tiefschlaf. */
    const val STALE_MS = 30 * 60_000L

    /** So lange bleibt eine Meldung sichtbar, danach räumt Android sie weg. */
    const val VISIBLE_MS = 90 * 60_000L

    fun notificationId(slot: Int) = FIRST_NOTIFICATION_ID + slot

    /** Neue Planung aus der App. Verschobene Erinnerungen bleiben erhalten. */
    fun replace(old: List<ReminderEntry>, incoming: List<ReminderEntry>, now: Long): List<ReminderEntry> {
        val snoozed = old.filter { it.snoozes > 0 && it.at > now }
        val snoozedKeys = snoozed.map { it.date to it.key }.toSet()
        return (snoozed + incoming.filter { it.at > now && (it.date to it.key) !in snoozedKeys }).sortedBy { it.at }
    }

    /** Teilt in Fälliges und Restliches. Veraltetes fällt weg, je Schlüssel kommt nur die neueste Stufe. */
    fun takeDue(queue: List<ReminderEntry>, now: Long): DueResult {
        val (reached, remaining) = queue.partition { it.at <= now }
        val fresh = reached.filter { now - it.at <= STALE_MS }
        val latest = fresh.groupBy { it.date to it.key }.map { (_, v) -> v.maxBy { it.at } }.sortedBy { it.at }
        return DueResult(latest, remaining)
    }

    /**
     * Wählt den Slot. Niedrigeres verdrängt nie Höheres: Ein harter Termin bleibt sichtbar, wenn eine
     * Kleinigkeit eintrifft. Klingelt der Wecker, bleibt der dritte Slot frei, damit höchstens drei Meldungen stehen.
     */
    fun place(slots: List<SlotEntry>, e: ReminderEntry, now: Long, alarmRinging: Boolean): Placement {
        val live = slots.filter { it.expiresAt > now }
        val candidates = linkedSetOf(e.slot, SLOT_LATEST).filter { !(alarmRinging && it == SLOT_LATEST) }
        for (c in candidates) {
            val occ = live.firstOrNull { it.slot == c }
            if (occ == null || occ.rank <= e.rank) {
                val entry = SlotEntry(c, e.key, e.date, e.rank, now + VISIBLE_MS)
                return Placement(live.filter { it.slot != c } + entry, c, occ)
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
        val next = source.copy(at = now + SNOOZE_MS, snoozes = n, actions = n < MAX_SNOOZE)
        return (withoutKey(queue, source.date, source.key) + next).sortedBy { it.at }
    }

    /** Sichtbare Meldungen, die laut aktuellem Plan nicht mehr relevant sind (erledigt, geändert, abgelaufen). */
    fun obsolete(slots: List<SlotEntry>, relevant: Set<String>, now: Long): List<SlotEntry> =
        slots.filter { it.expiresAt <= now || "${it.date}|${it.key}" !in relevant }
}
