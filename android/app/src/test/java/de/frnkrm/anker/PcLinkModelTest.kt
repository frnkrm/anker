package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test
import java.net.InetAddress

class PcLinkModelTest {
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
}
