package com.dulidanstudios.web

/* Dulidan Web Android · Untere Leiste (für den Daumen)
   [Start] [ Adress-Pille mit Energiestrahl + Werbeblocker-Zähler ] [Tabs] [Menü] – darüber eine leuchtende Ladelinie */

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.SweepGradient
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.min

/* Gezeichnete Icons, damit keine Vektor-Ressourcen nötig sind */
class IconBtn(ctx: Context, private val kind: String) : View(ctx) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    var count = 1; set(v) { field = v; invalidate() }
    var lit = false; set(v) { field = v; invalidate() }
    private val path = Path()

    override fun onDraw(c: Canvas) {
        val w = width.toFloat(); val h = height.toFloat(); val cx = w / 2; val cy = h / 2; val u = dp(1)
        p.strokeWidth = dp(1.9f); p.color = if (lit) Dw.pink else Dw.TEXT; p.style = Paint.Style.STROKE
        p.setShadowLayer(if (lit) dp(8) else 0f, 0f, 0f, Dw.mag)
        when (kind) {
            "home" -> { path.reset(); path.moveTo(cx - 8 * u, cy - 1 * u); path.lineTo(cx, cy - 8 * u); path.lineTo(cx + 8 * u, cy - 1 * u)
                path.moveTo(cx - 6 * u, cy - 2 * u); path.lineTo(cx - 6 * u, cy + 8 * u); path.lineTo(cx + 6 * u, cy + 8 * u); path.lineTo(cx + 6 * u, cy - 2 * u); c.drawPath(path, p) }
            "tabs" -> { val r = RectF(cx - 9 * u, cy - 9 * u, cx + 9 * u, cy + 9 * u); p.color = Dw.TEXT; c.drawRoundRect(r, 5 * u, 5 * u, p)
                p.style = Paint.Style.FILL; p.textAlign = Paint.Align.CENTER; p.typeface = Dw.monoBold; p.textSize = dp(if (count > 9) 9 else 11); p.setShadowLayer(0f, 0f, 0f, 0)
                c.drawText(if (count > 99) ":D" else "$count", cx, cy + p.textSize * 0.36f, p) }
            "menu" -> { p.style = Paint.Style.FILL; for (k in -1..1) c.drawCircle(cx, cy + k * 6.5f * u, 2.1f * u, p) }
        }
    }
}

class OmniPill(ctx: Context) : FrameLayout(ctx) {
    private val bg = Paint(Paint.ANTI_ALIAS_FLAG)
    private val beamP = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val r = RectF()
    private val m = Matrix()
    var angle = 0f
    var boost = 0f
    var focused = false
    var progress = 0f; set(v) { field = v; invalidate() }
    private var shader: SweepGradient? = null
    private var lastW = 0

