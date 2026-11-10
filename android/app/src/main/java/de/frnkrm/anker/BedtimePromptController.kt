package de.frnkrm.anker

import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.Display
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSObject
import org.json.JSONObject
import java.util.UUID

/** Ein Besitzer, eigene Credential-Prefs, begrenztes echtes Overlay. Alle Aufrufe auf dem Mainthread. */
object BedtimePromptController {
    const val ACTION_DUE = "de.frnkrm.anker.BEDTIME_PROMPT_DUE"
    const val ACTION_EXPIRE = "de.frnkrm.anker.BEDTIME_PROMPT_EXPIRE"
    const val ACTION_QUIET_TICK = "de.frnkrm.anker.BEDTIME_QUIET_TICK"
    const val ACTION_QUIET_SNOOZE = "de.frnkrm.anker.BEDTIME_QUIET_SNOOZE"
    const val ACTION_QUIET_STOP = "de.frnkrm.anker.BEDTIME_QUIET_STOP"
    const val ACTION_QUIET_DISMISS = "de.frnkrm.anker.BEDTIME_QUIET_DISMISS"
    const val QUIET_NOTIFICATION_ID = 7412
    private const val QUIET_CHANNEL = "bedtime-quiet-v1"
    private const val PREFS = "anker_bedtime_prompt"
    private val handler = Handler(Looper.getMainLooper())
    // Session cleanup must never discard a newer settings/source handoff queued on Main.
    private val entryHandler = Handler(Looper.getMainLooper())
    private var card: View? = null
    private var windowManager: WindowManager? = null
    private var screenReceiver: BroadcastReceiver? = null
    private var receiverContext: Context? = null
    @Volatile private var appForeground = false

    private data class ScreenFacts(val interactive: Boolean, val displayState: Int) {
        val visible get() = BedtimePromptModel.screenVisible(interactive, displayState)
    }

    private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun boot(ctx: Context) = Settings.Global.getInt(ctx.contentResolver, Settings.Global.BOOT_COUNT, -1)
    private fun screen(ctx: Context): ScreenFacts {
        val interactive = try { ctx.getSystemService(PowerManager::class.java)?.isInteractive == true } catch (_: Exception) { false }
        // Der Default-Bildschirm ist das Handy, kein eingeschalteter DeX-/externer Monitor.
        val display = try { ctx.getSystemService(DisplayManager::class.java)?.getDisplay(Display.DEFAULT_DISPLAY)?.state ?: Display.STATE_UNKNOWN }
            catch (_: Exception) { Display.STATE_UNKNOWN }
        return ScreenFacts(interactive, display)
    }
    private fun unlocked(ctx: Context): Boolean = ctx.getSystemService(KeyguardManager::class.java)?.let { !it.isKeyguardLocked && !it.isDeviceLocked } == true
    private fun permitted(ctx: Context) = Settings.canDrawOverlays(ctx)
    private fun alarmActive(ctx: Context) = AnkerPrefs.isRinging(ctx)
    private fun active(s: BedtimePromptState) = s.phase == BedtimePromptPhase.WAITING || s.phase == BedtimePromptPhase.SHOWN

    /** Also called under ReminderScheduler's lock: no preferences, handlers or controller lock here. */
    fun hasQuietNotification(ctx: Context): Boolean = try {
        ctx.getSystemService(NotificationManager::class.java)?.activeNotifications?.any { it.id == QUIET_NOTIFICATION_ID } == true
    } catch (_: Exception) { false }

    private fun record(ctx: Context, code: String, s: BedtimePromptState, details: Map<String, Any> = emptyMap()) {
        try {
            val observed = screen(ctx)
            val values = mutableMapOf<String, Any>("interactive" to observed.interactive, "displayState" to observed.displayState,
                "overlayAllowed" to permitted(ctx), "foreground" to appForeground,
                "attached" to (card?.isAttachedToWindow == true))
            if (s.dueAt > 0) values["targetAt"] = s.dueAt
            if (s.dueElapsed > 0) values["driftMs"] = (SystemClock.elapsedRealtime() - s.dueElapsed).coerceAtLeast(0)
            values.putAll(details)
            NativeDiagnosticJournal.record(ctx, "bedtime", code, values)
        } catch (_: Exception) { /* Eine Diagnose darf weder Schlafhinweis noch Wecker verhindern. */ }
    }

    private fun read(ctx: Context): BedtimePromptState = try {
        val p = prefs(ctx)
        BedtimePromptState(p.getString("id", "") ?: "", BedtimePromptPhase.of(p.getString("phase", "") ?: ""),
            p.getLong("started", 0), p.getLong("due", 0), p.getLong("dueAt", 0), p.getInt("boot", -1),
            p.getBoolean("exact", false), p.getLong("visibleUntil", 0), p.getString("reason", "") ?: "",
            p.getBoolean("wakeup", false), p.getBoolean("allowWhileIdle", false),
            BedtimePromptForeground.of(p.getString("foregroundStatus", "") ?: ""),
            p.getInt("foregroundAttempts", 0).coerceIn(0, 1000), p.getLong("foregroundRequestedElapsed", 0),
            p.getBoolean("followUps", false), p.getLong("quietDueElapsed", 0), p.getLong("quietDueAt", 0),
            p.getLong("quietUntilElapsed", 0), p.getLong("quietUntilAt", 0), p.getBoolean("quietVisible", false), p.getString("quietToken", "") ?: "",
            p.getString("sourceDate", "")?.takeIf { it.isNotEmpty() }?.let {
                BedtimeQuietSource(it, p.getString("sourceKey", "") ?: "", p.getString("sourceRevision", "") ?: "",
                    p.getString("sourceToken", "") ?: "", p.getLong("sourceAt", 0))
            })
    } catch (_: Exception) { BedtimePromptState() }

