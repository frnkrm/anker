package de.frnkrm.anker

import android.Manifest
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject

/** Ein Reader im vorhandenen Plugin; sämtliche Zustandsänderungen laufen auf dem UI-Thread. */
class NfcAnchorReader(private val activity: Activity, private val foreground: () -> Boolean) {
    private val handler = Handler(Looper.getMainLooper())
    private val session = NfcAnchorSession()
    private var adapter: NfcAdapter? = null
    private var result: ((JSObject) -> Unit)? = null
    private var watch: Runnable? = null
    private fun elapsed() = SystemClock.elapsedRealtime()
    private fun canOpen(): Boolean = try {
        foreground() && !activity.isFinishing && !activity.isDestroyed && activity.hasWindowFocus()
            && activity.getSystemService(PowerManager::class.java).isInteractive
            && !activity.getSystemService(KeyguardManager::class.java).isKeyguardLocked
            && !activity.getSystemService(KeyguardManager::class.java).isDeviceLocked
            && !AnkerPrefs.isRinging(activity)
    } catch (_: Exception) { false }

    private fun state(): String {
        if (!canOpen()) return "blocked"
        return try {
            if (!activity.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)) "unsupported"
            else if (ContextCompat.checkSelfPermission(activity, Manifest.permission.NFC) != PackageManager.PERMISSION_GRANTED) "unavailable"
            else {
                val found = NfcAdapter.getDefaultAdapter(activity)
                if (found == null) "unsupported" else if (!found.isEnabled) "disabled" else "ready"
            }
        } catch (_: Exception) { "unavailable" }
    }
    fun status(): JSObject = JSObject().put("status", state()).put("canOpen", canOpen())

    fun scan(id: String, complete: (JSObject) -> Unit) {
        val availability = state()
        if (availability != "ready") { complete(response(availability)); return }
        if (session.current != null) { complete(response("busy")); return }
        val attempt = session.begin(id, elapsed()) ?: run { complete(response("unavailable")); return }
        result = complete
        try {
            adapter = NfcAdapter.getDefaultAdapter(activity)
            adapter!!.enableReaderMode(activity, { tag -> activity.runOnUiThread { found(attempt.generation, tag) } },
                NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F
                    or NfcAdapter.FLAG_READER_NFC_V or NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS, null)
            watch = object : Runnable {
                override fun run() {
                    if (!session.active(attempt.generation)) return
                    val current = state()
                    if (current != "ready") cancelAll(current)
                    else if (elapsed() >= attempt.deadline) cancelAll("timeout")
                    else handler.postDelayed(this, 200)
                }
            }.also { handler.postDelayed(it, 200) }
        } catch (_: Exception) { cancelAll("unavailable") }
    }

    private fun found(generation: Long, tag: Tag?) {
        if (!session.active(generation) || session.current?.target != null) return
        val available = state()
        if (!session.valid(generation, elapsed(), available == "ready")) { cancelAll(if (available == "ready") "timeout" else available); return }
        val target = try {
            val message = tag?.let { Ndef.get(it) }?.cachedNdefMessage
            if (message == null || message.byteArrayLength !in 1..NfcAnchorModel.MAX_MESSAGE_BYTES || message.records.size != 1) null
            else message.records.single().let { record ->
                NfcAnchorModel.target(listOf(NfcAnchorModel.Record(record.tnf, record.type, record.payload, record.id)), message.byteArrayLength)
            }
        } catch (_: Exception) { null }
        if (target == null) { cancelAll("invalid"); return }
        val finalState = state()
        if (!session.read(generation, target, elapsed(), finalState == "ready")) { cancelAll(if (finalState == "ready") "timeout" else finalState); return }
        stopRadio()
        val callback = result; result = null
        callback?.invoke(response("read").put("target", target))
        // Die Vorschau gilt nur bis zur ursprünglichen Frist. Der Watcher hält keinen Reader aktiv.
    }

    fun confirm(id: String, target: String): JSObject {
        val allowed = session.confirm(id, target, elapsed(), state() == "ready")
        if (session.current == null) cleanup()
        return JSObject().put("allowed", allowed)
    }
    fun cancel(id: String) { if (session.current?.id == id) cancelAll("cancelled") }
    fun cancelAll(reason: String = "cancelled") {
        session.cancel()
        cleanup()
        val callback = result; result = null
        callback?.invoke(response(reason))
    }
    private fun stopRadio() { try { adapter?.disableReaderMode(activity) } catch (_: Exception) { }; adapter = null }
    private fun cleanup() { stopRadio(); watch?.let { handler.removeCallbacks(it) }; watch = null }
    private fun response(status: String) = JSObject().put("status", status)
}
