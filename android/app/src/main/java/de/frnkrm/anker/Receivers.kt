package de.frnkrm.anker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Der Wecker-Zeitpunkt ist erreicht: Klingel-Dienst starten. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        AnkerPrefs.clearAlarm(ctx)
        ContextCompat.startForegroundService(ctx, Intent(ctx, AlarmService::class.java))
    }
}

/** Nach Neustart, Update oder Zeitänderung: Wecker und Widget wiederherstellen. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        AlarmScheduler.restore(ctx)
        AnkerWidget.refreshAll(ctx)
    }
}
