package com.dulidanstudios.web

/* Dulidan Web Android · Rechner: sicherer Parser (gleiche Regeln wie Desktop calc.js) + Panel, das von oben einfällt */

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.abs

object Calc {
    private class Tok(val t: Char, val n: Double = 0.0, val s: String = "")
    private val FUN: Map<String, (Double) -> Double> = mapOf(
        "sqrt" to { x -> Math.sqrt(x) }, "√" to { x -> Math.sqrt(x) }, "ln" to { x -> Math.log(x) }, "log" to { x -> Math.log10(x) }, "abs" to { x -> abs(x) },
        "sin" to { x -> Math.sin(Math.toRadians(x)) }, "cos" to { x -> Math.cos(Math.toRadians(x)) }, "tan" to { x -> Math.tan(Math.toRadians(x)) }
    )
    private val NUM = Regex("^\\d*\\.?\\d+(?:e[+-]?\\d+)?", RegexOption.IGNORE_CASE)
    private val WORD = Regex("^(sqrt|sin|cos|tan|log|ln|abs|pi|π|e|√)", RegexOption.IGNORE_CASE)

    private fun tokenize(src: String): List<Tok> {
        val s = src.replace(Regex("\\s+"), "").replace(Regex("×|x(?=[\\d(])"), "*").replace(Regex("÷|:"), "/").replace("−", "-").replace(",", ".")
        val out = ArrayList<Tok>()
        var i = 0
        while (i < s.length) {
            val c = s[i]; val rest = s.substring(i)
            val num = NUM.find(rest)
            if ((c.isDigit() || c == '.') && num != null) { out.add(Tok('n', num.value.toDouble())); i += num.value.length; continue }
            val w = WORD.find(rest)
            if (w != null) {
                when (val k = w.value.lowercase()) { "pi", "π" -> out.add(Tok('n', Math.PI)); "e" -> out.add(Tok('n', Math.E)); else -> out.add(Tok('f', s = k)) }
                i += w.value.length; continue
            }
            if ("+-*/%^()!".indexOf(c) >= 0) { out.add(Tok('o', s = c.toString())); i++; continue }
            throw IllegalArgumentException("Zeichen $c")
        }
        return out
    }

    /* Summe → Produkt → Vorzeichen → Potenz → Fakultät → Faktor (−3^2 = −9, 2^3^2 = 512, 200*15% = 30) */
    fun evaluate(src: String): Double {
        val tk = tokenize(src)
        var p = 0
        fun peek() = tk.getOrNull(p)
        fun take() = tk.getOrNull(p++)
        fun isOp(v: String) = peek()?.let { it.t == 'o' && it.s == v } == true
        fun startsFactor() = peek()?.let { it.t == 'n' || it.t == 'f' } == true || isOp("(")
        lateinit var sum: () -> Double
        lateinit var unary: () -> Double
        fun atom(): Double {
            val t = take() ?: throw IllegalArgumentException("Ende")
            return when {
                t.t == 'n' -> t.n
                t.t == 'f' -> FUN.getValue(t.s)(if (isOp("(")) atom() else unary())
                t.s == "(" -> { val v = sum(); if (isOp(")")) take(); v }
                else -> throw IllegalArgumentException("Unerwartet ${t.s}")
            }
        }
        fun post(): Double {
            var v = atom()
            while (isOp("!")) {
                take(); if (v < 0 || v > 170 || v % 1 != 0.0) throw IllegalArgumentException("!")
                var f = 1.0; for (k in 2..v.toInt()) f *= k; v = f
            }
            return v
        }
        fun pow(): Double { val b = post(); return if (isOp("^")) { take(); Math.pow(b, unary()) } else b }
        unary = { if (isOp("-")) { take(); -unary() } else if (isOp("+")) { take(); unary() } else pow() }
        fun prod(): Double {
            var v = unary()
            while (true) {
                when {
                    isOp("*") -> { take(); v *= unary() }
                    isOp("/") -> { take(); v /= unary() }
                    isOp("%") -> { take(); v = if (startsFactor()) v % unary() else v / 100 }
                    startsFactor() -> v *= pow()      /* 2π, 3(4+1) */
                    else -> return v
                }
            }
        }
        sum = {
            var v = prod()
            while (isOp("+") || isOp("-")) v = if (take()!!.s == "+") v + prod() else v - prod()
            v
        }
        val v = sum()
        if (p < tk.size) throw IllegalArgumentException("Rest")
        if (v.isNaN() || v.isInfinite()) throw IllegalArgumentException("Unendlich")
        return v
    }

