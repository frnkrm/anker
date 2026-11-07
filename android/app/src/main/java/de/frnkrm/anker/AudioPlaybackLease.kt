package de.frnkrm.anker

/** Fokus gilt nur für die aktuelle Wiedergabe. Ein endgültiger Verlust braucht einen neuen Start. */
class AudioPlaybackLease {
    private enum class State { CLOSED, REQUESTING, PLAYING, SUSPENDED }
    private var generation = 0
    private var state = State.CLOSED

    fun begin(): Int {
        generation++
        state = State.REQUESTING
        return generation
    }

    fun requested(id: Int, granted: Boolean): Boolean {
        if (id != generation || state != State.REQUESTING) return false
        state = if (granted) State.PLAYING else State.CLOSED
        return granted
    }

    fun gain(id: Int): Boolean {
        if (id != generation || state != State.SUSPENDED) return false
        state = State.PLAYING
        return true
    }

    fun lose(id: Int, transient: Boolean): Boolean {
        if (id != generation || (state != State.PLAYING && state != State.SUSPENDED)) return false
        state = if (transient) State.SUSPENDED else State.CLOSED
        return true
    }

    fun permits(id: Int): Boolean = id == generation && state == State.PLAYING

    fun cancel() {
        generation++
        state = State.CLOSED
    }
}
