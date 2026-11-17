package de.frnkrm.anker

/** Nur technische Zähler. Fehlender Eingang ist niemals ein stilles Messintervall. */
class SmartWakeEvidence {
    var intervals = 0L; private set
    var validIntervals = 0L; private set
    var missingIntervals = 0L; private set
    var quietIntervals = 0L; private set
    var audioBlocks = 0L; private set
    var motionEvents = 0L; private set
    var firstInputAt = 0L; private set
    var lastInputAt = 0L; private set
    var quietSinceAt = 0L; private set
    private var lastAt = 0L
    @Synchronized fun observe(at: Long, motion: Double, sound: Double, audio: Long, movement: Long) {
        if (at <= lastAt || at <= 0 || !motion.isFinite() || !sound.isFinite() || audio < 0 || movement < 0) return
        if (lastAt > 0 && at - lastAt > 30_000) quietSinceAt = 0
        lastAt = at; intervals++
        audioBlocks += audio; motionEvents += movement
        if (audio > 0 || movement > 0) {
            if (firstInputAt == 0L) firstInputAt = at
            lastInputAt = at
        }
        if (audio == 0L || movement == 0L) { missingIntervals++; quietSinceAt = 0; return }
        validIntervals++
        if (motion < 0.3 && sound < 0.015) {
            quietIntervals++
            if (quietSinceAt == 0L) quietSinceAt = at
        } else quietSinceAt = 0
    }
    @Synchronized fun facts(): Map<String, Any> = mapOf("count" to intervals, "validIntervals" to validIntervals,
        "missingIntervals" to missingIntervals, "quietIntervals" to quietIntervals, "audioBlocks" to audioBlocks,
        "motionEvents" to motionEvents, "firstInputAt" to firstInputAt, "lastInputAt" to lastInputAt, "quietSinceAt" to quietSinceAt)
}
