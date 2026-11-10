package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class DeviceCalendarModelTest {
    @Test fun selectionBindsProviderIdToAccountAndNeverContainsTheAccountText() {
        val first = DeviceCalendarModel.selectionKey(42, "Synthetic@example.invalid")
        assertEquals(first, DeviceCalendarModel.selectionKey(42, "synthetic@EXAMPLE.invalid"))
        assertNotEquals(first, DeviceCalendarModel.selectionKey(42, "other@example.invalid"))
        assertNotEquals(first, DeviceCalendarModel.selectionKey(43, "Synthetic@example.invalid"))
        assertFalse(first.contains("example"))
        assertEquals(42L, DeviceCalendarModel.selection(first).id)
    }

    @Test fun malformedAmbiguousAndOversizedIdsAreRejected() {
        val binding = "a".repeat(64)
        for (id in listOf("0", "-1", "01", "1 OR 1=1", "9223372036854775808", "1.0")) {
            assertThrows(IllegalArgumentException::class.java) { DeviceCalendarModel.selection("$id:$binding") }
        }
        for (key in listOf("1", "1:" + "A".repeat(64), "1:" + "a".repeat(65), "1:$binding\n")) {
            assertThrows(IllegalArgumentException::class.java) { DeviceCalendarModel.selection(key) }
        }
    }

    @Test fun selectionSetIsSmallNonemptyAndCannotAliasTheSameCalendar() {
        val key = DeviceCalendarModel.selectionKey(1, "synthetic@example.invalid")
        assertEquals(1, DeviceCalendarModel.selections(listOf(key)).size)
        for (keys in listOf(emptyList(), listOf(key, key), List(21) { DeviceCalendarModel.selectionKey(it + 1L, "synthetic@example.invalid") },
            listOf(key, DeviceCalendarModel.selectionKey(1, "other@example.invalid")))) {
            assertThrows(IllegalArgumentException::class.java) { DeviceCalendarModel.selections(keys) }
        }
    }

    @Test fun readWindowCannotScanAnUnlimitedCalendarHistory() {
        DeviceCalendarModel.window(0, DeviceCalendarModel.MAX_WINDOW_MS)
        for ((from, to) in listOf(-1L to 100L, 100L to 100L, 100L to 99L, 0L to DeviceCalendarModel.MAX_WINDOW_MS + 1, 0L to Long.MAX_VALUE)) {
            assertThrows(IllegalArgumentException::class.java) { DeviceCalendarModel.window(from, to) }
        }
    }

    @Test fun recurringInstancesHaveDifferentIdsAndNoPrivateTitles() {
        assertNotEquals(DeviceCalendarModel.eventId(1, 2, 1000), DeviceCalendarModel.eventId(1, 2, 2000))
        assertNotEquals(DeviceCalendarModel.eventId(1, 2, 1000), DeviceCalendarModel.eventId(2, 2, 1000))
        assertThrows(IllegalArgumentException::class.java) { DeviceCalendarModel.eventId(0, 2, 1000) }
    }

    @Test fun allDayDatesStayDatesAtBothBerlinDstBoundaries() {
        for (date in listOf("2026-03-29", "2026-10-25", "2026-12-31")) {
            assertEquals(date, DeviceCalendarModel.allDayDate(Instant.parse(date + "T00:00:00Z").toEpochMilli()))
        }
    }
}
