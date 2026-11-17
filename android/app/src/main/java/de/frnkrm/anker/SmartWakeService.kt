package de.frnkrm.anker

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Bewusst am Abend gestarteter Mikrofon-Foreground-Dienst. Erfasst ab Start technische Ruheindikatoren.
 * Nur im morgendlichen Weckfenster darf der bestehende Aktivitätsdetektor einen Wecker anfragen.
 * Nur kurzlebige Bewegungs-/Lautstärke-Aggregate im RAM: keine Tondateien, kein Versand.
 * Ein abgebrochener Dienst wird nicht automatisch mit Mikrofonrechten neu gestartet.
 * Der AlarmController behält unabhängig davon den festen Hauptwecker.
 */
class SmartWakeService : Service(), SensorEventListener {
    companion object {
        private const val CHANNEL = "anker_smart_wake"
        private const val ID = 7010
        private const val REQUEST = 7790
        const val ACTION_START = "de.frnkrm.anker.SMART_START"
        const val ACTION_STOP = "de.frnkrm.anker.SMART_STOP"
        private const val PREFS = "anker_smart_wake"
        @Volatile var instance: SmartWakeService? = null
            private set
        fun hasForeground(): Boolean = instance?.foregroundShown == true

        fun status(ctx: Context): JSObject {
            val p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE)
            if (p.getBoolean("active", false) && instance == null) {
                p.edit().putBoolean("active", false).putString("phase", "interrupted")
                    .putString("message", "Die Messung wurde unterbrochen. Der feste Wecker bleibt gestellt. Starte die Messung erneut, wenn du möchtest.").commit()
            }
            return JSObject().apply {
                put("active", p.getBoolean("active", false))
                put("phase", p.getString("phase", "idle"))
                put("message", p.getString("message", "Für diese Nacht noch nicht gestartet."))
                put("targetAt", p.getLong("targetAt", 0))
                put("windowAt", p.getLong("windowAt", 0))
                put("screenLockAvailable", SleepLockAdmin.available(ctx))
                put("screenLockSupported", SleepLockAdmin.supported(ctx))
                put("estimatedOnsetAt", p.getLong("estimatedOnsetAt", 0))
                put("estimateInvalidated", p.getBoolean("estimateInvalidated", false))
                put("onsetEstimationActive", instance?.estimatesOnset() == true)
                put("preWakePausedForTargetAt", AlarmController.state(ctx).preWakePausedForTargetAt)
                put("hasMotion", ctx.getSystemService(SensorManager::class.java)?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null)
                put("microphoneGranted", ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
            }
        }

        /** Nur die lebende Instanz anfassen: auch vor dem ersten Entsperren muss der feste Wecker funktionieren. */
        fun stopIfRunning(message: String) { instance?.let { service ->
            if (Looper.myLooper() == Looper.getMainLooper()) service.finish("stopped", message)
            else service.handler.post { service.finish("stopped", message) }
        } }

        fun planChanged() {
            instance?.let { service -> service.handler.post {
                val cfg = AnkerPrefs.config(service)
                if (cfg?.enabled != true || !cfg.smartWakeEnabled || cfg.smartWakeWindowMinutes != service.minutes || AlarmController.state(service).mainAt != service.targetAt) {
                    service.finish("stopped", "Der Weckplan wurde geändert. Starte die Messung für die neue Weckzeit erneut. Der feste Wecker bleibt gestellt.")
                }
            } }
        }

        private fun windowIntent(ctx: Context): PendingIntent = PendingIntent.getBroadcast(ctx, REQUEST,
            Intent(ctx, SmartWakeWindowReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private val handler = Handler(Looper.getMainLooper())
    private var targetAt = 0L
    private var windowAt = 0L
    private var minutes = 45
    private var detector: SmartWakeDetector? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var audio: AudioRecord? = null
    @Volatile private var sampling = false
    private val sampleLock = Any()
    private var motionPeak = 0.0
    private var soundPeak = 0.0
    private var audioBlocks = 0L
    private var motionEvents = 0L
    private val evidence = SmartWakeEvidence()
    private var lastSummaryAt = 0L
    private var lastTickAt = 0L
    private var morningWindowEntered = false
    private var lockScreen = false
    private var estimateOnset = false
    private val promptEvidence = SleepPromptEvidence()
    private var estimatedOnsetAt = 0L
    private var questionsPaused = false
    private var nextQuestionAt = 0L
    private var questionUntilAt = 0L

    fun estimatesOnset(): Boolean = estimateOnset && !questionsPaused && !ending && sampling && System.currentTimeMillis() < windowAt
    fun pauseSleepQuestions() { questionsPaused = true }
    fun hasOnsetEstimate(): Boolean = estimatedOnsetAt > 0
    fun observeSleepPrompt(session: String, visible: Boolean) {
        if (!estimatesOnset() || estimatedOnsetAt > 0) return
        val at = promptEvidence.observe(session, android.os.SystemClock.elapsedRealtime(), System.currentTimeMillis(), visible) ?: return
        estimatedOnsetAt = at
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong("estimatedOnsetAt", at).putBoolean("estimateInvalidated", false).commit()
        NativeDiagnosticJournal.record(this, "measurement", "sleep_estimated", mapOf("observedAt" to at))
    }
    fun userAwake() {
        if (estimatedOnsetAt > 0 && System.currentTimeMillis() - estimatedOnsetAt in 0..5 * 60_000L)
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("estimateInvalidated", true).commit()
    }
    private var gravity: FloatArray? = null
    private var ending = false
    @Volatile private var foregroundShown = false
    private val tick = object : Runnable {
        override fun run() {
            if (ending) return
            val now = System.currentTimeMillis()
            if (now >= targetAt) { finish("finished", "Die feste Weckzeit ist erreicht. Der reguläre Wecker übernimmt."); return }
            if (AlarmController.state(this@SmartWakeService).mainAt != targetAt) { finish("stopped", "Der Weckplan hat sich geändert. Der feste Wecker bleibt gestellt."); return }
            if (lastTickAt > 0 && now < lastTickAt - 30_000) { finish("stopped", "Die Uhrzeit wurde geändert. Starte die Messung erneut."); return }
            lastTickAt = now
            if (!sampling && now >= windowAt) { beginMeasurement(); return }
            if (sampling) {
                if (estimatesOnset() && !hasOnsetEstimate() && now >= nextQuestionAt && now < questionUntilAt) {
                    nextQuestionAt = now + 10 * 60_000
                    try { BedtimePromptController.offerSleepQuestion(this@SmartWakeService) } catch (_: Exception) { }
                }
                val values = synchronized(sampleLock) {
                    val value = doubleArrayOf(motionPeak, soundPeak, audioBlocks.toDouble(), motionEvents.toDouble())
                    motionPeak = 0.0; soundPeak = 0.0; audioBlocks = 0; motionEvents = 0; value
                }
                evidence.observe(now, values[0], values[1], values[2].toLong(), values[3].toLong())
                if (lastSummaryAt == 0L || now - lastSummaryAt >= 5 * 60_000) {
                    NativeDiagnosticJournal.record(this@SmartWakeService, "measurement", "input_summary", evidence.facts() + mapOf("targetAt" to targetAt))
                    lastSummaryAt = now
                }
                if (now >= windowAt && !morningWindowEntered) {
                    morningWindowEntered = true
                    NativeDiagnosticJournal.record(this@SmartWakeService, "measurement", "morning_window", mapOf("targetAt" to targetAt, "windowAt" to windowAt))
                    recordStatus("measuring", "Das Aktivitäts-Weckfenster läuft. Keine Schlafphasenmessung.", true)
                }
                // Einen laufenden Test-/Vorwecker nicht selbst als Aktivitätsnachweis verwerten.
                if (now >= windowAt && values[2] > 0 && values[3] > 0 && AlarmController.state(this@SmartWakeService).ringing == null && detector?.observe(now, values[0], values[1]) == true) {
                    releaseSamples()
                    val accepted = AlarmController.trySmartWake(this@SmartWakeService, targetAt)
                    finish(if (accepted) "triggered" else "finished", if (accepted) "Der Aktivitätshinweis hat einen früheren Wecker ausgelöst. Die feste Zeit bleibt bis zum bestätigten Beenden abgesichert." else "Der feste Wecker übernimmt.")
                    return
                }
            }
            handler.postDelayed(this, if (sampling) 10_000 else 60_000)
        }
    }

    override fun onCreate() { super.onCreate(); instance = this }
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { finish("stopped", "Messung beendet. Der feste Wecker bleibt gestellt."); return START_NOT_STICKY }
        if (intent?.action != ACTION_START) { finish("interrupted", "Messung unterbrochen. Bitte bei geöffneter App erneut starten."); return START_NOT_STICKY }
        if (targetAt > 0) return START_NOT_STICKY
        targetAt = intent.getLongExtra("targetAt", 0)
        minutes = intent.getIntExtra("minutes", 45).coerceIn(5, 90)
        windowAt = targetAt - minutes * 60_000L
        lockScreen = intent.getBooleanExtra("lockScreen", false)
        estimateOnset = intent.getBooleanExtra("estimateOnset", false)
        nextQuestionAt = System.currentTimeMillis() + 5 * 60_000
        questionUntilAt = minOf(System.currentTimeMillis() + 2 * 3600_000, windowAt)
        NativeDiagnosticJournal.record(this, "measurement", "start_requested", mapOf("targetAt" to targetAt, "windowAt" to windowAt))
        try {
            if (targetAt <= System.currentTimeMillis() || AlarmController.state(this).mainAt != targetAt || AnkerPrefs.config(this)?.smartWakeEnabled != true) throw IllegalStateException("Weckzeit fehlt")
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw SecurityException("Mikrofon fehlt")
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove("estimatedOnsetAt").remove("estimateInvalidated").commit()
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Aktivitäts-Weckfenster", NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null) })
            showForeground(false)
            if (System.currentTimeMillis() < windowAt) {
                getSystemService(AlarmManager::class.java).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, windowAt, windowIntent(this))
                if (!AlarmController.prepareSmartWake(this, targetAt)) throw IllegalStateException("Weckplan hat sich geändert")
                recordStatus("waiting", "Vorbereitet. Der Vorwecker pausiert für diese Nacht, auch nach Messungsende. Der feste Hauptwecker bleibt gestellt.", true)
            }
            beginMeasurement()
            handler.removeCallbacks(tick)
            handler.postDelayed(tick, if (sampling) 10_000 else 60_000)
        } catch (_: Exception) { finish("error", "Die Messung konnte nicht gestartet werden. Prüfe Mikrofonfreigabe und exakte Wecker. Der feste Wecker bleibt gestellt.") }
        return START_NOT_STICKY
    }

    private fun showForeground(measuring: Boolean) {
        val open = PendingIntent.getActivity(this, 7791, Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW; data = Uri.parse("${packageName}://smartwake")
        }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 7792, Intent(this, SmartWakeService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_stat_anker)
            .setContentTitle("Anker: Aktivitäts-Weckfenster")
            .setContentText(if (measuring) "Bewegungs- und Geräuschaktivität wird ab jetzt lokal ausgewertet." else "Die lokale Messung wird gestartet.")
            .setOngoing(true).setContentIntent(open).addAction(0, "Messung beenden", stop).build()
        // Reserve the ordinary-notification slot before posting the required service display.
        foregroundShown = true
        try {
            ReminderScheduler.onProtectedDisplaysChanged(this)
            if (Build.VERSION.SDK_INT >= 30) startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            else startForeground(ID, notification)
        } catch (error: Exception) {
            foregroundShown = false
            try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
            throw error
        }
    }

    fun beginMeasurement() {
        if (sampling || ending) return
        val now = System.currentTimeMillis()
        if (now >= targetAt) return
        try {
            // Eigene Sprachausgabe und Diktat dürfen die Messung nicht stören oder selbst auslösen.
            AlarmTonePreview.stopForPriorityAudio()
            LocalVoiceController.silenceForAlarm()
            RoutinePaceKeeperService.stopForPriorityAudio(this)
            SleepAudioService.stopForPriorityAudio(this)
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw SecurityException("Mikrofonfreigabe fehlt")
            val sm = getSystemService(SensorManager::class.java)
            val sensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: throw IllegalStateException("Bewegungssensor fehlt")
            if (!sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME, handler)) throw IllegalStateException("Bewegungssensor nicht verfügbar")
            val size = max(2048, AudioRecord.getMinBufferSize(16_000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT))
            val recorder = AudioRecord(MediaRecorder.AudioSource.MIC, 16_000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
            audio = recorder
            if (recorder.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("Mikrofon nicht verfügbar")
            recorder.startRecording()
            if (recorder.recordingState != AudioRecord.RECORDSTATE_RECORDING) throw IllegalStateException("Mikrofon nicht verfügbar")
            if (!AlarmController.prepareSmartWake(this, targetAt)) throw IllegalStateException("Weckplan hat sich geändert")
            sampling = true
            detector = SmartWakeDetector(max(now, windowAt), targetAt)
            wakeLock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anker:smart-window").apply {
                setReferenceCounted(false); acquire((targetAt - now + 60_000).coerceAtLeast(1000))
            }
            Thread({
                val buffer = ShortArray(1024)
                try {
                    while (sampling) {
                        val n = recorder.read(buffer, 0, buffer.size)
                        if (n < 0) throw IllegalStateException("Mikrofon unterbrochen")
                        if (n == 0) continue
                        var sum = 0.0
                        for (i in 0 until n) { val sample = buffer[i] / 32768.0; sum += sample * sample }
                        val rms = sqrt(sum / n)
                        synchronized(sampleLock) { soundPeak = max(soundPeak, rms); audioBlocks++ }
                        buffer.fill(0)
                    }
                } catch (_: Exception) { if (sampling) handler.post { finish("error", "Die Mikrofonmessung wurde unterbrochen. Der feste Wecker bleibt gestellt.") } }
                finally { buffer.fill(0) }
            }, "AnkerSmartWake").start()
            showForeground(true)
            NativeDiagnosticJournal.record(this, "measurement", "sampling_started", mapOf("targetAt" to targetAt, "windowAt" to windowAt))
            recordStatus(if (now < windowAt) "settling" else "measuring", "Die lokale Messung läuft ab jetzt. Nur im morgendlichen Weckfenster kann Aktivität früher wecken. Keine Schlafphasenmessung.", true)
            if (lockScreen) {
                val locked = SleepLockAdmin.lockIfAllowed(this)
                NativeDiagnosticJournal.record(this, "measurement", "screen_lock", mapOf("accepted" to locked))
            }
            handler.removeCallbacks(tick)
            handler.postDelayed(tick, 10_000)
        } catch (_: Exception) { finish("error", "Sensoren oder Mikrofon sind nicht verfügbar. Der feste Wecker bleibt gestellt.") }
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!sampling) return
        val previous = gravity
        if (previous == null) { gravity = event.values.clone(); return }
        var sum = 0.0
        for (i in 0..2) {
            previous[i] = previous[i] * 0.9f + event.values[i] * 0.1f
            val change = (event.values[i] - previous[i]).toDouble(); sum += change * change
        }
        synchronized(sampleLock) { motionPeak = max(motionPeak, sqrt(sum)); motionEvents++ }
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun recordStatus(phase: String, message: String, active: Boolean) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("phase", phase).putString("message", message).putBoolean("active", active)
            .putLong("targetAt", targetAt).putLong("windowAt", windowAt).commit()
    }

