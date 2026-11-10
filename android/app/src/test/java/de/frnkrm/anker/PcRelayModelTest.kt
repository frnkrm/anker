package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class PcRelayModelTest {
    private val now = PcLinkModel.timestamp("2026-11-12T21:00:00Z")

    @Test fun onlyAnExplicitHostedSupabaseProjectCanChooseTheFixedEndpoint() {
        assertEquals("https://${"a".repeat(20)}.supabase.co/functions/v1/pc-link", PcRelayModel.endpoint("a".repeat(20)))
        for (value in listOf("", "a".repeat(19), "a".repeat(21), "https://attacker.invalid", "a@supabase.co", "A".repeat(20), "a".repeat(19) + "/")) {
            assertThrows(IllegalArgumentException::class.java) { PcRelayModel.endpoint(value) }
        }
    }

    @Test fun capabilitiesAreFiniteWithAStrictFutureDeadline() {
        assertTrue(PcRelayModel.validExpiry(now + PcRelayModel.MAX_CAPABILITY_MS, now))
        assertFalse(PcRelayModel.validExpiry(now, now))
        assertFalse(PcRelayModel.validExpiry(now - 1, now))
        assertFalse(PcRelayModel.validExpiry(now + PcRelayModel.MAX_CAPABILITY_MS + 5001, now))
        assertFalse(PcRelayModel.validExpiry(Long.MAX_VALUE, Long.MAX_VALUE - 1))
    }

    @Test fun secretsAndPairNamesAreStrictRatherThanCoercedFromOtherValues() {
        assertTrue(PcRelayModel.validToken("a".repeat(64)))
        assertTrue(PcRelayModel.validPair("synthetic-pair"))
        for (value in listOf(null, true, 1, "a".repeat(63), "A".repeat(64), "a".repeat(63) + "\n")) assertFalse(PcRelayModel.validToken(value))
        for (value in listOf(null, true, "", "other/pair", "<private>")) assertFalse(PcRelayModel.validPair(value))
    }

    @Test fun staleOrImplausiblyFutureOuterFramesCannotBePublicReceiptProof() {
        assertTrue(PcRelayModel.sourceFresh(now, now))
        assertTrue(PcRelayModel.sourceFresh(now - PcRelayModel.MAX_CAPABILITY_MS, now))
        assertFalse(PcRelayModel.sourceFresh(now - PcRelayModel.MAX_CAPABILITY_MS - 1, now))
        assertFalse(PcRelayModel.sourceFresh(now + 120001, now))
    }

    @Test fun missingConsentAndExpiredAuthorizationHaveHonestStatusWhileLanHasPriority() {
        assertEquals("off", PcRelayModel.publicStatus(false, now + 1, now, false, "received"))
        assertEquals("expired", PcRelayModel.publicStatus(true, now, now, false, "received"))
        assertEquals("lan", PcRelayModel.publicStatus(true, now + 1000, now, true, "received"))
        assertEquals("received", PcRelayModel.publicStatus(true, now + 1000, now, false, "received"))
        assertEquals("waiting", PcRelayModel.publicStatus(true, now + 1000, now, false, "private-server-body"))
    }

    @Test fun onlyARecentAuthenticatedIncomingFrameCanEstablishLiveRelayContact() {
        assertTrue(PcRelayModel.liveContact(true, now + 1000, now, now - 90_000))
        assertFalse(PcRelayModel.liveContact(true, now + 1000, now, 0))
        assertFalse(PcRelayModel.liveContact(true, now + 1000, now, now - 90_001))
        assertFalse(PcRelayModel.liveContact(true, now + 1000, now, now + 1))
        assertFalse(PcRelayModel.liveContact(false, now + 1000, now, now))
        assertFalse(PcRelayModel.liveContact(true, now, now, now))
    }

    @Test fun deliveryOfOldMailboxContentNeverProvesThePcIsOnlineNow() {
        assertTrue(PcRelayModel.freshPeerFrame(now - 90_000, now))
        assertFalse(PcRelayModel.freshPeerFrame(now - 90_001, now))
        assertFalse(PcRelayModel.freshPeerFrame(now - 7 * 86_400_000L, now))
        assertFalse(PcRelayModel.freshPeerFrame(now + 90_001, now))
    }

    @Test fun renewalCanPruneExpiredCiphertextWithoutResettingReservedSequenceOrder() {
        val queue = listOf(41L to now - PcRelayModel.MAX_CAPABILITY_MS - 1,
            42L to now - PcRelayModel.MAX_CAPABILITY_MS, 43L to now - 1000)
        val retained = queue.filterNot { PcRelayModel.expiredCiphertext(it.second, now) }
        assertEquals(listOf(43L), retained.map { it.first })
        assertFalse(PcRelayModel.expiredCiphertext(now + 1, now))
        assertFalse(PcRelayModel.expiredCiphertext(now - PcRelayModel.MAX_CAPABILITY_MS + 1, now))
    }
}