    private fun save(ctx: Context, s: BedtimePromptState, restDate: String? = null, explicitStart: Boolean = false) {
        val editor = prefs(ctx).edit().putString("id", s.sessionId).putString("phase", s.phase.wire)
            .putLong("started", s.startedElapsed).putLong("due", s.dueElapsed).putLong("dueAt", s.dueAt)
            .putInt("boot", s.bootCount).putBoolean("exact", s.exact).putLong("visibleUntil", s.visibleUntilElapsed)
            .putBoolean("wakeup", s.wakeup).putBoolean("allowWhileIdle", s.allowWhileIdle)
            .putString("foregroundStatus", s.foreground.wire).putInt("foregroundAttempts", s.foregroundAttempts)
            .putLong("foregroundRequestedElapsed", s.foregroundRequestedElapsed)
            .putBoolean("followUps", s.followUps).putLong("quietDueElapsed", s.quietDueElapsed).putLong("quietDueAt", s.quietDueAt)
            .putLong("quietUntilElapsed", s.quietUntilElapsed).putLong("quietUntilAt", s.quietUntilAt)
            .putBoolean("quietVisible", s.quietVisible).putString("quietToken", s.quietToken)
            .putString("sourceDate", s.quietSource?.date ?: "").putString("sourceKey", s.quietSource?.key ?: "")
            .putString("sourceRevision", s.quietSource?.revision ?: "").putString("sourceToken", s.quietSource?.token ?: "")
            .putLong("sourceAt", s.quietSource?.at ?: 0)
            .putString("reason", s.reason)
        if (restDate != null) editor.putString("quietRestDate", restDate)
        if (explicitStart) editor.putBoolean("quietEnabled", true).remove("quietRestDate")
        check(editor.commit()) { "Der Schlafhinweis konnte nicht sicher gespeichert werden." }
    }

    private fun json(ctx: Context, s: BedtimePromptState): JSObject = JSObject()
        .put("phase", s.phase.wire).put("overlayPermission", permitted(ctx)).put("exact", s.exact)
        .put("wakeup", s.wakeup).put("allowWhileIdle", s.allowWhileIdle)
        .put("foregroundStatus", s.foreground.wire).put("foregroundAttempts", s.foregroundAttempts)
        .put("overlayAttached", card?.isAttachedToWindow == true).apply {
            val observed = screen(ctx)
            put("screenInteractive", observed.interactive); put("displayState", observed.displayState)
            if (s.sessionId.isNotEmpty()) put("sessionId", s.sessionId)
            if (s.dueAt > 0) put("dueAt", s.dueAt)
            if (s.reason.isNotEmpty()) put("reason", s.reason)
            if (s.phase == BedtimePromptPhase.QUIET) {
                put("quietDueAt", s.quietDueAt); put("quietUntilAt", s.quietUntilAt)
                put("quietVisible", s.quietVisible && hasQuietNotification(ctx))
                put("quietReady", quietSourceAllowed(ctx, s) && BedtimePromptModel.quietReady(s, SystemClock.elapsedRealtime(), boot(ctx),
                    System.currentTimeMillis(), observed.interactive, observed.displayState, unlocked(ctx), alarmActive(ctx)))
            }
        }

    private fun publish(ctx: Context, s: BedtimePromptState) { AnkerNativePlugin.notifyBedtimePromptChanged(json(ctx, s)) }

    private fun quietRevisions(ctx: Context): Map<String, String> = try {
        val value = JSONObject(prefs(ctx).getString("quietSourceRevisions", "{}") ?: "{}")
        value.keys().asSequence().associateWith { value.getString(it) }
    } catch (_: Exception) { emptyMap() }

    private fun quietSourceAllowed(ctx: Context, s: BedtimePromptState): Boolean =
        prefs(ctx).getBoolean("quietEnabled", false) &&
            (s.quietSource?.let { BedtimePromptModel.currentQuietSource(it, quietRevisions(ctx)) && prefs(ctx).getString("quietRestDate", "") != it.date } ?: true)

    /** The reminder worker never mutates this credential-protected session off Main. */
    fun configureQuietFollowUps(ctx: Context, enabled: Boolean) {
        val app = ctx.applicationContext
        entryHandler.post { try {
            check(prefs(app).edit().putBoolean("quietEnabled", enabled).commit())
            val before = read(app)
            if (!enabled && before.followUps) {
                val next = if (before.phase == BedtimePromptPhase.QUIET) BedtimePromptModel.stop(before)
                    else before.copy(followUps = false, quietVisible = false, quietToken = "")
                save(app, next); cancelQuietNotification(app)
                if (before.phase == BedtimePromptPhase.QUIET) cleanup(app, before)
                publish(app, next)
            }
        } catch (_: Exception) { /* No false completion or alarm side effect. */ } }
    }

