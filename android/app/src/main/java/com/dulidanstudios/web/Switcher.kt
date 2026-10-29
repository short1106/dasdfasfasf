package com.dulidanstudios.web

/* Dulidan Web Android · Tab-Übersicht als 3D-Karten-Stapel
   Öffnen: aktiver Tab schrumpft aus dem Vollbild in den Stapel. Wischen: Karte zerfällt. Tippen: zoomt zurück ins Vollbild. */

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Camera
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.OverScroller
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class Card(val id: Int, val title: String, val host: String, val thumb: Bitmap?, val active: Boolean) {
    var dx = 0f          // Wisch-Versatz
    var gone = false
}

class SwitcherView(ctx: Context, private val fx: FxView, private val cb: Callbacks) : View(ctx) {
    interface Callbacks { fun open(id: Int); fun close(id: Int); fun newTab(); fun dismissed() }

    private var cards = ArrayList<Card>()
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val txt = Paint(Paint.ANTI_ALIAS_FLAG)
    private val cam = Camera()
    private val mtx = Matrix()
    private val rect = RectF()
    private val scroller = OverScroller(ctx)
    private var scrollY = 0f
    private var enter = 0f              // 0 → 1 beim Öffnen
    private var zoom = 0f               // 0 → 1 beim Hineinzoomen
    private var zoomId = -1
    private var bgA = 0f
    var contentTop = 0f; var contentBottom = 0f  // Bereich, den eine Seite im Vollbild einnimmt
    private var swipe: Card? = null
    private var swipeAxis = 0           // 0 = offen, 1 = horizontal, 2 = vertikal
    private val plusR = RectF()

    private val cardW get() = width * 0.84f
    private val cardH get() = cardW * ((contentBottom - contentTop) / width.coerceAtLeast(1)).coerceIn(1.1f, 2.1f) * 0.62f
    private val gap get() = cardH * 0.5f
    private val top0 get() = contentTop + dp(70)
    private val maxScroll get() = max(0f, top0 + (cards.size - 1) * gap + cardH + dp(120) - height)

    fun show(list: List<Card>) {
        cards = ArrayList(list)
        val ai = cards.indexOfFirst { it.active }.coerceAtLeast(0)
        scrollY = (top0 + ai * gap - (height - cardH) / 2f).coerceIn(0f, maxScroll)
        zoom = 0f; zoomId = -1; visibility = VISIBLE
        animator(0f, 1f, if (Dw.on) 620 else 1) { enter = it; bgA = it; invalidate() }
    }

    private fun animator(from: Float, to: Float, ms: Long, end: (() -> Unit)? = null, f: (Float) -> Unit) =
        ValueAnimator.ofFloat(from, to).apply {
            duration = ms; interpolator = DecelerateInterpolator(2.2f)
            addUpdateListener { f(it.animatedValue as Float) }
            if (end != null) addListener(object : android.animation.AnimatorListenerAdapter() { override fun onAnimationEnd(a: android.animation.Animator) { end() } })
            start()
        }

    fun hide() {
        animator(bgA, 0f, if (Dw.on) 260 else 1, { visibility = INVISIBLE; cb.dismissed() }) { bgA = it; enter = it; invalidate() }
    }

    /* Ruhelage einer Karte im Stapel */
    private fun slot(i: Int, out: RectF) {
        val x = (width - cardW) / 2; val y = top0 + i * gap - scrollY
        out.set(x, y, x + cardW, y + cardH)
    }
    private fun fullRect(out: RectF) { out.set(0f, contentTop, width.toFloat(), contentBottom) }

