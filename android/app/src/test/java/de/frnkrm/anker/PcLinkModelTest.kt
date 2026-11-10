package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test
import java.net.InetAddress

class PcLinkModelTest {
    private val nightNow = PcLinkModel.timestamp("2026-11-12T22:30:00Z")
    private fun automaticNight() = PcLinkModel.EmergencyState(
        revision = "pc3:night", date = "2026-11-12", generatedAt = nightNow - 1_000,
        validUntil = nightNow + 12 * 60 * 60_000L, morningDeadlineAt = nightNow + 10 * 60 * 60_000L,
        targetAt = nightNow - 30 * 60_000L, lockEnforced = false,
        strictEnabled = true, enforcementEnabled = true,
    )
    private fun confirmedNight() = PcLinkModel.EmergencyAcknowledgement(
        revision = "pc3:night", date = "2026-11-12", mode = "locked", receivedAt = nightNow - 10,
        localReceivedAt = nightNow - 5, stopAt = nightNow - 30 * 60_000L,
    )

    @Test fun companionMinimumUsesStableSemanticVersionComponentsWithoutProtocolBump() {
        for (version in listOf("0.1.1", "0.1.2", "0.1.10", "0.2.0", "1.0.0", "10.0.0", "0.1.1+build.42", "0.1.1+build-42.01")) {
            assertTrue(version, PcLinkModel.compatibleCompanion(3, version))
            assertTrue(version, PcLinkModel.compatibleCompanion(3L, version))
        }
        for (version in listOf("0.0.999", "0.1.0", "0.0.0", "0.1.1-rc.1", "0.2.0-alpha", "1.0.0-dev+build.1")) {
            assertFalse(version, PcLinkModel.compatibleCompanion(3, version))
        }
    }

    @Test fun companionHelloCannotInventMissingMalformedOrCoercedVersionSupport() {
        for (version in listOf(null, true, 1, "", "0.1", "v0.1.1", "0.01.1", "00.1.1", "0.1.01", "0.1.1.0",
            "0.1.1+", "0.1.1+bad..build", "0.1.1+bad_build", " 0.1.1", "0.1.1\n", "9".repeat(129), "9223372036854775808.1.1")) {
            assertFalse(version.toString(), PcLinkModel.compatibleCompanion(3, version))
        }
        for (protocol in listOf(null, true, "3", 3.0, 3.1, 2, 4)) {
            assertFalse(protocol.toString(), PcLinkModel.compatibleCompanion(protocol, "0.1.1"))
        }
    }

    @Test fun companionPreferenceExtensionsRemainOptionalAndHaveExactNativeTypesAndBounds() {
        assertTrue(PcLinkModel.validCompanionPreferenceExtensions(emptyMap()))
        for (enabled in listOf(false, true)) {
            for (minutes in listOf(0, 1, 30, 0L, 30L)) {
                assertTrue(PcLinkModel.validCompanionPreferenceExtensions(mapOf("singleTransition" to enabled, "bedAfterStopMin" to minutes)))
            }
            assertTrue(PcLinkModel.validCompanionPreferenceExtensions(mapOf("singleTransition" to enabled)))
        }
        assertTrue(PcLinkModel.validCompanionPreferenceExtensions(mapOf("bedAfterStopMin" to 15)))
        for (invalid in listOf(null, 0, 1, "true", Any())) {
            assertFalse(PcLinkModel.validCompanionPreferenceExtensions(mapOf("singleTransition" to invalid)))
        }
        for (invalid in listOf(null, true, "15", 0.0, 1.5, -1, 31, Long.MAX_VALUE)) {
            assertFalse(PcLinkModel.validCompanionPreferenceExtensions(mapOf("bedAfterStopMin" to invalid)))
        }
        assertFalse(PcLinkModel.validCompanionPreferenceExtensions(mapOf("followGentleEvening" to true)))
        assertFalse(PcLinkModel.validCompanionPreferenceExtensions(mapOf("singleTransition" to true, "unknown" to false)))
    }

    @Test fun privateLanAndLoopbackAreAllowedButInternetAndUnspecifiedAreNot() {
        for (host in listOf("10.2.3.4", "172.16.2.3", "192.168.10.2", "169.254.1.1", "127.0.0.1", "::1", "fd12::1", "fe80::1")) {
            assertTrue(host, PcLinkModel.privateAddress(InetAddress.getByName(host)))
        }
        for (host in listOf("8.8.8.8", "172.32.0.1", "0.0.0.0", "224.0.0.1", "2001:4860:4860::8888", "::")) {
            assertFalse(host, PcLinkModel.privateAddress(InetAddress.getByName(host)))
        }
    }

