package de.frnkrm.anker
import org.junit.Assert.*
import org.junit.Test

class SleepPromptEvidenceTest {
    @Test fun nurLueckenlosSichtbareMinuteLiefertEinmalUnsichereZeit() {
        val p = SleepPromptEvidence()
        for (i in 0L until 60) assertNull(p.observe("night", i * 1000, 100_000 + i * 1000, true))
        assertEquals(160_000L, p.observe("night", 60_000, 160_000, true))
        assertNull(p.observe("night", 61_000, 161_000, true))
    }
    @Test fun displayAusVerdecktOderUnbeobachteteLueckeIstKeinSchlafnachweis() {
        val p = SleepPromptEvidence()
        p.observe("night", 0, 100_000, true)
        assertNull(p.observe("night", 60_000, 160_000, true))
        p.observe("night", 61_000, 161_000, false)
        assertNull(p.observe("night", 62_000, 162_000, true))
        assertNull(p.observe("other", 63_000, 163_000, true))
    }
}
