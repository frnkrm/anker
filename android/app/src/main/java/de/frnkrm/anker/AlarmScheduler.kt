package de.frnkrm.anker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/**
 * Plant den Wecker mit AlarmManager.setAlarmClock (exakt, auch im Doze, mit Wecker-Symbol).
 * Der Schlummer-Wecker hat einen eigenen PendingIntent, damit das Neuplanen
 * des nächsten Morgens ihn nicht ersetzt.
 */
object AlarmScheduler {
    const val EXTRA_SNOOZE = "anker_snooze"
    private const val REQUEST = 4711
    private const val REQUEST_SNOOZE = 4713

    private fun fireIntent(ctx: Context, snooze: Boolean): PendingIntent =
        PendingIntent.getBroadcast(
            ctx,
            if (snooze) REQUEST_SNOOZE else REQUEST,
            Intent(ctx, AlarmReceiver::class.java).putExtra(EXTRA_SNOOZE, snooze),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun showIntent(ctx: Context): PendingIntent =
        PendingIntent.getActivity(
            ctx, REQUEST + 1, Intent(ctx, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun schedule(ctx: Context, at: Long, label: String) {
        AnkerPrefs.setAlarm(ctx, at, label)
        setSystemAlarm(ctx, at, snooze = false)
    }

    fun snooze(ctx: Context, at: Long) {
        AnkerPrefs.setSnooze(ctx, at)
        setSystemAlarm(ctx, at, snooze = true)
    }

    private fun setSystemAlarm(ctx: Context, at: Long, snooze: Boolean) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val fire = fireIntent(ctx, snooze)
        try {
            am.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent(ctx)), fire)
        } catch (e: SecurityException) {
            // Ohne Exakt-Recht: so genau wie möglich
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire)
        }
    }

    fun cancel(ctx: Context) {
        ctx.getSystemService(AlarmManager::class.java)?.cancel(fireIntent(ctx, snooze = false))
        AnkerPrefs.clearAlarm(ctx)
        cancelSnooze(ctx)
    }

    fun cancelSnooze(ctx: Context) {
        ctx.getSystemService(AlarmManager::class.java)?.cancel(fireIntent(ctx, snooze = true))
        AnkerPrefs.clearSnooze(ctx)
    }

    /** Nach Neustart oder Zeitänderung: beide Wecker wieder setzen, sofern sie noch anstehen. */
    fun restore(ctx: Context) {
        val now = System.currentTimeMillis()
        val at = AnkerPrefs.alarmAt(ctx)
        if (at > now) setSystemAlarm(ctx, at, snooze = false)
        val snoozeAt = AnkerPrefs.snoozeAt(ctx)
        if (snoozeAt > now) setSystemAlarm(ctx, snoozeAt, snooze = true)
    }
}
