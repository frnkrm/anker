package de.frnkrm.anker

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Explicit bounded NSD scan; no SSID, location or persistent multicast listener. */
internal object PcBridgeDiscovery {
    fun discover(context: Context, timeoutMs: Long): JSONObject {
        val manager = context.getSystemService(NsdManager::class.java) ?: return JSONObject().put("devices", JSONArray())
        val found = linkedMapOf<String, JSONObject>()
        val lock = Any()
        val done = CountDownLatch(1)
        var multicast: WifiManager.MulticastLock? = null
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(type: String) = Unit
            override fun onServiceFound(info: NsdServiceInfo) {
                if (!info.serviceType.startsWith("_anker._tcp")) return
                synchronized(lock) { if (found.size >= 10) return }
                @Suppress("DEPRECATION")
                manager.resolveService(info, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(service: NsdServiceInfo, code: Int) = Unit
                    override fun onServiceResolved(service: NsdServiceInfo) {
                        val host = service.host ?: return
                        if (!PcLinkModel.privateAddress(host) || service.port !in 1..65535) return
                        val address = host.hostAddress ?: return
                        val authority = PcLinkModel.Endpoint(address, service.port).authority()
                        val version = service.attributes["v"]?.toString(Charsets.UTF_8)?.toIntOrNull() ?: 3
                        synchronized(lock) {
                            if (found.size < 10) found[authority] = JSONObject().put("name", service.serviceName.take(100))
                                .put("host", address).put("port", service.port).put("version", version)
                        }
                    }
                })
            }
            override fun onServiceLost(info: NsdServiceInfo) = Unit
            override fun onDiscoveryStopped(type: String) { done.countDown() }
            override fun onStartDiscoveryFailed(type: String, code: Int) { done.countDown() }
            override fun onStopDiscoveryFailed(type: String, code: Int) { done.countDown() }
        }
        try {
            multicast = (context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager)
                ?.createMulticastLock("anker-pc-discovery")?.apply { setReferenceCounted(false); acquire() }
            manager.discoverServices("_anker._tcp.", NsdManager.PROTOCOL_DNS_SD, listener)
            done.await(timeoutMs.coerceIn(500, 10_000), TimeUnit.MILLISECONDS)
        } catch (_: SecurityException) { throw IllegalStateException("PC_NETWORK_PERMISSION") }
        finally {
            try { manager.stopServiceDiscovery(listener) } catch (_: Exception) { /* discovery may not have started */ }
            if (multicast?.isHeld == true) multicast.release()
        }
        val devices = JSONArray()
        synchronized(lock) { found.values.forEach { devices.put(it) } }
        return JSONObject().put("devices", devices)
    }
}
