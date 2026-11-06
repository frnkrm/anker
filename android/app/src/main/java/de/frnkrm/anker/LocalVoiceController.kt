package de.frnkrm.anker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import com.getcapacitor.JSObject
import java.lang.ref.WeakReference
import java.util.Locale

/** Nur lokale Android-Engines, keine Audio-Datei, kein Netz-/Cloud-Fallback. Alle Aufrufe auf dem UI-Thread. */
class LocalVoiceController(private val context: Context) {
    companion object {
        private var current: WeakReference<LocalVoiceController>? = null
        fun silenceForAlarm() { current?.get()?.let { voice -> voice.handler.post { voice.stopDictation(); voice.stopSpeaking() } } }
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
    private var destroyed = false
    init { current = WeakReference(this) }

    private fun dictationAvailable(): Boolean = try { Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context) } catch (_: Exception) { false }
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
        if (AlarmController.state(context).ringing != null || SmartWakeService.status(context).optString("phase", "") == "measuring") { callback(result("busy")); return }
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
        pendingSpeech = null
        pendingSpeechResult?.invoke(result("cancelled")); pendingSpeechResult = null
        try { tts?.stop() } catch (_: Exception) { }
    }
    private fun speakPending() {
        val text = pendingSpeech ?: return
        val callback = pendingSpeechResult ?: return
        pendingSpeech = null; pendingSpeechResult = null
        if (destroyed || !ttsReady || AlarmController.state(context).ringing != null) { callback(result("unavailable")); return }
        val engine = tts ?: run { callback(result("unavailable")); return }
        val voice = engine.voices?.filter { !it.isNetworkConnectionRequired && it.locale.language == Locale.GERMAN.language }?.sortedBy { it.name }?.firstOrNull()
        if (voice == null) { callback(result("unavailable")); return }
        engine.voice = voice
        val value = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "anker-local-$speechGeneration")
        callback(result(if (value == TextToSpeech.SUCCESS) "spoken" else "unavailable"))
    }
    fun speak(text: String, callback: (JSObject) -> Unit) {
        stopSpeaking()
        if (destroyed || AlarmController.state(context).ringing != null || recognizer != null) { callback(result("busy")); return }
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
                if (ttsReady) speakPending() else { pendingSpeechResult?.invoke(result("unavailable")); pendingSpeechResult = null; pendingSpeech = null }
            } }
        } catch (_: Exception) { pendingSpeechResult?.invoke(result("unavailable")); pendingSpeechResult = null; pendingSpeech = null }
    }
    fun destroy() {
        destroyed = true; stopDictation(); stopSpeaking()
        try { tts?.shutdown() } catch (_: Exception) { }; tts = null
    }
}
