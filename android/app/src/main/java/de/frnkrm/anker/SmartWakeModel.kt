package de.frnkrm.anker

import kotlin.math.max

/**
 * Konservative Aktivitätsheuristik, KEINE Erkennung von Schlafstadien oder Wachheit.
 * Drei Kalibrierintervalle, danach mehrere Bewegungs- und Geräuschintervalle innerhalb einer Minute.
 * Ein einzelnes Geräusch, konstantes Rauschen oder eine einzelne Bewegung reichen nicht.
 * Es werden nur Zehn-Sekunden-Aggregate im RAM gehalten, keine Aufnahmen.
 */
class SmartWakeDetector(private val from: Long, private val deadline: Long) {
    private var lastAt = Long.MIN_VALUE
    private var baselineCount = 0
    private var motionFloor = 0.0
    private var soundFloor = 0.0
    private val recent = ArrayDeque<Triple<Long, Boolean, Boolean>>()
    private var triggered = false

    fun observe(at: Long, motionPeak: Double, soundRms: Double): Boolean {
        if (triggered || at < from || at >= deadline || at <= lastAt || !motionPeak.isFinite() || !soundRms.isFinite()) return false
        // Zu dicht eintreffende Aufrufe dürfen die Mindestdauer nicht umgehen.
        if (lastAt != Long.MIN_VALUE && at - lastAt < 9_000) return false
        lastAt = at
        if (baselineCount < 3) {
            motionFloor = max(motionFloor, motionPeak)
            soundFloor = max(soundFloor, soundRms)
            baselineCount++
            return false
        }
        while (recent.isNotEmpty() && recent.first().first < at - 60_000) recent.removeFirst()
        recent.addLast(Triple(at, motionPeak > max(0.3, motionFloor * 3 + 0.1), soundRms > max(0.015, soundFloor * 2.8)))
        while (recent.size > 6) recent.removeFirst()
        if (recent.count { it.second } >= 3 && recent.count { it.third } >= 2) {
            triggered = true
            return true
        }
        return false
    }
}