    override fun onDraw(c: Canvas) {
        if (scroller.computeScrollOffset()) { scrollY = scroller.currY.toFloat(); postInvalidateOnAnimation() }
        c.drawColor(Dw.alpha(Dw.BG, 0.94f * bgA))
        /* Kopfzeile */
        txt.typeface = Dw.monoBold; txt.textSize = dp(11); txt.letterSpacing = 0.25f
        txt.color = Dw.alpha(Dw.pink, bgA)
        c.drawText("DULIDAN://TABS", dp(20), contentTop + dp(34), txt)
        txt.color = Dw.alpha(Dw.MUTED, bgA); txt.textAlign = Paint.Align.RIGHT
        c.drawText("${cards.count { !it.gone }} ${if (cards.count { !it.gone } == 1) "TAB" else "TABS"}", width - dp(20), contentTop + dp(34), txt)
        txt.textAlign = Paint.Align.LEFT; txt.letterSpacing = 0f
        val full = RectF(); fullRect(full)
        for ((i, card) in cards.withIndex()) {
            if (card.gone) continue
            slot(i, rect)
            /* Einflug: aktive Karte kommt aus dem Vollbild, die anderen gleiten gestaffelt von unten herein */
            val k = if (card.active) enter else ((enter * 1.3f - i * 0.04f).coerceIn(0f, 1f))
            if (card.active) lerpRect(rect, full, 1 - k) else rect.offset(0f, (1 - k) * height * 0.6f)
            if (card.id == zoomId) lerpRect(rect, full, zoom)
            if (rect.bottom < 0 || rect.top > height) continue
            val tilt = if (card.id == zoomId) -14f * (1 - zoom) else -14f * k
            drawCard(c, card, rect, tilt, if (card.id == zoomId) 1f else k)
        }
        /* Neuer-Tab-Knopf */
        val r = dp(30); val cx = width / 2f; val cy = height - contentTopInsetBottom() - dp(48)
        plusR.set(cx - r, cy - r, cx + r, cy + r)
        p.shader = LinearGradient(cx - r, cy - r, cx + r, cy + r, Dw.vio, Dw.mag, Shader.TileMode.CLAMP)
        p.alpha = (255 * bgA).toInt(); p.setShadowLayer(dp(18), 0f, 0f, Dw.mag)
        c.drawCircle(cx, cy, r * (0.6f + 0.4f * enter), p)
        p.shader = null; p.clearShadowLayer()
        p.color = Dw.alpha(Color.WHITE, bgA); p.strokeWidth = dp(2.6f); p.style = Paint.Style.STROKE; p.strokeCap = Paint.Cap.ROUND
        c.drawLine(cx - dp(9), cy, cx + dp(9), cy, p); c.drawLine(cx, cy - dp(9), cx, cy + dp(9), p)
        p.style = Paint.Style.FILL
    }
    var bottomInset = 0f
    private fun contentTopInsetBottom() = bottomInset

    private fun lerpRect(a: RectF, b: RectF, t: Float) {
        a.set(a.left + (b.left - a.left) * t, a.top + (b.top - a.top) * t, a.right + (b.right - a.right) * t, a.bottom + (b.bottom - a.bottom) * t)
    }

