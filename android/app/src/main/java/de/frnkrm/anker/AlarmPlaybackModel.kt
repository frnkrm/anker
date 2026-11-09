package de.frnkrm.anker

/** Runtime player failures may recover only within the same live, focused alarm occurrence. */
object AlarmPlaybackModel {
    const val MEDIA_SOURCE_COUNT = 3
    const val FALLBACK_PULSE_MS = 600
    const val FALLBACK_GAP_MS = 1200L
    fun mayPlay(state: AlarmState, kind: AlarmKind, startedAt: Long, now: Long, focusPermitted: Boolean): Boolean =
        focusPermitted && state.ringing == kind && state.ringStartedAt == startedAt && now >= startedAt && !AlarmMachine.ringExpired(state, now)
    fun nextSource(failedSource: Int): Int = (failedSource + 1).coerceIn(0, MEDIA_SOURCE_COUNT)
}
