package de.frnkrm.anker

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.hardware.display.DisplayManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.os.UserManager
import android.provider.Settings
import android.view.Display
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/** A bounded local technical journal. Disk writes never block the critical alarm/audio thread. */
object NativeDiagnosticJournal {
    private val dropped = AtomicLong()
    private val pendingRecords = AtomicLong()
    private val writer = ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS, ArrayBlockingQueue(64),
        { task -> Thread(task, "anker-diagnostics").apply { isDaemon = true } }, ThreadPoolExecutor.AbortPolicy())

    fun record(ctx: Context, category: String, code: String, details: Map<String, Any> = emptyMap()) {
        if (!NativeDiagnosticModel.valid(category, code)) return
        val at = System.currentTimeMillis()
        val elapsed = SystemClock.elapsedRealtime()
        val facts = NativeDiagnosticModel.details(details)
        val context = ctx.applicationContext
        pendingRecords.incrementAndGet()
        try { writer.execute {
            try {
                val old = stored(context)
                val events = entries(old)
                val next = old.optLong("lastSeq") + 1
                val row = NativeDiagnosticEntry(next, at, elapsed, category, code,
                    NativeDiagnosticModel.details(systemSnapshot(context) + facts))
                val retained = NativeDiagnosticModel.append(events, row, System.currentTimeMillis())
                if (retained == events) return@execute
                val appended = retained.lastOrNull()?.seq == next
                val out = JSONObject().put("lastSeq", if (appended) next else old.optLong("lastSeq")).put("events", JSONArray(retained.map(::json)))
                if (!AnkerPrefs.setDiagnosticJournal(context, out.toString())) dropped.incrementAndGet()
            } catch (_: Exception) { dropped.incrementAndGet() }
            finally { pendingRecords.decrementAndGet() }
        } } catch (_: Exception) { pendingRecords.decrementAndGet(); dropped.incrementAndGet() }
    }

    /** Call on the plugin's background executor. A bounded drain makes export include earlier queued facts. */
    fun snapshot(ctx: Context): JSONObject {
        try { writer.submit {
            try {
                val old = stored(ctx); val existing = entries(old)
                val retained = NativeDiagnosticModel.retain(existing, System.currentTimeMillis())
                if (retained != existing && !AnkerPrefs.setDiagnosticJournal(ctx, JSONObject().put("lastSeq", old.optLong("lastSeq")).put("events", JSONArray(retained.map(::json))).toString())) dropped.incrementAndGet()
            } catch (_: Exception) { dropped.incrementAndGet() }
        }.get(2, TimeUnit.SECONDS) } catch (_: Exception) { }
        return try {
            JSONObject().put("version", NativeDiagnosticModel.VERSION).put("retentionDays", NativeDiagnosticModel.RETENTION_DAYS)
                .put("maxEntries", NativeDiagnosticModel.MAX_ENTRIES).put("droppedEvents", dropped.get()).put("pendingEvents", pendingRecords.get())
                .put("events", JSONArray(NativeDiagnosticModel.retain(entries(stored(ctx)), System.currentTimeMillis()).map(::json)))
        } catch (_: Exception) {
            JSONObject().put("version", 1).put("retentionDays", 7).put("maxEntries", 800).put("droppedEvents", dropped.get()).put("pendingEvents", pendingRecords.get()).put("events", JSONArray())
        }
    }

    fun clear(ctx: Context): Boolean = try {
        writer.submit<Boolean> {
            try {
                val previous = stored(ctx)
                val cleared = AnkerPrefs.setDiagnosticJournal(ctx, JSONObject().put("lastSeq", previous.optLong("lastSeq")).put("events", JSONArray()).toString())
                if (cleared) dropped.set(0)
                cleared
            } catch (_: Exception) { false }
        }.get(2, TimeUnit.SECONDS)
    } catch (_: Exception) { false }

    private fun stored(ctx: Context): JSONObject = try { JSONObject(AnkerPrefs.diagnosticJournal(ctx)) } catch (_: Exception) { JSONObject() }
    private fun entries(value: JSONObject): List<NativeDiagnosticEntry> {
        val list = value.optJSONArray("events") ?: return emptyList()
        return (0 until list.length()).mapNotNull { index -> try {
            val row = list.getJSONObject(index)
            val category = row.getString("category"); val code = row.getString("code")
            if (!NativeDiagnosticModel.valid(category, code)) return@mapNotNull null
            val facts = row.optJSONObject("details") ?: JSONObject()
            val decoded = facts.keys().asSequence().associateWith { key ->
                if (key == "outputTypes") facts.optJSONArray(key)?.let { a -> (0 until a.length()).map(a::getInt) } ?: emptyList<Int>() else facts.get(key)
            }
            NativeDiagnosticEntry(row.getLong("seq"), row.getLong("at"), row.getLong("elapsedMs"), category, code, NativeDiagnosticModel.details(decoded))
        } catch (_: Exception) { null } }
    }
    private fun json(row: NativeDiagnosticEntry): JSONObject = JSONObject().put("seq", row.seq).put("at", row.at).put("elapsedMs", row.elapsedMs)
        .put("category", row.category).put("code", row.code).put("details", JSONObject(row.details))

    private fun systemSnapshot(ctx: Context): Map<String, Any> {
        val result = mutableMapOf<String, Any>("observedAt" to System.currentTimeMillis(), "sdk" to Build.VERSION.SDK_INT)
        fun read(block: () -> Unit) { try { block() } catch (_: Exception) { } }
        read { val audio = ctx.getSystemService(AudioManager::class.java)
            result["alarmVolume"] = audio.getStreamVolume(AudioManager.STREAM_ALARM)
            result["alarmVolumeMax"] = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            result["alarmMuted"] = audio.isStreamMute(AudioManager.STREAM_ALARM)
            val types = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { it.type }.distinct().take(32)
            result["outputTypes"] = types
            result["bluetooth"] = types.any { it in setOf(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_BLE_SPEAKER) }
            result["wired"] = types.any { it in setOf(AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_USB_HEADSET) }
        }
        read { val power = ctx.getSystemService(PowerManager::class.java)
            result["interactive"] = power.isInteractive; result["powerSave"] = power.isPowerSaveMode
            result["batteryIgnored"] = power.isIgnoringBatteryOptimizations(ctx.packageName) }
        read { result["keyguardLocked"] = ctx.getSystemService(KeyguardManager::class.java).isKeyguardLocked }
        read { result["userUnlocked"] = ctx.getSystemService(UserManager::class.java).isUserUnlocked }
        read { result["displayState"] = ctx.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)?.state ?: Display.STATE_UNKNOWN }
        read { val notifications = ctx.getSystemService(NotificationManager::class.java)
            result["notificationsEnabled"] = NotificationManagerCompat.from(ctx).areNotificationsEnabled()
            result["interruptionFilter"] = notifications.currentInterruptionFilter
            result["channelImportance"] = notifications.getNotificationChannel(AlarmService.CHANNEL)?.importance ?: -1
            result["fullScreenAllowed"] = Build.VERSION.SDK_INT < 34 || notifications.canUseFullScreenIntent() }
        read { result["exactAllowed"] = AlarmController.canExact(ctx) }
        read { result["overlayAllowed"] = Settings.canDrawOverlays(ctx) }
        return result
    }
}
