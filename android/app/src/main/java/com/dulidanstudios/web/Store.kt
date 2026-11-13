package com.dulidanstudios.web

/* Dulidan Web Android · Einstellungen, Sitzung (offene Tabs) und Verlauf in SharedPreferences */

import android.content.Context
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject

class Store(ctx: Context) {
    private val p = ctx.getSharedPreferences("dw", Context.MODE_PRIVATE)

    /* Hat das System Animationen abgeschaltet, starten wir mit "aus" */
    private val systemNoAnim = try {
        Settings.Global.getFloat(ctx.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    } catch (_: Exception) { false }

    var engine: String
        get() {
            /* Einmalig: alter Standard DuckDuckGo wird zur eigenen Ergebnisseite */
            if (!p.getBoolean("engineV2", false)) {
                val old = p.getString("engine", null)
                p.edit().putBoolean("engineV2", true).apply { if (old == null || old == "duckduckgo") putString("engine", "dulidan") }.apply()
            }
            return p.getString("engine", "dulidan") ?: "dulidan"
        }
        set(v) = p.edit().putString("engine", v).apply()
    var accent: String
        get() = p.getString("accent", "dulidan") ?: "dulidan"
        set(v) = p.edit().putString("accent", v).apply()
    /* Eigene Akzentfarbe aus dem Spektrum (accent = "custom") */
    var customColor: Int
        get() = p.getInt("customColor", 0xFFC020B8.toInt())
        set(v) = p.edit().putInt("customColor", v).apply()
    /* Objekt in der Mitte der Startseite: d, japan, blume, galaxie … */
    var center: String
        get() = p.getString("center", "d") ?: "d"
        set(v) = p.edit().putString("center", v).apply()
    /* Widget-Farbe: "app" (wie die App), ein Akzent oder "custom" */
    var widgetColor: String
        get() = p.getString("widgetColor", "app") ?: "app"
        set(v) = p.edit().putString("widgetColor", v).apply()
    var widgetCustom: Int
        get() = p.getInt("widgetCustom", 0xFF00B7FF.toInt())
        set(v) = p.edit().putInt("widgetCustom", v).apply()
    /* Drei Töne fürs Widget */
    fun widgetTones(): Triple<Int, Int, Int> = when (widgetColor) {
        "app" -> Dw.tonesOf(accent, customColor)
        "custom" -> Dw.tones(widgetCustom)
        else -> Dw.tonesOf(widgetColor, 0)
    }
    var anim: String
        get() = p.getString("anim", if (systemNoAnim) "aus" else "episch") ?: "episch"
        set(v) = p.edit().putString("anim", v).apply()
    var adblock: Boolean
        get() = p.getBoolean("adblock", true)
        set(v) = p.edit().putBoolean("adblock", v).apply()
    var booted: Boolean
        get() = p.getBoolean("booted", false)
        set(v) = p.edit().putBoolean("booted", v).apply()

    fun saveSession(urls: List<String>, active: Int) {
        p.edit().putString("session", JSONObject().put("tabs", JSONArray(urls)).put("active", active).toString()).apply()
    }
    fun session(): Pair<List<String>, Int>? = try {
        val o = JSONObject(p.getString("session", null) ?: return null)
        val a = o.getJSONArray("tabs")
        Pair((0 until a.length()).map { a.getString(it) }, o.optInt("active", 0))
    } catch (_: Exception) { null }

    fun addHistory(url: String, title: String) {
        if (!url.startsWith("http")) return
        val old = history().filter { it.first != url }
        val a = JSONArray()
        a.put(JSONArray().put(url).put(title))
        for ((u, t) in old.take(299)) a.put(JSONArray().put(u).put(t))
        p.edit().putString("history", a.toString()).apply()
    }
    fun history(): List<Pair<String, String>> = try {
        val a = JSONArray(p.getString("history", "[]"))
        (0 until a.length()).map { val e = a.getJSONArray(it); Pair(e.getString(0), e.optString(1)) }
    } catch (_: Exception) { emptyList() }
}
