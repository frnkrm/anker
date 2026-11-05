package de.frnkrm.anker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Ein Weckzeitpunkt ist erreicht (oder der Ausweg vor dem ersten Entsperren wurde angetippt). */
class AlarmReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_STOP_LOCKED = "de.frnkrm.anker.ALARM_STOP_LOCKED"
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        val action = intent.action
        if (action == ACTION_STOP_LOCKED) {
            AlarmController.stop(ctx, "locked")
            return
        }
        val kind = action?.removePrefix(AlarmController.ACTION_FIRE_PREFIX)?.let { AlarmKind.of(it) } ?: AlarmKind.MAIN
        AlarmController.onFire(ctx, kind, intent.getLongExtra(AlarmController.EXTRA_AT, 0L))
    }
}

/**
 * Neustart, Update, Uhrzeit- oder Zeitzonenänderung, Rechteänderung: alles neu abgleichen.
 * Die Sommerzeit braucht kein eigenes Signal, weil Zeitpunkte in UTC vorliegen und mit den
 * Berliner Regeln berechnet werden.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val boot = intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED
        AlarmController.reconcile(ctx, if (boot) "boot" else "system")
        ReminderScheduler.reconcile(ctx)
        // Beim gesperrten Start ist der normale Speicher des Widgets noch nicht bereit
        if (intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED) AnkerWidget.refreshAll(ctx)
    }
}
