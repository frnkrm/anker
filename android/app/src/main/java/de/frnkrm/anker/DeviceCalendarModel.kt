package de.frnkrm.anker

import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneOffset
import java.util.Locale

/** Calendar identities bind a local provider id to its Google account, never to a guessed primary account. */
object DeviceCalendarModel {
    const val MAX_CALENDARS = 20
    const val MAX_EVENTS = 2_000
    const val MAX_WINDOW_MS = 7 * 24 * 60 * 60_000L
    const val MAX_EPOCH_MS = 253_402_300_799_999L
    data class Selection(val id: Long, val binding: String)

    fun selectionKey(id: Long, account: String): String {
        require(id > 0 && account.isNotBlank()) { "DEVICE_CALENDAR_SELECTION_INVALID" }
        val bytes = MessageDigest.getInstance("SHA-256").digest("com.google\u0000${account.trim().lowercase(Locale.ROOT)}\u0000$id".toByteArray(Charsets.UTF_8))
        return "$id:" + bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
    }

    fun selection(value: String): Selection {
        require(value.matches(Regex("[1-9][0-9]{0,18}:[a-f0-9]{64}"))) { "DEVICE_CALENDAR_SELECTION_INVALID" }
        val id = value.substringBefore(':').toLongOrNull()
        require(id != null && id > 0) { "DEVICE_CALENDAR_SELECTION_INVALID" }
        return Selection(id, value.substringAfter(':'))
    }

    fun selections(values: List<String>): List<Selection> {
        require(values.isNotEmpty() && values.size <= MAX_CALENDARS && values.toSet().size == values.size) { "DEVICE_CALENDAR_SELECTION_INVALID" }
        return values.map(::selection).also { require(it.map { value -> value.id }.toSet().size == it.size) { "DEVICE_CALENDAR_SELECTION_INVALID" } }
    }

    fun window(from: Long, to: Long) {
        require(from >= 0 && to > from && to <= MAX_EPOCH_MS && to - from <= MAX_WINDOW_MS) { "DEVICE_CALENDAR_WINDOW_INVALID" }
        try { Instant.ofEpochMilli(from); Instant.ofEpochMilli(to) } catch (_: Exception) { throw IllegalArgumentException("DEVICE_CALENDAR_WINDOW_INVALID") }
    }

    fun eventId(calendarId: Long, eventId: Long, begin: Long): String {
        require(calendarId > 0 && eventId > 0 && begin >= 0) { "DEVICE_CALENDAR_EVENT_INVALID" }
        return "device-google:$calendarId:$eventId:$begin"
    }

    /** Android all-day provider times represent UTC dates, not a local clock time. */
    fun allDayDate(at: Long): String = Instant.ofEpochMilli(at).atOffset(ZoneOffset.UTC).toLocalDate().toString()
}
