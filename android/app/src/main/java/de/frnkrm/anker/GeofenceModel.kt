package de.frnkrm.anker

import kotlin.math.*

/** Ausgewählte Besuchsdefinition, niemals ein eigenständiger Aufenthalts- oder Arbeitsnachweis. */
data class GeofenceVisitDefinition(
    val id: String,
    val revision: String,
    val latitude: Double,
    val longitude: Double,
    val radiusM: Float,
    val dwellMs: Long,
    val startsAt: Long,
    val expiresAt: Long,
) {
    val requestId: String get() = "geo:${GeofenceModel.hash(id)}:${GeofenceModel.hash(revision)}"
}

data class GeofencePendingSuggestion(val id: String, val visitId: String, val revision: String, val at: Long)
data class GeofenceTriggerFix(val latitude: Double, val longitude: Double, val accuracyM: Float, val at: Long)

/** Reine Validierung/Deduplikation. Keine Ortsabfrage, Standortbiografie oder automatische Ankunft. */
object GeofenceModel {
    const val MAX_VISITS = 20
    private const val HOUR = 3_600_000L

    fun hash(value: String): String {
        var hash = 0x811c9dc5.toInt()
        for (char in value) hash = (hash xor char.code) * 16777619
        return Integer.toUnsignedString(hash, 16)
    }

    fun wellFormed(visit: GeofenceVisitDefinition): Boolean =
        visit.id.isNotEmpty() && visit.id.length <= 200 && visit.revision.isNotEmpty() && visit.revision.length <= 100 &&
            visit.latitude.isFinite() && abs(visit.latitude) <= 90 && visit.longitude.isFinite() && abs(visit.longitude) <= 180 &&
            visit.radiusM.isFinite() && visit.radiusM in 100f..1000f && visit.dwellMs in 60_000L..900_000L &&
            visit.startsAt >= 0 && visit.expiresAt > visit.startsAt &&
            (visit.startsAt == 0L || visit.expiresAt - visit.startsAt <= 24 * HOUR)

    fun active(visits: List<GeofenceVisitDefinition>, now: Long): List<GeofenceVisitDefinition> = visits
        .filter { wellFormed(it) && it.expiresAt > now && it.expiresAt <= now + 48 * HOUR && it.startsAt <= now + 24 * HOUR }
        .distinctBy { it.id }
        .take(MAX_VISITS)

    fun currentSuggestion(suggestion: GeofencePendingSuggestion, visits: List<GeofenceVisitDefinition>, now: Long): Boolean =
        suggestion.at in 0..(now + 60_000L) && suggestion.at >= now - 6 * HOUR && visits.any {
            it.id == suggestion.visitId && it.revision == suggestion.revision &&
                suggestion.at >= it.startsAt && suggestion.at < it.expiresAt && now < it.expiresAt
        }

    fun pending(values: List<GeofencePendingSuggestion>, visits: List<GeofenceVisitDefinition>, now: Long): List<GeofencePendingSuggestion> =
        values.filter { currentSuggestion(it, visits, now) }.distinctBy { it.id }.take(MAX_VISITS)

    fun dwell(
        enabled: Boolean,
        visits: List<GeofenceVisitDefinition>,
        previous: List<GeofencePendingSuggestion>,
        handled: Set<String>,
        requestIds: Set<String>,
        now: Long,
        isDwell: Boolean,
        fix: GeofenceTriggerFix? = null,
    ): List<GeofencePendingSuggestion> {
        val current = active(visits, now)
        val pending = pending(previous, current, now)
        if (!enabled || !isDwell) return pending
        val seen = pending.map { it.id }.toMutableSet()
        val additions = current.mapNotNull { visit ->
            val suggestionId = "suggest:${visit.requestId}"
            if (visit.requestId !in requestIds || now < visit.startsAt || suggestionId in handled || suggestionId in seen || !credible(visit, fix, now)) null
            else GeofencePendingSuggestion(suggestionId, visit.id, visit.revision, now).also { seen.add(suggestionId) }
        }
        return (pending + additions).take(MAX_VISITS)
    }

    private fun credible(visit: GeofenceVisitDefinition, fix: GeofenceTriggerFix?, now: Long): Boolean {
        if (fix == null) return true // Android meldet nicht bei jedem Callback einen Fix; Ergebnis bleibt nur Vorschlag.
        if (!fix.latitude.isFinite() || abs(fix.latitude) > 90 || !fix.longitude.isFinite() || abs(fix.longitude) > 180 ||
            !fix.accuracyM.isFinite() || fix.accuracyM < 0 || fix.accuracyM > visit.radiusM ||
            fix.at < visit.startsAt || fix.at > now + 60_000 || fix.at < now - 10 * 60_000) return false
        val latitude = Math.toRadians(fix.latitude - visit.latitude)
        val longitude = Math.toRadians(fix.longitude - visit.longitude)
        val a = sin(latitude / 2).pow(2) + cos(Math.toRadians(visit.latitude)) * cos(Math.toRadians(fix.latitude)) * sin(longitude / 2).pow(2)
        val distance = 6_371_000 * 2 * atan2(sqrt(a.coerceIn(0.0, 1.0)), sqrt((1 - a).coerceIn(0.0, 1.0)))
        return distance <= visit.radiusM + fix.accuracyM
    }
}
