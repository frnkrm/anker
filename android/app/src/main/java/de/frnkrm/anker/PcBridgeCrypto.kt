package de.frnkrm.anker

import java.math.BigInteger
import java.nio.charset.StandardCharsets.UTF_8
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Standard JCA primitives shared with the WebCrypto/Python v3 wire contract. */
object PcBridgeCrypto {
    data class DirectionKeys(val phoneToPc: ByteArray, val pcToPhone: ByteArray)
    data class Header(val pair: String, val from: String, val seq: Long, val sentAt: String) {
        fun aad(): ByteArray = ("{\"from\":" + quote(from) + ",\"kind\":\"anker-link\",\"pair\":" + quote(pair) +
            ",\"sentAt\":" + quote(sentAt) + ",\"seq\":" + seq + ",\"v\":3}").toByteArray(UTF_8)
    }

    fun generateEphemeral(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    fun random(count: Int): ByteArray = ByteArray(count).also { SecureRandom().nextBytes(it) }
    fun publicSec1(key: java.security.PublicKey): ByteArray {
        val public = key as ECPublicKey
        return byteArrayOf(4) + unsigned32(public.w.affineX) + unsigned32(public.w.affineY)
    }

    fun decodePublic(bytes: ByteArray): java.security.PublicKey {
        require(bytes.size == 65 && bytes[0] == 4.toByte()) { "PC_PUBLIC_KEY_INVALID" }
        val parameters = AlgorithmParameters.getInstance("EC").apply { init(ECGenParameterSpec("secp256r1")) }.getParameterSpec(ECParameterSpec::class.java)
        val x = BigInteger(1, bytes.copyOfRange(1, 33)); val y = BigInteger(1, bytes.copyOfRange(33, 65))
        val prime = (parameters.curve.field as java.security.spec.ECFieldFp).p
        require(x < prime && y < prime && y.multiply(y).mod(prime) == x.pow(3).add(parameters.curve.a.multiply(x)).add(parameters.curve.b).mod(prime)) { "PC_PUBLIC_KEY_INVALID" }
        return KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(ECPoint(x, y), parameters))
    }

    fun derive(private: PrivateKey, peer: ByteArray, salt: ByteArray): DirectionKeys {
        require(salt.size == 32) { "PC_PAIR_SECRET_INVALID" }
        val ikm = KeyAgreement.getInstance("ECDH").apply { init(private); doPhase(decodePublic(peer), true) }.generateSecret()
        require(ikm.size == 32) { "PC_PUBLIC_KEY_INVALID" }
        return try { DirectionKeys(hkdf(ikm, salt, "anker-link v3 phone->pc"), hkdf(ikm, salt, "anker-link v3 pc->phone")) }
        finally { ikm.fill(0) }
    }

    fun hmac(key: ByteArray, bytes: ByteArray): ByteArray = Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(key, "HmacSHA256")); doFinal(bytes) }
    fun hkdf(ikm: ByteArray, salt: ByteArray, info: String): ByteArray {
        val prk = hmac(salt, ikm)
        return try { hmac(prk, info.toByteArray(UTF_8) + byteArrayOf(1)) } finally { prk.fill(0) }
    }
    fun confirmationCode(pcPublic: ByteArray, phonePublic: ByteArray): String {
        val hash = MessageDigest.getInstance("SHA-256").digest(pcPublic + phonePublic)
        val number = ((hash[0].toLong() and 255) shl 24) or ((hash[1].toLong() and 255) shl 16) or ((hash[2].toLong() and 255) shl 8) or (hash[3].toLong() and 255)
        return (number % 10_000).toString().padStart(4, '0')
    }
    fun seal(key: ByteArray, nonce: ByteArray, header: Header, plaintext: ByteArray): ByteArray = cipher(Cipher.ENCRYPT_MODE, key, nonce, header.aad()).doFinal(plaintext)
    fun open(key: ByteArray, nonce: ByteArray, header: Header, ciphertext: ByteArray): ByteArray = cipher(Cipher.DECRYPT_MODE, key, nonce, header.aad()).doFinal(ciphertext)
    private fun cipher(mode: Int, key: ByteArray, nonce: ByteArray, aad: ByteArray): Cipher {
        require(key.size == 32 && nonce.size == 12) { "PC_CIPHER_INPUT_INVALID" }
        return Cipher.getInstance("AES/GCM/NoPadding").apply { init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce)); updateAAD(aad) }
    }
    fun sign(private: PrivateKey, canonical: ByteArray): ByteArray = Signature.getInstance("SHA256withECDSA").run { initSign(private); update(canonical); sign() }
    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)
    private fun unsigned32(value: BigInteger): ByteArray = value.toByteArray().let { bytes -> if (bytes.size == 33 && bytes[0] == 0.toByte()) bytes.copyOfRange(1, 33) else ByteArray(32 - bytes.size) + bytes }
    fun quote(value: String): String = buildString {
        append('"'); for (char in value) when (char) {
            '"' -> append("\\\""); '\\' -> append("\\\\"); '\b' -> append("\\b"); '\u000c' -> append("\\f"); '\n' -> append("\\n"); '\r' -> append("\\r"); '\t' -> append("\\t")
            else -> if (char.code < 32) append("\\u" + char.code.toString(16).padStart(4, '0')) else append(char)
        }; append('"')
    }
}
