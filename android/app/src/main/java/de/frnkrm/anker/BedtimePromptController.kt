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
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
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

    private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun boot(ctx: Context) = Settings.Global.getInt(ctx.contentResolver, Settings.Global.BOOT_COUNT, -1)
    private fun interactive(ctx: Context) = ctx.getSystemService(PowerManager::class.java)?.isInteractive == true
    private fun unlocked(ctx: Context): Boolean = ctx.getSystemService(KeyguardManager::class.java)?.let { !it.isKeyguardLocked && !it.isDeviceLocked } == true
    private fun permitted(ctx: Context) = Settings.canDrawOverlays(ctx)
    private fun alarmActive(ctx: Context) = AnkerPrefs.isRinging(ctx)
    private fun active(s: BedtimePromptState) = s.phase == BedtimePromptPhase.WAITING || s.phase == BedtimePromptPhase.SHOWN

    private fun read(ctx: Context): BedtimePromptState = try {
        val p = prefs(ctx)
        BedtimePromptState(p.getString("id", "") ?: "", BedtimePromptPhase.of(p.getString("phase", "") ?: ""),
            p.getLong("started", 0), p.getLong("due", 0), p.getLong("dueAt", 0), p.getInt("boot", -1),
            p.getBoolean("exact", false), p.getLong("visibleUntil", 0), p.getString("reason", "") ?: "")
    } catch (_: Exception) { BedtimePromptState() }

    private fun save(ctx: Context, s: BedtimePromptState) {
        check(prefs(ctx).edit().putString("id", s.sessionId).putString("phase", s.phase.wire)
            .putLong("started", s.startedElapsed).putLong("due", s.dueElapsed).putLong("dueAt", s.dueAt)
            .putInt("boot", s.bootCount).putBoolean("exact", s.exact).putLong("visibleUntil", s.visibleUntilElapsed)
            .putString("reason", s.reason).commit()) { "Der Schlafhinweis konnte nicht sicher gespeichert werden." }
    }

    private fun json(ctx: Context, s: BedtimePromptState): JSObject = JSObject()
        .put("phase", s.phase.wire).put("overlayPermission", permitted(ctx)).put("exact", s.exact).apply {
            if (s.sessionId.isNotEmpty()) put("sessionId", s.sessionId)
            if (s.dueAt > 0) put("dueAt", s.dueAt)
            if (s.reason.isNotEmpty()) put("reason", s.reason)
        }

    private fun publish(ctx: Context, s: BedtimePromptState) { AnkerNativePlugin.notifyBedtimePromptChanged(json(ctx, s)) }

    /** Native Klicks/Handler laufen außerhalb eines PluginCall-Tryblocks. Nie den Weckerprozess werfen. */
    private fun asynchronously(ctx: Context, id: String, action: () -> Unit) {
        val before = read(ctx)
        if (before.sessionId != id) return
        try { action() } catch (_: Exception) {
            try { cleanup(ctx, before) } catch (_: Exception) { }
            val failed = before.copy(phase = BedtimePromptPhase.ERROR, reason = "storage-failed")
            try { save(ctx, failed); publish(ctx, failed) } catch (_: Exception) { }
        }
    }

    fun state(ctx: Context): JSObject {
        val before = read(ctx)
        var next = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx))
        if (active(next) && !permitted(ctx)) next = BedtimePromptModel.skip(next, "permission-revoked")
        if (next != before) { save(ctx, next); cleanup(ctx, before); publish(ctx, next) }
        return json(ctx, next)
    }

    fun start(ctx: Context, minutes: Int): JSObject {
        require(minutes in 0..60) { "Die Einschlafzeit muss zwischen 0 und 60 Minuten liegen." }
        check(permitted(ctx)) { "Erlaube zuerst bewusst das Anzeigen über anderen Apps." }
        check(interactive(ctx) && unlocked(ctx)) { "Entsperre das Handy, um den Schlafhinweis zu starten." }
        check(!alarmActive(ctx)) { "Während eines Weckers startet kein Schlafhinweis." }
        val old = read(ctx)
        cleanup(ctx, old)
        val manager = ctx.getSystemService(AlarmManager::class.java) ?: error("Die Zeitplanung ist nicht verfügbar.")
        val exact = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()
        var next = BedtimePromptModel.arm(UUID.randomUUID().toString(), minutes, SystemClock.elapsedRealtime(), System.currentTimeMillis(), boot(ctx), exact)
        try {
            save(ctx, next)
            val alarm = pending(ctx, next.sessionId, ACTION_DUE)
            if (exact) {
                try { manager.setExact(AlarmManager.ELAPSED_REALTIME, next.dueElapsed, alarm) }
                catch (_: SecurityException) { next = next.copy(exact = false); save(ctx, next); manager.set(AlarmManager.ELAPSED_REALTIME, next.dueElapsed, alarm) }
            } else manager.set(AlarmManager.ELAPSED_REALTIME, next.dueElapsed, alarm)
        } catch (e: Exception) {
            cleanup(ctx, next)
            val failed = next.copy(phase = BedtimePromptPhase.ERROR, reason = "schedule-failed")
            save(ctx, failed); publish(ctx, failed)
            throw e
        }
        publish(ctx, next)
        return json(ctx, next)
    }

    fun stop(ctx: Context, id: String?): JSObject {
        val before = read(ctx)
        val next = BedtimePromptModel.stop(before, id)
        if (next != before) { save(ctx, next); cleanup(ctx, before); publish(ctx, next) }
        return json(ctx, next)
    }

    fun ack(ctx: Context, id: String): JSObject {
        val before = read(ctx)
        val next = BedtimePromptModel.ack(before, id)
        if (next != before) { save(ctx, next); cleanup(ctx, before); publish(ctx, next) }
        return json(ctx, next)
    }

    fun reset(ctx: Context, reason: String) {
        val before = read(ctx)
        val next = BedtimePromptModel.skip(before, reason)
        cleanup(ctx, before)
        if (next != before) { save(ctx, next); publish(ctx, next) }
    }

    fun onDue(ctx: Context, id: String) {
        val before = read(ctx)
        val next = BedtimePromptModel.due(before, id, SystemClock.elapsedRealtime(), boot(ctx), interactive(ctx), unlocked(ctx), permitted(ctx), alarmActive(ctx))
        if (next == before) return
        try {
            save(ctx, next)
            if (next.phase == BedtimePromptPhase.SHOWN) show(ctx.applicationContext, next)
            else cleanup(ctx, before)
            publish(ctx, read(ctx))
        } catch (_: Exception) {
            cleanup(ctx, before)
            val failed = next.copy(phase = BedtimePromptPhase.ERROR, reason = "overlay-failed")
            try { save(ctx, failed); publish(ctx, failed) } catch (_: Exception) { }
        }
    }

    fun expire(ctx: Context, id: String) {
        val before = read(ctx)
        if (before.sessionId != id || before.phase != BedtimePromptPhase.SHOWN) return
        val next = BedtimePromptModel.reconcile(before, SystemClock.elapsedRealtime(), boot(ctx))
        if (next != before) { save(ctx, next); cleanup(ctx, before); publish(ctx, next) }
    }

    /** Erst eine tatsächlich fortgesetzte Anker-Activity, nicht ein fehlerfreier startActivity-Aufruf. */
    fun onAppResume(ctx: Context) {
        state(ctx)
        if (read(ctx).phase == BedtimePromptPhase.SHOWN) removeCard()
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
                if (intent.action == Intent.ACTION_SCREEN_OFF && read(context).phase == BedtimePromptPhase.SHOWN)
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
        check(permitted(ctx) && interactive(ctx) && unlocked(ctx) && !alarmActive(ctx))
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
        buttons.addView(Button(ctx).apply { text = "Jetzt öffnen"; setOnClickListener { asynchronously(ctx, s.sessionId) { openNow(ctx, s.sessionId) } } })
        buttons.addView(Button(ctx).apply { text = "Schließen"; setOnClickListener { asynchronously(ctx, s.sessionId) { ack(ctx, s.sessionId) } } })
        panel.addView(buttons)
        val width = minOf(dp(360), ctx.resources.displayMetrics.widthPixels - dp(24)).coerceAtLeast(dp(180))
        val layout = WindowManager.LayoutParams(width, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL; y = dp(32); title = "Anker Schlafhinweis" }
        // Kleine touchbare Karte; kein transparentes, vollflächiges Durchreichfenster.
        manager.addView(panel, layout)
        card = panel; windowManager = manager
        watchScreen(ctx)
        ctx.getSystemService(AlarmManager::class.java)?.set(AlarmManager.ELAPSED_REALTIME, s.visibleUntilElapsed, pending(ctx, s.sessionId, ACTION_EXPIRE))
        panel.post {
            // SYSTEM_ALERT_WINDOW ist die legitime BAL-Ausnahme. Ein stiller BAL-Block
            // zählt nicht als Erfolg: Karte mit explizitem Öffnenknopf bleibt stehen.
            asynchronously(ctx, s.sessionId) { if (panel.isAttachedToWindow && panel.isShown && card === panel) openNow(ctx, s.sessionId) }
        }
        handler.post(object : Runnable {
            override fun run() {
                asynchronously(ctx, s.sessionId) {
                val current = read(ctx)
                if (current.phase != BedtimePromptPhase.SHOWN) return@asynchronously
                when {
                    !interactive(ctx) -> reset(ctx, "screen-off")
                    !unlocked(ctx) -> reset(ctx, "locked")
                    !permitted(ctx) -> reset(ctx, "permission-revoked")
                    alarmActive(ctx) -> reset(ctx, "alarm-active")
                    SystemClock.elapsedRealtime() >= current.visibleUntilElapsed -> expire(ctx, s.sessionId)
                    else -> handler.postDelayed(this, 500)
                }
                }
            }
        })
    }

    private fun openNow(ctx: Context, id: String) {
        val current = read(ctx)
        if (current.sessionId != id || current.phase != BedtimePromptPhase.SHOWN || !permitted(ctx)
            || !interactive(ctx) || !unlocked(ctx) || alarmActive(ctx)
            || SystemClock.elapsedRealtime() >= current.visibleUntilElapsed) return
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${ctx.packageName}://now")).setPackage(ctx.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        } catch (_: Exception) { /* Expliziter Jetzt-Knopf bleibt als ehrlicher Fallback. */ }
    }
}
