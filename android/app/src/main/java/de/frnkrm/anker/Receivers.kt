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
        if (action == null) {
            // Ein alter Alarm ohne Action darf nur über den migrierten, gespeicherten Termin
            // nachgeholt werden; niemals aus einer leeren Nachricht einen Hauptwecker erfinden.
            AlarmController.reconcile(ctx, "legacy-fire")
            return
        }
        val kind = AlarmKind.fromFireAction(action) ?: return
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
        val reason = when (intent.action) {
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> "locked-boot"
            Intent.ACTION_BOOT_COMPLETED -> "boot"
            else -> "system"
        }
        AlarmController.reconcile(ctx, reason)
        ReminderScheduler.reconcile(ctx)
        // Beim gesperrten Start ist der normale Speicher des Widgets noch nicht bereit
        if (intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED) AnkerWidget.refreshAll(ctx)
    }
}
