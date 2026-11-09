package de.frnkrm.anker

import android.app.Notification
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
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.UserManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Klingelt im Vordergrund, bis der Alarm in der App beendet wird. Sicherheitsnetz: Jede Alarmart wird
 * nach ihrem Zeitlimit still. Die Laufzeit zählt ab dem gespeicherten Start, übersteht also einen
 * Prozess-Neustart. Systemlautstärke und Hardwaretasten bleiben unangetastet.
 */
class AlarmService : Service() {
    companion object {
        const val EXTRA_ALARM = "anker_alarm"
        const val ACTION_STOP = "de.frnkrm.anker.ALARM_STOP"
        const val CHANNEL = "anker_wecker_alarm"
        private const val FALLBACK_CHANNEL = "anker_wecker_ersatz"
        const val NOTIFICATION_ID = 7001
        private const val FALLBACK_ID = 7002
        /** Kurzlebige zweite Meldung, nur um das Vollbild nach dem Einschalten des Bildschirms erneut anzustoßen */
        private const val WAKE_ID = 7003

        fun stop(ctx: Context) {
            try {
                ctx.startService(Intent(ctx, AlarmService::class.java).setAction(ACTION_STOP))
            } catch (_: IllegalStateException) {
                // Dienst läuft nicht und die App ist im Hintergrund: dann klingelt ohnehin nichts
            }
        }

        fun ensureChannel(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            // Android lässt einmal angelegte Kanäle nur vom Nutzer ändern, deshalb nur beim ersten Mal wirksam
            val ch = NotificationChannel(CHANNEL, "Wecker (klingelt)", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Der Anker-Wecker"
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                if (nm.isNotificationPolicyAccessGranted) setBypassDnd(true)
            }
            nm.createNotificationChannel(ch)
        }

        /** Ersatz, falls der Klingel-Dienst nicht starten darf: Benachrichtigung mit Wecker-Ton. */
        fun postFallback(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
            nm.createNotificationChannel(
                NotificationChannel(FALLBACK_CHANNEL, "Wecker (Ersatz)", NotificationManager.IMPORTANCE_HIGH).apply {
                    setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), attrs)
                    enableVibration(true)
                },
            )
            val open = PendingIntent.getActivity(ctx, 4717, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            nm.notify(
                FALLBACK_ID,
                NotificationCompat.Builder(ctx, FALLBACK_CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_anker)
                    .setContentTitle("Anker-Wecker")
                    .setContentText("Zeit zum Aufstehen. Android hat das Dauerklingeln nicht erlaubt.")
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setContentIntent(open)
                    .setFullScreenIntent(open, true)
                    .setAutoCancel(true)
                    .build(),
            )
        }
    }

    private var player: MediaPlayer? = null
    private var tone: ToneGenerator? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var screenLock: PowerManager.WakeLock? = null
    private var focus: AudioFocusRequest? = null
    private val audioLease = AudioPlaybackLease()
    private var activeKind: AlarmKind? = null
    private var activeStartedAt = 0L
    private var fadeTick: Runnable? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val s = AlarmController.state(this)
        if (intent?.action == ACTION_STOP && AlarmMachine.shouldStopRingingService(s)) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        val kind = s.ringing
        // startForeground immer zuerst: Android beendet die App sonst nach startForegroundService
        if (!startInForeground(kind ?: AlarmKind.MAIN)) {
            AnkerPrefs.setAlarmError(this, "foreground_denied")
            AnkerPrefs.setAudioOk(this, false)
            postFallback(this)
            stopSelf()
            return START_NOT_STICKY
        }
        AnkerPrefs.setAlarmError(this, "")
        val now = System.currentTimeMillis()
        if (kind == null || AlarmMachine.ringExpired(s, now)) {
            AlarmController.timeout(this)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        // Doppelte Starts erzeugen keine zweite Klingel-Instanz
        if (activeKind != kind || activeStartedAt != s.ringStartedAt) {
            activeKind = kind
            activeStartedAt = s.ringStartedAt
            stopSound()
            startRinging(kind, kind.timeoutMs - (now - s.ringStartedAt))
            wakeScreen()
        }
        AnkerNativePlugin.notifyRinging()
        return START_STICKY
    }

    private fun textFor(kind: AlarmKind): Pair<String, String> = when (kind) {
        AlarmKind.MAIN, AlarmKind.SNOOZE -> "Aufstehen" to "Zum Beenden den QR-Code im Bad scannen."
        AlarmKind.PRE_WAKE -> "Vorwecker" to "Antippen und beenden. Der Hauptwecker bleibt gestellt."
        AlarmKind.WAKE_CHECK -> "Bist du wach?" to "Antippen und bestätigen."
        AlarmKind.TEST -> "Test-Wecker" to "Antippen und Test beenden. Dein echter Wecker bleibt gestellt."
    }

    private fun startInForeground(kind: AlarmKind): Boolean {
        ensureChannel(this)
        val b = alarmNotification(kind)
        return try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, b.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
            } else {
                startForeground(NOTIFICATION_ID, b.build())
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Bei Always-on-Display zeigen manche Geräte nur die Meldung, obwohl Vollbild erlaubt ist.
     * Deshalb: Ist der Bildschirm aus oder im Always-on-Display, kurz einschalten und das Vollbild
     * mit einer zweiten, kurzlebigen Meldung erneut anstoßen. Ändert weder Lautstärke noch Einstellungen.
     * Ist der Bildschirm schon an, zeigt Android bewusst nur die Meldung oben, daran ändert Anker nichts.
     */
    private fun wakeScreen() {
        val pm = getSystemService(PowerManager::class.java) ?: return
        if (pm.isInteractive) return
        try {
            screenLock?.let { if (it.isHeld) it.release() }
            @Suppress("DEPRECATION")
            screenLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "anker:screen",
            ).apply { acquire(15_000) }
        } catch (_: Exception) {
            return
        }
        val kind = activeKind ?: return
        handler.postDelayed({
            if (activeKind == null) return@postDelayed
            try {
                getSystemService(NotificationManager::class.java)?.notify(WAKE_ID, alarmNotification(kind).setOngoing(false).setTimeoutAfter(15_000).build())
            } catch (_: Exception) {
            }
        }, 700)
    }

    private fun alarmNotification(kind: AlarmKind): NotificationCompat.Builder {
        val open = Intent(this, MainActivity::class.java)
            .putExtra(EXTRA_ALARM, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val (title, text) = textFor(kind)
        val b = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_anker)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
        // Vor dem ersten Entsperren nach einem Neustart kann die App nicht öffnen: Ausweg direkt in der Meldung
        if (getSystemService(UserManager::class.java)?.isUserUnlocked == false) {
            val stop = PendingIntent.getBroadcast(
                this, 4718,
                Intent(this, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_STOP_LOCKED),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            b.addAction(0, "Beenden", stop)
        }
        return b
    }

    private fun alarmAttributes() = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    private fun startRinging(kind: AlarmKind, remainingMs: Long) {
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({
            AlarmController.timeout(this)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }, remainingMs.coerceAtLeast(1000))

        // Bei einem Wechsel (Vorwecker zu Hauptwecker) gilt die neue, längere Laufzeit
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = getSystemService(PowerManager::class.java)
            ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anker:alarm")
            ?.apply { acquire(remainingMs.coerceAtLeast(1000) + 5000) }
        val gentle = kind == AlarmKind.PRE_WAKE || kind == AlarmKind.WAKE_CHECK
        requestAlarmAudio(kind, activeStartedAt, if (gentle) 0.6f else 1f)

        vibrator = if (Build.VERSION.SDK_INT >= 31) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        }
        val pattern = if (gentle) longArrayOf(0, 300, 1700) else longArrayOf(0, 800, 600)
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
    }

    private fun requestAlarmAudio(kind: AlarmKind, startedAt: Long, volume: Float) {
        val id = audioLease.begin()
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(alarmAttributes())
            .setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener({ change ->
                when (change) {
                    AudioManager.AUDIOFOCUS_GAIN -> if (audioLease.gain(id)) {
                        val state = AlarmController.state(this)
                        if (activeKind == kind && state.ringing == kind && state.ringStartedAt == startedAt && !AlarmMachine.ringExpired(state, System.currentTimeMillis())) {
                            AnkerPrefs.setAudioOk(this, playFirstAvailable(playerVolume(kind, startedAt, volume), volume))
                            schedulePreWakeFade(kind, startedAt, volume)
                        } else {
                            audioLease.cancel()
                        }
                    }
                    AudioManager.AUDIOFOCUS_LOSS,
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> if (audioLease.lose(id, change != AudioManager.AUDIOFOCUS_LOSS)) {
                        stopPlayback()
                        AnkerPrefs.setAudioOk(this, false)
                    }
                }
            }, handler)
            .build()
        focus = request
        val granted = try {
            getSystemService(AudioManager::class.java)?.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } catch (_: Exception) { false }
        // Weder abgelehnter noch verzögerter Fokus bestätigt eine laufende Tonausgabe.
        AnkerPrefs.setAudioOk(this, audioLease.requested(id, granted) && playFirstAvailable(playerVolume(kind, startedAt, volume), volume))
        if (granted) schedulePreWakeFade(kind, startedAt, volume)
        if (!granted) {
            try { getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(request) } catch (_: Exception) { }
            focus = null
        }
    }

    /** Wecker-Ton, sonst Benachrichtigungs- oder Klingelton, zuletzt ein erzeugter Ton. */
    private fun playerVolume(kind: AlarmKind, startedAt: Long, maximum: Float): Float =
        if (kind == AlarmKind.PRE_WAKE && AnkerPrefs.config(this)?.preWakeFadeIn == true)
            PreWakeFadeModel.volume(System.currentTimeMillis() - startedAt, maximum) else maximum

    private fun schedulePreWakeFade(kind: AlarmKind, startedAt: Long, maximum: Float) {
        fadeTick?.let { handler.removeCallbacks(it) }; fadeTick = null
        if (kind != AlarmKind.PRE_WAKE || AnkerPrefs.config(this)?.preWakeFadeIn != true || player == null) return
        val tick = object : Runnable { override fun run() {
            if (activeKind != kind || activeStartedAt != startedAt || player == null) return
            val gain = playerVolume(kind, startedAt, maximum)
            try { player?.setVolume(gain, gain) } catch (_: Exception) { return }
            if (gain < maximum) handler.postDelayed(this, 1_000)
        } }
        fadeTick = tick; handler.post(tick)
    }

    private fun playFirstAvailable(volume: Float, fallbackVolume: Float = volume): Boolean {
        val types = intArrayOf(RingtoneManager.TYPE_ALARM, RingtoneManager.TYPE_NOTIFICATION, RingtoneManager.TYPE_RINGTONE)
        for (t in types) {
            val uri = RingtoneManager.getDefaultUri(t) ?: continue
            var candidate: MediaPlayer? = null
            try {
                candidate = MediaPlayer()
                candidate.apply {
                    setAudioAttributes(alarmAttributes())
                    setDataSource(this@AlarmService, uri)
                    isLooping = true
                    setVolume(volume, volume)
                    prepare()
                    start()
                }
                player = candidate
                return true
            } catch (_: Exception) {
                candidate?.release()
            }
        }
        return try {
            // ToneGenerator has no gain ramp. A gentle audible fallback is safer than a silent failed fade.
            val fallback = ToneGenerator(AudioManager.STREAM_ALARM, (fallbackVolume * 100).toInt())
            tone = fallback
            fallback.startTone(ToneGenerator.TONE_CDMA_HIGH_L)
        } catch (_: Exception) {
            false
        }
    }

    /** Fokusverlust stoppt nur den Ton; Alarmzustand, Vibration und Sicherheitslimit bleiben aktiv. */
    private fun stopPlayback() {
        fadeTick?.let { handler.removeCallbacks(it) }; fadeTick = null
        player?.run {
            try {
                stop()
            } catch (_: Exception) {
            }
            release()
        }
        player = null
        tone?.release()
        tone = null
    }

    private fun stopSound() {
        audioLease.cancel()
        stopPlayback()
        vibrator?.cancel()
        focus?.let { getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(it) }
        focus = null
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        stopSound()
        wakeLock?.let { if (it.isHeld) it.release() }
        screenLock?.let { if (it.isHeld) it.release() }
        getSystemService(NotificationManager::class.java)?.cancel(WAKE_ID)
        super.onDestroy()
    }
}
