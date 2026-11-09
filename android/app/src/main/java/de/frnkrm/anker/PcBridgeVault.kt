package de.frnkrm.anker

import android.content.Context
import android.os.UserManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.spec.ECGenParameterSpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** A separate credential-protected store, encrypted with a non-exportable Android key. */
internal class PcBridgeVault(context: Context) {
    private val ctx = if (context.isDeviceProtectedStorage) context.createCredentialProtectedStorageContext() else context.applicationContext
    private val prefs get() = ctx.getSharedPreferences("anker_pc_bridge_secure_v3", Context.MODE_PRIVATE)
    private val store get() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun unlocked() {
        check(ctx.getSystemService(UserManager::class.java)?.isUserUnlocked != false) { "PC_UNLOCK_REQUIRED" }
    }
    private fun master(): SecretKey {
        val keys = store
        (keys.getKey(MASTER_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(MASTER_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(false).build())
        }.generateKey()
    }

    fun read(): JSONObject {
        unlocked()
        val raw = prefs.getString("sealed", null) ?: return JSONObject()
        try {
            check(raw.length <= 3_000_000) { "PC_SECURE_STORAGE_INVALID" }
            val bytes = java.util.Base64.getUrlDecoder().decode(raw)
            check(bytes.size > 28) { "PC_SECURE_STORAGE_INVALID" }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, master(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            return JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
        } catch (_: Exception) { throw IllegalStateException("PC_SECURE_STORAGE_UNAVAILABLE") }
    }

    fun write(value: JSONObject) {
        unlocked()
        check(value.toString().toByteArray(Charsets.UTF_8).size <= 2_000_000) { "PC_EVENT_QUEUE_FULL" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, master())
        val encoded = PcLinkModel.encoded(cipher.iv + cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8)))
        check(prefs.edit().putString("sealed", encoded).commit()) { "PC_SECURE_STORAGE_WRITE_FAILED" }
    }

    fun emergencyKey(pair: String): PrivateKey {
        unlocked()
        val keys = store
        val alias = EMERGENCY_PREFIX + PcLinkModel.hex(PcBridgeCrypto.sha256(pair.toByteArray(Charsets.UTF_8)))
        (keys.getKey(alias, null) as? PrivateKey)?.let { return it }
        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").apply {
            initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256).setUserAuthenticationRequired(false).build())
        }.generateKeyPair()
        return keys.getKey(alias, null) as PrivateKey
    }

    fun emergencyPublic(pair: String): ByteArray {
        emergencyKey(pair)
        val alias = EMERGENCY_PREFIX + PcLinkModel.hex(PcBridgeCrypto.sha256(pair.toByteArray(Charsets.UTF_8)))
        return PcBridgeCrypto.publicSec1(store.getCertificate(alias).publicKey)
    }

    fun deleteEmergencyKey(pair: String) {
        unlocked()
        store.deleteEntry(EMERGENCY_PREFIX + PcLinkModel.hex(PcBridgeCrypto.sha256(pair.toByteArray(Charsets.UTF_8))))
    }

    fun clear() {
        unlocked()
        check(prefs.edit().clear().commit()) { "PC_SECURE_STORAGE_WRITE_FAILED" }
        val keys = store
        for (alias in keys.aliases().toList()) if (alias.startsWith(EMERGENCY_PREFIX)) keys.deleteEntry(alias)
        // The master is scoped to this module. Clearing can recover an invalidated vault.
        keys.deleteEntry(MASTER_ALIAS)
    }

    companion object {
        private const val MASTER_ALIAS = "anker.pc.bridge.v3.vault"
        private const val EMERGENCY_PREFIX = "anker.pc.bridge.v3.emergency."
    }
}
