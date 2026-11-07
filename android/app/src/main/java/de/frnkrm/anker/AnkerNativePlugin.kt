package de.frnkrm.anker

import android.app.AlarmManager
import android.Manifest
import android.app.NotificationManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
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
@CapacitorPlugin(name = "AnkerNative", permissions = [
    Permission(alias = "smartAudio", strings = [Manifest.permission.RECORD_AUDIO]),
    // Android 12+: genaue und ungefähre Freigabe gemeinsam anfragen. Nur Fine genügt für Geofences.
    Permission(alias = "geofenceForeground", strings = [Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION]),
    Permission(alias = "geofenceBackground", strings = [Manifest.permission.ACCESS_BACKGROUND_LOCATION]),
])
class AnkerNativePlugin : Plugin() {
    private val dictationLease = VoiceRequestLease()
    private val speechLease = VoiceRequestLease()
    @Volatile private var voiceForeground = true
    private val voice by lazy { LocalVoiceController(context) }
    private val alarmTonePreview by lazy { AlarmTonePreview(context) }
    override fun handleOnResume() { super.handleOnResume(); voiceForeground = true }
    override fun handleOnPause() { voiceForeground = false; dictationLease.cancel(); speechLease.cancel(); super.handleOnPause(); activity.runOnUiThread { voice.stopDictation(); voice.stopSpeaking(); alarmTonePreview.stop() } }
    override fun handleOnDestroy() { voiceForeground = false; dictationLease.cancel(); speechLease.cancel(); activity.runOnUiThread { voice.destroy(); alarmTonePreview.stop() }; super.handleOnDestroy() }

    @PluginMethod fun getVoiceCapabilities(call: PluginCall) { activity.runOnUiThread { call.resolve(voice.capabilities()) } }
    @PluginMethod fun startDictation(call: PluginCall) {
        if (!voiceForeground) { ok(call, "status" to "cancelled"); return }
        dictationLease.begin(call.callbackId)
        if (getPermissionState("smartAudio") != PermissionState.GRANTED) requestPermissionForAlias("smartAudio", call, "dictationPermitted")
        else dictationPermitted(call)
    }
    @PermissionCallback private fun dictationPermitted(call: PluginCall) {
        if (!dictationLease.accepts(call.callbackId) || !voiceForeground) { ok(call, "status" to "cancelled"); return }
        if (getPermissionState("smartAudio") != PermissionState.GRANTED) { ok(call, "status" to "permission-denied"); return }
        activity.runOnUiThread {
            if (!voiceForeground || !dictationLease.accepts(call.callbackId)) ok(call, "status" to "cancelled")
            else voice.dictate(activity) { result -> call.resolve(result) }
        }
    }
    @PluginMethod fun stopDictation(call: PluginCall) { dictationLease.cancel(); activity.runOnUiThread { voice.stopDictation(); call.resolve() } }
    @PluginMethod fun speakCue(call: PluginCall) {
        if (!voiceForeground) { ok(call, "status" to "cancelled"); return }
        speechLease.begin(call.callbackId)
        activity.runOnUiThread {
            if (!voiceForeground || !speechLease.accepts(call.callbackId)) ok(call, "status" to "cancelled")
            else voice.speak(call.getString("text") ?: "") { result -> call.resolve(result) }
        }
    }
    @PluginMethod fun stopSpeaking(call: PluginCall) { speechLease.cancel(); activity.runOnUiThread { voice.stopSpeaking(); call.resolve() } }

    // ---------- Freiwillige besuchsbezogene Ankunftshinweise ----------

    @PluginMethod fun syncGeofences(call: PluginCall) {
        GeofenceManager.sync(context, call.data) { result -> call.resolve(result) }
    }

    @PluginMethod fun getGeofenceState(call: PluginCall) { call.resolve(GeofenceManager.state(context)) }

    @PluginMethod fun ackGeofenceSuggestions(call: PluginCall) {
        val ids = call.getArray("ids") ?: JSONArray()
        GeofenceManager.ack(context, (0 until ids.length()).mapNotNull { ids.optString(it).takeIf { id -> id.isNotBlank() } }.toSet())
        call.resolve()
    }

    private fun geofencePermissionState(settingsOpened: Boolean = false): JSObject {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val background = fine && (Build.VERSION.SDK_INT < 29 || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED)
        return JSObject().put("fineGranted", fine).put("backgroundGranted", background).put("settingsOpened", settingsOpened)
    }

