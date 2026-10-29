package com.dulidanstudios.web

/* Dulidan Web Android · Grundlagen: Farben, Schriften, Feder-Animation, Haptik, Drück-Effekt */

import android.animation.TimeInterpolator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
import kotlin.math.cos
import kotlin.math.exp

data class Accent(val name: String, val vio: Int, val mag: Int, val pink: Int)

object Dw {
    const val BG = 0xFF07060B.toInt()
    const val BG2 = 0xFF0C0A13.toInt()
    const val SURFACE = 0xFF110E1A.toInt()
    const val TEXT = 0xFFEFEAF7.toInt()
    const val MUTED = 0xFFA49CB6.toInt()
    const val DIM = 0xFF8A83A0.toInt()
    const val OK = 0xFF3DDC97.toInt()
    const val LINE = 0x17EFEAF7

    /* Gleiche Akzente wie die Desktop-Version */
    val ACCENTS = linkedMapOf(
        "dulidan" to Accent("Dulidan", 0xFF8122B5.toInt(), 0xFFC020B8.toInt(), 0xFFFF7AE6.toInt()),
        "cyber" to Accent("Cyber", 0xFF2A3BFF.toInt(), 0xFF00B7FF.toInt(), 0xFF7AF3FF.toInt()),
        "toxic" to Accent("Toxic", 0xFF0F8A4A.toInt(), 0xFF39E36B.toInt(), 0xFFC8FF7A.toInt()),
        "inferno" to Accent("Inferno", 0xFFB5161F.toInt(), 0xFFFF5A1F.toInt(), 0xFFFFC27A.toInt()),
        "royal" to Accent("Royal", 0xFF4B1FB5.toInt(), 0xFF8A5CFF.toInt(), 0xFFD2B8FF.toInt()),
        "ice" to Accent("Ice", 0xFF3B6B9A.toInt(), 0xFF9FD8FF.toInt(), 0xFFFFFFFF.toInt())
    )
    var vio = 0xFF8122B5.toInt(); private set
    var mag = 0xFFC020B8.toInt(); private set
    var pink = 0xFFFF7AE6.toInt(); private set

    /* "episch" | "normal" | "aus" */
    var anim = "episch"
    val amp get() = when (anim) { "aus" -> 0f; "normal" -> 0.5f; else -> 1f }
    val on get() = anim != "aus"

    lateinit var sans: Typeface; private set
    lateinit var sansBold: Typeface; private set
    lateinit var mono: Typeface; private set
    lateinit var monoBold: Typeface; private set

    fun init(ctx: Context) {
        fun font(path: String, wght: Int): Typeface = try {
            Typeface.Builder(ctx.assets, path).setFontVariationSettings("'wght' $wght").build()
        } catch (e: Exception) { Typeface.DEFAULT }
        sans = font("fonts/space-grotesk.ttf", 500)
        sansBold = font("fonts/space-grotesk.ttf", 700)
        mono = font("fonts/jetbrains-mono.ttf", 500)
        monoBold = font("fonts/jetbrains-mono.ttf", 700)
    }

    fun accent(key: String) {
        val a = ACCENTS[key] ?: ACCENTS.getValue("dulidan")
        vio = a.vio; mag = a.mag; pink = a.pink
    }

    fun hex(c: Int) = String.format("#%06X", 0xFFFFFF and c)
    fun alpha(c: Int, a: Float) = Color.argb((a.coerceIn(0f, 1f) * 255).toInt(), Color.red(c), Color.green(c), Color.blue(c))
    fun mix(a: Int, b: Int, t: Float): Int {
        val k = t.coerceIn(0f, 1f)
        return Color.argb(
            (Color.alpha(a) + (Color.alpha(b) - Color.alpha(a)) * k).toInt(),
            (Color.red(a) + (Color.red(b) - Color.red(a)) * k).toInt(),
            (Color.green(a) + (Color.green(b) - Color.green(a)) * k).toInt(),
            (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * k).toInt()
        )
    }
}

fun Context.dp(v: Number): Float = v.toFloat() * resources.displayMetrics.density
fun View.dp(v: Number): Float = context.dp(v)

/* Gedämpfte Feder als Interpolator: schießt über und schwingt aus */
class Spring(private val damping: Float = 5.5f, private val freq: Float = 12f) : TimeInterpolator {
    override fun getInterpolation(x: Float): Float = (1.0 - exp(-damping * x.toDouble()) * cos(freq * x.toDouble())).toFloat()
}

/* Haptik: kurzer Tick oder kräftiger Stoß */
object Haptic {
    private var vib: Vibrator? = null
    fun init(ctx: Context) {
        vib = if (Build.VERSION.SDK_INT >= 31) (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        else @Suppress("DEPRECATION") (ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)
    }
    fun tick(v: View) { v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP) }
    fun play(kind: String) {
        val v = vib ?: return
        if (!v.hasVibrator()) return
        val effect = when (kind) {
            "fire" -> VibrationEffect.createWaveform(longArrayOf(0, 18, 40, 30), intArrayOf(0, 200, 0, 120), -1)
            "shock" -> VibrationEffect.createOneShot(26, 170)
            "boom" -> VibrationEffect.createWaveform(longArrayOf(0, 40, 30, 60), intArrayOf(0, 255, 0, 140), -1)
            else -> VibrationEffect.createOneShot(8, 90)
        }
        try { v.vibrate(effect) } catch (_: Exception) {}
    }
}

/* Drück-Effekt für alles Antippbare: schrumpft, federt elastisch zurück, Haptik */
fun View.pressable(scaleDown: Float = 0.86f, onTap: () -> Unit) {
    isClickable = true
    setOnTouchListener { v, e ->
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                v.animate().scaleX(scaleDown).scaleY(scaleDown).setDuration(110).setInterpolator(DecelerateInterpolator()).start()
                Haptic.tick(v)
            }
            MotionEvent.ACTION_UP -> {
                v.animate().scaleX(1f).scaleY(1f).setDuration(if (Dw.on) 620 else 1).setInterpolator(Spring()).start()
                if (e.x >= 0 && e.y >= 0 && e.x <= v.width && e.y <= v.height) { v.performClick(); onTap() }
            }
            MotionEvent.ACTION_CANCEL -> v.animate().scaleX(1f).scaleY(1f).setDuration(250).start()
        }
        true
    }
}
