package de.frnkrm.anker

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Ausschließlich neutrale öffentliche Marker, keine Tagidentität oder Authentifizierung. */
object NfcAnchorModel {
    const val MIME = "application/vnd.frnkrm.anker.anchor"
    const val MAX_MESSAGE_BYTES = 256
    const val MAX_PAYLOAD_BYTES = 32
    val targets = setOf("now", "prep", "recover")
    data class Record(val tnf: Short, val type: ByteArray, val payload: ByteArray, val id: ByteArray = byteArrayOf())

    fun target(records: List<Record>, messageBytes: Int): String? {
        if (messageBytes !in 1..MAX_MESSAGE_BYTES || records.size != 1) return null
        val record = records.single()
        if (record.tnf.toInt() != 2 || !record.type.contentEquals(MIME.toByteArray(Charsets.US_ASCII))
            || record.id.isNotEmpty() || record.payload.size !in 1..MAX_PAYLOAD_BYTES) return null
        val text = try {
            Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(record.payload)).toString()
        } catch (_: Exception) { return null }
        return targets.firstOrNull { text == "anker:1:$it" }
    }
}

/** Monotone, flüchtige Scan-/Vorschauinstanz. Keine Reaktivierung bei Resume oder Import. */
class NfcAnchorSession {
    companion object { const val WINDOW_MS = 30_000L }
    data class Attempt(val id: String, val generation: Long, val deadline: Long, val target: String? = null)
    private var serial = 0L
    var current: Attempt? = null
        private set

    fun begin(id: String, now: Long): Attempt? {
        if (current != null || !id.matches(Regex("[A-Za-z0-9-]{1,80}")) || now < 0 || now > Long.MAX_VALUE - WINDOW_MS) return null
        return Attempt(id, ++serial, now + WINDOW_MS).also { current = it }
    }
    fun active(generation: Long): Boolean = current?.generation == generation
    fun valid(generation: Long, now: Long, eligible: Boolean): Boolean = eligible && active(generation) && now >= 0 && now < current!!.deadline
    fun read(generation: Long, target: String, now: Long, eligible: Boolean): Boolean {
        if (!valid(generation, now, eligible) || current!!.target != null || target !in NfcAnchorModel.targets) return false
        current = current!!.copy(target = target)
        return true
    }
    fun cancel(id: String? = null): Boolean {
        if (current == null || id != null && current!!.id != id) return false
        current = null
        return true
    }
    fun confirm(id: String, target: String, now: Long, eligible: Boolean): Boolean {
        val attempt = current ?: return false
        if (attempt.id != id || attempt.target == null) return false
        val allowed = valid(attempt.generation, now, eligible) && attempt.target == target && target in NfcAnchorModel.targets
        current = null
        return allowed
    }
}
