package de.frnkrm.anker

import android.app.NotificationManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.lang.ref.WeakReference

/** Brücke zwischen der Web-App und dem nativen Teil: Wecker, Widget, Berechtigungs-Einstellungen. */
@CapacitorPlugin(name = "AnkerNative")
class AnkerNativePlugin : Plugin() {
    companion object {
        private var instance: WeakReference<AnkerNativePlugin>? = null

        fun notifyRinging() {
            instance?.get()?.notifyListeners("alarmRinging", JSObject(), true)
        }
    }

    override fun load() {
        instance = WeakReference(this)
    }

    private fun ok(call: PluginCall, vararg pairs: Pair<String, Any?>) {
        val o = JSObject()
        for ((k, v) in pairs) o.put(k, v)
        call.resolve(o)
    }

    private fun open(call: PluginCall, intent: Intent, fallback: Intent? = null) {
        try {
            activity.startActivity(intent)
        } catch (_: Exception) {
            try {
                activity.startActivity(fallback ?: appSettingsIntent())
            } catch (_: Exception) {
            }
        }
        call.resolve()
    }

    private fun appSettingsIntent() =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))

    // ---------- Wecker ----------

    @PluginMethod
    fun scheduleAlarm(call: PluginCall) {
        val at = call.getLong("at") ?: return call.reject("at fehlt")
        AlarmScheduler.schedule(context, at, call.getString("label") ?: "Aufstehen")
        call.resolve()
    }

    @PluginMethod
    fun cancelAlarm(call: PluginCall) {
        AlarmScheduler.cancel(context)
        call.resolve()
    }

    @PluginMethod
    fun stopAlarm(call: PluginCall) {
        AlarmService.stop(context)
        AnkerPrefs.setRinging(context, false)
        AnkerPrefs.setSnoozed(context, 0)
        activity.runOnUiThread {
            activity.setShowWhenLocked(false)
            activity.setTurnScreenOn(false)
        }
        call.resolve()
    }

    @PluginMethod
    fun snoozeAlarm(call: PluginCall) {
        if (AnkerPrefs.snoozed(context) >= 1) return ok(call, "ok" to false)
        val minutes = call.getInt("minutes") ?: 5
        AlarmService.stop(context)
        AnkerPrefs.setSnoozed(context, 1)
        val at = System.currentTimeMillis() + minutes * 60_000L
        AlarmScheduler.setSystemAlarm(context, at)
        ok(call, "ok" to true)
    }

    @PluginMethod
    fun getAlarmState(call: PluginCall) {
        val at = AnkerPrefs.alarmAt(context)
        ok(call, "ringing" to AnkerPrefs.isRinging(context), "scheduledAt" to (if (at > 0) at else null), "snoozed" to AnkerPrefs.snoozed(context))
    }

    // ---------- Berechtigungen ----------

    @PluginMethod
    fun canUseFullScreenIntent(call: PluginCall) {
        val nm = context.getSystemService(NotificationManager::class.java)
        val granted = if (Build.VERSION.SDK_INT >= 34) nm.canUseFullScreenIntent() else true
        ok(call, "granted" to granted)
    }

    @PluginMethod
    fun openFullScreenIntentSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 34) {
            open(call, Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}")))
        } else {
            open(call, appSettingsIntent())
        }
    }

    @PluginMethod
    fun isIgnoringBatteryOptimizations(call: PluginCall) {
        val pm = context.getSystemService(PowerManager::class.java)
        ok(call, "granted" to pm.isIgnoringBatteryOptimizations(context.packageName))
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        open(
            call,
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")),
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        )
    }

    @PluginMethod
    fun hasDndAccess(call: PluginCall) {
        val nm = context.getSystemService(NotificationManager::class.java)
        ok(call, "granted" to nm.isNotificationPolicyAccessGranted)
    }

    @PluginMethod
    fun openDndSettings(call: PluginCall) {
        open(call, Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        open(call, appSettingsIntent())
    }

    // ---------- Widget ----------

    @PluginMethod
    fun updateWidget(call: PluginCall) {
        val entries = call.getArray("entries") ?: return call.reject("entries fehlt")
        AnkerPrefs.setWidgetEntries(context, entries.toString())
        AnkerWidget.refreshAll(context)
        call.resolve()
    }

    @PluginMethod
    fun isWidgetPlaced(call: PluginCall) {
        val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, AnkerWidget::class.java))
        ok(call, "placed" to ids.isNotEmpty())
    }
}
