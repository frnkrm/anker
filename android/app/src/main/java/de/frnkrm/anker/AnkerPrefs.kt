package de.frnkrm.anker

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Kleiner Speicher für den nativen Teil: Wecker-Konfiguration und -Zustand, Erinnerungs-Warteschlange,
 * Widget-Zeitleiste. Liegt im Geräteschutz-Speicher, damit der Wecker auch vor dem ersten Entsperren klappt.
 * Deshalb stehen hier nur Uhrzeiten und allgemeine Erinnerungstexte, keine Gesundheits- oder Arbeitsinhalte.
 */
object AnkerPrefs {
    private const val NAME = "anker_native"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.createDeviceProtectedStorageContext().getSharedPreferences(NAME, Context.MODE_PRIVATE)

    // ---------- Alte Felder (1.0.x), nur noch für die Übernahme gelesen ----------
    fun alarmAt(ctx: Context): Long = prefs(ctx).getLong("alarmAt", 0L)
    fun snoozeAt(ctx: Context): Long = prefs(ctx).getLong("snoozeAt", 0L)
    fun snoozed(ctx: Context): Int = prefs(ctx).getInt("snoozed", 0)

    // ---------- Wecker ----------
    fun alarmStateJson(ctx: Context): String? = prefs(ctx).getString("alarmState", null)

    /** commit statt apply: Receiver dürfen nach onReceive jederzeit beendet werden. */
    fun saveState(ctx: Context, s: AlarmState) {
        val o = JSONObject()
            .put("ringing", s.ringing?.wire ?: "")
            .put("ringStartedAt", s.ringStartedAt)
            .put("mainAt", s.mainAt)
            .put("preWakeAt", s.preWakeAt)
            .put("snoozeAt", s.snoozeAt)
            .put("testAt", s.testAt)
            .put("wakeCheckAt", s.wakeCheckAt)
            .put("snoozeUsed", s.snoozeUsed)
            .put("lastMainFiredAt", s.lastMainFiredAt)
            .put("lastPreWakeFiredAt", s.lastPreWakeFiredAt)
            .put("lastSnoozeFiredAt", s.lastSnoozeFiredAt)
            .put("lastTestFiredAt", s.lastTestFiredAt)
            .put("lastWakeCheckFiredAt", s.lastWakeCheckFiredAt)
            .put("lastStopMethod", s.lastStopMethod)
            .put("lastStopAt", s.lastStopAt)
            .put("lastTimeoutAt", s.lastTimeoutAt)
            .put("missedMainAt", s.missedMainAt)
            .put("testResult", s.testResult)
            .put("testResultAt", s.testResultAt)
        prefs(ctx).edit().putString("alarmState", o.toString()).commit()
    }

    fun loadState(ctx: Context): AlarmState {
        val raw = alarmStateJson(ctx) ?: return AlarmState()
        return try {
            val o = JSONObject(raw)
            AlarmState(
                ringing = AlarmKind.of(o.optString("ringing")),
                ringStartedAt = o.optLong("ringStartedAt"),
                mainAt = o.optLong("mainAt"),
                preWakeAt = o.optLong("preWakeAt"),
                snoozeAt = o.optLong("snoozeAt"),
                testAt = o.optLong("testAt"),
                wakeCheckAt = o.optLong("wakeCheckAt"),
                snoozeUsed = o.optBoolean("snoozeUsed"),
                lastMainFiredAt = o.optLong("lastMainFiredAt"),
                lastPreWakeFiredAt = o.optLong("lastPreWakeFiredAt"),
                lastSnoozeFiredAt = o.optLong("lastSnoozeFiredAt"),
                lastTestFiredAt = o.optLong("lastTestFiredAt"),
                lastWakeCheckFiredAt = o.optLong("lastWakeCheckFiredAt"),
                lastStopMethod = o.optString("lastStopMethod"),
                lastStopAt = o.optLong("lastStopAt"),
                lastTimeoutAt = o.optLong("lastTimeoutAt"),
                missedMainAt = o.optLong("missedMainAt"),
                testResult = o.optString("testResult"),
                testResultAt = o.optLong("testResultAt"),
            )
        } catch (_: Exception) {
            AlarmState()
        }
    }

