package de.frnkrm.anker

/** Relative monotonic time bounds the session even if the wall clock changes. */
object SleepAudioModel {
    const val DEFAULT_MINUTES = 20
    const val MAX_MINUTES = 60

    fun volume(initial: Double, elapsedMs: Long, durationMs: Long): Float {
        require(initial.isFinite() && initial in 0.0..0.6)
        require(durationMs in 60_000..MAX_MINUTES * 60_000L)
        val fraction = 1.0 - elapsedMs.coerceAtLeast(0).toDouble() / durationMs
        return (initial * fraction.coerceIn(0.0, 1.0)).toFloat()
    }
}

/** Locally generated, bounded low-frequency noise; no recording or downloaded media. */
class BrownNoiseGenerator(seed: Long = System.nanoTime()) {
    private val random = kotlin.random.Random(seed)
    private var value = 0.0
    fun fill(samples: ShortArray) {
        for (i in samples.indices) {
            value = (value + random.nextDouble(-0.02, 0.02)) / 1.02
            samples[i] = ((value * 3.5).coerceIn(-0.8, 0.8) * Short.MAX_VALUE).toInt().toShort()
        }
    }
}
