package com.dulidanstudios.web

/* Dulidan Web Android · Hauptaktivität
   Aufbau: Ebenen · Tabs/WebViews · Navigation mit Partikel-Morph · Startseite (Brücke) · Leiste/Vorschläge · Tab-Übersicht · Menü · System */

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

class Tab(val id: Int) {
    var web: WebView? = null
    var url = ""
    var title = ""
    var home = true
    var progress = 0
    val blocked = AtomicInteger(0)
    var thumb: Bitmap? = null
    var desktop = false
}

class MainActivity : Activity() {
    private lateinit var store: Store
    private lateinit var root: FrameLayout
    private lateinit var pages: FrameLayout
    private lateinit var home: WebView
    private lateinit var morphFx: FxView
    private lateinit var topFx: FxView
    private lateinit var bar: BottomBar
    private lateinit var suggest: SuggestPanel
    private lateinit var switcher: SwitcherView
    private lateinit var menu: MenuSheet
    private lateinit var toaster: Toaster
    private val ui = Handler(Looper.getMainLooper())

    private val tabs = ArrayList<Tab>()
    private var active: Tab? = null
    private var nextId = 1
    private var insetTop = 0
    private var insetBottom = 0
    private var barH = 0
    private var homeReady = false
    @Volatile private var adblockOn = true
    private var morph: FxView.Morph? = null
    private var morphTab: Tab? = null
    private var fullView: View? = null
    private var fullCb: WebChromeClient.CustomViewCallback? = null
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var suggestSeq = 0

    /* ===================== Aufbau ===================== */
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(saved: Bundle?) {
        super.onCreate(saved)
        Dw.init(this); Haptic.init(this)
        store = Store(this)
        Dw.accent(store.accent); Dw.anim = store.anim; adblockOn = store.adblock
        edgeToEdge()
        AdBlock.init(this)

        root = FrameLayout(this).apply { setBackgroundColor(Dw.BG) }
        pages = FrameLayout(this)
        home = WebView(this).apply {
            setBackgroundColor(Dw.BG)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER
            addJavascriptInterface(HomeBridge(), "Dulidan")       /* nur auf der lokalen Startseite, nie in fremden Seiten */
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean { go(r.url.toString()); return true }
            }
            loadUrl("file:///android_asset/home/index.html")
        }
        morphFx = FxView(this)
        topFx = FxView(this)
        bar = BottomBar(this)
        suggest = SuggestPanel(this) { pickSuggestion(it) }
        switcher = SwitcherView(this, topFx, object : SwitcherView.Callbacks {
            override fun open(id: Int) { tabs.find { it.id == id }?.let { activate(it, reveal = false) } }
            override fun close(id: Int) { tabs.find { it.id == id }?.let { closeTab(it, fromSwitcher = true) } }
            override fun newTab() { switcher.hide(); newTab(null) }
            override fun dismissed() {}
        }).apply { visibility = View.INVISIBLE }
        menu = MenuSheet(this, store) { menuAction(it) }

