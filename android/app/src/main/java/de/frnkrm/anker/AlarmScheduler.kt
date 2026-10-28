package de.frnkrm.anker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/** Plant den Wecker mit AlarmManager.setAlarmClock (exakt, auch im Doze, mit Wecker-Symbol). */
object AlarmScheduler {
    private const val REQUEST = 4711

    private fun fireIntent(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(
            ctx, REQUEST, Intent(ctx, AlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun showIntent(ctx: Context): PendingIntent =
        PendingIntent.getActivity(
            ctx, REQUEST + 1, Intent(ctx, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun schedule(ctx: Context, at: Long, label: String) {
        AnkerPrefs.setAlarm(ctx, at, label)
        setSystemAlarm(ctx, at)
    }

    /** Nach Neustart, Zeitänderung oder Schlummern. Behält Label und Schlummer-Zähler. */
    fun setSystemAlarm(ctx: Context, at: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        try {
            am.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent(ctx)), fireIntent(ctx))
        } catch (e: SecurityException) {
            // Ohne Exakt-Recht: so genau wie möglich
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fireIntent(ctx))
        }
    }

    fun cancel(ctx: Context) {
        ctx.getSystemService(AlarmManager::class.java)?.cancel(fireIntent(ctx))
        AnkerPrefs.clearAlarm(ctx)
    }

    fun restore(ctx: Context) {
        val at = AnkerPrefs.alarmAt(ctx)
        if (at > System.currentTimeMillis()) setSystemAlarm(ctx, at)
    }
}
