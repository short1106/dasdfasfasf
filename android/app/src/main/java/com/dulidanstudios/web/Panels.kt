package com.dulidanstudios.web

/* Dulidan Web Android · Overlays: Live-Vorschläge, Menü-Sheet, Boot-Sequenz, Toast */

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

private fun Context.label(text: String, size: Float, color: Int, mono: Boolean = false, bold: Boolean = false) = TextView(this).apply {
    this.text = text; setTextColor(color); setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    typeface = if (mono) (if (bold) Dw.monoBold else Dw.mono) else (if (bold) Dw.sansBold else Dw.sans)
}
private fun pillBg(ctx: Context, fill: Int, stroke: Int, radius: Float) = GradientDrawable().apply { cornerRadius = ctx.dp(radius); setColor(fill); setStroke(ctx.dp(1).toInt(), stroke) }

/* Gestaffeltes Einblenden mit Feder */
fun View.staggerIn(i: Int, dy: Float = 26f) {
    if (!Dw.on) { alpha = 1f; translationY = 0f; return }
    alpha = 0f; translationY = dp(dy); scaleX = 0.96f; scaleY = 0.96f
    animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f).setStartDelay(i * 38L).setDuration(560).setInterpolator(Spring(6f, 11f)).start()
}

/* ===================== Live-Vorschläge ===================== */
class SuggestPanel(ctx: Context, private val pick: (String) -> Unit) : LinearLayout(ctx) {
    init {
        orientation = VERTICAL
        setPadding(dp(8).toInt(), dp(8).toInt(), dp(8).toInt(), dp(8).toInt())
        background = pillBg(ctx, 0xF50D0B14.toInt(), Dw.alpha(Dw.mag, 0.45f), 20f)
        elevation = dp(12)
        visibility = GONE
    }
    fun show(q: String, items: List<Triple<String, String, String>>) {   // (Symbol, Text, Hinweis)
        removeAllViews()
        if (items.isEmpty()) { visibility = GONE; return }
        visibility = VISIBLE
        items.forEachIndexed { i, (sym, text, hint) ->
            val row = LinearLayout(context).apply { orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12).toInt(), dp(11).toInt(), dp(12).toInt(), dp(11).toInt()) }
            row.addView(context.label(sym, 15f, Dw.pink, mono = true, bold = true).apply { minWidth = dp(26).toInt() })
            val t = SpannableStringBuilder(text)
            val at = text.lowercase().indexOf(q.lowercase())
            if (q.isNotEmpty() && at >= 0) t.setSpan(ForegroundColorSpan(Color.WHITE), at, at + q.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            row.addView(context.label("", 15f, Dw.MUTED).apply { this.text = t; maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END }, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            if (hint.isNotEmpty()) row.addView(context.label(hint.uppercase(), 9.5f, Dw.DIM, mono = true).apply { letterSpacing = 0.12f })
            row.pressable(0.97f) { pick(text) }
            if (i == 0) row.background = pillBg(context, Dw.alpha(Dw.mag, 0.18f), Dw.alpha(Dw.pink, 0.35f), 14f)
            addView(row)
            row.staggerIn(i, 18f)
        }
    }
    fun hide() { visibility = GONE; removeAllViews() }
}

/* ===================== Toast ===================== */
class Toaster(private val host: FrameLayout) {
    private val v = host.context.label("", 13f, Dw.TEXT, mono = true).apply {
        setPadding(dp(18).toInt(), dp(12).toInt(), dp(18).toInt(), dp(12).toInt())
        background = pillBg(context, 0xF2140F1F.toInt(), Dw.alpha(Dw.mag, 0.55f), 24f)
        elevation = dp(16); alpha = 0f; letterSpacing = 0.04f
    }
    private val h = Handler(Looper.getMainLooper())
    var bottom = 0
    init { host.addView(v, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL)) }
    fun show(msg: String) {
        v.text = msg; v.bringToFront()
        (v.layoutParams as FrameLayout.LayoutParams).bottomMargin = bottom + v.dp(14).toInt(); v.requestLayout()
        v.translationY = v.dp(40); v.scaleX = 0.85f; v.scaleY = 0.85f
        v.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f).setDuration(if (Dw.on) 560 else 1).setInterpolator(Spring()).start()
        h.removeCallbacksAndMessages(null)
        h.postDelayed({ v.animate().alpha(0f).translationY(v.dp(20)).setDuration(260).start() }, 2200)
    }
}

