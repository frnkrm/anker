package de.frnkrm.anker

import android.app.AlarmManager
import android.Manifest
import android.app.NotificationManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import java.lang.ref.WeakReference

/** Brücke zwischen der Web-App und dem nativen Teil: Wecker, Erinnerungen, Widget, Druck, Einstellungen. */
@CapacitorPlugin(name = "AnkerNative", permissions = [Permission(alias = "smartAudio", strings = [Manifest.permission.RECORD_AUDIO])])
class AnkerNativePlugin : Plugin() {
    companion object {
        private var instance: WeakReference<AnkerNativePlugin>? = null

        fun notifyRinging() {
            instance?.get()?.notifyListeners("alarmRinging", JSObject(), true)
        }

        fun notifyReminderAction() {
            instance?.get()?.notifyListeners("reminderAction", JSObject(), true)
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

    /** Die einzige Stelle, über die die App den Wecker plant. Kritisch: Fehler gehen an die App zurück. */
    @PluginMethod
    fun syncAlarmConfig(call: PluginCall) {
        try {
            val skip = call.getArray("skipDates") ?: JSONArray()
            val overrides = call.getObject("wakeOverrides") ?: JSObject()
            val cfg = AlarmConfig(
                enabled = call.getBoolean("enabled") ?: return call.reject("enabled fehlt"),
                wakeMinutes = call.getInt("wakeMinutes") ?: return call.reject("wakeMinutes fehlt"),
                skipDates = (0 until skip.length()).map { skip.getString(it) }.toSet(),
                wakeOverrides = overrides.keys().asSequence().associateWith { overrides.getInt(it) },
                preWakeEnabled = call.getBoolean("preWakeEnabled") ?: false,
                preWakeLeadMinutes = call.getInt("preWakeLeadMinutes") ?: 30,
                wakeCheckEnabled = call.getBoolean("wakeCheckEnabled") ?: false,
                wakeCheckDelayMinutes = call.getInt("wakeCheckDelayMinutes") ?: 5,
                label = call.getString("label") ?: "Aufstehen",
                smartWakeEnabled = call.getBoolean("smartWakeEnabled") ?: false,
                smartWakeWindowMinutes = (call.getInt("smartWakeWindowMinutes") ?: 45).coerceIn(5, 90),
            )
            AlarmController.syncConfig(context, cfg)
            call.resolve(stateObject())
        } catch (e: Exception) {
            call.reject("Wecker konnte nicht geplant werden: ${e.javaClass.simpleName}")
        }
    }

    private fun stateObject(): JSObject {
        val s = AlarmController.state(context)
        val o = JSObject()
        o.put("ringing", s.ringing != null)
        o.put("kind", s.ringing?.wire)
        o.put("scheduledAt", if (s.mainAt > 0) s.mainAt else null)
        o.put("preWakeAt", if (s.preWakeAt > 0) s.preWakeAt else null)
        o.put("preWakePausedForTargetAt", s.preWakePausedForTargetAt)
        o.put("snoozeAt", if (s.snoozeAt > 0) s.snoozeAt else null)
        o.put("wakeCheckAt", if (s.wakeCheckAt > 0) s.wakeCheckAt else null)
        o.put("testAt", if (s.testAt > 0) s.testAt else null)
        o.put("snoozed", if (s.snoozeUsed) 1 else 0)
        o.put("mainConfirmed", s.mainAt > 0 && AlarmController.isArmed(context, AlarmKind.MAIN))
        o.put("preWakeConfirmed", s.preWakeAt > 0 && AlarmController.isArmed(context, AlarmKind.PRE_WAKE))
        o.put("exact", AlarmController.canExact(context))
        o.put("error", AnkerPrefs.alarmError(context))
        return o
    }

    @PluginMethod
    fun getAlarmState(call: PluginCall) {
        val now = System.currentTimeMillis()
        // Prozess war tot und Limit abgelaufen: keinen alten Klingel-Status vorspiegeln
        if (AlarmMachine.ringExpired(AlarmController.state(context), now)) AlarmController.timeout(context)
        call.resolve(stateObject())
    }

    @PluginMethod
    fun getSmartWakeState(call: PluginCall) { call.resolve(SmartWakeService.status(context)) }

    @PluginMethod
    fun startSmartWake(call: PluginCall) {
        if (getPermissionState("smartAudio") != PermissionState.GRANTED) {
            requestPermissionForAlias("smartAudio", call, "startSmartWakePermitted")
        } else startSmartWakePermitted(call)
    }

    @PermissionCallback
    private fun startSmartWakePermitted(call: PluginCall) {
        if (getPermissionState("smartAudio") != PermissionState.GRANTED) { call.reject("Ohne Mikrofonfreigabe startet die kombinierte Messung nicht. Der feste Wecker bleibt gestellt."); return }
        try {
            val cfg = AnkerPrefs.config(context)
            val state = AlarmController.state(context)
            if (cfg?.enabled != true || !cfg.smartWakeEnabled || state.mainAt <= System.currentTimeMillis() || state.ringing != null || !AlarmController.canExact(context)) {
                call.reject("Aktiviere das Weckfenster und einen bestätigten exakten Hauptwecker, bevor du startest."); return
            }
            if (activity.isFinishing || activity.isDestroyed) { call.reject("Bitte starte die Messung bei geöffneter App."); return }
            ContextCompat.startForegroundService(context, Intent(context, SmartWakeService::class.java)
                .setAction(SmartWakeService.ACTION_START).putExtra("targetAt", state.mainAt).putExtra("minutes", cfg.smartWakeWindowMinutes))
            call.resolve()
        } catch (_: Exception) { call.reject("Android hat den Messstart nicht erlaubt. Öffne die App und versuche es erneut. Der feste Wecker bleibt gestellt.") }
    }

    @PluginMethod
    fun stopSmartWake(call: PluginCall) {
        SmartWakeService.stopIfRunning("Messung beendet. Der feste Wecker bleibt gestellt.")
        call.resolve()
    }

    @PluginMethod
    fun stopAlarm(call: PluginCall) {
        AlarmController.stop(context, call.getString("method") ?: "qr")
        if (AlarmMachine.shouldStopRingingService(AlarmController.state(context))) hideFromLockScreen()
        call.resolve(stateObject())
    }

    @PluginMethod
    fun snoozeAlarm(call: PluginCall) {
        val done = AlarmController.snooze(context, call.getInt("minutes") ?: 5)
        if (done) hideFromLockScreen()
        ok(call, "ok" to done)
    }

    @PluginMethod
    fun testAlarm(call: PluginCall) {
        val at = AlarmController.scheduleTest(context, call.getInt("seconds") ?: 10)
        ok(call, "at" to at)
    }

    @PluginMethod
    fun confirmTest(call: PluginCall) {
        AlarmController.confirmTest(context, call.getBoolean("heard") ?: false)
        call.resolve()
    }

    private fun hideFromLockScreen() {
        activity?.runOnUiThread {
            activity.setShowWhenLocked(false)
            activity.setTurnScreenOn(false)
        }
    }

    /** Kurzer Probeton über den Wecker-Kanal. Ändert keine Lautstärke. */
    @PluginMethod
    fun playTestTone(call: PluginCall) {
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        try {
            val p = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                setDataSource(context, uri)
                prepare()
                start()
            }
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    p.stop()
                } catch (_: Exception) {
                }
                p.release()
            }, 3000)
            ok(call, "ok" to true)
        } catch (_: Exception) {
            ok(call, "ok" to false)
        }
    }

    /** Echte Werte aus Android, nichts Geratenes. */
    @PluginMethod
    fun getAlarmDiagnostics(call: PluginCall) {
        val ctx = context
        val s = AlarmController.state(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val am = ctx.getSystemService(AudioManager::class.java)
        val pm = ctx.getSystemService(PowerManager::class.java)
        val channel = nm.getNotificationChannel(AlarmService.CHANNEL)
        val outputs = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        val bluetooth = outputs.any { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
        val wired = outputs.any { it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET || it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || it.type == AudioDeviceInfo.TYPE_USB_HEADSET }
        val (queue, horizon) = ReminderScheduler.queueInfo(ctx)
        val o = stateObject()
        o.put("systemNextAt", ctx.getSystemService(AlarmManager::class.java)?.nextAlarmClock?.triggerTime)
        o.put("notificationsEnabled", NotificationManagerCompat.from(ctx).areNotificationsEnabled())
        o.put("channelImportance", channel?.importance ?: -1)
        o.put("channelBypassDnd", channel?.canBypassDnd() ?: false)
        o.put("interruptionFilter", nm.currentInterruptionFilter)
        o.put("dndAccess", nm.isNotificationPolicyAccessGranted)
        o.put("fullScreen", if (Build.VERSION.SDK_INT >= 34) nm.canUseFullScreenIntent() else true)
        o.put("batteryIgnored", pm.isIgnoringBatteryOptimizations(ctx.packageName))
        o.put("powerSave", pm.isPowerSaveMode)
        o.put("alarmVolume", am.getStreamVolume(AudioManager.STREAM_ALARM))
        o.put("alarmVolumeMax", am.getStreamMaxVolume(AudioManager.STREAM_ALARM))
        o.put("bluetooth", bluetooth)
        o.put("wired", wired)
        o.put("audioOk", AnkerPrefs.audioOk(ctx))
        o.put("testResult", s.testResult)
        o.put("testResultAt", s.testResultAt)
        o.put("lastStopMethod", s.lastStopMethod)
        o.put("lastStopAt", s.lastStopAt)
        o.put("lastTimeoutAt", s.lastTimeoutAt)
        o.put("missedMainAt", s.missedMainAt)
        o.put("lastReconcileAt", AnkerPrefs.lastReconcileAt(ctx))
        o.put("lastReconcileReason", AnkerPrefs.lastReconcileReason(ctx))
        o.put("reminderQueue", queue)
        o.put("reminderHorizon", horizon)
        o.put("remindersVisible", ReminderScheduler.visibleCount(ctx))
        o.put("sdk", Build.VERSION.SDK_INT)
        o.put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
        call.resolve(o)
    }

    // ---------- Erinnerungen ----------

    @PluginMethod
    fun syncReminders(call: PluginCall) {
        try {
            val arr = call.getArray("reminders") ?: return call.reject("reminders fehlt")
            val rel = call.getArray("relevant") ?: JSONArray()
            val list = (0 until arr.length()).map { ReminderScheduler.entryFromJson(arr.getJSONObject(it)) }
            val revisions = call.getObject("revisions") ?: JSObject()
            val revisionMap = revisions.keys().asSequence().associateWith { revisions.getString(it) }
            ReminderScheduler.sync(context, list, (0 until rel.length()).map { rel.getString(it) }.toSet(), revisionMap, call.getObject("policy") ?: JSObject(), call.getObject("ruleSnapshot") ?: JSObject())
            call.resolve()
        } catch (e: Exception) {
            call.reject("Erinnerungen konnten nicht geplant werden: ${e.javaClass.simpleName}")
        }
    }

    @PluginMethod
    fun drainReminderActions(call: PluginCall) {
        val o = JSObject()
        o.put("actions", JSONArray(ReminderScheduler.drainActions(context)))
        call.resolve(o)
    }

    @PluginMethod
    fun ackReminderActions(call: PluginCall) {
        val ids = call.getArray("ids") ?: return call.reject("ids fehlt")
        ReminderScheduler.acknowledgeActions(context, (0 until ids.length()).map { ids.getString(it) }.toSet())
        call.resolve()
    }

    @PluginMethod
    fun setReminderFocus(call: PluginCall) {
        ReminderScheduler.setFocus(context, call.getLong("until") ?: 0)
        call.resolve()
    }

    // ---------- Druck ----------

    /** Öffnet den Android-Druckdialog (dort ist „Als PDF speichern“ wählbar) für die aktuelle Seite. */
    @PluginMethod
    fun printPage(call: PluginCall) {
        val name = call.getString("jobName") ?: "Anker"
        val a4 = call.getString("size") == "A4"
        activity.runOnUiThread {
            try {
                val pm = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
                val adapter = bridge.webView.createPrintDocumentAdapter(name)
                val attrs = PrintAttributes.Builder()
                    .setMediaSize(if (a4) PrintAttributes.MediaSize.ISO_A4 else PrintAttributes.MediaSize.ISO_A5)
                    .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                    .build()
                pm.print(name, adapter, attrs)
                ok(call, "opened" to true)
            } catch (e: Exception) {
                ok(call, "opened" to false)
            }
        }
    }

    // ---------- Fokus-Puls ----------

    /** Kurze Doppel-Vibration, nur auf ausdrücklichen Aufruf der geöffneten Fokus-Seite. */
    @PluginMethod
    fun vibratePulse(call: PluginCall) {
        val strong = call.getString("strength") == "strong"
        val v = if (Build.VERSION.SDK_INT >= 31) {
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
        val on = if (strong) 140L else 60L
        v?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, on, 120, on), -1))
        call.resolve()
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
    fun openExactAlarmSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 31) {
            open(call, Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
        } else {
            open(call, appSettingsIntent())
        }
    }

    @PluginMethod
    fun openAlarmChannelSettings(call: PluginCall) {
        AlarmService.ensureChannel(context)
        open(
            call,
            Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                .putExtra(Settings.EXTRA_CHANNEL_ID, AlarmService.CHANNEL),
        )
    }

    @PluginMethod
    fun openFocusSettings(call: PluginCall) {
        open(call, Intent("android.settings.ZEN_MODE_SETTINGS"), Intent(Settings.ACTION_SETTINGS))
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
