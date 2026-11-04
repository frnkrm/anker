package de.frnkrm.anker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Einziger Besitzer des Weckerzustands. Receiver, Dienst und Web-App gehen alle hier durch.
 * Der Zustand liegt im Geräteschutz-Speicher, damit Planung und Klingeln auch ohne WebView
 * und vor dem ersten Entsperren funktionieren.
 */
object AlarmController {
    const val ACTION_FIRE_PREFIX = "de.frnkrm.anker.ALARM_FIRE."
    const val EXTRA_AT = "anker_at"

    private fun fireIntent(ctx: Context, kind: AlarmKind, at: Long): Intent =
        Intent(ctx, AlarmReceiver::class.java)
            .setAction(ACTION_FIRE_PREFIX + kind.wire)
            .putExtra(EXTRA_AT, at)

    private fun pending(ctx: Context, kind: AlarmKind, at: Long): PendingIntent =
        PendingIntent.getBroadcast(ctx, kind.requestCode, fireIntent(ctx, kind, at), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun existing(ctx: Context, kind: AlarmKind): PendingIntent? =
        PendingIntent.getBroadcast(ctx, kind.requestCode, fireIntent(ctx, kind, 0), PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)

    private fun showIntent(ctx: Context): PendingIntent =
        PendingIntent.getActivity(ctx, 4712, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun manager(ctx: Context) = ctx.getSystemService(AlarmManager::class.java)

    fun canExact(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 31 || manager(ctx)?.canScheduleExactAlarms() == true

    private fun arm(ctx: Context, kind: AlarmKind, at: Long) {
        val am = manager(ctx) ?: return
        if (at <= 0) {
            existing(ctx, kind)?.let {
                am.cancel(it)
                it.cancel()
            }
            return
        }
        val pi = pending(ctx, kind, at)
        try {
            if (kind == AlarmKind.TEST) {
                // Der Test erscheint nicht als „nächster Wecker“ im System
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            } else {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent(ctx)), pi)
            }
        } catch (e: SecurityException) {
            AnkerPrefs.setAlarmError(ctx, "exact_denied")
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    /** Sichtbare Prüfung: Liegt bei Android wirklich ein PendingIntent für diese Alarmart? */
    fun isArmed(ctx: Context, kind: AlarmKind): Boolean = existing(ctx, kind) != null

    /** Von früheren Versionen gesetzte Alarme (ohne Action) entfernen und den alten Stand übernehmen. */
    private fun migrateLegacy(ctx: Context) {
        if (AnkerPrefs.alarmStateJson(ctx) != null) return
        val am = manager(ctx)
        for (code in intArrayOf(AlarmKind.MAIN.requestCode, AlarmKind.SNOOZE.requestCode)) {
            PendingIntent.getBroadcast(ctx, code, Intent(ctx, AlarmReceiver::class.java), PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)?.let {
                am?.cancel(it)
                it.cancel()
            }
        }
        AnkerPrefs.saveState(
            ctx,
            AlarmState(mainAt = AnkerPrefs.alarmAt(ctx), snoozeAt = AnkerPrefs.snoozeAt(ctx), snoozeUsed = AnkerPrefs.snoozed(ctx) >= 1),
        )
    }

    @Synchronized
    fun state(ctx: Context): AlarmState {
        migrateLegacy(ctx)
        return AnkerPrefs.loadState(ctx)
    }

    /** Plant alles neu, was laut Zustand anstehen soll. Idempotent. */
    @Synchronized
    fun reconcile(ctx: Context, reason: String) {
        migrateLegacy(ctx)
        var s = AnkerPrefs.loadState(ctx)
        val now = System.currentTimeMillis()
        if (reason == "boot" && s.ringing != null) s = s.copy(ringing = null, ringStartedAt = 0)
        if (AlarmMachine.ringExpired(s, now)) s = AlarmMachine.timedOut(s, now)
        val r = AlarmMachine.reconcile(s, AnkerPrefs.config(ctx), now)
        AnkerPrefs.saveState(ctx, r.state)
        AnkerPrefs.setAlarmError(ctx, "")
        AnkerPrefs.setLastReconcile(ctx, now, reason)
        arm(ctx, AlarmKind.MAIN, r.state.mainAt.takeIf { it > now } ?: 0)
        arm(ctx, AlarmKind.PRE_WAKE, r.state.preWakeAt)
        arm(ctx, AlarmKind.SNOOZE, r.state.snoozeAt.takeIf { it > now } ?: 0)
        arm(ctx, AlarmKind.WAKE_CHECK, r.state.wakeCheckAt)
        arm(ctx, AlarmKind.TEST, r.state.testAt)
        r.fireLate?.let { onFire(ctx, it, if (it == AlarmKind.MAIN) r.state.mainAt else r.state.snoozeAt) }
    }

    /** Alarmzeitpunkt erreicht. Danach sofort den nächsten Morgen planen, unabhängig von der App. */
    @Synchronized
    fun onFire(ctx: Context, kind: AlarmKind, at: Long) {
        val now = System.currentTimeMillis()
        val d = AlarmMachine.fired(state(ctx), kind, at, now)
        AnkerPrefs.saveState(ctx, d.state)
        if (d.ring) startRinging(ctx)
        reconcile(ctx, "fired")
    }

    private fun startRinging(ctx: Context) {
        ReminderScheduler.onAlarmStarted(ctx)
        try {
            ContextCompat.startForegroundService(ctx, Intent(ctx, AlarmService::class.java))
        } catch (e: Exception) {
            // Sollte mit exaktem Alarm erlaubt sein. Falls nicht: sichtbarer Ersatz statt Stille.
            AnkerPrefs.setAlarmError(ctx, "ring_start_failed")
            AlarmService.postFallback(ctx)
        }
    }

    @Synchronized
    fun stop(ctx: Context, method: String) {
        val now = System.currentTimeMillis()
        AnkerPrefs.saveState(ctx, AlarmMachine.stopped(state(ctx), method, AnkerPrefs.config(ctx), now))
        AlarmService.stop(ctx)
        reconcile(ctx, "stopped")
    }

    @Synchronized
    fun snooze(ctx: Context, minutes: Int): Boolean {
        val next = AlarmMachine.snoozed(state(ctx), minutes, System.currentTimeMillis()) ?: return false
        AnkerPrefs.saveState(ctx, next)
        AlarmService.stop(ctx)
        reconcile(ctx, "snoozed")
        return true
    }

    @Synchronized
    fun timeout(ctx: Context) {
        AnkerPrefs.saveState(ctx, AlarmMachine.timedOut(state(ctx), System.currentTimeMillis()))
        reconcile(ctx, "timeout")
    }

    @Synchronized
    fun scheduleTest(ctx: Context, seconds: Int): Long {
        val now = System.currentTimeMillis()
        val at = now + seconds.coerceIn(5, 60) * 1000L
        AnkerPrefs.saveState(ctx, state(ctx).copy(testAt = at, testResult = "scheduled", testResultAt = now))
        arm(ctx, AlarmKind.TEST, at)
        return at
    }

    @Synchronized
    fun confirmTest(ctx: Context, heard: Boolean) {
        AnkerPrefs.saveState(ctx, state(ctx).copy(testResult = if (heard) "heard" else "not-heard", testResultAt = System.currentTimeMillis()))
    }

    @Synchronized
    fun syncConfig(ctx: Context, cfg: AlarmConfig) {
        AnkerPrefs.setConfig(ctx, cfg)
        reconcile(ctx, "config")
    }
}
