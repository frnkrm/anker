package de.frnkrm.anker

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

/** Ausschließlich die separat gewählte Bildschirmsperre; keine weiteren Administratorregeln. */
class SleepLockAdmin : DeviceAdminReceiver() {
    companion object {
        private fun component(ctx: Context) = ComponentName(ctx, SleepLockAdmin::class.java)
        fun supported(ctx: Context) = ctx.packageManager.hasSystemFeature(PackageManager.FEATURE_DEVICE_ADMIN)
        fun available(ctx: Context) = supported(ctx) && ctx.getSystemService(DevicePolicyManager::class.java)?.isAdminActive(component(ctx)) == true
        fun permissionIntent(ctx: Context) = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component(ctx))
            .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Nur nach deiner Wahl: Bildschirm nach dem Start der Nachtmessung sperren. Die Sperre garantiert nicht, dass andere Apps keine Medien mehr abspielen.")
        fun lockIfAllowed(ctx: Context): Boolean = try {
            if (!available(ctx)) false else { ctx.getSystemService(DevicePolicyManager::class.java).lockNow(); true }
        } catch (_: Exception) { false }
    }
}