    private val MATH = Regex("^[\\d\\s.,+\\-*/×÷:%^()!πe√a-z]*$", RegexOption.IGNORE_CASE)
    private val OPS = Regex("[+\\-*/×÷:%^!√]|sqrt|sin|cos|tan|log|ln|pi|π", RegexOption.IGNORE_CASE)
    fun looksLikeMath(s: String): Boolean {
        val t = s.trim()
        if (t.length < 2 || !MATH.matches(t) || !t.any { it.isDigit() }) return false
        /* Buchstaben nur als bekannte Funktion/Konstante, sonst ist es eine Suche */
        if (t.lowercase().replace(Regex("sqrt|sin|cos|tan|log|ln|abs|pi|e|x"), "").any { it in 'a'..'z' }) return false
        return OPS.containsMatchIn(t.removePrefix("-"))
    }
    fun tryCalc(s: String): Double? = try { if (looksLikeMath(s)) evaluate(s) else null } catch (_: Exception) { null }

    private val FMT = DecimalFormat("#,##0.##########", DecimalFormatSymbols(Locale.GERMANY))
    fun format(v: Double): String {
        if (abs(v) >= 1e15 || (abs(v) < 1e-9 && v != 0.0)) return String.format(Locale.GERMANY, "%.6e", v)
        return FMT.format(java.math.BigDecimal(v).round(java.math.MathContext(12)).toDouble())
    }
    fun copy(ctx: Context, text: String) {
        (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Ergebnis", text))
    }
}

/* ===================== Rechner-Panel (fällt von oben ein) ===================== */
class CalcPanel(ctx: Context, private val fx: FxView, private val toast: (String) -> Unit) : FrameLayout(ctx) {
    private val scrim = View(ctx).apply { setBackgroundColor(Color.BLACK); alpha = 0f }
    private val card = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        background = GradientDrawable().apply { cornerRadii = floatArrayOf(0f, 0f, 0f, 0f, dp(30), dp(30), dp(30), dp(30)); setColor(0xFA0D0B14.toInt()); setStroke(dp(1).toInt(), Dw.alpha(Dw.mag, 0.45f)) }
        elevation = dp(24)
    }
    private val exprV = text("0", 15f, Dw.MUTED, mono = true).apply { gravity = Gravity.END; maxLines = 1 }
    private val exprScroll = HorizontalScrollView(ctx).apply { isHorizontalScrollBarEnabled = false; addView(exprV) }
    private val outV = text("0", 46f, Dw.TEXT, bold = true).apply { gravity = Gravity.END; maxLines = 1; letterSpacing = -0.03f; setShadowLayer(dp(18), 0f, 0f, Dw.alpha(Dw.mag, 0.8f)) }
    private val histRow = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
    private val keys = ArrayList<TextView>()
    private var expr = ""
    private val hist = ArrayList<Pair<String, Double>>()
    var topInset = 0
        set(v) { field = v; card.setPadding(dp(16).toInt(), v + dp(12).toInt(), dp(16).toInt(), dp(18).toInt()) }
    val open get() = visibility == VISIBLE

    private val KEYS = listOf(
        "sin" to "fn", "cos" to "fn", "tan" to "fn", "^" to "op", "√" to "fn",
        "(" to "op", ")" to "op", "%" to "op", "÷" to "op", "C" to "clr",
        "7" to "", "8" to "", "9" to "", "×" to "op", "⌫" to "clr",
        "4" to "", "5" to "", "6" to "", "−" to "op", "π" to "fn",
        "1" to "", "2" to "", "3" to "", "+" to "op", "!" to "op",
        "±" to "op", "0" to "", "," to "op", "=" to "eq"
    )

