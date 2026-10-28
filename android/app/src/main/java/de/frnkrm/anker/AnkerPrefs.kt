package de.frnkrm.anker

import android.content.Context
import android.content.SharedPreferences

/** Kleiner Speicher für den nativen Teil (Wecker-Zeit, Klingel-Status, Widget-Zeitleiste). */
object AnkerPrefs {
    private const val NAME = "anker_native"

    // Geräteschutz-Speicher, damit der Wecker auch vor dem ersten Entsperren nach einem Neustart klappt
    private fun prefs(ctx: Context): SharedPreferences =
        ctx.createDeviceProtectedStorageContext().getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun alarmAt(ctx: Context): Long = prefs(ctx).getLong("alarmAt", 0L)
    fun alarmLabel(ctx: Context): String = prefs(ctx).getString("alarmLabel", "Aufstehen") ?: "Aufstehen"
    fun setAlarm(ctx: Context, at: Long, label: String) =
        prefs(ctx).edit().putLong("alarmAt", at).putString("alarmLabel", label).putInt("snoozed", 0).apply()

    fun clearAlarm(ctx: Context) = prefs(ctx).edit().putLong("alarmAt", 0L).apply()

    fun isRinging(ctx: Context): Boolean = prefs(ctx).getBoolean("ringing", false)
    fun setRinging(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("ringing", v).apply()

    fun snoozed(ctx: Context): Int = prefs(ctx).getInt("snoozed", 0)
    fun setSnoozed(ctx: Context, n: Int) = prefs(ctx).edit().putInt("snoozed", n).apply()

    fun widgetEntries(ctx: Context): String = prefs(ctx).getString("widget", "[]") ?: "[]"
    fun setWidgetEntries(ctx: Context, json: String) = prefs(ctx).edit().putString("widget", json).apply()
}
