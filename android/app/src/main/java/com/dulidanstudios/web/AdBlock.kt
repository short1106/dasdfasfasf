package com.dulidanstudios.web

/* Dulidan Web Android · Werbeblocker
   Lädt die StevenBlack-Hosts-Liste (Werbung + Tracker + Malware), speichert sie lokal und aktualisiert wöchentlich.
   Blockiert werden nur Unteranfragen einer Seite, nie die Seite selbst. */

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object AdBlock {
    private const val LIST = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"
    @Volatile private var hosts: Set<String> = emptySet()
    @Volatile var count = 0; private set

    fun init(ctx: Context) {
        thread(name = "adblock", isDaemon = true) {
            val f = File(ctx.filesDir, "hosts.txt")
            if (f.exists()) parse(f)
            if (!f.exists() || System.currentTimeMillis() - f.lastModified() > 7L * 24 * 3600 * 1000) {
                try {
                    val c = URL(LIST).openConnection() as HttpURLConnection
                    c.connectTimeout = 15000; c.readTimeout = 30000
                    val tmp = File(ctx.filesDir, "hosts.tmp")
                    c.inputStream.use { inp -> tmp.outputStream().use { inp.copyTo(it) } }
                    c.disconnect()
                    if (tmp.length() > 10000 && tmp.renameTo(f)) parse(f)
                } catch (_: Exception) {}
            }
        }
    }

    private fun parse(f: File) {
        val set = HashSet<String>(160_000)
        f.forEachLine { line ->
            if (line.startsWith("0.0.0.0 ")) {
                val h = line.substring(8).substringBefore('#').trim().lowercase()
                if (h.isNotEmpty() && h != "0.0.0.0") set.add(h)
            }
        }
        hosts = set
        count = set.size
    }

    /* Host oder eine seiner Elterndomains steht auf der Liste */
    fun blocked(host: String?): Boolean {
        var h = host?.lowercase() ?: return false
        val set = hosts
        if (set.isEmpty()) return false
        while (true) {
            if (set.contains(h)) return true
            val i = h.indexOf('.')
            if (i < 0) return false
            h = h.substring(i + 1)
            if (!h.contains('.')) return false
        }
    }
}
