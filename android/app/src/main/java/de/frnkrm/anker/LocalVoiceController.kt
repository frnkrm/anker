package de.frnkrm.anker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.getcapacitor.JSObject
import java.lang.ref.WeakReference
import java.util.Locale

/** Nur lokale Android-Engines, keine Audio-Datei, kein Netz-/Cloud-Fallback. Alle Aufrufe auf dem UI-Thread. */
class LocalVoiceController(private val context: Context) {
    companion object {
        private var current: WeakReference<LocalVoiceController>? = null
        fun hasActiveVoice(): Boolean = current?.get()?.let { it.recognizer != null || it.speakingUtterance != null || it.pendingSpeech != null } == true
        fun silenceForAlarm() { current?.get()?.let { voice ->
            if (Looper.myLooper() == voice.handler.looper) { voice.stopDictation(); voice.stopSpeaking() }
            else voice.handler.post { voice.stopDictation(); voice.stopSpeaking() }
        } }
    }
    private val handler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var dictationGeneration = 0
    private var dictationResult: ((JSObject) -> Unit)? = null
    private var timeout: Runnable? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsChecked = false
    private var speechGeneration = 0
    private var pendingSpeech: String? = null
    private var pendingSpeechResult: ((JSObject) -> Unit)? = null
    private var speechFocus: AudioFocusRequest? = null
    private val speechAudioLease = AudioPlaybackLease()
    private var speakingUtterance: String? = null
    private var destroyed = false
    init { current = WeakReference(this) }

