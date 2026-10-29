package com.dulidanstudios.web

/* Dulidan Web Android · Eingabe auflösen (Adresse / Suche / Shortcut) und Live-Vorschläge */

import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONArray

object Search {
    val ENGINES = linkedMapOf(
        "duckduckgo" to Pair("DuckDuckGo", "https://duckduckgo.com/?q=%s"),
        "google" to Pair("Google", "https://www.google.com/search?q=%s"),
        "bing" to Pair("Bing", "https://www.bing.com/search?q=%s"),
        "brave" to Pair("Brave", "https://search.brave.com/search?q=%s"),
        "ecosia" to Pair("Ecosia", "https://www.ecosia.org/search?q=%s"),
        "startpage" to Pair("Startpage", "https://www.startpage.com/do/search?query=%s")
    )
    /* Kürzel → (Name, Such-URL, Start-URL) */
    val SHORTCUTS = linkedMapOf(
        "yt" to Triple("YouTube", "https://m.youtube.com/results?search_query=%s", "https://m.youtube.com"),
        "gh" to Triple("GitHub", "https://github.com/search?q=%s", "https://github.com"),
        "wiki" to Triple("Wikipedia", "https://de.m.wikipedia.org/w/index.php?search=%s", "https://de.m.wikipedia.org"),
        "maps" to Triple("Maps", "https://www.google.com/maps/search/%s", "https://www.google.com/maps"),
        "mc" to Triple("Minecraft Wiki", "https://de.minecraft.wiki/?search=%s", "https://de.minecraft.wiki")
    )
    private val SHORT = Regex("^(yt|gh|wiki|maps|mc)\\s+(.*)$", RegexOption.IGNORE_CASE)
    private val HOSTLIKE = Regex("^(?:[\\w-]+\\.)+[a-z][a-z0-9-]{1,62}(?::\\d{1,5})?(?:[/?#].*)?$", RegexOption.IGNORE_CASE)
    private val LOCAL = Regex("^(?:localhost|\\d{1,3}(?:\\.\\d{1,3}){3})(?::\\d{1,5})?(?:[/?#].*)?$", RegexOption.IGNORE_CASE)

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    fun shortcutOf(text: String): String? = SHORT.matchEntire(text.trim())?.groupValues?.get(1)?.lowercase()

    /* Text → Ziel-URL */
    fun resolve(raw: String, engine: String): String? {
        val q = raw.trim()
        if (q.isEmpty()) return null
        SHORTCUTS[q.lowercase()]?.let { return it.third }
        SHORT.matchEntire(q)?.let { m ->
            val sc = SHORTCUTS.getValue(m.groupValues[1].lowercase())
            val rest = m.groupValues[2].trim()
            return if (rest.isEmpty()) sc.third else sc.second.replace("%s", enc(rest))
        }
        if (Regex("^(https?)://", RegexOption.IGNORE_CASE).containsMatchIn(q)) return q
        if (!q.contains(' ')) {
            if (LOCAL.matches(q)) return "http://$q"
            if (HOSTLIKE.matches(q) && !Regex("^\\d+(\\.\\d+)+$").matches(q)) return "https://$q"
        }
        return (ENGINES[engine] ?: ENGINES.getValue("duckduckgo")).second.replace("%s", enc(q))
    }

    fun engineName(engine: String) = (ENGINES[engine] ?: ENGINES.getValue("duckduckgo")).first

    /* DuckDuckGo-Vorschläge (blockierend – nur im Hintergrund-Thread aufrufen) */
    fun suggest(q: String): List<String> = try {
        val c = URL("https://duckduckgo.com/ac/?type=list&q=" + enc(q)).openConnection() as HttpURLConnection
        c.connectTimeout = 2500; c.readTimeout = 2500
        val body = c.inputStream.bufferedReader().use { it.readText() }
        c.disconnect()
        val arr = JSONArray(body).getJSONArray(1)
        (0 until minOf(6, arr.length())).map { arr.getString(it) }
    } catch (_: Exception) { emptyList() }
}
