package com.dulidanstudios.web

/* Dulidan Web Android · eigene Seiten unter https://dulidan.search/ (gleiche Dateien wie am Desktop, aus shared/)
   Ergebnisseite (search/), Dulidan Maps (maps/), Übersetzer (translate/), dazu Kartenbibliothek und Übersetzer-Engine (vendor/).
   API: /api/fetch holt nativ – nur von festen Quellen –, /api/mapconfig liefert die Kartenquelle, /api/model die Sprachpakete. */

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL

object SearchProxy {
    const val HOST = "dulidan.search"
    const val PAGE = "https://$HOST/search/index.html"
    const val MAPS = "https://$HOST/maps/index.html"
    const val TRANSLATE = "https://$HOST/translate/index.html"
    /* Gleiche Liste wie am Desktop (main.js PROXY_HOSTS) – nicht aufweichen */
    private val SOURCES = setOf("html.duckduckgo.com", "lite.duckduckgo.com", "duckduckgo.com", "de.wikipedia.org", "api.mymemory.translated.net",
        "photon.komoot.io", "routing.openstreetmap.de", "get.geojs.io",
        /* Sofort-Antworten der Ergebnisseite: Wetter, EZB-Kurse, Fußball, Formel 1 */
        "api.open-meteo.com", "geocoding-api.open-meteo.com", "api.frankfurter.dev", "api.openligadb.de", "api.jolpi.ca",
        /* Maps: News pro Land (GDELT) */
        "api.gdeltproject.org")
    /* OSM-Dienste wollen eine ehrliche App-Kennung statt eines Browser-UA */
    private val OSM = setOf("photon.komoot.io", "routing.openstreetmap.de")
    private val FILES = listOf("search/", "maps/", "translate/", "vendor/maplibre/", "vendor/bergamot/")
    private val MIME = mapOf("html" to "text/html", "css" to "text/css", "js" to "text/javascript", "mjs" to "text/javascript", "json" to "application/json",
        "webp" to "image/webp", "woff2" to "font/woff2", "png" to "image/png", "svg" to "image/svg+xml", "wasm" to "application/wasm")
    private const val MAP_CONFIG = """{"tiles":"https://tiles.openfreemap.org/planet","glyphs":"https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"}"""
    var ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
    private var appUa: String? = null

    /* Für die Adressleiste: "Dulidan · begriff", "Maps · ort", "Übersetzer · text" statt der internen Adresse */
    fun queryOf(url: String?): String? {
        if (url == null || !url.startsWith(PAGE)) return null
        return try { Uri.parse(url).getQueryParameter("q") ?: "" } catch (_: Exception) { null }
    }
    fun labelOf(url: String?): String? {
        if (url == null) return null
        val (name, prefix) = when {
            url.startsWith(MAPS) -> "Maps" to MAPS
            url.startsWith(TRANSLATE) -> "Übersetzer" to TRANSLATE
            else -> return null
        }
        val q = try { Uri.parse(url).getQueryParameter("q") } catch (_: Exception) { null }
        return if (q.isNullOrBlank() || !url.startsWith(prefix)) name else "$name · $q"
    }

    fun handle(ctx: Context, r: WebResourceRequest): WebResourceResponse? {
        val u = r.url
        if (u.scheme != "https" || u.host != HOST) return null
        val path = u.path ?: "/"
        when (path) {
            "/api/fetch" -> return api(ctx, r)
            "/api/mapconfig" -> return json(MAP_CONFIG)
            "/api/model" -> return model(ctx, r)
        }
        /* Nur die eigenen Seiten, die beiden Bibliotheken und den geteilten Rechner ausliefern */
        val file = path.removePrefix("/")
        if (file.contains("..") || !(file == "calc.js" || FILES.any { file.startsWith(it) })) return status(404)
        return try {
            val type = MIME[file.substringAfterLast('.', "")] ?: "application/octet-stream"
            WebResourceResponse(type, if (type.startsWith("text/") || type == "application/json") "utf-8" else null, ctx.assets.open(file)).apply {
                responseHeaders = mapOf("Cache-Control" to "no-cache")
            }
        } catch (_: Exception) { status(404) }
    }

    /* Eigener Header: fremde Seiten bräuchten dafür eine CORS-Vorabanfrage, die nie beantwortet wird */
    private fun trusted(r: WebResourceRequest) = r.requestHeaders.entries.firstOrNull { it.key.equals("x-dw", true) }?.value == "1"

    private fun api(ctx: Context, r: WebResourceRequest): WebResourceResponse {
        if (r.method != "GET" || !trusted(r)) return status(403)
        val target = try { URL(r.url.getQueryParameter("u") ?: "") } catch (_: Exception) { return status(400) }
        if (target.protocol != "https" || target.host !in SOURCES) return status(403)
        val post = r.url.getQueryParameter("post")
        val out = JSONObject()
        try {
            val c = target.openConnection() as HttpURLConnection
            c.connectTimeout = 8000; c.readTimeout = 9000
            c.setRequestProperty("User-Agent", if (target.host in OSM) appUa(ctx) else ua)
            c.setRequestProperty("Accept-Language", "de-DE,de;q=0.9,en;q=0.6")
            if (target.host.endsWith("duckduckgo.com")) c.setRequestProperty("Referer", "https://duckduckgo.com/")
            if (post != null) {
                c.requestMethod = "POST"; c.doOutput = true
                c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                c.outputStream.use { it.write(post.toByteArray()) }
            }
            val code = c.responseCode
            val stream = if (code >= 400) c.errorStream else c.inputStream
            val body = stream?.bufferedReader()?.use { rd ->
                val sb = StringBuilder(); val buf = CharArray(16384)
                while (sb.length < 4 * 1024 * 1024) { val n = rd.read(buf); if (n < 0) break; sb.append(buf, 0, n) }
                sb.toString()
            } ?: ""
            c.disconnect()
            out.put("status", code).put("body", body)
        } catch (_: Exception) {
            out.put("status", 599).put("body", "")
        }
        return json(out.toString(), "no-store")
    }

    /* Sprachpakete: einmal laden, Prüfsumme prüfen, in der App ablegen, danach offline (Models.kt) */
    private fun model(ctx: Context, r: WebResourceRequest): WebResourceResponse {
        if (r.method != "GET" || !trusted(r)) return status(403)
        val f = r.url.getQueryParameter("f") ?: ""
        if (f == "__installed") return json(Models.installed(ctx).toString(), "no-store")
        return try {
            val file = Models.get(ctx, f)
            WebResourceResponse("application/octet-stream", null, 200, "OK", mapOf("Cache-Control" to "no-store"), FileInputStream(file))
        } catch (e: Exception) {
            WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", emptyMap(), ByteArrayInputStream((e.message ?: "Fehler").toByteArray()))
        }
    }

    private fun appUa(ctx: Context): String = appUa ?: run {
        val v = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName } catch (_: Exception) { null } ?: "0.2"
        "DulidanWeb/$v (Android; +https://github.com/short1106/dasdfasfasf)".also { appUa = it }
    }
    private fun json(s: String, cache: String = "no-cache") =
        WebResourceResponse("application/json", "utf-8", ByteArrayInputStream(s.toByteArray())).apply { responseHeaders = mapOf("Cache-Control" to cache) }
    private fun status(code: Int) = WebResourceResponse("text/plain", "utf-8", code, if (code == 404) "Not Found" else "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}
