package de.frnkrm.anker
import org.junit.Assert.*
import org.junit.Test

class SmartWakeEvidenceTest {
    @Test fun nullEingangIstNichtStille() {
        val e = SmartWakeEvidence()
        e.observe(10_000, 0.0, 0.0, 0, 0)
        assertEquals(1L, e.missingIntervals); assertEquals(0L, e.validIntervals)
        assertEquals(0L, e.quietSinceAt); assertEquals(0L, e.firstInputAt)
    }
    @Test fun valideStilleAktivitaetLueckeUndZaehlerBleibenGetrennt() {
        val e = SmartWakeEvidence()
        e.observe(10_000, 0.0, 0.0, 10, 20)
        e.observe(20_000, 0.0, 0.0, 10, 20)
        assertEquals(10_000L, e.quietSinceAt)
        e.observe(30_000, 1.0, 0.1, 10, 20)
        assertEquals(0L, e.quietSinceAt)
        e.observe(40_000, 0.0, 0.0, 10, 20)
        e.observe(80_000, 0.0, 0.0, 10, 20)
        assertEquals(80_000L, e.quietSinceAt)
        e.observe(90_000, 0.0, 0.0, 0, 20)
        assertEquals(0L, e.quietSinceAt)
        assertEquals(50L, e.audioBlocks); assertEquals(120L, e.motionEvents)
        assertEquals(10_000L, e.firstInputAt); assertEquals(90_000L, e.lastInputAt)
    }
    @Test fun rueckwaertsDoppeltOderUngueltigErzeugtKeineNachweise() {
        val e = SmartWakeEvidence()
        e.observe(10_000, 0.0, 0.0, 1, 1)
        e.observe(10_000, 0.0, 0.0, 1, 1)
        e.observe(9_000, 0.0, 0.0, 1, 1)
        e.observe(20_000, Double.NaN, 0.0, 1, 1)
        assertEquals(1L, e.intervals)
    }
}
