package de.frnkrm.anker

import android.app.AlarmManager
import android.app.KeyguardManager
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
import com.getcapacitor.JSObject
import java.util.UUID

/** Ein Besitzer, eigene Credential-Prefs, begrenztes echtes Overlay. Alle Aufrufe auf dem Mainthread. */
object BedtimePromptController {
    const val ACTION_DUE = "de.frnkrm.anker.BEDTIME_PROMPT_DUE"
    const val ACTION_EXPIRE = "de.frnkrm.anker.BEDTIME_PROMPT_EXPIRE"
    private const val PREFS = "anker_bedtime_prompt"
    private val handler = Handler(Looper.getMainLooper())
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
            p.getInt("foregroundAttempts", 0).coerceIn(0, 1000), p.getLong("foregroundRequestedElapsed", 0))
    } catch (_: Exception) { BedtimePromptState() }

    private fun save(ctx: Context, s: BedtimePromptState) {
        check(prefs(ctx).edit().putString("id", s.sessionId).putString("phase", s.phase.wire)
            .putLong("started", s.startedElapsed).putLong("due", s.dueElapsed).putLong("dueAt", s.dueAt)
            .putInt("boot", s.bootCount).putBoolean("exact", s.exact).putLong("visibleUntil", s.visibleUntilElapsed)
            .putBoolean("wakeup", s.wakeup).putBoolean("allowWhileIdle", s.allowWhileIdle)
            .putString("foregroundStatus", s.foreground.wire).putInt("foregroundAttempts", s.foregroundAttempts)
            .putLong("foregroundRequestedElapsed", s.foregroundRequestedElapsed)
            .putString("reason", s.reason).commit()) { "Der Schlafhinweis konnte nicht sicher gespeichert werden." }
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
        }

    private fun publish(ctx: Context, s: BedtimePromptState) { AnkerNativePlugin.notifyBedtimePromptChanged(json(ctx, s)) }

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
        var next = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx))
        if (active(next) && !permitted(ctx)) next = BedtimePromptModel.skip(next, "permission-revoked")
        if (active(next) && alarmActive(ctx)) next = BedtimePromptModel.skip(next, "alarm-active")
        if (next.phase == BedtimePromptPhase.SHOWN && !screen(ctx).visible) next = BedtimePromptModel.skip(next, "screen-off")
        if (next.phase == BedtimePromptPhase.SHOWN && !unlocked(ctx)) next = BedtimePromptModel.skip(next, "locked")
        if (next != before) {
            save(ctx, next)
            if (next.phase != BedtimePromptPhase.SHOWN) cleanup(ctx, before)
            record(ctx, if (next.foreground == BedtimePromptForeground.UNCONFIRMED && next.phase == BedtimePromptPhase.SHOWN)
                "foreground_unconfirmed" else "session_skipped", next,
                mapOf("reasonCode" to if (next.phase == BedtimePromptPhase.SHOWN) "foreground-unconfirmed" else next.reason))
            publish(ctx, next)
        }
        return json(ctx, next)
    }

    fun start(ctx: Context, minutes: Int): JSObject {
        require(minutes in 0..60) { "Die Einschlafzeit muss zwischen 0 und 60 Minuten liegen." }
        check(permitted(ctx)) { "Erlaube zuerst bewusst das Anzeigen über anderen Apps." }
        check(screen(ctx).visible && unlocked(ctx)) { "Entsperre das Handy, um den Schlafhinweis zu starten." }
        check(!alarmActive(ctx)) { "Während eines Weckers startet kein Schlafhinweis." }
        val old = read(ctx)
        cleanup(ctx, old)
        val manager = ctx.getSystemService(AlarmManager::class.java) ?: error("Die Zeitplanung ist nicht verfügbar.")
        val exact = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()
        var next = BedtimePromptModel.arm(UUID.randomUUID().toString(), minutes, SystemClock.elapsedRealtime(), System.currentTimeMillis(), boot(ctx), exact)
        try {
            save(ctx, next)
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
        if (next != before) { save(ctx, next); cleanup(ctx, before); record(ctx, "stopped", next, mapOf("reasonCode" to "stopped")); publish(ctx, next) }
        return json(ctx, next)
    }

    fun ack(ctx: Context, id: String): JSObject {
        val before = read(ctx)
        val next = BedtimePromptModel.ack(before, id)
        if (next != before) { save(ctx, next); cleanup(ctx, before); record(ctx, "acknowledged", next, mapOf("reasonCode" to "acknowledged")); publish(ctx, next) }
        return json(ctx, next)
    }

    fun reset(ctx: Context, reason: String) {
        val before = read(ctx)
        val next = BedtimePromptModel.skip(before, reason)
        cleanup(ctx, before)
        if (next != before) { save(ctx, next); record(ctx, "session_skipped", next, mapOf("reasonCode" to next.reason)); publish(ctx, next) }
    }

    fun onDue(ctx: Context, id: String) {
        val before = read(ctx)
        if (id != before.sessionId || before.phase != BedtimePromptPhase.WAITING) {
            record(ctx, "due_rejected", BedtimePromptState(), mapOf("accepted" to false, "reasonCode" to "stale-session"))
            return
        }
        val observed = screen(ctx)
        record(ctx, "due_received", before, mapOf("interactive" to observed.interactive, "displayState" to observed.displayState))
        val next = BedtimePromptModel.due(before, id, SystemClock.elapsedRealtime(), boot(ctx), observed.interactive, unlocked(ctx), permitted(ctx), alarmActive(ctx), observed.displayState)
        if (next == before) {
            record(ctx, "due_rejected", before, mapOf("accepted" to false, "reasonCode" to "not-due"))
            return
        }
        try {
            save(ctx, next)
            record(ctx, if (next.phase == BedtimePromptPhase.SHOWN) "due_accepted" else "due_rejected", next,
                mapOf("accepted" to (next.phase == BedtimePromptPhase.SHOWN), "reasonCode" to next.reason))
            if (next.phase == BedtimePromptPhase.SHOWN) show(ctx.applicationContext, next)
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
        val next = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx))
        if (next != before) { save(ctx, next); cleanup(ctx, before); record(ctx, "session_skipped", next, mapOf("reasonCode" to next.reason)); publish(ctx, next) }
    }

    /** Erst eine tatsächlich fortgesetzte Anker-Activity, nicht ein fehlerfreier startActivity-Aufruf. */
    fun onAppResume(ctx: Context) {
        appForeground = true
        state(ctx)
        val before = read(ctx)
        val next = BedtimePromptModel.foregroundConfirmed(before, before.sessionId, SystemClock.elapsedRealtime())
        if (next != before) { save(ctx, next); record(ctx, "foreground_confirmed", next, mapOf("foreground" to true)); publish(ctx, next) }
        if (next.phase == BedtimePromptPhase.SHOWN) removeCard()
    }

    fun onAppPause(ctx: Context) {
        appForeground = false
        val current = read(ctx)
        if (active(current)) record(ctx, "app_paused", current, mapOf("foreground" to false))
    }

    fun onAlarmStarted() {
        receiverContext?.let { ctx -> handler.post { try { reset(ctx, "alarm-active") } catch (_: Exception) { } } }
    }

    private fun pending(ctx: Context, id: String, action: String): PendingIntent = PendingIntent.getBroadcast(ctx, 0,
        Intent(ctx, BedtimePromptReceiver::class.java).setAction(action)
            .setData(Uri.Builder().scheme(ctx.packageName).authority("bedtime-prompt").appendPath(id).appendPath(action).build())
            .putExtra("sessionId", id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun watchScreen(ctx: Context) {
        if (screenReceiver != null) return
        val app = ctx.applicationContext
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                // Dieser Broadcast beschreibt Interaktivität, nicht zuverlässig den Displayzustand.
                if (intent.action == Intent.ACTION_SCREEN_OFF && read(context).phase == BedtimePromptPhase.SHOWN && !screen(context).visible)
                    try { reset(context, "screen-off") } catch (_: Exception) { }
            }
        }
        ContextCompat.registerReceiver(app, receiver, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
        screenReceiver = receiver; receiverContext = app
    }

    private fun cleanup(ctx: Context, s: BedtimePromptState) {
        if (s.sessionId.isNotEmpty()) {
            val manager = ctx.getSystemService(AlarmManager::class.java)
            for (action in listOf(ACTION_DUE, ACTION_EXPIRE)) try { manager?.cancel(pending(ctx, s.sessionId, action)) } catch (_: Exception) { }
        }
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
        buttons.addView(Button(ctx).apply { text = "Schließen"; setOnClickListener { asynchronously(ctx, s.sessionId) { ack(ctx, s.sessionId) } } })
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
