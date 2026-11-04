package de.frnkrm.anker

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Erinnerungen ohne laufendes JavaScript: Die App legt die Warteschlange für zwei Wochen ab,
 * Android weckt immer nur für den nächsten Eintrag. Ein einziger geplanter Alarm, keine Hintergrundschleife.
 * Betrifft nur Ankers eigene Meldungen, nie die anderer Apps.
 */
object ReminderScheduler {
    private const val REQUEST_TICK = 4800
    const val ACTION_TICK = "de.frnkrm.anker.REMINDER_TICK"
    const val ACTION_DONE = "de.frnkrm.anker.REMINDER_DONE"
    const val ACTION_SNOOZE = "de.frnkrm.anker.REMINDER_SNOOZE"
    const val ACTION_SKIP = "de.frnkrm.anker.REMINDER_SKIP"
    const val ACTION_SWIPED = "de.frnkrm.anker.REMINDER_SWIPED"
    private const val EXTRA_KEY = "key"
    private const val EXTRA_DATE = "date"
    private const val EXTRA_SNOOZES = "snoozes"

    // ---------- Speicher ----------
    fun entryFromJson(o: JSONObject) = ReminderEntry(
        key = o.getString("key"),
        date = o.getString("date"),
        at = o.getLong("at"),
        channel = o.optString("channel", "sanft"),
        title = o.optString("title"),
        body = o.optString("body"),
        actions = o.optBoolean("actions"),
        slot = o.optInt("slot", ReminderLogic.SLOT_LATEST),
        rank = o.optInt("rank", 1),
        exact = o.optBoolean("exact", true),
        snoozes = o.optInt("snoozes", 0),
    )

    private fun entryToJson(e: ReminderEntry) = JSONObject()
        .put("key", e.key).put("date", e.date).put("at", e.at).put("channel", e.channel)
        .put("title", e.title).put("body", e.body).put("actions", e.actions)
        .put("slot", e.slot).put("rank", e.rank).put("exact", e.exact).put("snoozes", e.snoozes)

    private fun loadQueue(ctx: Context): List<ReminderEntry> = try {
        val a = JSONArray(AnkerPrefs.reminderQueue(ctx))
        (0 until a.length()).map { entryFromJson(a.getJSONObject(it)) }
    } catch (_: Exception) {
        emptyList()
    }

    private fun saveQueue(ctx: Context, q: List<ReminderEntry>) {
        val a = JSONArray()
        q.forEach { a.put(entryToJson(it)) }
        AnkerPrefs.setReminderQueue(ctx, a.toString())
    }

    private fun loadSlots(ctx: Context): List<SlotEntry> = try {
        val a = JSONArray(AnkerPrefs.reminderSlots(ctx))
        (0 until a.length()).map {
            val o = a.getJSONObject(it)
            SlotEntry(o.getInt("slot"), o.getString("key"), o.getString("date"), o.getInt("rank"), o.getLong("expiresAt"))
        }
    } catch (_: Exception) {
        emptyList()
    }

    private fun saveSlots(ctx: Context, s: List<SlotEntry>) {
        val a = JSONArray()
        s.forEach { a.put(JSONObject().put("slot", it.slot).put("key", it.key).put("date", it.date).put("rank", it.rank).put("expiresAt", it.expiresAt)) }
        AnkerPrefs.setReminderSlots(ctx, a.toString())
    }

    // ---------- Von der App ----------
    @Synchronized
    fun sync(ctx: Context, incoming: List<ReminderEntry>, relevant: Set<String>) {
        val now = System.currentTimeMillis()
        val q = ReminderLogic.replace(loadQueue(ctx), incoming, now)
        saveQueue(ctx, q)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val slots = loadSlots(ctx)
        val gone = ReminderLogic.obsolete(slots, relevant, now)
        gone.forEach { nm.cancel(ReminderLogic.notificationId(it.slot)) }
        saveSlots(ctx, slots - gone.toSet())
        armNext(ctx, q)
    }

    @Synchronized
    fun drainActions(ctx: Context): String {
        val json = AnkerPrefs.reminderActions(ctx)
        AnkerPrefs.setReminderActions(ctx, "[]")
        return json
    }

    fun queueInfo(ctx: Context): Pair<Int, Long> {
        val q = loadQueue(ctx)
        return q.size to (q.lastOrNull()?.at ?: 0L)
    }

    fun visibleCount(ctx: Context): Int {
        val now = System.currentTimeMillis()
        return loadSlots(ctx).count { it.expiresAt > now }
    }

    // ---------- Vom System ----------
    @Synchronized
    fun reconcile(ctx: Context) {
        tick(ctx)
    }

    @Synchronized
    fun tick(ctx: Context) {
        val now = System.currentTimeMillis()
        val r = ReminderLogic.takeDue(loadQueue(ctx), now)
        saveQueue(ctx, r.remaining)
        val ringing = AnkerPrefs.isRinging(ctx)
        var slots = loadSlots(ctx)
        for (e in r.due) {
            val p = ReminderLogic.place(slots, e, now, ringing)
            slots = p.slots
            p.slot?.let { post(ctx, e, it) }
        }
        saveSlots(ctx, slots)
        armNext(ctx, r.remaining)
    }

