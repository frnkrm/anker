package de.frnkrm.anker

import android.app.KeyguardManager
import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(AnkerNativePlugin::class.java)
        super.onCreate(savedInstanceState)
        handleAlarmIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleAlarmIntent(intent)
    }

    /** Wecker: über dem Sperrbildschirm anzeigen und zum Entsperren auffordern (für den QR-Scan). */
    private fun handleAlarmIntent(intent: Intent?) {
        val ringing = intent?.getBooleanExtra(AlarmService.EXTRA_ALARM, false) == true || AnkerPrefs.isRinging(this)
        setShowWhenLocked(ringing)
        setTurnScreenOn(ringing)
        if (ringing) {
            getSystemService(KeyguardManager::class.java)?.requestDismissKeyguard(this, null)
            AnkerNativePlugin.notifyRinging()
        }
    }
}
