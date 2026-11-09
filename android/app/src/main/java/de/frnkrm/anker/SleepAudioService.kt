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
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import org.json.JSONObject
import java.util.UUID

/** Optional locally generated sleep audio, bounded by elapsed time and always subordinate to alarms. */
class SleepAudioService : Service() {
    companion object {
        private const val PREFS = "anker_sleep_audio"
        private const val CHANNEL = "anker_sleep_audio"
        private const val ID = 7090
        private const val STOP = "de.frnkrm.anker.SLEEP_AUDIO_STOP"
        @Volatile private var instance: SleepAudioService? = null
        fun hasForeground(): Boolean = instance?.foregroundShown == true
        private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private fun read(ctx: Context): JSONObject? = try { prefs(ctx).getString("state", null)?.let { JSONObject(it) } } catch (_: Exception) { null }
        private fun save(ctx: Context, value: JSONObject) { check(prefs(ctx).edit().putString("state", value.toString()).commit()) { "Audiostatus konnte nicht gespeichert werden." } }
        private fun priorityAudio(ctx: Context) = AlarmController.state(ctx).ringing != null || SmartWakeService.status(ctx).optString("phase") == "measuring"

        /** Must follow a deliberate UI action; permission or a restored preference alone never starts audio. */
        fun start(ctx: Context, options: JSONObject): JSObject {
            val rawDuration = options.opt("durationMinutes") ?: SleepAudioModel.DEFAULT_MINUTES
            require(rawDuration is Number && rawDuration.toDouble().isFinite() && rawDuration.toDouble() == rawDuration.toInt().toDouble()) { "Ungültige Dauer." }
            val minutes = rawDuration.toInt(); require(minutes in 1..SleepAudioModel.MAX_MINUTES) { "Wähle 1 bis 60 Minuten." }
            val rawVolume = options.opt("volume") ?: 0.25
            require(rawVolume is Number && rawVolume.toDouble().isFinite() && rawVolume.toDouble() in 0.0..0.6) { "Ungültige Audiolautstärke." }
            check(!priorityAudio(ctx)) { "Wecker oder Aktivitätsmessung haben gerade Vorrang." }
            if (hasForeground()) return state(ctx) // A repeated tap never restarts or extends the current session.
            RoutinePaceKeeperService.stopForPriorityAudio(ctx)
            LocalVoiceController.silenceForAlarm()
            val now = System.currentTimeMillis()
            val state = JSONObject().put("sessionId", UUID.randomUUID().toString()).put("phase", "prepared")
                .put("startedAt", now).put("deadlineAt", now + minutes * 60_000L).put("durationMs", minutes * 60_000L)
                .put("startedElapsed", SystemClock.elapsedRealtime()).put("volume", rawVolume.toDouble())
            save(ctx, state)
            try { ContextCompat.startForegroundService(ctx, Intent(ctx, SleepAudioService::class.java).putExtra("sessionId", state.getString("sessionId"))) }
            catch (_: Exception) { save(ctx, state.put("phase", "error").put("error", "foreground-denied")) }
            return state(ctx)
        }

        fun stop(ctx: Context, sessionId: String? = null): JSObject {
            val stored = read(ctx)
            if (stored != null && (sessionId == null || sessionId == stored.optString("sessionId"))) {
                instance?.finish("stopped") ?: save(ctx, stored.put("phase", "stopped"))
            }
            return state(ctx)
        }

        fun state(ctx: Context): JSObject {
            val stored = read(ctx)
            val phase = stored?.optString("phase", "idle") ?: "idle"
            return JSObject().apply {
                put("active", instance?.foregroundShown == true && phase == "playing")
                put("phase", if (phase == "playing" && instance == null) "interrupted" else phase)
                put("localOnly", true)
                if (stored != null) { put("sessionId", stored.optString("sessionId")); put("deadlineAt", stored.optLong("deadlineAt")); put("error", stored.optString("error", "")) }
            }
        }

        fun stopForPriorityAudio(ctx: Context) {
            val service = instance ?: return
            if (Looper.myLooper() == service.handler.looper) service.finish("interrupted", "priority-audio")
            else service.handler.post { service.finish("interrupted", "priority-audio") }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var foregroundShown = false
    private var ending = false
    private var sessionId = ""
    private var track: AudioTrack? = null
    private var focus: AudioFocusRequest? = null
    private val audioLease = AudioPlaybackLease()
    private var wakeLock: PowerManager.WakeLock? = null
    @Volatile private var generating = false
    private var worker: Thread? = null

    override fun onCreate() { super.onCreate(); instance = this }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) { stop(this, intent.getStringExtra("sessionId")); return START_NOT_STICKY }
        val stored = read(this)
        if (stored == null || intent?.getStringExtra("sessionId") != stored.optString("sessionId")) { if (!foregroundShown) stopSelf(startId); return START_NOT_STICKY }
        if (foregroundShown && sessionId == stored.optString("sessionId")) return START_NOT_STICKY
        sessionId = stored.optString("sessionId"); ending = false
        val duration = stored.optLong("durationMs")
        val start = stored.optLong("startedElapsed")
        if (duration !in 60_000..SleepAudioModel.MAX_MINUTES * 60_000L || SystemClock.elapsedRealtime() !in start until start + duration || priorityAudio(this)) {
            finish("interrupted", "expired-or-priority"); return START_NOT_STICKY
        }
        try {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Einschlafklang", NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null) })
            val open = PendingIntent.getActivity(this, ID, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val stop = PendingIntent.getService(this, ID + 1, Intent(this, SleepAudioService::class.java).setAction(STOP).putExtra("sessionId", sessionId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_stat_anker).setContentTitle("Anker · Einschlafklang")
                .setContentText("Lokales Rauschen wird langsam leiser.").setOngoing(true).setContentIntent(open).addAction(0, "Klang beenden", stop).build()
            foregroundShown = true
            ReminderScheduler.onProtectedDisplaysChanged(this)
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK) else startForeground(ID, notification)
            val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()
            val lease = audioLease.begin()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener({ change -> if (change < 0 && audioLease.lose(lease, false)) finish("interrupted", "audio-focus") }, handler).build()
            focus = request
            val granted = getSystemService(AudioManager::class.java)?.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!audioLease.requested(lease, granted)) { finish("error", "audio-focus-denied"); return START_NOT_STICKY }
            val format = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(22_050).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build()
            val bufferSize = maxOf(8_192, AudioTrack.getMinBufferSize(22_050, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT))
            val player = AudioTrack.Builder().setAudioAttributes(attrs).setAudioFormat(format).setTransferMode(AudioTrack.MODE_STREAM).setBufferSizeInBytes(bufferSize).build()
            check(player.state == AudioTrack.STATE_INITIALIZED)
            track = player
            player.setVolume(0f); player.play()
            wakeLock = getSystemService(PowerManager::class.java)?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anker:sleep-audio")?.apply {
                acquire((start + duration - SystemClock.elapsedRealtime()).coerceAtLeast(1_000) + 5_000)
            }
            save(this, stored.put("phase", "playing").put("error", ""))
            generating = true
            val id = sessionId
            worker = Thread({
                val generator = BrownNoiseGenerator()
                val samples = ShortArray(2_048)
                var failed = false
                while (generating && SystemClock.elapsedRealtime() < start + duration) {
                    try {
                        generator.fill(samples)
                        player.setVolume(SleepAudioModel.volume(stored.optDouble("volume", 0.25), SystemClock.elapsedRealtime() - start, duration))
                        if (player.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING) < 0) { failed = true; break }
                    } catch (_: Exception) { failed = true; break }
                }
                handler.post { if (!ending && sessionId == id) finish(if (failed) "error" else "finished", if (failed) "playback-failed" else "") }
            }, "anker-sleep-audio").also { it.isDaemon = true; it.start() }
        } catch (_: Exception) { finish("error", "playback-unavailable") }
        return START_NOT_STICKY
    }

    private fun finish(phase: String, error: String = "") {
        if (ending) return
        ending = true; generating = false
        handler.removeCallbacksAndMessages(null)
        audioLease.cancel()
        try { track?.pause(); track?.flush(); track?.stop() } catch (_: Exception) { }
        try { track?.release() } catch (_: Exception) { }; track = null
        focus?.let { try { getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(it) } catch (_: Exception) { } }; focus = null
        wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null
        try { read(this)?.takeIf { it.optString("sessionId") == sessionId }?.let { save(this, it.put("phase", phase).put("error", error)) } } catch (_: Exception) { }
        foregroundShown = false
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
        try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
    }

    override fun onDestroy() {
        finish("interrupted", "service-ended")
        if (instance === this) instance = null
        super.onDestroy()
    }
}