/* ===================== Menü-Sheet ===================== */
class MenuSheet(ctx: Context, private val store: Store, private val act: (String) -> Unit) : FrameLayout(ctx) {
    private val scrim = View(ctx).apply { setBackgroundColor(Color.BLACK); alpha = 0f }
    private val sheet = object : LinearLayout(ctx) {
        private val gp = Paint(Paint.ANTI_ALIAS_FLAG)
        override fun dispatchDraw(c: Canvas) {
            super.dispatchDraw(c)
            gp.shader = LinearGradient(0f, 0f, width.toFloat(), 0f, intArrayOf(Color.TRANSPARENT, Dw.pink, Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
            c.drawRect(dp(30), 0f, width - dp(30), dp(1.5f), gp)
        }
    }.apply {
        orientation = LinearLayout.VERTICAL
        background = GradientDrawable().apply { cornerRadii = floatArrayOf(dp(28), dp(28), dp(28), dp(28), 0f, 0f, 0f, 0f); setColor(0xFA0D0B14.toInt()); setStroke(dp(1).toInt(), Dw.alpha(Dw.mag, 0.35f)) }
        setPadding(dp(18).toInt(), dp(14).toInt(), dp(18).toInt(), dp(18).toInt())
        elevation = dp(24)
    }
    private val scroll = ScrollView(ctx).apply { isVerticalScrollBarEnabled = false; addView(sheet) }
    var bottomInset = 0
    val open get() = visibility == VISIBLE

    init {
        visibility = GONE
        addView(scrim, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        addView(scroll, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        scrim.setOnClickListener { hide() }
    }

    private fun section(title: String) = context.label(title, 10f, Dw.pink, mono = true, bold = true).apply { letterSpacing = 0.2f; setPadding(dp(4).toInt(), dp(18).toInt(), 0, dp(10).toInt()) }

    private fun build() {
        sheet.removeAllViews()
        sheet.addView(View(context).apply { background = pillBg(context, Dw.alpha(Color.WHITE, 0.25f), Color.TRANSPARENT, 3f) },
            LinearLayout.LayoutParams(dp(42).toInt(), dp(4).toInt()).apply { gravity = Gravity.CENTER_HORIZONTAL; bottomMargin = dp(12).toInt() })
        sheet.addView(context.label("Dulidan Web", 22f, Dw.TEXT, bold = true).apply { letterSpacing = -0.02f })
        /* Aktionen als Kacheln */
        val acts = listOf("＋" to "Neuer Tab" to "new", "▤" to "Tabs" to "tabs", "↻" to "Neu laden" to "reload", "⌂" to "Start" to "home",
            "⇪" to "Teilen" to "share", "▭" to "Desktop" to "desktop", "⚡" to "Boot" to "boot", "⨯" to "Tab zu" to "close")
        var row: LinearLayout? = null
        acts.forEachIndexed { i, (pair, key) ->
            if (i % 4 == 0) { row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }; sheet.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10).toInt() }) }
            val (sym, name) = pair
            val tile = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                setPadding(0, dp(14).toInt(), 0, dp(12).toInt())
                background = pillBg(context, 0xFF171323.toInt(), Dw.alpha(Color.WHITE, 0.08f), 18f)
                addView(context.label(sym, 20f, Dw.pink, bold = true).apply { gravity = Gravity.CENTER })
                addView(context.label(name, 11f, Dw.MUTED).apply { gravity = Gravity.CENTER; setPadding(0, dp(4).toInt(), 0, 0) })
            }
            tile.pressable { hide(); act(key) }
            row!!.addView(tile, LinearLayout.LayoutParams(0, -2, 1f).apply { if (i % 4 != 0) leftMargin = dp(8).toInt() })
            tile.staggerIn(i)
        }
        /* Suchmaschine */
        sheet.addView(section("SUCHMASCHINE"))
        sheet.addView(chips(Search.ENGINES.map { it.key to it.value.first }, store.engine) { store.engine = it; act("engine") })
        /* Akzentfarbe */
        sheet.addView(section("AKZENTFARBE"))
        val sw = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        Dw.ACCENTS.entries.forEachIndexed { i, (k, a) ->
            val v = View(context).apply {
                background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(a.vio, a.mag)).apply { shape = GradientDrawable.OVAL; if (k == store.accent) setStroke(dp(3).toInt(), Color.WHITE) }
            }
            v.pressable { store.accent = k; Dw.accent(k); act("accent"); build() }
            sw.addView(v, LinearLayout.LayoutParams(dp(40).toInt(), dp(40).toInt()).apply { if (i > 0) leftMargin = dp(12).toInt() })
            v.staggerIn(i)
        }
        sheet.addView(sw)
        /* Animationen */
        sheet.addView(section("ANIMATIONEN"))
        sheet.addView(chips(listOf("episch" to "EPISCH", "normal" to "NORMAL", "aus" to "AUS"), store.anim) { store.anim = it; Dw.anim = it; act("anim") })
        /* Werbeblocker */
        sheet.addView(section("WERBEBLOCKER"))
        sheet.addView(chips(listOf("an" to "AN · ${if (AdBlock.count > 0) "%,d".format(AdBlock.count).replace(',', '.') + " Hosts" else "lädt …"}", "aus" to "AUS"), if (store.adblock) "an" else "aus") { store.adblock = it == "an"; act("adblock") })
        sheet.addView(context.label("Dulidan Web 0.1 · Dream. Design. Develop. Dominate.", 10f, Dw.DIM, mono = true).apply { setPadding(dp(4).toInt(), dp(22).toInt(), 0, 0) })
        sheet.setPadding(sheet.paddingLeft, sheet.paddingTop, sheet.paddingRight, dp(18).toInt() + bottomInset)
    }

    private fun chips(opts: List<Pair<String, String>>, sel: String, onPick: (String) -> Unit): View {
        val hs = HorizontalScrollView(context).apply { isHorizontalScrollBarEnabled = false; clipToPadding = false }
        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        opts.forEachIndexed { i, (k, name) ->
            val on = k == sel
            val c = context.label(name, 12f, if (on) Color.WHITE else Dw.MUTED, mono = true, bold = on).apply {
                setPadding(dp(14).toInt(), dp(9).toInt(), dp(14).toInt(), dp(9).toInt())
                background = if (on) GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Dw.vio, Dw.mag)).apply { cornerRadius = dp(12) }
                else pillBg(context, 0xFF120F1C.toInt(), Dw.alpha(Color.WHITE, 0.1f), 12f)
            }
            c.pressable { onPick(k); build() }
            row.addView(c, LinearLayout.LayoutParams(-2, -2).apply { if (i > 0) leftMargin = dp(8).toInt() })
        }
        hs.addView(row)
        return hs
    }

    fun show() {
        build()
        visibility = VISIBLE
        scrim.animate().alpha(0.55f).setDuration(260).start()
        scroll.translationY = dp(500); scroll.alpha = 0.4f
        scroll.animate().translationY(0f).alpha(1f).setDuration(if (Dw.on) 640 else 1).setInterpolator(Spring(6.5f, 10f)).start()
    }
    fun hide() {
        scrim.animate().alpha(0f).setDuration(220).start()
        scroll.animate().translationY(dp(520)).setDuration(260).withEndAction { visibility = GONE }.start()
    }
}

