package com.dulidanstudios.web

/* Dulidan Web Android · eigene Ergebnisseite unter https://dulidan.search/
   Die Seite (shared/search, gleiche Dateien wie am Desktop) kommt aus den Assets, Treffer holt /api/fetch nativ – nur von festen Quellen. */

import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

object SearchProxy {
    const val HOST = "dulidan.search"
    const val PAGE = "https://$HOST/search/index.html"
    private val SOURCES = setOf("html.duckduckgo.com", "lite.duckduckgo.com", "duckduckgo.com", "de.wikipedia.org")
    private val MIME = mapOf("html" to "text/html", "css" to "text/css", "js" to "text/javascript", "webp" to "image/webp", "woff2" to "font/woff2", "png" to "image/png", "svg" to "image/svg+xml")
    var ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"

    /* Suchbegriff, wenn eine Adresse die eigene Ergebnisseite ist */
    fun queryOf(url: String?): String? {
        if (url == null || !url.startsWith(PAGE)) return null
        return try { android.net.Uri.parse(url).getQueryParameter("q") ?: "" } catch (_: Exception) { null }
    }

    fun handle(ctx: Context, r: WebResourceRequest): WebResourceResponse? {
        val u = r.url
        if (u.scheme != "https" || u.host != HOST) return null
        val path = u.path ?: "/"
        if (path == "/api/fetch") return api(r)
        /* Nur die Such-Dateien und den geteilten Rechner ausliefern */
        val file = path.removePrefix("/")
        if (!(file.startsWith("search/") || file == "calc.js") || file.contains("..")) return status(404)
        return try {
            val type = MIME[file.substringAfterLast('.', "")] ?: "application/octet-stream"
            WebResourceResponse(type, if (type.startsWith("text/")) "utf-8" else null, ctx.assets.open(file)).apply {
                responseHeaders = mapOf("Cache-Control" to "no-cache")
            }
        } catch (_: Exception) { status(404) }
    }

    private fun api(r: WebResourceRequest): WebResourceResponse {
        /* Eigener Header: fremde Seiten bräuchten dafür eine CORS-Vorabanfrage, die nie beantwortet wird */
        val hdr = r.requestHeaders.entries.firstOrNull { it.key.equals("x-dw", true) }?.value
        if (r.method != "GET" || hdr != "1") return status(403)
        val target = try { URL(r.url.getQueryParameter("u") ?: "") } catch (_: Exception) { return status(400) }
        if (target.protocol != "https" || target.host !in SOURCES) return status(403)
        val post = r.url.getQueryParameter("post")
        val out = JSONObject()
        try {
            val c = target.openConnection() as HttpURLConnection
            c.connectTimeout = 8000; c.readTimeout = 9000
            c.setRequestProperty("User-Agent", ua)
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
        return WebResourceResponse("application/json", "utf-8", ByteArrayInputStream(out.toString().toByteArray())).apply { responseHeaders = mapOf("Cache-Control" to "no-store") }
    }

    private fun status(code: Int) = WebResourceResponse("text/plain", "utf-8", code, if (code == 404) "Not Found" else "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}
