package de.frnkrm.anker

/** Die Web-App liefert die gemeinsame Auswahl; native Logik prüft nur deren Lebensdauer. */
object WidgetModel {
    fun isFresh(generatedAt: Long, expiresAt: Long, now: Long): Boolean = generatedAt > 0 && generatedAt <= now + 60_000L && expiresAt > now && expiresAt > generatedAt && expiresAt - generatedAt <= 48 * 3600_000L
    fun nextRefresh(nextAt: Long?, expiresAt: Long, now: Long): Long? = listOfNotNull(nextAt, expiresAt.takeIf { it > now }).filter { it > now }.minOrNull()
}
