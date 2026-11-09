package de.frnkrm.anker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.UUID

/** Explicitly started continuation of a routine timer. Private step titles stay in credential storage. */
class RoutinePaceKeeperService : Service() {
    companion object {
        private const val PREFS = "anker_routine_pace"
        private const val CHANNEL = "anker_routine_pace"
        private const val ID = 7080
        private const val STOP = "de.frnkrm.anker.PACE_STOP"
        @Volatile private var instance: RoutinePaceKeeperService? = null
        fun hasForeground(): Boolean = instance?.foregroundShown == true
        private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private fun read(ctx: Context): JSONObject? = try { prefs(ctx).getString("state", null)?.let { JSONObject(it) } } catch (_: Exception) { null }
        private fun save(ctx: Context, value: JSONObject) { check(prefs(ctx).edit().putString("state", value.toString()).commit()) { "Begleitung konnte nicht gespeichert werden." } }
        private fun number(o: JSONObject, key: String, fallback: Long? = null): Long {
            val raw = o.opt(key) ?: return fallback ?: throw IllegalArgumentException("Ungültige Zeitangabe.")
            require(raw is Number && raw.toDouble().isFinite() && raw.toDouble() == raw.toLong().toDouble()) { "Ungültige Zeitangabe." }
            return raw.toLong()
        }
        private fun interval(o: JSONObject): Int {
            val value = number(o, "intervalSeconds", 60)
            require(value in 15L..300L) { "Ungültiger Begleitungsabstand." }
            return value.toInt()
        }
        private fun spec(o: JSONObject) = RoutinePaceSpec(o.getString("sessionId"), o.getString("stepId"), VoiceModel.transcript(listOf(o.optString("title", "")))?.take(240) ?: "",
            number(o, "durationMs"), number(o, "deadlineAt", 0), interval(o),
            o.optBoolean("hapticsEnabled", false), o.optBoolean("thresholds", true), o.optBoolean("speakStep", false), o.optString("strength", "gentle"))
        private fun decode(o: JSONObject): RoutinePaceState {
            val passed = o.optJSONArray("passedThresholds") ?: JSONArray()
            return RoutinePaceState(spec(o), o.optString("phase", "stopped"), o.optLong("lastBucket"),
                o.optBoolean("announced"), (0 until passed.length()).map { passed.getInt(it) }.toSet())
        }
        private fun encode(s: RoutinePaceState, request: String) = JSONObject().apply {
            put("requestId", request); put("sessionId", s.spec.sessionId); put("stepId", s.spec.stepId); put("title", s.spec.title)
            put("durationMs", s.spec.durationMs); put("deadlineAt", s.spec.deadlineAt); put("intervalSeconds", s.spec.intervalSeconds)
            put("hapticsEnabled", s.spec.hapticsEnabled); put("thresholds", s.spec.thresholds); put("speakStep", s.spec.speakStep); put("strength", s.spec.strength)
            put("phase", s.phase); put("lastBucket", s.lastBucket); put("announced", s.announced); put("passedThresholds", JSONArray(s.passedThresholds.sorted()))
            put("updatedAt", System.currentTimeMillis())
        }

        /** Call on the Activity/main thread. Returning a start request never claims an audible cue. */
        fun sync(ctx: Context, options: JSONObject): JSObject {
            if (!options.optBoolean("enabled", false) || options.optString("status", "running") == "stopped") return stop(ctx, options.optString("sessionId").ifBlank { null })
            val requested = spec(options); RoutinePaceKeeperModel.validate(requested)
            val stored = read(ctx)
            if (stored?.optBoolean("userStopped", false) == true && stored.optString("sessionId") == requested.sessionId && stored.optString("stepId") == requested.stepId) return state(ctx)
            val old = stored?.let { try { decode(it) } catch (_: Exception) { null } }
            val next = RoutinePaceKeeperModel.sync(old, requested, options.optString("status", "running"), System.currentTimeMillis())
            val requestId = UUID.randomUUID().toString()
            save(ctx, encode(next, requestId).put("speechStatus", "idle"))
            if (next.phase != "running") { instance?.finish(next.phase); return state(ctx) }
            if (priorityAudio(ctx)) { save(ctx, encode(next.copy(phase = "blocked"), requestId).put("error", "priority-audio")); return state(ctx) }
            try {
                ContextCompat.startForegroundService(ctx, Intent(ctx, RoutinePaceKeeperService::class.java).putExtra("requestId", requestId))
            } catch (_: Exception) { save(ctx, encode(next.copy(phase = "error"), requestId).put("error", "foreground-denied")) }
            return state(ctx)
        }

        fun stop(ctx: Context, sessionId: String? = null): JSObject {
            val current = read(ctx)
            if (current != null && (sessionId == null || current.optString("sessionId") == sessionId)) {
                save(ctx, current.put("phase", "stopped").put("userStopped", false).put("title", ""))
                instance?.finish("stopped")
            }
            return state(ctx)
        }

        fun state(ctx: Context): JSObject {
            val s = read(ctx)
            val active = instance?.foregroundShown == true && s?.optString("phase") == "running"
            val phase = s?.optString("phase") ?: "idle"
            val visiblePhase = if (phase == "running" && !hasForeground()) {
                val age = System.currentTimeMillis() - (s?.optLong("updatedAt") ?: 0)
                if (age in 0..10_000) "prepared" else "interrupted"
            } else phase
            return JSObject().apply {
                put("active", active); put("phase", visiblePhase)
                put("speechStatus", s?.optString("speechStatus", "idle") ?: "idle")
                if (s != null) { put("sessionId", s.optString("sessionId")); put("stepId", s.optString("stepId")); put("deadlineAt", s.optLong("deadlineAt")); put("error", s.optString("error", "")) }
            }
        }

        fun stopForPriorityAudio(ctx: Context) {
            val service = instance ?: return
            if (Looper.myLooper() == service.handler.looper) service.finish("interrupted", "priority-audio")
            else service.handler.post { service.finish("interrupted", "priority-audio") }
        }

        private fun priorityAudio(ctx: Context): Boolean = AlarmController.state(ctx).ringing != null ||
            SmartWakeService.status(ctx).optString("phase") == "measuring"
    }