    /** Der laufende Wecker ist die eine Meldung, die nie weichen darf. Also weicht die unwichtigste normale. */
    @Synchronized
    fun onAlarmStarted(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.cancel(ReminderLogic.notificationId(ReminderLogic.SLOT_LATEST))
        saveSlots(ctx, loadSlots(ctx).filter { it.slot != ReminderLogic.SLOT_LATEST })
    }

    private fun tickIntent(ctx: Context) = PendingIntent.getBroadcast(
        ctx, REQUEST_TICK,
        Intent(ctx, ReminderReceiver::class.java).setAction(ACTION_TICK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun armNext(ctx: Context, q: List<ReminderEntry>) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val next = q.firstOrNull()
        val pi = tickIntent(ctx)
        if (next == null) {
            am.cancel(pi)
            return
        }
        try {
            if (next.exact && AlarmController.canExact(ctx)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pi)
            }
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pi)
        }
    }

    private fun ensureChannels(ctx: Context) {
        // Gleiche IDs wie in 1.0.x: vorhandene Kanäle und deine Einstellungen dazu bleiben unverändert
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val defs = listOf(
            Triple("wecker", "Wecker", NotificationManager.IMPORTANCE_HIGH),
            Triple("uebergang", "Übergänge", NotificationManager.IMPORTANCE_HIGH),
            Triple("sanft", "Sanft", NotificationManager.IMPORTANCE_DEFAULT),
        )
        for ((id, name, imp) in defs) {
            if (nm.getNotificationChannel(id) == null) nm.createNotificationChannel(NotificationChannel(id, name, imp))
        }
    }

    private fun actionIntent(ctx: Context, action: String, e: ReminderEntry, slot: Int, idx: Int) = PendingIntent.getBroadcast(
        ctx, 4900 + slot * 10 + idx,
        Intent(ctx, ReminderReceiver::class.java).setAction(action)
            .putExtra(EXTRA_KEY, e.key).putExtra(EXTRA_DATE, e.date).putExtra(EXTRA_SNOOZES, e.snoozes),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun post(ctx: Context, e: ReminderEntry, slot: Int) {
        ensureChannels(ctx)
        val open = PendingIntent.getActivity(
            ctx, 4950 + slot,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val b = NotificationCompat.Builder(ctx, e.channel)
            .setSmallIcon(R.drawable.ic_stat_anker)
            .setContentTitle(e.title)
            .setContentText(e.body)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setTimeoutAfter(ReminderLogic.VISIBLE_MS)
            .setDeleteIntent(actionIntent(ctx, ACTION_SWIPED, e, slot, 0))
        if (e.actions) {
            b.addAction(0, "Erledigt", actionIntent(ctx, ACTION_DONE, e, slot, 1))
            if (e.snoozes < ReminderLogic.MAX_SNOOZE) b.addAction(0, "5 Min später", actionIntent(ctx, ACTION_SNOOZE, e, slot, 2))
            b.addAction(0, "Heute nicht", actionIntent(ctx, ACTION_SKIP, e, slot, 3))
        }
        try {
            ctx.getSystemService(NotificationManager::class.java).notify(ReminderLogic.notificationId(slot), b.build())
        } catch (_: SecurityException) {
            // Benachrichtigungen nicht erlaubt: zeigt der Einrichtungs-Check an
        }
        // Eintrag für „5 Min später“ merken, auch wenn die App geschlossen ist
        rememberShown(ctx, e)
    }

    private fun rememberShown(ctx: Context, e: ReminderEntry) {
        AnkerPrefs.setReminderLastShown(ctx, e.date, e.key, entryToJson(e).toString())
    }

    @Synchronized
    fun onAction(ctx: Context, intent: Intent) {
        val action = intent.action ?: return
        val key = intent.getStringExtra(EXTRA_KEY) ?: return
        val date = intent.getStringExtra(EXTRA_DATE) ?: return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val slots = loadSlots(ctx)
        val occupant = ReminderLogic.slotOf(slots, date, key)
        if (action == ACTION_SWIPED) {
            if (occupant != null) saveSlots(ctx, slots - occupant)
            return
        }
        occupant?.let { nm.cancel(ReminderLogic.notificationId(it.slot)) }
        if (occupant != null) saveSlots(ctx, slots - occupant)

        val now = System.currentTimeMillis()
        val queue = loadQueue(ctx)
        val next = when (action) {
            ACTION_SNOOZE -> {
                val source = AnkerPrefs.reminderLastShown(ctx, date, key)?.let {
                    try {
                        entryFromJson(JSONObject(it))
                    } catch (_: Exception) {
                        null
                    }
                }
                source?.let { ReminderLogic.snooze(queue, it, now) } ?: queue
            }
            else -> {
                val a = JSONArray(AnkerPrefs.reminderActions(ctx))
                a.put(JSONObject().put("action", if (action == ACTION_DONE) "done" else "skip").put("key", key).put("date", date).put("at", now))
                AnkerPrefs.setReminderActions(ctx, a.toString())
                ReminderLogic.withoutKey(queue, date, key)
            }
        }
        saveQueue(ctx, next)
        armNext(ctx, next)
        if (action != ACTION_SNOOZE) AnkerNativePlugin.notifyReminderAction()
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == ReminderScheduler.ACTION_TICK) ReminderScheduler.tick(ctx) else ReminderScheduler.onAction(ctx, intent)
    }
}
