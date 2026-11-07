package de.frnkrm.anker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Eigene non-WAKEUP-Sitzung, niemals ein Anker-Wecker. */
class BedtimePromptReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try { when (intent.action) {
            BedtimePromptController.ACTION_DUE -> BedtimePromptController.onDue(context, intent.getStringExtra("sessionId") ?: return)
            BedtimePromptController.ACTION_EXPIRE -> BedtimePromptController.expire(context, intent.getStringExtra("sessionId") ?: return)
            Intent.ACTION_BOOT_COMPLETED -> BedtimePromptController.reset(context, "restart")
            Intent.ACTION_MY_PACKAGE_REPLACED -> BedtimePromptController.reset(context, "updated")
        } } catch (_: Exception) { /* Dieses freiwillige Extra darf weder App noch Hauptwecker beenden. */ }
    }
}