    private val handler = Handler(Looper.getMainLooper())
    private var current: RoutinePaceState? = null
    private var requestId = ""
    private var foregroundShown = false
    private var ending = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var expiresElapsed = 0L
    private var vibrator: Vibrator? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsFailed = false
    private var pendingIntro: String? = null
    private var speechFocus: AudioFocusRequest? = null
    private val speechLease = AudioPlaybackLease()
    private var utteranceId: String? = null
    private val tick: Runnable = object : Runnable { override fun run() {
        val before = current ?: return
        if (ending) return
        if (SystemClock.elapsedRealtime() >= expiresElapsed) { finish("expired", "timer-limit"); return }
        if (priorityAudio(this@RoutinePaceKeeperService)) { finish("interrupted", "priority-audio"); return }
        val result = RoutinePaceKeeperModel.tick(before, System.currentTimeMillis())
        current = result.state
        try { if (result.state != before) save(this@RoutinePaceKeeperService, encode(result.state, requestId).put("speechStatus", read(this@RoutinePaceKeeperService)?.optString("speechStatus", "idle") ?: "idle")) }
        catch (_: Exception) { finish("error", "storage-failed"); return }
        if (result.state.phase != "running") { finish(result.state.phase); return }
        if (result.pulse) {
            val on = if (result.state.spec.strength == "strong") 140L else 60L
            try { vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, on, 120, on), -1)) } catch (_: Exception) { }
        }
        result.speech?.let { speak(it) }
        handler.postDelayed(this, 500)
    } }

    override fun onCreate() { super.onCreate(); instance = this }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) {
            val stored = read(this)
            if (stored != null && stored.optString("sessionId") == intent.getStringExtra("sessionId")) {
                save(this, stored.put("userStopped", true)); finish("stopped")
            }
            return START_NOT_STICKY
        }
        val saved = read(this)
        if (saved == null || intent?.getStringExtra("requestId") != saved.optString("requestId")) { if (!foregroundShown) stopSelf(startId); return START_NOT_STICKY }
        val previous = current
        current = try { decode(saved) } catch (_: Exception) { finish("error", "invalid-request"); return START_NOT_STICKY }
        if (current?.phase != "running") { finish(current?.phase ?: "stopped"); return START_NOT_STICKY }
        if (current!!.spec.deadlineAt <= System.currentTimeMillis() || priorityAudio(this)) { finish("interrupted", "not-running"); return START_NOT_STICKY }
        if (ending || previous == null || previous.spec.sessionId != current!!.spec.sessionId || previous.spec.stepId != current!!.spec.stepId || previous.spec.deadlineAt != current!!.spec.deadlineAt || expiresElapsed == 0L)
            expiresElapsed = SystemClock.elapsedRealtime() + (current!!.spec.deadlineAt - System.currentTimeMillis()).coerceIn(1_000, current!!.spec.durationMs)
        requestId = saved.optString("requestId"); ending = false
        try {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Routinebegleitung", NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null) })
            val open = PendingIntent.getActivity(this, ID, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val stop = PendingIntent.getService(this, ID + 1, Intent(this, RoutinePaceKeeperService::class.java).setAction(STOP).putExtra("sessionId", current!!.spec.sessionId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_stat_anker).setContentTitle("Anker · Routinebegleitung")
                .setContentText("Dein laufender Schritt wird lokal begleitet.").setOngoing(true).setContentIntent(open).addAction(0, "Begleitung beenden", stop).build()
            foregroundShown = true
            ReminderScheduler.onProtectedDisplaysChanged(this)
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED) else startForeground(ID, notification)
            wakeLock?.let { if (it.isHeld) it.release() }
            wakeLock = getSystemService(PowerManager::class.java)?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anker:routine-pace")?.apply {
                acquire((current!!.spec.deadlineAt - System.currentTimeMillis()).coerceIn(1_000, RoutinePaceKeeperModel.MAX_DURATION_MS) + 5_000)
            }
            vibrator = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java)?.defaultVibrator else {
                @Suppress("DEPRECATION") getSystemService(Vibrator::class.java)
            }
            handler.removeCallbacks(tick); handler.post(tick)
        } catch (_: Exception) { finish("error", "foreground-denied") }
        return START_NOT_STICKY
    }

    private fun speechStatus(value: String) { try { read(this)?.takeIf { it.optString("requestId") == requestId }?.let { save(this, it.put("speechStatus", value)) } } catch (_: Exception) { } }
    private fun stopSpeech() {
        speechLease.cancel(); pendingIntro = null; utteranceId = null
        try { tts?.stop() } catch (_: Exception) { }
        speechFocus?.let { try { getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(it) } catch (_: Exception) { } }; speechFocus = null
    }
    private fun speak(text: String) {
        if (ending || priorityAudio(this) || LocalVoiceController.hasActiveVoice()) { speechStatus("blocked"); return }
        stopSpeech(); pendingIntro = text
        if (ttsReady) { speakPending(); return }
        if (ttsFailed) { pendingIntro = null; speechStatus("unavailable"); return }
        if (tts != null) return
        speechStatus("initializing")
        handler.postDelayed({ if (!ttsReady && pendingIntro != null) { pendingIntro = null; ttsFailed = true; speechStatus("unavailable") } }, 5_000)
        try { tts = TextToSpeech(this) { status -> handler.post {
            if (ending) return@post
            ttsReady = status == TextToSpeech.SUCCESS; ttsFailed = !ttsReady
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) { }
                override fun onDone(id: String?) { handler.post { if (id == utteranceId) stopSpeech() } }
                @Suppress("OVERRIDE_DEPRECATION") override fun onError(id: String?) { handler.post { if (id == utteranceId) { stopSpeech(); speechStatus("unavailable") } } }
            })
            if (ttsReady) speakPending() else { pendingIntro = null; speechStatus("unavailable") }
        } } } catch (_: Exception) { ttsFailed = true; pendingIntro = null; speechStatus("unavailable") }
    }
    private fun speakPending() {
        val text = pendingIntro ?: return
        pendingIntro = null
        if (ending || priorityAudio(this) || LocalVoiceController.hasActiveVoice() || current?.phase != "running") { speechStatus("blocked"); return }
        val engine = tts ?: return
        val voice = engine.voices?.filter { !it.isNetworkConnectionRequired && it.locale.language == Locale.GERMAN.language }?.minByOrNull { it.name }
        if (voice == null) { speechStatus("unavailable"); return }
        try {
            engine.voice = voice
            val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
            if (engine.setAudioAttributes(attrs) != TextToSpeech.SUCCESS) { speechStatus("unavailable"); return }
            val lease = speechLease.begin()
            val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener({ change -> if (change < 0 && speechLease.lose(lease, false)) { stopSpeech(); speechStatus("interrupted") } }, handler).build()
            speechFocus = focus
            val granted = getSystemService(AudioManager::class.java)?.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!speechLease.requested(lease, granted)) { stopSpeech(); speechStatus("unavailable"); return }
            val id = "pace-$requestId-${System.nanoTime()}"; utteranceId = id
            speechStatus(if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.SUCCESS) "requested" else "unavailable")
        } catch (_: Exception) { stopSpeech(); speechStatus("unavailable") }
    }

    private fun finish(phase: String, error: String = "") {
        if (ending) return
        ending = true; handler.removeCallbacksAndMessages(null); stopSpeech()
        try { read(this)?.let { save(this, it.put("phase", phase).put("error", error).put("title", "")) } } catch (_: Exception) { }
        if (AlarmController.state(this).ringing == null) try { vibrator?.cancel() } catch (_: Exception) { }
        wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null
        foregroundShown = false
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
        try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
    }
    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null); stopSpeech()
        wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null
        try { tts?.shutdown() } catch (_: Exception) { }; tts = null
        foregroundShown = false; if (instance === this) instance = null
        try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
        super.onDestroy()
    }
}
