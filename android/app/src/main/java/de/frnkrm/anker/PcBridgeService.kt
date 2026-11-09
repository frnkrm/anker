package de.frnkrm.anker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** User-started visible connection keeper. A disconnected PC never blocks the local alarm. */
class PcBridgeService : Service() {
    private val worker = Executors.newSingleThreadScheduledExecutor()
    private var loop: ScheduledFuture<*>? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            worker.execute { try { PcBridgeClient.stop(applicationContext) } finally { stopSelf() } }
            return START_NOT_STICKY
        }
        return try {
            val notification = notification()
            foreground = true
            ReminderScheduler.onProtectedDisplaysChanged(this)
            if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
            else startForeground(NOTIFICATION_ID, notification)
            if (loop == null) loop = worker.scheduleWithFixedDelay({
                try {
                    if (!PcBridgeClient.state(applicationContext).optBoolean("requestedActive")) stopSelf()
                    else PcBridgeClient.tick(applicationContext)
                } catch (_: Exception) {
                    // Error details stay in the typed state; no texts, hostnames or keys in logs.
                }
            }, 0, 5, TimeUnit.SECONDS)
            START_STICKY
        } catch (_: Exception) {
            foreground = false
            try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
            PcBridgeClient.serviceFailed(applicationContext, "PC_FOREGROUND_NOT_ALLOWED")
            stopSelf()
            START_NOT_STICKY
        }
    }

    override fun onDestroy() {
        loop?.cancel(false); loop = null
        worker.shutdownNow()
        PcBridgeClient.serviceDestroyed()
        foreground = false
        try { ReminderScheduler.onProtectedDisplaysChanged(this) } catch (_: Exception) { }
        super.onDestroy()
    }

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "PC-Verbindung", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Sichtbarer Status der bewusst gestarteten lokalen PC-Verbindung"
            setShowBadge(false)
        })
        val open = Intent(Intent.ACTION_VIEW, Uri.parse("$packageName://now"), this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val content = PendingIntent.getActivity(this, NOTIFICATION_ID, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stop = PendingIntent.getService(this, NOTIFICATION_ID + 1, Intent(this, PcBridgeService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_share)
            .setContentTitle("Anker PC-Verbindung")
            .setContentText("Der lokale Abgleich ist aktiv. Den Empfang siehst du in Anker.")
            .setContentIntent(content).setOngoing(true).setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .addAction(Notification.Action.Builder(null, "Verbindung beenden", stop).build()).build()
    }

    companion object {
        const val ACTION_START = "de.frnkrm.anker.PC_BRIDGE_START"
        const val ACTION_STOP = "de.frnkrm.anker.PC_BRIDGE_STOP"
        private const val CHANNEL = "anker_pc_bridge"
        const val NOTIFICATION_ID = 43_180
        @Volatile private var foreground = false
        fun hasForeground(): Boolean = foreground
    }
}