    private fun releaseSamples() {
        sampling = false
        getSystemService(SensorManager::class.java)?.unregisterListener(this)
        audio?.let { try { it.stop() } catch (_: Exception) { }; try { it.release() } catch (_: Exception) { } }; audio = null
        wakeLock?.let { try { if (it.isHeld) it.release() } catch (_: Exception) { } }; wakeLock = null
        gravity = null
    }

    private fun finish(phase: String, message: String) {
        if (ending) return
        ending = true
        NativeDiagnosticJournal.record(this, "measurement", if (phase in setOf("error", "interrupted", "triggered", "finished")) phase else "stopped",
            evidence.facts() + mapOf("targetAt" to targetAt, "windowAt" to windowAt))
        handler.removeCallbacksAndMessages(null)
        // Aufräumfehler dieses Extras dürfen den festen Hauptwecker niemals unterbrechen.
        try { releaseSamples() } catch (_: Exception) { }
        try { getSystemService(AlarmManager::class.java)?.cancel(windowIntent(this)) } catch (_: Exception) { }
        try { recordStatus(phase, message, false) } catch (_: Exception) { }
        try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (_: Exception) { }
        foregroundShown = false
        try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
        stopSelf()
    }

    override fun onDestroy() {
        if (!ending) finish("interrupted", "Messung unterbrochen. Der feste Wecker bleibt gestellt.")
        if (instance === this) instance = null
        super.onDestroy()
    }
}

/** Ein Alarm weckt die bereits laufende Sitzung. Kein Mikrofonstart aus einem neuen Hintergrundprozess. */
class SmartWakeWindowReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) { SmartWakeService.instance?.beginMeasurement() }
}