    /** Nie vom Abgleich aufgerufen: beide Rechte brauchen eine eigene ausdrückliche Bedienhandlung. */
    @PluginMethod fun requestGeofencePermission(call: PluginCall) {
        when (call.getString("kind")) {
            "foreground" -> {
                if (geofencePermissionState().optBoolean("fineGranted")) call.resolve(geofencePermissionState())
                else requestPermissionForAlias("geofenceForeground", call, "geofencePermissionReturned")
            }
            "background" -> {
                // Die Hintergrundfreigabe wird niemals gemeinsam mit der ersten Standortfreigabe verlangt.
                if (!geofencePermissionState().optBoolean("fineGranted") || Build.VERSION.SDK_INT < 29 || geofencePermissionState().optBoolean("backgroundGranted")) {
                    call.resolve(geofencePermissionState())
                } else if (Build.VERSION.SDK_INT == 29) {
                    requestPermissionForAlias("geofenceBackground", call, "geofencePermissionReturned")
                } else activity.runOnUiThread {
                    var opened = false
                    try { activity.startActivity(appSettingsIntent()); opened = true } catch (_: Exception) { /* Status bleibt ehrlich. */ }
                    call.resolve(geofencePermissionState(opened))
                }
            }
            else -> call.resolve(geofencePermissionState())
        }
    }

    @PermissionCallback private fun geofencePermissionReturned(call: PluginCall) { call.resolve(geofencePermissionState()) }

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
        activity.runOnUiThread {
            ok(call, "ok" to (voiceForeground && alarmTonePreview.play()))
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
        val (rules, rulesFrom) = ReminderScheduler.ruleInfo(ctx)
        o.put("reminderRuleCount", rules)
        o.put("reminderRulesFrom", rulesFrom)
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
            val revisionMap = revisions.keys().asSequence().associateWith { requireNotNull(revisions.getString(it)) { "revision fehlt" } }
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

    /** Druckt nur die gewählten Daten über einen eigenen, vollständig lokalen WebView. */
    @PluginMethod
    fun printPage(call: PluginCall) {
        val name = call.getString("jobName") ?: "Anker"
        try {
            val sheets = PrintRenderer.readSheets(call.getArray("sheets") ?: throw IllegalArgumentException("Missing sheets"))
            val paper = PrintPaper.of(call.getString("size"))
            val fontScale = (call.getDouble("fontScale") ?: 1.0).toFloat().also { require(it.isFinite()) }
            activity.runOnUiThread { PrintRenderer.openDialog(activity, name, sheets, paper, fontScale) { opened -> ok(call, "opened" to opened) } }
        } catch (_: Exception) { call.reject("Die Druckauswahl konnte nicht vorbereitet werden. Bitte wähle weniger oder kürzere Schritte und versuche es erneut.") }
    }

    @PluginMethod
    fun exportPrintPdf(call: PluginCall) {
        try {
            val sheets = PrintRenderer.readSheets(call.getArray("sheets") ?: throw IllegalArgumentException("Missing sheets"))
            val paper = PrintPaper.of(call.getString("size"))
            val fontScale = (call.getDouble("fontScale") ?: 1.0).toFloat().also { require(it.isFinite()) }
            execute {
                try {
                    val exported = PrintRenderer.exportPdf(context, sheets, paper, fontScale)
                    call.resolve(JSObject().apply { put("uri", Uri.fromFile(exported.file).toString()); put("pages", exported.pages) })
                } catch (_: Exception) { call.reject("Die PDF-Datei konnte nicht erstellt werden. Es wurde nichts geteilt oder gedruckt.") }
            }
        } catch (_: Exception) { call.reject("Die PDF-Auswahl konnte nicht vorbereitet werden. Bitte wähle weniger oder kürzere Schritte und versuche es erneut.") }
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
        try { activity.startActivity(Intent("android.settings.ZEN_MODE_SETTINGS")); ok(call, "opened" to true, "destination" to "dnd") }
        catch (_: Exception) {
            try { activity.startActivity(Intent(Settings.ACTION_SETTINGS)); ok(call, "opened" to true, "destination" to "settings") }
            catch (_: Exception) { ok(call, "opened" to false, "destination" to "unavailable") }
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
        if (!AnkerPrefs.setWidgetEntries(context, entries.toString(), call.getLong("generatedAt") ?: 0L, call.getLong("expiresAt") ?: 0L)) { call.reject("Widgetstand konnte nicht gespeichert werden."); return }
        AnkerWidget.refreshAll(context)
        call.resolve()
    }

    @PluginMethod
    fun isWidgetPlaced(call: PluginCall) {
        val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, AnkerWidget::class.java))
        ok(call, "placed" to ids.isNotEmpty())
    }
}
