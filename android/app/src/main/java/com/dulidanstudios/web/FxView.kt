package com.dulidanstudios.web

/* Dulidan Web Android · Partikel-Engine
   - burst(): Funkenexplosion
   - shatter(): ein Bild (z. B. Tab-Karte) zerfällt in Splitter
   - morph(): Seitenwechsel – altes Seitenfoto zerfällt, fliegt zum Dulidan-D, D explodiert und gibt per
     wachsendem Kreis die neue Seite darunter frei */

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

class FxView(ctx: Context) : View(ctx) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    /* ===== Freie Partikel ===== */
    private val cap = 4000
    private val px = FloatArray(cap); private val py = FloatArray(cap)
    private val vx = FloatArray(cap); private val vy = FloatArray(cap)
    private val life = FloatArray(cap); private val maxLife = FloatArray(cap)
    private val size = FloatArray(cap); private val col = IntArray(cap); private val grav = FloatArray(cap)
    private val sq = BooleanArray(cap)
    private var n = 0
    private var last = 0L

    private fun palette() = intArrayOf(Dw.vio, Dw.mag, Dw.pink, Dw.pink, Color.WHITE)

    private fun add(x: Float, y: Float, vX: Float, vY: Float, l: Float, s: Float, c: Int, g: Float, square: Boolean) {
        if (n >= cap) return
        px[n] = x; py[n] = y; vx[n] = vX; vy[n] = vY; life[n] = 0f; maxLife[n] = l; size[n] = s; col[n] = c; grav[n] = g; sq[n] = square
        n++
    }

    fun burst(x: Float, y: Float, count: Int = 60, speed: Float = 9f) {
        if (!Dw.on) return
        val pal = palette()
        val k = dp(1)
        repeat((count * (0.4f + Dw.amp * 0.6f)).toInt()) {
            val a = Random.nextFloat() * 2f * PI.toFloat()
            val v = (0.3f + Random.nextFloat()) * speed * k * (0.5f + Dw.amp * 0.5f)
            add(x, y, cos(a) * v, sin(a) * v, 0.6f + Random.nextFloat() * 0.6f, (1.2f + Random.nextFloat() * 2.4f) * k, pal[Random.nextInt(pal.size)], 0.12f * k, false)
        }
        kick()
    }

    /* Bild zerfällt in Splitter (Bitmap wird an die Bildschirm-Position x/y mit Größe w/h gelegt) */
    fun shatter(bmp: Bitmap?, x: Float, y: Float, w: Float, h: Float) {
        if (!Dw.on) return
        val step = max(dp(7), sqrt(w * h / 2600f))
        val cols = max(1, (w / step).toInt()); val rows = max(1, (h / step).toInt())
        val small = bmp?.let { Bitmap.createScaledBitmap(it, cols, rows, true) }
        val pal = palette()
        val cx = x + w / 2; val cy = y + h / 2
        for (j in 0 until rows) for (i in 0 until cols) {
            val sx = x + (i + 0.5f) * step; val sy = y + (j + 0.5f) * step
            val dx = sx - cx; val dy = sy - cy; val d = max(1f, hypot(dx, dy))
            val c = small?.getPixel(i, j) ?: pal[Random.nextInt(3)]
            add(sx, sy, dx / d * (1f + Random.nextFloat() * 6f) * dp(1) * Dw.amp + (Random.nextFloat() - 0.5f) * dp(2),
                -Random.nextFloat() * dp(5) * Dw.amp + dy / d * dp(1), 0.9f + Random.nextFloat() * 0.8f, step * 0.9f, c, 0.25f * dp(1), true)
        }
        small?.recycle()
        kick()
    }

    /* ===== Morph (Seitenwechsel) ===== */
    private var logoPts: FloatArray? = null
    private fun logo(): FloatArray {
        logoPts?.let { return it }
        val pts = ArrayList<Float>()
        try {
            val b = context.assets.open("logo-mark.webp").use { BitmapFactory.decodeStream(it) }
            val s = Bitmap.createScaledBitmap(b, 150, 150, true)
            for (y in 0 until 150 step 2) for (x in 0 until 150 step 2) if (Color.alpha(s.getPixel(x, y)) > 140) { pts.add(x / 150f * 2 - 1); pts.add(y / 150f * 2 - 1) }
            s.recycle(); b.recycle()
        } catch (_: Exception) {}
        if (pts.isEmpty()) repeat(400) { val a = it / 400f * 6.283f; pts.add(cos(a) * 0.8f); pts.add(sin(a) * 0.8f) }
        return pts.toFloatArray().also { logoPts = it }
    }

    inner class Morph(src: Bitmap?, val label: String, private val onCovered: () -> Unit, private val onDone: () -> Unit) {
        val hasSrc = src != null
        private val m: Int
        private val sx: FloatArray; private val sy: FloatArray; private val tx: FloatArray; private val ty: FloatArray
        private val r1: FloatArray; private val r2: FloatArray; private val r3: FloatArray; private val c: IntArray
        private val step: Float
        val t0 = System.nanoTime()
        private var t2 = 0L
        private var gathered = false
        private var ready = false
        private var covered = false
        var finished = false; private set
        private val hole = Path()

        init {
            val w = width.toFloat().coerceAtLeast(1f); val h = height.toFloat().coerceAtLeast(1f)
            step = max(dp(6), sqrt(w * h / (if (hasSrc) 3200f else 1800f)))
            val cols = max(1, (w / step).toInt()); val rows = max(1, (h / step).toInt())
            m = cols * rows
            sx = FloatArray(m); sy = FloatArray(m); tx = FloatArray(m); ty = FloatArray(m)
            r1 = FloatArray(m); r2 = FloatArray(m); r3 = FloatArray(m); c = IntArray(m)
            val small = src?.let { Bitmap.createScaledBitmap(it, cols, rows, true) }
            val L = logo(); val ln = L.size / 2
            val S = min(w, h) * 0.3f; val cx = w / 2; val cy = h * 0.44f
            val pal = palette()
            for (k in 0 until m) {
                val i = k % cols; val j = k / cols
                if (small != null) { sx[k] = (i + 0.5f) * step; sy[k] = (j + 0.5f) * step; c[k] = small.getPixel(i, j) }
                else { val a = Random.nextFloat() * 6.283f; val d = max(w, h) * (0.6f + Random.nextFloat() * 0.4f); sx[k] = cx + cos(a) * d; sy[k] = cy + sin(a) * d; c[k] = pal[Random.nextInt(3)] }
                val q = Random.nextInt(ln)
                tx[k] = cx + (L[q * 2] + (Random.nextFloat() - 0.5f) * 0.015f) * S
                ty[k] = cy + (L[q * 2 + 1] + (Random.nextFloat() - 0.5f) * 0.015f) * S
                r1[k] = Random.nextFloat(); r2[k] = Random.nextFloat(); r3[k] = Random.nextFloat()
            }
            small?.recycle()
            if (hasSrc) { covered = true; post { onCovered() } }
        }

        /* Seite fertig geladen → explodieren, sobald das D steht */
        fun ready() { ready = true }

        fun draw(cv: Canvas, now: Long) {
            val spd = if (Dw.anim == "normal") 0.7f else 1f
            val p1 = ((now - t0) / 1e9f / (1.15f * spd)).coerceIn(0f, 1f)
            if (p1 >= 1f && !gathered) gathered = true
            if (gathered && ready && t2 == 0L && (now - t0) / 1e9f > 1.15f * spd + 0.35f * spd) t2 = now
            val p2 = if (t2 == 0L) 0f else (1f - (1f - ((now - t2) / 1e9f / (0.85f * spd)).coerceIn(0f, 1f)).pow(3))
            val w = width.toFloat(); val h = height.toFloat(); val diag = hypot(w, h)
            /* Hintergrund deckt die Seite ab, Explosion schneidet ein wachsendes Loch hinein */
            val bgA = if (hasSrc) 1f else (p1 * 2.2f).coerceIn(0f, 1f)
            if (!covered && bgA >= 1f) { covered = true; onCovered() }
            cv.save()
            if (p2 > 0f) { hole.reset(); hole.addCircle(w / 2, h * 0.44f, p2 * diag * 0.62f, Path.Direction.CW); cv.clipOutPath(hole) }
            cv.drawColor(Dw.alpha(Dw.BG, bgA))
            cv.restore()
            if (p2 > 0f) { paint.style = Paint.Style.STROKE; paint.strokeWidth = dp(3) * (1 - p2); paint.color = Dw.alpha(Dw.pink, 1 - p2)
                cv.drawCircle(w / 2, h * 0.44f, p2 * diag * 0.62f, paint); paint.style = Paint.Style.FILL }
            val t = (now - t0) / 1e9f
            for (k in 0 until m) {
                val delay = r1[k] * 0.5f + (sy[k] / h).coerceIn(0f, 1f) * 0.35f
                var e = ((p1 * 1.55f - delay) / 0.7f).coerceIn(0f, 1f); e = e * e * (3 - 2 * e)
                val dx = tx[k] - sx[k]; val dy = ty[k] - sy[k]
                val mx = (sx[k] + tx[k]) / 2 - dy * (r2[k] - 0.5f) * 1.5f; val my = (sy[k] + ty[k]) / 2 + dx * (r2[k] - 0.5f) * 1.5f - h * 0.15f * (r3[k] - 0.3f)
                val u = 1 - e
                var x = u * u * sx[k] + 2 * u * e * mx + e * e * tx[k]
                var y = u * u * sy[k] + 2 * u * e * my + e * e * ty[k]
                x += sin(t * 3f + r2[k] * 40f) * dp(1.5f) * e; y += cos(t * 2.6f + r1[k] * 30f) * dp(1.5f) * e
                if (p2 > 0f) {
                    val ox = tx[k] - w / 2; val oy = ty[k] - h * 0.44f; val od = max(1f, hypot(ox, oy))
                    val rot = (r3[k] - 0.5f) * 1.4f
                    val ux = (ox * cos(rot) - oy * sin(rot)) / od; val uy = (ox * sin(rot) + oy * cos(rot)) / od
                    val push = (p2 * p2 * (1.2f + r2[k] * 1.8f) + p2 * 0.15f) * diag * 0.5f
                    x += ux * push; y += uy * push
                }
                val lift = sin(e * PI.toFloat())
                val s = (step + 1f + (dp(2.4f) + r3[k] * dp(2.6f) - step - 1f) * e) * (1 + lift * 0.7f) * (1 + p2 * 2f)
                val srcA = if (hasSrc) 1f else (e * 3f).coerceIn(0f, 1f)
                val a = srcA * (1 - p2 * p2)
                if (a <= 0.01f) continue
                val accent = Dw.mix(Dw.mix(Dw.vio, Dw.mag, (tx[k] / w).coerceIn(0f, 1f)), Dw.pink, r3[k] * 0.5f)
                var cc = Dw.mix(c[k], accent, (e * 1.4f).coerceIn(0f, 1f))
                cc = Dw.mix(cc, Color.WHITE, lift * 0.4f + p2 * 0.6f)
                paint.color = Dw.alpha(cc, a)
                if (e < 0.15f) cv.drawRect(x - s / 2, y - s / 2, x + s / 2, y + s / 2, paint) else cv.drawCircle(x, y, s / 2, paint)
            }
            if (gathered && t2 == 0L && label.isNotEmpty()) {
                paint.typeface = Dw.mono; paint.textSize = dp(10); paint.textAlign = Paint.Align.CENTER; paint.letterSpacing = 0.3f
                paint.color = Dw.alpha(Dw.MUTED, 0.9f)
                val cursor = if ((now / 400_000_000L) % 2 == 0L) "_" else " "
                cv.drawText(label + cursor, w / 2, h * 0.44f + min(w, h) * 0.3f + dp(42), paint)
                paint.textAlign = Paint.Align.LEFT; paint.letterSpacing = 0f
            }
            if (p2 >= 1f && !finished) { finished = true; post { onDone() } }
        }
    }

    private var morph: Morph? = null

    fun morph(src: Bitmap?, label: String, onCovered: () -> Unit, onDone: () -> Unit): Morph {
        morph?.let { if (!it.finished) { morph = null } }
        val mm = Morph(src, label, onCovered, { morph = null; onDone() })
        morph = mm
        kick()
        return mm
    }
    fun cancelMorph() { morph = null; invalidate() }
    val morphing get() = morph != null

    /* ===== Zeichnen ===== */
    private fun kick() { last = System.nanoTime(); postInvalidateOnAnimation() }

    override fun onDraw(canvas: Canvas) {
        val now = System.nanoTime()
        val dt = ((now - last) / 1e9f).coerceIn(0f, 0.05f)
        last = now
        morph?.draw(canvas, now)
        var i = 0
        while (i < n) {
            life[i] += dt
            if (life[i] >= maxLife[i]) {
                n--
                px[i] = px[n]; py[i] = py[n]; vx[i] = vx[n]; vy[i] = vy[n]; life[i] = life[n]; maxLife[i] = maxLife[n]
                size[i] = size[n]; col[i] = col[n]; grav[i] = grav[n]; sq[i] = sq[n]
                continue
            }
            val f = dt * 60f
            vx[i] *= 0.95f.pow(f); vy[i] = vy[i] * 0.95f.pow(f) + grav[i] * f
            px[i] += vx[i] * f; py[i] += vy[i] * f
            val k = 1 - life[i] / maxLife[i]
            paint.color = Dw.alpha(col[i], min(1f, k * 1.4f) * Color.alpha(col[i]) / 255f)
            val s = size[i] * (if (sq[i]) 1f else 0.4f + k * 0.6f)
            if (sq[i]) canvas.drawRect(px[i] - s / 2, py[i] - s / 2, px[i] + s / 2, py[i] + s / 2, paint) else canvas.drawCircle(px[i], py[i], s, paint)
            i++
        }
        if (n > 0 || morph != null) postInvalidateOnAnimation()
    }
}
