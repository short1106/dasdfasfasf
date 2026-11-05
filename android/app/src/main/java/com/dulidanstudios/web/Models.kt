package com.dulidanstudios.web

/* Dulidan Web Android · Sprachpakete für den lokalen Übersetzer (Mozilla Bergamot), wie main/translate-models.js am Desktop
   Lädt Modelle einmalig aus dem öffentlichen Bergamot-Speicher, prüft die SHA-256-Summe aus dem Verzeichnis und legt sie
   in den App-Dateien ab. Danach übersetzt das Handy offline, kein Text verlässt das Gerät.
   Läuft im Hintergrund-Thread von shouldInterceptRequest, darf also blockieren. */

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

object Models {
    private const val VERSION = "0.3.3"
    private const val BASE = "https://storage.googleapis.com/bergamot-models-sandbox/$VERSION"
    private const val MAX = 120L * 1024 * 1024
    private val NAME = Regex("^([a-z]{4})/([\\w.\\-]+)$")
    private var registry: JSONObject? = null
    private val locks = ConcurrentHashMap<String, Any>()

    private fun dir(ctx: Context) = File(ctx.filesDir, "translate-models/$VERSION")

    private fun open(name: String): HttpURLConnection {
        val c = URL("$BASE/$name").openConnection() as HttpURLConnection
        c.connectTimeout = 10000; c.readTimeout = 30000
        if (c.responseCode != 200) { c.disconnect(); throw Exception("HTTP ${c.responseCode}") }
        return c
    }

    /* Verzeichnis aller Sprachpaare, zwischengespeichert, damit es auch offline geht */
    @Synchronized private fun registry(ctx: Context): JSONObject {
        registry?.let { return it }
        val file = File(dir(ctx), "registry.json")
        val reg = try {
            val c = open("registry.json"); val txt = c.inputStream.bufferedReader().use { it.readText() }; c.disconnect()
            JSONObject(txt).also { dir(ctx).mkdirs(); file.writeText(txt) }
        } catch (e: Exception) {
            if (file.exists()) JSONObject(file.readText()) else throw e
        }
        registry = reg
        return reg
    }

    /* name = "registry.json" oder "<paar>/<datei>", z. B. "deen/vocab.deen.spm" */
    fun get(ctx: Context, name: String): File {
        if (name == "registry.json") { registry(ctx); return File(dir(ctx), "registry.json") }
        val m = NAME.matchEntire(name) ?: throw Exception("Ungültiger Name")
        val (pair, fname) = m.destructured
        val files = registry(ctx).optJSONObject(pair) ?: throw Exception("Unbekanntes Paar")
        var entry: JSONObject? = null
        for (k in files.keys()) { val e = files.optJSONObject(k); if (e != null && e.optString("name") == fname) entry = e }
        if (entry == null) throw Exception("Unbekannte Datei")
        val file = File(dir(ctx), "$pair/$fname")
        synchronized(locks.getOrPut(name) { Any() }) {
            if (file.exists()) return file
            file.parentFile?.mkdirs()
            val tmp = File(file.path + ".part")
            val sha = MessageDigest.getInstance("SHA-256")
            val c = open(name)
            try {
                var total = 0L
                c.inputStream.use { inp -> tmp.outputStream().use { out ->
                    val buf = ByteArray(65536)
                    while (true) { val n = inp.read(buf); if (n < 0) break; total += n; if (total > MAX) throw Exception("Zu groß"); sha.update(buf, 0, n); out.write(buf, 0, n) }
                } }
            } catch (e: Exception) { tmp.delete(); throw e } finally { c.disconnect() }
            val hex = sha.digest().joinToString("") { "%02x".format(it) }
            val want = entry.optString("expectedSha256Hash")
            if (want.isNotEmpty() && hex != want) { tmp.delete(); throw Exception("Prüfsumme falsch") }
            if (!tmp.renameTo(file)) { tmp.delete(); throw Exception("Speichern fehlgeschlagen") }
            return file
        }
    }

    /* Welche Paare liegen schon lokal? (für „offline bereit“ auf der Seite) */
    fun installed(ctx: Context): JSONArray {
        val arr = JSONArray()
        dir(ctx).listFiles()?.filter { it.isDirectory && Regex("^[a-z]{4}$").matches(it.name) }?.forEach { arr.put(it.name) }
        return arr
    }
}
