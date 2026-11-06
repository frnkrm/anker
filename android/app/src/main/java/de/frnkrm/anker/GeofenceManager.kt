package de.frnkrm.anker

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.UserManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import org.json.JSONArray
import org.json.JSONObject

/**
 * Ein minimaler, credential-geschützter Spiegel ausdrücklich ausgewählter Besuche.
 * Keine Adressen, Namen, Bewegungsbiografie, Notification oder Arbeits-/Ankunftsbuchung.
 */
object GeofenceManager {
    const val ACTION_DWELL = "de.frnkrm.anker.GEOFENCE_DWELL"
    private const val PREFS = "anker_geofences"
    private const val REQUEST_CODE = 6701
    private val lock = Any()
    private val main = Handler(Looper.getMainLooper())
    private var generation = 0L
    private var busy = false
    private var reconciled = false
    private var cached: Mirror? = null
    private val callbacks = mutableListOf<(JSObject) -> Unit>()

    private data class Mirror(
        val enabled: Boolean = false,
        val visits: List<GeofenceVisitDefinition> = emptyList(),
        val suggestions: List<GeofencePendingSuggestion> = emptyList(),
        val handled: Set<String> = emptySet(),
        val registered: Int = 0,
        val error: String? = null,
    )

    // Android bietet keinen createCredentialProtectedStorageContext-Gegenpart. Die normale
    // Application ist credential-protected; einen anders konfigurierten Kontext ablehnen.
    private fun credential(context: Context): Context = context.applicationContext
    private fun unlocked(context: Context): Boolean = !credential(context).isDeviceProtectedStorage && context.getSystemService(UserManager::class.java)?.isUserUnlocked == true
    private fun prefs(context: Context): SharedPreferences = credential(context).getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun fine(context: Context): Boolean = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    private fun background(context: Context): Boolean = fine(context) && (Build.VERSION.SDK_INT < 29 || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED)
    private fun available(context: Context): Boolean = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    private fun locationEnabled(context: Context): Boolean = if (Build.VERSION.SDK_INT >= 28) context.getSystemService(LocationManager::class.java)?.isLocationEnabled == true
        else Settings.Secure.getInt(context.contentResolver, Settings.Secure.LOCATION_MODE, Settings.Secure.LOCATION_MODE_OFF) != Settings.Secure.LOCATION_MODE_OFF

    private fun parseVisit(value: JSONObject): GeofenceVisitDefinition? {
        fun number(key: String): Number? = (value.opt(key) as? Number)?.takeIf { it.toDouble().isFinite() }
        val id = value.opt("id") as? String ?: return null
        val revision = value.opt("revision") as? String ?: return null
        return GeofenceVisitDefinition(id, revision, number("latitude")?.toDouble() ?: return null, number("longitude")?.toDouble() ?: return null,
            number("radiusM")?.toFloat() ?: return null, number("dwellMs")?.toLong() ?: return null,
            if (value.has("startsAt")) number("startsAt")?.toLong() ?: return null else 0L,
            number("expiresAt")?.toLong() ?: return null).takeIf(GeofenceModel::wellFormed)
    }

    private fun visitJson(visit: GeofenceVisitDefinition): JSONObject = JSONObject().put("id", visit.id).put("revision", visit.revision)
        .put("latitude", visit.latitude).put("longitude", visit.longitude).put("radiusM", visit.radiusM).put("dwellMs", visit.dwellMs)
        .put("startsAt", visit.startsAt).put("expiresAt", visit.expiresAt)
    private fun suggestionJson(value: GeofencePendingSuggestion): JSONObject = JSONObject().put("id", value.id).put("visitId", value.visitId).put("revision", value.revision).put("at", value.at)

    private fun read(context: Context): Mirror {
        cached?.let { return it }
        val loaded = try {
            val source = prefs(context)
            val definitions = JSONArray(source.getString("visits", "[]"))
            val visits = (0 until minOf(definitions.length(), GeofenceModel.MAX_VISITS)).mapNotNull { definitions.optJSONObject(it)?.let(::parseVisit) }
            val events = JSONArray(source.getString("suggestions", "[]"))
            val suggestions = (0 until minOf(events.length(), GeofenceModel.MAX_VISITS)).mapNotNull { index ->
                val value = events.optJSONObject(index) ?: return@mapNotNull null
                val id = value.opt("id") as? String ?: return@mapNotNull null
                val visitId = value.opt("visitId") as? String ?: return@mapNotNull null
                val revision = value.opt("revision") as? String ?: return@mapNotNull null
                val at = value.opt("at") as? Number ?: return@mapNotNull null
                GeofencePendingSuggestion(id, visitId, revision, at.toLong())
            }
            val handled = JSONArray(source.getString("handled", "[]"))
            Mirror(source.getBoolean("enabled", false), visits, suggestions,
                (0 until minOf(handled.length(), GeofenceModel.MAX_VISITS)).mapNotNull { handled.opt(it) as? String }.toSet(),
                source.getInt("registered", 0).coerceIn(0, GeofenceModel.MAX_VISITS), source.getString("error", null))
        } catch (_: Exception) { Mirror(error = "storage-unavailable") }
        cached = loaded
        return loaded
    }