    fun setConfig(ctx: Context, c: AlarmConfig) {
        val o = JSONObject()
            .put("enabled", c.enabled)
            .put("wakeMinutes", c.wakeMinutes)
            .put("skipDates", JSONArray(c.skipDates.toList()))
            .put("wakeOverrides", JSONObject(c.wakeOverrides as Map<*, *>))
            .put("preWakeEnabled", c.preWakeEnabled)
            .put("preWakeLeadMinutes", c.preWakeLeadMinutes)
            .put("wakeCheckEnabled", c.wakeCheckEnabled)
            .put("wakeCheckDelayMinutes", c.wakeCheckDelayMinutes)
            .put("label", c.label)
        prefs(ctx).edit().putString("alarmConfig", o.toString()).commit()
    }

    /** null = die App hat noch nie eine Konfiguration geliefert (frisch aktualisiert von 1.0.x). */
    fun config(ctx: Context): AlarmConfig? {
        val raw = prefs(ctx).getString("alarmConfig", null) ?: return null
        return try {
            val o = JSONObject(raw)
            val skip = o.optJSONArray("skipDates") ?: JSONArray()
            val overrides = o.optJSONObject("wakeOverrides") ?: JSONObject()
            AlarmConfig(
                enabled = o.getBoolean("enabled"),
                wakeMinutes = o.getInt("wakeMinutes"),
                skipDates = (0 until skip.length()).map { skip.getString(it) }.toSet(),
                wakeOverrides = overrides.keys().asSequence().associateWith { overrides.getInt(it) },
                preWakeEnabled = o.optBoolean("preWakeEnabled"),
                preWakeLeadMinutes = o.optInt("preWakeLeadMinutes", 30),
                wakeCheckEnabled = o.optBoolean("wakeCheckEnabled"),
                wakeCheckDelayMinutes = o.optInt("wakeCheckDelayMinutes", 5),
                label = o.optString("label", "Aufstehen"),
            )
        } catch (_: Exception) {
            null
        }
    }

    fun alarmError(ctx: Context): String = prefs(ctx).getString("alarmError", "") ?: ""
    fun setAlarmError(ctx: Context, e: String) = prefs(ctx).edit().putString("alarmError", e).apply()
    fun lastReconcileAt(ctx: Context): Long = prefs(ctx).getLong("lastReconcileAt", 0L)
    fun lastReconcileReason(ctx: Context): String = prefs(ctx).getString("lastReconcileReason", "") ?: ""
    fun setLastReconcile(ctx: Context, at: Long, reason: String) =
        prefs(ctx).edit().putLong("lastReconcileAt", at).putString("lastReconcileReason", reason).apply()
    fun audioOk(ctx: Context): Boolean = prefs(ctx).getBoolean("audioOk", true)
    fun setAudioOk(ctx: Context, ok: Boolean) = prefs(ctx).edit().putBoolean("audioOk", ok).apply()

    fun isRinging(ctx: Context): Boolean = loadState(ctx).ringing != null

    // ---------- Erinnerungen ----------
    fun reminderQueue(ctx: Context): String = prefs(ctx).getString("reminderQueue", "[]") ?: "[]"
    fun setReminderQueue(ctx: Context, json: String) = prefs(ctx).edit().putString("reminderQueue", json).commit()
    fun reminderSlots(ctx: Context): String = prefs(ctx).getString("reminderSlots", "[]") ?: "[]"
    fun setReminderSlots(ctx: Context, json: String) = prefs(ctx).edit().putString("reminderSlots", json).commit()
    fun reminderActions(ctx: Context): String = prefs(ctx).getString("reminderActions", "[]") ?: "[]"
    fun setReminderActions(ctx: Context, json: String) = prefs(ctx).edit().putString("reminderActions", json).commit()

    fun reminderLastShown(ctx: Context, date: String, key: String): String? = prefs(ctx).getString("shown:$date|$key", null)
    fun setReminderLastShown(ctx: Context, date: String, key: String, json: String) {
        val p = prefs(ctx)
        val e = p.edit()
        // Nur den aktuellen Tag aufheben
        p.all.keys.filter { it.startsWith("shown:") && !it.startsWith("shown:$date") }.forEach { e.remove(it) }
        e.putString("shown:$date|$key", json).apply()
    }

    // ---------- Widget ----------
    fun widgetEntries(ctx: Context): String = prefs(ctx).getString("widget", "[]") ?: "[]"
    fun setWidgetEntries(ctx: Context, json: String) = prefs(ctx).edit().putString("widget", json).apply()
}
