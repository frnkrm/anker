package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPrivateKeySpec

/** Same public test vector as src/core/pcLink/fixtures/v3-crypto.json; never runtime credentials. */
class PcBridgeCryptoTest {
    private val phonePublic = "BGsX0fLhLEJH-Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU"
    private val pcPublic = "BHzyexiNA09-ilI4AwS1GsPAiWnid_IbNaYLSPxHZpl4B3dVENuO0EApPZrGn3Qw27p9reY86YIpngS3nSJ4c9E"
    private val expectedPhoneKey = "1bea62591faac1e08d09840f33e075d47ca2a06d84366641806654fca7139d0b"
    private val expectedPcKey = "5b1564726346a19c3cde983fcf7276426359cd988f07061c9a6c9af0a2c5909d"
    private val header = PcBridgeCrypto.Header("fixture-pair", "phone", 1, "2026-11-12T21:00:00.000Z")

    private fun scalar(value: Int): java.security.PrivateKey {
        val parameters = AlgorithmParameters.getInstance("EC").apply { init(ECGenParameterSpec("secp256r1")) }.getParameterSpec(ECParameterSpec::class.java)
        return KeyFactory.getInstance("EC").generatePrivate(ECPrivateKeySpec(BigInteger.valueOf(value.toLong()), parameters))
    }

    @Test fun ecdhHkdfMatchesThePythonCryptographyGoldenVector() {
        val keys = PcBridgeCrypto.derive(scalar(1), PcLinkModel.decoded(pcPublic), ByteArray(32) { it.toByte() })
        val reverse = PcBridgeCrypto.derive(scalar(2), PcLinkModel.decoded(phonePublic), ByteArray(32) { it.toByte() })
        assertEquals(expectedPhoneKey, PcLinkModel.hex(keys.phoneToPc))
        assertEquals(expectedPcKey, PcLinkModel.hex(keys.pcToPhone))
        assertArrayEquals(keys.phoneToPc, reverse.phoneToPc)
        assertArrayEquals(keys.pcToPhone, reverse.pcToPhone)
        assertFalse(keys.phoneToPc.contentEquals(keys.pcToPhone))
    }

    @Test fun canonicalAadAndAesGcmMatchPythonBytes() {
        assertEquals("{\"from\":\"phone\",\"kind\":\"anker-link\",\"pair\":\"fixture-pair\",\"sentAt\":\"2026-11-12T21:00:00.000Z\",\"seq\":1,\"v\":3}", String(header.aad()))
        val keys = PcBridgeCrypto.derive(scalar(1), PcLinkModel.decoded(pcPublic), ByteArray(32) { it.toByte() })
        val nonce = ByteArray(12) { it.toByte() }
        val plaintext = "{\"type\":\"pull\",\"after\":0}".toByteArray()
        val sealed = PcBridgeCrypto.seal(keys.phoneToPc, nonce, header, plaintext)
        assertEquals("ayReCLbw23NP4XfzmMINYjRpDpow0jpkmW_Ri-slIvP5ym3whdrqhAs", PcLinkModel.encoded(sealed))
        assertArrayEquals(plaintext, PcBridgeCrypto.open(keys.phoneToPc, nonce, header, sealed))
    }

    @Test fun pairAndSequenceTamperingCannotAuthenticate() {
        val keys = PcBridgeCrypto.derive(scalar(1), PcLinkModel.decoded(pcPublic), ByteArray(32) { it.toByte() })
        val nonce = ByteArray(12) { it.toByte() }
        val encrypted = PcBridgeCrypto.seal(keys.phoneToPc, nonce, header, "hello".toByteArray())
        assertThrows(Exception::class.java) { PcBridgeCrypto.open(keys.phoneToPc, nonce, header.copy(seq = 2), encrypted) }
        assertThrows(Exception::class.java) { PcBridgeCrypto.open(keys.phoneToPc, nonce, header.copy(pair = "other"), encrypted) }
        assertThrows(Exception::class.java) { PcBridgeCrypto.open(keys.pcToPhone, nonce, header, encrypted) }
        encrypted[0] = (encrypted[0].toInt() xor 1).toByte()
        assertThrows(Exception::class.java) { PcBridgeCrypto.open(keys.phoneToPc, nonce, header, encrypted) }
    }

    @Test fun sec1RejectsInvalidAndForeignCurvePoints() {
        assertArrayEquals(PcLinkModel.decoded(phonePublic), PcBridgeCrypto.publicSec1(PcBridgeCrypto.decodePublic(PcLinkModel.decoded(phonePublic))))
        assertThrows(IllegalArgumentException::class.java) { PcBridgeCrypto.decodePublic(ByteArray(65).apply { this[0] = 4 }) }
        assertThrows(IllegalArgumentException::class.java) { PcBridgeCrypto.decodePublic(ByteArray(33).apply { this[0] = 2 }) }
    }

    @Test fun bothScreensShowTheSameFixedWidthPairingCode() {
        assertEquals("5270", PcBridgeCrypto.confirmationCode(PcLinkModel.decoded(pcPublic), PcLinkModel.decoded(phonePublic)))
    }

    @Test fun escapedAadUsesJsonCompatibleStrings() {
        assertEquals("\"A\\nB\\\"\\\\\"", PcBridgeCrypto.quote("A\nB\"\\"))
    }
}
