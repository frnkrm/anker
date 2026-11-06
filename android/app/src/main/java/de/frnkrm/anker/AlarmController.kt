package de.frnkrm.anker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Einziger Besitzer des Weckerzustands. Receiver, Dienst und Web-App gehen alle hier durch.
 * Der Zustand liegt im Geräteschutz-Speicher, damit Planung und Klingeln auch ohne WebView
 * und vor dem ersten Entsperren funktionieren.
 */
object AlarmController {
    const val ACTION_FIRE_PREFIX = AlarmKind.FIRE_ACTION_PREFIX
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

    /** Ein PendingIntent-Token existiert. Das bestätigt weder Zustellung noch Hörbarkeit. */
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
        val before = AnkerPrefs.loadState(ctx)
        var s = before
        val now = System.currentTimeMillis()
        if (reason == "boot" || reason == "locked-boot") {
            val bootCount = Settings.Global.getInt(ctx.contentResolver, Settings.Global.BOOT_COUNT, -1).takeIf { it >= 0 }
            s = AlarmMachine.booted(s, bootCount, reason == "locked-boot")
        }
        if (AlarmMachine.ringExpired(s, now)) s = AlarmMachine.timedOut(s, now)
        val r = AlarmMachine.reconcile(s, AnkerPrefs.config(ctx), now)
        AnkerPrefs.saveState(ctx, r.state)
        if (before.ringing != null && AlarmMachine.shouldStopRingingService(r.state)) AlarmService.stop(ctx)
        if (AnkerPrefs.alarmError(ctx) == "exact_denied") AnkerPrefs.setAlarmError(ctx, "")
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
        val d = AlarmMachine.firedScheduled(state(ctx), kind, at, now)
        AnkerPrefs.saveState(ctx, d.state)
        if (d.ring && kind == AlarmKind.MAIN) SmartWakeService.stopIfRunning("Der feste Hauptwecker übernimmt.")
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
    fun trySmartWake(ctx: Context, targetAt: Long): Boolean {
        val now = System.currentTimeMillis()
        val decision = AlarmMachine.smartFired(state(ctx), AnkerPrefs.config(ctx), targetAt, now)
        if (!decision.ring) return false
        AnkerPrefs.saveState(ctx, decision.state)
        startRinging(ctx)
        reconcile(ctx, "smart-fired")
        return true
    }

    @Synchronized
    fun stop(ctx: Context, method: String) {
        val now = System.currentTimeMillis()
        val next = AlarmMachine.stopped(state(ctx), method, AnkerPrefs.config(ctx), now)
        AnkerPrefs.saveState(ctx, next)
        if (AlarmMachine.shouldStopRingingService(next)) AlarmService.stop(ctx)
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
        val next = AlarmMachine.timedOut(state(ctx), System.currentTimeMillis())
        AnkerPrefs.saveState(ctx, next)
        if (AlarmMachine.shouldStopRingingService(next)) AlarmService.stop(ctx)
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
        SmartWakeService.planChanged()
    }
}
