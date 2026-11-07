package de.frnkrm.anker

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference

/** Bewusster dreisekündiger Wecker-Probeton, nur solange die Activity sichtbar ist. */
class AlarmTonePreview(private val context: Context) {
    companion object {
        private var current: WeakReference<AlarmTonePreview>? = null
        fun stopForPriorityAudio() { current?.get()?.let { preview ->
            if (Looper.myLooper() == preview.handler.looper) preview.stop()
            else preview.handler.post { preview.stop() }
        } }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val lease = AudioPlaybackLease()
    private var player: MediaPlayer? = null
    private var focus: AudioFocusRequest? = null
    init { current = WeakReference(this) }

    fun play(): Boolean {
        stop()
        if (AlarmController.state(context).ringing != null || SmartWakeService.status(context).optString("phase", "") == "measuring") return false
        LocalVoiceController.silenceForAlarm()
        val id = lease.begin()
        return try {
            val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes).setWillPauseWhenDucked(true)
                .setOnAudioFocusChangeListener({ change ->
                    if (change < 0 && lease.lose(id, false)) stop()
                }, handler).build()
            focus = request
            val granted = context.getSystemService(AudioManager::class.java)?.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!lease.requested(id, granted)) { stop(); return false }
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: run { stop(); return false }
            val preview = MediaPlayer().also { player = it }
            preview.setAudioAttributes(attributes)
            preview.setDataSource(context, uri)
            preview.prepare()
            preview.start()
            handler.postDelayed({ if (lease.permits(id)) stop() }, 3000L)
            true
        } catch (_: Exception) { stop(); false }
    }

    fun stop() {
        lease.cancel()
        handler.removeCallbacksAndMessages(null)
        player?.let { preview ->
            try { preview.stop() } catch (_: Exception) { }
            try { preview.release() } catch (_: Exception) { }
        }
        player = null
        focus?.let { request ->
            try { context.getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(request) } catch (_: Exception) { }
        }
        focus = null
    }
}