    private fun dictationAvailable(): Boolean = try { Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context) } catch (_: Exception) { false }
    private fun priorityAudioActive(): Boolean = AlarmController.state(context).ringing != null || SmartWakeService.status(context).optString("phase", "") == "measuring"
    fun capabilities(): JSObject = JSObject().put("dictationSupported", dictationAvailable())
        .put("localOnly", true).put("speechSupported", if (!ttsChecked) org.json.JSONObject.NULL else ttsReady && tts?.voices?.any { !it.isNetworkConnectionRequired && it.locale.language == Locale.GERMAN.language } == true)

    private fun result(status: String, text: String? = null): JSObject = JSObject().put("status", status).also { if (text != null) it.put("text", text) }
    private fun finishDictation(generation: Int, status: String, text: String? = null) {
        if (generation != dictationGeneration) return
        dictationGeneration++
        timeout?.let { handler.removeCallbacks(it) }; timeout = null
        val callback = dictationResult; dictationResult = null
        val previous = recognizer; recognizer = null
        try { previous?.cancel(); previous?.destroy() } catch (_: Exception) { }
        callback?.invoke(result(status, text))
    }
    fun stopDictation() { finishDictation(dictationGeneration, "cancelled") }

    fun dictate(activity: Activity, callback: (JSObject) -> Unit) {
        stopDictation()
        if (destroyed || Build.VERSION.SDK_INT < 31 || !dictationAvailable()) { callback(result("unavailable")); return }
        if (priorityAudioActive()) { callback(result("busy")); return }
        stopSpeaking()
        val generation = ++dictationGeneration
        dictationResult = callback
        try {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity).also { speech ->
                speech.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) { }
                    override fun onBeginningOfSpeech() { }
                    override fun onRmsChanged(rmsdB: Float) { }
                    override fun onBufferReceived(buffer: ByteArray?) { }
                    override fun onEndOfSpeech() { }
                    override fun onError(error: Int) { finishDictation(generation, if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) "permission-denied" else "unavailable") }
                    override fun onResults(results: Bundle?) {
                        val text = VoiceModel.transcript(results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: emptyList())
                        finishDictation(generation, if (text == null) "empty" else "text", text)
                    }
                    override fun onPartialResults(partialResults: Bundle?) { }
                    override fun onEvent(eventType: Int, params: Bundle?) { }
                })
                speech.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "de-DE")
                    .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1))
            }
            timeout = Runnable { finishDictation(generation, "timeout") }.also { handler.postDelayed(it, 30_000L) }
        } catch (_: Exception) { finishDictation(generation, "unavailable") }
    }

    fun stopSpeaking() {
        speechGeneration++
        speechAudioLease.cancel()
        speakingUtterance = null
        pendingSpeech = null
        pendingSpeechResult?.invoke(result("cancelled")); pendingSpeechResult = null
        try { tts?.stop() } catch (_: Exception) { }
        speechFocus?.let { request ->
            try { context.getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(request) } catch (_: Exception) { }
        }
        speechFocus = null
    }

    private fun speechFinished(id: String?) { handler.post {
        if (id != null && id == speakingUtterance) stopSpeaking()
    } }

    private fun speakPending() {
        val text = pendingSpeech ?: return
        val callback = pendingSpeechResult ?: return
        pendingSpeech = null; pendingSpeechResult = null
        if (destroyed || !ttsReady || priorityAudioActive() || recognizer != null) { callback(result("unavailable")); return }
        val engine = tts ?: run { callback(result("unavailable")); return }
        val voice = engine.voices?.filter { !it.isNetworkConnectionRequired && it.locale.language == Locale.GERMAN.language }?.sortedBy { it.name }?.firstOrNull()
        if (voice == null) { callback(result("unavailable")); return }
        try {
            // Ein freiwilliger Hinweis ist gewöhnliche Sprache, kein Alarm oder Hintergrunddienst.
            val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
            if (engine.setAudioAttributes(attributes) != TextToSpeech.SUCCESS) { callback(result("unavailable")); return }
            engine.voice = voice
            val generation = speechGeneration
            val focusId = speechAudioLease.begin()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes).setWillPauseWhenDucked(true)
                .setOnAudioFocusChangeListener({ change ->
                    if (change < 0 && speechAudioLease.lose(focusId, false)) stopSpeaking()
                }, handler).build()
            speechFocus = request
            val granted = context.getSystemService(AudioManager::class.java)?.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!speechAudioLease.requested(focusId, granted)) { stopSpeaking(); callback(result("unavailable")); return }
            val id = "anker-local-$generation"
            speakingUtterance = id
            val value = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            if (value != TextToSpeech.SUCCESS) stopSpeaking()
            callback(result(if (value == TextToSpeech.SUCCESS) "spoken" else "unavailable"))
        } catch (_: Exception) { stopSpeaking(); callback(result("unavailable")) }
    }
    fun speak(text: String, callback: (JSObject) -> Unit) {
        stopSpeaking()
        if (destroyed || priorityAudioActive() || recognizer != null) { callback(result("busy")); return }
        val trimmed = VoiceModel.transcript(listOf(text))?.take(240) ?: run { callback(result("empty")); return }
        pendingSpeech = trimmed; pendingSpeechResult = callback
        val generation = speechGeneration
        handler.postDelayed({
            if (generation == speechGeneration && pendingSpeechResult != null) {
                pendingSpeechResult?.invoke(result("unavailable")); pendingSpeechResult = null; pendingSpeech = null
            }
        }, 5000L)
        if (ttsReady) { speakPending(); return }
        if (ttsChecked) { pendingSpeechResult = null; pendingSpeech = null; callback(result("unavailable")); return }
        if (tts != null) return
        try {
            tts = TextToSpeech(context) { status -> handler.post {
                if (destroyed) return@post
                ttsChecked = true
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) { }
                    override fun onDone(utteranceId: String?) { speechFinished(utteranceId) }
                    @Suppress("OVERRIDE_DEPRECATION")
                    override fun onError(utteranceId: String?) { speechFinished(utteranceId) }
                    override fun onStop(utteranceId: String?, interrupted: Boolean) { speechFinished(utteranceId) }
                })
                if (ttsReady) speakPending() else { pendingSpeechResult?.invoke(result("unavailable")); pendingSpeechResult = null; pendingSpeech = null }
            } }
        } catch (_: Exception) { pendingSpeechResult?.invoke(result("unavailable")); pendingSpeechResult = null; pendingSpeech = null }
    }
    fun destroy() {
        destroyed = true; stopDictation(); stopSpeaking()
        try { tts?.shutdown() } catch (_: Exception) { }; tts = null
    }
}