        val mp = ViewGroup.LayoutParams.MATCH_PARENT
        root.addView(pages, FrameLayout.LayoutParams(mp, mp))
        root.addView(home, FrameLayout.LayoutParams(mp, mp))
        root.addView(morphFx, FrameLayout.LayoutParams(mp, mp))
        root.addView(bar, FrameLayout.LayoutParams(mp, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        root.addView(suggest, FrameLayout.LayoutParams(mp, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM).apply { leftMargin = dp(10).toInt(); rightMargin = dp(10).toInt() })
        root.addView(switcher, FrameLayout.LayoutParams(mp, mp))
        root.addView(menu, FrameLayout.LayoutParams(mp, mp))
        root.addView(topFx, FrameLayout.LayoutParams(mp, mp))
        toaster = Toaster(root)
        setContentView(root)
        morphFx.isClickable = false; topFx.isClickable = false

        wireBar()
        root.setOnApplyWindowInsetsListener { _, ins -> applyInsets(ins); ins }

        /* Sitzung wiederherstellen oder frisch starten */
        val s = store.session()
        if (s != null && s.first.any { it.isNotEmpty() }) {
            for (u in s.first.take(30)) { val t = createTab(); if (u.isNotEmpty()) { t.home = false; t.url = u; ensureWeb(t).loadUrl(u) } }
            activate(tabs[s.second.coerceIn(0, tabs.size - 1)], reveal = false)
            toast("↺ ${tabs.size} ${if (tabs.size == 1) "Tab" else "Tabs"} wiederhergestellt")
        } else newTab(null, intro = false)
        handleIntent(intent)

        if (!store.booted) playBoot()
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
                if (!handleBack()) moveTaskToBack(true)
            }
        }
    }

    private fun playBoot() {
        lateinit var boot: BootView
        boot = BootView(this) { store.booted = true; root.removeView(boot); homeJs("dwIntro()") }
        root.addView(boot, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    private fun edgeToEdge() {
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false)
        else @Suppress("DEPRECATION") {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        }
    }

    /* Statusleiste oben, Navigationsleiste/Tastatur unten: Leiste rutscht über die Tastatur */
    private fun applyInsets(ins: WindowInsets) {
        val top: Int; val bottom: Int
        if (Build.VERSION.SDK_INT >= 30) {
            top = ins.getInsets(WindowInsets.Type.statusBars() or WindowInsets.Type.displayCutout()).top
            bottom = ins.getInsets(WindowInsets.Type.navigationBars() or WindowInsets.Type.ime()).bottom
        } else @Suppress("DEPRECATION") { top = ins.systemWindowInsetTop; bottom = ins.systemWindowInsetBottom }
        insetTop = top; insetBottom = bottom
        bar.setPadding(bar.paddingLeft, dp(10).toInt(), bar.paddingRight, dp(10).toInt() + bottom)
        bar.post {
            barH = bar.height
            (pages.layoutParams as FrameLayout.LayoutParams).apply { topMargin = insetTop; bottomMargin = barH }
            pages.requestLayout()
            (suggest.layoutParams as FrameLayout.LayoutParams).bottomMargin = barH + dp(6).toInt(); suggest.requestLayout()
            switcher.contentTop = insetTop.toFloat(); switcher.contentBottom = (root.height - barH).toFloat(); switcher.bottomInset = barH.toFloat()
            menu.bottomInset = bottom
            toaster.bottom = barH
            pushHome()
        }
    }

    /* ===================== Tabs ===================== */
    private fun createTab(): Tab { val t = Tab(nextId++); tabs.add(t); return t }

    private fun newTab(url: String?, intro: Boolean = true) {
        val t = createTab()
        activate(t, reveal = false)
        if (url != null) navigate(t, url) else if (intro) { homeJs("dwClear();dwIntro()") }
        bar.tabs.count = tabs.size
        saveSession()
    }

    private fun activate(t: Tab, reveal: Boolean = true) {
        active?.let { if (it != t) it.thumb = snapshot(it) }
        active = t
        for (o in tabs) o.web?.visibility = if (o == t && !o.home) View.VISIBLE else View.GONE
        home.visibility = if (t.home) View.VISIBLE else View.GONE
        if (t.home) home.onResume()
        if (reveal && !t.home && Dw.on) t.web?.let { w -> w.alpha = 0f; w.scaleX = 1.06f; w.scaleY = 1.06f; w.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(420).setInterpolator(Spring(7f, 9f)).start() }
        updateBar()
        bar.tabs.count = tabs.size
        homeJs("dwTabs(${tabs.size})")
        saveSession()
    }

    private fun closeTab(t: Tab, fromSwitcher: Boolean = false) {
        val i = tabs.indexOf(t)
        if (i < 0) return
        tabs.removeAt(i)
        t.web?.let { pages.removeView(it); it.stopLoading(); it.destroy() }
        t.web = null
        if (tabs.isEmpty()) { newTab(null); return }
        if (active == t) { active = null; activate(tabs[(i - 1).coerceAtLeast(0)], reveal = !fromSwitcher) }
        bar.tabs.count = tabs.size
        homeJs("dwTabs(${tabs.size})")
        saveSession()
    }

    private fun saveSession() {
        store.saveSession(tabs.map { if (it.home) "" else it.url }, tabs.indexOf(active).coerceAtLeast(0))
    }

    /* Foto einer Seite für Übersicht und Übergang */
    private fun snapshot(t: Tab): Bitmap? {
        val v: View = if (t.home) return homeThumb() else t.web ?: return null
        if (v.width <= 0 || v.height <= 0 || v.visibility != View.VISIBLE) return t.thumb
        return try {
            val s = 0.5f
            val b = Bitmap.createBitmap((v.width * s).toInt(), (v.height * s).toInt(), Bitmap.Config.ARGB_8888)
            val c = Canvas(b); c.scale(s, s); v.draw(c); b
        } catch (_: Throwable) { t.thumb }
    }
    private var homeThumbCache: Bitmap? = null
    private fun homeThumb(): Bitmap? {
        homeThumbCache?.let { return it }
        val w = (root.width / 2).coerceAtLeast(10); val h = ((root.height - barH) / 2).coerceAtLeast(10)
        val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); val c = Canvas(b)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), Dw.BG2, Dw.alpha(Dw.vio, 0.5f), Shader.TileMode.CLAMP); c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p); p.shader = null
        try { val l = assets.open("logo-mark.webp").use { BitmapFactory.decodeStream(it) }; val s = w * 0.42f; c.drawBitmap(l, null, android.graphics.RectF(w / 2 - s / 2, h * 0.36f - s / 2, w / 2 + s / 2, h * 0.36f + s / 2), p) } catch (_: Exception) {}
        p.color = Color.WHITE; p.typeface = Dw.sansBold; p.textSize = w * 0.09f; p.textAlign = Paint.Align.CENTER
        c.drawText("DULIDAN WEB", w / 2f, h * 0.62f, p)
        homeThumbCache = b
        return b
    }

    /* ===================== WebViews ===================== */
    @SuppressLint("SetJavaScriptEnabled")
    private fun ensureWeb(t: Tab): WebView {
        t.web?.let { return it }
        val w = WebView(this)
        with(w.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = true
            displayZoomControls = false
            setSupportZoom(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            /* Wie normales Chrome auftreten: mit "; wv" blockiert Google die Anmeldung */
            userAgentString = userAgentString.replace("; wv", "").replace(Regex(" Version/\\d+(\\.\\d+)*"), "")
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
            WebSettingsCompat.setRequestedWithHeaderOriginAllowList(w.settings, emptySet())
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true)
        w.setBackgroundColor(Color.WHITE)
        w.webViewClient = PageClient(t)
        w.webChromeClient = ChromeClient(t)
        w.setDownloadListener { url, ua, cd, mime, _ -> download(url, ua, cd, mime) }
        w.visibility = View.GONE
        pages.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        t.web = w
        return w
    }

    inner class PageClient(private val t: Tab) : WebViewClient() {
        override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
            val u = r.url
            val scheme = u.scheme?.lowercase() ?: return false
            if (scheme == "http" || scheme == "https") return false
            /* Apps öffnen: intent://, mailto:, tel:, WhatsApp, Play Store … */
            try {
                val i = if (scheme == "intent") Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) else Intent(Intent.ACTION_VIEW, u)
                i.addCategory(Intent.CATEGORY_BROWSABLE); i.component = null; i.selector = null
                startActivity(i)
            } catch (e: Exception) {
                if (scheme == "intent") try {
                    Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url")?.let { if (it.startsWith("http")) v.loadUrl(it) }
                } catch (_: Exception) {}
                toast("Keine App für diesen Link")
            }
            return true
        }
        override fun onPageStarted(v: WebView, url: String, favicon: Bitmap?) {
            t.url = url; t.blocked.set(0); t.progress = 5
            if (t == active) updateBar()
        }
        override fun onPageFinished(v: WebView, url: String) {
            t.url = url; t.title = v.title ?: t.title; t.progress = 100
            store.addHistory(url, t.title)
            if (t == active) updateBar()
            morphReady(t)
            saveSession()
        }
        override fun doUpdateVisitedHistory(v: WebView, url: String, reload: Boolean) { t.url = url; if (t == active) updateBar() }
        override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? {
            if (!adblockOn || r.isForMainFrame || !AdBlock.blocked(r.url.host)) return null
            val n = t.blocked.incrementAndGet()
            ui.post { if (t == active) updateShield(n) }
            return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
        }
        override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) {
            if (!r.isForMainFrame) return
            v.loadDataWithBaseURL(null, errorPage(e.description.toString(), r.url.toString()), "text/html", "utf-8", r.url.toString())
            morphReady(t)
        }
        override fun onRenderProcessGone(v: WebView, d: android.webkit.RenderProcessGoneDetail): Boolean {
            pages.removeView(v); v.destroy(); t.web = null
            if (t == active) { ensureWeb(t).loadUrl(t.url); activate(t) }
            toast("Seite abgestürzt – neu geladen")
            return true
        }
    }

    inner class ChromeClient(private val t: Tab) : WebChromeClient() {
        override fun onProgressChanged(v: WebView, p: Int) {
            t.progress = p
            if (t == active) bar.progress = p / 100f
            if (p >= 70) morphReady(t)
        }
        override fun onReceivedTitle(v: WebView, title: String?) { t.title = title ?: ""; if (t == active) updateBar() }
        /* Vollbild-Videos (YouTube & Co.) */
        override fun onShowCustomView(view: View, cb: CustomViewCallback) {
            fullView?.let { cb.onCustomViewHidden(); return }
            fullView = view; fullCb = cb
            root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            bar.visibility = View.GONE
            immersive(true)
        }
        override fun onHideCustomView() {
            fullView?.let { root.removeView(it) }
            fullView = null; fullCb?.onCustomViewHidden(); fullCb = null
            bar.visibility = View.VISIBLE
            immersive(false)
        }
        override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileCb?.onReceiveValue(null)
            fileCb = cb
            return try { startActivityForResult(params.createIntent(), REQ_FILE); true } catch (e: ActivityNotFoundException) { fileCb = null; false }
        }
        override fun onPermissionRequest(r: PermissionRequest) { r.deny() }
        override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) { cb.invoke(origin, false, false) }
    }

    @Suppress("DEPRECATION")
    private fun immersive(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) {
            val c = window.insetsController ?: return
            if (on) { c.hide(WindowInsets.Type.systemBars()); c.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE }
            else c.show(WindowInsets.Type.systemBars())
        } else {
            window.decorView.systemUiVisibility = if (on) View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            else View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        }
    }

    @Deprecated("Framework-Activity")
    override fun onActivityResult(req: Int, res: Int, data: Intent?) {
        if (req == REQ_FILE) { fileCb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); fileCb = null; return }
        @Suppress("DEPRECATION") super.onActivityResult(req, res, data)
    }

    private fun download(url: String, ua: String, cd: String?, mime: String?) {
        try {
            val name = URLUtil.guessFileName(url, cd, mime)
            val r = DownloadManager.Request(Uri.parse(url))
                .setMimeType(mime).addRequestHeader("User-Agent", ua)
                .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                .setTitle(name).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(r)
            toast("⬇ Download gestartet: $name")
            Haptic.play("fire")
        } catch (e: Exception) { toast("Download nicht möglich") }
    }

    private fun errorPage(desc: String, url: String): String {
        val safe = { s: String -> s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") }
        return """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0;background:#07060b;color:#efeaf7;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center">
            <div style="padding:24px"><div style="font:600 11px monospace;letter-spacing:.24em;color:${Dw.hex(Dw.pink)}">// FEHLER</div>
            <h1 style="font-size:40px;letter-spacing:-.04em;margin:10px 0">SIGNAL VERLOREN</h1><p style="color:#a49cb6">${safe(desc)}</p>
            <p style="font:12px monospace;color:#8a83a0;word-break:break-all">${safe(url)}</p></div>"""
    }

    /* ===================== Navigation mit Partikel-Morph ===================== */
    private fun go(text: String) {
        val url = Search.resolve(text, store.engine) ?: return
        val t = active ?: return
        hideKeyboard()
        suggest.hide()
        navigate(t, url)
    }

    private fun navigate(t: Tab, url: String) {
        val wasHome = t.home
        val src = if (!wasHome && t.web?.visibility == View.VISIBLE) snapshot(t) else null
        val w = ensureWeb(t)
        t.url = url; t.title = ""
        if (Dw.on && t == active) {
            Haptic.play("fire")
            morphTab = t
            morph = morphFx.morph(src, "VERBINDE " + (Uri.parse(url).host ?: "").removePrefix("www.").uppercase(),
                onCovered = { if (t == active) { t.home = false; activate(t, reveal = false) } },
                onDone = { morph = null; morphTab = null })
            ui.postDelayed({ morphReady(t, force = true) }, 5000)
            w.loadUrl(url)
        } else {
            t.home = false
            if (t == active) activate(t, reveal = false)
            w.loadUrl(url)
        }
        updateBar()
    }

    private fun morphReady(t: Tab, force: Boolean = false) {
        if (morphTab != t && !force) return
        morph?.ready()
    }

    /* ===================== Startseite ===================== */
    inner class HomeBridge {
        @JavascriptInterface fun go(text: String) { ui.post { this@MainActivity.go(text) } }
        @JavascriptInterface fun haptic(kind: String) { ui.post { Haptic.play(kind) } }
        @JavascriptInterface fun ready() { ui.post { homeReady = true; pushHome() } }
    }
    private fun homeJs(js: String) { if (homeReady) home.evaluateJavascript(js, null) }
    private fun pushHome() {
        val d = resources.displayMetrics.density
        homeJs("dwInsets(${(insetTop / d).toInt()},${(barH / d).toInt()});dwAccent('${Dw.hex(Dw.vio)}','${Dw.hex(Dw.mag)}','${Dw.hex(Dw.pink)}');dwAnim('${Dw.anim}');dwTabs(${tabs.size})")
    }

    /* ===================== Leiste + Vorschläge ===================== */
    private fun wireBar() {
        val inp = bar.pill.input
        bar.home.pressable { goHome() }
        bar.tabs.pressable { openSwitcher() }
        bar.menu.pressable { hideKeyboard(); menu.show() }
        bar.pill.shield.pressable { toast("🛡 ${active?.blocked?.get() ?: 0} Werbe- und Tracker-Anfragen blockiert") }
        inp.setOnFocusChangeListener { _, f ->
            bar.pill.focused = f
            if (f) { bar.pill.boost += 400f; inp.post { inp.selectAll() } ; Haptic.tick(inp) }
            else { suggest.hide(); updateBar() }
            bar.pill.animate().scaleX(if (f) 1.02f else 1f).scaleY(if (f) 1.06f else 1f).setDuration(500).setInterpolator(Spring()).start()
        }
        inp.setOnEditorActionListener { _, id, ev ->
            if (id == EditorInfo.IME_ACTION_GO || ev?.keyCode == KeyEvent.KEYCODE_ENTER) { fire(); go(inp.text.toString()); inp.clearFocus(); true } else false
        }
        inp.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) { if (inp.hasFocus()) suggestFor(s?.toString() ?: "") }
        })
    }

    private fun fire() {
        val r = IntArray(2); bar.pill.getLocationInWindow(r)
        topFx.burst(r[0] + bar.pill.width / 2f, r[1] + bar.pill.height / 2f, 90, 11f)
        bar.pill.animate().scaleX(0.94f).scaleY(0.9f).setDuration(90).withEndAction { bar.pill.animate().scaleX(1f).scaleY(1f).setDuration(600).setInterpolator(Spring()).start() }.start()
    }

    private fun suggestFor(q: String) {
        val seq = ++suggestSeq
        val text = q.trim()
        if (text.isEmpty()) { suggest.hide(); return }
        val items = ArrayList<Triple<String, String, String>>()
        val sc = Search.shortcutOf(text)
        val isUrl = !text.contains(' ') && Search.resolve(text, store.engine)?.let { !it.contains(Search.engineName(store.engine).lowercase()) && !it.contains("?q=") && !it.contains("query=") } == true
        items.add(Triple(if (sc != null) "◉" else if (isUrl) "◎" else "⌕", text, if (sc != null) Search.SHORTCUTS.getValue(sc).first else if (isUrl) "öffnen" else Search.engineName(store.engine)))
        for ((u, title) in store.history()) {
            if (items.size >= 4) break
            if (u.contains(text, true) || title.contains(text, true)) items.add(Triple("↺", if (title.isNotEmpty()) title else u, "verlauf"))
        }
        suggest.show(text, items)
        if (isUrl || sc != null) return
        thread(isDaemon = true) {
            Thread.sleep(110)
            if (seq != suggestSeq) return@thread
            val more = Search.suggest(text)
            ui.post {
                if (seq != suggestSeq || !bar.pill.input.hasFocus()) return@post
                val all = ArrayList(items)
                for (m in more) if (all.size < 7 && all.none { it.second.equals(m, true) }) all.add(Triple("⌕", m, ""))
                suggest.show(text, all)
            }
        }
    }

    private fun pickSuggestion(text: String) {
        val hit = store.history().firstOrNull { it.second == text }
        fire()
        bar.pill.input.clearFocus()
        go(hit?.first ?: text)
    }

    private fun updateBar() {
        val t = active ?: return
        if (!bar.pill.input.hasFocus()) {
            val shown = if (t.home) "" else (Uri.parse(t.url).host?.removePrefix("www.") ?: t.url)
            bar.pill.input.setText(shown)
        }
        bar.home.lit = t.home
        bar.progress = if (t.home) 0f else t.progress / 100f
        updateShield(t.blocked.get())
    }
    private fun updateShield(n: Int) {
        val t = active ?: return
        val sh = bar.pill.shield
        if (t.home || !adblockOn || n == 0) { sh.visibility = View.GONE; return }
        val was = sh.visibility == View.VISIBLE
        sh.visibility = View.VISIBLE; sh.text = "🛡 $n"
        if (!was && Dw.on) { sh.scaleX = 0.3f; sh.scaleY = 0.3f; sh.animate().scaleX(1f).scaleY(1f).setDuration(600).setInterpolator(Spring()).start() }
    }

    private fun hideKeyboard() {
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(root.windowToken, 0)
        bar.pill.input.clearFocus()
    }

    private fun goHome() {
        val t = active ?: return
        if (t.home) { homeJs("dwIntro()"); return }
        t.thumb = snapshot(t)
        t.home = true
        activate(t, reveal = false)
        homeJs("dwClear();dwIntro()")
    }

    /* ===================== Tab-Übersicht ===================== */
    private fun openSwitcher() {
        hideKeyboard()
        active?.let { it.thumb = snapshot(it) }
        switcher.show(tabs.map { t ->
            val host = if (t.home) "DULIDAN://START" else Uri.parse(t.url).host?.removePrefix("www.") ?: ""
            Card(t.id, if (t.home) "Neuer Tab" else t.title.ifEmpty { host }, host, t.thumb ?: if (t.home) homeThumb() else null, t == active)
        })
        Haptic.play("fire")
    }

    /* ===================== Menü ===================== */
    private fun menuAction(key: String) {
        val t = active
        when (key) {
            "new" -> newTab(null)
            "tabs" -> openSwitcher()
            "reload" -> t?.web?.reload()
            "home" -> goHome()
            "close" -> t?.let { closeTab(it) }
            "share" -> if (t != null && !t.home) startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t.url), "Teilen"))
            "desktop" -> t?.web?.let { w ->
                t.desktop = !t.desktop
                w.settings.userAgentString = if (t.desktop) "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" else null
                if (!t.desktop) w.settings.userAgentString = w.settings.userAgentString.replace("; wv", "").replace(Regex(" Version/\\d+(\\.\\d+)*"), "")
                w.reload(); toast(if (t.desktop) "Desktop-Version" else "Mobile Version")
            }
            "boot" -> playBoot()
            "engine" -> toast("Suchmaschine: ${Search.engineName(store.engine)}")
            "accent" -> { bar.pill.resetShader(); bar.invalidate(); homeThumbCache = null; pushHome() }
            "anim" -> { pushHome(); toast("Animationen: ${Dw.anim.uppercase()}") }
            "adblock" -> { adblockOn = store.adblock; updateBar(); toast("Werbeblocker: ${if (adblockOn) "AN" else "AUS"}") }
        }
    }

    private fun toast(msg: String) = toaster.show(msg)

    /* ===================== System ===================== */
    private fun handleIntent(i: Intent?) {
        i ?: return
        when (i.action) {
            Intent.ACTION_VIEW -> i.dataString?.let { if (it.startsWith("http")) newTab(it) }
            Intent.ACTION_WEB_SEARCH -> i.getStringExtra(SearchManager.QUERY)?.let { newTab(null, intro = false); go(it) }
        }
    }
    override fun onNewIntent(i: Intent) { super.onNewIntent(i); handleIntent(i) }

    /* Zurück: erst Overlays schließen, dann in der Seite zurück, dann zur Startseite, dann App in den Hintergrund */
    private fun handleBack(): Boolean {
        when {
            fullView != null -> (active?.web?.webChromeClient as? ChromeClient)?.onHideCustomView()
            menu.open -> menu.hide()
            switcher.visibility == View.VISIBLE -> switcher.hide()
            suggest.visibility == View.VISIBLE -> { suggest.hide(); hideKeyboard() }
            active?.let { !it.home && it.web?.canGoBack() == true } == true -> active?.web?.goBack()
            active?.let { !it.home } == true -> goHome()
            else -> return false
        }
        return true
    }
    @Deprecated("Framework-Activity")
    override fun onBackPressed() { if (!handleBack()) moveTaskToBack(true) }

    override fun onPause() { super.onPause(); saveSession(); CookieManager.getInstance().flush() }
    override fun onDestroy() { for (t in tabs) t.web?.destroy(); home.destroy(); super.onDestroy() }

    companion object { private const val REQ_FILE = 42 }
}