    @Test fun endpointRejectsUrlInjectionPublicHostsAndAmbiguousIpv4() {
        for (raw in listOf("https://192.168.0.1:47830", "user@192.168.0.1:47830", "192.168.0.1:80/path", "example.org:47830", "8.8.8.8:443", "127.1:80", "010.0.0.1:80", "192.168.0.1:0", "192.168.0.1:65536")) {
            assertThrows(raw, IllegalArgumentException::class.java) { PcLinkModel.endpoint(raw) }
        }
        assertEquals("https://192.168.1.2:47830/v3/hello", PcLinkModel.endpoint("192.168.1.2:47830").https("/v3/hello"))
        assertEquals("[fd00::1]:47830", PcLinkModel.endpoint("[fd00::1]:47830").authority())
        assertEquals("mein-pc.local", PcLinkModel.endpoint("mein-pc.local:47830").host)
    }

    @Test fun pinMustMatchTheExactLeafCertificate() {
        val certificate = "test certificate DER bytes".toByteArray()
        val pin = PcLinkModel.hex(PcBridgeCrypto.sha256(certificate))
        assertTrue(PcLinkModel.matchesPin(pin, certificate))
        assertFalse(PcLinkModel.matchesPin(pin, certificate + byteArrayOf(0)))
        assertFalse(PcLinkModel.matchesPin("", certificate))
        assertEquals(pin, PcLinkModel.normalisePin(pin.uppercase().chunked(2).joinToString(":")))
    }

    @Test fun replayAndNonSafeSequencesAreRejectedWithoutRequiringContiguousDelivery() {
        assertTrue(PcLinkModel.acceptSequence(0, 1))
        assertTrue(PcLinkModel.acceptSequence(42, 50))
        assertFalse(PcLinkModel.acceptSequence(42, 42))
        assertFalse(PcLinkModel.acceptSequence(42, 41))
        assertFalse(PcLinkModel.acceptSequence(0, 0))
        assertFalse(PcLinkModel.acceptSequence(0, PcLinkModel.MAX_SAFE_SEQUENCE + 1))
    }

    @Test fun wireCountersNeverTruncateFractionsOrCoerceStringsAndBooleans() {
        assertEquals(1L, PcLinkModel.wireInteger(1))
        assertEquals(PcLinkModel.MAX_SAFE_SEQUENCE, PcLinkModel.wireInteger(PcLinkModel.MAX_SAFE_SEQUENCE))
        for (invalid in listOf(1.0, 1.5, Double.NaN, "1", true, null)) assertNull(PcLinkModel.wireInteger(invalid))
    }

    @Test fun reconnectBackoffIsFiniteAndNeverImmediate() {
        assertEquals(1_000, PcLinkModel.retryDelayMs(-1))
        assertEquals(2_000, PcLinkModel.retryDelayMs(1))
        assertEquals(60_000, PcLinkModel.retryDelayMs(Int.MAX_VALUE))
    }

    @Test fun base64urlHasOneCanonicalRepresentation() {
        val bytes = byteArrayOf(0, 1, 2, -1)
        assertArrayEquals(bytes, PcLinkModel.decoded(PcLinkModel.encoded(bytes), 4))
        for (invalid in listOf("AA==", "+/", "A", "AB", "", "AA\n")) {
            assertThrows(invalid, IllegalArgumentException::class.java) { PcLinkModel.decoded(invalid) }
        }
    }

    @Test fun pairingExpiresAndFutureQrCannotCreateAnUnlimitedCapability() {
        val now = 1_000_000L
        assertTrue(PcLinkModel.validPairExpiry(now + 600_000, now))
        assertFalse(PcLinkModel.validPairExpiry(now, now))
        assertFalse(PcLinkModel.validPairExpiry(now + 600_001, now))
        assertTrue(PcLinkModel.validLease(now, now + PcLinkModel.MAX_LEASE_MS))
        assertFalse(PcLinkModel.validLease(now, now + PcLinkModel.MAX_LEASE_MS + 1))
    }

    @Test fun timestampsRequireAnExplicitZone() {
        assertEquals(PcLinkModel.timestamp("2026-11-12T21:00:00.000Z"), PcLinkModel.timestamp("2026-11-12T22:00:00+01:00"))
        assertThrows(IllegalArgumentException::class.java) { PcLinkModel.timestamp("2026-11-12T21:00:00") }
        assertThrows(IllegalArgumentException::class.java) { PcLinkModel.timestamp("not-a-time") }
    }

    @Test fun hardwareExtensionCannotOutliveItsNightOrMorningSafetyDeadline() {
        val now = 1_000_000L
        assertEquals(now + 120 * 60_000, PcLinkModel.emergencyUntil(now, 120, now + PcLinkModel.MAX_LEASE_MS))
        assertEquals(now + 30_000, PcLinkModel.emergencyUntil(now, 120, now + 30_000))
        assertEquals(now + 20_000, PcLinkModel.emergencyUntil(now, 120, now + 30_000, now + 20_000))
        assertThrows(IllegalStateException::class.java) { PcLinkModel.emergencyUntil(now, 5, now - 1) }
        assertThrows(IllegalStateException::class.java) { PcLinkModel.emergencyUntil(now, 5, now + 60_000, now) }
        assertThrows(IllegalArgumentException::class.java) { PcLinkModel.emergencyUntil(now, 121, now + PcLinkModel.MAX_LEASE_MS) }
        assertThrows(IllegalArgumentException::class.java) { PcLinkModel.emergencyUntil(Long.MAX_VALUE, 120, Long.MAX_VALUE) }
    }

