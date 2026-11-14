package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class NfcAnchorModelTest {
    private fun record(text: String = "anker:1:now") = NfcAnchorModel.Record(2, NfcAnchorModel.MIME.toByteArray(), text.toByteArray())
    private fun parse(record: NfcAnchorModel.Record, bytes: Int = 50) = NfcAnchorModel.target(listOf(record), bytes)
    @Test fun onlyThreeNeutralTargets() {
        for (target in listOf("now", "prep", "recover")) assertEquals(target, parse(record("anker:1:$target")))
    }
    @Test fun noNormalizationOrAdditionalCommands() {
        for (text in listOf("", "anker:2:now", "anker:1:NOW", " anker:1:now", "anker:1:now\n", "\uFEFFanker:1:now", "anker:1:now\u0000", "anker:1:now:private", "anker:1:alarm", "https://anker/", "anker:1:/fokus-start")) assertNull(text, parse(record(text)))
    }
    @Test fun mimeAndTnfMustMatchExactly() {
        for (tnf in listOf<Short>(0, 1, 3, 4, 5, 6)) assertNull(parse(record().copy(tnf = tnf)))
        for (mime in listOf("APPLICATION/vnd.frnkrm.anker.anchor", "application/vnd.frnkrm.anker.anchor ", "android.com:pkg", "text/plain", "")) assertNull(parse(record().copy(type = mime.toByteArray())))
    }
    @Test fun additionalRecordsOrRecordIdentifiersAreRejected() {
        assertNull(NfcAnchorModel.target(emptyList(), 50))
        assertNull(NfcAnchorModel.target(listOf(record(), record("anker:1:prep")), 100))
        assertNull(parse(record().copy(id = byteArrayOf(1))))
    }
    @Test fun boundedMessageAndPayload() {
        assertEquals("now", parse(record(), 256))
        for (size in listOf(-1, 0, 257, Int.MAX_VALUE)) assertNull(parse(record(), size))
        assertNull(parse(record().copy(payload = ByteArray(33))))
        assertNull(parse(record().copy(payload = byteArrayOf())))
    }
    @Test fun malformedUtf8DoesNotBecomeAReplacementOrPartialTarget() {
        for (bytes in listOf(byteArrayOf(0xC3.toByte(), 0x28), "anker:1:now".toByteArray() + byteArrayOf(0xFF.toByte()), byteArrayOf(0xED.toByte(), 0xA0.toByte(), 0x80.toByte()))) assertNull(parse(record().copy(payload = bytes)))
    }
}
