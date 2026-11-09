package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class NativePreferenceFilesTest {
    @Test fun journalWritesAndReadsNeverResolveTheCriticalAlarmFile() {
        val files = mutableMapOf<String, MutableMap<String, String>>()
        val opened = mutableListOf<String>()
        val resolve: (String) -> MutableMap<String, String> = { name ->
            opened.add(name)
            files.getOrPut(name) { mutableMapOf() }
        }
        val alarm = NativePreferenceFiles.alarm(resolve)
        alarm["alarmState"] = "current-main-and-snooze-state"
        alarm["alarmConfig"] = "existing-config"
        val original = alarm.toMap()
        opened.clear()
        val journal = NativePreferenceFiles.journal(resolve)
        journal["diagnosticJournal"] = "bounded-journal-body".repeat(800)
        assertNotSame(alarm, journal)
        assertEquals(original, alarm)
        assertEquals(1, opened.distinct().size)
        assertNotEquals(opened.single(), files.entries.single { it.value === alarm }.key)
        assertEquals(journal["diagnosticJournal"], NativePreferenceFiles.journal(resolve)["diagnosticJournal"])
        assertEquals(original, NativePreferenceFiles.alarm(resolve))
        assertFalse(alarm.containsKey("diagnosticJournal"))
    }

    @Test fun clearingOrReplacingJournalDoesNotMigrateOrClearExistingAlarmData() {
        val files = mutableMapOf<String, MutableMap<String, String>>()
        val resolve: (String) -> MutableMap<String, String> = { name -> files.getOrPut(name) { mutableMapOf() } }
        val alarm = NativePreferenceFiles.alarm(resolve)
        alarm.putAll(mapOf("alarmState" to "saved-main", "alarmConfig" to "saved-config", "diagnosticJournal" to "unreleased-legacy-key"))
        val original = alarm.toMap()
        val journal = NativePreferenceFiles.journal(resolve)
        assertNull(journal["diagnosticJournal"]) // No read or migration from the alarm namespace.
        journal["diagnosticJournal"] = "new-log"
        journal.clear()
        assertEquals(original, alarm)
        alarm["alarmState"] = "next-main"
        assertTrue(journal.isEmpty())
        assertEquals("saved-config", alarm["alarmConfig"])
    }
}