/* ===================== Boot-Sequenz ===================== */
class BootView(ctx: Context, private val done: () -> Unit) : FrameLayout(ctx) {
    private val grid = Paint().apply { strokeWidth = 1f }
    private val lines = ctx.label("", 12f, Dw.MUTED, mono = true).apply { setLineSpacing(0f, 1.5f) }
    private val bar = View(ctx)
    private val pct = ctx.label("0%", 11f, Dw.DIM, mono = true)
    private val h = Handler(Looper.getMainLooper())
    private var finished = false
    private val sb = SpannableStringBuilder()
    private val L = listOf(
        "> dulidan-web --boot --mobil", "Lade Kreativ-Kern", "Kompiliere Shader: partikel.vert · nebel.frag",
        "Kalibriere Haptik-Motor", "Verbinde Gyroskop", "Lade Werbeblocker-Listen", "Koffein-Level: kritisch, aber stabil",
        "Dream. Design. Develop. Dominate."
    )

    init {
        setBackgroundColor(Dw.BG); setWillNotDraw(false); isClickable = true
        val col = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(32).toInt(), 0, dp(32).toInt(), 0) }
        val logo = ImageView(ctx).apply {
            try { setImageBitmap(ctx.assets.open("logo-mark.webp").use { BitmapFactory.decodeStream(it) }) } catch (_: Exception) {}
        }
        col.addView(logo, LinearLayout.LayoutParams(dp(64).toInt(), dp(64).toInt()).apply { bottomMargin = dp(28).toInt() })
        col.addView(lines, LinearLayout.LayoutParams(-1, dp(230).toInt()))
        val track = FrameLayout(ctx).apply { setBackgroundColor(Dw.LINE) }
        bar.background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Dw.vio, Dw.mag, Dw.pink))
        track.addView(bar, LayoutParams(0, -1))
        col.addView(track, LinearLayout.LayoutParams(-1, dp(2).toInt()).apply { topMargin = dp(16).toInt() })
        val foot = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        foot.addView(ctx.label("DULIDAN WEB · v0.1", 11f, Dw.DIM, mono = true), LinearLayout.LayoutParams(0, -2, 1f))
        foot.addView(pct)
        col.addView(foot, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10).toInt() })
        addView(col, LayoutParams(-1, -2, Gravity.CENTER_VERTICAL))
        addView(ctx.label("TIPPEN ZUM ÜBERSPRINGEN", 10f, Dw.DIM, mono = true).apply { letterSpacing = 0.2f },
            LayoutParams(-2, -2, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = dp(56).toInt() })
        logo.animate().scaleX(1.08f).scaleY(1.08f).setDuration(700).withEndAction { logo.animate().scaleX(1f).scaleY(1f).setDuration(700).start() }.start()
        setOnClickListener { finish() }
        line(0)
    }

    override fun onDraw(c: Canvas) {
        val s = dp(44)
        grid.color = Dw.alpha(Dw.vio, 0.12f)
        var x = 0f; while (x < width) { c.drawLine(x, 0f, x, height.toFloat(), grid); x += s }
        var y = 0f; while (y < height) { c.drawLine(0f, y, width.toFloat(), y, grid); y += s }
    }

    private fun line(i: Int) {
        if (finished) return
        if (i >= L.size) { h.postDelayed({ finish() }, 450); return }
        val text = (if (i == 0 || i == L.size - 1) "" else "  ") + L[i]
        val start = sb.length
        var k = 0
        val type = object : Runnable {
            override fun run() {
                if (finished) return
                if (k <= text.length) {
                    sb.replace(start, sb.length, text.substring(0, k) + "█")
                    lines.text = sb; k += 2; h.postDelayed(this, 12)
                    return
                }
                sb.replace(start, sb.length, text)
                if (i == L.size - 1) sb.setSpan(ForegroundColorSpan(Dw.pink), start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                if (i in 1 until L.size - 1) { val ok = sb.length; sb.append("  [OK]"); sb.setSpan(ForegroundColorSpan(Dw.OK), ok, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE); Haptic.play("tick") }
                sb.append("\n"); lines.text = sb
                val p = (i + 1) * 100 / L.size
                pct.text = "$p%"
                (bar.layoutParams as LayoutParams).width = ((bar.parent as View).width * p / 100); bar.requestLayout()
                h.postDelayed({ line(i + 1) }, 120L + (Math.random() * 140).toLong())
            }
        }
        h.post(type)
    }

    private fun finish() {
        if (finished) return
        finished = true
        h.removeCallbacksAndMessages(null)
        Haptic.play("boom")
        animate().alpha(0f).scaleX(1.35f).scaleY(1.35f).setDuration(if (Dw.on) 650 else 1).withEndAction { done() }.start()
    }
}
