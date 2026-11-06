package de.frnkrm.anker

/** Begrenzte lokale Texte; keine Roh-Audiodaten oder aufgezeichnete Sprachhistorie. */
object VoiceModel {
    fun transcript(candidates: List<String>): String? = candidates.firstOrNull { it.isNotBlank() }
        ?.filter { it >= ' ' || it == '\n' }?.trim()?.take(3000)?.takeIf { it.isNotBlank() }
}

/** Eine verspätete Freigabe oder UI-Aufgabe darf nach Abbruch keinen neuen Start übernehmen. */
class VoiceRequestLease {
    @Volatile private var request: String? = null
    fun begin(id: String) { request = id.takeIf { it.isNotBlank() } }
    fun cancel() { request = null }
    fun accepts(id: String): Boolean = request != null && request == id
}
