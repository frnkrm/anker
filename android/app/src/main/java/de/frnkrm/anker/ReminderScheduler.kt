package de.frnkrm.anker

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Erinnerungen ohne laufendes JavaScript: Die App legt die Warteschlange für zwei Wochen ab,
 * Android weckt nur für den nächsten exakten und den nächsten ungenauen Eintrag. Keine Hintergrundschleife.
 * Betrifft nur Ankers eigene Meldungen, nie die anderer Apps.
 */
object ReminderScheduler {
    private const val REQUEST_TICK_EXACT = 4800
    private const val REQUEST_TICK_INEXACT = 4801
    const val ACTION_TICK = "de.frnkrm.anker.REMINDER_TICK"
    const val ACTION_DONE = "de.frnkrm.anker.REMINDER_DONE"
    const val ACTION_SNOOZE = "de.frnkrm.anker.REMINDER_SNOOZE"
    const val ACTION_SKIP = "de.frnkrm.anker.REMINDER_SKIP"
    const val ACTION_SWIPED = "de.frnkrm.anker.REMINDER_SWIPED"
    private const val EXTRA_KEY = "key"
    private const val EXTRA_DATE = "date"
    private const val EXTRA_SNOOZES = "snoozes"
    private const val EXTRA_REVISION = "revision"
    private const val EXTRA_TOKEN = "token"

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
        revision = o.optString("revision"),
        token = o.optString("token"),
        critical = o.optBoolean("critical", false),
        ruleId = o.optString("ruleId"),
    )

    private fun entryToJson(e: ReminderEntry) = JSONObject()
        .put("key", e.key).put("date", e.date).put("at", e.at).put("channel", e.channel)
        .put("title", e.title).put("body", e.body).put("actions", e.actions)
        .put("slot", e.slot).put("rank", e.rank).put("exact", e.exact).put("snoozes", e.snoozes)
        .put("revision", e.revision).put("token", e.token).put("critical", e.critical).put("ruleId", e.ruleId)

    private fun loadQueue(ctx: Context): List<ReminderEntry> = try {
        val a = JSONArray(AnkerPrefs.reminderQueue(ctx))
        (0 until a.length()).map { entryFromJson(a.getJSONObject(it)) }
    } catch (_: Exception) {
        emptyList()
    }

    private fun queueJson(q: List<ReminderEntry>): String {
        val a = JSONArray()
        q.forEach { a.put(entryToJson(it)) }
        return a.toString()
    }
    private fun saveQueue(ctx: Context, q: List<ReminderEntry>) = AnkerPrefs.setReminderQueue(ctx, queueJson(q))

    private fun loadSlots(ctx: Context): List<SlotEntry> = try {
        val a = JSONArray(AnkerPrefs.reminderSlots(ctx))
        (0 until a.length()).map {
            val o = a.getJSONObject(it)
            SlotEntry(o.getInt("slot"), o.getString("key"), o.getString("date"), o.getInt("rank"), o.getLong("expiresAt"), o.optString("revision"), o.optString("token"))
        }
    } catch (_: Exception) {
        emptyList()
    }

    private fun slotsJson(s: List<SlotEntry>): String {
        val a = JSONArray()
        s.forEach { a.put(JSONObject().put("slot", it.slot).put("key", it.key).put("date", it.date).put("rank", it.rank).put("expiresAt", it.expiresAt).put("revision", it.revision).put("token", it.token)) }
        return a.toString()
    }
    private fun saveSlots(ctx: Context, s: List<SlotEntry>) = AnkerPrefs.setReminderSlots(ctx, slotsJson(s))

    // ---------- Von der App ----------
    @Synchronized
    fun sync(ctx: Context, incoming: List<ReminderEntry>, relevant: Set<String>, revisions: Map<String, String>, policyJson: JSONObject, rulesJson: JSONObject) {
        val now = System.currentTimeMillis()
        AnkerPrefs.setReminderRevisions(ctx, JSONObject(revisions).toString())
        AnkerPrefs.setReminderPolicy(ctx, policyJson.toString())
        AnkerPrefs.setReminderRules(ctx, rulesJson.toString())
        val consumed = consumedTokens(ctx)
        val q = continueRules(ctx, ReminderLogic.replace(loadQueue(ctx), incoming.filter { !consumed.has(it.token) }, relevant, now, revisions), now)
        saveQueue(ctx, q)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val slots = loadSlots(ctx)
        val gone = ReminderLogic.obsolete(slots, relevant, now, revisions)
        gone.forEach { nm.cancel(ReminderLogic.notificationId(it.slot)) }
        saveSlots(ctx, slots - gone.toSet())
        onProtectedDisplaysChanged(ctx)
        armNext(ctx, q)
    }

    @Synchronized
    fun drainActions(ctx: Context): String {
        val actions = JSONArray(AnkerPrefs.reminderActions(ctx))
        var changed = false
        for (i in 0 until actions.length()) actions.getJSONObject(i).let {
            if (it.optString("id").isEmpty()) { it.put("id", "legacy:" + java.util.UUID.randomUUID().toString()); changed = true }
        }
        if (changed) AnkerPrefs.setReminderActions(ctx, actions.toString())
        return actions.toString()
    }

    @Synchronized
    fun acknowledgeActions(ctx: Context, ids: Set<String>) {
        val old = JSONArray(AnkerPrefs.reminderActions(ctx))
        val remaining = JSONArray()
        for (i in 0 until old.length()) old.getJSONObject(i).let { if (it.optString("id") !in ids) remaining.put(it) }
        AnkerPrefs.setReminderActions(ctx, remaining.toString())
    }

    private fun policy(ctx: Context): ReminderPolicy = try {
        val o = JSONObject(AnkerPrefs.reminderPolicy(ctx))
        val ranges = o.optJSONArray("ranges") ?: JSONArray()
        ReminderPolicy(o.optInt("quietStart"), o.optInt("quietEnd"), (0 until ranges.length()).map { val r = ranges.getJSONObject(it); ReminderQuietRange(r.getLong("from"), r.getLong("to")) })
    } catch (_: Exception) { ReminderPolicy() }

    @Synchronized
    fun setFocus(ctx: Context, until: Long) {
        val now = System.currentTimeMillis()
        AnkerPrefs.setReminderFocusUntil(ctx, until.coerceIn(0, now + 12 * 3600_000L))
        onProtectedDisplaysChanged(ctx)
    }

    private fun protectedDisplays(ctx: Context): Int = (if (AnkerPrefs.isRinging(ctx)) 1 else 0) + (if (SmartWakeService.hasForeground()) 1 else 0)

    private fun ruleSnapshot(ctx: Context): NativeReminderRuleSnapshot? = try {
        val o = JSONObject(AnkerPrefs.reminderRules(ctx))
        val arr = o.getJSONArray("rules")
        val dates = o.optJSONArray("excludedDates") ?: JSONArray()
        NativeReminderRuleSnapshot(o.getLong("validFrom"), (0 until dates.length()).map { dates.getString(it) }.toSet(), (0 until arr.length()).map {
            val r = arr.getJSONObject(it)
            NativeReminderRule(r.getString("ruleId"), r.getString("key"), r.getInt("weekday"), r.getInt("minute"), r.getString("channel"), r.getString("title"), r.getString("body"), r.getInt("slot"), r.getInt("rank"), r.getBoolean("exact"), r.getString("revision"))
        })
    } catch (_: Exception) { null }

    /** Fill only one strictly future occurrence per baseline rule; no replay of missed days. */
    private fun continueRules(ctx: Context, queue: List<ReminderEntry>, now: Long): List<ReminderEntry> {
        val snapshot = ruleSnapshot(ctx) ?: return queue
        val consumed = try { JSONObject(AnkerPrefs.reminderRuleConsumed(ctx)) } catch (_: Exception) { JSONObject() }
        val out = queue.toMutableList()
        for (rule in snapshot.rules) {
            if (out.any { it.ruleId == rule.ruleId && it.at > now }) continue
            val occurrence = ReminderRules.nextOccurrence(rule, snapshot, now, consumed.optLong(rule.ruleId)) ?: continue
            out.add(ReminderEntry(rule.key, occurrence.date, occurrence.at, rule.channel, rule.title, rule.body, false, rule.slot, rule.rank, rule.exact,
                revision = rule.revision + "|" + occurrence.date, token = java.util.UUID.randomUUID().toString(), critical = true, ruleId = rule.ruleId))
        }
        return out.sortedBy { it.at }
    }

    private fun consumeRules(ctx: Context, queue: List<ReminderEntry>, now: Long) {
        val consumed = try { JSONObject(AnkerPrefs.reminderRuleConsumed(ctx)) } catch (_: Exception) { JSONObject() }
        for (e in queue) if (e.ruleId.isNotEmpty() && e.at <= now) consumed.put(e.ruleId, maxOf(consumed.optLong(e.ruleId), e.at))
        AnkerPrefs.setReminderRuleConsumed(ctx, consumed.toString())
    }

    private fun consumedTokens(ctx: Context): JSONObject = try { JSONObject(AnkerPrefs.reminderConsumedTokens(ctx)) } catch (_: Exception) { JSONObject() }

    private fun consumeTokens(ctx: Context, entries: List<ReminderEntry>) {
        val tokens = consumedTokens(ctx)
        entries.filter { it.token.isNotEmpty() }.forEach { tokens.put(it.token, it.at) }
        val keys = tokens.keys().asSequence().sortedByDescending { tokens.optLong(it) }.take(2048).toList()
        val bounded = JSONObject()
        keys.forEach { bounded.put(it, tokens.getLong(it)) }
        AnkerPrefs.setReminderConsumedTokens(ctx, bounded.toString())
    }

    fun queueInfo(ctx: Context): Pair<Int, Long> {
        val q = loadQueue(ctx)
        return q.size to (q.lastOrNull()?.at ?: 0L)
    }

    fun ruleInfo(ctx: Context): Pair<Int, Long> {
        val snapshot = ruleSnapshot(ctx)
        return (snapshot?.rules?.size ?: 0) to (snapshot?.validFrom ?: 0L)
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
        onProtectedDisplaysChanged(ctx)
        val queue = loadQueue(ctx)
        consumeRules(ctx, queue, now)
        val r = ReminderLogic.takeDue(queue, now)
        val next = continueRules(ctx, r.remaining, now)
        saveQueue(ctx, next)
        val reserved = protectedDisplays(ctx)
        val policy = policy(ctx)
        var slots = loadSlots(ctx)
        val consumed = consumedTokens(ctx)
        for (e in r.due) {
            if (consumed.has(e.token)) continue
            if (!ReminderLogic.allowed(e, now, policy, AnkerPrefs.reminderFocusUntil(ctx))) continue
            val p = ReminderLogic.place(slots, e, now, reserved)
            (slots - p.slots.toSet()).forEach { ctx.getSystemService(NotificationManager::class.java).cancel(ReminderLogic.notificationId(it.slot)) }
            slots = p.slots
            p.slot?.let { post(ctx, e, it) }
        }
        consumeTokens(ctx, queue.filter { it.at <= now })
        saveSlots(ctx, slots)
        armNext(ctx, next)
    }

    /** Der laufende Wecker ist die eine Meldung, die nie weichen darf. Also weicht die unwichtigste normale. */
    @Synchronized
    fun onAlarmStarted(ctx: Context) {
        onProtectedDisplaysChanged(ctx)
    }

    @Synchronized
    fun onProtectedDisplaysChanged(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val now = System.currentTimeMillis()
        val old = loadSlots(ctx)
        val allowed = old.filter { slot ->
            AnkerPrefs.reminderLastShown(ctx, slot.date, slot.key)?.let { json ->
                try { ReminderLogic.allowed(entryFromJson(JSONObject(json)), now, policy(ctx), AnkerPrefs.reminderFocusUntil(ctx)) } catch (_: Exception) { false }
            } ?: false
        }
        val retained = ReminderLogic.trimToBudget(allowed, now, protectedDisplays(ctx))
        (old - retained.toSet()).forEach { nm.cancel(ReminderLogic.notificationId(it.slot)) }
        saveSlots(ctx, retained)
    }

    private fun tickIntent(ctx: Context, code: Int) = PendingIntent.getBroadcast(
        ctx, code,
        Intent(ctx, ReminderReceiver::class.java).setAction(ACTION_TICK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** Getrennt geplant: Eine ungenaue Erinnerung kann sich im Tiefschlaf verspäten, eine exakte darf das nicht erben. */
    private fun armNext(ctx: Context, q: List<ReminderEntry>) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val exactPi = tickIntent(ctx, REQUEST_TICK_EXACT)
        val inexactPi = tickIntent(ctx, REQUEST_TICK_INEXACT)
        val exact = q.firstOrNull { it.exact }
        val inexact = q.firstOrNull { !it.exact }
        if (inexact != null) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, inexact.at, inexactPi) else am.cancel(inexactPi)
        if (exact == null) {
            am.cancel(exactPi)
            return
        }
        try {
            if (AlarmController.canExact(ctx)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, exact.at, exactPi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, exact.at, exactPi)
            }
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, exact.at, exactPi)
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
            .setData(Uri.parse("anker-reminder://action/" + java.security.MessageDigest.getInstance("SHA-256").digest(e.token.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }))
            .putExtra(EXTRA_KEY, e.key).putExtra(EXTRA_DATE, e.date).putExtra(EXTRA_SNOOZES, e.snoozes)
            .putExtra(EXTRA_REVISION, e.revision).putExtra(EXTRA_TOKEN, e.token),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun post(ctx: Context, e: ReminderEntry, slot: Int) {
        ensureChannels(ctx)
        val launch = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        ReminderLogic.tapDestination(e.key)?.let { destination ->
            launch.action = Intent.ACTION_VIEW
            launch.data = Uri.parse("${ctx.packageName}://$destination")
        }
        // Ziel gehört zur PendingIntent-Identität: ein neuer Slot-Inhalt darf keine alte Zielseite erben.
        val open = PendingIntent.getActivity(
            ctx, 4950 + slot,
            launch,
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
        if (e.actions && e.token.isNotEmpty() && e.revision.isNotEmpty()) {
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
        if (action !in setOf(ACTION_DONE, ACTION_SNOOZE, ACTION_SKIP, ACTION_SWIPED)) return
        val key = intent.getStringExtra(EXTRA_KEY) ?: return
        val date = intent.getStringExtra(EXTRA_DATE) ?: return
        val revision = intent.getStringExtra(EXTRA_REVISION) ?: return
        val token = intent.getStringExtra(EXTRA_TOKEN) ?: return
        val now = System.currentTimeMillis()
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val slots = loadSlots(ctx)
        val occupant = ReminderLogic.currentAction(slots, date, key, revision, token, now) ?: return
        if (action == ACTION_SWIPED) {
            saveSlots(ctx, slots - occupant)
            return
        }
        val source = AnkerPrefs.reminderLastShown(ctx, date, key)?.let {
            try { entryFromJson(JSONObject(it)) } catch (_: Exception) { null }
        } ?: return
        if (!source.actions || source.revision != revision || source.token != token) return
        val revisions = try { JSONObject(AnkerPrefs.reminderRevisions(ctx)) } catch (_: Exception) { return }
        if (revisions.optString("$date|$key") != revision) return
        val queue = loadQueue(ctx)
        val actions = JSONArray(AnkerPrefs.reminderActions(ctx))
        val next = when (action) {
            ACTION_SNOOZE -> {
                if (ReminderLogic.allowed(source, now + ReminderLogic.SNOOZE_MS, policy(ctx), AnkerPrefs.reminderFocusUntil(ctx))) ReminderLogic.snooze(queue, source, now) ?: queue
                else ReminderLogic.withoutKey(queue, date, key)
            }
            else -> {
                actions.put(JSONObject().put("id", "$token:$action").put("revision", revision).put("token", token).put("action", if (action == ACTION_DONE) "done" else "skip").put("key", key).put("date", date).put("at", now))
                ReminderLogic.withoutKey(queue, date, key)
            }
        }
        if (!AnkerPrefs.commitReminderAction(ctx, slotsJson(slots - occupant), queueJson(next), actions.toString())) return
        nm.cancel(ReminderLogic.notificationId(occupant.slot))
        armNext(ctx, next)
        if (action != ACTION_SNOOZE) AnkerNativePlugin.notifyReminderAction()
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == ReminderScheduler.ACTION_TICK) ReminderScheduler.tick(ctx) else ReminderScheduler.onAction(ctx, intent)
    }
}
