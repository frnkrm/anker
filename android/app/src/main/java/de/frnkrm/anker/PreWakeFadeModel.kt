package de.frnkrm.anker

/** Only the pre-wake player's gain ramps; the system alarm volume is never changed. */
object PreWakeFadeModel {
    const val FADE_MS = 60_000L
    fun volume(elapsedMs: Long, maximum: Float): Float {
        require(maximum.isFinite() && maximum in 0f..1f)
        return maximum * (elapsedMs.toDouble() / FADE_MS).coerceIn(0.0, 1.0).toFloat()
    }
}