    fun reconcileQuietSource(ctx: Context, validBedRevisions: Map<String, String>) {
        val app = ctx.applicationContext
        val selected = validBedRevisions.filter { (key, value) -> key.endsWith("|bed") && key.length <= 64 && value.isNotBlank() }.toMap()
        entryHandler.post { try {
            check(prefs(app).edit().putString("quietSourceRevisions", JSONObject(selected).toString()).commit())
            val before = read(app)
            if (before.phase == BedtimePromptPhase.QUIET && !quietSourceAllowed(app, before)) {
                val next = BedtimePromptModel.stop(before); save(app, next); cleanup(app, before); publish(app, next)
            }
        } catch (_: Exception) { /* Keep the last durable source; never invent acceptance. */ } }
    }

    /** True only after durable handoff or an intentional rejection; false remains retryable at the source. */
    fun startQuietFromReminder(ctx: Context, date: String, key: String, revision: String, token: String,
                               dueAt: Long, delayMinutes: Int, completion: (Boolean) -> Unit = {}) {
        val app = ctx.applicationContext
        val source = BedtimeQuietSource(date, key, revision, token, dueAt)
        entryHandler.post {
            var accepted = false
            try {
                val old = read(app)
                val disposition = BedtimePromptModel.quietSourceAction(old, source, quietRevisions(app),
                    prefs(app).getBoolean("quietEnabled", false), prefs(app).getString("quietRestDate", "") ?: "")
                if (disposition == BedtimeQuietSourceAction.REJECT) {
                    record(app, "quiet_source_rejected", old, mapOf("reasonCode" to if (!prefs(app).getBoolean("quietEnabled", false)) "quiet-disabled" else "stale-session"))
                    accepted = true
                } else if (disposition == BedtimeQuietSourceAction.REUSE) {
                    // A changed delivery UUID never resurrects Today quiet or an expired source.
                    if (old.phase == BedtimePromptPhase.QUIET) { watchScreen(app); checkQuiet(app, old.sessionId, BedtimeQuietTrigger.NON_WAKEUP_CHECK) }
                    accepted = true
                } else {
                    val next = BedtimePromptModel.fromReminder(UUID.randomUUID().toString(), dueAt, delayMinutes,
                        SystemClock.elapsedRealtime(), System.currentTimeMillis(), boot(app)).copy(quietSource = source)
                    cleanup(app, old); save(app, next)
                    if (next.phase == BedtimePromptPhase.QUIET) { watchScreen(app); checkQuiet(app, next.sessionId, BedtimeQuietTrigger.NON_WAKEUP_CHECK) }
                    record(app, "quiet_scheduled", read(app), mapOf("targetAt" to next.quietDueAt))
                    publish(app, read(app)); accepted = true
                }
            } catch (error: Exception) {
                record(app, "session_error", read(app), mapOf("reasonCode" to "storage-failed", "errorClass" to error.javaClass.simpleName))
            } finally { try { completion(accepted) } catch (_: Exception) { } }
        }
    }

    private fun quietRestDate(s: BedtimePromptState): String {
        val local = java.time.Instant.ofEpochMilli(System.currentTimeMillis()).atZone(java.time.ZoneId.of("Europe/Berlin"))
        return s.quietSource?.date ?: (if (local.hour < 4) local.toLocalDate().minusDays(1) else local.toLocalDate()).toString()
    }

    /** Native Klicks/Handler laufen außerhalb eines PluginCall-Tryblocks. Nie den Weckerprozess werfen. */
    private fun asynchronously(ctx: Context, id: String, action: () -> Unit) {
        val before = read(ctx)
        if (before.sessionId != id) return
        try { action() } catch (error: Exception) {
            record(ctx, "session_error", before, mapOf("reasonCode" to "storage-failed", "errorClass" to error.javaClass.simpleName))
            try { cleanup(ctx, before) } catch (_: Exception) { }
            val failed = before.copy(phase = BedtimePromptPhase.ERROR, reason = "storage-failed")
            try { save(ctx, failed); publish(ctx, failed) } catch (_: Exception) { }
        }
    }

