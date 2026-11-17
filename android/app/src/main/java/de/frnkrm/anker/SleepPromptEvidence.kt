package de.frnkrm.anker

/** Ein Timeout ist nur bei lückenlos beobachteter sichtbarer Frage eine unsichere Schätzung. */
class SleepPromptEvidence {
    private var id = ""
    private var from = -1L
    private var last = -1L
    private var emitted = false
    fun observe(session: String, elapsed: Long, wall: Long, visible: Boolean): Long? {
        if (session.isBlank() || elapsed < 0 || wall <= 0) return null
        if (id != session) { id = session; from = -1; last = -1; emitted = false }
        if (!visible) { from = -1; last = -1; return null }
        if (emitted) return null
        if (last < 0 || elapsed < last || elapsed - last > 2000) from = elapsed
        last = elapsed
        if (elapsed - from < 60_000) return null
        emitted = true
        return wall
    }
}