    private fun store(context: Context, mirror: Mirror): Mirror {
        cached = mirror
        val success = try {
            prefs(context).edit().putBoolean("enabled", mirror.enabled)
                .putString("visits", JSONArray().also { result -> mirror.visits.forEach { result.put(visitJson(it)) } }.toString())
                .putString("suggestions", JSONArray().also { result -> mirror.suggestions.forEach { result.put(suggestionJson(it)) } }.toString())
                .putString("handled", JSONArray(mirror.handled.toList()).toString()).putInt("registered", mirror.registered)
                .putString("error", mirror.error).commit()
        } catch (_: Exception) { false }
        if (!success) cached = Mirror(error = "storage-unavailable")
        return cached!!
    }

    private fun pruned(mirror: Mirror, now: Long): Mirror {
        val visits = if (mirror.enabled) GeofenceModel.active(mirror.visits, now) else emptyList()
        val validIds = visits.map { "suggest:${it.requestId}" }.toSet()
        return mirror.copy(visits = visits, suggestions = GeofenceModel.pending(mirror.suggestions, visits, now), handled = mirror.handled.intersect(validIds))
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE,
        Intent(context, GeofenceReceiver::class.java).setAction(ACTION_DWELL), PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)

    fun sync(context: Context, input: JSObject, callback: (JSObject) -> Unit) {
        if (!unlocked(context)) { callback(lockedState()); return }
        val app = credential(context).applicationContext
        synchronized(lock) {
            val values = input.optJSONArray("visits")
            val parsed = if (values != null && values.length() <= GeofenceModel.MAX_VISITS) (0 until values.length()).map { values.optJSONObject(it)?.let(::parseVisit) } else null
            val invalid = input.opt("enabled") !is Boolean || parsed == null || parsed.any { it == null } || parsed.filterNotNull().map { it.id }.toSet().size != parsed.size
            val enabled = input.optBoolean("enabled", false) && !invalid
            val permitted = fine(app) && background(app) && available(app) && locationEnabled(app)
            val before = read(app)
            val visits = if (enabled && permitted) GeofenceModel.active(parsed!!.filterNotNull(), System.currentTimeMillis()) else emptyList()
            val base = pruned(before.copy(enabled = enabled, visits = visits), System.currentTimeMillis())
            val error = when {
                invalid -> "invalid-snapshot"
                enabled && !fine(app) -> "foreground-permission-required"
                enabled && !background(app) -> "background-permission-required"
                enabled && !available(app) -> "location-service-unavailable"
                enabled && !locationEnabled(app) -> "location-disabled"
                else -> null
            }
            val next = base.copy(error = error)
            if (next == before && before.error == null && !busy && reconciled) { callback(stateLocked(app)); return }
            if (next != before) { store(app, next); generation++ }
            callbacks.add(callback)
            if (!busy) { busy = true; main.post { reconcile(app) } }
        }
    }