    fun state(ctx: Context): JSObject {
        val before = read(ctx)
        var next = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx), System.currentTimeMillis())
        if (next.phase == BedtimePromptPhase.QUIET && !quietSourceAllowed(ctx, next)) next = BedtimePromptModel.stop(next)
        if (active(next) && !permitted(ctx)) next = BedtimePromptModel.skip(next, "permission-revoked")
        if (active(next) && alarmActive(ctx)) next = BedtimePromptModel.skip(next, "alarm-active")
        if (next.phase == BedtimePromptPhase.SHOWN && (!screen(ctx).visible || !unlocked(ctx))) next =
            if (next.followUps) BedtimePromptModel.quiet(next, next.sessionId, SystemClock.elapsedRealtime(), System.currentTimeMillis())
            else BedtimePromptModel.skip(next, if (!screen(ctx).visible) "screen-off" else "locked")
        if (next.phase == BedtimePromptPhase.QUIET && (!screen(ctx).interactive || !screen(ctx).visible || !unlocked(ctx))) {
            next = BedtimePromptModel.hideQuiet(next); cancelQuietNotification(ctx)
        }
        if (next.phase == BedtimePromptPhase.QUIET && next.quietVisible && !hasQuietNotification(ctx)) next = BedtimePromptModel.hideQuiet(next)
        if (next.phase == BedtimePromptPhase.QUIET && alarmActive(ctx)) next = BedtimePromptModel.skip(next, "alarm-active")
        if (next != before) {
            save(ctx, next)
            if (next.phase == BedtimePromptPhase.QUIET) { removeCard(); watchScreen(ctx); scheduleQuiet(ctx, next) }
            else if (next.phase != BedtimePromptPhase.SHOWN) cleanup(ctx, before)
            record(ctx, if (next.foreground == BedtimePromptForeground.UNCONFIRMED && next.phase == BedtimePromptPhase.SHOWN)
                "foreground_unconfirmed" else "session_skipped", next,
                mapOf("reasonCode" to if (next.phase == BedtimePromptPhase.SHOWN) "foreground-unconfirmed" else next.reason))
            publish(ctx, next)
        }
        return json(ctx, next)
    }

    fun start(ctx: Context, minutes: Int, followUps: Boolean = false, quietOnly: Boolean = false): JSObject {
        require(minutes in 0..60) { "Die Einschlafzeit muss zwischen 0 und 60 Minuten liegen." }
        require(!quietOnly || followUps) { "Die stille Begleitung benötigt deine eigene Freigabe." }
        if (!quietOnly) check(permitted(ctx)) { "Erlaube zuerst bewusst das Anzeigen über anderen Apps." }
        check(screen(ctx).visible && unlocked(ctx)) { "Entsperre das Handy, um den Schlafhinweis zu starten." }
        check(!alarmActive(ctx)) { "Während eines Weckers startet kein Schlafhinweis." }
        val old = read(ctx)
        cleanup(ctx, old)
        val manager = ctx.getSystemService(AlarmManager::class.java) ?: error("Die Zeitplanung ist nicht verfügbar.")
        val exact = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()
        var next = BedtimePromptModel.arm(UUID.randomUUID().toString(), minutes, SystemClock.elapsedRealtime(), System.currentTimeMillis(), boot(ctx), if (quietOnly) false else exact, followUps, quietOnly)
        try {
            save(ctx, next, explicitStart = followUps)
            if (quietOnly) {
                watchScreen(ctx); checkQuiet(ctx, next.sessionId, BedtimeQuietTrigger.APP_RESUME)
                record(ctx, "quiet_scheduled", read(ctx)); return json(ctx, read(ctx))
            }
            val alarm = pending(ctx, next.sessionId, ACTION_DUE)
            BedtimePromptDelivery.schedule(exact, next.dueElapsed, object : BedtimePromptDeliveryBackend {
                override fun exactIdleCpuCheck(atElapsed: Long) = manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, atElapsed, alarm)
                override fun inexactIdleCpuCheck(atElapsed: Long) = manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, atElapsed, alarm)
            }) { next = next.copy(exact = false); save(ctx, next) }
        } catch (e: Exception) {
            record(ctx, "schedule_failed", next, mapOf("reasonCode" to "schedule-failed", "errorClass" to e.javaClass.simpleName))
            cleanup(ctx, next)
            val failed = next.copy(phase = BedtimePromptPhase.ERROR, reason = "schedule-failed")
            save(ctx, failed); publish(ctx, failed)
            throw e
        }
        record(ctx, "scheduled", next, buildMap {
            put("exactAllowed", next.exact)
            if (!next.exact) put("reasonCode", "inexact-schedule")
        })
        publish(ctx, next)
        return json(ctx, next)
    }

    fun stop(ctx: Context, id: String?): JSObject {
        val before = read(ctx)
        val next = BedtimePromptModel.stop(before, id)
        if (next != before) {
            save(ctx, next, restDate = if (before.followUps) quietRestDate(before) else null)
            cleanup(ctx, before); record(ctx, if (before.followUps) "quiet_stopped" else "stopped", next, mapOf("reasonCode" to "stopped")); publish(ctx, next)
        }
        return json(ctx, next)
    }

    fun ack(ctx: Context, id: String): JSObject {
        val before = read(ctx)
        val next = when {
            before.phase == BedtimePromptPhase.QUIET -> BedtimePromptModel.snoozeQuiet(before, id, SystemClock.elapsedRealtime(), boot(ctx), System.currentTimeMillis())
            before.followUps -> BedtimePromptModel.quiet(before, id, SystemClock.elapsedRealtime(), System.currentTimeMillis())
            else -> BedtimePromptModel.ack(before, id)
        }
        if (next != before) {
            save(ctx, next)
            if (next.phase == BedtimePromptPhase.QUIET) { removeCard(); cancelQuietNotification(ctx); watchScreen(ctx); scheduleQuiet(ctx, next) }
            else cleanup(ctx, before)
            record(ctx, if (next.phase == BedtimePromptPhase.QUIET) "quiet_snoozed" else "acknowledged", next,
                mapOf("reasonCode" to if (next.phase == BedtimePromptPhase.QUIET) "snoozed" else "acknowledged")); publish(ctx, next)
        }
        return json(ctx, next)
    }

    fun reset(ctx: Context, reason: String) {
        val before = read(ctx)
        val next = if (before.followUps && before.phase == BedtimePromptPhase.SHOWN && reason in setOf("screen-off", "locked"))
            BedtimePromptModel.quiet(before, before.sessionId, SystemClock.elapsedRealtime(), System.currentTimeMillis()) else BedtimePromptModel.skip(before, reason)
        cleanup(ctx, before)
        if (next != before) {
            save(ctx, next)
            if (next.phase == BedtimePromptPhase.QUIET) { watchScreen(ctx); scheduleQuiet(ctx, next) }
            record(ctx, "session_skipped", next, mapOf("reasonCode" to reason)); publish(ctx, next)
        }
    }

    fun onDue(ctx: Context, id: String) {
        val before = read(ctx)
        if (id != before.sessionId || before.phase != BedtimePromptPhase.WAITING) {
            record(ctx, "due_rejected", BedtimePromptState(), mapOf("accepted" to false, "reasonCode" to "stale-session"))
            return
        }
        val observed = screen(ctx)
        record(ctx, "due_received", before, mapOf("interactive" to observed.interactive, "displayState" to observed.displayState))
        var next = BedtimePromptModel.due(before, id, SystemClock.elapsedRealtime(), boot(ctx), observed.interactive, unlocked(ctx), permitted(ctx), alarmActive(ctx), observed.displayState)
        if (before.followUps && next.phase == BedtimePromptPhase.SKIPPED && next.reason in setOf("screen-off", "locked", "permission-revoked"))
            next = BedtimePromptModel.quiet(before, id, SystemClock.elapsedRealtime(), System.currentTimeMillis())
        if (next == before) {
            record(ctx, "due_rejected", before, mapOf("accepted" to false, "reasonCode" to "not-due"))
            return
        }
        try {
            save(ctx, next)
            record(ctx, if (next.phase == BedtimePromptPhase.SHOWN) "due_accepted" else "due_rejected", next,
                mapOf("accepted" to (next.phase == BedtimePromptPhase.SHOWN), "reasonCode" to next.reason))
            if (next.phase == BedtimePromptPhase.SHOWN) show(ctx.applicationContext, next)
            else if (next.phase == BedtimePromptPhase.QUIET) { cleanup(ctx, before); watchScreen(ctx); scheduleQuiet(ctx, next) }
            else cleanup(ctx, before)
            publish(ctx, read(ctx))
        } catch (error: Exception) {
            record(ctx, "session_error", next, mapOf("reasonCode" to "overlay-failed", "errorClass" to error.javaClass.simpleName))
            cleanup(ctx, before)
            val failed = next.copy(phase = BedtimePromptPhase.ERROR, reason = "overlay-failed")
            try { save(ctx, failed); publish(ctx, failed) } catch (_: Exception) { }
        }
    }

    fun expire(ctx: Context, id: String) {
        val before = read(ctx)
        if (before.sessionId != id || before.phase != BedtimePromptPhase.SHOWN) return
        val next = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx), System.currentTimeMillis())
        if (next != before) {
            save(ctx, next); cleanup(ctx, before)
            if (next.phase == BedtimePromptPhase.QUIET) { watchScreen(ctx); scheduleQuiet(ctx, next) }
            record(ctx, "session_skipped", next, mapOf("reasonCode" to "expired")); publish(ctx, next)
        }
    }

    /** Erst eine tatsächlich fortgesetzte Anker-Activity, nicht ein fehlerfreier startActivity-Aufruf. */
    fun onAppResume(ctx: Context) {
        appForeground = true
        state(ctx)
        val before = read(ctx)
        val next = BedtimePromptModel.foregroundConfirmed(before, before.sessionId, SystemClock.elapsedRealtime())
        if (next != before) { save(ctx, next); record(ctx, "foreground_confirmed", next, mapOf("foreground" to true)); publish(ctx, next) }
        if (next.phase == BedtimePromptPhase.SHOWN) removeCard()
        if (next.phase == BedtimePromptPhase.QUIET) checkQuiet(ctx, next.sessionId, BedtimeQuietTrigger.APP_RESUME)
    }

    fun onAppPause(ctx: Context) {
        appForeground = false
        val current = read(ctx)
        if (active(current)) record(ctx, "app_paused", current, mapOf("foreground" to false))
    }

    fun onAlarmStarted() {
        receiverContext?.let { ctx -> entryHandler.post { try { reset(ctx, "alarm-active") } catch (_: Exception) { } } }
    }

    private fun pending(ctx: Context, id: String, action: String, token: String = ""): PendingIntent = PendingIntent.getBroadcast(ctx, 0,
        Intent(ctx, BedtimePromptReceiver::class.java).setAction(action)
            .setData(Uri.Builder().scheme(ctx.packageName).authority("bedtime-prompt").appendPath(id).appendPath(action)
                .apply { if (token.isNotEmpty()) appendPath(token) }.build())
            .putExtra("sessionId", id).putExtra("quietToken", token), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun watchScreen(ctx: Context) {
        if (screenReceiver != null) return
        val app = ctx.applicationContext
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                // Dieser Broadcast beschreibt Interaktivität, nicht zuverlässig den Displayzustand.
                if (intent.action == Intent.ACTION_SCREEN_OFF && read(context).phase == BedtimePromptPhase.SHOWN && !screen(context).visible)
                    try { reset(context, "screen-off") } catch (_: Exception) { }
                if (intent.action == Intent.ACTION_SCREEN_OFF && read(context).phase == BedtimePromptPhase.QUIET) try {
                    val before = read(context); val next = BedtimePromptModel.hideQuiet(before)
                    if (next != before) { save(context, next); publish(context, next) }
                    cancelQuietNotification(context)
                } catch (_: Exception) { }
                if (intent.action == Intent.ACTION_USER_PRESENT) try {
                    val current = read(context)
                    if (current.phase == BedtimePromptPhase.QUIET) checkQuiet(context, current.sessionId, BedtimeQuietTrigger.USER_PRESENT)
                } catch (_: Exception) { }
            }
        }
        ContextCompat.registerReceiver(app, receiver, IntentFilter(Intent.ACTION_SCREEN_OFF).apply { addAction(Intent.ACTION_USER_PRESENT) }, ContextCompat.RECEIVER_NOT_EXPORTED)
        screenReceiver = receiver; receiverContext = app
    }

    private fun cleanup(ctx: Context, s: BedtimePromptState) {
        if (s.sessionId.isNotEmpty()) {
            val manager = ctx.getSystemService(AlarmManager::class.java)
            for (action in listOf(ACTION_DUE, ACTION_EXPIRE, ACTION_QUIET_TICK)) try { manager?.cancel(pending(ctx, s.sessionId, action)) } catch (_: Exception) { }
        }
        cancelQuietNotification(ctx)
        handler.removeCallbacksAndMessages(null)
        removeCard()
        screenReceiver?.let { try { receiverContext?.unregisterReceiver(it) } catch (_: Exception) { } }
        screenReceiver = null; receiverContext = null
    }

    private fun removeCard() {
        handler.removeCallbacksAndMessages(null)
        card?.let { try { windowManager?.removeViewImmediate(it) } catch (_: Exception) { } }
        card = null; windowManager = null
    }

    private fun cancelQuietNotification(ctx: Context) {
        try { ctx.getSystemService(NotificationManager::class.java)?.cancel(QUIET_NOTIFICATION_ID) } catch (_: Exception) { }
    }

    private fun scheduleQuiet(ctx: Context, s: BedtimePromptState) {
        val next = BedtimePromptDelivery.nextQuietCheck(s, SystemClock.elapsedRealtime()) ?: return
        val manager = ctx.getSystemService(AlarmManager::class.java) ?: error("Die stille Zeitplanung ist nicht verfügbar.")
        // No WAKEUP, exact, allowWhileIdle, wake lock or activity fallback in this path.
        manager.set(AlarmManager.ELAPSED_REALTIME, next, pending(ctx, s.sessionId, ACTION_QUIET_TICK))
    }

    fun onQuietTick(ctx: Context, id: String) {
        asynchronously(ctx, id) { checkQuiet(ctx, id, BedtimeQuietTrigger.NON_WAKEUP_CHECK) }
    }

    private fun checkQuiet(ctx: Context, id: String, trigger: BedtimeQuietTrigger) {
        val before = read(ctx)
        if (before.sessionId != id || before.phase != BedtimePromptPhase.QUIET) return
        val elapsed = SystemClock.elapsedRealtime(); val wall = System.currentTimeMillis()
        var next = BedtimePromptModel.reconcile(before, elapsed, boot(ctx), wall)
        if (next.phase == BedtimePromptPhase.QUIET && !quietSourceAllowed(ctx, next)) next = BedtimePromptModel.stop(next)
        if (next.phase == BedtimePromptPhase.QUIET && alarmActive(ctx)) next = BedtimePromptModel.skip(next, "alarm-active")
        if (next.phase != BedtimePromptPhase.QUIET) {
            save(ctx, next); cleanup(ctx, before)
            record(ctx, "quiet_expired", next, mapOf("reasonCode" to if (next.reason == "alarm-active") "alarm-active" else "quiet-finished"))
            publish(ctx, next); return
        }
        val observed = screen(ctx); val isUnlocked = unlocked(ctx)
        if (!observed.interactive || !observed.visible || !isUnlocked) next = BedtimePromptModel.hideQuiet(next)
        if (next.quietVisible && !hasQuietNotification(ctx)) next = BedtimePromptModel.hideQuiet(next)
        next = BedtimePromptModel.presentQuiet(next, elapsed, boot(ctx), wall, trigger, observed.interactive,
            isUnlocked, alarmActive(ctx), observed.displayState, UUID.randomUUID().toString())
        if (next.quietVisible && elapsed >= next.quietDueElapsed) {
            // Reserve the new action identity durably without claiming it was posted.
            val pending = next.copy(quietVisible = false)
            save(ctx, pending)
            val posted = postQuietNotification(ctx, next)
            next = if (posted) next else BedtimePromptModel.hideQuiet(next)
            try { save(ctx, next) } catch (error: Exception) { cancelQuietNotification(ctx); throw error }
            if (!posted) cancelQuietNotification(ctx)
        }
        else {
            if (next != before) save(ctx, next)
            cancelQuietNotification(ctx)
            record(ctx, "quiet_deferred", next, mapOf("reasonCode" to when {
                !observed.interactive || !observed.visible -> "screen-off"
                !isUnlocked -> "locked"
                else -> "not-due"
            }))
        }
        scheduleQuiet(ctx, next)
        publish(ctx, next) // time-dependent inline eligibility may change without a persisted phase change
    }

    /** The callback is run under the existing slot owner's lock, without replacing any normal card. */
    private fun postQuietNotification(ctx: Context, s: BedtimePromptState): Boolean {
        val manager = ctx.getSystemService(NotificationManager::class.java) ?: return false
        manager.createNotificationChannel(NotificationChannel(QUIET_CHANNEL, "Stille Schlafbegleitung", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Freiwillige, begrenzte Hinweise ohne Ton, Vibration oder Aufwecken des Bildschirms"
            setSound(null, null); enableVibration(false); enableLights(false); setShowBadge(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET
        })
        var rejection = "budget"
        val posted = ReminderScheduler.tryPostQuietBedtime(ctx) {
            val current = read(ctx)
            val observed = screen(ctx)
            val channel = manager.getNotificationChannel(QUIET_CHANNEL)
            val allowed = channel != null && quietSourceAllowed(ctx, current) && BedtimePromptDelivery.canPostQuiet(current,
                s.sessionId, s.quietToken, SystemClock.elapsedRealtime(), boot(ctx), System.currentTimeMillis(),
                observed.interactive, observed.displayState, unlocked(ctx), alarmActive(ctx), manager.areNotificationsEnabled(),
                channel.importance, channel.sound != null, channel.shouldVibrate(), channel.shouldShowLights())
            if (!allowed) {
                cancelQuietNotification(ctx)
                rejection = when {
                    SystemClock.elapsedRealtime() >= current.quietUntilElapsed || System.currentTimeMillis() >= current.quietUntilAt -> "quiet-finished"
                    current.sessionId != s.sessionId || current.quietToken != s.quietToken -> "stale-session"
                    !quietSourceAllowed(ctx, current) -> "quiet-disabled"
                    alarmActive(ctx) -> "alarm-active"
                    !observed.interactive || !observed.visible -> "screen-off"
                    !unlocked(ctx) -> "locked"
                    else -> "channel-blocked"
                }
                false
            } else {
                val open = PendingIntent.getActivity(ctx, QUIET_NOTIFICATION_ID,
                    Intent(ctx, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse("${ctx.packageName}://now"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val remaining = (current.quietUntilElapsed - SystemClock.elapsedRealtime()).coerceAtLeast(1)
                val notification = NotificationCompat.Builder(ctx, QUIET_CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Anker · Stille Schlafbegleitung")
                    .setContentText("Wenn du noch am Handy bist: Vielleicht passt jetzt eine Pause fürs Schlafen.")
                    .setStyle(NotificationCompat.BigTextStyle().bigText("Wenn du noch am Handy bist: Vielleicht passt jetzt eine Pause fürs Schlafen. Du entscheidest, wie es weitergeht."))
                    .setContentIntent(open).setVisibility(NotificationCompat.VISIBILITY_SECRET)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER).setPriority(NotificationCompat.PRIORITY_LOW)
                    .setSilent(true).setSound(null).setVibrate(longArrayOf()).setLights(0, 0, 0).setDefaults(0)
                    .setOnlyAlertOnce(true).setOngoing(true).setAutoCancel(false).setShowWhen(false).setLocalOnly(true)
                    .setTimeoutAfter(remaining)
                    .setDeleteIntent(pending(ctx, s.sessionId, ACTION_QUIET_DISMISS, s.quietToken))
                    .addAction(0, "5 Min später", pending(ctx, s.sessionId, ACTION_QUIET_SNOOZE, s.quietToken))
                    .addAction(0, "Heute Ruhe", pending(ctx, s.sessionId, ACTION_QUIET_STOP, s.quietToken)).build()
                try {
                    manager.notify(QUIET_NOTIFICATION_ID, notification)
                    record(ctx, "quiet_posted", current, mapOf("remainingMs" to remaining, "reasonCode" to "normal"))
                    true
                } catch (_: Exception) { rejection = "channel-blocked"; false }
            }
        }
        if (!posted) record(ctx, "quiet_deferred", s, mapOf("reasonCode" to if (alarmActive(ctx)) "alarm-active" else rejection))
        return posted
    }

    fun onQuietAction(ctx: Context, id: String, token: String, stop: Boolean) {
        asynchronously(ctx, id) {
            val before = read(ctx)
            val checked = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx), System.currentTimeMillis())
            if (checked != before) { save(ctx, checked); cleanup(ctx, before); publish(ctx, checked); return@asynchronously }
            if (before.phase != BedtimePromptPhase.QUIET || !before.quietVisible || before.quietToken != token || token.isBlank()) {
                record(ctx, "quiet_source_rejected", before, mapOf("reasonCode" to "stale-session")); return@asynchronously
            }
            val next = if (stop) BedtimePromptModel.stopQuiet(before, id, token)
                else BedtimePromptModel.snoozeQuiet(before, id, SystemClock.elapsedRealtime(), boot(ctx), System.currentTimeMillis(), token)
            if (next != before) {
                save(ctx, next, restDate = if (stop) quietRestDate(before) else null); cancelQuietNotification(ctx)
                if (next.phase == BedtimePromptPhase.QUIET) scheduleQuiet(ctx, next) else cleanup(ctx, before)
                record(ctx, if (stop) "quiet_stopped" else "quiet_snoozed", next,
                    mapOf("reasonCode" to if (stop) "stopped" else "snoozed")); publish(ctx, next)
            }
        }
    }

    private fun show(ctx: Context, s: BedtimePromptState) {
        check(permitted(ctx) && screen(ctx).visible && unlocked(ctx) && !alarmActive(ctx))
        val manager = ctx.getSystemService(WindowManager::class.java) ?: error("Kein Fenster verfügbar")
        val density = ctx.resources.displayMetrics.density
        fun dp(n: Int) = (n * density).toInt()
        val panel = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(12))
            background = GradientDrawable().apply { setColor(Color.rgb(31, 37, 46)); cornerRadius = dp(18).toFloat() }
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
        fun text(value: String, size: Float) = TextView(ctx).apply { text = value; textSize = size; setTextColor(Color.rgb(236, 238, 242)); setPadding(0, 0, 0, dp(10)) }
        panel.addView(text("Anker · Schlafhinweis", 18f))
        panel.addView(text("Deine Einschlafzeit ist um. Wenn es passt, leg das Handy jetzt weg.", 16f))
        val buttons = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        buttons.addView(Button(ctx).apply { text = "Jetzt öffnen"; setOnClickListener { asynchronously(ctx, s.sessionId) { openNow(ctx, s.sessionId, automatic = false) } } })
        buttons.addView(Button(ctx).apply { text = if (s.followUps) "5 Min später" else "Schließen"; setOnClickListener { asynchronously(ctx, s.sessionId) { ack(ctx, s.sessionId) } } })
        if (s.followUps) buttons.addView(Button(ctx).apply { text = "Heute Ruhe"; setOnClickListener { asynchronously(ctx, s.sessionId) { stop(ctx, s.sessionId) } } })
        panel.addView(buttons)
        val width = minOf(dp(360), ctx.resources.displayMetrics.widthPixels - dp(24)).coerceAtLeast(dp(180))
        val layout = WindowManager.LayoutParams(width, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL; y = dp(32); title = "Anker Schlafhinweis" }
        // Kleine touchbare Karte; kein transparentes, vollflächiges Durchreichfenster.
        record(ctx, "overlay_requested", s)
        manager.addView(panel, layout)
        card = panel; windowManager = manager
        record(ctx, "overlay_attached", s, mapOf("attached" to panel.isAttachedToWindow))
        watchScreen(ctx)
        ctx.getSystemService(AlarmManager::class.java)?.set(AlarmManager.ELAPSED_REALTIME, s.visibleUntilElapsed, pending(ctx, s.sessionId, ACTION_EXPIRE))
        // Android 15+ verlangt eine sichtbar gewordene Overlay-UI für die BAL-Ausnahme.
        // Nicht schon nach addView behaupten, dass Anker im Vordergrund ist.
        var drawn = false
        val drawListener = object : ViewTreeObserver.OnDrawListener {
            override fun onDraw() {
                if (drawn) return
                drawn = true
                panel.post {
                    if (panel.viewTreeObserver.isAlive) panel.viewTreeObserver.removeOnDrawListener(this)
                    for (delay in listOf(200L, 1400L)) handler.postDelayed({
                        asynchronously(ctx, s.sessionId) {
                            if (panel.isAttachedToWindow && panel.isShown && card === panel)
                                openNow(ctx, s.sessionId, automatic = true)
                        }
                    }, delay)
                }
            }
        }
        panel.viewTreeObserver.addOnDrawListener(drawListener)
        handler.postDelayed({ asynchronously(ctx, s.sessionId) {
            if (!drawn && card === panel) {
                val current = read(ctx)
                val next = BedtimePromptModel.foregroundUnconfirmed(current, s.sessionId)
                if (next != current) { save(ctx, next); record(ctx, "foreground_unconfirmed", next, mapOf("reasonCode" to "overlay-not-drawn")); publish(ctx, next) }
            }
        } }, 3000)
        handler.post(object : Runnable {
            override fun run() {
                asynchronously(ctx, s.sessionId) {
                val current = read(ctx)
                if (current.phase != BedtimePromptPhase.SHOWN) return@asynchronously
                when {
                    !screen(ctx).visible -> reset(ctx, "screen-off")
                    !unlocked(ctx) -> reset(ctx, "locked")
                    !permitted(ctx) -> reset(ctx, "permission-revoked")
                    alarmActive(ctx) -> reset(ctx, "alarm-active")
                    SystemClock.elapsedRealtime() >= current.visibleUntilElapsed -> expire(ctx, s.sessionId)
                    else -> {
                        val next = BedtimePromptModel.reconcile(current, SystemClock.elapsedRealtime(), boot(ctx))
                        if (next != current) { save(ctx, next); record(ctx, "foreground_unconfirmed", next, mapOf("reasonCode" to "foreground-unconfirmed")); publish(ctx, next) }
                        handler.postDelayed(this, 500)
                    }
                }
                }
            }
        })
    }

    private fun openNow(ctx: Context, id: String, automatic: Boolean) {
        val current = read(ctx)
        if (current.sessionId != id || current.phase != BedtimePromptPhase.SHOWN || !permitted(ctx)
            || !screen(ctx).visible || !unlocked(ctx) || alarmActive(ctx)
            || SystemClock.elapsedRealtime() >= current.visibleUntilElapsed) return
        val requested = BedtimePromptModel.requestForeground(current, id, SystemClock.elapsedRealtime(), automatic)
        if (requested == current) return
        save(ctx, requested)
        record(ctx, "foreground_requested", requested, mapOf("reasonCode" to "foreground-requested", "count" to requested.foregroundAttempts))
        publish(ctx, requested)
        try {
            ctx.startActivity(Intent(ctx, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse("${ctx.packageName}://now"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
            // Wenn Anker bereits fortgesetzt war, gibt es durch SINGLE_TOP nicht zwingend ein neues onResume.
            if (appForeground) onAppResume(ctx)
        } catch (error: Exception) {
            val failed = BedtimePromptModel.foregroundFailed(read(ctx), id)
            save(ctx, failed)
            record(ctx, "foreground_failed", failed, mapOf("reasonCode" to "activity-start-failed", "errorClass" to error.javaClass.simpleName))
            publish(ctx, failed)
            // Expliziter Jetzt-Knopf bleibt als Fallback; keine System- oder Spielschutzsperre umgehen.
        }
    }
}