    private fun text(s: String, size: Float, color: Int, mono: Boolean = false, bold: Boolean = false) = TextView(context).apply {
        text = s; setTextColor(color); setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
        typeface = if (mono) (if (bold) Dw.monoBold else Dw.mono) else (if (bold) Dw.sansBold else Dw.sans)
    }
    private fun bg(fill: Int, stroke: Int, r: Float) = GradientDrawable().apply { cornerRadius = dp(r); setColor(fill); setStroke(dp(1).toInt(), stroke) }

    init {
        visibility = GONE
        addView(scrim, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        addView(card, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.TOP))
        scrim.setOnClickListener { hide() }
        card.isClickable = true
        topInset = 0

        /* Kopf: Titel, Kopieren, Schließen */
        val head = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        head.addView(text("// RECHNER", 10f, Dw.pink, mono = true, bold = true).apply { letterSpacing = 0.22f }, LinearLayout.LayoutParams(0, -2, 1f))
        head.addView(text("⧉ KOPIEREN", 10f, Dw.MUTED, mono = true, bold = true).apply {
            letterSpacing = 0.14f; setPadding(dp(12).toInt(), dp(8).toInt(), dp(12).toInt(), dp(8).toInt()); background = bg(0xFF171323.toInt(), Dw.alpha(Color.WHITE, 0.08f), 12f)
            pressable { val t = outV.text.toString(); if (t != "…") { Calc.copy(context, t); toast("Ergebnis kopiert: $t") } }
        })
        head.addView(text("✕", 16f, Dw.MUTED, bold = true).apply { gravity = Gravity.CENTER; pressable { hide() } }, LinearLayout.LayoutParams(dp(40).toInt(), dp(40).toInt()).apply { leftMargin = dp(6).toInt() })
        card.addView(head)

        /* Anzeige */
        val screen = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(16).toInt(), dp(12).toInt(), dp(16).toInt(), dp(10).toInt())
            background = bg(0xFF120F1C.toInt(), Dw.alpha(Dw.mag, 0.4f), 20f)
        }
        screen.addView(exprScroll, LinearLayout.LayoutParams(-1, -2))
        screen.addView(outV, LinearLayout.LayoutParams(-1, -2))
        card.addView(screen, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10).toInt() })
        card.addView(HorizontalScrollView(ctx).apply { isHorizontalScrollBarEnabled = false; addView(histRow) }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8).toInt() })

        /* Tasten: 5 Spalten, "=" doppelt breit */
        var row: LinearLayout? = null
        var col = 0
        for ((k, kind) in KEYS) {
            if (row == null || col >= 5) { row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }; card.addView(row, LinearLayout.LayoutParams(-1, dp(54).toInt()).apply { topMargin = dp(7).toInt() }); col = 0 }
            val span = if (k == "=") 2 else 1
            val b = text(k, if (kind == "fn" && k.length > 1) 14f else 20f, when (kind) { "op" -> Dw.pink; "clr" -> 0xFFFF6B8A.toInt(); "fn" -> Dw.MUTED; else -> Dw.TEXT }, mono = kind == "fn" && k.length > 1, bold = kind != "fn").apply {
                gravity = Gravity.CENTER
                background = if (kind == "eq") GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Dw.vio, Dw.mag)).apply { cornerRadius = dp(16) }
                    else bg(if (kind == "") 0xFF1A1627.toInt() else 0xFF141120.toInt(), Dw.alpha(Color.WHITE, 0.07f), 16f)
                if (kind == "eq") { setTextColor(Color.WHITE); elevation = dp(8) }
                pressable(0.84f) { press(k, this) }
            }
            keys.add(b)
            row.addView(b, LinearLayout.LayoutParams(0, -1, span.toFloat()).apply { marginStart = dp(3.5f).toInt(); marginEnd = dp(3.5f).toInt() })
            col += span
        }
        /* Wischen nach oben schließt */
        var y0 = 0f
        card.setOnTouchListener { _, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> y0 = e.rawY
                MotionEvent.ACTION_MOVE -> card.translationY = (e.rawY - y0).coerceAtMost(0f)
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> if (card.translationY < -dp(70)) hide() else card.animate().translationY(0f).setDuration(400).setInterpolator(Spring()).start()
            }
            true
        }
        live()
    }

    private fun press(k: String, v: View) {
        when (k) {
            "C" -> expr = ""
            "⌫" -> expr = expr.dropLast(1)
            "=" -> return equals(v)
            "±" -> expr = if (expr.startsWith("-(") && expr.endsWith(")")) expr.substring(2, expr.length - 1) else if (expr.isNotEmpty()) "-($expr)" else "-"
            "sin", "cos", "tan", "√" -> expr += "$k("
            else -> expr += k
        }
        live()
    }
    private fun live() {
        exprV.text = expr.ifEmpty { "0" }
        exprScroll.post { exprScroll.fullScroll(View.FOCUS_RIGHT) }
        val v = try { if (expr.isEmpty()) null else Calc.evaluate(expr) } catch (_: Exception) { null }
        outV.text = if (v == null) (if (expr.isEmpty()) "0" else "…") else Calc.format(v)
        outV.setTextColor(if (v == null && expr.isNotEmpty()) Dw.DIM else Dw.TEXT)
        val len = outV.text.length
        outV.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (len > 14) 30f else if (len > 10) 38f else 46f)
    }
    private fun equals(v: View) {
        val r = try { Calc.evaluate(expr) } catch (_: Exception) {
            Haptic.play("shock")
            outV.animate().translationX(dp(12)).setDuration(50).withEndAction { outV.translationX = -dp(12); outV.animate().translationX(0f).setDuration(500).setInterpolator(Spring(7f, 30f)).start() }.start()
            return
        }
        hist.add(0, expr to r); while (hist.size > 8) hist.removeAt(hist.size - 1)
        expr = Calc.format(r).replace(".", "")
        live(); renderHist()
        Haptic.play("fire")
        if (Dw.on) {
            val loc = IntArray(2); v.getLocationInWindow(loc)
            fx.burst(loc[0] + v.width / 2f, loc[1] + v.height / 2f, 70, 9f)
            outV.scaleX = 1.25f; outV.scaleY = 1.25f; outV.pivotX = outV.width.toFloat(); outV.pivotY = outV.height / 2f
            outV.animate().scaleX(1f).scaleY(1f).setDuration(700).setInterpolator(Spring()).start()
        }
    }
    private fun renderHist() {
        histRow.removeAllViews()
        hist.forEachIndexed { i, (e, r) ->
            histRow.addView(text("$e = ${Calc.format(r)}", 11f, Dw.MUTED, mono = true).apply {
                setPadding(dp(10).toInt(), dp(6).toInt(), dp(10).toInt(), dp(6).toInt()); background = bg(0xFF141120.toInt(), Dw.alpha(Dw.mag, 0.25f), 10f)
                pressable(0.94f) { expr = e; live() }
            }, LinearLayout.LayoutParams(-2, -2).apply { marginEnd = dp(6).toInt() })
            if (i == 0) histRow.getChildAt(0).staggerIn(0, 0f)
        }
    }

    fun show(start: String? = null) {
        if (start != null) expr = start
        live()
        visibility = VISIBLE
        Haptic.play("fire")
        scrim.animate().alpha(0.55f).setDuration(260).start()
        if (!Dw.on) { card.translationY = 0f; return }
        card.post {
            card.translationY = -card.height.toFloat()
            card.animate().translationY(0f).setDuration(720).setInterpolator(Spring(6f, 10f)).start()
            keys.forEachIndexed { i, k -> k.alpha = 0f; k.scaleX = 0.5f; k.scaleY = 0.5f; k.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(120L + i * 14L).setDuration(520).setInterpolator(Spring()).start() }
        }
    }
    fun hide() {
        if (!open) return
        scrim.animate().alpha(0f).setDuration(240).start()
        card.animate().translationY(-card.height.toFloat() - dp(20)).setDuration(if (Dw.on) 300 else 1).withEndAction { visibility = GONE; card.translationY = 0f }.start()
    }
}