    val input = EditText(ctx).apply {
        background = null
        setTextColor(Dw.TEXT); setHintTextColor(Dw.DIM); hint = "Suche oder Adresse"
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f); typeface = Dw.sans
        isSingleLine = true; maxLines = 1
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        imeOptions = EditorInfo.IME_ACTION_GO or EditorInfo.IME_FLAG_NO_EXTRACT_UI
        setSelectAllOnFocus(true)
        setPadding(dp(16).toInt(), 0, dp(54).toInt(), 0)
        highlightColor = Dw.alpha(Dw.mag, 0.4f)
    }
    val shield = TextView(ctx).apply {
        setTextColor(Dw.OK); typeface = Dw.monoBold; setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f); gravity = Gravity.CENTER
        setPadding(dp(7).toInt(), 0, dp(7).toInt(), 0)
        background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(8); setStroke(dp(1).toInt(), Dw.alpha(Dw.OK, 0.35f)); setColor(Dw.alpha(Dw.OK, 0.08f)) }
        visibility = View.GONE
    }

    init {
        setWillNotDraw(false)
        addView(input, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        addView(shield, LayoutParams(LayoutParams.WRAP_CONTENT, dp(24).toInt(), Gravity.END or Gravity.CENTER_VERTICAL).apply { rightMargin = dp(10).toInt() })
        input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) { if (input.hasFocus()) boost = min(boost + 520f, 2800f) }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    fun shader(): SweepGradient {
        if (shader == null || lastW != width) {
            lastW = width
            val t = Color.TRANSPARENT
            shader = SweepGradient(width / 2f, height / 2f,
                intArrayOf(t, t, Dw.alpha(Dw.vio, 0.5f), Dw.mag, Dw.pink, Color.WHITE, t),
                floatArrayOf(0f, 0.55f, 0.72f, 0.87f, 0.95f, 0.985f, 1f))
        }
        return shader!!
    }
    fun resetShader() { shader = null; invalidate() }

    override fun onDraw(c: Canvas) {
        val rad = height / 2f
        r.set(dp(1), dp(1), width - dp(1), height - dp(1))
        bg.style = Paint.Style.FILL; bg.color = if (focused) 0xF20C0A13.toInt() else 0xE6100D18.toInt()
        c.drawRoundRect(r, rad, rad, bg)
        bg.style = Paint.Style.STROKE; bg.strokeWidth = dp(1); bg.color = Dw.alpha(Dw.mag, if (focused) 0.15f else 0.3f)
        c.drawRoundRect(r, rad, rad, bg)
        /* Energiestrahl: rotierender Sweep-Verlauf als Rand, darunter weichere Glow-Spuren */
        val sh = shader()
        m.setRotate(angle, width / 2f, height / 2f); sh.setLocalMatrix(m)
        beamP.shader = sh
        val strength = if (focused) 1f else 0.55f
        for ((wd, a) in listOf(dp(9) to 0.12f, dp(5) to 0.22f, dp(2) to 1f)) {
            beamP.strokeWidth = wd; beamP.alpha = (a * strength * 255).toInt()
            c.drawRoundRect(r, rad, rad, beamP)
        }
        /* Ladelinie unten in der Pille */
        if (progress in 0.01f..0.999f) {
            bg.style = Paint.Style.FILL
            val x1 = r.left + rad * 0.6f; val x2 = x1 + (r.width() - rad * 1.2f) * progress
            bg.shader = LinearGradient(x1, 0f, x2, 0f, intArrayOf(Dw.vio, Dw.mag, Dw.pink), null, Shader.TileMode.CLAMP)
            c.drawRoundRect(x1, r.bottom - dp(3), x2, r.bottom - dp(1), dp(1), dp(1), bg)
            bg.shader = null; bg.color = Color.WHITE
            c.drawCircle(x2, r.bottom - dp(2), dp(2.4f), bg)
        }
    }
}

class BottomBar(ctx: Context) : LinearLayout(ctx) {
    val home = IconBtn(ctx, "home")
    val pill = OmniPill(ctx)
    val tabs = IconBtn(ctx, "tabs")
    val menu = IconBtn(ctx, "menu")
    private val line = Paint(Paint.ANTI_ALIAS_FLAG)
    private val fill = Paint()
    var progress = 0f; set(v) { field = v; pill.progress = v; invalidate() }
    private val spin = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 1000; repeatCount = ValueAnimator.INFINITE; interpolator = LinearInterpolator()
        var lastT = System.nanoTime()
        addUpdateListener {
            val now = System.nanoTime(); val dt = ((now - lastT) / 1e9f).coerceIn(0f, 0.05f); lastT = now
            pill.boost *= Math.pow(0.12, dt.toDouble()).toFloat()
            val speed = if (!Dw.on) 0f else (if (pill.focused) 90f else 28f) + pill.boost
            pill.angle = (pill.angle + speed * dt) % 360f
            pill.invalidate()
        }
    }

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setWillNotDraw(false)
        val s = dp(48).toInt()
        setPadding(dp(8).toInt(), dp(10).toInt(), dp(8).toInt(), dp(10).toInt())
        addView(home, LayoutParams(s, s))
        addView(pill, LayoutParams(0, dp(48).toInt(), 1f).apply { leftMargin = dp(4).toInt(); rightMargin = dp(4).toInt() })
        addView(tabs, LayoutParams(s, s))
        addView(menu, LayoutParams(s, s))
    }

    override fun onAttachedToWindow() { super.onAttachedToWindow(); spin.start() }
    override fun onDetachedFromWindow() { spin.cancel(); super.onDetachedFromWindow() }

    override fun onDraw(c: Canvas) {
        val w = width.toFloat()
        fill.shader = LinearGradient(0f, 0f, 0f, height.toFloat(), intArrayOf(0xE60B0911.toInt(), 0xFA07060B.toInt()), null, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, height.toFloat(), fill)
        line.shader = LinearGradient(0f, 0f, w, 0f, intArrayOf(Color.TRANSPARENT, Dw.alpha(Dw.mag, 0.7f), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
        line.strokeWidth = dp(1)
        c.drawLine(0f, 0f, w, 0f, line)
        if (progress in 0.01f..0.999f) {
            line.shader = LinearGradient(0f, 0f, w * progress, 0f, intArrayOf(Dw.vio, Dw.mag, Dw.pink), null, Shader.TileMode.CLAMP)
            line.strokeWidth = dp(2.5f)
            c.drawLine(0f, dp(1), w * progress, dp(1), line)
        }
    }
}