    @Test fun automaticPcNightCanUseFreshAuthenticatedConfirmationWithoutPhoneBedFact() {
        val state = automaticNight()
        assertFalse(state.lockEnforced)
        assertTrue(PcLinkModel.emergencyNightConfirmed(state, confirmedNight(), nightNow))
        assertTrue(PcLinkModel.emergencyNightConfirmed(state, confirmedNight().copy(mode = "scheduled"), nightNow))
        assertFalse(PcLinkModel.emergencyNightConfirmed(state, null, nightNow))
    }

    @Test fun aNightConfirmationCannotBelongToAnotherDayRevisionOrInactiveMode() {
        val state = automaticNight(); val ack = confirmedNight()
        for (unrelated in listOf(ack.copy(revision = "pc3:other"), ack.copy(date = "2026-11-11"), ack.copy(mode = "paused"), ack.copy(mode = "released"))) {
            assertFalse(PcLinkModel.emergencyNightConfirmed(state, unrelated, nightNow))
        }
        for (warning in listOf("clock-skew", "local-enforcement-off", "legacy-conflict", "source-expired", "link-stale", "pairing-required", "morning-deadline-reached", "unknown-future-warning")) {
            assertFalse(warning, PcLinkModel.emergencyNightConfirmed(state, ack.copy(warnings = setOf(warning)), nightNow))
        }
    }

    @Test fun remoteClockToleranceNeverReplacesFreshNonfutureLocalContact() {
        val state = automaticNight(); val ack = confirmedNight()
        assertTrue(PcLinkModel.emergencyNightConfirmed(state, ack.copy(receivedAt = nightNow + 120_000), nightNow))
        assertTrue(PcLinkModel.emergencyNightConfirmed(state, ack.copy(receivedAt = nightNow - 120_000), nightNow))
        for (invalid in listOf(ack.copy(receivedAt = nightNow + 120_001), ack.copy(receivedAt = nightNow - 120_001), ack.copy(localReceivedAt = nightNow + 1), ack.copy(localReceivedAt = nightNow - 120_001))) {
            assertFalse(PcLinkModel.emergencyNightConfirmed(state, invalid, nightNow))
        }
    }

    @Test fun automaticNightNeedsAnAlreadyDueAcknowledgedTarget() {
        val state = automaticNight(); val ack = confirmedNight()
        assertFalse(PcLinkModel.emergencyNightConfirmed(state, ack.copy(stopAt = nightNow + 1), nightNow))
        assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(targetAt = null), ack.copy(stopAt = null), nightNow))
        assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(targetAt = nightNow + 1), ack.copy(stopAt = null), nightNow))
        assertTrue(PcLinkModel.emergencyNightConfirmed(state, ack.copy(stopAt = null), nightNow))
    }

    @Test fun morningProjectionCanStillExtendTheAuthenticatedOriginalNightTarget() {
        val state = automaticNight().copy(date = "2026-11-13", targetAt = nightNow + 20 * 60 * 60_000L)
        val ack = confirmedNight().copy(date = "2026-11-13")
        assertTrue(PcLinkModel.emergencyNightConfirmed(state, ack, nightNow))
        assertFalse(PcLinkModel.emergencyNightConfirmed(state, ack.copy(stopAt = null), nightNow))
        assertFalse(PcLinkModel.emergencyNightConfirmed(state, ack.copy(date = "2026-11-12"), nightNow))
    }

    @Test fun consentAndFiniteLeaseRemainRequiredEvenWithAnExplicitPhoneNight() {
        for (phoneFact in listOf(false, true)) {
            val state = automaticNight().copy(lockEnforced = phoneFact)
            val ack = confirmedNight()
            assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(strictEnabled = false), ack, nightNow))
            assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(enforcementEnabled = false), ack, nightNow))
            assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(validUntil = nightNow), ack, nightNow))
            assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(morningDeadlineAt = nightNow), ack, nightNow))
            assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(generatedAt = nightNow + 120_001), ack, nightNow))
            assertFalse(PcLinkModel.emergencyNightConfirmed(state.copy(validUntil = state.generatedAt + PcLinkModel.MAX_LEASE_MS + 1), ack, nightNow))
        }
        assertTrue(PcLinkModel.emergencyNightConfirmed(automaticNight().copy(lockEnforced = true), null, nightNow))
    }
}
