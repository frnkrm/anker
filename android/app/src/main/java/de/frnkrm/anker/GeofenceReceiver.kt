package de.frnkrm.anker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import java.util.concurrent.atomic.AtomicBoolean

/** Keine Meldung und keine Datenbankbuchung: nur ein später manuell bestätigbarer Vorschlag. */
class GeofenceReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED || intent.action == Intent.ACTION_USER_UNLOCKED) {
            val pending = goAsync()
            val finished = AtomicBoolean(false)
            val handler = Handler(Looper.getMainLooper())
            val finish = Runnable { if (finished.compareAndSet(false, true)) pending.finish() }
            // Broadcasts sind begrenzt: auch bei ausbleibender Play-Dienste-Antwort freigeben.
            handler.postDelayed(finish, 8_000L)
            try { GeofenceManager.restoreAfterBoot(context) { handler.removeCallbacks(finish); finish.run() } }
            catch (_: Exception) { handler.removeCallbacks(finish); finish.run() }
            return
        }
        if (intent.action != GeofenceManager.ACTION_DWELL) return
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError() || event.geofenceTransition != Geofence.GEOFENCE_TRANSITION_DWELL) return
        val ids = event.triggeringGeofences?.map { it.requestId }?.toSet() ?: return
        val fix = event.triggeringLocation?.let { GeofenceTriggerFix(it.latitude, it.longitude, it.accuracy, it.time) }
        GeofenceManager.recordDwell(context, ids, fix)
    }
}
