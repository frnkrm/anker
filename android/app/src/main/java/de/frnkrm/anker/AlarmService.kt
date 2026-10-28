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
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Klingelt im Vordergrund, bis der Wecker in der App per QR-Code (oder Rechenaufgaben)
 * ausgeschaltet wird. Sicherheitsnetz: nach 30 Minuten automatisch still.
 */
class AlarmService : Service() {
    companion object {
        const val EXTRA_ALARM = "anker_alarm"
        const val ACTION_STOP = "de.frnkrm.anker.ALARM_STOP"
        private const val CHANNEL = "anker_wecker_alarm"
        private const val NOTIFICATION_ID = 7001
        private const val MAX_RING_MS = 30 * 60_000L

        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, AlarmService::class.java).setAction(ACTION_STOP))
        }
    }

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            AnkerPrefs.setRinging(this, false)
            stopSelf()
            return START_NOT_STICKY
        }
        AnkerPrefs.setRinging(this, true)
        startInForeground()
        startRinging()
        handler.postDelayed({ stopSelf() }, MAX_RING_MS)
        AnkerNativePlugin.notifyRinging()
        return START_STICKY
    }

    private fun startInForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        val ch = NotificationChannel(CHANNEL, "Wecker (klingelt)", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Der Anker-Wecker"
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            if (nm.isNotificationPolicyAccessGranted) setBypassDnd(true)
        }
        nm.createNotificationChannel(ch)

        val open = Intent(this, MainActivity::class.java)
            .putExtra(EXTRA_ALARM, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val n = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_anker)
            .setContentTitle(AnkerPrefs.alarmLabel(this))
            .setContentText("Zum Ausschalten den QR-Code im Bad scannen.")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
        } else {
            startForeground(NOTIFICATION_ID, n)
        }
    }

    private fun startRinging() {
        wakeLock = getSystemService(PowerManager::class.java)
            ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anker:alarm")
            ?.apply { acquire(MAX_RING_MS) }
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            player?.release()
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(this@AlarmService, uri)
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {
            // Ohne Ton bleibt zumindest die Vibration
        }
        vibrator = if (Build.VERSION.SDK_INT >= 31) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        }
        vibrator?.vibrate(
            VibrationEffect.createWaveform(longArrayOf(0, 800, 600), 0),
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build(),
        )
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        player?.run {
            try {
                stop()
            } catch (_: Exception) {
            }
            release()
        }
        player = null
        vibrator?.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
        AnkerPrefs.setRinging(this, false)
        super.onDestroy()
    }
}
