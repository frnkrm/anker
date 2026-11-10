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
    private const val REQUEST_TICK_QUIET = 4802
    const val ACTION_TICK = "de.frnkrm.anker.REMINDER_TICK"
    const val ACTION_DONE = "de.frnkrm.anker.REMINDER_DONE"
    const val ACTION_SNOOZE = "de.frnkrm.anker.REMINDER_SNOOZE"
    const val ACTION_SKIP = "de.frnkrm.anker.REMINDER_SKIP"
    const val ACTION_SWIPED = "de.frnkrm.anker.REMINDER_SWIPED"
    val CHANNEL_IDS = listOf("sanft", "uebergang", "wecker")
    private const val EXTRA_KEY = "key"
    private const val EXTRA_DATE = "date"
    private const val EXTRA_SNOOZES = "snoozes"
    private const val EXTRA_REVISION = "revision"
    private const val EXTRA_TOKEN = "token"
    private val quietHandoffs = mutableSetOf<String>()

    private fun diagnostic(ctx: Context, code: String, values: Map<String, Any> = emptyMap()) {
        try { NativeDiagnosticJournal.record(ctx, "reminder", code, values) } catch (_: Exception) { }
    }

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
        deferredFrom = o.optLong("deferredFrom"),
        quietFollowUps = o.opt("quietFollowUps") == true,
    )

    private fun entryToJson(e: ReminderEntry) = JSONObject()
        .put("key", e.key).put("date", e.date).put("at", e.at).put("channel", e.channel)
        .put("title", e.title).put("body", e.body).put("actions", e.actions)
        .put("slot", e.slot).put("rank", e.rank).put("exact", e.exact).put("snoozes", e.snoozes)
        .put("revision", e.revision).put("token", e.token).put("critical", e.critical).put("ruleId", e.ruleId).put("deferredFrom", e.deferredFrom)
        .put("quietFollowUps", e.quietFollowUps)

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
        val q = continueRules(ctx, ReminderLogic.replace(loadQueue(ctx), incoming, relevant, now, revisions, consumed.keys), now)
        saveQueue(ctx, q)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val slots = loadSlots(ctx)
        val gone = ReminderLogic.obsolete(slots, relevant, now, revisions)
        gone.forEach { nm.cancel(ReminderLogic.notificationId(it.slot)) }
        saveSlots(ctx, slots - gone.toSet())
        val pc = pcSnapshot(ctx, now)
        reconcileProtectedDisplays(ctx, pc)
        reconcileQuietBedtime(ctx, now)
        armNext(ctx, loadQueue(ctx))
        AnkerPrefs.setReminderLastSyncAt(ctx, now)
        if (loadQueue(ctx).any { it.deferredFrom > 0 && !pc.suppress(it) }) tick(ctx)
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
        ReminderPolicy(o.optInt("quietStart"), o.optInt("quietEnd"), (0 until ranges.length()).map { val r = ranges.getJSONObject(it); ReminderQuietRange(r.getLong("from"), r.getLong("to")) },
            o.opt("bedtimeFollowUpsEnabled") == true, o.optInt("bedtimeFollowUpsDelayMinutes", 0).coerceIn(0, 60))
    } catch (_: Exception) { ReminderPolicy() }

    private fun pcExpectation(ctx: Context): PcReminderExpectation? = try {
        val value = JSONObject(AnkerPrefs.reminderPolicy(ctx)).getJSONObject("pcConfirmation")
        PcReminderExpectation(value.getString("revision"), value.getString("date"), value.getLong("validUntil"))
    } catch (_: Exception) { null }

    private fun pcSnapshot(ctx: Context, now: Long): PcReminderSnapshot =
        PcReminderGate.capture(pcExpectation(ctx), PcBridgeClient::currentReminderProof, now)

    @Synchronized
    fun setFocus(ctx: Context, until: Long) {
        val now = System.currentTimeMillis()
        AnkerPrefs.setReminderFocusUntil(ctx, until.coerceIn(0, now + 12 * 3600_000L))
        onProtectedDisplaysChanged(ctx)
    }

    private fun protectedDisplays(ctx: Context): Int = (if (AnkerPrefs.isRinging(ctx)) 1 else 0) +
        (if (SmartWakeService.hasForeground()) 1 else 0) + (if (RoutinePaceKeeperService.hasForeground()) 1 else 0) +
        (if (SleepAudioService.hasForeground()) 1 else 0) + (if (PcBridgeService.hasForeground()) 1 else 0) +
        (if (BedtimePromptController.hasQuietNotification(ctx)) 1 else 0)

    /** One existing budget owns ordinary cards and the optional single silent bedtime card. */
    @Synchronized
    fun tryPostQuietBedtime(ctx: Context, post: () -> Boolean): Boolean {
        if (AnkerPrefs.isRinging(ctx)) return false
        val now = System.currentTimeMillis()
        val alreadyShown = BedtimePromptController.hasQuietNotification(ctx)
        if (!ReminderLogic.quietDisplayFits(loadSlots(ctx).count { it.expiresAt > now }, protectedDisplays(ctx), alreadyShown, AnkerPrefs.isRinging(ctx))) return false
        return try { post() } catch (_: Exception) { false }
    }

    private fun reconcileQuietBedtime(ctx: Context, now: Long): Map<String, String> {
        val currentPolicy = policy(ctx)
        val enabled = currentPolicy.bedtimeFollowUpsEnabled
        val current = mutableMapOf<String, String>()
        if (enabled) {
            ruleSnapshot(ctx)?.let { current.putAll(ReminderRules.quietBedRevisions(it, now, currentPolicy.bedtimeFollowUpsDelayMinutes)) }
            try {
                val revisions = JSONObject(AnkerPrefs.reminderRevisions(ctx))
                revisions.keys().forEach { key -> if (key.endsWith("|bed")) current[key] = revisions.getString(key) }
            } catch (_: Exception) { }
        }
        BedtimePromptController.configureQuietFollowUps(ctx, enabled)
        BedtimePromptController.reconcileQuietSource(ctx, current)
        return current
    }

    @Synchronized
    private fun completeQuietHandoff(ctx: Context, source: ReminderEntry, accepted: Boolean) {
        quietHandoffs.remove(source.token)
        val queue = loadQueue(ctx)
        val completed = ReminderLogic.completeQuietSource(queue, consumedTokens(ctx), source, accepted, System.currentTimeMillis())
        if (accepted) {
            val (next, tokens) = completed
            val saved = AnkerPrefs.commitReminderAction(ctx, slotsJson(loadSlots(ctx)), queueJson(next),
                AnkerPrefs.reminderActions(ctx), JSONObject(tokens).toString())
            if (!saved) diagnostic(ctx, "delivery_rejected", mapOf("reasonCode" to "storage-failed"))
            armNext(ctx, if (saved) next else queue)
        } else {
            // Do not reinsert a source removed by a newer plan while Main was working.
            val next = completed.first
            saveQueue(ctx, next)
            diagnostic(ctx, "delivery_rejected", mapOf("reasonCode" to "schedule-failed"))
            armNext(ctx, next)
        }
    }

    private fun ruleSnapshot(ctx: Context): NativeReminderRuleSnapshot? = try {
        val o = JSONObject(AnkerPrefs.reminderRules(ctx))
        val arr = o.getJSONArray("rules")
        val dates = o.optJSONArray("excludedDates") ?: JSONArray()
        NativeReminderRuleSnapshot(o.getLong("validFrom"), (0 until dates.length()).map { dates.getString(it) }.toSet(), (0 until arr.length()).map {
            val r = arr.getJSONObject(it)
            NativeReminderRule(r.getString("ruleId"), r.getString("key"), r.getInt("weekday"), r.getInt("minute"), r.getString("channel"), r.getString("title"), r.getString("body"), r.getInt("slot"), r.getInt("rank"), r.getBoolean("exact"), r.getString("revision"), r.opt("quietFollowUps") == true)
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
                revision = rule.revision + "|" + occurrence.date, token = java.util.UUID.randomUUID().toString(), critical = ReminderRules.critical(rule.key), ruleId = rule.ruleId, quietFollowUps = rule.quietFollowUps))
        }
        return out.sortedBy { it.at }
    }

    private fun consumeRules(ctx: Context, queue: List<ReminderEntry>, now: Long) {
        val consumed = try { JSONObject(AnkerPrefs.reminderRuleConsumed(ctx)) } catch (_: Exception) { JSONObject() }
        for (e in queue) if (e.ruleId.isNotEmpty() && e.at <= now) consumed.put(e.ruleId, maxOf(consumed.optLong(e.ruleId), e.at))
        AnkerPrefs.setReminderRuleConsumed(ctx, consumed.toString())
    }

    private fun consumedTokens(ctx: Context): Map<String, Long> = try {
        val tokens = JSONObject(AnkerPrefs.reminderConsumedTokens(ctx))
        tokens.keys().asSequence().associateWith { tokens.optLong(it) }
    } catch (_: Exception) { emptyMap() }

    private fun consumeTokens(ctx: Context, entries: List<ReminderEntry>) {
        val tokens = ReminderLogic.consumeTokens(consumedTokens(ctx), entries)
        AnkerPrefs.setReminderConsumedTokens(ctx, JSONObject(tokens).toString())
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
        return try {
            ctx.getSystemService(NotificationManager::class.java).activeNotifications.count {
                it.id in ReminderLogic.FIRST_NOTIFICATION_ID..ReminderLogic.notificationId(ReminderLogic.SLOT_LATEST)
            }
        } catch (_: Exception) { -1 }
    }

    /** Android-Snapshot und gespeicherte Planung getrennt; weder Quelle bestätigt eine Wahrnehmung. */
    @Synchronized
    fun diagnostics(ctx: Context): JSONObject {
        val now = System.currentTimeMillis()
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val channels = JSONArray()
        for (id in CHANNEL_IDS) {
            val importance = nm.getNotificationChannel(id)?.importance ?: -1
            channels.put(JSONObject().put("id", id).put("importance", importance).put("blocked", importance == NotificationManager.IMPORTANCE_NONE))
        }
        val next = loadQueue(ctx).filter { it.at >= now - ReminderLogic.STALE_MS }.minByOrNull { it.at }
        val currentPolicy = policy(ctx)
        return JSONObject().put("channels", channels)
            .put("nextAt", next?.at ?: 0).put("nextChannel", next?.channel ?: "")
            .put("focusUntil", AnkerPrefs.reminderFocusUntil(ctx).takeIf { it > now } ?: 0)
            .put("quietUntil", ReminderLogic.quietUntil(now, currentPolicy))
            .put("planQuietUntil", currentPolicy.ranges.filter { now >= it.from && now < it.to }.maxOfOrNull { it.to } ?: 0)
            .put("storedSlots", loadSlots(ctx).count { it.expiresAt > now })
            .put("activeNotifications", visibleCount(ctx))
            .put("lastSyncAt", AnkerPrefs.reminderLastSyncAt(ctx))
    }

    // ---------- Vom System ----------
    @Synchronized
    fun reconcile(ctx: Context) {
        tick(ctx)
    }

    @Synchronized
    fun tick(ctx: Context) {
        val now = System.currentTimeMillis()
        val pc = pcSnapshot(ctx, now)
        reconcileProtectedDisplays(ctx, pc)
        // One immutable gate snapshot owns holding, delivery and token consumption. A concurrent
        // ACK/disconnect posts the next round; it cannot change this round halfway through.
        val batch = pc.prepare(loadQueue(ctx))
        consumeRules(ctx, batch.restoredQueue, now)
        val next = continueRules(ctx, batch.remaining, now)
        val reserved = protectedDisplays(ctx)
        val policy = policy(ctx)
        val quietBedRevisions = reconcileQuietBedtime(ctx, now)
        val focusUntil = AnkerPrefs.reminderFocusUntil(ctx)
        val retries = mutableListOf<ReminderEntry>()
        fun retainSnooze(entry: ReminderEntry) {
            ReminderLogic.retrySnooze(entry, now, policy, focusUntil)?.let(retries::add)
        }
        var slots = loadSlots(ctx)
        val consumed = consumedTokens(ctx)
        for (e in batch.deliveries) {
            if (e.token in consumed) continue
            if (ReminderLogic.quietPath(e, policy)) {
                if (ReminderLogic.canStartQuietBed(e, policy, quietBedRevisions)) {
                    // Persist the same source for a non-WAKEUP recovery even if
                    // this process dies before Main finishes the durable handoff.
                    val retry = ReminderLogic.retryQuietSource(e, now)
                    if (retry != null) retries.add(retry)
                    if (retry != null && quietHandoffs.add(e.token)) {
                        try {
                            BedtimePromptController.startQuietFromReminder(ctx, e.date, e.key, e.revision, e.token, PcReminderGate.originalAt(e), policy.bedtimeFollowUpsDelayMinutes) { accepted ->
                                completeQuietHandoff(ctx, e, accepted)
                            }
                        } catch (_: Exception) {
                            quietHandoffs.remove(e.token)
                            diagnostic(ctx, "delivery_rejected", mapOf("reasonCode" to "schedule-failed"))
                        }
                    }
                }
                // Only completion after durable session storage/arming consumes
                // this token. The session owns every later silent follow-up.
                continue
            }
            if (!ReminderLogic.allowed(e, now, policy, focusUntil)) {
                retainSnooze(e)
                diagnostic(ctx, "delivery_rejected", mapOf("reasonCode" to if (now < focusUntil && !e.critical) "focus" else "quiet-hours"))
                continue
            }
            val p = ReminderLogic.place(slots, e, now, reserved)
            // Bekannte App-/Kanalsperren verändern keine vorhandene Karte.
            if (p.slot != null && !canPost(ctx, e.channel)) {
                retainSnooze(e)
                diagnostic(ctx, "delivery_rejected", mapOf("reasonCode" to "channel-blocked"))
                continue
            }
            val beforePost = ReminderLogic.reserveBeforePost(slots, p)
            (slots - beforePost.toSet()).forEach {
                ctx.getSystemService(NotificationManager::class.java).cancel(ReminderLogic.notificationId(it.slot))
            }
            val accepted = p.slot?.let { post(ctx, e, it) } ?: false
            slots = ReminderLogic.afterPostRequest(beforePost, p, accepted)
            if (accepted) {
                AnkerPrefs.setReminderLastShown(ctx, e.date, e.key, entryToJson(e).toString(), slots, now)
                diagnostic(ctx, "delivered", mapOf("targetAt" to e.at))
            } else {
                retainSnooze(e)
                diagnostic(ctx, "delivery_rejected", mapOf("reasonCode" to if (p.slot != null) "channel-blocked" else if (reserved >= 3) "budget" else "priority"))
            }
        }
        val retryTokens = retries.map { it.token }.toSet()
        consumeTokens(ctx, batch.consumed.filter { it.token !in retryTokens })
        val pending = (next + retries).sortedBy { it.at }
        saveQueue(ctx, pending)
        saveSlots(ctx, slots)
        armNext(ctx, pending)
        retries.filter { it.snoozes > 0 }.forEach {
            diagnostic(ctx, "scheduled", mapOf("kind" to "snooze", "targetAt" to it.at))
        }
    }

    /** Der laufende Wecker ist die eine Meldung, die nie weichen darf. Also weicht die unwichtigste normale. */
    @Synchronized
    fun onAlarmStarted(ctx: Context) {
        onProtectedDisplaysChanged(ctx)
    }

    @Synchronized
    fun onProtectedDisplaysChanged(ctx: Context) {
        reconcileProtectedDisplays(ctx, pcSnapshot(ctx, System.currentTimeMillis()))
    }

    private fun reconcileProtectedDisplays(ctx: Context, pc: PcReminderSnapshot) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val now = pc.now
        // The quiet card is optional: a newly ringing alarm or mandatory
        // foreground displays must not leave it outside the shared budget.
        if (BedtimePromptController.hasQuietNotification(ctx) && (AnkerPrefs.isRinging(ctx) || protectedDisplays(ctx) > 3)) {
            nm.cancel(BedtimePromptController.QUIET_NOTIFICATION_ID)
        }
        val old = loadSlots(ctx)
        val hidden = old.mapNotNull { slot ->
            val source = AnkerPrefs.reminderLastShown(ctx, slot.date, slot.key)?.let { try { entryFromJson(JSONObject(it)) } catch (_: Exception) { null } }
            source?.takeIf { pc.suppress(it) && now - PcReminderGate.originalAt(it) <= ReminderLogic.STALE_MS }
        }
        if (hidden.isNotEmpty()) {
            val queue = loadQueue(ctx)
            val held = hidden.filter { source -> queue.none { it.date == source.date && it.key == source.key && it.deferredFrom > 0 } }
                .map { PcReminderGate.defer(it.copy(token = java.util.UUID.randomUUID().toString()), now) }
            saveQueue(ctx, (queue + held).sortedBy { it.at })
        }
        val allowed = old.filter { slot ->
            AnkerPrefs.reminderLastShown(ctx, slot.date, slot.key)?.let { json ->
                try { val entry = entryFromJson(JSONObject(json)); !pc.suppress(entry) && ReminderLogic.allowed(entry, now, policy(ctx), AnkerPrefs.reminderFocusUntil(ctx)) } catch (_: Exception) { false }
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
        val quietPi = tickIntent(ctx, REQUEST_TICK_QUIET)
        val targets = ReminderLogic.nextTicks(q)
        val exact = targets.exact
        val inexact = targets.inexact
        // A quiet source must not wake a sleeping device or gain idle exemption.
        if (targets.quiet != null) am.set(AlarmManager.RTC, targets.quiet.at, quietPi) else am.cancel(quietPi)
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

    fun ensureChannels(ctx: Context) {
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

    private fun canPost(ctx: Context, channel: String): Boolean {
        ensureChannels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        return ReminderLogic.canPost(nm.areNotificationsEnabled(), nm.getNotificationChannel(channel)?.importance ?: -1)
    }

    private fun post(ctx: Context, e: ReminderEntry, slot: Int): Boolean {
        if (!canPost(ctx, e.channel)) return false
        val nm = ctx.getSystemService(NotificationManager::class.java)
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
        return try {
            nm.notify(ReminderLogic.notificationId(slot), b.build())
            true
        } catch (_: SecurityException) {
            false
        }
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
        var nextConsumed: String? = null
        val next = when (action) {
            ACTION_SNOOZE -> {
                val snoozed = ReminderLogic.requestSnooze(queue, source, now, policy(ctx), AnkerPrefs.reminderFocusUntil(ctx)) ?: return
                nextConsumed = JSONObject(ReminderLogic.consumeSnoozeTokens(consumedTokens(ctx), queue, source)).toString()
                snoozed
            }
            else -> {
                actions.put(JSONObject().put("id", "$token:$action").put("revision", revision).put("token", token).put("action", if (action == ACTION_DONE) "done" else "skip").put("key", key).put("date", date).put("at", now))
                ReminderLogic.withoutKey(queue, date, key)
            }
        }
        if (!AnkerPrefs.commitReminderAction(ctx, slotsJson(slots - occupant), queueJson(next), actions.toString(), nextConsumed)) {
            diagnostic(ctx, "action_rejected", mapOf("reasonCode" to "storage-failed"))
            return
        }
        if (action == ACTION_SNOOZE) {
            diagnostic(ctx, "action_accepted", mapOf("reasonCode" to "snoozed"))
        }
        nm.cancel(ReminderLogic.notificationId(occupant.slot))
        armNext(ctx, next)
        if (action == ACTION_SNOOZE) next.firstOrNull { it.date == date && it.key == key }?.let {
            diagnostic(ctx, "scheduled", mapOf("kind" to "snooze", "targetAt" to it.at))
        }
        if (action != ACTION_SNOOZE) AnkerNativePlugin.notifyReminderAction()
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == ReminderScheduler.ACTION_TICK) ReminderScheduler.tick(ctx) else ReminderScheduler.onAction(ctx, intent)
    }
}
