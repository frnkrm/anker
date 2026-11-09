package de.frnkrm.anker

/** A bounded mirror of one existing focus timer; it never advances or completes a routine. */
data class RoutinePaceSpec(
    val sessionId: String,
    val stepId: String,
    val title: String,
    val durationMs: Long,
    val deadlineAt: Long,
    val intervalSeconds: Int = 60,
    val hapticsEnabled: Boolean = false,
    val thresholds: Boolean = true,
    val speakStep: Boolean = false,
    val strength: String = "gentle",
)

data class RoutinePaceState(
    val spec: RoutinePaceSpec,
    val phase: String = "running",
    val lastBucket: Long = 0,
    val announced: Boolean = false,
    val passedThresholds: Set<Int> = emptySet(),
)

data class RoutinePaceTick(val state: RoutinePaceState, val pulse: Boolean = false, val speech: String? = null)

object RoutinePaceKeeperModel {
    const val MAX_DURATION_MS = 6 * 60 * 60_000L
    private val CHECKPOINTS = listOf(50, 25, 10)

    fun validate(spec: RoutinePaceSpec) {
        require(spec.sessionId.isNotBlank() && spec.sessionId.length <= 128)
        require(spec.stepId.isNotBlank() && spec.stepId.length <= 128)
        require(spec.title.length <= 240 && spec.title.none { it < ' ' && it != '\n' })
        require(spec.durationMs in 1_000..MAX_DURATION_MS)
        require(spec.deadlineAt >= 0 && spec.intervalSeconds in 15..300)
        require(spec.strength == "gentle" || spec.strength == "strong")
    }

    fun remaining(spec: RoutinePaceSpec, now: Long): Long =
        (spec.deadlineAt - now).coerceIn(0, spec.durationMs)

    /** Opening an already running step does not replay old interval or threshold signals. */
    fun sync(previous: RoutinePaceState?, spec: RoutinePaceSpec, status: String, now: Long): RoutinePaceState {
        validate(spec)
        require(status in setOf("running", "paused", "stopped"))
        require(now >= 0)
        val phase = if (status == "running" && spec.deadlineAt <= now) "expired" else status
        val same = previous?.spec?.let { it.sessionId == spec.sessionId && it.stepId == spec.stepId && it.durationMs == spec.durationMs } == true
        val left = if (phase == "running") remaining(spec, now) else spec.durationMs
        val elapsed = spec.durationMs - left
        val passed = CHECKPOINTS.filter { left * 100 <= spec.durationMs * it }.toSet()
        if (same) {
            val next = previous.copy(spec = spec, phase = phase)
            return if (previous.phase != "running" && phase == "running") next.copy(
                lastBucket = maxOf(previous.lastBucket, elapsed / (spec.intervalSeconds * 1000L)),
                passedThresholds = previous.passedThresholds + passed,
            ) else next
        }
        return RoutinePaceState(spec, phase, elapsed / (spec.intervalSeconds * 1000L), passedThresholds = passed)
    }

    fun tick(s: RoutinePaceState, now: Long): RoutinePaceTick {
        if (s.phase != "running") return RoutinePaceTick(s)
        val left = remaining(s.spec, now)
        if (left <= 0) return RoutinePaceTick(s.copy(phase = "expired"))
        val elapsed = s.spec.durationMs - left
        val bucket = elapsed / (s.spec.intervalSeconds * 1000L)
        val crossed = CHECKPOINTS.filter { it !in s.passedThresholds && left * 100 <= s.spec.durationMs * it }.toSet()
        val pulse = s.spec.hapticsEnabled && (bucket > s.lastBucket || (s.spec.thresholds && crossed.isNotEmpty()))
        val speech = if (s.spec.speakStep && !s.announced) {
            val minutes = (left + 59_999) / 60_000
            "${s.spec.title.ifBlank { "Dein nächster Schritt" }}. $minutes ${if (minutes == 1L) "Minute" else "Minuten"}."
        } else null
        return RoutinePaceTick(s.copy(lastBucket = maxOf(s.lastBucket, bucket), announced = s.announced || speech != null,
            passedThresholds = s.passedThresholds + crossed), pulse, speech)
    }
}
