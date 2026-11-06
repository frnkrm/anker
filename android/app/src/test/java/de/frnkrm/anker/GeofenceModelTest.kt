package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class GeofenceModelTest {
    private val now = 10_000_000L
    private val visit = GeofenceVisitDefinition("local-visit", "current-revision", 52.0, 13.0, 150f, 120_000, now - 60_000, now + 3_600_000)
    private val fix = GeofenceTriggerFix(52.0, 13.0, 25f, now)
    private fun event(definitions: List<GeofenceVisitDefinition> = listOf(visit), ids: Set<String> = setOf(visit.requestId), at: Long = now, dwell: Boolean = true, position: GeofenceTriggerFix? = fix) =
        GeofenceModel.dwell(true, definitions, emptyList(), emptySet(), ids, at, dwell, position)

    @Test fun onlyDwellCreatesProposalNotArrival() {
        assertTrue(event(dwell = false).isEmpty())
        assertEquals(1, event().size)
        assertEquals("local-visit", event().single().visitId)
        assertTrue(GeofenceModel.dwell(false, listOf(visit), emptyList(), emptySet(), setOf(visit.requestId), now, true, fix).isEmpty())
    }

    @Test fun staleRevisionAndVisitWindowAreRejected() {
        assertTrue(event(definitions = listOf(visit.copy(revision = "newer"))).isEmpty())
        assertTrue(event(at = visit.expiresAt).isEmpty())
        assertTrue(event(at = visit.startsAt - 1, position = null).isEmpty())
        assertTrue(event(ids = setOf("unrelated")).isEmpty())
    }

    @Test fun inaccurateDriveByAndOldTriggerLocationAreNotAccepted() {
        assertTrue(event(position = fix.copy(latitude = 53.0)).isEmpty())
        assertTrue(event(position = fix.copy(accuracyM = 500f)).isEmpty())
        assertTrue(event(position = fix.copy(at = now - 11 * 60_000)).isEmpty())
        assertTrue(event(position = fix.copy(latitude = Double.NaN)).isEmpty())
        assertEquals(1, event(position = null).size) // weiterhin nur manuell zu bestätigender Vorschlag
    }

    @Test fun duplicateAndAlreadyAnsweredCallbacksRemainSingle() {
        val first = event().single()
        assertEquals(listOf(first), GeofenceModel.dwell(true, listOf(visit), listOf(first), emptySet(), setOf(visit.requestId), now + 1000, true, fix))
        assertTrue(GeofenceModel.dwell(true, listOf(visit), emptyList(), setOf(first.id), setOf(visit.requestId), now + 1000, true, fix).isEmpty())
    }

    @Test fun boundedDefinitionsRejectInvalidOrExpiredCoordinatesAndDurations() {
        for (bad in listOf(visit.copy(latitude = 91.0), visit.copy(radiusM = 1f), visit.copy(dwellMs = 0), visit.copy(expiresAt = now), visit.copy(startsAt = -1))) {
            assertTrue(GeofenceModel.active(listOf(bad), now).isEmpty())
        }
        assertEquals(20, GeofenceModel.active((1..25).map { visit.copy(id = "v$it") }, now).size)
    }

    @Test fun callbackIdentifiersContainNoReadableVisitTitleAndAreBounded() {
        val sensitive = visit.copy(id = "Eine vertrauliche Kundensache".repeat(4))
        assertFalse(sensitive.requestId.contains("Kunden"))
        assertTrue(sensitive.requestId.length < 100)
        assertNotEquals(visit.requestId, visit.copy(revision = "new").requestId)
    }

    @Test fun pruningRemovesAnsweredOldAndExpiredPendingEvents() {
        val pending = event().single()
        assertTrue(GeofenceModel.pending(listOf(pending), emptyList(), now).isEmpty())
        assertTrue(GeofenceModel.pending(listOf(pending), listOf(visit), visit.expiresAt).isEmpty())
        assertTrue(GeofenceModel.pending(listOf(pending.copy(revision = "old")), listOf(visit), now).isEmpty())
    }
}