    /** Serial remove→add; ein älterer Abschluss darf neuere Abschaltung oder Auswahl nicht überholen. */
    private fun reconcile(context: Context) {
        val expected: Long
        val mirror: Mirror
        synchronized(lock) {
            expected = generation
            mirror = store(context, pruned(read(context), System.currentTimeMillis()))
        }
        try {
            val client = LocationServices.getGeofencingClient(context)
            client.removeGeofences(pendingIntent(context)).addOnCompleteListener { removed ->
                synchronized(lock) {
                    if (expected != generation) { main.post { reconcile(context) }; return@addOnCompleteListener }
                }
                if (!removed.isSuccessful) { finish(context, expected, 0, "removal-unconfirmed"); return@addOnCompleteListener }
                val visits = mirror.visits.filter { "suggest:${it.requestId}" !in mirror.handled }
                if (!mirror.enabled || visits.isEmpty() || !fine(context) || !background(context) || !locationEnabled(context)) {
                    finish(context, expected, 0, mirror.error); return@addOnCompleteListener
                }
                try {
                val definitions = visits.map { visit ->
                    Geofence.Builder().setRequestId(visit.requestId).setCircularRegion(visit.latitude, visit.longitude, visit.radiusM)
                        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL).setLoiteringDelay(visit.dwellMs.toInt())
                        .setExpirationDuration((visit.expiresAt - System.currentTimeMillis()).coerceAtLeast(1L))
                        .setNotificationResponsiveness(60_000).build()
                }
                val request = GeofencingRequest.Builder().setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_DWELL).addGeofences(definitions).build()
                    client.addGeofences(request, pendingIntent(context)).addOnCompleteListener { added ->
                        finish(context, expected, if (added.isSuccessful) visits.size else 0, if (added.isSuccessful) null else "registration-unconfirmed")
                    }
                } catch (_: SecurityException) { finish(context, expected, 0, "permission-required") }
                catch (_: Exception) { finish(context, expected, 0, "registration-unconfirmed") }
            }
        } catch (_: Exception) { finish(context, expected, 0, "location-service-unavailable") }
    }

    private fun finish(context: Context, expected: Long, registered: Int, error: String?) {
        val waiting: List<(JSObject) -> Unit>
        val result: JSObject
        synchronized(lock) {
            if (expected != generation) { main.post { reconcile(context) }; return }
            val current = read(context)
            store(context, current.copy(registered = registered, error = error))
            reconciled = error == null
            busy = false
            result = stateLocked(context)
            waiting = callbacks.toList(); callbacks.clear()
        }
        waiting.forEach { callback -> try { callback(result) } catch (_: Exception) { /* Bridgefehler enthält keine privaten Logs. */ } }
    }

    fun state(context: Context): JSObject {
        if (!unlocked(context)) return lockedState()
        synchronized(lock) {
            val current = read(context)
            val next = pruned(current, System.currentTimeMillis())
            val revoked = current.enabled && (!fine(context) || !background(context) || !locationEnabled(context))
            if (next != current || (revoked && (current.visits.isNotEmpty() || current.suggestions.isNotEmpty() || current.registered != 0 || current.error != "permission-required"))) {
                val cleaned = if (revoked) next.copy(visits = emptyList(), suggestions = emptyList(), handled = emptySet(), error = "permission-required") else next
                store(context, cleaned); generation++
                if (!busy) { busy = true; main.post { reconcile(credential(context).applicationContext) } }
            }
            return stateLocked(context)
        }
    }

    private fun stateLocked(context: Context): JSObject {
        val mirror = read(context)
        return JSObject().put("enabled", mirror.enabled).put("available", available(context)).put("registered", if (busy) 0 else mirror.registered)
            .put("fineGranted", fine(context)).put("backgroundGranted", background(context)).put("updating", busy)
            .put("suggestions", JSArray().also { values -> mirror.suggestions.forEach { values.put(suggestionJson(it)) } })
            .also { if (mirror.error != null) it.put("error", mirror.error) }
    }

    private fun lockedState(): JSObject = JSObject().put("registered", 0).put("fineGranted", false).put("backgroundGranted", false)
        .put("available", false).put("suggestions", JSArray()).put("error", "unlock-required")

    fun ack(context: Context, ids: Set<String>) {
        if (!unlocked(context)) return
        synchronized(lock) {
            val current = pruned(read(context), System.currentTimeMillis())
            val accepted = current.suggestions.filter { it.id in ids }.map { it.id }.toSet()
            if (accepted.isEmpty()) return
            store(context, current.copy(suggestions = current.suggestions.filterNot { it.id in accepted }, handled = (current.handled + accepted).take(GeofenceModel.MAX_VISITS).toSet()))
            generation++
            if (!busy) { busy = true; main.post { reconcile(credential(context).applicationContext) } }
        }
    }

    fun recordDwell(context: Context, requestIds: Set<String>, fix: GeofenceTriggerFix?) {
        if (!unlocked(context)) return
        synchronized(lock) {
            val current = pruned(read(context), System.currentTimeMillis())
            if (!fine(context) || !background(context) || !locationEnabled(context)) { state(context); return }
            val suggestions = GeofenceModel.dwell(current.enabled, current.visits, current.suggestions, current.handled, requestIds, System.currentTimeMillis(), true, fix)
            store(context, current.copy(suggestions = suggestions))
        }
    }

    fun restoreAfterBoot(context: Context, completed: (() -> Unit)? = null) {
        if (!unlocked(context)) { completed?.invoke(); return }
        synchronized(lock) {
            val current = pruned(read(context), System.currentTimeMillis())
            // Registrierungen überleben Reboot nicht zuverlässig; nur vorhandene Auswahl/reale Rechte verwenden.
            store(context, current.copy(registered = 0)); generation++
            if (completed != null) callbacks.add { completed() }
            if (!busy) { busy = true; main.post { reconcile(credential(context).applicationContext) } }
        }
    }
}