    private fun drawCard(c: Canvas, card: Card, r: RectF, tilt: Float, alpha: Float) {
        c.save()
        /* Perspektive: Karte kippt nach hinten, beim Wischen dreht sie sich mit */
        cam.save(); cam.rotateX(tilt * Dw.amp); cam.rotateY(-card.dx / width * 25f); cam.getMatrix(mtx); cam.restore()
        val cx = r.centerX() + card.dx; val cy = r.top
        mtx.preTranslate(-cx, -cy); mtx.postTranslate(cx, cy)
        c.concat(mtx)
        c.translate(card.dx, 0f)
        c.rotate(card.dx / width * 12f, r.centerX(), r.centerY())
        val fade = (1f - abs(card.dx) / width).coerceIn(0f, 1f) * alpha
        val rad = dp(22) * (1 - if (card.id == zoomId) zoom else 0f)
        /* Glow */
        p.color = Dw.alpha(if (card.active) Dw.mag else Color.BLACK, (if (card.active) 0.55f else 0.6f) * fade)
        p.setShadowLayer(dp(if (card.active) 26 else 18), 0f, dp(6), p.color)
        c.drawRoundRect(r, rad, rad, p)
        p.clearShadowLayer()
        /* Vorschau */
        val bmp = card.thumb
        if (bmp != null && !bmp.isRecycled) {
            val sh = BitmapShader(bmp, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
            val sm = Matrix(); val s = max(r.width() / bmp.width, r.height() / bmp.height)
            sm.setScale(s, s); sm.postTranslate(r.left, r.top); sh.setLocalMatrix(sm)
            p.shader = sh; p.alpha = (255 * fade).toInt()
            c.drawRoundRect(r, rad, rad, p)
            p.shader = null
        } else { p.color = Dw.alpha(Dw.SURFACE, fade); c.drawRoundRect(r, rad, rad, p) }
        val ui = (1 - if (card.id == zoomId) zoom else 0f) * fade
        if (ui > 0.02f) {
            /* Titelleiste */
            p.shader = LinearGradient(0f, r.top, 0f, r.top + dp(64), intArrayOf(Dw.alpha(Dw.BG, 0.92f * ui), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
            c.drawRoundRect(r.left, r.top, r.right, r.top + dp(64), rad, rad, p); p.shader = null
            txt.typeface = Dw.sansBold; txt.textSize = dp(14); txt.color = Dw.alpha(Color.WHITE, ui)
            c.drawText(ellipsize(card.title, r.width() - dp(80)), r.left + dp(16), r.top + dp(26), txt)
            txt.typeface = Dw.mono; txt.textSize = dp(9.5f); txt.color = Dw.alpha(Dw.pink, ui); txt.letterSpacing = 0.12f
            c.drawText(card.host.uppercase(), r.left + dp(16), r.top + dp(42), txt); txt.letterSpacing = 0f
            /* Schließen */
            val xr = dp(14); val xx = r.right - dp(26); val xy = r.top + dp(24)
            p.color = Dw.alpha(Color.WHITE, 0.12f * ui); c.drawCircle(xx, xy, xr, p)
            p.color = Dw.alpha(Color.WHITE, ui); p.style = Paint.Style.STROKE; p.strokeWidth = dp(1.8f); p.strokeCap = Paint.Cap.ROUND
            c.drawLine(xx - dp(5), xy - dp(5), xx + dp(5), xy + dp(5), p); c.drawLine(xx + dp(5), xy - dp(5), xx - dp(5), xy + dp(5), p)
            /* Rand – aktiver Tab leuchtet im Akzent */
            p.strokeWidth = dp(if (card.active) 2f else 1f)
            p.shader = if (card.active) LinearGradient(r.left, r.top, r.right, r.bottom, intArrayOf(Dw.vio, Dw.mag, Dw.pink), null, Shader.TileMode.CLAMP) else null
            if (!card.active) p.color = Dw.alpha(Color.WHITE, 0.1f * ui)
            c.drawRoundRect(r, rad, rad, p)
            p.shader = null; p.style = Paint.Style.FILL
        }
        c.restore()
    }

    private fun ellipsize(s: String, w: Float): String {
        if (txt.measureText(s) <= w) return s
        var t = s
        while (t.length > 1 && txt.measureText("$t…") > w) t = t.dropLast(1)
        return "$t…"
    }

    /* ===== Gesten ===== */
    private fun hit(x: Float, y: Float): Int {
        for (i in cards.indices.reversed()) { if (cards[i].gone) continue; slot(i, rect); if (rect.contains(x, y)) return i }
        return -1
    }
    private val gd = GestureDetector(ctx, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent): Boolean { scroller.forceFinished(true); swipe = null; swipeAxis = 0; return true }
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            if (plusR.contains(e.x, e.y)) { Haptic.play("tick"); cb.newTab(); return true }
            val i = hit(e.x, e.y)
            if (i < 0) { hide(); return true }
            slot(i, rect)
            if (e.x > rect.right - dp(52) && e.y < rect.top + dp(50)) { kill(cards[i], 0f); return true }
            openCard(cards[i]); return true
        }
        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dX: Float, dY: Float): Boolean {
            if (swipeAxis == 0) {
                swipeAxis = if (abs(dX) > abs(dY)) 1 else 2
                if (swipeAxis == 1 && e1 != null) { val i = hit(e1.x, e1.y); swipe = if (i >= 0) cards[i] else null; if (swipe == null) swipeAxis = 2 }
            }
            if (swipeAxis == 1) swipe?.let { it.dx -= dX } else scrollY = (scrollY + dY).coerceIn(0f, maxScroll)
            invalidate(); return true
        }
        override fun onFling(e1: MotionEvent?, e2: MotionEvent, vX: Float, vY: Float): Boolean {
            if (swipeAxis == 1) { swipe?.let { if (abs(vX) > dp(900)) { kill(it, vX); swipe = null } } }
            else { scroller.fling(0, scrollY.toInt(), 0, -vY.toInt(), 0, 0, 0, maxScroll.toInt()); postInvalidateOnAnimation() }
            return true
        }
    })

    override fun onTouchEvent(e: MotionEvent): Boolean {
        if (zoomId >= 0) return true
        val r = gd.onTouchEvent(e)
        if (e.actionMasked == MotionEvent.ACTION_UP || e.actionMasked == MotionEvent.ACTION_CANCEL) {
            swipe?.let { s ->
                if (abs(s.dx) > width * 0.33f) kill(s, s.dx) else animator(s.dx, 0f, if (Dw.on) 420 else 1) { s.dx = it; invalidate() }
            }
            swipe = null
        }
        return r || true
    }

    /* Karte zerfällt in Partikel und der Tab wird geschlossen */
    private fun kill(card: Card, dir: Float) {
        val i = cards.indexOf(card)
        slot(i, rect)
        Haptic.play("boom")
        val sx = if (dir == 0f) 0f else if (dir > 0) width * 0.15f else -width * 0.15f
        fx.shatter(card.thumb, rect.left + card.dx + sx, rect.top, rect.width(), rect.height())
        card.gone = true
        cb.close(card.id)
        if (cards.none { !it.gone }) { hide(); return }
        /* Die übrigen Karten rücken mit Feder nach */
        val list = cards.filter { !it.gone }
        val oldScroll = scrollY
        cards = ArrayList(list)
        animator(oldScroll, oldScroll.coerceIn(0f, maxScroll), 380) { scrollY = it; invalidate() }
    }

    private fun openCard(card: Card) {
        zoomId = card.id
        Haptic.play("fire")
        animator(0f, 1f, if (Dw.on) 380 else 1, { cb.open(card.id); visibility = INVISIBLE; bgA = 0f; zoomId = -1 }) { zoom = it; bgA = 1 - it * 0.6f; invalidate() }
    }
}
